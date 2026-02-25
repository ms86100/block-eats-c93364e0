import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Settings, Save, Loader2, RefreshCw, IndianRupee, Mail, Type, Percent, FileText } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

interface SettingField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'textarea';
  icon: React.ElementType;
  group: string;
  description: string;
}

const SETTING_FIELDS: SettingField[] = [
  { key: 'base_delivery_fee', label: 'Base Delivery Fee', type: 'number', icon: IndianRupee, group: 'Financial', description: 'Charged when order is below free delivery threshold' },
  { key: 'free_delivery_threshold', label: 'Free Delivery Threshold', type: 'number', icon: IndianRupee, group: 'Financial', description: 'Orders above this amount get free delivery' },
  { key: 'platform_fee_percent', label: 'Platform Fee (%)', type: 'number', icon: Percent, group: 'Financial', description: 'Commission deducted from seller earnings' },
  { key: 'support_email', label: 'Support Email', type: 'email', icon: Mail, group: 'Contact', description: 'Shown on Terms & Pricing pages' },
  { key: 'grievance_email', label: 'Grievance Email', type: 'email', icon: Mail, group: 'Contact', description: 'Shown on Help & Grievance Officer section' },
  { key: 'dpo_email', label: 'DPO Email', type: 'email', icon: Mail, group: 'Contact', description: 'Data Protection Officer email on Privacy Policy' },
  { key: 'grievance_officer_name', label: 'Grievance Officer Name', type: 'text', icon: Type, group: 'Contact', description: 'Displayed in the Grievance Officer card' },
  { key: 'header_tagline', label: 'Header Tagline', type: 'text', icon: Type, group: 'Branding', description: 'Shown below the logo in the app header' },
  { key: 'app_version', label: 'App Version', type: 'text', icon: Settings, group: 'Branding', description: 'Displayed on the Profile page' },
  { key: 'address_block_label', label: 'Address Block Label', type: 'text', icon: Type, group: 'Address', description: 'Label for block/tower field (e.g., Block / Tower, Wing)' },
  { key: 'address_flat_label', label: 'Address Flat Label', type: 'text', icon: Type, group: 'Address', description: 'Label for flat/unit field (e.g., Flat Number, Unit)' },
  { key: 'terms_last_updated', label: 'Terms Last Updated', type: 'text', icon: Type, group: 'Legal', description: 'Date shown on Terms & Conditions page' },
  { key: 'privacy_last_updated', label: 'Privacy Last Updated', type: 'text', icon: Type, group: 'Legal', description: 'Date shown on Privacy Policy page' },
  { key: 'terms_content_md', label: 'Terms & Conditions Content', type: 'textarea', icon: FileText, group: 'Legal CMS', description: 'Plain text content for Terms page. Leave empty to use default template.' },
  { key: 'privacy_content_md', label: 'Privacy Policy Content', type: 'textarea', icon: FileText, group: 'Legal CMS', description: 'Plain text content for Privacy page. Leave empty to use default template.' },
  { key: 'help_sections_json', label: 'Help Sections (JSON)', type: 'textarea', icon: FileText, group: 'Help CMS', description: 'JSON array: [{"icon":"ShoppingBag","title":"How to Order","items":["Step 1","Step 2"]}]. Leave empty for defaults.' },
  // Trust Signal Labels
  { key: 'label_in_your_society', label: '"In your society" Label', type: 'text', icon: Type, group: 'Trust Labels', description: 'Shown on product cards for same-society sellers' },
  { key: 'label_distance_m_format', label: 'Distance (meters) Format', type: 'text', icon: Type, group: 'Trust Labels', description: 'Format: {distance}m away' },
  { key: 'label_distance_km_format', label: 'Distance (km) Format', type: 'text', icon: Type, group: 'Trust Labels', description: 'Format: {distance} km away' },
  { key: 'label_your_neighbor', label: '"Your neighbor" Label', type: 'text', icon: Type, group: 'Trust Labels', description: 'Shown for same-society sellers on detail sheet' },
  { key: 'label_active_now', label: '"Active now" Label', type: 'text', icon: Type, group: 'Trust Labels', description: 'Seller activity within 1 hour' },
  { key: 'label_active_hours_ago', label: '"Hours ago" Format', type: 'text', icon: Type, group: 'Trust Labels', description: 'Format: {hours}h ago' },
  { key: 'label_active_yesterday', label: '"Yesterday" Label', type: 'text', icon: Type, group: 'Trust Labels', description: 'Seller activity 24-48h ago' },
  { key: 'label_on_time_format', label: 'On-time Badge Format', type: 'text', icon: Type, group: 'Trust Labels', description: 'Format: ✓ On-time: {pct}%' },
  { key: 'label_social_proof_format', label: 'Social Proof Format', type: 'text', icon: Type, group: 'Trust Labels', description: 'Format: 👥 {count} {unit} ordered this week' },
  { key: 'label_social_proof_singular', label: 'Social Proof Singular', type: 'text', icon: Type, group: 'Trust Labels', description: 'e.g. "family"' },
  { key: 'label_social_proof_plural', label: 'Social Proof Plural', type: 'text', icon: Type, group: 'Trust Labels', description: 'e.g. "families"' },
  { key: 'label_stable_price', label: 'Stable Price Label', type: 'text', icon: Type, group: 'Trust Labels', description: 'e.g. "Stable Price (30+ days)"' },
  // Notify Me Labels
  { key: 'label_notify_me', label: '"Notify Me" (short)', type: 'text', icon: Type, group: 'Notify Labels', description: 'Compact button text' },
  { key: 'label_notify_watching', label: '"Watching" (short)', type: 'text', icon: Type, group: 'Notify Labels', description: 'Compact watching state' },
  { key: 'label_notify_watching_long', label: '"Watching" (long)', type: 'text', icon: Type, group: 'Notify Labels', description: 'Full watching state text' },
  { key: 'label_notify_me_long', label: '"Notify Me" (long)', type: 'text', icon: Type, group: 'Notify Labels', description: 'Full button text' },
  // Checkout Labels
  { key: 'label_checkout_community_support', label: 'Community Support Text', type: 'text', icon: Type, group: 'Checkout Labels', description: 'Format: {count} and {suffix} placeholders' },
  { key: 'label_checkout_community_emoji', label: 'Community Emoji', type: 'text', icon: Type, group: 'Checkout Labels', description: 'Emoji shown in checkout footer' },
  { key: 'label_neighborhood_guarantee', label: 'Guarantee Title', type: 'text', icon: Type, group: 'Checkout Labels', description: 'e.g. "Neighborhood Guarantee"' },
  { key: 'label_neighborhood_guarantee_desc', label: 'Guarantee Description', type: 'text', icon: Type, group: 'Checkout Labels', description: 'Shown on dispute sheets' },
  { key: 'label_neighborhood_guarantee_badge', label: 'Guarantee Badge Text', type: 'text', icon: Type, group: 'Checkout Labels', description: 'Shown on cart page' },
  { key: 'label_neighborhood_guarantee_emoji', label: 'Guarantee Emoji', type: 'text', icon: Type, group: 'Checkout Labels', description: 'e.g. 🛡️' },
  { key: 'label_dispute_sla_notice', label: 'Dispute SLA Notice', type: 'text', icon: Type, group: 'Checkout Labels', description: 'e.g. "The committee will review within 48 hours."' },
  // Group Buy Labels
  { key: 'label_group_buy_title', label: 'Group Buy Title', type: 'text', icon: Type, group: 'Group Buy Labels', description: 'Page heading' },
  { key: 'label_group_buy_subtitle', label: 'Group Buy Subtitle', type: 'text', icon: Type, group: 'Group Buy Labels', description: 'Page subheading' },
  { key: 'label_group_buy_empty', label: 'Empty State Title', type: 'text', icon: Type, group: 'Group Buy Labels', description: 'No group buys message' },
  { key: 'label_group_buy_empty_desc', label: 'Empty State Desc', type: 'text', icon: Type, group: 'Group Buy Labels', description: 'No group buys description' },
  { key: 'label_group_buy_join', label: 'Join Button', type: 'text', icon: Type, group: 'Group Buy Labels', description: 'e.g. "Join Group Buy"' },
  { key: 'label_group_buy_leave', label: 'Leave Button', type: 'text', icon: Type, group: 'Group Buy Labels', description: 'e.g. "Leave Group Buy"' },
  { key: 'label_group_buy_fulfilled', label: 'Fulfilled Badge', type: 'text', icon: Type, group: 'Group Buy Labels', description: 'e.g. "✓ Target Reached"' },
  // Seller Dashboard Labels (Admin-controlled UX copy for seller-facing screens)
  { key: 'label_demand_insights_title', label: 'Demand Insights Title', type: 'text', icon: Type, group: 'Seller Dashboard Labels', description: 'Heading for demand insights section' },
  { key: 'label_demand_insights_empty', label: 'Demand Insights Empty', type: 'text', icon: Type, group: 'Seller Dashboard Labels', description: 'Shown when no demand data' },
  { key: 'label_reputation_empty', label: 'Reputation Empty Title', type: 'text', icon: Type, group: 'Seller Dashboard Labels', description: 'No reputation data heading' },
  { key: 'label_reputation_empty_desc', label: 'Reputation Empty Desc', type: 'text', icon: Type, group: 'Seller Dashboard Labels', description: 'No reputation data description' },
  { key: 'label_analytics_intelligence_title', label: 'Intelligence Title', type: 'text', icon: Type, group: 'Seller Dashboard Labels', description: 'e.g. "30-Day Intelligence"' },
  { key: 'label_analytics_active_buyers', label: 'Active Buyers Label', type: 'text', icon: Type, group: 'Seller Dashboard Labels', description: 'Stat label' },
  { key: 'label_analytics_views', label: 'Views Label', type: 'text', icon: Type, group: 'Seller Dashboard Labels', description: 'Stat label' },
  { key: 'label_analytics_conversion', label: 'Conversion Label', type: 'text', icon: Type, group: 'Seller Dashboard Labels', description: 'Stat label' },
  { key: 'label_analytics_fee_format', label: 'Fee Format', type: 'text', icon: Type, group: 'Seller Dashboard Labels', description: 'Format: {pct}% platform fee' },
  { key: 'label_analytics_fee_desc', label: 'Fee Description', type: 'text', icon: Type, group: 'Seller Dashboard Labels', description: 'e.g. "Applied on each completed order"' },
  // Discovery
  { key: 'label_discovery_popular', label: 'Popular Section Title', type: 'text', icon: Type, group: 'Discovery Labels', description: 'e.g. "Popular near you"' },
  { key: 'label_discovery_new', label: 'New Section Title', type: 'text', icon: Type, group: 'Discovery Labels', description: 'e.g. "New this week"' },
  // Reorder
  { key: 'label_reorder_prefix', label: 'Reorder Prefix', type: 'text', icon: Type, group: 'Discovery Labels', description: 'e.g. "Reorder from"' },
  { key: 'label_reorder_success', label: 'Reorder Success', type: 'text', icon: Type, group: 'Discovery Labels', description: 'Toast after reorder' },
  { key: 'label_reorder_unavailable', label: 'Reorder Unavailable', type: 'text', icon: Type, group: 'Discovery Labels', description: 'When items are gone' },
  // Visibility Thresholds (Admin-controlled — affect marketplace policy)
  { key: 'on_time_badge_min_orders', label: 'On-time Badge Min Orders', type: 'number', icon: Settings, group: 'Visibility Thresholds', description: 'Minimum orders to show on-time badge' },
  { key: 'new_this_week_days', label: 'New This Week Days', type: 'number', icon: Settings, group: 'Visibility Thresholds', description: 'Cutoff for "new this week" discovery' },
  { key: 'discovery_min_products', label: 'Discovery Min Products', type: 'number', icon: Settings, group: 'Visibility Thresholds', description: 'Min products to show discovery row' },
  { key: 'discovery_max_items', label: 'Discovery Max Items', type: 'number', icon: Settings, group: 'Visibility Thresholds', description: 'Max items per discovery row' },
  { key: 'demand_insights_max_items', label: 'Demand Insights Max Items', type: 'number', icon: Settings, group: 'Visibility Thresholds', description: 'Max items shown in demand insights' },
  { key: 'dispute_sla_warning_hours', label: 'Dispute SLA Warning Hours', type: 'number', icon: Settings, group: 'Visibility Thresholds', description: 'Hours before SLA warning appears' },
  // Dispute Config (Admin-controlled — marketplace policy)
  { key: 'dispute_categories_json', label: 'Dispute Categories', type: 'textarea', icon: FileText, group: 'Dispute Config', description: 'JSON array: [{"value":"noise","label":"Noise"}]' },
];

