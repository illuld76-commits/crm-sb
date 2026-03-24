import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface StatusMarkerProps {
  planId: string;
  currentStatus: string;
  onStatusChange?: (newStatus: string) => void;
  readOnly?: boolean;
}

const STATUS_OPTIONS = [
  { value: 'published', label: 'Published', color: 'bg-primary text-primary-foreground' },
  { value: 'ongoing', label: 'Ongoing', color: 'bg-info text-info-foreground' },
  { value: 'hold', label: 'On Hold', color: 'bg-warning text-warning-foreground' },
  { value: 'approved', label: 'Approved', color: 'bg-success text-success-foreground' },
  { value: 'rejected', label: 'Rejected', color: 'bg-destructive text-destructive-foreground' },
];

export default function StatusMarker({ planId, currentStatus, onStatusChange, readOnly = false }: StatusMarkerProps) {
  const statusConfig = STATUS_OPTIONS.find(s => s.value === currentStatus) || STATUS_OPTIONS[0];

  const handleStatusChange = async (newStatus: string) => {
    const { error } = await supabase
      .from('treatment_plans')
      .update({ status: newStatus })
      .eq('id', planId);

    if (error) {
      toast.error('Failed to update status');
      return;
    }

    toast.success(`Status updated to ${newStatus}`);
    onStatusChange?.(newStatus);
  };

  if (readOnly) {
    return (
      <Badge className={`text-xs ${statusConfig.color}`}>
        {statusConfig.label}
      </Badge>
    );
  }

  return (
    <Select value={currentStatus} onValueChange={handleStatusChange}>
      <SelectTrigger className="w-[120px] h-7 text-xs">
        <SelectValue>
          <Badge className={`text-xs ${statusConfig.color}`}>
            {statusConfig.label}
          </Badge>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map(option => (
          <SelectItem key={option.value} value={option.value}>
            <Badge className={`text-xs ${option.color}`}>{option.label}</Badge>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
