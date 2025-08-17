// Main exports for the SaaS module

// Context and Provider
export { SaasProvider, useSaas } from './context'

// Custom Hooks
export {
  useOrganization,
  useSubscription,
  useFeatureGating,
  usePermissions,
  useFeatureAccess,
  useOrganizationSwitcher,
  useUserInvitations,
  useSubscriptionPlans,
  useUsageMonitoring,
  useTrialStatus,
  useRoleGuard,
  useFeatureGuard,
  useRegionalNumberFormatter,
  useRegionalDateFormatter,
  useOrganizationCurrency,
} from './hooks'

// Types and interfaces
export type {
  SaasContextType,
  SaasState,
  SaasActions,
  Organization,
  OrganizationUser,
  OrganizationSubscription,
  SubscriptionPlan,
  UserProfile,
  SuperAdmin,
  UserInvitation,
  FeatureAccess,
  UsageMetrics,
  CreateOrganizationData,
  UpdateUserData,
  SaasError,
  SaasEvent,
  SaasConfig,
  UseOrganizationResult,
  UseSubscriptionResult,
  UseFeatureGatingResult,
  UsePermissionsResult,
  UserRole,
  SubscriptionStatus,
  SubscriptionInterval,
  OrganizationStatus,
  Permission,
  RolePermissions,
  Json,
} from './types'

// Services
export * from './services'

// Utilities
export * from './utils'

// Constants
export {
  ROLE_HIERARCHY,
  ROLE_PERMISSIONS,
  DEFAULT_TRIAL_DAYS,
  USAGE_WARNING_THRESHOLD,
  USAGE_CRITICAL_THRESHOLD,
  FEATURE_CATEGORIES,
  SAAS_ERROR_CODES,
  DEFAULT_ORGANIZATION_SETTINGS,
  CACHE_KEYS,
  ANALYTICS_EVENTS,
  PLAN_SLUGS,
  BILLING_INTERVALS,
  ORGANIZATION_STATUS,
  SUBSCRIPTION_STATUS,
  API_ENDPOINTS,
  STORAGE_KEYS,
} from './constants'