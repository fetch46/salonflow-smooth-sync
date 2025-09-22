import { AlertCircle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatRelativeTime } from '@/lib/saas/utils';

interface JobCardChangeAlertProps {
  jobCardNumber: string;
  clientName?: string;
  lastUpdate: string;
  onRefresh?: () => void;
  onViewJobCard?: () => void;
}

export function JobCardChangeAlert({ 
  jobCardNumber, 
  clientName, 
  lastUpdate,
  onRefresh,
  onViewJobCard 
}: JobCardChangeAlertProps) {
  return (
    <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertDescription className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-medium text-amber-800 dark:text-amber-200">
              Job Card quantities have changed
            </span>
            <div className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              Job Card <Badge variant="outline" className="text-xs">{jobCardNumber}</Badge>
              {clientName && <span> for {clientName}</span>} was updated {formatRelativeTime(new Date(lastUpdate))}.
              The invoice amounts may need adjustment.
            </div>
          </div>
          <div className="flex gap-2">
            {onViewJobCard && (
              <Button
                variant="outline"
                size="sm"
                onClick={onViewJobCard}
                className="text-amber-700 border-amber-300 hover:bg-amber-100 dark:text-amber-300 dark:border-amber-700 dark:hover:bg-amber-900/30"
              >
                View Job Card
              </Button>
            )}
            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                className="text-amber-700 border-amber-300 hover:bg-amber-100 dark:text-amber-300 dark:border-amber-700 dark:hover:bg-amber-900/30"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Refresh
              </Button>
            )}
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}