$ErrorActionPreference = "Stop"

$pgBin = "C:\Program Files\PostgreSQL\18\bin"
$required = @("initdb.exe", "pg_isready.exe", "pg_ctl.exe", "createdb.exe")
foreach ($name in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $pgBin $name))) {
    Write-Output "LOCAL_POSTGRES_TOOL_GATE=FAIL"
    exit 2
  }
}

$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$cluster = Join-Path $tempBase ("oldmike-v1515-admin-" + [Guid]::NewGuid().ToString("N"))
$logs = Join-Path $tempBase ("oldmike-v1515-admin-logs-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $cluster, $logs | Out-Null

$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
$listener.Start()
$port = ([Net.IPEndPoint]$listener.LocalEndpoint).Port
$listener.Stop()
$started = $false
$code = 2
$stage = "INITDB"
try {
  & (Join-Path $pgBin "initdb.exe") -D $cluster -U postgres -A trust --no-locale *> (Join-Path $logs "initdb.log")
  if ($LASTEXITCODE -ne 0) { throw "INITDB_FAILED" }
  $stage = "POSTGRES_START"
  $server = Start-Process -FilePath (Join-Path $pgBin "pg_ctl.exe") -ArgumentList @(
    "-D", $cluster, "-l", (Join-Path $logs "postgres.log"),
    "-o", "`"-h 127.0.0.1 -p $port`"", "-w", "start"
  ) -WindowStyle Hidden -PassThru
  if (-not $server.WaitForExit(30000) -or $server.ExitCode -ne 0) { throw "POSTGRES_START_FAILED" }
  $started = $true
  & (Join-Path $pgBin "createdb.exe") -h 127.0.0.1 -p $port -U postgres oldmike_v1515 *> (Join-Path $logs "createdb.log")
  if ($LASTEXITCODE -ne 0) { throw "CREATE_DATABASE_FAILED" }

  $env:INTEGRATION_DATABASE_URL = "postgresql://postgres@127.0.0.1:$port/oldmike_v1515"
  $env:INTEGRATION_DATABASE_DISPOSABLE = "1"
  $stage = "ADMIN_PROVISIONING_REAL"
  node scripts/verify-admin-provisioning-real.mjs
  $code = $LASTEXITCODE
  if ($code -ne 0) { throw "ADMIN_PROVISIONING_REAL_FAILED" }
  Write-Output "DISPOSABLE_POSTGRES_REAL_INTEGRATION=PASS"
} catch {
  Write-Output "DISPOSABLE_POSTGRES_REAL_INTEGRATION=FAIL"
  Write-Output "FAILED_STAGE=$stage"
  $code = 2
} finally {
  Remove-Item Env:INTEGRATION_DATABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:INTEGRATION_DATABASE_DISPOSABLE -ErrorAction SilentlyContinue
  if ($started) { & (Join-Path $pgBin "pg_ctl.exe") -D $cluster -m fast -w stop *> (Join-Path $logs "stop.log") }
  $resolvedCluster = [IO.Path]::GetFullPath($cluster)
  $resolvedLogs = [IO.Path]::GetFullPath($logs)
  if (-not $resolvedCluster.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase) -or
      [IO.Path]::GetFileName($resolvedCluster) -notlike "oldmike-v1515-admin-*" -or
      -not $resolvedLogs.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase) -or
      [IO.Path]::GetFileName($resolvedLogs) -notlike "oldmike-v1515-admin-logs-*") {
    throw "TEMP_SCOPE_INVALID"
  }
  if (Test-Path -LiteralPath $resolvedCluster) { Remove-Item -LiteralPath $resolvedCluster -Recurse -Force }
  if (Test-Path -LiteralPath $resolvedLogs) { Remove-Item -LiteralPath $resolvedLogs -Recurse -Force }
  Write-Output "DATABASE_WRITES_DISPOSABLE_RETAINED=0"
}
exit $code
