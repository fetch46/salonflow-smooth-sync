// SaaS Services for managing organizations, subscriptions, and users
import { supabase } from '@/integrations/supabase/client'
import type {
  Organization,
  OrganizationUser,
  OrganizationSubscription,
  SubscriptionPlan,
  UserInvitation,
  UserRole,
  CreateOrganizationData,
  UsageMetrics,
} from './types'

// Simple retry utility
const withRetry = async <T>(fn: () => Promise<T>, retries = 3): Promise<T> => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (i === retries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
  throw new Error('Max retries exceeded')
}

// Simple timeout utility
const withTimeout = <T>(promise: Promise<T>, ms = 10000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), ms)
    )
  ])
}

// Network error handler
const handleNetworkError = (error: any) => {
  console.error('Network error:', error)
}

/**
 * Organization Service
 */
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
        )
      )

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Failed to fetch user organizations:', error)
      throw error
    }
  }

  static async createOrganization(data: CreateOrganizationData, userId: string): Promise<Organization> {
    try {
      const { data: orgData, error: orgError } = await withTimeout(
        supabase
          .from('organizations')
          .insert([{
            name: data.name,
            slug: data.slug || data.name.toLowerCase().replace(/\s+/g, '-'),
            settings: data.settings || {},
          }])
          .select()
          .single()
      )

      if (orgError) throw orgError

      // Add user as owner
      const { error: memberError } = await supabase
        .from('organization_users')
        .insert([{
          organization_id: orgData.id,
          user_id: userId,
          role: 'owner',
          is_active: true,
        }])

      if (memberError) throw memberError
      
      return orgData
    } catch (error) {
      console.error('Failed to create organization:', error)
      throw error
    }
  }

  static async updateOrganization(id: string, data: Partial<Organization>): Promise<Organization> {
    try {
      const { data: orgData, error: orgError } = await withTimeout(
        supabase
          .from('organizations')
          .update(data)
          .eq('id', id)
          .select()
          .single()
      )

      if (orgError) throw orgError
      return orgData
    } catch (error) {
      console.error('Failed to update organization:', error)
      throw error
    }
  }
}

/**
 * User Service
 */
export class UserService {
  static async getOrganizationUsers(organizationId: string): Promise<OrganizationUser[]> {
    try {
      const { data, error } = await withTimeout(
        withRetry(() =>
          supabase
            .from('organization_users')
            .select(`
              *,
              profiles:user_id (*)
            `)
            .eq('organization_id', organizationId)
            .eq('is_active', true)
        )
      )

      if (error) throw error
      return (data || []).map(item => ({
        ...item,
        role: item.role as UserRole
      }))
    } catch (error) {
      console.error('Error fetching organization users:', error)
      handleNetworkError(error)
      return []
    }
  }

  static async inviteUser(organizationId: string, email: string, role: UserRole, invitedBy: string): Promise<UserInvitation> {
    try {
      const token = Math.random().toString(36).substring(2, 15)
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

      const { data, error } = await withTimeout(
        withRetry(() =>
          supabase
            .from('user_invitations')
            .insert({
              organization_id: organizationId,
              email,
              role,
              invited_by: invitedBy,
              token,
              expires_at: expiresAt
            })
            .select()
            .single()
        )
      )

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error inviting user:', error)
      throw error
    }
  }

  static async removeUser(organizationId: string, userId: string): Promise<void> {
    try {
      const { error } = await withTimeout(
        supabase
          .from('organization_users')
          .update({ is_active: false })
          .eq('organization_id', organizationId)
          .eq('user_id', userId)
      )

      if (error) throw error
    } catch (error) {
      console.error('Error removing user:', error)
      throw error
    }
  }

  static async updateUserRole(organizationId: string, userId: string, role: UserRole): Promise<void> {
    try {
      const { error } = await withTimeout(
        supabase
          .from('organization_users')
          .update({ role })
          .eq('organization_id', organizationId)
          .eq('user_id', userId)
      )

      if (error) throw error
    } catch (error) {
      console.error('Error updating user role:', error)
      throw error
    }
  }
}

