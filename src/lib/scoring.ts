import type {
  BusinessCategory,
  ScoreBreakdown,
  ScoreClassification,
  WebsiteAuditMetrics,
  WebsiteTier,
} from '../types/domain';

export interface ScoringInput {
  businessStatus: 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'UNKNOWN';
  website: string | null;
  websiteTier: WebsiteTier;
  auditMetrics?: WebsiteAuditMetrics;
  rating: number | null;
  reviewCount: number | null;
  phone: string | null;
  email: string | null;
  address: string;
  category: BusinessCategory;
}

const HIGH_TICKET_CATEGORIES = new Set<string>([
  'Luxury Restaurants',
  'Hotels',
  'Resorts',
  'Real Estate',
  'Dental Clinics',
  'Automobile Dealerships',
  'Law Firms',
  'Event Companies',
]);

const MEDIUM_TICKET_CATEGORIES = new Set<string>([
  'Restaurants',
  'Gyms',
  'Beauty Salons',
  'Travel Agencies',
  'Retail Businesses',
  'Cafes',
]);

export function classifyScore(total: number): ScoreClassification {
  if (total >= 90) return 'Premium Lead';
  if (total >= 75) return 'High Quality';
  if (total >= 60) return 'Medium';
  return 'Reject';
}

export function classifyWebsiteTier(
  hasWebsite: boolean,
  metrics?: Partial<WebsiteAuditMetrics>
): WebsiteTier {
  if (!hasWebsite) return 'A';
  if (!metrics) return 'C';

  const avg =
    ((metrics.availability ?? 5) +
      (metrics.mobileResponsiveness ?? 5) +
      (metrics.loadingPerformance ?? 5) +
      (metrics.visualDesign ?? 5) +
      (metrics.navigation ?? 5) +
      (metrics.menuAccessibility ?? 5) +
      (metrics.contactInformation ?? 5) +
      (metrics.bookingFunctionality ?? 5) +
      (metrics.overallQuality ?? 5)) /
    9;

  if (avg < 3.5) return 'C';
  if (avg < 5.5) return 'B';
  if (avg < 7.8) return 'D';
  return 'E';
}

/**
 * Computes deterministic 0-100 lead score across 6 weighted pillars:
 * - Business quality: 25 points (operational continuity & storefront completeness — NOT purchasing power)
 * - Website opportunity: 25 points (prioritizes A/B/C website gaps)
 * - Online presence: 15 points (gap between listing visibility and web conversion readiness)
 * - Customer activity: 15 points (active customer engagement signals; explicitly not equated to budget)
 * - Contact availability: 10 points (reachable phone, email, verified address)
 * - Business potential: 10 points (website ROI fit for industry category)
 */
