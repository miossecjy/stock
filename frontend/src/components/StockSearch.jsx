import { useState, useEffect, useRef } from "react";
import { searchStocks } from "../lib/api";
import { Input } from "./ui/input";
import { Search, Loader2, Check } from "lucide-react";

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

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search stocks (e.g., AAPL, MSFT)"
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
          className="absolute z-50 w-full mt-2 bg-card border border-border rounded-md shadow-lg max-h-64 overflow-y-auto animate-fade-in"
          data-testid="stock-search-results"
        >
          {results.map((stock, index) => (
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
                <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                  <span className="text-xs font-mono font-bold text-primary">
                    {stock.symbol.slice(0, 2)}
                  </span>
                </div>
                <div>
                  <p className="font-mono font-medium">{stock.symbol}</p>
                  <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {stock.name}
                  </p>
                </div>
              </div>
              {selectedSymbol === stock.symbol && (
                <Check className="w-4 h-4 text-primary" />
              )}
            </button>
          ))}
        </div>
      )}

      {showResults && query.length >= 1 && results.length === 0 && !loading && (
        <div
          className="absolute z-50 w-full mt-2 bg-card border border-border rounded-md shadow-lg p-4 text-center text-muted-foreground text-sm"
          data-testid="stock-search-empty"
        >
          No stocks found for "{query}"
        </div>
      )}
    </div>
  );
}
