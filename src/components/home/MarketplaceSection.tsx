import { useState, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useProductsByCategory } from '@/hooks/queries/useProductsByCategory';
import { useParentGroups } from '@/hooks/useParentGroups';
import { ParentGroupTabs } from '@/components/home/ParentGroupTabs';
import { CategoryImageGrid } from '@/components/home/CategoryImageGrid';
import { FeaturedBanners } from '@/components/home/FeaturedBanners';
import { ShopByStoreDiscovery } from '@/components/home/ShopByStoreDiscovery';
import { ProductListingCard, ProductWithSeller } from '@/components/product/ProductListingCard';
import { ProductDetailSheet } from '@/components/product/ProductDetailSheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Store, ChevronRight, ShoppingBag, Sparkles, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { escapeIlike } from '@/lib/query-utils';
import { useCategoryConfigs } from '@/hooks/useCategoryBehavior';
import { useMarketplaceConfig } from '@/hooks/useMarketplaceConfig';
import { useBadgeConfig } from '@/hooks/useBadgeConfig';

export function MarketplaceSection() {
  const navigate = useNavigate();
  const { user, profile, effectiveSocietyId } = useAuth();

  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { configs: categoryConfigs } = useCategoryConfigs();
  const mc = useMarketplaceConfig();
  const { badges: badgeConfigs } = useBadgeConfig();

  const { data: localCategories = [], isLoading: loadingLocal } = useProductsByCategory(80);
  const { parentGroupInfos } = useParentGroups();

  const filteredCategories = activeGroup
    ? localCategories.filter(cat => cat.parentGroup === activeGroup)
    : localCategories;

  const activeCategorySet = new Set(localCategories.map(c => c.category));
  const activeParentGroupSet = new Set(localCategories.map(c => c.parentGroup));

  const activeParentGroups = activeGroup
    ? parentGroupInfos.filter(g => g.value === activeGroup && activeParentGroupSet.has(g.value))
    : parentGroupInfos.filter(g => activeParentGroupSet.has(g.value));

  const handleProductTap = useCallback((product: ProductWithSeller) => {
    const catConfig = categoryConfigs.find(c => c.category === product.category);
    setSelectedProduct({
      product_id: product.id,
      product_name: product.name,
      price: product.price,
      image_url: product.image_url,
      is_veg: product.is_veg,
      category: product.category,
      description: product.description,
      prep_time_minutes: product.prep_time_minutes,
      fulfillment_mode: product.fulfillment_mode,
      delivery_note: product.delivery_note,
      action_type: product.action_type,
      contact_phone: product.contact_phone,
      specifications: product.specifications || null,
      seller_id: product.seller_id,
      seller_name: product.seller_name || 'Seller',
      seller_rating: product.seller_rating || 0,
      seller_reviews: product.seller_reviews || 0,
      society_name: (product as any).society_name || null,
      distance_km: (product as any).distance_km ?? null,
      is_same_society: (product as any).is_same_society ?? true,
      last_active_at: (product as any).last_active_at ?? null,
      _catIcon: catConfig?.icon || '🛍️',
      _catName: catConfig?.displayName || product.category,
    });
    setDetailOpen(true);
  }, [categoryConfigs]);

  return (
    <div className="pb-2">
      {/* ━━━ Parent Group Pill Tabs ━━━ */}
      <div className="pt-3 pb-4">
        <ParentGroupTabs activeGroup={activeGroup} onGroupChange={setActiveGroup} activeParentGroups={activeParentGroupSet} />
      </div>

      {/* ━━━ Category Image Sections ━━━ */}
      {activeParentGroups.slice(0, 4).map((group) => (
        <CategoryImageGrid
          key={group.value}
          parentGroup={group.value}
          title={group.label}
          activeCategories={activeCategorySet}
        />
      ))}

      {/* ━━━ Featured Banners ━━━ */}
      <FeaturedBanners />

      {/* ━━━ Product Listings ━━━ */}
      <ProductListings
        categories={filteredCategories}
        isLoading={loadingLocal}
        onProductTap={handleProductTap}
        onNavigate={navigate}
        categoryConfigs={categoryConfigs}
        marketplaceConfig={mc}
        badgeConfigs={badgeConfigs}
      />

      {/* ━━━ Shop by Store Discovery ━━━ */}
      <ShopByStoreDiscovery />

      {/* ━━━ Product Detail Sheet ━━━ */}
      <ProductDetailSheet
        product={selectedProduct}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        categoryIcon={selectedProduct?._catIcon}
        categoryName={selectedProduct?._catName}
      />
    </div>
  );
}

// ── Product Listings by Category ──
function ProductListings({
  categories, isLoading, onProductTap, onNavigate, categoryConfigs, marketplaceConfig, badgeConfigs,
}: {
  categories: { category: string; parentGroup: string; displayName: string; icon: string; products: ProductWithSeller[] }[];
  isLoading: boolean;
  onProductTap?: (product: ProductWithSeller) => void;
  onNavigate?: (path: string) => void;
  categoryConfigs?: any[];
  marketplaceConfig?: any;
  badgeConfigs?: any[];
}) {
  if (isLoading) {
    return (
      <div className="px-4 space-y-5 mt-4">
        {[1, 2].map(i => (
          <div key={i}>
            <Skeleton className="h-5 w-40 mb-3" />
            <div className="flex gap-3">
              {[1, 2, 3].map(j => <Skeleton key={j} className="w-[150px] h-56 rounded-xl shrink-0" />)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="relative mb-6"
        >
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
            <ShoppingBag size={40} className="text-primary" />
          </div>
          <div className="absolute -top-2 -right-2">
            <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center">
              <Sparkles size={16} className="text-warning" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="space-y-3"
        >
          <h2 className="text-lg font-extrabold text-foreground tracking-tight">Your marketplace is getting ready!</h2>
          <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
            Sellers from your community are setting up shop. Products, services & more — all coming your way.
          </p>
        </motion.div>

        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="mt-6 flex items-center gap-2 text-xs text-muted-foreground bg-card border border-border rounded-full px-4 py-2"
        >
          <Clock size={14} />
          <span>New listings appear here automatically</span>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-8 mt-5">
      {categories.map(cat => (
        <div key={cat.category}>
          <div className="flex items-center justify-between px-4 mb-3">
            <h3 className="font-extrabold text-[15px] text-foreground tracking-tight flex items-center gap-1.5">
              <span className="text-base">{cat.icon}</span>
              {cat.displayName}
            </h3>
            <Link
              to={`/category/${cat.category}`}
              className="text-[11px] font-bold text-primary flex items-center gap-0.5"
            >
              see all <ChevronRight size={12} />
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4 pb-1 snap-x snap-mandatory">
            {cat.products.slice(0, 8).map(product => (
              <div key={product.id} className="w-[155px] shrink-0 snap-start">
                <ProductListingCard
                  product={product}
                  onTap={onProductTap}
                  onNavigate={onNavigate}
                  categoryConfigs={categoryConfigs}
                  marketplaceConfig={marketplaceConfig}
                  badgeConfigs={badgeConfigs}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
