param(
  [Parameter(Mandatory = $true)][ValidatePattern('^[0-9a-f]{32}$')][string]$AttemptId,
  [Parameter(Mandatory = $true)][string]$OwnedRoot,
  [Parameter(Mandatory = $true)][string]$WorkRoot,
  [Parameter(Mandatory = $true)][string]$ObservationReceiptPath,
  [Parameter(Mandatory = $true)][string]$CleanupReceiptPath,
  [Parameter(Mandatory = $true)][string]$InnerOutcomePath,
  [Parameter(Mandatory = $true)][ValidateRange(1024, 65535)][int]$PostgresPort,
  [Parameter(Mandatory = $true)][ValidateRange(1024, 65535)][int]$WebPort,
  [Parameter(Mandatory = $true)][ValidateRange(60000, 1800000)][int]$DeadlineMs,
  [Parameter(Mandatory = $true)][string]$NodePath,
  [Parameter(Mandatory = $true)][ValidatePattern('^[0-9a-f]{64}$')][string]$ExpectedBundleSha256,
  [Parameter(Mandatory = $true)][ValidatePattern('^[0-9a-f]{64}$')][string]$ExpectedEnvironmentFingerprint
)

$ErrorActionPreference = "Stop"
$pgBin = "C:\Program Files\PostgreSQL\18\bin"
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$innerSchema = "old-mike-v2-beta2/product-acceptance-inner-outcome/4"
$cleanupSchema = "old-mike-v2-beta2/product-acceptance-cleanup-receipt/4"
$sharedParserSource = @'
import { readFileSync } from 'node:fs';
import {
  V2_BETA2_PRODUCT_ACCEPTANCE_INNER_OUTCOME_SCHEMA_ID,
  parseV2Beta2ProductAcceptanceBrowserFailureJson,
  parseV2Beta2ProductAcceptanceCleanupReceipt,
  parseV2Beta2ProductAcceptanceObservationReceiptJson,
  parseV2Beta2ProductAcceptanceVerifierResult,
  serializeV2Beta2ProductAcceptanceCleanupReceipt,
  serializeV2Beta2ProductAcceptanceInnerOutcome,
} from './lib/v2-beta2/product-acceptance.ts';
const envelope = JSON.parse(Buffer.from(process.argv[1], 'base64').toString('utf8'));
let value;
if (envelope.kind === 'VERIFIER_RESULT') {
  value = parseV2Beta2ProductAcceptanceVerifierResult(envelope.value);
  process.stdout.write(`${JSON.stringify(value)}\n`);
} else if (envelope.kind === 'OBSERVATION_RECEIPT_PATH') {
  value = parseV2Beta2ProductAcceptanceObservationReceiptJson(readFileSync(envelope.value, 'utf8'));
  process.stdout.write(`${JSON.stringify(value)}\n`);
} else if (envelope.kind === 'BROWSER_FAILURE_RAW') {
  value = parseV2Beta2ProductAcceptanceBrowserFailureJson(envelope.value);
  process.stdout.write(`${JSON.stringify(value)}\n`);
} else if (envelope.kind === 'CLEANUP_RECEIPT') {
  process.stdout.write(serializeV2Beta2ProductAcceptanceCleanupReceipt(parseV2Beta2ProductAcceptanceCleanupReceipt(envelope.value)));
} else if (envelope.kind === 'INNER_PASS') {
  const verifier = parseV2Beta2ProductAcceptanceVerifierResult(envelope.verifierResult);
  if (verifier.status !== 'PASS') throw new Error('beta2_product_acceptance_verifier_result_invalid');
  value = {
    schemaId: V2_BETA2_PRODUCT_ACCEPTANCE_INNER_OUTCOME_SCHEMA_ID,
    status: 'PASS', attemptId: envelope.attemptId, contractId: verifier.contractId,
    runtimeContract: verifier.productContract, environmentFingerprint: envelope.environmentFingerprint,
    acceptanceBundleSha256: verifier.acceptanceBundleSha256, contractFileSha256: verifier.contractFileSha256,
    vectorsFileSha256: verifier.vectorsFileSha256, acceptanceAuthorityAssertions: verifier.assertions,
    observationReceiptAuthority: envelope.observationReceiptAuthority,
    cleanupReceiptAuthority: envelope.cleanupReceiptAuthority,
    databaseObservation: envelope.databaseObservation, counts: envelope.counts,
    externalEffects: envelope.externalEffects,
    protocol: { verifier: 'PASS', database: 'PASS', browser: 'PASS', environment: 'PASS' },
    cleanup: envelope.cleanup, primaryFailure: null, cleanupFailure: null,
  };
  process.stdout.write(serializeV2Beta2ProductAcceptanceInnerOutcome(value));
} else if (envelope.kind === 'INNER_FAILURE') {
  value = {
    schemaId: V2_BETA2_PRODUCT_ACCEPTANCE_INNER_OUTCOME_SCHEMA_ID,
    status: envelope.status, attemptId: envelope.attemptId,
    environmentFingerprint: envelope.environmentFingerprint,
    observationReceiptAuthority: envelope.observationReceiptAuthority,
    cleanupReceiptAuthority: envelope.cleanupReceiptAuthority,
    cleanup: envelope.cleanup, primaryFailure: envelope.primaryFailure, cleanupFailure: envelope.cleanupFailure,
  };
  process.stdout.write(serializeV2Beta2ProductAcceptanceInnerOutcome(value));
} else throw new Error('beta2_product_acceptance_parser_mode_invalid');
'@
$sharedParserArgv = @("--no-warnings", "--experimental-strip-types", "--input-type=module", "--eval", $sharedParserSource)
$verifierArgv = @("--no-warnings", "--experimental-strip-types", "--experimental-loader", "./scripts/disposable-server-only-loader.mjs", "scripts/verify-v2-beta2-product-acceptance.mjs")

