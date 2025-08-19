import React from 'react';
import { useFeatureAccess } from '@/lib/saas/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { FEATURE_LABELS, FEATURE_DESCRIPTIONS } from '@/lib/features';
import { 
  Lock, 
  Crown, 
  ArrowUpRight, 
  AlertTriangle, 
  Zap,
  Sparkles 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface FeatureGateProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  hideWhenDisabled?: boolean;
  showUpgradePrompt?: boolean;
  className?: string;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({
  feature,
  children,
  fallback,
  hideWhenDisabled = false,
  showUpgradePrompt = true,
  className = '',
}) => {
  const { access, enabled } = useFeatureAccess(feature);
  const navigate = useNavigate();

  if (!enabled) {
    if (hideWhenDisabled) {
      return null;
    }

    if (fallback) {
      return <>{fallback}</>;
    }

    if (showUpgradePrompt) {
      return (
        <Card className={`border-dashed border-2 border-slate-300 ${className}`}>
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-100 to-amber-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              {FEATURE_LABELS[feature] || feature} Not Available
            </h3>
            <p className="text-slate-600 mb-4 max-w-md mx-auto">
              {FEATURE_DESCRIPTIONS[feature] || 'This feature is not included in your current plan.'}
            </p>
            <Button 
              onClick={() => navigate('/settings?tab=subscription')}
              className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
            >
              <Crown className="w-4 h-4 mr-2" />
              Upgrade Plan
              <ArrowUpRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className={`opacity-50 pointer-events-none ${className}`}>
        {children}
      </div>
    );
  }

  return <div className={className}>{children}</div>;
};

interface CreateButtonGateProps {
  feature: string;
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}

export const CreateButtonGate: React.FC<CreateButtonGateProps> = ({
  feature,
  children,
  onClick,
  className = '',
}) => {
  const { access, canCreate } = useFeatureAccess(feature);
  const navigate = useNavigate();

  const handleClick = () => {
    if (canCreate) {
      onClick();
    }
  };

  if (!access.enabled) {
    return (
      <Button
        variant="outline"
        onClick={() => navigate('/settings?tab=subscription')}
        className={`border-dashed border-amber-300 text-amber-700 hover:bg-amber-50 ${className}`}
      >
        <Lock className="w-4 h-4 mr-2" />
        Upgrade to Create
      </Button>
    );
  }

  if (!canCreate) {
    return (
      <Button
        variant="outline"
        onClick={() => navigate('/settings?tab=subscription')}
        className={`border-dashed border-red-300 text-red-700 hover:bg-red-50 ${className}`}
      >
        <AlertTriangle className="w-4 h-4 mr-2" />
        Limit Reached - Upgrade
      </Button>
    );
  }

  return (
    <div onClick={handleClick} className={className}>
      {children}
    </div>
  );
};

interface UsageBadgeProps {
  feature: string;
  showOnUnlimited?: boolean;
  className?: string;
}

export const UsageBadge: React.FC<UsageBadgeProps> = ({
  feature,
  showOnUnlimited = false,
  className = '',
}) => {
  const { access } = useFeatureAccess(feature);

  if (!access.enabled) {
    return (
      <Badge variant="outline" className={`text-slate-500 ${className}`}>
        <Lock className="w-3 h-3 mr-1" />
        Disabled
      </Badge>
    );
  }

  if (access.unlimited) {
    if (!showOnUnlimited) return null;
    return (
      <Badge className={`bg-emerald-100 text-emerald-700 border-emerald-200 ${className}`}>
        <Sparkles className="w-3 h-3 mr-1" />
        Unlimited
      </Badge>
    );
  }

  const percentage = access.limit ? (access.usage! / access.limit) * 100 : 0;
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;

  return (
    <Badge 
      variant="outline" 
      className={`${
        isAtLimit ? 'border-red-300 text-red-700' :
        isNearLimit ? 'border-amber-300 text-amber-700' :
        'border-slate-300 text-slate-700'
      } ${className}`}
    >
      {access.usage}/{access.limit}
      {isAtLimit && <AlertTriangle className="w-3 h-3 ml-1" />}
    </Badge>
  );
};

interface UsageCardProps {
  feature: string;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
}

export const UsageCard: React.FC<UsageCardProps> = ({
  feature,
  title,
  description,
  icon,
  className = '',
}) => {
  const { access } = useFeatureAccess(feature);
  const navigate = useNavigate();

  const displayTitle = title || FEATURE_LABELS[feature] || feature;
  const displayDescription = description || FEATURE_DESCRIPTIONS[feature];

  if (!access.enabled) {
    return (
      <Card className={`border-dashed border-slate-300 ${className}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {icon && <div className="text-slate-400">{icon}</div>}
              <CardTitle className="text-sm text-slate-600">{displayTitle}</CardTitle>
            </div>
            <Badge variant="outline" className="text-slate-500">
              <Lock className="w-3 h-3 mr-1" />
              Disabled
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-slate-500 mb-3">{displayDescription}</p>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => navigate('/settings?tab=subscription')}
            className="w-full border-dashed border-amber-300 text-amber-700 hover:bg-amber-50"
          >
            <Crown className="w-3 h-3 mr-1" />
            Upgrade to Enable
          </Button>
        </CardContent>
      </Card>
    );
  }

  const percentage = access.unlimited ? 0 : ((access.usage! / access.limit!) * 100);
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;

  return (
    <Card className={`${className} ${isAtLimit ? 'border-red-200' : isNearLimit ? 'border-amber-200' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon && (
              <div className={`${
                isAtLimit ? 'text-red-600' :
                isNearLimit ? 'text-amber-600' :
                'text-slate-600'
              }`}>
                {icon}
              </div>
            )}
            <CardTitle className="text-sm">{displayTitle}</CardTitle>
          </div>
          <UsageBadge feature={feature} showOnUnlimited />
        </div>
      </CardHeader>
      <CardContent>
        {!access.unlimited && (
          <div className="space-y-2 mb-3">
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Usage</span>
              <span className={`${
                isAtLimit ? 'text-red-600' :
                isNearLimit ? 'text-amber-600' :
                'text-slate-600'
              }`}>
                {access.usage}/{access.limit}
              </span>
            </div>
            <Progress 
              value={percentage} 
              className={`h-2 ${
                isAtLimit ? 'bg-red-100' :
                isNearLimit ? 'bg-amber-100' :
                'bg-slate-100'
              }`}
            />
          </div>
        )}
        
        {access.unlimited && (
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span className="text-sm text-emerald-700 font-medium">Unlimited usage</span>
          </div>
        )}

        {isAtLimit && (
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => navigate('/settings?tab=subscription')}
            className="w-full border-red-300 text-red-700 hover:bg-red-50"
          >
            <AlertTriangle className="w-3 h-3 mr-1" />
            Upgrade for More
          </Button>
        )}

        {isNearLimit && !isAtLimit && (
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => navigate('/settings?tab=subscription')}
            className="w-full border-amber-300 text-amber-700 hover:bg-amber-50"
          >
            <Zap className="w-3 h-3 mr-1" />
            Upgrade Plan
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

interface FeatureTooltipProps {
  feature: string;
  children: React.ReactNode;
}

export const FeatureTooltip: React.FC<FeatureTooltipProps> = ({
  feature,
  children,
}) => {
  const { access } = useFeatureAccess(feature);
  
  if (!access.enabled) {
    return (
      <div className="group relative inline-block">
        {children}
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block">
          <div className="bg-slate-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
            Upgrade to access {FEATURE_LABELS[feature]}
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};