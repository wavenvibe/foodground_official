# VS-2 Approval C -- staging->public publish runner
# PROHIBITED: schema migrations, staging modification, Vercel deploy, commit/push
# PROHIBITED: executing this script before user explicitly approves Approval C
# Run from project root:
#   powershell -ExecutionPolicy Bypass -File scripts\vs2_publish_public_secure.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# -- Constants ----------------------------------------------------------------
$EXPECTED_PROJECT_REF = 'glczrbadvfgmblmkpgfj'
$EXPECTED_USER        = "postgres.$EXPECTED_PROJECT_REF"
$SUPABASE_URL         = 'https://glczrbadvfgmblmkpgfj.supabase.co'
if ($env:FOODGROUND_PYTHON_EXE) {
    $PYTHON_EXE = $env:FOODGROUND_PYTHON_EXE
} else {
    $pycmd = Get-Command python -ErrorAction SilentlyContinue
    if (-not $pycmd) { Write-Host '[ABORT] Python not found. Set FOODGROUND_PYTHON_EXE or add python to PATH.' -ForegroundColor Red; exit 1 }
    $PYTHON_EXE = $pycmd.Source
}
$ROOT                 = Split-Path -Parent $PSScriptRoot

$PREFLIGHT_SCRIPT   = 'scripts\vs2_publish_preflight.py'
$PUBLISH_SQL        = 'scripts\vs2_publish_public.sql'
$ROLLBACK_SQL       = 'scripts\vs2_rollback_public.sql'
$VERIFY_SCRIPT      = 'scripts\vs2_verify_approval_c.py'

# -- 0. File existence check --------------------------------------------------
Write-Host '[CHECK] Required files exist...' -ForegroundColor Cyan
$missing = [System.Collections.Generic.List[string]]::new()
if (-not (Test-Path $PYTHON_EXE)) { $missing.Add($PYTHON_EXE) }
foreach ($rel in @($PREFLIGHT_SCRIPT, $PUBLISH_SQL, $ROLLBACK_SQL, $VERIFY_SCRIPT)) {
    if (-not (Test-Path (Join-Path $ROOT $rel))) { $missing.Add($rel) }
}
if ($missing.Count -gt 0) {
    Write-Host '[ABORT] Missing files -- exiting without credential prompt:' -ForegroundColor Red
    foreach ($f in $missing) { Write-Host "  - $f" -ForegroundColor Red }
    exit 1
}
Write-Host '[OK] All required files found' -ForegroundColor Green

# -- 1. Accept URI template (plain text, no real password) --------------------
Write-Host ''
Write-Host 'Supabase Dashboard -> Connect -> Session pooler -> copy the URI' -ForegroundColor Cyan
Write-Host 'The URI must contain [YOUR-PASSWORD] as the password placeholder.' -ForegroundColor Cyan
$uriTemplate = (Read-Host 'URI template').Trim()

# -- 2. Validate URI template -------------------------------------------------
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

# -- Sensitive variable init --------------------------------------------------
[SecureString]$securePw      = $null
[string]$plainPw             = $null
[string]$encodedPw           = $null
[string]$dbUrl               = $null
[SecureString]$secureAnonKey = $null
[string]$plainAnonKey        = $null
$tempPy = $null
$exitCode = 0

