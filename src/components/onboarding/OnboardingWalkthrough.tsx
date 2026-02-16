import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronRight, ShoppingBag, Users, MapPin, Shield, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OnboardingWalkthroughProps {
  onComplete: () => void;
}

const slides = [
  {
    icon: Users,
    title: 'Community Marketplace',
    description: 'Buy homemade food and local goods exclusively from your community neighbors. Everything is made fresh and delivered within the society.',
    color: 'bg-primary/10 text-primary',
  },
  {
    icon: ShoppingBag,
    title: 'Easy Ordering',
    description: 'Browse sellers, add items to cart, and place orders with just a few taps. Pay via UPI or Cash on Delivery.',
    color: 'bg-success/10 text-success',
  },
  {
    icon: MapPin,
    title: 'Pickup or Delivery',
    description: 'Pick up from the seller\'s home or get it delivered to your doorstep. Track your order in real-time.',
    color: 'bg-info/10 text-info',
  },
  {
    icon: Shield,
    title: 'Trusted & Verified',
    description: 'All sellers are verified society residents. Rate and review after each order to help the community.',
    color: 'bg-warning/10 text-warning',
  },
];

export function OnboardingWalkthrough({ onComplete }: OnboardingWalkthroughProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    // Only trigger if horizontal swipe is dominant
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX < 0) handleNext();
      else handlePrev();
    }
    touchStartX.current = null;
    touchStartY.current = null;
  }, [currentSlide]);

  const slide = slides[currentSlide];
  const Icon = slide.icon;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* Skip button */}
      <div className="flex justify-end p-4">
        <Button variant="ghost" size="sm" onClick={handleSkip}>
          Skip
          <X size={16} className="ml-1" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <div className={cn('w-24 h-24 rounded-3xl flex items-center justify-center mb-8', slide.color)}>
          <Icon size={48} />
        </div>
        <h1 className="text-2xl font-bold text-center mb-4">{slide.title}</h1>
        <p className="text-center text-muted-foreground max-w-xs">{slide.description}</p>
      </div>

      {/* Navigation */}
      <div className="p-6 space-y-4">
        {/* Dots */}
        <div className="flex justify-center gap-2">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={cn(
                'w-2 h-2 rounded-full transition-all',
                index === currentSlide ? 'w-6 bg-primary' : 'bg-muted'
              )}
            />
          ))}
        </div>

        {/* Button */}
        <Button className="w-full" size="lg" onClick={handleNext}>
          {currentSlide === slides.length - 1 ? 'Get Started' : 'Next'}
          <ChevronRight size={18} className="ml-1" />
        </Button>
      </div>
    </div>
  );
}

// Hook to manage onboarding state
export function useOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    if (!hasSeenOnboarding) {
      setShowOnboarding(true);
    }
    setHasChecked(true);
  }, []);

  const completeOnboarding = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    setShowOnboarding(false);
  };

  const resetOnboarding = () => {
    localStorage.removeItem('hasSeenOnboarding');
    setShowOnboarding(true);
  };

  return { showOnboarding, hasChecked, completeOnboarding, resetOnboarding };
}
