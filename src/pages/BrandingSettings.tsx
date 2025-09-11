import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Palette, Building, Save } from "lucide-react";
import { toast } from "sonner";
import { useOrganization } from "@/lib/saas/hooks";

export default function BrandingSettings() {
  const { organization, updateOrganization } = useOrganization();

  const [loading, setLoading] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState("default");
  const [brandColors, setBrandColors] = useState({
    primary: "0 0% 9%",
    secondary: "0 0% 96.1%",
    accent: "0 0% 96.1%",
    theme: "default",
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
    { name: "Default", id: "default", description: "Clean black and white theme", colors: { primary: "0 0% 9%", secondary: "0 0% 96.1%", accent: "0 0% 96.1%", preview: "hsl(0 0% 9%)" } },
    { name: "Red", id: "red", description: "Bold red accent theme", colors: { primary: "0 72% 51%", secondary: "0 0% 96.1%", accent: "0 0% 96.1%", preview: "hsl(0 72% 51%)" } },
    { name: "Rose", id: "rose", description: "Elegant rose theme", colors: { primary: "346 77% 50%", secondary: "0 0% 96.1%", accent: "0 0% 96.1%", preview: "hsl(346 77% 50%)" } },
    { name: "Orange", id: "orange", description: "Vibrant orange theme", colors: { primary: "25 95% 53%", secondary: "0 0% 96.1%", accent: "0 0% 96.1%", preview: "hsl(25 95% 53%)" } },
    { name: "Green", id: "green", description: "Nature green theme", colors: { primary: "142 76% 36%", secondary: "0 0% 96.1%", accent: "0 0% 96.1%", preview: "hsl(142 76% 36%)" } },
    { name: "Blue", id: "blue", description: "Professional blue theme", colors: { primary: "221 83% 53%", secondary: "0 0% 96.1%", accent: "0 0% 96.1%", preview: "hsl(221 83% 53%)" } },
    { name: "Yellow", id: "yellow", description: "Bright yellow theme", colors: { primary: "48 96% 53%", secondary: "0 0% 96.1%", accent: "0 0% 96.1%", preview: "hsl(48 96% 53%)" } },
    { name: "Violet", id: "violet", description: "Creative violet theme", colors: { primary: "262 83% 58%", secondary: "0 0% 96.1%", accent: "0 0% 96.1%", preview: "hsl(262 83% 58%)" } },
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
    <div className="container mx-auto py-8 space-y-8 bg-pattern-dots min-h-screen">
      <div className="card-premium p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg">
              <Palette className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Branding & Themes</h1>
              <p className="text-muted-foreground text-lg mt-1">Customize your application's visual identity and color scheme</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 space-y-6">
            <div className="card-premium p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 text-primary">
                  <Palette className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Quick Themes</h2>
                  <p className="text-muted-foreground text-sm">Choose from professionally designed color schemes</p>
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-sm font-semibold text-foreground">Select Theme Preset</Label>
                <Select value={selectedTheme} onValueChange={(v) => handleThemeChange(v)}>
                  <SelectTrigger className="h-12 rounded-xl border-2 hover:border-primary/30 transition-colors">
                    <SelectValue placeholder="Choose a theme" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {THEME_PRESETS.map((theme) => (
                      <SelectItem key={theme.id} value={theme.id} className="rounded-lg my-1">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-5 h-5 rounded-full border-2 border-white shadow-sm" 
                            style={{ backgroundColor: theme.colors.preview }} 
                          />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{theme.name}</span>
                            <span className="text-xs text-muted-foreground">{theme.description}</span>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
                  {THEME_PRESETS.slice(0, 8).map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => handleThemeChange(theme.id)}
                      className={`
                        relative p-4 rounded-xl border-2 transition-all duration-300 group
                        ${selectedTheme === theme.id 
                          ? 'border-current shadow-lg scale-105' 
                          : 'border-border hover:border-current hover:scale-105'
                        }
                      `}
                      style={{
                        backgroundColor: theme.colors.preview,
                        color: theme.id === 'default' ? '#ffffff' : '#ffffff'
                      }}
                    >
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/10 to-transparent" />
                      <div className="relative text-center">
                        <div className="text-sm font-medium">{theme.name}</div>
                        {selectedTheme === theme.id && (
                          <div className="absolute -top-2 -right-2 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-md">
                            <div className="w-2 h-2 bg-green-500 rounded-full" />
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 text-primary">
                  <Building className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Live Preview</h2>
                  <p className="text-muted-foreground text-sm">See your theme in action</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center space-y-2">
                    <div 
                      className="h-16 w-full rounded-xl border shadow-md transition-all hover:scale-105" 
                      style={{ backgroundColor: `hsl(${brandColors.primary})` }} 
                    />
                    <span className="text-xs font-medium text-muted-foreground">Primary</span>
                  </div>
                  <div className="text-center space-y-2">
                    <div 
                      className="h-16 w-full rounded-xl border shadow-md transition-all hover:scale-105" 
                      style={{ backgroundColor: `hsl(${(brandColors as any).secondary})` }} 
                    />
                    <span className="text-xs font-medium text-muted-foreground">Secondary</span>
                  </div>
                  <div className="text-center space-y-2">
                    <div 
                      className="h-16 w-full rounded-xl border shadow-md transition-all hover:scale-105" 
                      style={{ backgroundColor: `hsl(${brandColors.accent})` }} 
                    />
                    <span className="text-xs font-medium text-muted-foreground">Accent</span>
                  </div>
                </div>

                <div className="space-y-4 p-4 rounded-xl bg-background/50 border backdrop-blur-sm">
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" className="btn-premium">Primary</Button>
                    <Button variant="secondary" size="sm" className="rounded-lg">Secondary</Button>
                    <Button variant="outline" size="sm" className="btn-outline-modern">Outline</Button>
                  </div>
                  <div className="p-3 rounded-xl bg-accent text-accent-foreground text-sm font-medium">
                    Accent surface example with modern styling
                  </div>
                  <div className="p-3 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium">
                    Secondary surface with enhanced design
                  </div>
                </div>

                <div className="glass-card p-3 text-xs text-muted-foreground space-y-1">
                  <div className="font-semibold text-foreground mb-2">Current HSL Values:</div>
                  <div>Primary: {brandColors.primary}</div>
                  <div>Secondary: {(brandColors as any).secondary}</div>
                  <div>Accent: {brandColors.accent}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center pt-6">
          <Button 
            onClick={saveBrandingSettings} 
            disabled={loading} 
            className="btn-premium px-12 py-4 text-lg shadow-xl"
          >
            <Save className="h-5 w-5 mr-2" />
            {loading ? 'Saving Theme...' : 'Save Brand Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}

