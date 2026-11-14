import React from 'react';
import type {
  LeadRecord,
  ScoreClassification,
  WebsiteAudit,
  WebsiteTier,
} from '../types/domain';
import { WEBSITE_TIER_LABELS } from '../types/domain';
import {
  computeCountryBreakdown,
  computeTierDistribution,
  type OverviewStats,
} from '../lib/metrics';

interface AnalyticsViewProps {
  leads: LeadRecord[];
  audits: WebsiteAudit[];
  stats: OverviewStats;
  isDemoMode: boolean;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  leads,
  audits,
  stats,
  isDemoMode,
}) => {
  const tierDist = computeTierDistribution(leads);
  const countryStats = computeCountryBreakdown(leads).sort((a, b) => b.count - a.count);

  const scoreBuckets: Array<{ label: ScoreClassification; count: number; color: string }> = [
    {
      label: 'Premium Lead',
      count: leads.filter((l) => l.score.classification === 'Premium Lead').length,
      color: '#dc2626',
    },
    {
      label: 'High Quality',
      count: leads.filter((l) => l.score.classification === 'High Quality').length,
      color: '#f87171',
    },
    {
      label: 'Medium',
      count: leads.filter((l) => l.score.classification === 'Medium').length,
      color: '#a1a1aa',
    },
    {
      label: 'Reject',
      count: leads.filter((l) => l.score.classification === 'Reject').length,
      color: '#52525b',
    },
  ];

  const categoryMap: Record<string, { count: number; avgScore: number; totalScore: number }> = {};
  for (const lead of leads) {
    if (!categoryMap[lead.category]) {
      categoryMap[lead.category] = { count: 0, avgScore: 0, totalScore: 0 };
    }
    categoryMap[lead.category].count += 1;
    categoryMap[lead.category].totalScore += lead.score.total;
  }
  const topCategories = Object.entries(categoryMap)
    .map(([category, v]) => ({
      category,
      count: v.count,
      avgScore: Math.round(v.totalScore / Math.max(1, v.count)),
    }))
    .sort((a, b) => b.count - a.count || b.avgScore - a.avgScore)
    .slice(0, 8);

  const maxTierCount = Math.max(1, ...tierDist.map((t) => t.count));
  const maxCountryCount = Math.max(1, ...countryStats.map((c) => c.count));
  const totalLeads = Math.max(1, leads.length);

  const avgAuditQuality =
    audits.length > 0
      ? (
          audits.reduce((sum, a) => sum + a.metrics.overallQuality, 0) / audits.length
        ).toFixed(1)
      : '0.0';

  const tierColors: Record<WebsiteTier, string> = {
    A: '#dc2626',
    B: '#ea580c',
    C: '#d97706',
    D: '#71717a',
    E: '#27272a',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-white tracking-tight">
          Acquisition Analytics
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Real-time performance distributions computed from {leads.length} {isDemoMode ? 'Demo Mode' : 'Firestore'} prospect records.
        </p>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-panel rounded-xl p-4">
          <div className="text-xs text-zinc-400">Tier A / B / C Share</div>
          <div className="mt-1.5 font-mono text-2xl font-semibold text-red-400 tabular-nums">
            {leads.length > 0
              ? `${Math.round(
                  (leads.filter((l) => ['A', 'B', 'C'].includes(l.websiteTier)).length /
                    leads.length) *
                    100
                )}%`
              : '0%'}
          </div>
        </div>
        <div className="glass-panel rounded-xl p-4">
          <div className="text-xs text-zinc-400">Mean Lead Score</div>
          <div className="mt-1.5 font-mono text-2xl font-semibold text-white tabular-nums">
            {leads.length > 0
              ? Math.round(leads.reduce((s, l) => s + l.score.total, 0) / leads.length)
              : 0}
            <span className="text-xs text-zinc-500"> / 100</span>
          </div>
        </div>
        <div className="glass-panel rounded-xl p-4">
          <div className="text-xs text-zinc-400">Avg Audited Site Quality</div>
          <div className="mt-1.5 font-mono text-2xl font-semibold text-white tabular-nums">
            {avgAuditQuality}
            <span className="text-xs text-zinc-500"> / 10</span>
          </div>
        </div>
        <div className="glass-panel rounded-xl p-4">
          <div className="text-xs text-zinc-400">Lead-to-Ready Conversion</div>
          <div className="mt-1.5 font-mono text-2xl font-semibold text-white tabular-nums">
            {stats.conversionRate.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Website Tier SVG Bar Chart */}
        <div className="lg:col-span-6 glass-panel rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-white">
              Website Quality Tier Breakdown
            </h2>
            <span className="text-[11px] text-zinc-400">A / B / C prioritized</span>
          </div>
          <div className="space-y-3">
            {tierDist.map((item) => {
              const pctWidth = Math.round((item.count / maxTierCount) * 100);
              return (
                <div key={item.tier} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300">{WEBSITE_TIER_LABELS[item.tier]}</span>
                    <span className="font-mono text-zinc-200 tabular-nums">
                      {item.count} ({Math.round((item.count / totalLeads) * 100)}%)
                    </span>
                  </div>
                  <svg className="w-full h-3 rounded bg-white/[0.05]" role="img" aria-label={`${WEBSITE_TIER_LABELS[item.tier]}: ${item.count}`}>
                    <rect
                      x={0}
                      y={0}
                      width={`${pctWidth}%`}
                      height="100%"
                      rx={4}
                      fill={tierColors[item.tier]}
                    />
                  </svg>
                </div>
              );
            })}
          </div>
        </div>

        {/* Score Classification Distribution */}
        <div className="lg:col-span-6 glass-panel rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-white">
              AI Lead Score Classification
            </h2>
            <span className="text-[11px] text-zinc-400">0–100 model</span>
          </div>

          {/* Stacked SVG Ratio Bar */}
          <svg className="w-full h-5 rounded-lg overflow-hidden bg-white/[0.05]" role="img" aria-label="Score classification distribution">
            {(() => {
              let xOffset = 0;
              return scoreBuckets.map((b) => {
                const widthPct = (b.count / totalLeads) * 100;
                const el = (
                  <rect
                    key={b.label}
                    x={`${xOffset}%`}
                    y={0}
                    width={`${widthPct}%`}
                    height="100%"
                    fill={b.color}
                  />
                );
                xOffset += widthPct;
                return el;
              });
            })()}
          </svg>

          <div className="grid grid-cols-2 gap-3 pt-1">
            {scoreBuckets.map((b) => (
              <div
                key={b.label}
                className="bg-black/40 border border-white/[0.06] rounded-lg p-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2.5 w-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: b.color }}
                  />
                  <span className="text-xs text-zinc-300 truncate">{b.label}</span>
                </div>
                <span className="font-mono text-sm font-semibold text-white tabular-nums">
                  {b.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Country Market Breakdown */}
        <div className="lg:col-span-6 glass-panel rounded-xl p-5 space-y-4">
          <h2 className="font-display text-base font-semibold text-white">
            Target Market Performance
          </h2>
          {countryStats.length === 0 ? (
            <p className="text-xs text-zinc-400">No country data recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {countryStats.map((c) => {
                const widthPct = Math.round((c.count / maxCountryCount) * 100);
                return (
                  <div key={c.country} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-200 font-medium">{c.country}</span>
                      <span className="font-mono text-zinc-400 tabular-nums">
                        {c.count} leads · Avg Score {c.avgScore}
                      </span>
                    </div>
                    <svg className="w-full h-2.5 rounded bg-white/[0.05]">
                      <rect
                        x={0}
                        y={0}
                        width={`${widthPct}%`}
                        height="100%"
                        rx={3}
                        fill="#dc2626"
                      />
                    </svg>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Categories */}
        <div className="lg:col-span-6 glass-panel rounded-xl p-5 space-y-4">
          <h2 className="font-display text-base font-semibold text-white">
            Category Opportunity Matrix
          </h2>
          {topCategories.length === 0 ? (
            <p className="text-xs text-zinc-400">No categories discovered yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] text-[11px] text-zinc-400">
                    <th className="py-2 pr-3">Category</th>
                    <th className="py-2 px-3 text-right">Businesses</th>
                    <th className="py-2 pl-3 text-right">Avg Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {topCategories.map((cat) => (
                    <tr key={cat.category}>
                      <td className="py-2.5 pr-3 text-white font-medium">{cat.category}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-zinc-300 tabular-nums">
                        {cat.count}
                      </td>
                      <td className="py-2.5 pl-3 text-right font-mono text-red-400 tabular-nums">
                        {cat.avgScore}/100
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
