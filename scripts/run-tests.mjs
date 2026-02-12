import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const outDir = path.join(root, ".codex-tests");
const entries = [
  path.join(root, "tests/rule-manager.test.ts"),
  path.join(root, "tests/bridge-contract.test.ts"),
  path.join(root, "tests/legacy-modal-bridge-contract.test.ts"),
  path.join(root, "tests/i18n-contract.test.ts"),
];

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

function resolveSourceWithExtension(basePath) {
  const candidates = [
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.mjs`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
    path.join(basePath, "index.js"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return basePath;
}

for (const entry of entries) {
  const outFile = path.join(
    outDir,
    path.basename(entry).replace(/\.tsx?$/, ".cjs")
  );

  await build({
    entryPoints: [entry],
    outfile: outFile,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node18",
    sourcemap: false,
    logLevel: "silent",
    plugins: [
      {
        name: "aliases",
        setup(buildApi) {
          buildApi.onResolve({ filter: /^@\// }, (args) => ({
            path: resolveSourceWithExtension(path.join(root, "src", args.path.slice(2))),
          }));

          buildApi.onResolve({ filter: /^obsidian$/ }, () => ({
            path: path.join(root, "tests/mocks/obsidian.ts"),
          }));
        },
      },
    ],
  });
}

const testFiles = fs.readdirSync(outDir)
  .filter((file) => file.endsWith(".cjs"))
  .map((file) => path.join(outDir, file));

const result = spawnSync(process.execPath, ["--test", ...testFiles], {
  stdio: "inherit",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
