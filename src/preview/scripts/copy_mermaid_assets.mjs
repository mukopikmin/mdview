import { cp, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const previewRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceRoot = resolve(previewRoot, "node_modules", "mermaid", "dist");
const destinationRoot = resolve(previewRoot, "dist");

const requiredAssets = ["mermaid.esm.min.mjs", "chunks/mermaid.esm.min"];

await mkdir(destinationRoot, { recursive: true });

for (const relativePath of requiredAssets) {
  await cp(
    resolve(sourceRoot, relativePath),
    resolve(destinationRoot, relativePath),
    { force: true, recursive: true },
  );
}
