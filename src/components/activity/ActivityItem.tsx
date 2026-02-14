import { formatDistanceToNow } from 'date-fns';
import { 
  Milestone, DollarSign, AlertTriangle, Bug, FileText, 
  Radio, MessageCircle, Activity 
} from 'lucide-react';

const ACTIVITY_ICONS: Record<string, typeof Activity> = {
  milestone_posted: Milestone,
  expense_added: DollarSign,
  dispute_created: AlertTriangle,
  snag_reported: Bug,
  snag_fixed: Bug,
  document_uploaded: FileText,
  broadcast_sent: Radio,
  question_answered: MessageCircle,
};

const ACTIVITY_COLORS: Record<string, string> = {
  milestone_posted: 'bg-primary/10 text-primary',
  expense_added: 'bg-warning/10 text-warning',
  dispute_created: 'bg-destructive/10 text-destructive',
  snag_reported: 'bg-destructive/10 text-destructive',
  snag_fixed: 'bg-success/10 text-success',
  document_uploaded: 'bg-info/10 text-info',
  broadcast_sent: 'bg-destructive/10 text-destructive',
  question_answered: 'bg-primary/10 text-primary',
};

interface ActivityItemProps {
  activity: {
    id: string;
    activity_type: string;
    title: string;
    description?: string | null;
    created_at: string;
    is_system: boolean;
  };
}

export function ActivityItem({ activity }: ActivityItemProps) {
  const Icon = ACTIVITY_ICONS[activity.activity_type] || Activity;
  const colorClass = ACTIVITY_COLORS[activity.activity_type] || 'bg-muted text-muted-foreground';

  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}>
        <Icon size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight truncate">{activity.title}</p>
        {activity.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{activity.description}</p>
        )}
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}
