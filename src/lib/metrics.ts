import type {
  ConversationThread,
  LeadRecord,
  OutreachMessage,
  ReadyProject,
  TargetCountry,
  WebsiteTier,
} from '../types/domain';

export interface OverviewStats {
  totalDiscovered: number;
  verifiedLeads: number;
  highQualityLeads: number; // score >= 75 (High Quality + Premium Lead)
  emailsSent: number;
  repliesReceived: number;
  interestedClients: number;
  negotiations: number;
  readyProjectsCount: number;
  conversionRate: number; // percentage 0-100
  estimatedPipelineUsd: number;
}

const COUNTRY_ESTIMATED_AVG_USD: Record<TargetCountry, number> = {
  'United States': 2400,
  'United Kingdom': 2100,
  Canada: 1850,
  Australia: 1750,
  'United Arab Emirates': 2450,
  India: 300,
};

export function computeOverviewStats(params: {
  leads: LeadRecord[];
  outreachMessages: OutreachMessage[];
  conversations: ConversationThread[];
  readyProjects: ReadyProject[];
}): OverviewStats {
  const { leads, outreachMessages, conversations, readyProjects } = params;

  const totalDiscovered = leads.length;
  const verifiedLeads = leads.filter((l) => l.verified).length;
  const highQualityLeads = leads.filter(
    (l) => l.score.classification === 'Premium Lead' || l.score.classification === 'High Quality'
  ).length;

  const emailsSent = outreachMessages.filter(
    (m) => m.status === 'sent' || m.status === 'replied' || m.status === 'unsubscribed'
  ).length;

  const repliesReceived =
    outreachMessages.filter((m) => m.status === 'replied').length ||
    conversations.filter((c) => c.messages.some((msg) => msg.sender === 'client')).length;

  const interestedClients = leads.filter(
    (l) =>
      l.stage === 'Interested' ||
      l.stage === 'Requirements Discussion' ||
      l.stage === 'Negotiation' ||
      l.stage === 'Ready for Project'
  ).length;

  const negotiations = leads.filter((l) => l.stage === 'Negotiation').length;
  const readyProjectsCount = readyProjects.length;

  const conversionRate =
    totalDiscovered > 0
      ? Math.round((readyProjectsCount / totalDiscovered) * 1000) / 10
      : 0;

  // Compute realistic pipeline value across active qualified & advancing leads
  const pipelineLeads = leads.filter(
    (l) =>
      !l.optedOut &&
      l.stage !== 'Not Interested' &&
      (l.score.total >= 75 ||
        l.stage === 'Interested' ||
        l.stage === 'Requirements Discussion' ||
        l.stage === 'Negotiation' ||
        l.stage === 'Ready for Project')
  );

  const stageWeight: Record<LeadRecord['stage'], number> = {
    'New Lead': 0.2,
    Contacted: 0.3,
    Interested: 0.5,
    'Requirements Discussion': 0.65,
    Negotiation: 0.85,
    'Ready for Project': 1.0,
    'Not Interested': 0,
  };

  const estimatedPipelineUsd = Math.round(
    pipelineLeads.reduce((sum, lead) => {
      const avg = COUNTRY_ESTIMATED_AVG_USD[lead.country] ?? 1500;
      return sum + avg * stageWeight[lead.stage];
    }, 0)
  );

  return {
    totalDiscovered,
    verifiedLeads,
    highQualityLeads,
    emailsSent,
    repliesReceived,
    interestedClients,
    negotiations,
    readyProjectsCount,
    conversionRate,
    estimatedPipelineUsd,
  };
}

export function computeTierDistribution(leads: LeadRecord[]): { tier: WebsiteTier; count: number }[] {
  const counts: Record<WebsiteTier, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const lead of leads) {
    counts[lead.websiteTier] = (counts[lead.websiteTier] ?? 0) + 1;
  }
  return (['A', 'B', 'C', 'D', 'E'] as WebsiteTier[]).map((tier) => ({
    tier,
    count: counts[tier],
  }));
}

export function computeCountryBreakdown(leads: LeadRecord[]): { country: TargetCountry; count: number; avgScore: number }[] {
  const map: Record<string, { count: number; totalScore: number }> = {};
  for (const lead of leads) {
    if (!map[lead.country]) map[lead.country] = { count: 0, totalScore: 0 };
    map[lead.country].count += 1;
    map[lead.country].totalScore += lead.score.total;
  }
  return Object.entries(map).map(([country, val]) => ({
    country: country as TargetCountry,
    count: val.count,
    avgScore: val.count > 0 ? Math.round(val.totalScore / val.count) : 0,
  }));
}
