import { useState, useEffect, useRef } from "react";
import { searchStocks } from "../lib/api";
import { Input } from "./ui/input";
import { Search, Loader2, Check, Globe } from "lucide-react";

// Exchange color mapping
const exchangeColors = {
  "US": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "London": "bg-red-500/10 text-red-400 border-red-500/20",
  "Frankfurt": "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  "Paris": "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  "Amsterdam": "bg-orange-500/10 text-orange-400 border-orange-500/20",
  "Zurich": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "Milan": "bg-green-500/10 text-green-400 border-green-500/20",
  "Madrid": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  "Copenhagen": "bg-rose-500/10 text-rose-400 border-rose-500/20",
  "Stockholm": "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  "Oslo": "bg-sky-500/10 text-sky-400 border-sky-500/20",
};

// Currency symbols
const currencySymbols = {
  "USD": "$",
  "GBP": "£",
  "EUR": "€",
  "CHF": "CHF ",
  "DKK": "kr ",
  "SEK": "kr ",
  "NOK": "kr ",
};

export default function StockSearch({ onSelect, selectedSymbol }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.length < 1) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const response = await searchStocks(query);
        setResults(response.data);
        setShowResults(true);
      } catch (error) {
        console.error("Search failed:", error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  const handleSelect = (stock) => {
    onSelect(stock);
    setQuery(stock.symbol);
    setShowResults(false);
  };

  const getExchangeColor = (exchange) => {
    return exchangeColors[exchange] || "bg-primary/10 text-primary border-primary/20";
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search US & European stocks (e.g., AAPL, BMW, Shell)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          className="pl-10 pr-10 bg-secondary/50 border-transparent focus:border-primary"
          data-testid="stock-search-input"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {showResults && results.length > 0 && (
        <div
          className="absolute z-50 w-full mt-2 bg-card border border-border rounded-md shadow-lg max-h-72 overflow-y-auto animate-fade-in"
          data-testid="stock-search-results"
        >
          {results.map((stock, index) => {
            const exchange = stock.exchange || "US";
            const currency = stock.currency || "USD";
            
            return (
              <button
                key={`${stock.symbol}-${index}`}
                type="button"
                onClick={() => handleSelect(stock)}
                className={`w-full px-4 py-3 text-left hover:bg-accent transition-colors flex items-center justify-between ${
                  selectedSymbol === stock.symbol ? "bg-primary/10" : ""
                }`}
                data-testid={`stock-result-${stock.symbol}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-md flex items-center justify-center border ${getExchangeColor(exchange)}`}>
                    <span className="text-xs font-mono font-bold">
                      {stock.symbol.split(".")[0].slice(0, 3)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-mono font-medium">{stock.symbol}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getExchangeColor(exchange)}`}>
                        {exchange}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate max-w-[250px]">
                      {stock.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {stock.region} • {currencySymbols[currency] || currency}
                    </p>
                  </div>
                </div>
                {selectedSymbol === stock.symbol ? (
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                ) : (
                  <Globe className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {showResults && query.length >= 1 && results.length === 0 && !loading && (
        <div
          className="absolute z-50 w-full mt-2 bg-card border border-border rounded-md shadow-lg p-4 text-center text-muted-foreground text-sm"
          data-testid="stock-search-empty"
        >
          No stocks found for &quot;{query}&quot;
        </div>
      )}
    </div>
  );
}
