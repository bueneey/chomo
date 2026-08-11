import type { Plugin } from 'vite'
import { api } from './api'

function loadEnvFile() {
  try {
    // Lazy load dotenv-like from Vite's loaded env; process.env already hydrated by Vite
  } catch {
    /* ignore */
  }
}

export function chomoApiPlugin(): Plugin {
  return {
    name: 'chomo-api',
    configureServer(server) {
      loadEnvFile()
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api')) return next()

        try {
          const host = req.headers.host || 'localhost'
          const url = new URL(req.url, `http://${host}`)
          const headers = new Headers()
          for (const [key, value] of Object.entries(req.headers)) {
            if (value) headers.set(key, Array.isArray(value) ? value.join(',') : value)
          }

          const request = new Request(url, {
            method: req.method,
            headers,
          })

          const response = await api.fetch(request)
          res.statusCode = response.status
          response.headers.forEach((value, key) => {
            res.setHeader(key, value)
          })
          const body = Buffer.from(await response.arrayBuffer())
          res.end(body)
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'api error' }))
        }
      })
    },
  }
}
