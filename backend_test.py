import requests
import sys
import json
from datetime import datetime

class StockPortfolioAPITester:
    def __init__(self, base_url="https://asset-monitor-48.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.user_id = None

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}")
        if details:
            print(f"    {details}")

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            
            if not success:
                details += f" (Expected: {expected_status})"
                try:
                    error_data = response.json()
                    details += f" - {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f" - {response.text[:100]}"
            
            self.log_test(name, success, details)
            
            if success:
                try:
                    return response.json()
                except:
                    return {}
            return None

        except Exception as e:
            self.log_test(name, False, f"Error: {str(e)}")
            return None

    def test_health_check(self):
        """Test basic health endpoints"""
        print("\n🔍 Testing Health Endpoints...")
        self.run_test("Health Check", "GET", "health", 200)
        self.run_test("Root Endpoint", "GET", "", 200)

    def test_auth_flow(self):
        """Test authentication flow"""
        print("\n🔍 Testing Authentication...")
        
        # Generate unique test user
        timestamp = datetime.now().strftime('%H%M%S')
        test_email = f"test_user_{timestamp}@example.com"
        test_password = "TestPass123!"
        test_name = f"Test User {timestamp}"

        # Test registration
        register_data = {
            "email": test_email,
            "password": test_password,
            "name": test_name
        }
        
        response = self.run_test("User Registration", "POST", "auth/register", 200, register_data)
        if response and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            print(f"    Registered user: {test_email}")
        else:
            print("❌ Registration failed - cannot continue with authenticated tests")
            return False

        # Test login
        login_data = {
            "email": test_email,
            "password": test_password
        }
        
        login_response = self.run_test("User Login", "POST", "auth/login", 200, login_data)
        if login_response and 'access_token' in login_response:
            self.token = login_response['access_token']
            print(f"    Login successful")
        
        # Test get current user
        self.run_test("Get Current User", "GET", "auth/me", 200)
        
        return True

    def test_stock_functionality(self):
        """Test stock-related endpoints"""
        print("\n🔍 Testing Stock Functionality...")
        
        # Test stock search - US stocks
        self.run_test("Stock Search - US", "GET", "stocks/search?query=AAPL", 200)
        
        # Test stock search - European stocks
        self.run_test("Stock Search - European", "GET", "stocks/search?query=BMW", 200)
        
        # Test stock quote - US
        self.run_test("Stock Quote - US", "GET", "stocks/quote/AAPL", 200)
        
        # Test stock quote - European (BMW.DEX)
        self.run_test("Stock Quote - European BMW", "GET", "stocks/quote/BMW.DEX", 200)
        
        # Test stock quote - European (SHEL.LON)
        self.run_test("Stock Quote - European Shell", "GET", "stocks/quote/SHEL.LON", 200)
        
        # Test multiple quotes with mixed US/EU
        self.run_test("Multiple Quotes - Mixed US/EU", "GET", "stocks/quotes?symbols=AAPL,BMW.DEX,SHEL.LON", 200)

    def test_european_stocks_specific(self):
        """Test European stocks specific functionality"""
        print("\n🔍 Testing European Stocks Specific Features...")
        
        # Test search returns European stocks with exchange field
        search_response = self.run_test("European Stock Search Response", "GET", "stocks/search?query=BMW", 200)
        if search_response:
            # Check if response contains European stocks with exchange info
            found_bmw = False
            for stock in search_response:
                if "BMW" in stock.get("symbol", ""):
                    found_bmw = True
                    exchange = stock.get("exchange", "")
                    currency = stock.get("currency", "")
                    self.log_test("BMW Stock Has Exchange Field", bool(exchange), f"Exchange: {exchange}")
                    self.log_test("BMW Stock Has Currency Field", bool(currency), f"Currency: {currency}")
                    break
            
            if not found_bmw:
                self.log_test("BMW Stock Found in Search", False, "BMW not found in search results")
        
        # Test various European exchanges
        european_stocks = [
            ("BMW.DEX", "Frankfurt"),
            ("SHEL.LON", "London"), 
            ("OR.PAR", "Paris"),
            ("ASML.AMS", "Amsterdam"),
            ("NESN.SWX", "Zurich"),
            ("ENI.MIL", "Milan"),
            ("SAN.MAD", "Madrid"),
            ("NOVO-B.CPH", "Copenhagen"),
            ("VOLV-B.STO", "Stockholm"),
            ("EQNR.OSL", "Oslo")
        ]
        
        for symbol, expected_exchange in european_stocks:
            quote_response = self.run_test(f"Quote for {symbol}", "GET", f"stocks/quote/{symbol}", 200)
            if quote_response:
                currency = quote_response.get("currency", "")
                is_mock = quote_response.get("is_mock", False)
                self.log_test(f"{symbol} Has Currency", bool(currency), f"Currency: {currency}, Mock: {is_mock}")
        
        # Test search with European terms
        european_searches = ["Shell", "BMW", "ASML", "Nestle", "Volkswagen"]
        for search_term in european_searches:
            self.run_test(f"European Search - {search_term}", "GET", f"stocks/search?query={search_term}", 200)
        """Test holdings CRUD operations"""
        print("\n🔍 Testing Holdings CRUD...")
        
        # Get initial holdings
        self.run_test("Get Holdings (Empty)", "GET", "holdings", 200)
        
        # Create holding
        holding_data = {
            "symbol": "AAPL",
            "shares": 10.5,
            "buy_price": 150.00,
            "buy_date": "2024-01-15"
        }
        
        create_response = self.run_test("Create Holding", "POST", "holdings", 200, holding_data)
        holding_id = None
        if create_response and 'id' in create_response:
            holding_id = create_response['id']
            print(f"    Created holding ID: {holding_id}")
        
        # Get holdings after creation
        self.run_test("Get Holdings (After Create)", "GET", "holdings", 200)
        
        # Update holding
        if holding_id:
            update_data = {
                "shares": 15.0,
                "buy_price": 155.00
            }
            self.run_test("Update Holding", "PUT", f"holdings/{holding_id}", 200, update_data)
        
        # Delete holding
        if holding_id:
            self.run_test("Delete Holding", "DELETE", f"holdings/{holding_id}", 200)

    def test_watchlist_crud(self):
        """Test watchlist CRUD operations"""
        print("\n🔍 Testing Watchlist CRUD...")
        
        # Get initial watchlist
        self.run_test("Get Watchlist (Empty)", "GET", "watchlist", 200)
        
        # Add to watchlist
        watchlist_data = {"symbol": "TSLA"}
        self.run_test("Add to Watchlist", "POST", "watchlist", 200, watchlist_data)
        
        # Get watchlist after addition
        self.run_test("Get Watchlist (After Add)", "GET", "watchlist", 200)
        
        # Remove from watchlist
        self.run_test("Remove from Watchlist", "DELETE", "watchlist/TSLA", 200)

    def test_portfolio_summary(self):
        """Test portfolio summary"""
        print("\n🔍 Testing Portfolio Summary...")
        self.run_test("Portfolio Summary", "GET", "portfolio/summary", 200)

    def test_crypto_functionality(self):
        """Test crypto-related endpoints"""
        print("\n🔍 Testing Crypto Functionality...")
        
        # Test top cryptos
        self.run_test("Get Top Cryptos", "GET", "crypto/top", 200)
        
        # Test crypto search
        self.run_test("Crypto Search", "GET", "crypto/search?query=bitcoin", 200)
        
        # Test crypto price
        self.run_test("Crypto Price", "GET", "crypto/price/bitcoin", 200)

    def test_crypto_holdings_crud(self):
        """Test crypto holdings CRUD operations"""
        print("\n🔍 Testing Crypto Holdings CRUD...")
        
        # Get initial crypto holdings
        self.run_test("Get Crypto Holdings (Empty)", "GET", "crypto/holdings", 200)
        
        # Create crypto holding
        crypto_holding_data = {
            "coin_id": "bitcoin",
            "symbol": "BTC",
            "name": "Bitcoin",
            "amount": 0.5,
            "buy_price": 45000.00,
            "buy_date": "2024-01-15"
        }
        
        create_response = self.run_test("Create Crypto Holding", "POST", "crypto/holdings", 200, crypto_holding_data)
        holding_id = None
        if create_response and 'id' in create_response:
            holding_id = create_response['id']
            print(f"    Created crypto holding ID: {holding_id}")
        
        # Get crypto holdings after creation
        self.run_test("Get Crypto Holdings (After Create)", "GET", "crypto/holdings", 200)
        
        # Update crypto holding
        if holding_id:
            update_data = {
                "amount": 0.75,
                "buy_price": 47000.00
            }
            self.run_test("Update Crypto Holding", "PUT", f"crypto/holdings/{holding_id}", 200, update_data)
        
        # Delete crypto holding
        if holding_id:
            self.run_test("Delete Crypto Holding", "DELETE", f"crypto/holdings/{holding_id}", 200)

    def test_crypto_watchlist_crud(self):
        """Test crypto watchlist CRUD operations"""
        print("\n🔍 Testing Crypto Watchlist CRUD...")
        
        # Get initial crypto watchlist
        self.run_test("Get Crypto Watchlist (Empty)", "GET", "crypto/watchlist", 200)
        
        # Add to crypto watchlist
        crypto_watchlist_data = {
            "coin_id": "ethereum",
            "symbol": "ETH",
            "name": "Ethereum"
        }
        self.run_test("Add to Crypto Watchlist", "POST", "crypto/watchlist", 200, crypto_watchlist_data)
        
        # Get crypto watchlist after addition
        self.run_test("Get Crypto Watchlist (After Add)", "GET", "crypto/watchlist", 200)
        
        # Remove from crypto watchlist
        self.run_test("Remove from Crypto Watchlist", "DELETE", "crypto/watchlist/ethereum", 200)

    def test_crypto_portfolio_summary(self):
        """Test crypto portfolio summary"""
        print("\n🔍 Testing Crypto Portfolio Summary...")
        self.run_test("Crypto Portfolio Summary", "GET", "crypto/portfolio/summary", 200)

    def test_price_alerts_crud(self):
        """Test price alerts CRUD operations"""
        print("\n🔍 Testing Price Alerts CRUD...")
        
        # Get initial alerts (should be empty)
        self.run_test("Get Price Alerts (Empty)", "GET", "alerts", 200)
        
        # Create stock alert
        stock_alert_data = {
            "asset_type": "stock",
            "symbol": "AAPL",
            "name": "Apple Inc",
            "target_price": 200.00,
            "condition": "above"
        }
        
        create_response = self.run_test("Create Stock Alert", "POST", "alerts", 200, stock_alert_data)
        stock_alert_id = None
        if create_response and 'id' in create_response:
            stock_alert_id = create_response['id']
            print(f"    Created stock alert ID: {stock_alert_id}")
        
        # Create crypto alert
        crypto_alert_data = {
            "asset_type": "crypto",
            "symbol": "BTC",
            "name": "Bitcoin",
            "target_price": 50000.00,
            "condition": "below",
            "coin_id": "bitcoin"
        }
        
        create_response = self.run_test("Create Crypto Alert", "POST", "alerts", 200, crypto_alert_data)
        crypto_alert_id = None
        if create_response and 'id' in create_response:
            crypto_alert_id = create_response['id']
            print(f"    Created crypto alert ID: {crypto_alert_id}")
        
        # Get alerts after creation
        self.run_test("Get Price Alerts (After Create)", "GET", "alerts", 200)
        
        # Check alerts
        self.run_test("Check Price Alerts", "GET", "alerts/check", 200)
        
        # Reset alert (if we have one)
        if stock_alert_id:
            self.run_test("Reset Stock Alert", "POST", f"alerts/{stock_alert_id}/reset", 200)
        
        # Delete alerts
        if stock_alert_id:
            self.run_test("Delete Stock Alert", "DELETE", f"alerts/{stock_alert_id}", 200)
        
        if crypto_alert_id:
            self.run_test("Delete Crypto Alert", "DELETE", f"alerts/{crypto_alert_id}", 200)

    def run_all_tests(self):
        """Run all tests"""
        print("🚀 Starting Stock Portfolio API Tests...")
        print(f"Base URL: {self.base_url}")
        
        # Basic health checks
        self.test_health_check()
        
        # Authentication flow
        if not self.test_auth_flow():
            print("❌ Authentication failed - stopping tests")
            return False
        
        # Stock functionality tests
        self.test_stock_functionality()
        self.test_holdings_crud()
        self.test_watchlist_crud()
        self.test_portfolio_summary()
        
        # NEW: Crypto functionality tests
        self.test_crypto_functionality()
        self.test_crypto_holdings_crud()
        self.test_crypto_watchlist_crud()
        self.test_crypto_portfolio_summary()
        
        # NEW: Price Alerts functionality tests
        self.test_price_alerts_crud()
        
        return True

    def print_summary(self):
        """Print test summary"""
        print(f"\n📊 Test Summary:")
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        # Print failed tests
        failed_tests = [t for t in self.test_results if not t['success']]
        if failed_tests:
            print(f"\n❌ Failed Tests:")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['details']}")
        
        return self.tests_passed == self.tests_run

def main():
    tester = StockPortfolioAPITester()
    
    try:
        success = tester.run_all_tests()
        tester.print_summary()
        
        # Save detailed results
        with open('/app/test_reports/backend_test_results.json', 'w') as f:
            json.dump({
                'summary': {
                    'tests_run': tester.tests_run,
                    'tests_passed': tester.tests_passed,
                    'success_rate': tester.tests_passed/tester.tests_run*100 if tester.tests_run > 0 else 0
                },
                'results': tester.test_results,
                'timestamp': datetime.now().isoformat()
            }, f, indent=2)
        
        return 0 if success else 1
        
    except Exception as e:
        print(f"❌ Test execution failed: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())