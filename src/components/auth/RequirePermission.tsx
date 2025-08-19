import React from 'react'
import { Navigate } from 'react-router-dom'
import { usePermissions } from '@/lib/saas/hooks'

interface RequirePermissionProps {
  resource: string
  action: string
  children: React.ReactNode
  fallback?: React.ReactNode
}

export default function RequirePermission({ 
  resource, 
  action, 
  children, 
  fallback 
}: RequirePermissionProps) {
  const { canPerformAction, userRole } = usePermissions()
  
  // Owner and Admin roles have full access to all organization resources
  if (userRole === 'owner' || userRole === 'admin') {
    return <>{children}</>
  }
  
  const allowed = canPerformAction(action, resource)
  
  if (!allowed) {
    if (fallback) {
      return <>{fallback}</>
    }
    return <Navigate to="/dashboard" replace />
  }
  
  return <>{children}</>
}