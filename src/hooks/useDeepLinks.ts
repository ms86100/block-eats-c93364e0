import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App, URLOpenListenerEvent } from '@capacitor/app';

/**
 * Hook to handle deep links in Capacitor native apps
 * 
 * Supports:
 * - Custom URL scheme: greenfield://orders/123
 * - Universal Links (iOS): https://block-eats.lovable.app/#/orders/123
 * - App Links (Android): https://block-eats.lovable.app/#/orders/123
 * 
 * Since the app uses HashRouter, deep link paths are extracted from:
 * 1. The hash fragment (e.g., /#/orders/123 -> /orders/123)
 * 2. The pathname for custom schemes (e.g., greenfield://orders/123 -> /orders/123)
 */
export function useDeepLinks() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const handleDeepLink = (event: URLOpenListenerEvent) => {
      console.log('Deep link received:', event.url);
      
      try {
        const url = new URL(event.url);
        let path = '';

        // Check if URL has a hash (for universal links with HashRouter)
        if (url.hash && url.hash.startsWith('#/')) {
          // Extract path from hash: https://domain.com/#/orders/123 -> /orders/123
          path = url.hash.substring(1); // Remove the leading #
        } else if (url.protocol === 'greenfield:' || url.protocol === 'greenfieldcommunity:') {
          // Custom URL scheme: greenfield://orders/123
          // pathname will be /orders/123 or orders/123
          path = url.pathname.startsWith('/') ? url.pathname : `/${url.pathname}`;
          // Include query params if any
          if (url.search) {
            path += url.search;
          }
        } else {
          // Universal link without hash, use pathname
          path = url.pathname;
          if (url.search) {
            path += url.search;
          }
        }

        if (path && path !== '/') {
          console.log('Navigating to:', path);
          navigate(path);
        }
      } catch (error) {
        console.error('Error parsing deep link:', error);
      }
    };

    // Listen for app URL open events
    const listenerPromise = App.addListener('appUrlOpen', handleDeepLink);

    // Check if app was opened via deep link (cold start)
    App.getLaunchUrl().then((launchUrl) => {
      if (launchUrl?.url) {
        console.log('App launched via deep link:', launchUrl.url);
        handleDeepLink({ url: launchUrl.url });
      }
    });

    // Cleanup listener on unmount
    return () => {
      listenerPromise.then((listener) => listener.remove());
    };
  }, [navigate]);
}
