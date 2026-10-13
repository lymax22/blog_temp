# Large ECOS SOCP Solver

`/tools/ecos-large/` reads a local JSON problem, validates its sparse CSC structure, and solves it in a module Web Worker. The selected file is never uploaded. The page does not use `fetch`, `XMLHttpRequest`, `FormData`, `sendBeacon`, or WebSocket APIs for problem data.

The Worker uses the production numerical core at `../ecos/ecos.js`, `../ecos/ecos.wasm`, and `../ecos/solver.js`. Its bootstrap fetches and compiles the production WASM URL, supplies the compiled module through Emscripten's `instantiateWasm` hook, and applies a scoped environment-detection compatibility shim while the web-targeted module factory initializes. The real Worker globals are restored immediately afterward. ECOS runs single-threaded. Cancel terminates the active Worker and creates a fresh one.

## Input

The JSON schema is the existing `solveSocp()` schema, restricted to CSC matrices:

```json
{
  "c": [],
  "G": {
    "format": "csc",
    "rows": 0,
    "cols": 0,
    "values": [],
    "colPointers": [],
    "rowIndices": []
  },
  "h": [],
  "A": {
    "format": "csc",
    "rows": 0,
    "cols": 0,
    "values": [],
    "colPointers": [],
    "rowIndices": []
  },
  "b": [],
  "cones": { "l": 0, "q": [], "nex": 0 }
}
```

`A` may be omitted when `b` is empty. Version 1 supports nonnegative linear cones and second-order cones. Exponential cones are rejected.

## Limits

- File size: 128 MiB
- `n`: 20,000
- `m`: 100,000
- `p`: 20,000
- `nnz(A) + nnz(G)`: 2,000,000

The preflight validates finite vectors and matrix values, integer and monotonic CSC pointers, row bounds, dimensions, cone row counts, and the version-one cone restriction before enabling Solve. The Worker repeats validation before invoking ECOS.

## Result and diagnostics

Only compact vector previews are rendered. The full `x`, `y`, `z`, and `s` arrays remain available in a locally generated `result.json` download. KKT diagnostics use sparse CSC multiplication independently of ECOS residual fields and report equality, cone-affine, stationarity, complementarity, and primal/dual cone violations.
