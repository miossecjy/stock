import requests
import sys
import json
from datetime import datetime

class FinnhubIntegrationTester:
    def __init__(self, base_url="https://asset-monitor-48.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

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

    def run_test(self, name, method, endpoint, expected_status, data=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)

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

    def setup_auth(self):
        """Setup authentication for tests"""
        print("🔍 Setting up authentication...")
        
        # Generate unique test user
        timestamp = datetime.now().strftime('%H%M%S')
        test_email = f"finnhub_test_{timestamp}@example.com"
        test_password = "TestPass123!"
        test_name = f"Finnhub Test User {timestamp}"

        # Register user
        register_data = {
            "email": test_email,
            "password": test_password,
            "name": test_name
        }
        
        response = self.run_test("User Registration", "POST", "auth/register", 200, register_data)
        if response and 'access_token' in response:
            self.token = response['access_token']
            print(f"    Registered user: {test_email}")
            return True
        else:
            print("❌ Registration failed - cannot continue with tests")
            return False

    def test_finnhub_stock_search(self):
        """Test stock search uses Finnhub API and returns source field"""
        print("\n🔍 Testing Finnhub Stock Search Integration...")
        
        # Test search for AAPL (US stock - should use Finnhub)
        search_response = self.run_test("Stock Search - AAPL", "GET", "stocks/search?query=AAPL", 200)
        if search_response:
            found_aapl = False
            for stock in search_response:
                if stock.get("symbol") == "AAPL":
                    found_aapl = True
                    self.log_test("AAPL Found in Search Results", True, f"Symbol: {stock.get('symbol')}, Name: {stock.get('name')}")
                    break
            
            if not found_aapl:
                self.log_test("AAPL Found in Search Results", False, "AAPL not found in search results")
        
        # Test search for MSTR (US stock - should use Finnhub)
        search_response = self.run_test("Stock Search - MSTR", "GET", "stocks/search?query=MSTR", 200)
        if search_response:
            found_mstr = False
            for stock in search_response:
                if stock.get("symbol") == "MSTR":
                    found_mstr = True
                    self.log_test("MSTR Found in Search Results", True, f"Symbol: {stock.get('symbol')}, Name: {stock.get('name')}")
                    break
            
            if not found_mstr:
                self.log_test("MSTR Found in Search Results", False, "MSTR not found in search results")
        
        # Test search for BMW (European stock - should fall back to mock)
        search_response = self.run_test("Stock Search - BMW", "GET", "stocks/search?query=BMW", 200)
        if search_response:
            found_bmw = False
            for stock in search_response:
                if "BMW" in stock.get("symbol", ""):
                    found_bmw = True
                    self.log_test("BMW Found in Search Results", True, f"Symbol: {stock.get('symbol')}, Name: {stock.get('name')}")
                    break
            
            if not found_bmw:
                self.log_test("BMW Found in Search Results", False, "BMW not found in search results")

    def test_finnhub_stock_quotes(self):
        """Test stock quotes use Finnhub for US stocks and check source field"""
        print("\n🔍 Testing Finnhub Stock Quotes Integration...")
        
        # Test AAPL quote (US stock - should use Finnhub)
        aapl_quote = self.run_test("Stock Quote - AAPL", "GET", "stocks/quote/AAPL", 200)
        if aapl_quote:
            source = aapl_quote.get("source", "")
            price = aapl_quote.get("price", 0)
            symbol = aapl_quote.get("symbol", "")
            
            self.log_test("AAPL Quote Has Source Field", bool(source), f"Source: {source}")
            self.log_test("AAPL Quote Source is Finnhub", source == "finnhub", f"Expected: finnhub, Got: {source}")
            self.log_test("AAPL Quote Has Valid Price", price > 0, f"Price: {price}")
            self.log_test("AAPL Quote Has Correct Symbol", symbol == "AAPL", f"Symbol: {symbol}")
        
        # Test MSTR quote (US stock - should use Finnhub)
        mstr_quote = self.run_test("Stock Quote - MSTR", "GET", "stocks/quote/MSTR", 200)
        if mstr_quote:
            source = mstr_quote.get("source", "")
            price = mstr_quote.get("price", 0)
            symbol = mstr_quote.get("symbol", "")
            
            self.log_test("MSTR Quote Has Source Field", bool(source), f"Source: {source}")
            self.log_test("MSTR Quote Source is Finnhub", source == "finnhub", f"Expected: finnhub, Got: {source}")
            self.log_test("MSTR Quote Has Valid Price", price > 0, f"Price: {price}")
            self.log_test("MSTR Quote Has Correct Symbol", symbol == "MSTR", f"Symbol: {symbol}")
        
        # Test BMW.DEX quote (European stock - should fall back to mock)
        bmw_quote = self.run_test("Stock Quote - BMW.DEX", "GET", "stocks/quote/BMW.DEX", 200)
        if bmw_quote:
            source = bmw_quote.get("source", "")
            is_mock = bmw_quote.get("is_mock", False)
            price = bmw_quote.get("price", 0)
            currency = bmw_quote.get("currency", "")
            
            self.log_test("BMW.DEX Quote Has Price", price > 0, f"Price: {price}")
            self.log_test("BMW.DEX Quote Is Mock Data", is_mock, f"Is Mock: {is_mock}")
            self.log_test("BMW.DEX Quote Has EUR Currency", currency == "EUR", f"Currency: {currency}")
            
            # European stocks should NOT have Finnhub source (free tier doesn't support EU)
            if source == "finnhub":
                self.log_test("BMW.DEX Quote NOT Using Finnhub (Expected)", False, f"European stock should not use Finnhub free tier, got source: {source}")
            else:
                self.log_test("BMW.DEX Quote NOT Using Finnhub (Expected)", True, f"Correctly not using Finnhub for EU stock, source: {source}")

    def test_multiple_quotes_mixed(self):
        """Test multiple quotes with mixed US/European stocks"""
        print("\n🔍 Testing Multiple Quotes with Mixed US/European Stocks...")
        
        # Test multiple quotes: AAPL (US), MSTR (US), BMW.DEX (EU)
        quotes_response = self.run_test("Multiple Quotes - Mixed", "GET", "stocks/quotes?symbols=AAPL,MSTR,BMW.DEX", 200)
        if quotes_response:
            # Check AAPL
            if "AAPL" in quotes_response:
                aapl_data = quotes_response["AAPL"]
                source = aapl_data.get("source", "")
                self.log_test("Multiple Quotes - AAPL Source is Finnhub", source == "finnhub", f"AAPL Source: {source}")
            
            # Check MSTR
            if "MSTR" in quotes_response:
                mstr_data = quotes_response["MSTR"]
                source = mstr_data.get("source", "")
                self.log_test("Multiple Quotes - MSTR Source is Finnhub", source == "finnhub", f"MSTR Source: {source}")
            
            # Check BMW.DEX
            if "BMW.DEX" in quotes_response:
                bmw_data = quotes_response["BMW.DEX"]
                is_mock = bmw_data.get("is_mock", False)
                currency = bmw_data.get("currency", "")
                self.log_test("Multiple Quotes - BMW.DEX Is Mock", is_mock, f"BMW.DEX Is Mock: {is_mock}")
                self.log_test("Multiple Quotes - BMW.DEX Currency EUR", currency == "EUR", f"BMW.DEX Currency: {currency}")

    def test_existing_features_still_work(self):
        """Test that all existing features still work after Finnhub integration"""
        print("\n🔍 Testing Existing Features Still Work...")
        
        # Test holdings functionality
        self.run_test("Holdings - Get Empty", "GET", "holdings", 200)
        
        # Create a holding with US stock (AAPL)
        holding_data = {
            "symbol": "AAPL",
            "shares": 10.0,
            "buy_price": 150.00,
            "buy_date": "2024-01-15"
        }
        
        create_response = self.run_test("Holdings - Create AAPL", "POST", "holdings", 200, holding_data)
        holding_id = None
        if create_response and 'id' in create_response:
            holding_id = create_response['id']
        
        # Test watchlist functionality
        watchlist_data = {"symbol": "MSTR"}
        self.run_test("Watchlist - Add MSTR", "POST", "watchlist", 200, watchlist_data)
        self.run_test("Watchlist - Get", "GET", "watchlist", 200)
        self.run_test("Watchlist - Remove MSTR", "DELETE", "watchlist/MSTR", 200)
        
        # Test crypto functionality
        self.run_test("Crypto - Get Top", "GET", "crypto/top", 200)
        self.run_test("Crypto - Search Bitcoin", "GET", "crypto/search?query=bitcoin", 200)
        
        # Test alerts functionality
        alert_data = {
            "asset_type": "stock",
            "symbol": "AAPL",
            "name": "Apple Inc",
            "target_price": 200.00,
            "condition": "above"
        }
        
        alert_response = self.run_test("Alerts - Create Stock Alert", "POST", "alerts", 200, alert_data)
        alert_id = None
        if alert_response and 'id' in alert_response:
            alert_id = alert_response['id']
        
        # Test portfolio summary
        self.run_test("Portfolio - Summary", "GET", "portfolio/summary", 200)
        
        # Clean up
        if holding_id:
            self.run_test("Holdings - Delete AAPL", "DELETE", f"holdings/{holding_id}", 200)
        
        if alert_id:
            self.run_test("Alerts - Delete", "DELETE", f"alerts/{alert_id}", 200)

    def test_dashboard_currency_conversion(self):
        """Test dashboard displays portfolio with converted currencies"""
        print("\n🔍 Testing Dashboard Currency Conversion...")
        
        # Create holdings with different currencies
        holdings_data = [
            {
                "symbol": "AAPL",
                "shares": 5.0,
                "buy_price": 150.00,
                "buy_date": "2024-01-15"
            },
            {
                "symbol": "BMW.DEX",
                "shares": 3.0,
                "buy_price": 98.50,
                "buy_date": "2024-01-15"
            }
        ]
        
        created_holdings = []
        
        # Create holdings
        for holding_data in holdings_data:
            create_response = self.run_test(
                f"Create Holding - {holding_data['symbol']}", 
                "POST", 
                "holdings", 
                200, 
                holding_data
            )
            if create_response and 'id' in create_response:
                created_holdings.append(create_response['id'])
        
        if created_holdings:
            # Test portfolio summary in different currencies
            currencies = ["USD", "EUR", "GBP"]
            
            for currency in currencies:
                summary_response = self.run_test(
                    f"Portfolio Summary - {currency}", 
                    "GET", 
                    f"portfolio/summary?display_currency={currency}", 
                    200
                )
                
                if summary_response:
                    display_currency = summary_response.get("display_currency", "")
                    total_value = summary_response.get("total_value", 0)
                    holdings = summary_response.get("holdings", [])
                    
                    self.log_test(f"Portfolio Currency Set to {currency}", display_currency == currency, f"Currency: {display_currency}")
                    self.log_test(f"Portfolio Has Value in {currency}", total_value > 0, f"Value: {total_value}")
                    
                    # Check holdings have currency conversion fields
                    for holding in holdings:
                        symbol = holding.get("symbol", "")
                        original_currency = holding.get("original_currency", "")
                        market_value_converted = holding.get("market_value_converted")
                        
                        self.log_test(f"{symbol} Has Original Currency", bool(original_currency), f"Original: {original_currency}")
                        self.log_test(f"{symbol} Has Converted Value", market_value_converted is not None, f"Converted: {market_value_converted}")
        
        # Clean up holdings
        for holding_id in created_holdings:
            self.run_test("Delete Test Holding", "DELETE", f"holdings/{holding_id}", 200)

    def run_all_tests(self):
        """Run all Finnhub integration tests"""
        print("🚀 Starting Finnhub Integration Tests...")
        print(f"Base URL: {self.base_url}")
        
        # Setup authentication
        if not self.setup_auth():
            return False
        
        # Run Finnhub-specific tests
        self.test_finnhub_stock_search()
        self.test_finnhub_stock_quotes()
        self.test_multiple_quotes_mixed()
        self.test_existing_features_still_work()
        self.test_dashboard_currency_conversion()
        
        return True

    def print_summary(self):
        """Print test summary"""
        print(f"\n📊 Finnhub Integration Test Summary:")
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
    tester = FinnhubIntegrationTester()
    
    try:
        success = tester.run_all_tests()
        tester.print_summary()
        
        # Save detailed results
        with open('/app/test_reports/finnhub_integration_results.json', 'w') as f:
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