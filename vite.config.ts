import { defineConfig, type Plugin, type Connect } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { createReadStream, existsSync } from 'node:fs'

// vite dev/preview's static file server (sirv) auto-sets
// "Content-Encoding: gzip" for any request path ending in .gz, on the
// (usually correct) assumption that it's serving a precompressed sibling of
// some other asset. That's wrong for kuromoji's dictionary files: the
// browser transparently decompresses the response before kuromoji's own
// manual gunzip step (see zlibGunzipShim.ts) ever sees it, which then fails
// with "invalid file signature" on the already-decompressed bytes. Serving
// these specific files directly, with Content-Encoding deliberately absent,
// keeps the bytes kuromoji receives identical to what's on disk.
function serveDictWithoutContentEncoding(): Plugin {
  const handler: Connect.NextHandleFunction = (req, res, next) => {
    const url = req.url ?? ''
    if (!url.startsWith('/dict/kuromoji/') || !url.endsWith('.dat.gz')) return next()
    const filePath = path.join(__dirname, 'public', url)
    if (!existsSync(filePath)) return next()
    res.setHeader('Content-Type', 'application/octet-stream')
    createReadStream(filePath).pipe(res)
  }
  return {
    name: 'serve-kuromoji-dict-raw',
    configureServer: (server) => {
      server.middlewares.use(handler)
    },
    configurePreviewServer: (server) => {
      server.middlewares.use(handler)
    },
  }
}

// base is overridden at build time for GitHub Pages via VITE_BASE env var
export default defineConfig({
  plugins: [react(), serveDictWithoutContentEncoding()],
  base: process.env.VITE_BASE || '/',
  resolve: {
    alias: {
      // kuromoji's dictionary loader (used by both Node and browser code
      // paths) calls Node's path.join() unconditionally - without a real
      // implementation in the browser bundle this throws at runtime
      // ("path.join is not a function"), so it's polyfilled explicitly
      // rather than left to Vite's default externalize-and-stub behavior.
      path: 'path-browserify',
      // See src/vendor/zlibGunzipShim.ts - works around zlibjs's exports
      // being lost when bundled for the browser.
      'zlibjs/bin/gunzip.min.js': path.resolve(__dirname, 'src/vendor/zlibGunzipShim.ts'),
    },
  },
})
