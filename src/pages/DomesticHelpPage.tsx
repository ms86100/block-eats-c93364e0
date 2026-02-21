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
import { UserPlus, Phone, LogIn, LogOut, CheckCircle, Calendar, Users } from 'lucide-react';

type HelpType = 'maid' | 'cook' | 'driver' | 'nanny' | 'gardener' | 'other';

const helpTypeLabels: Record<HelpType, string> = {
  maid: '🧹 Maid',
  cook: '👨‍🍳 Cook',
  driver: '🚗 Driver',
  nanny: '👶 Nanny',
  gardener: '🌱 Gardener',
  other: '👤 Other',
};

interface HelpEntry {
  id: string;
  help_name: string;
  help_phone: string | null;
  help_type: HelpType;
  flat_number: string | null;
  is_active: boolean;
  created_at: string;
}

interface AttendanceRecord {
  id: string;
  help_entry_id: string;
  check_in_at: string;
  check_out_at: string | null;
  date: string;
}

export default function DomesticHelpPage() {
  const { user, profile, effectiveSocietyId } = useAuth();
  const [helpers, setHelpers] = useState<HelpEntry[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('today');

  // Form
  const [helpName, setHelpName] = useState('');
  const [helpPhone, setHelpPhone] = useState('');
  const [helpType, setHelpType] = useState<HelpType>('maid');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const fetchData = useCallback(async () => {
    if (!effectiveSocietyId || !user) return;
    setIsLoading(true);

    const [helpersRes, attendanceRes] = await Promise.all([
      supabase.from('domestic_help_entries').select('*')
        .eq('resident_id', user.id).eq('is_active', true)
        .order('created_at', { ascending: false }),
      supabase.from('domestic_help_attendance').select('*')
        .eq('society_id', effectiveSocietyId).eq('date', today)
        .eq('marked_by', user.id),
    ]);

    setHelpers((helpersRes.data as HelpEntry[]) || []);
    setTodayAttendance((attendanceRes.data as AttendanceRecord[]) || []);
    setIsLoading(false);
  }, [effectiveSocietyId, user, today]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdd = async () => {
    if (!helpName.trim() || !user || !effectiveSocietyId) return;
    setIsSubmitting(true);

    const { error } = await supabase.from('domestic_help_entries').insert({
      society_id: effectiveSocietyId,
      resident_id: user.id,
      help_name: helpName.trim(),
      help_phone: helpPhone || null,
      help_type: helpType,
      flat_number: profile?.flat_number || null,
    });

    if (error) {
      toast.error(friendlyError(error));
      console.error(error);
    } else {
      toast.success('Helper added');
      setIsAddOpen(false);
      setHelpName(''); setHelpPhone(''); setHelpType('maid');
      fetchData();
    }
    setIsSubmitting(false);
  };

  const handleCheckIn = async (helpEntryId: string) => {
    if (!user || !effectiveSocietyId) return;
    const { error } = await supabase.from('domestic_help_attendance').insert({
      help_entry_id: helpEntryId,
      society_id: effectiveSocietyId,
      marked_by: user.id,
      date: today,
    });
    if (!error) { toast.success('Checked in'); fetchData(); }
    else toast.error(friendlyError(error));
  };

  const handleCheckOut = async (attendanceId: string) => {
    if (!user) return;
    const { error } = await supabase.from('domestic_help_attendance')
      .update({ check_out_at: new Date().toISOString() })
      .eq('id', attendanceId)
      .eq('marked_by', user.id);
    if (!error) { toast.success('Checked out'); fetchData(); }
  };

  const getAttendance = (helpId: string) =>
    todayAttendance.find(a => a.help_entry_id === helpId);

  const checkedInCount = todayAttendance.filter(a => !a.check_out_at).length;

  return (
    <AppLayout headerTitle="Domestic Help" showLocation={false}>
      <div className="p-4 space-y-4">
        {/* Summary */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="text-primary" size={24} />
              </div>
              <div>
                <p className="font-semibold">Today's Attendance</p>
                <p className="text-2xl font-bold text-primary">{checkedInCount} / {helpers.length}</p>
              </div>
            </div>
            <Sheet open={isAddOpen} onOpenChange={setIsAddOpen}>
              <SheetTrigger asChild>
                <Button size="sm"><UserPlus size={16} className="mr-1" /> Add</Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Add Domestic Help</SheetTitle>
                  <SheetDescription>Register a helper for daily attendance tracking</SheetDescription>
                </SheetHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label>Name *</Label>
                    <Input value={helpName} onChange={e => setHelpName(e.target.value)} placeholder="Enter name" />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input value={helpPhone} onChange={e => setHelpPhone(e.target.value)} placeholder="+91 XXXXX XXXXX" />
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select value={helpType} onValueChange={v => setHelpType(v as HelpType)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(helpTypeLabels).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleAdd} disabled={!helpName.trim() || isSubmitting} className="w-full">
                    {isSubmitting ? 'Adding...' : 'Add Helper'}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </CardContent>
        </Card>

        {/* Helper List */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="today" className="text-xs">Today</TabsTrigger>
            <TabsTrigger value="all" className="text-xs">All Helpers</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-3 space-y-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
            ) : helpers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="mx-auto mb-3" size={32} />
                <p className="text-sm">No domestic help registered yet</p>
                <p className="text-xs mt-1">Add your maid, cook, driver, or other helpers to track their daily attendance.</p>
              </div>
            ) : (
              helpers.map(helper => {
                const attendance = getAttendance(helper.id);
                const isCheckedIn = attendance && !attendance.check_out_at;
                const isCheckedOut = attendance && attendance.check_out_at;

                return (
                  <Card key={helper.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{helper.help_name}</p>
                            <Badge variant="outline" className="text-[10px]">
                              {helpTypeLabels[helper.help_type]}
                            </Badge>
                          </div>
                          {helper.help_phone && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <Phone size={10} /> {helper.help_phone}
                            </p>
                          )}
                          {attendance && (
                            <p className="text-[10px] text-muted-foreground mt-1">
                              In: {new Date(attendance.check_in_at).toLocaleTimeString()}
                              {attendance.check_out_at && ` • Out: ${new Date(attendance.check_out_at).toLocaleTimeString()}`}
                            </p>
                          )}
                        </div>

                        <div>
                          {!attendance && activeTab === 'today' && (
                            <Button size="sm" onClick={() => handleCheckIn(helper.id)}>
                              <LogIn size={14} className="mr-1" /> In
                            </Button>
                          )}
                          {isCheckedIn && (
                            <Button size="sm" variant="outline" onClick={() => handleCheckOut(attendance!.id)}>
                              <LogOut size={14} className="mr-1" /> Out
                            </Button>
                          )}
                          {isCheckedOut && (
                            <Badge className="bg-success/10 text-success text-[10px]">
                              <CheckCircle size={10} className="mr-1" /> Done
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
