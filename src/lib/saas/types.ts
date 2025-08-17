// Core SaaS Types and Interfaces

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// User Role System
export type UserRole = 'owner' | 'admin' | 'manager' | 'staff' | 'viewer' | 'member'

export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'canceled' | 'incomplete' | 'unpaid'

export type SubscriptionInterval = 'month' | 'year'

export type OrganizationStatus = 'active' | 'suspended' | 'deleted'

// Permission System
export interface Permission {
  action: string
  resource: string
  conditions?: Record<string, any>
}

export interface RolePermissions {
  [role: string]: Permission[]
}

// Organization System
export interface Organization {
  id: string
  name: string
  slug: string
  domain?: string | null
  logo_url?: string | null
  status: OrganizationStatus
  settings: Json
  metadata: Json
  created_at: string
  updated_at: string
}

export interface OrganizationUser {
  id: string
  organization_id: string
  user_id: string
  role: UserRole
  is_active: boolean
  invited_by?: string | null
  invited_at?: string | null
  joined_at?: string | null
  metadata: Json
  created_at: string
  updated_at: string
  organizations?: Organization | null
}

// Subscription System
export interface SubscriptionPlan {
  id: string
  name: string
  slug: string
  description?: string | null
  price_monthly: number
  price_yearly: number
  max_users?: number | null
  max_locations?: number | null
  features: Json
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface OrganizationSubscription {
  id: string
  organization_id: string
  plan_id: string
  status: SubscriptionStatus
  interval: SubscriptionInterval
  current_period_start?: string | null
  current_period_end?: string | null
  trial_start?: string | null
  trial_end?: string | null
  stripe_subscription_id?: string | null
  stripe_customer_id?: string | null
  metadata: Json
  created_at: string
  updated_at: string
  subscription_plans?: SubscriptionPlan | null
}

// User Profile
export interface UserProfile {
  id: string
  email?: string | null
  full_name?: string | null
  avatar_url?: string | null
  created_at: string
  updated_at: string
}

// Super Admin System
export interface SuperAdmin {
  id: string
  user_id: string
  granted_by?: string | null
  granted_at: string
  is_active: boolean
  permissions: Json
  created_at: string
  updated_at: string
}

// Feature Access
export interface FeatureAccess {
  enabled: boolean
  limit?: number
  usage?: number
  remaining?: number
  unlimited: boolean
  canCreate: boolean
  warningThreshold?: number
  upgradeRequired: boolean
}

// Usage Tracking
export interface UsageMetrics {
  [feature: string]: number
}

// User Invitation System
export interface UserInvitation {
  id: string
  organization_id: string
  email: string
  role: UserRole
  invited_by: string
  token: string
  expires_at: string
  accepted_at?: string | null
  created_at: string
}

// SaaS Context State
export interface SaasState {
  // Authentication
  user: any | null
  loading: boolean
  
  // Organization Management
  organization: Organization | null
  organizations: Organization[]
  organizationRole: UserRole | null
  userRoles: Record<string, UserRole>
  
  // Subscription Management
  subscription: OrganizationSubscription | null
  subscriptionPlan: SubscriptionPlan | null
  subscriptionStatus: SubscriptionStatus | null
  
  // Super Admin
  isSuperAdmin: boolean
  superAdminPermissions: Json | null
  
  // Feature Access
  usageMetrics: UsageMetrics
  
  // Error State
  error: string | null

  // System Settings
  systemSettings?: Json | null
}

// SaaS Actions
export interface SaasActions {
  // Organization Actions
  switchOrganization: (organizationId: string) => Promise<void>
  refreshOrganization: () => Promise<void>
  createOrganization: (data: CreateOrganizationData) => Promise<Organization>
  updateOrganization: (id: string, data: Partial<Organization>) => Promise<Organization>
  
  // User Management
  inviteUser: (email: string, role: UserRole) => Promise<UserInvitation>
  removeUser: (userId: string) => Promise<void>
  updateUserRole: (userId: string, role: UserRole) => Promise<void>
  
  // Subscription Management
  updateSubscription: (planId: string) => Promise<void>
  cancelSubscription: () => Promise<void>
  
  // Usage Tracking
  refreshUsage: () => Promise<void>
  
  // Error Handling
  clearError: () => void
}

// Combined SaaS Context
export interface SaasContextType extends SaasState, SaasActions {
  // Computed Properties
  isOrganizationOwner: boolean
  isOrganizationAdmin: boolean
  canManageUsers: boolean
  canManageSettings: boolean
  canManageSystem: boolean
  isTrialing: boolean
  isSubscriptionActive: boolean
  daysLeftInTrial: number | null
  
  // Feature Checking
  hasFeature: (feature: string) => boolean
  getFeatureAccess: (feature: string) => FeatureAccess
  canPerformAction: (action: string, resource: string) => boolean

  // Formatting/Locale
  locale: string
}

// API Data Types
export interface CreateOrganizationData {
  name: string
  slug?: string
  settings?: Json
  planId?: string
}

export interface UpdateUserData {
  full_name?: string
  email?: string
  avatar_url?: string
}

// Error Types
export interface SaasError {
  code: string
  message: string
  details?: any
}

// Event Types
export type SaasEventType = 
  | 'organization_switched'
  | 'user_invited'
  | 'user_removed'
  | 'subscription_updated'
  | 'organization_created'
  | 'organization_updated'

export interface SaasEvent {
  type: SaasEventType
  payload: any
  timestamp: string
}

// Configuration Types
export interface SaasConfig {
  features: Record<string, any>
  permissions: RolePermissions
  limits: Record<string, any>
  billing: {
    provider: 'stripe' | 'other'
    webhookSecret?: string
  }
}

// Hook Types
export interface UseOrganizationResult {
  organization: Organization | null
  organizations: Organization[]
  loading: boolean
  error: string | null
  switchOrganization: (id: string) => Promise<void>
  createOrganization: (data: CreateOrganizationData) => Promise<Organization>
  updateOrganization: (id: string, data: Partial<Organization>) => Promise<Organization>
}

export interface UseSubscriptionResult {
  subscription: OrganizationSubscription | null
  plan: SubscriptionPlan | null
  status: SubscriptionStatus | null
  loading: boolean
  error: string | null
  updateSubscription: (planId: string) => Promise<void>
  cancelSubscription: () => Promise<void>
}

export interface UseFeatureGatingResult {
  hasFeature: (feature: string) => boolean
  getFeatureAccess: (feature: string) => FeatureAccess
  enforceLimit: (feature: string) => boolean
  usageMetrics: UsageMetrics
  loading: boolean
  refreshUsage: () => Promise<void>
}

export interface UsePermissionsResult {
  canPerformAction: (action: string, resource: string) => boolean
  hasRole: (role: UserRole) => boolean
  hasMinimumRole: (minRole: UserRole) => boolean
  userRole: UserRole | null
}