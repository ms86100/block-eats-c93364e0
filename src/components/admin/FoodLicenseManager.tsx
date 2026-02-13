import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Check, X, FileText, Eye, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface LicenseSubmission {
  id: string;
  business_name: string;
  food_license_url: string;
  food_license_status: string;
  food_license_submitted_at: string;
  profile?: { name: string };
}

export function FoodLicenseManager() {
  const [requireLicense, setRequireLicense] = useState(false);
  const [submissions, setSubmissions] = useState<LicenseSubmission[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [settingRes, submissionsRes] = await Promise.all([
        supabase.from('admin_settings').select('value').eq('key', 'require_food_license').single(),
        supabase
          .from('seller_profiles')
          .select('id, business_name, food_license_url, food_license_status, food_license_submitted_at, profile:profiles!seller_profiles_user_id_fkey(name)')
          .neq('food_license_status', 'none')
          .order('food_license_submitted_at', { ascending: false }),
      ]);

      if (settingRes.data) {
        setRequireLicense(settingRes.data.value === 'true');
      }
      setSubmissions((submissionsRes.data as any) || []);
    } catch (error) {
      console.error('Error fetching license data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRequirement = async (checked: boolean) => {
    try {
      await supabase.from('admin_settings').update({ value: String(checked) }).eq('key', 'require_food_license');
      setRequireLicense(checked);
      toast.success(checked ? 'Food license requirement enabled' : 'Food license requirement disabled');
    } catch (error) {
      toast.error('Failed to update setting');
    }
  };

  const updateLicenseStatus = async (sellerId: string, status: 'approved' | 'rejected') => {
    try {
      await supabase
        .from('seller_profiles')
        .update({ 
          food_license_status: status, 
          food_license_reviewed_at: new Date().toISOString() 
        })
        .eq('id', sellerId);
      toast.success(`License ${status}`);
      fetchData();
    } catch (error) {
      toast.error('Failed to update license status');
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="text-warning border-warning"><Clock size={10} className="mr-1" /> Pending</Badge>;
      case 'approved': return <Badge variant="outline" className="text-success border-success"><Check size={10} className="mr-1" /> Approved</Badge>;
      case 'rejected': return <Badge variant="outline" className="text-destructive border-destructive"><X size={10} className="mr-1" /> Rejected</Badge>;
      default: return null;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <FileText size={16} className="text-primary" />
                Require Food License for Sellers
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                When enabled, food category sellers must upload a valid food license
              </p>
            </div>
            <Switch checked={requireLicense} onCheckedChange={toggleRequirement} />
          </div>
        </CardContent>
      </Card>

      <h3 className="text-sm font-semibold text-muted-foreground">
        License Submissions ({submissions.filter(s => s.food_license_status === 'pending').length} pending)
      </h3>

      {submissions.length > 0 ? submissions.map((sub) => (
        <Card key={sub.id}>
          <CardContent className="p-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-sm">{sub.business_name}</p>
                <p className="text-xs text-muted-foreground">{(sub as any).profile?.name}</p>
                {sub.food_license_submitted_at && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Submitted {format(new Date(sub.food_license_submitted_at), 'dd MMM yyyy')}
                  </p>
                )}
                <div className="mt-1">{statusBadge(sub.food_license_status)}</div>
              </div>
              <div className="flex gap-1.5">
                {sub.food_license_url && (
                  <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setPreviewUrl(sub.food_license_url)}>
                    <Eye size={14} />
                  </Button>
                )}
                {sub.food_license_status === 'pending' && (
                  <>
                    <Button size="sm" variant="outline" className="text-destructive h-8 w-8 p-0" onClick={() => updateLicenseStatus(sub.id, 'rejected')}>
                      <X size={14} />
                    </Button>
                    <Button size="sm" className="h-8 w-8 p-0" onClick={() => updateLicenseStatus(sub.id, 'approved')}>
                      <Check size={14} />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )) : (
        <p className="text-center text-muted-foreground py-4 text-sm">No license submissions</p>
      )}

      {/* Document Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>License Document</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            previewUrl.match(/\.(jpg|jpeg|png|webp)$/i) ? (
              <img src={previewUrl} alt="Food License" className="w-full rounded-lg" />
            ) : (
              <div className="text-center py-8">
                <FileText size={48} className="mx-auto text-muted-foreground mb-4" />
                <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  Open Document
                </a>
              </div>
            )
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
