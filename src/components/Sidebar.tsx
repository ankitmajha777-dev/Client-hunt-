import React from 'react';
import {
  LayoutDashboard,
  Crosshair,
  Database,
  Globe,
  Mail,
  MessageSquare,
  Scale,
  Briefcase,
  BarChart3,
  Settings,
  X,
  LogOut,
} from 'lucide-react';
import type { NavSection } from '../types/domain';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  readyProjectsCount: number;
  isDemoMode: boolean;
  userEmail: string | null;
  userName: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
  isSigningIn: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'hunter', label: 'Lead Hunter', icon: Crosshair },
  { id: 'database', label: 'Lead Database', icon: Database },
  { id: 'inspector', label: 'Website Inspector', icon: Globe },
  { id: 'outreach', label: 'AI Outreach', icon: Mail },
  { id: 'conversations', label: 'Conversations', icon: MessageSquare },
  { id: 'negotiator', label: 'AI Negotiator', icon: Scale },
  { id: 'projects', label: 'Ready Projects', icon: Briefcase },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  readyProjectsCount,
  isDemoMode,
  userEmail,
  userName,
  onSignIn,
  onSignOut,
  isSigningIn,
  mobileOpen,
  onCloseMobile,
}) => {
  const [avatarFailed, setAvatarFailed] = React.useState(false);

  const navContent = (
    <div className="flex h-full flex-col bg-[#08080b] border-r border-white/[0.08]">
      {/* Brand header */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-white/[0.08]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white font-display font-bold text-sm tracking-tight">
            AK
          </div>
          <div className="min-w-0">
            <div className="font-display text-sm font-semibold text-white truncate">
              AK47 Client Hunter
            </div>
            <div className="text-[11px] text-zinc-400 truncate">
              {isDemoMode ? 'Demo Workspace · A.M' : 'Live Workspace · A.M'}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 text-zinc-400 hover:text-white rounded-md"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectSection(item.id);
                onCloseMobile();
              }}
              aria-current={active ? 'page' : undefined}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
                active
                  ? 'bg-red-600/15 text-white border border-red-500/30'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-red-500' : 'text-zinc-500'}`} />
                <span className="truncate">{item.label}</span>
              </span>
              {item.id === 'projects' && readyProjectsCount > 0 && (
                <span className="font-mono text-xs font-semibold text-red-400 tabular-nums">
                  {readyProjectsCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Account / Auth Footer */}
      <div className="p-4 border-t border-white/[0.08] space-y-3">
        <div className="flex items-center gap-3">
          {!avatarFailed ? (
            <img
              src="/src/assets/images/avatar_ankit_founder_1794659124280.jpg"
              alt="Ankit Majhi"
              referrerPolicy="no-referrer"
              onError={() => setAvatarFailed(true)}
              className="h-9 w-9 rounded-lg object-cover border border-white/10 shrink-0"
            />
          ) : (
            <div className="h-9 w-9 rounded-lg bg-zinc-800 border border-white/10 flex items-center justify-center text-xs font-semibold text-white shrink-0">
              AM
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-white truncate">
              {userName || 'Ankit Majhi'}
            </div>
            <div className="text-[11px] text-zinc-400 truncate">
              {userEmail || 'ankitmajha777@gmail.com'}
            </div>
          </div>
          {userEmail && (
            <button
              type="button"
              onClick={onSignOut}
              aria-label="Sign out of Google account"
              className="p-1.5 text-zinc-400 hover:text-white rounded-md hover:bg-white/[0.06]"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>

        {!userEmail && (
          <button
            type="button"
            onClick={onSignIn}
            disabled={isSigningIn}
            className="w-full flex items-center justify-center gap-2.5 px-3 py-2 rounded-lg bg-white text-zinc-900 hover:bg-zinc-100 text-xs font-semibold transition-colors disabled:opacity-60 whitespace-nowrap"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
            </svg>
            <span>{isSigningIn ? 'Connecting...' : 'Sign in with Google'}</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0">{navContent}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative w-72 max-w-[85vw] h-full z-10">{navContent}</aside>
        </div>
      )}
    </>
  );
};
