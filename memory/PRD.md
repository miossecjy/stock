# StockFolio - Portfolio Tracker

## Original Problem Statement
Build a portal through which a user can track their stock portfolio in real time.

## User Requirements
- Real-time stock tracking with Alpha Vantage API
- Crypto tracking with CoinGecko API (separate section)
- Browser push notifications for price alerts
- JWT authentication
- US stocks focus

## Architecture
- **Backend**: FastAPI with MongoDB (motor async driver)
- **Frontend**: React with Tailwind CSS, Shadcn UI components
- **APIs**: Alpha Vantage (stocks), CoinGecko (crypto)
- **Notifications**: Browser Push API

## What's Been Implemented (Dec 2025)

### Core Features
- [x] User authentication (register, login, JWT tokens)
- [x] Stock holdings CRUD (add, edit, delete)
- [x] Stock watchlist management
- [x] Real-time stock quotes (Alpha Vantage)
- [x] Portfolio dashboard with summary cards
- [x] Performance chart (recharts)
- [x] Crypto holdings CRUD
- [x] Crypto watchlist management
- [x] Top cryptocurrencies market view (CoinGecko)
- [x] Crypto portfolio summary
- [x] Price alerts for stocks and crypto
- [x] Browser push notifications when target price hit
- [x] Alert conditions: above/below target price
- [x] Active and triggered alerts management

### UI/UX
- Dark theme "Obsidian Ledger"
- Chivo + Manrope fonts
- Responsive design
- Tabs for Crypto (Holdings, Watchlist, Market)
- Tabs for Alerts (Active, Triggered)

## API Endpoints
- Auth: /api/auth/register, /api/auth/login, /api/auth/me
- Holdings: /api/holdings (CRUD)
- Watchlist: /api/watchlist (CRUD)
- Stocks: /api/stocks/quote, /api/stocks/search, /api/portfolio/summary
- Crypto: /api/crypto/top, /api/crypto/holdings, /api/crypto/watchlist, /api/crypto/portfolio/summary
- Alerts: /api/alerts (CRUD), /api/alerts/check, /api/alerts/{id}/reset

## Prioritized Backlog

### P0 (Critical)
- None

### P1 (High Priority)
- Email notifications for alerts (when user offline)
- Historical portfolio performance tracking
- CSV/data export

### P2 (Medium Priority)
- Multiple portfolios support
- News integration per stock/crypto
- Social sharing of portfolio performance
- Percentage change alerts (in addition to target price)

## Next Tasks
1. Add email notifications via SendGrid/Resend for offline alerts
2. Implement historical portfolio value tracking with charts
3. Add dividend tracking for stocks
