# ECOS WebAssembly source and build information

This directory distributes an ECOS WebAssembly build together with the corresponding source used to build it.

## Version and provenance

- Repository: `lymax22/ECOS`
- ECOS version: `2.0.8`
- Source commit: `e2b58055e3fc8a7757c20284f19de27ecd8c3045`
- Source bundle: [`source/ecos-wasm-source-e2b58055.zip`](./source/ecos-wasm-source-e2b58055.zip)
- Source bundle SHA-256: `4985eeadb39c16f72966f5ca3444a32b0ca2f1150a9e288256f341fbda2e5421`
- License: [GNU General Public License, version 3](./LICENSE.txt)

## Build and deployment artifacts

| File | Representation | Normalization | Size (bytes) | SHA-256 |
| --- | --- | --- | ---: | --- |
| `ecos.js` | Upstream validated build artifact (CRLF) | None | 57,827 | `0745ccc847515f620de7c3ac080c708dcfe35e08f77077b62213309fcf6064b5` |
| `ecos.js` | Pages deployment artifact (LF) | `CRLF_TO_LF` | 56,222 | `92e0f8c60004fd8edb74e37a189b430086b37662fcef28d361e25de0a28e070f` |
| `ecos.wasm` | Upstream validated build artifact (binary) | None | 102,184 | `bdd1405bf8b70bb6d596173e8fb11f32ee45f1bf45b1577bb8910e802787f998` |
| `ecos.wasm` | Pages deployment artifact (binary) | `NONE` | 102,184 | `bdd1405bf8b70bb6d596173e8fb11f32ee45f1bf45b1577bb8910e802787f998` |

The copied [`manifest.json`](./manifest.json) records the compiler, integer and floating-point widths, and separate `upstream_build_artifact` and `deployed_artifact` metadata. LF is the canonical Web deployment representation for `ecos.js`; its only change from the validated upstream build artifact is deterministic CRLF-to-LF line-ending normalization. `ecos.wasm` is byte-for-byte identical in both representations.

The `Distributed artifact hashes` section in `BUILD_SOURCE.txt` inside the source archive describes the original validated upstream build artifacts. The source archive itself is unchanged by deployment normalization and retains SHA-256 `4985eeadb39c16f72966f5ca3444a32b0ca2f1150a9e288256f341fbda2e5421`.

The build pipeline runs [`build-tools/verify-ecos-deployment.mjs`](../../../build-tools/verify-ecos-deployment.mjs) before generation, normalizes only the generated `public/tools/ecos/ecos.js`, and then verifies the generated JS, WASM, and corresponding-source archive against the deployment manifest. Any mismatch exits non-zero.

The surrounding blog repository retains its own licensing. ECOS and its corresponding source remain governed by GPL-3.0.
