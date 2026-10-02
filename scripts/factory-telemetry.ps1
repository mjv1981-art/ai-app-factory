$ErrorActionPreference = 'Stop'

function Write-FactoryJsonUtf8 {
    param([string]$Path, $Value)
    $json = $Value | ConvertTo-Json -Depth 12
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($Path, $json, $utf8)
}

function Initialize-FactoryTelemetry {
    param(
        [string]$Path,
        [string]$RequestText
    )

    $doc = [ordered]@{
        started_at = [DateTime]::UtcNow.ToString('o')
        request = $RequestText
        stages = @()
    }
    Write-FactoryJsonUtf8 -Path $Path -Value $doc
}

function Get-CodexUsageFromJsonl {
    param([string]$Path)

    $usage = [ordered]@{
        input_tokens = 0
        cached_input_tokens = 0
        output_tokens = 0
        reasoning_output_tokens = 0
        total_tokens = 0
    }

    if (-not (Test-Path -LiteralPath $Path)) { return [pscustomobject]$usage }

    foreach ($line in [IO.File]::ReadAllLines($Path)) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        try { $event = $line | ConvertFrom-Json } catch { continue }
        if ($event.type -ne 'turn.completed' -or -not $event.usage) { continue }

        foreach ($name in @('input_tokens', 'cached_input_tokens', 'output_tokens', 'reasoning_output_tokens')) {
            if ($event.usage.PSObject.Properties.Name -contains $name) {
                $usage[$name] += [int64]$event.usage.$name
            }
        }
    }

    $usage.total_tokens = [int64]$usage.input_tokens + [int64]$usage.output_tokens
    return [pscustomobject]$usage
}

function Add-FactoryTelemetryStage {
    param(
        [string]$Path,
        [string]$Name,
        [ValidateSet('llm','deterministic','human','git')][string]$Kind,
        [int64]$DurationMs,
        [string]$EventsPath = '',
        [string]$Notes = ''
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        Initialize-FactoryTelemetry -Path $Path -RequestText ''
    }

    $doc = [IO.File]::ReadAllText($Path) | ConvertFrom-Json
    $usage = if ($EventsPath) { Get-CodexUsageFromJsonl -Path $EventsPath } else {
        [pscustomobject]@{
            input_tokens = 0
            cached_input_tokens = 0
            output_tokens = 0
            reasoning_output_tokens = 0
            total_tokens = 0
        }
    }

    $stage = [pscustomobject]@{
        name = $Name
        kind = $Kind
        duration_ms = $DurationMs
        input_tokens = [int64]$usage.input_tokens
        cached_input_tokens = [int64]$usage.cached_input_tokens
        output_tokens = [int64]$usage.output_tokens
        reasoning_output_tokens = [int64]$usage.reasoning_output_tokens
        total_tokens = [int64]$usage.total_tokens
        notes = $Notes
    }

    $doc.stages = @($doc.stages) + @($stage)
    Write-FactoryJsonUtf8 -Path $Path -Value $doc
}

function Add-FactoryProviderTelemetryStage {
    param(
        [string]$Path,
        [string]$Name,
        [string]$Provider,
        [string]$Model,
        [int64]$DurationMs,
        [int64]$InputTokens,
        [int64]$OutputTokens,
        [int64]$TotalTokens,
        [string]$Notes = ''
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        Initialize-FactoryTelemetry -Path $Path -RequestText ''
    }

    $doc = [IO.File]::ReadAllText($Path) | ConvertFrom-Json
    $stage = [pscustomobject]@{
        name = $Name
        kind = 'llm'
        provider = $Provider
        model = $Model
        duration_ms = $DurationMs
        input_tokens = $InputTokens
        cached_input_tokens = 0
        output_tokens = $OutputTokens
        reasoning_output_tokens = 0
        total_tokens = $TotalTokens
        notes = $Notes
    }

    $doc.stages = @($doc.stages) + @($stage)
    Write-FactoryJsonUtf8 -Path $Path -Value $doc
}

