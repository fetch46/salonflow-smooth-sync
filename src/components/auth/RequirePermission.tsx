import React from 'react'
import { Navigate } from 'react-router-dom'
import { usePermissions } from '@/lib/saas/hooks'

interface RequirePermissionProps {
  resource: string
  action: string
  children: React.ReactNode
}

export default function RequirePermission({ resource, action, children }: RequirePermissionProps) {
  const { canPerformAction } = usePermissions()
  const allowed = canPerformAction(action, resource)
  if (!allowed) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}