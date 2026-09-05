$ErrorActionPreference = "Stop"

function Resolve-PhysicalDirectory([string]$LiteralPath) {
  $cursor = Get-Item -LiteralPath ([IO.Path]::GetFullPath($LiteralPath))
  $tail = [Collections.Generic.List[string]]::new()
  while ($null -ne $cursor) {
    if (($cursor.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      $target = @($cursor.Target)[0]
      if (-not [IO.Path]::IsPathRooted($target)) { $target = Join-Path $cursor.Parent.FullName $target }
      $physical = [IO.Path]::GetFullPath($target)
      foreach ($segment in $tail) { $physical = Join-Path $physical $segment }
      return [IO.Path]::GetFullPath($physical)
    }
    $tail.Insert(0, $cursor.Name)
    $cursor = $cursor.Parent
  }
  return [IO.Path]::GetFullPath($LiteralPath)
}

$portalRoot = Resolve-PhysicalDirectory (Join-Path $PSScriptRoot "..")
$temporaryRoot = Join-Path ([IO.Path]::GetFullPath([IO.Path]::GetTempPath())) ("oldmike-v2-alpha9-browser-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $temporaryRoot | Out-Null

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
      if ($process.ParentProcessId -eq $ids[$index] -and -not $ids.Contains([int]$process.ProcessId)) {
        $ids.Add([int]$process.ProcessId)
      }
    }
  }
  for ($index = $ids.Count - 1; $index -ge 0; $index--) {
    Stop-Process -Id $ids[$index] -Force -ErrorAction SilentlyContinue
  }
}

$environmentNames = @(
  "TEST_FIXTURE",
  "OLD_MIKE_V2_ALPHA9_SYNTHETIC_PRINCIPAL",
  "OLD_MIKE_V2_ALPHA9_LOCAL_PROTOTYPE",
  "NEXT_TELEMETRY_DISABLED",
  "V2_ALPHA9_BASE_URL",
  "BETTER_AUTH_URL"
)
$priorEnvironment = @{}
foreach ($name in $environmentNames) {
  $item = Get-Item -LiteralPath ("Env:" + $name) -ErrorAction SilentlyContinue
  if ($null -ne $item) { $priorEnvironment[$name] = $item.Value }
}

$webPort = Get-FreePort
$server = $null
$exitCode = 2
try {
  $env:TEST_FIXTURE = "1"
  $env:OLD_MIKE_V2_ALPHA9_SYNTHETIC_PRINCIPAL = "1"
  $env:OLD_MIKE_V2_ALPHA9_LOCAL_PROTOTYPE = "1"
  $env:NEXT_TELEMETRY_DISABLED = "1"
  $env:V2_ALPHA9_BASE_URL = "http://127.0.0.1:$webPort"
  $env:BETTER_AUTH_URL = $env:V2_ALPHA9_BASE_URL

  $nodePath = (Get-Command node).Source
  $nextPath = Join-Path $portalRoot "node_modules\next\dist\bin\next"
  if (-not (Test-Path -LiteralPath $nextPath -PathType Leaf)) { throw "NEXT_BINARY_MISSING" }

  $server = Start-Process -FilePath $nodePath -ArgumentList @($nextPath, "dev", "--hostname", "127.0.0.1", "--port", [string]$webPort) -WorkingDirectory $portalRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $temporaryRoot "next.out.log") -RedirectStandardError (Join-Path $temporaryRoot "next.err.log") -PassThru
  $ready = $false
  for ($attempt = 0; $attempt -lt 200; $attempt++) {
    if ($server.HasExited) { throw "NEXT_SERVER_EXITED" }
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri ("http://127.0.0.1:{0}/v2-alpha9-local" -f $webPort) -TimeoutSec 1
      if ($response.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
    Start-Sleep -Milliseconds 250
  }
  if (-not $ready) { throw "NEXT_SERVER_TIMEOUT" }

  Push-Location $portalRoot
  try {
    & $nodePath --experimental-strip-types --experimental-loader ./scripts/disposable-server-only-loader.mjs ./scripts/verify-v2-alpha9-browser.mjs
    if ($LASTEXITCODE -ne 0) { throw "BROWSER_TEST_FAILED" }
  } finally {
    Pop-Location
  }
  $exitCode = 0
} catch {
  Write-Output "V2_ALPHA9_BROWSER=FAIL"
  Write-Output ("FIRST_FAILED_STAGE=" + $_.Exception.Message)
  $errorLog = Join-Path $temporaryRoot "next.err.log"
  if (Test-Path -LiteralPath $errorLog -PathType Leaf) { Get-Content -LiteralPath $errorLog -Tail 30 }
} finally {
  if ($null -ne $server) { Stop-ExactProcessTree $server.Id }
  foreach ($name in $environmentNames) {
    if ($priorEnvironment.ContainsKey($name)) { Set-Item -LiteralPath ("Env:" + $name) -Value $priorEnvironment[$name] }
    else { Remove-Item -LiteralPath ("Env:" + $name) -ErrorAction SilentlyContinue }
  }

  $cleaned = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    if (-not (Test-Path -LiteralPath $temporaryRoot)) { $cleaned = $true; break }
    Remove-Item -LiteralPath $temporaryRoot -Recurse -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 100
  }
  if (-not $cleaned -and (Test-Path -LiteralPath $temporaryRoot)) {
    Write-Output "V2_ALPHA9_BROWSER_CLEANUP=FAIL_TEMP_RETAINED"
    $exitCode = 2
  } else {
    Write-Output "V2_ALPHA9_BROWSER_CLEANUP=PASS_ZERO_TEMP_PROCESS"
  }
}
exit $exitCode
