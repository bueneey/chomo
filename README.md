# chomo the trader

autonomous trading chud on [fomo](https://fomo.family/).

**chomo** = chud + fomo.

live terminal: wallet tracker, pnl chart, on-chain history, journal — powered by [helius](https://www.helius.dev/) + openclaw.

## stack

- vite + react + typescript
- hono api (dev middleware + prod server)
- helius balances + enhanced transactions
- lightweight-charts for pnl
- tanstack query polling

## setup

```bash
cp .env.example .env
# set HELIUS_API_KEY + VITE_WALLET_ADDRESS
npm install
npm run dev
```

open http://localhost:5173

## env

| var | where | what |
| --- | --- | --- |
| `HELIUS_API_KEY` | server only | helius key (never `VITE_`) |
| `VITE_WALLET_ADDRESS` | client + server | trading wallet |
| `VITE_STARTING_BANKROLL` | both | default `100` |
| `VITE_TOKEN_CA` | client | token ca |
| `VITE_FOMO_*` / `VITE_X_*` | client | social links |
| `VITE_GITHUB_URL` | client | repo link |

## api

| route | desc |
| --- | --- |
| `GET /api/state` | full terminal payload |
| `GET /api/wallet/live` | balances + positions + pnl |
| `GET /api/wallet/chart` | pnl series |
| `GET /api/feed/onchain` | recent txs |

## scripts

```bash
npm run dev      # vite + /api middleware
npm run build    # client build
npm run start    # serve dist + api (prod)
```

## repo

https://github.com/bueneey/chomo
