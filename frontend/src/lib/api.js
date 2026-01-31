import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Portfolio Management API
export const getPortfolios = () => axios.get(`${API}/portfolios`);
export const createPortfolio = (data) => axios.post(`${API}/portfolios`, data);
export const updatePortfolio = (id, data) => axios.put(`${API}/portfolios/${id}`, data);
export const deletePortfolio = (id) => axios.delete(`${API}/portfolios/${id}`);
export const getPortfolioDetails = (id, displayCurrency = "USD") => 
  axios.get(`${API}/portfolios/${id}/summary?display_currency=${displayCurrency}`);

// Holdings API
export const getHoldings = (portfolioId = null) => {
  const params = portfolioId ? `?portfolio_id=${portfolioId}` : '';
  return axios.get(`${API}/holdings${params}`);
};
export const createHolding = (data) => axios.post(`${API}/holdings`, data);
export const updateHolding = (id, data) => axios.put(`${API}/holdings/${id}`, data);
export const deleteHolding = (id) => axios.delete(`${API}/holdings/${id}`);

// Watchlist API
export const getWatchlist = () => axios.get(`${API}/watchlist`);
export const addToWatchlist = (symbol) => axios.post(`${API}/watchlist`, { symbol });
export const removeFromWatchlist = (symbol) => axios.delete(`${API}/watchlist/${symbol}`);

// Stock Data API
export const getStockQuote = (symbol) => axios.get(`${API}/stocks/quote/${symbol}`);
export const getMultipleQuotes = (symbols) => axios.get(`${API}/stocks/quotes?symbols=${symbols.join(",")}`);
export const searchStocks = (query) => axios.get(`${API}/stocks/search?query=${query}`);

// Portfolio Summary API
export const getPortfolioSummary = (displayCurrency = "USD") => 
  axios.get(`${API}/portfolio/summary?display_currency=${displayCurrency}`);

// Currency API
export const getSupportedCurrencies = () => axios.get(`${API}/currencies`);
export const getExchangeRates = (base = "USD") => axios.get(`${API}/exchange-rates?base=${base}`);

// Crypto Data API
export const getTopCryptos = () => axios.get(`${API}/crypto/top`);
export const searchCryptos = (query) => axios.get(`${API}/crypto/search?query=${query}`);
export const getCryptoPrice = (coinId) => axios.get(`${API}/crypto/price/${coinId}`);

// Crypto Holdings API
export const getCryptoHoldings = (portfolioId = null) => {
  const params = portfolioId ? `?portfolio_id=${portfolioId}` : '';
  return axios.get(`${API}/crypto/holdings${params}`);
};
export const createCryptoHolding = (data) => axios.post(`${API}/crypto/holdings`, data);
export const updateCryptoHolding = (id, data) => axios.put(`${API}/crypto/holdings/${id}`, data);
export const deleteCryptoHolding = (id) => axios.delete(`${API}/crypto/holdings/${id}`);

// Crypto Watchlist API
export const getCryptoWatchlist = () => axios.get(`${API}/crypto/watchlist`);
export const addToCryptoWatchlist = (data) => axios.post(`${API}/crypto/watchlist`, data);
export const removeFromCryptoWatchlist = (coinId) => axios.delete(`${API}/crypto/watchlist/${coinId}`);

// Crypto Portfolio API
export const getCryptoPortfolioSummary = () => axios.get(`${API}/crypto/portfolio/summary`);

// Price Alerts API
export const getPriceAlerts = () => axios.get(`${API}/alerts`);
export const createPriceAlert = (data) => axios.post(`${API}/alerts`, data);
export const deletePriceAlert = (id) => axios.delete(`${API}/alerts/${id}`);
export const checkPriceAlerts = () => axios.get(`${API}/alerts/check`);
export const resetPriceAlert = (id) => axios.post(`${API}/alerts/${id}/reset`);

// API Settings
export const getAPISettings = () => axios.get(`${API}/settings/api`);
export const updateAPISettings = (data) => axios.put(`${API}/settings/api`, data);
export const testAPIProvider = (provider) => axios.post(`${API}/settings/api/test/${provider}`);
