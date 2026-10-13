import { LIMITS, validateProblem } from "./problem.js";

const PREVIEW_VALUES = 12;

const elements = {
  fileInput: document.querySelector("#problem-file"),
  loadStatus: document.querySelector("#load-status"),
  error: document.querySelector("#input-error"),
  summary: document.querySelector("#problem-summary"),
  solveButton: document.querySelector("#solve-button"),
  cancelButton: document.querySelector("#cancel-button"),
  downloadButton: document.querySelector("#download-button"),
  result: document.querySelector("#result-output"),
  kkt: document.querySelector("#kkt-output"),
};

const state = {
  worker: null,
  workerEpoch: 0,
  workerReady: false,
  solving: false,
  requestId: 0,
  problem: null,
  sourceFile: null,
  summary: null,
  timing: null,
  result: null,
};

let resolveInitialReady;
window.ecosLargeAppReady = new Promise((resolve) => { resolveInitialReady = resolve; });
window.ecosLargeLastResult = null;

function setStatus(message, kind = "pending") {
  elements.loadStatus.textContent = message;
  elements.loadStatus.className = `status ${kind}`;
}

function showError(error) {
  elements.error.textContent = error instanceof Error ? error.message : String(error);
}

function clearError() {
  elements.error.textContent = "";
}

function updateControls() {
  elements.fileInput.disabled = state.solving;
  elements.solveButton.disabled = state.solving || !state.workerReady || !state.problem;
  elements.cancelButton.disabled = !state.solving;
  elements.downloadButton.disabled = state.solving || !state.result;
}

function vectorSummary(values) {
  let minimum = Infinity;
  let maximum = -Infinity;
  let infinityNorm = 0;
  let allFinite = true;
  for (const value of values) {
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
    infinityNorm = Math.max(infinityNorm, Math.abs(value));
    allFinite &&= Number.isFinite(value);
  }
  return {
    length: values.length,
    firstValues: values.slice(0, PREVIEW_VALUES),
    min: values.length ? minimum : null,
    max: values.length ? maximum : null,
    infinityNorm,
    allFinite,
  };
}

function renderResult(downloadable, memory) {
  elements.result.textContent = JSON.stringify({
    status: downloadable.status,
    statusCode: downloadable.statusCode,
    timing: downloadable.timing,
    memory,
    info: downloadable.info,
    vectors: {
      x: vectorSummary(downloadable.primal.x),
      y: vectorSummary(downloadable.dual.y),
      z: vectorSummary(downloadable.dual.z),
      s: vectorSummary(downloadable.slack.s),
    },
  }, null, 2);
  elements.kkt.textContent = JSON.stringify(downloadable.kkt, null, 2);
}

function renderProblemSummary(file, summary, ready) {
  elements.summary.textContent = [
    "Problem loaded",
    `filename: ${file.name}`,
    `file size: ${file.size.toLocaleString()} bytes`,
    `n: ${summary.n}`,
    `m: ${summary.m}`,
    `p: ${summary.p}`,
    `nnz(G): ${summary.nnzG}`,
    `nnz(A): ${summary.nnzA}`,
    `nnz total: ${summary.nnzTotal}`,
    `linear cone dimension: ${summary.linearConeDimension}`,
    `SOC count: ${summary.socCount}`,
    `largest SOC: ${summary.largestSoc}`,
    ready ? "Ready to solve" : "Waiting for ECOS WASM",
  ].join("\n");
}

function handleWorkerMessage(epoch, message) {
  if (epoch !== state.workerEpoch) return;
  if (message.type === "load-progress") {
    window.ecosLargeWorkerStage = message.stage;
    setStatus(`Loading ECOS WASM in worker… ${message.stage}`);
    return;
  }
  if (message.type === "ready") {
    state.workerReady = true;
    if (state.problem) {
      renderProblemSummary(state.sourceFile, state.summary, true);
      setStatus("Ready to solve", "ready");
    } else {
      setStatus("ECOS WASM loaded. Select a problem.json file.", "ready");
    }
    updateControls();
    resolveInitialReady?.(true);
    resolveInitialReady = null;
    return;
  }
  if (message.type === "init-error") {
    state.workerReady = false;
    state.solving = false;
    setStatus("ECOS WASM failed to load", "failed");
    showError(message.message);
    updateControls();
    resolveInitialReady?.(false);
    resolveInitialReady = null;
    return;
  }
  if (message.requestId !== state.requestId) return;
  if (message.type === "solve-error") {
    state.solving = false;
    setStatus("Solve failed", "failed");
    showError(message.message);
    updateControls();
    return;
  }
  if (message.type !== "result") return;

  state.solving = false;
  const result = message.result;
  state.result = {
    metadata: {
      sourceFile: state.sourceFile.name,
      fileSizeBytes: state.sourceFile.size,
      n: state.summary.n,
      m: state.summary.m,
      p: state.summary.p,
      nnzA: state.summary.nnzA,
      nnzG: state.summary.nnzG,
    },
    status: result.status,
    statusCode: result.statusCode,
    primal: result.primal,
    dual: result.dual,
    slack: result.slack,
    info: result.info,
    kkt: message.kkt,
    timing: message.timing,
    memory: message.memory,
  };
  window.ecosLargeLastResult = state.result;
  renderResult(state.result, message.memory);
  setStatus(`Solve complete: ${result.status}`, result.status.startsWith("optimal") ? "ready" : "pending");
  updateControls();
}

