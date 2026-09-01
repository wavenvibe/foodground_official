<#
.SYNOPSIS
    CHG-G6-002 G5 — secure logical backup and isolated restore rehearsal.

.DESCRIPTION
    Reads the approved official Supabase through pg_dump 17, restores only the
    application-owned public/private/staging schemas into an ephemeral local
    PostgreSQL 17 database in Ubuntu WSL, verifies counts and the Approval C
    SQL contract, then deletes the dump and restored database.

    A Python helper accepts the password through the console without echo,
    encodes it as UTF-8 Base64 in memory, and sends it to WSL through standard
    input. It is never printed, written to disk, put on the command line, or
    retained in a process-scoped Windows environment variable.

    This script does not write to Supabase, Git, Vercel, or Production.

.PARAMETER Approved
    Required. Confirms authorization for a read-only logical backup from the
    approved official Supabase and local-only restore verification.
#>

[CmdletBinding()]
param(
    [switch]$Approved,
    [switch]$SelfTest
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$ScriptsDir = Join-Path $RepoRoot 'scripts'
$BashScript = Join-Path $ScriptsDir 'chg_g6_002_recovery_rehearsal.sh'
$SecretRunner = Join-Path $ScriptsDir 'chg_g6_002_wsl_secret_runner.py'
$OutputDir = Join-Path $RepoRoot 'output'
$ReportDir = Join-Path $OutputDir 'recovery-rehearsal'
$ExpectedRef = 'glczrbadvfgmblmkpgfj'

if (-not $Approved -and -not $SelfTest) {
    throw 'Recovery rehearsal requires explicit -Approved.'
}
if (-not (Test-Path -LiteralPath $BashScript)) {
    throw "Required script not found: $BashScript"
}
if (-not (Test-Path -LiteralPath $SecretRunner)) {
    throw "Required script not found: $SecretRunner"
}

function Resolve-PythonCommand {
    $candidates = @()
    if (-not [string]::IsNullOrWhiteSpace($env:FOODGROUND_PYTHON_EXE)) {
        $candidates += [pscustomobject]@{ Exe = $env:FOODGROUND_PYTHON_EXE; Prefix = @() }
    }
    $python312 = Join-Path $env:LOCALAPPDATA 'Programs\Python\Python312\python.exe'
    if (Test-Path -LiteralPath $python312) {
        $candidates += [pscustomobject]@{ Exe = $python312; Prefix = @() }
    }
    $pythonCommand = Get-Command 'python.exe' -ErrorAction SilentlyContinue
    if ($null -ne $pythonCommand) {
        $candidates += [pscustomobject]@{ Exe = $pythonCommand.Source; Prefix = @() }
    }
    $pyCommand = Get-Command 'py.exe' -ErrorAction SilentlyContinue
    if ($null -ne $pyCommand) {
        $candidates += [pscustomobject]@{ Exe = $pyCommand.Source; Prefix = @('-3') }
    }

    foreach ($candidate in $candidates) {
        try {
            & $candidate.Exe @($candidate.Prefix) -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 9) else 1)' 2>$null
            if ($LASTEXITCODE -eq 0) { return $candidate }
        } catch {
            continue
        }
    }
    throw 'Python 3.9 or newer is required for secure WSL password transport.'
}

