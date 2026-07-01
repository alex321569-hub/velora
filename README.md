# Velora

Velora is a personal stock search and analysis web app built with Next.js, TypeScript, and Tailwind CSS.

It provides a clean search-first interface, autocomplete for US and Korean tickers, Yahoo Finance powered market data, recent prices, and technical analysis cards.

## Tech Stack

- Next.js
- TypeScript
- Tailwind CSS
- API Routes
- Yahoo Finance provider
- Generated stock universe for NASDAQ, NYSE, AMEX, and ETFs

## Local Setup

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env.local
```

Run the development server:

```bash
npm run dev
```

Open the app:

```text
http://localhost:3000
```

## Environment Variables

Environment variables are managed in `.env.local`.

```env
MARKET_PROVIDER=yahoo
```

Available values:

- `yahoo`: Uses Yahoo Finance for quote and historical OHLCV data.
- `mock`: Uses local development mock data.

Do not commit `.env` or `.env.local`.

## Stock Universe

Velora uses a generated stock universe file:

```text
lib/market/generated/stockUniverse.json
```

To refresh NASDAQ, NYSE, AMEX, and ETF symbols:

```bash
npm run update:stock-universe
```

The app also has manual Korean aliases for frequently used symbols such as `NVDA`, `AAPL`, `TSLA`, and `005930`.

## Build

Run a production build:

```bash
npm run build
```

## Vercel Deployment

1. Push this project to GitHub.
2. Go to [Vercel](https://vercel.com).
3. Import the GitHub repository.
4. Keep the framework preset as `Next.js`.
5. Add the environment variable:

```env
MARKET_PROVIDER=yahoo
```

6. Deploy.

You can start with a default Vercel URL such as:

```text
velora.vercel.app
velora-stock.vercel.app
my-velora.vercel.app
```

## Custom Domain

To connect a domain such as `velora.ai`:

1. Open the project in Vercel.
2. Go to `Settings` -> `Domains`.
3. Add your custom domain.
4. Follow Vercel's DNS instructions at your domain registrar.
5. Wait for DNS verification to complete.

## Disclaimer

Velora is intended for personal research. Market data may be delayed, incomplete, or unavailable. This app is for reference only and is not investment advice.
