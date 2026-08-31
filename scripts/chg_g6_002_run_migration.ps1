<#
.SYNOPSIS
    CHG-G6-002 VS-F — Secure Migration/Publish Runner (PowerShell)

.DESCRIPTION
    Executes Supabase migration, staging load, publish, and verify scripts
    against the approved isolated Supabase project.

    Security:
    - Accepts a non-secret URI template with [YOUR-PASSWORD], then prompts
      for the password separately as SecureString (no echo).
    - Sets SUPABASE_DB_URL as process-scoped environment variable only.
    - Clears the variable in finally{} block regardless of success/failure.
    - Never logs, prints, or writes the connection string.
    - Source DB path is read from FOODGROUND_SOURCE_DB env var.
    - SQL execution via chg_g6_002_sql_runner.py (psycopg2, no psql DSN exposure).
    - Migration via Supabase CLI db push (preserves schema_migrations history).

    REMOTE EXECUTION PROHIBITED UNTIL USER APPROVAL.

.PARAMETER Action
    One of: preflight, migrate, load, publish, verify, rollback-data, rollback-schema, full

.PARAMETER DryRun
    If set, runs local-only validation (no Supabase connection).

.PARAMETER Approved
    Required for live actions. Confirms user has approved remote execution.

.PARAMETER Only
    For 'load' action: comma-separated dataset names to load.

.PARAMETER Resume
    For 'load' action: resume from last checkpoint.

.PARAMETER BatchSize
    For 'load' action: rows per transaction chunk.

.EXAMPLE
    .\scripts\chg_g6_002_run_migration.ps1 -Action preflight -DryRun
    .\scripts\chg_g6_002_run_migration.ps1 -Action full -Approved
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('preflight','migrate','load','publish','verify',
                 'rollback-data','rollback-schema','full')]
    [string]$Action,

    [switch]$DryRun,

    [switch]$Approved,

    [string]$Only = '',

    [switch]$Resume,

    [int]$BatchSize = 5000
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$ScriptsDir = Join-Path $RepoRoot 'scripts'
$MigrationsDir = Join-Path $RepoRoot 'supabase' 'migrations'
$RollbackDir = Join-Path $RepoRoot 'supabase' 'rollback'

function Get-SecureDbUrl {
    <#
    .SYNOPSIS
        Validates a non-secret URI template, prompts separately for the DB
        password, URL-encodes it, and sets a process-scope environment value.
        Caller MUST clear it in finally{}.
    #>
    $template = Read-Host -Prompt 'Session pooler/direct URI template containing [YOUR-PASSWORD]'
    if ([string]::IsNullOrWhiteSpace($template)) {
        throw 'URI template is empty.'
    }
    if (([regex]::Matches($template, '\[YOUR-PASSWORD\]').Count) -ne 1) {
        throw 'URI template must contain [YOUR-PASSWORD] exactly once.'
    }

    # Validate scheme before [Uri] parse (which silently accepts non-pg schemes)
    if ($template -notmatch '^postgre(sql|s)://') {
        throw 'URI template scheme must be postgresql or postgres.'
    }
    $validationValue = $template.Replace('[YOUR-PASSWORD]', 'placeholder')
    try {
        $uri = [Uri]$validationValue
    } catch {
        throw 'URI template is not a valid PostgreSQL URI.'
    }
    $expectedRef = 'glczrbadvfgmblmkpgfj'
    $userName = ($uri.UserInfo -split ':', 2)[0]
    $isPooler = (
        $userName -eq "postgres.$expectedRef" -and
        $uri.Host.EndsWith('.pooler.supabase.com') -and
        $uri.Port -in @(5432, 6543) -and
        $uri.AbsolutePath -eq '/postgres'
    )
    $isDirect = (
        $userName -eq 'postgres' -and
        $uri.Host -eq "db.$expectedRef.supabase.co" -and
        $uri.Port -eq 5432 -and
        $uri.AbsolutePath -eq '/postgres'
    )
    if (-not ($isPooler -or $isDirect)) {
        throw 'URI template does not target the approved Foodground Supabase project.'
    }

    $secure = Read-Host -Prompt 'Supabase DB password' -AsSecureString
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $plainPassword = $null
    $encodedPassword = $null
    try {
        $plainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
        if ([string]::IsNullOrWhiteSpace($plainPassword)) {
            throw 'Database password is empty.'
        }
        $encodedPassword = [Uri]::EscapeDataString($plainPassword)
        $dbUrl = $template.Replace('[YOUR-PASSWORD]', $encodedPassword)
        [Environment]::SetEnvironmentVariable('SUPABASE_DB_URL', $dbUrl, 'Process')
    } finally {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
        $plainPassword = $null
        $encodedPassword = $null
        $dbUrl = $null
        if ($secure) { $secure.Dispose() }
    }
    Write-Host '[security] Approved DB target accepted; credentials not logged.'
}

