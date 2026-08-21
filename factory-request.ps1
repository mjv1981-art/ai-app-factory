param(
    [Parameter(Mandatory = $true)]
    [string]$Request
)

$ErrorActionPreference = "Stop"

function Stop-Planner {
    param([string]$Message)

    Write-Host ""
    Write-Host "PLANNER STOPPED" -ForegroundColor Red
    Write-Host $Message -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "AI APP FACTORY - PLANNER" -ForegroundColor Cyan
Write-Host "========================"
Write-Host ""

foreach ($command in @("git", "codex")) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
        Stop-Planner "Required command not found: $command"
    }
}

$repo = [System.IO.Path]::GetFullPath(
    (& git rev-parse --show-toplevel 2>$null).Trim()
)

if (-not $repo) {
    Stop-Planner "Run this command inside the AI App Factory repository."
}

Set-Location $repo

$branch = (& git branch --show-current).Trim()

if ($branch -ne "main") {
    Stop-Planner "Planner must start from main. Current branch: $branch"
}

if (git status --porcelain) {
    Stop-Planner "Working tree must be clean before planning a new change."
}

git fetch origin main --quiet

$mainSha = (& git rev-parse main).Trim()
$originMainSha = (& git rev-parse origin/main).Trim()

if ($mainSha -ne $originMainSha) {
    Stop-Planner @"
Local main is not current.

Run:

git pull

and retry.
"@
}

# ------------------------------------------------------------
# Runtime
# ------------------------------------------------------------

$runtime = Join-Path $repo ".factory-runtime"

if (Test-Path $runtime) {
    Remove-Item $runtime -Recurse -Force
}

New-Item -ItemType Directory -Force $runtime | Out-Null

$excludeFile = Join-Path $repo ".git\info\exclude"

if (-not (Select-String `
    -Path $excludeFile `
    -SimpleMatch ".factory-runtime/" `
    -Quiet `
    -ErrorAction SilentlyContinue)) {

    Add-Content $excludeFile ".factory-runtime/"
}

$schema = Join-Path $runtime "planner.schema.json"
$output = Join-Path $runtime "planner.json"

$schemaText = @'
{
  "type": "object",
  "properties": {
    "change_id": {
      "type": "string",
      "pattern": "^CHANGE-[0-9]{3}$"
    },
    "slug": {
      "type": "string",
      "pattern": "^[a-z0-9-]+$"
    },
    "title": {
      "type": "string"
    },
    "contract_markdown": {
      "type": "string"
    },
    "assumptions": {
      "type": "array",
      "items": { "type": "string" }
    },
    "questions_or_risks": {
      "type": "array",
      "items": { "type": "string" }
    }
  },
  "required": [
    "change_id",
    "slug",
    "title",
    "contract_markdown",
    "assumptions",
    "questions_or_risks"
  ],
  "additionalProperties": false
}
'@

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

[System.IO.File]::WriteAllText(
    $schema,
    $schemaText,
    $utf8NoBom
)

