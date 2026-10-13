const INFO_LENGTH = 8;

const STATUS_NAMES = new Map([
  [0, "optimal"],
  [1, "primal_infeasible"],
  [2, "dual_infeasible"],
  [10, "optimal_inaccurate"],
  [11, "primal_infeasible_inaccurate"],
  [12, "dual_infeasible_inaccurate"],
  [-1, "max_iterations"],
  [-2, "numerical_problem"],
  [-3, "numerical_problem"],
  [-4, "interrupted"],
  [-7, "fatal"],
  [-100, "setup_failed"],
  [-101, "invalid_argument"],
]);

let defaultModulePromise;

function fail(message) {
  throw new TypeError(`Invalid ECOS problem: ${message}`);
}

function isArrayLike(value) {
  return Array.isArray(value) || (ArrayBuffer.isView(value) && !(value instanceof DataView));
}

function finiteVector(value, name, expectedLength) {
  if (!isArrayLike(value)) fail(`${name} must be an array or typed array`);
  const result = Array.from(value, Number);
  if (expectedLength !== undefined && result.length !== expectedLength) {
    fail(`${name} must have length ${expectedLength}, got ${result.length}`);
  }
  for (let i = 0; i < result.length; i += 1) {
    if (!Number.isFinite(result[i])) fail(`${name}[${i}] must be finite`);
  }
  return result;
}

function integerVector(value, name, expectedLength) {
  const result = finiteVector(value, name, expectedLength);
  for (let i = 0; i < result.length; i += 1) {
    if (!Number.isSafeInteger(result[i])) fail(`${name}[${i}] must be an integer`);
  }
  return result;
}

export function denseToCsc(matrix, expectedRows, expectedCols, name = "matrix") {
  if (!Array.isArray(matrix) || matrix.length !== expectedRows) {
    fail(`${name} dense input must contain ${expectedRows} rows`);
  }
  const rows = matrix.map((row, rowIndex) => {
    if (!isArrayLike(row) || row.length !== expectedCols) {
      fail(`${name}[${rowIndex}] must contain ${expectedCols} columns`);
    }
    return finiteVector(row, `${name}[${rowIndex}]`, expectedCols);
  });

  const values = [];
  const rowIndices = [];
  const colPointers = [0];
  for (let col = 0; col < expectedCols; col += 1) {
    for (let row = 0; row < expectedRows; row += 1) {
      const value = rows[row][col];
      if (value !== 0) {
        values.push(value);
        rowIndices.push(row);
      }
    }
    colPointers.push(values.length);
  }
  return { format: "csc", rows: expectedRows, cols: expectedCols, values, colPointers, rowIndices };
}

function normalizeCsc(matrix, expectedRows, expectedCols, name) {
  if (Array.isArray(matrix)) return denseToCsc(matrix, expectedRows, expectedCols, name);
  if (!matrix || typeof matrix !== "object") fail(`${name} must be a dense 2D array or CSC object`);

  const rows = Number(matrix.rows ?? matrix.m);
  const cols = Number(matrix.cols ?? matrix.n);
  if (rows !== expectedRows || cols !== expectedCols) {
    fail(`${name} dimensions must be ${expectedRows}x${expectedCols}, got ${rows}x${cols}`);
  }

  const values = finiteVector(matrix.values ?? matrix.data ?? matrix.pr, `${name}.values`);
  const colPointers = integerVector(
    matrix.colPointers ?? matrix.indptr ?? matrix.jc,
    `${name}.colPointers`,
    expectedCols + 1,
  );
  const rowIndices = integerVector(
    matrix.rowIndices ?? matrix.indices ?? matrix.ir,
    `${name}.rowIndices`,
    values.length,
  );

  if (colPointers[0] !== 0 || colPointers[colPointers.length - 1] !== values.length) {
    fail(`${name}.colPointers must start at 0 and end at values.length`);
  }
  for (let col = 0; col < expectedCols; col += 1) {
    if (colPointers[col] > colPointers[col + 1]) {
      fail(`${name}.colPointers must be monotonic`);
    }
  }
  for (let i = 0; i < rowIndices.length; i += 1) {
    if (rowIndices[i] < 0 || rowIndices[i] >= expectedRows) {
      fail(`${name}.rowIndices[${i}] is outside [0, ${expectedRows})`);
    }
  }
  return { format: "csc", rows, cols, values, colPointers, rowIndices };
}

export function normalizeProblem(problem) {
  if (!problem || typeof problem !== "object") fail("problem must be an object");
  const c = finiteVector(problem.c, "c");
  const h = finiteVector(problem.h, "h");
  const b = problem.b == null ? [] : finiteVector(problem.b, "b");
  const n = c.length;
  const m = h.length;
  const p = b.length;
  if (n === 0) fail("c must not be empty");
  if (m === 0) fail("h must not be empty");

  const cones = problem.cones ?? {};
  const l = Number(cones.l ?? 0);
  const q = integerVector(cones.q ?? [], "cones.q");
  const nex = Number(cones.nex ?? 0);
  if (!Number.isSafeInteger(l) || l < 0) fail("cones.l must be a non-negative integer");
  if (!Number.isSafeInteger(nex) || nex < 0) fail("cones.nex must be a non-negative integer");
  if (q.some((size) => size <= 0)) fail("every cones.q entry must be positive");
  const coneRows = l + q.reduce((sum, size) => sum + size, 0) + 3 * nex;
  if (coneRows !== m) {
    fail(`h.length (${m}) must equal cones.l + sum(cones.q) + 3*cones.nex (${coneRows})`);
  }

  const G = normalizeCsc(problem.G, m, n, "G");
  let A;
  if (p === 0) {
    if (problem.A != null) A = normalizeCsc(problem.A, 0, n, "A");
    else A = { format: "csc", rows: 0, cols: n, values: [], colPointers: new Array(n + 1).fill(0), rowIndices: [] };
  } else {
    if (problem.A == null) fail("A is required when b is non-empty");
    A = normalizeCsc(problem.A, p, n, "A");
  }
  return { n, m, p, l, q, nex, c, h, b, G, A };
}

