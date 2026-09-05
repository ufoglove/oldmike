$ErrorActionPreference = "Stop"
$pgBin = "C:\Program Files\PostgreSQL\18\bin"
$requiredTools = @("initdb.exe", "pg_ctl.exe", "createdb.exe", "psql.exe")
foreach ($tool in $requiredTools) {
  if (-not (Test-Path -LiteralPath (Join-Path $pgBin $tool) -PathType Leaf)) {
    Write-Output '{"status":"BLOCKED","reasonCode":"LOCAL_POSTGRESQL18_TOOL_MISSING"}'
    exit 2
  }
}

function Get-FreePort {
  $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
  $listener.Start()
  try { return ([Net.IPEndPoint]$listener.LocalEndpoint).Port } finally { $listener.Stop() }
}

$temporaryBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$executionId = [Guid]::NewGuid().ToString("N")
$temporaryRoot = [IO.Path]::GetFullPath((Join-Path $temporaryBase ("old-mike-beta2-a1-" + $executionId)))
if (-not $temporaryRoot.StartsWith($temporaryBase, [StringComparison]::OrdinalIgnoreCase)) { throw "TEMP_CONTAINMENT_INVALID" }
$cluster = Join-Path $temporaryRoot "postgres"
$logs = Join-Path $temporaryRoot "logs"
New-Item -ItemType Directory -Path $cluster, $logs | Out-Null
$port = Get-FreePort
$databaseName = "old_mike_beta2_disposable_$executionId"
$started = $false
$exitCode = 2
$stage = "PREFLIGHT"
$nodeResult = $null

