"""
Test cases for Portfolio Holdings Bug Fixes:
1. Holdings should be created with portfolio_id
2. Dashboard summary should filter by portfolio_id
3. Total stocks should show correctly when filtered by portfolio
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPortfolioHoldingsBugFix:
    """Test the bug fixes for portfolio_id in holdings and summary"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test user and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Create unique test user
        self.test_email = f"TEST_portfolio_bug_{uuid.uuid4().hex[:8]}@test.com"
        self.test_password = "Test123!"
        
        # Register user
        register_response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.test_email,
            "password": self.test_password,
            "name": "Portfolio Bug Test User"
        })
        
        if register_response.status_code == 201:
            data = register_response.json()
            self.token = data.get("token")
            self.user_id = data.get("user", {}).get("id")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip(f"Failed to register test user: {register_response.text}")
        
        yield
        
        # Cleanup - delete test holdings
        try:
            holdings = self.session.get(f"{BASE_URL}/api/holdings").json()
            for holding in holdings:
                if holding.get("symbol", "").startswith("TEST") or True:  # Delete all test holdings
                    self.session.delete(f"{BASE_URL}/api/holdings/{holding['id']}")
        except:
            pass
    
    def test_01_default_portfolio_created_on_registration(self):
        """Test that a default portfolio is created when user registers"""
        response = self.session.get(f"{BASE_URL}/api/portfolios")
        assert response.status_code == 200, f"Failed to get portfolios: {response.text}"
        
        portfolios = response.json()
        assert len(portfolios) >= 1, "No default portfolio created"
        
        # Check for Main Portfolio
        main_portfolio = next((p for p in portfolios if p.get("name") == "Main Portfolio"), None)
        assert main_portfolio is not None, "Main Portfolio not found"
        assert main_portfolio.get("is_default") == True, "Main Portfolio should be default"
        
        self.portfolio_id = main_portfolio["id"]
        print(f"✓ Default portfolio created: {main_portfolio['name']} (ID: {self.portfolio_id})")
    
    def test_02_create_holding_with_portfolio_id(self):
        """Test that holdings are created with portfolio_id"""
        # Get default portfolio
        portfolios = self.session.get(f"{BASE_URL}/api/portfolios").json()
        portfolio_id = portfolios[0]["id"]
        
        # Create holding with portfolio_id
        holding_data = {
            "symbol": "AAPL",
            "shares": 10,
            "buy_price": 150.00,
            "buy_date": "2024-01-15",
            "portfolio_id": portfolio_id
        }
        
        response = self.session.post(f"{BASE_URL}/api/holdings", json=holding_data)
        assert response.status_code == 200 or response.status_code == 201, f"Failed to create holding: {response.text}"
        
        holding = response.json()
        assert holding.get("portfolio_id") == portfolio_id, f"Holding portfolio_id mismatch. Expected: {portfolio_id}, Got: {holding.get('portfolio_id')}"
        assert holding.get("symbol") == "AAPL", "Symbol mismatch"
        assert holding.get("shares") == 10, "Shares mismatch"
        
        self.holding_id = holding["id"]
        print(f"✓ Holding created with portfolio_id: {holding['portfolio_id']}")
    
    def test_03_create_holding_without_portfolio_id_uses_default(self):
        """Test that holdings without portfolio_id use default portfolio"""
        # Get default portfolio
        portfolios = self.session.get(f"{BASE_URL}/api/portfolios").json()
        default_portfolio = next((p for p in portfolios if p.get("is_default")), portfolios[0])
        
        # Create holding WITHOUT portfolio_id
        holding_data = {
            "symbol": "GOOGL",
            "shares": 5,
            "buy_price": 140.00,
            "buy_date": "2024-01-20"
        }
        
        response = self.session.post(f"{BASE_URL}/api/holdings", json=holding_data)
        assert response.status_code == 200 or response.status_code == 201, f"Failed to create holding: {response.text}"
        
        holding = response.json()
        assert holding.get("portfolio_id") == default_portfolio["id"], f"Holding should use default portfolio. Expected: {default_portfolio['id']}, Got: {holding.get('portfolio_id')}"
        
        print(f"✓ Holding without portfolio_id uses default: {holding['portfolio_id']}")
    
    def test_04_get_holdings_filtered_by_portfolio(self):
        """Test that holdings can be filtered by portfolio_id"""
        # Get default portfolio
        portfolios = self.session.get(f"{BASE_URL}/api/portfolios").json()
        portfolio_id = portfolios[0]["id"]
        
        # Get holdings filtered by portfolio
        response = self.session.get(f"{BASE_URL}/api/holdings?portfolio_id={portfolio_id}")
        assert response.status_code == 200, f"Failed to get holdings: {response.text}"
        
        holdings = response.json()
        # All holdings should belong to the specified portfolio
        for holding in holdings:
            assert holding.get("portfolio_id") == portfolio_id, f"Holding {holding.get('symbol')} has wrong portfolio_id"
        
        print(f"✓ Holdings filtered by portfolio_id: {len(holdings)} holdings found")
    
    def test_05_portfolio_summary_with_portfolio_id(self):
        """Test that portfolio summary filters by portfolio_id - THE BUG FIX"""
        # Get default portfolio
        portfolios = self.session.get(f"{BASE_URL}/api/portfolios").json()
        portfolio_id = portfolios[0]["id"]
        
        # First ensure we have a holding
        holding_data = {
            "symbol": "MSFT",
            "shares": 10,
            "buy_price": 350.00,
            "portfolio_id": portfolio_id
        }
        self.session.post(f"{BASE_URL}/api/holdings", json=holding_data)
        
        # Get portfolio summary WITH portfolio_id
        response = self.session.get(f"{BASE_URL}/api/portfolio/summary?display_currency=USD&portfolio_id={portfolio_id}")
        assert response.status_code == 200, f"Failed to get portfolio summary: {response.text}"
        
        summary = response.json()
        
        # Verify summary has data
        assert "total_value" in summary, "Summary missing total_value"
        assert "holdings_count" in summary, "Summary missing holdings_count"
        assert "holdings" in summary, "Summary missing holdings list"
        
        # THE KEY BUG FIX TEST: total_value should NOT be $0.00 if we have holdings
        if summary.get("holdings_count", 0) > 0:
            assert summary.get("total_value", 0) > 0, f"BUG: Total value is $0.00 but we have {summary.get('holdings_count')} holdings!"
        
        print(f"✓ Portfolio summary with portfolio_id: total_value=${summary.get('total_value', 0):.2f}, holdings_count={summary.get('holdings_count', 0)}")
    
    def test_06_portfolio_summary_without_portfolio_id(self):
        """Test portfolio summary without portfolio_id returns all holdings"""
        response = self.session.get(f"{BASE_URL}/api/portfolio/summary?display_currency=USD")
        assert response.status_code == 200, f"Failed to get portfolio summary: {response.text}"
        
        summary = response.json()
        assert "total_value" in summary, "Summary missing total_value"
        
        print(f"✓ Portfolio summary without portfolio_id: total_value=${summary.get('total_value', 0):.2f}")
    
    def test_07_holdings_linked_to_correct_portfolio(self):
        """Test that holdings are properly linked to their portfolio"""
        # Get portfolios
        portfolios = self.session.get(f"{BASE_URL}/api/portfolios").json()
        portfolio_id = portfolios[0]["id"]
        
        # Get all holdings
        all_holdings = self.session.get(f"{BASE_URL}/api/holdings").json()
        
        # Get holdings for specific portfolio
        portfolio_holdings = self.session.get(f"{BASE_URL}/api/holdings?portfolio_id={portfolio_id}").json()
        
        # Verify all portfolio holdings have correct portfolio_id
        for holding in portfolio_holdings:
            assert holding.get("portfolio_id") == portfolio_id, f"Holding {holding.get('symbol')} not linked to portfolio"
        
        print(f"✓ All {len(portfolio_holdings)} holdings properly linked to portfolio {portfolio_id}")
    
    def test_08_specific_portfolio_summary_endpoint(self):
        """Test the specific portfolio summary endpoint"""
        # Get default portfolio
        portfolios = self.session.get(f"{BASE_URL}/api/portfolios").json()
        portfolio_id = portfolios[0]["id"]
        
        # Get specific portfolio summary
        response = self.session.get(f"{BASE_URL}/api/portfolios/{portfolio_id}/summary?display_currency=USD")
        assert response.status_code == 200, f"Failed to get specific portfolio summary: {response.text}"
        
        summary = response.json()
        assert "portfolio" in summary, "Summary missing portfolio info"
        assert "total_value" in summary, "Summary missing total_value"
        assert summary.get("portfolio", {}).get("id") == portfolio_id, "Portfolio ID mismatch in summary"
        
        print(f"✓ Specific portfolio summary: {summary.get('portfolio', {}).get('name')} - ${summary.get('total_value', 0):.2f}")


