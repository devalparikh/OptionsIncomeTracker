# Wheel Options Tracker

_Automatically synced with your [v0.dev](https://v0.dev) deployments_

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/devalpp-9892s-projects/v0-wheel-options-tracker)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.dev-black?style=for-the-badge)](https://v0.dev/chat/projects/aTFqFvgbCSc)

## Overview

This repository will stay in sync with your deployed chats on [v0.dev](https://v0.dev).
Any changes you make to your deployed app will be automatically pushed to this repository from [v0.dev](https://v0.dev).

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- pnpm (v8 or later)
- Supabase account
- Alpha Vantage API key
- Alpaca API key and secret

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/OptionsIncomeTracker.git
cd OptionsIncomeTracker
```

2. Install dependencies using pnpm:

```bash
pnpm install
```

3. Create a `.env.local` file in the root directory with the required environment variables (see Environment Variables section below)

4. Set up the database:

   - Create a new project in [Supabase](https://supabase.com)
   - Run the SQL commands from `scripts/create-tables.sql` in your Supabase SQL editor
   - Update the environment variables with your Supabase project credentials

5. Start the development server:

```bash
pnpm dev
```

The application will be available at `http://localhost:3000`

### Development

- Run development server: `pnpm dev`
- Build for production: `pnpm build`
- Start production server: `pnpm start`
- Run linting: `pnpm lint`
- Run type checking: `pnpm type-check`

## Required Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase project's anon/public key
- `ALPHA_VANTAGE_API_KEY`: Your Alpha Vantage API key for fetching stock quotes
- `ALPACA_API_KEY`: Your Alpaca API key for backup market data
- `ALPACA_SECRET_KEY`: Your Alpaca secret key for backup market data

## Deployment

Your project is live at:

**[https://vercel.com/devalpp-9892s-projects/v0-wheel-options-tracker](https://vercel.com/devalpp-9892s-projects/v0-wheel-options-tracker)**

## Build your app

Continue building your app on:

**[https://v0.dev/chat/projects/aTFqFvgbCSc](https://v0.dev/chat/projects/aTFqFvgbCSc)**

## How It Works

1. Create and modify your project using [v0.dev](https://v0.dev)
2. Deploy your chats from the v0 interface
3. Changes are automatically pushed to this repository
4. Vercel deploys the latest version from this repository

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```bash
# Supabase (Public keys - safe to expose)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Alpha Vantage (Private API Key - server-side only)
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_api_key
# Note: Free tier has a limit of 25 requests per day. When rate limit is hit, the app will fall back to Alpaca.

# Alpaca (Private API Keys - server-side only)
ALPACA_API_KEY=your_alpaca_api_key
ALPACA_SECRET_KEY=your_alpaca_secret_key
# Note: Using paper trading mode for market data access.
```

### API Keys Setup

1. **Alpha Vantage API Key**

   - Sign up at [Alpha Vantage](https://www.alphavantage.co/support/#api-key)
   - Free tier includes 25 API requests per day
   - When rate limit is reached, the app automatically falls back to Alpaca

2. **Alpaca API Key**
   - Sign up at [Alpaca](https://app.alpaca.markets/signup)
   - Create a paper trading account
   - Get your API key and secret from the dashboard
   - Used as a backup when Alpha Vantage rate limit is reached

### Adding New Dependencies

When adding new dependencies, use pnpm:

```bash
# Add a production dependency
pnpm add package-name

# Add a development dependency
pnpm add -D package-name

# Add a global dependency
pnpm add -g package-name
```

### Updating Dependencies

To update dependencies:

```bash
# Update all dependencies
pnpm update

# Update a specific package
pnpm update package-name

# Update to the latest version of a package
pnpm update package-name@latest
```
