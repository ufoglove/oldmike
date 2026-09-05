$ErrorActionPreference = "Stop"

$pgBin = "C:\Program Files\PostgreSQL\18\bin"
$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$cluster = Join-Path $tempBase ("oldmike-v154-workflow-" + [Guid]::NewGuid().ToString("N"))
$logs = Join-Path $tempBase ("oldmike-v154-workflow-logs-" + [Guid]::NewGuid().ToString("N"))
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
  & (Join-Path $pgBin "createdb.exe") -h 127.0.0.1 -p $port -U postgres oldmike_matrix *> (Join-Path $logs "createdb.log")
  if ($LASTEXITCODE -ne 0) { throw "CREATE_DATABASE_FAILED" }

  $env:INTEGRATION_DATABASE_URL = "postgresql://postgres@127.0.0.1:$port/oldmike_matrix"
  $env:INTEGRATION_DATABASE_DISPOSABLE = "1"
  node scripts/verify-research-workflow-disposable.mjs
  $code = $LASTEXITCODE
  if ($code -ne 0) { throw "WORKFLOW_CONTRACT_FAILED" }
  Write-Output "WORKFLOW_DISPOSABLE_CONTRACT=PASS"
  Write-Output "WORKFLOW_DISPOSABLE_EXIT_CODE=$code"
} finally {
  Remove-Item Env:INTEGRATION_DATABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:INTEGRATION_DATABASE_DISPOSABLE -ErrorAction SilentlyContinue
  if ($started) { & (Join-Path $pgBin "pg_ctl.exe") -D $cluster -m fast -w stop *> (Join-Path $logs "stop.log") }
  if (Test-Path -LiteralPath $cluster) { Remove-Item -LiteralPath $cluster -Recurse -Force }
  if (Test-Path -LiteralPath $logs) { Remove-Item -LiteralPath $logs -Recurse -Force }
}
exit $code
