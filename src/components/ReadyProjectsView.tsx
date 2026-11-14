import React, { useState } from 'react';
import {
  CheckCircle2,
  UserCheck,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Copy,
  Check,
  Send,
  Mail,
} from 'lucide-react';
import type { LeadRecord, ReadyProject } from '../types/domain';
import {
  buildReadyProjectMessage,
  buildSmsHandoverUrl,
  buildWhatsAppHandoverUrl,
  formatDisplayPhone,
} from '../lib/handover';

interface ReadyProjectsViewProps {
  projects: ReadyProject[];
  leads: LeadRecord[];
  ownerName: string;
  notifyPhone: string;
  notifyEmail: string;
  gmailAccessToken: string | null;
  isDemoMode: boolean;
  onTakeOverProject: (projectId: string) => void;
}

export const ReadyProjectsView: React.FC<ReadyProjectsViewProps> = ({
  projects,
  leads,
  ownerName,
  notifyPhone,
  notifyEmail,
  gmailAccessToken,
  isDemoMode,
  onTakeOverProject,
}) => {
  const [filter, setFilter] = useState<'all' | 'pending_takeover' | 'taken_over'>('all');
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<Record<string, string>>({});

  const filtered = projects.filter((p) => (filter === 'all' ? true : p.status === filter));
  const pendingCount = projects.filter((p) => p.status === 'pending_takeover').length;
  const takenCount = projects.filter((p) => p.status === 'taken_over').length;
  const formattedNotifyPhone = formatDisplayPhone(notifyPhone || '+91 78530 25466');

  const toggleHistory = (id: string) => {
    setExpandedHistoryIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyMessage = async (project: ReadyProject, msg: string) => {
    try {
      await navigator.clipboard.writeText(msg);
      setCopiedId(project.id);
      setTimeout(() => setCopiedId((curr) => (curr === project.id ? null : curr)), 2500);
    } catch {
      setCopiedId(project.id);
    }
  };

  const handleSendGmailHandover = async (project: ReadyProject, msg: string) => {
    if (!gmailAccessToken || isDemoMode) {
      setEmailStatus((prev) => ({
        ...prev,
        [project.id]: 'Switch to Live Mode and sign in with Google to send handover email via Gmail.',
      }));
      return;
    }

    setEmailStatus((prev) => ({ ...prev, [project.id]: 'Sending handover email...' }));
    try {
      const res = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${gmailAccessToken}`,
        },
        body: JSON.stringify({
          to: notifyEmail,
          subject: `READY PROJECT! ${project.businessName} (${project.discussedPrice})`,
          body: msg,
          fromName: 'AK47 Client Hunter AI',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gmail handover send failed.');
      setEmailStatus((prev) => ({
        ...prev,
        [project.id]: `Handover email sent via Gmail to ${notifyEmail}.`,
      }));
    } catch (err) {
      setEmailStatus((prev) => ({
        ...prev,
        [project.id]: err instanceof Error ? err.message : 'Unable to send handover email.',
      }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white tracking-tight">
            Ready Projects Handover
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Qualified clients ready to pay &amp; start — forward full client details directly to {formattedNotifyPhone} or {ownerName}.
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {[
            { id: 'all', label: `All (${projects.length})` },
            { id: 'pending_takeover', label: `Pending Takeover (${pendingCount})` },
            { id: 'taken_over', label: `Taken Over (${takenCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id as typeof filter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                filter === tab.id
                  ? 'bg-red-600 text-white'
                  : 'bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="glass-panel rounded-xl p-10 text-center space-y-2">
          <Sparkles className="h-6 w-6 text-zinc-500 mx-auto" />
          <p className="text-sm font-medium text-zinc-200">
            No ready project handovers in this filter yet.
          </p>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            When a client explicitly confirms readiness to pay or start in Conversations, a complete handover package and alert for {formattedNotifyPhone} appear here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.map((project) => {
            const isPending = project.status === 'pending_takeover';
            const historyOpen = Boolean(expandedHistoryIds[project.id]);
            const resolvedClientPhone =
              project.clientPhone || leads.find((l) => l.id === project.leadId)?.phone || null;
            const alertMessage = buildReadyProjectMessage(project, resolvedClientPhone);
            const whatsappUrl = buildWhatsAppHandoverUrl(
              notifyPhone || '+91 78530 25466',
              alertMessage
            );
            const smsUrl = buildSmsHandoverUrl(notifyPhone || '+91 78530 25466', alertMessage);

            return (
              <article
                key={project.id}
                className={`glass-panel rounded-xl overflow-hidden ${
                  isPending ? 'border-red-500/40' : 'border-emerald-500/25'
                }`}
              >
                {/* Handover Notification Banner */}
                <div
                  className={`px-5 py-3.5 border-b border-white/[0.08] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                    isPending ? 'bg-red-950/30' : 'bg-emerald-950/20'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`font-mono text-xs font-bold tracking-wider uppercase ${
                        isPending ? 'text-red-400' : 'text-emerald-400'
                      }`}
                    >
                      {isPending ? 'READY PROJECT!' : 'PROJECT TAKEN OVER'}
                    </span>
                    <span className="text-zinc-500">·</span>
                    <span className="text-sm font-semibold text-white truncate">
                      {project.businessName}
                    </span>
                    {project.isDemo && (
                      <span className="text-[11px] font-mono text-amber-300 shrink-0">
                        · Demo Sample
                      </span>
                    )}
                  </div>

                  {isPending ? (
                    <button
                      type="button"
                      onClick={() => onTakeOverProject(project.id)}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-bold tracking-wide text-white transition-colors whitespace-nowrap shrink-0"
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      <span>TAKE OVER PROJECT</span>
                    </button>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-300 shrink-0">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>
                        Assigned to {project.takenOverBy || ownerName}
                        {project.takenOverAt
                          ? ` · ${new Date(project.takenOverAt).toLocaleDateString()}`
                          : ''}
                      </span>
                    </div>
                  )}
                </div>

                {/* Direct Client Details Message Dispatch -> 78530 25466 */}
                <div className="px-5 py-3 border-b border-white/[0.08] bg-black/40 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                  <div className="text-xs text-zinc-300">
                    <span className="font-semibold text-white">Direct Handover Alert:</span> Send client details &amp; pricing brief to{' '}
                    <span className="font-mono text-red-400">{formattedNotifyPhone}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors whitespace-nowrap"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>WhatsApp {formattedNotifyPhone}</span>
                    </a>
                    <a
                      href={smsUrl}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-xs font-semibold text-white transition-colors whitespace-nowrap"
                    >
                      <span>SMS {formattedNotifyPhone}</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => handleCopyMessage(project, alertMessage)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-medium text-zinc-200 transition-colors whitespace-nowrap"
                    >
                      {copiedId === project.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Copied Client Brief</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy Details</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendGmailHandover(project, alertMessage)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-medium text-zinc-200 transition-colors whitespace-nowrap"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      <span>Email {ownerName}</span>
                    </button>
                  </div>
                </div>

                {emailStatus[project.id] && (
                  <div className="px-5 py-2 bg-white/[0.03] border-b border-white/[0.06] text-xs text-zinc-300">
                    {emailStatus[project.id]}
                  </div>
                )}

                {/* All Required Handover Fields + Client Phone */}
                <div className="p-5 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                    <div className="bg-black/40 border border-white/[0.06] rounded-lg p-3">
                      <div className="text-[11px] text-zinc-400">Business Name</div>
                      <div className="mt-1 font-semibold text-white">{project.businessName}</div>
                    </div>
                    <div className="bg-black/40 border border-white/[0.06] rounded-lg p-3">
                      <div className="text-[11px] text-zinc-400">Contact Person</div>
                      <div className="mt-1 font-semibold text-white">{project.contactPerson}</div>
                    </div>
                    <div className="bg-black/40 border border-white/[0.06] rounded-lg p-3">
                      <div className="text-[11px] text-zinc-400">Client Email</div>
                      <div className="mt-1 font-mono text-zinc-200 break-all">{project.email}</div>
                    </div>
                    <div className="bg-black/40 border border-white/[0.06] rounded-lg p-3">
                      <div className="text-[11px] text-zinc-400">Client Phone</div>
                      <div className="mt-1 font-mono text-zinc-200">
                        {resolvedClientPhone || 'Not listed on Google Maps'}
                      </div>
                    </div>
                    <div className="bg-black/40 border border-white/[0.06] rounded-lg p-3">
                      <div className="text-[11px] text-zinc-400">Country</div>
                      <div className="mt-1 font-medium text-white">{project.country}</div>
                    </div>
                    <div className="bg-black/40 border border-white/[0.06] rounded-lg p-3">
                      <div className="text-[11px] text-zinc-400">Business Category</div>
                      <div className="mt-1 font-medium text-white">{project.category}</div>
                    </div>
                    <div className="bg-black/40 border border-white/[0.06] rounded-lg p-3">
                      <div className="text-[11px] text-zinc-400">Expected Timeline</div>
                      <div className="mt-1 font-mono text-white">{project.expectedTimeline}</div>
                    </div>
                    <div className="bg-black/40 border border-white/[0.06] rounded-lg p-3">
                      <div className="text-[11px] text-zinc-400">Client Budget</div>
                      <div className="mt-1 font-mono font-semibold text-zinc-200">
                        {project.clientBudget}
                      </div>
                    </div>
                    <div className="bg-black/40 border border-white/[0.06] rounded-lg p-3 sm:col-span-2 lg:col-span-4">
                      <div className="text-[11px] text-zinc-400">Discussed Price (Indicative Quote)</div>
                      <div className="mt-1 font-mono text-base font-bold text-red-400">
                        {project.discussedPrice}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                    <div className="bg-black/40 border border-white/[0.06] rounded-lg p-4 space-y-1.5">
                      <div className="text-[11px] font-medium text-zinc-400">Project Requirements</div>
                      <p className="text-zinc-200 leading-relaxed">{project.projectRequirements}</p>
                    </div>
                    <div className="bg-black/40 border border-white/[0.06] rounded-lg p-4 space-y-2">
                      <div className="text-[11px] font-medium text-zinc-400">Requested Features</div>
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-zinc-200">
                        {project.requestedFeatures.map((feat) => (
                          <li key={feat} className="leading-snug">
                            · {feat}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Complete Conversation History */}
                  <div className="border-t border-white/[0.08] pt-4">
                    <button
                      type="button"
                      onClick={() => toggleHistory(project.id)}
                      className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-300 hover:text-white transition-colors"
                    >
                      <MessageSquare className="h-3.5 w-3.5 text-red-500" />
                      <span>
                        Complete Conversation History ({project.conversationHistory.length} messages)
                      </span>
                      {historyOpen ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>

                    {historyOpen && (
                      <div className="mt-3 space-y-2.5 rounded-lg bg-black/50 border border-white/[0.08] p-4 max-h-80 overflow-y-auto">
                        {project.conversationHistory.map((msg) => (
                          <div key={msg.id} className="text-xs space-y-0.5">
                            <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500">
                              <span className="font-semibold text-zinc-300">{msg.senderName}</span>
                              <span className="font-mono tabular-nums">
                                {new Date(msg.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-zinc-200 leading-relaxed">{msg.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
