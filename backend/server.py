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

# Alpha Vantage
ALPHA_VANTAGE_KEY = os.environ.get('ALPHA_VANTAGE_KEY', 'demo')

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
        "AAPL": 178.50, "GOOGL": 141.80, "MSFT": 378.90, "AMZN": 178.25,
        "TSLA": 248.50, "META": 505.75, "NVDA": 875.30, "JPM": 195.40,
        "V": 275.60, "WMT": 165.80
    }
    base_price = base_prices.get(symbol, 100 + random.random() * 200)
    change = (random.random() - 0.5) * 10
    return {
        "symbol": symbol,
        "price": round(base_price + change, 2),
        "change": round(change, 2),
        "change_percent": str(round((change / base_price) * 100, 2)),
        "volume": random.randint(1000000, 50000000),
        "latest_trading_day": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "previous_close": round(base_price, 2),
        "is_mock": True
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
                for match in data["bestMatches"][:10]:
                    results.append({
                        "symbol": match.get("1. symbol", ""),
                        "name": match.get("2. name", ""),
                        "type": match.get("3. type", ""),
                        "region": match.get("4. region", ""),
                        "currency": match.get("8. currency", "USD")
                    })
                return results
            elif "Note" in data:
                # API limit - return popular stocks
                return get_popular_stocks(query)
            return []
    except Exception as e:
        logger.error(f"Error searching stocks: {e}")
        return get_popular_stocks(query)

def get_popular_stocks(query: str = ""):
    """Return popular stocks when API is unavailable"""
    stocks = [
        {"symbol": "AAPL", "name": "Apple Inc", "type": "Equity", "region": "United States", "currency": "USD"},
        {"symbol": "GOOGL", "name": "Alphabet Inc", "type": "Equity", "region": "United States", "currency": "USD"},
        {"symbol": "MSFT", "name": "Microsoft Corporation", "type": "Equity", "region": "United States", "currency": "USD"},
        {"symbol": "AMZN", "name": "Amazon.com Inc", "type": "Equity", "region": "United States", "currency": "USD"},
        {"symbol": "TSLA", "name": "Tesla Inc", "type": "Equity", "region": "United States", "currency": "USD"},
        {"symbol": "META", "name": "Meta Platforms Inc", "type": "Equity", "region": "United States", "currency": "USD"},
        {"symbol": "NVDA", "name": "NVIDIA Corporation", "type": "Equity", "region": "United States", "currency": "USD"},
        {"symbol": "JPM", "name": "JPMorgan Chase & Co", "type": "Equity", "region": "United States", "currency": "USD"},
        {"symbol": "V", "name": "Visa Inc", "type": "Equity", "region": "United States", "currency": "USD"},
        {"symbol": "WMT", "name": "Walmart Inc", "type": "Equity", "region": "United States", "currency": "USD"},
    ]
    if query:
        query_lower = query.lower()
        return [s for s in stocks if query_lower in s["symbol"].lower() or query_lower in s["name"].lower()]
    return stocks

# ============ Portfolio Summary ============

@api_router.get("/portfolio/summary")
async def get_portfolio_summary(current_user: dict = Depends(get_current_user)):
    holdings = await db.holdings.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    
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
    symbols = list(set(h["symbol"] for h in holdings))
    quotes = {}
    for symbol in symbols:
        quotes[symbol] = await fetch_stock_quote(symbol)
    
    total_value = 0
    total_cost = 0
    holdings_with_prices = []
    
    for holding in holdings:
        quote = quotes.get(holding["symbol"], {})
        current_price = quote.get("price", holding["buy_price"])
        market_value = current_price * holding["shares"]
        cost_basis = holding["buy_price"] * holding["shares"]
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
            "day_change": quote.get("change", 0),
            "day_change_percent": float(quote.get("change_percent", "0"))
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
