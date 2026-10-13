import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const [mode, rootArgument] = process.argv.slice(2);
if (!["--source", "--deployment"].includes(mode) || !rootArgument) {
  console.error("Usage: node build-tools/verify-ecos-deployment.mjs (--source|--deployment) <ecos-directory>");
  process.exit(2);
}

const root = resolve(rootArgument);
const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
const failures = [];

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function describe(bytes) {
  return { size_bytes: bytes.length, sha256: digest(bytes) };
}

function check(condition, message) {
  if (!condition) failures.push(message);
}

function checkBytes(label, bytes, expected) {
  const actual = describe(bytes);
  check(actual.size_bytes === expected?.size_bytes,
    `${label} size mismatch: expected ${expected?.size_bytes}, got ${actual.size_bytes}`);
  check(actual.sha256 === expected?.sha256,
    `${label} SHA-256 mismatch: expected ${expected?.sha256}, got ${actual.sha256}`);
  return actual;
}

function toCanonicalLf(bytes) {
  const output = [];
  for (let index = 0; index < bytes.length; index += 1) {
    if (bytes[index] !== 0x0d) {
      output.push(bytes[index]);
      continue;
    }
    check(bytes[index + 1] === 0x0a, "ecos.js contains a lone CR byte");
  }
  return Buffer.from(output);
}

function toCrlf(bytes) {
  const output = [];
  for (const byte of bytes) {
    if (byte === 0x0a) output.push(0x0d);
    output.push(byte);
  }
  return Buffer.from(output);
}

check(manifest.schema_version === 2, `manifest schema_version must be 2, got ${manifest.schema_version}`);
check(/^[0-9a-f]{40}$/.test(manifest.source_commit || ""), "manifest source_commit must be a full lowercase Git SHA");

const js = manifest.artifacts?.find(({ file }) => file === "ecos.js");
const wasm = manifest.artifacts?.find(({ file }) => file === "ecos.wasm");
check(Boolean(js), "manifest is missing ecos.js metadata");
check(Boolean(wasm), "manifest is missing ecos.wasm metadata");

if (js) {
  check(js.upstream_build_artifact?.line_endings === "CRLF", "ecos.js upstream line_endings must be CRLF");
  check(js.deployed_artifact?.line_endings === "LF", "ecos.js deployment line_endings must be LF");
  check(js.deployed_artifact?.normalization === "CRLF_TO_LF", "ecos.js deployment normalization must be CRLF_TO_LF");

  const raw = await readFile(join(root, js.file));
  const canonicalLf = toCanonicalLf(raw);
  checkBytes("ecos.js deployed artifact", canonicalLf, js.deployed_artifact);
  checkBytes("ecos.js reconstructed upstream artifact", toCrlf(canonicalLf), js.upstream_build_artifact);
  if (mode === "--deployment") {
    check(!raw.includes(0x0d), "deployed ecos.js is not canonical LF");
    checkBytes("deployed ecos.js file", raw, js.deployed_artifact);
  }
}

if (wasm) {
  check(wasm.upstream_build_artifact?.representation === "binary", "ecos.wasm upstream representation must be binary");
  check(wasm.deployed_artifact?.representation === "binary", "ecos.wasm deployment representation must be binary");
  check(wasm.deployed_artifact?.normalization === "NONE", "ecos.wasm deployment normalization must be NONE");
  check(wasm.upstream_build_artifact?.sha256 === wasm.deployed_artifact?.sha256,
    "ecos.wasm upstream and deployment SHA-256 values must match");
  check(wasm.upstream_build_artifact?.size_bytes === wasm.deployed_artifact?.size_bytes,
    "ecos.wasm upstream and deployment sizes must match");
  const bytes = await readFile(join(root, wasm.file));
  checkBytes("ecos.wasm upstream artifact", bytes, wasm.upstream_build_artifact);
  checkBytes("ecos.wasm deployed artifact", bytes, wasm.deployed_artifact);
}

const source = manifest.corresponding_source;
check(Boolean(source), "manifest is missing corresponding_source metadata");
if (source) {
  const bytes = await readFile(join(root, source.file));
  checkBytes("corresponding source archive", bytes, source);
}

if (failures.length > 0) {
  console.error("ECOS deployment integrity verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`ECOS ${mode === "--source" ? "source" : "deployment"} integrity verified`);
console.log(`source_commit=${manifest.source_commit}`);
console.log(`ecos.js deployment=${js.deployed_artifact.sha256}`);
console.log(`ecos.wasm deployment=${wasm.deployed_artifact.sha256}`);
console.log(`source bundle=${source.sha256}`);
