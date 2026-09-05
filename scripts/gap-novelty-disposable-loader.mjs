import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export default {};", shortCircuit: true };
  if (specifier === "next/server") {
    return { url: pathToFileURL(path.join(root, "node_modules", "next", "server.js")).href, shortCircuit: true };
  }
  if (specifier.startsWith("@/")) {
    const base = path.join(root, specifier.slice(2));
    const target = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`].find(existsSync);
    if (!target) throw new Error("gap_novelty_alias_target_missing");
    return { url: pathToFileURL(target).href, shortCircuit: true };
  }
  if (specifier.startsWith(".") && !path.extname(specifier) && context.parentURL?.startsWith("file:")) {
    const base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    const target = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`].find(existsSync);
    if (target) return { url: pathToFileURL(target).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
