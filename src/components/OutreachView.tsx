import React, { useState } from 'react';
import { Sparkles, Send, RefreshCw, Ban, Loader2, AlertTriangle } from 'lucide-react';
import type {
  AgencySettings,
  LeadRecord,
  OutreachMessage,
  WebsiteAudit,
} from '../types/domain';

interface OutreachViewProps {
  leads: LeadRecord[];
  audits: WebsiteAudit[];
  outreachMessages: OutreachMessage[];
  settings: AgencySettings;
  initialLeadId: string | null;
  isDemoMode: boolean;
  gmailAccessToken: string | null;
  onSignIn: () => void;
  onSaveOutreach: (msg: OutreachMessage, markContactedLeadId?: string) => void;
  onMarkUnsubscribed: (leadId: string, email: string) => void;
}

export const OutreachView: React.FC<OutreachViewProps> = ({
  leads,
  audits,
  outreachMessages,
  settings,
  initialLeadId,
  isDemoMode,
  gmailAccessToken,
  onSignIn,
  onSaveOutreach,
  onMarkUnsubscribed,
}) => {
  const eligibleLeads = leads
    .filter((l) => !l.optedOut && l.stage !== 'Not Interested')
    .sort((a, b) => b.score.total - a.score.total);

  const [selectedLeadId, setSelectedLeadId] = useState<string>(
    initialLeadId || eligibleLeads[0]?.id || ''
  );
  const [recipientEmail, setRecipientEmail] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [isFollowUp, setIsFollowUp] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [inboxReplies, setInboxReplies] = useState<
    Array<{ id: string; from: string; subject: string; date: string; snippet: string }>
  >([]);
  const [isPollingGmail, setIsPollingGmail] = useState(false);

  const selectedLead = leads.find((l) => l.id === selectedLeadId) || eligibleLeads[0] || null;
  const effectiveEmail = (recipientEmail || selectedLead?.email || '').trim();

  const isDuplicateSent = selectedLead
    ? settings.automation.preventDuplicates &&
      outreachMessages.some(
        (m) => m.leadId === selectedLead.id && (m.status === 'sent' || m.status === 'replied')
      ) &&
      !isFollowUp
    : false;

  const isOptedOutEmail = Boolean(
    effectiveEmail &&
      settings.optOutEmails.some((e) => e.toLowerCase() === effectiveEmail.toLowerCase())
  );

  const handleGenerateDraft = async () => {
    if (!selectedLead) return;
    setIsDrafting(true);
    setErrorBanner(null);
    setStatusBanner(null);

    try {
      const audit = audits.find((a) => a.businessId === selectedLead.id);
      const res = await fetch('/api/ai/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead: {
            name: selectedLead.name,
            city: selectedLead.city,
            country: selectedLead.country,
            category: selectedLead.category,
            contactPerson: selectedLead.contactPerson,
            website: selectedLead.website,
            websiteTier: selectedLead.websiteTier,
          },
          auditFindings: audit?.findings || [],
          settings: {
            ownerName: settings.ownerName,
            businessName: settings.businessName,
            portfolioUrl: settings.portfolioUrl,
            aiPersonality: settings.aiPersonality,
          },
          isFollowUp,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to generate AI draft');
      setSubject(data.subject || '');
      setBody(data.body || '');
      setStatusBanner(
        `AI Outreach draft generated (${data.generatedBy === 'gemini-4-hydrogen' ? 'Gemini AI' : 'Template engine'}). Review before sending.`
      );
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Unable to generate outreach draft.');
    } finally {
      setIsDrafting(false);
    }
  };

  const executeSend = async () => {
    if (!selectedLead || !subject.trim() || !body.trim() || !effectiveEmail) return;
    setConfirmOpen(false);
    setIsSending(true);
    setErrorBanner(null);
    setStatusBanner(null);

    try {
      let gmailMessageId: string | null = null;
      let gmailThreadId: string | null = null;

      if (!isDemoMode) {
        if (!gmailAccessToken) {
          throw new Error('Sign in with Google first to authorize Gmail sending.');
        }
        const res = await fetch('/api/gmail/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${gmailAccessToken}`,
          },
          body: JSON.stringify({
            to: effectiveEmail,
            subject: subject.trim(),
            body: body.trim(),
            fromName: `${settings.ownerName} (${settings.businessName})`,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Gmail API failed to send message.');
        gmailMessageId = data.id || null;
        gmailThreadId = data.threadId || null;
      }

      const newMsg: OutreachMessage = {
        id: `msg_${Date.now()}`,
        leadId: selectedLead.id,
        businessName: selectedLead.name,
        recipientEmail: effectiveEmail,
        subject: subject.trim(),
        body: body.trim(),
        status: 'sent',
        channel: isDemoMode ? 'demo_simulated' : 'gmail',
        followUpCount: isFollowUp ? 1 : 0,
        sentAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        gmailMessageId,
        gmailThreadId,
        isDemo: isDemoMode,
      };

      onSaveOutreach(newMsg, selectedLead.id);
      setStatusBanner(
        isDemoMode
          ? `Demo Mode: Simulated outreach logged for ${selectedLead.name}.`
          : `Email sent via Gmail API to ${effectiveEmail}.`
      );
      setSubject('');
      setBody('');
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to send outreach message.');
    } finally {
      setIsSending(false);
    }
  };

  const handlePollReplies = async () => {
    if (!gmailAccessToken) {
      setErrorBanner('Sign in with Google to scan your Gmail inbox for client replies.');
      return;
    }
    setIsPollingGmail(true);
    setErrorBanner(null);
    try {
      const res = await fetch('/api/gmail/replies', {
        headers: { Authorization: `Bearer ${gmailAccessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to read Gmail inbox');
      setInboxReplies(Array.isArray(data.messages) ? data.messages : []);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Gmail reply scan failed.');
    } finally {
      setIsPollingGmail(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white tracking-tight">
            AI Outreach Agent
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Transparent AI outreach via Gmail API with duplicate prevention, follow-ups, and opt-out compliance.
          </p>
        </div>
        <button
          type="button"
          onClick={handlePollReplies}
          disabled={isPollingGmail || isDemoMode}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-xs font-semibold text-white transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isPollingGmail ? 'animate-spin' : ''}`} />
          <span>{isDemoMode ? 'Reply Sync (Live Mode)' : 'Scan Gmail Replies'}</span>
        </button>
      </div>

      {!isDemoMode && !gmailAccessToken && (
        <div className="glass-panel rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-amber-500/30 bg-amber-950/15">
          <div className="text-xs text-amber-200">
            Connect your Google account with Gmail permissions to send live outreach emails and monitor replies.
          </div>
          <button
            type="button"
            onClick={onSignIn}
            className="px-4 py-2 rounded-lg bg-white text-zinc-900 text-xs font-semibold hover:bg-zinc-100 whitespace-nowrap shrink-0"
          >
            Connect Gmail Account
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Composer */}
        <div className="lg:col-span-7 glass-panel rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-base font-semibold text-white">
              Outreach Composer
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsFollowUp((v) => !v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  isFollowUp
                    ? 'bg-red-600/20 border-red-500/40 text-red-200'
                    : 'bg-white/[0.04] border-white/10 text-zinc-300'
                }`}
              >
                {isFollowUp ? 'Mode: Follow-Up' : 'Mode: First Touch'}
              </button>
              <button
                type="button"
                onClick={handleGenerateDraft}
                disabled={isDrafting || !selectedLead}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white transition-colors disabled:opacity-60 whitespace-nowrap"
              >
                {isDrafting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                <span>Draft with Gemini AI</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="outreach-lead-select" className="block text-xs text-zinc-400 mb-1">
                Target Lead
              </label>
              <select
                id="outreach-lead-select"
                value={selectedLead?.id || ''}
                onChange={(e) => {
                  setSelectedLeadId(e.target.value);
                  setRecipientEmail('');
                }}
                className="w-full rounded-lg bg-black/60 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
              >
                {eligibleLeads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} · Score {l.score.total} (Tier {l.websiteTier})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="outreach-email-input" className="block text-xs text-zinc-400 mb-1">
                Recipient Email
              </label>
              <input
                id="outreach-email-input"
                type="email"
                value={recipientEmail || selectedLead?.email || ''}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="business@domain.com"
                className="w-full rounded-lg bg-black/60 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          {isDuplicateSent && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-xs text-amber-200 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Duplicate guard: First-touch outreach already sent to this lead. Switch to Follow-Up mode to send a follow-up.</span>
            </div>
          )}

          {isOptedOutEmail && (
            <div className="rounded-lg border border-red-500/40 bg-red-950/30 px-3 py-2 text-xs text-red-200 flex items-center gap-2">
              <Ban className="h-4 w-4 shrink-0" />
              <span>Compliance block: {effectiveEmail} is on the Unsubscribe / Opt-Out registry. Sending disabled.</span>
            </div>
          )}

          <div>
            <label htmlFor="outreach-subject" className="block text-xs text-zinc-400 mb-1">
              Subject Line
            </label>
            <input
              id="outreach-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Click 'Draft with Gemini AI' or write a subject..."
              className="w-full rounded-lg bg-black/60 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label htmlFor="outreach-body" className="block text-xs text-zinc-400 mb-1">
              Email Body
            </label>
            <textarea
              id="outreach-body"
              rows={9}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="AI-drafted personalized message will appear here..."
              className="w-full rounded-lg bg-black/60 border border-white/10 p-3 text-xs text-white leading-relaxed focus:outline-none focus:border-red-500"
            />
          </div>

          {statusBanner && (
            <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-200">
              {statusBanner}
            </div>
          )}
          {errorBanner && (
            <div role="alert" className="rounded-lg border border-red-500/40 bg-red-950/30 px-3 py-2 text-xs text-red-200">
              {errorBanner}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            {selectedLead && effectiveEmail && (
              <button
                type="button"
                onClick={() => onMarkUnsubscribed(selectedLead.id, effectiveEmail)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs text-zinc-300 transition-colors"
              >
                <Ban className="h-3.5 w-3.5" />
                <span>Add to Opt-Out List</span>
              </button>
            )}
            <button
              type="button"
              disabled={
                isSending ||
                !selectedLead ||
                !effectiveEmail ||
                !subject.trim() ||
                !body.trim() ||
                isDuplicateSent ||
                isOptedOutEmail
              }
              onClick={() => setConfirmOpen(true)}
              className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{isDemoMode ? 'Simulate Outreach Send' : 'Review & Send via Gmail'}</span>
            </button>
          </div>
        </div>

        {/* Outreach Log & Gmail Inbox Replies */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-panel rounded-xl p-5 space-y-3">
            <h2 className="font-display text-base font-semibold text-white">
              Outreach History ({outreachMessages.length})
            </h2>
            {outreachMessages.length === 0 ? (
              <p className="text-xs text-zinc-400 py-4">No outreach messages logged yet.</p>
            ) : (
              <div className="divide-y divide-white/[0.06] max-h-[340px] overflow-y-auto">
                {outreachMessages.map((msg) => (
                  <div key={msg.id} className="py-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-white truncate">
                        {msg.businessName}
                      </span>
                      <span className="font-mono text-[11px] text-zinc-300 shrink-0">
                        {msg.status} · {msg.isDemo ? 'Demo' : 'Gmail'}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-400 truncate">{msg.subject}</div>
                    <div className="text-[11px] text-zinc-500">
                      To: {msg.recipientEmail || 'Unlisted'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {inboxReplies.length > 0 && (
            <div className="glass-panel rounded-xl p-5 space-y-3">
              <h3 className="font-display text-sm font-semibold text-white">
                Recent Gmail Inbox Messages
              </h3>
              <div className="divide-y divide-white/[0.06] max-h-[240px] overflow-y-auto">
                {inboxReplies.map((r) => (
                  <div key={r.id} className="py-2.5 space-y-1">
                    <div className="text-xs font-medium text-white truncate">{r.subject}</div>
                    <div className="text-[11px] text-zinc-400 truncate">{r.from}</div>
                    <div className="text-[11px] text-zinc-500 line-clamp-2">{r.snippet}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Explicit Confirmation Modal before sending email (mandatory per workspace-integration skill) */}
      {confirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-send-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div className="glass-panel-elevated rounded-xl max-w-lg w-full p-6 space-y-4">
            <h3 id="confirm-send-title" className="font-display text-lg font-semibold text-white">
              {isDemoMode ? 'Confirm Demo Outreach Simulation' : 'Confirm Gmail Outreach Send'}
            </h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {isDemoMode
                ? 'This will log a simulated outreach message inside Demo Mode (no real email will be dispatched).'
                : `This will send a real email from your connected Gmail account to ${effectiveEmail}.`}
            </p>
            <div className="rounded-lg bg-black/50 border border-white/10 p-3 space-y-1.5 text-xs">
              <div>
                <span className="text-zinc-400">To: </span>
                <span className="text-white font-mono">{effectiveEmail}</span>
              </div>
              <div>
                <span className="text-zinc-400">Subject: </span>
                <span className="text-white">{subject}</span>
              </div>
              <div className="pt-2 border-t border-white/[0.06] text-zinc-300 whitespace-pre-wrap max-h-40 overflow-y-auto">
                {body}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeSend}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white"
              >
                {isDemoMode ? 'Confirm Simulation' : 'Confirm & Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
