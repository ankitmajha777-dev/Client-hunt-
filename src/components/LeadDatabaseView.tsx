import React, { useState } from 'react';
import { Download, Search, Trash2, CheckCircle2, Globe, Mail, X } from 'lucide-react';
import {
  CONVERSATION_STAGES,
  TARGET_COUNTRIES,
  type ConversationStage,
  type LeadRecord,
  type ScoreClassification,
  type WebsiteTier,
} from '../types/domain';

interface LeadDatabaseViewProps {
  leads: LeadRecord[];
  onUpdateLead: (leadId: string, patch: Partial<LeadRecord>) => void;
  onDeleteLead: (leadId: string) => void;
  onInspectLead: (leadId: string) => void;
  onDraftOutreach: (leadId: string) => void;
}

export const LeadDatabaseView: React.FC<LeadDatabaseViewProps> = ({
  leads,
  onUpdateLead,
  onDeleteLead,
  onInspectLead,
  onDraftOutreach,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<'all' | WebsiteTier>('all');
  const [classFilter, setClassFilter] = useState<'all' | ScoreClassification>('all');
  const [stageFilter, setStageFilter] = useState<'all' | ConversationStage>('all');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const filtered = leads
    .filter((l) => {
      if (countryFilter !== 'all' && l.country !== countryFilter) return false;
      if (tierFilter !== 'all' && l.websiteTier !== tierFilter) return false;
      if (classFilter !== 'all' && l.score.classification !== classFilter) return false;
      if (stageFilter !== 'all' && l.stage !== stageFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          l.name.toLowerCase().includes(q) ||
          l.city.toLowerCase().includes(q) ||
          l.category.toLowerCase().includes(q) ||
          (l.email || '').toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => b.score.total - a.score.total);

  const selectedLead = leads.find((l) => l.id === selectedLeadId) ?? null;

  const exportCsv = () => {
    const headers = [
      'Name',
      'Country',
      'City',
      'Category',
      'Website Tier',
      'Score',
      'Classification',
      'Stage',
      'Phone',
      'Email',
      'Website',
      'Demo',
    ];
    const rows = filtered.map((l) => [
      l.name,
      l.country,
      l.city,
      l.category,
      l.websiteTier,
      String(l.score.total),
      l.score.classification,
      l.stage,
      l.phone || '',
      l.email || '',
      l.website || '',
      String(l.isDemo),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ak47-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white tracking-tight">
            Lead Database & Scoring
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Ranked prospects with transparent 0–100 scoring across all six qualification criteria.
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-xs font-semibold text-white transition-colors disabled:opacity-40 whitespace-nowrap shrink-0"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export CSV ({filtered.length})</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative">
          <Search className="h-4 w-4 text-zinc-500 absolute left-3 top-2.5" />
          <input
            type="text"
            aria-label="Search leads"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search business, city, category..."
            className="w-full rounded-lg bg-black/60 border border-white/10 pl-9 pr-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-red-500"
          />
        </div>

        <select
          aria-label="Filter by country"
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          className="rounded-lg bg-black/60 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
        >
          <option value="all">All Countries</option>
          {TARGET_COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by website tier"
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value as any)}
          className="rounded-lg bg-black/60 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
        >
          <option value="all">All Website Tiers (A–E)</option>
          <option value="A">Tier A · No Website</option>
          <option value="B">Tier B · Outdated</option>
          <option value="C">Tier C · Poor</option>
          <option value="D">Tier D · Average</option>
          <option value="E">Tier E · Premium</option>
        </select>

        <select
          aria-label="Filter by score classification"
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value as any)}
          className="rounded-lg bg-black/60 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
        >
          <option value="all">All Score Tiers</option>
          <option value="Premium Lead">Premium Lead (90–100)</option>
          <option value="High Quality">High Quality (75–89)</option>
          <option value="Medium">Medium (60–74)</option>
          <option value="Reject">Reject (&lt;60)</option>
        </select>

        <select
          aria-label="Filter by conversation stage"
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value as any)}
          className="rounded-lg bg-black/60 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
        >
          <option value="all">All Pipeline Stages</option>
          {CONVERSATION_STAGES.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
      </div>

      {/* Table + Detail Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className={`${selectedLead ? 'lg:col-span-7' : 'lg:col-span-12'} glass-panel rounded-xl overflow-hidden`}>
          {filtered.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm text-zinc-300">No leads match your current filters.</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCountryFilter('all');
                  setTierFilter('all');
                  setClassFilter('all');
                  setStageFilter('all');
                }}
                className="mt-3 px-4 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-white"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.08] text-[11px] font-medium text-zinc-400">
                    <th className="py-3 px-4">Business</th>
                    <th className="py-3 px-3">Market</th>
                    <th className="py-3 px-3">Tier</th>
                    <th className="py-3 px-3 text-right">Score</th>
                    <th className="py-3 px-3">Stage</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05] text-xs">
                  {filtered.map((lead) => (
                    <tr
                      key={lead.id}
                      className={`transition-colors ${
                        selectedLeadId === lead.id ? 'bg-red-950/20' : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => setSelectedLeadId(lead.id)}
                          className="text-left font-medium text-white hover:text-red-400 transition-colors"
                        >
                          {lead.name}
                        </button>
                        <div className="text-[11px] text-zinc-500 mt-0.5">
                          {lead.category} {lead.isDemo ? '· Demo' : ''}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-zinc-300 whitespace-nowrap">
                        {lead.city ? `${lead.city}, ` : ''}
                        {lead.country}
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold text-zinc-200">
                        {lead.websiteTier}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums">
                        <span
                          className={
                            lead.score.total >= 90
                              ? 'text-red-400 font-semibold'
                              : lead.score.total >= 75
                                ? 'text-white font-semibold'
                                : 'text-zinc-400'
                          }
                        >
                          {lead.score.total}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-zinc-300 whitespace-nowrap">{lead.stage}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onInspectLead(lead.id)}
                            aria-label={`Inspect website for ${lead.name}`}
                            className="p-1.5 rounded bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white"
                            title="Inspect Website"
                          >
                            <Globe className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDraftOutreach(lead.id)}
                            aria-label={`Draft outreach for ${lead.name}`}
                            className="p-1.5 rounded bg-white/[0.05] hover:bg-red-600/30 text-zinc-300 hover:text-white"
                            title="Draft AI Outreach"
                          >
                            <Mail className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (selectedLeadId === lead.id) setSelectedLeadId(null);
                              onDeleteLead(lead.id);
                            }}
                            aria-label={`Delete ${lead.name}`}
                            className="p-1.5 rounded bg-white/[0.05] hover:bg-red-600/30 text-zinc-400 hover:text-red-300"
                            title="Delete Lead"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Selected Lead Score & CRUD Panel */}
        {selectedLead && (
          <div className="lg:col-span-5 glass-panel rounded-xl p-5 space-y-5 self-start">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold text-white">
                  {selectedLead.name}
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {selectedLead.category} · {selectedLead.city}, {selectedLead.country}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLeadId(null)}
                aria-label="Close lead details"
                className="p-1.5 text-zinc-400 hover:text-white rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Score Breakdown */}
            <div className="space-y-3 border-t border-white/[0.08] pt-4">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold text-white">
                  AI Lead Score: {selectedLead.score.classification}
                </span>
                <span className="font-mono text-xl font-bold text-red-400 tabular-nums">
                  {selectedLead.score.total}/100
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                {[
                  ['Business Quality', selectedLead.score.businessQuality, 25],
                  ['Website Opportunity', selectedLead.score.websiteOpportunity, 25],
                  ['Online Presence', selectedLead.score.onlinePresence, 15],
                  ['Customer Activity', selectedLead.score.customerActivity, 15],
                  ['Contact Availability', selectedLead.score.contactAvailability, 10],
                  ['Business Potential', selectedLead.score.businessPotential, 10],
                ].map(([label, val, max]) => (
                  <div key={String(label)} className="bg-black/40 border border-white/[0.06] rounded-lg p-2.5">
                    <div className="text-[11px] text-zinc-400">{label}</div>
                    <div className="mt-1 font-mono text-sm font-semibold text-white tabular-nums">
                      {val} / {max}
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-medium text-zinc-400">Scoring Rationale</div>
                <ul className="space-y-1 text-xs text-zinc-300">
                  {selectedLead.score.reasons.map((r, i) => (
                    <li key={i} className="leading-relaxed">
                      · {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Contact & Verification CRUD */}
            <div className="space-y-3 border-t border-white/[0.08] pt-4">
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label htmlFor="lead-contact-email" className="block text-[11px] text-zinc-400 mb-1">
                    Contact Email
                  </label>
                  <input
                    id="lead-contact-email"
                    type="email"
                    value={selectedLead.email || ''}
                    onChange={(e) =>
                      onUpdateLead(selectedLead.id, { email: e.target.value || null })
                    }
                    placeholder="Add verified business email..."
                    className="w-full rounded-lg bg-black/60 border border-white/10 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label htmlFor="lead-contact-person" className="block text-[11px] text-zinc-400 mb-1">
                    Contact Person
                  </label>
                  <input
                    id="lead-contact-person"
                    type="text"
                    value={selectedLead.contactPerson || ''}
                    onChange={(e) =>
                      onUpdateLead(selectedLead.id, { contactPerson: e.target.value || null })
                    }
                    placeholder="Owner or manager name..."
                    className="w-full rounded-lg bg-black/60 border border-white/10 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label htmlFor="lead-stage-select" className="block text-[11px] text-zinc-400 mb-1">
                    Pipeline Stage
                  </label>
                  <select
                    id="lead-stage-select"
                    value={selectedLead.stage}
                    onChange={(e) =>
                      onUpdateLead(selectedLead.id, { stage: e.target.value as ConversationStage })
                    }
                    className="w-full rounded-lg bg-black/60 border border-white/10 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-500"
                  >
                    {CONVERSATION_STAGES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateLead(selectedLead.id, { verified: !selectedLead.verified })
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    selectedLead.verified
                      ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                      : 'bg-white/[0.04] border-white/10 text-zinc-300'
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{selectedLead.verified ? 'Verified Lead' : 'Mark Verified'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDraftOutreach(selectedLead.id)}
                  className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white transition-colors"
                >
                  Draft Outreach
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
