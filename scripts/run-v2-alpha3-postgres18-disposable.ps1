$ErrorActionPreference = "Stop"
$pgBin = "C:\Program Files\PostgreSQL\18\bin"
$required = @("initdb.exe", "pg_ctl.exe", "createdb.exe", "psql.exe")
foreach ($name in $required) { if (-not (Test-Path -LiteralPath (Join-Path $pgBin $name))) { Write-Output "V2_ALPHA3_POSTGRES18=BLOCKED_LOCAL_PROVIDER_MISSING"; exit 2 } }
$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$cluster = Join-Path $tempBase ("oldmike-v2-alpha3-pg18-" + [Guid]::NewGuid().ToString("N"))
$logs = Join-Path $tempBase ("oldmike-v2-alpha3-pg18-logs-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $cluster,$logs | Out-Null
function Get-FreePort { $listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0); $listener.Start(); $port=([Net.IPEndPoint]$listener.LocalEndpoint).Port; $listener.Stop(); return $port }
$port = Get-FreePort
$started = $false
$exitCode = 2
try {
  & (Join-Path $pgBin "initdb.exe") -D $cluster -U postgres -A trust --no-locale *> (Join-Path $logs "initdb.log")
  if ($LASTEXITCODE -ne 0) { throw "INITDB_FAILED" }
  $start = Start-Process -FilePath (Join-Path $pgBin "pg_ctl.exe") -ArgumentList @("-D",$cluster,"-l",(Join-Path $logs "postgres.log"),"-o","`"-h 127.0.0.1 -p $port`"","-w","start") -WindowStyle Hidden -PassThru
  if (-not $start.WaitForExit(30000) -or $start.ExitCode -ne 0) { throw "POSTGRES_START_FAILED" }
  $started = $true
  & (Join-Path $pgBin "createdb.exe") -h 127.0.0.1 -p $port -U postgres alpha3
  if ($LASTEXITCODE -ne 0) { throw "CREATE_DB_FAILED" }
  $env:PGOPTIONS = "-c client_min_messages=warning"
  foreach ($migration in 1..6) {
    $matches = @(Get-ChildItem -LiteralPath "database\migrations" -Filter (("{0:D4}_*.up.sql" -f $migration)))
    if ($matches.Count -ne 1) { throw ("MIGRATION_{0:D4}_AUTHORITY_INVALID" -f $migration) }
    & (Join-Path $pgBin "psql.exe") -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $port -U postgres -d alpha3 -f $matches[0].FullName *> (Join-Path $logs ("migration-{0:D4}.log" -f $migration))
    if ($LASTEXITCODE -ne 0) { throw ("MIGRATION_{0:D4}_FAILED" -f $migration) }
  }
  & (Join-Path $pgBin "psql.exe") -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $port -U postgres -d alpha3 -f "database\proposals\v2-alpha2-research-generation.up.sql" *> (Join-Path $logs "alpha2-ddl.log")
  if ($LASTEXITCODE -ne 0) { throw "ALPHA2_PROPOSAL_FAILED" }
  & (Join-Path $pgBin "psql.exe") -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $port -U postgres -d alpha3 -f "database\proposals\v2-alpha3-domain-chat-literature.up.sql" *> (Join-Path $logs "alpha3-ddl.log")
  if ($LASTEXITCODE -ne 0) { throw "ALPHA3_DDL_FAILED" }
  $verify = Join-Path $logs "alpha3-verify.log"
  & (Join-Path $pgBin "psql.exe") -X -A -t -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $port -U postgres -d alpha3 -f "database\proposals\v2-alpha3-domain-chat-literature.verify.sql" -o $verify
  if ($LASTEXITCODE -ne 0 -or -not (Select-String -LiteralPath $verify -Pattern '^COMPLETE$' -Quiet)) { throw "ALPHA3_VERIFY_COMPLETE_FAILED" }
  $env:DATABASE_URL = "postgresql://postgres@127.0.0.1:$port/alpha3"
  $env:INTEGRATION_TEST_MODE = "1"
  $env:TEST_FIXTURE = "1"
  node --experimental-strip-types --experimental-loader ./scripts/disposable-server-only-loader.mjs scripts/verify-v2-alpha3-postgres.mjs
  if ($LASTEXITCODE -ne 0) { throw "REPOSITORY_TEST_FAILED" }
  $exitCode = 0
} catch {
  Write-Output "V2_ALPHA3_POSTGRES18=FAIL"
  Write-Output ("FIRST_FAILED_STAGE=" + $_.Exception.Message)
} finally {
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:INTEGRATION_TEST_MODE -ErrorAction SilentlyContinue
  Remove-Item Env:TEST_FIXTURE -ErrorAction SilentlyContinue
  Remove-Item Env:PGOPTIONS -ErrorAction SilentlyContinue
  if ($started) { & (Join-Path $pgBin "pg_ctl.exe") -D $cluster -m fast -w stop *> (Join-Path $logs "stop.log") }
  if (Test-Path -LiteralPath $cluster) { Remove-Item -LiteralPath $cluster -Recurse -Force }
  if (Test-Path -LiteralPath $logs) { Remove-Item -LiteralPath $logs -Recurse -Force }
  Write-Output "V2_ALPHA3_DISPOSABLE_CLEANUP=PASS_ZERO_TEMP"
}
exit $exitCode
