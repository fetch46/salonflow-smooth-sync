import type { UserRole, RolePermissions } from './types'

// Role Hierarchy (higher number = higher privilege)
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  viewer: 1,
  member: 2,
  staff: 3,
  manager: 4,
  admin: 5,
  owner: 6,
  accountant: 5,
}

// Role-based permissions (frontend-only gating; backend is authoritative)
export const ROLE_PERMISSIONS: RolePermissions = {
  viewer: [
    { action: 'view', resource: 'appointments' },
    { action: 'view', resource: 'clients' },
    { action: 'view', resource: 'services' },
  ],
  member: [
    { action: 'view', resource: 'appointments' },
    { action: 'create', resource: 'appointments' },
    { action: 'view', resource: 'clients' },
    { action: 'view', resource: 'services' },
  ],
  staff: [
    { action: 'view', resource: 'appointments' },
    { action: 'create', resource: 'appointments' },
    { action: 'edit', resource: 'appointments' },
    { action: 'view', resource: 'clients' },
    { action: 'create', resource: 'clients' },
    { action: 'edit', resource: 'clients' },
    { action: 'view', resource: 'services' },
    { action: 'view', resource: 'products' },
    { action: 'view', resource: 'jobcards' },
    { action: 'create', resource: 'jobcards' },
    { action: 'edit', resource: 'jobcards' },
  ],
  manager: [
    { action: 'view', resource: 'appointments' },
    { action: 'create', resource: 'appointments' },
    { action: 'edit', resource: 'appointments' },
    { action: 'delete', resource: 'appointments' },

    { action: 'view', resource: 'clients' },
    { action: 'create', resource: 'clients' },
    { action: 'edit', resource: 'clients' },
    { action: 'delete', resource: 'clients' },

    { action: 'view', resource: 'invoices' },
    { action: 'create', resource: 'invoices' },
    { action: 'edit', resource: 'invoices' },

    { action: 'view', resource: 'payments' },
    { action: 'create', resource: 'payments' },

    { action: 'view', resource: 'jobcards' },
    { action: 'create', resource: 'jobcards' },
    { action: 'edit', resource: 'jobcards' },
    { action: 'delete', resource: 'jobcards' },

    { action: 'view', resource: 'suppliers' },
    { action: 'view', resource: 'purchases' },
    { action: 'create', resource: 'purchases' },
    { action: 'edit', resource: 'purchases' },

    { action: 'view', resource: 'goods_received' },
    { action: 'create', resource: 'goods_received' },

    { action: 'view', resource: 'expenses' },
    { action: 'create', resource: 'expenses' },
    { action: 'edit', resource: 'expenses' },

    { action: 'view', resource: 'products' },
    { action: 'create', resource: 'products' },
    { action: 'edit', resource: 'products' },

    { action: 'view', resource: 'adjustments' },
    { action: 'create', resource: 'adjustments' },
    { action: 'edit', resource: 'adjustments' },

    { action: 'view', resource: 'transfers' },
    { action: 'create', resource: 'transfers' },
    { action: 'edit', resource: 'transfers' },

    { action: 'view', resource: 'settings' },
    { action: 'edit', resource: 'settings' },
  ],
  admin: [
    { action: '*', resource: '*' },
  ],
  accountant: [
    { action: 'view', resource: 'appointments' },
    { action: 'view', resource: 'clients' },

    { action: 'view', resource: 'invoices' },
    { action: 'create', resource: 'invoices' },
    { action: 'edit', resource: 'invoices' },
    { action: 'delete', resource: 'invoices' },

    { action: 'view', resource: 'payments' },
    { action: 'create', resource: 'payments' },
    { action: 'delete', resource: 'payments' },

    { action: 'view', resource: 'suppliers' },
    { action: 'view', resource: 'purchases' },
    { action: 'create', resource: 'purchases' },
    { action: 'edit', resource: 'purchases' },

    { action: 'view', resource: 'goods_received' },
    { action: 'create', resource: 'goods_received' },

    { action: 'view', resource: 'expenses' },
    { action: 'create', resource: 'expenses' },
    { action: 'edit', resource: 'expenses' },
    
    { action: 'view', resource: 'products' },
    { action: 'create', resource: 'products' },
    { action: 'edit', resource: 'products' },

    { action: 'view', resource: 'adjustments' },
    { action: 'create', resource: 'adjustments' },
    { action: 'edit', resource: 'adjustments' },

    { action: 'view', resource: 'transfers' },
    { action: 'create', resource: 'transfers' },
    { action: 'edit', resource: 'transfers' },

    // Accountant + Owner only modules
    { action: 'view', resource: 'banking' },
    { action: 'edit', resource: 'banking' },
    { action: 'view', resource: 'reports' },

    { action: 'view', resource: 'settings' },
    { action: 'edit', resource: 'settings' },
  ],
  owner: [
    { action: '*', resource: '*' },
  ],
}

// Default trial duration in days
export const DEFAULT_TRIAL_DAYS = 14

// Usage warning thresholds (percentage of limit)
export const USAGE_WARNING_THRESHOLD = 0.8
export const USAGE_CRITICAL_THRESHOLD = 0.95

