import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getPortfolioSummary } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Briefcase,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Plus,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSummary = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const response = await getPortfolioSummary();
      setSummary(response.data);
    } catch (error) {
      console.error("Failed to fetch portfolio summary:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    const interval = setInterval(() => fetchSummary(), 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

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

  // Generate mock chart data based on holdings
  const generateChartData = () => {
    if (!summary || summary.holdings_count === 0) return [];
    const days = 30;
    const data = [];
    let value = summary.total_cost;
    const dailyReturn = Math.pow(summary.total_value / summary.total_cost, 1 / days);

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

  const isPositive = summary?.total_gain_loss >= 0;

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-chivo text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Your portfolio at a glance</p>
        </div>
        <div className="flex items-center gap-2">
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
          <Link to="/holdings">
            <Button size="sm" data-testid="add-holding-btn">
              <Plus className="w-4 h-4 mr-2" />
              Add Holding
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Value */}
        <Card className="bg-card border-border card-hover" data-testid="total-value-card">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Portfolio Value
            </CardTitle>
            <DollarSign className="w-4 h-4 text-primary" />
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
              <span className="text-muted-foreground">all time</span>
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
              {formatCurrency(summary?.total_gain_loss || 0)}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              Cost basis: {formatCurrency(summary?.total_cost || 0)}
            </div>
          </CardContent>
        </Card>

        {/* Holdings Count */}
        <Card className="bg-card border-border card-hover" data-testid="holdings-count-card">
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
            <div className="text-sm text-muted-foreground mt-1">
              {summary?.holdings_count === 1 ? "stock" : "stocks"} in portfolio
            </div>
          </CardContent>
        </Card>

        {/* Top Performer */}
        <Card className="bg-card border-border card-hover" data-testid="top-performer-card">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Top Performer
            </CardTitle>
            <TrendingUp className="w-4 h-4 text-success" />
          </CardHeader>
          <CardContent>
            {summary?.holdings?.length > 0 ? (
              <>
                <div className="text-2xl font-bold font-mono">
                  {
                    [...(summary.holdings || [])].sort(
                      (a, b) => b.gain_loss_percent - a.gain_loss_percent
                    )[0]?.symbol
                  }
                </div>
                <div className="text-sm text-gain mt-1 tabular-nums">
                  {formatPercent(
                    [...(summary.holdings || [])].sort(
                      (a, b) => b.gain_loss_percent - a.gain_loss_percent
                    )[0]?.gain_loss_percent || 0
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-muted-foreground">—</div>
                <div className="text-sm text-muted-foreground mt-1">No holdings yet</div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Portfolio Chart */}
      <Card className="bg-card border-border" data-testid="portfolio-chart-card">
        <CardHeader>
          <CardTitle className="font-chivo">Portfolio Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {summary?.holdings_count > 0 ? (
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
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
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
              <p className="text-sm">Add stocks to see your portfolio performance</p>
              <Link to="/holdings" className="mt-4">
                <Button data-testid="empty-add-holding-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Holding
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Holdings Table */}
      {summary?.holdings?.length > 0 && (
        <Card className="bg-card border-border" data-testid="holdings-table-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-chivo">Holdings</CardTitle>
            <Link to="/holdings">
              <Button variant="ghost" size="sm" data-testid="view-all-holdings-btn">
                View All
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-3 text-sm font-medium text-muted-foreground">Symbol</th>
                    <th className="pb-3 text-sm font-medium text-muted-foreground text-right">
                      Shares
                    </th>
                    <th className="pb-3 text-sm font-medium text-muted-foreground text-right">
                      Price
                    </th>
                    <th className="pb-3 text-sm font-medium text-muted-foreground text-right">
                      Value
                    </th>
                    <th className="pb-3 text-sm font-medium text-muted-foreground text-right">
                      Gain/Loss
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summary.holdings.slice(0, 5).map((holding) => (
                    <tr
                      key={holding.id}
                      className="border-b border-border/50 hover:bg-accent/50 transition-colors"
                      data-testid={`holding-row-${holding.symbol}`}
                    >
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-mono font-bold text-primary">
                              {holding.symbol.slice(0, 2)}
                            </span>
                          </div>
                          <span className="font-mono font-medium">{holding.symbol}</span>
                        </div>
                      </td>
                      <td className="py-4 text-right tabular-nums">{holding.shares}</td>
                      <td className="py-4 text-right tabular-nums">
                        {formatCurrency(holding.current_price)}
                      </td>
                      <td className="py-4 text-right tabular-nums font-medium">
                        {formatCurrency(holding.market_value)}
                      </td>
                      <td className="py-4 text-right">
                        <div
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-sm text-sm tabular-nums ${
                            holding.gain_loss >= 0 ? "bg-gain text-gain" : "bg-loss text-loss"
                          }`}
                        >
                          {holding.gain_loss >= 0 ? (
                            <ArrowUpRight className="w-3 h-3" />
                          ) : (
                            <ArrowDownRight className="w-3 h-3" />
                          )}
                          {formatPercent(holding.gain_loss_percent)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
