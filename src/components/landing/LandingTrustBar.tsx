import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Building2, Store, LayoutGrid } from 'lucide-react';

export function LandingTrustBar() {
  const [stats, setStats] = useState({ societies: 0, sellers: 0, categories: 0 });

  useEffect(() => {
    async function fetch() {
      const [s, sel, cat] = await Promise.all([
        supabase.from('societies').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('seller_profiles').select('*', { count: 'exact', head: true }).eq('verification_status', 'approved'),
        supabase.from('parent_groups').select('*', { count: 'exact', head: true }).eq('is_active', true),
      ]);
      setStats({ societies: s.count || 0, sellers: sel.count || 0, categories: cat.count || 0 });
    }
    fetch();
  }, []);

  const items = [
    { icon: Building2, label: 'Societies', value: stats.societies },
    { icon: Store, label: 'Verified Sellers', value: stats.sellers },
    { icon: LayoutGrid, label: 'Service Categories', value: stats.categories },
  ];

  return (
    <section className="py-12 bg-card border-y border-border">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto">
          {items.map(({ icon: Icon, label, value }) => (
            <div key={label} className="text-center">
              <Icon className="mx-auto text-primary mb-2" size={24} />
              <p className="text-2xl md:text-3xl font-bold text-foreground">{value > 0 ? `${value}+` : '—'}</p>
              <p className="text-xs md:text-sm text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
