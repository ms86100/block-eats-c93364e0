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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { friendlyError } from '@/lib/utils';
import {
  UserPlus, Shield, Clock, Car, Phone, Truck, Users,
  CheckCircle, XCircle, Copy, RefreshCw, LogIn, LogOut
} from 'lucide-react';

type VisitorType = 'guest' | 'delivery' | 'cab' | 'domestic_help' | 'contractor';
type VisitorStatus = 'expected' | 'checked_in' | 'checked_out' | 'cancelled' | 'expired';

interface VisitorEntry {
  id: string;
  visitor_name: string;
  visitor_phone: string | null;
  visitor_type: VisitorType;
  purpose: string | null;
  expected_date: string | null;
  expected_time: string | null;
  otp_code: string | null;
  is_preapproved: boolean;
  is_recurring: boolean;
  recurring_days: string[] | null;
  status: VisitorStatus;
  checked_in_at: string | null;
  checked_out_at: string | null;
  vehicle_number: string | null;
  flat_number: string | null;
  created_at: string;
}

const visitorTypeLabels: Record<VisitorType, { label: string; icon: typeof Users }> = {
  guest: { label: 'Guest', icon: Users },
  delivery: { label: 'Delivery', icon: Truck },
  cab: { label: 'Cab/Ride', icon: Car },
  domestic_help: { label: 'Domestic Help', icon: Users },
  contractor: { label: 'Contractor', icon: Users },
};

