import type { AgencySettings, RegionalPricingConfig, TargetCountry } from '../types/domain';

export const DEFAULT_REGIONAL_PRICING: RegionalPricingConfig[] = [
  {
    country: 'India',
    currency: 'INR',
    symbol: '₹',
    indicativeMin: 10000,
    indicativeMax: 30000,
    minAcceptablePrice: 9000,
    formattedRange: '₹10,000–₹30,000',
  },
  {
    country: 'United States',
    currency: 'USD',
    symbol: '$',
    indicativeMin: 1000,
    indicativeMax: 4000,
    minAcceptablePrice: 850,
    formattedRange: '$1,000–$4,000',
  },
  {
    country: 'United Kingdom',
    currency: 'GBP',
    symbol: '£',
    indicativeMin: 800,
    indicativeMax: 3000,
    minAcceptablePrice: 700,
    formattedRange: '£800–£3,000',
  },
  {
    country: 'Canada',
    currency: 'CAD',
    symbol: 'CAD ',
    indicativeMin: 1000,
    indicativeMax: 4000,
    minAcceptablePrice: 850,
    formattedRange: 'CAD 1,000–4,000',
  },
  {
    country: 'Australia',
    currency: 'AUD',
    symbol: 'AUD ',
    indicativeMin: 1000,
    indicativeMax: 4000,
    minAcceptablePrice: 850,
    formattedRange: 'AUD 1,000–4,000',
  },
  {
    country: 'United Arab Emirates',
    currency: 'AED',
    symbol: 'AED ',
    indicativeMin: 3500,
    indicativeMax: 14000,
    minAcceptablePrice: 3000,
    formattedRange: 'AED 3,500–14,000',
  },
];

export const DEFAULT_SETTINGS: AgencySettings = {
  ownerName: 'Ankit Majhi',
  businessName: 'A.M',
  contactEmail: 'ankitmajha777@gmail.com',
  portfolioUrl: '',
  targetCountries: ['United States', 'United Kingdom', 'Canada', 'Australia', 'United Arab Emirates', 'India'],
  targetCategories: [
    'Restaurants',
    'Luxury Restaurants',
    'Hotels',
    'Resorts',
    'Dental Clinics',
    'Real Estate',
    'Automobile Dealerships',
    'Law Firms',
  ],
  aiPersonality: 'Consultative & Crisp',
  maxDiscountPercent: 15,
  paymentMilestones: '40% kickoff · 30% design sign-off · 30% production launch',
  defaultDeliveryTimeline: '10–21 business days depending on scope',
  regionalPricing: DEFAULT_REGIONAL_PRICING,
  packages: [
    {
      id: 'pkg-launch',
      name: 'Launch Foundation',
      description: 'Mobile-first 5-page custom website with local SEO and lead capture form.',
      deliveryTimeline: '7–10 business days',
      features: ['Responsive custom UI', 'Google Maps & contact integration', 'On-page SEO foundation', 'SSL & speed optimization'],
    },
    {
      id: 'pkg-growth',
      name: 'Growth & Booking Engine',
      description: 'Conversion-focused site with online booking, digital menus/catalog, and analytics.',
      deliveryTimeline: '12–16 business days',
      features: ['Online reservation / booking flow', 'Interactive menu or service catalog', 'WhatsApp & email inquiry routing', '30-day post-launch support'],
    },
    {
      id: 'pkg-flagship',
      name: 'Flagship Custom Platform',
      description: 'Bespoke brand experience with CMS, multi-location support, and CRM integration.',
      deliveryTimeline: '18–25 business days',
      features: ['Bespoke design system', 'CMS content dashboard', 'Automated follow-up webhooks', 'Priority maintenance SLA'],
    },
  ],
  automation: {
    enabled: false,
    dailyDiscoveryTarget: 100,
    dailyVerifiedTarget: 50,
    dailyOutreachTarget: 30,
    scheduleTimeUtc: '09:00',
    autoReplyMonitor: true,
    preventDuplicates: true,
    respectUnsubscribes: true,
  },
  notifications: {
    notifyOnReadyProject: true,
    notifyOnReply: true,
    notifyEmail: 'ankitmajha777@gmail.com',
    notifyPhone: '+91 78530 25466',
    notifyViaWhatsApp: true,
  },
  optOutEmails: [],
};

export function getPricingForCountry(
  country: TargetCountry,
  pricingList: RegionalPricingConfig[] = DEFAULT_REGIONAL_PRICING
): RegionalPricingConfig {
  return (
    pricingList.find((p) => p.country === country) ??
    DEFAULT_REGIONAL_PRICING.find((p) => p.country === country) ??
    DEFAULT_REGIONAL_PRICING[1]
  );
}

/**
 * Evaluates whether a proposed price or discount is within Ankit's authorized negotiation bounds.
 * AI cannot accept contracts, discounts outside maxDiscountPercent, or payment commitments without owner approval.
 */
export function evaluateNegotiationBounds(params: {
  country: TargetCountry;
  proposedPrice: number;
  maxDiscountPercent: number;
  pricingList?: RegionalPricingConfig[];
}): {
  withinAuthority: boolean;
  requiresOwnerApproval: boolean;
  reason: string;
  floorPrice: number;
} {
  const cfg = getPricingForCountry(params.country, params.pricingList);
  const discountFloor = Math.round(cfg.indicativeMin * (1 - params.maxDiscountPercent / 100));
  const floorPrice = Math.max(cfg.minAcceptablePrice, discountFloor);

  if (params.proposedPrice < floorPrice) {
    return {
      withinAuthority: false,
      requiresOwnerApproval: true,
      floorPrice,
      reason: `Proposed price (${cfg.symbol}${params.proposedPrice.toLocaleString()}) falls below the authorized floor (${cfg.symbol}${floorPrice.toLocaleString()}, max ${params.maxDiscountPercent}% discount). Owner approval required.`,
    };
  }

  return {
    withinAuthority: true,
    requiresOwnerApproval: false,
    floorPrice,
    reason: `Within indicative range (${cfg.formattedRange}) and authorized minimum (${cfg.symbol}${floorPrice.toLocaleString()}).`,
  };
}

export function formatCurrencyAmount(amount: number, country: TargetCountry, pricingList?: RegionalPricingConfig[]): string {
  const cfg = getPricingForCountry(country, pricingList);
  return `${cfg.symbol}${amount.toLocaleString('en-US')}`;
}
