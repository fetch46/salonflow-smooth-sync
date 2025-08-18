
import { supabase } from '@/integrations/supabase/client'
import type { 
  Organization, 
  OrganizationUser, 
  OrganizationSubscription, 
  SubscriptionPlan,
  UserRole,
  OrganizationStatus,
  CreateOrganizationData,
  UserInvitation,
  UsageMetrics
} from './types'
import { withRetry, withTimeout } from './utils'

// Network error handler
const handleNetworkError = (error: unknown): never => {
  if (error instanceof Error && error.message.includes('Failed to fetch')) {
    throw new Error('Network connection failed. Please check your internet connection and try again.')
  }
  throw error
}

export class OrganizationService {
  static async getUserOrganizations(userId: string): Promise<OrganizationUser[]> {
    try {
      const { data, error } = await withTimeout(
        withRetry(() =>
          supabase
            .from('organization_users')
            .select(`
              *,
              organizations (*)
            `)
            .eq('user_id', userId)
            .eq('is_active', true)
        ),
        5000
      )

      if (error) throw error
      if (!data) return []

      return data.map(item => ({
        ...item,
        role: item.role as UserRole,
        organizations: item.organizations ? {
          ...item.organizations,
          status: item.organizations.status as OrganizationStatus
        } : null
      }))
    } catch (error) {
      console.error('Error fetching user organizations:', error)
      handleNetworkError(error)
    }
  }

  static async createOrganization(data: CreateOrganizationData, userId: string): Promise<Organization> {
    try {
      const { data: orgData, error } = await withTimeout(
        withRetry(() =>
          supabase
            .from('organizations')
            .insert({
              name: data.name,
              slug: data.slug,
              settings: data.settings || {}
            })
            .select()
            .single()
        ),
        5000
      )

      if (error) throw error
      if (!orgData) throw new Error('Failed to create organization')

      return {
        ...orgData,
        status: orgData.status as OrganizationStatus
      }
    } catch (error) {
      console.error('Error creating organization:', error)
      handleNetworkError(error)
    }
  }

  static async updateOrganization(id: string, data: Partial<Organization>): Promise<Organization> {
    try {
      const { data: orgData, error } = await withTimeout(
        withRetry(() =>
          supabase
            .from('organizations')
            .update(data)
            .eq('id', id)
            .select()
            .single()
        ),
        5000
      )

      if (error) throw error
      if (!orgData) throw new Error('Organization not found')

      return {
        ...orgData,
        status: orgData.status as OrganizationStatus
      }
    } catch (error) {
      console.error('Error updating organization:', error)
      handleNetworkError(error)
    }
  }
}

export class SubscriptionService {
  static async getOrganizationSubscription(organizationId: string): Promise<OrganizationSubscription | null> {
    try {
      const { data, error } = await withTimeout(
        withRetry(() =>
          supabase
            .from('organization_subscriptions')
            .select(`
              *,
              subscription_plans (*)
            `)
            .eq('organization_id', organizationId)
            .single()
        ),
        5000
      )

      if (error) {
        if (error.code === 'PGRST116') return null // No subscription found
        throw error
      }

      return {
        ...data,
        metadata: data.metadata || {}
      }
    } catch (error) {
      console.error('Error fetching subscription:', error)
      handleNetworkError(error)
    }
  }

  static async updateSubscription(organizationId: string, planId: string): Promise<OrganizationSubscription> {
    try {
      const { data, error } = await withTimeout(
        withRetry(() =>
          supabase
            .from('organization_subscriptions')
            .update({ plan_id: planId })
            .eq('organization_id', organizationId)
            .select(`
              *,
              subscription_plans (*)
            `)
            .single()
        ),
        5000
      )

      if (error) throw error
      if (!data) throw new Error('Subscription not found')

      return {
        ...data,
        metadata: data.metadata || {}
      }
    } catch (error) {
      console.error('Error updating subscription:', error)
      handleNetworkError(error)
    }
  }

  static async cancelSubscription(organizationId: string): Promise<void> {
    try {
      const { error } = await withTimeout(
        withRetry(() =>
          supabase
            .from('organization_subscriptions')
            .update({ status: 'canceled' })
            .eq('organization_id', organizationId)
        ),
        5000
      )

      if (error) throw error
    } catch (error) {
      console.error('Error canceling subscription:', error)
      handleNetworkError(error)
    }
  }
}

export class UserService {
  static async getOrganizationUsers(organizationId: string): Promise<OrganizationUser[]> {
    try {
      const { data, error } = await withTimeout(
        withRetry(() =>
          supabase
            .from('organization_users')
            .select(`
              *,
              profiles (*)
            `)
            .eq('organization_id', organizationId)
            .eq('is_active', true)
        ),
        5000
      )

      if (error) throw error
      if (!data) return []

      return data.map(item => ({
        ...item,
        role: item.role as UserRole
      }))
    } catch (error) {
      console.error('Error fetching organization users:', error)
      handleNetworkError(error)
    }
  }

