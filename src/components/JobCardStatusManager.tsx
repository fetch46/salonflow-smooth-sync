import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CheckCircle, Clock, PlayCircle } from 'lucide-react';

interface JobCardStatusManagerProps {
  jobCardId: string;
  currentStatus: string;
  onStatusChange?: (newStatus: string) => void;
}

const statusOptions = [
  { value: 'in_progress', label: 'In Progress', icon: PlayCircle, color: 'bg-blue-500' },
  { value: 'completed', label: 'Completed', icon: CheckCircle, color: 'bg-green-500' },
  { value: 'closed', label: 'Closed', icon: Clock, color: 'bg-gray-500' }
];

export default function JobCardStatusManager({ jobCardId, currentStatus, onStatusChange }: JobCardStatusManagerProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStatusUpdate = async (newStatus: string) => {
    if (newStatus === currentStatus) return;
    
    setIsUpdating(true);
    try {
      const updateData: any = { status: newStatus };
      
      // Set end_time when completing
      if (newStatus === 'completed' && currentStatus !== 'completed') {
        updateData.end_time = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from('job_cards')
        .update(updateData)
        .eq('id', jobCardId);

      if (error) throw error;

      // Show appropriate message based on status change
      if (newStatus === 'completed') {
        toast.success('Job card completed! Inventory has been automatically deducted.');
      } else if (newStatus === 'closed') {
        toast.success('Job card closed.');
      } else {
        toast.success('Status updated successfully.');
      }

      onStatusChange?.(newStatus);
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast.error(error.message || 'Failed to update status');
    } finally {
      setIsUpdating(false);
    }
  };

  const currentOption = statusOptions.find(opt => opt.value === currentStatus);
  const Icon = currentOption?.icon || Clock;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-full ${currentOption?.color || 'bg-gray-500'}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <Badge variant="outline" className="text-sm">
          {currentOption?.label || currentStatus}
        </Badge>
      </div>
      
      <Select value={currentStatus} onValueChange={handleStatusUpdate} disabled={isUpdating}>
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((option) => {
            const OptionIcon = option.icon;
            return (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex items-center gap-2">
                  <div className={`p-1 rounded-full ${option.color}`}>
                    <OptionIcon className="w-3 h-3 text-white" />
                  </div>
                  {option.label}
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}