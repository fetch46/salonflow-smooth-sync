import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Palette, Building, Save, LayoutGrid } from "lucide-react";
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
          <Card className="lg:col-span-4 shadow-lg border-2 hover:shadow-xl transition-shadow animate-fade-in">
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
                <div className="grid grid-cols-2 gap-3">
                  {THEME_PRESETS.map((theme) => (
                    <Button
                      key={theme.id}
                      variant={selectedTheme === theme.id ? "default" : "outline"}
                      className={`flex flex-col items-center gap-2 h-auto p-3 transition-all duration-200 hover-scale ${
                        selectedTheme === theme.id ? 'ring-2 ring-primary ring-offset-2' : ''
                      }`}
                      onClick={() => handleThemeChange(theme.id)}
                    >
                      <div className="w-8 h-8 rounded-full border-2 border-border shadow-sm" style={{ backgroundColor: theme.colors.preview }} />
                      <span className="text-xs font-medium">{theme.name}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-4 shadow-lg border-2 hover:shadow-xl transition-shadow animate-fade-in">
            <CardHeader className="bg-gradient-to-r from-accent/5 to-accent/10 border-b">
              <CardTitle className="flex items-center gap-2">
                <LayoutGrid className="h-5 w-5 text-primary" />
                Custom Colors
              </CardTitle>
              <CardDescription>
                Fine-tune individual color elements
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    Primary Color
                    <div className="w-4 h-4 rounded border shadow-sm" style={{ backgroundColor: `hsl(${brandColors.primary})` }} />
                  </Label>
                  <Select value={SHADCN_COLORS.find(c => c.hsl === brandColors.primary)?.id} onValueChange={(id) => {
                    const c = SHADCN_COLORS.find(x => x.id === id);
                    if (c) setPrimaryColor(c.hsl);
                  }}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Choose primary color" />
                    </SelectTrigger>
                    <SelectContent>
                      {SHADCN_COLORS.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="flex items-center gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded border" style={{ backgroundColor: `hsl(${c.hsl})` }} />
                            {c.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    Secondary Color
                    <div className="w-4 h-4 rounded border shadow-sm" style={{ backgroundColor: `hsl(${(brandColors as any).secondary})` }} />
                  </Label>
                  <Select value={SHADCN_COLORS.find(c => c.hsl === (brandColors as any).secondary)?.id} onValueChange={(id) => {
                    const c = SHADCN_COLORS.find(x => x.id === id);
                    if (c) setSecondaryColor(c.hsl);
                  }}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Choose secondary color" />
                    </SelectTrigger>
                    <SelectContent>
                      {SHADCN_COLORS.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded border" style={{ backgroundColor: `hsl(${c.hsl})` }} />
                            {c.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    Accent Color
                    <div className="w-4 h-4 rounded border shadow-sm" style={{ backgroundColor: `hsl(${brandColors.accent})` }} />
                  </Label>
                  <Select value={SHADCN_COLORS.find(c => c.hsl === brandColors.accent)?.id} onValueChange={(id) => {
                    const c = SHADCN_COLORS.find(x => x.id === id);
                    if (c) setAccentColor(c.hsl);
                  }}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Choose accent color" />
                    </SelectTrigger>
                    <SelectContent>
                      {SHADCN_COLORS.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded border" style={{ backgroundColor: `hsl(${c.hsl})` }} />
                            {c.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-4 shadow-lg border-2 hover:shadow-xl transition-shadow animate-fade-in">
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

