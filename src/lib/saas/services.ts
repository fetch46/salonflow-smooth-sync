import { supabase } from '@/integrations/supabase/client'
import type { 
  Organization, 
  OrganizationUser, 
  OrganizationSubscription, 
  SubscriptionPlan,
  UserInvitation,
  CreateOrganizationData,
  UserRole,
  SuperAdmin
} from './types'
import { createSaasError, sanitizeOrganizationData } from './utils'

/**
 * Organization Services
 */

export class OrganizationService {
  static async getUserOrganizations(userId: string): Promise<OrganizationUser[]> {
    try {
      // Primary approach: fetch memberships with embedded organization via foreign relation
      const { data, error } = await supabase
        .from('organization_users')
        .select(`
          *,
          organizations (*)
        `)
        .eq('user_id', userId)
        .eq('is_active', true)

      if (error) {
        // Fallback: fetch memberships first, then fetch organizations separately
        console.warn('Relational fetch for user organizations failed; attempting fallback without join', error)

        const { data: memberships, error: membershipsError } = await supabase
          .from('organization_users')
          .select('id, organization_id, user_id, role, is_active, invited_by, invited_at, joined_at, metadata, created_at, updated_at')
          .eq('user_id', userId)
          .eq('is_active', true)

        if (membershipsError) throw membershipsError

        if (!memberships || memberships.length === 0) return []

        const orgIds = Array.from(new Set(memberships.map(m => m.organization_id)))

        const { data: orgs, error: orgsError } = await supabase
          .from('organizations')
          .select('*')
          .in('id', orgIds)

        if (orgsError) throw orgsError

        const orgIdToOrg = new Map<string, Organization>()
        ;(orgs || []).forEach(o => orgIdToOrg.set(o.id, o as Organization))

        const result: OrganizationUser[] = memberships.map(m => ({
          ...m,
          organizations: orgIdToOrg.get(m.organization_id) || null,
        })) as OrganizationUser[]

        return result
      }

      return data || []
    } catch (error) {
      throw createSaasError('SERVER_ERROR', 'Failed to fetch user organizations', error)
    }
  }

  static async getOrganization(id: string): Promise<Organization | null> {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', id)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return data
    } catch (error) {
      throw createSaasError('SERVER_ERROR', 'Failed to fetch organization', error)
    }
  }

  static async createOrganization(data: CreateOrganizationData, userId: string): Promise<Organization> {
    try {
      const sanitizedData = sanitizeOrganizationData(data)
      
      // Use the database function to create organization with user
      const { data: result, error } = await supabase.rpc('create_organization_with_user', {
        org_name: sanitizedData.name,
        org_slug: sanitizedData.slug || null,
        org_settings: sanitizedData.settings,
        plan_id: data.planId || null
      })

      if (error) throw error
      return result
    } catch (error) {
      throw createSaasError('SERVER_ERROR', 'Failed to create organization', error)
    }
  }

  static async updateOrganization(id: string, data: Partial<Organization>): Promise<Organization> {
    try {
      const sanitizedData = sanitizeOrganizationData(data)
      
      const { data: result, error } = await supabase
        .from('organizations')
        .update(sanitizedData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return result
    } catch (error) {
      throw createSaasError('SERVER_ERROR', 'Failed to update organization', error)
    }
  }

  static async deleteOrganization(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ status: 'deleted' })
        .eq('id', id)

      if (error) throw error
    } catch (error) {
      throw createSaasError('SERVER_ERROR', 'Failed to delete organization', error)
    }
  }
}

/**
 * Subscription Services
 */

export class SubscriptionService {
  static async getOrganizationSubscription(organizationId: string): Promise<OrganizationSubscription | null> {
    try {
      const { data, error } = await supabase
        .from('organization_subscriptions')
        .select(`
          *,
          subscription_plans (*)
        `)
        .eq('organization_id', organizationId)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return data
    } catch (error) {
      throw createSaasError('SERVER_ERROR', 'Failed to fetch subscription', error)
    }
  }

  static async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')

