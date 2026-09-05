$ErrorActionPreference = "Stop"

$pgBin = "C:\Program Files\PostgreSQL\18\bin"
$required = @("initdb.exe", "pg_ctl.exe", "createdb.exe")
foreach ($name in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $pgBin $name))) {
    Write-Output "ADMIN_BOOTSTRAP_BRIDGE_REAL_INTEGRATION=FAIL"
    Write-Output "ERROR_CATEGORY=POSTGRESQL_18_REQUIRED"
    exit 2
  }
}

$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$cluster = Join-Path $tempBase ("oldmike-admin-bridge-real-" + [Guid]::NewGuid().ToString("N"))
$logs = Join-Path $tempBase ("oldmike-admin-bridge-real-logs-" + [Guid]::NewGuid().ToString("N"))
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
  if (-not $server.WaitForExit(30000) -or $server.ExitCode -ne 0) { throw "POSTGRES_START_FAILED" }
  $started = $true
  & (Join-Path $pgBin "createdb.exe") -h 127.0.0.1 -p $port -U postgres oldmike_admin_bridge_real *> (Join-Path $logs "createdb.log")
  if ($LASTEXITCODE -ne 0) { throw "CREATE_DATABASE_FAILED" }
  $env:INTEGRATION_DATABASE_URL = "postgresql://postgres@127.0.0.1:$port/oldmike_admin_bridge_real"
  $env:INTEGRATION_DATABASE_DISPOSABLE = "1"
  node scripts/verify-admin-bootstrap-bridge-real.mjs
  $code = $LASTEXITCODE
} catch {
  Write-Output "ADMIN_BOOTSTRAP_BRIDGE_REAL_INTEGRATION=FAIL"
  Write-Output "ERROR_CATEGORY=HARNESS_FAILURE"
  $code = 2
} finally {
  Remove-Item Env:INTEGRATION_DATABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:INTEGRATION_DATABASE_DISPOSABLE -ErrorAction SilentlyContinue
  if ($started) { & (Join-Path $pgBin "pg_ctl.exe") -D $cluster -m fast -w stop *> (Join-Path $logs "stop.log") }
  $resolvedCluster = [IO.Path]::GetFullPath($cluster)
  $resolvedLogs = [IO.Path]::GetFullPath($logs)
  if (-not $resolvedCluster.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase) -or
      [IO.Path]::GetFileName($resolvedCluster) -notlike "oldmike-admin-bridge-real-*" -or
      -not $resolvedLogs.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase) -or
      [IO.Path]::GetFileName($resolvedLogs) -notlike "oldmike-admin-bridge-real-logs-*") {
    throw "TEMP_SCOPE_INVALID"
  }
  if (Test-Path -LiteralPath $resolvedCluster) { Remove-Item -LiteralPath $resolvedCluster -Recurse -Force }
  if (Test-Path -LiteralPath $resolvedLogs) { Remove-Item -LiteralPath $resolvedLogs -Recurse -Force }
}
exit $code

