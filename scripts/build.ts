import { build } from "esbuild";
import { build as viteBuild } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { mkdir, copyFile, writeFile } from "node:fs/promises";
await build({
  entryPoints: {
    "server/main": "apps/server/src/main.ts",
    "server/cli": "apps/server/src/cli.ts",
    "mcp/index": "apps/mcp/src/index.ts",
    "pi-extension/index": "apps/pi-extension/index.ts",
  },
  outdir: "dist",
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  packages: "external",
  sourcemap: true,
});
await viteBuild({
  root: "apps/web",
  plugins: [react(), tailwind()],
  build: {
    outDir: "../../dist/web",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("codemirror") || id.includes("@lezer"))
            return "editor";
        },
      },
    },
  },
});
await mkdir("dist/pi-extension", { recursive: true });
await writeFile(
  "dist/pi-extension/package.json",
  JSON.stringify({
    name: "jev-workbench-pi",
    version: "0.1.0",
    type: "module",
    pi: { extensions: ["./index.js"] },
    dependencies: { "@sinclair/typebox": "0.34.52" },
  }),
);
