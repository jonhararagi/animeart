import { cp, mkdir, rm } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

const sourceDir = ".";
const outputDir = "dist";

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

for (const entry of await readdir(sourceDir, { withFileTypes: true })) {
  if (entry.name === outputDir || entry.name === "node_modules") continue;
  await cp(join(sourceDir, entry.name), join(outputDir, entry.name), {
    recursive: true
  });
}

console.log("AnimeArt Web static build complete.");