function createWorker(statusMessage = "Loading ECOS WASM in worker…") {
  state.worker?.terminate();
  state.workerEpoch += 1;
  const epoch = state.workerEpoch;
  state.workerReady = false;
  state.worker = new Worker("./worker.js", { type: "module" });
  state.worker.addEventListener("message", ({ data }) => handleWorkerMessage(epoch, data));
  state.worker.addEventListener("error", (event) => {
    if (epoch !== state.workerEpoch) return;
    state.workerReady = false;
    state.solving = false;
    setStatus("Worker failed", "failed");
    showError(event.message || "Unknown worker error");
    updateControls();
  });
  state.worker.addEventListener("messageerror", () => {
    if (epoch !== state.workerEpoch) return;
    showError("Worker returned an unreadable message.");
  });
  setStatus(statusMessage);
  updateControls();
}

async function loadSelectedFile(file) {
  clearError();
  state.problem = null;
  state.summary = null;
  state.result = null;
  window.ecosLargeLastResult = null;
  elements.result.textContent = "尚未求解。";
  elements.kkt.textContent = "尚未求解。";
  elements.summary.textContent = "Reading local file…";
  updateControls();

  if (!file.name.toLowerCase().endsWith(".json")) throw new TypeError("Select a file with a .json extension.");
  if (file.type && file.type !== "application/json") throw new TypeError(`Unsupported file type: ${file.type}`);
  if (file.size > LIMITS.maxFileBytes) {
    throw new RangeError(`File exceeds the ${LIMITS.maxFileBytes.toLocaleString()} byte limit.`);
  }

  const readStarted = performance.now();
  const text = await file.text();
  const fileReadTimeMs = performance.now() - readStarted;
  const parseStarted = performance.now();
  const parsed = JSON.parse(text);
  const parseTimeMs = performance.now() - parseStarted;
  const preflightStarted = performance.now();
  const validated = validateProblem(parsed);
  const preflightTimeMs = performance.now() - preflightStarted;

  state.problem = validated.problem;
  state.summary = validated.summary;
  state.sourceFile = file;
  state.timing = { fileReadTimeMs, parseTimeMs, preflightTimeMs };
  renderProblemSummary(file, state.summary, state.workerReady);
  setStatus(state.workerReady ? "Ready to solve" : "Problem loaded. Waiting for ECOS WASM…", state.workerReady ? "ready" : "pending");
  updateControls();
}

elements.fileInput.addEventListener("change", async () => {
  const [file] = elements.fileInput.files;
  if (!file) return;
  try {
    await loadSelectedFile(file);
  } catch (error) {
    elements.summary.textContent = "No valid problem loaded.";
    showError(error);
    setStatus(state.workerReady ? "Select a valid problem.json file." : "Loading ECOS WASM in worker…", state.workerReady ? "ready" : "pending");
    updateControls();
  }
});

elements.solveButton.addEventListener("click", () => {
  if (!state.workerReady || !state.problem || state.solving) return;
  clearError();
  state.solving = true;
  state.result = null;
  window.ecosLargeLastResult = null;
  state.requestId += 1;
  setStatus("Solving…", "pending");
  elements.result.textContent = "ECOS is solving in a Web Worker. The page remains responsive.";
  elements.kkt.textContent = "Waiting for solution.";
  updateControls();
  state.worker.postMessage({
    type: "solve",
    requestId: state.requestId,
    problem: state.problem,
    timing: state.timing,
  });
});

elements.cancelButton.addEventListener("click", () => {
  if (!state.solving) return;
  state.requestId += 1;
  state.solving = false;
  state.result = null;
  window.ecosLargeLastResult = null;
  state.worker.terminate();
  state.worker = null;
  elements.result.textContent = "Solve canceled. The worker was terminated.";
  elements.kkt.textContent = "No KKT result for the canceled solve.";
  createWorker("Solve canceled. Reloading ECOS WASM…");
});

elements.downloadButton.addEventListener("click", () => {
  if (!state.result) return;
  const blob = new Blob([`${JSON.stringify(state.result, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const baseName = state.sourceFile.name.replace(/\.json$/i, "").replace(/[^a-zA-Z0-9._-]+/g, "-") || "problem";
  link.href = url;
  link.download = `${baseName}-ecos-result.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
});

createWorker();
