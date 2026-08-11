import { Hono } from 'hono'
import { getChart, getChomoState, getFeed, getLiveWallet } from './helius'

export const api = new Hono().basePath('/api')

api.get('/health', (c) => c.json({ ok: true, service: 'chomo' }))

api.get('/state', async (c) => {
  try {
    const state = await getChomoState()
    return c.json(state)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'state failed'
    return c.json({ error: message }, 500)
  }
})

api.get('/wallet/live', async (c) => {
  try {
    const wallet = await getLiveWallet()
    if (!wallet) return c.json({ error: 'wallet not configured' }, 404)
    return c.json(wallet)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'wallet live failed'
    return c.json({ error: message }, 500)
  }
})

api.get('/wallet/chart', async (c) => {
  try {
    return c.json(await getChart())
  } catch (err) {
    const message = err instanceof Error ? err.message : 'chart failed'
    return c.json({ error: message }, 500)
  }
})

api.get('/feed/onchain', async (c) => {
  try {
    const limit = Number(c.req.query('limit') || 50)
    return c.json(await getFeed(Math.min(100, Math.max(1, limit))))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'feed failed'
    return c.json({ error: message }, 500)
  }
})