const statusColors: Record<VisitorStatus, string> = {
  expected: 'bg-warning/10 text-warning',
  checked_in: 'bg-success/10 text-success',
  checked_out: 'bg-muted text-muted-foreground',
  cancelled: 'bg-destructive/10 text-destructive',
  expired: 'bg-muted text-muted-foreground',
};

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default function VisitorManagementPage() {
  const { user, profile, effectiveSocietyId } = useAuth();
  const [visitors, setVisitors] = useState<VisitorEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('today');

  // Form state
  const [visitorName, setVisitorName] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');
  const [visitorType, setVisitorType] = useState<VisitorType>('guest');
  const [purpose, setPurpose] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [expectedDate, setExpectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedTime, setExpectedTime] = useState('');
  const [isPreapproved, setIsPreapproved] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchVisitors = useCallback(async () => {
    if (!effectiveSocietyId || !user) return;
    setIsLoading(true);

    const today = new Date().toISOString().split('T')[0];

    let query = supabase
      .from('visitor_entries')
      .select('*')
      .eq('resident_id', user.id)
      .order('created_at', { ascending: false });

    if (activeTab === 'today') {
      query = query.eq('expected_date', today);
    } else if (activeTab === 'upcoming') {
      query = query.gt('expected_date', today);
    } else if (activeTab === 'history') {
      query = query.in('status', ['checked_out', 'cancelled', 'expired']);
    }

    const { data, error } = await query.limit(50);
    if (error) {
      toast.error('Could not load visitors. Please try again.');
      console.error('Fetch visitors error:', error);
    }
    setVisitors((data as VisitorEntry[]) || []);
    setIsLoading(false);
  }, [effectiveSocietyId, user, activeTab]);

  useEffect(() => { fetchVisitors(); }, [fetchVisitors]);

  const handleAddVisitor = async () => {
    if (!visitorName.trim() || !user || !effectiveSocietyId) return;
    setIsSubmitting(true);

    const otp = generateOTP();

    const { error } = await supabase.from('visitor_entries').insert({
      society_id: effectiveSocietyId,
      resident_id: user.id,
      visitor_name: visitorName.trim(),
      visitor_phone: visitorPhone || null,
      visitor_type: visitorType,
      purpose: purpose || null,
      expected_date: expectedDate || null,
      expected_time: expectedTime || null,
      otp_code: isPreapproved ? otp : null,
      otp_expires_at: isPreapproved ? new Date(Date.now() + 24 * 3600000).toISOString() : null,
      is_preapproved: isPreapproved,
      vehicle_number: vehicleNumber || null,
      flat_number: profile?.flat_number || null,
      status: 'expected',
    });

    if (error) {
      toast.error(friendlyError(error));
      console.error(error);
    } else {
      toast.success(`Visitor added! ${isPreapproved ? `OTP: ${otp}` : ''}`);
      setIsAddOpen(false);
      resetForm();
      fetchVisitors();
    }
    setIsSubmitting(false);
  };

  const handleCheckIn = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from('visitor_entries')
      .update({ status: 'checked_in', checked_in_at: new Date().toISOString() })
      .eq('id', id)
      .eq('resident_id', user.id);
    if (!error) { toast.success('Visitor checked in'); fetchVisitors(); }
  };

  const handleCheckOut = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from('visitor_entries')
      .update({ status: 'checked_out', checked_out_at: new Date().toISOString() })
      .eq('id', id)
      .eq('resident_id', user.id);
    if (!error) { toast.success('Visitor checked out'); fetchVisitors(); }
  };

  const handleCancel = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from('visitor_entries')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('resident_id', user.id);
    if (!error) { toast.success('Visitor entry cancelled'); fetchVisitors(); }
  };

  const copyOTP = (otp: string) => {
    navigator.clipboard.writeText(otp);
    toast.success('OTP copied to clipboard');
  };

  const resetForm = () => {
    setVisitorName('');
    setVisitorPhone('');
    setVisitorType('guest');
    setPurpose('');
    setVehicleNumber('');
    setExpectedDate(new Date().toISOString().split('T')[0]);
    setExpectedTime('');
    setIsPreapproved(true);
  };

  const todayCount = visitors.filter(v => v.status === 'expected' || v.status === 'checked_in').length;

  return (
    <AppLayout headerTitle="Visitor Management" showLocation={false}>
      <div className="p-4 space-y-4">
        {/* Summary Card */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="text-primary" size={24} />
              </div>
              <div>
                <p className="font-semibold">Today's Visitors</p>
                <p className="text-2xl font-bold text-primary">{todayCount}</p>
              </div>
            </div>
            <Sheet open={isAddOpen} onOpenChange={setIsAddOpen}>
              <SheetTrigger asChild>
                <Button size="sm">
                  <UserPlus size={16} className="mr-1" />
                  Add
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Add Visitor</SheetTitle>
                  <SheetDescription>Pre-approve a visitor with an OTP for gate entry</SheetDescription>
                </SheetHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label>Visitor Name *</Label>
                    <Input value={visitorName} onChange={e => setVisitorName(e.target.value)} placeholder="Enter name" />
                  </div>
                  <div>
                    <Label>Phone Number</Label>
                    <Input value={visitorPhone} onChange={e => setVisitorPhone(e.target.value)} placeholder="+91 XXXXX XXXXX" />
                  </div>
                  <div>
                    <Label>Visitor Type</Label>
                    <Select value={visitorType} onValueChange={v => setVisitorType(v as VisitorType)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(visitorTypeLabels).map(([key, { label }]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Purpose</Label>
                    <Input value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="e.g., Family visit" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Expected Date</Label>
                      <Input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} />
                    </div>
                    <div>
                      <Label>Expected Time</Label>
                      <Input type="time" value={expectedTime} onChange={e => setExpectedTime(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label>Vehicle Number (optional)</Label>
                    <Input value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} placeholder="MH 01 AB 1234" />
                  </div>
                  <Button onClick={handleAddVisitor} disabled={!visitorName.trim() || isSubmitting} className="w-full">
                    {isSubmitting ? 'Adding...' : 'Add Visitor & Generate OTP'}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="today" className="text-xs">Today</TabsTrigger>
            <TabsTrigger value="upcoming" className="text-xs">Upcoming</TabsTrigger>
            <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-3 space-y-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
            ) : visitors.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="mx-auto mb-3" size={32} />
                <p className="text-sm">No visitors {activeTab === 'today' ? 'expected today' : activeTab === 'upcoming' ? 'upcoming' : 'in history'}</p>
                <p className="text-xs mt-1">Pre-approve visitors with an OTP so they can enter smoothly at the gate.</p>
              </div>
            ) : (
              visitors.map(visitor => (
                <Card key={visitor.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{visitor.visitor_name}</p>
                          <Badge variant="outline" className={`text-[10px] ${statusColors[visitor.status]}`}>
                            {visitor.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span className="capitalize">{visitorTypeLabels[visitor.visitor_type]?.label}</span>
                          {visitor.visitor_phone && (
                            <span className="flex items-center gap-0.5">
                              <Phone size={10} /> {visitor.visitor_phone}
                            </span>
                          )}
                          {visitor.vehicle_number && (
                            <span className="flex items-center gap-0.5">
                              <Car size={10} /> {visitor.vehicle_number}
                            </span>
                          )}
                        </div>
                        {visitor.purpose && (
                          <p className="text-xs text-muted-foreground mt-1">{visitor.purpose}</p>
                        )}
                        {visitor.expected_time && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Clock size={10} /> {visitor.expected_time}
                          </p>
                        )}
                      </div>

                      {/* OTP Display */}
                      {visitor.otp_code && visitor.status === 'expected' && (
                        <button
                          onClick={() => copyOTP(visitor.otp_code!)}
                          className="flex flex-col items-center gap-1 bg-primary/10 rounded-lg px-3 py-2"
                        >
                          <span className="text-lg font-mono font-bold text-primary tracking-widest">{visitor.otp_code}</span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Copy size={8} /> Copy OTP
                          </span>
                        </button>
                      )}
                    </div>

                    {/* Actions */}
                    {visitor.status === 'expected' && (
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" variant="default" className="flex-1" onClick={() => handleCheckIn(visitor.id)}>
                          <LogIn size={14} className="mr-1" /> Check In
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleCancel(visitor.id)}>
                          <XCircle size={14} />
                        </Button>
                      </div>
                    )}
                    {visitor.status === 'checked_in' && (
                      <Button size="sm" variant="outline" className="w-full mt-3" onClick={() => handleCheckOut(visitor.id)}>
                        <LogOut size={14} className="mr-1" /> Check Out
                      </Button>
                    )}
                    {visitor.checked_in_at && (
                      <p className="text-[10px] text-muted-foreground mt-2">
                        In: {new Date(visitor.checked_in_at).toLocaleTimeString()}
                        {visitor.checked_out_at && ` • Out: ${new Date(visitor.checked_out_at).toLocaleTimeString()}`}
                      </p>
                    )}
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
