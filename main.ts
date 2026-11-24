import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Pickup line runner, revised edition.
//
// Behaviour (unchanged): read the single pickup line from line.txt next to
// this file, make sure it is exactly one non-blank line of 1-200
// characters, and write it to entry.txt inside the output directory
// ($MAKEFUN_OUTPUT_DIR, falling back to /output).
//
// What is different from the first version:
//   * The source is decoded as strict UTF-8 (a fatal TextDecoder), so a
//     malformed byte sequence fails loudly instead of silently turning
//     into replacement characters.
//   * Line splitting is done by cutting on any line ending and then
//     checking the segment count, instead of normalising newlines and
//     searching for a leftover "\n".
//   * Length is counted in grapheme clusters (Intl.Segmenter), so a
//     combined character such as an emoji with a modifier counts as the
//     one visible character it is, not as several code points.
//   * Correctness of the write is proven by hashing: after writing
//     entry.txt we read it back and compare its SHA-256 digest with the
//     digest of the source line, instead of trusting the write call.
//   * The output directory is only ever created, never removed, so a
//     mounted /output volume is left intact.

const MAX_CHARS = 200;

function digest(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function readSingleLine(filePath: string): string {
  const bytes = readFileSync(filePath);
  const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const segments = decoded.split(/\r\n|\r|\n/);
  // A trailing newline leaves one empty segment behind; drop exactly that.
  if (segments.length > 0 && segments[segments.length - 1] === "") {
    segments.pop();
  }
  if (segments.length === 0 || segments[0].trim() === "") {
    throw new Error("line.txt is empty or holds only whitespace");
  }
  if (segments.length !== 1) {
    throw new Error(
      `line.txt must hold exactly one line, but it holds ${segments.length}`,
    );
  }
  return segments[0];
}

function countGraphemes(text: string): number {
  const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
  let total = 0;
  for (const _segment of segmenter.segment(text)) total += 1;
  return total;
}

function checkedLine(filePath: string): { text: string; chars: number } {
  const text = readSingleLine(filePath);
  const chars = countGraphemes(text);
  if (chars < 1 || chars > MAX_CHARS) {
    throw new Error(
      `pickup line is ${chars} graphemes; it must be 1-${MAX_CHARS}`,
    );
  }
  return { text, chars };
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const { text: pickupLine, chars } = checkedLine(join(scriptDir, "line.txt"));

const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
mkdirSync(outputDir, { recursive: true });
const entryPath = join(outputDir, "entry.txt");
writeFileSync(entryPath, pickupLine, { encoding: "utf8" });

// Read the file back and prove, by hash, that what landed on disk is
// exactly the validated line — a write that silently truncated or
// re-encoded the text cannot slip through.
const writtenBack = readFileSync(entryPath, "utf8");
if (digest(writtenBack) !== digest(pickupLine)) {
  throw new Error("entry.txt failed its integrity check: hash mismatch");
}

console.log(
  `wrote ${chars} characters to ${entryPath} ` +
    `(sha256 ${digest(pickupLine).slice(0, 16)}…)`,
);
