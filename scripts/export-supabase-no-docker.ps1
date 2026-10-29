# ELH CRM - SUPABASE BACKEND CATALOG EXPORT (NO DOCKER, NO EXTRA INSTALL)
# Read-only Management API endpoint; metadata only, NOT a restorable pg_dump.
# Compatible with Windows PowerShell 5.1+. NEVER runs DDL/DML on Production.
[CmdletBinding()]
param(
    [string]$ProjectRef = 'qmzmkijlarwdlslipaou',
    [string]$RepoRoot = '',
    [string]$OutputRoot = ''
)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Save-JsonUtf8($Path, $Object) {
    $j = ConvertTo-Json -InputObject $Object -Depth 60
    [System.IO.File]::WriteAllText($Path, $j, (New-Object System.Text.UTF8Encoding($false)))
}
function Save-TextUtf8($Path, $Text) {
    [System.IO.File]::WriteAllText($Path, $Text, (New-Object System.Text.UTF8Encoding($false)))
}
function Get-ClientRows($Response) {
    if ($null -eq $Response) { return @() }
    if ($Response -is [System.Array]) { return @($Response) }
    if ($null -ne $Response.data) { return @($Response.data) }
    if ($null -ne $Response.result) { return @($Response.result) }
    if ($null -ne $Response.rows) { return @($Response.rows) }
    return @($Response)
}
function Invoke-ReadOnlyQuery($Sql, $Key) {
    $address = 'https://api.supabase.com/v1/projects/' + $ProjectRef + '/database/query/read-only'
    $body = @{ query = $Sql } | ConvertTo-Json -Compress
    $headers = @{ Authorization = ('Bearer ' + $Key); Accept = 'application/json' }
    $result = Invoke-RestMethod -Uri $address -Method Post -Headers $headers -ContentType 'application/json' -Body $body -TimeoutSec 150
    # Let PowerShell enumerate result rows rather than wrapping them as one array item.
    Get-ClientRows $result
}
function Get-SourceStatus($Root) {
    $summary = [ordered]@{ detected_root = $Root; exists = (Test-Path -LiteralPath $Root -PathType Container); checks = @(); files_reviewed = 0; caution_files = @() }
    if (-not $summary.exists) { return $summary }
    $checks = @('src', 'tests', 'public', 'supabase/functions', 'supabase/migrations', 'index.html', 'package.json', 'package-lock.json', 'README.md', '.gitignore', '.env.example')
    foreach ($part in $checks) {
        $name = $part.Replace('/', [IO.Path]::DirectorySeparatorChar)
        $summary.checks += [ordered]@{ path = $part; present = (Test-Path -LiteralPath (Join-Path $Root $name)) }
    }
    $files = @(Get-ChildItem -LiteralPath $Root -File -Recurse -ErrorAction SilentlyContinue | Where-Object {
        $_.FullName -notmatch '[\\/](node_modules|dist|\.git|coverage|\.vite)[\\/]'
    })
    $summary.files_reviewed = $files.Count
    foreach ($f in $files) {
        $rel = $f.FullName.Substring($Root.TrimEnd('\','/').Length).TrimStart('\','/')
        if ($f.Name -match '^(\.env(\..+)?|\.pgpass)$' -and $f.Name -ne '.env.example') {
            $summary.caution_files += [ordered]@{ path = $rel; reason = 'Potential credentials file - DO NOT COMMIT' }
        }
        if ($f.Name -match '(?i)(customer.*\.csv|lead.*export.*\.csv|\.pem|\.pfx|\.p12|\.dump|\.backup)$') {
            $summary.caution_files += [ordered]@{ path = $rel; reason = 'Sensitive data / credential candidate - DO NOT COMMIT' }
        }
        # Basic content scan: report file names only, NEVER print matched secret values.
        if (($f.Extension -in @('.js','.jsx','.ts','.tsx','.json','.mjs','.sql','.toml','.ps1','.html')) -and $f.Length -lt 2097152) {
            try {
                $lineNo = 0
                foreach ($line in [System.IO.File]::ReadLines($f.FullName)) {
                    $lineNo++
                    if ($line -match '(?i)(sb_secret_[a-z0-9_\-]{10,}|sbp_[a-z0-9_\-]{12,}|postgres(?:ql)?://[^\s]+:[^\s]+@|eyJhbGciOi[A-Za-z0-9_\-]{24,})') {
                        $summary.caution_files += [ordered]@{ path = $rel; line_number = $lineNo; reason = 'Possible embedded token, JWT, or DB password - REVIEW' }
                        break
                    }
                }
            } catch { # Permission denied, binary file, etc: report without leaking content.
                $summary.caution_files += [ordered]@{ path = $rel; reason = 'Content scan unavailable; review manually' }
            }
        }
    }
    return $summary
}

# Resolve repository directory from this script, not a cmd argument ending in backslash.
# The previous RUN_EXPORT_NO_DOCKER.cmd quoted "%~dp0" with trailing backslash,
# which can cause an illegal path argument on some Windows command line parsers.
if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $RepoRoot = [System.IO.Path]::GetFullPath((Join-Path -Path $PSScriptRoot -ChildPath '..'))
} else {
    $RepoRoot = $RepoRoot.Trim().Trim('"')
}
if (-not (Test-Path -LiteralPath $RepoRoot -PathType Container)) {
    throw "Repository path not found or invalid. Location: $RepoRoot"
}
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
if ($ProjectRef -notmatch '^[a-z0-9]{20}$') { throw 'Project ref format looks wrong. Stop to avoid exporting the wrong project.' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
    $desktop = [Environment]::GetFolderPath('Desktop')
    if ([string]::IsNullOrWhiteSpace($desktop)) { $desktop = [Environment]::GetFolderPath('MyDocuments') }
    $OutputRoot = Join-Path $desktop 'ELH_CRM_LOCAL_EXPORTS_DO_NOT_UPLOAD'
}
$folder = Join-Path $OutputRoot ("backend_{0}_{1}" -f $ProjectRef, $stamp)
New-Item -ItemType Directory -Force -Path $folder | Out-Null
Write-Host "`nELH CRM BACKEND EXPORT - NO DOCKER" -ForegroundColor Cyan
Write-Host "PowerShell: $($PSVersionTable.PSVersion)"
Write-Host "Node.js installed (NOT required): $([bool](Get-Command node -ErrorAction SilentlyContinue))"
Write-Host 'Docker NOT required. No npm install, no database migration, no git push.'
Write-Host "Project ref: $ProjectRef"
Write-Host "Local output: $folder"
$sourceStatus = Get-SourceStatus $RepoRoot
Save-JsonUtf8 (Join-Path $folder 'source_inventory.json') $sourceStatus
Write-Host "Local source files found: $($sourceStatus.files_reviewed)"

# Catalog-only SQL: never SELECT rows from customers, leads, Auth users, calls, or any application data.
$queries = [ordered]@{
    tables = @'
SELECT n.nspname AS schema_name, c.relname AS relation_name,
       CASE c.relkind WHEN 'r' THEN 'table' WHEN 'p' THEN 'partitioned_table' ELSE c.relkind::text END AS relation_type,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced,
       pg_catalog.obj_description(c.oid, 'pg_class') AS description
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public','private') AND c.relkind IN ('r','p')
ORDER BY n.nspname, c.relname
'@
    columns = @'
SELECT n.nspname AS schema_name, c.relname AS relation_name, a.attnum AS ordinal,
       a.attname AS column_name,
       pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
       a.attnotnull AS not_null, a.attidentity AS identity_type, a.attgenerated AS generated_type,
       pg_catalog.pg_get_expr(d.adbin, d.adrelid) AS default_expression
FROM pg_catalog.pg_attribute a
JOIN pg_catalog.pg_class c ON c.oid=a.attrelid
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
WHERE n.nspname IN ('public','private') AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped
ORDER BY n.nspname,c.relname,a.attnum
'@
    constraints = @'
SELECT n.nspname AS schema_name, c.relname AS relation_name, co.conname AS constraint_name,
       co.contype AS constraint_type, co.convalidated AS validated,
       pg_catalog.pg_get_constraintdef(co.oid, true) AS definition
FROM pg_catalog.pg_constraint co
JOIN pg_catalog.pg_class c ON c.oid=co.conrelid
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','private')
ORDER BY n.nspname,c.relname,co.conname
'@
    indexes = @'
SELECT schemaname AS schema_name, tablename AS relation_name,
       indexname AS index_name, indexdef AS definition
FROM pg_catalog.pg_indexes
WHERE schemaname IN ('public','private')
ORDER BY schemaname,tablename,indexname
'@
    policies = @'
SELECT schemaname AS schema_name, tablename AS relation_name, policyname AS policy_name,
       permissive, roles, cmd, qual AS using_expression, with_check AS check_expression
FROM pg_catalog.pg_policies
WHERE schemaname IN ('public','private')
ORDER BY schemaname,tablename,policyname
'@
    routines = @'
SELECT n.nspname AS schema_name, p.proname AS routine_name,
       p.oid::pg_catalog.regprocedure::text AS signature,
       p.prosecdef AS security_definer,
       p.prokind AS routine_type,
       pg_catalog.pg_get_functiondef(p.oid) AS definition
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname IN ('public','private') AND p.prokind IN ('f','p')
ORDER BY n.nspname,p.proname,p.oid::pg_catalog.regprocedure::text
'@
    triggers = @'
SELECT n.nspname AS schema_name,c.relname AS relation_name,t.tgname AS trigger_name,
       pg_catalog.pg_get_triggerdef(t.oid,true) AS definition
FROM pg_catalog.pg_trigger t
JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','private') AND NOT t.tgisinternal
ORDER BY n.nspname,c.relname,t.tgname
'@
    views = @'
SELECT schemaname AS schema_name, viewname AS view_name, 'view' AS kind, definition
FROM pg_catalog.pg_views WHERE schemaname IN ('public','private')
UNION ALL
SELECT schemaname AS schema_name, matviewname AS view_name,'materialized_view' AS kind, definition
FROM pg_catalog.pg_matviews WHERE schemaname IN ('public','private')
ORDER BY schema_name,view_name
'@
    enums = @'
SELECT n.nspname AS schema_name,t.typname AS type_name,e.enumlabel AS label,e.enumsortorder AS sort_order
FROM pg_catalog.pg_enum e
JOIN pg_catalog.pg_type t ON t.oid=e.enumtypid
JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
WHERE n.nspname IN ('public','private')
ORDER BY n.nspname,t.typname,e.enumsortorder
'@
    sequences = @'
SELECT schemaname AS schema_name, sequencename AS sequence_name,
       data_type,start_value,min_value,max_value,increment_by,cycle,cache_size
FROM pg_catalog.pg_sequences
WHERE schemaname IN ('public','private')
ORDER BY schemaname,sequencename
'@
    extensions = @'
SELECT e.extname AS extension_name,e.extversion AS extension_version,
       n.nspname AS schema_name
FROM pg_catalog.pg_extension e
JOIN pg_catalog.pg_namespace n ON n.oid=e.extnamespace
ORDER BY e.extname
'@
    grants = @'
SELECT table_schema AS schema_name,table_name AS relation_name,grantee,privilege_type,is_grantable
FROM information_schema.role_table_grants
WHERE table_schema IN ('public','private')
ORDER BY table_schema,table_name,grantee,privilege_type
'@
}

# Scoped PAT is only used in memory. No token is written to files or console.
$secure = $null; $pointer = [IntPtr]::Zero; $accessToken = $null
$results = New-Object System.Collections.Generic.List[object]
$fatalError = $null
try {
    if (-not [string]::IsNullOrWhiteSpace($env:SUPABASE_ACCESS_TOKEN)) {
        Write-Host 'Using existing SUPABASE_ACCESS_TOKEN from current session (not saving it).'
        $accessToken = $env:SUPABASE_ACCESS_TOKEN
    } else {
        Write-Host "`nCreate a SCOPED Database READ token for this project at:" -ForegroundColor Yellow
        Write-Host 'https://supabase.com/dashboard/account/tokens'
        Write-Host 'Do NOT paste token into ChatGPT, GitHub, a source file, or PowerShell commands.'
        $secure = Read-Host 'Paste token securely here (hidden)' -AsSecureString
        $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        $accessToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    if ([string]::IsNullOrWhiteSpace($accessToken)) { throw 'Missing access token; no API queries were run.' }

    Write-Host "`nVerifying Management API read-only access..."
    try {
        $probe = Invoke-ReadOnlyQuery 'SELECT 1 AS ok, pg_catalog.current_database() AS database_name, CURRENT_USER AS query_role' $accessToken
        Save-JsonUtf8 (Join-Path $folder 'connection_check.json') @($probe)
        Write-Host 'Connection: OK. No app/customer rows queried.' -ForegroundColor Green
    } catch {
        Write-Warning ('Read-only connection failed: ' + $_.Exception.Message)
        Write-Warning 'Check ProjectRef, token Database READ permission and Supabase beta endpoint availability.'
        throw 'Stopped safely; source_inventory.json is still available.'
    }
    foreach ($item in $queries.GetEnumerator()) {
        Write-Host ("Exporting catalog: {0} ..." -f $item.Key) -NoNewline
        try {
            $rows = @(Invoke-ReadOnlyQuery $item.Value $accessToken)
            Save-JsonUtf8 (Join-Path $folder ("catalog_{0}.json" -f $item.Key)) @($rows)
            $results.Add([ordered]@{ section=$item.Key; status='OK'; count=$rows.Count })
            Write-Host (" OK ({0} items)" -f $rows.Count) -ForegroundColor Green
        } catch {
            $results.Add([ordered]@{ section=$item.Key; status='FAILED'; count=0; error=$_.Exception.Message })
            Write-Host ' FAILED (see report)' -ForegroundColor Yellow
        }
    }
} catch {
    $fatalError = $_.Exception.Message
    Write-Host ("Export stopped: " + $fatalError) -ForegroundColor Red
} finally {
    $accessToken = $null
    if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    $secure = $null
}
# PS 5.1 fix: do NOT use @($results) for a generic List[object].
# On Windows PowerShell 5.1 this can throw: "Argument types do not match".
$sectionArray = $results.ToArray()
$failures = 0
foreach ($entry in $sectionArray) {
    if ($entry['status'] -ne 'OK') { $failures++ }
}
$manifest = [ordered]@{
    export_date_local=(Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    target_ref=$ProjectRef
    origin='Supabase Management API read-only beta'
    is_pg_dump=$false
    includes_customer_records=$false
    includes_auth_user_records=$false
    is_restorable_backup=$false
    export_complete=([string]::IsNullOrWhiteSpace($fatalError) -and $failures -eq 0 -and $results.Count -eq $queries.Count)
    fatal_error=$fatalError
    source_checks='source_inventory.json'
    sections=$sectionArray
}
Save-JsonUtf8 (Join-Path $folder 'EXPORT_MANIFEST.json') $manifest
$help = @'
ELH CRM - LOCAL BACKEND CATALOG EXPORT
====================================
THIS IS A CATALOG/DDL REFERENCE EXPORT, NOT A FULL RESTORABLE POSTGRES DUMP.
No application/customer rows or Auth users were selected.
Routines and RLS policies may contain embedded credentials: REVIEW ALL OUTPUT BEFORE SHARING.
Files remain ONLY on this PC (Desktop/ELH_CRM_LOCAL_EXPORTS_DO_NOT_UPLOAD).
DO NOT upload this folder, real .env files or real customer exports to GitHub.
A vetted schema snapshot/migration may later be committed after separate review.
Supabase Management API read-only endpoint is BETA; check EXPORT_MANIFEST.json for failed sections.
To back up actual customer data/Auth, use a separate encrypted backup procedure and restore test.
'@
Save-TextUtf8 (Join-Path $folder 'READ_THIS_FIRST.txt') $help
Write-Host "`nEXPORTED TO: $folder" -ForegroundColor Cyan
Write-Host "Sections OK: $($results.Count - $failures) / $($queries.Count). Failures: $failures"
Write-Host 'This did NOT write to Supabase Production or GitHub.'
Write-Host 'Next: share EXPORT_MANIFEST.json and source_inventory.json (not raw routines) for review.'
if (-not [string]::IsNullOrWhiteSpace($fatalError)) { exit 1 }
if ($failures -gt 0) { exit 2 }
