export const LIMITS = Object.freeze({
  maxFileBytes: 128 * 1024 * 1024,
  maxN: 20_000,
  maxM: 100_000,
  maxP: 20_000,
  maxNnz: 2_000_000,
});

function invalid(message) {
  throw new TypeError(`Invalid Large Solver problem: ${message}`);
}

function requireArray(value, name) {
  if (!Array.isArray(value)) invalid(`${name} must be a JSON array`);
  return value;
}

function finiteVector(value, name) {
  const vector = requireArray(value, name);
  for (let index = 0; index < vector.length; index += 1) {
    if (typeof vector[index] !== "number" || !Number.isFinite(vector[index])) {
      invalid(`${name}[${index}] must be a finite number`);
    }
  }
  return vector;
}

function nonNegativeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) invalid(`${name} must be a non-negative integer`);
  return value;
}

function validateCsc(matrix, expectedRows, expectedCols, name) {
  if (!matrix || typeof matrix !== "object" || Array.isArray(matrix)) {
    invalid(`${name} must be a CSC object; dense matrices are not supported`);
  }
  if (matrix.format !== "csc") invalid(`${name}.format must be "csc"`);
  const rows = nonNegativeInteger(matrix.rows, `${name}.rows`);
  const cols = nonNegativeInteger(matrix.cols, `${name}.cols`);
  if (rows !== expectedRows || cols !== expectedCols) {
    invalid(`${name} dimensions must be ${expectedRows}x${expectedCols}, got ${rows}x${cols}`);
  }

  const values = finiteVector(matrix.values, `${name}.values`);
  const colPointers = requireArray(matrix.colPointers, `${name}.colPointers`);
  const rowIndices = requireArray(matrix.rowIndices, `${name}.rowIndices`);
  if (values.length > LIMITS.maxNnz) invalid(`${name} has more than ${LIMITS.maxNnz.toLocaleString()} nonzeros`);
  if (colPointers.length !== cols + 1) {
    invalid(`${name}.colPointers must have length ${cols + 1}, got ${colPointers.length}`);
  }
  if (rowIndices.length !== values.length) {
    invalid(`${name}.rowIndices must have length ${values.length}, got ${rowIndices.length}`);
  }
  for (let index = 0; index < colPointers.length; index += 1) {
    if (!Number.isSafeInteger(colPointers[index])) invalid(`${name}.colPointers[${index}] must be an integer`);
  }
  if (colPointers[0] !== 0 || colPointers[colPointers.length - 1] !== values.length) {
    invalid(`${name}.colPointers must start at 0 and end at values.length`);
  }
  for (let column = 0; column < cols; column += 1) {
    if (colPointers[column] > colPointers[column + 1]) {
      invalid(`${name}.colPointers must be monotonic at column ${column}`);
    }
  }
  for (let index = 0; index < rowIndices.length; index += 1) {
    const row = rowIndices[index];
    if (!Number.isSafeInteger(row)) invalid(`${name}.rowIndices[${index}] must be an integer`);
    if (row < 0 || row >= rows) invalid(`${name}.rowIndices[${index}] is outside [0, ${rows})`);
  }
  return { format: "csc", rows, cols, values, colPointers, rowIndices };
}

export function validateProblem(problem) {
  if (!problem || typeof problem !== "object" || Array.isArray(problem)) invalid("problem must be an object");
  const c = finiteVector(problem.c, "c");
  const h = finiteVector(problem.h, "h");
  const b = problem.b == null ? [] : finiteVector(problem.b, "b");
  const n = c.length;
  const m = h.length;
  const p = b.length;
  if (n === 0) invalid("c must not be empty");
  if (m === 0) invalid("h must not be empty");
  if (n > LIMITS.maxN) invalid(`n (${n}) exceeds ${LIMITS.maxN}`);
  if (m > LIMITS.maxM) invalid(`m (${m}) exceeds ${LIMITS.maxM}`);
  if (p > LIMITS.maxP) invalid(`p (${p}) exceeds ${LIMITS.maxP}`);

  const cones = problem.cones;
  if (!cones || typeof cones !== "object" || Array.isArray(cones)) invalid("cones must be an object");
  const l = nonNegativeInteger(cones.l ?? 0, "cones.l");
  const nex = nonNegativeInteger(cones.nex ?? 0, "cones.nex");
  if (nex !== 0) throw new TypeError("Exponential cones are not supported by Large Solver v1.");
  const q = requireArray(cones.q ?? [], "cones.q");
  let socRows = 0;
  let largestSoc = 0;
  for (let index = 0; index < q.length; index += 1) {
    if (!Number.isSafeInteger(q[index]) || q[index] <= 0) invalid(`cones.q[${index}] must be a positive integer`);
    socRows += q[index];
    largestSoc = Math.max(largestSoc, q[index]);
    if (!Number.isSafeInteger(socRows) || socRows > LIMITS.maxM) invalid("sum(cones.q) is too large");
  }
  if (l + socRows !== m) invalid(`h.length (${m}) must equal cones.l + sum(cones.q) (${l + socRows})`);

  const G = validateCsc(problem.G, m, n, "G");
  let A;
  if (p === 0 && problem.A == null) {
    A = { format: "csc", rows: 0, cols: n, values: [], colPointers: new Array(n + 1).fill(0), rowIndices: [] };
  } else {
    if (problem.A == null) invalid("A is required when b is non-empty");
    A = validateCsc(problem.A, p, n, "A");
  }

  const nnzG = G.values.length;
  const nnzA = A.values.length;
  if (nnzG + nnzA > LIMITS.maxNnz) {
    invalid(`nnz(A) + nnz(G) (${nnzA + nnzG}) exceeds ${LIMITS.maxNnz.toLocaleString()}`);
  }

  const canonical = { c, G, h, A, b, cones: { l, q, nex: 0 } };
  const summary = {
    n,
    m,
    p,
    nnzG,
    nnzA,
    nnzTotal: nnzG + nnzA,
    linearConeDimension: l,
    socCount: q.length,
    largestSoc,
  };
  return { problem: canonical, summary };
}
