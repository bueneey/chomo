import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { api } from './api'

const app = new Hono()

app.route('/', api)

app.use(
  '/*',
  serveStatic({
    root: './dist',
    rewriteRequestPath: (path) => (path === '/' ? '/index.html' : path),
  }),
)

// SPA fallback for client routes (/, /feed, /journal)
app.get('*', async (c, next) => {
  if (c.req.path.startsWith('/api')) return next()
  return serveStatic({ root: './dist', path: '/index.html' })(c, next)
})

const port = Number(process.env.PORT || 8787)
console.log(`chomo listening on :${port}`)
serve({ fetch: app.fetch, port })
