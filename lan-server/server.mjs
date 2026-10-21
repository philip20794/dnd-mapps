import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createKiApiBridge, KiApiBridgeError } from './kiApiBridge.mjs'

const dist = resolve(fileURLToPath(new URL('../dist/', import.meta.url)))
const host = process.env.LAN_HOST || '127.0.0.1'
const port = Number(process.env.LAN_PORT || 4173)
const bridge = createKiApiBridge({
  baseUrl: process.env.KI_API_BASE_URL || 'http://127.0.0.1:3100',
  apiKey: process.env.KI_API_KEY,
})
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}
const json = (res, status, body) => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  res.end(JSON.stringify(body))
}

const readBody = async (req) => {
  const parts = []
  let bytes = 0
  for await (const part of req) {
    bytes += part.length
    if (bytes > 16_384) throw new KiApiBridgeError(413, 'request_too_large')
    parts.push(part)
  }
  try {
    return JSON.parse(Buffer.concat(parts).toString('utf8'))
  } catch {
    throw new KiApiBridgeError(400, 'invalid_json')
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host || 'localhost'}`)
    if (url.pathname === '/api/ki-map-design') {
      if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' })
      if (!req.headers['content-type']?.toLowerCase().startsWith('application/json'))
        return json(res, 415, { error: 'unsupported_media_type' })
      // A cross-origin website must not be able to use the user's LAN API.
      if (req.headers.origin && req.headers.origin !== url.origin)
        return json(res, 403, { error: 'cross_origin_forbidden' })
      return json(res, 200, await bridge.propose(await readBody(req)))
    }
    if (url.pathname === '/api/ki-health') {
      if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' })
      const ok = await bridge.health()
      return json(res, ok ? 200 : 503, { status: ok ? 'ok' : 'unavailable' })
    }
    if (url.pathname.startsWith('/api/')) return json(res, 404, { error: 'not_found' })
    if (req.method !== 'GET' && req.method !== 'HEAD')
      return json(res, 405, { error: 'method_not_allowed' })
    let pathname
    try { pathname = decodeURIComponent(url.pathname) } catch { return json(res, 400, { error: 'bad_path' }) }
    const filename = resolve(dist, '.' + pathname)
    if (filename !== dist && !filename.startsWith(dist + sep)) return json(res, 403, { error: 'forbidden' })
    let target = filename
    try {
      const info = await stat(target)
      if (!info.isFile()) target = resolve(dist, 'index.html')
    } catch {
      if (extname(pathname)) return json(res, 404, { error: 'not_found' })
      target = resolve(dist, 'index.html')
    }
    const data = await readFile(target)
    res.writeHead(200, {
      'Content-Type': mime[extname(target)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': target.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600',
    })
    res.end(req.method === 'HEAD' ? undefined : data)
  } catch (error) {
    const status = error instanceof KiApiBridgeError ? error.status : 500
    json(res, status, { error: error instanceof KiApiBridgeError ? error.code : 'internal_error' })
  }
})
server.listen(port, host, () => console.log(`DnD Mapps LAN: http://${host}:${port} | KI API: serverseitig`))
