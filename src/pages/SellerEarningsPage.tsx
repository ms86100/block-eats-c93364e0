import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { PaymentRecord, Order, PAYMENT_STATUS_LABELS, PaymentStatus, SellerProfile } from '@/types/database';
import { ArrowLeft, TrendingUp, DollarSign, Calendar, CreditCard } from 'lucide-react';
import { format, startOfDay, startOfWeek, startOfMonth, isAfter, parseISO } from 'date-fns';

export default function SellerEarningsPage() {
  const { user, currentSellerId, sellerProfiles } = useAuth();
  const [payments, setPayments] = useState<(PaymentRecord & { order?: Order })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
    allTime: 0,
    pendingPayout: 0,
  });

  const activeSellerId = currentSellerId || (sellerProfiles.length > 0 ? sellerProfiles[0].id : null);

  useEffect(() => {
    if (user && activeSellerId) {
      fetchEarnings(activeSellerId);
    } else {
      setIsLoading(false);
    }
  }, [user, activeSellerId]);

  const fetchEarnings = async (sellerId: string) => {
    if (!user) return;

    try {
      // Fetch payment records for the active seller
      const { data, error } = await supabase
        .from('payment_records')
        .select(`
          *,
          order:orders(id, status, created_at, buyer:profiles!orders_buyer_id_fkey(name))
        `)
        .eq('seller_id', sellerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const paymentList = (data as any) || [];
      setPayments(paymentList);

      // Calculate stats
      const today = startOfDay(new Date());
      const weekStart = startOfWeek(new Date());
      const monthStart = startOfMonth(new Date());

      const paidPayments = paymentList.filter((p: PaymentRecord) => p.payment_status === 'paid');
      const todayPayments = paidPayments.filter((p: PaymentRecord) => 
        isAfter(parseISO(p.created_at), today)
      );
      const weekPayments = paidPayments.filter((p: PaymentRecord) =>
        isAfter(parseISO(p.created_at), weekStart)
      );
      const monthPayments = paidPayments.filter((p: PaymentRecord) =>
        isAfter(parseISO(p.created_at), monthStart)
      );
      const pendingPayments = paymentList.filter((p: PaymentRecord) => p.payment_status === 'pending');

      setStats({
        today: todayPayments.reduce((sum: number, p: PaymentRecord) => sum + Number(p.net_amount), 0),
        thisWeek: weekPayments.reduce((sum: number, p: PaymentRecord) => sum + Number(p.net_amount), 0),
        thisMonth: monthPayments.reduce((sum: number, p: PaymentRecord) => sum + Number(p.net_amount), 0),
        allTime: paidPayments.reduce((sum: number, p: PaymentRecord) => sum + Number(p.net_amount), 0),
        pendingPayout: pendingPayments.reduce((sum: number, p: PaymentRecord) => sum + Number(p.net_amount), 0),
      });
    } catch (error) {
      console.error('Error fetching earnings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout showHeader={false}>
        <div className="p-4">
          <Skeleton className="h-8 w-32 mb-4" />
          <Skeleton className="h-32 w-full rounded-xl mb-4" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout showHeader={false}>
      <div className="p-4 safe-top">
        <Link to="/seller" className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft size={20} />
          <span>Back to Dashboard</span>
        </Link>

        <h1 className="text-xl font-bold mb-4">Earnings & Payouts</h1>

        {/* Earnings Overview */}
        <div className="bg-gradient-to-r from-success/10 to-success/5 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="text-success" size={20} />
            <h3 className="font-semibold">Earnings Overview</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-background/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Today</p>
              <p className="text-xl font-bold text-success">₹{stats.today}</p>
            </div>
            <div className="bg-background/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">This Week</p>
              <p className="text-xl font-bold text-success">₹{stats.thisWeek}</p>
            </div>
            <div className="bg-background/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">This Month</p>
              <p className="text-xl font-bold text-success">₹{stats.thisMonth}</p>
            </div>
            <div className="bg-background/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">All Time</p>
              <p className="text-xl font-bold text-success">₹{stats.allTime}</p>
            </div>
          </div>
        </div>

        {/* Pending Payout */}
        {stats.pendingPayout > 0 && (
          <Card className="mb-6 border-warning/30 bg-warning/5">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center">
                <DollarSign className="text-warning" size={24} />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Pending Collection</p>
                <p className="text-sm text-muted-foreground">COD payments to collect</p>
              </div>
              <p className="text-xl font-bold text-warning">₹{stats.pendingPayout}</p>
            </CardContent>
          </Card>
        )}

        {/* Transaction History */}
        <div>
          <h3 className="font-semibold mb-3">Transaction History</h3>
          
          {payments.length > 0 ? (
            <div className="space-y-3">
              {payments.map((payment) => {
                const order = payment.order as any;
                const statusInfo = PAYMENT_STATUS_LABELS[payment.payment_status as PaymentStatus];
                
                return (
                  <Card key={payment.id}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                            <CreditCard size={18} className="text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">
                              Order #{payment.order_id.slice(0, 8)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {order?.buyer?.name || 'Customer'}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {format(new Date(payment.created_at), 'MMM d, h:mm a')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">₹{payment.amount}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {payment.payment_method.toUpperCase()}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 bg-muted rounded-xl">
              <DollarSign className="mx-auto text-muted-foreground mb-2" size={32} />
              <p className="text-sm text-muted-foreground">No transactions yet</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