class TestHoldingsCRUD:
    """Test basic CRUD operations for holdings"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test user"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        self.test_email = f"TEST_crud_{uuid.uuid4().hex[:8]}@test.com"
        self.test_password = "Test123!"
        
        register_response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.test_email,
            "password": self.test_password,
            "name": "CRUD Test User"
        })
        
        if register_response.status_code == 201:
            data = register_response.json()
            self.token = data.get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip(f"Failed to register: {register_response.text}")
        
        yield
    
    def test_create_holding(self):
        """Test creating a holding"""
        portfolios = self.session.get(f"{BASE_URL}/api/portfolios").json()
        portfolio_id = portfolios[0]["id"]
        
        response = self.session.post(f"{BASE_URL}/api/holdings", json={
            "symbol": "NVDA",
            "shares": 5,
            "buy_price": 800.00,
            "portfolio_id": portfolio_id
        })
        
        assert response.status_code in [200, 201], f"Create failed: {response.text}"
        holding = response.json()
        assert holding["symbol"] == "NVDA"
        assert holding["shares"] == 5
        assert holding["portfolio_id"] == portfolio_id
        
        print(f"✓ Created holding: {holding['symbol']}")
    
    def test_read_holdings(self):
        """Test reading holdings"""
        response = self.session.get(f"{BASE_URL}/api/holdings")
        assert response.status_code == 200, f"Read failed: {response.text}"
        
        holdings = response.json()
        assert isinstance(holdings, list)
        print(f"✓ Read {len(holdings)} holdings")
    
    def test_update_holding(self):
        """Test updating a holding"""
        # Create first
        portfolios = self.session.get(f"{BASE_URL}/api/portfolios").json()
        portfolio_id = portfolios[0]["id"]
        
        create_resp = self.session.post(f"{BASE_URL}/api/holdings", json={
            "symbol": "AMD",
            "shares": 10,
            "buy_price": 150.00,
            "portfolio_id": portfolio_id
        })
        holding_id = create_resp.json()["id"]
        
        # Update
        update_resp = self.session.put(f"{BASE_URL}/api/holdings/{holding_id}", json={
            "shares": 20,
            "buy_price": 160.00
        })
        
        assert update_resp.status_code == 200, f"Update failed: {update_resp.text}"
        updated = update_resp.json()
        assert updated["shares"] == 20
        assert updated["buy_price"] == 160.00
        
        print(f"✓ Updated holding: shares={updated['shares']}, price={updated['buy_price']}")
    
    def test_delete_holding(self):
        """Test deleting a holding"""
        # Create first
        portfolios = self.session.get(f"{BASE_URL}/api/portfolios").json()
        portfolio_id = portfolios[0]["id"]
        
        create_resp = self.session.post(f"{BASE_URL}/api/holdings", json={
            "symbol": "INTC",
            "shares": 15,
            "buy_price": 45.00,
            "portfolio_id": portfolio_id
        })
        holding_id = create_resp.json()["id"]
        
        # Delete
        delete_resp = self.session.delete(f"{BASE_URL}/api/holdings/{holding_id}")
        assert delete_resp.status_code == 200, f"Delete failed: {delete_resp.text}"
        
        # Verify deleted
        get_resp = self.session.get(f"{BASE_URL}/api/holdings")
        holdings = get_resp.json()
        assert not any(h["id"] == holding_id for h in holdings), "Holding not deleted"
        
        print(f"✓ Deleted holding: {holding_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
