import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ImageUpload } from '@/components/ui/image-upload';
import { useAuth } from '@/contexts/AuthContext';
import { FileText, Check, X, Clock, Upload } from 'lucide-react';
import { toast } from 'sonner';

interface FoodLicenseUploadProps {
  sellerId: string;
  currentUrl?: string | null;
  currentStatus?: string;
  onUpdate?: () => void;
}

export function FoodLicenseUpload({ sellerId, currentUrl, currentStatus = 'none', onUpdate }: FoodLicenseUploadProps) {
  const { user } = useAuth();
  const [requireLicense, setRequireLicense] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSetting = async () => {
      const { data } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'require_food_license')
        .single();
      setRequireLicense(data?.value === 'true');
      setIsLoading(false);
    };
    fetchSetting();
  }, []);

  const handleUpload = async (url: string | null) => {
    if (!url) return;
    try {
      await supabase
        .from('seller_profiles')
        .update({
          food_license_url: url,
          food_license_status: 'pending',
          food_license_submitted_at: new Date().toISOString(),
        } as any)
        .eq('id', sellerId);
      toast.success('Food license uploaded! Awaiting admin verification.');
      onUpdate?.();
    } catch (error) {
      toast.error('Failed to upload license');
    }
  };

  if (isLoading) return null;

  const statusMap: Record<string, { label: string; icon: typeof Upload; color: string }> = {
    none: { label: 'Not Submitted', icon: Upload, color: 'text-muted-foreground' },
    pending: { label: 'Pending Verification', icon: Clock, color: 'text-warning' },
    approved: { label: 'Verified', icon: Check, color: 'text-success' },
    rejected: { label: 'Rejected - Please Re-upload', icon: X, color: 'text-destructive' },
  };

  const statusInfo = statusMap[currentStatus] || statusMap['none'];
  const StatusIcon = statusInfo.icon;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-primary" />
          <h3 className="font-semibold text-sm">Food License / FSSAI Certificate</h3>
          {requireLicense && <Badge variant="destructive" className="text-[10px]">Required</Badge>}
        </div>

        <div className="flex items-center gap-2">
          <StatusIcon size={14} className={statusInfo.color} />
          <span className={`text-sm font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
        </div>

        {currentStatus === 'approved' && currentUrl && (
          <div className="bg-success/10 rounded-lg p-3 text-sm text-success flex items-center gap-2">
            <Check size={16} />
            Your food license has been verified. You can sell food items.
          </div>
        )}

        {(currentStatus === 'none' || currentStatus === 'rejected') && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Upload your FSSAI registration certificate or food license (PDF, JPG, PNG, max 10MB)
            </p>
            {user && (
              <ImageUpload
                value={currentUrl}
                onChange={handleUpload}
                folder="food-licenses"
                userId={user.id}
                placeholder="Upload License"
              />
            )}
          </div>
        )}

        {currentStatus === 'pending' && (
          <div className="bg-warning/10 rounded-lg p-3 text-sm text-warning flex items-center gap-2">
            <Clock size={16} />
            Your license is being reviewed by the admin. Food selling is restricted until approved.
          </div>
        )}

        {!requireLicense && currentStatus === 'none' && (
          <p className="text-xs text-muted-foreground italic">
            Food license upload is currently optional. However, FSSAI registration is legally required for food businesses.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
