import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { notifySocietyMembers } from '@/lib/society-notifications';
import { Megaphone, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const BROADCAST_CATEGORIES = [
  { value: 'water_shutdown', label: '💧 Water Shutdown', emoji: '💧' },
  { value: 'power_outage', label: '⚡ Power Outage', emoji: '⚡' },
  { value: 'security_alert', label: '🚨 Security Alert', emoji: '🚨' },
  { value: 'maintenance', label: '🔧 Maintenance', emoji: '🔧' },
  { value: 'fire_drill', label: '🔥 Fire Drill', emoji: '🔥' },
  { value: 'general', label: '📢 General', emoji: '📢' },
];

export function EmergencyBroadcastSheet() {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [category, setCategory] = useState('general');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const handleSend = async () => {
    if (!user || !profile?.society_id || !title.trim() || !body.trim()) return;
    setSending(true);

    try {
      const cat = BROADCAST_CATEGORIES.find(c => c.value === category);
      const emoji = cat?.emoji || '📢';

      // Save to database
      const { error } = await supabase.from('emergency_broadcasts').insert({
        society_id: profile.society_id,
        sent_by: user.id,
        category,
        title: title.trim(),
        body: body.trim(),
      } as any);

      if (error) throw error;

      // Send push to ALL society members
      await notifySocietyMembers(
        profile.society_id,
        `${emoji} ${title.trim()}`,
        body.trim(),
        { type: 'broadcast', category }
      );

      toast.success('Broadcast sent to all residents');
      setTitle('');
      setBody('');
      setCategory('general');
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send broadcast');
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="destructive" size="sm" className="gap-1.5">
          <Megaphone size={14} />
          Emergency Broadcast
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <AlertTriangle className="text-destructive" size={18} />
            Emergency Broadcast
          </SheetTitle>
        </SheetHeader>
        <p className="text-xs text-muted-foreground mt-1">
          This will send a push notification to ALL residents in your society.
        </p>
        <div className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-medium">Category</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BROADCAST_CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Title *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Water supply disruption in Tower B"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Message *</label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Provide details — timing, affected areas, expected resolution..."
              rows={4}
            />
          </div>
          <Button
            variant="destructive"
            onClick={handleSend}
            disabled={sending || !title.trim() || !body.trim()}
            className="w-full"
          >
            {sending ? <Loader2 className="animate-spin mr-2" size={16} /> : <Megaphone size={16} className="mr-2" />}
            Send to All Residents
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
