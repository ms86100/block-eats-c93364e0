import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { jitteredStaleTime } from '@/lib/query-utils';

export interface SystemSettings {
  baseDeliveryFee: number;
  freeDeliveryThreshold: number;
  platformFeePercent: number;
  supportEmail: string;
  grievanceEmail: string;
  dpoEmail: string;
  grievanceOfficerName: string;
  headerTagline: string;
  appVersion: string;
  addressBlockLabel: string;
  addressFlatLabel: string;
  termsLastUpdated: string;
  privacyLastUpdated: string;
  helpSectionsJson: string;
  termsContentMd: string;
  privacyContentMd: string;
  currencySymbol: string;
  budgetFilterThreshold: number;
  platformName: string;
  violationPolicyJson: string;
  sellerEmptyStateCopy: string;
  landingSlidesJson: string;
  maxPriceFilter: number;
  locale: string;
  upiProviderLabel: string;
  defaultCountryCode: string;
  supportedCountryCodes: string[];
  refundPromiseText: string;
  refundSlaHours: number;
}

const DEFAULTS: SystemSettings = {
  baseDeliveryFee: 20,
  freeDeliveryThreshold: 500,
  platformFeePercent: 0,
  supportEmail: 'support@sociva.com',
  grievanceEmail: 'grievance@sociva.in',
  dpoEmail: 'dpo@sociva.com',
  grievanceOfficerName: 'Sociva Grievance Cell',
  headerTagline: 'Your Society, Your Store',
  appVersion: '2.0.0',
  addressBlockLabel: 'Block / Tower',
  addressFlatLabel: 'Flat Number',
  termsLastUpdated: 'February 13, 2026',
  privacyLastUpdated: 'February 13, 2026',
  helpSectionsJson: '',
  termsContentMd: '',
  privacyContentMd: '',
  currencySymbol: '₹',
  budgetFilterThreshold: 150,
  platformName: 'Sociva',
  violationPolicyJson: '',
  sellerEmptyStateCopy: 'Sell products, groceries, or services to your community',
  landingSlidesJson: '',
  maxPriceFilter: 50000,
  locale: 'en-IN',
  upiProviderLabel: 'GPay, PhonePe, Paytm',
  defaultCountryCode: '+91',
  supportedCountryCodes: ['+91', '+1', '+44', '+971', '+65', '+61'],
  refundPromiseText: 'If anything goes wrong, refund within 24 hours',
  refundSlaHours: 24,
};

export function useSystemSettings(): SystemSettings {
  const { data = DEFAULTS } = useQuery({
    queryKey: ['system-settings-core'],
    queryFn: async (): Promise<SystemSettings> => {
      const { data } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', [
          'base_delivery_fee', 'free_delivery_threshold', 'platform_fee_percent',
          'support_email', 'grievance_email', 'dpo_email', 'grievance_officer_name',
          'header_tagline', 'app_version',
          'address_block_label', 'address_flat_label',
          'terms_last_updated', 'privacy_last_updated',
          'help_sections_json', 'terms_content_md', 'privacy_content_md',
          'currency_symbol', 'budget_filter_threshold', 'platform_name',
          'violation_policy_json', 'seller_empty_state_copy', 'landing_slides_json',
          'max_price_filter', 'locale', 'upi_provider_label',
          'default_country_code', 'supported_country_codes',
          'refund_promise_text', 'refund_sla_hours',
        ]);

      const map: Record<string, string> = {};
      for (const row of data || []) {
        if (row.key && row.value) map[row.key] = row.value;
      }

      return {
        baseDeliveryFee: parseInt(map.base_delivery_fee || '20', 10) || 20,
        freeDeliveryThreshold: parseInt(map.free_delivery_threshold || '500', 10) || 500,
        platformFeePercent: parseFloat(map.platform_fee_percent || '0') || 0,
        supportEmail: map.support_email || DEFAULTS.supportEmail,
        grievanceEmail: map.grievance_email || DEFAULTS.grievanceEmail,
        dpoEmail: map.dpo_email || DEFAULTS.dpoEmail,
        grievanceOfficerName: map.grievance_officer_name || DEFAULTS.grievanceOfficerName,
        headerTagline: map.header_tagline || DEFAULTS.headerTagline,
        appVersion: map.app_version || DEFAULTS.appVersion,
        addressBlockLabel: map.address_block_label || DEFAULTS.addressBlockLabel,
        addressFlatLabel: map.address_flat_label || DEFAULTS.addressFlatLabel,
        termsLastUpdated: map.terms_last_updated || DEFAULTS.termsLastUpdated,
        privacyLastUpdated: map.privacy_last_updated || DEFAULTS.privacyLastUpdated,
        helpSectionsJson: map.help_sections_json || DEFAULTS.helpSectionsJson,
        termsContentMd: map.terms_content_md || DEFAULTS.termsContentMd,
        privacyContentMd: map.privacy_content_md || DEFAULTS.privacyContentMd,
        currencySymbol: map.currency_symbol || DEFAULTS.currencySymbol,
        budgetFilterThreshold: parseInt(map.budget_filter_threshold || '150', 10) || 150,
        platformName: map.platform_name || DEFAULTS.platformName,
        violationPolicyJson: map.violation_policy_json || DEFAULTS.violationPolicyJson,
        sellerEmptyStateCopy: map.seller_empty_state_copy || DEFAULTS.sellerEmptyStateCopy,
        landingSlidesJson: map.landing_slides_json || DEFAULTS.landingSlidesJson,
        maxPriceFilter: parseInt(map.max_price_filter || '50000', 10) || 50000,
        locale: map.locale || DEFAULTS.locale,
        upiProviderLabel: map.upi_provider_label || DEFAULTS.upiProviderLabel,
        defaultCountryCode: map.default_country_code || DEFAULTS.defaultCountryCode,
        supportedCountryCodes: map.supported_country_codes
          ? map.supported_country_codes.split(',').map(c => c.trim())
          : DEFAULTS.supportedCountryCodes,
        refundPromiseText: map.refund_promise_text || DEFAULTS.refundPromiseText,
        refundSlaHours: parseInt(map.refund_sla_hours || '24', 10) || 24,
      };
    },
    staleTime: jitteredStaleTime(15 * 60 * 1000),
  });

  // E6: Warn when falling back to defaults
  if (data === DEFAULTS && import.meta.env.DEV) {
    console.warn('[SystemSettings] Using hardcoded defaults — DB query may have failed');
  }

  return data;
}