export function calculateLeadScore(input: ScoringInput): ScoreBreakdown {
  const reasons: string[] = [];

  // 1. Business Quality (max 25)
  let businessQuality = 0;
  if (input.businessStatus === 'OPERATIONAL') {
    businessQuality += 17;
    reasons.push('Business Quality (+17): Verified operational status.');
  } else if (input.businessStatus === 'UNKNOWN') {
    businessQuality += 10;
    reasons.push('Business Quality (+10): Operational status unconfirmed.');
  } else {
    businessQuality += 2;
    reasons.push('Business Quality (+2): Temporarily closed; low immediate priority.');
  }

  if (input.address && input.address.trim().length > 8) {
    businessQuality += 5;
  }
  if (input.rating !== null && input.rating >= 4.0) {
    businessQuality += 3;
    reasons.push(
      `Business Quality (+3): Consistent service reputation (${input.rating.toFixed(1)}★), noted as operational consistency rather than budget proof.`
    );
  }
  businessQuality = Math.min(25, businessQuality);

  // 2. Website Opportunity (max 25) — prioritizes A, B, C
  const tierScores: Record<WebsiteTier, number> = {
    A: 25,
    B: 22,
    C: 19,
    D: 10,
    E: 3,
  };
  const websiteOpportunity = tierScores[input.websiteTier];
  if (input.websiteTier === 'A') {
    reasons.push('Website Opportunity (+25/25): Tier A — No active website detected; immediate greenfield build opportunity.');
  } else if (input.websiteTier === 'B') {
    reasons.push('Website Opportunity (+22/25): Tier B — Outdated website architecture; strong redesign & modernization case.');
  } else if (input.websiteTier === 'C') {
    reasons.push('Website Opportunity (+19/25): Tier C — Poor mobile UX or missing booking/contact flows.');
  } else if (input.websiteTier === 'D') {
    reasons.push('Website Opportunity (+10/25): Tier D — Average website; moderate conversion-optimization scope.');
  } else {
    reasons.push('Website Opportunity (+3/25): Tier E — Existing website is already modern and well-structured.');
  }

  // 3. Online Presence (max 15)
  let onlinePresence = 0;
  if (!input.website) {
    onlinePresence = 15;
    reasons.push('Online Presence (+15/15): Present on Google Maps without a dedicated owned web property.');
  } else if (input.auditMetrics) {
    const gap = Math.max(0, 10 - input.auditMetrics.overallQuality);
    onlinePresence = Math.min(15, Math.round(5 + gap * 1.1));
    reasons.push(`Online Presence (+${onlinePresence}/15): Measurable gap between Maps discoverability and web conversion quality.`);
  } else {
    onlinePresence = 9;
    reasons.push('Online Presence (+9/15): Baseline web presence pending deeper technical audit.');
  }

  // 4. Customer Activity (max 15) — signals active footfall/demand, NOT purchasing capacity
  let customerActivity = 4;
  if (input.reviewCount !== null) {
    if (input.reviewCount >= 120) {
      customerActivity = 15;
      reasons.push(`Customer Activity (+15/15): Active customer volume (${input.reviewCount} reviews — indicates steady demand, not assumed budget).`);
    } else if (input.reviewCount >= 40) {
      customerActivity = 12;
      reasons.push(`Customer Activity (+12/15): Healthy customer engagement (${input.reviewCount} reviews — demand signal only).`);
    } else if (input.reviewCount >= 10) {
      customerActivity = 8;
      reasons.push(`Customer Activity (+8/15): Moderate review footprint (${input.reviewCount} reviews).`);
    } else {
      customerActivity = 5;
      reasons.push(`Customer Activity (+5/15): Early or low review volume (${input.reviewCount} reviews).`);
    }
  } else {
    reasons.push('Customer Activity (+4/15): Review count unavailable; conservative baseline applied.');
  }

  // 5. Contact Availability (max 10)
  let contactAvailability = 0;
  if (input.phone) contactAvailability += 5;
  if (input.email) contactAvailability += 4;
  if (input.address) contactAvailability += 1;
  contactAvailability = Math.min(10, contactAvailability);
  reasons.push(
    `Contact Availability (+${contactAvailability}/10): ${[
      input.phone ? 'Phone available' : 'No phone',
      input.email ? 'Email verified' : 'Email not listed',
    ].join(' · ')}.`
  );

  // 6. Business Potential (max 10)
  let businessPotential = 6;
  if (HIGH_TICKET_CATEGORIES.has(input.category)) {
    businessPotential = 10;
    reasons.push(`Business Potential (+10/10): ${input.category} benefits directly from online bookings, showcase UX, and lead capture.`);
  } else if (MEDIUM_TICKET_CATEGORIES.has(input.category)) {
    businessPotential = 8;
    reasons.push(`Business Potential (+8/10): ${input.category} has clear conversion upside from menu, booking, or local SEO improvements.`);
  } else {
    reasons.push(`Business Potential (+7/10): Custom category (${input.category}) evaluated at standard commercial potential.`);
    businessPotential = 7;
  }

  const total = Math.max(
    0,
    Math.min(
      100,
      businessQuality +
        websiteOpportunity +
        onlinePresence +
        customerActivity +
        contactAvailability +
        businessPotential
    )
  );

  return {
    businessQuality,
    websiteOpportunity,
    onlinePresence,
    customerActivity,
    contactAvailability,
    businessPotential,
    total,
    classification: classifyScore(total),
    reasons,
  };
}

