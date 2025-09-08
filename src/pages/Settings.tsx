import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Building, Palette, Wrench, CreditCard, Package, Users, UserCheck, MapPin, Warehouse, Save } from "lucide-react";
import { toast } from "sonner";
import { useOrganization } from "@/lib/saas/hooks";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { Globe } from "lucide-react";
import { useSaas } from "@/lib/saas";
import { ModuleManagement } from "@/components/settings/ModuleManagement";
import { LocationsSettings } from "@/components/settings/LocationsSettings";
import { WarehousesSettings } from "@/components/settings/WarehousesSettings";
import { AccountingSettings } from "@/components/settings/AccountingSettings";
import { ItemsSettings } from "@/components/settings/ItemsSettings";
import { RegionalSettings } from "@/components/settings/RegionalSettings";

import { SubscriptionBilling } from "@/components/settings/SubscriptionBilling";

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "company");
  const { systemSettings } = useSaas();
  const appName = (systemSettings as any)?.app_name || 'AURA OS';
  
  // Branding state
  const [brandColors, setBrandColors] = useState({
    primary: "0 0% 9%",
    accent: "0 0% 96.1%",
    theme: "default"
  });
  
  // Shadcn UI Theme Presets - Based on ui.shadcn.com/themes
  const THEME_PRESETS = [
    {
      name: "Default",
      id: "default",
      description: "Clean black and white theme",
      colors: {
        primary: "0 0% 9%",
        accent: "0 0% 96.1%",
        preview: "hsl(0 0% 9%)"
      }
    },
    {
      name: "Red",
      id: "red", 
      description: "Bold red accent theme",
      colors: {
        primary: "0 72% 51%",
        accent: "0 0% 96.1%",
        preview: "hsl(0 72% 51%)"
      }
    },
    {
      name: "Rose",
      id: "rose",
      description: "Elegant rose theme",
      colors: {
        primary: "346 77% 50%",
        accent: "0 0% 96.1%", 
        preview: "hsl(346 77% 50%)"
      }
    },
    {
      name: "Orange",
      id: "orange",
      description: "Vibrant orange theme",
      colors: {
        primary: "25 95% 53%",
        accent: "0 0% 96.1%",
        preview: "hsl(25 95% 53%)"
      }
    },
    {
      name: "Green",
      id: "green", 
      description: "Nature green theme",
      colors: {
        primary: "142 76% 36%",
        accent: "0 0% 96.1%",
        preview: "hsl(142 76% 36%)"
      }
    },
    {
      name: "Blue",
      id: "blue",
      description: "Professional blue theme", 
      colors: {
        primary: "221 83% 53%",
        accent: "0 0% 96.1%",
        preview: "hsl(221 83% 53%)"
      }
    },
    {
      name: "Yellow",
      id: "yellow",
      description: "Bright yellow theme",
      colors: {
        primary: "48 96% 53%", 
        accent: "0 0% 96.1%",
        preview: "hsl(48 96% 53%)"
      }
    },
    {
      name: "Violet",
      id: "violet",
      description: "Creative violet theme",
      colors: {
        primary: "262 83% 58%",
        accent: "0 0% 96.1%",
        preview: "hsl(262 83% 58%)"
      }
    }
  ];

  const [selectedTheme, setSelectedTheme] = useState("default");
  const [loading, setLoading] = useState(false);
  const [countries, setCountries] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const { organization, updateOrganization } = useOrganization();
  const [companySettings, setCompanySettings] = useState({
    name: '',
    country: '',
    currency: ''
  });

  useEffect(() => {
    if (searchParams.get("tab") !== activeTab) {
      setSearchParams({ tab: activeTab });
    }
  }, [activeTab, searchParams, setSearchParams]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (organization) {
      const settings = organization.settings as any || {};
      setCompanySettings({
        name: organization.name || '',
        country: settings.country || '',
        currency: settings.currency || ''
      });
    }
  }, [organization]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [countriesRes, currenciesRes, modulesRes] = await Promise.all([
        supabase.from("countries").select("*").eq("is_active", true).order("name"),
        supabase.from("currencies").select("*").eq("is_active", true).order("name"),
        supabase.from("organization_modules").select("*").eq("organization_id", organization?.id)
      ]);

      if (countriesRes.data) setCountries(countriesRes.data);
      if (currenciesRes.data) setCurrencies(currenciesRes.data);
      if (modulesRes.data) setModules(modulesRes.data);

    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load settings data");
    } finally {
      setLoading(false);
    }
  };

  const handleThemeChange = (themeId: string) => {
    setSelectedTheme(themeId);
    const theme = THEME_PRESETS.find(t => t.id === themeId);
    if (theme) {
      setBrandColors({
        primary: theme.colors.primary,
        accent: theme.colors.accent,
        theme: themeId
      });
      applyTheme(theme.colors);
    }
  };

  const applyTheme = (colors: { primary: string; accent: string }) => {
    const root = document.documentElement;
    root.style.setProperty('--primary', colors.primary);
    root.style.setProperty('--accent', colors.accent);
  };

  const handleCompanySettingsChange = (field: string, value: string) => {
    setCompanySettings(prev => ({ ...prev, [field]: value }));
  };

  const saveCompanySettings = async () => {
    if (!organization?.id || !updateOrganization) return;
    
    try {
      setLoading(true);
      
      const currentSettings = organization.settings as any || {};
      const updatedSettings = {
        ...currentSettings,
        country: companySettings.country,
        currency: companySettings.currency
      };

      await updateOrganization(organization.id, {
        name: companySettings.name,
        settings: updatedSettings
      });

      toast.success('Company settings saved successfully');
    } catch (error) {
      console.error('Error saving company settings:', error);
      toast.error('Failed to save company settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your organization settings and preferences
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
          <TabsTrigger value="company" className="justify-start gap-2 data-[state=active]:bg-muted">
            <Building className="h-4 w-4" />
            Company
          </TabsTrigger>
          <TabsTrigger value="branding" className="justify-start gap-2 data-[state=active]:bg-muted">
            <Palette className="h-4 w-4" />
            Branding
          </TabsTrigger>
          <TabsTrigger value="accounting" className="justify-start gap-2 data-[state=active]:bg-muted">
            <CreditCard className="h-4 w-4" />
            Accounting
          </TabsTrigger>
          <TabsTrigger value="items" className="justify-start gap-2 data-[state=active]:bg-muted">
            <Package className="h-4 w-4" />
            Items
          </TabsTrigger>
          <TabsTrigger value="locations" className="justify-start gap-2 data-[state=active]:bg-muted">
            <MapPin className="h-4 w-4" />
            Locations
          </TabsTrigger>
          <TabsTrigger value="warehouses" className="justify-start gap-2 data-[state=active]:bg-muted">
            <Warehouse className="h-4 w-4" />
            Warehouses
          </TabsTrigger>
          <TabsTrigger value="modules" className="justify-start gap-2 data-[state=active]:bg-muted">
            <Wrench className="h-4 w-4" />
            Modules
          </TabsTrigger>
          <TabsTrigger value="staff" className="justify-start gap-2 data-[state=active]:bg-muted">
            <Users className="h-4 w-4" />
            Staff
          </TabsTrigger>
        </TabsList>

        <div className="space-y-6">
          {/* Company Settings */}
          <TabsContent value="company">
            <div className="space-y-6">
              {/* Company Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5 text-primary" />
                    Company Information
                  </CardTitle>
                  <CardDescription>
                    Basic information about your organization
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Organization Name</Label>
                      <Input 
                        value={companySettings.name} 
                        onChange={(e) => handleCompanySettingsChange('name', e.target.value)}
                        placeholder="Enter organization name"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <Label>Country</Label>
                      <Select 
                        value={companySettings.country} 
                        onValueChange={(value) => handleCompanySettingsChange('country', value)}
                        disabled={loading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                        <SelectContent>
                          {countries.map(country => (
                            <SelectItem key={country.id} value={country.code}>
                              {country.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Currency</Label>
                      <Select 
                        value={companySettings.currency} 
                        onValueChange={(value) => handleCompanySettingsChange('currency', value)}
                        disabled={loading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          {currencies.map(currency => (
                            <SelectItem key={currency.id} value={currency.code}>
                              {currency.name} ({currency.symbol})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="flex justify-end pt-4 border-t">
                    <Button onClick={saveCompanySettings} disabled={loading} className="flex items-center gap-2">
                      <Save className="h-4 w-4" />
                      {loading ? 'Saving...' : 'Save Company Settings'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Regional Settings */}
              <RegionalSettings />

              {/* Subscription & Billing */}
              <SubscriptionBilling />
            </div>
          </TabsContent>

          {/* Branding Settings */}
          <TabsContent value="branding">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5 text-primary" />
                  Theme & Branding
                </CardTitle>
                <CardDescription>
                  Choose from beautiful preset themes inspired by shadcn/ui
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-4">
                    <Label className="text-base font-semibold">Choose a Theme</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {THEME_PRESETS.map((theme) => (
                        <div
                          key={theme.id}
                          className={`relative cursor-pointer rounded-lg border-2 p-4 transition-all hover:shadow-md ${
                            selectedTheme === theme.id 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border hover:border-primary/50'
                          }`}
                          onClick={() => handleThemeChange(theme.id)}
                        >
                          <div className="space-y-2">
                            <div 
                              className="w-full h-8 rounded-md border"
                              style={{ backgroundColor: theme.colors.preview }}
                            />
                            <div className="space-y-1">
                              <div className="font-medium text-sm">{theme.name}</div>
                              <div className="text-xs text-muted-foreground">{theme.description}</div>
                            </div>
                          </div>
                          {selectedTheme === theme.id && (
                            <div className="absolute top-2 right-2">
                              <div className="w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                                <div className="w-2 h-2 bg-white rounded-full" />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
                    <Label className="text-sm font-medium">Preview</Label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded border"
                          style={{ 
                            backgroundColor: `hsl(${brandColors.primary})` 
                          }}
                        />
                        <span className="text-sm">Primary: {brandColors.primary}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded border"
                          style={{ 
                            backgroundColor: `hsl(${brandColors.accent})` 
                          }}
                        />
                        <span className="text-sm">Accent: {brandColors.accent}</span>
                      </div>
                    </div>
                  </div>
                </div>

              </CardContent>
            </Card>
          </TabsContent>

          {/* Accounting Settings */}
          <TabsContent value="accounting">
            <AccountingSettings />
          </TabsContent>

          {/* Items Settings */}
          <TabsContent value="items">
            <ItemsSettings />
          </TabsContent>

          {/* Locations Settings */}
          <TabsContent value="locations">
            <LocationsSettings />
          </TabsContent>

          {/* Warehouses Settings */}
          <TabsContent value="warehouses">
            <WarehousesSettings />
          </TabsContent>

          {/* Module Management */}
          <TabsContent value="modules">
            <ModuleManagement />
          </TabsContent>

          {/* Staff Settings - Redirect to main Staff page */}
          <TabsContent value="staff">
            <Card>
              <CardContent className="p-6 text-center">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Staff Management</h3>
                <p className="text-muted-foreground mb-4">
                  Staff management has been moved to its own dedicated page with more features.
                </p>
                <Button onClick={() => window.location.href = '/staff'}>
                  Go to Staff Management
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}