# Find the next CHANGE number from committed contracts.
$existingIds = @(
    Get-ChildItem `
        -Path (Join-Path $repo "changes") `
        -Filter "CHANGE-*.md" `
        -ErrorAction SilentlyContinue |
    ForEach-Object {
        if ($_.Name -match "^CHANGE-(\d{3})") {
            [int]$Matches[1]
        }
    }
)

if ($existingIds.Count -eq 0) {
    $nextNumber = 1
}
else {
 $nextNumber = [int](($existingIds | Measure-Object -Maximum).Maximum) + 1
}

$nextId = "CHANGE-" + ([int]$nextNumber).ToString("D3")

# ------------------------------------------------------------
# Planner Agent
# ------------------------------------------------------------

Write-Host "Planning $nextId..." -ForegroundColor Cyan
Write-Host ""

$prompt = @"
Act as a senior Product Analyst and QA Planner for this repository.

Read:
- AGENTS.md
- changes/CHANGE-TEMPLATE.md
- existing application code
- existing Playwright regression tests
- previous Change Contracts under changes/

The human request is:

"$Request"

Create the next Change Contract with ID exactly:

$nextId

Your task is to translate the human request into a precise, conservative
Change Contract.

Important principles:

- Do not implement anything.
- Do not modify repository files.
- Prefer the smallest reasonable scope.
- Explicitly identify what must remain unchanged.
- Preserve existing functionality unless the request explicitly changes it.
- Identify functional regression scenarios.
- Identify visual regression scope.
- Baseline screenshot changes must default to NO unless the human explicitly
  requested a visual change that requires them.
- Every contract must contain the exact sections `## Baseline changes authorized?`
  and `## Authorized baseline files`.
- Use `NO` followed by `NONE.` when no visual baseline update is expected.
- Use `YES` only when the human request intentionally changes approved UI.
- When using `YES`, list every exact repository-relative baseline path that may
  change under `## Authorized baseline files` and authorize no unrelated baseline.
- Do not invent product requirements unnecessarily.
- If something is ambiguous, record it under questions_or_risks.
- Use a short lowercase hyphenated slug.
- Use normal ASCII '-' in the Markdown H1 title, not an em dash.
- contract_markdown must be a complete Markdown Change Contract ready to save
  as changes/<CHANGE-ID>-<slug>.md.

Return only the required structured result.
"@

# Windows PowerShell can split multiline strings when invoking native executables.
# Normalize the Planner prompt to one CLI argument.

# Pass the Planner prompt through stdin.
# This avoids Windows PowerShell native argument parsing problems
# with long/multiline prompt strings.

$prompt | & codex exec `
    --ephemeral `
    --sandbox read-only `
    --output-schema $schema `
    --output-last-message $output `
    -

if ($LASTEXITCODE -ne 0) {
    Stop-Planner "Planner Agent failed."
}

try {
    $plan = Get-Content $output -Raw | ConvertFrom-Json
}
catch {
    Stop-Planner "Could not parse Planner output."
}

if ($plan.change_id -ne $nextId) {
    Stop-Planner "Planner returned unexpected Change ID: $($plan.change_id)"
}

$contractFile = "$($plan.change_id)-$($plan.slug).md"
$contractRel = "changes/$contractFile"
$contractFull = Join-Path $repo $contractRel

# ------------------------------------------------------------
# Human approval gate
# ------------------------------------------------------------

Write-Host ""
Write-Host "PROPOSED CHANGE CONTRACT" -ForegroundColor Yellow
Write-Host "========================"
Write-Host ""

Write-Host $plan.contract_markdown

if ($plan.assumptions.Count -gt 0) {
    Write-Host ""
    Write-Host "Planner assumptions:" -ForegroundColor Yellow

    foreach ($item in $plan.assumptions) {
        Write-Host " - $item"
    }
}

if ($plan.questions_or_risks.Count -gt 0) {
    Write-Host ""
    Write-Host "Questions / risks:" -ForegroundColor Yellow

    foreach ($item in $plan.questions_or_risks) {
        Write-Host " - $item"
    }
}

Write-Host ""
Write-Host "Nothing has been changed yet." -ForegroundColor Green
Write-Host ""

while ($true) {
    Write-Host "Approve this Change Contract?"
    Write-Host ""
    Write-Host "[A] Approve"
    Write-Host "[R] Reject"
    Write-Host "[X] Exit"
    Write-Host ""
    $approval = (Read-Host "Choice").Trim().ToUpperInvariant()

    if ($approval -in @("A", "Y", "YES", "APPROVE")) {
        break
    }

    if ($approval -in @("R", "N", "NO", "REJECT")) {
        Write-Host ""
        Write-Host "The Change Contract was rejected." -ForegroundColor Yellow
        exit 0
    }

    if ($approval -in @("X", "EXIT", "CANCEL", "QUIT")) {
        Write-Host ""
        Write-Host "The factory flow was cancelled by the user." -ForegroundColor Yellow
        exit 0
    }

    Write-Host ""
    Write-Host "Invalid response. Enter A to approve, R to reject, or X to exit." -ForegroundColor Yellow
    Write-Host ""
}

# ------------------------------------------------------------
# Create approved contract + branch
# ------------------------------------------------------------

$changeBranch = "change/$($plan.change_id)-$($plan.slug)"

git switch -c $changeBranch

if ($LASTEXITCODE -ne 0) {
    Stop-Planner "Could not create branch $changeBranch"
}

[System.IO.File]::WriteAllText(
    $contractFull,
    $plan.contract_markdown,
    $utf8NoBom
)

Write-Host ""
Write-Host "Approved contract saved:" -ForegroundColor Green
Write-Host $contractRel

Write-Host ""
Write-Host "Starting autonomous Builder -> QA -> Reviewer -> PR pipeline..." -ForegroundColor Cyan
Write-Host ""

& (Join-Path $repo "factory.ps1") -Contract $contractRel

exit $LASTEXITCODE
