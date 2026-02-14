import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface AddMilestoneSheetProps {
  onAdded: () => void;
}

export function AddMilestoneSheet({ onAdded }: AddMilestoneSheetProps) {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [stage, setStage] = useState('foundation');
  const [completion, setCompletion] = useState([0]);

  const handleSubmit = async () => {
    if (!user || !profile?.society_id || !title.trim()) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('construction_milestones')
        .insert({
          society_id: profile.society_id,
          title: title.trim(),
          description: description.trim() || null,
          stage,
          completion_percentage: completion[0],
          posted_by: user.id,
        });

      if (error) throw error;

      toast.success('Milestone added');
      setTitle('');
      setDescription('');
      setStage('foundation');
      setCompletion([0]);
      setOpen(false);
      onAdded();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add milestone');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" className="gap-1">
          <Plus size={14} /> Add Milestone
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add Construction Milestone</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-medium">Title *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., 14th Floor Slab Poured"
            />
          </div>
          <div>
            <label className="text-sm font-medium">RERA Stage</label>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="foundation">Foundation</SelectItem>
                <SelectItem value="structure">Structure</SelectItem>
                <SelectItem value="mep">MEP Works</SelectItem>
                <SelectItem value="finishing">Finishing</SelectItem>
                <SelectItem value="handover">Handover</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Completion: {completion[0]}%</label>
            <Slider
              value={completion}
              onValueChange={setCompletion}
              min={0}
              max={100}
              step={5}
              className="mt-2"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this milestone update..."
              rows={3}
            />
          </div>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !title.trim()}
            className="w-full"
          >
            {isSubmitting ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
            Post Milestone
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