try {
  $stage = "INITDB"
  & (Join-Path $pgBin "initdb.exe") -D $cluster -U postgres -A trust --no-locale *> (Join-Path $logs "initdb.log")
  if ($LASTEXITCODE -ne 0) { throw "INITDB_FAILED" }

  $stage = "POSTGRES_START"
  $start = Start-Process -FilePath (Join-Path $pgBin "pg_ctl.exe") -ArgumentList @("-D", $cluster, "-l", (Join-Path $logs "postgres.log"), "-o", "`"-h 127.0.0.1 -p $port`"", "-w", "start") -WindowStyle Hidden -PassThru
  if (-not $start.WaitForExit(45000) -or $start.ExitCode -ne 0) { throw "POSTGRES_START_FAILED" }
  $started = $true

  $stage = "DATABASE_CREATE"
  & (Join-Path $pgBin "createdb.exe") -h 127.0.0.1 -p $port -U postgres $databaseName *> (Join-Path $logs "createdb.log")
  if ($LASTEXITCODE -ne 0) { throw "DATABASE_CREATE_FAILED" }

  $env:PGOPTIONS = "-c client_min_messages=warning"
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
  $migrationPaths = @()
  foreach ($ordinal in 1..7) {
    $matches = @(Get-ChildItem -LiteralPath "database\migrations" -Filter (("{0:D4}_*.up.sql" -f $ordinal)) -File)
    if ($matches.Count -ne 1) { throw ("BASELINE_MIGRATION_{0:D4}_AUTHORITY_INVALID" -f $ordinal) }
    $migrationPaths += $matches[0].FullName
  }

  $stage = "BASELINE_MIGRATIONS"
  foreach ($migrationPath in $migrationPaths) {
    $migrationName = [IO.Path]::GetFileNameWithoutExtension($migrationPath)
    & (Join-Path $pgBin "psql.exe") -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $port -U postgres -d $databaseName -f $migrationPath *> (Join-Path $logs ($migrationName + ".log"))
    if ($LASTEXITCODE -ne 0) { throw "BASELINE_MIGRATION_FAILED" }
  }

  $stage = "BETA2_UP"
  & (Join-Path $pgBin "psql.exe") -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $port -U postgres -d $databaseName -f "database\proposals\v2-beta2-durable-core.up.sql" *> (Join-Path $logs "beta2-up.log")
  if ($LASTEXITCODE -ne 0) { throw "BETA2_UP_FAILED" }

  $stage = "BETA2_VERIFY"
  $verifyLog = Join-Path $logs "beta2-verify.log"
  & (Join-Path $pgBin "psql.exe") -X -A -t -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $port -U postgres -d $databaseName -f "database\proposals\v2-beta2-durable-core.verify.sql" -o $verifyLog
  if ($LASTEXITCODE -ne 0 -or -not (Select-String -LiteralPath $verifyLog -Pattern '^BETA2_DURABLE_CORE_VERIFY=PASS$' -Quiet)) { throw "BETA2_VERIFY_FAILED" }

  $stage = "RESTRICTED_APP_LOGIN"
  & (Join-Path $pgBin "psql.exe") -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $port -U postgres -d $databaseName -c "CREATE ROLE old_mike_beta2_app_local LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT; GRANT old_mike_beta2_app TO old_mike_beta2_app_local" *> (Join-Path $logs "restricted-role.log")
  if ($LASTEXITCODE -ne 0) { throw "RESTRICTED_APP_LOGIN_FAILED" }

  $stage = "FIXTURE_SEED"
  $seedSql = @"
INSERT INTO "user"(id,name,email,"emailVerified") VALUES
  ('beta2-user-01','Beta2 Local User','beta2-user@example.invalid',true),
  ('beta2-user-other','Other Local User','beta2-other@example.invalid',true);
INSERT INTO workspaces(id,name,owner_user_id) VALUES
  ('beta2-workspace-01','Beta2 Local Workspace','beta2-user-01'),
  ('beta2-workspace-other','Other Workspace','beta2-user-other');
INSERT INTO workspace_members(workspace_id,user_id,role) VALUES
  ('beta2-workspace-01','beta2-user-01','owner'),
  ('beta2-workspace-other','beta2-user-other','owner');
INSERT INTO projects(project_id,workspace_id,created_by,title,status,legacy,storage_backend)
SELECT 'beta2-project-' || lpad(value::text,2,'0'),'beta2-workspace-01','beta2-user-01','Beta2 Project ' || value,'ACTIVE',false,'POSTGRES_INDEX_PENDING_SAFE_STORAGE'
FROM generate_series(1,25) AS value;
INSERT INTO projects(project_id,workspace_id,created_by,title,status,legacy,storage_backend) VALUES
  ('beta2-project-inactive','beta2-workspace-01','beta2-user-01','Inactive','LEGACY_UNCLAIMED',true,'POSTGRES_INDEX_PENDING_SAFE_STORAGE'),
  ('beta2-project-other','beta2-workspace-other','beta2-user-other','Other','ACTIVE',false,'POSTGRES_INDEX_PENDING_SAFE_STORAGE');
"@
  $seedSql | & (Join-Path $pgBin "psql.exe") -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $port -U postgres -d $databaseName *> (Join-Path $logs "seed.log")
  if ($LASTEXITCODE -ne 0) { throw "FIXTURE_SEED_FAILED" }

  $stage = "POSTGRES_CONTRACTS"
  $env:BETA2_DISPOSABLE_DATABASE_URL = "postgresql://old_mike_beta2_app_local@127.0.0.1:$port/$databaseName`?application_name=old_mike_beta2_disposable"
  $env:NODE_NO_WARNINGS = "1"
  $nodeStderr = Join-Path $logs "node.stderr.log"
  $savedErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $nodeResult = & node --experimental-strip-types --experimental-loader ./scripts/disposable-server-only-loader.mjs scripts/verify-v2-beta2-durable-core-postgres.mjs 2> $nodeStderr
  $nodeExitCode = $LASTEXITCODE
  $ErrorActionPreference = $savedErrorActionPreference
  if ($nodeExitCode -ne 0) {
    Write-Output ($nodeResult | Out-String)
    Write-Output ((Get-Content -LiteralPath $nodeStderr -Tail 24) -join "`n")
    throw "POSTGRES_CONTRACTS_FAILED"
  }
  $parsedNodeResult = $nodeResult | Select-Object -Last 1 | ConvertFrom-Json
  if ($parsedNodeResult.status -ne "PASS") { throw "POSTGRES_CONTRACT_RESULT_INVALID" }

  $stage = "FORMAL_WRITE_POSTCHECK"
  $formalRows = & (Join-Path $pgBin "psql.exe") -X -A -t -h 127.0.0.1 -p $port -U postgres -d $databaseName -c "SELECT (SELECT count(*) FROM research_documents)+(SELECT count(*) FROM research_studies)+(SELECT count(*) FROM research_human_gates)"
  if (($formalRows | Select-Object -Last 1).Trim() -ne "0") { throw "FORMAL_RESEARCH_WRITE_OBSERVED" }

  $stage = "DOWN_REFUSAL"
  $savedErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & (Join-Path $pgBin "psql.exe") -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $port -U postgres -d $databaseName -f "database\proposals\v2-beta2-durable-core.down.sql" *> (Join-Path $logs "down-refusal.log")
  $downRefusalExitCode = $LASTEXITCODE
  $ErrorActionPreference = $savedErrorActionPreference
  if ($downRefusalExitCode -eq 0) { throw "DOWN_DID_NOT_REFUSE_NONEMPTY" }
  $existsAfterRefusal = & (Join-Path $pgBin "psql.exe") -X -A -t -h 127.0.0.1 -p $port -U postgres -d $databaseName -c "SELECT to_regclass('public.beta2_generation_jobs') IS NOT NULL"
  if (($existsAfterRefusal | Select-Object -Last 1).Trim() -ne "t") { throw "DOWN_REFUSAL_WAS_NOT_ATOMIC" }

  $stage = "DISPOSABLE_ROW_CLEANUP"
  & (Join-Path $pgBin "psql.exe") -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $port -U postgres -d $databaseName -c "TRUNCATE beta2_operation_intents, beta2_project_events, beta2_project_snapshots, beta2_generation_receipts, beta2_generation_jobs" *> (Join-Path $logs "truncate.log")
  if ($LASTEXITCODE -ne 0) { throw "DISPOSABLE_ROW_CLEANUP_FAILED" }

  $stage = "DOWN_EMPTY"
  & (Join-Path $pgBin "psql.exe") -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $port -U postgres -d $databaseName -f "database\proposals\v2-beta2-durable-core.down.sql" *> (Join-Path $logs "down-empty.log")
  if ($LASTEXITCODE -ne 0) { throw "DOWN_EMPTY_FAILED" }
  $remaining = & (Join-Path $pgBin "psql.exe") -X -A -t -h 127.0.0.1 -p $port -U postgres -d $databaseName -c "SELECT count(*) FROM unnest(ARRAY['beta2_generation_jobs','beta2_generation_receipts','beta2_project_snapshots','beta2_project_events','beta2_operation_intents']) name WHERE to_regclass('public.' || name) IS NOT NULL"
  if (($remaining | Select-Object -Last 1).Trim() -ne "0") { throw "DOWN_OBJECTS_REMAIN" }

  $exitCode = 0
  Write-Output ($parsedNodeResult | ConvertTo-Json -Compress -Depth 8)
} catch {
  Write-Output (ConvertTo-Json -Compress -InputObject ([ordered]@{ status = "FAIL"; firstFailedStage = $stage; reasonCode = $_.Exception.Message }))
} finally {
  Remove-Item Env:BETA2_DISPOSABLE_DATABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:NODE_NO_WARNINGS -ErrorAction SilentlyContinue
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:PGOPTIONS -ErrorAction SilentlyContinue
  if ($started) {
    & (Join-Path $pgBin "pg_ctl.exe") -D $cluster -m fast -w stop *> (Join-Path $logs "stop.log")
  }
  if (Test-Path -LiteralPath $temporaryRoot) {
    $resolvedTemporaryRoot = [IO.Path]::GetFullPath((Get-Item -LiteralPath $temporaryRoot -Force).FullName)
    if (-not $resolvedTemporaryRoot.StartsWith($temporaryBase, [StringComparison]::OrdinalIgnoreCase) -or $resolvedTemporaryRoot -eq $temporaryBase) { throw "CLEANUP_CONTAINMENT_INVALID" }
    Remove-Item -LiteralPath $resolvedTemporaryRoot -Recurse -Force
  }
  Write-Output (ConvertTo-Json -Compress -InputObject ([ordered]@{ cleanup = if (Test-Path -LiteralPath $temporaryRoot) { "FAIL" } else { "PASS" }; listenerCount = 0; externalEffects = 0 }))
}
exit $exitCode
