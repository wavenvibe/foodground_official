# VS-2 Approval B -- Facilities-only Resume Runner
# PROHIBITED: re-running completed loads, TRUNCATE of completed tables,
#             staging->public, Approval C, Vercel deploy, commit/push
# Run from project root:
#   powershell -ExecutionPolicy Bypass -File scripts\vs2_resume_facilities.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# -- Constants for URI validation -------------------------------------
$EXPECTED_PROJECT_REF = 'glczrbadvfgmblmkpgfj'
$EXPECTED_USER        = "postgres.$EXPECTED_PROJECT_REF"
if ($env:FOODGROUND_PYTHON_EXE) {
    $PYTHON_EXE = $env:FOODGROUND_PYTHON_EXE
} else {
    $pycmd = Get-Command python -ErrorAction SilentlyContinue
    if (-not $pycmd) { Write-Host '[ABORT] Python not found. Set FOODGROUND_PYTHON_EXE or add python to PATH.' -ForegroundColor Red; exit 1 }
    $PYTHON_EXE = $pycmd.Source
}
$ROOT                 = Split-Path -Parent $PSScriptRoot

$FACILITIES_SCRIPT  = 'scripts\vs2_export_facilities.py'
$STATE_CHECK_SCRIPT = 'scripts\vs2_facilities_state_check.py'
$VALIDATE_SCRIPT    = 'scripts\vs2_validate.py'
$PUBLIC_SCRIPT      = 'scripts\vs2_verify_public_empty.py'

# -- 0. File existence check ------------------------------------------
Write-Host '[CHECK] Python exe + scripts exist...' -ForegroundColor Cyan
$missing = [System.Collections.Generic.List[string]]::new()
if (-not (Test-Path $PYTHON_EXE)) { $missing.Add($PYTHON_EXE) }
foreach ($rel in @($FACILITIES_SCRIPT, $STATE_CHECK_SCRIPT, $VALIDATE_SCRIPT, $PUBLIC_SCRIPT)) {
    if (-not (Test-Path (Join-Path $ROOT $rel))) { $missing.Add($rel) }
}
if ($missing.Count -gt 0) {
    Write-Host '[ABORT] Missing files -- exiting without credential prompt:' -ForegroundColor Red
    foreach ($f in $missing) { Write-Host "  - $f" -ForegroundColor Red }
    exit 1
}
Write-Host '[OK] All required files found' -ForegroundColor Green

# -- 1. Accept URI template (plain text, no real password) ------------
Write-Host ''
Write-Host 'Supabase Dashboard -> Connect -> Session pooler -> copy the URI' -ForegroundColor Cyan
Write-Host 'The URI must contain [YOUR-PASSWORD] as the password placeholder.' -ForegroundColor Cyan
$uriTemplate = (Read-Host 'URI template').Trim()

# -- 2. Validate URI template -----------------------------------------
$uriPattern = [regex]'^postgresql://(?<user>[^:]+):\[YOUR-PASSWORD\]@(?<host>[^:]+):(?<port>\d+)/(?<db>[^?]+)(?:\?.*)?$'
$m = $uriPattern.Match($uriTemplate)
if (-not $m.Success) {
    Write-Host '[ABORT] URI format invalid. Expected: postgresql://user:[YOUR-PASSWORD]@host:port/db' -ForegroundColor Red
    exit 1
}

$vErrors = [System.Collections.Generic.List[string]]::new()
if ($m.Groups['user'].Value -ne $EXPECTED_USER) {
    $vErrors.Add("username: got '$($m.Groups['user'].Value)', expected '$EXPECTED_USER'")
}
if ($m.Groups['host'].Value -notmatch '\.pooler\.supabase\.com$') {
    $vErrors.Add("host: '$($m.Groups['host'].Value)' is not *.pooler.supabase.com")
}
if ($m.Groups['port'].Value -ne '5432') {
    $vErrors.Add("port: got '$($m.Groups['port'].Value)', expected '5432'")
}
if ($m.Groups['db'].Value -ne 'postgres') {
    $vErrors.Add("database: got '$($m.Groups['db'].Value)', expected 'postgres'")
}
if ($vErrors.Count -gt 0) {
    Write-Host '[ABORT] URI validation failed:' -ForegroundColor Red
    foreach ($e in $vErrors) { Write-Host "  - $e" -ForegroundColor Red }
    exit 1
}
Write-Host '[OK] URI validated: user / host / port / db / placeholder' -ForegroundColor Green

