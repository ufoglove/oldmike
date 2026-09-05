import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildRoot = path.join(portalRoot, ".next");

await rm(buildRoot, { recursive: true, force: true });
console.log("cleaned .next build artifact");
