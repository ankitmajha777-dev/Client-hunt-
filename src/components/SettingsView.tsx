import React, { useEffect, useState } from 'react';
import { Save, Plus, Trash2, Database, KeyRound, CheckCircle2 } from 'lucide-react';
import {
  BUSINESS_CATEGORIES,
  TARGET_COUNTRIES,
  type AgencySettings,
  type TargetCountry,
} from '../types/domain';

interface SettingsViewProps {
  settings: AgencySettings;
  isDemoMode: boolean;
  userEmail: string | null;
  gmailConnected: boolean;
  onToggleDemoMode: (nextDemo: boolean) => void;
  onSaveSettings: (updated: AgencySettings) => void;
  onSignIn: () => void;
  onResetDemoWorkspace: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  isDemoMode,
  userEmail,
  gmailConnected,
  onToggleDemoMode,
  onSaveSettings,
  onSignIn,
  onResetDemoWorkspace,
}) => {
  const [draft, setDraft] = useState<AgencySettings>(settings);
  const [newCategory, setNewCategory] = useState('');
  const [newOptOutEmail, setNewOptOutEmail] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const toggleCountry = (c: TargetCountry) => {
    setDraft((prev) => {
      const exists = prev.targetCountries.includes(c);
      const next = exists
        ? prev.targetCountries.length > 1
          ? prev.targetCountries.filter((x) => x !== c)
          : prev.targetCountries
        : [...prev.targetCountries, c];
      return { ...prev, targetCountries: next };
    });
  };

  const toggleCategory = (cat: string) => {
    setDraft((prev) => {
      const exists = prev.targetCategories.includes(cat);
      const next = exists
        ? prev.targetCategories.filter((x) => x !== cat)
        : [...prev.targetCategories, cat];
      return { ...prev, targetCategories: next };
    });
  };

  const handleAddCustomCategory = () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    if (!draft.targetCategories.includes(trimmed)) {
      setDraft((p) => ({ ...p, targetCategories: [...p.targetCategories, trimmed] }));
    }
    setNewCategory('');
  };

  const handleAddOptOut = () => {
    const email = newOptOutEmail.trim().toLowerCase();
    if (!email) return;
    if (!draft.optOutEmails.includes(email)) {
      setDraft((p) => ({ ...p, optOutEmails: [...p.optOutEmails, email] }));
    }
    setNewOptOutEmail('');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(draft);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white tracking-tight">
            Workspace & Agent Settings
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Configure owner profile, target markets, daily automation targets, compliance rules, and live integrations.
          </p>
        </div>
        <button
          type="submit"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
        >
          <Save className="h-3.5 w-3.5" />
          <span>Save Settings</span>
        </button>
      </div>

      {savedNotice && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-4 py-2.5 text-xs text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>Workspace configuration saved.</span>
        </div>
      )}

      {/* Workspace Mode Switcher */}
      <div className="glass-panel rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-display text-base font-semibold text-white flex items-center gap-2">
              <Database className="h-4 w-4 text-red-500" />
              <span>Workspace Mode: {isDemoMode ? 'Demo Mode (Sample Data)' : 'Live Production Mode'}</span>
            </h2>
            <p className="text-xs text-zinc-400">
              {isDemoMode
                ? 'Demo Mode displays 30 clearly labeled fictional businesses so you can test scoring, audits, and sales conversations safely.'
                : userEmail
                  ? `Connected as ${userEmail}. All leads, audits, and ready projects persist to Firebase Firestore.`
                  : 'Sign in with Google to persist live Google Places leads and send real Gmail outreach.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onToggleDemoMode(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                isDemoMode
                  ? 'bg-amber-500/20 border border-amber-400/40 text-amber-200'
                  : 'bg-white/[0.05] text-zinc-300 hover:bg-white/[0.1]'
              }`}
            >
              Demo Mode
            </button>
            <button
              type="button"
              onClick={() => onToggleDemoMode(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                !isDemoMode
                  ? 'bg-red-600 text-white'
                  : 'bg-white/[0.05] text-zinc-300 hover:bg-white/[0.1]'
              }`}
            >
              Live Mode
            </button>
            {isDemoMode && (
              <button
                type="button"
                onClick={onResetDemoWorkspace}
                className="px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-xs text-zinc-300"
              >
                Reset Demo Data
              </button>
            )}
          </div>
        </div>

        {!userEmail && (
          <div className="pt-3 border-t border-white/[0.08] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="text-xs text-zinc-300">
              Google Sign-In unlocks Firebase Firestore persistence and Gmail API outreach scopes.
            </span>
            <button
              type="button"
              onClick={onSignIn}
              className="px-4 py-2 rounded-lg bg-white text-zinc-900 text-xs font-semibold hover:bg-zinc-100 whitespace-nowrap shrink-0"
            >
              Sign in with Google
            </button>
          </div>
        )}
      </div>

      {/* Agency Identity & Portfolio */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel rounded-xl p-5 space-y-4">
          <h2 className="font-display text-base font-semibold text-white">
            Agency Profile & AI Identity
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label htmlFor="set-owner-name" className="block text-zinc-400 mb-1">
                Owner Name
              </label>
              <input
                id="set-owner-name"
                type="text"
                value={draft.ownerName}
                onChange={(e) => setDraft((p) => ({ ...p, ownerName: e.target.value }))}
                className="w-full rounded-lg bg-black/60 border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-red-500"
              />
            </div>
            <div>
              <label htmlFor="set-business-name" className="block text-zinc-400 mb-1">
                Business / Agency Name
              </label>
              <input
                id="set-business-name"
                type="text"
                value={draft.businessName}
                onChange={(e) => setDraft((p) => ({ ...p, businessName: e.target.value }))}
                className="w-full rounded-lg bg-black/60 border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-red-500"
              />
            </div>
            <div>
              <label htmlFor="set-contact-email" className="block text-zinc-400 mb-1">
                Owner Contact Email
              </label>
              <input
                id="set-contact-email"
                type="email"
                value={draft.contactEmail}
                onChange={(e) => setDraft((p) => ({ ...p, contactEmail: e.target.value }))}
                className="w-full rounded-lg bg-black/60 border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-red-500"
              />
            </div>
            <div>
              <label htmlFor="set-ai-personality" className="block text-zinc-400 mb-1">
                AI Personality
              </label>
              <select
                id="set-ai-personality"
                value={draft.aiPersonality}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    aiPersonality: e.target.value as AgencySettings['aiPersonality'],
                  }))
                }
                className="w-full rounded-lg bg-black/60 border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-red-500"
              >
                <option value="Consultative & Crisp">Consultative & Crisp</option>
                <option value="Executive & Direct">Executive & Direct</option>
                <option value="Warm & Helpful">Warm & Helpful</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="set-portfolio-url" className="block text-zinc-400 mb-1">
                Portfolio URL (AI only shares if configured; never fabricated)
              </label>
              <input
                id="set-portfolio-url"
                type="url"
                value={draft.portfolioUrl}
                onChange={(e) => setDraft((p) => ({ ...p, portfolioUrl: e.target.value }))}
                placeholder="https://your-real-portfolio.com (leave blank if none)"
                className="w-full rounded-lg bg-black/60 border border-white/10 px-3 py-2 text-white placeholder:text-zinc-500 focus:outline-none focus:border-red-500"
              />
            </div>
          </div>
        </div>

        {/* Daily Automation & Notifications */}
        <div className="glass-panel rounded-xl p-5 space-y-4">
          <h2 className="font-display text-base font-semibold text-white">
            Daily Automation Targets & Compliance
          </h2>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <label htmlFor="set-target-disc" className="block text-zinc-400 mb-1">
                Discovery / Day
              </label>
              <input
                id="set-target-disc"
                type="number"
                min={1}
                value={draft.automation.dailyDiscoveryTarget}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    automation: {
                      ...p.automation,
                      dailyDiscoveryTarget: Math.max(1, Number(e.target.value)),
                    },
                  }))
                }
                className="w-full rounded-lg bg-black/60 border border-white/10 px-3 py-2 font-mono text-white focus:outline-none focus:border-red-500"
              />
            </div>
            <div>
              <label htmlFor="set-target-ver" className="block text-zinc-400 mb-1">
                Verified / Day
              </label>
              <input
                id="set-target-ver"
                type="number"
                min={1}
                value={draft.automation.dailyVerifiedTarget}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    automation: {
                      ...p.automation,
                      dailyVerifiedTarget: Math.max(1, Number(e.target.value)),
                    },
                  }))
                }
                className="w-full rounded-lg bg-black/60 border border-white/10 px-3 py-2 font-mono text-white focus:outline-none focus:border-red-500"
              />
            </div>
            <div>
              <label htmlFor="set-target-out" className="block text-zinc-400 mb-1">
                Outreach / Day
              </label>
              <input
                id="set-target-out"
                type="number"
                min={1}
                value={draft.automation.dailyOutreachTarget}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    automation: {
                      ...p.automation,
                      dailyOutreachTarget: Math.max(1, Number(e.target.value)),
                    },
                  }))
                }
                className="w-full rounded-lg bg-black/60 border border-white/10 px-3 py-2 font-mono text-white focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
            <label className="flex items-center gap-2 text-zinc-300">
              <input
                type="checkbox"
                checked={draft.automation.enabled}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    automation: { ...p.automation, enabled: e.target.checked },
                  }))
                }
                className="accent-red-600"
              />
              <span>Enable Scheduled Daily Automation</span>
            </label>
            <label className="flex items-center gap-2 text-zinc-300">
              <input
                type="checkbox"
                checked={draft.automation.preventDuplicates}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    automation: { ...p.automation, preventDuplicates: e.target.checked },
                  }))
                }
                className="accent-red-600"
              />
              <span>Prevent Duplicate Outreach</span>
            </label>
            <label className="flex items-center gap-2 text-zinc-300">
              <input
                type="checkbox"
                checked={draft.automation.respectUnsubscribes}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    automation: { ...p.automation, respectUnsubscribes: e.target.checked },
                  }))
                }
                className="accent-red-600"
              />
              <span>Enforce Opt-Out / Unsubscribe List</span>
            </label>
            <label className="flex items-center gap-2 text-zinc-300">
              <input
                type="checkbox"
                checked={draft.notifications.notifyOnReadyProject}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    notifications: { ...p.notifications, notifyOnReadyProject: e.target.checked },
                  }))
                }
                className="accent-red-600"
              />
              <span>Notify Ankit on Ready Project</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2 border-t border-white/[0.08]">
            <div>
              <label htmlFor="set-notify-phone" className="block text-zinc-400 mb-1">
                Ready Project Alert Phone / WhatsApp
              </label>
              <input
                id="set-notify-phone"
                type="tel"
                value={draft.notifications.notifyPhone}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    notifications: { ...p.notifications, notifyPhone: e.target.value },
                  }))
                }
                placeholder="+91 78530 25466"
                className="w-full rounded-lg bg-black/60 border border-white/10 px-3 py-2 font-mono text-white focus:outline-none focus:border-red-500"
              />
            </div>
            <div>
              <label htmlFor="set-notify-email" className="block text-zinc-400 mb-1">
                Ready Project Alert Email
              </label>
              <input
                id="set-notify-email"
                type="email"
                value={draft.notifications.notifyEmail}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    notifications: { ...p.notifications, notifyEmail: e.target.value },
                  }))
                }
                className="w-full rounded-lg bg-black/60 border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          <p className="text-[11px] text-zinc-500">
            Daily targets are configurable workflow caps (not guaranteed discovery or response volumes) and remain subject to Gmail and Google Maps Platform quotas.
          </p>
        </div>
      </div>

      {/* Target Countries & Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel rounded-xl p-5 space-y-3">
          <h2 className="font-display text-base font-semibold text-white">
            Default Target Markets
          </h2>
          <div className="flex flex-wrap gap-2">
            {TARGET_COUNTRIES.map((c) => {
              const active = draft.targetCountries.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCountry(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    active
                      ? 'bg-red-600 text-white'
                      : 'bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08] border border-white/[0.08]'
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        <div className="glass-panel rounded-xl p-5 space-y-3">
          <h2 className="font-display text-base font-semibold text-white">
            Active Business Categories
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {Array.from(new Set([...BUSINESS_CATEGORIES, ...draft.targetCategories])).map((cat) => {
              const active = draft.targetCategories.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                    active
                      ? 'bg-red-600/25 border border-red-500/40 text-white'
                      : 'bg-white/[0.03] border border-white/[0.06] text-zinc-400 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 pt-1">
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Add custom category..."
              className="flex-1 rounded-lg bg-black/60 border border-white/10 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-500"
            />
            <button
              type="button"
              onClick={handleAddCustomCategory}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.12] text-xs text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add</span>
            </button>
          </div>
        </div>
      </div>

      {/* Opt-Out Registry & API Setup Instructions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel rounded-xl p-5 space-y-3">
          <h2 className="font-display text-base font-semibold text-white">
            Unsubscribe & Opt-Out Compliance List
          </h2>
          <p className="text-xs text-zinc-400">
            Addresses added here are permanently blocked from AI outreach drafts and automated follow-ups.
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              value={newOptOutEmail}
              onChange={(e) => setNewOptOutEmail(e.target.value)}
              placeholder="optout@business.com"
              className="flex-1 rounded-lg bg-black/60 border border-white/10 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-500"
            />
            <button
              type="button"
              onClick={handleAddOptOut}
              className="px-3 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.12] text-xs font-medium text-white"
            >
              Block Email
            </button>
          </div>
          {draft.optOutEmails.length === 0 ? (
            <div className="text-xs text-zinc-500 py-2">No opted-out addresses recorded.</div>
          ) : (
            <ul className="divide-y divide-white/[0.06] max-h-40 overflow-y-auto text-xs">
              {draft.optOutEmails.map((em) => (
                <li key={em} className="py-2 flex items-center justify-between gap-2">
                  <span className="font-mono text-zinc-300">{em}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((p) => ({
                        ...p,
                        optOutEmails: p.optOutEmails.filter((x) => x !== em),
                      }))
                    }
                    aria-label={`Remove ${em} from opt-out list`}
                    className="text-zinc-500 hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="glass-panel rounded-xl p-5 space-y-3">
          <h2 className="font-display text-base font-semibold text-white flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-red-500" />
            <span>External API Setup Guide</span>
          </h2>
          <ol className="space-y-2 text-xs text-zinc-300 leading-relaxed list-decimal list-inside">
            <li>
              <strong className="text-white">Google Places & Maps API:</strong> Configured via server environment (<code className="font-mono text-zinc-400">GOOGLE_MAPS_API_KEY</code>) and browser Maps key (<code className="font-mono text-zinc-400">VITE_GOOGLE_MAPS_API_KEY</code>) with HTTP referrer & API restrictions in Google Cloud Console.
            </li>
            <li>
              <strong className="text-white">Gemini AI Engine:</strong> Server-side <code className="font-mono text-zinc-400">GEMINI_API_KEY</code> powers personalized outreach drafting and natural-language sales responses without exposing credentials to the browser.
            </li>
            <li>
              <strong className="text-white">Gmail OAuth Integration:</strong>{' '}
              {gmailConnected
                ? 'Active in current session (readonly, compose, and send scopes authorized).'
                : 'Click Sign in with Google in the sidebar to grant Gmail readonly, compose, and send permissions.'}
            </li>
            <li>
              <strong className="text-white">Firebase Firestore:</strong> User-scoped security rules isolate leads, audits, conversations, and ready projects under your authenticated Google UID.
            </li>
          </ol>
        </div>
      </div>
    </form>
  );
};
