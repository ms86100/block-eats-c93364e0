import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface FavoriteButtonProps {
  sellerId: string;
  initialFavorite?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'icon' | 'button';
  onToggle?: (isFavorite: boolean) => void;
}

export function FavoriteButton({
  sellerId,
  initialFavorite = false,
  size = 'md',
  variant = 'icon',
  onToggle,
}: FavoriteButtonProps) {
  const { user } = useAuth();
  const [isFavorite, setIsFavorite] = useState(initialFavorite);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user && !initialFavorite) {
      checkFavoriteStatus();
    }
  }, [user, sellerId]);

  const checkFavoriteStatus = async () => {
    if (!user) return;
    
    try {
      const { data } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('seller_id', sellerId)
        .single();
      
      setIsFavorite(!!data);
    } catch (error) {
      // Not found is expected
    }
  };

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      toast.error('Please sign in to add favorites');
      return;
    }

    setIsLoading(true);
    try {
      if (isFavorite) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('seller_id', sellerId);

        if (error) throw error;
        setIsFavorite(false);
        toast.success('Removed from favorites');
        onToggle?.(false);
      } else {
        const { error } = await supabase.from('favorites').insert({
          user_id: user.id,
          seller_id: sellerId,
        });

        if (error) throw error;
        setIsFavorite(true);
        toast.success('Added to favorites');
        onToggle?.(true);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorites');
    } finally {
      setIsLoading(false);
    }
  };

  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 24,
  };

  if (variant === 'button') {
    return (
      <Button
        variant={isFavorite ? 'default' : 'outline'}
        size="sm"
        onClick={toggleFavorite}
        disabled={isLoading}
      >
        <Heart
          size={iconSizes[size]}
          className={cn('mr-1', isFavorite && 'fill-current')}
        />
        {isFavorite ? 'Saved' : 'Save'}
      </Button>
    );
  }

  return (
    <button
      onClick={toggleFavorite}
      disabled={isLoading}
      className={cn(
        'p-2 rounded-full transition-all',
        isFavorite
          ? 'bg-primary/10 text-primary'
          : 'bg-white/80 text-muted-foreground hover:bg-white hover:text-primary',
        'shadow-sm backdrop-blur-sm'
      )}
    >
      <Heart
        size={iconSizes[size]}
        className={cn(isFavorite && 'fill-current')}
      />
    </button>
  );
}
