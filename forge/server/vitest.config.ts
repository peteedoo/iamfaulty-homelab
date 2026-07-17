import { defineConfig } from "vitest/config";

// The server sources are authored as ESM with NodeNext resolution, so relative
// imports carry explicit ".js" extensions that actually point at ".ts" files.
// Vite's default resolver does not rewrite those, so this plugin maps a relative
// "*.js" specifier to its "*.ts" sibling when the .ts file exists.
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

function resolveTsJsImports() {
  return {
    name: "resolve-ts-js-imports",
    enforce: "pre" as const,
    resolveId(source: string, importer: string | undefined) {
      if (!importer) return null;
      if (!source.startsWith(".") || !source.endsWith(".js")) return null;
      const tsCandidate = resolve(dirname(importer), source.replace(/\.js$/, ".ts"));
      if (existsSync(tsCandidate)) return tsCandidate;
      return null;
    },
  };
}

export default defineConfig({
  plugins: [resolveTsJsImports()],
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.{test,spec}.ts",
        "src/index.ts",
        // Type-only module (interfaces/types) — no runtime code to cover.
        "src/providers/types.ts",
      ],
    },
  },
});
