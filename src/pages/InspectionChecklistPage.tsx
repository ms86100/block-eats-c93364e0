import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ImageUpload } from '@/components/ui/image-upload';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger
} from '@/components/ui/sheet';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  ClipboardCheck, Plus, CheckCircle, XCircle, MinusCircle, AlertTriangle,
  Camera, Send, Zap, Droplets, Hammer, PaintBucket, DoorOpen, ChefHat, Bath
} from 'lucide-react';

interface InspectionChecklist {
  id: string;
  flat_number: string;
  inspection_date: string | null;
  status: string;
  overall_score: number;
  total_items: number;
  passed_items: number;
  failed_items: number;
  notes: string | null;
  submitted_at: string | null;
  created_at: string;
}

interface InspectionItem {
  id: string;
  checklist_id: string;
  category: string;
  item_name: string;
  description: string | null;
  status: string;
  severity: string;
  photo_urls: string[];
  notes: string | null;
  display_order: number;
}

const INSPECTION_CATEGORIES = [
  { key: 'electrical', label: 'Electrical', icon: Zap },
  { key: 'plumbing', label: 'Plumbing', icon: Droplets },
  { key: 'civil', label: 'Civil Work', icon: Hammer },
  { key: 'painting', label: 'Painting', icon: PaintBucket },
  { key: 'doors_windows', label: 'Doors & Windows', icon: DoorOpen },
  { key: 'kitchen', label: 'Kitchen', icon: ChefHat },
  { key: 'bathroom', label: 'Bathroom', icon: Bath },
  { key: 'flooring', label: 'Flooring', icon: Hammer },
];

const DEFAULT_ITEMS: Record<string, string[]> = {
  electrical: [
    'All switches working', 'All socket points functional', 'MCB panel installed properly',
    'Earthing connection verified', 'Light fixtures working', 'Fan points functional',
    'AC points functional', 'Geyser point working', 'Doorbell working', 'Intercom functional',
  ],
  plumbing: [
    'No water leakage in taps', 'Hot/cold water supply working', 'Toilet flush working',
    'Wash basin drainage clear', 'No seepage on walls', 'Water pressure adequate',
    'Overhead tank supply OK', 'Balcony drain functional', 'Kitchen sink drainage',
  ],
  civil: [
    'No cracks on walls', 'No cracks on ceiling', 'Proper wall plastering',
    'No dampness/seepage', 'Skirting properly done', 'Balcony railing secure',
    'Proper slope for water drainage', 'Window sills intact',
  ],
  painting: [
    'Even paint finish on walls', 'No paint drips/marks', 'Ceiling paint uniform',
    'Paint color as per specification', 'No patches or unfinished areas', 'Primer visible under paint',
  ],
  doors_windows: [
    'Main door lock working', 'All room doors close properly', 'Door handles firm',
    'Window latches working', 'No gaps in window frames', 'Mosquito mesh installed',
    'Sliding doors smooth', 'Balcony door lock working', 'Peephole working',
  ],
  kitchen: [
    'Kitchen platform installed', 'Sink properly fitted', 'Chimney point available',
    'Gas pipeline connection', 'Electrical points above platform', 'Cabinet fittings secure',
    'Tiles properly grouted', 'Water supply in kitchen',
  ],
  bathroom: [
    'Tiles properly laid', 'No leakage from shower', 'Proper slope for drainage',
    'Mirror fitted properly', 'Towel rod installed', 'Soap dish installed',
    'Exhaust fan working', 'Hot water supply working', 'Commode flush working',
  ],
  flooring: [
    'No hollow tiles (tap test)', 'Uniform tile joints', 'No cracked tiles',
    'Proper grouting', 'Level flooring', 'Threshold strips installed',
  ],
};

