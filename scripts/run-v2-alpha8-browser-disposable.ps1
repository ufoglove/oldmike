$ErrorActionPreference = "Stop"
$logs = Join-Path ([IO.Path]::GetFullPath([IO.Path]::GetTempPath())) ("oldmike-v2-alpha8-browser-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $logs | Out-Null

function Get-FreePort {
  $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
  $listener.Start()
  $selected = ([Net.IPEndPoint]$listener.LocalEndpoint).Port
  $listener.Stop()
  return $selected
}

function Stop-ExactProcessTree([int]$RootPid) {
  $all = @(Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId)
  $ids = [Collections.Generic.List[int]]::new()
  $ids.Add($RootPid)
  for ($index = 0; $index -lt $ids.Count; $index++) {
    foreach ($process in $all) {
      if ($process.ParentProcessId -eq $ids[$index] -and -not $ids.Contains([int]$process.ProcessId)) { $ids.Add([int]$process.ProcessId) }
    }
  }
  for ($index = $ids.Count - 1; $index -ge 0; $index--) { Stop-Process -Id $ids[$index] -Force -ErrorAction SilentlyContinue }
}

$webPort = Get-FreePort
$server = $null
$exitCode = 2
try {
  $env:TEST_FIXTURE = "1"
  $env:OLD_MIKE_V2_ALPHA8_SYNTHETIC_PRINCIPAL = "1"
  $env:OLD_MIKE_V2_ALPHA8_LOCAL_PROTOTYPE = "1"
  $env:NEXT_TELEMETRY_DISABLED = "1"
  $env:V2_ALPHA8_BASE_URL = "http://127.0.0.1:$webPort"
  $env:BETTER_AUTH_URL = $env:V2_ALPHA8_BASE_URL
  $node = (Get-Command node).Source
  $next = Join-Path (Get-Location) "node_modules\next\dist\bin\next"
  $server = Start-Process -FilePath $node -ArgumentList @($next, "dev", "--hostname", "127.0.0.1", "--port", [string]$webPort) -WorkingDirectory (Get-Location) -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs "next.out.log") -RedirectStandardError (Join-Path $logs "next.err.log") -PassThru
  $ready = $false
  for ($attempt = 0; $attempt -lt 160; $attempt++) {
    if ($server.HasExited) { throw "NEXT_SERVER_EXITED" }
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri ("http://127.0.0.1:{0}/v2-alpha8-local" -f $webPort) -TimeoutSec 1
      if ($response.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
    Start-Sleep -Milliseconds 250
  }
  if (-not $ready) { throw "NEXT_SERVER_TIMEOUT" }
  node --experimental-strip-types --experimental-loader ./scripts/disposable-server-only-loader.mjs scripts/verify-v2-alpha8-browser.mjs
  if ($LASTEXITCODE -ne 0) { throw "BROWSER_TEST_FAILED" }
  $exitCode = 0
} catch {
  Write-Output "V2_ALPHA8_BROWSER=FAIL"
  Write-Output ("FIRST_FAILED_STAGE=" + $_.Exception.Message)
  if (Test-Path -LiteralPath (Join-Path $logs "next.err.log")) { Get-Content -LiteralPath (Join-Path $logs "next.err.log") -Tail 20 }
} finally {
  if ($server) { Stop-ExactProcessTree $server.Id }
  foreach ($name in @("TEST_FIXTURE", "OLD_MIKE_V2_ALPHA8_SYNTHETIC_PRINCIPAL", "OLD_MIKE_V2_ALPHA8_LOCAL_PROTOTYPE", "NEXT_TELEMETRY_DISABLED", "V2_ALPHA8_BASE_URL", "BETTER_AUTH_URL")) { Remove-Item ("Env:" + $name) -ErrorAction SilentlyContinue }
  $cleaned = $false
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    if (-not (Test-Path -LiteralPath $logs)) { $cleaned = $true; break }
    Remove-Item -LiteralPath $logs -Recurse -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 100
  }
  if (-not $cleaned -and (Test-Path -LiteralPath $logs)) { Write-Output "V2_ALPHA8_BROWSER_CLEANUP=FAIL_TEMP_RETAINED"; $exitCode = 2 }
  else { Write-Output "V2_ALPHA8_BROWSER_CLEANUP=PASS_ZERO_TEMP_PROCESS" }
}
exit $exitCode
