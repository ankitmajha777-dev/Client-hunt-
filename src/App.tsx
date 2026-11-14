import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { Menu, AlertTriangle, X, Loader2 } from 'lucide-react';
import {
  type ActivityLog,
  type AgencySettings,
  type ConversationThread,
  type LeadRecord,
  type NavSection,
  type OutreachMessage,
  type ReadyProject,
  type WebsiteAudit,
} from './types/domain';
import { DEFAULT_SETTINGS, getPricingForCountry } from './lib/pricing';
import { buildDemoDataset } from './lib/demoData';
import { computeOverviewStats } from './lib/metrics';
import { calculateLeadScore, generateDeterministicAuditMetrics } from './lib/scoring';
import {
  initFirebaseAuth,
  logoutFirebase,
  signInWithGoogleGmail,
} from './lib/firebase';
import {
  appendActivityLogToFirestore,
  deleteLeadInFirestore,
  ensureUserProfile,
  loadLiveWorkspace,
  saveAuditToFirestore,
  saveConversationToFirestore,
  saveLeadToFirestore,
  saveOutreachToFirestore,
  saveReadyProjectToFirestore,
  saveSettingsToFirestore,
  takeOverProjectInFirestore,
  updateLeadFieldsInFirestore,
} from './lib/firestoreService';
import { Sidebar } from './components/Sidebar';
import { OverviewView } from './components/OverviewView';
import { LeadHunterView } from './components/LeadHunterView';
import { LeadDatabaseView } from './components/LeadDatabaseView';
import { WebsiteInspectorView } from './components/WebsiteInspectorView';
import { OutreachView } from './components/OutreachView';
import { ConversationsView } from './components/ConversationsView';
import { NegotiatorView } from './components/NegotiatorView';
import { ReadyProjectsView } from './components/ReadyProjectsView';
import { AnalyticsView } from './components/AnalyticsView';
import { SettingsView } from './components/SettingsView';

interface WorkspaceState {
  leads: LeadRecord[];
  audits: WebsiteAudit[];
  outreachMessages: OutreachMessage[];
  conversations: ConversationThread[];
  readyProjects: ReadyProject[];
  activityLogs: ActivityLog[];
}