function Get-Sha256Hex {
  param([Parameter(Mandatory = $true)][byte[]]$Bytes)
  $algorithm = [Security.Cryptography.SHA256]::Create()
  try { return ([BitConverter]::ToString($algorithm.ComputeHash($Bytes))).Replace("-", "").ToLowerInvariant() }
  finally { $algorithm.Dispose() }
}

function Get-EnvironmentFingerprint {
  $builder = [Text.StringBuilder]::new()
  foreach ($name in @("SystemRoot", "WINDIR", "ComSpec", "PATH", "TEMP", "TMP")) {
    [void]$builder.Append($name); [void]$builder.Append([char]0); [void]$builder.Append([Environment]::GetEnvironmentVariable($name)); [void]$builder.Append("`n")
  }
  return Get-Sha256Hex ([Text.UTF8Encoding]::new($false).GetBytes($builder.ToString()))
}

function Get-SanitizedReasonCode {
  param([Parameter(Mandatory = $true)]$ErrorRecord)
  $candidate = [string]$ErrorRecord.Exception.Message
  if ($candidate -match '^[A-Z][A-Z0-9_]{2,95}$') { return $candidate }
  return "UNEXPECTED_LOCAL_FAILURE"
}

function Invoke-SharedAcceptanceParser {
  param([Parameter(Mandatory = $true)]$Envelope)
  $serialized = ConvertTo-Json -Compress -Depth 60 -InputObject $Envelope
  $encoded = [Convert]::ToBase64String([Text.UTF8Encoding]::new($false).GetBytes($serialized))
  $saved = $ErrorActionPreference; $ErrorActionPreference = "Continue"
  try { $output = @(& $NodePath @sharedParserArgv $encoded 2>$null | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) }); $parserExit = $LASTEXITCODE }
  finally { $ErrorActionPreference = $saved }
  if ($parserExit -ne 0 -or $output.Count -ne 1) { throw "ACCEPTANCE_SHARED_PARSER_FAILED" }
  return [string]$output[0]
}

function Publish-StrictRecord {
  param([Parameter(Mandatory = $true)][string]$Target, [Parameter(Mandatory = $true)][string]$Json)
  if (Test-Path -LiteralPath $Target) { throw "STRICT_RECORD_TARGET_EXISTS" }
  $directory = Split-Path -Parent $Target
  $temporary = Join-Path $directory ((Split-Path -Leaf $Target) + "." + [Guid]::NewGuid().ToString("N") + ".tmp")
  try {
    [IO.File]::WriteAllText($temporary, ($Json.TrimEnd("`r", "`n") + "`n"), [Text.UTF8Encoding]::new($false))
    [IO.File]::Move($temporary, $Target)
  } finally { if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force } }
}

