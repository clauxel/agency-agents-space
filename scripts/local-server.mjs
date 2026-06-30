import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { handleRequest } from '../worker/index.js'

const root = new URL('../public/', import.meta.url)
const port = Number(process.env.PORT || process.argv.find((arg) => arg.startsWith('--port='))?.split('=')[1] || 8797)

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8'
  if (file.endsWith('.css')) return 'text/css; charset=utf-8'
  if (file.endsWith('.js')) return 'application/javascript; charset=utf-8'
  if (file.endsWith('.json') || file.endsWith('.webmanifest')) return 'application/json; charset=utf-8'
  if (file.endsWith('.xml')) return 'application/xml; charset=utf-8'
  if (file.endsWith('.svg')) return 'image/svg+xml'
  if (file.endsWith('.jpg')) return 'image/jpeg'
  if (file.endsWith('.png')) return 'image/png'
  return 'text/plain; charset=utf-8'
}

const assetBinding = {
  async fetch(request) {
    const url = new URL(request.url)
    let file = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\//, '')
    if (file.endsWith('/')) file += 'index.html'
    try {
      const bytes = await readFile(new URL(file, root))
      return new Response(bytes, { status: 200, headers: { 'Content-Type': contentType(file) } })
    } catch {
      return new Response('not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }
  },
}

const server = createServer(async (req, res) => {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const body = chunks.length ? Buffer.concat(chunks) : undefined
  const request = new Request('http://127.0.0.1:' + port + req.url, {
    method: req.method,
    headers: req.headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
  })
  const response = await handleRequest(request, { SITE_ASSETS: assetBinding })
  res.writeHead(response.status, Object.fromEntries(response.headers.entries()))
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  const arrayBuffer = await response.arrayBuffer()
  res.end(Buffer.from(arrayBuffer))
})

server.listen(port, '127.0.0.1', () => {
  console.log('agency-agents.space local server listening on http://127.0.0.1:' + port + '/')
})

process.on('SIGTERM', () => server.close(() => process.exit(0)))
process.on('SIGINT', () => server.close(() => process.exit(0)))
