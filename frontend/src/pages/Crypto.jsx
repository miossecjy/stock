import { useState, useEffect, useCallback } from "react";
import {
  getCryptoHoldings,
  createCryptoHolding,
  updateCryptoHolding,
  deleteCryptoHolding,
  getCryptoWatchlist,
  addToCryptoWatchlist,
  removeFromCryptoWatchlist,
  getCryptoPortfolioSummary,
  getTopCryptos,
  searchCryptos,
} from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Skeleton } from "../components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
  Bitcoin,
  TrendingUp,
  TrendingDown,
  Eye,
  Briefcase,
  RefreshCw,
} from "lucide-react";

export default function Crypto() {
  const [holdings, setHoldings] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [summary, setSummary] = useState(null);
  const [topCryptos, setTopCryptos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Dialog states
  const [holdingDialogOpen, setHoldingDialogOpen] = useState(false);
  const [watchlistDialogOpen, setWatchlistDialogOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedCrypto, setSelectedCrypto] = useState(null);
  
  // Form data
  const [formData, setFormData] = useState({
    amount: "",
    buy_price: "",
    buy_date: "",
  });

  const fetchAllData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const [holdingsRes, watchlistRes, summaryRes, topRes] = await Promise.all([
        getCryptoHoldings(),
        getCryptoWatchlist(),
        getCryptoPortfolioSummary(),
        getTopCryptos(),
      ]);
      setHoldings(holdingsRes.data);
      setWatchlist(watchlistRes.data);
      setSummary(summaryRes.data);
      setTopCryptos(topRes.data);
    } catch (error) {
      console.error("Failed to fetch crypto data:", error);
      toast.error("Failed to load crypto data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(() => fetchAllData(), 60000);
    return () => clearInterval(interval);
  }, [fetchAllData]);

  // Search handler
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 1) {
      setSearchResults([]);
      return;
    }
    
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await searchCryptos(searchQuery);
        setSearchResults(response.data);
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleAddHolding = async () => {
    if (!selectedCrypto || !formData.amount || !formData.buy_price) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      const data = {
        coin_id: selectedCrypto.id,
        symbol: selectedCrypto.symbol,
        name: selectedCrypto.name,
        amount: parseFloat(formData.amount),
        buy_price: parseFloat(formData.buy_price),
        buy_date: formData.buy_date || undefined,
      };

      if (editingHolding) {
        await updateCryptoHolding(editingHolding.id, {
          amount: data.amount,
          buy_price: data.buy_price,
          buy_date: data.buy_date,
        });
        toast.success("Holding updated successfully");
      } else {
        await createCryptoHolding(data);
        toast.success("Holding added successfully");
      }

      setHoldingDialogOpen(false);
      resetForm();
      fetchAllData();
    } catch (error) {
      const message = error.response?.data?.detail || "Failed to save holding";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteHolding = async (holding) => {
    if (!window.confirm(`Delete ${holding.symbol} from your holdings?`)) return;

    try {
      await deleteCryptoHolding(holding.id);
      toast.success("Holding deleted");
      fetchAllData();
    } catch (error) {
      toast.error("Failed to delete holding");
    }
  };

  const handleEditHolding = (holding) => {
    setEditingHolding(holding);
    setSelectedCrypto({ id: holding.coin_id, symbol: holding.symbol, name: holding.name });
    setFormData({
      amount: holding.amount.toString(),
      buy_price: holding.buy_price.toString(),
      buy_date: holding.buy_date,
    });
    setHoldingDialogOpen(true);
  };

  const handleAddToWatchlist = async (crypto) => {
    try {
      await addToCryptoWatchlist({
        coin_id: crypto.id,
        symbol: crypto.symbol,
        name: crypto.name,
      });
      toast.success(`${crypto.symbol} added to watchlist`);
      setWatchlistDialogOpen(false);
      setSearchQuery("");
      setSearchResults([]);
      fetchAllData();
    } catch (error) {
      const message = error.response?.data?.detail || "Failed to add to watchlist";
      toast.error(message);
    }
  };

  const handleRemoveFromWatchlist = async (coinId, symbol) => {
    if (!window.confirm(`Remove ${symbol} from your watchlist?`)) return;

    try {
      await removeFromCryptoWatchlist(coinId);
      toast.success("Removed from watchlist");
      fetchAllData();
    } catch (error) {
      toast.error("Failed to remove from watchlist");
    }
  };

  const resetForm = () => {
    setEditingHolding(null);
    setSelectedCrypto(null);
    setSearchQuery("");
    setSearchResults([]);
    setFormData({ amount: "", buy_price: "", buy_date: "" });
  };

  const formatCurrency = (value) => {
    if (value >= 1) {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    }
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(value);
  };

  const formatPercent = (value) => {
    if (value === null || value === undefined) return "0.00%";
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  };

  const formatLargeNumber = (value) => {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return formatCurrency(value);
  };

  if (loading) {
    return (
      <div className="space-y-8" data-testid="crypto-loading">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const isPositive = summary?.total_gain_loss >= 0;

  return (
    <div className="space-y-8" data-testid="crypto-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-warning/10 border border-warning/20 flex items-center justify-center">
            <Bitcoin className="w-5 h-5 text-warning" />
          </div>
          <div>
            <h1 className="font-chivo text-3xl font-bold tracking-tight">Crypto</h1>
            <p className="text-muted-foreground">Track your cryptocurrency portfolio</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchAllData(true)}
          disabled={refreshing}
          data-testid="refresh-crypto-btn"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-card border-border card-hover" data-testid="crypto-total-value">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Crypto Value
            </CardTitle>
            <Bitcoin className="w-4 h-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-manrope tabular-nums">
              {formatCurrency(summary?.total_value || 0)}
            </div>
            <div
              className={`flex items-center gap-1 text-sm mt-1 ${
                isPositive ? "text-gain" : "text-loss"
              }`}
            >
              {isPositive ? (
                <ArrowUpRight className="w-4 h-4" />
              ) : (
                <ArrowDownRight className="w-4 h-4" />
              )}
              <span className="tabular-nums">
                {formatPercent(summary?.total_gain_loss_percent || 0)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border card-hover" data-testid="crypto-gain-loss">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Gain/Loss
            </CardTitle>
            {isPositive ? (
              <TrendingUp className="w-4 h-4 text-success" />
            ) : (
              <TrendingDown className="w-4 h-4 text-error" />
            )}
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold font-manrope tabular-nums ${
                isPositive ? "text-gain" : "text-loss"
              }`}
            >
              {isPositive ? "+" : ""}
              {formatCurrency(summary?.total_gain_loss || 0)}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              Cost: {formatCurrency(summary?.total_cost || 0)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border card-hover" data-testid="crypto-holdings-count">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Holdings
            </CardTitle>
            <Briefcase className="w-4 h-4 text-chart-3" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-manrope tabular-nums">
              {summary?.holdings_count || 0}
            </div>
            <div className="text-sm text-muted-foreground mt-1">cryptocurrencies</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border card-hover" data-testid="crypto-watchlist-count">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Watching
            </CardTitle>
            <Eye className="w-4 h-4 text-chart-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-manrope tabular-nums">
              {watchlist.length}
            </div>
            <div className="text-sm text-muted-foreground mt-1">in watchlist</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Holdings, Watchlist, Market */}
      <Tabs defaultValue="holdings" className="space-y-6">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="holdings" data-testid="crypto-tab-holdings">
            <Briefcase className="w-4 h-4 mr-2" />
            Holdings
          </TabsTrigger>
          <TabsTrigger value="watchlist" data-testid="crypto-tab-watchlist">
            <Eye className="w-4 h-4 mr-2" />
            Watchlist
          </TabsTrigger>
          <TabsTrigger value="market" data-testid="crypto-tab-market">
            <TrendingUp className="w-4 h-4 mr-2" />
            Market
          </TabsTrigger>
        </TabsList>

        {/* Holdings Tab */}
        <TabsContent value="holdings" className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => {
                resetForm();
                setHoldingDialogOpen(true);
              }}
              data-testid="add-crypto-holding-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Holding
            </Button>
          </div>

          {holdings.length === 0 ? (
            <Card className="bg-card border-border" data-testid="empty-crypto-holdings">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mb-4">
                  <Bitcoin className="w-8 h-8 text-warning opacity-50" />
                </div>
                <h3 className="font-chivo text-lg font-semibold mb-2">No crypto holdings yet</h3>
                <p className="text-muted-foreground text-center max-w-sm mb-4">
                  Start tracking your crypto portfolio by adding your first holding.
                </p>
                <Button onClick={() => setHoldingDialogOpen(true)} data-testid="empty-add-crypto-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Crypto
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {(summary?.holdings || []).map((holding) => {
                const isHoldingPositive = holding.gain_loss >= 0;
                return (
                  <Card
                    key={holding.id}
                    className="bg-card border-border card-hover"
                    data-testid={`crypto-holding-${holding.symbol}`}
                  >
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-md bg-warning/10 border border-warning/20 flex items-center justify-center">
                            <span className="text-sm font-mono font-bold text-warning">
                              {holding.symbol.slice(0, 3)}
                            </span>
                          </div>
                          <div>
                            <h3 className="font-mono font-bold text-lg">{holding.symbol}</h3>
                            <p className="text-sm text-muted-foreground">
                              {holding.amount} @ {formatCurrency(holding.buy_price)}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-6 md:gap-8">
                          <div className="text-left md:text-right">
                            <p className="text-xs text-muted-foreground uppercase tracking-wide">
                              Current Price
                            </p>
                            <p className="font-manrope font-semibold tabular-nums">
                              {formatCurrency(holding.current_price)}
                            </p>
                            <p
                              className={`text-xs tabular-nums ${
                                holding.day_change_percent >= 0 ? "text-gain" : "text-loss"
                              }`}
                            >
                              {formatPercent(holding.day_change_percent)} 24h
                            </p>
                          </div>

                          <div className="text-left md:text-right">
                            <p className="text-xs text-muted-foreground uppercase tracking-wide">
                              Market Value
                            </p>
                            <p className="font-manrope font-semibold tabular-nums">
                              {formatCurrency(holding.market_value)}
                            </p>
                          </div>

                          <div className="text-left md:text-right">
                            <p className="text-xs text-muted-foreground uppercase tracking-wide">
                              Gain/Loss
                            </p>
                            <div
                              className={`flex items-center gap-1 ${
                                isHoldingPositive ? "text-gain" : "text-loss"
                              }`}
                            >
                              {isHoldingPositive ? (
                                <ArrowUpRight className="w-4 h-4" />
                              ) : (
                                <ArrowDownRight className="w-4 h-4" />
                              )}
                              <span className="font-manrope font-semibold tabular-nums">
                                {formatPercent(holding.gain_loss_percent)}
                              </span>
                            </div>
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" data-testid={`crypto-menu-${holding.symbol}`}>
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditHolding(holding)}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteHolding(holding)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
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
        </TabsContent>

        {/* Watchlist Tab */}
        <TabsContent value="watchlist" className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setSearchQuery("");
                setSearchResults([]);
                setWatchlistDialogOpen(true);
              }}
              data-testid="add-crypto-watchlist-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add to Watchlist
            </Button>
          </div>

          {watchlist.length === 0 ? (
            <Card className="bg-card border-border" data-testid="empty-crypto-watchlist">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mb-4">
                  <Eye className="w-8 h-8 text-warning opacity-50" />
                </div>
                <h3 className="font-chivo text-lg font-semibold mb-2">Watchlist is empty</h3>
                <p className="text-muted-foreground text-center max-w-sm mb-4">
                  Add cryptocurrencies to your watchlist to track their prices.
                </p>
                <Button onClick={() => setWatchlistDialogOpen(true)} data-testid="empty-add-watchlist-crypto-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Crypto
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {watchlist.map((item) => {
                const cryptoData = topCryptos.find((c) => c.id === item.coin_id) || {};
                const isWatchlistPositive = (cryptoData.price_change_percentage_24h || 0) >= 0;
                return (
                  <Card
                    key={item.id}
                    className="bg-card border-border card-hover group"
                    data-testid={`crypto-watchlist-${item.symbol}`}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-md flex items-center justify-center ${
                              isWatchlistPositive
                                ? "bg-success/10 border border-success/20"
                                : "bg-error/10 border border-error/20"
                            }`}
                          >
                            {isWatchlistPositive ? (
                              <TrendingUp className="w-5 h-5 text-success" />
                            ) : (
                              <TrendingDown className="w-5 h-5 text-error" />
                            )}
                          </div>
                          <div>
                            <h3 className="font-mono font-bold">{item.symbol}</h3>
                            <p className="text-xs text-muted-foreground">{item.name}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleRemoveFromWatchlist(item.coin_id, item.symbol)}
                          data-testid={`remove-crypto-watchlist-${item.symbol}`}
                        >
                          <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <div className="text-2xl font-bold font-manrope tabular-nums">
                          {formatCurrency(cryptoData.current_price || 0)}
                        </div>
                        <div
                          className={`flex items-center gap-2 ${
                            isWatchlistPositive ? "text-gain" : "text-loss"
                          }`}
                        >
                          {isWatchlistPositive ? (
                            <ArrowUpRight className="w-4 h-4" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4" />
                          )}
                          <span className="font-medium tabular-nums">
                            {formatPercent(cryptoData.price_change_percentage_24h)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          MCap: {formatLargeNumber(cryptoData.market_cap || 0)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Market Tab */}
        <TabsContent value="market" className="space-y-4">
          <Card className="bg-card border-border" data-testid="crypto-market-table">
            <CardHeader>
              <CardTitle className="font-chivo">Top Cryptocurrencies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-3 text-sm font-medium text-muted-foreground">#</th>
                      <th className="pb-3 text-sm font-medium text-muted-foreground">Name</th>
                      <th className="pb-3 text-sm font-medium text-muted-foreground text-right">Price</th>
                      <th className="pb-3 text-sm font-medium text-muted-foreground text-right">24h</th>
                      <th className="pb-3 text-sm font-medium text-muted-foreground text-right">Market Cap</th>
                      <th className="pb-3 text-sm font-medium text-muted-foreground text-right">Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topCryptos.slice(0, 20).map((crypto) => {
                      const isMarketPositive = (crypto.price_change_percentage_24h || 0) >= 0;
                      return (
                        <tr
                          key={crypto.id}
                          className="border-b border-border/50 hover:bg-accent/50 transition-colors"
                          data-testid={`market-row-${crypto.symbol}`}
                        >
                          <td className="py-4 text-muted-foreground">{crypto.market_cap_rank}</td>
                          <td className="py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-md bg-warning/10 flex items-center justify-center">
                                <span className="text-xs font-mono font-bold text-warning">
                                  {crypto.symbol.slice(0, 2)}
                                </span>
                              </div>
                              <div>
                                <span className="font-medium">{crypto.name}</span>
                                <span className="text-muted-foreground ml-2 text-sm">{crypto.symbol}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 text-right font-mono tabular-nums">
                            {formatCurrency(crypto.current_price)}
                          </td>
                          <td className="py-4 text-right">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-sm text-sm tabular-nums ${
                                isMarketPositive ? "bg-gain text-gain" : "bg-loss text-loss"
                              }`}
                            >
                              {isMarketPositive ? (
                                <ArrowUpRight className="w-3 h-3" />
                              ) : (
                                <ArrowDownRight className="w-3 h-3" />
                              )}
                              {formatPercent(crypto.price_change_percentage_24h)}
                            </span>
                          </td>
                          <td className="py-4 text-right tabular-nums">
                            {formatLargeNumber(crypto.market_cap)}
                          </td>
                          <td className="py-4 text-right tabular-nums text-muted-foreground">
                            {formatLargeNumber(crypto.total_volume)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Holding Dialog */}
      <Dialog
        open={holdingDialogOpen}
        onOpenChange={(open) => {
          setHoldingDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-chivo">
              {editingHolding ? "Edit Crypto Holding" : "Add Crypto Holding"}
            </DialogTitle>
            <DialogDescription>
              {editingHolding ? "Update your holding details" : "Search and add a cryptocurrency"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Crypto Search */}
            {!editingHolding && (
              <div className="space-y-2">
                <Label>Cryptocurrency</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search cryptocurrencies..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-secondary/50 border-transparent focus:border-primary"
                    data-testid="crypto-search-input"
                  />
                  {searching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin" />
                  )}
                </div>
                {searchResults.length > 0 && (
                  <div className="max-h-48 overflow-y-auto border border-border rounded-md bg-card">
                    {searchResults.map((crypto) => (
                      <button
                        key={crypto.id}
                        type="button"
                        onClick={() => {
                          setSelectedCrypto(crypto);
                          setSearchQuery(crypto.name);
                          setSearchResults([]);
                        }}
                        className={`w-full px-4 py-3 text-left hover:bg-accent transition-colors flex items-center justify-between ${
                          selectedCrypto?.id === crypto.id ? "bg-primary/10" : ""
                        }`}
                        data-testid={`crypto-result-${crypto.symbol}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-md bg-warning/10 flex items-center justify-center">
                            <span className="text-xs font-mono font-bold text-warning">
                              {crypto.symbol.slice(0, 2)}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{crypto.name}</p>
                            <p className="text-xs text-muted-foreground">{crypto.symbol}</p>
                          </div>
                        </div>
                        {crypto.market_cap_rank && (
                          <span className="text-xs text-muted-foreground">#{crypto.market_cap_rank}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {selectedCrypto && (
                  <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-md">
                    <span className="font-mono font-bold">{selectedCrypto.symbol}</span>
                    <span className="text-muted-foreground">{selectedCrypto.name}</span>
                  </div>
                )}
              </div>
            )}

            {editingHolding && (
              <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-md">
                <span className="font-mono font-bold">{selectedCrypto?.symbol}</span>
                <span className="text-muted-foreground">{selectedCrypto?.name}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="any"
                  placeholder="0.5"
                  value={formData.amount}
                  onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                  className="bg-secondary/50 border-transparent focus:border-primary"
                  data-testid="crypto-amount-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buy_price">Buy Price (USD)</Label>
                <Input
                  id="buy_price"
                  type="number"
                  step="any"
                  placeholder="45000"
                  value={formData.buy_price}
                  onChange={(e) => setFormData((prev) => ({ ...prev, buy_price: e.target.value }))}
                  className="bg-secondary/50 border-transparent focus:border-primary"
                  data-testid="crypto-price-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="buy_date">Buy Date (optional)</Label>
              <Input
                id="buy_date"
                type="date"
                value={formData.buy_date}
                onChange={(e) => setFormData((prev) => ({ ...prev, buy_date: e.target.value }))}
                className="bg-secondary/50 border-transparent focus:border-primary"
                data-testid="crypto-date-input"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setHoldingDialogOpen(false)} data-testid="cancel-crypto-btn">
              Cancel
            </Button>
            <Button onClick={handleAddHolding} disabled={submitting || (!editingHolding && !selectedCrypto)} data-testid="save-crypto-btn">
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : editingHolding ? (
                "Update"
              ) : (
                "Add"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add to Watchlist Dialog */}
      <Dialog
        open={watchlistDialogOpen}
        onOpenChange={(open) => {
          setWatchlistDialogOpen(open);
          if (!open) {
            setSearchQuery("");
            setSearchResults([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-chivo">Add to Watchlist</DialogTitle>
            <DialogDescription>Search and add a cryptocurrency to track</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search cryptocurrencies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-secondary/50 border-transparent focus:border-primary"
                data-testid="watchlist-crypto-search-input"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin" />
              )}
            </div>

            <div className="max-h-64 overflow-y-auto">
              {searchResults.length > 0 ? (
                searchResults.map((crypto) => (
                  <button
                    key={crypto.id}
                    type="button"
                    onClick={() => handleAddToWatchlist(crypto)}
                    className="w-full px-4 py-3 text-left hover:bg-accent transition-colors flex items-center justify-between border-b border-border/50"
                    data-testid={`watchlist-result-${crypto.symbol}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md bg-warning/10 flex items-center justify-center">
                        <span className="text-xs font-mono font-bold text-warning">
                          {crypto.symbol.slice(0, 2)}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{crypto.name}</p>
                        <p className="text-xs text-muted-foreground">{crypto.symbol}</p>
                      </div>
                    </div>
                    <Plus className="w-4 h-4 text-primary" />
                  </button>
                ))
              ) : searchQuery.length > 0 && !searching ? (
                <p className="text-center text-muted-foreground py-4">No results found</p>
              ) : (
                <p className="text-center text-muted-foreground py-4">Type to search cryptocurrencies</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