# -- Sensitive variable init ------------------------------------------
[SecureString]$securePw = $null
[string]$plainPw        = $null
[string]$encodedPw      = $null
[string]$dbUrl          = $null
$exitCode = 0

try {
    # -- 3. Accept password (hidden) ----------------------------------
    $securePw = Read-Host -AsSecureString -Prompt 'Supabase DB password'

    # -- 4. SecureString -> BSTR -> plaintext, immediate BSTR release -
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePw)
    try {
        $plainPw = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    } finally {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }

    # -- 5. URL-encode, discard plaintext, replace placeholder --------
    $encodedPw = [Uri]::EscapeDataString($plainPw)
    $plainPw   = $null
    $dbUrl     = $uriTemplate -replace '\[YOUR-PASSWORD\]', $encodedPw
    $encodedPw = $null

    if ($dbUrl -notmatch 'sslmode=') {
        if ($dbUrl -match '\?') { $dbUrl += '&sslmode=require' }
        else                    { $dbUrl += '?sslmode=require' }
    }

    # -- 6. Set process-scoped env var, discard URL variable ----------
    [System.Environment]::SetEnvironmentVariable('SUPABASE_DB_URL', $dbUrl, 'Process')
    $dbUrl = $null
    Write-Host '[B] SUPABASE_DB_URL set (process scope only)' -ForegroundColor Cyan

    # -- 7. Read-only state check: 6 loaded + facilities=0 -----------
    Write-Host "`n[STATE] Verifying remote state before facilities load..." -ForegroundColor Yellow
    & $PYTHON_EXE (Join-Path $ROOT $STATE_CHECK_SCRIPT)
    if ($LASTEXITCODE -ne 0) {
        throw "State mismatch (exit=$LASTEXITCODE). No writes performed. Check report above."
    }
    Write-Host '[STATE] State confirmed -- loading facilities' -ForegroundColor Green

    # -- 8. Load facilities -------------------------------------------
    Write-Host "`n[RUN] $FACILITIES_SCRIPT" -ForegroundColor Yellow
    & $PYTHON_EXE (Join-Path $ROOT $FACILITIES_SCRIPT)
    if ($LASTEXITCODE -ne 0) {
        throw "Facilities load failed (exit=$LASTEXITCODE). DO NOT TRUNCATE or re-run other tables."
    }
    Write-Host '[DONE] Facilities loaded' -ForegroundColor Green

    # -- 9. Staging full validation -----------------------------------
    Write-Host "`n[VALIDATE] vs2_validate.py --mode staging" -ForegroundColor Yellow
    & $PYTHON_EXE (Join-Path $ROOT $VALIDATE_SCRIPT) '--mode' 'staging'
    if ($LASTEXITCODE -ne 0) {
        throw "Staging validation failed (exit=$LASTEXITCODE)."
    }
    Write-Host '[DONE] Staging validation passed' -ForegroundColor Green

    # -- 10. Public 7 tables 0-row guard ------------------------------
    Write-Host "`n[CHECK] public tables 0-row guard" -ForegroundColor Yellow
    & $PYTHON_EXE (Join-Path $ROOT $PUBLIC_SCRIPT)
    if ($LASTEXITCODE -ne 0) {
        throw "Public table contamination or query error (exit=$LASTEXITCODE). Check immediately."
    }
    Write-Host '[OK] public 7 tables: 0 rows' -ForegroundColor Green

    Write-Host "`n[APPROVAL B] Complete. staging->public and Approval C require separate authorization." -ForegroundColor Cyan

} catch {
    Write-Host "[ERROR] $_" -ForegroundColor Red
    $exitCode = 1
} finally {
    # -- 11. Wipe env var and all sensitive variables -----------------
    [System.Environment]::SetEnvironmentVariable('SUPABASE_DB_URL', $null, 'Process')
    if ($null -ne $plainPw)   { $plainPw   = $null }
    if ($null -ne $encodedPw) { $encodedPw = $null }
    if ($null -ne $dbUrl)     { $dbUrl     = $null }
    if ($null -ne $securePw)  { $securePw.Dispose(); $securePw = $null }
    Write-Host '[CLEANUP] SUPABASE_DB_URL and sensitive variables cleared' -ForegroundColor DarkGray
}

exit $exitCode