      if (error) throw error
      return data || []
    } catch (error) {
      throw createSaasError('SERVER_ERROR', 'Failed to fetch subscription plans', error)
    }
  }

  static async updateSubscription(
    organizationId: string, 
    planId: string
  ): Promise<OrganizationSubscription> {
    try {
      const { data, error } = await supabase
        .from('organization_subscriptions')
        .upsert({
          organization_id: organizationId,
          plan_id: planId,
          status: 'active',
          interval: 'month',
        })
        .select(`
          *,
          subscription_plans (*)
        `)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      throw createSaasError('SERVER_ERROR', 'Failed to update subscription', error)
    }
  }

  static async cancelSubscription(organizationId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('organization_subscriptions')
        .update({ status: 'canceled' })
        .eq('organization_id', organizationId)

      if (error) throw error
    } catch (error) {
      throw createSaasError('SERVER_ERROR', 'Failed to cancel subscription', error)
    }
  }
}

/**
 * User Management Services
 */

export class UserService {
  static async getOrganizationUsers(organizationId: string): Promise<OrganizationUser[]> {
    try {
      const { data, error } = await supabase
        .from('organization_users')
        .select(`
          *,
          profiles (*)
        `)
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('created_at')

      if (error) throw error
      return data || []
    } catch (error) {
      throw createSaasError('SERVER_ERROR', 'Failed to fetch organization users', error)
    }
  }

  static async inviteUser(
    organizationId: string, 
    email: string, 
    role: UserRole,
    invitedBy: string
  ): Promise<UserInvitation> {
    try {
      // Generate invitation token
      const token = crypto.randomUUID()
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7) // 7 days expiration

      const { data, error } = await supabase
        .from('user_invitations')
        .insert({
          organization_id: organizationId,
          email,
          role,
          invited_by: invitedBy,
          token,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      throw createSaasError('SERVER_ERROR', 'Failed to create user invitation', error)
    }
  }

  static async updateUserRole(
    organizationId: string, 
    userId: string, 
    role: UserRole
  ): Promise<OrganizationUser> {
    try {
      const { data, error } = await supabase
        .from('organization_users')
        .update({ role })
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      throw createSaasError('SERVER_ERROR', 'Failed to update user role', error)
    }
  }

  static async removeUser(organizationId: string, userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('organization_users')
        .update({ is_active: false })
        .eq('organization_id', organizationId)
        .eq('user_id', userId)

      if (error) throw error
    } catch (error) {
      throw createSaasError('SERVER_ERROR', 'Failed to remove user', error)
    }
  }

