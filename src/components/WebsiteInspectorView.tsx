import React, { useState } from 'react';
import { Globe, Play, Loader2, ExternalLink } from 'lucide-react';
import {
  WEBSITE_TIER_LABELS,
  type LeadRecord,
  type WebsiteAudit,
} from '../types/domain';
import { calculateLeadScore, generateDeterministicAuditMetrics } from '../lib/scoring';

interface WebsiteInspectorViewProps {
  leads: LeadRecord[];
  audits: WebsiteAudit[];
  initialLeadId: string | null;
  isDemoMode: boolean;
  onSaveAuditAndRescore: (leadId: string, audit: WebsiteAudit, updatedLeadPatch: Partial<LeadRecord>) => void;
}

export const WebsiteInspectorView: React.FC<WebsiteInspectorViewProps> = ({
  leads,
  audits,
  initialLeadId,
  isDemoMode,
  onSaveAuditAndRescore,
}) => {
  const prioritizedLeads = [...leads].sort((a, b) => {
    const order = { A: 0, B: 1, C: 2, D: 3, E: 4 };
    return order[a.websiteTier] - order[b.websiteTier] || b.score.total - a.score.total;
  });

  const [selectedLeadId, setSelectedLeadId] = useState<string>(
    initialLeadId || prioritizedLeads[0]?.id || ''
  );
  const [customUrl, setCustomUrl] = useState('');
  const [isAuditing, setIsAuditing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const activeLead = leads.find((l) => l.id === selectedLeadId) || prioritizedLeads[0] || null;
  const activeAudit = activeLead
    ? audits.find((a) => a.businessId === activeLead.id) || null
    : null;

  const handleRunAudit = async () => {
    if (!activeLead) return;
    setIsAuditing(true);
    setStatusMsg(null);

    const targetUrl = customUrl.trim() || activeLead.website;

    try {
      let result: {
        tier: WebsiteAudit['tier'];
        metrics: WebsiteAudit['metrics'];
        findings: string[];
        opportunities: string[];
        liveChecked?: boolean;
      };

      if (isDemoMode || !targetUrl) {
        result = generateDeterministicAuditMetrics(targetUrl, activeLead.id);
      } else {
        const res = await fetch('/api/audit/website', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ websiteUrl: targetUrl }),
        });
        if (!res.ok) throw new Error('Live website inspection failed');
        result = await res.json();
      }

      const newAudit: WebsiteAudit = {
        id: activeAudit?.id || `audit_${activeLead.id}`,
        businessId: activeLead.id,
        websiteUrl: targetUrl || null,
        tier: result.tier,
        metrics: result.metrics,
        findings: result.findings,
        opportunities: result.opportunities,
        auditedAt: new Date().toISOString(),
        isDemo: isDemoMode,
      };

      const updatedScore = calculateLeadScore({
        businessStatus: activeLead.businessStatus,
        website: targetUrl || null,
        websiteTier: result.tier,
        auditMetrics: result.metrics,
        rating: activeLead.rating,
        reviewCount: activeLead.reviewCount,
        phone: activeLead.phone,
        email: activeLead.email,
        address: activeLead.address,
        category: activeLead.category,
      });

      onSaveAuditAndRescore(activeLead.id, newAudit, {
        websiteTier: result.tier,
        score: updatedScore,
        website: targetUrl || null,
      });

      setStatusMsg(
        `Inspection complete: classified as ${WEBSITE_TIER_LABELS[result.tier]} · Updated Lead Score ${updatedScore.total}/100 (${updatedScore.classification}).`
      );
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Website inspection failed.');
    } finally {
      setIsAuditing(false);
    }
  };

  const metricEntries = activeAudit
    ? [
        ['Website Availability', activeAudit.metrics.availability],
        ['Mobile Responsiveness', activeAudit.metrics.mobileResponsiveness],
        ['Loading Performance', activeAudit.metrics.loadingPerformance],
        ['Visual Design', activeAudit.metrics.visualDesign],
        ['Navigation Structure', activeAudit.metrics.navigation],
        ['Menu / Service Accessibility', activeAudit.metrics.menuAccessibility],
        ['Contact Information', activeAudit.metrics.contactInformation],
        ['Booking Functionality', activeAudit.metrics.bookingFunctionality],
        ['Overall Website Quality', activeAudit.metrics.overallQuality],
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-white tracking-tight">
          Website Inspector
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Evaluate 9 technical & UX quality signals, classify tiers A–E, and prioritize high-opportunity A/B/C prospects.
        </p>
      </div>

      {prioritizedLeads.length === 0 ? (
        <div className="glass-panel rounded-xl p-10 text-center text-sm text-zinc-400">
          No businesses available to inspect yet. Discover leads in Lead Hunter first.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Prioritized Prospect Selector */}
          <div className="lg:col-span-4 glass-panel rounded-xl flex flex-col max-h-[640px]">
            <div className="px-4 py-3 border-b border-white/[0.08] text-xs font-semibold text-white">
              Priority Queue (A · B · C First)
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-white/[0.05]">
              {prioritizedLeads.map((lead) => {
                const selected = activeLead?.id === lead.id;
                return (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => {
                      setSelectedLeadId(lead.id);
                      setCustomUrl('');
                      setStatusMsg(null);
                    }}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      selected ? 'bg-red-950/25' : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-white truncate">
                        {lead.name}
                      </span>
                      <span className="font-mono text-xs font-semibold text-red-400 shrink-0 tabular-nums">
                        Tier {lead.websiteTier}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-400 truncate">
                      {lead.category} · {lead.city || lead.country} · Score {lead.score.total}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Audit Workspace */}
          {activeLead && (
            <div className="lg:col-span-8 glass-panel rounded-xl p-5 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/[0.08] pb-4">
                <div>
                  <h2 className="font-display text-lg font-semibold text-white">
                    {activeLead.name}
                  </h2>
                  <div className="text-xs text-zinc-400 mt-1 flex flex-wrap items-center gap-2">
                    <span>{WEBSITE_TIER_LABELS[activeAudit?.tier || activeLead.websiteTier]}</span>
                    <span>·</span>
                    {activeLead.website ? (
                      <a
                        href={activeLead.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-red-400 hover:text-red-300"
                      >
                        <span className="truncate max-w-[260px]">{activeLead.website}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    ) : (
                      <span>No website URL on record</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRunAudit}
                  disabled={isAuditing}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
                >
                  {isAuditing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  <span>{isAuditing ? 'Inspecting...' : 'Run Website Audit'}</span>
                </button>
              </div>

              {/* Optional URL override */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label htmlFor="inspector-url-input" className="block text-[11px] text-zinc-400 mb-1">
                    Inspect Specific Website URL (optional override)
                  </label>
                  <div className="relative">
                    <Globe className="h-4 w-4 text-zinc-500 absolute left-3 top-2.5" />
                    <input
                      id="inspector-url-input"
                      type="url"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      placeholder={activeLead.website || 'https://example.com'}
                      className="w-full rounded-lg bg-black/60 border border-white/10 pl-9 pr-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-red-500"
                    />
                  </div>
                </div>
              </div>

              {statusMsg && (
                <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-200">
                  {statusMsg}
                </div>
              )}

              {/* 9 Evaluation Dimensions */}
              {activeAudit ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {metricEntries.map(([label, scoreVal]) => {
                      const num = Number(scoreVal);
                      const pct = Math.min(100, Math.round(num * 10));
                      return (
                        <div key={String(label)} className="bg-black/40 border border-white/[0.06] rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-zinc-300 truncate">{label}</span>
                            <span className="font-mono font-semibold text-white tabular-nums shrink-0">
                              {num.toFixed(1)}/10
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-white/[0.08] overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                num >= 7 ? 'bg-emerald-500' : num >= 4 ? 'bg-amber-500' : 'bg-red-600'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-black/40 border border-white/[0.06] rounded-lg p-4 space-y-2">
                      <h3 className="text-xs font-semibold text-white">Diagnostic Findings</h3>
                      <ul className="space-y-1.5 text-xs text-zinc-300">
                        {activeAudit.findings.map((f, i) => (
                          <li key={i}>· {f}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-black/40 border border-white/[0.06] rounded-lg p-4 space-y-2">
                      <h3 className="text-xs font-semibold text-white">Website Improvement Opportunities</h3>
                      <ul className="space-y-1.5 text-xs text-zinc-300">
                        {activeAudit.opportunities.map((o, i) => (
                          <li key={i}>· {o}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center text-xs text-zinc-400">
                  Click "Run Website Audit" to evaluate all 9 quality metrics and update the lead score.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
