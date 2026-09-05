$ErrorActionPreference = "Stop"

$pgBin = "C:\Program Files\PostgreSQL\18\bin"
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$withServer = "C:\Users\Administrator\.codex\skills\webapp-testing\scripts\with_server.py"
$pythonDeps = $env:OLDMIKE_V1518_PYTHON_DEPS
foreach ($path in @((Join-Path $pgBin "initdb.exe"), (Join-Path $pgBin "postgres.exe"), (Join-Path $pgBin "pg_isready.exe"), (Join-Path $pgBin "pg_ctl.exe"), (Join-Path $pgBin "createdb.exe"), $chrome, $withServer)) {
  if (-not (Test-Path -LiteralPath $path)) { Write-Output "PROFILE_BROWSER_E2E=FAIL"; Write-Output "ERROR_CATEGORY=LOCAL_TOOL_MISSING"; exit 2 }
}
if ([string]::IsNullOrWhiteSpace($pythonDeps) -or -not (Test-Path -LiteralPath $pythonDeps)) { Write-Output "PROFILE_BROWSER_E2E=FAIL"; Write-Output "ERROR_CATEGORY=PYTHON_BROWSER_DEPENDENCY_MISSING"; exit 2 }

$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$cluster = Join-Path $tempBase ("oldmike-v1518-profile-" + [Guid]::NewGuid().ToString("N"))
$logs = Join-Path $tempBase ("oldmike-v1518-profile-logs-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $cluster, $logs | Out-Null
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0); $listener.Start(); $pgPort = ([Net.IPEndPoint]$listener.LocalEndpoint).Port; $listener.Stop()
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0); $listener.Start(); $appPort = ([Net.IPEndPoint]$listener.LocalEndpoint).Port; $listener.Stop()
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0); $listener.Start(); $browserPort = ([Net.IPEndPoint]$listener.LocalEndpoint).Port; $listener.Stop()
$started = $false
$postgresProcess = $null
$serviceName = "oldmike-v1518-profile-" + [Guid]::NewGuid().ToString("N").Substring(0, 10)
$serviceRegistered = $false
$windowsIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
$windowsPrincipal = [Security.Principal.WindowsPrincipal]::new($windowsIdentity)
$isAdministrator = $windowsPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
$code = 2
$stage = "INITDB"
try {
  $savedPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & (Join-Path $pgBin "initdb.exe") -D $cluster -U postgres -A trust --no-locale *> (Join-Path $logs "initdb.log")
  $nativeExit = $LASTEXITCODE
  $ErrorActionPreference = $savedPreference
  if ($nativeExit -ne 0) { throw "INITDB_FAILED" }
  $stage = "POSTGRES_START"
  if ($isAdministrator) {
    & icacls.exe $cluster /grant '*S-1-5-20:(OI)(CI)F' /T /Q *> (Join-Path $logs "acl.log")
    if ($LASTEXITCODE -ne 0) { throw "POSTGRES_SERVICE_ACL_FAILED" }
    $savedPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & (Join-Path $pgBin "pg_ctl.exe") register -N $serviceName -D $cluster -o "-h 127.0.0.1 -p $pgPort" -U 'NT AUTHORITY\NetworkService' *> (Join-Path $logs "service-register.log")
    $nativeExit = $LASTEXITCODE
    $ErrorActionPreference = $savedPreference
    if ($nativeExit -ne 0) { throw "POSTGRES_SERVICE_REGISTER_FAILED" }
    $serviceRegistered = $true
    Start-Service -Name $serviceName
  } else {
    $postgresProcess = Start-Process -FilePath (Join-Path $pgBin "postgres.exe") -ArgumentList @("-D", $cluster, "-h", "127.0.0.1", "-p", [string]$pgPort) -RedirectStandardOutput (Join-Path $logs "postgres.stdout.log") -RedirectStandardError (Join-Path $logs "postgres.stderr.log") -WindowStyle Hidden -PassThru
  }
  $ready = $false
  for ($attempt = 0; $attempt -lt 60; $attempt += 1) {
    if ($null -ne $postgresProcess -and $postgresProcess.HasExited) { break }
    $savedPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & (Join-Path $pgBin "pg_isready.exe") -h 127.0.0.1 -p $pgPort -t 1 *> $null
    $nativeExit = $LASTEXITCODE
    $ErrorActionPreference = $savedPreference
    if ($nativeExit -eq 0) { $ready = $true; break }
    Start-Sleep -Milliseconds 500
  }
  if (-not $ready) { throw "POSTGRES_START_FAILED" }
  $started = $true
  $env:PGCONNECT_TIMEOUT = "5"
  $savedPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & (Join-Path $pgBin "createdb.exe") -h 127.0.0.1 -p $pgPort -U postgres oldmike_v1518_profile *> (Join-Path $logs "createdb.log")
  $nativeExit = $LASTEXITCODE
  $ErrorActionPreference = $savedPreference
  if ($nativeExit -ne 0) { throw "CREATE_DATABASE_FAILED" }

  $env:INTEGRATION_DATABASE_URL = "postgresql://postgres@127.0.0.1:$pgPort/oldmike_v1518_profile"
  $env:INTEGRATION_DATABASE_DISPOSABLE = "1"
  $env:DATABASE_URL = $env:INTEGRATION_DATABASE_URL
  $env:BETTER_AUTH_SECRET = "profile-browser-disposable-secret-32-chars"
  $env:BETTER_AUTH_URL = "https://localhost:$browserPort"
  $env:REGISTRATION_MODE = "closed"
  $env:ACCOUNT_PROVISIONING_MODE = "admin_only"
  $env:OPENCLAW_EXTERNAL_SEARCH = "false"
  $env:NODE_ENV = "production"
  $env:PORT = [string]$appPort
  $env:PROFILE_E2E_BASE_URL = $env:BETTER_AUTH_URL
  $env:PROFILE_E2E_BACKEND_URL = "http://127.0.0.1:$appPort"
  $env:PROFILE_E2E_EMAIL = "profile-browser@fixture.invalid"
  $env:PROFILE_E2E_PASSWORD = "Profile-Browser-Fixture-Password-512!"
  $env:PROFILE_E2E_CHROME = $chrome
  $env:PYTHONUTF8 = "1"
  $env:PYTHONPATH = $pythonDeps

  $stage = "FIXTURE_SETUP"
  node scripts/setup-profile-display-name-browser-fixture.mjs
  if ($LASTEXITCODE -ne 0) { throw "FIXTURE_SETUP_FAILED" }
  $stage = "PLAYWRIGHT_AXE"
  python $withServer --server "node .next/standalone/server.js" --port $appPort --timeout 45 -- python scripts/verify-profile-display-name-browser.py
  if ($LASTEXITCODE -ne 0) { throw "PLAYWRIGHT_AXE_FAILED" }
  $stage = "DATABASE_POSTCHECK"
  node scripts/verify-profile-display-name-browser-db.mjs
  if ($LASTEXITCODE -ne 0) { throw "DATABASE_POSTCHECK_FAILED" }
  $code = 0
  Write-Output "PROFILE_DISPLAY_NAME_BROWSER_CONTRACT=PASS"
} catch {
  Write-Output "PROFILE_DISPLAY_NAME_BROWSER_CONTRACT=FAIL"
  Write-Output "FAILED_STAGE=$stage"
  $code = 2
} finally {
  $appListeners = @(Get-NetTCPConnection -LocalPort $appPort -State Listen -ErrorAction SilentlyContinue)
  foreach ($appListener in $appListeners) {
    $ownerId = $appListener.OwningProcess
    $owner = Get-Process -Id $ownerId -ErrorAction SilentlyContinue
    if ($null -ne $owner -and $owner.ProcessName -eq "node") { Stop-Process -Id $ownerId -Force }
  }
  foreach ($name in @("INTEGRATION_DATABASE_URL","INTEGRATION_DATABASE_DISPOSABLE","DATABASE_URL","BETTER_AUTH_SECRET","BETTER_AUTH_URL","REGISTRATION_MODE","ACCOUNT_PROVISIONING_MODE","OPENCLAW_EXTERNAL_SEARCH","NODE_ENV","PORT","PGCONNECT_TIMEOUT","PROFILE_E2E_BASE_URL","PROFILE_E2E_BACKEND_URL","PROFILE_E2E_EMAIL","PROFILE_E2E_PASSWORD","PROFILE_E2E_CHROME","PYTHONUTF8","PYTHONPATH")) { Remove-Item "Env:$name" -ErrorAction SilentlyContinue }
  if ($started) {
    if ($serviceRegistered) {
      Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
    } else {
      $savedPreference = $ErrorActionPreference
      $ErrorActionPreference = "Continue"
      & (Join-Path $pgBin "pg_ctl.exe") -D $cluster -m fast -t 30 -w stop *> (Join-Path $logs "stop.log")
      $ErrorActionPreference = $savedPreference
    }
  }
  if ($serviceRegistered) {
    $savedPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & (Join-Path $pgBin "pg_ctl.exe") unregister -N $serviceName *> (Join-Path $logs "service-unregister.log")
    $ErrorActionPreference = $savedPreference
  }
  $resolvedCluster = [IO.Path]::GetFullPath($cluster); $resolvedLogs = [IO.Path]::GetFullPath($logs)
  if (-not $resolvedCluster.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($resolvedCluster) -notlike "oldmike-v1518-profile-*" -or -not $resolvedLogs.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($resolvedLogs) -notlike "oldmike-v1518-profile-logs-*") { throw "TEMP_SCOPE_INVALID" }
  if (Test-Path -LiteralPath $resolvedCluster) { Remove-Item -LiteralPath $resolvedCluster -Recurse -Force }
  if (Test-Path -LiteralPath $resolvedLogs) { Remove-Item -LiteralPath $resolvedLogs -Recurse -Force }
  Write-Output "DATABASE_WRITES_DISPOSABLE_RETAINED=0"
}
exit $code
