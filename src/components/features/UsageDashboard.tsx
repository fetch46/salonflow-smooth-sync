import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useFeatureGating } from '@/hooks/useFeatureGating';
import { useSaas } from '@/lib/saas/context';
import { FEATURE_LABELS, FEATURE_CATEGORIES } from '@/lib/features';
import { 
  Users, 
  Calendar, 
  Scissors, 
  Package, 
  Building, 
  CreditCard,
  Crown, 
  AlertTriangle, 
  Sparkles,
  TrendingUp,
  ArrowUpRight,
  Clock,
  Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface UsageDashboardProps {
  className?: string;
  showUpgrade?: boolean;
  compact?: boolean;
}

export const UsageDashboard: React.FC<UsageDashboardProps> = ({
  className = '',
  showUpgrade = true,
  compact = false,
}) => {
  const navigate = useNavigate();
  const { getFeatureAccess, usageData, loading } = useFeatureGating();
  const { 
    subscriptionPlan, 
    isTrialing, 
    daysLeftInTrial,
    isSubscriptionActive 
  } = useSaas();

  const coreFeatures = ['clients', 'staff', 'services', 'appointments'];
  
  const getFeatureIcon = (feature: string) => {
    switch (feature) {
      case 'clients': return <Users className="w-4 h-4" />;
      case 'staff': return <Users className="w-4 h-4" />;
      case 'services': return <Scissors className="w-4 h-4" />;
      case 'appointments': return <Calendar className="w-4 h-4" />;
      case 'suppliers': return <Building className="w-4 h-4" />;
      case 'inventory': return <Package className="w-4 h-4" />;
      default: return <Sparkles className="w-4 h-4" />;
    }
  };

  const getUsageStatus = (feature: string) => {
    const access = getFeatureAccess(feature);
    
    if (!access.enabled) {
      return { status: 'disabled', color: 'slate', message: 'Not available' };
    }
    
    if (access.unlimited) {
      return { status: 'unlimited', color: 'emerald', message: 'Unlimited' };
    }
    
    if (access.usage !== undefined && access.limit) {
      const percentage = (access.usage / access.limit) * 100;
      
      if (percentage >= 100) {
        return { status: 'full', color: 'red', message: 'Limit reached' };
      } else if (percentage >= 80) {
        return { status: 'warning', color: 'amber', message: 'Near limit' };
      } else {
        return { status: 'good', color: 'green', message: 'Available' };
      }
    }
    
    return { status: 'good', color: 'green', message: 'Available' };
  };

  const featuresNeedingAttention = coreFeatures.filter(feature => {
    const status = getUsageStatus(feature);
    return status.status === 'full' || status.status === 'warning';
  });

  const disabledFeatures = coreFeatures.filter(feature => {
    const access = getFeatureAccess(feature);
    return !access.enabled;
  });

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-slate-200 rounded w-1/3"></div>
            <div className="h-8 bg-slate-200 rounded w-1/2"></div>
            <div className="h-2 bg-slate-200 rounded w-full"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Usage Overview</span>
            {isTrialing && daysLeftInTrial !== null && (
              <Badge variant="outline" className="text-xs">
                <Clock className="w-3 h-3 mr-1" />
                {daysLeftInTrial}d trial
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {coreFeatures.map(feature => {
            const access = getFeatureAccess(feature);
            const status = getUsageStatus(feature);
            
            if (!access.enabled) return null;
            
            return (
              <div key={feature} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getFeatureIcon(feature)}
                  <span className="text-sm capitalize">{feature}</span>
                </div>
                <div className="flex items-center gap-2">
                  {access.unlimited ? (
                    <Badge className="text-xs bg-emerald-100 text-emerald-700">
                      <Sparkles className="w-2 h-2 mr-1" />
                      ∞
                    </Badge>
                  ) : (
                    <span className={`text-xs ${
                      status.status === 'full' ? 'text-red-600' :
                      status.status === 'warning' ? 'text-amber-600' :
                      'text-slate-600'
                    }`}>
                      {access.usage}/{access.limit}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          
          {(featuresNeedingAttention.length > 0 || disabledFeatures.length > 0) && showUpgrade && (
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => navigate('/settings?tab=subscription')}
              className="w-full mt-3 border-violet-300 text-violet-700 hover:bg-violet-50"
            >
              <Crown className="w-3 h-3 mr-1" />
              Upgrade Plan
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {coreFeatures.map(feature => {
          const access = getFeatureAccess(feature);
          const status = getUsageStatus(feature);
          const percentage = access.unlimited ? 0 : access.limit ? (access.usage! / access.limit) * 100 : 0;
          
          return (
            <Card 
              key={feature} 
              className={`border-l-4 ${
                status.status === 'disabled' ? 'border-l-slate-400 bg-slate-50' :
                status.status === 'full' ? 'border-l-red-500 bg-red-50' :
                status.status === 'warning' ? 'border-l-amber-500 bg-amber-50' :
                'border-l-emerald-500'
              }`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getFeatureIcon(feature)}
                    <CardTitle className="text-sm capitalize">
                      {FEATURE_LABELS[feature] || feature}
                    </CardTitle>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${
                      status.status === 'disabled' ? 'text-slate-500' :
                      status.status === 'full' ? 'text-red-700 border-red-300' :
                      status.status === 'warning' ? 'text-amber-700 border-amber-300' :
                      'text-emerald-700 border-emerald-300'
                    }`}
                  >
                    {status.message}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {access.enabled ? (
                  <>
                    <div className="text-2xl font-bold mb-2">
                      {access.unlimited ? '∞' : access.usage}
                      {!access.unlimited && <span className="text-sm text-slate-500">/{access.limit}</span>}
                    </div>
                    {!access.unlimited && (
                      <Progress value={percentage} className="h-2" />
                    )}
                    {access.unlimited && (
                      <div className="flex items-center gap-1 text-emerald-600">
                        <Sparkles className="w-3 h-3" />
                        <span className="text-xs">Unlimited usage</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-4">
                    <div className="text-slate-400 mb-2">Feature disabled</div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => navigate('/settings?tab=subscription')}
                      className="border-violet-300 text-violet-700 hover:bg-violet-50"
                    >
                      Upgrade
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Plan Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Subscription Details</span>
            {subscriptionPlan && (
              <Badge className={`${
                subscriptionPlan.slug === 'enterprise' ? 'bg-amber-100 text-amber-800' :
                subscriptionPlan.slug === 'professional' ? 'bg-purple-100 text-purple-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {subscriptionPlan.name}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isTrialing && daysLeftInTrial !== null && (
            <div className={`p-4 rounded-lg border ${
              daysLeftInTrial <= 3 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className={`font-medium ${
                    daysLeftInTrial <= 3 ? 'text-red-800' : 'text-amber-800'
                  }`}>
                    Trial Period
                  </h4>
                  <p className={`text-sm ${
                    daysLeftInTrial <= 3 ? 'text-red-600' : 'text-amber-600'
                  }`}>
                    {daysLeftInTrial} days remaining in your free trial
                  </p>
                </div>
                <Button 
                  onClick={() => navigate('/settings?tab=subscription')}
                  className={`${
                    daysLeftInTrial <= 3 ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  <Crown className="w-4 h-4 mr-2" />
                  Choose Plan
                </Button>
              </div>
            </div>
          )}

          {featuresNeedingAttention.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h4 className="font-medium text-amber-800">Attention Required</h4>
              </div>
              <p className="text-sm text-amber-700 mb-3">
                {featuresNeedingAttention.length} feature{featuresNeedingAttention.length > 1 ? 's' : ''} 
                {' '}near or at limit: {featuresNeedingAttention.join(', ')}
              </p>
              <Button 
                size="sm"
                onClick={() => navigate('/settings?tab=subscription')}
                className="bg-amber-600 hover:bg-amber-700"
              >
                <TrendingUp className="w-3 h-3 mr-1" />
                Upgrade Now
              </Button>
            </div>
          )}

          {disabledFeatures.length > 0 && showUpgrade && (
            <div className="p-4 bg-violet-50 border border-violet-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-violet-600" />
                <h4 className="font-medium text-violet-800">Unlock More Features</h4>
              </div>
              <p className="text-sm text-violet-700 mb-3">
                {disabledFeatures.length} feature{disabledFeatures.length > 1 ? 's' : ''} 
                {' '}available with upgrade: {disabledFeatures.map(f => FEATURE_LABELS[f] || f).join(', ')}
              </p>
              <Button 
                size="sm"
                onClick={() => navigate('/settings?tab=subscription')}
                className="bg-violet-600 hover:bg-violet-700"
              >
                <Crown className="w-3 h-3 mr-1" />
                See Plans
                <ArrowUpRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};