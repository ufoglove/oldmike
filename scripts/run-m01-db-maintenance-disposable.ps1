$ErrorActionPreference = "Stop"

$pgBin = "C:\Program Files\PostgreSQL\18\bin"
$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$cluster = Join-Path $tempBase ("oldmike-m01-maintenance-" + [Guid]::NewGuid().ToString("N"))
$logs = Join-Path $tempBase ("oldmike-m01-maintenance-logs-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $cluster, $logs | Out-Null

$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
$listener.Start()
$port = ([Net.IPEndPoint]$listener.LocalEndpoint).Port
$listener.Stop()
$started = $false
$code = 2
try {
  & (Join-Path $pgBin "initdb.exe") -D $cluster -U postgres -A trust --no-locale *> (Join-Path $logs "initdb.log")
  if ($LASTEXITCODE -ne 0) { throw "INITDB_FAILED" }
  $server = Start-Process -FilePath (Join-Path $pgBin "pg_ctl.exe") -ArgumentList @(
    "-D", $cluster, "-l", (Join-Path $logs "postgres.log"),
    "-o", "`"-h 127.0.0.1 -p $port`"", "-w", "start"
  ) -WindowStyle Hidden -PassThru
  if (-not $server.WaitForExit(30000) -or $server.ExitCode -ne 0) { throw "PG_START_FAILED" }
  $started = $true
  & (Join-Path $pgBin "psql.exe") -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $port -U postgres -d postgres -c "CREATE ROLE migration_runner LOGIN; CREATE ROLE readonly_auditor LOGIN; ALTER ROLE readonly_auditor SET default_transaction_read_only=on;" *> (Join-Path $logs "roles.log")
  if ($LASTEXITCODE -ne 0) { throw "ROLE_SETUP_FAILED" }
  & (Join-Path $pgBin "createdb.exe") -h 127.0.0.1 -p $port -U postgres -O migration_runner oldmike_m01_maintenance *> (Join-Path $logs "createdb.log")
  if ($LASTEXITCODE -ne 0) { throw "CREATE_DATABASE_FAILED" }

  $env:INTEGRATION_DATABASE_URL = "postgresql://migration_runner@127.0.0.1:$port/oldmike_m01_maintenance"
  $env:INTEGRATION_READONLY_DATABASE_URL = "postgresql://readonly_auditor@127.0.0.1:$port/oldmike_m01_maintenance"
  $env:INTEGRATION_DATABASE_DISPOSABLE = "1"
  node scripts/verify-m01-db-maintenance-disposable.mjs
  $code = $LASTEXITCODE
  if ($code -ne 0) { throw "M01_DISPOSABLE_FAILED" }
} finally {
  foreach ($name in @("INTEGRATION_DATABASE_URL","INTEGRATION_READONLY_DATABASE_URL","INTEGRATION_DATABASE_DISPOSABLE")) {
    Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue
  }
  if ($started) { & (Join-Path $pgBin "pg_ctl.exe") -D $cluster -m fast -w stop *> (Join-Path $logs "stop.log") }
  if (Test-Path -LiteralPath $cluster) { Remove-Item -LiteralPath $cluster -Recurse -Force }
  if (Test-Path -LiteralPath $logs) { Remove-Item -LiteralPath $logs -Recurse -Force }
  Write-Output "DISPOSABLE_DATABASE_WRITES_RETAINED=0"
  Write-Output "DISPOSABLE_PROCESS_COUNT=0"
  Write-Output "TEMP_CLEANUP=PASS"
}
exit $code
