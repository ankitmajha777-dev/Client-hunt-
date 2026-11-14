export type TargetCountry =
  | 'United States'
  | 'United Kingdom'
  | 'Canada'
  | 'Australia'
  | 'United Arab Emirates'
  | 'India';

export const TARGET_COUNTRIES: TargetCountry[] = [
  'United States',
  'United Kingdom',
  'Canada',
  'Australia',
  'United Arab Emirates',
  'India',
];

export const BUSINESS_CATEGORIES = [
  'Restaurants',
  'Luxury Restaurants',
  'Hotels',
  'Resorts',
  'Cafes',
  'Real Estate',
  'Dental Clinics',
  'Automobile Dealerships',
  'Gyms',
  'Beauty Salons',
  'Law Firms',
  'Travel Agencies',
  'Event Companies',
  'Retail Businesses',
] as const;

export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number] | string;

export type WebsiteTier = 'A' | 'B' | 'C' | 'D' | 'E';

export const WEBSITE_TIER_LABELS: Record<WebsiteTier, string> = {
  A: 'A · No Website',
  B: 'B · Outdated Website',
  C: 'C · Poor Website',
  D: 'D · Average Website',
  E: 'E · Premium Website',
};

export type ScoreClassification = 'Premium Lead' | 'High Quality' | 'Medium' | 'Reject';

export type ConversationStage =
  | 'New Lead'
  | 'Contacted'
  | 'Interested'
  | 'Requirements Discussion'
  | 'Negotiation'
  | 'Ready for Project'
  | 'Not Interested';

export const CONVERSATION_STAGES: ConversationStage[] = [
  'New Lead',
  'Contacted',
  'Interested',
  'Requirements Discussion',
  'Negotiation',
  'Ready for Project',
  'Not Interested',
];

export interface ScoreBreakdown {
  businessQuality: number; // max 25
  websiteOpportunity: number; // max 25
  onlinePresence: number; // max 15
  customerActivity: number; // max 15
  contactAvailability: number; // max 10
  businessPotential: number; // max 10
  total: number; // 0-100
  classification: ScoreClassification;
  reasons: string[];
}

export interface WebsiteAuditMetrics {
  availability: number; // 0-10
  mobileResponsiveness: number; // 0-10
  loadingPerformance: number; // 0-10
  visualDesign: number; // 0-10
  navigation: number; // 0-10
  menuAccessibility: number; // 0-10
  contactInformation: number; // 0-10
  bookingFunctionality: number; // 0-10
  overallQuality: number; // 0-10
}

export interface WebsiteAudit {
  id: string;
  businessId: string;
  websiteUrl: string | null;
  tier: WebsiteTier;
  metrics: WebsiteAuditMetrics;
  findings: string[];
  opportunities: string[];
  auditedAt: string;
  isDemo: boolean;
}

export interface LeadRecord {
  id: string;
  placeId: string;
  name: string;
  address: string;
  city: string;
  country: TargetCountry;
  category: BusinessCategory;
  phone: string | null;
  email: string | null;
  contactPerson: string | null;
  website: string | null;
  googleMapsUri: string;
  rating: number | null;
  reviewCount: number | null;
  businessStatus: 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'UNKNOWN';
  location: { lat: number; lng: number };
  websiteTier: WebsiteTier;
  score: ScoreBreakdown;
  stage: ConversationStage;
  verified: boolean;
  optedOut: boolean;
  isDemo: boolean;
  discoveredAt: string;
  updatedAt: string;
}

export interface OutreachMessage {
  id: string;
  leadId: string;
  businessName: string;
  recipientEmail: string | null;
  subject: string;
  body: string;
  status: 'draft' | 'sent' | 'replied' | 'bounced' | 'unsubscribed';
  channel: 'gmail' | 'demo_simulated';
  followUpCount: number;
  sentAt: string | null;
  createdAt: string;
  gmailMessageId?: string | null;
  gmailThreadId?: string | null;
  isDemo: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'ai_agent' | 'client' | 'owner';
  senderName: string;
  content: string;
  timestamp: string;
  detectedIntent?: 'pricing' | 'features' | 'timeline' | 'portfolio' | 'buying_intent' | 'opt_out' | 'general';
  requiresOwnerApproval?: boolean;
}

export interface ConversationThread {
  id: string;
  leadId: string;
  businessName: string;
  contactPerson: string | null;
  email: string | null;
  country: TargetCountry;
  category: BusinessCategory;
  stage: ConversationStage;
  discussedPrice: string | null;
  clientBudget: string | null;
  expectedTimeline: string | null;
  requestedFeatures: string[];
  readinessConfidence: number; // 0-100
  readinessTriggerPhrase: string | null;
  messages: ChatMessage[];
  updatedAt: string;
  isDemo: boolean;
}

export interface ReadyProject {
  id: string;
  leadId: string;
  conversationId: string;
  businessName: string;
  contactPerson: string;
  email: string;
  clientPhone?: string | null;
  country: TargetCountry;
  category: BusinessCategory;
  projectRequirements: string;
  requestedFeatures: string[];
  clientBudget: string;
  discussedPrice: string;
  expectedTimeline: string;
  conversationHistory: ChatMessage[];
  status: 'pending_takeover' | 'taken_over';
  takenOverBy: string | null;
  takenOverAt: string | null;
  createdAt: string;
  isDemo: boolean;
}

export interface RegionalPricingConfig {
  country: TargetCountry;
  currency: string;
  symbol: string;
  indicativeMin: number;
  indicativeMax: number;
  minAcceptablePrice: number;
  formattedRange: string;
}

export interface WebsitePackage {
  id: string;
  name: string;
  description: string;
  deliveryTimeline: string;
  features: string[];
}

export interface ActivityLog {
  id: string;
  type: 'discovery' | 'audit' | 'score' | 'outreach' | 'conversation' | 'handover' | 'automation' | 'settings';
  title: string;
  detail: string;
  timestamp: string;
  isDemo: boolean;
}

export interface AgencySettings {
  ownerName: string;
  businessName: string;
  contactEmail: string;
  portfolioUrl: string;
  targetCountries: TargetCountry[];
  targetCategories: string[];
  aiPersonality: 'Consultative & Crisp' | 'Executive & Direct' | 'Warm & Helpful';
  maxDiscountPercent: number;
  paymentMilestones: string;
  defaultDeliveryTimeline: string;
  regionalPricing: RegionalPricingConfig[];
  packages: WebsitePackage[];
  automation: {
    enabled: boolean;
    dailyDiscoveryTarget: number;
    dailyVerifiedTarget: number;
    dailyOutreachTarget: number;
    scheduleTimeUtc: string;
    autoReplyMonitor: boolean;
    preventDuplicates: boolean;
    respectUnsubscribes: boolean;
  };
  notifications: {
    notifyOnReadyProject: boolean;
    notifyOnReply: boolean;
    notifyEmail: string;
    notifyPhone: string;
    notifyViaWhatsApp: boolean;
  };
  optOutEmails: string[];
}

export type NavSection =
  | 'overview'
  | 'hunter'
  | 'database'
  | 'inspector'
  | 'outreach'
  | 'conversations'
  | 'negotiator'
  | 'projects'
  | 'analytics'
  | 'settings';