function Copy-FileToWslTemp {
    param(
        [Parameter(Mandatory=$true)][string]$WindowsPath,
        [Parameter(Mandatory=$true)][string]$WslPath
    )
    $bridgeFile = Join-Path ([System.IO.Path]::GetTempPath()) ("fg-recovery-" + [Guid]::NewGuid().ToString('N') + '.b64')
    try {
        $bytes = [System.IO.File]::ReadAllBytes($WindowsPath)
        $base64 = [Convert]::ToBase64String($bytes)
        [System.IO.File]::WriteAllText($bridgeFile, $base64, [System.Text.Encoding]::ASCII)
        $bridgeFull = [System.IO.Path]::GetFullPath($bridgeFile)
        if ($bridgeFull -notmatch '^([A-Za-z]):\\(.+)$') {
            throw 'ASCII-only staging bridge path is not a Windows drive path.'
        }
        $bridgeWsl = '/mnt/' + $Matches[1].ToLowerInvariant() + '/' + $Matches[2].Replace('\', '/')
        $command = "base64 -d < '$bridgeWsl' > '$WslPath' && chmod 600 '$WslPath'"
        & wsl.exe -d Ubuntu -u root -- bash -lc $command
        if ($LASTEXITCODE -ne 0) {
            throw "Could not stage local recovery file inside WSL: $WslPath"
        }
        & wsl.exe -d Ubuntu -u root -- test -s $WslPath
        if ($LASTEXITCODE -ne 0) {
            throw "Staged recovery file is missing or empty inside WSL: $WslPath"
        }
    } finally {
        $base64 = $null
        $bytes = $null
        if (Test-Path -LiteralPath $bridgeFile) {
            Remove-Item -LiteralPath $bridgeFile -Force -ErrorAction SilentlyContinue
        }
    }
}

function Copy-FileFromWslTemp {
    param(
        [Parameter(Mandatory=$true)][string]$WslPath,
        [Parameter(Mandatory=$true)][string]$WindowsPath
    )
    $bridgeFile = Join-Path ([System.IO.Path]::GetTempPath()) ("fg-recovery-report-" + [Guid]::NewGuid().ToString('N') + '.tmp')
    try {
        [System.IO.File]::WriteAllBytes($bridgeFile, [byte[]]@())
        $bridgeFull = [System.IO.Path]::GetFullPath($bridgeFile)
        if ($bridgeFull -notmatch '^([A-Za-z]):\\(.+)$') {
            throw 'ASCII-only report bridge path is not a Windows drive path.'
        }
        $bridgeWsl = '/mnt/' + $Matches[1].ToLowerInvariant() + '/' + $Matches[2].Replace('\', '/')
        & wsl.exe -d Ubuntu -u root -- cp -- $WslPath $bridgeWsl
        if ($LASTEXITCODE -ne 0) {
            throw "Could not read sanitized recovery report from WSL: $WslPath"
        }
        [System.IO.File]::Copy($bridgeFile, $WindowsPath, $true)
    } finally {
        if (Test-Path -LiteralPath $bridgeFile) {
            Remove-Item -LiteralPath $bridgeFile -Force -ErrorAction SilentlyContinue
        }
    }
}

if ($SelfTest) {
    $selfTestId = [Guid]::NewGuid().ToString('N')
    $selfTestWsl = "/tmp/chg_g6_002_selftest_$selfTestId.sh"
    $roundTripWsl = "/tmp/chg_g6_002_selftest_$selfTestId.out"
    $roundTripWindows = Join-Path ([System.IO.Path]::GetTempPath()) ("fg-recovery-selftest-$selfTestId.out")
    try {
        Copy-FileToWslTemp -WindowsPath $BashScript -WslPath $selfTestWsl
        & wsl.exe -d Ubuntu -u root -- cp -- $selfTestWsl $roundTripWsl
        if ($LASTEXITCODE -ne 0) { throw 'WSL self-test copy failed.' }
        Copy-FileFromWslTemp -WslPath $roundTripWsl -WindowsPath $roundTripWindows
        $sourceHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $BashScript).Hash
        $roundTripHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $roundTripWindows).Hash
        if ($sourceHash -ne $roundTripHash) {
            throw 'WSL staging round-trip SHA-256 mismatch.'
        }
        & wsl.exe -d Ubuntu -u root -- bash -n $selfTestWsl
        if ($LASTEXITCODE -ne 0) { throw "WSL Bash syntax self-test failed (exit=$LASTEXITCODE)." }
        $python = Resolve-PythonCommand
        & $python.Exe @($python.Prefix) $SecretRunner --self-test --distribution Ubuntu --wsl-script $selfTestWsl
        if ($LASTEXITCODE -ne 0) { throw "UTF-8 secret-pipe self-test failed (exit=$LASTEXITCODE)." }
        & wsl.exe -d Ubuntu -u root -- bash $selfTestWsl --local-restore-self-test
        if ($LASTEXITCODE -ne 0) { throw "Local PostgreSQL restore self-test failed (exit=$LASTEXITCODE)." }
        Write-Host "[PASS] Windows PowerShell/WSL staging self-test: SHA-256 $sourceHash"
        Write-Host '[PASS] WSL Bash syntax self-test.'
        exit 0
    } finally {
        & wsl.exe -d Ubuntu -u root -- rm -f -- $selfTestWsl $roundTripWsl 2>$null
        if (Test-Path -LiteralPath $roundTripWindows) {
            Remove-Item -LiteralPath $roundTripWindows -Force -ErrorAction SilentlyContinue
        }
    }
}

