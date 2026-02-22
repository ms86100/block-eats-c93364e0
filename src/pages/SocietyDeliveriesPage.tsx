import { AppLayout } from '@/components/layout/AppLayout';
import { DeliveryMonitoringTab } from '@/components/delivery/DeliveryMonitoringTab';
import { useAuth } from '@/contexts/AuthContext';

export default function SocietyDeliveriesPage() {
  const { effectiveSocietyId } = useAuth();

  return (
    <AppLayout headerTitle="Delivery Monitoring" showLocation={false}>
      <div className="p-4">
        <DeliveryMonitoringTab societyId={effectiveSocietyId || undefined} />
      </div>
    </AppLayout>
  );
}
