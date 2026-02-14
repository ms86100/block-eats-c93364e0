import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { CheckCircle2, Clock, AlertTriangle, Plus } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

interface MaintenanceDue {
  id: string;
  flat_identifier: string;
  month: string;
  amount: number;
  status: string;
  paid_date: string | null;
  created_at: string;
}

export default function MaintenancePage() {
  const { user, profile, isAdmin, effectiveSocietyId } = useAuth();
  const [dues, setDues] = useState<MaintenanceDue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [generateMonth, setGenerateMonth] = useState('');
  const [generateAmount, setGenerateAmount] = useState('');
  const [generating, setGenerating] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    fetchDues();
  }, [user, profile]);

  const fetchDues = async () => {
    if (!effectiveSocietyId) return;
    const { data } = await supabase
      .from('maintenance_dues')
      .select('*')
      .eq('society_id', effectiveSocietyId)
      .order('month', { ascending: false })
      .limit(100);
    setDues((data as any) || []);
    setIsLoading(false);
  };

  const handleMarkPaid = async (id: string) => {
    const { error } = await supabase
      .from('maintenance_dues')
      .update({ status: 'paid', paid_date: new Date().toISOString().split('T')[0] })
      .eq('id', id);
    if (error) { toast.error('Failed to update'); return; }
    toast.success('Marked as paid');
    fetchDues();
  };

  const handleBulkGenerate = async () => {
    if (!generateMonth || !generateAmount || !profile?.society_id) return;
    setGenerating(true);
    try {
      // Get all approved residents
      const { data: residents } = await supabase
        .from('profiles')
        .select('id, block, flat_number')
        .eq('society_id', profile.society_id)
        .eq('verification_status', 'approved');

      if (!residents?.length) { toast.error('No approved residents found'); return; }

      const rows = residents.map(r => ({
        society_id: profile.society_id!,
        flat_identifier: `${r.block}-${r.flat_number}`,
        resident_id: r.id,
        month: generateMonth,
        amount: parseFloat(generateAmount),
        status: 'pending',
      }));

      const { error } = await supabase.from('maintenance_dues').insert(rows as any);
      if (error) throw error;
      toast.success(`Generated dues for ${rows.length} flats`);
      setSheetOpen(false);
      setGenerateMonth('');
      setGenerateAmount('');
      fetchDues();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const statusIcon = (status: string) => {
    if (status === 'paid') return <CheckCircle2 size={14} className="text-success" />;
    if (status === 'overdue') return <AlertTriangle size={14} className="text-destructive" />;
    return <Clock size={14} className="text-warning" />;
  };

  const statusBadge = (status: string) => {
    const variant = status === 'paid' ? 'default' : status === 'overdue' ? 'destructive' : 'secondary';
    return <Badge variant={variant} className="text-[10px]">{status}</Badge>;
  };

  // For residents, show only their own dues
  const displayDues = isAdmin ? dues : dues.filter(d => (d as any).resident_id === user?.id);

  return (
    <AppLayout headerTitle="Maintenance" showLocation={false}>
      <div className="p-4 space-y-4">
        {isAdmin && (
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button className="w-full gap-2">
                <Plus size={16} /> Generate Monthly Dues
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl">
              <SheetHeader>
                <SheetTitle>Generate Monthly Dues</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <label className="text-sm font-medium">Month (YYYY-MM)</label>
                  <Input 
                    value={generateMonth} 
                    onChange={e => setGenerateMonth(e.target.value)} 
                    placeholder="2026-02" 
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Amount per flat (₹)</label>
                  <Input 
                    type="number" 
                    value={generateAmount} 
                    onChange={e => setGenerateAmount(e.target.value)} 
                    placeholder="5000" 
                  />
                </div>
                <Button className="w-full" disabled={generating || !generateMonth || !generateAmount} onClick={handleBulkGenerate}>
                  {generating ? 'Generating...' : 'Generate for All Flats'}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        )}

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : displayDues.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="font-medium">No maintenance records</p>
            <p className="text-sm mt-1">Records will appear here once generated</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayDues.map(d => (
              <Card key={d.id}>
                <CardContent className="p-4 flex items-center gap-3">
                  {statusIcon(d.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{d.flat_identifier}</p>
                      {statusBadge(d.status)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {d.month} · ₹{d.amount.toLocaleString()}
                      {d.paid_date && ` · Paid ${d.paid_date}`}
                    </p>
                  </div>
                  {isAdmin && d.status !== 'paid' && (
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => handleMarkPaid(d.id)}>
                      Mark Paid
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