async function loadDefaultModule() {
  if (!defaultModulePromise) {
    defaultModulePromise = import(new URL("./ecos.js", import.meta.url).href)
      .then(({ default: createEcosModule }) => createEcosModule({
        locateFile(path) {
          if (path.endsWith(".wasm")) return new URL("./ecos.wasm", import.meta.url).href;
          return path;
        },
      }));
  }
  return defaultModulePromise;
}

function allocate(Module, allocations, values, Type) {
  if (values.length === 0) return 0;
  const pointer = Module._malloc(values.length * Type.BYTES_PER_ELEMENT);
  if (!pointer) throw new Error(`WASM allocation failed for ${values.length} values`);
  allocations.push(pointer);
  const view = Type === Float64Array ? Module.HEAPF64 : Module.HEAP32;
  view.set(values, pointer / Type.BYTES_PER_ELEMENT);
  return pointer;
}

function allocateOutput(Module, allocations, length, Type) {
  if (length === 0) return 0;
  const pointer = Module._malloc(length * Type.BYTES_PER_ELEMENT);
  if (!pointer) throw new Error(`WASM output allocation failed for ${length} values`);
  allocations.push(pointer);
  return pointer;
}

function copyOutput(Module, pointer, length, Type) {
  if (length === 0) return [];
  const view = Type === Float64Array ? Module.HEAPF64 : Module.HEAP32;
  return Array.from(view.subarray(pointer / Type.BYTES_PER_ELEMENT, pointer / Type.BYTES_PER_ELEMENT + length));
}

export async function solveSocp(problem, options = {}) {
  const normalized = normalizeProblem(problem);
  const Module = options.module ?? await loadDefaultModule();
  const allocations = [];
  const f64 = (values) => allocate(Module, allocations, values, Float64Array);
  const i32 = (values) => allocate(Module, allocations, values, Int32Array);

  try {
    const qPtr = i32(normalized.q);
    const GprPtr = f64(normalized.G.values);
    const GjcPtr = i32(normalized.G.colPointers);
    const GirPtr = i32(normalized.G.rowIndices);
    const AprPtr = normalized.p ? f64(normalized.A.values) : 0;
    const AjcPtr = normalized.p ? i32(normalized.A.colPointers) : 0;
    const AirPtr = normalized.p ? i32(normalized.A.rowIndices) : 0;
    const cPtr = f64(normalized.c);
    const hPtr = f64(normalized.h);
    const bPtr = normalized.p ? f64(normalized.b) : 0;
    const xPtr = allocateOutput(Module, allocations, normalized.n, Float64Array);
    const yPtr = allocateOutput(Module, allocations, normalized.p, Float64Array);
    const zPtr = allocateOutput(Module, allocations, normalized.m, Float64Array);
    const sPtr = allocateOutput(Module, allocations, normalized.m, Float64Array);
    const infoPtr = allocateOutput(Module, allocations, INFO_LENGTH, Float64Array);
    const iterPtr = allocateOutput(Module, allocations, 1, Int32Array);

    const statusCode = Module._ecos_wasm_solve_once(
      normalized.n, normalized.m, normalized.p, normalized.l,
      normalized.q.length, qPtr, normalized.nex,
      GprPtr, GjcPtr, GirPtr,
      AprPtr, AjcPtr, AirPtr,
      cPtr, hPtr, bPtr,
      xPtr, yPtr, zPtr, sPtr, infoPtr, iterPtr,
    );

    const info = copyOutput(Module, infoPtr, INFO_LENGTH, Float64Array);
    const iter = copyOutput(Module, iterPtr, 1, Int32Array)[0];
    return {
      statusCode,
      status: STATUS_NAMES.get(statusCode) ?? "unknown",
      primal: { x: copyOutput(Module, xPtr, normalized.n, Float64Array) },
      dual: {
        y: copyOutput(Module, yPtr, normalized.p, Float64Array),
        z: copyOutput(Module, zPtr, normalized.m, Float64Array),
      },
      slack: { s: copyOutput(Module, sPtr, normalized.m, Float64Array) },
      info: {
        pcost: info[0], dcost: info[1], pres: info[2], dres: info[3],
        gap: info[4], relgap: info[5], pinfres: info[6], dinfres: info[7], iter,
      },
    };
  } finally {
    for (let i = allocations.length - 1; i >= 0; i -= 1) Module._free(allocations[i]);
  }
}

export async function getEcosModule() {
  return loadDefaultModule();
}
