import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..");
const outDir = path.join(repo, ".tmp-project-online-solve");
await fs.rm(outDir, { recursive: true, force: true });
await fs.mkdir(outDir, { recursive: true });

const productionBase = "https://blog.louisym.com/tools/ecos/";
const assets = ["ecos.js", "ecos.wasm", "solver.js"];
const online = {};
const hashes = {};

for (const name of assets) {
  const response = await fetch(new URL(name, productionBase));
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const local = await fs.readFile(path.join(repo, "source", "tools", "ecos", name));
  if (!bytes.equals(local)) {
    throw new Error(`${name}: deployed bytes differ from blog_temp main`);
  }
  online[name] = bytes;
  hashes[name] = createHash("sha256").update(bytes).digest("hex");
}

if (hashes["ecos.js"] !== "92e0f8c60004fd8edb74e37a189b430086b37662fcef28d361e25de0a28e070f") {
  throw new Error(`unexpected deployed ecos.js SHA256: ${hashes["ecos.js"]}`);
}
if (hashes["ecos.wasm"] !== "bdd1405bf8b70bb6d596173e8fb11f32ee45f1bf45b1577bb8910e802787f998") {
  throw new Error(`unexpected deployed ecos.wasm SHA256: ${hashes["ecos.wasm"]}`);
}

await fs.writeFile(path.join(outDir, "ecos.mjs"), online["ecos.js"]);
await fs.writeFile(path.join(outDir, "solver.mjs"), online["solver.js"]);
await fs.writeFile(path.join(outDir, "ecos.wasm"), online["ecos.wasm"]);

const { default: createEcosModule } = await import(
  pathToFileURL(path.join(outDir, "ecos.mjs")).href
);
const { solveSocp } = await import(
  pathToFileURL(path.join(outDir, "solver.mjs")).href
);

const qReference = [
  0.662597513968216,
 -0.0575241067660466,
  0.0534435232884158,
  0.744848509055629,
];

const qNormSquared = qReference.reduce((s, v) => s + v * v, 0);
const lowerGradient = qReference.map((v) => 2 * v);
const lowerOffset = 1 + qNormSquared;
const requiredDot = lowerOffset / 2;

// Orthogonal projection onto the terminal affine attitude set
// q0=q3, q1=q2, matching dt14_scvx_solve_subproblem.m.
const projected = [
  0.5 * (qReference[0] + qReference[3]),
  0.5 * (qReference[1] + qReference[2]),
  0.5 * (qReference[1] + qReference[2]),
  0.5 * (qReference[0] + qReference[3]),
];
const maximumUnitAttitudeSetDot = Math.hypot(...projected);
const geometryGap = requiredDot - maximumUnitAttitudeSetDot;
if (!(geometryGap > 0)) throw new Error("expected positive terminal geometry gap");

// Standard ECOS form for the exact terminal feasibility slice:
// q0-q3=0, q1-q2=0,
// lowerGradient' q >= lowerOffset,
// ||q||_2 <= 1.
const problem = {
  c: [0, 0, 0, 0],
  G: [
    lowerGradient.map((v) => -v),
    [0, 0, 0, 0],
    [-1, 0, 0, 0],
    [0, -1, 0, 0],
    [0, 0, -1, 0],
    [0, 0, 0, -1],
  ],
  h: [-lowerOffset, 1, 0, 0, 0, 0],
  A: [
    [1, 0, 0, -1],
    [0, 1, -1, 0],
  ],
  b: [0, 0],
  cones: { l: 1, q: [5], nex: 0 },
};

const module = await createEcosModule({
  locateFile(name) {
    if (name.endsWith(".wasm")) return path.join(outDir, "ecos.wasm");
    return name;
  },
});

const start = performance.now();
const result = await solveSocp(problem, { module });
const elapsedMs = performance.now() - start;

if (!["primal_infeasible", "primal_infeasible_inaccurate"].includes(result.status)) {
  throw new Error(`expected primal infeasible, got ${result.status}`);
}

const report = {
  verdict: "PASS",
  test: "DT14_TERMINAL_QUATERNION_INFEASIBILITY_ONLINE_ECOS",
  provenance: {
    project: "lymax22/LGR_Learning_prj",
    branch: "codex/draft/dt14-free-tf-convex-subproblem",
    head: "7f19797fd3db8947ddea7f1a0abadc0e5e890d98",
    formulation_file: "code/research/six-dof/dt14-free-tf-scvx/dt14_scvx_solve_subproblem.m",
    qnorm_file: "code/research/six-dof/dt14-free-tf-scvx/dt14_scvx_qnorm_convexification.m",
    reference_file: "code/research/six-dof/dt14-free-tf-scvx/results/propagation_kernel_v1/reference_rollout_nodes.csv",
    historical_mosek_status: "Infeasible",
  },
  deployed_assets: {
    base_url: productionBase,
    sha256: hashes,
    exact_match_with_blog_main: true,
  },
  geometry: {
    qReference,
    qNormSquared,
    requiredDot,
    maximumUnitAttitudeSetDot,
    gap: geometryGap,
  },
  ecos: {
    statusCode: result.statusCode,
    status: result.status,
    info: result.info,
    elapsedMs,
  },
};

const reportPath = path.join(repo, "project-online-solve-result.json");
await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
