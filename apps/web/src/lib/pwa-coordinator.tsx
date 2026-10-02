import React, { useEffect, useState, useCallback, createContext, useContext } from 'react';
import { useLocation } from 'react-router-dom';

export interface PwaContextType {
  isInstallable: boolean;
  appName: string;
  appType: 'admin' | 'technician';
  promptInstall: () => Promise<boolean>;
}

const PwaContext = createContext<PwaContextType>({
  isInstallable: false,
  appName: 'Enterprises CRM',
  appType: 'admin',
  promptInstall: async () => false,
});

export const usePwaInstallPrompt = () => useContext(PwaContext);

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

/**
 * PwaCoordinator
 * Coordinates dynamic manifest selection, route-aware Service Worker registration,
 * and context-isolated installation prompts for:
 * 1. Admin CRM (id: /crm, scope: /, name: Enterprises CRM)
 * 2. Technician Portal (id: /technician, scope: /technician/, name: Enterprises Technician)
 */
export const PwaCoordinator: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const isTechnician = location.pathname.startsWith('/technician');
  const appType: 'admin' | 'technician' = isTechnician ? 'technician' : 'admin';
  const appName = isTechnician ? 'Enterprises Technician' : 'Enterprises CRM';

  const [installPromptEvent, setInstallPromptEvent] = useState<{
    event: BeforeInstallPromptEvent | null;
    capturedFor: 'admin' | 'technician';
  }>({
    event: null,
    capturedFor: 'admin',
  });

  // 1. Dynamic DOM Manifest and Identity Synchronization
  useEffect(() => {
    try {
      const manifestEl = document.getElementById('app-manifest') as HTMLLinkElement | null;
      const appleTitleEl = document.getElementById('app-apple-title') as HTMLMetaElement | null;
      const appNameEl = document.getElementById('app-name-meta') as HTMLMetaElement | null;
      const appleIconEl = document.getElementById('app-apple-icon') as HTMLLinkElement | null;

      if (isTechnician) {
        if (manifestEl && manifestEl.getAttribute('href') !== '/manifest-technician.webmanifest') {
          manifestEl.setAttribute('href', '/manifest-technician.webmanifest');
        }
        if (appleTitleEl) appleTitleEl.setAttribute('content', 'Technician');
        if (appNameEl) appNameEl.setAttribute('content', 'Enterprises Technician');
        if (appleIconEl) appleIconEl.setAttribute('href', '/apple-touch-icon-technician.png');
        if (document.title.indexOf('Technician') === -1) {
          document.title = 'Enterprises Technician';
        }
      } else {
        if (manifestEl && manifestEl.getAttribute('href') !== '/manifest-admin.webmanifest') {
          manifestEl.setAttribute('href', '/manifest-admin.webmanifest');
        }
        if (appleTitleEl) appleTitleEl.setAttribute('content', 'CRM');
        if (appNameEl) appNameEl.setAttribute('content', 'Enterprises CRM');
        if (appleIconEl) appleIconEl.setAttribute('href', '/apple-touch-icon.png');
        if (document.title === 'Enterprises Technician') {
          document.title = 'Enterprises CRM';
        }
      }
    } catch (e) {
      console.warn('[PWA] Error updating manifest identity:', e);
    }
  }, [isTechnician, location.pathname]);

  // 2. Route-Aware Isolated Service Worker Registration
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const swScript = isTechnician ? '/sw-technician.js' : '/sw-admin.js';
    const swScope = isTechnician ? '/technician/' : '/';

    navigator.serviceWorker
      .register(swScript, { scope: swScope })
      .then((registration) => {
        // Automatically check for worker updates on navigation
        registration.update().catch(() => {});
      })
      .catch((err) => {
        console.warn(`[PWA] Failed to register service worker for ${swScope}:`, err);
      });
  }, [isTechnician]);

  // 3. Capture beforeinstallprompt event isolated to active app context
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent automatic browser mini-infobar so app controls installation prompt
      e.preventDefault();
      const currentCapturedFor = window.location.pathname.startsWith('/technician')
        ? 'technician'
        : 'admin';

      setInstallPromptEvent({
        event: e as BeforeInstallPromptEvent,
        capturedFor: currentCapturedFor,
      });
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Check if active install prompt is valid for current route context
  const isInstallable =
    installPromptEvent.event !== null && installPromptEvent.capturedFor === appType;

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!installPromptEvent.event || installPromptEvent.capturedFor !== appType) {
      return false;
    }

    try {
      await installPromptEvent.event.prompt();
      const choice = await installPromptEvent.event.userChoice;
      setInstallPromptEvent({ event: null, capturedFor: appType });
      return choice.outcome === 'accepted';
    } catch (e) {
      console.warn('[PWA] promptInstall failed:', e);
      return false;
    }
  }, [installPromptEvent, appType]);

  return (
    <PwaContext.Provider
      value={{
        isInstallable,
        appName,
        appType,
        promptInstall,
      }}
    >
      {children}
    </PwaContext.Provider>
  );
};
