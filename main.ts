import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Reads the pickup line from line.txt next to this script, checks it is a
// single non-blank line of 1-200 characters, and writes it to entry.txt in
// the output directory (MAKEFUN_OUTPUT_DIR, or /output by default).

const scriptDir = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(scriptDir, "line.txt");

const raw = readFileSync(sourcePath, "utf8");
const normalized = raw.replace(/\r\n?/g, "\n");
const line = normalized.endsWith("\n")
  ? normalized.slice(0, -1)
  : normalized;

if (line.length === 0 || line.trim().length === 0) {
  throw new Error("line.txt holds no pickup line: the text is empty or only whitespace");
}
if (line.includes("\n")) {
  throw new Error("line.txt must hold exactly one line, but it holds more");
}
const length = [...line].length;
if (length < 1 || length > 200) {
  throw new Error(`pickup line is ${length} characters; it must be 1-200`);
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "entry.txt");
writeFileSync(outPath, line, "utf8");
console.log(`wrote ${length} characters to ${outPath}`);
