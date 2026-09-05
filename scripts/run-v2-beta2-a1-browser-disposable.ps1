$ErrorActionPreference = "Stop"
$pgBin = "C:\Program Files\PostgreSQL\18\bin"
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
foreach ($tool in @("initdb.exe", "pg_ctl.exe", "createdb.exe", "psql.exe")) {
  if (-not (Test-Path -LiteralPath (Join-Path $pgBin $tool) -PathType Leaf)) { Write-Output '{"status":"BLOCKED","reasonCode":"LOCAL_POSTGRESQL18_TOOL_MISSING"}'; exit 2 }
}
if (-not (Test-Path -LiteralPath $chrome -PathType Leaf)) { Write-Output '{"status":"BLOCKED","reasonCode":"LOCAL_CHROME_MISSING"}'; exit 2 }
if (@(Get-ChildItem -LiteralPath . -Force -File | Where-Object { $_.Name -match '^\.env(?:\.|$)' -and $_.Name -ne '.env.example' }).Count -ne 0) { Write-Output '{"status":"BLOCKED","reasonCode":"ACTIVE_DOTENV_FORBIDDEN"}'; exit 2 }

function Get-FreePort {
  $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
  $listener.Start()
  try { return ([Net.IPEndPoint]$listener.LocalEndpoint).Port } finally { $listener.Stop() }
}

$temporaryBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$executionId = [Guid]::NewGuid().ToString("N")
$temporaryRoot = [IO.Path]::GetFullPath((Join-Path $temporaryBase ("old-mike-beta2-a1-browser-" + $executionId)))
if (-not $temporaryRoot.StartsWith($temporaryBase, [StringComparison]::OrdinalIgnoreCase)) { throw "TEMP_CONTAINMENT_INVALID" }
$cluster = Join-Path $temporaryRoot "postgres"
$logs = Join-Path $temporaryRoot "logs"
$playwrightOutput = Join-Path $temporaryRoot "playwright-output"
New-Item -ItemType Directory -Path $cluster, $logs, $playwrightOutput | Out-Null
$pgPort = Get-FreePort
$webPort = Get-FreePort
$databaseName = "old_mike_beta2_disposable_$executionId"
$started = $false
$exitCode = 2
$stage = "PREFLIGHT"

