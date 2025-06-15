# Wheel Options Tracker

_Automatically synced with your [v0.dev](https://v0.dev) deployments_

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/devalpp-9892s-projects/v0-wheel-options-tracker)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.dev-black?style=for-the-badge)](https://v0.dev/chat/projects/aTFqFvgbCSc)

## Overview

This repository will stay in sync with your deployed chats on [v0.dev](https://v0.dev).
Any changes you make to your deployed app will be automatically pushed to this repository from [v0.dev](https://v0.dev).

## Local Development Setup

1. Clone the repository:

```bash
git clone https://github.com/yourusername/OptionsIncomeTracker.git
cd OptionsIncomeTracker
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env.local` file in the root directory with the following environment variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Alpha Vantage API (for stock quotes)
NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY=your_alpha_vantage_api_key
```

4. Set up the database:

   - Create a new project in [Supabase](https://supabase.com)
   - Run the SQL commands from `scripts/create-tables.sql` in your Supabase SQL editor
   - Update the environment variables with your Supabase project credentials

5. Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Required Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase project's anon/public key
- `NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY`: Your Alpha Vantage API key for fetching stock quotes

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
