import path from "node:path";

export function hasNoGroupOrOtherWrite(mode, platform = process.platform) {
  return platform === "win32" || (Number.isInteger(mode) && (mode & 0o022) === 0);
}

export function packagedArtifactIntegrity({
  expectedPath,
  actualPath,
  info,
  canonicalPath,
  expectedSha256,
  actualSha256,
  parentChain = [],
  platform = process.platform,
}) {
  const resolvedExpected = path.resolve(expectedPath);
  const resolvedActual = path.resolve(actualPath);
  return resolvedActual === resolvedExpected &&
    Boolean(info?.isFile && !info.isSymbolicLink && info.nlink === 1) &&
    hasNoGroupOrOtherWrite(info?.mode, platform) &&
    canonicalPath === resolvedExpected &&
    actualSha256 === expectedSha256 &&
    parentChain.every((parent) =>
      Boolean(parent?.isDirectory && !parent.isSymbolicLink) &&
      hasNoGroupOrOtherWrite(parent?.mode, platform));
}

export function runtimePrivateDirectoryIntegrity({
  runtimeUid,
  expectedPath,
  info,
  canonicalPath,
}) {
  return resolvedPathMatches(expectedPath, canonicalPath) &&
    Boolean(info?.isDirectory && !info.isSymbolicLink) &&
    info.uid === runtimeUid &&
    info.mode === 0o700;
}

export function runtimePrivateOutputIntegrity({
  runtimeUid,
  privateDirectory,
  expectedPath,
  info,
  canonicalPath,
  expectedSha256,
  actualSha256,
}) {
  const resolvedExpected = path.resolve(expectedPath);
  const resolvedDirectory = path.resolve(privateDirectory);
  const relative = path.relative(resolvedDirectory, canonicalPath || "");
  return resolvedPathMatches(expectedPath, canonicalPath) &&
    Boolean(info?.isFile && !info.isSymbolicLink && info.nlink === 1) &&
    info.uid === runtimeUid &&
    info.mode === 0o600 &&
    relative !== "" &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative) &&
    actualSha256 === expectedSha256 &&
    path.dirname(resolvedExpected) === resolvedDirectory;
}

function resolvedPathMatches(expectedPath, canonicalPath) {
  return path.resolve(expectedPath) === path.resolve(canonicalPath || "");
}
