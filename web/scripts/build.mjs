import { cp, mkdir, rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await cp(".", "dist", {
  recursive: true,
  filter: source => !source.includes("/dist") && !source.includes("/node_modules")
});
console.log("AnimeArt Web static build complete.");
