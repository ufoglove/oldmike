$ErrorActionPreference = "Stop"
$pgBin = "C:\Program Files\PostgreSQL\18\bin"
foreach ($tool in @((Join-Path $pgBin "initdb.exe"),(Join-Path $pgBin "pg_ctl.exe"),(Join-Path $pgBin "createdb.exe"))) { if (-not (Test-Path -LiteralPath $tool)) { Write-Output "M05_DISPOSABLE=FAIL"; Write-Output "ERROR_CATEGORY=LOCAL_POSTGRESQL18_MISSING"; exit 2 } }
$tempBase=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()); $cluster=Join-Path $tempBase ("oldmike-v1530-m05-"+[Guid]::NewGuid().ToString("N")); $logs=Join-Path $tempBase ("oldmike-v1530-m05-logs-"+[Guid]::NewGuid().ToString("N")); New-Item -ItemType Directory -Path $cluster,$logs|Out-Null
function Free-Port { $listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0); $listener.Start(); $value=([Net.IPEndPoint]$listener.LocalEndpoint).Port; $listener.Stop(); return $value }
$pgPort=Free-Port; $postgresStarted=$false; $code=2; $stage="INITDB"
try {
  & (Join-Path $pgBin "initdb.exe") -D $cluster -U postgres -A trust --no-locale *> (Join-Path $logs "initdb.log"); if($LASTEXITCODE-ne 0){throw "INITDB_FAILED"}
  $stage="POSTGRES_START"; $pgStart=Start-Process -FilePath (Join-Path $pgBin "pg_ctl.exe") -ArgumentList @("-D",$cluster,"-l",(Join-Path $logs "postgres.log"),"-o","`"-h 127.0.0.1 -p $pgPort`"","-w","start") -WindowStyle Hidden -PassThru; if(-not $pgStart.WaitForExit(30000)-or $pgStart.ExitCode-ne 0){throw "POSTGRES_START_FAILED"}; $postgresStarted=$true
  & (Join-Path $pgBin "createdb.exe") -h 127.0.0.1 -p $pgPort -U postgres oldmike_m05 *> (Join-Path $logs "createdb.log"); if($LASTEXITCODE-ne 0){throw "CREATE_DATABASE_FAILED"}
  $env:INTEGRATION_DATABASE_URL="postgresql://postgres@127.0.0.1:$pgPort/oldmike_m05"; $env:DATABASE_URL=$env:INTEGRATION_DATABASE_URL; $env:INTEGRATION_DATABASE_DISPOSABLE="1"; $env:INTEGRATION_TEST_MODE="1"; $env:TEST_FIXTURE="1"
  $stage="M05_DISPOSABLE"; node --experimental-strip-types --experimental-loader ./scripts/disposable-server-only-loader.mjs scripts/verify-proposal-studio-disposable.mjs; if($LASTEXITCODE-ne 0){throw "M05_DISPOSABLE_FAILED"}; $code=0
} catch { Write-Output "M05_DISPOSABLE=FAIL"; Write-Output "FAILED_STAGE=$stage"; $code=2 } finally {
  foreach($name in @("INTEGRATION_DATABASE_URL","DATABASE_URL","INTEGRATION_DATABASE_DISPOSABLE","INTEGRATION_TEST_MODE","TEST_FIXTURE")){Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue}
  if($postgresStarted){&(Join-Path $pgBin "pg_ctl.exe") -D $cluster -m fast -w stop *> (Join-Path $logs "stop.log")}
  $resolvedCluster=[IO.Path]::GetFullPath($cluster);$resolvedLogs=[IO.Path]::GetFullPath($logs);if(-not $resolvedCluster.StartsWith($tempBase,[StringComparison]::OrdinalIgnoreCase)-or[IO.Path]::GetFileName($resolvedCluster)-notlike"oldmike-v1530-m05-*"-or-not $resolvedLogs.StartsWith($tempBase,[StringComparison]::OrdinalIgnoreCase)-or[IO.Path]::GetFileName($resolvedLogs)-notlike"oldmike-v1530-m05-logs-*"){throw "TEMP_SCOPE_INVALID"};if(Test-Path -LiteralPath $resolvedCluster){Remove-Item -LiteralPath $resolvedCluster -Recurse -Force};if(Test-Path -LiteralPath $resolvedLogs){Remove-Item -LiteralPath $resolvedLogs -Recurse -Force};Write-Output "DATABASE_PROCESS_TEMP_CLEANUP=PASS"
}
exit $code
