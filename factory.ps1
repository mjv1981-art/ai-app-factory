[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$RunId,
    [Parameter(Mandatory = $true)][string]$ApprovedRevision,
    [Parameter(Mandatory = $true)][string]$FactoryUrl,
    [Parameter(Mandatory = $true)][Microsoft.PowerShell.Commands.WebRequestSession]$Session,
    [Parameter(Mandatory = $true)][string]$CsrfToken
)
$ErrorActionPreference = 'Stop'
if ($FactoryUrl -notmatch '^https://') { throw 'Hosted API requires HTTPS.' }
if ($RunId -notmatch '^[a-f0-9-]{36}$' -or $ApprovedRevision -notmatch '^[a-f0-9]{64}$') { throw 'Run UUID and exact approved plan hash are required.' }
$origin = ([Uri]$FactoryUrl).GetLeftPart([UriPartial]::Authority)
$body = @{ revision = $ApprovedRevision } | ConvertTo-Json
Invoke-RestMethod -Uri "$origin/api/runs/$RunId/approve" -Method Post -ContentType 'application/json' -Body $body -WebSession $Session -Headers @{ Origin = $origin; 'X-CSRF-Token' = $CsrfToken }
# Approval binds repository base and plan hash; implementation occurs in a cloud job.
