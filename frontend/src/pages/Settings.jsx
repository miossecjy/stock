import { useLanguage } from "../context/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { Globe, Check } from "lucide-react";

export default function Settings() {
  const { language, setLanguage, languages, t } = useLanguage();

  // Settings-specific translations
  const settingsText = {
    en: {
      title: "Settings",
      subtitle: "Manage your application preferences",
      languageTitle: "Language",
      languageDescription: "Choose your preferred language for the application",
      currentLanguage: "Current language",
    },
    fr: {
      title: "Paramètres",
      subtitle: "Gérez vos préférences d'application",
      languageTitle: "Langue",
      languageDescription: "Choisissez votre langue préférée pour l'application",
      currentLanguage: "Langue actuelle",
    },
    de: {
      title: "Einstellungen",
      subtitle: "Verwalten Sie Ihre Anwendungseinstellungen",
      languageTitle: "Sprache",
      languageDescription: "Wählen Sie Ihre bevorzugte Sprache für die Anwendung",
      currentLanguage: "Aktuelle Sprache",
    },
    es: {
      title: "Configuración",
      subtitle: "Gestiona las preferencias de la aplicación",
      languageTitle: "Idioma",
      languageDescription: "Elige tu idioma preferido para la aplicación",
      currentLanguage: "Idioma actual",
    },
  };

  const text = settingsText[language];

  return (
    <div className="space-y-8" data-testid="settings-page">
      {/* Header */}
      <div>
        <h1 className="font-chivo text-3xl font-bold tracking-tight">{text.title}</h1>
        <p className="text-muted-foreground mt-1">{text.subtitle}</p>
      </div>

      {/* Language Settings Card */}
      <Card className="bg-card border-border" data-testid="language-settings-card">
        <CardHeader>
          <CardTitle className="font-chivo flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            {text.languageTitle}
          </CardTitle>
          <CardDescription>{text.languageDescription}</CardDescription>
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
    </div>
  );
}