  static async acceptInvitation(token: string, userId: string): Promise<OrganizationUser> {
    try {
      // Get invitation
      const { data: invitation, error: inviteError } = await supabase
        .from('user_invitations')
        .select('*')
        .eq('token', token)
        .gt('expires_at', new Date().toISOString())
        .is('accepted_at', null)
        .single()

      if (inviteError || !invitation) {
        throw createSaasError('INVITATION_INVALID', 'Invalid or expired invitation')
      }

      // Create organization user
      const { data: orgUser, error: orgError } = await supabase
        .from('organization_users')
        .insert({
          organization_id: invitation.organization_id,
          user_id: userId,
          role: invitation.role,
          is_active: true,
          invited_by: invitation.invited_by,
          invited_at: invitation.created_at,
          joined_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (orgError) throw orgError

      // Mark invitation as accepted
      await supabase
        .from('user_invitations')
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', invitation.id)

      return orgUser
    } catch (error) {
      throw createSaasError('SERVER_ERROR', 'Failed to accept invitation', error)
    }
  }
}

/**
 * Super Admin Services
 */

export class SuperAdminService {
  static async checkSuperAdminStatus(userId: string): Promise<boolean> {
    try {
      // Use RPC to avoid RLS recursion issues and ensure reliable check
      const { data, error } = await supabase.rpc('is_super_admin', { uid: userId })

      if (error) throw error
      return data === true
    } catch (error) {
      console.error('Error checking super admin status:', error)
      return false
    }
  }

  static async getSuperAdmin(userId: string): Promise<SuperAdmin | null> {
    try {
      const { data, error } = await supabase
        .from('super_admins')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return data
    } catch (error) {
      throw createSaasError('SERVER_ERROR', 'Failed to fetch super admin data', error)
    }
  }

  static async grantSuperAdmin(
    targetUserId: string, 
    grantedBy: string, 
    permissions: any = {}
  ): Promise<SuperAdmin> {
    try {
      const { data, error } = await supabase
        .from('super_admins')
        .upsert({
          user_id: targetUserId,
          granted_by: grantedBy,
          granted_at: new Date().toISOString(),
          is_active: true,
          permissions,
        })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      throw createSaasError('SERVER_ERROR', 'Failed to grant super admin privileges', error)
    }
  }

  static async revokeSuperAdmin(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('super_admins')
        .update({ is_active: false })
        .eq('user_id', userId)

      if (error) throw error
    } catch (error) {
      throw createSaasError('SERVER_ERROR', 'Failed to revoke super admin privileges', error)
    }
  }
}

/**
 * Usage Tracking Services
 */

export class UsageService {
  static async getUsageMetrics(organizationId: string): Promise<Record<string, number>> {
    try {
      const usage: Record<string, number> = {}

      // Get counts for various features
      const queries = [
        { feature: 'appointments', table: 'appointments' },
        { feature: 'clients', table: 'clients' },
        { feature: 'staff', table: 'staff' },
        { feature: 'services', table: 'services' },
        { feature: 'inventory', table: 'inventory_items' },
        { feature: 'purchases', table: 'purchases' },
        { feature: 'job_cards', table: 'job_cards' },
        { feature: 'invoices', table: 'invoices' },
        { feature: 'expenses', table: 'expenses' },
      ]

      const results = await Promise.allSettled(
        queries.map(async ({ feature, table }) => {
          try {
            const { count, error } = await supabase
              .from(table as any)
              .select('*', { count: 'exact', head: true })
              .eq('organization_id', organizationId)

            if (error) throw error
            return { feature, count: count || 0 }
          } catch (err) {
            console.error(`Error fetching ${feature} count:`, err)
            return { feature, count: 0 }
          }
        })
      )

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          usage[result.value.feature] = result.value.count
        }
      })

      // Get monthly usage
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

      try {
        const { count: monthlyAppointments } = await supabase
          .from('appointments')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .gte('appointment_date', monthStart.toISOString().split('T')[0])

        usage.monthly_appointments = monthlyAppointments || 0
      } catch (err) {
        console.error('Error fetching monthly appointments:', err)
        usage.monthly_appointments = 0
      }

      return usage
    } catch (error) {
      throw createSaasError('SERVER_ERROR', 'Failed to fetch usage metrics', error)
    }
  }

  static async recordUsageEvent(
    organizationId: string,
    feature: string,
    eventData?: any
  ): Promise<void> {
    try {
      // This would typically record to a usage events table
      // For now, we'll just log it
      console.log('Usage event recorded:', {
        organizationId,
        feature,
        eventData,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      // Don't throw for usage tracking errors
      console.error('Failed to record usage event:', error)
    }
  }
}

/**
 * Analytics Services
 */

export class AnalyticsService {
  static async trackEvent(
    organizationId: string,
    event: string,
    properties?: Record<string, any>
  ): Promise<void> {
    try {
      // This would typically send to an analytics service
      // For now, we'll just log it
      console.log('Analytics event:', {
        organizationId,
        event,
        properties,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      // Don't throw for analytics errors
      console.error('Failed to track analytics event:', error)
    }
  }
}

/**
 * Cache Services
 */

export class CacheService {
  private static cache = new Map<string, { data: any; timestamp: number }>()
  private static defaultTTL = 5 * 60 * 1000 // 5 minutes

  static set(key: string, data: any, ttl = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now() + ttl,
    })
  }

  static get<T>(key: string): T | null {
    const item = this.cache.get(key)
    if (!item) return null

    if (Date.now() > item.timestamp) {
      this.cache.delete(key)
      return null
    }

    return item.data
  }

  static delete(key: string): void {
    this.cache.delete(key)
  }

  static clear(): void {
    this.cache.clear()
  }

  static has(key: string): boolean {
    const item = this.cache.get(key)
    if (!item) return false

    if (Date.now() > item.timestamp) {
      this.cache.delete(key)
      return false
    }

    return true
  }
}