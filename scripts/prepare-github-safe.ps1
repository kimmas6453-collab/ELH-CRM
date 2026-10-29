# ELH CRM - offline sanitize Supabase catalog into GitHub-safe structural inventory
# Windows PowerShell 5.1+. No Docker, Node, PAT, API calls, or changes to Production.
[CmdletBinding()]
param([string]$ExportDirectory = '')
$ErrorActionPreference = 'Stop'
function Save-JsonUtf8([string]$Path, $Obj) {
    $data = ConvertTo-Json -InputObject $Obj -Depth 40
    [IO.File]::WriteAllText($Path, $data + [Environment]::NewLine, (New-Object Text.UTF8Encoding($false)))
}
function Get-SectionRows([string]$Folder, [string]$Section, [int]$Expected) {
    $file = Join-Path $Folder ("catalog_{0}.json" -f $Section)
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Missing section: $file" }
    $parsed = @(Get-Content -LiteralPath $file -Raw -Encoding UTF8 | ConvertFrom-Json)
    if ($parsed.Count -ne $Expected) {
        throw ("Section {0} count mismatch. Expected {1}, got {2}" -f $Section,$Expected,$parsed.Count)
    }
    return ,$parsed
}
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if ([string]::IsNullOrWhiteSpace($ExportDirectory)) {
    $desktop = [Environment]::GetFolderPath('Desktop')
    $root = Join-Path $desktop 'ELH_CRM_LOCAL_EXPORTS_DO_NOT_UPLOAD'
    if (-not (Test-Path -LiteralPath $root -PathType Container)) { throw "Export folder not found on Desktop: $root" }
    $found = @(Get-ChildItem -LiteralPath $root -Directory | Where-Object {
        $_.Name -like 'backend_qmzmkijlarwdlslipaou_*' -and
        (Test-Path -LiteralPath (Join-Path $_.FullName 'EXPORT_MANIFEST.json') -PathType Leaf) -and
        (Test-Path -LiteralPath (Join-Path $_.FullName 'catalog_tables.json') -PathType Leaf)
    } | Sort-Object LastWriteTime -Descending)
    if ($found.Count -eq 0) { throw 'No full local export found. Existing 12 catalog_*.json files must be present in the same export directory.' }
    $ExportDirectory = $found[0].FullName
}
$ExportDirectory = (Resolve-Path -LiteralPath $ExportDirectory).Path
$manifestPath = Join-Path $ExportDirectory 'EXPORT_MANIFEST.json'
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw 'EXPORT_MANIFEST.json is missing in selected local export.'
}
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifest.target_ref -ne 'qmzmkijlarwdlslipaou') { throw 'Wrong Supabase project ref. Refusing to process.' }
$required = @('tables','columns','constraints','indexes','policies','routines','triggers','views','enums','sequences','extensions','grants')
$allRows = @{}
$countMap = [ordered]@{}
foreach ($name in $required) {
    $sectionMatch = @($manifest.sections | Where-Object { $_.section -eq $name })
    if ($sectionMatch.Count -ne 1 -or $sectionMatch[0].status -ne 'OK') { throw "Incomplete or ambiguous manifest section: $name" }
    $expected = [int]$sectionMatch[0].count
    $allRows[$name] = Get-SectionRows -Folder $ExportDirectory -Section $name -Expected $expected
    $countMap[$name] = $expected
}
# ONLY whitelisted structural metadata; ignore raw SQL, function bodies, defaults, comments and policy expressions.
# Do not include customer records or actual values, secrets, local paths, token data.
$tables = @(
    foreach($r in $allRows['tables']) {
        [ordered]@{
            schema = [string]$r.schema_name
            name = [string]$r.relation_name
            type = [string]$r.relation_type
            rlsEnabled = [bool]$r.rls_enabled
        }
    }
)
$columns = @(
    foreach($r in $allRows['columns']) {
        [ordered]@{
            schema = [string]$r.schema_name
            table = [string]$r.relation_name
            column = [string]$r.column_name
            type = [string]$r.data_type
            notNull = [bool]$r.not_null
            identity = [string]$r.identity_type
            generated = [string]$r.generated_type
        }
    }
)
$constraints = @(
    foreach($r in $allRows['constraints']) {
        [ordered]@{
            schema = [string]$r.schema_name
            table = [string]$r.relation_name
            name = [string]$r.constraint_name
            type = [string]$r.constraint_type
        }
    }
)
$indexes = @(
    foreach($r in $allRows['indexes']) {
        [ordered]@{ schema = [string]$r.schema_name; table = [string]$r.relation_name; name = [string]$r.index_name }
    }
)
$policies = @(
    foreach($r in $allRows['policies']) {
        [ordered]@{ schema = [string]$r.schema_name; table = [string]$r.relation_name; name = [string]$r.policy_name; command = [string]$r.cmd }
    }
)
$routines = @(
    foreach($r in $allRows['routines']) {
        [ordered]@{
            schema = [string]$r.schema_name
            name = [string]$r.routine_name
            securityDefiner = [bool]$r.security_definer
            routineType = [string]$r.routine_type
        }
    }
)
$triggers = @(
    foreach($r in $allRows['triggers']) {
        [ordered]@{ schema = [string]$r.schema_name; table = [string]$r.relation_name; name = [string]$r.trigger_name }
    }
)
$sequences = @(
    foreach($r in $allRows['sequences']) {
        [ordered]@{ schema = [string]$r.schema_name; name = [string]$r.sequence_name }
    }
)
$safe = [ordered]@{
    schemaSnapshot = '2026-10-29'
    projectRef = 'qmzmkijlarwdlslipaou'
    content = 'SANITIZED structural metadata only (no SQL definitions or data)'
    restoreReady = $false
    catalogCounts = $countMap
    tables = $tables
    columns = $columns
    constraints = $constraints
    indexes = $indexes
    policies = $policies
    routines = $routines
    triggers = $triggers
    sequences = $sequences
}
$dest = Join-Path $repo 'docs\backend\production_structure_20261029_SANITIZED.json'
Save-JsonUtf8 -Path $dest -Obj $safe
Write-Host ''
Write-Host 'COMPLETE: sanitized metadata saved inside repo.' -ForegroundColor Green
Write-Host ('Read-only offline input: ' + $ExportDirectory)
Write-Host ('GitHub candidate: ' + $dest)
Write-Host 'Raw catalog files remain LOCAL and outside the repo.' -ForegroundColor Green
Write-Host 'No database calls. No schema changes. No GitHub push. No data/SQL/secret exported.'
