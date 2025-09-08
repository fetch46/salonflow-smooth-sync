import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building, Users, CreditCard, MessageSquare, MapPin, Plus, Edit2, Trash2, Crown, Shield, User, Package, Settings2, Palette } from "lucide-react";
import { Dialog as UIDialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { usePermissions } from "@/lib/saas/hooks";
import { toast } from "sonner";
import { useOrganization } from "@/lib/saas/hooks";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { Globe } from "lucide-react";
import { useSaas } from "@/lib/saas";
import { ModuleManagement } from "@/components/settings/ModuleManagement";

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "company");
  const { systemSettings } = useSaas();
  const appName = (systemSettings as any)?.app_name || 'AURA OS';
  
  // Branding state
  const [brandColors, setBrandColors] = useState({
    primary: "0 0% 9%",
    accent: "0 0% 96.1%",
    theme: "default" // default, branded
  });
  
  const [selectedPrimary, setSelectedPrimary] = useState('slate');
  const [selectedAccent, setSelectedAccent] = useState('gray');
  
  const SHADCN_COLORS = [
    { name: 'slate', hsl: 'hsl(210 40% 50%)' },
    { name: 'gray', hsl: 'hsl(220 8.9% 46.1%)' },
    { name: 'zinc', hsl: 'hsl(240 5.9% 10%)' },
    { name: 'neutral', hsl: 'hsl(0 0% 45%)' },
    { name: 'stone', hsl: 'hsl(25 5% 45%)' },
    { name: 'red', hsl: 'hsl(0 84.2% 60.2%)' },
    { name: 'orange', hsl: 'hsl(24.6 95% 53.1%)' },
    { name: 'amber', hsl: 'hsl(45.4 93.4% 47.5%)' },
    { name: 'yellow', hsl: 'hsl(54.5 91.7% 64.3%)' },
    { name: 'lime', hsl: 'hsl(82.2 84.5% 67.1%)' },
    { name: 'green', hsl: 'hsl(142.1 76.2% 36.3%)' },
    { name: 'emerald', hsl: 'hsl(161.1 93.5% 30.4%)' },
    { name: 'teal', hsl: 'hsl(175.7 82.7% 31.8%)' },
    { name: 'cyan', hsl: 'hsl(188.7 94.5% 42.7%)' },
    { name: 'sky', hsl: 'hsl(198.6 88.7% 48.4%)' },
    { name: 'blue', hsl: 'hsl(221.2 83.2% 53.3%)' },
    { name: 'indigo', hsl: 'hsl(243.4 75.4% 58.6%)' },
    { name: 'violet', hsl: 'hsl(258.3 89.5% 66.3%)' },
    { name: 'purple', hsl: 'hsl(272.1 81.3% 55.9%)' },
    { name: 'fuchsia', hsl: 'hsl(292.2 91.4% 72.9%)' },
    { name: 'pink', hsl: 'hsl(328.4 85.5% 70.2%)' },
    { name: 'rose', hsl: 'hsl(351.7 94.5% 71.4%)' }
  ];
  
  const handleColorChange = (type: 'primary' | 'accent', color: { name: string; hsl: string }) => {
    if (type === 'primary') {
      setSelectedPrimary(color.name);
      document.documentElement.style.setProperty('--primary', color.hsl.replace('hsl(', '').replace(')', ''));
    } else {
      setSelectedAccent(color.name);
      document.documentElement.style.setProperty('--accent', color.hsl.replace('hsl(', '').replace(')', ''));
    }
    
    // Save to localStorage
    localStorage.setItem(`brandColors_${type}`, color.name);
  };
  
  useEffect(() => {
    const savedPrimary = localStorage.getItem('brandColors_primary');
    const savedAccent = localStorage.getItem('brandColors_accent');
    
    if (savedPrimary) setSelectedPrimary(savedPrimary);
    if (savedAccent) setSelectedAccent(savedAccent);
  }, []);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your organization settings</p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value);
          setSearchParams(value ? { tab: value } : {});
          const y = window.scrollY;
          requestAnimationFrame(() => window.scrollTo({ top: y }));
        }}
        className="grid gap-6 md:grid-cols-[240px_1fr] items-start"
      >
        <TabsList className="flex h-auto w-full flex-col items-stretch gap-2 rounded-lg border bg-background p-2 sticky top-16 z-30">
          <TabsTrigger value="company" className="justify-start gap-2 data-[state=active]:bg-muted">
            <Building className="w-4 h-4" />
            Organization
          </TabsTrigger>
          <TabsTrigger value="branding" className="justify-start gap-2 data-[state=active]:bg-muted">
            <Palette className="w-4 h-4" />
            Branding
          </TabsTrigger>
          <TabsTrigger value="modules" className="justify-start gap-2 data-[state=active]:bg-muted">
            <Settings2 className="w-4 h-4" />
            Modules
          </TabsTrigger>
        </TabsList>

        <div className="space-y-6 min-h-[50vh]">
          {/* Organization Settings */}
          <TabsContent value="company">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5 text-pink-600" />
                  Organization Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p>Organization settings would go here...</p>
              </CardContent>
            </Card>
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
                  Customize the visual appearance of your application
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Color Theme</Label>
                    <Select 
                      value={brandColors.theme} 
                      onValueChange={(value) => setBrandColors(prev => ({ ...prev, theme: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select theme" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default Black & White</SelectItem>
                        <SelectItem value="branded">Custom Branded Colors</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {brandColors.theme === "branded" && (
                    <div className="space-y-4 border rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Primary Color</Label>
                          <div className="grid grid-cols-3 gap-2">
                            {SHADCN_COLORS.map(color => (
                              <Button
                                key={color.name}
                                variant={selectedPrimary === color.name ? "default" : "outline"}
                                className="h-16 p-2 flex flex-col items-center gap-1"
                                style={{ backgroundColor: selectedPrimary === color.name ? color.hsl : undefined }}
                                onClick={() => handleColorChange('primary', color)}
                              >
                                <div 
                                  className="w-6 h-6 rounded-full border border-border" 
                                  style={{ backgroundColor: color.hsl }}
                                />
                                <span className="text-xs">{color.name}</span>
                              </Button>
                            ))}
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Accent Color</Label>
                          <div className="grid grid-cols-3 gap-2">
                            {SHADCN_COLORS.map(color => (
                              <Button
                                key={color.name}
                                variant={selectedAccent === color.name ? "default" : "outline"}
                                className="h-16 p-2 flex flex-col items-center gap-1"
                                style={{ backgroundColor: selectedAccent === color.name ? color.hsl : undefined }}
                                onClick={() => handleColorChange('accent', color)}
                              >
                                <div 
                                  className="w-6 h-6 rounded-full border border-border" 
                                  style={{ backgroundColor: color.hsl }}
                                />
                                <span className="text-xs">{color.name}</span>
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      <div className="pt-4 border-t">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">Preview</h4>
                            <p className="text-sm text-muted-foreground">See how your colors look</p>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm">Primary Button</Button>
                            <Button variant="secondary" size="sm">Secondary</Button>
                            <Button variant="outline" size="sm">Outline</Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Modules Tab */}
          <TabsContent value="modules">
            <ModuleManagement />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}