function Clear-DbUrl {
    [Environment]::SetEnvironmentVariable('SUPABASE_DB_URL', $null, 'Process')
    Write-Host '[security] SUPABASE_DB_URL cleared from process environment.'
}

function Find-PythonExe {
    <#
    .SYNOPSIS
        Resolve Python: FOODGROUND_PYTHON_EXE > py -3 > python.
        Returns @{ ExePath; PrefixArgs } — structured, no string concatenation.
    #>
    $envExe = $env:FOODGROUND_PYTHON_EXE
    if ($envExe -and (Test-Path $envExe)) {
        return @{ ExePath = $envExe; PrefixArgs = @() }
    }
    $pyLauncher = Get-Command 'py' -ErrorAction SilentlyContinue
    if ($pyLauncher) {
        return @{ ExePath = $pyLauncher.Source; PrefixArgs = @('-3') }
    }
    $python = Get-Command 'python' -ErrorAction SilentlyContinue
    if ($python) {
        return @{ ExePath = $python.Source; PrefixArgs = @() }
    }
    throw 'Python not found. Set FOODGROUND_PYTHON_EXE, install py launcher, or add python to PATH.'
}

function Invoke-Python {
    <#
    .SYNOPSIS
        Runs a Python script via Find-PythonExe and checks $LASTEXITCODE.
    #>
    param(
        [string]$Script,
        [string[]]$Arguments = @()
    )
    $py = Find-PythonExe
    $allArgs = $py.PrefixArgs + @($Script) + $Arguments
    Write-Host "Running: $($py.ExePath) $($allArgs -join ' ')"
    & $py.ExePath @allArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Python script failed: $Script (exit code $LASTEXITCODE)"
    }
}

function Invoke-SqlRunner {
    <#
    .SYNOPSIS
        Runs chg_g6_002_sql_runner.py to execute SQL via psycopg2.
        DSN is read from SUPABASE_DB_URL env var (never CLI argument).
    #>
    param([string]$SqlFile)
    Invoke-Python -Script (Join-Path $ScriptsDir 'chg_g6_002_sql_runner.py') -Arguments @($SqlFile, '--on-error-stop')
}

function Find-SupabaseCli {
    <#
    .SYNOPSIS
        Find Supabase CLI: FOODGROUND_SUPABASE_EXE > PATH > npx.
        Returns @{ ExePath; PrefixArgs } — structured, never a bare
        concatenated string like "npx supabase".
    #>
    $envExe = $env:FOODGROUND_SUPABASE_EXE
    if ($envExe -and (Test-Path $envExe)) {
        return @{ ExePath = $envExe; PrefixArgs = @() }
    }
    $pathExe = Get-Command 'supabase' -ErrorAction SilentlyContinue
    if ($pathExe) {
        return @{ ExePath = $pathExe.Source; PrefixArgs = @() }
    }
    $npx = Get-Command 'npx' -ErrorAction SilentlyContinue
    if ($npx) {
        return @{ ExePath = $npx.Source; PrefixArgs = @('supabase') }
    }
    return $null
}

function Invoke-SupabaseDbPush {
    <#
    .SYNOPSIS
        Runs supabase db push with dry-run first, then actual push.
        Uses Supabase CLI to preserve schema_migrations history.
    #>
    $cli = Find-SupabaseCli
    if (-not $cli) {
        throw "Supabase CLI not found. Set FOODGROUND_SUPABASE_EXE, install via npm, or add to PATH."
    }

    # Check link
    $refFile = Join-Path $RepoRoot 'supabase' '.temp' 'project-ref'
    if (-not (Test-Path $refFile)) {
        $refFile = Join-Path $RepoRoot '.supabase' 'project-ref'
    }
    if (Test-Path $refFile) {
        $ref = (Get-Content $refFile -Raw).Trim()
        if ($ref -ne 'glczrbadvfgmblmkpgfj') {
            throw "Supabase linked to wrong project: $ref (expected glczrbadvfgmblmkpgfj)"
        }
        Write-Host "  Linked project ref: $ref (OK)"
    } else {
        throw "Supabase project not linked. Run: supabase link --project-ref glczrbadvfgmblmkpgfj"
    }

    # Dry-run first
    Write-Host "--- db push --dry-run ---"
    $dryArgs = $cli.PrefixArgs + @('db', 'push', '--dry-run')
    & $cli.ExePath @dryArgs
    if ($LASTEXITCODE -ne 0) {
        throw "supabase db push --dry-run failed (exit code $LASTEXITCODE)"
    }

    # Actual push
    Write-Host "--- db push ---"
    $pushArgs = $cli.PrefixArgs + @('db', 'push')
    & $cli.ExePath @pushArgs
    if ($LASTEXITCODE -ne 0) {
        throw "supabase db push failed (exit code $LASTEXITCODE)"
    }

    Write-Host "All migrations applied via Supabase CLI."
}

