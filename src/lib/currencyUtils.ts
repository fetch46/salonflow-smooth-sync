/**
 * Currency formatting utilities that follow regional settings
 */

interface CurrencyFormatOptions {
  currency?: string;
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  useGrouping?: boolean;
}

/**
 * Format currency with thousand separators and proper regional formatting
 */
export function formatCurrency(
  amount: number, 
  options: CurrencyFormatOptions = {}
): string {
  const {
    currency = 'USD',
    locale = 'en-US',
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    useGrouping = true
  } = options;

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits,
      maximumFractionDigits,
      useGrouping
    }).format(amount);
  } catch (error) {
    // Fallback formatting if Intl.NumberFormat fails
    const parts = amount.toFixed(maximumFractionDigits).split('.');
    const integerPart = useGrouping 
      ? parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      : parts[0];
    
    return `${currency} ${integerPart}${parts[1] ? `.${parts[1]}` : ''}`;
  }
}

/**
 * Format number with thousand separators
 */
export function formatNumber(
  number: number,
  options: Omit<CurrencyFormatOptions, 'currency'> = {}
): string {
  const {
    locale = 'en-US',
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
    useGrouping = true
  } = options;

  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits,
      maximumFractionDigits,
      useGrouping
    }).format(number);
  } catch (error) {
    // Fallback formatting
    const parts = number.toFixed(maximumFractionDigits).split('.');
    const integerPart = useGrouping 
      ? parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      : parts[0];
    
    return `${integerPart}${parts[1] ? `.${parts[1]}` : ''}`;
  }
}

/**
 * Get currency symbol for a given currency code
 */
export function getCurrencySymbol(currencyCode: string, locale: string = 'en-US'): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(0).replace(/[\d\s]/g, '');
  } catch (error) {
    return currencyCode;
  }
}