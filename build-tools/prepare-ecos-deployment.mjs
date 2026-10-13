import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(process.argv[2] || "public/tools/ecos");
const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
const artifact = manifest.artifacts?.find(({ file }) => file === "ecos.js");

if (artifact?.deployed_artifact?.normalization !== "CRLF_TO_LF") {
  throw new Error("manifest.json must declare ecos.js deployment normalization as CRLF_TO_LF");
}
if (artifact.deployed_artifact.line_endings !== "LF") {
  throw new Error("manifest.json must declare LF as the ecos.js deployment representation");
}

const file = join(root, artifact.file);
const input = await readFile(file);
const output = [];
let changed = false;

for (let index = 0; index < input.length; index += 1) {
  const byte = input[index];
  if (byte !== 0x0d) {
    output.push(byte);
    continue;
  }
  if (input[index + 1] !== 0x0a) {
    throw new Error(`${file} contains a lone CR byte; refusing non-CRLF normalization`);
  }
  changed = true;
}

if (changed) {
  await writeFile(file, Buffer.from(output));
  console.log(`Normalized ${artifact.file} from CRLF to canonical LF`);
} else {
  console.log(`${artifact.file} is already canonical LF`);
}