function Get-LeafAuthority {
  param([Parameter(Mandatory = $true)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
  $item = Get-Item -LiteralPath $Path
  return [ordered]@{ path = $item.FullName; size = [int64]$item.Length; sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $item.FullName).Hash.ToLowerInvariant() }
}

function Publish-BuiltinBlockedInner {
  param($Primary, $CleanupFailure, $Cleanup, $ObservationAuthority, $CleanupAuthority)
  if (Test-Path -LiteralPath $InnerOutcomePath) { return }
  if ($null -eq $Primary -and $null -eq $CleanupFailure) { $Primary = [ordered]@{ stage = "RUNNER_TERMINALIZATION"; reasonCode = "RUNNER_BUILTIN_BLOCKED" } }
  $record = [ordered]@{
    schemaId = $innerSchema; status = "BLOCKED"; attemptId = $AttemptId; environmentFingerprint = $ExpectedEnvironmentFingerprint
    observationReceiptAuthority = $ObservationAuthority; cleanupReceiptAuthority = $CleanupAuthority; cleanup = $Cleanup
    primaryFailure = $Primary; cleanupFailure = $CleanupFailure
  }
  Publish-StrictRecord -Target $InnerOutcomePath -Json (ConvertTo-Json -Compress -Depth 20 -InputObject $record)
}

function Test-PortFree {
  param([Parameter(Mandatory = $true)][int]$Port)
  $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Port)
  try { $listener.Start(); return $true } catch { return $false } finally { try { $listener.Stop() } catch {} }
}

$ownedResolved = [IO.Path]::GetFullPath($OwnedRoot)
$workResolved = [IO.Path]::GetFullPath($WorkRoot)
$observationResolved = [IO.Path]::GetFullPath($ObservationReceiptPath)
$cleanupResolved = [IO.Path]::GetFullPath($CleanupReceiptPath)
$outcomeResolved = [IO.Path]::GetFullPath($InnerOutcomePath)
$prefix = $ownedResolved + [IO.Path]::DirectorySeparatorChar
if (-not (Test-Path -LiteralPath $ownedResolved -PathType Container)) { throw "OWNED_ROOT_MISSING" }
$ownedItem = Get-Item -LiteralPath $ownedResolved -Force
if ((($ownedItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) -or (-not ($workResolved.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase))) -or (-not ($observationResolved.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase))) -or (-not ($cleanupResolved.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase))) -or (-not ($outcomeResolved.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase))) -or ($outcomeResolved -ne ([IO.Path]::GetFullPath((Join-Path $ownedResolved "inner-outcome.json"))))) { throw "OWNED_ROOT_CONTAINMENT_INVALID" }
if (-not (Test-Path -LiteralPath $NodePath -PathType Leaf)) { throw "NODE_EXECUTABLE_MISSING" }
$observedEnvironmentFingerprint = Get-EnvironmentFingerprint
if ($observedEnvironmentFingerprint -ne $ExpectedEnvironmentFingerprint) { throw "CHILD_ENVIRONMENT_FINGERPRINT_MISMATCH" }
if (-not $env:TEMP.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase) -or $env:TEMP -ne $env:TMP) { throw "CHILD_TEMP_CONTAINMENT_INVALID" }

$cluster = Join-Path $workResolved "postgres"
$logs = Join-Path $workResolved "logs"
$playwrightOutput = Join-Path $workResolved "playwright-output"
$databaseName = "old_mike_beta2_disposable_$AttemptId"
$stage = "PREFLIGHT"
$started = $false
$verifierReceipt = $null
$observationReceipt = $null
$databaseObservation = $null
$primaryFailure = $null
$cleanupFailure = $null
$cleanupObservation = [ordered]@{ status = "UNKNOWN"; listenerCount = 0; processResidualCount = 0; tempResidualCount = 1 }
$registeredPids = [Collections.Generic.HashSet[int]]::new()
$descendantPids = [Collections.Generic.HashSet[int]]::new()

