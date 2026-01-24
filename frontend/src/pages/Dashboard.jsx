import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { getPortfolioSummary, getSupportedCurrencies, getCryptoPortfolioSummary } from "../lib/api";
import { useLanguage } from "../context/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Briefcase,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Plus,
  Globe,
  Bitcoin,
  PieChart,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
} from "recharts";

// Currency symbols mapping
const currencySymbols = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CHF: "CHF ",
  DKK: "kr ",
  SEK: "kr ",
  NOK: "kr ",
};

// Colors for pie chart
const COLORS = ["hsl(var(--primary))", "hsl(var(--warning))"];

export default function Dashboard() {
  const { t } = useLanguage();
  const [stockSummary, setStockSummary] = useState(null);
  const [cryptoSummary, setCryptoSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currencies, setCurrencies] = useState([]);
  const [displayCurrency, setDisplayCurrency] = useState(
    localStorage.getItem("displayCurrency") || "USD"
  );

  const fetchCurrencies = async () => {
    try {
      const response = await getSupportedCurrencies();
      setCurrencies(response.data);
    } catch (error) {
      console.error("Failed to fetch currencies:", error);
    }
  };

  const fetchSummary = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const [stockRes, cryptoRes] = await Promise.all([
        getPortfolioSummary(displayCurrency),
        getCryptoPortfolioSummary()
      ]);
      setStockSummary(stockRes.data);
      setCryptoSummary(cryptoRes.data);
    } catch (error) {
      console.error("Failed to fetch portfolio summary:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [displayCurrency]);

  useEffect(() => {
    fetchCurrencies();
  }, []);

  useEffect(() => {
    fetchSummary();
    const interval = setInterval(() => fetchSummary(), 60000);
    return () => clearInterval(interval);
  }, [fetchSummary]);

  const handleCurrencyChange = (currency) => {
    setDisplayCurrency(currency);
    localStorage.setItem("displayCurrency", currency);
  };

  const formatCurrency = (value, currency = displayCurrency) => {
    const symbol = currencySymbols[currency] || "$";
    return `${symbol}${new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)}`;
  };

  const formatPercent = (value) => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  };

  // Calculate combined totals
  const totalPortfolioValue = (stockSummary?.total_value || 0) + (cryptoSummary?.total_value || 0);
  const totalPortfolioCost = (stockSummary?.total_cost || 0) + (cryptoSummary?.total_cost || 0);
  const totalGainLoss = totalPortfolioValue - totalPortfolioCost;
  const totalGainLossPercent = totalPortfolioCost > 0 ? ((totalPortfolioValue - totalPortfolioCost) / totalPortfolioCost) * 100 : 0;

  // Pie chart data
  const pieData = [
    { name: "Stocks", value: stockSummary?.total_value || 0, color: "hsl(var(--primary))" },
    { name: "Crypto", value: cryptoSummary?.total_value || 0, color: "hsl(var(--warning))" },
  ].filter(d => d.value > 0);

  // Generate mock chart data based on combined holdings
  const generateChartData = () => {
    if (totalPortfolioCost === 0) return [];
    const days = 30;
    const data = [];
    let value = totalPortfolioCost;
    const dailyReturn = Math.pow(totalPortfolioValue / totalPortfolioCost, 1 / days);

    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const noise = 1 + (Math.random() - 0.5) * 0.02;
      value = value * dailyReturn * noise;
      data.push({
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        value: Math.round(value * 100) / 100,
      });
    }
    return data;
  };

  const chartData = generateChartData();

  if (loading) {
    return (
      <div className="space-y-8" data-testid="dashboard-loading">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="bg-card border-border">
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-4 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="bg-card border-border">
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPositive = totalGainLoss >= 0;
  const hasHoldings = (stockSummary?.holdings_count || 0) + (cryptoSummary?.holdings_count || 0) > 0;

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-chivo text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Your complete portfolio at a glance</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Currency Selector */}
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <Select value={displayCurrency} onValueChange={handleCurrencyChange}>
              <SelectTrigger className="w-[120px] bg-secondary/50 border-transparent" data-testid="currency-selector">
                <SelectValue placeholder="Currency" />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((currency) => (
                  <SelectItem key={currency.code} value={currency.code}>
                    <span className="flex items-center gap-2">
                      <span className="font-mono">{currency.symbol}</span>
                      <span>{currency.code}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchSummary(true)}
            disabled={refreshing}
            data-testid="refresh-btn"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Combined Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Portfolio Value */}
        <Card className="bg-card border-border card-hover" data-testid="total-value-card">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Portfolio
            </CardTitle>
            <DollarSign className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-manrope tabular-nums">
              {formatCurrency(totalPortfolioValue)}
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
                {formatPercent(totalGainLossPercent)}
              </span>
              <span className="text-muted-foreground">all time</span>
            </div>
          </CardContent>
        </Card>

        {/* Stocks Value */}
        <Card className="bg-card border-border card-hover" data-testid="stocks-value-card">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Stocks
            </CardTitle>
            <Briefcase className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-manrope tabular-nums">
              {formatCurrency(stockSummary?.total_value || 0)}
            </div>
            <div className="flex items-center gap-2 text-sm mt-1">
              <span className="text-muted-foreground">{stockSummary?.holdings_count || 0} holdings</span>
              {stockSummary?.total_gain_loss !== undefined && (
                <span className={stockSummary.total_gain_loss >= 0 ? "text-gain" : "text-loss"}>
                  {formatPercent(stockSummary.total_gain_loss_percent || 0)}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Crypto Value */}
        <Card className="bg-card border-border card-hover" data-testid="crypto-value-card">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Crypto
            </CardTitle>
            <Bitcoin className="w-4 h-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-manrope tabular-nums">
              {formatCurrency(cryptoSummary?.total_value || 0)}
            </div>
            <div className="flex items-center gap-2 text-sm mt-1">
              <span className="text-muted-foreground">{cryptoSummary?.holdings_count || 0} holdings</span>
              {cryptoSummary?.total_gain_loss !== undefined && (
                <span className={cryptoSummary.total_gain_loss >= 0 ? "text-gain" : "text-loss"}>
                  {formatPercent(cryptoSummary.total_gain_loss_percent || 0)}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Total Gain/Loss */}
        <Card className="bg-card border-border card-hover" data-testid="gain-loss-card">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Gain/Loss
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
              {formatCurrency(totalGainLoss)}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              Cost: {formatCurrency(totalPortfolioCost)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Portfolio Performance Chart */}
        <Card className="bg-card border-border lg:col-span-2" data-testid="portfolio-chart-card">
          <CardHeader>
            <CardTitle className="font-chivo">Portfolio Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {hasHoldings ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor="hsl(var(--primary))"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="hsl(var(--primary))"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${currencySymbols[displayCurrency] || "$"}${(value / 1000).toFixed(0)}k`}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                      }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                      formatter={(value) => [formatCurrency(value), "Value"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorValue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-72 flex flex-col items-center justify-center text-muted-foreground">
                <Briefcase className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">No holdings yet</p>
                <p className="text-sm">Add stocks or crypto to see your portfolio performance</p>
                <div className="flex gap-2 mt-4">
                  <Link to="/holdings">
                    <Button variant="outline" size="sm" data-testid="empty-add-stock-btn">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Stock
                    </Button>
                  </Link>
                  <Link to="/crypto">
                    <Button variant="outline" size="sm" data-testid="empty-add-crypto-btn">
                      <Bitcoin className="w-4 h-4 mr-2" />
                      Add Crypto
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Allocation Pie Chart */}
        <Card className="bg-card border-border" data-testid="allocation-chart-card">
          <CardHeader>
            <CardTitle className="font-chivo flex items-center gap-2">
              <PieChart className="w-5 h-5" />
              Allocation
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasHoldings && pieData.length > 0 ? (
              <div className="h-72 flex flex-col items-center justify-center">
                <ResponsiveContainer width="100%" height={200}>
                  <RechartsPieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                      }}
                      formatter={(value) => formatCurrency(value)}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
                <div className="flex gap-6 mt-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-primary" />
                    <span className="text-sm">Stocks ({((stockSummary?.total_value || 0) / totalPortfolioValue * 100).toFixed(1)}%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-warning" />
                    <span className="text-sm">Crypto ({((cryptoSummary?.total_value || 0) / totalPortfolioValue * 100).toFixed(1)}%)</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-72 flex flex-col items-center justify-center text-muted-foreground">
                <PieChart className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-sm">Add holdings to see allocation</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Holdings Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock Holdings */}
        <Card className="bg-card border-border" data-testid="stock-holdings-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-chivo flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" />
              Stock Holdings
            </CardTitle>
            <Link to="/holdings">
              <Button variant="ghost" size="sm" data-testid="view-all-stocks-btn">
                View All
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {stockSummary?.holdings?.length > 0 ? (
              <div className="space-y-3">
                {stockSummary.holdings.slice(0, 5).map((holding) => (
                  <div
                    key={holding.id}
                    className="flex items-center justify-between p-3 rounded-md bg-secondary/30 hover:bg-secondary/50 transition-colors"
                    data-testid={`stock-row-${holding.symbol}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-mono font-bold text-primary">
                          {holding.symbol.split(".")[0].slice(0, 2)}
                        </span>
                      </div>
                      <div>
                        <p className="font-mono font-medium text-sm">{holding.symbol}</p>
                        <p className="text-xs text-muted-foreground">{holding.shares} shares</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium tabular-nums text-sm">
                        {formatCurrency(holding.market_value_converted || holding.market_value)}
                      </p>
                      <p className={`text-xs tabular-nums ${holding.gain_loss_percent >= 0 ? "text-gain" : "text-loss"}`}>
                        {formatPercent(holding.gain_loss_percent)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No stock holdings</p>
                <Link to="/holdings">
                  <Button variant="link" size="sm" className="mt-2">Add stocks</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Crypto Holdings */}
        <Card className="bg-card border-border" data-testid="crypto-holdings-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-chivo flex items-center gap-2">
              <Bitcoin className="w-5 h-5 text-warning" />
              Crypto Holdings
            </CardTitle>
            <Link to="/crypto">
              <Button variant="ghost" size="sm" data-testid="view-all-crypto-btn">
                View All
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {cryptoSummary?.holdings?.length > 0 ? (
              <div className="space-y-3">
                {cryptoSummary.holdings.slice(0, 5).map((holding) => (
                  <div
                    key={holding.id}
                    className="flex items-center justify-between p-3 rounded-md bg-secondary/30 hover:bg-secondary/50 transition-colors"
                    data-testid={`crypto-row-${holding.symbol}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md bg-warning/10 flex items-center justify-center">
                        <span className="text-xs font-mono font-bold text-warning">
                          {holding.symbol.slice(0, 2)}
                        </span>
                      </div>
                      <div>
                        <p className="font-mono font-medium text-sm">{holding.symbol}</p>
                        <p className="text-xs text-muted-foreground">{holding.amount} units</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium tabular-nums text-sm">
                        {formatCurrency(holding.market_value)}
                      </p>
                      <p className={`text-xs tabular-nums ${holding.gain_loss_percent >= 0 ? "text-gain" : "text-loss"}`}>
                        {formatPercent(holding.gain_loss_percent)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Bitcoin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No crypto holdings</p>
                <Link to="/crypto">
                  <Button variant="link" size="sm" className="mt-2">Add crypto</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
