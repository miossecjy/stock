# StockFolio - Portfolio Tracker

## Original Problem Statement
Build a portal through which a user can track their stock portfolio in real time.

## User Requirements
- Real-time stock tracking with Alpha Vantage API
- Crypto tracking with CoinGecko API (separate section)
- JWT authentication
- US stocks focus

## Architecture
- **Backend**: FastAPI with MongoDB (motor async driver)
- **Frontend**: React with Tailwind CSS, Shadcn UI components
- **APIs**: Alpha Vantage (stocks), CoinGecko (crypto)

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

### UI/UX
- Dark theme "Obsidian Ledger"
- Chivo + Manrope fonts
- Responsive design
- Tabs for Crypto (Holdings, Watchlist, Market)

## Prioritized Backlog
### P0 (Critical)
- None

### P1 (High Priority)
- Price alerts and notifications
- Historical portfolio performance tracking
- CSV/data export

### P2 (Medium Priority)
- Multiple portfolios support
- News integration per stock/crypto
- Social sharing of portfolio performance

## Next Tasks
1. Add price alerts for stocks and crypto
2. Implement historical portfolio value tracking
3. Add dividend tracking for stocks