export function PlatformSettingsManager() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [original, setOriginal] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', SETTING_FIELDS.map(f => f.key));

    const map: Record<string, string> = {};
    for (const row of data || []) {
      if (row.key && row.value) map[row.key] = row.value;
    }
    setValues(map);
    setOriginal(map);
    setLoading(false);
  };

  const changedKeys = Object.keys(values).filter(k => values[k] !== original[k]);
  const hasChanges = changedKeys.length > 0;

  const handleSave = async () => {
    if (!hasChanges) return;
    setSaving(true);
    try {
      for (const key of changedKeys) {
        // Upsert: update if exists, insert if not
        const { data: existing } = await supabase
          .from('system_settings')
          .select('key')
          .eq('key', key)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('system_settings')
            .update({ value: values[key], updated_at: new Date().toISOString() })
            .eq('key', key);
        } else {
          await supabase
            .from('system_settings')
            .insert({ key, value: values[key] });
        }
      }
      setOriginal({ ...values });
      queryClient.invalidateQueries({ queryKey: ['system-settings-core'] });
      toast.success(`${changedKeys.length} setting(s) updated`);
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const groups = [...new Set(SETTING_FIELDS.map(f => f.group))];

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> Loading settings...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <Settings size={16} className="text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Platform Settings</h3>
              <p className="text-[10px] text-muted-foreground">Configure global platform behavior</p>
            </div>
          </div>
          <div className="flex gap-1.5">
            <Button variant="ghost" size="sm" className="h-8 text-xs rounded-lg" onClick={fetchSettings}>
              <RefreshCw size={12} className="mr-1" /> Refresh
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs rounded-lg"
              disabled={!hasChanges || saving}
              onClick={handleSave}
            >
              {saving ? <Loader2 size={12} className="mr-1 animate-spin" /> : <Save size={12} className="mr-1" />}
              Save {hasChanges ? `(${changedKeys.length})` : ''}
            </Button>
          </div>
        </div>

        {groups.map((group, gi) => (
          <div key={group}>
            {gi > 0 && <Separator className="my-4" />}
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              {group}
            </p>
            <div className="space-y-4">
              {SETTING_FIELDS.filter(f => f.group === group).map(field => {
                const Icon = field.icon;
                const isChanged = values[field.key] !== original[field.key];
                return (
                  <div key={field.key} className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1.5">
                      <Icon size={12} className="text-muted-foreground" />
                      {field.label}
                      {isChanged && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/20">
                          modified
                        </Badge>
                      )}
                    </Label>
                    {field.type === 'textarea' ? (
                      <Textarea
                        value={values[field.key] ?? ''}
                        onChange={(e) => setValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                        className="text-sm min-h-[80px] rounded-xl"
                        placeholder={field.description}
                        rows={4}
                      />
                    ) : (
                      <Input
                        type={field.type}
                        value={values[field.key] ?? ''}
                        onChange={(e) => setValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                        className="h-9 text-sm rounded-xl"
                        placeholder={field.description}
                      />
                    )}
                    <p className="text-[10px] text-muted-foreground">{field.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
