$ErrorActionPreference = "Stop"

$pgBin = "C:\Program Files\PostgreSQL\18\bin"
$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$cluster = Join-Path $tempBase ("oldmike-v1522-topic-lab-" + [Guid]::NewGuid().ToString("N"))
$logs = Join-Path $tempBase ("oldmike-v1522-topic-lab-logs-" + [Guid]::NewGuid().ToString("N"))
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
  & (Join-Path $pgBin "createdb.exe") -h 127.0.0.1 -p $port -U postgres oldmike_topic_lab *> (Join-Path $logs "createdb.log")
  if ($LASTEXITCODE -ne 0) { throw "CREATE_DATABASE_FAILED" }

  $env:INTEGRATION_DATABASE_URL = "postgresql://postgres@127.0.0.1:$port/oldmike_topic_lab"
  $env:DATABASE_URL = $env:INTEGRATION_DATABASE_URL
  $env:INTEGRATION_DATABASE_DISPOSABLE = "1"
  $env:INTEGRATION_TEST_MODE = "1"
  $env:TEST_FIXTURE = "1"
  $env:BETTER_AUTH_URL = "http://127.0.0.1:$port"
  $env:BETTER_AUTH_SECRET = "disposable-topic-lab-secret-not-for-production"
  $env:REGISTRATION_MODE = "closed"
  $env:ACCOUNT_PROVISIONING_MODE = "admin_only"
  node --experimental-strip-types --experimental-loader ./scripts/disposable-server-only-loader.mjs scripts/verify-topic-lab-disposable.mjs
  $code = $LASTEXITCODE
  if ($code -ne 0) { throw "TOPIC_LAB_CONTRACT_FAILED" }
} finally {
  foreach ($name in @("INTEGRATION_DATABASE_URL","DATABASE_URL","INTEGRATION_DATABASE_DISPOSABLE","INTEGRATION_TEST_MODE","TEST_FIXTURE","BETTER_AUTH_URL","BETTER_AUTH_SECRET","REGISTRATION_MODE","ACCOUNT_PROVISIONING_MODE")) { Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue }
  if ($started) { & (Join-Path $pgBin "pg_ctl.exe") -D $cluster -m fast -w stop *> (Join-Path $logs "stop.log") }
  if (Test-Path -LiteralPath $cluster) { Remove-Item -LiteralPath $cluster -Recurse -Force }
  if (Test-Path -LiteralPath $logs) { Remove-Item -LiteralPath $logs -Recurse -Force }
  Write-Output "DATABASE_WRITES_DISPOSABLE_RETAINED=0"
}
exit $code
