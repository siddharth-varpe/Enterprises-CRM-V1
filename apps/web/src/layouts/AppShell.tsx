import React from 'react';
import {
  WifiOff,
  RefreshCw,
  Menu,
  Wrench,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNetworkStatus } from '../providers/NetworkStatusProvider';
import { useUIStore } from '../stores/ui-store';
import { CommandPalette } from '../components/search/CommandPalette';
import { NotificationCenter } from '../components/notifications/NotificationCenter';
import { GlobalSidebar } from '../components/navigation/GlobalSidebar';
import { GlobalFooter } from '../components/navigation/GlobalFooter';
import { ChatbotWidget } from '../components/chatbot/ChatbotWidget';
import { cn } from '../lib/utils';

export interface AppShellProps {
  children?: React.ReactNode;
  activePath?: string;
  onNavigate?: (path: string) => void;
}

export function AppShell({ children, activePath = '/dashboard', onNavigate }: AppShellProps) {
  const navigate = useNavigate();
  const { status, isOnline } = useNetworkStatus();
  const {
    sidebarState,
    mobileNavOpen,
    collapseSidebar,
    setMobileNavOpen,
  } = useUIStore();

  const handleNavClick = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      navigate(path);
    }
    setMobileNavOpen(false);
  };

  // Outside click on workspace collapses the sidebar
  const handleWorkspaceClick = () => {
    if (sidebarState === 'expanded' || sidebarState === 'manuallyExpanded' || sidebarState === 'hoverExpanded') {
      collapseSidebar();
    }
  };

  const isDesktopExpandedOffset =
    sidebarState === 'expanded' || sidebarState === 'manuallyExpanded';

  return (
    <div className="min-h-screen bg-workspace flex flex-col font-sans relative print:bg-white print:min-h-0 print:p-0 print:m-0">
      {/* Network Connectivity Notification Banner */}
      {!isOnline && (
        <div className="bg-amber-500 text-slate-950 px-4 py-1.5 text-xs font-semibold flex items-center justify-center gap-2 shadow-2xs z-50 print:hidden">
          <WifiOff className="w-4 h-4" />
          <span>Offline Mode: Working with cached data. Changes will synchronize upon reconnection.</span>
        </div>
      )}
      {status === 'syncing' && (
        <div className="bg-primary-600 text-white px-4 py-1 text-xs font-medium flex items-center justify-center gap-2 z-50 print:hidden">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Synchronizing state with server...</span>
        </div>
      )}

      {/* Authoritative Permanent Global Master Sidebar */}
      <GlobalSidebar activePath={activePath} onNavigate={handleNavClick} />

      {/* Mobile Drawer Backdrop Overlay */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-xs md:hidden print:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main Application Layout Container */}
      <div
        className={cn(
          'flex-1 flex flex-col transition-all duration-200 ease-out print:pl-0 print:m-0 print:p-0',
          isDesktopExpandedOffset ? 'md:pl-[136px]' : 'md:pl-[68px]'
        )}
      >
        {/* Top Application Header */}
        <header
          onClick={handleWorkspaceClick}
          className="h-16 bg-white border-b border-slate-200/90 px-4 lg:px-6 flex items-center justify-between sticky top-0 z-20 shadow-2xs print:hidden"
        >
          <div className="flex items-center gap-3">
            {/* Mobile Navigation Hamburger Toggle */}
            <button
              type="button"
              className="md:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              onClick={(e) => {
                e.stopPropagation();
                setMobileNavOpen(!mobileNavOpen);
              }}
              aria-label="Toggle mobile navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb / Section context */}
            <div className="flex flex-col min-w-0">
              <span className="font-display font-extrabold text-slate-900 text-xs sm:text-sm tracking-tight block truncate max-w-[150px] xs:max-w-[200px] sm:max-w-none">
                ENTERPRISES CRM
              </span>
              <span className="text-[9px] sm:text-[10px] text-slate-500 font-semibold uppercase tracking-wider hidden xs:block">
                Commercial Service &amp; Sales Management
              </span>
            </div>
          </div>

          {/* Header Action: Quick Navigation to Technician Login */}
          <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => handleNavClick('/technician/login')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-lg border border-slate-200/90 transition-all shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500"
              title="Go to Technician Login"
              aria-label="Technician Login"
            >
              <Wrench className="w-3.5 h-3.5 text-slate-600" />
              <span>Technician Login</span>
            </button>
          </div>
        </header>

        {/* Main Content Workspace (Clicks outside sidebar will collapse it) */}
        <main
          onClick={handleWorkspaceClick}
          className="flex-1 flex flex-col overflow-y-auto p-3 sm:p-6 lg:p-8 print:p-0 print:m-0 print:overflow-visible"
        >
          <div className="flex-1 w-full max-w-7xl mx-auto print:max-w-none print:m-0 print:p-0">{children}</div>
          <GlobalFooter />
        </main>
      </div>

      {/* Global Overlays: Command Palette, Notification Center & Chatbot Widget */}
      <div className="print:hidden">
        <CommandPalette onNavigate={handleNavClick} />
        <NotificationCenter />
        <ChatbotWidget />
      </div>
    </div>
  );
}
