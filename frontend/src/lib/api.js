import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Holdings API
export const getHoldings = () => axios.get(`${API}/holdings`);
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

// Portfolio API
export const getPortfolioSummary = () => axios.get(`${API}/portfolio/summary`);