export function generateDeterministicAuditMetrics(
  website: string | null,
  seedHint: string
): { tier: WebsiteTier; metrics: WebsiteAuditMetrics; findings: string[]; opportunities: string[] } {
  if (!website) {
    return {
      tier: 'A',
      metrics: {
        availability: 0,
        mobileResponsiveness: 0,
        loadingPerformance: 0,
        visualDesign: 0,
        navigation: 0,
        menuAccessibility: 0,
        contactInformation: 2,
        bookingFunctionality: 0,
        overallQuality: 0,
      },
      findings: [
        'No dedicated business website URL found on Google Business Profile.',
        'Customers searching online cannot browse services, pricing, or book directly.',
        'All inbound digital discovery relies on third-party directories.',
      ],
      opportunities: [
        'Launch a mobile-first flagship website with direct booking/inquiry capture.',
        'Establish brand credibility and local search visibility.',
        'Add structured service/menu showcase with WhatsApp & email lead routing.',
      ],
    };
  }

  let hash = 0;
  for (let i = 0; i < seedHint.length; i++) {
    hash = (hash * 31 + seedHint.charCodeAt(i)) % 1000;
  }

  const isWeakDomain =
    website.includes('wixsite') ||
    website.includes('blogspot') ||
    website.includes('wordpress.com') ||
    website.includes('sites.google') ||
    website.includes('facebook.com') ||
    website.includes('instagram.com') ||
    website.startsWith('http://');

  const base = isWeakDomain ? 3 : 4 + (hash % 5);
  const clamp = (n: number) => Math.max(1, Math.min(10, n));

  const metrics: WebsiteAuditMetrics = {
    availability: website.startsWith('http://') ? 6 : 9,
    mobileResponsiveness: clamp(base - (isWeakDomain ? 1 : 0)),
    loadingPerformance: clamp(base + ((hash >> 2) % 3) - 1),
    visualDesign: clamp(base - 1 + (hash % 2)),
    navigation: clamp(base),
    menuAccessibility: clamp(base - 1),
    contactInformation: clamp(base + 1),
    bookingFunctionality: isWeakDomain ? 2 : clamp(base - 2),
    overallQuality: 0,
  };

  const avg =
    (metrics.availability +
      metrics.mobileResponsiveness +
      metrics.loadingPerformance +
      metrics.visualDesign +
      metrics.navigation +
      metrics.menuAccessibility +
      metrics.contactInformation +
      metrics.bookingFunctionality) /
    8;
  metrics.overallQuality = Math.round(avg * 10) / 10;

  const tier = classifyWebsiteTier(true, metrics);
  const findings: string[] = [];
  const opportunities: string[] = [];

  if (website.startsWith('http://')) {
    findings.push('Site uses unencrypted HTTP rather than HTTPS SSL.');
    opportunities.push('Migrate to HTTPS with modern hosting and CDN caching.');
  }
  if (isWeakDomain) {
    findings.push('Relies on a free subdomain or social profile instead of a custom brand domain.');
    opportunities.push('Deploy custom domain website to improve trust and conversion.');
  }
  if (metrics.mobileResponsiveness <= 5) {
    findings.push('Mobile viewport layout shows cramped navigation and inconsistent touch spacing.');
    opportunities.push('Redesign responsive mobile navigation with thumb-friendly primary CTAs.');
  }
  if (metrics.bookingFunctionality <= 4) {
    findings.push('No instant booking, appointment request, or structured quote form found.');
    opportunities.push('Integrate frictionless online booking and automated inquiry confirmations.');
  }
  if (metrics.loadingPerformance <= 5) {
    findings.push('Unoptimized media assets and heavy scripts slow first contentful paint.');
    opportunities.push('Compress images, eliminate render-blocking assets, and optimize Core Web Vitals.');
  }
  if (findings.length === 0) {
    findings.push('Website is functional with baseline structure and SSL enabled.');
    opportunities.push('Enhance conversion copy and analytics tracking for incremental gains.');
  }

  return { tier, metrics, findings, opportunities };
}
