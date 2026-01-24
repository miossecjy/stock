from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'stock-portfolio-secret-key-2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Alpha Vantage (fallback)
ALPHA_VANTAGE_KEY = os.environ.get('ALPHA_VANTAGE_KEY', 'demo')

# Finnhub (primary - 60 req/min)
FINNHUB_API_KEY = os.environ.get('FINNHUB_API_KEY', '')

# Supported currencies
SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "CHF", "DKK", "SEK", "NOK"]

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============ Models ============

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    created_at: str

class HoldingCreate(BaseModel):
    symbol: str
    shares: float
    buy_price: float
    buy_date: Optional[str] = None

class HoldingUpdate(BaseModel):
    shares: Optional[float] = None
    buy_price: Optional[float] = None
    buy_date: Optional[str] = None

class HoldingResponse(BaseModel):
    id: str
    symbol: str
    shares: float
    buy_price: float
    buy_date: str
    user_id: str
    created_at: str

class WatchlistItem(BaseModel):
    symbol: str

class WatchlistResponse(BaseModel):
    id: str
    symbol: str
    user_id: str
    added_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# ============ Crypto Models ============

class CryptoHoldingCreate(BaseModel):
    coin_id: str
    symbol: str
    name: str
    amount: float
    buy_price: float
    buy_date: Optional[str] = None

class CryptoHoldingUpdate(BaseModel):
    amount: Optional[float] = None
    buy_price: Optional[float] = None
    buy_date: Optional[str] = None

class CryptoHoldingResponse(BaseModel):
    id: str
    coin_id: str
    symbol: str
    name: str
    amount: float
    buy_price: float
    buy_date: str
    user_id: str
    created_at: str

class CryptoWatchlistItem(BaseModel):
    coin_id: str
    symbol: str
    name: str

class CryptoWatchlistResponse(BaseModel):
    id: str
    coin_id: str
    symbol: str
    name: str
    user_id: str
    added_at: str

# ============ Price Alert Models ============

class PriceAlertCreate(BaseModel):
    asset_type: str  # "stock" or "crypto"
    symbol: str
    name: str
    target_price: float
    condition: str  # "above" or "below"
    coin_id: Optional[str] = None  # For crypto only

class PriceAlertResponse(BaseModel):
    id: str
    asset_type: str
    symbol: str
    name: str
    target_price: float
    condition: str
    coin_id: Optional[str] = None
    current_price: Optional[float] = None
    triggered: bool
    triggered_at: Optional[str] = None
    user_id: str
    created_at: str

# ============ Auth Helpers ============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS),
        "iat": datetime.now(timezone.utc)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ============ Auth Routes ============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(data: UserCreate):
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": data.email,
        "name": data.name,
        "password": hash_password(data.password),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)
    
    token = create_token(user_id)
    user_response = UserResponse(id=user_id, email=data.email, name=data.name, created_at=user["created_at"])
    return TokenResponse(access_token=token, user=user_response)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"])
    user_response = UserResponse(id=user["id"], email=user["email"], name=user["name"], created_at=user["created_at"])
    return TokenResponse(access_token=token, user=user_response)

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(**current_user)

# ============ Holdings Routes ============

@api_router.get("/holdings", response_model=List[HoldingResponse])
async def get_holdings(current_user: dict = Depends(get_current_user)):
    holdings = await db.holdings.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    return holdings

