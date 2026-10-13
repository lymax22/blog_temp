import { calculateKkt } from "./kkt.js";
import { validateProblem } from "./problem.js";

function reportLoadStage(stage) {
  self.postMessage({ type: "load-progress", stage });
}

const [ecosGlue, solverAdapter] = await Promise.all([
  import("../ecos/ecos.js"),
  import("../ecos/solver.js"),
]);
reportLoadStage("JavaScript modules loaded");
const createEcosModule = ecosGlue.default;
const solveSocp = solverAdapter.solveSocp;

// The production Emscripten glue targets ENVIRONMENT=web. Compile the exact
// production WASM URL in this Worker, pass it through the supported
// instantiateWasm hook, and present a web-like environment only while the
// module factory initializes. The real Worker globals are restored afterward.
async function createWorkerEcosModule(options) {
  const wasmUrl = options.locateFile("ecos.wasm");
  reportLoadStage("Fetching ECOS WASM");
  const wasmResponse = await fetch(wasmUrl, { credentials: "same-origin" });
  if (!wasmResponse.ok) {
    throw new Error(`Unable to load ECOS WASM (${wasmResponse.status}).`);
  }
  const wasmModule = await WebAssembly.compile(await wasmResponse.arrayBuffer());
  reportLoadStage("ECOS WASM compiled");
  const workerScopeDescriptor = Object.getOwnPropertyDescriptor(globalThis, "WorkerGlobalScope");
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  try {
    Object.defineProperty(globalThis, "WorkerGlobalScope", { value: undefined, configurable: true });
    Object.defineProperty(globalThis, "window", { value: globalThis, configurable: true });
    const module = await createEcosModule({
      ...options,
      instantiateWasm(imports, receiveInstance) {
        reportLoadStage("Instantiating ECOS WASM");
        const instance = new WebAssembly.Instance(wasmModule, imports);
        receiveInstance(instance);
        reportLoadStage("ECOS WASM instantiated");
        return instance.exports;
      },
      onRuntimeInitialized() {
        reportLoadStage("ECOS runtime initialized");
      },
      postRun() {
        reportLoadStage("ECOS post-run complete");
      },
    });
    reportLoadStage("ECOS module factory complete");
    return module;
  } finally {
    reportLoadStage("Restoring Worker globals");
    if (workerScopeDescriptor) Object.defineProperty(globalThis, "WorkerGlobalScope", workerScopeDescriptor);
    else delete globalThis.WorkerGlobalScope;
    if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
    else delete globalThis.window;
    reportLoadStage("Worker globals restored");
  }
}

const modulePromise = createWorkerEcosModule({
  locateFile(path) {
    if (path.endsWith(".wasm")) return new URL("../ecos/ecos.wasm", import.meta.url).href;
    return path;
  },
});

let solving = false;

modulePromise
  .then((module) => {
    self.postMessage({
      type: "ready",
      heapBytes: module.HEAPU8.buffer.byteLength,
    });
  })
  .catch((error) => {
    self.postMessage({
      type: "init-error",
      message: error instanceof Error ? error.message : String(error),
    });
  });

self.addEventListener("message", async ({ data }) => {
  if (data?.type !== "solve") return;
  if (solving) {
    self.postMessage({ type: "solve-error", requestId: data.requestId, message: "Worker is already solving." });
    return;
  }

  solving = true;
  const workerStarted = performance.now();
  try {
    const workerPreflightStarted = performance.now();
    const validated = validateProblem(data.problem);
    const workerPreflightTimeMs = performance.now() - workerPreflightStarted;
    const module = await modulePromise;
    const heapBytesBefore = module.HEAPU8.buffer.byteLength;
    const solveStarted = performance.now();
    const result = await solveSocp(validated.problem, { module });
    const solveTimeMs = performance.now() - solveStarted;
    const kktStarted = performance.now();
    const kkt = calculateKkt(validated.problem, result);
    const kktTimeMs = performance.now() - kktStarted;
    const heapBytesAfter = module.HEAPU8.buffer.byteLength;

    self.postMessage({
      type: "result",
      requestId: data.requestId,
      result,
      kkt,
      summary: validated.summary,
      timing: {
        fileReadTimeMs: data.timing?.fileReadTimeMs ?? null,
        parseTimeMs: data.timing?.parseTimeMs ?? null,
        preflightTimeMs: data.timing?.preflightTimeMs ?? null,
        workerPreflightTimeMs,
        solveTimeMs,
        kktTimeMs,
        totalWorkerTimeMs: performance.now() - workerStarted,
      },
      memory: { heapBytesBefore, heapBytesAfter },
    });
  } catch (error) {
    self.postMessage({
      type: "solve-error",
      requestId: data.requestId,
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    solving = false;
  }
});
