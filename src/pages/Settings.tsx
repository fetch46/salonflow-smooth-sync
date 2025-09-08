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
import { Building, Palette, Wrench, CreditCard, Package, Users, UserCheck, MapPin, Warehouse, Save, LayoutGrid } from "lucide-react";
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
// ThemeColorPicker removed in favor of dropdown-based selectors

import { SubscriptionBilling } from "@/components/settings/SubscriptionBilling";

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "company");
  const { systemSettings } = useSaas();
  const appName = (systemSettings as any)?.app_name || 'AURA OS';
  
  // Branding state
  const [brandColors, setBrandColors] = useState({
    primary: "0 0% 9%",
    secondary: "0 0% 96.1%",
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
        secondary: "0 0% 96.1%",
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
        secondary: "0 0% 96.1%",
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
        secondary: "0 0% 96.1%",
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
        secondary: "0 0% 96.1%",
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
        secondary: "0 0% 96.1%",
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
        secondary: "0 0% 96.1%",
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
        secondary: "0 0% 96.1%",
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
        secondary: "0 0% 96.1%",
        accent: "0 0% 96.1%",
        preview: "hsl(262 83% 58%)"
      }
    }
  ];

  // Shadcn color options (500-ish hues)
  const SHADCN_COLORS: { id: string; name: string; hsl: string }[] = [
    { id: 'slate', name: 'Slate', hsl: '215 20.2% 65.1%' },
    { id: 'gray', name: 'Gray', hsl: '220 9% 46%' },
    { id: 'zinc', name: 'Zinc', hsl: '240 5% 64.9%' },
    { id: 'neutral', name: 'Neutral', hsl: '0 0% 45%' },
    { id: 'stone', name: 'Stone', hsl: '24 6% 55%' },
    { id: 'red', name: 'Red', hsl: '0 72% 51%' },
    { id: 'rose', name: 'Rose', hsl: '346 77% 50%' },
    { id: 'orange', name: 'Orange', hsl: '25 95% 53%' },
    { id: 'amber', name: 'Amber', hsl: '38 92% 50%' },
    { id: 'yellow', name: 'Yellow', hsl: '48 96% 53%' },
    { id: 'lime', name: 'Lime', hsl: '84 81% 44%' },
    { id: 'green', name: 'Green', hsl: '142 76% 36%' },
    { id: 'emerald', name: 'Emerald', hsl: '160 84% 39%' },
    { id: 'teal', name: 'Teal', hsl: '173 80% 40%' },
    { id: 'cyan', name: 'Cyan', hsl: '199 89% 48%' },
    { id: 'sky', name: 'Sky', hsl: '202 89% 53%' },
    { id: 'blue', name: 'Blue', hsl: '221 83% 53%' },
    { id: 'indigo', name: 'Indigo', hsl: '239 84% 67%' },
    { id: 'violet', name: 'Violet', hsl: '262 83% 58%' },
    { id: 'purple', name: 'Purple', hsl: '270 70% 55%' },
    { id: 'fuchsia', name: 'Fuchsia', hsl: '292 84% 61%' },
    { id: 'pink', name: 'Pink', hsl: '330 81% 60%' },
    { id: 'black', name: 'Black', hsl: '0 0% 9%' },
    { id: 'white', name: 'White', hsl: '0 0% 96.1%' },
  ];

  const [selectedTheme, setSelectedTheme] = useState("default");
  const [loading, setLoading] = useState(false);
  // Manual theme parts
  const [manualTheme, setManualTheme] = useState({
    sidebarBg: '',
    sidebarText: '',
    topbarBg: '',
    topbarText: '',
    footerBg: '',
    footerText: '',
    navLinkColor: '',
    tabsBg: '',
    tabsText: '',
    tabsActiveBg: '',
    tabsActiveText: ''
  });
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

  // Load manual theme overrides from localStorage on mount
  useEffect(() => {
    const keys = [
      'sidebarBg','sidebarText','topbarBg','topbarText','footerBg','footerText','navLinkColor','tabsBg','tabsText','tabsActiveBg','tabsActiveText'
    ] as const
    const loaded: any = {}
    let hasAny = false
    keys.forEach((k) => {
      const v = localStorage.getItem(`manual-${k}`)
      if (v) {
        loaded[k] = v
        hasAny = true
      }
    })
    if (hasAny) {
      setManualTheme((prev) => ({ ...prev, ...loaded }))
      applyManualTheme(loaded)
    }
  }, [])

  useEffect(() => {
    if (organization) {
      const settings = organization.settings as any || {};
      setCompanySettings({
        name: organization.name || '',
        country: settings.country || '',
        currency: settings.currency || ''
      });

      // Load saved branding/theme settings
      if (settings.branding) {
        const branding = settings.branding as any
        if (branding.theme) {
          setSelectedTheme(branding.theme)
        }
        if (branding.colors) {
          setBrandColors((prev) => ({
            ...prev,
            primary: branding.colors.primary || prev.primary,
            secondary: branding.colors.secondary || prev.secondary,
            accent: branding.colors.accent || prev.accent,
          }))
          // Apply to CSS variables so preview reflects saved branding
          applyTheme({ 
            primary: branding.colors.primary || brandColors.primary, 
            secondary: branding.colors.secondary || brandColors.secondary,
            accent: branding.colors.accent || brandColors.accent 
          })
        }
        if (branding.manual) {
          setManualTheme({
            sidebarBg: branding.manual.sidebarBg || '',
            sidebarText: branding.manual.sidebarText || '',
            topbarBg: branding.manual.topbarBg || '',
            topbarText: branding.manual.topbarText || '',
            footerBg: branding.manual.footerBg || '',
            footerText: branding.manual.footerText || '',
            navLinkColor: branding.manual.navLinkColor || '',
            tabsBg: branding.manual.tabsBg || '',
            tabsText: branding.manual.tabsText || '',
            tabsActiveBg: branding.manual.tabsActiveBg || '',
            tabsActiveText: branding.manual.tabsActiveText || ''
          })
          applyManualTheme(branding.manual)
        }
      }
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
      setBrandColors((prev) => ({
        ...prev,
        primary: theme.colors.primary,
        secondary: theme.colors.secondary,
        accent: theme.colors.accent,
        theme: themeId
      }));
      applyTheme(theme.colors as any);
    }
  };

  const applyTheme = (colors: { primary: string; secondary: string; accent: string }) => {
    const root = document.documentElement;
    root.style.setProperty('--theme-primary', colors.primary);
    root.style.setProperty('--theme-primary-foreground', computeForeground(colors.primary));
    // Secondary and Accent map directly to Tailwind tokens
    root.style.setProperty('--secondary', colors.secondary);
    root.style.setProperty('--secondary-foreground', computeForeground(colors.secondary));
    root.style.setProperty('--accent', colors.accent);
    root.style.setProperty('--accent-foreground', computeForeground(colors.accent));
    
    // Store in localStorage for persistence
    localStorage.setItem('theme-primary', colors.primary);
    localStorage.setItem('theme-primary-foreground', computeForeground(colors.primary));
    localStorage.setItem('theme-secondary', colors.secondary);
    localStorage.setItem('theme-secondary-foreground', computeForeground(colors.secondary));
    localStorage.setItem('theme-accent', colors.accent);
    localStorage.setItem('theme-accent-foreground', computeForeground(colors.accent));
  };

  const computeForeground = (hsl: string) => {
    // crude parse: "H S% L%" -> decide white or near-black text
    try {
      const parts = hsl.split(' ');
      const lightnessStr = parts[2] || '';
      const lightness = parseInt(lightnessStr.replace('%', ''));
      if (isNaN(lightness)) return '0 0% 98%';
      return lightness < 55 ? '0 0% 98%' : '0 0% 9%';
    } catch {
      return '0 0% 98%';
    }
  };

  const applyManualTheme = (manual: Partial<typeof manualTheme>) => {
    const root = document.documentElement;
    if (manual.sidebarBg) root.style.setProperty('--sidebar-background', manual.sidebarBg);
    if (manual.sidebarText) root.style.setProperty('--sidebar-foreground', manual.sidebarText);
    if (manual.topbarBg) root.style.setProperty('--topbar-bg', manual.topbarBg);
    if (manual.topbarText) root.style.setProperty('--topbar-foreground', manual.topbarText);
    if (manual.footerBg) root.style.setProperty('--footer-bg', manual.footerBg);
    if (manual.footerText) root.style.setProperty('--footer-foreground', manual.footerText);
    if (manual.navLinkColor) root.style.setProperty('--nav-link-color', manual.navLinkColor);
    if (manual.tabsBg) root.style.setProperty('--tabs-bg', manual.tabsBg);
    if (manual.tabsText) root.style.setProperty('--tabs-foreground', manual.tabsText);
    if (manual.tabsActiveBg) root.style.setProperty('--tabs-active-bg', manual.tabsActiveBg);
    if (manual.tabsActiveText) root.style.setProperty('--tabs-active-foreground', manual.tabsActiveText);

    Object.entries(manual).forEach(([key, value]) => {
      if (value) localStorage.setItem(`manual-${key}`, String(value));
    });
  };

  const setPrimaryColor = (hsl: string) => {
    setBrandColors((prev) => {
      const next = { ...prev, primary: hsl, theme: 'custom' } as any;
      applyTheme(next as any);
      return next;
    });
  };

  const setSecondaryColor = (hsl: string) => {
    setBrandColors((prev) => {
      const next = { ...prev, secondary: hsl, theme: 'custom' } as any;
      applyTheme(next as any);
      return next;
    });
  };

  const setAccentColor = (hsl: string) => {
    setBrandColors((prev) => {
      const next = { ...prev, accent: hsl, theme: 'custom' } as any;
      applyTheme(next as any);
      return next;
    });
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

  const saveBrandingSettings = async () => {
    if (!organization?.id || !updateOrganization) return;

    try {
      setLoading(true);

      const currentSettings = (organization.settings as any) || {};
      const updatedSettings = {
        ...currentSettings,
        branding: {
          theme: selectedTheme,
          colors: brandColors,
          manual: manualTheme,
        },
      };

      await updateOrganization(organization.id, {
        settings: updatedSettings,
      });

      toast.success('Theme settings saved successfully');
    } catch (error) {
      console.error('Error saving theme settings:', error);
      toast.error('Failed to save theme settings');
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
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <Label>Organization Name</Label>
                      <Input 
                        value={companySettings.name} 
                        onChange={(e) => handleCompanySettingsChange('name', e.target.value)}
                        placeholder="Enter organization name"
                        disabled={loading}
                      />
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

          {/* Branding Settings */
          /* Layout: Left new card (40% width), Theme & Branding (40%), Preview below (full width) */}
          <TabsContent value="branding">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* New Left Card (instructions / quick actions) */}
              <Card className="lg:col-span-3 order-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LayoutGrid className="h-5 w-5 text-primary" />
                    Appearance Overview
                  </CardTitle>
                  <CardDescription>
                    Configure brand colors and UI sections. Primary affects buttons; Secondary affects text/icons.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-sm text-muted-foreground">Primary color is used for buttons and active elements. Secondary color is used for text and icons.</div>
                  <Separator />
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <div className="text-sm text-muted-foreground">Primary</div>
                        <div className="h-10 rounded-md border" style={{ backgroundColor: `hsl(${brandColors.primary})` }} />
                        <div className="text-xs break-all">{brandColors.primary}</div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm text-muted-foreground">Secondary</div>
                        <div className="h-10 rounded-md border" style={{ backgroundColor: `hsl(${(brandColors as any).secondary})` }} />
                        <div className="text-xs break-all">{(brandColors as any).secondary}</div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm text-muted-foreground">Accent</div>
                        <div className="h-10 rounded-md border" style={{ backgroundColor: `hsl(${brandColors.accent})` }} />
                        <div className="text-xs break-all">{brandColors.accent}</div>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex flex-wrap gap-3">
                      <Button>Primary Button</Button>
                      <Button variant="secondary">Secondary</Button>
                      <Button variant="outline">Outline</Button>
                    </div>
                    <div className="p-4 rounded-md border bg-accent text-accent-foreground">
                      This is an accent surface
                    </div>
                    <div className="p-4 rounded-md border bg-secondary text-secondary-foreground">
                      This is a secondary surface
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Theme & Branding Controls - 40% width */}
              <Card className="lg:col-span-2 order-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5 text-primary" />
                    Theme & Branding
                  </CardTitle>
                  <CardDescription>
                    Select a theme and customize Primary, Secondary, and Accent colors
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Theme preset</Label>
                    <Select value={selectedTheme} onValueChange={handleThemeChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a theme" />
                      </SelectTrigger>
                      <SelectContent>
                        {THEME_PRESETS.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Primary color</Label>
                      <Select value={SHADCN_COLORS.find(c => c.hsl === brandColors.primary)?.id}
                        onValueChange={(id) => {
                          const c = SHADCN_COLORS.find(x => x.id === id);
                          if (c) setPrimaryColor(c.hsl);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose primary" />
                        </SelectTrigger>
                        <SelectContent>
                          {SHADCN_COLORS.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Secondary color</Label>
                      <Select value={SHADCN_COLORS.find(c => c.hsl === (brandColors as any).secondary)?.id}
                        onValueChange={(id) => {
                          const c = SHADCN_COLORS.find(x => x.id === id);
                          if (c) setSecondaryColor(c.hsl);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose secondary" />
                        </SelectTrigger>
                        <SelectContent>
                          {SHADCN_COLORS.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Accent color</Label>
                      <Select value={SHADCN_COLORS.find(c => c.hsl === brandColors.accent)?.id}
                        onValueChange={(id) => {
                          const c = SHADCN_COLORS.find(x => x.id === id);
                          if (c) setAccentColor(c.hsl);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose accent" />
                        </SelectTrigger>
                        <SelectContent>
                          {SHADCN_COLORS.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t">
                    <Button onClick={saveBrandingSettings} disabled={loading} className="flex items-center gap-2">
                      <Save className="h-4 w-4" />
                      {loading ? 'Saving...' : 'Save Theme Settings'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Manual Theme Controls removed */}
            </div>
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