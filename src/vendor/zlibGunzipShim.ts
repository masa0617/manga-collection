// zlibjs's browser build (used internally by kuromoji's BrowserDictionaryLoader
// to gunzip the fetched dictionary files) attaches its exports via a legacy
// top-level `this` reference instead of an explicit `module.exports = ...`
// (see the trailing `.call(this)` at the end of the vendor file). That works
// under Node's real CommonJS require() (where a script's top-level `this` is
// `module.exports`) but not under Vite/Rollup's ESM-based bundling, which
// doesn't preserve it - kuromoji ends up with an object missing `.Zlib`
// entirely and throws "Cannot read properties of undefined (reading
// 'Gunzip')" the moment it tries to decompress a dictionary file.
//
// Evaluating the vendor source with `this` explicitly bound to a fresh
// exports object reproduces the semantics it actually depends on. Vite is
// configured (see vite.config.ts) to resolve kuromoji's
// `require("zlibjs/bin/gunzip.min.js")` to this file instead of the raw
// package export.
import zlibSource from 'zlibjs/bin/gunzip.min.js?raw'

const moduleExports: { Zlib?: unknown } = {}
new Function(zlibSource).call(moduleExports)

// Also a named export, not just default: Rollup's CJS-interop helper
// (used by kuromoji's `require(...)` of this module) shallow-copies the
// *named* exports of an ES module onto the object it hands back - a
// default-only export leaves that object without a usable `.Zlib`.
export const Zlib = moduleExports.Zlib
export default moduleExports