  static async inviteUser(organizationId: string, email: string, role: UserRole, invitedBy: string): Promise<UserInvitation> {
    try {
      const { data, error } = await withTimeout(
        withRetry(() =>
          supabase
            .from('user_invitations')
            .insert({
              organization_id: organizationId,
              email,
              role,
              invited_by: invitedBy
            })
            .select()
            .single()
        ),
        5000
      )

      if (error) throw error
      if (!data) throw new Error('Failed to create invitation')

      return {
        ...data,
        role: data.role as UserRole
      }
    } catch (error) {
      console.error('Error inviting user:', error)
      handleNetworkError(error)
    }
  }

  static async removeUser(organizationId: string, userId: string): Promise<void> {
    try {
      const { error } = await withTimeout(
        withRetry(() =>
          supabase
            .from('organization_users')
            .update({ is_active: false })
            .eq('organization_id', organizationId)
            .eq('user_id', userId)
        ),
        5000
      )

      if (error) throw error
    } catch (error) {
      console.error('Error removing user:', error)
      handleNetworkError(error)
    }
  }

  static async updateUserRole(organizationId: string, userId: string, role: UserRole): Promise<void> {
    try {
      const { error } = await withTimeout(
        withRetry(() =>
          supabase
            .from('organization_users')
            .update({ role })
            .eq('organization_id', organizationId)
            .eq('user_id', userId)
        ),
        5000
      )

      if (error) throw error
    } catch (error) {
      console.error('Error updating user role:', error)
      handleNetworkError(error)
    }
  }
}

export class SuperAdminService {
  static async checkSuperAdminStatus(userId: string): Promise<boolean> {
    try {
      const { data, error } = await withTimeout(
        withRetry(() =>
          supabase
            .from('super_admins')
            .select('id')
            .eq('user_id', userId)
            .eq('is_active', true)
            .single()
        ),
        5000
      )

      if (error) {
        if (error.code === 'PGRST116') return false // No super admin record
        throw error
      }

      return !!data
    } catch (error) {
      console.error('Error checking super admin status:', error)
      handleNetworkError(error)
    }
  }
}

export class UsageService {
  static async getUsageMetrics(organizationId: string): Promise<UsageMetrics> {
    try {
      // This would typically fetch from usage tracking tables
      // For now, returning empty metrics
      return {}
    } catch (error) {
      console.error('Error fetching usage metrics:', error)
      handleNetworkError(error)
    }
  }
}

export class AnalyticsService {
  static trackEvent(organizationId: string, event: string, properties: Record<string, any>): void {
    try {
      // Log analytics event (replace with actual analytics service)
      console.log('Analytics event:', {
        organizationId,
        event,
        properties,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.warn('Analytics tracking failed:', error)
    }
  }
}

export class CacheService {
  static get<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key)
      if (!item) return null
      const parsed = JSON.parse(item)
      
      // Check expiration
      if (parsed.expires && Date.now() > parsed.expires) {
        localStorage.removeItem(key)
        return null
      }
      
      return parsed.value
    } catch {
      return null
    }
  }

  static set<T>(key: string, value: T, ttlMs = 5 * 60 * 1000): void {
    try {
      const item = {
        value,
        expires: Date.now() + ttlMs
      }
      localStorage.setItem(key, JSON.stringify(item))
    } catch (error) {
      console.warn('Cache set failed:', error)
    }
  }

  static delete(key: string): void {
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.warn('Cache delete failed:', error)
    }
  }

  static clear(): void {
    try {
      // Only clear cache items, not all localStorage
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.startsWith('cache_')) {
          localStorage.removeItem(key)
        }
      })
    } catch (error) {
      console.warn('Cache clear failed:', error)
    }
  }
}

export class SystemSettingsService {
  static async getSystemSettings(): Promise<any | null> {
    try {
      const { data, error } = await withTimeout(
        withRetry(() =>
          supabase
            .from('system_settings')
            .select('*')
            .single()
        ),
        5000
      )

      if (error) {
        if (error.code === 'PGRST116') return null // No settings found
        throw error
      }

      return data
    } catch (error) {
      console.error('Error fetching system settings:', error)
      handleNetworkError(error)
    }
  }

  static async saveSystemSettings(settings: any): Promise<boolean> {
    try {
      // First try to get existing settings
      const { data: existing } = await supabase
        .from('system_settings')
        .select('id')
        .single()

      let result
      if (existing) {
        // Update existing settings
        result = await withTimeout(
          withRetry(() =>
            supabase
              .from('system_settings')
              .update(settings)
              .eq('id', existing.id)
          ),
          5000
        )
      } else {
        // Insert new settings
        result = await withTimeout(
          withRetry(() =>
            supabase
              .from('system_settings')
              .insert([settings])
          ),
          5000
        )
      }

      if (result.error) throw result.error
      return true
    } catch (error) {
      console.error('Error saving system settings:', error)
      handleNetworkError(error)
    }
  }
}
