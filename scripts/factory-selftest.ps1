[CmdletBinding()]
param([switch]$SyntaxOnly)
$ErrorActionPreference = 'Stop'
foreach ($relative in @('factory-request.ps1', 'factory.ps1', 'scripts/factory-telemetry.ps1', 'scripts/factory-selftest.ps1')) {
    $path = Join-Path (Split-Path $PSScriptRoot -Parent) $relative
    $tokens = $null
    $errors = $null
    [System.Management.Automation.Language.Parser]::ParseFile($path, [ref]$tokens, [ref]$errors) | Out-Null
    if ($errors.Count -gt 0) { throw "$relative contains syntax errors: $($errors.Message -join '; ')" }
}
if (-not $SyntaxOnly) {
    Push-Location (Split-Path $PSScriptRoot -Parent)
    try {
        $npm = if ($env:OS -eq 'Windows_NT') { 'npm.cmd' } else { 'npm' }
        & $npm run test:factory
        if ($LASTEXITCODE -ne 0) { throw 'Factory unit/integration tests failed.' }
    } finally { Pop-Location }
}
Write-Host 'Factory deterministic checks passed. Stubbed integration evidence does not establish live hosted acceptance.'