const EMPTY_WORKSPACE: WorkspaceState = {
  leads: [],
  audits: [],
  outreachMessages: [],
  conversations: [],
  readyProjects: [],
  activityLogs: [],
};

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(err: unknown) {
    return {
      hasError: true,
      message: err instanceof Error ? err.message : 'Unexpected workspace error.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#060608] text-white flex items-center justify-center p-6">
          <div className="glass-panel rounded-xl max-w-md w-full p-6 space-y-4">
            <h1 className="font-display text-lg font-semibold text-red-400">
              Workspace Recovery
            </h1>
            <p className="text-xs text-zinc-300 leading-relaxed">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Auth & Workspace Mode
  const [user, setUser] = useState<User | null>(null);
  const [gmailAccessToken, setGmailAccessToken] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isLoadingLive, setIsLoadingLive] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(true);

  // Separate Demo & Live datasets so demo data never contaminates live leads
  const [demoWorkspace, setDemoWorkspace] = useState<WorkspaceState>(() => buildDemoDataset());
  const [liveWorkspace, setLiveWorkspace] = useState<WorkspaceState>(EMPTY_WORKSPACE);
  const [settings, setSettings] = useState<AgencySettings>(DEFAULT_SETTINGS);

  // Cross-view selection handoffs
  const [inspectorLeadId, setInspectorLeadId] = useState<string | null>(null);
  const [outreachLeadId, setOutreachLeadId] = useState<string | null>(null);

  // Alerts & Case A GMP Quota Banner
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 4000);
  }, []);

  // Google Maps Platform Tier 1 Quota Exceeded Listener (Case A)
  useEffect(() => {
    const onQuota = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuota);
  }, []);

  const hydrateLiveWorkspace = useCallback(async (authedUser: User) => {
    setIsLoadingLive(true);
    setErrorBanner(null);
    try {
      await ensureUserProfile(authedUser);
      const data = await loadLiveWorkspace(authedUser.uid);
      setLiveWorkspace({
        leads: data.leads,
        audits: data.audits,
        outreachMessages: data.outreachMessages,
        conversations: data.conversations,
        readyProjects: data.readyProjects,
        activityLogs: data.activityLogs.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        ),
      });
      if (data.settings) {
        setSettings({
          ...DEFAULT_SETTINGS,
          ...data.settings,
          notifications: {
            ...DEFAULT_SETTINGS.notifications,
            ...(data.settings.notifications || {}),
          },
        });
      }
    } catch (err) {
      setErrorBanner(
        err instanceof Error
          ? `Unable to load live Firestore workspace: ${err.message}`
          : 'Unable to load live Firestore workspace.'
      );
    } finally {
      setIsLoadingLive(false);
    }
  }, []);

  // Firebase Auth listener
  useEffect(() => {
    const unsub = initFirebaseAuth((authedUser, token) => {
      setUser(authedUser);
      if (token) setGmailAccessToken(token);
      if (authedUser) {
        void hydrateLiveWorkspace(authedUser);
      } else {
        setLiveWorkspace(EMPTY_WORKSPACE);
        setGmailAccessToken(null);
      }
    });
    return () => unsub();
  }, [hydrateLiveWorkspace]);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setErrorBanner(null);
    try {
      const { user: authedUser, accessToken } = await signInWithGoogleGmail();
      setUser(authedUser);
      setGmailAccessToken(accessToken);
      setIsDemoMode(false);
      await hydrateLiveWorkspace(authedUser);
      showToast(`Signed in as ${authedUser.email || authedUser.displayName}. Live mode enabled.`);
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Google Sign-In did not complete.'
      );
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await logoutFirebase();
    setUser(null);
    setGmailAccessToken(null);
    setIsDemoMode(true);
    showToast('Signed out. Switched back to Demo Mode.');
  };

  const activeWorkspace = isDemoMode ? demoWorkspace : liveWorkspace;
  const updateActiveWorkspace = useCallback(
    (updater: (prev: WorkspaceState) => WorkspaceState) => {
      if (isDemoMode) {
        setDemoWorkspace(updater);
      } else {
        setLiveWorkspace(updater);
      }
    },
    [isDemoMode]
  );

  const stats = useMemo(
    () =>
      computeOverviewStats({
        leads: activeWorkspace.leads,
        outreachMessages: activeWorkspace.outreachMessages,
        conversations: activeWorkspace.conversations,
        readyProjects: activeWorkspace.readyProjects,
      }),
    [activeWorkspace]
  );

  const recordLog = useCallback(
    (entry: Omit<ActivityLog, 'id' | 'timestamp' | 'isDemo'>) => {
      const log: ActivityLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        ...entry,
        timestamp: new Date().toISOString(),
        isDemo: isDemoMode,
      };
      updateActiveWorkspace((prev) => ({
        ...prev,
        activityLogs: [log, ...prev.activityLogs].slice(0, 50),
      }));
      if (!isDemoMode && user) {
        void appendActivityLogToFirestore(user.uid, log).catch((err) =>
          console.error('Activity log error:', err)
        );
      }
    },
    [isDemoMode, updateActiveWorkspace, user]
  );

  const handleSaveLeads = useCallback(
    async (newLeads: LeadRecord[]) => {
      if (newLeads.length === 0) return;
      updateActiveWorkspace((prev) => {
        const existingPlaceIds = new Set(prev.leads.map((l) => l.placeId));
        const unique = newLeads.filter((l) => !existingPlaceIds.has(l.placeId));
        return {
          ...prev,
          leads: [...unique, ...prev.leads],
        };
      });

      if (!isDemoMode && user) {
        try {
          await Promise.all(newLeads.map((lead) => saveLeadToFirestore(user.uid, lead)));
        } catch (err) {
          setErrorBanner(err instanceof Error ? err.message : 'Failed saving leads to Firestore.');
        }
      }
      recordLog({
        type: 'discovery',
        title: `Saved ${newLeads.length} business listing${newLeads.length === 1 ? '' : 's'}`,
        detail: `Added discovered prospects to ${isDemoMode ? 'Demo' : 'Live'} Lead Database.`,
      });
      showToast(`Saved ${newLeads.length} lead${newLeads.length === 1 ? '' : 's'} to database.`);
    },
    [isDemoMode, recordLog, showToast, updateActiveWorkspace, user]
  );

  const handleUpdateLead = useCallback(
    async (leadId: string, patch: Partial<LeadRecord>) => {
      updateActiveWorkspace((prev) => ({
        ...prev,
        leads: prev.leads.map((l) =>
          l.id === leadId ? { ...l, ...patch, updatedAt: new Date().toISOString() } : l
        ),
      }));

      if (!isDemoMode && user) {
        try {
          await updateLeadFieldsInFirestore(leadId, patch);
        } catch (err) {
          setErrorBanner(err instanceof Error ? err.message : 'Failed updating lead.');
        }
      }
    },
    [isDemoMode, updateActiveWorkspace, user]
  );

  const handleDeleteLead = useCallback(
    async (leadId: string) => {
      updateActiveWorkspace((prev) => ({
        ...prev,
        leads: prev.leads.filter((l) => l.id !== leadId),
      }));
      if (!isDemoMode && user) {
        try {
          await deleteLeadInFirestore(leadId);
        } catch (err) {
          setErrorBanner(err instanceof Error ? err.message : 'Failed deleting lead.');
        }
      }
      showToast('Lead removed from database.');
    },
    [isDemoMode, showToast, updateActiveWorkspace, user]
  );

  const handleSaveAuditAndRescore = useCallback(
    async (leadId: string, audit: WebsiteAudit, updatedLeadPatch: Partial<LeadRecord>) => {
      updateActiveWorkspace((prev) => {
        const otherAudits = prev.audits.filter((a) => a.businessId !== leadId);
        return {
          ...prev,
          audits: [audit, ...otherAudits],
          leads: prev.leads.map((l) =>
            l.id === leadId
              ? { ...l, ...updatedLeadPatch, updatedAt: new Date().toISOString() }
              : l
          ),
        };
      });

      if (!isDemoMode && user) {
        try {
          await Promise.all([
            saveAuditToFirestore(user.uid, audit),
            updateLeadFieldsInFirestore(leadId, updatedLeadPatch),
          ]);
        } catch (err) {
          setErrorBanner(err instanceof Error ? err.message : 'Failed saving audit.');
        }
      }

      recordLog({
        type: 'audit',
        title: `Website audit completed (Tier ${audit.tier})`,
        detail: `Re-scored lead ${updatedLeadPatch.score ? `${updatedLeadPatch.score.total}/100` : ''}.`,
      });
    },
    [isDemoMode, recordLog, updateActiveWorkspace, user]
  );

  const handleSaveOutreach = useCallback(
    async (msg: OutreachMessage, markContactedLeadId?: string) => {
      updateActiveWorkspace((prev) => ({
        ...prev,
        outreachMessages: [msg, ...prev.outreachMessages],
        leads: markContactedLeadId
          ? prev.leads.map((l) =>
              l.id === markContactedLeadId && l.stage === 'New Lead'
                ? { ...l, stage: 'Contacted', updatedAt: new Date().toISOString() }
                : l
            )
          : prev.leads,
      }));

      if (!isDemoMode && user) {
        try {
          await saveOutreachToFirestore(user.uid, msg);
          if (markContactedLeadId) {
            await updateLeadFieldsInFirestore(markContactedLeadId, { stage: 'Contacted' });
          }
        } catch (err) {
          setErrorBanner(err instanceof Error ? err.message : 'Failed saving outreach log.');
        }
      }

      recordLog({
        type: 'outreach',
        title: `Outreach ${msg.isDemo ? 'simulated' : 'sent'} for ${msg.businessName}`,
        detail: `Subject: "${msg.subject}"`,
      });
    },
    [isDemoMode, recordLog, updateActiveWorkspace, user]
  );

  const handleMarkUnsubscribed = useCallback(
    async (leadId: string, email: string) => {
      const normalized = email.trim().toLowerCase();
      if (!normalized) return;

      const updatedSettings: AgencySettings = {
        ...settings,
        optOutEmails: Array.from(new Set([...settings.optOutEmails, normalized])),
      };
      setSettings(updatedSettings);

      updateActiveWorkspace((prev) => ({
        ...prev,
        leads: prev.leads.map((l) =>
          l.id === leadId
            ? { ...l, optedOut: true, stage: 'Not Interested', updatedAt: new Date().toISOString() }
            : l
        ),
      }));

      if (!isDemoMode && user) {
        try {
          await Promise.all([
            saveSettingsToFirestore(user.uid, updatedSettings),
            updateLeadFieldsInFirestore(leadId, { optedOut: true, stage: 'Not Interested' }),
          ]);
        } catch (err) {
          setErrorBanner(err instanceof Error ? err.message : 'Failed saving opt-out.');
        }
      }
      showToast(`${normalized} added to Opt-Out compliance registry.`);
    },
    [isDemoMode, settings, showToast, updateActiveWorkspace, user]
  );

  const handleCreateThreadForLead = useCallback(
    (lead: LeadRecord): ConversationThread => {
      const existing = activeWorkspace.conversations.find((c) => c.leadId === lead.id);
      if (existing) return existing;

      const pricing = getPricingForCountry(lead.country, settings.regionalPricing);
      const thread: ConversationThread = {
        id: `conv_${lead.id}_${Date.now()}`,
        leadId: lead.id,
        businessName: lead.name,
        contactPerson: lead.contactPerson,
        email: lead.email,
        country: lead.country,
        category: lead.category,
        stage: lead.stage === 'New Lead' ? 'Interested' : lead.stage,
        discussedPrice: pricing.formattedRange,
        clientBudget: null,
        expectedTimeline: settings.defaultDeliveryTimeline,
        requestedFeatures: [],
        readinessConfidence: 30,
        readinessTriggerPhrase: null,
        messages: [
          {
            id: `init_${Date.now()}`,
            sender: 'ai_agent',
            senderName: `AI Sales Agent (${settings.businessName})`,
            content: `Hello ${lead.contactPerson || lead.name}, I'm the AI assistant working with ${settings.ownerName} at ${settings.businessName}. Happy to share indicative website scope, pricing (${pricing.formattedRange} starting range for ${lead.country}), and delivery timelines whenever you're ready.`,
            timestamp: new Date().toISOString(),
            detectedIntent: 'general',
          },
        ],
        updatedAt: new Date().toISOString(),
        isDemo: isDemoMode,
      };

      updateActiveWorkspace((prev) => ({
        ...prev,
        conversations: [thread, ...prev.conversations],
      }));

      if (!isDemoMode && user) {
        void saveConversationToFirestore(user.uid, thread, true).catch((err) =>
          console.error('Failed creating conversation:', err)
        );
      }

      return thread;
    },
    [activeWorkspace.conversations, isDemoMode, settings, updateActiveWorkspace, user]
  );

  const handleUpdateThread = useCallback(
    async (
      thread: ConversationThread,
      leadPatch?: Partial<LeadRecord>,
      newReadyProject?: ReadyProject
    ) => {
      updateActiveWorkspace((prev) => {
        const existsProj = newReadyProject
          ? prev.readyProjects.some((p) => p.leadId === newReadyProject.leadId)
          : false;
        return {
          ...prev,
          conversations: prev.conversations.map((c) => (c.id === thread.id ? thread : c)),
          leads: leadPatch
            ? prev.leads.map((l) =>
                l.id === thread.leadId
                  ? { ...l, ...leadPatch, updatedAt: new Date().toISOString() }
                  : l
              )
            : prev.leads,
          readyProjects:
            newReadyProject && !existsProj
              ? [newReadyProject, ...prev.readyProjects]
              : prev.readyProjects,
        };
      });

      if (!isDemoMode && user) {
        try {
          await saveConversationToFirestore(user.uid, thread, false);
          if (leadPatch) {
            await updateLeadFieldsInFirestore(thread.leadId, leadPatch);
          }
          if (newReadyProject) {
            await saveReadyProjectToFirestore(user.uid, newReadyProject);
          }
        } catch (err) {
          setErrorBanner(err instanceof Error ? err.message : 'Failed saving conversation update.');
        }
      }

      if (newReadyProject) {
        recordLog({
          type: 'handover',
          title: `READY PROJECT! ${newReadyProject.businessName}`,
          detail: `Client confirmed readiness ("${thread.readinessTriggerPhrase || 'explicit confirmation'}"). Estimate: ${newReadyProject.discussedPrice}.`,
        });
        showToast(`READY PROJECT! Handover generated for ${newReadyProject.businessName}.`);
      }
    },
    [isDemoMode, recordLog, showToast, updateActiveWorkspace, user]
  );

  const handleTakeOverProject = useCallback(
    async (projectId: string) => {
      const now = new Date().toISOString();
      updateActiveWorkspace((prev) => ({
        ...prev,
        readyProjects: prev.readyProjects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                status: 'taken_over',
                takenOverBy: settings.ownerName,
                takenOverAt: now,
              }
            : p
        ),
      }));

      if (!isDemoMode && user) {
        try {
          await takeOverProjectInFirestore(projectId, settings.ownerName, now);
        } catch (err) {
          setErrorBanner(err instanceof Error ? err.message : 'Failed taking over project.');
        }
      }

      const proj = activeWorkspace.readyProjects.find((p) => p.id === projectId);
      recordLog({
        type: 'handover',
        title: `${settings.ownerName} took over ${proj?.businessName || 'Ready Project'}`,
        detail: 'Owner assumed direct contract finalization and project delivery.',
      });
      showToast(`Project assigned to ${settings.ownerName}.`);
    },
    [
      activeWorkspace.readyProjects,
      isDemoMode,
      recordLog,
      settings.ownerName,
      showToast,
      updateActiveWorkspace,
      user,
    ]
  );

  const handleSaveSettings = useCallback(
    async (updated: AgencySettings) => {
      setSettings(updated);
      if (!isDemoMode && user) {
        try {
          await saveSettingsToFirestore(user.uid, updated);
        } catch (err) {
          setErrorBanner(err instanceof Error ? err.message : 'Failed saving settings.');
        }
      }
      recordLog({
        type: 'settings',
        title: 'Updated agency & negotiation configuration',
        detail: `Active targets: ${updated.targetCountries.length} countries, max discount ${updated.maxDiscountPercent}%.`,
      });
      showToast('Settings saved.');
    },
    [isDemoMode, recordLog, showToast, user]
  );

  const handleRunDailyAutomationCycle = useCallback(() => {
    const currentLeads = activeWorkspace.leads;
    if (currentLeads.length === 0) {
      showToast('No leads in workspace yet. Discover businesses in Lead Hunter first.');
      setActiveSection('hunter');
      return;
    }

    let newlyAudited = 0;
    const auditedMap = new Map(activeWorkspace.audits.map((a) => [a.businessId, a]));
    const updatedAudits = [...activeWorkspace.audits];

    const updatedLeads = currentLeads.map((lead) => {
      let audit = auditedMap.get(lead.id);
      if (!audit) {
        newlyAudited += 1;
        const evalRes = generateDeterministicAuditMetrics(lead.website, lead.id);
        audit = {
          id: `audit_${lead.id}`,
          businessId: lead.id,
          websiteUrl: lead.website,
          tier: evalRes.tier,
          metrics: evalRes.metrics,
          findings: evalRes.findings,
          opportunities: evalRes.opportunities,
          auditedAt: new Date().toISOString(),
          isDemo: isDemoMode,
        };
        updatedAudits.push(audit);
      }

      const rescored = calculateLeadScore({
        businessStatus: lead.businessStatus,
        website: lead.website,
        websiteTier: audit.tier,
        auditMetrics: audit.metrics,
        rating: lead.rating,
        reviewCount: lead.reviewCount,
        phone: lead.phone,
        email: lead.email,
        address: lead.address,
        category: lead.category,
      });

      return {
        ...lead,
        websiteTier: audit.tier,
        score: rescored,
        updatedAt: new Date().toISOString(),
      };
    });

    updateActiveWorkspace((prev) => ({
      ...prev,
      leads: updatedLeads,
      audits: updatedAudits,
    }));

    const tierACount = updatedLeads.filter((l) => ['A', 'B', 'C'].includes(l.websiteTier)).length;
    recordLog({
      type: 'automation',
      title: 'Automation Audit & Scoring Cycle Complete',
      detail: `Evaluated ${updatedLeads.length} leads (${newlyAudited} new audits); ${tierACount} prioritized in Tiers A/B/C.`,
    });
    showToast(`Audit cycle complete: ${updatedLeads.length} leads scored (${tierACount} Tier A/B/C).`);
  }, [activeWorkspace.audits, activeWorkspace.leads, isDemoMode, recordLog, showToast, updateActiveWorkspace]);

  const pendingReadyCount = activeWorkspace.readyProjects.filter(
    (p) => p.status === 'pending_takeover'
  ).length;

  return (
    <AppErrorBoundary>
      <div className="min-h-screen bg-[#060608] text-[#F4F4F5] flex flex-col">
        {/* Mandatory Case A Google Maps Quota Exceeded Banner */}
        {quotaExceeded && (
          <div className="sticky top-0 z-50 bg-amber-500 text-zinc-950 px-4 py-2.5 text-xs font-medium flex flex-wrap items-center justify-between gap-2 shadow-lg">
            <span>
              The Google Maps Platform demo key has reached its quota. Live map tiles or Places requests may be temporarily limited.{' '}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-bold"
              >
                Learn how to add your own Google Maps API key
              </a>
            </span>
            <button
              type="button"
              onClick={() => setQuotaExceeded(false)}
              aria-label="Dismiss Google Maps quota notice"
              className="p-1 rounded hover:bg-black/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="flex flex-1 min-h-0">
          <Sidebar
            activeSection={activeSection}
            onSelectSection={setActiveSection}
            readyProjectsCount={pendingReadyCount}
            isDemoMode={isDemoMode}
            userEmail={user?.email ?? null}
            userName={user?.displayName ?? null}
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
            isSigningIn={isSigningIn}
            mobileOpen={mobileMenuOpen}
            onCloseMobile={() => setMobileMenuOpen(false)}
          />

          <div className="flex-1 min-w-0 flex flex-col">
            {/* Compact Top Bar */}
            <header className="sticky top-0 z-30 h-14 px-4 lg:px-8 border-b border-white/[0.08] bg-[#060608]/90 backdrop-blur-md flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  aria-label="Open navigation menu"
                  className="lg:hidden p-1.5 rounded-md text-zinc-300 hover:text-white hover:bg-white/[0.06]"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <span className="font-display text-sm font-semibold text-white truncate lg:hidden">
                  AK47 Client Hunter
                </span>
                <span className="hidden lg:inline text-xs text-zinc-400">
                  {isDemoMode
                    ? 'Demo Mode Active · 30 Fictional Sample Businesses (Not Real Leads)'
                    : user
                      ? `Live Production Workspace · ${user.email}`
                      : 'Live Mode · Sign in with Google to persist Firestore & Gmail'}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isLoadingLive && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400 mr-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span className="hidden sm:inline">Syncing...</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setIsDemoMode((v) => !v)}
                  className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors whitespace-nowrap ${
                    isDemoMode
                      ? 'border-amber-500/40 bg-amber-950/30 text-amber-200 hover:bg-amber-950/50'
                      : 'border-red-500/40 bg-red-950/30 text-red-200 hover:bg-red-950/50'
                  }`}
                >
                  {isDemoMode ? 'Demo Mode · Switch to Live' : 'Live Mode · Switch to Demo'}
                </button>
              </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-[1440px] w-full mx-auto space-y-4">
              {errorBanner && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-3 text-xs text-red-200 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                    <span>{errorBanner}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setErrorBanner(null)}
                    aria-label="Dismiss error"
                    className="p-1 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {toastMessage && (
                <div
                  role="status"
                  className="rounded-xl border border-white/15 bg-zinc-900/95 px-4 py-2.5 text-xs text-white flex items-center justify-between gap-3"
                >
                  <span>{toastMessage}</span>
                  <button
                    type="button"
                    onClick={() => setToastMessage(null)}
                    aria-label="Dismiss notification"
                    className="text-zinc-400 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {activeSection === 'overview' && (
                <OverviewView
                  stats={stats}
                  leads={activeWorkspace.leads}
                  readyProjects={activeWorkspace.readyProjects}
                  activityLogs={activeWorkspace.activityLogs}
                  settings={settings}
                  isDemoMode={isDemoMode}
                  onNavigate={setActiveSection}
                  onRunDailyAutomationCycle={handleRunDailyAutomationCycle}
                />
              )}

              {activeSection === 'hunter' && (
                <LeadHunterView
                  existingLeads={activeWorkspace.leads}
                  isDemoMode={isDemoMode}
                  onSaveLeads={handleSaveLeads}
                  onInspectLead={(id) => {
                    setInspectorLeadId(id);
                    setActiveSection('inspector');
                  }}
                  onQuotaExceeded={() => setQuotaExceeded(true)}
                />
              )}

              {activeSection === 'database' && (
                <LeadDatabaseView
                  leads={activeWorkspace.leads}
                  onUpdateLead={handleUpdateLead}
                  onDeleteLead={handleDeleteLead}
                  onInspectLead={(id) => {
                    setInspectorLeadId(id);
                    setActiveSection('inspector');
                  }}
                  onDraftOutreach={(id) => {
                    setOutreachLeadId(id);
                    setActiveSection('outreach');
                  }}
                />
              )}

              {activeSection === 'inspector' && (
                <WebsiteInspectorView
                  key={inspectorLeadId || 'inspector-default'}
                  leads={activeWorkspace.leads}
                  audits={activeWorkspace.audits}
                  initialLeadId={inspectorLeadId}
                  isDemoMode={isDemoMode}
                  onSaveAuditAndRescore={handleSaveAuditAndRescore}
                />
              )}

              {activeSection === 'outreach' && (
                <OutreachView
                  key={outreachLeadId || 'outreach-default'}
                  leads={activeWorkspace.leads}
                  audits={activeWorkspace.audits}
                  outreachMessages={activeWorkspace.outreachMessages}
                  settings={settings}
                  initialLeadId={outreachLeadId}
                  isDemoMode={isDemoMode}
                  gmailAccessToken={gmailAccessToken}
                  onSignIn={handleSignIn}
                  onSaveOutreach={handleSaveOutreach}
                  onMarkUnsubscribed={handleMarkUnsubscribed}
                />
              )}

              {activeSection === 'conversations' && (
                <ConversationsView
                  threads={activeWorkspace.conversations}
                  leads={activeWorkspace.leads}
                  settings={settings}
                  isDemoMode={isDemoMode}
                  onUpdateThread={handleUpdateThread}
                  onCreateThreadForLead={handleCreateThreadForLead}
                  onNavigateProjects={() => setActiveSection('projects')}
                />
              )}

              {activeSection === 'negotiator' && (
                <NegotiatorView
                  key={`${settings.maxDiscountPercent}-${settings.regionalPricing.map((r) => r.minAcceptablePrice).join(',')}`}
                  settings={settings}
                  onSaveSettings={handleSaveSettings}
                />
              )}

              {activeSection === 'projects' && (
                <ReadyProjectsView
                  projects={activeWorkspace.readyProjects}
                  leads={activeWorkspace.leads}
                  ownerName={settings.ownerName}
                  notifyPhone={settings.notifications.notifyPhone}
                  notifyEmail={settings.notifications.notifyEmail}
                  gmailAccessToken={gmailAccessToken}
                  isDemoMode={isDemoMode}
                  onTakeOverProject={handleTakeOverProject}
                />
              )}

              {activeSection === 'analytics' && (
                <AnalyticsView
                  leads={activeWorkspace.leads}
                  audits={activeWorkspace.audits}
                  stats={stats}
                  isDemoMode={isDemoMode}
                />
              )}

              {activeSection === 'settings' && (
                <SettingsView
                  settings={settings}
                  isDemoMode={isDemoMode}
                  userEmail={user?.email ?? null}
                  gmailConnected={Boolean(gmailAccessToken)}
                  onToggleDemoMode={(nextDemo) => setIsDemoMode(nextDemo)}
                  onSaveSettings={handleSaveSettings}
                  onSignIn={handleSignIn}
                  onResetDemoWorkspace={() => {
                    setDemoWorkspace(buildDemoDataset());
                    showToast('Demo Mode dataset reset to 30 clean sample businesses.');
                  }}
                />
              )}
            </main>
          </div>
        </div>
      </div>
    </AppErrorBoundary>
  );
}