// Feature categories for organization
export const FEATURE_CATEGORIES = {
  core: {
    label: 'Core Features',
    icon: 'Calendar',
    features: ['appointments', 'clients', 'staff', 'services'],
  },
  inventory: {
    label: 'Inventory Management',
    icon: 'Package',
    features: ['inventory', 'inventory_adjustments', 'suppliers'],
  },
  financial: {
    label: 'Financial Management',
    icon: 'DollarSign',
    features: ['expenses', 'purchases', 'accounting', 'pos', 'invoices'],
  },
  advanced: {
    label: 'Advanced Features',
    icon: 'Zap',
    features: ['job_cards', 'reports', 'advanced_reports', 'analytics'],
  },
  integrations: {
    label: 'Integrations & API',
    icon: 'Link',
    features: ['integrations', 'api_access', 'webhooks'],
  },
  customization: {
    label: 'Customization',
    icon: 'Palette',
    features: ['white_label', 'custom_branding', 'custom_domains'],
  },
  communication: {
    label: 'Communication',
    icon: 'MessageSquare',
    features: ['sms_notifications', 'email_marketing', 'whatsapp_integration'],
  },
  support: {
    label: 'Support',
    icon: 'HelpCircle',
    features: ['priority_support', 'phone_support', 'dedicated_manager'],
  },
} as const

// Error codes
export const SAAS_ERROR_CODES = {
  // Authentication errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  
  // Organization errors
  ORGANIZATION_NOT_FOUND: 'ORGANIZATION_NOT_FOUND',
  ORGANIZATION_SUSPENDED: 'ORGANIZATION_SUSPENDED',
  ORGANIZATION_LIMIT_REACHED: 'ORGANIZATION_LIMIT_REACHED',
  
  // Subscription errors
  SUBSCRIPTION_INACTIVE: 'SUBSCRIPTION_INACTIVE',
  SUBSCRIPTION_EXPIRED: 'SUBSCRIPTION_EXPIRED',
  PLAN_NOT_FOUND: 'PLAN_NOT_FOUND',
  BILLING_ERROR: 'BILLING_ERROR',
  
  // Feature errors
  FEATURE_NOT_AVAILABLE: 'FEATURE_NOT_AVAILABLE',
  USAGE_LIMIT_EXCEEDED: 'USAGE_LIMIT_EXCEEDED',
  
  // User errors
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  INVITATION_EXPIRED: 'INVITATION_EXPIRED',
  INVITATION_INVALID: 'INVITATION_INVALID',
  
  // Generic errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
} as const

// Default organization settings
export const DEFAULT_ORGANIZATION_SETTINGS = {
  timezone: 'UTC',
  currency: 'USD',
  date_format: 'MM/DD/YYYY',
  time_format: '12h',
  // Organization-wide regional settings used by UI formatters
  regional_settings: {
    date_format: 'MMM dd, yyyy',
    time_format: '12h',
    thousand_separator: ',',
    decimal_separator: '.',
    currency_decimals: 2,
  },
  business_hours: {
    monday: { open: '09:00', close: '17:00', closed: false },
    tuesday: { open: '09:00', close: '17:00', closed: false },
    wednesday: { open: '09:00', close: '17:00', closed: false },
    thursday: { open: '09:00', close: '17:00', closed: false },
    friday: { open: '09:00', close: '17:00', closed: false },
    saturday: { open: '09:00', close: '15:00', closed: false },
    sunday: { open: '10:00', close: '14:00', closed: true },
  },
  notifications: {
    appointment_reminders: true,
    email_notifications: true,
    sms_notifications: false,
  },
  booking: {
    advance_booking_days: 30,
    cancellation_hours: 24,
    confirmation_required: true,
  },
} as const

// Cache keys
export const CACHE_KEYS = {
  USER_ORGANIZATIONS: 'user_organizations',
  SUBSCRIPTION_PLANS: 'subscription_plans',
  USAGE_METRICS: 'usage_metrics',
  FEATURE_ACCESS: 'feature_access',
  USER_PERMISSIONS: 'user_permissions',
} as const

// Event names for analytics
export const ANALYTICS_EVENTS = {
  ORGANIZATION_CREATED: 'organization_created',
  ORGANIZATION_SWITCHED: 'organization_switched',
  USER_INVITED: 'user_invited',
  USER_JOINED: 'user_joined',
  SUBSCRIPTION_UPGRADED: 'subscription_upgraded',
  SUBSCRIPTION_DOWNGRADED: 'subscription_downgraded',
  SUBSCRIPTION_CANCELED: 'subscription_canceled',
  FEATURE_ACCESSED: 'feature_accessed',
  USAGE_LIMIT_REACHED: 'usage_limit_reached',
} as const

// Subscription plan slugs
export const PLAN_SLUGS = {
  STARTER: 'starter',
  PROFESSIONAL: 'professional',
  ENTERPRISE: 'enterprise',
} as const

// Billing intervals
export const BILLING_INTERVALS = {
  MONTHLY: 'month',
  YEARLY: 'year',
} as const

// Organization status values
export const ORGANIZATION_STATUS = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  DELETED: 'deleted',
} as const

// Subscription status values
export const SUBSCRIPTION_STATUS = {
  TRIAL: 'trial',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELED: 'canceled',
  INCOMPLETE: 'incomplete',
  UNPAID: 'unpaid',
} as const

// API endpoints
export const API_ENDPOINTS = {
  ORGANIZATIONS: '/api/organizations',
  SUBSCRIPTIONS: '/api/subscriptions',
  USERS: '/api/users',
  INVITATIONS: '/api/invitations',
  USAGE: '/api/usage',
  FEATURES: '/api/features',
} as const

// Local storage keys
export const STORAGE_KEYS = {
  ACTIVE_ORGANIZATION: 'activeOrganizationId',
  USER_PREFERENCES: 'userPreferences',
  FEATURE_CACHE: 'featureCache',
} as const