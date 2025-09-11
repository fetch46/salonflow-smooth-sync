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
import { Building, CreditCard, Package, UserCheck, MapPin, Warehouse, Save } from "lucide-react";
import { toast } from "sonner";
import { useOrganization } from "@/lib/saas/hooks";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { Globe } from "lucide-react";
import { useSaas } from "@/lib/saas";
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
  const navigate = useNavigate();
  const { systemSettings } = useSaas();
  const appName = (systemSettings as any)?.app_name || 'AURA OS';
  
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

  // Redirect old deep links like /settings?tab=branding to the new page
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "branding") {
      navigate("/settings/branding", { replace: true });
    }
  }, [searchParams, navigate]);


  useEffect(() => {
    if (organization) {
      const settings = organization.settings as any || {};
      setCompanySettings({
        name: organization.name || '',
        country: settings.country || '',
        currency: settings.currency || ''
      });

      // Branding moved to dedicated page
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

  // Branding save and UI moved to dedicated page

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
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-5">
          <TabsTrigger value="company" className="justify-start gap-2 data-[state=active]:bg-muted">
            <Building className="h-4 w-4" />
            Company
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
        </TabsList>

        <div className="space-y-6">
          {/* Company Settings */}
          <TabsContent value="company">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Company Information</CardTitle>
                  <CardDescription>
                    Update your company details and basic settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="company-name">Company Name</Label>
                      <Input
                        id="company-name"
                        value={companySettings.name}
                        onChange={(e) => handleCompanySettingsChange("name", e.target.value)}
                        placeholder="Enter company name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <Select 
                        value={companySettings.country} 
                        onValueChange={(value) => handleCompanySettingsChange("country", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                        <SelectContent>
                          {countries.map((country) => (
                            <SelectItem key={country.id} value={country.code}>
                              {country.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="currency">Currency</Label>
                      <Select 
                        value={companySettings.currency} 
                        onValueChange={(value) => handleCompanySettingsChange("currency", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          {currencies.map((currency) => (
                            <SelectItem key={currency.id} value={currency.code}>
                              {currency.code} - {currency.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t">
                    <Button onClick={saveCompanySettings} disabled={loading}>
                      <Save className="h-4 w-4 mr-2" />
                      {loading ? 'Saving...' : 'Save Changes'}
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

          {/* Branding tab removed; branding is now a dedicated page at /settings/branding */}

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

          
        </div>
      </Tabs>
    </div>
  );
}