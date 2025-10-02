import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Palette, Building, Save } from "lucide-react";
import { toast } from "sonner";
import { useOrganization } from "@/lib/saas/hooks";

export default function BrandingSettings() {
  const { organization, updateOrganization } = useOrganization();

  const [loading, setLoading] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState("blue");
  const [brandColors, setBrandColors] = useState({
    primary: "221.2 83.2% 53.3%",
    secondary: "210 40% 96.1%",
    accent: "210 40% 96.1%",
    theme: "blue",
  });
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

  const THEME_PRESETS = [
    { 
      name: "Zinc", 
      id: "zinc",
      description: "Neutral and refined", 
      colors: { 
        primary: "240 5.9% 10%", 
        secondary: "240 4.8% 95.9%", 
        accent: "240 4.8% 95.9%", 
        preview: "hsl(240 5.9% 10%)" 
      } 
    },
    { 
      name: "Slate", 
      id: "slate",
      description: "Professional and modern", 
      colors: { 
        primary: "215.4 16.3% 46.9%", 
        secondary: "214.3 31.8% 91.4%", 
        accent: "210 40% 96.1%", 
        preview: "hsl(215.4 16.3% 46.9%)" 
      } 
    },
    { 
      name: "Blue", 
      id: "blue",
      description: "Calm and trustworthy", 
      colors: { 
        primary: "221.2 83.2% 53.3%", 
        secondary: "210 40% 96.1%", 
        accent: "210 40% 96.1%", 
        preview: "hsl(221.2 83.2% 53.3%)" 
      } 
    },
    { 
      name: "Green", 
      id: "green",
      description: "Natural and fresh", 
      colors: { 
        primary: "142.1 76.2% 36.3%", 
        secondary: "138 76% 96.9%", 
        accent: "138 76% 96.9%", 
        preview: "hsl(142.1 76.2% 36.3%)" 
      } 
    },
    { 
      name: "Orange", 
      id: "orange",
      description: "Energetic and bold", 
      colors: { 
        primary: "24.6 95% 53.1%", 
        secondary: "24 100% 96.5%", 
        accent: "24 100% 96.5%", 
        preview: "hsl(24.6 95% 53.1%)" 
      } 
    },
    { 
      name: "Red", 
      id: "red",
      description: "Passionate and strong", 
      colors: { 
        primary: "0 72.2% 50.6%", 
        secondary: "0 85% 97.3%", 
        accent: "0 85% 97.3%", 
        preview: "hsl(0 72.2% 50.6%)" 
      } 
    },
    { 
      name: "Rose", 
      id: "rose",
      description: "Elegant and warm", 
      colors: { 
        primary: "346.8 77.2% 49.8%", 
        secondary: "355 100% 97.3%", 
        accent: "355 100% 97.3%", 
        preview: "hsl(346.8 77.2% 49.8%)" 
      } 
    },
    { 
      name: "Violet", 
      id: "violet",
      description: "Creative and vibrant", 
      colors: { 
        primary: "262.1 83.3% 57.8%", 
        secondary: "270 100% 98%", 
        accent: "270 100% 98%", 
        preview: "hsl(262.1 83.3% 57.8%)" 
      } 
    },
    { 
      name: "Yellow", 
      id: "yellow",
      description: "Bright and optimistic", 
      colors: { 
        primary: "47.9 95.8% 53.1%", 
        secondary: "54 91.7% 95.3%", 
        accent: "54 91.7% 95.3%", 
        preview: "hsl(47.9 95.8% 53.1%)" 
      } 
    }
  ];

  

  useEffect(() => {
    const keys = [
      'sidebarBg','sidebarText','topbarBg','topbarText','footerBg','footerText','navLinkColor','tabsBg','tabsText','tabsActiveBg','tabsActiveText'
    ] as const;
    const loaded: any = {};
    let hasAny = false;
    keys.forEach((k) => {
      const v = localStorage.getItem(`manual-${k}`);
      if (v) {
        loaded[k] = v;
        hasAny = true;
      }
    });
    if (hasAny) {
      setManualTheme((prev) => ({ ...prev, ...loaded }));
      applyManualTheme(loaded);
    }
  }, []);

  useEffect(() => {
    if (!organization) return;
    const settings = (organization.settings as any) || {};
    if (settings.branding) {
      const branding = settings.branding as any;
      if (branding.theme) setSelectedTheme(branding.theme);
      if (branding.colors) {
        setBrandColors((prev) => ({
          ...prev,
          primary: branding.colors.primary || prev.primary,
          secondary: branding.colors.secondary || prev.secondary,
          accent: branding.colors.accent || prev.accent,
        }));
        applyTheme({
          primary: branding.colors.primary || brandColors.primary,
          secondary: branding.colors.secondary || brandColors.secondary,
          accent: branding.colors.accent || brandColors.accent,
        });
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
        });
        applyManualTheme(branding.manual);
      }
    }
  }, [organization]);

  const applyTheme = (colors: { primary: string; secondary: string; accent: string }) => {
    const root = document.documentElement;
    root.style.setProperty('--theme-primary', colors.primary);
    root.style.setProperty('--theme-primary-foreground', computeForeground(colors.primary));
    root.style.setProperty('--secondary', colors.secondary);
    root.style.setProperty('--secondary-foreground', computeForeground(colors.secondary));
    root.style.setProperty('--accent', colors.accent);
    root.style.setProperty('--accent-foreground', computeForeground(colors.accent));

    localStorage.setItem('theme-primary', colors.primary);
    localStorage.setItem('theme-primary-foreground', computeForeground(colors.primary));
    localStorage.setItem('theme-secondary', colors.secondary);
    localStorage.setItem('theme-secondary-foreground', computeForeground(colors.secondary));
    localStorage.setItem('theme-accent', colors.accent);
    localStorage.setItem('theme-accent-foreground', computeForeground(colors.accent));
  };

  const computeForeground = (hsl: string) => {
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

  const handleThemeChange = (themeId: string) => {
    setSelectedTheme(themeId);
    const theme = THEME_PRESETS.find(t => t.id === themeId);
    if (theme) {
      setBrandColors((prev) => ({
        ...prev,
        primary: theme.colors.primary,
        secondary: theme.colors.secondary,
        accent: theme.colors.accent,
        theme: themeId,
      }));
      applyTheme(theme.colors as any);
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
          <h1 className="text-3xl font-bold tracking-tight">Branding</h1>
          <p className="text-muted-foreground">Customize your application's visual identity</p>
        </div>
      </div>

      <div className="space-y-8">
        {/* Theme Gallery */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              Theme Gallery
            </CardTitle>
            <CardDescription>
              Choose from our curated collection of professional themes
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {THEME_PRESETS.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => handleThemeChange(theme.id)}
                  className={`group relative p-4 rounded-xl border-2 transition-all text-left ${
                    selectedTheme === theme.id
                      ? 'border-primary bg-primary/5 shadow-md'
                      : 'border-border hover:border-primary/50 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div 
                      className="w-12 h-12 rounded-lg shrink-0 shadow-sm border"
                      style={{ backgroundColor: theme.colors.preview }}
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm mb-1">{theme.name}</h3>
                      <p className="text-xs text-muted-foreground">{theme.description}</p>
                    </div>
                  </div>
                  {selectedTheme === theme.id && (
                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Preview Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-primary" />
              Live Preview
            </CardTitle>
            <CardDescription>
              See how your selected theme looks across different components
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* Color Swatches */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <div 
                  className="h-20 w-full rounded-lg shadow-sm border-2" 
                  style={{ backgroundColor: `hsl(${brandColors.primary})` }} 
                />
                <div className="text-xs">
                  <p className="font-medium">Primary</p>
                  <p className="text-muted-foreground">{brandColors.primary}</p>
                </div>
              </div>
              <div className="space-y-2">
                <div 
                  className="h-20 w-full rounded-lg shadow-sm border-2" 
                  style={{ backgroundColor: `hsl(${(brandColors as any).secondary})` }} 
                />
                <div className="text-xs">
                  <p className="font-medium">Secondary</p>
                  <p className="text-muted-foreground">{(brandColors as any).secondary}</p>
                </div>
              </div>
              <div className="space-y-2">
                <div 
                  className="h-20 w-full rounded-lg shadow-sm border-2" 
                  style={{ backgroundColor: `hsl(${brandColors.accent})` }} 
                />
                <div className="text-xs">
                  <p className="font-medium">Accent</p>
                  <p className="text-muted-foreground">{brandColors.accent}</p>
                </div>
              </div>
            </div>

            {/* Component Previews */}
            <div className="space-y-4 p-6 rounded-lg border bg-muted/30">
              <div className="flex flex-wrap gap-3">
                <Button>Primary Button</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="destructive">Destructive</Button>
              </div>
              <div className="p-4 rounded-md bg-accent text-accent-foreground">
                <p className="text-sm font-medium">Accent Surface</p>
                <p className="text-xs mt-1 opacity-90">This is how accent surfaces appear with your theme</p>
              </div>
              <div className="p-4 rounded-md bg-secondary text-secondary-foreground">
                <p className="text-sm font-medium">Secondary Surface</p>
                <p className="text-xs mt-1 opacity-90">This is how secondary surfaces appear with your theme</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center pt-2">
          <Button onClick={saveBrandingSettings} disabled={loading} className="flex items-center gap-2 px-8 py-3 text-lg hover-scale shadow-lg" size="lg">
            <Save className="h-5 w-5" />
            {loading ? 'Saving Theme...' : 'Save Brand Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}

