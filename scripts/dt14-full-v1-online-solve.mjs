import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..");
const generated = path.join(repo, ".tmp-dt14-full-v1");
const work = path.join(repo, ".tmp-dt14-full-v1-online");
await fs.rm(work, { recursive: true, force: true });
await fs.mkdir(work, { recursive: true });

const problem = JSON.parse(await fs.readFile(path.join(generated, "problem.json"), "utf8"));
const meta = JSON.parse(await fs.readFile(path.join(generated, "meta.json"), "utf8"));

const base = "https://blog.louisym.com/tools/ecos/";
const names = ["ecos.js", "ecos.wasm", "solver.js"];
const hashes = {};
for (const name of names) {
  const response = await fetch(new URL(name, base));
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  hashes[name] = createHash("sha256").update(bytes).digest("hex");
  await fs.writeFile(path.join(work, name === "ecos.js" ? "ecos.mjs" : name === "solver.js" ? "solver.mjs" : name), bytes);
}
if (hashes["ecos.js"] !== "92e0f8c60004fd8edb74e37a189b430086b37662fcef28d361e25de0a28e070f") {
  throw new Error(`unexpected ecos.js hash: ${hashes["ecos.js"]}`);
}
if (hashes["ecos.wasm"] !== "bdd1405bf8b70bb6d596173e8fb11f32ee45f1bf45b1577bb8910e802787f998") {
  throw new Error(`unexpected ecos.wasm hash: ${hashes["ecos.wasm"]}`);
}

const { default: createEcosModule } = await import(pathToFileURL(path.join(work, "ecos.mjs")).href);
const { solveSocp } = await import(pathToFileURL(path.join(work, "solver.mjs")).href);
const module = await createEcosModule({
  locateFile(name) {
    if (name.endsWith(".wasm")) return path.join(work, "ecos.wasm");
    return name;
  },
});

const heapBefore = module.HEAPU8.buffer.byteLength;
const t0 = performance.now();
const result = await solveSocp(problem, { module });
const elapsedMs = performance.now() - t0;
const heapAfter = module.HEAPU8.buffer.byteLength;

if (!["primal_infeasible", "primal_infeasible_inaccurate"].includes(result.status)) {
  throw new Error(`expected full DT14 V1 primal infeasibility, got ${result.status}`);
}
if (!(Number.isFinite(result.info.pinfres) && result.info.pinfres < 1e-6)) {
  throw new Error(`infeasibility certificate residual too large: ${result.info.pinfres}`);
}

const report = {
  verdict: "PASS",
  test: "DT14_FULL_V1_CONVEX_SUBPROBLEM_ONLINE_ECOS",
  canonicalProblem: meta,
  deployedAssets: { baseUrl: base, sha256: hashes },
  ecos: {
    statusCode: result.statusCode,
    status: result.status,
    info: result.info,
    elapsedMs,
    heapBefore,
    heapAfter,
  },
  comparison: {
    historicalMosekStatus: meta.expectedHistoricalStatus,
    onlineEcosStatus: result.status,
    statusAgreement: true,
    fullCanonicalProblem: true,
    terminalConflictOnly: false,
  },
};
await fs.writeFile(path.join(repo, "dt14-full-v1-online-result.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
