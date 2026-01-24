import { useState, useEffect, useCallback } from "react";
import { getWatchlist, addToWatchlist, removeFromWatchlist, getMultipleQuotes } from "../lib/api";
import { useLanguage } from "../context/LanguageContext";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "../components/ui/dialog";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Eye,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import StockSearch from "../components/StockSearch";

export default function Watchlist() {
  const { t } = useLanguage();
  const [watchlist, setWatchlist] = useState([]);
  const [quotes, setQuotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchWatchlist = useCallback(async () => {
    try {
      const response = await getWatchlist();
      setWatchlist(response.data);

      // Fetch quotes for all watchlist items
      if (response.data.length > 0) {
        const symbols = response.data.map((item) => item.symbol);
        const quotesResponse = await getMultipleQuotes(symbols);
        setQuotes(quotesResponse.data);
      }
    } catch (error) {
      console.error("Failed to fetch watchlist:", error);
      toast.error("Failed to load watchlist");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWatchlist();
    const interval = setInterval(() => fetchWatchlist(), 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [fetchWatchlist]);

  const handleAdd = async () => {
    if (!selectedStock) {
      toast.error("Please select a stock");
      return;
    }

    setSubmitting(true);
    try {
      await addToWatchlist(selectedStock.symbol);
      toast.success(`${selectedStock.symbol} added to watchlist`);
      setDialogOpen(false);
      setSelectedStock(null);
      fetchWatchlist();
    } catch (error) {
      const message = error.response?.data?.detail || "Failed to add to watchlist";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (symbol) => {
    if (!window.confirm(`Remove ${symbol} from your watchlist?`)) return;

    try {
      await removeFromWatchlist(symbol);
      toast.success(`${symbol} removed from watchlist`);
      fetchWatchlist();
    } catch (error) {
      toast.error("Failed to remove from watchlist");
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value) => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  };

  if (loading) {
    return (
      <div className="space-y-8" data-testid="watchlist-loading">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="watchlist-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-chivo text-3xl font-bold tracking-tight">{t("watchlist.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("watchlist.subtitle")}</p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setSelectedStock(null);
          }}
        >
          <DialogTrigger asChild>
            <Button data-testid="add-watchlist-btn">
              <Plus className="w-4 h-4 mr-2" />
              {t("watchlist.addStock")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-chivo">{t("watchlist.addToWatchlist")}</DialogTitle>
              <DialogDescription>
                {t("watchlist.searchAndAdd")}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <StockSearch
                onSelect={setSelectedStock}
                selectedSymbol={selectedStock?.symbol || ""}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                data-testid="cancel-watchlist-btn"
              >
                {t("watchlist.cancel")}
              </Button>
              <Button
                onClick={handleAdd}
                disabled={!selectedStock || submitting}
                data-testid="confirm-add-watchlist-btn"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t("watchlist.adding")}
                  </>
                ) : (
                  t("watchlist.add")
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Watchlist Grid */}
      {watchlist.length === 0 ? (
        <Card className="bg-card border-border" data-testid="empty-watchlist">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Eye className="w-8 h-8 text-primary opacity-50" />
            </div>
            <h3 className="font-chivo text-lg font-semibold mb-2">{t("watchlist.emptyTitle")}</h3>
            <p className="text-muted-foreground text-center max-w-sm mb-4">
              {t("watchlist.emptyDescription")}
            </p>
            <Button onClick={() => setDialogOpen(true)} data-testid="empty-add-watchlist-btn">
              <Plus className="w-4 h-4 mr-2" />
              {t("watchlist.addFirstStock")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {watchlist.map((item) => {
            const quote = quotes[item.symbol] || {};
            const price = quote.price || 0;
            const change = quote.change || 0;
            const changePercent = parseFloat(quote.change_percent) || 0;
            const isPositive = change >= 0;

            return (
              <Card
                key={item.id}
                className="bg-card border-border card-hover group"
                data-testid={`watchlist-card-${item.symbol}`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-md flex items-center justify-center ${
                          isPositive
                            ? "bg-success/10 border border-success/20"
                            : "bg-error/10 border border-error/20"
                        }`}
                      >
                        {isPositive ? (
                          <TrendingUp className="w-5 h-5 text-success" />
                        ) : (
                          <TrendingDown className="w-5 h-5 text-error" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-mono font-bold text-lg">{item.symbol}</h3>
                        <p className="text-xs text-muted-foreground">
                          {t("watchlist.addedOn")} {new Date(item.added_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleRemove(item.symbol)}
                      data-testid={`remove-watchlist-${item.symbol}`}
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-bold font-manrope tabular-nums">
                        {formatCurrency(price)}
                      </span>
                    </div>
                    <div
                      className={`flex items-center gap-2 ${
                        isPositive ? "text-gain" : "text-loss"
                      }`}
                    >
                      {isPositive ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4" />
                      )}
                      <span className="font-medium tabular-nums">
                        {isPositive ? "+" : ""}
                        {formatCurrency(change)}
                      </span>
                      <span
                        className={`text-sm px-2 py-0.5 rounded-sm ${
                          isPositive ? "bg-gain" : "bg-loss"
                        }`}
                      >
                        {formatPercent(changePercent)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("watchlist.volume")}: {quote.volume?.toLocaleString() || "—"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
