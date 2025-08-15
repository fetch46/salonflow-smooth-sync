// Centralized type definitions for API responses and data models

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// User and Authentication
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export type UserRole = 'ADMIN' | 'ACCOUNTANT' | 'INVENTORY' | 'OWNER';

// Account and Financial
export interface Account {
  id: string;
  account_code: string;
  account_name: string;
  account_type: 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense';
  account_subtype?: string;
  normal_balance?: 'debit' | 'credit';
  is_active: boolean;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  account_id: string;
  transaction_date: string;
  description: string;
  debit_amount: number;
  credit_amount: number;
  reference_type?: string;
  reference_id?: string;
  location_id?: string;
  created_at: string;
}

// Business entities
export interface Organization {
  id: string;
  name: string;
  slug: string;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  organization_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Validation schemas
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface FormData {
  [key: string]: any;
}

// Utility types
export type SortDirection = 'asc' | 'desc';
export type FilterOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in';

export interface SortConfig {
  field: string;
  direction: SortDirection;
}

export interface FilterConfig {
  field: string;
  operator: FilterOperator;
  value: any;
}