@api_router.post("/holdings", response_model=HoldingResponse)
async def create_holding(data: HoldingCreate, current_user: dict = Depends(get_current_user)):
    holding_id = str(uuid.uuid4())
    holding = {
        "id": holding_id,
        "symbol": data.symbol.upper(),
        "shares": data.shares,
        "buy_price": data.buy_price,
        "buy_date": data.buy_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "user_id": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.holdings.insert_one(holding)
    return HoldingResponse(**holding)

@api_router.put("/holdings/{holding_id}", response_model=HoldingResponse)
async def update_holding(holding_id: str, data: HoldingUpdate, current_user: dict = Depends(get_current_user)):
    holding = await db.holdings.find_one({"id": holding_id, "user_id": current_user["id"]}, {"_id": 0})
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.holdings.update_one({"id": holding_id}, {"$set": update_data})
        holding.update(update_data)
    
    return HoldingResponse(**holding)

@api_router.delete("/holdings/{holding_id}")
async def delete_holding(holding_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.holdings.delete_one({"id": holding_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Holding not found")
    return {"message": "Holding deleted"}

# ============ Watchlist Routes ============

@api_router.get("/watchlist", response_model=List[WatchlistResponse])
async def get_watchlist(current_user: dict = Depends(get_current_user)):
    items = await db.watchlist.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    return items

@api_router.post("/watchlist", response_model=WatchlistResponse)
async def add_to_watchlist(data: WatchlistItem, current_user: dict = Depends(get_current_user)):
    symbol = data.symbol.upper()
    existing = await db.watchlist.find_one({"symbol": symbol, "user_id": current_user["id"]})
    if existing:
        raise HTTPException(status_code=400, detail="Symbol already in watchlist")
    
    item_id = str(uuid.uuid4())
    item = {
        "id": item_id,
        "symbol": symbol,
        "user_id": current_user["id"],
        "added_at": datetime.now(timezone.utc).isoformat()
    }
    await db.watchlist.insert_one(item)
    return WatchlistResponse(**item)

@api_router.delete("/watchlist/{symbol}")
async def remove_from_watchlist(symbol: str, current_user: dict = Depends(get_current_user)):
    result = await db.watchlist.delete_one({"symbol": symbol.upper(), "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Symbol not in watchlist")
    return {"message": "Removed from watchlist"}

# ============ Stock Data Routes ============

# In-memory cache for stock data (simple approach without Redis)
stock_cache = {}
CACHE_TTL = 300  # 5 minutes

# Exchange rate cache
exchange_rate_cache = {}
EXCHANGE_RATE_CACHE_TTL = 3600  # 1 hour

async def fetch_exchange_rates(base_currency: str = "USD"):
    """Fetch exchange rates from frankfurter.app (free, no API key required)"""
    cache_key = f"rates_{base_currency}"
    now = datetime.now(timezone.utc).timestamp()
    
    if cache_key in exchange_rate_cache:
        cached_data, cached_time = exchange_rate_cache[cache_key]
        if now - cached_time < EXCHANGE_RATE_CACHE_TTL:
            return cached_data
    
    try:
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(
                f"https://api.frankfurter.app/latest",
                params={"from": base_currency},
                timeout=10.0
            )
            data = response.json()
            
            if "rates" in data:
                # Add base currency with rate 1
                rates = {base_currency: 1.0, **data["rates"]}
                exchange_rate_cache[cache_key] = (rates, now)
                return rates
    except Exception as e:
        logger.error(f"Error fetching exchange rates: {e}")
    
    # Fallback rates (approximate)
    return get_fallback_exchange_rates(base_currency)

def get_fallback_exchange_rates(base_currency: str = "USD"):
    """Fallback exchange rates when API is unavailable"""
    # Rates relative to USD
    usd_rates = {
        "USD": 1.0,
        "EUR": 0.92,
        "GBP": 0.79,
        "CHF": 0.88,
        "DKK": 6.87,
        "SEK": 10.45,
        "NOK": 10.85,
        "JPY": 149.50,
        "CAD": 1.36,
        "AUD": 1.53,
    }
    
    if base_currency == "USD":
        return usd_rates
    
    # Convert to requested base currency
    base_rate = usd_rates.get(base_currency, 1.0)
    return {currency: rate / base_rate for currency, rate in usd_rates.items()}

def get_currency_from_symbol(symbol: str) -> str:
    """Determine currency from stock symbol"""
    if ".LON" in symbol:
        return "GBP"
    elif ".SWX" in symbol:
        return "CHF"
    elif ".CPH" in symbol:
        return "DKK"
    elif ".STO" in symbol:
        return "SEK"
    elif ".OSL" in symbol:
        return "NOK"
    elif any(suffix in symbol for suffix in [".DEX", ".PAR", ".AMS", ".MIL", ".MAD", ".BRU"]):
        return "EUR"
    return "USD"

async def convert_to_currency(amount: float, from_currency: str, to_currency: str) -> float:
    """Convert amount from one currency to another"""
    if from_currency == to_currency:
        return amount
    
    rates = await fetch_exchange_rates(from_currency)
    rate = rates.get(to_currency, 1.0)
    return amount * rate

async def fetch_stock_quote(symbol: str):
    cache_key = f"quote_{symbol}"
    now = datetime.now(timezone.utc).timestamp()
    
    if cache_key in stock_cache:
        cached_data, cached_time = stock_cache[cache_key]
        if now - cached_time < CACHE_TTL:
            return cached_data
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://www.alphavantage.co/query",
                params={
                    "function": "GLOBAL_QUOTE",
                    "symbol": symbol,
                    "apikey": ALPHA_VANTAGE_KEY
                },
                timeout=10.0
            )
            data = response.json()
            
            if "Global Quote" in data and data["Global Quote"]:
                quote = data["Global Quote"]
                result = {
                    "symbol": quote.get("01. symbol", symbol),
                    "price": float(quote.get("05. price", 0)),
                    "change": float(quote.get("09. change", 0)),
                    "change_percent": quote.get("10. change percent", "0%").replace("%", ""),
                    "volume": int(quote.get("06. volume", 0)),
                    "latest_trading_day": quote.get("07. latest trading day", ""),
                    "previous_close": float(quote.get("08. previous close", 0))
                }
                stock_cache[cache_key] = (result, now)
                return result
            elif "Note" in data:
                # API limit reached, return mock data
                logger.warning(f"Alpha Vantage API limit reached: {data['Note']}")
                return get_mock_quote(symbol)
            else:
                return get_mock_quote(symbol)
    except Exception as e:
        logger.error(f"Error fetching stock quote: {e}")
        return get_mock_quote(symbol)

def get_mock_quote(symbol: str):
    """Return mock data when API is unavailable"""
    import random
    base_prices = {
        # US Stocks - Tech
        "AAPL": 178.50, "GOOGL": 141.80, "MSFT": 378.90, "AMZN": 178.25,
        "TSLA": 248.50, "META": 505.75, "NVDA": 875.30, "MSTR": 385.20,
        "COIN": 245.80, "AMD": 165.40, "INTC": 48.90, "CRM": 285.60,
        "ORCL": 125.40, "NFLX": 485.20, "PLTR": 22.50,
        # US Stocks - Finance
        "JPM": 195.40, "BAC": 35.80, "GS": 385.60, "V": 275.60, "MA": 445.20,
        # US Stocks - Other
        "WMT": 165.80, "DIS": 95.40, "KO": 62.50, "PEP": 175.80,
        "JNJ": 158.40, "PFE": 28.90, "XOM": 105.60, "CVX": 148.90,
        # UK Stocks (GBP - pence)
        "SHEL.LON": 2650.00, "HSBA.LON": 625.40, "BP.LON": 485.20, "VOD.LON": 72.50,
        "GSK.LON": 1425.00, "AZN.LON": 10250.00, "ULVR.LON": 4125.00, "RIO.LON": 5280.00,
        "BARC.LON": 185.60, "LLOY.LON": 52.40,
        # German Stocks (EUR)
        "BMW.DEX": 98.50, "SAP.DEX": 178.40, "SIE.DEX": 165.20, "VOW3.DEX": 118.60,
        "ALV.DEX": 245.80, "BAS.DEX": 48.50, "DTE.DEX": 22.80, "ADS.DEX": 185.40,
        "MBG.DEX": 72.40, "DBK.DEX": 14.80,
        # French Stocks (EUR)
        "OR.PAR": 425.60, "MC.PAR": 785.40, "SAN.PAR": 92.80, "TTE.PAR": 62.40,
        "AIR.PAR": 145.20, "BNP.PAR": 58.90, "OPM.PAR": 8.95, "ORA.PAR": 10.85,
        "SU.PAR": 185.60, "DG.PAR": 105.40, "CAP.PAR": 185.20, "HO.PAR": 145.60,
        "RNO.PAR": 42.80, "CS.PAR": 32.50, "KER.PAR": 365.40, "RI.PAR": 145.80,
        "EN.PAR": 32.60, "SGO.PAR": 68.90, "DSY.PAR": 42.80, "STM.PAR": 28.50,
        # Dutch Stocks (EUR)
        "ASML.AMS": 685.40, "PHIA.AMS": 24.80, "INGA.AMS": 14.20, "HEIA.AMS": 92.50,
        "UNA.AMS": 52.40, "AD.AMS": 28.60,
        # Swiss Stocks (CHF)
        "NESN.SWX": 98.50, "ROG.SWX": 265.40, "NOVN.SWX": 92.80, "UBSG.SWX": 25.40,
        "ZURN.SWX": 485.60, "ABBN.SWX": 45.80,
        # Italian Stocks (EUR)
        "ENI.MIL": 14.80, "ISP.MIL": 3.25, "RACE.MIL": 385.60, "UCG.MIL": 32.50, "ENEL.MIL": 6.85,
        # Spanish Stocks (EUR)
        "SAN.MAD": 4.25, "IBE.MAD": 11.80, "TEF.MAD": 4.15, "ITX.MAD": 42.80, "BBVA.MAD": 9.25,
        # Nordic Stocks
        "NOVO-B.CPH": 785.40, "MAERSK-B.CPH": 12500.00, "CARL-B.CPH": 885.60,
        "VOLV-B.STO": 265.80, "ERIC-B.STO": 68.40, "ATCO-A.STO": 165.40, "SEB-A.STO": 142.80, "HM-B.STO": 165.20,
        "EQNR.OSL": 285.60, "DNB.OSL": 205.40, "TEL.OSL": 128.60,
    }
    
    # Determine currency from symbol
    currency = "USD"
    if ".LON" in symbol:
        currency = "GBP"
    elif ".DEX" in symbol or ".PAR" in symbol or ".AMS" in symbol or ".MIL" in symbol or ".MAD" in symbol:
        currency = "EUR"
    elif ".SWX" in symbol:
        currency = "CHF"
    elif ".CPH" in symbol:
        currency = "DKK"
    elif ".STO" in symbol:
        currency = "SEK"
    elif ".OSL" in symbol:
        currency = "NOK"
    
    base_price = base_prices.get(symbol, 100 + random.random() * 200)
    change = (random.random() - 0.5) * (base_price * 0.05)  # ±2.5% change
    return {
        "symbol": symbol,
        "price": round(base_price + change, 2),
        "change": round(change, 2),
        "change_percent": str(round((change / base_price) * 100, 2)),
        "volume": random.randint(1000000, 50000000),
        "latest_trading_day": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "previous_close": round(base_price, 2),
        "currency": currency,
        "is_mock": True
    }

# ============ Currency Exchange Rates ============

@api_router.get("/currencies")
async def get_supported_currencies():
    """Get list of supported currencies"""
    currencies = [
        {"code": "USD", "name": "US Dollar", "symbol": "$"},
        {"code": "EUR", "name": "Euro", "symbol": "€"},
        {"code": "GBP", "name": "British Pound", "symbol": "£"},
        {"code": "CHF", "name": "Swiss Franc", "symbol": "CHF"},
        {"code": "DKK", "name": "Danish Krone", "symbol": "kr"},
        {"code": "SEK", "name": "Swedish Krona", "symbol": "kr"},
        {"code": "NOK", "name": "Norwegian Krone", "symbol": "kr"},
    ]
    return currencies

@api_router.get("/exchange-rates")
async def get_exchange_rates(base: str = "USD"):
    """Get current exchange rates"""
    rates = await fetch_exchange_rates(base.upper())
    return {
        "base": base.upper(),
        "rates": rates,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@api_router.get("/stocks/quote/{symbol}")
async def get_stock_quote(symbol: str):
    return await fetch_stock_quote(symbol.upper())

@api_router.get("/stocks/quotes")
async def get_multiple_quotes(symbols: str):
    """Get quotes for multiple symbols (comma-separated)"""
    symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    quotes = {}
    for symbol in symbol_list[:20]:  # Limit to 20 symbols
        quotes[symbol] = await fetch_stock_quote(symbol)
    return quotes

@api_router.get("/stocks/search")
async def search_stocks(query: str):
    """Search for stocks by keyword"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://www.alphavantage.co/query",
                params={
                    "function": "SYMBOL_SEARCH",
                    "keywords": query,
                    "apikey": ALPHA_VANTAGE_KEY
                },
                timeout=10.0
            )
            data = response.json()
            
            if "bestMatches" in data:
                results = []
                for match in data["bestMatches"][:15]:
                    symbol = match.get("1. symbol", "")
                    region = match.get("4. region", "")
                    currency = match.get("8. currency", "USD")
                    
                    # Determine exchange from symbol suffix
                    exchange = get_exchange_from_symbol(symbol)
                    
                    results.append({
                        "symbol": symbol,
                        "name": match.get("2. name", ""),
                        "type": match.get("3. type", ""),
                        "region": region,
                        "currency": currency,
                        "exchange": exchange
                    })
                return results
            elif "Note" in data or "Information" in data:
                # API limit - return popular stocks
                return get_popular_stocks(query)
            return get_popular_stocks(query) if not data.get("bestMatches") else []
    except Exception as e:
        logger.error(f"Error searching stocks: {e}")
        return get_popular_stocks(query)

def get_exchange_from_symbol(symbol: str) -> str:
    """Determine exchange from symbol suffix"""
    exchange_map = {
        ".LON": "London",
        ".DEX": "Frankfurt",
        ".PAR": "Paris",
        ".AMS": "Amsterdam",
        ".BRU": "Brussels",
        ".MIL": "Milan",
        ".MAD": "Madrid",
        ".SWX": "Zurich",
        ".VIE": "Vienna",
        ".STO": "Stockholm",
        ".HEL": "Helsinki",
        ".CPH": "Copenhagen",
        ".OSL": "Oslo",
        ".LSE": "London",
    }
    for suffix, exchange in exchange_map.items():
        if symbol.endswith(suffix):
            return exchange
    return "US"

def get_popular_stocks(query: str = ""):
    """Return popular US and European stocks when API is unavailable"""
    stocks = [
        # US Stocks - Major Tech
        {"symbol": "AAPL", "name": "Apple Inc", "type": "Equity", "region": "United States", "currency": "USD", "exchange": "US"},
        {"symbol": "GOOGL", "name": "Alphabet Inc", "type": "Equity", "region": "United States", "currency": "USD", "exchange": "US"},
        {"symbol": "MSFT", "name": "Microsoft Corporation", "type": "Equity", "region": "United States", "currency": "USD", "exchange": "US"},
        {"symbol": "AMZN", "name": "Amazon.com Inc", "type": "Equity", "region": "United States", "currency": "USD", "exchange": "US"},
        {"symbol": "TSLA", "name": "Tesla Inc", "type": "Equity", "region": "United States", "currency": "USD", "exchange": "US"},
        {"symbol": "META", "name": "Meta Platforms Inc", "type": "Equity", "region": "United States", "currency": "USD", "exchange": "US"},
        {"symbol": "NVDA", "name": "NVIDIA Corporation", "type": "Equity", "region": "United States", "currency": "USD", "exchange": "US"},
        {"symbol": "MSTR", "name": "MicroStrategy Inc", "type": "Equity", "region": "United States", "currency": "USD", "exchange": "US"},
        {"symbol": "COIN", "name": "Coinbase Global Inc", "type": "Equity", "region": "United States", "currency": "USD", "exchange": "US"},
        {"symbol": "AMD", "name": "Advanced Micro Devices", "type": "Equity", "region": "United States", "currency": "USD", "exchange": "US"},
        {"symbol": "INTC", "name": "Intel Corporation", "type": "Equity", "region": "United States", "currency": "USD", "exchange": "US"},
        {"symbol": "CRM", "name": "Salesforce Inc", "type": "Equity", "region": "United States", "currency": "USD", "exchange": "US"},
        {"symbol": "ORCL", "name": "Oracle Corporation", "type": "Equity", "region": "United States", "currency": "USD", "exchange": "US"},
        {"symbol": "NFLX", "name": "Netflix Inc", "type": "Equity", "region": "United States", "currency": "USD", "exchange": "US"},
        {"symbol": "PLTR", "name": "Palantir Technologies", "type": "Equity", "region": "United States", "currency": "USD", "exchange": "US"},
        # US Stocks - Finance
        {"symbol": "JPM", "name": "JPMorgan Chase & Co", "type": "Equity", "region": "United States", "currency": "USD", "exchange": "US"},
        {"symbol": "BAC", "name": "Bank of America", "type": "Equity", "region": "United States", "currency": "USD", "exchange": "US"},
        {"symbol": "GS", "name": "Goldman Sachs", "type": "Equity", "region": "United States", "currency": "USD", "exchange": "US"},
        {"symbol": "V", "name": "Visa Inc", "type": "Equity", "region": "United States", "currency": "USD", "exchange": "US"},
        {"symbol": "MA", "name": "Mastercard Inc", "type": "Equity", "region": "United States", "currency": "USD", "exchange": "US"},
        # US Stocks - Other
        {"symbol": "WMT", "name": "Walmart Inc", "type": "Equity", "region": "United States", "currency": "USD", "exchange": "US"},
        {"symbol": "DIS", "name": "Walt Disney Co", "type": "Equity", "region": "United States", "currency": "USD", "exchange": "US"},
        {"symbol": "KO", "name": "Coca-Cola Company", "type": "Equity", "region": "United States", "currency": "USD", "exchange": "US"},
        {"symbol": "PEP", "name": "PepsiCo Inc", "type": "Equity", "region": "United States", "currency": "USD", "exchange": "US"},
        {"symbol": "JNJ", "name": "Johnson & Johnson", "type": "Equity", "region": "United States", "currency": "USD", "exchange": "US"},
        {"symbol": "PFE", "name": "Pfizer Inc", "type": "Equity", "region": "United States", "currency": "USD", "exchange": "US"},
        {"symbol": "XOM", "name": "Exxon Mobil", "type": "Equity", "region": "United States", "currency": "USD", "exchange": "US"},
        {"symbol": "CVX", "name": "Chevron Corporation", "type": "Equity", "region": "United States", "currency": "USD", "exchange": "US"},
        # London Stock Exchange
        {"symbol": "SHEL.LON", "name": "Shell PLC", "type": "Equity", "region": "United Kingdom", "currency": "GBP", "exchange": "London"},
        {"symbol": "HSBA.LON", "name": "HSBC Holdings", "type": "Equity", "region": "United Kingdom", "currency": "GBP", "exchange": "London"},
        {"symbol": "BP.LON", "name": "BP PLC", "type": "Equity", "region": "United Kingdom", "currency": "GBP", "exchange": "London"},
        {"symbol": "VOD.LON", "name": "Vodafone Group", "type": "Equity", "region": "United Kingdom", "currency": "GBP", "exchange": "London"},
        {"symbol": "GSK.LON", "name": "GSK PLC", "type": "Equity", "region": "United Kingdom", "currency": "GBP", "exchange": "London"},
        {"symbol": "AZN.LON", "name": "AstraZeneca PLC", "type": "Equity", "region": "United Kingdom", "currency": "GBP", "exchange": "London"},
        {"symbol": "ULVR.LON", "name": "Unilever PLC", "type": "Equity", "region": "United Kingdom", "currency": "GBP", "exchange": "London"},
        {"symbol": "RIO.LON", "name": "Rio Tinto PLC", "type": "Equity", "region": "United Kingdom", "currency": "GBP", "exchange": "London"},
        {"symbol": "BARC.LON", "name": "Barclays PLC", "type": "Equity", "region": "United Kingdom", "currency": "GBP", "exchange": "London"},
        {"symbol": "LLOY.LON", "name": "Lloyds Banking Group", "type": "Equity", "region": "United Kingdom", "currency": "GBP", "exchange": "London"},
        # Frankfurt Stock Exchange
        {"symbol": "BMW.DEX", "name": "BMW AG", "type": "Equity", "region": "Germany", "currency": "EUR", "exchange": "Frankfurt"},
        {"symbol": "SAP.DEX", "name": "SAP SE", "type": "Equity", "region": "Germany", "currency": "EUR", "exchange": "Frankfurt"},
        {"symbol": "SIE.DEX", "name": "Siemens AG", "type": "Equity", "region": "Germany", "currency": "EUR", "exchange": "Frankfurt"},
        {"symbol": "VOW3.DEX", "name": "Volkswagen AG", "type": "Equity", "region": "Germany", "currency": "EUR", "exchange": "Frankfurt"},
        {"symbol": "ALV.DEX", "name": "Allianz SE", "type": "Equity", "region": "Germany", "currency": "EUR", "exchange": "Frankfurt"},
        {"symbol": "BAS.DEX", "name": "BASF SE", "type": "Equity", "region": "Germany", "currency": "EUR", "exchange": "Frankfurt"},
        {"symbol": "DTE.DEX", "name": "Deutsche Telekom AG", "type": "Equity", "region": "Germany", "currency": "EUR", "exchange": "Frankfurt"},
        {"symbol": "ADS.DEX", "name": "Adidas AG", "type": "Equity", "region": "Germany", "currency": "EUR", "exchange": "Frankfurt"},
        {"symbol": "MBG.DEX", "name": "Mercedes-Benz Group", "type": "Equity", "region": "Germany", "currency": "EUR", "exchange": "Frankfurt"},
        {"symbol": "DBK.DEX", "name": "Deutsche Bank AG", "type": "Equity", "region": "Germany", "currency": "EUR", "exchange": "Frankfurt"},
        # Paris Stock Exchange (Euronext Paris)
        {"symbol": "OR.PAR", "name": "L'Oreal SA", "type": "Equity", "region": "France", "currency": "EUR", "exchange": "Paris"},
        {"symbol": "MC.PAR", "name": "LVMH Moet Hennessy", "type": "Equity", "region": "France", "currency": "EUR", "exchange": "Paris"},
        {"symbol": "SAN.PAR", "name": "Sanofi SA", "type": "Equity", "region": "France", "currency": "EUR", "exchange": "Paris"},
        {"symbol": "TTE.PAR", "name": "TotalEnergies SE", "type": "Equity", "region": "France", "currency": "EUR", "exchange": "Paris"},
        {"symbol": "AIR.PAR", "name": "Airbus SE", "type": "Equity", "region": "France", "currency": "EUR", "exchange": "Paris"},
        {"symbol": "BNP.PAR", "name": "BNP Paribas", "type": "Equity", "region": "France", "currency": "EUR", "exchange": "Paris"},
        {"symbol": "OPM.PAR", "name": "OPmobility SE", "type": "Equity", "region": "France", "currency": "EUR", "exchange": "Paris"},
        {"symbol": "ORA.PAR", "name": "Orange SA", "type": "Equity", "region": "France", "currency": "EUR", "exchange": "Paris"},
        {"symbol": "SU.PAR", "name": "Schneider Electric", "type": "Equity", "region": "France", "currency": "EUR", "exchange": "Paris"},
        {"symbol": "DG.PAR", "name": "Vinci SA", "type": "Equity", "region": "France", "currency": "EUR", "exchange": "Paris"},
        {"symbol": "CAP.PAR", "name": "Capgemini SE", "type": "Equity", "region": "France", "currency": "EUR", "exchange": "Paris"},
        {"symbol": "HO.PAR", "name": "Thales SA", "type": "Equity", "region": "France", "currency": "EUR", "exchange": "Paris"},
        {"symbol": "RNO.PAR", "name": "Renault SA", "type": "Equity", "region": "France", "currency": "EUR", "exchange": "Paris"},
        {"symbol": "CS.PAR", "name": "AXA SA", "type": "Equity", "region": "France", "currency": "EUR", "exchange": "Paris"},
        {"symbol": "KER.PAR", "name": "Kering SA", "type": "Equity", "region": "France", "currency": "EUR", "exchange": "Paris"},
        {"symbol": "RI.PAR", "name": "Pernod Ricard", "type": "Equity", "region": "France", "currency": "EUR", "exchange": "Paris"},
        {"symbol": "EN.PAR", "name": "Bouygues SA", "type": "Equity", "region": "France", "currency": "EUR", "exchange": "Paris"},
        {"symbol": "SGO.PAR", "name": "Saint-Gobain", "type": "Equity", "region": "France", "currency": "EUR", "exchange": "Paris"},
        {"symbol": "DSY.PAR", "name": "Dassault Systemes", "type": "Equity", "region": "France", "currency": "EUR", "exchange": "Paris"},
        {"symbol": "STM.PAR", "name": "STMicroelectronics", "type": "Equity", "region": "France", "currency": "EUR", "exchange": "Paris"},
        # Amsterdam Stock Exchange
        {"symbol": "ASML.AMS", "name": "ASML Holding", "type": "Equity", "region": "Netherlands", "currency": "EUR", "exchange": "Amsterdam"},
        {"symbol": "PHIA.AMS", "name": "Philips NV", "type": "Equity", "region": "Netherlands", "currency": "EUR", "exchange": "Amsterdam"},
        {"symbol": "INGA.AMS", "name": "ING Group", "type": "Equity", "region": "Netherlands", "currency": "EUR", "exchange": "Amsterdam"},
        {"symbol": "HEIA.AMS", "name": "Heineken NV", "type": "Equity", "region": "Netherlands", "currency": "EUR", "exchange": "Amsterdam"},
        {"symbol": "UNA.AMS", "name": "Unilever NV", "type": "Equity", "region": "Netherlands", "currency": "EUR", "exchange": "Amsterdam"},
        {"symbol": "AD.AMS", "name": "Ahold Delhaize", "type": "Equity", "region": "Netherlands", "currency": "EUR", "exchange": "Amsterdam"},
        # Swiss Stock Exchange
        {"symbol": "NESN.SWX", "name": "Nestle SA", "type": "Equity", "region": "Switzerland", "currency": "CHF", "exchange": "Zurich"},
        {"symbol": "ROG.SWX", "name": "Roche Holding", "type": "Equity", "region": "Switzerland", "currency": "CHF", "exchange": "Zurich"},
        {"symbol": "NOVN.SWX", "name": "Novartis AG", "type": "Equity", "region": "Switzerland", "currency": "CHF", "exchange": "Zurich"},
        {"symbol": "UBSG.SWX", "name": "UBS Group AG", "type": "Equity", "region": "Switzerland", "currency": "CHF", "exchange": "Zurich"},
        {"symbol": "ZURN.SWX", "name": "Zurich Insurance", "type": "Equity", "region": "Switzerland", "currency": "CHF", "exchange": "Zurich"},
        {"symbol": "ABBN.SWX", "name": "ABB Ltd", "type": "Equity", "region": "Switzerland", "currency": "CHF", "exchange": "Zurich"},
        # Milan Stock Exchange
        {"symbol": "ENI.MIL", "name": "Eni SpA", "type": "Equity", "region": "Italy", "currency": "EUR", "exchange": "Milan"},
        {"symbol": "ISP.MIL", "name": "Intesa Sanpaolo", "type": "Equity", "region": "Italy", "currency": "EUR", "exchange": "Milan"},
        {"symbol": "RACE.MIL", "name": "Ferrari NV", "type": "Equity", "region": "Italy", "currency": "EUR", "exchange": "Milan"},
        {"symbol": "UCG.MIL", "name": "UniCredit SpA", "type": "Equity", "region": "Italy", "currency": "EUR", "exchange": "Milan"},
        {"symbol": "ENEL.MIL", "name": "Enel SpA", "type": "Equity", "region": "Italy", "currency": "EUR", "exchange": "Milan"},
        # Madrid Stock Exchange
        {"symbol": "SAN.MAD", "name": "Banco Santander", "type": "Equity", "region": "Spain", "currency": "EUR", "exchange": "Madrid"},
        {"symbol": "IBE.MAD", "name": "Iberdrola SA", "type": "Equity", "region": "Spain", "currency": "EUR", "exchange": "Madrid"},
        {"symbol": "TEF.MAD", "name": "Telefonica SA", "type": "Equity", "region": "Spain", "currency": "EUR", "exchange": "Madrid"},
        {"symbol": "ITX.MAD", "name": "Inditex SA", "type": "Equity", "region": "Spain", "currency": "EUR", "exchange": "Madrid"},
        {"symbol": "BBVA.MAD", "name": "BBVA SA", "type": "Equity", "region": "Spain", "currency": "EUR", "exchange": "Madrid"},
        # Nordic Exchanges
        {"symbol": "NOVO-B.CPH", "name": "Novo Nordisk", "type": "Equity", "region": "Denmark", "currency": "DKK", "exchange": "Copenhagen"},
        {"symbol": "MAERSK-B.CPH", "name": "AP Moller Maersk", "type": "Equity", "region": "Denmark", "currency": "DKK", "exchange": "Copenhagen"},
        {"symbol": "CARL-B.CPH", "name": "Carlsberg AS", "type": "Equity", "region": "Denmark", "currency": "DKK", "exchange": "Copenhagen"},
        {"symbol": "VOLV-B.STO", "name": "Volvo AB", "type": "Equity", "region": "Sweden", "currency": "SEK", "exchange": "Stockholm"},
        {"symbol": "ERIC-B.STO", "name": "Ericsson", "type": "Equity", "region": "Sweden", "currency": "SEK", "exchange": "Stockholm"},
        {"symbol": "ATCO-A.STO", "name": "Atlas Copco", "type": "Equity", "region": "Sweden", "currency": "SEK", "exchange": "Stockholm"},
        {"symbol": "SEB-A.STO", "name": "SEB AB", "type": "Equity", "region": "Sweden", "currency": "SEK", "exchange": "Stockholm"},
        {"symbol": "HM-B.STO", "name": "H&M Hennes & Mauritz", "type": "Equity", "region": "Sweden", "currency": "SEK", "exchange": "Stockholm"},
        {"symbol": "EQNR.OSL", "name": "Equinor ASA", "type": "Equity", "region": "Norway", "currency": "NOK", "exchange": "Oslo"},
        {"symbol": "DNB.OSL", "name": "DNB Bank ASA", "type": "Equity", "region": "Norway", "currency": "NOK", "exchange": "Oslo"},
        {"symbol": "TEL.OSL", "name": "Telenor ASA", "type": "Equity", "region": "Norway", "currency": "NOK", "exchange": "Oslo"},
    ]
    if query:
        query_lower = query.lower()
        return [s for s in stocks if query_lower in s["symbol"].lower() or query_lower in s["name"].lower() or query_lower in s.get("region", "").lower()]
    return stocks

# ============ Portfolio Summary ============

@api_router.get("/portfolio/summary")
async def get_portfolio_summary(current_user: dict = Depends(get_current_user), display_currency: str = "USD"):
    """Get portfolio summary with optional currency conversion"""
    holdings = await db.holdings.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    
    if not holdings:
        return {
            "total_value": 0,
            "total_cost": 0,
            "total_gain_loss": 0,
            "total_gain_loss_percent": 0,
            "holdings_count": 0,
            "holdings": [],
            "display_currency": display_currency
        }
    
    # Get current prices for all holdings
    symbols = list(set(h["symbol"] for h in holdings))
    quotes = {}
    for symbol in symbols:
        quotes[symbol] = await fetch_stock_quote(symbol)
    
    # Fetch exchange rates for currency conversion
    exchange_rates = await fetch_exchange_rates("USD")
    
    total_value_converted = 0
    total_cost_converted = 0
    holdings_with_prices = []
    
    for holding in holdings:
        quote = quotes.get(holding["symbol"], {})
        current_price = quote.get("price", holding["buy_price"])
        market_value = current_price * holding["shares"]
        cost_basis = holding["buy_price"] * holding["shares"]
        gain_loss = market_value - cost_basis
        gain_loss_percent = ((current_price - holding["buy_price"]) / holding["buy_price"] * 100) if holding["buy_price"] > 0 else 0
        
        # Get original currency and convert to display currency
        original_currency = get_currency_from_symbol(holding["symbol"])
        
        # Convert to USD first (as base), then to display currency
        if original_currency != "USD":
            # Get rate from original currency to USD
            original_to_usd = 1 / exchange_rates.get(original_currency, 1.0)
            market_value_usd = market_value * original_to_usd
            cost_basis_usd = cost_basis * original_to_usd
        else:
            market_value_usd = market_value
            cost_basis_usd = cost_basis
        
        # Convert from USD to display currency
        usd_to_display = exchange_rates.get(display_currency, 1.0)
        market_value_display = market_value_usd * usd_to_display
        cost_basis_display = cost_basis_usd * usd_to_display
        
        total_value_converted += market_value_display
        total_cost_converted += cost_basis_display
        
        holdings_with_prices.append({
            **holding,
            "current_price": current_price,
            "market_value": round(market_value, 2),
            "market_value_converted": round(market_value_display, 2),
            "cost_basis": round(cost_basis, 2),
            "cost_basis_converted": round(cost_basis_display, 2),
            "gain_loss": round(gain_loss, 2),
            "gain_loss_percent": round(gain_loss_percent, 2),
            "day_change": quote.get("change", 0),
            "day_change_percent": float(quote.get("change_percent", "0")),
            "original_currency": original_currency
        })
    
    total_gain_loss = total_value_converted - total_cost_converted
    total_gain_loss_percent = ((total_value_converted - total_cost_converted) / total_cost_converted * 100) if total_cost_converted > 0 else 0
    
    return {
        "total_value": round(total_value_converted, 2),
        "total_cost": round(total_cost_converted, 2),
        "total_gain_loss": round(total_gain_loss, 2),
        "total_gain_loss_percent": round(total_gain_loss_percent, 2),
        "holdings_count": len(holdings),
        "holdings": holdings_with_prices,
        "display_currency": display_currency
    }

# ============ Crypto Data (CoinGecko) ============

crypto_cache = {}
CRYPTO_CACHE_TTL = 60  # 1 minute

async def fetch_crypto_prices(coin_ids: List[str]):
    """Fetch prices for multiple cryptocurrencies from CoinGecko"""
    cache_key = f"crypto_prices_{','.join(sorted(coin_ids))}"
    now = datetime.now(timezone.utc).timestamp()
    
    if cache_key in crypto_cache:
        cached_data, cached_time = crypto_cache[cache_key]
        if now - cached_time < CRYPTO_CACHE_TTL:
            return cached_data
    
    try:
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(
                "https://api.coingecko.com/api/v3/simple/price",
                params={
                    "ids": ",".join(coin_ids),
                    "vs_currencies": "usd",
                    "include_24hr_change": "true",
                    "include_market_cap": "true",
                    "include_24hr_vol": "true"
                },
                timeout=10.0
            )
            data = response.json()
            crypto_cache[cache_key] = (data, now)
            return data
    except Exception as e:
        logger.error(f"Error fetching crypto prices: {e}")
        return {}

@api_router.get("/crypto/top")
async def get_top_cryptos():
    """Get top cryptocurrencies by market cap"""
    cache_key = "top_cryptos"
    now = datetime.now(timezone.utc).timestamp()
    
    if cache_key in crypto_cache:
        cached_data, cached_time = crypto_cache[cache_key]
        if now - cached_time < CRYPTO_CACHE_TTL:
            return cached_data
    
    try:
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(
                "https://api.coingecko.com/api/v3/coins/markets",
                params={
                    "vs_currency": "usd",
                    "order": "market_cap_desc",
                    "per_page": 50,
                    "page": 1,
                    "sparkline": "false",
                    "price_change_percentage": "24h"
                },
                timeout=10.0
            )
            data = response.json()
            result = [
                {
                    "id": coin["id"],
                    "symbol": coin["symbol"].upper(),
                    "name": coin["name"],
                    "current_price": coin["current_price"],
                    "market_cap": coin["market_cap"],
                    "market_cap_rank": coin["market_cap_rank"],
                    "price_change_24h": coin["price_change_24h"],
                    "price_change_percentage_24h": coin["price_change_percentage_24h"],
                    "total_volume": coin["total_volume"],
                    "image": coin["image"]
                }
                for coin in data
            ]
            crypto_cache[cache_key] = (result, now)
            return result
    except Exception as e:
        logger.error(f"Error fetching top cryptos: {e}")
        return get_mock_top_cryptos()

def get_mock_top_cryptos():
    """Return mock crypto data when API is unavailable"""
    return [
        {"id": "bitcoin", "symbol": "BTC", "name": "Bitcoin", "current_price": 67500, "market_cap": 1300000000000, "market_cap_rank": 1, "price_change_24h": 1200, "price_change_percentage_24h": 1.8, "total_volume": 28000000000, "image": ""},
        {"id": "ethereum", "symbol": "ETH", "name": "Ethereum", "current_price": 3450, "market_cap": 415000000000, "market_cap_rank": 2, "price_change_24h": -45, "price_change_percentage_24h": -1.3, "total_volume": 15000000000, "image": ""},
        {"id": "tether", "symbol": "USDT", "name": "Tether", "current_price": 1.0, "market_cap": 120000000000, "market_cap_rank": 3, "price_change_24h": 0, "price_change_percentage_24h": 0.01, "total_volume": 50000000000, "image": ""},
        {"id": "binancecoin", "symbol": "BNB", "name": "BNB", "current_price": 580, "market_cap": 85000000000, "market_cap_rank": 4, "price_change_24h": 12, "price_change_percentage_24h": 2.1, "total_volume": 1200000000, "image": ""},
        {"id": "solana", "symbol": "SOL", "name": "Solana", "current_price": 145, "market_cap": 65000000000, "market_cap_rank": 5, "price_change_24h": 5.2, "price_change_percentage_24h": 3.7, "total_volume": 2500000000, "image": ""},
        {"id": "ripple", "symbol": "XRP", "name": "XRP", "current_price": 0.52, "market_cap": 28000000000, "market_cap_rank": 6, "price_change_24h": 0.01, "price_change_percentage_24h": 1.9, "total_volume": 1100000000, "image": ""},
        {"id": "usd-coin", "symbol": "USDC", "name": "USD Coin", "current_price": 1.0, "market_cap": 26000000000, "market_cap_rank": 7, "price_change_24h": 0, "price_change_percentage_24h": 0.02, "total_volume": 4500000000, "image": ""},
        {"id": "cardano", "symbol": "ADA", "name": "Cardano", "current_price": 0.45, "market_cap": 16000000000, "market_cap_rank": 8, "price_change_24h": -0.02, "price_change_percentage_24h": -4.3, "total_volume": 400000000, "image": ""},
        {"id": "dogecoin", "symbol": "DOGE", "name": "Dogecoin", "current_price": 0.12, "market_cap": 17000000000, "market_cap_rank": 9, "price_change_24h": 0.005, "price_change_percentage_24h": 4.3, "total_volume": 800000000, "image": ""},
        {"id": "avalanche-2", "symbol": "AVAX", "name": "Avalanche", "current_price": 35, "market_cap": 14000000000, "market_cap_rank": 10, "price_change_24h": 1.5, "price_change_percentage_24h": 4.5, "total_volume": 450000000, "image": ""},
    ]

@api_router.get("/crypto/search")
async def search_cryptos(query: str):
    """Search for cryptocurrencies"""
    try:
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(
                "https://api.coingecko.com/api/v3/search",
                params={"query": query},
                timeout=10.0
            )
            data = response.json()
            return [
                {
                    "id": coin["id"],
                    "symbol": coin["symbol"].upper(),
                    "name": coin["name"],
                    "market_cap_rank": coin.get("market_cap_rank"),
                    "thumb": coin.get("thumb", "")
                }
                for coin in data.get("coins", [])[:15]
            ]
    except Exception as e:
        logger.error(f"Error searching cryptos: {e}")
        # Return top cryptos filtered by query
        top = get_mock_top_cryptos()
        query_lower = query.lower()
        return [
            {"id": c["id"], "symbol": c["symbol"], "name": c["name"], "market_cap_rank": c["market_cap_rank"], "thumb": ""}
            for c in top if query_lower in c["symbol"].lower() or query_lower in c["name"].lower()
        ]

@api_router.get("/crypto/price/{coin_id}")
async def get_crypto_price(coin_id: str):
    """Get price for a single cryptocurrency"""
    prices = await fetch_crypto_prices([coin_id])
    if coin_id in prices:
        return {
            "coin_id": coin_id,
            "price": prices[coin_id].get("usd", 0),
            "change_24h": prices[coin_id].get("usd_24h_change", 0),
            "market_cap": prices[coin_id].get("usd_market_cap", 0),
            "volume_24h": prices[coin_id].get("usd_24h_vol", 0)
        }
    # Fallback to mock data
    mock_cryptos = get_mock_top_cryptos()
    for crypto in mock_cryptos:
        if crypto["id"] == coin_id:
            return {
                "coin_id": coin_id,
                "price": crypto["current_price"],
                "change_24h": crypto["price_change_percentage_24h"],
                "market_cap": crypto["market_cap"],
                "volume_24h": crypto["total_volume"],
                "is_mock": True
            }
    raise HTTPException(status_code=404, detail="Cryptocurrency not found")

# ============ Crypto Holdings ============

@api_router.get("/crypto/holdings", response_model=List[CryptoHoldingResponse])
async def get_crypto_holdings(current_user: dict = Depends(get_current_user)):
    holdings = await db.crypto_holdings.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    return holdings

@api_router.post("/crypto/holdings", response_model=CryptoHoldingResponse)
async def create_crypto_holding(data: CryptoHoldingCreate, current_user: dict = Depends(get_current_user)):
    holding_id = str(uuid.uuid4())
    holding = {
        "id": holding_id,
        "coin_id": data.coin_id.lower(),
        "symbol": data.symbol.upper(),
        "name": data.name,
        "amount": data.amount,
        "buy_price": data.buy_price,
        "buy_date": data.buy_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "user_id": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.crypto_holdings.insert_one(holding)
    return CryptoHoldingResponse(**holding)

@api_router.put("/crypto/holdings/{holding_id}", response_model=CryptoHoldingResponse)
async def update_crypto_holding(holding_id: str, data: CryptoHoldingUpdate, current_user: dict = Depends(get_current_user)):
    holding = await db.crypto_holdings.find_one({"id": holding_id, "user_id": current_user["id"]}, {"_id": 0})
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.crypto_holdings.update_one({"id": holding_id}, {"$set": update_data})
        holding.update(update_data)
    
    return CryptoHoldingResponse(**holding)

@api_router.delete("/crypto/holdings/{holding_id}")
async def delete_crypto_holding(holding_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.crypto_holdings.delete_one({"id": holding_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Holding not found")
    return {"message": "Holding deleted"}

# ============ Crypto Watchlist ============

@api_router.get("/crypto/watchlist", response_model=List[CryptoWatchlistResponse])
async def get_crypto_watchlist(current_user: dict = Depends(get_current_user)):
    items = await db.crypto_watchlist.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    return items

@api_router.post("/crypto/watchlist", response_model=CryptoWatchlistResponse)
async def add_to_crypto_watchlist(data: CryptoWatchlistItem, current_user: dict = Depends(get_current_user)):
    coin_id = data.coin_id.lower()
    existing = await db.crypto_watchlist.find_one({"coin_id": coin_id, "user_id": current_user["id"]})
    if existing:
        raise HTTPException(status_code=400, detail="Coin already in watchlist")
    
    item_id = str(uuid.uuid4())
    item = {
        "id": item_id,
        "coin_id": coin_id,
        "symbol": data.symbol.upper(),
        "name": data.name,
        "user_id": current_user["id"],
        "added_at": datetime.now(timezone.utc).isoformat()
    }
    await db.crypto_watchlist.insert_one(item)
    return CryptoWatchlistResponse(**item)

@api_router.delete("/crypto/watchlist/{coin_id}")
async def remove_from_crypto_watchlist(coin_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.crypto_watchlist.delete_one({"coin_id": coin_id.lower(), "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Coin not in watchlist")
    return {"message": "Removed from watchlist"}

# ============ Crypto Portfolio Summary ============

@api_router.get("/crypto/portfolio/summary")
async def get_crypto_portfolio_summary(current_user: dict = Depends(get_current_user)):
    holdings = await db.crypto_holdings.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    
    if not holdings:
        return {
            "total_value": 0,
            "total_cost": 0,
            "total_gain_loss": 0,
            "total_gain_loss_percent": 0,
            "holdings_count": 0,
            "holdings": []
        }
    
    # Get current prices for all holdings
    coin_ids = list(set(h["coin_id"] for h in holdings))
    prices = await fetch_crypto_prices(coin_ids)
    
    total_value = 0
    total_cost = 0
    holdings_with_prices = []
    
    for holding in holdings:
        coin_price_data = prices.get(holding["coin_id"], {})
        current_price = coin_price_data.get("usd", holding["buy_price"])
        market_value = current_price * holding["amount"]
        cost_basis = holding["buy_price"] * holding["amount"]
        gain_loss = market_value - cost_basis
        gain_loss_percent = ((current_price - holding["buy_price"]) / holding["buy_price"] * 100) if holding["buy_price"] > 0 else 0
        
        total_value += market_value
        total_cost += cost_basis
        
        holdings_with_prices.append({
            **holding,
            "current_price": current_price,
            "market_value": round(market_value, 2),
            "cost_basis": round(cost_basis, 2),
            "gain_loss": round(gain_loss, 2),
            "gain_loss_percent": round(gain_loss_percent, 2),
            "day_change_percent": coin_price_data.get("usd_24h_change", 0)
        })
    
    total_gain_loss = total_value - total_cost
    total_gain_loss_percent = ((total_value - total_cost) / total_cost * 100) if total_cost > 0 else 0
    
    return {
        "total_value": round(total_value, 2),
        "total_cost": round(total_cost, 2),
        "total_gain_loss": round(total_gain_loss, 2),
        "total_gain_loss_percent": round(total_gain_loss_percent, 2),
        "holdings_count": len(holdings),
        "holdings": holdings_with_prices
    }

# ============ Price Alerts ============

@api_router.get("/alerts", response_model=List[PriceAlertResponse])
async def get_price_alerts(current_user: dict = Depends(get_current_user)):
    """Get all price alerts for the current user"""
    alerts = await db.price_alerts.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    return alerts

@api_router.post("/alerts", response_model=PriceAlertResponse)
async def create_price_alert(data: PriceAlertCreate, current_user: dict = Depends(get_current_user)):
    """Create a new price alert"""
    alert_id = str(uuid.uuid4())
    alert = {
        "id": alert_id,
        "asset_type": data.asset_type,
        "symbol": data.symbol.upper(),
        "name": data.name,
        "target_price": data.target_price,
        "condition": data.condition,
        "coin_id": data.coin_id.lower() if data.coin_id else None,
        "current_price": None,
        "triggered": False,
        "triggered_at": None,
        "user_id": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.price_alerts.insert_one(alert)
    return PriceAlertResponse(**alert)

@api_router.delete("/alerts/{alert_id}")
async def delete_price_alert(alert_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a price alert"""
    result = await db.price_alerts.delete_one({"id": alert_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"message": "Alert deleted"}

@api_router.get("/alerts/check")
async def check_price_alerts(current_user: dict = Depends(get_current_user)):
    """Check all active alerts and return triggered ones"""
    alerts = await db.price_alerts.find({
        "user_id": current_user["id"],
        "triggered": False
    }, {"_id": 0}).to_list(1000)
    
    if not alerts:
        return {"triggered_alerts": [], "active_alerts": []}
    
    triggered_alerts = []
    active_alerts = []
    
    # Separate stock and crypto alerts
    stock_alerts = [a for a in alerts if a["asset_type"] == "stock"]
    crypto_alerts = [a for a in alerts if a["asset_type"] == "crypto"]
    
    # Check stock alerts
    stock_symbols = list(set(a["symbol"] for a in stock_alerts))
    stock_prices = {}
    for symbol in stock_symbols:
        quote = await fetch_stock_quote(symbol)
        stock_prices[symbol] = quote.get("price", 0)
    
    # Check crypto alerts
    crypto_ids = list(set(a["coin_id"] for a in crypto_alerts if a["coin_id"]))
    crypto_prices = {}
    if crypto_ids:
        prices_data = await fetch_crypto_prices(crypto_ids)
        for coin_id in crypto_ids:
            if coin_id in prices_data:
                crypto_prices[coin_id] = prices_data[coin_id].get("usd", 0)
    
    # Process alerts
    for alert in alerts:
        current_price = 0
        if alert["asset_type"] == "stock":
            current_price = stock_prices.get(alert["symbol"], 0)
        else:
            current_price = crypto_prices.get(alert["coin_id"], 0)
        
        # Check if alert is triggered
        is_triggered = False
        if alert["condition"] == "above" and current_price >= alert["target_price"]:
            is_triggered = True
        elif alert["condition"] == "below" and current_price <= alert["target_price"]:
            is_triggered = True
        
        alert["current_price"] = current_price
        
        if is_triggered:
            # Mark as triggered in database
            await db.price_alerts.update_one(
                {"id": alert["id"]},
                {"$set": {
                    "triggered": True,
                    "triggered_at": datetime.now(timezone.utc).isoformat(),
                    "current_price": current_price
                }}
            )
            alert["triggered"] = True
            alert["triggered_at"] = datetime.now(timezone.utc).isoformat()
            triggered_alerts.append(alert)
        else:
            active_alerts.append(alert)
    
    return {
        "triggered_alerts": triggered_alerts,
        "active_alerts": active_alerts
    }

@api_router.post("/alerts/{alert_id}/reset")
async def reset_price_alert(alert_id: str, current_user: dict = Depends(get_current_user)):
    """Reset a triggered alert to active state"""
    result = await db.price_alerts.update_one(
        {"id": alert_id, "user_id": current_user["id"]},
        {"$set": {"triggered": False, "triggered_at": None}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"message": "Alert reset"}

# ============ Root ============

@api_router.get("/")
async def root():
    return {"message": "Stock Portfolio Tracker API"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

# Include router and middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
