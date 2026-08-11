import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { api } from './api'

const app = new Hono()
app.route('/', api)
app.use('/*', serveStatic({ root: './dist' }))
app.get('*', serveStatic({ path: './dist/index.html' }))

const port = Number(process.env.PORT || 8787)
console.log(`chomo listening on http://localhost:${port}`)
serve({ fetch: app.fetch, port })
