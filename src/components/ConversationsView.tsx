import React, { useState } from 'react';
import { Send, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import {
  CONVERSATION_STAGES,
  type AgencySettings,
  type ChatMessage,
  type ConversationStage,
  type ConversationThread,
  type LeadRecord,
  type ReadyProject,
} from '../types/domain';
import { getPricingForCountry } from '../lib/pricing';
import {
  buildReadyProjectMessage,
  buildSmsHandoverUrl,
  buildWhatsAppHandoverUrl,
  formatDisplayPhone,
} from '../lib/handover';

interface ConversationsViewProps {
  threads: ConversationThread[];
  leads: LeadRecord[];
  settings: AgencySettings;
  isDemoMode: boolean;
  onUpdateThread: (
    thread: ConversationThread,
    leadPatch?: Partial<LeadRecord>,
    newReadyProject?: ReadyProject
  ) => void;
  onCreateThreadForLead: (lead: LeadRecord) => ConversationThread;
  onNavigateProjects: () => void;
}

const SAMPLE_CUSTOMER_PROMPTS = [
  'How much does a website cost?',
  'What features do you provide and how long does development take?',
  'Can you customize the design and provide ongoing maintenance?',
  "Let's build the website — can we start this week?",
  'I am ready to hire you. Send me the payment details.',
];

export const ConversationsView: React.FC<ConversationsViewProps> = ({
  threads,
  leads,
  settings,
  isDemoMode,
  onUpdateThread,
  onCreateThreadForLead,
  onNavigateProjects,
}) => {
  const [stageFilter, setStageFilter] = useState<'all' | ConversationStage>('all');
  const [selectedThreadId, setSelectedThreadId] = useState<string>(threads[0]?.id || '');
  const [customerInput, setCustomerInput] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [handoverAlert, setHandoverAlert] = useState<{
    summary: string;
    project: ReadyProject;
  } | null>(null);

  const visibleThreads = threads.filter((t) =>
    stageFilter === 'all' ? true : t.stage === stageFilter
  );
  const activeThread =
    threads.find((t) => t.id === selectedThreadId) || visibleThreads[0] || null;

  const leadsWithoutThread = leads.filter(
    (l) => !l.optedOut && !threads.some((t) => t.leadId === l.id)
  );

  const handleSimulateClientMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeThread || !customerInput.trim()) return;

    setIsReplying(true);
    setErrorMsg(null);
    setHandoverAlert(null);

    const clientText = customerInput.trim();
    const clientMsg: ChatMessage = {
      id: `cmsg_${Date.now()}`,
      sender: 'client',
      senderName: activeThread.contactPerson || activeThread.businessName,
      content: clientText,
      timestamp: new Date().toISOString(),
    };

    try {
      const res = await fetch('/api/ai/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thread: {
            businessName: activeThread.businessName,
            contactPerson: activeThread.contactPerson,
            country: activeThread.country,
            category: activeThread.category,
            stage: activeThread.stage,
            messages: [...activeThread.messages, clientMsg],
          },
          incomingMessage: clientText,
          settings: {
            ownerName: settings.ownerName,
            businessName: settings.businessName,
            portfolioUrl: settings.portfolioUrl,
            aiPersonality: settings.aiPersonality,
            maxDiscountPercent: settings.maxDiscountPercent,
            paymentMilestones: settings.paymentMilestones,
            defaultDeliveryTimeline: settings.defaultDeliveryTimeline,
            regionalPricing: settings.regionalPricing,
            packages: settings.packages,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'AI Sales Agent failed to respond');

      const aiMsg: ChatMessage = {
        id: `amsg_${Date.now() + 1}`,
        sender: 'ai_agent',
        senderName: `AI Sales Agent (${settings.businessName})`,
        content: data.reply,
        timestamp: new Date().toISOString(),
        detectedIntent: data.readiness?.detectedIntent,
        requiresOwnerApproval: Boolean(data.requiresOwnerApproval),
      };

      const nextStage: ConversationStage = data.readiness?.suggestedStage || activeThread.stage;
      const mergedFeatures = Array.from(
        new Set([...activeThread.requestedFeatures, ...(data.requestedFeatures || [])])
      );

      const updatedThread: ConversationThread = {
        ...activeThread,
        stage: nextStage,
        discussedPrice:
          data.discussedPrice ||
          activeThread.discussedPrice ||
          getPricingForCountry(activeThread.country, settings.regionalPricing).formattedRange,
        clientBudget: data.clientBudget || activeThread.clientBudget,
        expectedTimeline:
          data.expectedTimeline ||
          activeThread.expectedTimeline ||
          settings.defaultDeliveryTimeline,
        requestedFeatures: mergedFeatures,
        readinessConfidence: data.readiness?.confidence ?? activeThread.readinessConfidence,
        readinessTriggerPhrase:
          data.readiness?.matchedPhrase || activeThread.readinessTriggerPhrase,
        messages: [...activeThread.messages, { ...clientMsg, detectedIntent: data.readiness?.detectedIntent }, aiMsg],
        updatedAt: new Date().toISOString(),
      };

      let createdProject: ReadyProject | undefined;
      if (data.readiness?.isReadyForProject) {
        const matchedLead = leads.find((l) => l.id === activeThread.leadId);
        createdProject = {
          id: `proj_${activeThread.leadId}_${Date.now()}`,
          leadId: activeThread.leadId,
          conversationId: activeThread.id,
          businessName: activeThread.businessName,
          contactPerson: activeThread.contactPerson || 'Primary Decision Maker',
          email: activeThread.email || 'Pending email confirmation',
          clientPhone: matchedLead?.phone || null,
          country: activeThread.country,
          category: activeThread.category,
          projectRequirements: `Custom website build for ${activeThread.businessName} (${activeThread.category} in ${activeThread.country}). Client explicitly confirmed intent to proceed: "${clientText}".`,
          requestedFeatures:
            mergedFeatures.length > 0
              ? mergedFeatures
              : ['Mobile-first custom design', 'Direct booking & contact lead capture'],
          clientBudget: updatedThread.clientBudget || 'Confirmed within indicative range',
          discussedPrice:
            updatedThread.discussedPrice ||
            getPricingForCountry(activeThread.country, settings.regionalPricing).formattedRange,
          expectedTimeline:
            updatedThread.expectedTimeline || settings.defaultDeliveryTimeline,
          conversationHistory: updatedThread.messages,
          status: 'pending_takeover',
          takenOverBy: null,
          takenOverAt: null,
          createdAt: new Date().toISOString(),
          isDemo: isDemoMode,
        };
        setHandoverAlert({
          summary: `READY PROJECT! Buying intent detected ("${data.readiness.matchedPhrase || clientText}"). Handover package created for ${settings.ownerName}.`,
          project: createdProject,
        });
      }

      onUpdateThread(
        updatedThread,
        {
          stage: nextStage,
          optedOut: Boolean(data.readiness?.isOptOut),
        },
        createdProject
      );
      setCustomerInput('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Conversation error');
    } finally {
      setIsReplying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white tracking-tight">
            AI Sales Conversations
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Natural-language qualification, pricing estimates, and automatic client readiness detection.
          </p>
        </div>

        {leadsWithoutThread.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              aria-label="Start conversation for lead"
              defaultValue=""
              onChange={(e) => {
                const lead = leads.find((l) => l.id === e.target.value);
                if (lead) {
                  const created = onCreateThreadForLead(lead);
                  setSelectedThreadId(created.id);
                }
                e.target.value = '';
              }}
              className="rounded-lg bg-black/60 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
            >
              <option value="" disabled>
                + Start AI Conversation with Lead...
              </option>
              {leadsWithoutThread.slice(0, 15).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.country})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Stage Filter Tabs */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setStageFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
            stageFilter === 'all'
              ? 'bg-red-600 text-white'
              : 'bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]'
          }`}
        >
          All ({threads.length})
        </button>
        {CONVERSATION_STAGES.map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStageFilter(st)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              stageFilter === st
                ? 'bg-red-600 text-white'
                : 'bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {handoverAlert && (
        <div className="glass-panel rounded-xl p-4 border-red-500/40 bg-red-950/25 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <CheckCircle2 className="h-4 w-4 text-red-500 shrink-0" />
            <span>{handoverAlert.summary}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {settings.notifications.notifyPhone && (
              <>
                <a
                  href={buildWhatsAppHandoverUrl(
                    settings.notifications.notifyPhone,
                    buildReadyProjectMessage(handoverAlert.project, handoverAlert.project.clientPhone)
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white whitespace-nowrap"
                >
                  WhatsApp {formatDisplayPhone(settings.notifications.notifyPhone)}
                </a>
                <a
                  href={buildSmsHandoverUrl(
                    settings.notifications.notifyPhone,
                    buildReadyProjectMessage(handoverAlert.project, handoverAlert.project.clientPhone)
                  )}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-xs font-semibold text-white whitespace-nowrap"
                >
                  SMS Alert
                </a>
              </>
            )}
            <button
              type="button"
              onClick={onNavigateProjects}
              className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white whitespace-nowrap"
            >
              Open Ready Projects
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Thread List */}
        <div className="lg:col-span-4 glass-panel rounded-xl divide-y divide-white/[0.06] max-h-[620px] overflow-y-auto">
          {visibleThreads.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-400">
              No conversations in this stage.
            </div>
          ) : (
            visibleThreads.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedThreadId(t.id)}
                className={`w-full text-left p-4 transition-colors ${
                  activeThread?.id === t.id ? 'bg-red-950/25' : 'hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-white truncate">
                    {t.businessName}
                  </span>
                  <span className="font-mono text-[11px] text-red-400 tabular-nums shrink-0">
                    {t.readinessConfidence}%
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-zinc-400">
                  {t.stage} · {t.country}
                </div>
                <div className="mt-1 text-[11px] text-zinc-500 truncate">
                  {t.messages[t.messages.length - 1]?.content || 'No messages yet'}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Active Conversation */}
        {activeThread ? (
          <div className="lg:col-span-8 glass-panel rounded-xl flex flex-col h-[620px]">
            <div className="p-4 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold text-white">
                  {activeThread.businessName}
                </h2>
                <div className="text-xs text-zinc-400 mt-0.5">
                  {activeThread.contactPerson || 'Prospect'} · Stage: {activeThread.stage} · Readiness:{' '}
                  <span className="font-mono text-white tabular-nums">
                    {activeThread.readinessConfidence}%
                  </span>
                </div>
              </div>
              <div className="text-right text-xs">
                <div className="text-zinc-400">
                  Discussed: <span className="font-mono text-white">{activeThread.discussedPrice || 'TBD'}</span>
                </div>
                <div className="text-[11px] text-zinc-500">
                  Timeline: {activeThread.expectedTimeline || settings.defaultDeliveryTimeline}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {activeThread.messages.map((msg) => {
                const isClient = msg.sender === 'client';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isClient ? 'items-start' : 'items-end'}`}
                  >
                    <div className="text-[11px] text-zinc-500 mb-1">
                      {msg.senderName} · {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div
                      className={`max-w-[85%] rounded-xl px-4 py-2.5 text-xs leading-relaxed ${
                        isClient
                          ? 'bg-white/[0.06] border border-white/10 text-zinc-100'
                          : 'bg-red-950/35 border border-red-500/30 text-white'
                      }`}
                    >
                      {msg.content}
                    </div>
                    {msg.requiresOwnerApproval && (
                      <span className="mt-1 text-[11px] text-amber-300">
                        Owner approval required for discount/terms outside configured bounds
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Quick sample customer message buttons + composer */}
            <div className="p-4 border-t border-white/[0.08] space-y-3 bg-black/30">
              <div className="flex flex-wrap gap-1.5">
                {SAMPLE_CUSTOMER_PROMPTS.map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => setCustomerInput(sample)}
                    className="px-2.5 py-1 rounded bg-white/[0.05] hover:bg-white/[0.1] text-[11px] text-zinc-300 transition-colors"
                  >
                    {sample}
                  </button>
                ))}
              </div>

              {errorMsg && (
                <div role="alert" className="text-xs text-red-300">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleSimulateClientMessage} className="flex gap-2">
                <input
                  type="text"
                  aria-label="Simulate incoming customer message"
                  value={customerInput}
                  onChange={(e) => setCustomerInput(e.target.value)}
                  placeholder="Type or pick a customer message to test AI Sales Agent & Readiness Detection..."
                  className="flex-1 rounded-lg bg-black/60 border border-white/10 px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-red-500"
                />
                <button
                  type="submit"
                  disabled={isReplying || !customerInput.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  {isReplying ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  <span>{isReplying ? 'Replying...' : 'Send & AI Reply'}</span>
                  <Send className="h-3 w-3" />
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-8 glass-panel rounded-xl p-10 flex items-center justify-center text-sm text-zinc-400">
            Select a conversation or start one from a qualified lead.
          </div>
        )}
      </div>
    </div>
  );
};
