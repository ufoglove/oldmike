$ErrorActionPreference = "Stop"

$pgBin = "C:\Program Files\PostgreSQL\18\bin"
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
foreach ($tool in @((Join-Path $pgBin "initdb.exe"), (Join-Path $pgBin "pg_ctl.exe"), (Join-Path $pgBin "createdb.exe"), $chrome, (Join-Path $PWD ".next\standalone\server.js"))) {
  if (-not (Test-Path -LiteralPath $tool)) { Write-Output "TOPIC_LAB_BROWSER_E2E=FAIL"; Write-Output "ERROR_CATEGORY=LOCAL_TOOL_OR_BUILD_MISSING"; exit 2 }
}

$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$cluster = Join-Path $tempBase ("oldmike-v1522-browser-" + [Guid]::NewGuid().ToString("N"))
$logs = Join-Path $tempBase ("oldmike-v1522-browser-logs-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $cluster, $logs | Out-Null
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0); $listener.Start(); $pgPort = ([Net.IPEndPoint]$listener.LocalEndpoint).Port; $listener.Stop()
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0); $listener.Start(); $appPort = ([Net.IPEndPoint]$listener.LocalEndpoint).Port; $listener.Stop()
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0); $listener.Start(); $browserPort = ([Net.IPEndPoint]$listener.LocalEndpoint).Port; $listener.Stop()
$postgresStarted = $false
$app = $null
$proxy = $null
$code = 2
$stage = "INITDB"
try {
  & (Join-Path $pgBin "initdb.exe") -D $cluster -U postgres -A trust --no-locale *> (Join-Path $logs "initdb.log")
  if ($LASTEXITCODE -ne 0) { throw "INITDB_FAILED" }
  $stage = "POSTGRES_START"
  $pgStart = Start-Process -FilePath (Join-Path $pgBin "pg_ctl.exe") -ArgumentList @("-D", $cluster, "-l", (Join-Path $logs "postgres.log"), "-o", "`"-h 127.0.0.1 -p $pgPort`"", "-w", "start") -WindowStyle Hidden -PassThru
  if (-not $pgStart.WaitForExit(30000) -or $pgStart.ExitCode -ne 0) { throw "POSTGRES_START_FAILED" }
  $postgresStarted = $true
  & (Join-Path $pgBin "createdb.exe") -h 127.0.0.1 -p $pgPort -U postgres oldmike_topic_lab_browser *> (Join-Path $logs "createdb.log")
  if ($LASTEXITCODE -ne 0) { throw "CREATE_DATABASE_FAILED" }

  $env:INTEGRATION_DATABASE_URL = "postgresql://postgres@127.0.0.1:$pgPort/oldmike_topic_lab_browser"
  $env:DATABASE_URL = $env:INTEGRATION_DATABASE_URL
  $env:INTEGRATION_DATABASE_DISPOSABLE = "1"
  $env:INTEGRATION_TEST_MODE = "1"
  $env:TEST_FIXTURE = "1"
  $env:BETTER_AUTH_URL = "https://localhost:$browserPort"
  $env:BETTER_AUTH_SECRET = "fixture-" + [Guid]::NewGuid().ToString("N") + [Guid]::NewGuid().ToString("N")
  $env:REGISTRATION_MODE = "closed"
  $env:ACCOUNT_PROVISIONING_MODE = "admin_only"
  $env:LEGACY_AUTH_ENABLED = "false"
  $env:OPENCLAW_EXTERNAL_SEARCH = "false"
  $env:OLD_MIKE_WEB_RESEARCH_MODE = "disabled"
  $env:NODE_ENV = "production"
  $env:PORT = [string]$appPort
  $env:HOSTNAME = "127.0.0.1"
  $env:TOPIC_LAB_E2E_BASE_URL = $env:BETTER_AUTH_URL
  $env:TOPIC_LAB_E2E_EMAIL = "topic-lab-" + [Guid]::NewGuid().ToString("N") + "@fixture.invalid"
  $env:TOPIC_LAB_E2E_PASSWORD = "Fixture-" + [Guid]::NewGuid().ToString("N") + "!"
  $env:TOPIC_LAB_E2E_CHROME = $chrome
  $env:LOCAL_HTTPS_PROXY_PORT = [string]$browserPort
  $env:LOCAL_HTTPS_BACKEND_PORT = [string]$appPort

  $stage = "FIXTURE_SETUP"
  node scripts/setup-topic-lab-browser-fixture.mjs
  if ($LASTEXITCODE -ne 0) { throw "FIXTURE_SETUP_FAILED" }
  Remove-Item -LiteralPath "Env:INTEGRATION_TEST_MODE" -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath "Env:TEST_FIXTURE" -ErrorAction SilentlyContinue
  $stage = "APP_START"
  $app = Start-Process -FilePath "node" -ArgumentList @(".next/standalone/server.js") -WorkingDirectory $PWD -RedirectStandardOutput (Join-Path $logs "app.stdout.log") -RedirectStandardError (Join-Path $logs "app.stderr.log") -WindowStyle Hidden -PassThru
  $ready = $false
  for ($attempt = 0; $attempt -lt 90; $attempt += 1) {
    if ($app.HasExited) { break }
    try { $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$appPort/login" -TimeoutSec 2; if ($response.StatusCode -eq 200) { $ready = $true; break } } catch {}
    Start-Sleep -Milliseconds 500
  }
  if (-not $ready) { throw "APP_START_FAILED" }
  $stage = "HTTPS_PROXY_START"
  $proxy = Start-Process -FilePath "node" -ArgumentList @("scripts/local-https-proxy.mjs") -WorkingDirectory $PWD -RedirectStandardOutput (Join-Path $logs "proxy.stdout.log") -RedirectStandardError (Join-Path $logs "proxy.stderr.log") -WindowStyle Hidden -PassThru
  $proxyReady = $false
  for ($attempt = 0; $attempt -lt 60; $attempt += 1) {
    if ($proxy.HasExited) { break }
    $probe = [Net.Sockets.TcpClient]::new()
    try { $probe.Connect("127.0.0.1", $browserPort); $proxyReady = $true; break } catch {} finally { $probe.Dispose() }
    Start-Sleep -Milliseconds 250
  }
  if (-not $proxyReady) { throw "HTTPS_PROXY_START_FAILED" }
  $stage = "PLAYWRIGHT_AXE"
  node scripts/verify-topic-lab-browser.mjs
  if ($LASTEXITCODE -ne 0) { throw "PLAYWRIGHT_AXE_FAILED" }
  $stage = "DATABASE_POSTCHECK"
  $env:INTEGRATION_TEST_MODE = "1"
  $env:TEST_FIXTURE = "1"
  node scripts/verify-topic-lab-browser-db.mjs
  if ($LASTEXITCODE -ne 0) { throw "DATABASE_POSTCHECK_FAILED" }
  $code = 0
  Write-Output "TOPIC_LAB_BROWSER_CONTRACT=PASS"
} catch {
  Write-Output "TOPIC_LAB_BROWSER_CONTRACT=FAIL"
  Write-Output "FAILED_STAGE=$stage"
  Write-Output ("APP_PROCESS_EXITED=" + $(if ($null -eq $app) { "NOT_STARTED" } elseif ($app.HasExited) { "YES" } else { "NO" }))
  Write-Output ("PROXY_PROCESS_EXITED=" + $(if ($null -eq $proxy) { "NOT_STARTED" } elseif ($proxy.HasExited) { "YES" } else { "NO" }))
  foreach ($logName in @("app.stderr.log", "app.stdout.log", "proxy.stderr.log", "proxy.stdout.log")) {
    $logPath = Join-Path $logs $logName
    if (Test-Path -LiteralPath $logPath) {
      Get-Content -LiteralPath $logPath -Tail 30 | ForEach-Object {
        $safe = $_ -replace 'postgres(?:ql)?://[^\s]+', '[REDACTED_DATABASE_URL]' -replace '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+', '[REDACTED_EMAIL]' -replace 'Fixture-[A-Za-z0-9-]+!', '[REDACTED_FIXTURE]'
        if ($safe -match 'Error|error|failed|ECONN|Unhandled|SIG|ready|started') { Write-Output ("APP_LOG_REDACTED=" + $safe) }
      }
    }
  }
  $code = 2
} finally {
  if ($null -ne $proxy -and -not $proxy.HasExited) { Stop-Process -Id $proxy.Id -Force -ErrorAction SilentlyContinue }
  if ($null -ne $app -and -not $app.HasExited) { Stop-Process -Id $app.Id -Force -ErrorAction SilentlyContinue }
  foreach ($name in @("INTEGRATION_DATABASE_URL","DATABASE_URL","INTEGRATION_DATABASE_DISPOSABLE","INTEGRATION_TEST_MODE","TEST_FIXTURE","BETTER_AUTH_URL","BETTER_AUTH_SECRET","REGISTRATION_MODE","ACCOUNT_PROVISIONING_MODE","LEGACY_AUTH_ENABLED","OPENCLAW_EXTERNAL_SEARCH","OLD_MIKE_WEB_RESEARCH_MODE","NODE_ENV","PORT","HOSTNAME","TOPIC_LAB_E2E_BASE_URL","TOPIC_LAB_E2E_EMAIL","TOPIC_LAB_E2E_PASSWORD","TOPIC_LAB_E2E_CHROME","LOCAL_HTTPS_PROXY_PORT","LOCAL_HTTPS_BACKEND_PORT")) { Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue }
  if ($postgresStarted) { & (Join-Path $pgBin "pg_ctl.exe") -D $cluster -m fast -w stop *> (Join-Path $logs "stop.log") }
  $resolvedCluster = [IO.Path]::GetFullPath($cluster); $resolvedLogs = [IO.Path]::GetFullPath($logs)
  if (-not $resolvedCluster.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($resolvedCluster) -notlike "oldmike-v1522-browser-*" -or -not $resolvedLogs.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($resolvedLogs) -notlike "oldmike-v1522-browser-logs-*") { throw "TEMP_SCOPE_INVALID" }
  if (Test-Path -LiteralPath $resolvedCluster) { Remove-Item -LiteralPath $resolvedCluster -Recurse -Force }
  if (Test-Path -LiteralPath $resolvedLogs) { Remove-Item -LiteralPath $resolvedLogs -Recurse -Force }
  Write-Output "DATABASE_WRITES_DISPOSABLE_RETAINED=0"
}
exit $code