function Register-Descendants {
  param([Parameter(Mandatory = $true)][int]$RootPid)
  try {
    $processes = @(Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId)
    $frontier = @($RootPid)
    while ($frontier.Count -gt 0) {
      $next = @()
      foreach ($parent in $frontier) {
        foreach ($child in @($processes | Where-Object { [int]$_.ParentProcessId -eq [int]$parent })) {
          if ($descendantPids.Add([int]$child.ProcessId)) { $next += [int]$child.ProcessId }
        }
      }
      $frontier = $next
    }
  } catch {}
}

try {
  $stage = "PREFLIGHT"
  if (Test-Path -LiteralPath $workResolved) { throw "WORK_ROOT_TARGET_EXISTS" }
  foreach ($tool in @("initdb.exe", "pg_ctl.exe", "createdb.exe", "psql.exe")) { if (-not (Test-Path -LiteralPath (Join-Path $pgBin $tool) -PathType Leaf)) { throw "LOCAL_POSTGRESQL18_TOOL_MISSING" } }
  if (-not (Test-Path -LiteralPath $chrome -PathType Leaf)) { throw "LOCAL_CHROME_MISSING" }
  if (@(Get-ChildItem -LiteralPath . -Force -File | Where-Object { $_.Name -match '^\.env(?:\.|$)' -and $_.Name -ne '.env.example' }).Count -ne 0) { throw "ACTIVE_DOTENV_FORBIDDEN" }
  New-Item -ItemType Directory -Path $cluster, $logs, $playwrightOutput | Out-Null

  $stage = "ACCEPTANCE_AUTHORITY"
  $verifierStdout = Join-Path $logs "acceptance-verifier.stdout.log"; $verifierStderr = Join-Path $logs "acceptance-verifier.stderr.log"
  $verifierProcess = Start-Process -FilePath $NodePath -ArgumentList $verifierArgv -WorkingDirectory (Get-Location).Path -RedirectStandardOutput $verifierStdout -RedirectStandardError $verifierStderr -WindowStyle Hidden -PassThru
  [void]$verifierProcess.Handle
  [void]$registeredPids.Add($verifierProcess.Id); $verifierProcess.WaitForExit(); $verifierProcess.Refresh(); Register-Descendants $verifierProcess.Id
  $verifierOutput = @([IO.File]::ReadAllLines($verifierStdout) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  if ($verifierProcess.ExitCode -ne 0) { throw ("ACCEPTANCE_VERIFIER_EXIT_{0}" -f $verifierProcess.ExitCode) }
  if ($verifierOutput.Count -ne 1) { throw ("ACCEPTANCE_VERIFIER_TERMINAL_COUNT_{0}" -f $verifierOutput.Count) }
  try { $verifierValue = $verifierOutput[0] | ConvertFrom-Json } catch { throw "ACCEPTANCE_VERIFIER_TERMINAL_INVALID" }
  $verifierReceipt = (Invoke-SharedAcceptanceParser ([ordered]@{ kind = "VERIFIER_RESULT"; value = $verifierValue })) | ConvertFrom-Json
  if ($verifierReceipt.status -ne "PASS" -or $verifierReceipt.acceptanceBundleSha256 -ne $ExpectedBundleSha256 -or $verifierReceipt.faultMatrixCases -ne 12) { throw "ACCEPTANCE_VERIFIER_FAILED" }

  $stage = "INITDB"
  & (Join-Path $pgBin "initdb.exe") -D $cluster -U postgres -A trust --no-locale *> (Join-Path $logs "initdb.log")
  if ($LASTEXITCODE -ne 0) { throw "INITDB_FAILED" }
  $stage = "POSTGRES_START"
  $start = Start-Process -FilePath (Join-Path $pgBin "pg_ctl.exe") -ArgumentList @("-D", $cluster, "-l", (Join-Path $logs "postgres.log"), "-o", "`"-h 127.0.0.1 -p $PostgresPort`"", "-w", "start") -WindowStyle Hidden -PassThru
  [void]$start.Handle
  [void]$registeredPids.Add($start.Id)
  if (-not $start.WaitForExit(45000)) { throw "POSTGRES_START_TIMEOUT" }
  $start.Refresh()
  if ($start.ExitCode -ne 0) { throw "POSTGRES_START_FAILED" }
  $started = $true
  $postmasterPidPath = Join-Path $cluster "postmaster.pid"
  if (Test-Path -LiteralPath $postmasterPidPath) { [void]$registeredPids.Add([int]([IO.File]::ReadLines($postmasterPidPath) | Select-Object -First 1)) }
  $stage = "DATABASE_CREATE"
  & (Join-Path $pgBin "createdb.exe") -h 127.0.0.1 -p $PostgresPort -U postgres $databaseName *> (Join-Path $logs "createdb.log")
  if ($LASTEXITCODE -ne 0) { throw "DATABASE_CREATE_FAILED" }
  $env:PGOPTIONS = "-c client_min_messages=warning"
  foreach ($ordinal in 1..7) {
    $matches = @(Get-ChildItem -LiteralPath "database\migrations" -Filter (("{0:D4}_*.up.sql" -f $ordinal)) -File)
    if ($matches.Count -ne 1) { throw ("BASELINE_MIGRATION_{0:D4}_AUTHORITY_INVALID" -f $ordinal) }
    & (Join-Path $pgBin "psql.exe") -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $PostgresPort -U postgres -d $databaseName -f $matches[0].FullName *> (Join-Path $logs (("migration-{0:D4}.log" -f $ordinal)))
    if ($LASTEXITCODE -ne 0) { throw "BASELINE_MIGRATION_FAILED" }
  }
  $stage = "BETA2_UP_VERIFY"
  & (Join-Path $pgBin "psql.exe") -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $PostgresPort -U postgres -d $databaseName -f "database\proposals\v2-beta2-durable-core.up.sql" *> (Join-Path $logs "beta2-up.log")
  if ($LASTEXITCODE -ne 0) { throw "BETA2_UP_FAILED" }
  $verifyLog = Join-Path $logs "beta2-verify.log"
  & (Join-Path $pgBin "psql.exe") -X -A -t -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $PostgresPort -U postgres -d $databaseName -f "database\proposals\v2-beta2-durable-core.verify.sql" -o $verifyLog
  if ($LASTEXITCODE -ne 0 -or -not (Select-String -LiteralPath $verifyLog -Pattern '^BETA2_DURABLE_CORE_VERIFY=PASS$' -Quiet)) { throw "BETA2_VERIFY_FAILED" }
  $stage = "RESTRICTED_APP_ROLE"
  & (Join-Path $pgBin "psql.exe") -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $PostgresPort -U postgres -d $databaseName -c "CREATE ROLE old_mike_beta2_app_local LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT; GRANT old_mike_beta2_app TO old_mike_beta2_app_local" *> (Join-Path $logs "restricted-role.log")
  if ($LASTEXITCODE -ne 0) { throw "RESTRICTED_APP_ROLE_FAILED" }

  $env:INTEGRATION_TEST_MODE = "1"; $env:TEST_FIXTURE = "1"
  $env:DATABASE_URL = "postgresql://postgres@127.0.0.1:$PostgresPort/$databaseName`?application_name=old_mike_beta2_disposable"
  $env:BETA2_DISPOSABLE_DATABASE_URL = "postgresql://old_mike_beta2_app_local@127.0.0.1:$PostgresPort/$databaseName`?application_name=old_mike_beta2_disposable"
  $env:BETTER_AUTH_SECRET = "fixture-" + [Guid]::NewGuid().ToString("N") + [Guid]::NewGuid().ToString("N")
  $env:BETA2_E2E_ACTIVE_EMAIL = "beta2-active-$AttemptId@fixture.invalid"; $env:BETA2_E2E_ACTIVE_PASSWORD = "Fixture-" + [Guid]::NewGuid().ToString("N") + "!Aa9"
  $env:BETA2_E2E_DISABLED_EMAIL = "beta2-disabled-$AttemptId@fixture.invalid"; $env:BETA2_E2E_DISABLED_PASSWORD = "Fixture-" + [Guid]::NewGuid().ToString("N") + "!Aa9"
  $env:BETA2_E2E_CHANGE_EMAIL = "beta2-change-$AttemptId@fixture.invalid"; $env:BETA2_E2E_CHANGE_PASSWORD = "Fixture-" + [Guid]::NewGuid().ToString("N") + "!Aa9"
  $env:NODE_NO_WARNINGS = "1"; $env:BETA2_ACCEPTANCE_ATTEMPT_ID = $AttemptId; $env:BETA2_ACCEPTANCE_OBSERVATION_PATH = $observationResolved

  $stage = "REAL_LOCAL_AUTH_SEED"
  $seed = & $NodePath --experimental-strip-types --experimental-loader ./scripts/disposable-server-only-loader.mjs scripts/setup-v2-beta2-a1-c1-browser-fixture.mjs 2> (Join-Path $logs "seed.stderr.log")
  if ($LASTEXITCODE -ne 0 -or (($seed | Select-Object -Last 1 | ConvertFrom-Json).status -ne "PASS")) { throw "REAL_LOCAL_AUTH_SEED_FAILED" }

  $stage = "PRODUCT_PLAYWRIGHT"
  $env:BETA2_PLAYWRIGHT_PORT = [string]$WebPort; $env:BETA2_PLAYWRIGHT_OUTPUT_DIR = $playwrightOutput; $env:PLAYWRIGHT_CHROME_PATH = $chrome
  $playwrightStdout = Join-Path $logs "playwright.stdout.log"; $playwrightStderr = Join-Path $logs "playwright.stderr.log"
  $browserFailurePath = Join-Path $ownedResolved "browser-failure.json"
  $playwright = Start-Process -FilePath $NodePath -ArgumentList @("node_modules/@playwright/test/cli.js", "test", "e2e/v2-beta2-product-acceptance.spec.ts", "--config", "playwright.beta2.config.ts") -WorkingDirectory (Get-Location).Path -RedirectStandardOutput $playwrightStdout -RedirectStandardError $playwrightStderr -WindowStyle Hidden -PassThru
  [void]$playwright.Handle
  [void]$registeredPids.Add($playwright.Id)
  $clock = [Diagnostics.Stopwatch]::StartNew()
  while (-not $playwright.WaitForExit(250)) { Register-Descendants $playwright.Id; if ($clock.ElapsedMilliseconds -gt $DeadlineMs) { & taskkill.exe /PID $playwright.Id /T /F *> $null; throw "PRODUCT_PLAYWRIGHT_TIMEOUT" } }
  $playwright.Refresh()
  Register-Descendants $playwright.Id
  if ($playwright.ExitCode -ne 0) {
    if (Test-Path -LiteralPath $browserFailurePath -PathType Leaf) {
      $browserFailure = (Invoke-SharedAcceptanceParser ([ordered]@{ kind = "BROWSER_FAILURE_RAW"; value = [IO.File]::ReadAllText($browserFailurePath) })) | ConvertFrom-Json
      if ($browserFailure.attemptId -ne $AttemptId -or $browserFailure.stage -ne "PRODUCT_PLAYWRIGHT") { throw "PRODUCT_PLAYWRIGHT_FAILURE_RECEIPT_MISMATCH" }
      throw $browserFailure.reasonCode
    }
    throw "PRODUCT_PLAYWRIGHT_FAILED_NO_FAILURE_RECEIPT"
  }

  $stage = "OBSERVATION_RECEIPT"
  if (-not (Test-Path -LiteralPath $observationResolved -PathType Leaf)) { throw "OBSERVATION_RECEIPT_MISSING" }
  $observationReceipt = (Invoke-SharedAcceptanceParser ([ordered]@{ kind = "OBSERVATION_RECEIPT_PATH"; value = $observationResolved })) | ConvertFrom-Json
  if ($observationReceipt.status -ne "PASS" -or $observationReceipt.attemptId -ne $AttemptId) { throw "OBSERVATION_RECEIPT_INVALID" }

  $stage = "DATABASE_PARITY"
  $authority = & (Join-Path $pgBin "psql.exe") -X -A -t -F "," -h 127.0.0.1 -p $PostgresPort -U postgres -d $databaseName -c "SELECT (SELECT count(*) FROM beta2_generation_jobs),(SELECT count(*) FROM beta2_generation_jobs WHERE provider_submission_count=1),(SELECT count(*) FROM beta2_project_snapshots),(SELECT count(*) FROM beta2_project_events),(SELECT count(*) FROM research_documents)+(SELECT count(*) FROM research_studies)+(SELECT count(*) FROM research_human_gates)"
  $values = @(($authority | Select-Object -Last 1).Trim().Split(",") | ForEach-Object { [int]$_ })
  if ($values.Count -ne 5) { throw "DATABASE_OBSERVATION_INVALID" }
  $databaseObservation = [ordered]@{ jobs = $values[0]; providerSubmissions = $values[1]; snapshots = $values[2]; events = $values[3]; formalResearchWrites = $values[4] }
  if ($databaseObservation.providerSubmissions -ne $observationReceipt.counters.providerSubmissions -or $databaseObservation.snapshots -ne $observationReceipt.counters.snapshots -or $databaseObservation.events -ne $observationReceipt.counters.events -or $databaseObservation.formalResearchWrites -ne $observationReceipt.counters.formalResearchWrites) { throw "OBSERVATION_DATABASE_PARITY_MISMATCH" }

  $stage = "DOWN_BOUNDARY"
  $saved = $ErrorActionPreference; $ErrorActionPreference = "Continue"
  try { & (Join-Path $pgBin "psql.exe") -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $PostgresPort -U postgres -d $databaseName -f "database\proposals\v2-beta2-durable-core.down.sql" *> (Join-Path $logs "down-refusal.log"); $downRefusalExit = $LASTEXITCODE }
  finally { $ErrorActionPreference = $saved }
  if ($downRefusalExit -eq 0) { throw "DOWN_DID_NOT_REFUSE_NONEMPTY" }
  & (Join-Path $pgBin "psql.exe") -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $PostgresPort -U postgres -d $databaseName -c "TRUNCATE beta2_operation_intents, beta2_project_events, beta2_project_snapshots, beta2_generation_receipts, beta2_generation_jobs" *> (Join-Path $logs "truncate.log")
  if ($LASTEXITCODE -ne 0) { throw "DISPOSABLE_ROW_CLEANUP_FAILED" }
  & (Join-Path $pgBin "psql.exe") -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $PostgresPort -U postgres -d $databaseName -f "database\proposals\v2-beta2-durable-core.down.sql" *> (Join-Path $logs "down-empty.log")
  if ($LASTEXITCODE -ne 0) { throw "DOWN_EMPTY_FAILED" }
} catch {
  if ($null -eq $primaryFailure) { $primaryFailure = [ordered]@{ stage = $stage; reasonCode = Get-SanitizedReasonCode $_ } }
} finally {
  try {
    foreach ($name in @("BETA2_DISPOSABLE_DATABASE_URL", "BETA2_PLAYWRIGHT_PORT", "BETA2_PLAYWRIGHT_OUTPUT_DIR", "PLAYWRIGHT_CHROME_PATH", "BETA2_ACCEPTANCE_ATTEMPT_ID", "BETA2_ACCEPTANCE_OBSERVATION_PATH", "NODE_NO_WARNINGS", "DATABASE_URL", "BETTER_AUTH_SECRET", "BETA2_E2E_ACTIVE_EMAIL", "BETA2_E2E_ACTIVE_PASSWORD", "BETA2_E2E_DISABLED_EMAIL", "BETA2_E2E_DISABLED_PASSWORD", "BETA2_E2E_CHANGE_EMAIL", "BETA2_E2E_CHANGE_PASSWORD", "INTEGRATION_TEST_MODE", "TEST_FIXTURE", "PGOPTIONS")) { Remove-Item -LiteralPath ("Env:" + $name) -ErrorAction SilentlyContinue }
    if ($started) { & (Join-Path $pgBin "pg_ctl.exe") -D $cluster -m fast -w stop *> (Join-Path $logs "stop.log") }
    if (Test-Path -LiteralPath $workResolved) {
      $item = Get-Item -LiteralPath $workResolved -Force
      if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or -not $item.FullName.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw "CLEANUP_CONTAINMENT_INVALID" }
      Remove-Item -LiteralPath $item.FullName -Recurse -Force
    }
    if (Test-Path -LiteralPath $env:TEMP) { $tempItem = Get-Item -LiteralPath $env:TEMP -Force; if (-not $tempItem.FullName.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw "CLEANUP_TEMP_CONTAINMENT_INVALID" }; Remove-Item -LiteralPath $tempItem.FullName -Recurse -Force }
    $allObserved = @($registeredPids) + @($descendantPids)
    $residualPids = @($allObserved | Sort-Object -Unique | Where-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue })
    $listenerCount = @(@($PostgresPort, $WebPort) | Where-Object { -not (Test-PortFree $_) }).Count
    $tempResidualCount = [int](Test-Path -LiteralPath $workResolved) + [int](Test-Path -LiteralPath $env:TEMP)
    if ($listenerCount -ne 0 -or $residualPids.Count -ne 0 -or $tempResidualCount -ne 0) { throw "CLEANUP_RESIDUAL" }
    $inventory = @(Get-ChildItem -LiteralPath $ownedResolved -Force | ForEach-Object { $_.Name } | Sort-Object)
    $cleanupRecord = [ordered]@{ schemaId = $cleanupSchema; status = "PASS"; attemptId = $AttemptId; environmentFingerprint = $observedEnvironmentFingerprint; registeredPids = @($registeredPids | Sort-Object); descendantPids = @($descendantPids | Sort-Object); listenerPorts = @($PostgresPort, $WebPort); ownedRootInventory = $inventory; listenerCount = 0; processResidualCount = 0; tempResidualCount = 0 }
    $cleanupJson = Invoke-SharedAcceptanceParser ([ordered]@{ kind = "CLEANUP_RECEIPT"; value = $cleanupRecord })
    Publish-StrictRecord -Target $cleanupResolved -Json $cleanupJson
    $cleanupObservation = [ordered]@{ status = "PASS"; listenerCount = 0; processResidualCount = 0; tempResidualCount = 0 }
  } catch {
    $cleanupFailure = [ordered]@{ stage = "CLEANUP"; reasonCode = Get-SanitizedReasonCode $_ }
    $cleanupObservation = [ordered]@{ status = "FAIL"; listenerCount = 0; processResidualCount = 0; tempResidualCount = 1 }
  }
}

