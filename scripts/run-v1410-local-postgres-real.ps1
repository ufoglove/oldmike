$ErrorActionPreference = "Stop"

$pgBin = "C:\Program Files\PostgreSQL\18\bin"
$required = @("initdb.exe", "pg_isready.exe", "pg_ctl.exe", "createdb.exe", "psql.exe")
foreach ($name in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $pgBin $name))) {
    Write-Output "LOCAL_POSTGRES_TOOL_GATE=FAIL"
    exit 2
  }
}

$tempBase = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$cluster = Join-Path $tempBase ("oldmike-v1410-pg-" + [Guid]::NewGuid().ToString("N"))
$logRoot = Join-Path $tempBase ("oldmike-v1410-pg-logs-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $cluster | Out-Null
New-Item -ItemType Directory -Path $logRoot | Out-Null

$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, 0)
$listener.Start()
$port = ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
$listener.Stop()

$started = $false
$testExit = 2
$stage = "INITDB"
$failureCategory = "UNKNOWN"
try {
  $savedPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & (Join-Path $pgBin "initdb.exe") -D $cluster -U postgres -A trust --no-locale *> (Join-Path $logRoot "initdb.log")
  $nativeExit = $LASTEXITCODE
  $ErrorActionPreference = $savedPreference
  if ($nativeExit -ne 0) {
    $initText = Get-Content -Raw -LiteralPath (Join-Path $logRoot "initdb.log") -ErrorAction SilentlyContinue
    if ($initText -match "administrative privileges|cannot be run as root") {
      $failureCategory = "ADMINISTRATOR_ACCOUNT"
    } elseif ($initText -match "Access is denied|Permission denied") {
      $failureCategory = "FILESYSTEM_PERMISSION"
    } elseif ($initText -match "locale|encoding") {
      $failureCategory = "LOCALE_CONFIGURATION"
    }
    throw "INITDB_FAILED"
  }
  Write-Output "LOCAL_POSTGRES_INITDB=PASS"

  $stage = "PG_START"
  $postgresOptions = '"-h 127.0.0.1 -p ' + $port + '"'
  $pgCtlProcess = Start-Process `
    -FilePath (Join-Path $pgBin "pg_ctl.exe") `
    -ArgumentList @("-D", $cluster, "-l", (Join-Path $logRoot "postgres.log"), "-o", $postgresOptions, "-w", "start") `
    -WindowStyle Hidden `
    -PassThru
  if (-not $pgCtlProcess.WaitForExit(30000)) {
    Stop-Process -Id $pgCtlProcess.Id -Force -ErrorAction SilentlyContinue
    $failureCategory = "POSTGRES_START_TIMEOUT"
    throw "PG_START_FAILED"
  }
  if ($pgCtlProcess.ExitCode -ne 0) {
    $failureCategory = "POSTGRES_STARTUP"
    throw "PG_START_FAILED"
  }
  & (Join-Path $pgBin "pg_isready.exe") -h 127.0.0.1 -p $port -d postgres -t 3 *> $null
  if ($LASTEXITCODE -ne 0) {
    $failureCategory = "POSTGRES_NOT_READY"
    throw "PG_START_FAILED"
  }
  $started = $true
  Write-Output "LOCAL_POSTGRES_START=PASS"

  $stage = "CREATE_DATABASE"
  $ErrorActionPreference = "Continue"
  & (Join-Path $pgBin "createdb.exe") -h 127.0.0.1 -p $port -U postgres oldmike_v1410 *> (Join-Path $logRoot "createdb.log")
  $nativeExit = $LASTEXITCODE
  $ErrorActionPreference = $savedPreference
  if ($nativeExit -ne 0) { throw "CREATE_DATABASE_FAILED" }
  Write-Output "LOCAL_POSTGRES_DATABASE=PASS"

  $env:INTEGRATION_DATABASE_URL = "postgresql://postgres@127.0.0.1:$port/oldmike_v1410"
  $env:INTEGRATION_DATABASE_DISPOSABLE = "1"
  $env:PSQL_BIN = Join-Path $pgBin "psql.exe"
  $stage = "MIGRATION_0004_DOWN_REAL"
  Write-Output "REAL_STAGE=MIGRATION_0004_DOWN_REAL"
  node scripts/verify-migration-0004-down-real.mjs
  $testExit = $LASTEXITCODE
  if ($testExit -ne 0) { throw "MIGRATION_0004_DOWN_REAL_FAILED" }
  Write-Output "MIGRATION_0004_DOWN_REAL=PASS"

  $stage = "AUTH_TENANT_REAL"
  Write-Output "REAL_STAGE=AUTH_TENANT_REAL"
  node --experimental-strip-types scripts/verify-v141-integration.mjs
  $testExit = $LASTEXITCODE
  if ($testExit -ne 0) { throw "AUTH_TENANT_REAL_FAILED" }
  Write-Output "AUTH_TENANT_REAL=PASS"

  $stage = "OPERATOR_ATOMIC_REAL"
  Write-Output "REAL_STAGE=OPERATOR_ATOMIC_REAL"
  node scripts/verify-operator-invite-real.mjs
  $testExit = $LASTEXITCODE
  if ($testExit -ne 0) { throw "OPERATOR_ATOMIC_REAL_FAILED" }
  Write-Output "OPERATOR_ATOMIC_REAL=PASS"

  $stage = "CONTROLLED_EMAIL_BRIDGE_RECOVERY_REAL"
  Write-Output "REAL_STAGE=CONTROLLED_EMAIL_BRIDGE_RECOVERY_REAL"
  node scripts/verify-controlled-auth-e2e-bridge-real.mjs
  $testExit = $LASTEXITCODE
  if ($testExit -ne 0) { throw "CONTROLLED_EMAIL_BRIDGE_RECOVERY_REAL_FAILED" }
  Write-Output "CONTROLLED_EMAIL_BRIDGE_RECOVERY_REAL=PASS"

  $stage = "N_MINUS_ONE_V1420"
  Write-Output "REAL_STAGE=N_MINUS_ONE_V1420"
  node scripts/verify-n-minus-one-v1420.mjs
  $testExit = $LASTEXITCODE
  if ($testExit -ne 0) { throw "N_MINUS_ONE_V1420_FAILED" }
  Write-Output "N_MINUS_ONE_V1420=PASS"
} catch {
  Write-Output "LOCAL_DISPOSABLE_POSTGRES=FAIL"
  Write-Output "LOCAL_POSTGRES_FAILED_STAGE=$stage"
  Write-Output "LOCAL_POSTGRES_ERROR_CATEGORY=$failureCategory"
  $testExit = 2
} finally {
  Remove-Item Env:INTEGRATION_DATABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:INTEGRATION_DATABASE_DISPOSABLE -ErrorAction SilentlyContinue
  Remove-Item Env:PSQL_BIN -ErrorAction SilentlyContinue
  if ($started) {
    & (Join-Path $pgBin "pg_ctl.exe") -D $cluster -m fast -w stop *> (Join-Path $logRoot "pgctl-stop.log")
  }

  $resolvedCluster = [System.IO.Path]::GetFullPath($cluster)
  $resolvedLogRoot = [System.IO.Path]::GetFullPath($logRoot)
  if (-not $resolvedCluster.StartsWith($tempBase, [System.StringComparison]::OrdinalIgnoreCase) -or
      [System.IO.Path]::GetFileName($resolvedCluster) -notlike "oldmike-v1410-pg-*" -or
      -not $resolvedLogRoot.StartsWith($tempBase, [System.StringComparison]::OrdinalIgnoreCase) -or
      [System.IO.Path]::GetFileName($resolvedLogRoot) -notlike "oldmike-v1410-pg-logs-*") {
    throw "TEMP_SCOPE_INVALID"
  }
  [System.IO.Directory]::Delete($resolvedCluster, $true)
  [System.IO.Directory]::Delete($resolvedLogRoot, $true)
  Write-Output "DATABASE_WRITES_DISPOSABLE_RETAINED=0"
}

if ($testExit -eq 0) { Write-Output "LOCAL_DISPOSABLE_POSTGRES=PASS" }
Write-Output "REAL_INTEGRATION_EXIT_CODE=$testExit"
exit $testExit
