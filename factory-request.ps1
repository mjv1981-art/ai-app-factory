[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Request,
    [Parameter(Mandatory = $true)][string]$ProjectId,
    [Parameter(Mandatory = $true)][string]$FactoryUrl,
    [Parameter(Mandatory = $true)][Microsoft.PowerShell.Commands.WebRequestSession]$Session,
    [Parameter(Mandatory = $true)][string]$CsrfToken
)
$ErrorActionPreference = 'Stop'
if ($FactoryUrl -notmatch '^https://') { throw 'Hosted API requires HTTPS.' }
if ($ProjectId -notmatch '^[a-f0-9-]{36}$') { throw 'Invalid project UUID.' }
$origin = ([Uri]$FactoryUrl).GetLeftPart([UriPartial]::Authority)
$body = @{ request = $Request } | ConvertTo-Json
Invoke-RestMethod -Uri "$origin/api/projects/$ProjectId/request" -Method Post -ContentType 'application/json' -Body $body -WebSession $Session -Headers @{ Origin = $origin; 'X-CSRF-Token' = $CsrfToken }
# Browser users use /factory. This optional API client performs no local implementation.
