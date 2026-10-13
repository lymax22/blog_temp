import createEcosModule from "./ecos.js";
import { normalizeProblem, solveSocp } from "./solver.js";

const MAX_JSON_CHARS = 500_000;
const MAX_TOTAL_DIMENSION = 20_000;
const MAX_NONZEROS = 200_000;

const analyticProblem = {
  c: [1, 0, 0],
  G: [
    [-1, 0, 0],
    [0, -1, 0],
    [0, 0, -1],
  ],
  h: [0, 0, 0],
  A: [
    [0, 1, 0],
    [0, 0, 1],
  ],
  b: [3, 4],
  cones: { l: 0, q: [3], nex: 0 },
};

const elements = {
  loadStatus: document.querySelector("#load-status"),
  analyticButton: document.querySelector("#analytic-button"),
  loopButton: document.querySelector("#loop-button"),
  solveButton: document.querySelector("#solve-button"),
  problemJson: document.querySelector("#problem-json"),
  inputError: document.querySelector("#input-error"),
  resultOutput: document.querySelector("#result-output"),
  kktOutput: document.querySelector("#kkt-output"),
};

elements.problemJson.value = JSON.stringify(analyticProblem, null, 2);

const modulePromise = createEcosModule({
  locateFile(path) {
    if (path.endsWith(".wasm")) return new URL("./ecos.wasm", import.meta.url).href;
    return path;
  },
});

function setLoadState(message, state) {
  elements.loadStatus.textContent = message;
  elements.loadStatus.className = `status ${state}`;
}

function setControlsDisabled(disabled) {
  elements.analyticButton.disabled = disabled;
  elements.loopButton.disabled = disabled;
  elements.solveButton.disabled = disabled;
}

function difference(left, right) {
  return left.map((value, index) => value - right[index]);
}

function infNorm(values) {
  return values.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0);
}

