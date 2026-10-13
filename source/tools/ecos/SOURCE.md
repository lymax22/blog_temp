# ECOS WebAssembly source and build information

This directory distributes an ECOS WebAssembly build together with the corresponding source used to build it.

## Version and provenance

- Repository: `lymax22/ECOS`
- ECOS version: `2.0.8`
- Source commit: `e2b58055e3fc8a7757c20284f19de27ecd8c3045`
- Source bundle: [`source/ecos-wasm-source-e2b58055.zip`](./source/ecos-wasm-source-e2b58055.zip)
- Source bundle SHA-256: `4985eeadb39c16f72966f5ca3444a32b0ca2f1150a9e288256f341fbda2e5421`
- License: [GNU General Public License, version 3](./LICENSE.txt)

## Distributed artifacts

| File | SHA-256 |
| --- | --- |
| `ecos.js` | `0745ccc847515f620de7c3ac080c708dcfe35e08f77077b62213309fcf6064b5` |
| `ecos.wasm` | `bdd1405bf8b70bb6d596173e8fb11f32ee45f1bf45b1577bb8910e802787f998` |

The copied [`manifest.json`](./manifest.json) records the compiler, integer and floating-point widths, artifact sizes, and the same hashes. `BUILD_SOURCE.txt` inside the source archive records the tested build commands and provenance.

The surrounding blog repository retains its own licensing. ECOS and its corresponding source remain governed by GPL-3.0.
