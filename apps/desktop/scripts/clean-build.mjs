import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const generatedPaths = [
  path.join(repositoryRoot, "apps", "web", "dist"),
  path.join(repositoryRoot, "apps", "web", "node_modules", ".vite"),
  path.join(repositoryRoot, "apps", "web", "node_modules", ".vite-temp"),
  path.join(repositoryRoot, "release"),
];

for (const generatedPath of generatedPaths) {
  const relativePath = path.relative(repositoryRoot, generatedPath);
  if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Refusing to remove unsafe build path: ${generatedPath}`);
  }
  await rm(generatedPath, { recursive: true, force: true });
  console.log(`Removed ${relativePath}`);
}