function dot(left, right) {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function cscMultiply(matrix, vector) {
  const output = new Array(matrix.rows).fill(0);
  for (let col = 0; col < matrix.cols; col += 1) {
    for (let index = matrix.colPointers[col]; index < matrix.colPointers[col + 1]; index += 1) {
      output[matrix.rowIndices[index]] += matrix.values[index] * vector[col];
    }
  }
  return output;
}

function cscTransposeMultiply(matrix, vector) {
  const output = new Array(matrix.cols).fill(0);
  for (let col = 0; col < matrix.cols; col += 1) {
    for (let index = matrix.colPointers[col]; index < matrix.colPointers[col + 1]; index += 1) {
      output[col] += matrix.values[index] * vector[matrix.rowIndices[index]];
    }
  }
  return output;
}

function coneViolation(vector, cones) {
  let violation = 0;
  let offset = 0;
  for (let index = 0; index < cones.l; index += 1) {
    violation = Math.max(violation, -vector[offset]);
    offset += 1;
  }
  for (const size of cones.q) {
    const block = vector.slice(offset, offset + size);
    violation = Math.max(violation, Math.hypot(...block.slice(1)) - block[0]);
    offset += size;
  }
  if (cones.nex > 0) return null;
  return Math.max(0, violation);
}

function calculateKkt(problem, result) {
  const normalized = normalizeProblem(problem);
  const { x } = result.primal;
  const { y, z } = result.dual;
  const { s } = result.slack;
  const axMinusB = difference(cscMultiply(normalized.A, x), normalized.b);
  const gxPlusSMinusH = difference(
    cscMultiply(normalized.G, x).map((value, index) => value + s[index]),
    normalized.h,
  );
  const aty = cscTransposeMultiply(normalized.A, y);
  const gtz = cscTransposeMultiply(normalized.G, z);
  const stationarity = normalized.c.map((value, index) => value + aty[index] + gtz[index]);
  const cones = { l: normalized.l, q: normalized.q, nex: normalized.nex };
  return {
    "||Ax-b||inf": infNorm(axMinusB),
    "||Gx+s-h||inf": infNorm(gxPlusSMinusH),
    "||c+A'y+G'z||inf": infNorm(stationarity),
    "s'z": dot(s, z),
    cone_s_violation: coneViolation(s, cones),
    cone_z_violation: coneViolation(z, cones),
    primal_objective: dot(normalized.c, x),
    dual_objective: -(dot(normalized.b, y) + dot(normalized.h, z)),
  };
}

function assertReasonableSize(problem) {
  const normalized = normalizeProblem(problem);
  if (normalized.n + normalized.m + normalized.p > MAX_TOTAL_DIMENSION) {
    throw new RangeError(`Problem dimensions exceed the ${MAX_TOTAL_DIMENSION} element limit`);
  }
  if (normalized.G.values.length + normalized.A.values.length > MAX_NONZEROS) {
    throw new RangeError(`Problem contains more than ${MAX_NONZEROS} nonzero matrix entries`);
  }
  return normalized;
}

function solutionIsFinite(result) {
  const values = [
    ...result.primal.x,
    ...result.dual.y,
    ...result.dual.z,
    ...result.slack.s,
    result.info.pcost,
    result.info.dcost,
    result.info.pres,
    result.info.dres,
    result.info.gap,
    result.info.relgap,
    result.info.iter,
  ];
  return values.every(Number.isFinite);
}

function showSolved(problem, result, extra = null) {
  const kkt = calculateKkt(problem, result);
  const displayed = {
    statusCode: result.statusCode,
    status: result.status,
    primal: result.primal,
    dual: result.dual,
    slack: result.slack,
    info: result.info,
  };
  if (extra) displayed.verification = extra;
  elements.resultOutput.textContent = JSON.stringify(displayed, null, 2);
  elements.kktOutput.textContent = JSON.stringify(kkt, null, 2);
  window.ecosLastRun = { problem, result, kkt, extra };
  return kkt;
}

function showError(error) {
  const message = error instanceof Error ? error.message : String(error);
  elements.inputError.textContent = message;
}

async function runOnce(problem) {
  assertReasonableSize(problem);
  const module = await modulePromise;
  const result = await solveSocp(problem, { module });
  showSolved(problem, result);
  return result;
}

async function withBusy(action) {
  elements.inputError.textContent = "";
  setControlsDisabled(true);
  try {
    await action();
  } catch (error) {
    showError(error);
  } finally {
    setControlsDisabled(false);
  }
}

elements.analyticButton.addEventListener("click", () => withBusy(async () => {
  const result = await runOnce(analyticProblem);
  if (result.status !== "optimal") throw new Error(`Analytic SOCP returned ${result.status}`);
}));

elements.solveButton.addEventListener("click", () => withBusy(async () => {
  const raw = elements.problemJson.value;
  if (raw.length > MAX_JSON_CHARS) throw new RangeError(`Problem JSON exceeds ${MAX_JSON_CHARS} characters`);
  let problem;
  try {
    problem = JSON.parse(raw);
  } catch (error) {
    throw new SyntaxError(`Invalid JSON: ${error.message}`);
  }
  await runOnce(problem);
}));

elements.loopButton.addEventListener("click", () => withBusy(async () => {
  const module = await modulePromise;
  const heapBefore = module.HEAPU8.buffer.byteLength;
  const start = performance.now();
  let result;
  for (let index = 0; index < 100; index += 1) {
    result = await solveSocp(analyticProblem, { module });
    if (result.status !== "optimal" || !solutionIsFinite(result)) {
      throw new Error(`Solve ${index + 1} failed with status ${result.status}`);
    }
  }
  const heapAfter = module.HEAPU8.buffer.byteLength;
  const extra = {
    solves: 100,
    allOptimalAndFinite: true,
    heapBytesBefore: heapBefore,
    heapBytesAfter: heapAfter,
    elapsedMs: performance.now() - start,
  };
  showSolved(analyticProblem, result, extra);
}));

modulePromise.then((module) => {
  setLoadState("ECOS WASM loaded", "ready");
  setControlsDisabled(false);
  window.ecosModule = module;
}, (error) => {
  setLoadState("ECOS WASM failed", "failed");
  elements.inputError.textContent = error instanceof Error ? error.message : String(error);
});

window.ecosAppReady = modulePromise.then(() => true, () => false);
window.ecosAnalyticProblem = analyticProblem;
