import { useState, useEffect, useCallback } from "react";
import { getHoldings, createHolding, updateHolding, deleteHolding, getMultipleQuotes } from "../lib/api";
import { useLanguage } from "../context/LanguageContext";
import { usePortfolio } from "../context/PortfolioContext";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Search,
  Globe,
} from "lucide-react";
import StockSearch from "../components/StockSearch";

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

const getExchangeFromSymbol = (symbol) => {
  const suffixMap = {
    ".LON": "London", ".DEX": "Frankfurt", ".PAR": "Paris",
    ".AMS": "Amsterdam", ".SWX": "Zurich", ".MIL": "Milan",
    ".MAD": "Madrid", ".CPH": "Copenhagen", ".STO": "Stockholm",
    ".OSL": "Oslo", ".BRU": "Brussels", ".VIE": "Vienna",
  };
  for (const [suffix, exchange] of Object.entries(suffixMap)) {
    if (symbol.includes(suffix)) return exchange;
  }
  return "US";
};

const getCurrencySymbol = (symbol) => {
  if (symbol.includes(".LON")) return "£";
  if (symbol.includes(".SWX")) return "CHF ";
  if (symbol.includes(".CPH")) return "kr ";
  if (symbol.includes(".STO")) return "kr ";
  if (symbol.includes(".OSL")) return "kr ";
  if (symbol.includes(".DEX") || symbol.includes(".PAR") || symbol.includes(".AMS") || 
      symbol.includes(".MIL") || symbol.includes(".MAD") || symbol.includes(".BRU")) return "€";
  return "$";
};

