import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { friendlyError } from '@/lib/utils';
import { Package, Plus, CheckCircle, Clock, PackageOpen } from 'lucide-react';

type ParcelStatus = 'received' | 'notified' | 'collected' | 'returned';

const statusConfig: Record<ParcelStatus, { label: string; color: string }> = {
  received: { label: 'Received', color: 'bg-warning/10 text-warning' },
  notified: { label: 'Notified', color: 'bg-info/10 text-info' },
  collected: { label: 'Collected', color: 'bg-success/10 text-success' },
  returned: { label: 'Returned', color: 'bg-muted text-muted-foreground' },
};

interface ParcelEntry {
  id: string;
  courier_name: string | null;
  tracking_number: string | null;
  description: string | null;
  status: ParcelStatus;
  received_at: string;
  collected_at: string | null;
  collected_by: string | null;
  flat_number: string | null;
  created_at: string;
}

export default function ParcelManagementPage() {
  const { user, profile, effectiveSocietyId, isSocietyAdmin, isAdmin } = useAuth();
  const [parcels, setParcels] = useState<ParcelEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');

  // Form
  const [courierName, setCourierName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canLogParcels = isSocietyAdmin || isAdmin;

  const fetchParcels = useCallback(async () => {
    if (!effectiveSocietyId || !user) return;
    setIsLoading(true);

    let query = supabase.from('parcel_entries').select('*')
      .eq('resident_id', user.id)
      .order('created_at', { ascending: false });

    if (activeTab === 'pending') {
      query = query.in('status', ['received', 'notified']);
    } else {
      query = query.in('status', ['collected', 'returned']);
    }

    const { data, error } = await query.limit(50);
    if (error) {
      toast.error('Could not load parcels. Please try again.');
      console.error(error);
    }
    setParcels((data as ParcelEntry[]) || []);
    setIsLoading(false);
  }, [effectiveSocietyId, user, activeTab]);

  useEffect(() => { fetchParcels(); }, [fetchParcels]);

  const handleAddParcel = async () => {
    if (!user || !effectiveSocietyId) return;
    setIsSubmitting(true);

    const { error } = await supabase.from('parcel_entries').insert({
      society_id: effectiveSocietyId,
      resident_id: user.id,
      courier_name: courierName || null,
      tracking_number: trackingNumber || null,
      description: description || null,
      flat_number: profile?.flat_number || null,
      status: 'received',
    });

    if (error) {
      toast.error(friendlyError(error));
      console.error(error);
    } else {
      toast.success('Parcel logged');
      setIsAddOpen(false);
      setCourierName(''); setTrackingNumber(''); setDescription('');
      fetchParcels();
    }
    setIsSubmitting(false);
  };

  const handleCollect = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from('parcel_entries')
      .update({
        status: 'collected',
        collected_at: new Date().toISOString(),
        collected_by: profile?.name || 'Resident',
      })
      .eq('id', id)
      .eq('resident_id', user.id);
    if (!error) { toast.success('Parcel marked as collected'); fetchParcels(); }
  };

  const pendingCount = parcels.filter(p => p.status === 'received' || p.status === 'notified').length;

  return (
    <AppLayout headerTitle="Parcels & Deliveries" showLocation={false}>
      <div className="p-4 space-y-4">
        {/* Summary */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Package className="text-primary" size={24} />
              </div>
              <div>
                <p className="font-semibold">Pending Parcels</p>
                <p className="text-2xl font-bold text-primary">{activeTab === 'pending' ? parcels.length : pendingCount}</p>
              </div>
            </div>
            <Sheet open={isAddOpen} onOpenChange={setIsAddOpen}>
              <SheetTrigger asChild>
                <Button size="sm"><Plus size={16} className="mr-1" /> Log</Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Log a Parcel</SheetTitle>
                  <SheetDescription>Record a delivery for tracking</SheetDescription>
                </SheetHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label>Courier / Platform</Label>
                    <Input value={courierName} onChange={e => setCourierName(e.target.value)} placeholder="e.g., Amazon, Flipkart, Swiggy" />
                  </div>
                  <div>
                    <Label>Tracking Number</Label>
                    <Input value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)} placeholder="Optional" />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g., Small brown box" />
                  </div>
                  <Button onClick={handleAddParcel} disabled={isSubmitting} className="w-full">
                    {isSubmitting ? 'Logging...' : 'Log Parcel'}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="pending" className="text-xs">Pending</TabsTrigger>
            <TabsTrigger value="history" className="text-xs">Collected</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-3 space-y-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
            ) : parcels.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <PackageOpen className="mx-auto mb-3" size={32} />
                <p className="text-sm">{activeTab === 'pending' ? 'No pending parcels' : 'No collection history'}</p>
                <p className="text-xs mt-1">Parcels logged by security or yourself will appear here for easy tracking.</p>
              </div>
            ) : (
              parcels.map(parcel => (
                <Card key={parcel.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{parcel.courier_name || 'Unknown Courier'}</p>
                          <Badge variant="outline" className={`text-[10px] ${statusConfig[parcel.status].color}`}>
                            {statusConfig[parcel.status].label}
                          </Badge>
                        </div>
                        {parcel.description && (
                          <p className="text-xs text-muted-foreground mt-1">{parcel.description}</p>
                        )}
                        {parcel.tracking_number && (
                          <p className="text-xs text-muted-foreground mt-0.5 font-mono">{parcel.tracking_number}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock size={10} /> {new Date(parcel.received_at).toLocaleString()}
                        </p>
                        {parcel.collected_at && (
                          <p className="text-[10px] text-muted-foreground">
                            Collected: {new Date(parcel.collected_at).toLocaleString()}
                            {parcel.collected_by && ` by ${parcel.collected_by}`}
                          </p>
                        )}
                      </div>

                      {(parcel.status === 'received' || parcel.status === 'notified') && (
                        <Button size="sm" variant="default" onClick={() => handleCollect(parcel.id)}>
                          <CheckCircle size={14} className="mr-1" /> Collect
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
