$ErrorActionPreference = "Stop"

$pgBin = "C:\Program Files\PostgreSQL\18\bin"
$workspaceRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$portalZip = Join-Path $workspaceRoot ".release-v1.5.14-final\Old_Mike_Research_Portal_v1.5.14.zip"
$expectedHash = "a378889c486e08fc0acaf3f48eb547623f6c653edede99a2889828295672f56a"
if (-not (Test-Path -LiteralPath $portalZip) -or (Get-FileHash -Algorithm SHA256 -LiteralPath $portalZip).Hash.ToLowerInvariant() -ne $expectedHash) {
  Write-Output "N_MINUS_ONE_V1514_ARTIFACT=FAIL"
  exit 2
}

$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$cluster = Join-Path $tempBase ("oldmike-v1514-on-0006-" + [Guid]::NewGuid().ToString("N"))
$extract = Join-Path $tempBase ("oldmike-v1514-extract-" + [Guid]::NewGuid().ToString("N"))
$logs = Join-Path $tempBase ("oldmike-v1514-on-0006-logs-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $cluster, $extract, $logs | Out-Null
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
$listener.Start(); $port = ([Net.IPEndPoint]$listener.LocalEndpoint).Port; $listener.Stop()
$started = $false
$code = 2
try {
  Expand-Archive -LiteralPath $portalZip -DestinationPath $extract
  $package = Get-Content -Raw -LiteralPath (Join-Path $extract "package.json") | ConvertFrom-Json
  if ($package.version -ne "1.5.14") { throw "N_MINUS_ONE_VERSION_MISMATCH" }
  Push-Location $extract
  try {
    pnpm install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) { throw "N_MINUS_ONE_FROZEN_INSTALL_FAILED" }
    pnpm build
    if ($LASTEXITCODE -ne 0) { throw "N_MINUS_ONE_BUILD_FAILED" }
  } finally { Pop-Location }

  & (Join-Path $pgBin "initdb.exe") -D $cluster -U postgres -A trust --no-locale *> (Join-Path $logs "initdb.log")
  if ($LASTEXITCODE -ne 0) { throw "INITDB_FAILED" }
  $server = Start-Process -FilePath (Join-Path $pgBin "pg_ctl.exe") -ArgumentList @("-D", $cluster, "-l", (Join-Path $logs "postgres.log"), "-o", "`"-h 127.0.0.1 -p $port`"", "-w", "start") -WindowStyle Hidden -PassThru
  if (-not $server.WaitForExit(30000) -or $server.ExitCode -ne 0) { throw "POSTGRES_START_FAILED" }
  $started = $true
  & (Join-Path $pgBin "createdb.exe") -h 127.0.0.1 -p $port -U postgres oldmike_n_minus_one *> (Join-Path $logs "createdb.log")
  if ($LASTEXITCODE -ne 0) { throw "CREATE_DATABASE_FAILED" }
  $env:INTEGRATION_DATABASE_URL = "postgresql://postgres@127.0.0.1:$port/oldmike_n_minus_one"
  $env:INTEGRATION_DATABASE_DISPOSABLE = "1"
  $env:N_MINUS_ONE_PORTAL_ROOT = $extract
  node scripts/verify-n-minus-one-v1514-on-0006.mjs
  $code = $LASTEXITCODE
} catch {
  Write-Output "N_MINUS_ONE_V1514_ON_0006=FAIL"
  $code = 2
} finally {
  Remove-Item Env:INTEGRATION_DATABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:INTEGRATION_DATABASE_DISPOSABLE -ErrorAction SilentlyContinue
  Remove-Item Env:N_MINUS_ONE_PORTAL_ROOT -ErrorAction SilentlyContinue
  if ($started) { & (Join-Path $pgBin "pg_ctl.exe") -D $cluster -m fast -w stop *> (Join-Path $logs "stop.log") }
  foreach ($target in @($cluster, $extract, $logs)) {
    $resolved = [IO.Path]::GetFullPath($target)
    if (-not $resolved.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($resolved) -notlike "oldmike-*") { throw "TEMP_SCOPE_INVALID" }
    if (Test-Path -LiteralPath $resolved) { Remove-Item -LiteralPath $resolved -Recurse -Force }
  }
}
exit $code
