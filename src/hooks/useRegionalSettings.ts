import { useState, useEffect } from 'react';
import { useOrganization } from '@/lib/saas/hooks';

interface RegionalSettings {
  locale: string;
  currency: string;
  dateFormat: string;
  numberFormat: string;
  timeFormat: '12h' | '24h';
  weekStart: 'sunday' | 'monday';
  countryCode: string;
}

const defaultSettings: RegionalSettings = {
  locale: 'en-US',
  currency: 'USD',
  dateFormat: 'MM/dd/yyyy',
  numberFormat: 'en-US',
  timeFormat: '12h',
  weekStart: 'sunday',
  countryCode: 'US',
};

// Regional presets for common countries/regions
const regionalPresets: Record<string, Partial<RegionalSettings>> = {
  'US': { locale: 'en-US', currency: 'USD', dateFormat: 'MM/dd/yyyy', countryCode: 'US' },
  'GB': { locale: 'en-GB', currency: 'GBP', dateFormat: 'dd/MM/yyyy', countryCode: 'GB' },
  'KE': { locale: 'en-KE', currency: 'KES', dateFormat: 'dd/MM/yyyy', countryCode: 'KE' },
  'UG': { locale: 'en-UG', currency: 'UGX', dateFormat: 'dd/MM/yyyy', countryCode: 'UG' },
  'TZ': { locale: 'sw-TZ', currency: 'TZS', dateFormat: 'dd/MM/yyyy', countryCode: 'TZ' },
  'ZA': { locale: 'en-ZA', currency: 'ZAR', dateFormat: 'yyyy/MM/dd', countryCode: 'ZA' },
  'IN': { locale: 'en-IN', currency: 'INR', dateFormat: 'dd/MM/yyyy', countryCode: 'IN' },
  'AU': { locale: 'en-AU', currency: 'AUD', dateFormat: 'dd/MM/yyyy', countryCode: 'AU' },
  'CA': { locale: 'en-CA', currency: 'CAD', dateFormat: 'yyyy-MM-dd', countryCode: 'CA' },
};

export function useRegionalSettings() {
  const { organization } = useOrganization();
  const [settings, setSettings] = useState<RegionalSettings>(defaultSettings);

  useEffect(() => {
    // Try to determine regional settings from organization
    if (organization?.settings) {
      const orgSettings = organization.settings as any;
      let detectedSettings = { ...defaultSettings };

      // Check for country information in organization settings
      const country = orgSettings.country || 
                     orgSettings.address?.country || 
                     orgSettings.business_country;

      if (country && regionalPresets[country.toUpperCase()]) {
        detectedSettings = {
          ...detectedSettings,
          ...regionalPresets[country.toUpperCase()],
        };
      }

      // Check for explicit regional settings
      if (orgSettings.regional) {
        detectedSettings = {
          ...detectedSettings,
          ...orgSettings.regional,
        };
      }

      setSettings(detectedSettings);
    } else {
      // Fallback: detect from browser locale
      const browserLocale = navigator.language || 'en-US';
      const countryCode = browserLocale.split('-')[1]?.toUpperCase();
      
      if (countryCode && regionalPresets[countryCode]) {
        setSettings({
          ...defaultSettings,
          ...regionalPresets[countryCode],
          locale: browserLocale,
        });
      }
    }
  }, [organization]);

  // Helper functions for formatting
  const formatCurrency = (amount: number) => {
    try {
      return new Intl.NumberFormat(settings.locale, {
        style: 'currency',
        currency: settings.currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch (error) {
      return `${settings.currency} ${amount.toFixed(2)}`;
    }
  };

  const formatDate = (date: Date | string, options?: Intl.DateTimeFormatOptions) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    try {
      return new Intl.DateTimeFormat(settings.locale, options).format(dateObj);
    } catch (error) {
      return dateObj.toLocaleDateString();
    }
  };

  const formatNumber = (number: number, options?: Intl.NumberFormatOptions) => {
    try {
      return new Intl.NumberFormat(settings.locale, options).format(number);
    } catch (error) {
      return number.toString();
    }
  };

  const formatTime = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const is24h = settings.timeFormat === '24h';
    
    try {
      return new Intl.DateTimeFormat(settings.locale, {
        hour: 'numeric',
        minute: '2-digit',
        hour12: !is24h,
      }).format(dateObj);
    } catch (error) {
      return dateObj.toLocaleTimeString();
    }
  };

  return {
    settings,
    setSettings,
    formatCurrency,
    formatDate,
    formatNumber,
    formatTime,
    regionalPresets,
  };
}