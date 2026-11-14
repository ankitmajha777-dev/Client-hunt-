import React from 'react';
import { ArrowRight, Play, AlertCircle } from 'lucide-react';
import type {
  ActivityLog,
  AgencySettings,
  LeadRecord,
  NavSection,
  ReadyProject,
} from '../types/domain';
import type { OverviewStats } from '../lib/metrics';

interface OverviewViewProps {
  stats: OverviewStats;
  leads: LeadRecord[];
  readyProjects: ReadyProject[];
  activityLogs: ActivityLog[];
  settings: AgencySettings;
  isDemoMode: boolean;
  onNavigate: (section: NavSection) => void;
  onRunDailyAutomationCycle: () => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  stats,
  leads,
  readyProjects,
  activityLogs,
  settings,
  isDemoMode,
  onNavigate,
  onRunDailyAutomationCycle,
}) => {
  const kpiCards = [
    { label: 'Total Businesses Discovered', value: stats.totalDiscovered.toLocaleString() },
    { label: 'Verified Leads', value: stats.verifiedLeads.toLocaleString() },
    { label: 'High-Quality Leads', value: stats.highQualityLeads.toLocaleString() },
    { label: 'Emails Sent', value: stats.emailsSent.toLocaleString() },
    { label: 'Replies Received', value: stats.repliesReceived.toLocaleString() },
    { label: 'Interested Clients', value: stats.interestedClients.toLocaleString() },
    { label: 'Negotiations', value: stats.negotiations.toLocaleString() },
    { label: 'Ready Projects', value: stats.readyProjectsCount.toLocaleString(), highlight: true },
    { label: 'Conversion Rate', value: `${stats.conversionRate.toFixed(1)}%` },
    {
      label: 'Estimated Pipeline Value',
      value: `$${stats.estimatedPipelineUsd.toLocaleString()}`,
    },
  ];

  const funnelStages = [
    { label: 'Discovered', count: stats.totalDiscovered },
    { label: 'Verified', count: stats.verifiedLeads },
    { label: 'Tier A/B/C Opportunity', count: leads.filter((l) => ['A', 'B', 'C'].includes(l.websiteTier)).length },
    { label: 'Outreach Sent', count: stats.emailsSent },
    { label: 'Active Replies', count: stats.repliesReceived },
    { label: 'Ready Projects', count: stats.readyProjectsCount },
  ];
  const maxFunnel = Math.max(1, ...funnelStages.map((s) => s.count));

  const pendingTakeovers = readyProjects.filter((p) => p.status === 'pending_takeover');

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white tracking-tight text-balance">
            Acquisition Command Overview
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Live metrics computed directly from your workspace database · {isDemoMode ? 'Demo Mode dataset (30 fictional businesses)' : 'Live Firestore workspace'}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onRunDailyAutomationCycle}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-xs font-semibold text-white transition-colors whitespace-nowrap"
          >
            <Play className="h-3.5 w-3.5 text-red-500" />
            <span>Run Automation Audit Cycle</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('hunter')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white transition-colors whitespace-nowrap"
          >
            <span>Hunt Leads</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Pending Handover Alert Banner */}
      {pendingTakeovers.length > 0 && (
        <div className="glass-panel rounded-xl p-4 border-red-500/30 bg-red-950/15 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-white">
                READY PROJECT! {pendingTakeovers.length} client{pendingTakeovers.length > 1 ? 's' : ''} confirmed buying intent
              </div>
              <div className="text-xs text-zinc-300 mt-0.5">
                {pendingTakeovers.map((p) => `${p.businessName} (${p.discussedPrice})`).join(' · ')}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('projects')}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
          >
            Review Ready Projects
          </button>
        </div>
      )}

      {/* 10 Live KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className={`glass-panel rounded-xl p-4 ${
              card.highlight ? 'border-red-500/35 bg-red-950/10' : ''
            }`}
          >
            <div className="text-xs text-zinc-400 leading-snug">{card.label}</div>
            <div
              className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${
                card.highlight ? 'text-red-400' : 'text-white'
              }`}
            >
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Middle 2-Column Split: Conversion Funnel + Daily Automation Targets */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 glass-panel rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-white">
              Pipeline Conversion Funnel
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('analytics')}
              className="text-xs text-zinc-400 hover:text-white transition-colors"
            >
              Full Analytics
            </button>
          </div>
          <div className="space-y-3">
            {funnelStages.map((stage) => {
              const pct = Math.round((stage.count / maxFunnel) * 100);
              return (
                <div key={stage.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300">{stage.label}</span>
                    <span className="font-mono text-zinc-200 tabular-nums">{stage.count}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-red-600 transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5 glass-panel rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-white">
              Configurable Daily Targets
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="text-xs text-zinc-400 hover:text-white transition-colors"
            >
              Configure
            </button>
          </div>
          <p className="text-xs text-zinc-400">
            Scheduled goals for automated discovery and compliance-checked outreach (targets only, not guaranteed outcomes).
          </p>
          <div className="space-y-3 pt-1">
            {[
              {
                label: 'Discovery Target',
                current: stats.totalDiscovered,
                target: settings.automation.dailyDiscoveryTarget,
              },
              {
                label: 'Verified Target',
                current: stats.verifiedLeads,
                target: settings.automation.dailyVerifiedTarget,
              },
              {
                label: 'Outreach Target',
                current: stats.emailsSent,
                target: settings.automation.dailyOutreachTarget,
              },
            ].map((item) => {
              const pct = Math.min(100, Math.round((item.current / Math.max(1, item.target)) * 100));
              return (
                <div key={item.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300">{item.label}</span>
                    <span className="font-mono text-zinc-300 tabular-nums">
                      {item.current} / {item.target}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-zinc-200 transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between text-xs text-zinc-400">
            <span>Schedule: {settings.automation.scheduleTimeUtc} UTC</span>
            <span>{settings.automation.enabled ? 'Automation Active' : 'Manual Trigger Mode'}</span>
          </div>
        </div>
      </div>

      {/* Recent Activity Logs */}
      <div className="glass-panel rounded-xl p-5 space-y-4">
        <h2 className="font-display text-base font-semibold text-white">
          Recent Agent Activity
        </h2>
        {activityLogs.length === 0 ? (
          <div className="py-8 text-center text-sm text-zinc-400">
            No agent actions recorded yet. Start by discovering leads or auditing a website.
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {activityLogs.slice(0, 6).map((log) => (
              <div key={log.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white">{log.title}</div>
                  <div className="text-xs text-zinc-400 mt-0.5">{log.detail}</div>
                </div>
                <div className="font-mono text-[11px] text-zinc-500 shrink-0 tabular-nums">
                  {new Date(log.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
