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
  const [selectedTheme, setSelectedTheme] = useState("blue");
  const [brandColors, setBrandColors] = useState({
    primary: "221 83% 53%",
    secondary: "217 19% 94%",
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
      name: "Blue", 
      id: "blue", 
      description: "Professional blue theme", 
      colors: { 
        primary: "221 83% 53%", 
        secondary: "217 19% 94%", 
        accent: "210 40% 96.1%", 
        preview: "hsl(221 83% 53%)" 
      } 
    },
    { 
      name: "Indigo", 
      id: "indigo", 
      description: "Deep indigo theme", 
      colors: { 
        primary: "234 89% 62%", 
        secondary: "226 22% 94%", 
        accent: "226 36% 95%", 
        preview: "hsl(234 89% 62%)" 
      } 
    },
    { 
      name: "Green", 
      id: "green", 
      description: "Fresh nature theme", 
      colors: { 
        primary: "142 76% 36%", 
        secondary: "138 16% 94%", 
        accent: "141 32% 95%", 
        preview: "hsl(142 76% 36%)" 
      } 
    },
    { 
      name: "Teal", 
      id: "teal", 
      description: "Modern teal theme", 
      colors: { 
        primary: "172 66% 50%", 
        secondary: "174 20% 94%", 
        accent: "173 36% 95%", 
        preview: "hsl(172 66% 50%)" 
      } 
    },
    { 
      name: "Purple", 
      id: "purple", 
      description: "Royal purple theme", 
      colors: { 
        primary: "262 83% 58%", 
        secondary: "261 20% 94%", 
        accent: "261 36% 95%", 
        preview: "hsl(262 83% 58%)" 
      } 
    },
    { 
      name: "Pink", 
      id: "pink", 
      description: "Playful pink theme", 
      colors: { 
        primary: "322 93% 64%", 
        secondary: "324 20% 94%", 
        accent: "323 36% 95%", 
        preview: "hsl(322 93% 64%)" 
      } 
    },
    { 
      name: "Orange", 
      id: "orange", 
      description: "Energetic orange theme", 
      colors: { 
        primary: "25 95% 53%", 
        secondary: "24 20% 94%", 
        accent: "24 36% 95%", 
        preview: "hsl(25 95% 53%)" 
      } 
    },
    { 
      name: "Red", 
      id: "red", 
      description: "Bold red theme", 
      colors: { 
        primary: "0 72% 51%", 
        secondary: "0 20% 94%", 
        accent: "0 36% 95%", 
        preview: "hsl(0 72% 51%)" 
      } 
    },
    { 
      name: "Amber", 
      id: "amber", 
      description: "Warm amber theme", 
      colors: { 
        primary: "38 92% 50%", 
        secondary: "37 20% 94%", 
        accent: "37 36% 95%", 
        preview: "hsl(38 92% 50%)" 
      } 
    },
    { 
      name: "Emerald", 
      id: "emerald", 
      description: "Luxurious emerald theme", 
      colors: { 
        primary: "160 84% 39%", 
        secondary: "158 16% 94%", 
        accent: "159 32% 95%", 
        preview: "hsl(160 84% 39%)" 
      } 
    },
    { 
      name: "Slate", 
      id: "slate", 
      description: "Professional slate theme", 
      colors: { 
        primary: "215 19% 35%", 
        secondary: "215 19% 94%", 
        accent: "215 25% 95%", 
        preview: "hsl(215 19% 35%)" 
      } 
    },
    { 
      name: "Zinc", 
      id: "zinc", 
      description: "Neutral zinc theme", 
      colors: { 
        primary: "240 6% 26%", 
        secondary: "240 6% 94%", 
        accent: "240 6% 95%", 
        preview: "hsl(240 6% 26%)" 
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
    // compute lighter tone for disabled/hover in light theme
    try {
      const [h, s, l] = colors.primary.split(' ');
      const lightVal = Math.min(parseInt((l || '0').replace('%','')) + 12, 92);
      root.style.setProperty('--theme-primary-light', `${h} ${s} ${lightVal}%`);
    } catch {}
    root.style.setProperty('--secondary', colors.secondary);
    root.style.setProperty('--secondary-foreground', computeForeground(colors.secondary));
    root.style.setProperty('--accent', colors.accent);
    root.style.setProperty('--accent-foreground', computeForeground(colors.accent));

    localStorage.setItem('theme-primary', colors.primary);
    localStorage.setItem('theme-primary-foreground', computeForeground(colors.primary));
    try {
      const [h, s, l] = colors.primary.split(' ');
      const lightVal = Math.min(parseInt((l || '0').replace('%','')) + 12, 92);
      localStorage.setItem('theme-primary-light', `${h} ${s} ${lightVal}%`);
    } catch {}
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

      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Card className="lg:col-span-7 shadow-lg border-2 hover:shadow-xl transition-shadow animate-fade-in">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                Quick Themes
              </CardTitle>
              <CardDescription>
                Choose from pre-designed color schemes
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <Label className="text-sm font-semibold">Select Theme Preset</Label>
                <Select value={selectedTheme} onValueChange={(v) => handleThemeChange(v)}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Choose a theme" />
                  </SelectTrigger>
                  <SelectContent>
                    {THEME_PRESETS.map((theme) => (
                      <SelectItem key={theme.id} value={theme.id} className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: theme.colors.preview }} />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{theme.name}</span>
                            <span className="text-[10px] text-muted-foreground">{theme.description}</span>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-5 shadow-lg border-2 hover:shadow-xl transition-shadow animate-fade-in">
            <CardHeader className="bg-gradient-to-r from-secondary/5 to-secondary/10 border-b">
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5 text-primary" />
                Live Preview
              </CardTitle>
              <CardDescription>
                See how your colors look in action
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center space-y-2">
                  <div className="h-12 w-full rounded-lg border-2 shadow-sm transition-all hover-scale" style={{ backgroundColor: `hsl(${brandColors.primary})` }} />
                  <span className="text-xs font-medium text-muted-foreground">Primary</span>
                </div>
                <div className="text-center space-y-2">
                  <div className="h-12 w-full rounded-lg border-2 shadow-sm transition-all hover-scale" style={{ backgroundColor: `hsl(${(brandColors as any).secondary})` }} />
                  <span className="text-xs font-medium text-muted-foreground">Secondary</span>
                </div>
                <div className="text-center space-y-2">
                  <div className="h-12 w-full rounded-lg border-2 shadow-sm transition-all hover-scale" style={{ backgroundColor: `hsl(${brandColors.accent})` }} />
                  <span className="text-xs font-medium text-muted-foreground">Accent</span>
                </div>
              </div>

              <div className="space-y-4 p-4 rounded-lg bg-background border">
                <div className="flex flex-wrap gap-2">
                  <Button size="sm">Primary Button</Button>
                  <Button variant="secondary" size="sm">Secondary</Button>
                  <Button variant="outline" size="sm">Outline</Button>
                </div>
                <div className="p-3 rounded-md bg-accent text-accent-foreground text-sm">Accent surface example</div>
                <div className="p-3 rounded-md bg-secondary text-secondary-foreground text-sm">Secondary surface example</div>
                <div className="text-xs text-muted-foreground">
                  HSL Values:<br />
                  Primary: {brandColors.primary}<br />
                  Secondary: {(brandColors as any).secondary}<br />
                  Accent: {brandColors.accent}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

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

