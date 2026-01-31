# StockFolio - Portfolio Tracker

## Original Problem Statement
Build a portal through which a user can track their stock portfolio in real time.

## User Requirements
- Real-time stock tracking with multiple data providers
- European stocks support with REAL-TIME data via Yahoo Finance
- Crypto tracking with CoinGecko API (separate section)
- Browser push notifications for price alerts
- Currency conversion for unified portfolio value
- JWT authentication
- **Multi-language support** (English, French, German, Spanish)

## Architecture
- **Backend**: FastAPI with MongoDB (motor async driver)
- **Frontend**: React with Tailwind CSS, Shadcn UI components
- **APIs**: 
  - Yahoo Finance (European stocks - FREE, no API key)
  - Finnhub (US stocks - 60 req/min)
  - Alpha Vantage (fallback)
  - CoinGecko (crypto)
  - Frankfurter (exchange rates)
- **Notifications**: Browser Push API
- **i18n**: Custom LanguageContext with localStorage persistence

## What's Been Implemented (Jan 2026)

### Core Features
- [x] User authentication (register, login, JWT tokens)
- [x] Stock holdings CRUD (add, edit, delete)
- [x] Stock watchlist management
- [x] Real-time stock quotes (Finnhub for US, **Yahoo Finance for European**)
- [x] Portfolio dashboard with summary cards
- [x] Performance chart (recharts)
- [x] **European stocks support with REAL DATA via Yahoo Finance**
- [x] **Currency conversion** (USD, EUR, GBP, CHF, DKK, SEK, NOK)
- [x] Live exchange rates from Frankfurter API
- [x] Currency selector with preference persistence
- [x] Crypto holdings CRUD
- [x] Crypto watchlist management
- [x] Top cryptocurrencies market view (CoinGecko)
- [x] Crypto portfolio summary
- [x] Price alerts for stocks and crypto
- [x] Browser push notifications when target price hit
- [x] **Language selection feature** (EN, FR, DE, ES)
- [x] Language selector dropdown in navbar
- [x] Dedicated Settings page for language management

### Data Provider Priority
1. **European Stocks**: Yahoo Finance (free, real-time) → Mock fallback
2. **US Stocks**: Finnhub (60 req/min) → Yahoo Finance → Alpha Vantage → Mock

### Supported Languages
- 🇬🇧 English (EN) - Default
- 🇫🇷 Français (FR) - French
- 🇩🇪 Deutsch (DE) - German
- 🇪🇸 Español (ES) - Spanish

### Supported Currencies
- $ USD (US Dollar)
- € EUR (Euro)
- £ GBP (British Pound)
- CHF (Swiss Franc)
- kr DKK (Danish Krone)
- kr SEK (Swedish Krona)
- kr NOK (Norwegian Krone)

### Supported European Exchanges
- 🇬🇧 London (.LON) - GBP
- 🇩🇪 Frankfurt (.DEX) - EUR
- 🇫🇷 Paris (.PAR) - EUR
- 🇳🇱 Amsterdam (.AMS) - EUR
- 🇨🇭 Zurich (.SWX) - CHF
- 🇮🇹 Milan (.MIL) - EUR
- 🇪🇸 Madrid (.MAD) - EUR
- 🇩🇰 Copenhagen (.CPH) - DKK
- 🇸🇪 Stockholm (.STO) - SEK
- 🇳🇴 Oslo (.OSL) - NOK

### UI/UX
- Dark theme "Obsidian Ledger"
- Chivo + Manrope fonts
- Responsive design
- Currency selector in dashboard header
- Exchange color-coding in search & holdings
- Language selector dropdown in navbar with flag icons
- Settings page with language cards

## API Endpoints
- Auth: /api/auth/register, /api/auth/login, /api/auth/me
- Holdings: /api/holdings (CRUD)
- Watchlist: /api/watchlist (CRUD)
- Stocks: /api/stocks/quote, /api/stocks/search, /api/stocks/popular
- Currency: /api/currencies, /api/exchange-rates
- Portfolio: /api/portfolio/summary?display_currency={code}
- Crypto: /api/crypto/top, /api/crypto/holdings, /api/crypto/watchlist, /api/crypto/summary
- Alerts: /api/alerts (CRUD), /api/alerts/check

## Key Files
- `/app/frontend/src/context/LanguageContext.js` - Translations and language provider
- `/app/frontend/src/pages/Settings.jsx` - Language settings page
- `/app/frontend/src/components/Layout.jsx` - Navbar with language selector
- `/app/backend/server.py` - FastAPI backend

## Prioritized Backlog

### P1 (High Priority)
- Email notifications for alerts
- Historical portfolio performance tracking
- CSV/data export

### P2 (Medium Priority)
- Multiple portfolios support
- News integration per stock/crypto
- Percentage change alerts

### Known Limitations
- European stocks use mock data (Finnhub free tier only supports US stocks)
- API rate limits may trigger mock data fallback
- Real-time data refreshes every 60 seconds

## Next Tasks
1. Add email notifications via SendGrid/Resend
2. Implement historical portfolio value tracking with charts
3. Add CSV export for holdings and transactions
4. Explore premium API for European stocks
