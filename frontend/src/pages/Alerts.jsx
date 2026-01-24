import { useState, useEffect, useCallback, useRef } from "react";
import {
  getPriceAlerts,
  createPriceAlert,
  deletePriceAlert,
  checkPriceAlerts,
  resetPriceAlert,
  searchStocks,
  searchCryptos,
} from "../lib/api";
import { useLanguage } from "../context/LanguageContext";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Bell,
  BellRing,
  ArrowUp,
  ArrowDown,
  Loader2,
  Search,
  RefreshCw,
  CheckCircle,
  RotateCcw,
  TrendingUp,
  Bitcoin,
} from "lucide-react";

// Request notification permission
const requestNotificationPermission = async () => {
  if (!("Notification" in window)) {
    console.log("This browser does not support notifications");
    return false;
  }
  
  if (Notification.permission === "granted") {
    return true;
  }
  
  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }
  
  return false;
};

// Show browser notification
const showNotification = (title, body, icon = "📈") => {
  if (Notification.permission === "granted") {
    new Notification(title, {
      body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: `price-alert-${Date.now()}`,
      requireInteraction: true,
    });
  }
};

export default function Alerts() {
  const { t } = useLanguage();
  const [alerts, setAlerts] = useState([]);
  const [triggeredAlerts, setTriggeredAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  
  // Search states
  const [assetType, setAssetType] = useState("stock");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  
  // Form data
  const [targetPrice, setTargetPrice] = useState("");
  const [condition, setCondition] = useState("above");
  
  // Polling ref
  const pollingRef = useRef(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const response = await getPriceAlerts();
      const active = response.data.filter((a) => !a.triggered);
      const triggered = response.data.filter((a) => a.triggered);
      setAlerts(active);
      setTriggeredAlerts(triggered);
    } catch (error) {
      console.error("Failed to fetch alerts:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkAlerts = useCallback(async (showToast = false) => {
    setChecking(true);
    try {
      const response = await checkPriceAlerts();
      const { triggered_alerts, active_alerts } = response.data;
      
      // Show notifications for newly triggered alerts
      for (const alert of triggered_alerts) {
        const priceFormatted = alert.current_price >= 1 
          ? `$${alert.current_price.toFixed(2)}`
          : `$${alert.current_price.toFixed(6)}`;
        
        showNotification(
          `🔔 Price Alert: ${alert.symbol}`,
          `${alert.name} has ${alert.condition === "above" ? "risen above" : "fallen below"} ${formatCurrency(alert.target_price)}. Current price: ${priceFormatted}`
        );
        
        toast.success(
          `${alert.symbol} ${alert.condition === "above" ? "↑" : "↓"} ${formatCurrency(alert.target_price)}`,
          { description: `Current price: ${priceFormatted}` }
        );
      }
      
      // Update alerts with current prices
      setAlerts(active_alerts);
      setTriggeredAlerts((prev) => [...triggered_alerts, ...prev.filter(
        (p) => !triggered_alerts.find((t) => t.id === p.id)
      )]);
      
      if (showToast && triggered_alerts.length === 0) {
        toast.info("No alerts triggered");
      }
    } catch (error) {
      console.error("Failed to check alerts:", error);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    // Check notification permission
    if ("Notification" in window) {
      setNotificationsEnabled(Notification.permission === "granted");
    }
    
    fetchAlerts();
    
    // Start polling every 30 seconds
    pollingRef.current = setInterval(() => {
      checkAlerts();
    }, 30000);
    
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [fetchAlerts, checkAlerts]);

  // Search handler
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 1) {
      setSearchResults([]);
      return;
    }
    
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = assetType === "stock" 
          ? await searchStocks(searchQuery)
          : await searchCryptos(searchQuery);
        setSearchResults(response.data);
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, assetType]);

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    setNotificationsEnabled(granted);
    if (granted) {
      toast.success("Notifications enabled!");
    } else {
      toast.error("Notifications blocked. Please enable in browser settings.");
    }
  };

  const handleCreateAlert = async () => {
    if (!selectedAsset || !targetPrice) {
      toast.error("Please select an asset and enter a target price");
      return;
    }

    setSubmitting(true);
    try {
      const data = {
        asset_type: assetType,
        symbol: selectedAsset.symbol,
        name: selectedAsset.name,
        target_price: parseFloat(targetPrice),
        condition,
        coin_id: assetType === "crypto" ? selectedAsset.id : null,
      };

      await createPriceAlert(data);
      toast.success(`Alert created for ${selectedAsset.symbol}`);
      setDialogOpen(false);
      resetForm();
      fetchAlerts();
    } catch (error) {
      const message = error.response?.data?.detail || "Failed to create alert";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAlert = async (alert) => {
    if (!window.confirm(`Delete alert for ${alert.symbol}?`)) return;

    try {
      await deletePriceAlert(alert.id);
      toast.success("Alert deleted");
      fetchAlerts();
    } catch (error) {
      toast.error("Failed to delete alert");
    }
  };

  const handleResetAlert = async (alert) => {
    try {
      await resetPriceAlert(alert.id);
      toast.success("Alert reset to active");
      fetchAlerts();
    } catch (error) {
      toast.error("Failed to reset alert");
    }
  };

  const resetForm = () => {
    setSelectedAsset(null);
    setSearchQuery("");
    setSearchResults([]);
    setTargetPrice("");
    setCondition("above");
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

  if (loading) {
    return (
      <div className="space-y-8" data-testid="alerts-loading">
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
    <div className="space-y-8" data-testid="alerts-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-chart-4/10 border border-chart-4/20 flex items-center justify-center">
            <Bell className="w-5 h-5 text-chart-4" />
          </div>
          <div>
            <h1 className="font-chivo text-3xl font-bold tracking-tight">Price Alerts</h1>
            <p className="text-muted-foreground">Get notified when prices hit your targets</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!notificationsEnabled && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleEnableNotifications}
              data-testid="enable-notifications-btn"
            >
              <BellRing className="w-4 h-4 mr-2" />
              Enable Notifications
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => checkAlerts(true)}
            disabled={checking}
            data-testid="check-alerts-btn"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${checking ? "animate-spin" : ""}`} />
            Check Now
          </Button>
          <Button onClick={() => setDialogOpen(true)} data-testid="create-alert-btn">
            <Plus className="w-4 h-4 mr-2" />
            Create Alert
          </Button>
        </div>
      </div>

      {/* Notification Status Banner */}
      {notificationsEnabled && (
        <div className="flex items-center gap-2 px-4 py-2 bg-success/10 border border-success/20 rounded-md">
          <CheckCircle className="w-4 h-4 text-success" />
          <span className="text-sm text-success">Browser notifications enabled - you'll be alerted when prices hit your targets</span>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="active" className="space-y-6">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="active" data-testid="alerts-tab-active">
            <Bell className="w-4 h-4 mr-2" />
            Active ({alerts.length})
          </TabsTrigger>
          <TabsTrigger value="triggered" data-testid="alerts-tab-triggered">
            <BellRing className="w-4 h-4 mr-2" />
            Triggered ({triggeredAlerts.length})
          </TabsTrigger>
        </TabsList>

        {/* Active Alerts */}
        <TabsContent value="active" className="space-y-4">
          {alerts.length === 0 ? (
            <Card className="bg-card border-border" data-testid="empty-alerts">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-full bg-chart-4/10 flex items-center justify-center mb-4">
                  <Bell className="w-8 h-8 text-chart-4 opacity-50" />
                </div>
                <h3 className="font-chivo text-lg font-semibold mb-2">No active alerts</h3>
                <p className="text-muted-foreground text-center max-w-sm mb-4">
                  Create price alerts to get notified when stocks or crypto hit your target prices.
                </p>
                <Button onClick={() => setDialogOpen(true)} data-testid="empty-create-alert-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Alert
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {alerts.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onDelete={handleDeleteAlert}
                  formatCurrency={formatCurrency}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Triggered Alerts */}
        <TabsContent value="triggered" className="space-y-4">
          {triggeredAlerts.length === 0 ? (
            <Card className="bg-card border-border" data-testid="empty-triggered">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
                  <CheckCircle className="w-8 h-8 text-success opacity-50" />
                </div>
                <h3 className="font-chivo text-lg font-semibold mb-2">No triggered alerts</h3>
                <p className="text-muted-foreground text-center max-w-sm">
                  When your price targets are hit, triggered alerts will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {triggeredAlerts.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onDelete={handleDeleteAlert}
                  onReset={handleResetAlert}
                  isTriggered
                  formatCurrency={formatCurrency}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Alert Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-chivo">Create Price Alert</DialogTitle>
            <DialogDescription>
              Get notified when an asset hits your target price
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Asset Type Selection */}
            <div className="space-y-2">
              <Label>Asset Type</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={assetType === "stock" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => {
                    setAssetType("stock");
                    setSelectedAsset(null);
                    setSearchQuery("");
                    setSearchResults([]);
                  }}
                  data-testid="asset-type-stock"
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Stock
                </Button>
                <Button
                  type="button"
                  variant={assetType === "crypto" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => {
                    setAssetType("crypto");
                    setSelectedAsset(null);
                    setSearchQuery("");
                    setSearchResults([]);
                  }}
                  data-testid="asset-type-crypto"
                >
                  <Bitcoin className="w-4 h-4 mr-2" />
                  Crypto
                </Button>
              </div>
            </div>

            {/* Asset Search */}
            <div className="space-y-2">
              <Label>Search {assetType === "stock" ? "Stock" : "Cryptocurrency"}</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={assetType === "stock" ? "Search stocks (e.g., AAPL)" : "Search crypto (e.g., Bitcoin)"}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-secondary/50 border-transparent focus:border-primary"
                  data-testid="alert-search-input"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin" />
                )}
              </div>
              
              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto border border-border rounded-md bg-card">
                  {searchResults.map((result, index) => (
                    <button
                      key={`${result.symbol}-${index}`}
                      type="button"
                      onClick={() => {
                        setSelectedAsset(result);
                        setSearchQuery(result.name);
                        setSearchResults([]);
                      }}
                      className={`w-full px-4 py-3 text-left hover:bg-accent transition-colors flex items-center justify-between ${
                        selectedAsset?.symbol === result.symbol ? "bg-primary/10" : ""
                      }`}
                      data-testid={`alert-result-${result.symbol}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-md flex items-center justify-center ${
                          assetType === "stock" ? "bg-primary/10" : "bg-warning/10"
                        }`}>
                          <span className={`text-xs font-mono font-bold ${
                            assetType === "stock" ? "text-primary" : "text-warning"
                          }`}>
                            {result.symbol.slice(0, 2)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{result.name}</p>
                          <p className="text-xs text-muted-foreground">{result.symbol}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Selected Asset */}
              {selectedAsset && (
                <div className={`flex items-center gap-2 p-2 rounded-md ${
                  assetType === "stock" ? "bg-primary/10" : "bg-warning/10"
                }`}>
                  <span className="font-mono font-bold">{selectedAsset.symbol}</span>
                  <span className="text-muted-foreground">{selectedAsset.name}</span>
                </div>
              )}
            </div>

            {/* Condition & Target Price */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Condition</Label>
                <Select value={condition} onValueChange={setCondition}>
                  <SelectTrigger className="bg-secondary/50 border-transparent" data-testid="alert-condition-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="above">
                      <div className="flex items-center gap-2">
                        <ArrowUp className="w-4 h-4 text-success" />
                        Price goes above
                      </div>
                    </SelectItem>
                    <SelectItem value="below">
                      <div className="flex items-center gap-2">
                        <ArrowDown className="w-4 h-4 text-error" />
                        Price goes below
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Target Price (USD)</Label>
                <Input
                  type="number"
                  step="any"
                  placeholder="100.00"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  className="bg-secondary/50 border-transparent focus:border-primary"
                  data-testid="alert-target-price-input"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="cancel-alert-btn">
              Cancel
            </Button>
            <Button
              onClick={handleCreateAlert}
              disabled={submitting || !selectedAsset || !targetPrice}
              data-testid="save-alert-btn"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Alert"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Alert Card Component
function AlertCard({ alert, onDelete, onReset, isTriggered = false, formatCurrency }) {
  const isStock = alert.asset_type === "stock";
  const isAbove = alert.condition === "above";

  return (
    <Card
      className={`bg-card border-border card-hover ${isTriggered ? "border-success/30" : ""}`}
      data-testid={`alert-card-${alert.symbol}`}
    >
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Asset Info */}
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-md flex items-center justify-center ${
              isStock 
                ? "bg-primary/10 border border-primary/20" 
                : "bg-warning/10 border border-warning/20"
            }`}>
              <span className={`text-sm font-mono font-bold ${isStock ? "text-primary" : "text-warning"}`}>
                {alert.symbol.slice(0, 3)}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-mono font-bold text-lg">{alert.symbol}</h3>
                {isTriggered && (
                  <span className="px-2 py-0.5 text-xs bg-success/10 text-success rounded-full">
                    Triggered
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{alert.name}</p>
            </div>
          </div>

          {/* Alert Details */}
          <div className="flex flex-wrap items-center gap-6 md:gap-8">
            <div className="text-left md:text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Condition</p>
              <div className={`flex items-center gap-1 ${isAbove ? "text-success" : "text-error"}`}>
                {isAbove ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                <span className="font-medium">{isAbove ? "Above" : "Below"}</span>
              </div>
            </div>

            <div className="text-left md:text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Target</p>
              <p className="font-manrope font-semibold tabular-nums">
                {formatCurrency(alert.target_price)}
              </p>
            </div>

            {alert.current_price && (
              <div className="text-left md:text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  {isTriggered ? "Price at Trigger" : "Current Price"}
                </p>
                <p className="font-manrope font-semibold tabular-nums">
                  {formatCurrency(alert.current_price)}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2">
              {isTriggered && onReset && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onReset(alert)}
                  title="Reset alert"
                  data-testid={`reset-alert-${alert.symbol}`}
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(alert)}
                className="text-muted-foreground hover:text-destructive"
                data-testid={`delete-alert-${alert.symbol}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {isTriggered && alert.triggered_at && (
          <div className="mt-4 pt-4 border-t border-border/50">
            <p className="text-xs text-muted-foreground">
              Triggered on {new Date(alert.triggered_at).toLocaleString()}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
