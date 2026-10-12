import { cp, mkdir, rm } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

const sourceDir = ".";
const outputDir = "dist";

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

const excludedEntries = new Set([outputDir, "node_modules", "scripts", "test", "tests", "package.json", "package-lock.json", "README.md", ".gitignore"]);

for (const entry of await readdir(sourceDir, { withFileTypes: true })) {
  if (excludedEntries.has(entry.name)) continue;
  await cp(join(sourceDir, entry.name), join(outputDir, entry.name), {
    recursive: true
  });
}

console.log("AnimeArt Web static build complete.");
