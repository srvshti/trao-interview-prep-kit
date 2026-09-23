import { readFile, writeFile } from "node:fs/promises";
import { createKit } from "../src/core.mjs";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

const inputPath = argument("--input");
const outputPath = argument("--output");
if (!inputPath || !outputPath) {
  console.error("Usage: npm run evaluate -- --input <cases.json> --output <kits.json>");
  process.exit(1);
}

const cases = JSON.parse(await readFile(inputPath, "utf8"));
if (!Array.isArray(cases)) throw new Error("input must be a JSON array");

const kits = cases.map((entry) => {
  try {
    return { id: entry.id, status: "ok", kit: createKit(entry), error: null };
  } catch (error) {
    return {
      id: entry.id,
      status: "failed",
      kit: null,
      error: { code: "KIT_GENERATION_FAILED", message: error instanceof Error ? error.message : "Unknown error" }
    };
  }
});

await writeFile(outputPath, JSON.stringify({ version: "1.0", generated_at: new Date().toISOString(), kits }, null, 2));