$template = Read-Host -Prompt 'Session pooler/direct URI template containing [YOUR-PASSWORD]'
if ([string]::IsNullOrWhiteSpace($template)) {
    throw 'URI template is empty.'
}
if (([regex]::Matches($template, '\[YOUR-PASSWORD\]').Count) -ne 1) {
    throw 'URI template must contain [YOUR-PASSWORD] exactly once.'
}
if ($template -notmatch '^postgre(sql|s)://') {
    throw 'URI template scheme must be postgresql or postgres.'
}

$validationValue = $template.Replace('[YOUR-PASSWORD]', 'placeholder')
try {
    $uri = [Uri]$validationValue
} catch {
    throw 'URI template is not a valid PostgreSQL URI.'
}

$userName = ($uri.UserInfo -split ':', 2)[0]
$isPooler = (
    $userName -eq "postgres.$ExpectedRef" -and
    $uri.Host.EndsWith('.pooler.supabase.com') -and
    $uri.Port -eq 5432 -and
    $uri.AbsolutePath -eq '/postgres'
)
$isDirect = (
    $userName -eq 'postgres' -and
    $uri.Host -eq "db.$ExpectedRef.supabase.co" -and
    $uri.Port -eq 5432 -and
    $uri.AbsolutePath -eq '/postgres'
)
if (-not ($isPooler -or $isDirect)) {
    throw 'URI template does not target the approved Foodground Supabase project or Session pooler port 5432.'
}

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
$runId = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')
$reportPath = Join-Path $ReportDir "chg-g6-002-recovery-$runId.md"
$bashWsl = "/tmp/chg_g6_002_recovery_$runId.sh"
$verifyWsl = "/tmp/chg_g6_002_verify_$runId.sql"
$reportWsl = "/tmp/chg_g6_002_recovery_report_$runId.md"

Copy-FileToWslTemp -WindowsPath $BashScript -WslPath $bashWsl
Copy-FileToWslTemp -WindowsPath (Join-Path $ScriptsDir 'chg_g6_002_verify.sql') -WslPath $verifyWsl

try {
    $python = Resolve-PythonCommand
    $arguments = @(
        $SecretRunner,
        '--distribution', 'Ubuntu',
        '--wsl-script', $bashWsl,
        '--host', $uri.Host,
        '--port', $uri.Port.ToString(),
        '--user', $userName,
        '--database', 'postgres',
        '--project-ref', $ExpectedRef,
        '--run-id', $runId,
        '--verify-sql', $verifyWsl,
        '--report', $reportWsl
    )

    Write-Host '[security] Approved official DB target accepted; secret values will not be logged.'
    Write-Host '[recovery] Starting read-only logical backup and local isolated restore.'

    & $python.Exe @($python.Prefix) @arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Recovery rehearsal failed (exit=$LASTEXITCODE). No remote writes were performed."
    }

    Copy-FileFromWslTemp -WslPath $reportWsl -WindowsPath $reportPath
    if (-not (Test-Path -LiteralPath $reportPath)) {
        throw 'Recovery passed, but the sanitized report could not be copied to the workspace.'
    }

    Write-Host "[PASS] Recovery rehearsal completed: $reportPath" -ForegroundColor Green
} finally {
    if ($bashWsl -and $verifyWsl -and $reportWsl) {
        & wsl.exe -d Ubuntu -u root -- rm -f -- $bashWsl $verifyWsl $reportWsl 2>$null
    }
    Write-Host '[security] No DB credential environment variable was created.'
}
