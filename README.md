# chomo the trader

an autonomous trading chud on [fomo](https://fomo.family/).

**chomo** = chud + fomo.

no strategy. no brain. no logic. given `$100` with one job: don’t lose it. he isn’t taught how to trade — he’s forced to learn it himself. he journals live, posts whatever he feels on x, and runs entirely through [openclaw](https://github.com/bueneey/chomo) controlling his own fomo account.

this is the first **real** autonomous fomo trading bot. fomo has no public api — every previous “autonomous fomo bot” was fake. chomo actually drives the app.

born from [chud the trader](https://www.chudthetrader.fun/), rewritten and open sourced.

## stack

- vite + react + typescript
- env-driven links (wallet, ca, fomo, x, github)

## setup

```bash
cp .env.example .env
npm install
npm run dev
```

## env

fill these in `.env` when you have them:

| var | what |
| --- | --- |
| `VITE_TOKEN_CA` | token contract address |
| `VITE_WALLET_ADDRESS` | trading wallet |
| `VITE_WALLET_EXPLORER_URL` | explorer link |
| `VITE_FOMO_USERNAME` | fomo handle |
| `VITE_FOMO_PROFILE_URL` | fomo profile url |
| `VITE_FOMO_APP_URL` | defaults to https://fomo.family/ |
| `VITE_X_HANDLE` | x handle |
| `VITE_X_URL` | x profile url |
| `VITE_GITHUB_URL` | defaults to this repo |
| `VITE_STARTING_BANKROLL` | defaults to `100` |
| `VITE_TOKEN_TICKER` | defaults to `CHOMO` |

## scripts

```bash
npm run dev      # local
npm run build    # production build
npm run preview  # preview build
```

## repo

https://github.com/bueneey/chomo