try {
    # -- 3. Accept password (hidden) ------------------------------------------
    $securePw = Read-Host -AsSecureString -Prompt 'Supabase DB password'

    # -- 3b. Accept anon key (hidden) -----------------------------------------
    $secureAnonKey = Read-Host -AsSecureString -Prompt 'Supabase publishable (anon) key'
    $bstrAnon = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureAnonKey)
    try {
        $plainAnonKey = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstrAnon)
    } finally {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstrAnon)
    }
    if ([string]::IsNullOrWhiteSpace($plainAnonKey)) {
        throw 'Anon key is empty. Publish aborted.'
    }
    Write-Host '[C] Anon key accepted (not logged)' -ForegroundColor Cyan

    # -- 4. SecureString -> BSTR -> plaintext, immediate BSTR release ----------
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePw)
    try {
        $plainPw = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    } finally {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }

    # -- 5. URL-encode, discard plaintext, replace placeholder ----------------
    $encodedPw = [Uri]::EscapeDataString($plainPw)
    $plainPw   = $null
    $dbUrl     = $uriTemplate -replace '\[YOUR-PASSWORD\]', $encodedPw
    $encodedPw = $null

    if ($dbUrl -notmatch 'sslmode=') {
        if ($dbUrl -match '\?') { $dbUrl += '&sslmode=require' }
        else                    { $dbUrl += '?sslmode=require' }
    }

    # -- 6. Set process-scoped env var ----------------------------------------
    [System.Environment]::SetEnvironmentVariable('SUPABASE_DB_URL', $dbUrl, 'Process')
    $dbUrl = $null
    Write-Host '[C] SUPABASE_DB_URL set (process scope only)' -ForegroundColor Cyan

    # -- 7. Pre-publish integrity checks (read-only) --------------------------
    Write-Host "`n[PREFLIGHT] Running pre-publish integrity checks..." -ForegroundColor Yellow
    & $PYTHON_EXE (Join-Path $ROOT $PREFLIGHT_SCRIPT)
    if ($LASTEXITCODE -ne 0) {
        throw "Pre-publish integrity checks failed (exit=$LASTEXITCODE). Publish aborted."
    }
    Write-Host '[PREFLIGHT] All integrity checks passed' -ForegroundColor Green

    # -- 8. Execute staging->public publish SQL in a single transaction -------
    Write-Host "`n[PUBLISH] Executing staging->public transaction..." -ForegroundColor Yellow

    # Write a minimal Python runner to a temp file; no sensitive vars in the .py
    $pyLines = @(
        "import os, sys",
        "try:",
        "    import psycopg2",
        "except ImportError:",
        "    print('[ERR] psycopg2 not installed', file=sys.stderr); sys.exit(1)",
        "sql_path = sys.argv[1]",
        "db_url = os.environ.get('SUPABASE_DB_URL', '')",
        "if not db_url:",
        "    print('[ERR] SUPABASE_DB_URL not set', file=sys.stderr); sys.exit(1)",
        "try:",
        "    with open(sql_path, 'r', encoding='utf-8') as f:",
        "        sql = f.read()",
        "except Exception as exc:",
        "    print('[ERR] Cannot read SQL: ' + type(exc).__name__, file=sys.stderr); sys.exit(1)",
        "conn = None",
        "try:",
        "    conn = psycopg2.connect(db_url)",
        "    conn.autocommit = True",
        "    with conn.cursor() as cur:",
        "        cur.execute(sql)",
        "    print('[DONE] Transaction committed')",
        "except Exception as exc:",
        "    print('[ERR] Publish failed: ' + type(exc).__name__, file=sys.stderr)",
        "    sys.exit(1)",
        "finally:",
        "    if conn:",
        "        try: conn.close()",
        "        except: pass"
    )

    $tempPy = [System.IO.Path]::GetTempFileName() -replace '\.tmp$', '.py'
    [System.IO.File]::WriteAllLines($tempPy, $pyLines, [System.Text.Encoding]::UTF8)

    & $PYTHON_EXE $tempPy (Join-Path $ROOT $PUBLISH_SQL)
    if ($LASTEXITCODE -ne 0) {
        throw "Publish SQL failed (exit=$LASTEXITCODE). The transaction auto-rolled back. Check output above."
    }
    Write-Host '[PUBLISH] staging->public publish complete' -ForegroundColor Green

    # -- 8b. Set Data API env vars for verification (process scope only) ------
    [System.Environment]::SetEnvironmentVariable('SUPABASE_URL', $SUPABASE_URL, 'Process')
    [System.Environment]::SetEnvironmentVariable('SUPABASE_ANON_KEY', $plainAnonKey, 'Process')
    $plainAnonKey = $null
    Write-Host '[C] SUPABASE_URL and SUPABASE_ANON_KEY set (process scope only)' -ForegroundColor Cyan

    # -- 9. Approval C verification -------------------------------------------
    Write-Host "`n[VERIFY] Running Approval C verification..." -ForegroundColor Yellow
    & $PYTHON_EXE (Join-Path $ROOT $VERIFY_SCRIPT)
    if ($LASTEXITCODE -ne 0) {
        throw "Approval C verification failed (exit=$LASTEXITCODE). Review output above. Rollback: $ROLLBACK_SQL"
    }
    Write-Host '[VERIFY] Approval C verification passed' -ForegroundColor Green

    Write-Host "`n[APPROVAL C] Complete." -ForegroundColor Cyan
    Write-Host "  Next: commit, push, and Vercel deployment require separate user authorization." -ForegroundColor Cyan
    Write-Host "  Rollback if needed: connect to DB and run $ROLLBACK_SQL" -ForegroundColor Cyan

} catch {
    Write-Host "[ERROR] $_" -ForegroundColor Red
    Write-Host '' -ForegroundColor Red
    Write-Host 'ROLLBACK INSTRUCTIONS:' -ForegroundColor Yellow
    Write-Host "  The publish SQL runs as a single transaction." -ForegroundColor Yellow
    Write-Host "  A SQL error auto-rolls back -- no manual rollback needed for SQL-level failures." -ForegroundColor Yellow
    Write-Host "  Use rollback SQL only if the COMMIT succeeded but Approval C verification then failed:" -ForegroundColor Yellow
    Write-Host "  $ROLLBACK_SQL" -ForegroundColor Yellow
    Write-Host "  This TRUNCATES public 7 tables only. staging/private/migrations are NOT affected." -ForegroundColor Yellow
    $exitCode = 1
} finally {
    # -- 10. Wipe all sensitive variables and env vars ------------------------
    [System.Environment]::SetEnvironmentVariable('SUPABASE_DB_URL',   $null, 'Process')
    [System.Environment]::SetEnvironmentVariable('SUPABASE_URL',      $null, 'Process')
    [System.Environment]::SetEnvironmentVariable('SUPABASE_ANON_KEY', $null, 'Process')
    if ($null -ne $plainPw)      { $plainPw      = $null }
    if ($null -ne $encodedPw)    { $encodedPw    = $null }
    if ($null -ne $dbUrl)        { $dbUrl        = $null }
    if ($null -ne $plainAnonKey) { $plainAnonKey = $null }
    if ($null -ne $securePw)     { $securePw.Dispose();     $securePw     = $null }
    if ($null -ne $secureAnonKey){ $secureAnonKey.Dispose(); $secureAnonKey = $null }
    if (-not [string]::IsNullOrWhiteSpace($tempPy) -and (Test-Path -LiteralPath $tempPy)) {
        Remove-Item -LiteralPath $tempPy -Force -ErrorAction SilentlyContinue
    }
    Write-Host '[CLEANUP] SUPABASE_DB_URL, SUPABASE_URL, SUPABASE_ANON_KEY and sensitive variables cleared' -ForegroundColor DarkGray
}

exit $exitCode
