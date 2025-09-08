import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Globe, Save } from "lucide-react";
import { toast } from "sonner";
import { useOrganization } from "@/lib/saas/hooks";
import { supabase } from "@/integrations/supabase/client";

interface RegionalFormats {
  currency: string;
  currencySymbol: string;
  thousandSeparator: string;
  decimalSeparator: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
}

const CURRENCY_OPTIONS = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
  { code: 'UGX', symbol: 'UGX', name: 'Ugandan Shilling' },
  { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
];

const THOUSAND_SEPARATOR_OPTIONS = [
  { value: ',', label: 'Comma (1,000)', example: '1,000.00' },
  { value: '.', label: 'Period (1.000)', example: '1.000,00' },
  { value: ' ', label: 'Space (1 000)', example: '1 000.00' },
  { value: "'", label: "Apostrophe (1'000)", example: "1'000.00" },
];

const DECIMAL_SEPARATOR_OPTIONS = [
  { value: '.', label: 'Period (.)', example: '1,000.00' },
  { value: ',', label: 'Comma (,)', example: '1.000,00' },
];

const DATE_FORMAT_OPTIONS = [
  { value: 'MM/dd/yyyy', label: 'MM/DD/YYYY', example: '12/31/2024' },
  { value: 'dd/MM/yyyy', label: 'DD/MM/YYYY', example: '31/12/2024' },
  { value: 'yyyy-MM-dd', label: 'YYYY-MM-DD', example: '2024-12-31' },
  { value: 'dd.MM.yyyy', label: 'DD.MM.YYYY', example: '31.12.2024' },
  { value: 'dd-MM-yyyy', label: 'DD-MM-YYYY', example: '31-12-2024' },
];

export function RegionalSettings() {
  const { organization, updateOrganization } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [formats, setFormats] = useState<RegionalFormats>({
    currency: 'USD',
    currencySymbol: '$',
    thousandSeparator: ',',
    decimalSeparator: '.',
    dateFormat: 'MM/dd/yyyy',
    timeFormat: '12h',
  });

  useEffect(() => {
    if (organization?.settings) {
      const settings = organization.settings as any;
      if (settings.regional) {
        setFormats({
          currency: settings.regional.currency || 'USD',
          currencySymbol: settings.regional.currencySymbol || '$',
          thousandSeparator: settings.regional.thousandSeparator || ',',
          decimalSeparator: settings.regional.decimalSeparator || '.',
          dateFormat: settings.regional.dateFormat || 'MM/dd/yyyy',
          timeFormat: settings.regional.timeFormat || '12h',
        });
      }
    }
  }, [organization]);

  const handleCurrencyChange = (currencyCode: string) => {
    const currency = CURRENCY_OPTIONS.find(c => c.code === currencyCode);
    if (currency) {
      setFormats(prev => ({
        ...prev,
        currency: currency.code,
        currencySymbol: currency.symbol,
      }));
    }
  };

  const handleSave = async () => {
    if (!organization?.id) return;
    
    try {
      setLoading(true);

      // Update organization settings with regional formats
      const currentSettings = organization.settings as any || {};
      const updatedSettings = {
        ...currentSettings,
        regional: formats,
      };

      const { error } = await supabase
        .from('organizations')
        .update({ settings: updatedSettings })
        .eq('id', organization.id);

      if (error) throw error;

      // Update local state through the hook
      if (updateOrganization) {
        await updateOrganization(organization.id, {
          settings: updatedSettings,
        });
      }

      toast.success('Regional settings saved successfully');
    } catch (error) {
      console.error('Error saving regional settings:', error);
      toast.error('Failed to save regional settings');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    const parts = num.toFixed(2).split('.');
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, formats.thousandSeparator);
    return `${integerPart}${formats.decimalSeparator}${parts[1]}`;
  };

  const formatCurrencyExample = (amount: number) => {
    return `${formats.currencySymbol}${formatNumber(amount)}`;
  };

  const formatDateExample = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    
    return formats.dateFormat
      .replace('yyyy', year.toString())
      .replace('MM', month)
      .replace('dd', day);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          Regional Formats
        </CardTitle>
        <CardDescription>
          Configure currency, number, and date formats for your organization
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Currency Settings */}
          <div className="space-y-4">
            <div>
              <Label>Currency</Label>
              <Select 
                value={formats.currency} 
                onValueChange={handleCurrencyChange}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map(currency => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.symbol} {currency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Currency Symbol</Label>
              <Input 
                value={formats.currencySymbol}
                onChange={(e) => setFormats(prev => ({ ...prev, currencySymbol: e.target.value }))}
                placeholder="$"
                disabled={loading}
              />
            </div>

            <div className="p-3 bg-muted rounded-lg">
              <Label className="text-sm font-medium">Currency Preview</Label>
              <div className="text-lg font-semibold mt-1">
                {formatCurrencyExample(1234.56)}
              </div>
            </div>
          </div>

          {/* Number Format Settings */}
          <div className="space-y-4">
            <div>
              <Label>Thousand Separator</Label>
              <Select 
                value={formats.thousandSeparator} 
                onValueChange={(value) => setFormats(prev => ({ ...prev, thousandSeparator: value }))}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select separator" />
                </SelectTrigger>
                <SelectContent>
                  {THOUSAND_SEPARATOR_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label} - {option.example}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Decimal Separator</Label>
              <Select 
                value={formats.decimalSeparator} 
                onValueChange={(value) => setFormats(prev => ({ ...prev, decimalSeparator: value }))}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select separator" />
                </SelectTrigger>
                <SelectContent>
                  {DECIMAL_SEPARATOR_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label} - {option.example}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 bg-muted rounded-lg">
              <Label className="text-sm font-medium">Number Preview</Label>
              <div className="text-lg font-semibold mt-1">
                {formatNumber(1234567.89)}
              </div>
            </div>
          </div>

          {/* Date & Time Settings */}
          <div className="space-y-4">
            <div>
              <Label>Date Format</Label>
              <Select 
                value={formats.dateFormat} 
                onValueChange={(value) => setFormats(prev => ({ ...prev, dateFormat: value }))}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select date format" />
                </SelectTrigger>
                <SelectContent>
                  {DATE_FORMAT_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label} - {option.example}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Time Format</Label>
              <Select 
                value={formats.timeFormat} 
                onValueChange={(value: '12h' | '24h') => setFormats(prev => ({ ...prev, timeFormat: value }))}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select time format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12h">12 Hour (2:30 PM)</SelectItem>
                  <SelectItem value="24h">24 Hour (14:30)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 bg-muted rounded-lg">
              <Label className="text-sm font-medium">Date Preview</Label>
              <div className="text-lg font-semibold mt-1">
                {formatDateExample()}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSave} disabled={loading} className="flex items-center gap-2">
            <Save className="h-4 w-4" />
            {loading ? 'Saving...' : 'Save Regional Settings'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}