import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ImageUpload } from '@/components/ui/image-upload';
import { useAuth } from '@/contexts/AuthContext';
import { FileText, Check, X, Clock, Upload } from 'lucide-react';
import { toast } from 'sonner';

interface LicenseUploadProps {
  sellerId: string;
  groupId: string;
  onStatusChange?: (status: string | null) => void;
}

interface GroupLicenseConfig {
  license_type_name: string;
  license_description: string;
  license_mandatory: boolean;
}

interface LicenseRecord {
  id: string;
  status: string;
  document_url: string;
  license_number: string | null;
  license_type: string;
  admin_notes: string | null;
}

export function LicenseUpload({ sellerId, groupId, onStatusChange }: LicenseUploadProps) {
  const { user } = useAuth();
  const [config, setConfig] = useState<GroupLicenseConfig | null>(null);
  const [license, setLicense] = useState<LicenseRecord | null>(null);
  const [licenseNumber, setLicenseNumber] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [sellerId, groupId]);

  const fetchData = async () => {
    try {
      const [groupRes, licenseRes] = await Promise.all([
        supabase
          .from('parent_groups')
          .select('license_type_name, license_description, license_mandatory')
          .eq('id', groupId)
          .eq('requires_license', true)
          .single(),
        supabase
          .from('seller_licenses')
          .select('id, status, document_url, license_number, license_type, admin_notes')
          .eq('seller_id', sellerId)
          .eq('group_id', groupId)
          .maybeSingle(),
      ]);

      if (groupRes.data) {
        const configData = groupRes.data as GroupLicenseConfig;
        // Fallback for null license_type_name
        if (!configData.license_type_name) {
          configData.license_type_name = 'Business License';
        }
        setConfig(configData);
      }
      if (licenseRes.data) {
        setLicense(licenseRes.data as LicenseRecord);
        setLicenseNumber(licenseRes.data.license_number || '');
        onStatusChange?.(licenseRes.data.status);
      } else {
        onStatusChange?.(null);
      }
    } catch (error) {
      console.error('Error fetching license data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async (url: string | null) => {
    if (!url || !config) return;
    try {
      if (license) {
        // Update existing (re-upload after rejection)
        await supabase
          .from('seller_licenses')
          .update({
            document_url: url,
            status: 'pending',
            license_number: licenseNumber.trim() || null,
            submitted_at: new Date().toISOString(),
            reviewed_at: null,
          } as any)
          .eq('id', license.id);
      } else {
        // Insert new
        await supabase
          .from('seller_licenses')
          .insert({
            seller_id: sellerId,
            group_id: groupId,
            license_type: config.license_type_name,
            document_url: url,
            license_number: licenseNumber.trim() || null,
          } as any);
      }
      toast.success(`${config.license_type_name} uploaded! Awaiting admin verification.`);
      fetchData();
    } catch (error) {
      toast.error('Failed to upload license');
    }
  };

  const handleUpdateLicenseNumber = async () => {
    if (!license) return;
    try {
      await supabase
        .from('seller_licenses')
        .update({ license_number: licenseNumber.trim() || null } as any)
        .eq('id', license.id);
      toast.success('License number updated');
    } catch (error) {
      toast.error('Failed to update license number');
    }
  };

  if (isLoading || !config) return null;

  const currentStatus = license?.status || 'none';

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
          <h3 className="font-semibold text-sm">{config.license_type_name}</h3>
          {config.license_mandatory && <Badge variant="destructive" className="text-[10px]">Required</Badge>}
        </div>

        <div className="flex items-center gap-2">
          <StatusIcon size={14} className={statusInfo.color} />
          <span className={`text-sm font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
        </div>

        {currentStatus === 'approved' && (
          <div className="bg-success/10 rounded-lg p-3 text-sm text-success flex items-center gap-2">
            <Check size={16} />
            Your {config.license_type_name} has been verified.
          </div>
        )}

        {(currentStatus === 'none' || currentStatus === 'rejected') && (
          <div className="space-y-3">
            {config.license_description && (
              <p className="text-xs text-muted-foreground">{config.license_description}</p>
            )}
            {license?.admin_notes && currentStatus === 'rejected' && (
              <div className="bg-destructive/10 rounded-lg p-2 text-xs text-destructive">
                Admin note: {license.admin_notes}
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-xs">License / Registration Number (optional)</Label>
              <Input
                placeholder="Enter license number"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
              />
            </div>
            {user && (
              <ImageUpload
                value={license?.document_url || null}
                onChange={handleUpload}
                folder="licenses"
                userId={user.id}
                placeholder={`Upload ${config.license_type_name}`}
              />
            )}
          </div>
        )}

        {currentStatus === 'pending' && (
          <div className="bg-warning/10 rounded-lg p-3 text-sm text-warning flex items-center gap-2">
            <Clock size={16} />
            Your license is being reviewed by the admin.
            {config.license_mandatory && ' Selling is restricted until approved.'}
          </div>
        )}

        {currentStatus === 'approved' && (
          <div className="space-y-2">
            <Label className="text-xs">License Number</Label>
            <div className="flex gap-2">
              <Input
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder="Enter license number"
              />
              <Button size="sm" variant="outline" onClick={handleUpdateLicenseNumber}>
                Save
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
