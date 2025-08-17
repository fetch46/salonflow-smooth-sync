
import { supabase } from '@/integrations/supabase/client';

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
}

// Utility function to handle fetch operations with proper error handling
export async function safeFetch<T>(
  fetchFn: () => Promise<{ data: T | null; error: any }>
): Promise<ApiResponse<T>> {
  try {
    const { data, error } = await fetchFn();
    
    if (error) {
      console.warn('Fetch operation failed:', error);
      return { error: error.message || 'Operation failed' };
    }
    
    return { data: data || undefined };
  } catch (networkError) {
    console.warn('Network error during fetch:', networkError);
    return { error: 'Network error occurred' };
  }
}

// Utility to check if we have a valid Supabase connection
export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.auth.getSession();
    return !error || error.message === 'Invalid JWT'; // JWT error is expected when not authenticated
  } catch {
    return false;
  }
}

// Retry mechanism for failed requests
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms:`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
  
  throw lastError!;
}

// Role and permission utilities
export function hasMinimumRole(userRole: string, requiredRole: string): boolean {
  const roleHierarchy = ['member', 'admin', 'owner', 'super_admin'];
  const userRoleIndex = roleHierarchy.indexOf(userRole);
  const requiredRoleIndex = roleHierarchy.indexOf(requiredRole);
  return userRoleIndex >= requiredRoleIndex;
}

export function canPerformAction(userRole: string, action: string): boolean {
  // Placeholder implementation
  return userRole === 'owner' || userRole === 'super_admin';
}

export function getRolePermissions(role: string): string[] {
  // Placeholder implementation
  const permissions: Record<string, string[]> = {
    member: ['read'],
    admin: ['read', 'write'],
    owner: ['read', 'write', 'delete', 'manage'],
    super_admin: ['read', 'write', 'delete', 'manage', 'system']
  };
  return permissions[role] || [];
}

export function isRoleHigherThan(role1: string, role2: string): boolean {
  const roleHierarchy = ['member', 'admin', 'owner', 'super_admin'];
  return roleHierarchy.indexOf(role1) > roleHierarchy.indexOf(role2);
}

// Subscription utilities
export function isSubscriptionActive(status: string): boolean {
  return status === 'active';
}

export function isSubscriptionTrialing(status: string): boolean {
  return status === 'trialing';
}

export function calculateTrialDaysRemaining(trialEndDate: string): number {
  const endDate = new Date(trialEndDate);
  const now = new Date();
  const diffTime = endDate.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function formatSubscriptionStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// Feature access utilities
export function calculateFeatureAccess(plan: any, features: any): any {
  // Placeholder implementation
  return {};
}

// Usage monitoring utilities
export function isApproachingUsageLimit(current: number, limit: number): boolean {
  return current / limit >= 0.8;
}

export function isAtUsageLimit(current: number, limit: number): boolean {
  return current >= limit;
}

export function getUsagePercentage(current: number, limit: number): number {
  return Math.min((current / limit) * 100, 100);
}

export function shouldShowUsageWarning(current: number, limit: number): boolean {
  return getUsagePercentage(current, limit) >= 80;
}

// Organization utilities
export function createSlugFromName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function generateUniqueSlug(baseName: string): string {
  const slug = createSlugFromName(baseName);
  const timestamp = Date.now().toString(36);
  return `${slug}-${timestamp}`;
}

// Date utilities
export function formatRelativeTime(date: string): string {
  const now = new Date();
  const targetDate = new Date(date);
  const diffMs = now.getTime() - targetDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

export function isDateInFuture(date: string): boolean {
  return new Date(date) > new Date();
}

export function isDateInPast(date: string): boolean {
  return new Date(date) < new Date();
}

// Error utilities
export function createSaasError(code: string, message: string): Error {
  const error = new Error(message);
  (error as any).code = code;
  return error;
}

export function isSaasError(error: any): boolean {
  return error && typeof error.code === 'string';
}

export function getErrorMessage(error: any): string {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  return 'An unknown error occurred';
}

// Validation utilities
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateOrganizationName(name: string): boolean {
  return name.length >= 2 && name.length <= 100;
}

export function validateSlug(slug: string): boolean {
  const slugRegex = /^[a-z0-9-]+$/;
  return slugRegex.test(slug) && slug.length >= 2 && slug.length <= 50;
}

export function sanitizeOrganizationData(data: any): any {
  // Basic sanitization
  return {
    ...data,
    name: data.name?.trim(),
    slug: data.slug?.toLowerCase().trim()
  };
}

// Formatting utilities
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat().format(num);
}

// Cache utilities
export function createCacheKey(...parts: string[]): string {
  return parts.join(':');
}

export function isExpired(timestamp: number, ttl: number): boolean {
  return Date.now() - timestamp > ttl;
}

// Feature flag utilities
export function checkFeatureFlag(flags: Record<string, any>, flagName: string): boolean {
  return Boolean(flags[flagName]);
}

export function getFeatureValue(flags: Record<string, any>, flagName: string, defaultValue: any = null): any {
  return flags[flagName] ?? defaultValue;
}

// Array utilities
export function groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const key = keyFn(item);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}

export function sortBy<T>(array: T[], keyFn: (item: T) => any): T[] {
  return [...array].sort((a, b) => {
    const aVal = keyFn(a);
    const bVal = keyFn(b);
    if (aVal < bVal) return -1;
    if (aVal > bVal) return 1;
    return 0;
  });
}

// Object utilities
export function omit<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  keys.forEach(key => delete result[key]);
  return result;
}

export function pick<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  keys.forEach(key => {
    if (key in obj) result[key] = obj[key];
  });
  return result;
}
