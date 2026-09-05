$ErrorActionPreference = "Stop"
$pgBin = "C:\Program Files\PostgreSQL\18\bin"
$cluster = Join-Path ([IO.Path]::GetFullPath([IO.Path]::GetTempPath())) ("oldmike-v2-alpha3-browser-pg18-" + [Guid]::NewGuid().ToString("N"))
$logs = Join-Path ([IO.Path]::GetFullPath([IO.Path]::GetTempPath())) ("oldmike-v2-alpha3-browser-logs-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $cluster,$logs | Out-Null
function Get-FreePort { $listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0); $listener.Start(); $selected=([Net.IPEndPoint]$listener.LocalEndpoint).Port; $listener.Stop(); return $selected }
function Stop-ExactProcessTree([int]$RootPid) {
  $all = @(Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId)
  $ids = [Collections.Generic.List[int]]::new(); $ids.Add($RootPid)
  for ($index=0; $index -lt $ids.Count; $index++) { foreach ($process in $all) { if ($process.ParentProcessId -eq $ids[$index] -and -not $ids.Contains([int]$process.ProcessId)) { $ids.Add([int]$process.ProcessId) } } }
  for ($index=$ids.Count-1; $index -ge 0; $index--) { Stop-Process -Id $ids[$index] -Force -ErrorAction SilentlyContinue }
}
$pgPort = Get-FreePort
$webPort = Get-FreePort
$pgStarted = $false
$server = $null
$exitCode = 2
try {
  & (Join-Path $pgBin "initdb.exe") -D $cluster -U postgres -A trust --no-locale *> (Join-Path $logs "initdb.log")
  if ($LASTEXITCODE -ne 0) { throw "INITDB_FAILED" }
  $pgStart = Start-Process -FilePath (Join-Path $pgBin "pg_ctl.exe") -ArgumentList @("-D",$cluster,"-l",(Join-Path $logs "postgres.log"),"-o","`"-h 127.0.0.1 -p $pgPort`"","-w","start") -WindowStyle Hidden -PassThru
  if (-not $pgStart.WaitForExit(30000) -or $pgStart.ExitCode -ne 0) { throw "POSTGRES_START_FAILED" }
  $pgStarted = $true
  & (Join-Path $pgBin "createdb.exe") -h 127.0.0.1 -p $pgPort -U postgres alpha3browser
  if ($LASTEXITCODE -ne 0) { throw "CREATE_DB_FAILED" }
  $env:PGOPTIONS = "-c client_min_messages=warning"
  foreach ($migration in 1..6) {
    $files = @(Get-ChildItem -LiteralPath "database\migrations" -Filter (("{0:D4}_*.up.sql" -f $migration)))
    if ($files.Count -ne 1) { throw ("MIGRATION_{0:D4}_AUTHORITY_INVALID" -f $migration) }
    & (Join-Path $pgBin "psql.exe") -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $pgPort -U postgres -d alpha3browser -f $files[0].FullName *> (Join-Path $logs ("migration-{0:D4}.log" -f $migration))
    if ($LASTEXITCODE -ne 0) { throw ("MIGRATION_{0:D4}_FAILED" -f $migration) }
  }
  foreach ($proposal in @("v2-alpha2-research-generation.up.sql","v2-alpha3-domain-chat-literature.up.sql")) {
    & (Join-Path $pgBin "psql.exe") -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $pgPort -U postgres -d alpha3browser -f (Join-Path "database\proposals" $proposal) *> (Join-Path $logs ($proposal + ".log"))
    if ($LASTEXITCODE -ne 0) { throw ("PROPOSAL_FAILED_" + $proposal) }
  }
  & (Join-Path $pgBin "psql.exe") -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $pgPort -U postgres -d alpha3browser -f "scripts\fixtures\v2-alpha3-browser.sql" *> (Join-Path $logs "fixture.log")
  if ($LASTEXITCODE -ne 0) { throw "FIXTURE_FAILED" }

  $env:DATABASE_URL = "postgresql://postgres@127.0.0.1:$pgPort/alpha3browser"
  $env:INTEGRATION_TEST_MODE = "1"
  $env:TEST_FIXTURE = "1"
  $env:OLD_MIKE_V2_ALPHA2_SERVER_ENABLED = "1"
  $env:OLD_MIKE_V2_ALPHA2_SYNTHETIC_PRINCIPAL = "1"
  $env:OLD_MIKE_V2_ALPHA2_SYNTHETIC_PROVIDER = "1"
  $env:OLD_MIKE_V2_ALPHA2_SYNTHETIC_DELAY_MS = "450"
  $env:OLD_MIKE_V2_ALPHA3_LOCAL_PROTOTYPE = "1"
  $env:NEXT_TELEMETRY_DISABLED = "1"
  $env:V2_ALPHA3_BASE_URL = "http://127.0.0.1:$webPort"
  $env:BETTER_AUTH_URL = $env:V2_ALPHA3_BASE_URL
  $node = (Get-Command node).Source
  $next = Join-Path (Get-Location) "node_modules\next\dist\bin\next"
  $server = Start-Process -FilePath $node -ArgumentList @($next,"dev","--hostname","127.0.0.1","--port",[string]$webPort) -WorkingDirectory (Get-Location) -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs "next.out.log") -RedirectStandardError (Join-Path $logs "next.err.log") -PassThru
  $ready = $false
  for ($attempt=0; $attempt -lt 160; $attempt++) {
    if ($server.HasExited) { throw "NEXT_SERVER_EXITED" }
    try { $response=Invoke-WebRequest -UseBasicParsing -Uri ("http://127.0.0.1:{0}/v2-alpha3-local" -f $webPort) -TimeoutSec 1; if ($response.StatusCode -eq 200) { $ready=$true; break } } catch {}
    Start-Sleep -Milliseconds 250
  }
  if (-not $ready) { throw "NEXT_SERVER_TIMEOUT" }
  node scripts\verify-v2-alpha3-browser.mjs
  if ($LASTEXITCODE -ne 0) { throw "BROWSER_TEST_FAILED" }
  $counts = & (Join-Path $pgBin "psql.exe") -X -A -t -F "|" -h 127.0.0.1 -p $pgPort -U postgres -d alpha3browser -c "SELECT (SELECT count(*) FROM research_generation_jobs),(SELECT count(*) FROM research_generation_effects),(SELECT count(*) FROM research_generation_results),(SELECT count(*) FROM research_domain_profiles),(SELECT count(*) FROM research_conversation_events),(SELECT count(*) FROM projects),(SELECT count(*) FROM research_documents)+(SELECT count(*) FROM research_studies)+(SELECT count(*) FROM research_workflow_events);"
  if ($LASTEXITCODE -ne 0 -or $counts.Trim() -ne "2|2|2|1|3|1|0") { throw ("EFFECT_OR_FORMAL_WRITE_COUNT_INVALID_" + $counts.Trim()) }
  Write-Output "PASS V2_ALPHA3_BROWSER_DB jobs=2 effects=2 results=2 profiles=1 events=3 formal_research_rows=0"
  $exitCode = 0
} catch {
  Write-Output "V2_ALPHA3_BROWSER=FAIL"
  Write-Output ("FIRST_FAILED_STAGE=" + $_.Exception.Message)
} finally {
  if ($server) { Stop-ExactProcessTree $server.Id }
  foreach ($name in @("DATABASE_URL","INTEGRATION_TEST_MODE","TEST_FIXTURE","OLD_MIKE_V2_ALPHA2_SERVER_ENABLED","OLD_MIKE_V2_ALPHA2_SYNTHETIC_PRINCIPAL","OLD_MIKE_V2_ALPHA2_SYNTHETIC_PROVIDER","OLD_MIKE_V2_ALPHA2_SYNTHETIC_DELAY_MS","OLD_MIKE_V2_ALPHA3_LOCAL_PROTOTYPE","NEXT_TELEMETRY_DISABLED","V2_ALPHA3_BASE_URL","BETTER_AUTH_URL","PGOPTIONS")) { Remove-Item ("Env:" + $name) -ErrorAction SilentlyContinue }
  if ($pgStarted) { & (Join-Path $pgBin "pg_ctl.exe") -D $cluster -m fast -w stop *> (Join-Path $logs "stop.log") }
  if (Test-Path -LiteralPath $cluster) { Remove-Item -LiteralPath $cluster -Recurse -Force }
  if (Test-Path -LiteralPath $logs) { Remove-Item -LiteralPath $logs -Recurse -Force }
  Write-Output "V2_ALPHA3_BROWSER_CLEANUP=PASS_ZERO_TEMP_PROCESS"
}
exit $exitCode