# ---------------------------------------------------------------------------
# DRY RUN — no credentials needed
# ---------------------------------------------------------------------------
if ($DryRun) {
    Write-Host '=== VS-F Secure Runner — DRY RUN ==='
    Write-Host ''

    switch ($Action) {
        'preflight' {
            Invoke-Python -Script (Join-Path $ScriptsDir 'chg_g6_002_preflight.py') -Arguments @('--dry-run')
        }
        'load' {
            $loadArgs = @('--dry-run', '--batch-size', $BatchSize.ToString())
            if ($Only) { $loadArgs += @('--only') + ($Only -split ',') }
            if ($Resume) { $loadArgs += '--resume' }
            Invoke-Python -Script (Join-Path $ScriptsDir 'chg_g6_002_staging_loader.py') -Arguments $loadArgs
        }
        'full' {
            Write-Host '--- Preflight ---'
            Invoke-Python -Script (Join-Path $ScriptsDir 'chg_g6_002_preflight.py') -Arguments @('--dry-run')
            Write-Host ''
            Write-Host '--- Loader ---'
            Invoke-Python -Script (Join-Path $ScriptsDir 'chg_g6_002_staging_loader.py') -Arguments @('--dry-run')
        }
        default {
            Write-Host "Action '$Action' requires live connection. Use without -DryRun."
        }
    }
    exit 0
}

# ---------------------------------------------------------------------------
# LIVE MODE — requires credentials and --Approved flag
# ---------------------------------------------------------------------------
if (-not $Approved) {
    Write-Host 'ERROR: Live actions require the -Approved flag to confirm user authorization.'
    Write-Host 'Usage: .\scripts\chg_g6_002_run_migration.ps1 -Action <action> -Approved'
    exit 1
}

Write-Host '=== VS-F Secure Runner — LIVE MODE ==='
Write-Host 'CAUTION: This action targets the approved isolated Supabase project.'
Write-Host ''

try {
    Get-SecureDbUrl

    switch ($Action) {
        'preflight' {
            Invoke-Python -Script (Join-Path $ScriptsDir 'chg_g6_002_preflight.py')
        }
        'migrate' {
            Invoke-SupabaseDbPush
        }
        'load' {
            $loadArgs = @('--batch-size', $BatchSize.ToString(), '--approved')
            if ($Only) { $loadArgs += @('--only') + ($Only -split ',') }
            if ($Resume) { $loadArgs += '--resume' }
            Invoke-Python -Script (Join-Path $ScriptsDir 'chg_g6_002_staging_loader.py') -Arguments $loadArgs
        }
        'publish' {
            Invoke-SqlRunner -SqlFile (Join-Path $ScriptsDir 'chg_g6_002_publish.sql')
        }
        'verify' {
            Invoke-SqlRunner -SqlFile (Join-Path $ScriptsDir 'chg_g6_002_verify.sql')
        }
        'rollback-data' {
            Invoke-SqlRunner -SqlFile (Join-Path $ScriptsDir 'chg_g6_002_publish_rollback.sql')
        }
        'rollback-schema' {
            Invoke-SqlRunner -SqlFile (Join-Path $RollbackDir '20260830_0028_0033_vs-a_g6_002_rollback.sql')
        }
        'full' {
            Write-Host '--- Step 1: Preflight ---'
            Invoke-Python -Script (Join-Path $ScriptsDir 'chg_g6_002_preflight.py')

            Write-Host '--- Step 2: Migrate (Supabase CLI db push) ---'
            Invoke-SupabaseDbPush

            Write-Host '--- Step 3: Staging Load ---'
            Invoke-Python -Script (Join-Path $ScriptsDir 'chg_g6_002_staging_loader.py') -Arguments @('--approved')

            Write-Host '--- Step 4: Publish ---'
            Invoke-SqlRunner -SqlFile (Join-Path $ScriptsDir 'chg_g6_002_publish.sql')

            Write-Host '--- Step 5: Verify ---'
            Invoke-SqlRunner -SqlFile (Join-Path $ScriptsDir 'chg_g6_002_verify.sql')

            Write-Host '=== Full pipeline complete ==='
        }
    }
} catch {
    Write-Error "Pipeline failed: $_"
    exit 1
} finally {
    Clear-DbUrl
}