function Get-FactoryLlmTokenTotal {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) { return [int64]0 }
    $doc = [IO.File]::ReadAllText($Path) | ConvertFrom-Json
    [int64]$total = 0
    foreach ($stage in @($doc.stages)) {
        if ($stage.kind -eq 'llm') {
            $total += [int64]$stage.total_tokens
        }
    }
    return $total
}

function Set-FactoryTelemetryMilestone {
    param(
        [string]$Path,
        [string]$Name
    )

    if (-not (Test-Path -LiteralPath $Path)) { return }
    $doc = [IO.File]::ReadAllText($Path) | ConvertFrom-Json
    $started = [DateTime]::Parse($doc.started_at).ToUniversalTime()
    $elapsedMs = [int64]([DateTime]::UtcNow - $started).TotalMilliseconds
    if (-not ($doc.PSObject.Properties.Name -contains 'milestones')) {
        $doc | Add-Member -NotePropertyName milestones -NotePropertyValue ([pscustomobject]@{})
    }
    $doc.milestones | Add-Member -NotePropertyName $Name -NotePropertyValue $elapsedMs -Force
    Write-FactoryJsonUtf8 -Path $Path -Value $doc
}

function Complete-FactoryTelemetry {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) { return }
    $doc = [IO.File]::ReadAllText($Path) | ConvertFrom-Json
    $doc | Add-Member -NotePropertyName completed_at -NotePropertyValue ([DateTime]::UtcNow.ToString('o')) -Force
    Write-FactoryJsonUtf8 -Path $Path -Value $doc
}

function Show-FactoryTelemetrySummary {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) { return }
    $doc = [IO.File]::ReadAllText($Path) | ConvertFrom-Json
    $stages = @($doc.stages)
    if ($stages.Count -eq 0) { return }

    Write-Host ''
    Write-Host '=== Factory telemetry ===' -ForegroundColor Cyan
    foreach ($stage in $stages) {
        $seconds = [math]::Round(([double]$stage.duration_ms / 1000), 1)
        if ($stage.kind -eq 'llm') {
            $providerLabel = if (($stage.PSObject.Properties.Name -contains "provider") -and $stage.provider) { " [$($stage.provider)/$($stage.model)]" } else { "" }
            Write-Host ("{0,-24} {1,7}s  tokens={2} (in={3}, cached={4}, out={5}, reasoning={6}){7}" -f $stage.name, $seconds, $stage.total_tokens, $stage.input_tokens, $stage.cached_input_tokens, $stage.output_tokens, $stage.reasoning_output_tokens, $providerLabel)
        } else {
            Write-Host ("{0,-24} {1,7}s  [{2}]" -f $stage.name, $seconds, $stage.kind)
        }
    }

    $llm = @($stages | Where-Object { $_.kind -eq 'llm' })
    [int64]$totalMs = 0
    [int64]$totalInput = 0
    [int64]$totalCached = 0
    [int64]$totalOutput = 0
    [int64]$totalReasoning = 0
    [int64]$totalTokens = 0

    foreach ($stage in $stages) {
        $totalMs += [int64]$stage.duration_ms
    }
    foreach ($stage in $llm) {
        $totalInput += [int64]$stage.input_tokens
        $totalCached += [int64]$stage.cached_input_tokens
        $totalOutput += [int64]$stage.output_tokens
        $totalReasoning += [int64]$stage.reasoning_output_tokens
        $totalTokens += [int64]$stage.total_tokens
    }
    Write-Host ('-' * 78)
    Write-Host ("Tracked time: {0}s | LLM tokens: {1} (in={2}, cached={3}, out={4}, reasoning={5})" -f [math]::Round(([double]$totalMs / 1000),1), $totalTokens, $totalInput, $totalCached, $totalOutput, $totalReasoning)
    if (($doc.PSObject.Properties.Name -contains 'milestones') -and ($doc.milestones.PSObject.Properties.Name -contains 'working_change_ready')) {
        Write-Host ("Time to working change: {0}s" -f [math]::Round(([double]$doc.milestones.working_change_ready / 1000),1))
    }
    Write-Host "Telemetry file: $Path" -ForegroundColor DarkGray
}