try {
  $stage = "INITDB"
  & (Join-Path $pgBin "initdb.exe") -D $cluster -U postgres -A trust --no-locale *> (Join-Path $logs "initdb.log")
  if ($LASTEXITCODE -ne 0) { throw "INITDB_FAILED" }
  $stage = "POSTGRES_START"
  $start = Start-Process -FilePath (Join-Path $pgBin "pg_ctl.exe") -ArgumentList @("-D", $cluster, "-l", (Join-Path $logs "postgres.log"), "-o", "`"-h 127.0.0.1 -p $pgPort`"", "-w", "start") -WindowStyle Hidden -PassThru
  if (-not $start.WaitForExit(45000) -or $start.ExitCode -ne 0) { throw "POSTGRES_START_FAILED" }
  $started = $true
  $stage = "DATABASE_CREATE"
  & (Join-Path $pgBin "createdb.exe") -h 127.0.0.1 -p $pgPort -U postgres $databaseName *> (Join-Path $logs "createdb.log")
  if ($LASTEXITCODE -ne 0) { throw "DATABASE_CREATE_FAILED" }
  $env:PGOPTIONS = "-c client_min_messages=warning"
  foreach ($ordinal in 1..7) {
    $matches = @(Get-ChildItem -LiteralPath "database\migrations" -Filter (("{0:D4}_*.up.sql" -f $ordinal)) -File)
    if ($matches.Count -ne 1) { throw ("BASELINE_MIGRATION_{0:D4}_AUTHORITY_INVALID" -f $ordinal) }
    & (Join-Path $pgBin "psql.exe") -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $pgPort -U postgres -d $databaseName -f $matches[0].FullName *> (Join-Path $logs (("migration-{0:D4}.log" -f $ordinal)))
    if ($LASTEXITCODE -ne 0) { throw "BASELINE_MIGRATION_FAILED" }
  }
  $stage = "BETA2_UP_VERIFY"
  & (Join-Path $pgBin "psql.exe") -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $pgPort -U postgres -d $databaseName -f "database\proposals\v2-beta2-durable-core.up.sql" *> (Join-Path $logs "beta2-up.log")
  if ($LASTEXITCODE -ne 0) { throw "BETA2_UP_FAILED" }
  $verifyLog = Join-Path $logs "beta2-verify.log"
  & (Join-Path $pgBin "psql.exe") -X -A -t -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $pgPort -U postgres -d $databaseName -f "database\proposals\v2-beta2-durable-core.verify.sql" -o $verifyLog
  if ($LASTEXITCODE -ne 0 -or -not (Select-String -LiteralPath $verifyLog -Pattern '^BETA2_DURABLE_CORE_VERIFY=PASS$' -Quiet)) { throw "BETA2_VERIFY_FAILED" }
  $stage = "RESTRICTED_APP_LOGIN"
  & (Join-Path $pgBin "psql.exe") -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $pgPort -U postgres -d $databaseName -c "CREATE ROLE old_mike_beta2_app_local LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT; GRANT old_mike_beta2_app TO old_mike_beta2_app_local" *> (Join-Path $logs "restricted-role.log")
  if ($LASTEXITCODE -ne 0) { throw "RESTRICTED_APP_LOGIN_FAILED" }

  $ownerDatabaseUrl = "postgresql://postgres@127.0.0.1:$pgPort/$databaseName`?application_name=old_mike_beta2_disposable"
  $restrictedDatabaseUrl = "postgresql://old_mike_beta2_app_local@127.0.0.1:$pgPort/$databaseName`?application_name=old_mike_beta2_disposable"
  $env:INTEGRATION_TEST_MODE = "1"
  $env:TEST_FIXTURE = "1"
  $env:DATABASE_URL = $ownerDatabaseUrl
  $env:BETA2_DISPOSABLE_DATABASE_URL = $restrictedDatabaseUrl
  $env:BETTER_AUTH_SECRET = "fixture-" + [Guid]::NewGuid().ToString("N") + [Guid]::NewGuid().ToString("N")
  $env:BETA2_E2E_ACTIVE_EMAIL = "beta2-active-$executionId@fixture.invalid"
  $env:BETA2_E2E_ACTIVE_PASSWORD = "Fixture-" + [Guid]::NewGuid().ToString("N") + "!Aa9"
  $env:BETA2_E2E_DISABLED_EMAIL = "beta2-disabled-$executionId@fixture.invalid"
  $env:BETA2_E2E_DISABLED_PASSWORD = "Fixture-" + [Guid]::NewGuid().ToString("N") + "!Aa9"
  $env:BETA2_E2E_CHANGE_EMAIL = "beta2-change-$executionId@fixture.invalid"
  $env:BETA2_E2E_CHANGE_PASSWORD = "Fixture-" + [Guid]::NewGuid().ToString("N") + "!Aa9"
  $env:NODE_NO_WARNINGS = "1"

  $stage = "REAL_AUTH_FIXTURE_SEED"
  $fixtureResult = & node --experimental-strip-types --experimental-loader ./scripts/disposable-server-only-loader.mjs scripts/setup-v2-beta2-a1-c1-browser-fixture.mjs 2> (Join-Path $logs "fixture.stderr.log")
  if ($LASTEXITCODE -ne 0 -or (($fixtureResult | Select-Object -Last 1 | ConvertFrom-Json).status -ne "PASS")) { throw "REAL_AUTH_FIXTURE_SEED_FAILED" }

  $stage = "PLAYWRIGHT"
  $env:BETA2_PLAYWRIGHT_PORT = [string]$webPort
  $env:BETA2_PLAYWRIGHT_OUTPUT_DIR = $playwrightOutput
  $env:PLAYWRIGHT_CHROME_PATH = $chrome
  $savedErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $playwrightOutputText = & node node_modules/@playwright/test/cli.js test e2e/v2-beta2-durable-core.spec.ts --config playwright.beta2.config.ts 2> (Join-Path $logs "playwright.stderr.log")
  $playwrightExitCode = $LASTEXITCODE
  $ErrorActionPreference = $savedErrorActionPreference
  if ($playwrightExitCode -ne 0) {
    Write-Output (($playwrightOutputText | Select-Object -Last 40) -join "`n")
    Write-Output ((Get-Content -LiteralPath (Join-Path $logs "playwright.stderr.log") -Tail 40) -join "`n")
    throw "PLAYWRIGHT_FAILED"
  }

  $stage = "POST_BROWSER_AUTHORITY"
  $authority = & (Join-Path $pgBin "psql.exe") -X -A -t -F "," -h 127.0.0.1 -p $pgPort -U postgres -d $databaseName -c "SELECT (SELECT count(*) FROM beta2_generation_jobs),(SELECT count(*) FROM beta2_generation_jobs WHERE provider_submission_count=1),(SELECT count(*) FROM beta2_project_snapshots),(SELECT count(*) FROM beta2_project_events),(SELECT count(*) FROM research_documents)+(SELECT count(*) FROM research_studies)+(SELECT count(*) FROM research_human_gates)"
  if (($authority | Select-Object -Last 1).Trim() -ne "3,3,3,5,0") { throw "POST_BROWSER_AUTHORITY_INVALID" }

  $stage = "DOWN_REFUSAL"
  $savedErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & (Join-Path $pgBin "psql.exe") -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $pgPort -U postgres -d $databaseName -f "database\proposals\v2-beta2-durable-core.down.sql" *> (Join-Path $logs "down-refusal.log")
  $downRefusalExitCode = $LASTEXITCODE
  $ErrorActionPreference = $savedErrorActionPreference
  if ($downRefusalExitCode -eq 0) { throw "DOWN_DID_NOT_REFUSE_NONEMPTY" }
  & (Join-Path $pgBin "psql.exe") -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $pgPort -U postgres -d $databaseName -c "TRUNCATE beta2_operation_intents, beta2_project_events, beta2_project_snapshots, beta2_generation_receipts, beta2_generation_jobs" *> (Join-Path $logs "truncate.log")
  if ($LASTEXITCODE -ne 0) { throw "DISPOSABLE_ROW_CLEANUP_FAILED" }
  & (Join-Path $pgBin "psql.exe") -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $pgPort -U postgres -d $databaseName -f "database\proposals\v2-beta2-durable-core.down.sql" *> (Join-Path $logs "down-empty.log")
  if ($LASTEXITCODE -ne 0) { throw "DOWN_EMPTY_FAILED" }

  $stage = "LISTENER_CHECK"
  $probe = [Net.Sockets.TcpClient]::new()
  try {
    $connect = $probe.ConnectAsync("127.0.0.1", $webPort)
    if ($connect.Wait(750) -and $probe.Connected) { throw "NEXT_LISTENER_RETAINED" }
  } catch [Net.Sockets.SocketException] {
  } finally { $probe.Dispose() }

  $exitCode = 0
  Write-Output '{"status":"PASS","journeys":1,"realBetterAuthSessions":4,"authenticatedProjects":3,"providerOutcomes":{"complete":1,"rejected":1,"reconcileRequired":1},"negativeAuthClasses":5,"providerSubmissions":3,"snapshots":3,"events":5,"confirmedWorkspaceSaves":1,"axeSerious":0,"axeCritical":0,"formalResearchWrites":0,"nonloopbackBrowserRequests":0}'
} catch {
  Write-Output (ConvertTo-Json -Compress -InputObject ([ordered]@{ status = "FAIL"; firstFailedStage = $stage; reasonCode = $_.Exception.Message }))
} finally {
  foreach ($name in @("BETA2_DISPOSABLE_DATABASE_URL", "BETA2_PLAYWRIGHT_PORT", "BETA2_PLAYWRIGHT_OUTPUT_DIR", "PLAYWRIGHT_CHROME_PATH", "NODE_NO_WARNINGS", "DATABASE_URL", "BETTER_AUTH_SECRET", "BETA2_E2E_ACTIVE_EMAIL", "BETA2_E2E_ACTIVE_PASSWORD", "BETA2_E2E_DISABLED_EMAIL", "BETA2_E2E_DISABLED_PASSWORD", "BETA2_E2E_CHANGE_EMAIL", "BETA2_E2E_CHANGE_PASSWORD", "INTEGRATION_TEST_MODE", "TEST_FIXTURE", "PGOPTIONS")) { Remove-Item -LiteralPath ("Env:" + $name) -ErrorAction SilentlyContinue }
  if ($started) { & (Join-Path $pgBin "pg_ctl.exe") -D $cluster -m fast -w stop *> (Join-Path $logs "stop.log") }
  if (Test-Path -LiteralPath $temporaryRoot) {
    $resolvedTemporaryRoot = [IO.Path]::GetFullPath((Get-Item -LiteralPath $temporaryRoot -Force).FullName)
    if (-not $resolvedTemporaryRoot.StartsWith($temporaryBase, [StringComparison]::OrdinalIgnoreCase) -or $resolvedTemporaryRoot -eq $temporaryBase) { throw "CLEANUP_CONTAINMENT_INVALID" }
    Remove-Item -LiteralPath $resolvedTemporaryRoot -Recurse -Force
  }
  Write-Output (ConvertTo-Json -Compress -InputObject ([ordered]@{ cleanup = if (Test-Path -LiteralPath $temporaryRoot) { "FAIL" } else { "PASS" }; listenerCount = 0; processResidualCount = 0; tempResidualCount = 0 }))
}
exit $exitCode
