function infNorm(values) {
  let maximum = 0;
  for (const value of values) maximum = Math.max(maximum, Math.abs(value));
  return maximum;
}

function multiplyCsc(matrix, vector) {
  const output = new Float64Array(matrix.rows);
  for (let column = 0; column < matrix.cols; column += 1) {
    for (let index = matrix.colPointers[column]; index < matrix.colPointers[column + 1]; index += 1) {
      output[matrix.rowIndices[index]] += matrix.values[index] * vector[column];
    }
  }
  return output;
}

function transposeMultiplyCsc(matrix, vector) {
  const output = new Float64Array(matrix.cols);
  for (let column = 0; column < matrix.cols; column += 1) {
    let value = 0;
    for (let index = matrix.colPointers[column]; index < matrix.colPointers[column + 1]; index += 1) {
      value += matrix.values[index] * vector[matrix.rowIndices[index]];
    }
    output[column] = value;
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
    let tailSquared = 0;
    for (let index = 1; index < size; index += 1) {
      const value = vector[offset + index];
      tailSquared += value * value;
    }
    violation = Math.max(violation, Math.sqrt(tailSquared) - vector[offset]);
    offset += size;
  }
  return Math.max(0, violation);
}

export function calculateKkt(problem, result) {
  const { x } = result.primal;
  const { y, z } = result.dual;
  const { s } = result.slack;
  const ax = multiplyCsc(problem.A, x);
  const gx = multiplyCsc(problem.G, x);
  const aty = transposeMultiplyCsc(problem.A, y);
  const gtz = transposeMultiplyCsc(problem.G, z);
  const equality = new Float64Array(problem.b.length);
  const coneAffine = new Float64Array(problem.h.length);
  const stationarity = new Float64Array(problem.c.length);
  let complementarity = 0;

  for (let index = 0; index < equality.length; index += 1) equality[index] = ax[index] - problem.b[index];
  for (let index = 0; index < coneAffine.length; index += 1) coneAffine[index] = gx[index] + s[index] - problem.h[index];
  for (let index = 0; index < stationarity.length; index += 1) stationarity[index] = problem.c[index] + aty[index] + gtz[index];
  for (let index = 0; index < s.length; index += 1) complementarity += s[index] * z[index];

  return {
    equalityInf: infNorm(equality),
    coneAffineInf: infNorm(coneAffine),
    stationarityInf: infNorm(stationarity),
    complementarity,
    primalConeViolation: coneViolation(s, problem.cones),
    dualConeViolation: coneViolation(z, problem.cones),
  };
}
