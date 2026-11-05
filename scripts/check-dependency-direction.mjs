// Enforces ARCHITECTURE.md section 4. Exits non-zero on any violation.
//   packages/engine   -> no workspace packages, no Node built-ins
//   packages/games/*  -> @twinthreads/engine only (no third-party or Node imports)
//   packages/*        -> never apps/*
import { readdirSync, readFileSync, statSync } from "node:fs";
import { builtinModules } from "node:module";
import { dirname, join, relative, resolve, sep } from "node:path";

const root = process.argv[2] ? resolve(process.argv[2]) : process.cwd();
const ENGINE = "@twinthreads/engine";
const IMPORT =
  /(?:\bfrom\s+|\bimport\s*\(?\s*|\brequire\s*\(\s*)["']([^"']+)["']/g;
const builtins = new Set(builtinModules);
const errors = [];

const list = (dir) => {
  try {
    return readdirSync(dir).map((name) => join(dir, name));
  } catch {
    return [];
  }
};

const sourceFiles = (dir) =>
  list(dir).flatMap((path) => {
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(c|m)?(t|j)sx?$/.test(path) ? [path] : [];
  });

const packages = [
  { dir: join(root, "packages/engine"), isGame: false },
  ...list(join(root, "packages/games")).map((dir) => ({ dir, isGame: true })),
];

for (const { dir, isGame } of packages) {
  const manifest = join(dir, "package.json");
  const pkg = JSON.parse(readFileSync(manifest, "utf8"));
  const allowed = isGame ? [ENGINE] : [];

  for (const name of Object.keys({
    ...pkg.dependencies,
    ...pkg.peerDependencies,
  })) {
    if (!allowed.includes(name)) {
      errors.push(
        `${relative(root, manifest)}: dependency "${name}" is not allowed`,
      );
    }
  }

  const testDir = join(dir, "test");
  for (const file of [
    ...sourceFiles(join(dir, "src")),
    ...sourceFiles(testDir),
  ]) {
    const isTest = file.startsWith(testDir + sep);
    for (const [, spec] of readFileSync(file, "utf8").matchAll(IMPORT)) {
      const where = relative(root, file);
      if (spec.startsWith(".")) {
        const target = resolve(dirname(file), spec);
        if (target !== dir && !target.startsWith(dir + sep)) {
          errors.push(`${where}: "${spec}" reaches outside its package`);
        }
      } else if (spec === "vitest" && isTest) {
        continue;
      } else if (spec.startsWith("node:") || builtins.has(spec)) {
        errors.push(`${where}: Node built-in "${spec}" is not allowed`);
      } else if (!allowed.includes(spec)) {
        errors.push(`${where}: import "${spec}" is not allowed`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error(
    "Dependency direction violations:\n" +
      errors.map((e) => `  - ${e}`).join("\n"),
  );
  process.exit(1);
}
console.log(`Dependency direction OK (${packages.length} packages checked).`);
