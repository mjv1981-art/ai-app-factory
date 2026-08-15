param(
    [Parameter(Mandatory = $true)]
    [string]$Contract
)

$ErrorActionPreference = "Stop"

function Stop-Factory {
    param([string]$Message)

    Write-Host ""
    Write-Host "FACTORY STOPPED" -ForegroundColor Red
    Write-Host $Message -ForegroundColor Red
    Write-Host ""
    Write-Host "No commit, push, or merge was performed by the factory after this failure."
    exit 1
}

function Invoke-CodexAgent {
    param(
        [string]$Sandbox,
        [string]$SchemaPath,
        [string]$OutputPath,
        [string]$Prompt
    )

    & codex exec `
        --ephemeral `
        --sandbox $Sandbox `
        --output-schema $SchemaPath `
        --output-last-message $OutputPath `
        $Prompt

    if ($LASTEXITCODE -ne 0) {
        Stop-Factory "Codex agent execution failed."
    }

    try {
        return Get-Content $OutputPath -Raw | ConvertFrom-Json
    }
    catch {
        Stop-Factory "Could not parse Codex structured output: $OutputPath"
    }
}

function Get-ChangedFiles {
    $tracked = @(git diff --name-only main)
    $untracked = @(git ls-files --others --exclude-standard)

    return @(
        $tracked
        $untracked
    ) |
    Where-Object { $_ -and $_.Trim() -ne "" } |
    ForEach-Object { $_.Replace("\", "/") } |
    Sort-Object -Unique
}

# ------------------------------------------------------------
# 1. PREFLIGHT
# ------------------------------------------------------------

Write-Host ""
Write-Host "AI APP FACTORY" -ForegroundColor Cyan
Write-Host "=============="
Write-Host ""

foreach ($command in @("git", "gh", "codex", "npm.cmd", "npx.cmd")) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
        Stop-Factory "Required command not found: $command"
    }
}

$repo = [System.IO.Path]::GetFullPath(
    (& git rev-parse --show-toplevel 2>$null).Trim()
)

if (-not $repo) {
    Stop-Factory "This command must be run inside a Git repository."
}

Set-Location $repo

$branch = (& git branch --show-current).Trim()

if ($branch -eq "main") {
    Stop-Factory @"
Do not run the factory directly on main.

Create a feature branch first, for example:

git switch -c change/CHANGE-002-example
"@
}

if (-not (Test-Path $Contract)) {
    Stop-Factory "Change Contract not found: $Contract"
}

$contractFull = [System.IO.Path]::GetFullPath(
    (Resolve-Path $Contract).Path
)

$repoPrefix = $repo + [System.IO.Path]::DirectorySeparatorChar

if (-not $contractFull.StartsWith(
    $repoPrefix,
    [System.StringComparison]::OrdinalIgnoreCase
)) {
    Stop-Factory "The Change Contract must be inside this repository."
}

$contractRel = $contractFull.Substring($repoPrefix.Length).Replace("\", "/")

# Ensure main is current relative to GitHub.
& git fetch origin main --quiet

$mainSha = (& git rev-parse main).Trim()
$originMainSha = (& git rev-parse origin/main).Trim()

if ($mainSha -ne $originMainSha) {
    Stop-Factory @"
Local main is not synchronized with origin/main.

Return to main and run:

git switch main
git pull

Then recreate the change branch.
"@
}

# The change branch must start directly from current main.
$mergeBase = (& git merge-base HEAD main).Trim()

if ($mergeBase -ne $mainSha) {
    Stop-Factory "Current branch was not created from the current main baseline."
}

# Nothing may already be staged.
& git diff --cached --quiet

if ($LASTEXITCODE -ne 0) {
    Stop-Factory "There are already staged changes. Unstage them before running the factory."
}

# Before the Builder starts, only the approved Change Contract may be dirty.
$currentDirty = @(git status --porcelain)

foreach ($line in $currentDirty) {
    if ($line.Length -lt 4) {
        continue
    }

    $path = $line.Substring(3).Replace("\", "/")

    if ($path -ne $contractRel) {
        Stop-Factory "Unexpected pre-existing working-tree change: $path"
    }
}

$contractHashBefore = (Get-FileHash $contractFull -Algorithm SHA256).Hash

Write-Host "Branch:   $branch" -ForegroundColor Green
Write-Host "Contract: $contractRel" -ForegroundColor Green
Write-Host ""

# ------------------------------------------------------------
# 2. LOCAL RUNTIME AREA
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

$builderSchema = Join-Path $runtime "builder.schema.json"
$qaSchema = Join-Path $runtime "qa.schema.json"
$reviewerSchema = Join-Path $runtime "reviewer.schema.json"

@'
{
  "type": "object",
  "properties": {
    "status": {
      "type": "string",
      "enum": ["DONE", "BLOCKED"]
    },
    "summary": {
      "type": "string"
    },
    "changed_files": {
      "type": "array",
      "items": { "type": "string" }
    },
    "notes": {
      "type": "array",
      "items": { "type": "string" }
    }
  },
  "required": ["status", "summary", "changed_files", "notes"],
  "additionalProperties": false
}
'@ | Set-Content $builderSchema -Encoding UTF8

@'
{
  "type": "object",
  "properties": {
    "verdict": {
      "type": "string",
      "enum": ["PASS", "PASS_WITH_WARNINGS", "FAIL"]
    },
    "summary": {
      "type": "string"
    },
    "unexpected_changes": {
      "type": "array",
      "items": { "type": "string" }
    },
    "risks": {
      "type": "array",
      "items": { "type": "string" }
    }
  },
  "required": ["verdict", "summary", "unexpected_changes", "risks"],
  "additionalProperties": false
}
'@ | Set-Content $qaSchema -Encoding UTF8

@'
{
  "type": "object",
  "properties": {
    "verdict": {
      "type": "string",
      "enum": [
        "SAFE_TO_REVIEW",
        "REVIEW_WITH_WARNINGS",
        "DO_NOT_MERGE"
      ]
    },
    "summary": {
      "type": "string"
    },
    "files_to_commit": {
      "type": "array",
      "items": { "type": "string" }
    },
    "risks": {
      "type": "array",
      "items": { "type": "string" }
    }
  },
  "required": ["verdict", "summary", "files_to_commit", "risks"],
  "additionalProperties": false
}
'@ | Set-Content $reviewerSchema -Encoding UTF8
# Windows PowerShell may emit a UTF-8 BOM.
# Codex output-schema expects clean JSON, so normalize schemas to UTF-8 without BOM.

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

foreach ($schemaFile in @(
    $builderSchema,
    $qaSchema,
    $reviewerSchema
)) {
    $schemaText = Get-Content $schemaFile -Raw

    [System.IO.File]::WriteAllText(
        $schemaFile,
        $schemaText,
        $utf8NoBom
    )
}
# ------------------------------------------------------------
# 3. BUILDER AGENT
# ------------------------------------------------------------

Write-Host "1/5  Builder Agent" -ForegroundColor Cyan

$builderOutput = Join-Path $runtime "builder.json"

$builderPrompt = @"
Act as the Builder Agent defined in agents/builder.md.

Read:
- AGENTS.md
- agents/builder.md
- $contractRel

Implement the approved Change Contract.

Rules:
- make the smallest safe implementation;
- modify only files necessary for the approved change;
- add or update functional tests when required;
- do not alter the Change Contract;
- do not commit;
- do not push;
- do not create a Pull Request;
- do not update golden screenshots;
- never run Playwright with --update-snapshots;
- do not modify AGENTS.md;
- do not modify agents/;
- do not modify .github/;
- do not modify factory.ps1;
- do not modify playwright.config.*;
- do not modify package.json or package-lock.json;
- do not run browser tests; the deterministic orchestrator runs them separately.

When implementation is complete, return the structured Builder result.
"@

$builder = Invoke-CodexAgent `
    -Sandbox "workspace-write" `
    -SchemaPath $builderSchema `
    -OutputPath $builderOutput `
    -Prompt $builderPrompt

if ($builder.status -ne "DONE") {
    Stop-Factory "Builder returned BLOCKED: $($builder.summary)"
}

# Builder is forbidden from changing the approved contract.
$contractHashAfter = (Get-FileHash $contractFull -Algorithm SHA256).Hash

if ($contractHashAfter -ne $contractHashBefore) {
    Stop-Factory "Builder modified the approved Change Contract."
}

# ------------------------------------------------------------
# 4. PROTECTED-ASSET GUARD
# ------------------------------------------------------------

$changedFiles = @(Get-ChangedFiles)

$protectedChanges = @(
    $changedFiles | Where-Object {
        $_ -eq "AGENTS.md" -or
        $_ -eq "factory.ps1" -or
        $_ -eq "changes/CHANGE-TEMPLATE.md" -or
        $_ -match "^agents/" -or
        $_ -match "^\.github/" -or
        $_ -match "^playwright\.config\." -or
        $_ -match "^package(-lock)?\.json$" -or
        $_ -match "-snapshots/"
    }
)

if ($protectedChanges.Count -gt 0) {
    Write-Host ""
    Write-Host "Protected files changed:" -ForegroundColor Red
    $protectedChanges | ForEach-Object { Write-Host " - $_" }

    Stop-Factory "Protected QA/governance assets were modified."
}

Write-Host "Builder changed:" -ForegroundColor DarkGray
$changedFiles | ForEach-Object { Write-Host " - $_" -ForegroundColor DarkGray }

# ------------------------------------------------------------
# 5. DETERMINISTIC BUILD + PLAYWRIGHT
# ------------------------------------------------------------

Write-Host ""
Write-Host "2/5  Deterministic QA" -ForegroundColor Cyan

$buildLog = Join-Path $runtime "build.log"
$testLog = Join-Path $runtime "playwright.log"

$oldCI = $env:CI
$env:CI = "true"

try {
    & npm.cmd run build *> $buildLog
    $buildExit = $LASTEXITCODE

    & npx.cmd playwright test *> $testLog
    $testExit = $LASTEXITCODE
}
finally {
    $env:CI = $oldCI
}

Write-Host "Build exit code:      $buildExit"
Write-Host "Playwright exit code: $testExit"

# ------------------------------------------------------------
# 6. INDEPENDENT QA AGENT
# ------------------------------------------------------------

Write-Host ""
Write-Host "3/5  Independent QA Agent" -ForegroundColor Cyan

$qaOutput = Join-Path $runtime "qa.json"

$qaPrompt = @"
Act as the independent QA Agent defined in agents/qa.md.

Do NOT trust the Builder's conclusion.

Read:
- AGENTS.md
- agents/qa.md
- $contractRel

Independently inspect:
- git diff against main;
- all changed and untracked files;
- existing regression tests;
- approved visual baselines;
- .factory-runtime/build.log;
- .factory-runtime/playwright.log;
- Playwright report/evidence where useful.

Deterministic execution results:
- npm run build exit code: $buildExit
- npx playwright test exit code: $testExit

Verify:
- every Change Contract acceptance criterion;
- every listed regression scenario;
- no unexplained scope expansion;
- existing tests were not weakened;
- golden screenshots were not changed;
- CSS/config/CI/governance were not changed unless explicitly part of the contract;
- visual regression evidence is consistent with the contract.

Do not modify anything.
Do not fix failures.
Do not update snapshots.
Do not commit or push.

Return the structured QA verdict.
"@

$qa = Invoke-CodexAgent `
    -Sandbox "read-only" `
    -SchemaPath $qaSchema `
    -OutputPath $qaOutput `
    -Prompt $qaPrompt

Write-Host "QA verdict: $($qa.verdict)"

if ($buildExit -ne 0) {
    Stop-Factory "Deterministic build failed. QA report: $qaOutput"
}

if ($testExit -ne 0) {
    Stop-Factory "Deterministic Playwright regression failed. QA report: $qaOutput"
}

if ($qa.verdict -ne "PASS") {
    Stop-Factory "QA verdict is $($qa.verdict). Review: $qaOutput"
}

# ------------------------------------------------------------
# 7. RELEASE REVIEWER
# ------------------------------------------------------------

Write-Host ""
Write-Host "4/5  Release Reviewer Agent" -ForegroundColor Cyan

$reviewerOutput = Join-Path $runtime "reviewer.json"

$reviewPrompt = @"
Act as the independent Release Reviewer Agent defined in agents/reviewer.md.

Read:
- AGENTS.md
- agents/reviewer.md
- $contractRel
- .factory-runtime/qa.json
- .factory-runtime/build.log
- .factory-runtime/playwright.log

Independently inspect the complete git diff against main.

Verify:
- implementation matches the approved Change Contract;
- no requested scope was omitted;
- no unrequested scope was added;
- tests were not weakened or manipulated;
- approved golden screenshots were not changed;
- QA infrastructure and governance were not changed;
- the evidence is sufficient to create a Pull Request.

Do not modify anything.
Do not commit.
Do not push.
Do not merge.

files_to_commit must contain the exact repository-relative paths that should
be included in the proposed commit, including the Change Contract itself.

Return the structured Release Reviewer result.
"@

$review = Invoke-CodexAgent `
    -Sandbox "read-only" `
    -SchemaPath $reviewerSchema `
    -OutputPath $reviewerOutput `
    -Prompt $reviewPrompt

Write-Host "Reviewer verdict: $($review.verdict)"

if ($review.verdict -ne "SAFE_TO_REVIEW") {
    Stop-Factory "Reviewer verdict is $($review.verdict). Review: $reviewerOutput"
}

# ------------------------------------------------------------
# 8. VERIFY EXACT COMMIT CONTENT
# ------------------------------------------------------------

& git diff --check main

if ($LASTEXITCODE -ne 0) {
    Stop-Factory "git diff --check reported patch problems."
}

git add -A

$actualFiles = @(
    git diff --cached --name-only |
    ForEach-Object { $_.Replace("\", "/") } |
    Sort-Object -Unique
)

$expectedFiles = @(
    $review.files_to_commit |
    ForEach-Object { $_.Replace("\", "/") } |
    Sort-Object -Unique
)

$comparison = Compare-Object `
    -ReferenceObject $expectedFiles `
    -DifferenceObject $actualFiles

if ($comparison) {
    git reset | Out-Null

    Write-Host ""
    Write-Host "Reviewer-approved files:" -ForegroundColor Yellow
    $expectedFiles | ForEach-Object { Write-Host " - $_" }

    Write-Host ""
    Write-Host "Files that would actually be committed:" -ForegroundColor Yellow
    $actualFiles | ForEach-Object { Write-Host " - $_" }

    Stop-Factory "Commit file set does not exactly match Reviewer approval."
}

# ------------------------------------------------------------
# 9. COMMIT + PUSH + PR
# ------------------------------------------------------------

Write-Host ""
Write-Host "5/5  GitHub Pull Request" -ForegroundColor Cyan

$heading = (Get-Content $contractFull -First 1).Trim()
$heading = $heading -replace "^#\s*", ""

git commit -m $heading

if ($LASTEXITCODE -ne 0) {
    Stop-Factory "Git commit failed."
}

git push -u origin $branch

if ($LASTEXITCODE -ne 0) {
    Stop-Factory "Git push failed."
}

$prBody = @"
## Change Contract

``$contractRel``

## Local deterministic QA

- Build: **PASS**
- Playwright functional + visual regression: **PASS**

## Independent QA

**$($qa.verdict)**

$($qa.summary)

## Release Review

**$($review.verdict)**

$($review.summary)

## Safety

The protected ``main`` branch still requires the GitHub Actions
``Functional + Visual Regression`` check before merge.

This factory does not auto-merge.
"@

& gh pr create `
    --base main `
    --head $branch `
    --title $heading `
    --body $prBody

if ($LASTEXITCODE -ne 0) {
    Stop-Factory "Pull Request creation failed."
}

$prUrl = (& gh pr view $branch --json url --jq ".url").Trim()

Write-Host ""
Write-Host "Pull Request created:" -ForegroundColor Green
Write-Host $prUrl -ForegroundColor Green

Write-Host ""
Write-Host "Waiting for required GitHub cloud QA..." -ForegroundColor Cyan

Start-Sleep -Seconds 8

& gh pr checks $prUrl --required --watch

$cloudExit = $LASTEXITCODE

Write-Host ""

if ($cloudExit -eq 0) {
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host "PR READY FOR HUMAN REVIEW" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host $prUrl
    Write-Host ""
    Write-Host "The factory will NOT merge it automatically."
}
else {
    Write-Host "==========================================" -ForegroundColor Red
    Write-Host "PR CREATED - CLOUD QA NOT GREEN" -ForegroundColor Red
    Write-Host "==========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host $prUrl
    Write-Host ""
    Write-Host "Do not merge. Inspect the failed GitHub Actions evidence."
    exit 2
}