/**
 * Subscription Service
 */
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
        )
      )

      if (error) {
        if (error.code === 'PGRST116') return null // No rows found
        throw error
      }
      return data
    } catch (error) {
      console.error('Failed to fetch subscription:', error)
      return null
    }
  }

  static async updateSubscription(organizationId: string, planId: string): Promise<OrganizationSubscription> {
    try {
      const { data, error } = await withTimeout(
        withRetry(() =>
          supabase
            .from('organization_subscriptions')
            .upsert({
              organization_id: organizationId,
              plan_id: planId,
              status: 'active',
              interval: 'month',
              current_period_start: new Date().toISOString(),
              current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            })
            .select(`
              *,
              subscription_plans (*)
            `)
            .single()
        )
      )

      if (error) throw error
      return data
    } catch (error) {
      console.error('Failed to update subscription:', error)
      throw error
    }
  }

  static async cancelSubscription(organizationId: string): Promise<void> {
    try {
      const { error } = await withTimeout(
        supabase
          .from('organization_subscriptions')
          .update({ status: 'canceled' })
          .eq('organization_id', organizationId)
      )

      if (error) throw error
    } catch (error) {
      console.error('Failed to cancel subscription:', error)
      throw error
    }
  }
}

/**
 * Super Admin Service
 */
export class SuperAdminService {
  static async checkSuperAdminStatus(userId: string): Promise<boolean> {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('super_admins')
          .select('is_active')
          .eq('user_id', userId)
          .eq('is_active', true)
          .single()
      )

      if (error) {
        if (error.code === 'PGRST116') return false // No rows found
        throw error
      }
      return data?.is_active || false
    } catch (error) {
      console.error('Failed to check super admin status:', error)
      return false
    }
  }
}

/**
 * Usage Service
 */
export class UsageService {
  static async getUsageMetrics(organizationId: string): Promise<UsageMetrics> {
    // Mock implementation for now
    return {}
  }
}

/**
 * System Settings Service
 */
export class SystemSettingsService {
  static async getSystemSettings(): Promise<any | null> {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('system_settings')
          .select('*')
          .single()
      )

      if (error) {
        if (error.code === 'PGRST116') return null // No rows found
        throw error
      }
      return data
    } catch (error) {
      console.error('Failed to fetch system settings:', error)
      return null
    }
  }

  static async saveSystemSettings(settings: any): Promise<boolean> {
    try {
      const { error } = await withTimeout(
        supabase
          .from('system_settings')
          .upsert(settings)
      )

      if (error) throw error
      return true
    } catch (error) {
      console.error('Failed to save system settings:', error)
      return false
    }
  }
}

/**
 * Analytics Service
 */
export class AnalyticsService {
  static trackEvent(organizationId: string, event: string, properties: Record<string, any>): void {
    console.log('Analytics Event:', { organizationId, event, properties })
  }
}

/**
 * Cache Service
 */
export class CacheService {
  private static CACHE_PREFIX = 'saas_cache_'

  static get<T>(key: string): T | null {
    try {
      const cached = localStorage.getItem(this.CACHE_PREFIX + key)
      if (!cached) return null

      const { data, expiry } = JSON.parse(cached)
      if (Date.now() > expiry) {
        localStorage.removeItem(this.CACHE_PREFIX + key)
        return null
      }
      return data
    } catch {
      return null
    }
  }

  static set<T>(key: string, value: T, ttlMs = 5 * 60 * 1000): void {
    try {
      const expiry = Date.now() + ttlMs
      localStorage.setItem(
        this.CACHE_PREFIX + key,
        JSON.stringify({ data: value, expiry })
      )
    } catch (error) {
      console.warn('Failed to cache data:', error)
    }
  }

  static delete(key: string): void {
    localStorage.removeItem(this.CACHE_PREFIX + key)
  }

  static clear(): void {
    Object.keys(localStorage)
      .filter(key => key.startsWith(this.CACHE_PREFIX))
      .forEach(key => localStorage.removeItem(key))
  }
}