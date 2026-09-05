$ErrorActionPreference = "Stop"
$tempBase = [System.IO.Path]::GetTempPath()
$cluster = Join-Path $tempBase ("oldmike-v1529-m04-" + [Guid]::NewGuid().ToString("N"))
$logs = Join-Path $tempBase ("oldmike-v1529-m04-logs-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $cluster,$logs | Out-Null
$pgBin = "C:\Program Files\PostgreSQL\18\bin"
if (-not (Test-Path -LiteralPath (Join-Path $pgBin "postgres.exe"))) { throw "PostgreSQL 18 binaries not found" }
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0); $listener.Start(); $port = ([Net.IPEndPoint]$listener.LocalEndpoint).Port; $listener.Stop(); $started = $false
try {
  & (Join-Path $pgBin "initdb.exe") -D $cluster -A trust -U postgres --no-locale *> (Join-Path $logs "initdb.log"); if ($LASTEXITCODE -ne 0) { throw "INITDB_FAILED" }
  $server = Start-Process -FilePath (Join-Path $pgBin "pg_ctl.exe") -ArgumentList @("-D",$cluster,"-l",(Join-Path $logs "postgres.log"),"-o","`"-h 127.0.0.1 -p $port`"","-w","start") -WindowStyle Hidden -PassThru
  if (-not $server.WaitForExit(30000) -or $server.ExitCode -ne 0) { throw "PG_START_FAILED" }; $started = $true
  & (Join-Path $pgBin "createdb.exe") -h 127.0.0.1 -p $port -U postgres oldmike_m04_submission *> (Join-Path $logs "createdb.log")
  $env:INTEGRATION_DATABASE_URL = "postgresql://postgres@127.0.0.1:$port/oldmike_m04_submission"; $env:DATABASE_URL = $env:INTEGRATION_DATABASE_URL; $env:INTEGRATION_DATABASE_DISPOSABLE = "1"; $env:INTEGRATION_TEST_MODE = "1"; $env:TEST_FIXTURE = "1"; $env:BETTER_AUTH_URL = "http://127.0.0.1:$port"; $env:BETTER_AUTH_SECRET = "disposable-m04-secret-not-for-production"; $env:REGISTRATION_MODE = "closed"; $env:ACCOUNT_PROVISIONING_MODE = "admin_only"
  node --experimental-strip-types --experimental-loader ./scripts/disposable-server-only-loader.mjs scripts/verify-journal-submission-disposable.mjs
  if ($LASTEXITCODE -ne 0) { throw "M04 disposable verifier failed" }
} finally {
  Remove-Item Env:INTEGRATION_DATABASE_URL,Env:DATABASE_URL,Env:INTEGRATION_DATABASE_DISPOSABLE,Env:INTEGRATION_TEST_MODE,Env:TEST_FIXTURE,Env:BETTER_AUTH_URL,Env:BETTER_AUTH_SECRET,Env:REGISTRATION_MODE,Env:ACCOUNT_PROVISIONING_MODE -ErrorAction SilentlyContinue
  if ($started) { & (Join-Path $pgBin "pg_ctl.exe") -D $cluster -m immediate -w stop *> $null }
  $clusterPath = [System.IO.Path]::GetFullPath($cluster); $logsPath = [System.IO.Path]::GetFullPath($logs); $tempPath = [System.IO.Path]::GetFullPath($tempBase)
  if ($clusterPath.StartsWith($tempPath) -and $logsPath.StartsWith($tempPath)) { Remove-Item -LiteralPath $clusterPath,$logsPath -Recurse -Force -ErrorAction SilentlyContinue }
}