$observationAuthority = Get-LeafAuthority $observationResolved
$cleanupAuthority = Get-LeafAuthority $cleanupResolved
try {
  if ($null -eq $primaryFailure -and $null -eq $cleanupFailure) {
    if ($null -eq $verifierReceipt -or $null -eq $observationReceipt -or $null -eq $databaseObservation -or $null -eq $observationAuthority -or $null -eq $cleanupAuthority) { throw "RUNNER_RECEIPT_EVIDENCE_MISSING" }
    $inner = Invoke-SharedAcceptanceParser ([ordered]@{ kind = "INNER_PASS"; attemptId = $AttemptId; environmentFingerprint = $observedEnvironmentFingerprint; verifierResult = $verifierReceipt; observationReceiptAuthority = $observationAuthority; cleanupReceiptAuthority = $cleanupAuthority; databaseObservation = $databaseObservation; counts = $observationReceipt.counters; externalEffects = $observationReceipt.externalEffects; cleanup = $cleanupObservation })
    Publish-StrictRecord -Target $outcomeResolved -Json $inner
    exit 0
  }
  $status = if ($null -eq $cleanupFailure -and $cleanupObservation.status -eq "PASS") { "FAIL" } else { "BLOCKED" }
  $inner = Invoke-SharedAcceptanceParser ([ordered]@{ kind = "INNER_FAILURE"; status = $status; attemptId = $AttemptId; environmentFingerprint = $observedEnvironmentFingerprint; observationReceiptAuthority = $observationAuthority; cleanupReceiptAuthority = $cleanupAuthority; cleanup = $cleanupObservation; primaryFailure = $primaryFailure; cleanupFailure = $cleanupFailure })
  Publish-StrictRecord -Target $outcomeResolved -Json $inner
  if ($status -eq "FAIL") { exit 1 }; exit 2
} catch {
  $terminalizationFailure = [ordered]@{ stage = "RUNNER_TERMINALIZATION"; reasonCode = Get-SanitizedReasonCode $_ }
  try { Publish-BuiltinBlockedInner -Primary $(if ($null -ne $primaryFailure) { $primaryFailure } else { $terminalizationFailure }) -CleanupFailure $cleanupFailure -Cleanup $cleanupObservation -ObservationAuthority $observationAuthority -CleanupAuthority $cleanupAuthority } catch {}
  exit 2
}