export default function Holdings() {
  const { t } = useLanguage();
  const { activePortfolio } = usePortfolio();
  const [holdings, setHoldings] = useState([]);
  const [quotes, setQuotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    symbol: "",
    shares: "",
    buy_price: "",
    buy_date: "",
  });

  const fetchHoldings = useCallback(async () => {
    try {
      const portfolioId = activePortfolio?.id || null;
      const response = await getHoldings(portfolioId);
      setHoldings(response.data);

      // Fetch quotes for all holdings
      if (response.data.length > 0) {
        const symbols = [...new Set(response.data.map((h) => h.symbol))];
        const quotesResponse = await getMultipleQuotes(symbols);
        setQuotes(quotesResponse.data);
      }
    } catch (error) {
      console.error("Failed to fetch holdings:", error);
      toast.error("Failed to load holdings");
    } finally {
      setLoading(false);
    }
  }, [activePortfolio]);

  useEffect(() => {
    fetchHoldings();
  }, [fetchHoldings]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.symbol || !formData.shares || !formData.buy_price) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      const data = {
        symbol: formData.symbol.toUpperCase(),
        shares: parseFloat(formData.shares),
        buy_price: parseFloat(formData.buy_price),
        buy_date: formData.buy_date || undefined,
      };

      if (editingHolding) {
        await updateHolding(editingHolding.id, data);
        toast.success("Holding updated successfully");
      } else {
        await createHolding(data);
        toast.success("Holding added successfully");
      }

      setDialogOpen(false);
      resetForm();
      fetchHoldings();
    } catch (error) {
      const message = error.response?.data?.detail || "Failed to save holding";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (holding) => {
    if (!window.confirm(`Delete ${holding.symbol} from your holdings?`)) return;

    try {
      await deleteHolding(holding.id);
      toast.success("Holding deleted");
      fetchHoldings();
    } catch (error) {
      toast.error("Failed to delete holding");
    }
  };

  const handleEdit = (holding) => {
    setEditingHolding(holding);
    setFormData({
      symbol: holding.symbol,
      shares: holding.shares.toString(),
      buy_price: holding.buy_price.toString(),
      buy_date: holding.buy_date,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingHolding(null);
    setFormData({ symbol: "", shares: "", buy_price: "", buy_date: "" });
  };

  const handleSelectStock = (stock) => {
    setFormData((prev) => ({ ...prev, symbol: stock.symbol }));
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

  const calculateHoldingValues = (holding) => {
    const quote = quotes[holding.symbol] || {};
    const currentPrice = quote.price || holding.buy_price;
    const marketValue = currentPrice * holding.shares;
    const costBasis = holding.buy_price * holding.shares;
    const gainLoss = marketValue - costBasis;
    const gainLossPercent =
      holding.buy_price > 0
        ? ((currentPrice - holding.buy_price) / holding.buy_price) * 100
        : 0;

    return {
      currentPrice,
      marketValue,
      costBasis,
      gainLoss,
      gainLossPercent,
      dayChange: quote.change || 0,
      dayChangePercent: parseFloat(quote.change_percent) || 0,
    };
  };

  if (loading) {
    return (
      <div className="space-y-8" data-testid="holdings-loading">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="holdings-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-chivo text-3xl font-bold tracking-tight">{t("holdings.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("holdings.subtitle")}</p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button data-testid="add-holding-btn">
              <Plus className="w-4 h-4 mr-2" />
              {t("holdings.addHolding")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-chivo">
                {editingHolding ? t("holdings.editHolding") : t("holdings.addHolding")}
              </DialogTitle>
              <DialogDescription>
                {editingHolding
                  ? t("holdings.updateDetails")
                  : t("holdings.addNewStock")}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="symbol">{t("holdings.stockSymbol")}</Label>
                {editingHolding ? (
                  <Input
                    id="symbol"
                    value={formData.symbol}
                    disabled
                    className="bg-secondary/50 font-mono"
                    data-testid="holding-symbol-input"
                  />
                ) : (
                  <StockSearch
                    onSelect={handleSelectStock}
                    selectedSymbol={formData.symbol}
                  />
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="shares">{t("holdings.shares")}</Label>
                  <Input
                    id="shares"
                    type="number"
                    step="0.0001"
                    placeholder="100"
                    value={formData.shares}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, shares: e.target.value }))
                    }
                    className="bg-secondary/50 border-transparent focus:border-primary"
                    data-testid="holding-shares-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="buy_price">{t("holdings.buyPrice")}</Label>
                  <Input
                    id="buy_price"
                    type="number"
                    step="0.01"
                    placeholder="150.00"
                    value={formData.buy_price}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, buy_price: e.target.value }))
                    }
                    className="bg-secondary/50 border-transparent focus:border-primary"
                    data-testid="holding-price-input"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="buy_date">{t("holdings.buyDate")}</Label>
                <Input
                  id="buy_date"
                  type="date"
                  value={formData.buy_date}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, buy_date: e.target.value }))
                  }
                  className="bg-secondary/50 border-transparent focus:border-primary"
                  data-testid="holding-date-input"
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  data-testid="cancel-holding-btn"
                >
                  {t("holdings.cancel")}
                </Button>
                <Button type="submit" disabled={submitting} data-testid="save-holding-btn">
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t("holdings.saving")}
                    </>
                  ) : editingHolding ? (
                    t("holdings.update")
                  ) : (
                    t("holdings.add")
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Holdings List */}
      {holdings.length === 0 ? (
        <Card className="bg-card border-border" data-testid="empty-holdings">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-primary opacity-50" />
            </div>
            <h3 className="font-chivo text-lg font-semibold mb-2">{t("holdings.noHoldingsYet")}</h3>
            <p className="text-muted-foreground text-center max-w-sm mb-4">
              {t("holdings.startBuilding")}
            </p>
            <Button onClick={() => setDialogOpen(true)} data-testid="empty-add-btn">
              <Plus className="w-4 h-4 mr-2" />
              {t("holdings.addFirstHolding")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {holdings.map((holding) => {
            const values = calculateHoldingValues(holding);
            const isPositive = values.gainLoss >= 0;
            const exchange = getExchangeFromSymbol(holding.symbol);
            const currencySymbol = getCurrencySymbol(holding.symbol);
            const exchangeColor = exchangeColors[exchange] || "bg-primary/10 text-primary border-primary/20";

            return (
              <Card
                key={holding.id}
                className="bg-card border-border card-hover"
                data-testid={`holding-card-${holding.symbol}`}
              >
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Symbol & Name */}
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-md flex items-center justify-center border ${exchangeColor}`}>
                        <span className="text-sm font-mono font-bold">
                          {holding.symbol.split(".")[0].slice(0, 3)}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-mono font-bold text-lg">{holding.symbol}</h3>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${exchangeColor}`}>
                            {exchange}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {holding.shares} {t("holdings.shares")} @ {currencySymbol}{holding.buy_price.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {/* Values */}
                    <div className="flex flex-wrap items-center gap-6 md:gap-8">
                      <div className="text-left md:text-right">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">
                          {t("holdings.currentPrice")}
                        </p>
                        <p className="font-manrope font-semibold tabular-nums">
                          {currencySymbol}{values.currentPrice.toFixed(2)}
                        </p>
                        <p
                          className={`text-xs tabular-nums ${
                            values.dayChange >= 0 ? "text-gain" : "text-loss"
                          }`}
                        >
                          {values.dayChange >= 0 ? "+" : ""}
                          {currencySymbol}{Math.abs(values.dayChange).toFixed(2)} ({formatPercent(values.dayChangePercent)})
                        </p>
                      </div>

                      <div className="text-left md:text-right">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">
                          {t("holdings.marketValue")}
                        </p>
                        <p className="font-manrope font-semibold tabular-nums">
                          {currencySymbol}{values.marketValue.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          Cost: {currencySymbol}{values.costBasis.toFixed(2)}
                        </p>
                      </div>

                      <div className="text-left md:text-right">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">
                          {t("holdings.gainLoss")}
                        </p>
                        <div
                          className={`flex items-center gap-1 ${
                            isPositive ? "text-gain" : "text-loss"
                          }`}
                        >
                          {isPositive ? (
                            <ArrowUpRight className="w-4 h-4" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4" />
                          )}
                          <span className="font-manrope font-semibold tabular-nums">
                            {formatCurrency(Math.abs(values.gainLoss))}
                          </span>
                        </div>
                        <p
                          className={`text-xs tabular-nums ${
                            isPositive ? "text-gain" : "text-loss"
                          }`}
                        >
                          {formatPercent(values.gainLossPercent)}
                        </p>
                      </div>

                      {/* Actions */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            data-testid={`holding-menu-${holding.symbol}`}
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleEdit(holding)}
                            data-testid={`edit-holding-${holding.symbol}`}
                          >
                            <Pencil className="w-4 h-4 mr-2" />
                            {t("holdings.edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(holding)}
                            className="text-destructive focus:text-destructive"
                            data-testid={`delete-holding-${holding.symbol}`}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {t("holdings.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
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
