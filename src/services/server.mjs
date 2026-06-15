import { createReadStream, existsSync, statSync } from 'node:fs'
import { join, extname, normalize, sep } from 'node:path'
import { createServer } from 'node:http'

const port = Number(process.env.PORT || 4173)
const root = join(process.cwd(), 'dist')
const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

function resolvePath(url = '/') {
  const pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname)
  const requested = normalize(join(root, pathname))
  if (requested !== root && !requested.startsWith(rootPrefix)) return join(root, 'index.html')

  if (existsSync(requested) && statSync(requested).isFile()) return requested

  return join(root, 'index.html')
}

createServer((request, response) => {
  const filePath = resolvePath(request.url)
  const contentType = contentTypes[extname(filePath)] || 'application/octet-stream'

  response.setHeader('Content-Type', contentType)
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')

  createReadStream(filePath)
    .on('error', () => {
      response.statusCode = 404
      response.end('Not found')
    })
    .pipe(response)
}).listen(port, '0.0.0.0', () => {
  console.log(`Cronos Procurement app listening on port ${port}`)
})
