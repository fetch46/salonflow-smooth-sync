/**
 * Text formatting utilities for the application
 */

/**
 * Convert text to sentence case (First letter capitalized, rest lowercase)
 */
export function toSentenceCase(text: string): string {
  if (!text) return '';
  return text
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Format phone number with proper spacing and validation
 */
export function formatPhoneNumber(phone: string, countryCode?: string): string {
  if (!phone) return '';
  
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // If no country code and phone doesn't start with +, add default
  if (countryCode && !cleaned.startsWith('+')) {
    cleaned = countryCode + cleaned;
  }
  
  return cleaned;
}

/**
 * Validate phone number format
 */
export function isValidPhoneNumber(phone: string): boolean {
  if (!phone) return false;
  
  // Basic validation: must have at least 7 digits after cleaning
  const digits = phone.replace(/[^\d]/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

/**
 * Regional number formatting based on locale
 */
export function formatCurrency(
  amount: number, 
  currency: string = 'USD', 
  locale: string = 'en-US'
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (error) {
    // Fallback to basic formatting
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * Format date based on regional settings
 */
export function formatDate(
  date: Date | string, 
  locale: string = 'en-US',
  options?: Intl.DateTimeFormatOptions
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };
  
  try {
    return new Intl.DateTimeFormat(locale, options || defaultOptions).format(dateObj);
  } catch (error) {
    // Fallback to ISO string
    return dateObj.toLocaleDateString();
  }
}

/**
 * Format numbers with regional separators
 */
export function formatNumber(
  number: number, 
  locale: string = 'en-US',
  options?: Intl.NumberFormatOptions
): string {
  try {
    return new Intl.NumberFormat(locale, options).format(number);
  } catch (error) {
    return number.toString();
  }
}