export default function InspectionChecklistPage() {
  const { user, profile, effectiveSocietyId } = useAuth();
  const [checklists, setChecklists] = useState<InspectionChecklist[]>([]);
  const [activeChecklist, setActiveChecklist] = useState<InspectionChecklist | null>(null);
  const [items, setItems] = useState<InspectionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('electrical');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (effectiveSocietyId && user) fetchChecklists();
  }, [effectiveSocietyId, user]);

  const fetchChecklists = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('inspection_checklists')
      .select('*')
      .eq('resident_id', user!.id)
      .order('created_at', { ascending: false });
    setChecklists((data as InspectionChecklist[]) || []);
    if (data && data.length > 0) {
      setActiveChecklist(data[0] as InspectionChecklist);
      fetchItems(data[0].id);
    } else {
      setIsLoading(false);
    }
  };

  const fetchItems = async (checklistId: string) => {
    const { data } = await supabase
      .from('inspection_items')
      .select('*')
      .eq('checklist_id', checklistId)
      .order('display_order');
    setItems((data as InspectionItem[]) || []);
    setIsLoading(false);
  };

  const createChecklist = async () => {
    if (!user || !effectiveSocietyId) return;
    setIsCreating(true);

    const { data: checklist, error } = await supabase
      .from('inspection_checklists')
      .insert({
        society_id: effectiveSocietyId,
        resident_id: user.id,
        flat_number: profile?.flat_number || 'Unknown',
        inspection_date: new Date().toISOString().split('T')[0],
        status: 'draft',
        total_items: Object.values(DEFAULT_ITEMS).flat().length,
      })
      .select()
      .single();

    if (error || !checklist) {
      toast.error('Failed to create checklist');
      setIsCreating(false);
      return;
    }

    // Insert all default items
    const allItems = Object.entries(DEFAULT_ITEMS).flatMap(([category, itemNames]) =>
      itemNames.map((name, idx) => ({
        checklist_id: checklist.id,
        category,
        item_name: name,
        status: 'not_checked',
        severity: 'minor',
        display_order: idx,
      }))
    );

    const { error: itemsError } = await supabase.from('inspection_items').insert(allItems);
    if (itemsError) {
      toast.error('Failed to create checklist items');
    } else {
      toast.success('Inspection checklist created!');
      fetchChecklists();
    }
    setIsCreating(false);
  };

  const updateItemStatus = async (itemId: string, newStatus: string) => {
    if (!activeChecklist) return;
    const { error } = await supabase
      .from('inspection_items')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', itemId)
      .eq('checklist_id', activeChecklist.id);

    if (!error) {
      setItems(prev => prev.map(item =>
        item.id === itemId ? { ...item, status: newStatus } : item
      ));
      // Update counts
      const updated = items.map(item => item.id === itemId ? { ...item, status: newStatus } : item);
      const passed = updated.filter(i => i.status === 'pass').length;
      const failed = updated.filter(i => i.status === 'fail').length;
      await supabase.from('inspection_checklists').update({
        passed_items: passed,
        failed_items: failed,
        overall_score: Math.round((passed / updated.length) * 100),
        status: 'in_progress',
      }).eq('id', activeChecklist.id).eq('resident_id', user!.id);
    }
  };

  const updateItemNotes = async (itemId: string, notes: string) => {
    if (!activeChecklist) return;
    await supabase.from('inspection_items')
      .update({ notes })
      .eq('id', itemId)
      .eq('checklist_id', activeChecklist.id);
    setItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, notes } : item
    ));
  };

  const submitChecklist = async () => {
    if (!activeChecklist || !user) return;
    const { error } = await supabase
      .from('inspection_checklists')
      .update({ status: 'submitted', submitted_at: new Date().toISOString() })
      .eq('id', activeChecklist.id)
      .eq('resident_id', user.id);
    if (!error) {
      toast.success('Checklist submitted to builder!');
      fetchChecklists();
    }
  };

  const categoryItems = items.filter(i => i.category === activeCategory);
  const totalChecked = items.filter(i => i.status !== 'not_checked').length;
  const passedCount = items.filter(i => i.status === 'pass').length;
  const failedCount = items.filter(i => i.status === 'fail').length;
  const progressPercent = items.length > 0 ? Math.round((totalChecked / items.length) * 100) : 0;

  if (isLoading) {
    return (
      <AppLayout headerTitle="Inspection Checklist" showLocation={false}>
        <div className="p-4 space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!activeChecklist) {
    return (
      <AppLayout headerTitle="Inspection Checklist" showLocation={false}>
        <div className="p-4 flex flex-col items-center justify-center min-h-[60vh] text-center">
          <ClipboardCheck className="text-primary mb-4" size={48} />
          <h2 className="text-lg font-semibold">Pre-Handover Inspection</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-xs">
            Create a detailed inspection checklist to verify your flat before possession. Cover 70+ items across electrical, plumbing, civil work, and more.
          </p>
          <Button className="mt-6" onClick={createChecklist} disabled={isCreating}>
            {isCreating ? 'Creating...' : 'Start Inspection'}
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout headerTitle="Inspection Checklist" showLocation={false}>
      <div className="p-4 space-y-4">
        {/* Progress Overview */}
        <Card className="border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-semibold">Flat {activeChecklist.flat_number}</p>
                <p className="text-xs text-muted-foreground">
                  {activeChecklist.inspection_date && new Date(activeChecklist.inspection_date).toLocaleDateString('en-IN')}
                </p>
              </div>
              <Badge variant="outline" className={
                activeChecklist.status === 'submitted' ? 'bg-success/10 text-success' :
                activeChecklist.status === 'in_progress' ? 'bg-warning/10 text-warning' :
                'bg-muted text-muted-foreground'
              }>
                {activeChecklist.status.replace('_', ' ')}
              </Badge>
            </div>
            <Progress value={progressPercent} className="h-2 mb-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{totalChecked}/{items.length} checked</span>
              <div className="flex gap-3">
                <span className="text-success flex items-center gap-0.5"><CheckCircle size={10} /> {passedCount}</span>
                <span className="text-destructive flex items-center gap-0.5"><XCircle size={10} /> {failedCount}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Category Tabs */}
        <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
          <div className="flex gap-2 min-w-max">
            {INSPECTION_CATEGORIES.map(({ key, label, icon: Icon }) => {
              const catItems = items.filter(i => i.category === key);
              const catFailed = catItems.filter(i => i.status === 'fail').length;
              return (
                <button
                  key={key}
                  onClick={() => setActiveCategory(key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    activeCategory === key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  <Icon size={14} />
                  {label}
                  {catFailed > 0 && (
                    <span className="bg-destructive text-destructive-foreground rounded-full w-4 h-4 text-[10px] flex items-center justify-center">
                      {catFailed}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Items List */}
        <div className="space-y-2">
          {categoryItems.map(item => (
            <Card key={item.id} className={
              item.status === 'fail' ? 'border-destructive/30' :
              item.status === 'pass' ? 'border-success/30' : ''
            }>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.item_name}</p>
                    {item.notes && (
                      <p className="text-xs text-muted-foreground mt-0.5">{item.notes}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => updateItemStatus(item.id, 'pass')}
                      className={`p-1.5 rounded-lg transition-colors ${
                        item.status === 'pass' ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <CheckCircle size={18} />
                    </button>
                    <button
                      onClick={() => updateItemStatus(item.id, 'fail')}
                      className={`p-1.5 rounded-lg transition-colors ${
                        item.status === 'fail' ? 'bg-destructive/20 text-destructive' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <XCircle size={18} />
                    </button>
                    <button
                      onClick={() => updateItemStatus(item.id, 'na')}
                      className={`p-1.5 rounded-lg transition-colors ${
                        item.status === 'na' ? 'bg-muted text-foreground' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <MinusCircle size={18} />
                    </button>
                  </div>
                </div>

                {item.status === 'fail' && (
                  <div className="mt-2 space-y-2">
                    <Textarea
                      className="text-xs h-16"
                      placeholder="Describe the issue..."
                      value={item.notes || ''}
                      onChange={e => updateItemNotes(item.id, e.target.value)}
                    />
                    <ImageUpload
                      value={item.photo_urls?.[0] || null}
                      onChange={async (url) => {
                        if (!activeChecklist || !url) return;
                        const newPhotos = [...(item.photo_urls || []), url];
                        await supabase.from('inspection_items')
                          .update({ photo_urls: newPhotos } as any)
                          .eq('id', item.id);
                        setItems(prev => prev.map(i => i.id === item.id ? { ...i, photo_urls: newPhotos } : i));
                      }}
                      folder="inspection"
                      userId={user?.id || ''}
                    />
                    {item.photo_urls && item.photo_urls.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {item.photo_urls.map((url, i) => (
                          <img key={i} src={url} alt={`Issue ${i + 1}`} className="w-12 h-12 rounded object-cover border border-border" />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Submit Button */}
        {activeChecklist.status !== 'submitted' && totalChecked > 0 && (
          <Button className="w-full" onClick={submitChecklist}>
            <Send size={16} className="mr-2" />
            Submit Inspection Report ({failedCount} issues found)
          </Button>
        )}

        {/* Convert failed items to snags */}
        {activeChecklist.status === 'submitted' && failedCount > 0 && (
          <Button
            variant="destructive"
            className="w-full"
            onClick={async () => {
              if (!user || !effectiveSocietyId) return;
              const failedItems = items.filter(i => i.status === 'fail');
              const snags = failedItems.map(item => ({
                society_id: effectiveSocietyId,
                flat_number: activeChecklist.flat_number,
                reported_by: user.id,
                category: item.category,
                description: `${item.item_name}${item.notes ? ': ' + item.notes : ''}`,
                photo_urls: item.photo_urls || [],
                status: 'open',
                sla_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              }));
              const { error } = await supabase.from('snag_tickets').insert(snags);
              if (error) {
                toast.error('Failed to create snag tickets');
                console.error(error);
              } else {
                toast.success(`${failedItems.length} snag tickets created!`);
              }
            }}
          >
            <AlertTriangle size={16} className="mr-2" />
            Convert {failedCount} Failed Items to Snag Tickets
          </Button>
        )}
      </div>
    </AppLayout>
  );
}
