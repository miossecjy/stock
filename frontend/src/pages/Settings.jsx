import { useState, useEffect } from "react";
import { useLanguage } from "../context/LanguageContext";
import { getAPISettings, updateAPISettings, testAPIProvider } from "../lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { toast } from "sonner";
import { 
  Globe, 
  Check, 
  Database, 
  GripVertical, 
  Key, 
  Loader2, 
  CheckCircle, 
  XCircle,
  ChevronUp,
  ChevronDown,
  Zap,
  Eye,
  EyeOff,
} from "lucide-react";

export default function Settings() {
  const { language, setLanguage, languages, t } = useLanguage();
  
  // API Settings state
  const [apiSettings, setApiSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState({});
  const [testResults, setTestResults] = useState({});
  const [showKeys, setShowKeys] = useState({});
  
  // Form state
  const [providerOrder, setProviderOrder] = useState([]);
  const [useCustomKeys, setUseCustomKeys] = useState(false);
  const [finnhubKey, setFinnhubKey] = useState("");
  const [alphavantageKey, setAlphavantageKey] = useState("");

  useEffect(() => {
    fetchAPISettings();
  }, []);

  const fetchAPISettings = async () => {
    try {
      const response = await getAPISettings();
      setApiSettings(response.data);
      setProviderOrder(response.data.stock_provider_priority);
      setUseCustomKeys(response.data.use_custom_keys);
    } catch (error) {
      console.error("Failed to fetch API settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const moveProvider = (index, direction) => {
    const newOrder = [...providerOrder];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newOrder.length) return;
    
    [newOrder[index], newOrder[newIndex]] = [newOrder[newIndex], newOrder[index]];
    setProviderOrder(newOrder);
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const data = {
        stock_provider_priority: providerOrder,
        use_custom_keys: useCustomKeys,
      };
      
      if (finnhubKey) data.finnhub_api_key = finnhubKey;
      if (alphavantageKey) data.alphavantage_api_key = alphavantageKey;
      
      await updateAPISettings(data);
      toast.success("API settings saved");
      setFinnhubKey("");
      setAlphavantageKey("");
      fetchAPISettings();
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleTestProvider = async (providerId) => {
    setTesting(prev => ({ ...prev, [providerId]: true }));
    setTestResults(prev => ({ ...prev, [providerId]: null }));
    
    try {
      const response = await testAPIProvider(providerId);
      setTestResults(prev => ({ ...prev, [providerId]: response.data }));
      if (response.data.success) {
        toast.success(`${providerId} is working!`);
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      setTestResults(prev => ({ 
        ...prev, 
        [providerId]: { success: false, message: "Connection failed" } 
      }));
      toast.error("Test failed");
    } finally {
      setTesting(prev => ({ ...prev, [providerId]: false }));
    }
  };

  const getProviderInfo = (providerId) => {
    return apiSettings?.available_stock_providers?.find(p => p.id === providerId) || {};
  };

  return (
    <div className="space-y-8" data-testid="settings-page">
      {/* Header */}
      <div>
        <h1 className="font-chivo text-3xl font-bold tracking-tight">{t("settings.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("settings.subtitle")}</p>
      </div>

      {/* Language Settings Card */}
      <Card className="bg-card border-border" data-testid="language-settings-card">
        <CardHeader>
          <CardTitle className="font-chivo flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            {t("settings.languageTitle")}
          </CardTitle>
          <CardDescription>{t("settings.languageDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={language}
            onValueChange={setLanguage}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            {languages.map((lang) => (
              <Label
                key={lang.code}
                htmlFor={`lang-${lang.code}`}
                className={`flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  language === lang.code
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-secondary/30"
                }`}
                data-testid={`language-option-${lang.code}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{lang.flag}</span>
                  <div>
                    <p className="font-medium">{lang.name}</p>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      {lang.code}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {language === lang.code && (
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                  <RadioGroupItem
                    value={lang.code}
                    id={`lang-${lang.code}`}
                    className="sr-only"
                  />
                </div>
              </Label>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* API Provider Settings */}
      <Card className="bg-card border-border" data-testid="api-settings-card">
        <CardHeader>
          <CardTitle className="font-chivo flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            Data Providers
          </CardTitle>
          <CardDescription>
            Configure which APIs to use for stock and crypto data. Drag to reorder priority.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Provider Priority */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Stock Data Priority</Label>
                <p className="text-xs text-muted-foreground mb-3">
                  Data will be fetched from providers in this order. First available wins.
                </p>
                
                <div className="space-y-2">
                  {providerOrder.map((providerId, index) => {
                    const provider = getProviderInfo(providerId);
                    const result = testResults[providerId];
                    
                    return (
                      <div
                        key={providerId}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/20 hover:bg-secondary/40 transition-colors"
                        data-testid={`provider-${providerId}`}
                      >
                        {/* Priority Number */}
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {index + 1}
                        </div>
                        
                        {/* Move Buttons */}
                        <div className="flex flex-col gap-0.5">
                          <button
                            onClick={() => moveProvider(index, "up")}
                            disabled={index === 0}
                            className="p-0.5 hover:bg-secondary rounded disabled:opacity-30"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => moveProvider(index, "down")}
                            disabled={index === providerOrder.length - 1}
                            className="p-0.5 hover:bg-secondary rounded disabled:opacity-30"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </div>
                        
                        {/* Provider Info */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{provider.name}</span>
                            {provider.requires_key && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-warning/20 text-warning">
                                API Key
                              </span>
                            )}
                            {!provider.requires_key && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-500">
                                Free
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{provider.description}</p>
                        </div>
                        
                        {/* Test Button & Result */}
                        <div className="flex items-center gap-2">
                          {result && (
                            result.success ? (
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-500" />
                            )
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTestProvider(providerId)}
                            disabled={testing[providerId]}
                            data-testid={`test-${providerId}`}
                          >
                            {testing[providerId] ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Zap className="w-4 h-4 mr-1" />
                                Test
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Custom API Keys */}
              <div className="space-y-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Use Custom API Keys</Label>
                    <p className="text-xs text-muted-foreground">
                      Use your own API keys instead of default ones
                    </p>
                  </div>
                  <Switch
                    checked={useCustomKeys}
                    onCheckedChange={setUseCustomKeys}
                    data-testid="use-custom-keys-switch"
                  />
                </div>
                
                {useCustomKeys && (
                  <div className="space-y-4 p-4 rounded-lg bg-secondary/30">
                    {/* Finnhub Key */}
                    <div className="space-y-2">
                      <Label htmlFor="finnhub-key" className="flex items-center gap-2">
                        <Key className="w-4 h-4" />
                        Finnhub API Key
                        {apiSettings?.finnhub_api_key_set && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-500">
                            Set
                          </span>
                        )}
                      </Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            id="finnhub-key"
                            type={showKeys.finnhub ? "text" : "password"}
                            placeholder={apiSettings?.finnhub_api_key_set ? "••••••••••••" : "Enter your Finnhub API key"}
                            value={finnhubKey}
                            onChange={(e) => setFinnhubKey(e.target.value)}
                            className="bg-background pr-10"
                            data-testid="finnhub-key-input"
                          />
                          <button
                            type="button"
                            onClick={() => setShowKeys(prev => ({ ...prev, finnhub: !prev.finnhub }))}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showKeys.finnhub ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Get your free key at <a href="https://finnhub.io" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">finnhub.io</a>
                      </p>
                    </div>
                    
                    {/* Alpha Vantage Key */}
                    <div className="space-y-2">
                      <Label htmlFor="alphavantage-key" className="flex items-center gap-2">
                        <Key className="w-4 h-4" />
                        Alpha Vantage API Key
                        {apiSettings?.alphavantage_api_key_set && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-500">
                            Set
                          </span>
                        )}
                      </Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            id="alphavantage-key"
                            type={showKeys.alphavantage ? "text" : "password"}
                            placeholder={apiSettings?.alphavantage_api_key_set ? "••••••••••••" : "Enter your Alpha Vantage API key"}
                            value={alphavantageKey}
                            onChange={(e) => setAlphavantageKey(e.target.value)}
                            className="bg-background pr-10"
                            data-testid="alphavantage-key-input"
                          />
                          <button
                            type="button"
                            onClick={() => setShowKeys(prev => ({ ...prev, alphavantage: !prev.alphavantage }))}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showKeys.alphavantage ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Get your free key at <a href="https://www.alphavantage.co/support/#api-key" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">alphavantage.co</a>
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Crypto Provider Info */}
              <div className="space-y-3 pt-4 border-t border-border">
                <Label className="text-sm font-medium">Crypto Data</Label>
                <div className="p-3 rounded-lg border border-border bg-secondary/20">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">CoinGecko</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-500">
                      Free
                    </span>
                    <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Free, no API key required. Comprehensive cryptocurrency data.
                  </p>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-4">
                <Button 
                  onClick={handleSaveSettings} 
                  disabled={saving}
                  data-testid="save-api-settings"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Settings"
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
