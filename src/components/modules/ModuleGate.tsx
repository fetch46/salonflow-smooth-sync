import React from 'react';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ModuleGateProps {
  moduleId: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgrade?: boolean;
}

export function ModuleGate({ 
  moduleId, 
  children, 
  fallback,
  showUpgrade = true 
}: ModuleGateProps) {
  const { moduleManager, isLoading, canAccessModule } = useModuleAccess();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!moduleManager || !canAccessModule(moduleId)) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex items-center justify-center min-h-[400px] p-8">
        <div className="max-w-md text-center space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-orange-100 p-3">
              <Lock className="h-8 w-8 text-orange-600" />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Module Not Available
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              The {moduleId} module is not enabled for your organization or you don't have permission to access it.
            </p>
          </div>
          {showUpgrade && (
            <div className="space-y-3">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Contact your administrator to enable this module or upgrade your subscription plan.
                </AlertDescription>
              </Alert>
              <Button variant="outline" onClick={() => window.history.back()}>
                Go Back
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}