import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

export function findBash() {
  if (process.env.BASH_EXECUTABLE && existsSync(process.env.BASH_EXECUTABLE)) return process.env.BASH_EXECUTABLE;
  if (process.platform !== "win32" && existsSync("/bin/bash")) return "/bin/bash";
  const git = spawnSync("where.exe", ["git.exe"], { encoding: "utf8", windowsHide: true });
  for (const executable of (git.stdout ?? "").split(/\r?\n/).filter(Boolean)) {
    const candidate = path.resolve(path.dirname(executable.trim()), "..", "usr", "bin", "sh.exe");
    if (existsSync(candidate)) return candidate;
  }
  return "";
}

export function findPtyPython() {
  if (process.env.PTY_PYTHON && existsSync(process.env.PTY_PYTHON)) return process.env.PTY_PYTHON;
  if (process.platform !== "win32") {
    for (const name of ["python3", "python"]) {
      const result = spawnSync(name, ["-c", "import pty"], { stdio: "ignore", windowsHide: true });
      if (result.status === 0) return name;
    }
    return "";
  }
  const candidates = [
    "C:\\Program Files\\PostgreSQL\\18\\pgAdmin 4\\python\\python.exe",
    "python.exe",
  ];
  for (const candidate of candidates) {
    if (path.isAbsolute(candidate) && !existsSync(candidate)) continue;
    const result = spawnSync(candidate, ["-c", "import winpty"], { stdio: "ignore", windowsHide: true });
    if (result.status === 0) return candidate;
  }
  return "";
}

export function shellPath(value) {
  if (process.platform !== "win32") return value;
  const normalized = value.replaceAll("\\", "/");
  const drive = /^([A-Za-z]):\/(.*)$/.exec(normalized);
  return drive ? `/${drive[1].toLowerCase()}/${drive[2]}` : normalized;
}
