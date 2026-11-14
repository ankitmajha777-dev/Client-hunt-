import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';
import { evaluateClientReadiness } from './src/lib/readiness.ts';
import { evaluateNegotiationBounds, getPricingForCountry } from './src/lib/pricing.ts';
import { classifyWebsiteTier } from './src/lib/scoring.ts';
import type { TargetCountry, WebsiteAuditMetrics } from './src/types/domain.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '2mb' }));

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withTimeout<T>(promise: Promise<T>, ms = 7000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`AI request timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

function getMapsApiKey(): string | null {
  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!key || key === 'MY_GOOGLE_MAPS_API_KEY') return null;
  return key;
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    geminiConfigured: Boolean(getGeminiClient()),
    mapsConfigured: Boolean(getMapsApiKey()),
  });
});

// Google Places API (New) Text Search Server Proxy (prevents CORS and protects server key)
app.post('/api/places/search', async (req, res) => {
  const apiKey = getMapsApiKey();
  if (!apiKey) {
    return res.status(400).json({
      error: 'MAPS_NOT_CONFIGURED',
      message: 'Google Maps API key is not configured in environment secrets. Use Demo Mode or configure GOOGLE_MAPS_API_KEY.',
    });
  }

  try {
    const {
      country,
      city,
      category,
      minRating = 0,
      minReviews = 0,
      websiteStatus = 'all',
      activityStatus = 'all',
    } = req.body as {
      country: TargetCountry;
      city?: string;
      category: string;
      minRating?: number;
      minReviews?: number;
      websiteStatus?: 'all' | 'no_website' | 'has_website';
      activityStatus?: 'all' | 'OPERATIONAL';
    };

    const textQuery = [category, city?.trim() ? `in ${city.trim()}, ${country}` : `in ${country}`]
      .filter(Boolean)
      .join(' ');

    const regionMap: Record<string, string> = {
      'United States': 'us',
      'United Kingdom': 'gb',
      Canada: 'ca',
      Australia: 'au',
      'United Arab Emirates': 'ae',
      India: 'in',
    };

    const bodyPayload: Record<string, unknown> = {
      textQuery,
      pageSize: 20,
      languageCode: 'en',
      regionCode: regionMap[country] || 'us',
    };

    if (minRating > 0) {
      bodyPayload.minRating = Math.min(5, Math.max(0.5, Math.round(minRating * 2) / 2));
    }

    const fieldMask = [
      'places.id',
      'places.displayName',
      'places.formattedAddress',
      'places.nationalPhoneNumber',
      'places.internationalPhoneNumber',
      'places.websiteUri',
      'places.googleMapsUri',
      'places.rating',
      'places.userRatingCount',
      'places.businessStatus',
      'places.location',
      'places.primaryTypeDisplayName',
    ].join(',');

    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
        'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
      },
      body: JSON.stringify(bodyPayload),
    });

    const data = (await response.json()) as {
      places?: Array<{
        id?: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        nationalPhoneNumber?: string;
        internationalPhoneNumber?: string;
        websiteUri?: string;
        googleMapsUri?: string;
        rating?: number;
        userRatingCount?: number;
        businessStatus?: string;
        location?: { latitude?: number; longitude?: number };
        primaryTypeDisplayName?: { text?: string };
      }>;
      error?: { status?: string; message?: string; code?: number };
    };

    if (!response.ok) {
      const isQuota =
        response.status === 429 ||
        data.error?.status === 'RESOURCE_EXHAUSTED';
      return res.status(response.status).json({
        error: isQuota ? 'RESOURCE_EXHAUSTED' : data.error?.status || 'PLACES_ERROR',
        quotaExceeded: isQuota,
        message: data.error?.message || `Places API returned status ${response.status}`,
      });
    }

    const rawPlaces = Array.isArray(data.places) ? data.places : [];
    const filtered = rawPlaces.filter((p) => {
      const reviews = p.userRatingCount ?? 0;
      const rating = p.rating ?? 0;
      if (minReviews > 0 && reviews < minReviews) return false;
      if (minRating > 0 && rating < minRating) return false;
      if (websiteStatus === 'no_website' && p.websiteUri) return false;
      if (websiteStatus === 'has_website' && !p.websiteUri) return false;
      if (activityStatus === 'OPERATIONAL' && p.businessStatus !== 'OPERATIONAL') return false;
      return true;
    });

    const mapped = filtered.map((p) => ({
      placeId: p.id || '',
      name: p.displayName?.text || 'Unnamed Business',
      address: p.formattedAddress || '',
      city: city?.trim() || '',
      country,
      category,
      phone: p.internationalPhoneNumber || p.nationalPhoneNumber || null,
      email: null,
      website: p.websiteUri || null,
      googleMapsUri: p.googleMapsUri || `https://maps.google.com/?q=place_id:${p.id}`,
      rating: typeof p.rating === 'number' ? p.rating : null,
      reviewCount: typeof p.userRatingCount === 'number' ? p.userRatingCount : null,
      businessStatus:
        p.businessStatus === 'OPERATIONAL'
          ? 'OPERATIONAL'
          : p.businessStatus === 'CLOSED_TEMPORARILY'
            ? 'CLOSED_TEMPORARILY'
            : 'UNKNOWN',
      location: {
        lat: p.location?.latitude ?? 0,
        lng: p.location?.longitude ?? 0,
      },
    }));

    return res.json({ places: mapped, totalRaw: rawPlaces.length });
  } catch (error) {
    return res.status(500).json({
      error: 'PLACES_PROXY_FAILED',
      message: error instanceof Error ? error.message : 'Failed to query Google Places API',
    });
  }
});

// Live Website Inspector: fetches actual URL headers & HTML signals
app.post('/api/audit/website', async (req, res) => {
  const { websiteUrl } = req.body as { websiteUrl?: string | null };

  if (!websiteUrl || !websiteUrl.trim()) {
    return res.json({
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
      findings: ['No website URL is attached to this business listing.'],
      opportunities: [
        'Build a high-converting custom website with mobile responsiveness and online inquiry capture.',
      ],
      liveChecked: false,
    });
  }

  let normalizedUrl = websiteUrl.trim();
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(normalizedUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'AK47-ClientHunter-Inspector/1.0' },
    });
    clearTimeout(timeout);

    const elapsedMs = Date.now() - start;
    const html = (await response.text()).slice(0, 120000).toLowerCase();
    const isHttps = response.url.startsWith('https://');
    const hasViewport = html.includes('name="viewport"') || html.includes("name='viewport'");
    const hasNav = html.includes('<nav');
    const hasBooking =
      html.includes('book') ||
      html.includes('reserv') ||
      html.includes('appointment') ||
      html.includes('schedule');
    const hasContact =
      html.includes('contact') ||
      html.includes('mailto:') ||
      html.includes('tel:') ||
      html.includes('whatsapp');
    const hasMenuOrServices =
      html.includes('menu') || html.includes('services') || html.includes('pricing');
    const isTemplateHost =
      normalizedUrl.includes('wixsite') ||
      normalizedUrl.includes('blogspot') ||
      normalizedUrl.includes('sites.google') ||
      normalizedUrl.includes('wordpress.com');

    const availability = response.ok ? (isHttps ? 9 : 6) : 3;
    const mobileResponsiveness = hasViewport ? (isTemplateHost ? 5 : 8) : 2;
    const loadingPerformance = elapsedMs < 900 ? 9 : elapsedMs < 2000 ? 6 : 3;
    const visualDesign = isTemplateHost ? 4 : html.includes('tailwind') || html.includes('flex') ? 7 : 5;
    const navigation = hasNav ? 7 : 3;
    const menuAccessibility = hasMenuOrServices ? 7 : 3;
    const contactInformation = hasContact ? 8 : 3;
    const bookingFunctionality = hasBooking ? 8 : 2;
    const overallQuality =
      Math.round(
        ((availability +
          mobileResponsiveness +
          loadingPerformance +
          visualDesign +
          navigation +
          menuAccessibility +
          contactInformation +
          bookingFunctionality) /
          8) *
          10
      ) / 10;

    const metrics: WebsiteAuditMetrics = {
      availability,
      mobileResponsiveness,
      loadingPerformance,
      visualDesign,
      navigation,
      menuAccessibility,
      contactInformation,
      bookingFunctionality,
      overallQuality,
    };

    const tier = classifyWebsiteTier(true, metrics);
    const findings: string[] = [
      `HTTP ${response.status} (${elapsedMs}ms response time) · ${isHttps ? 'HTTPS active' : 'Missing HTTPS SSL'}.`,
    ];
    const opportunities: string[] = [];

    if (!hasViewport) {
      findings.push('Missing mobile viewport meta tag; layout likely breaks on mobile screens.');
      opportunities.push('Implement responsive mobile-first layout.');
    }
    if (!hasBooking) {
      findings.push('No online booking, reservation, or appointment CTA detected.');
      opportunities.push('Add instant booking or quote request workflow.');
    }
    if (!hasContact) {
      findings.push('Direct contact links (tel/mailto/WhatsApp) not prominent.');
      opportunities.push('Surface persistent click-to-call and contact capture.');
    }
    if (isTemplateHost) {
      findings.push('Hosted on generic free subdomain rather than custom business domain.');
      opportunities.push('Upgrade to custom domain and cohesive brand system.');
    }
    if (opportunities.length === 0) {
      opportunities.push('Optimize conversion copy and Core Web Vitals for incremental lead lift.');
    }

    return res.json({ tier, metrics, findings, opportunities, liveChecked: true });
  } catch (err) {
    const metrics: WebsiteAuditMetrics = {
      availability: 2,
      mobileResponsiveness: 3,
      loadingPerformance: 2,
      visualDesign: 3,
      navigation: 3,
      menuAccessibility: 3,
      contactInformation: 3,
      bookingFunctionality: 2,
      overallQuality: 2.6,
    };
    return res.json({
      tier: 'C',
      metrics,
      findings: [
        `Could not reach ${normalizedUrl} (${err instanceof Error ? err.message : 'timeout or DNS failure'}).`,
      ],
      opportunities: [
        'Restore reliable HTTPS hosting and deploy a fast, responsive website.',
      ],
      liveChecked: true,
    });
  }
});

// AI Module 1: Outreach Agent (Gemini)
app.post('/api/ai/outreach', async (req, res) => {
  const {
    lead,
    auditFindings,
    settings,
    isFollowUp,
  } = req.body as {
    lead: {
      name: string;
      city: string;
      country: string;
      category: string;
      contactPerson?: string | null;
      website?: string | null;
      websiteTier: string;
    };
    auditFindings?: string[];
    settings: {
      ownerName: string;
      businessName: string;
      portfolioUrl?: string;
      aiPersonality: string;
    };
    isFollowUp?: boolean;
  };

  const portfolioLine = settings.portfolioUrl?.trim()
    ? `You can also review our work at: ${settings.portfolioUrl.trim()}`
    : '';

  const buildOutreachFallback = () => {
    const greeting = lead.contactPerson
      ? `Hi ${lead.contactPerson.split(' ')[0]},`
      : `Hello ${lead.name} team,`;
    const subject = isFollowUp
      ? `Following up: custom website upgrade for ${lead.name}`
      : `Website opportunity for ${lead.name} in ${lead.city || lead.country}`;
    const body = `${greeting}\n\nI am the AI Outreach Assistant working on behalf of ${settings.ownerName} at ${settings.businessName}. ${
      lead.website
        ? `While reviewing ${lead.name}, we noticed a few website conversion opportunities (${(auditFindings || []).slice(0, 2).join(' ') || 'mobile usability and booking flow improvements'}).`
        : `While discovering top local ${lead.category.toLowerCase()} in ${lead.city || lead.country}, we noticed ${lead.name} does not currently have a standalone website linked on Google Maps.`
    }\n\nA tailored, mobile-first website makes it effortless for local customers to explore your offerings and reach or book with you directly.\n${
      portfolioLine ? `\n${portfolioLine}\n` : ''
    }\nWould you be interested in discussing a website project for ${lead.name}?\n\nBest regards,\nAI Assistant for ${settings.ownerName} · ${settings.businessName}\n(Reply "unsubscribe" at any time to opt out of future messages.)`;

    return { subject, body };
  };

  const ai = getGeminiClient();
  if (!ai) {
    return res.json({ ...buildOutreachFallback(), generatedBy: 'deterministic_fallback' });
  }

  try {
    const prompt = `Draft a ${isFollowUp ? 'polite follow-up' : 'first-touch'} B2B outreach email to "${lead.name}" (${lead.category} in ${lead.city}, ${lead.country}).
Contact name: ${lead.contactPerson || 'Business Owner / Manager'}.
Current website: ${lead.website || 'None (Tier A - No Website)'} (Tier ${lead.websiteTier}).
Observed audit points: ${(auditFindings || []).join('; ') || 'Needs stronger mobile UX and direct inquiry capture.'}
Sender: AI assistant working for ${settings.ownerName} at ${settings.businessName}.
Tone: ${settings.aiPersonality}.
Portfolio URL: ${settings.portfolioUrl?.trim() || 'NONE_CONFIGURED'}.

MANDATORY RULES:
1. Introduce yourself transparently as an AI assistant working for ${settings.ownerName} (${settings.businessName}).
2. Identify relevant website improvement opportunities grounded ONLY in the facts above.
3. Explain clear business benefits.
4. ONLY include the Portfolio URL if it is not NONE_CONFIGURED. NEVER invent portfolio links, testimonials, guarantees, or client results.
5. Ask clearly if they are interested in discussing a website project.
6. Include a brief, respectful opt-out / unsubscribe line.`;

    const response = await withTimeout(
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              subject: { type: Type.STRING },
              body: { type: Type.STRING },
            },
            required: ['subject', 'body'],
          },
        },
      }),
      7000
    );

    const parsed = JSON.parse((response.text ?? '{}').trim()) as { subject?: string; body?: string };
    return res.json({
      subject: parsed.subject || `Website opportunity for ${lead.name}`,
      body: parsed.body || '',
      generatedBy: 'gemini-4-hydrogen',
    });
  } catch (error) {
    console.warn('Gemini outreach fallback engaged:', error instanceof Error ? error.message : String(error));
    return res.json({ ...buildOutreachFallback(), generatedBy: 'deterministic_fallback' });
  }
});

// AI Module 2: Sales Conversation & Negotiation Agent (Gemini + Guardrails)
app.post('/api/ai/sales', async (req, res) => {
  const {
    thread,
    incomingMessage,
    settings,
  } = req.body as {
    thread: {
      businessName: string;
      contactPerson?: string | null;
      country: TargetCountry;
      category: string;
      stage: string;
      messages: Array<{ sender: string; content: string }>;
    };
    incomingMessage: string;
    settings: {
      ownerName: string;
      businessName: string;
      portfolioUrl?: string;
      aiPersonality: string;
      maxDiscountPercent: number;
      paymentMilestones: string;
      defaultDeliveryTimeline: string;
      regionalPricing: Array<{
        country: TargetCountry;
        formattedRange: string;
        indicativeMin: number;
        indicativeMax: number;
        minAcceptablePrice: number;
        symbol: string;
        currency: string;
      }>;
      packages: Array<{ name: string; description: string; deliveryTimeline: string; features: string[] }>;
    };
  };

  const readiness = evaluateClientReadiness(incomingMessage, thread.stage as any);
  const pricing = getPricingForCountry(thread.country, settings.regionalPricing as any);

  // Check if customer proposed a specific numeric price/discount
  const numMatch = incomingMessage.replace(/,/g, '').match(/(?:₹|\$|£|cad|aud|aed)?\s*(\d{3,6})/i);
  let requiresOwnerApproval = false;
  let guardrailNote = '';
  if (numMatch) {
    const proposed = Number(numMatch[1]);
    if (proposed > 0) {
      const bounds = evaluateNegotiationBounds({
        country: thread.country,
        proposedPrice: proposed,
        maxDiscountPercent: settings.maxDiscountPercent,
        pricingList: settings.regionalPricing as any,
      });
      if (bounds.requiresOwnerApproval) {
        requiresOwnerApproval = true;
        guardrailNote = bounds.reason;
      }
    }
  }

  if (readiness.isOptOut) {
    return res.json({
      reply: `Understood. Thank you for letting us know—we have marked ${thread.businessName} as opted out and will not send any further outreach messages.`,
      readiness,
      requiresOwnerApproval: false,
      discussedPrice: null,
      expectedTimeline: null,
      requestedFeatures: [],
      generatedBy: 'policy_guardrail',
    });
  }

  const buildSalesFallback = () => {
    let reply = '';
    if (readiness.isReadyForProject) {
      reply = `Wonderful! We are excited to build a custom website for ${thread.businessName}. I am immediately notifying ${settings.ownerName} (${settings.businessName}) with your requirements so he can personally confirm the final agreement, payment milestones (${settings.paymentMilestones}), and project kickoff.`;
    } else if (requiresOwnerApproval) {
      reply = `Thank you for sharing your budget target. ${guardrailNote} I have flagged your request for ${settings.ownerName} to review personally before any discount or formal commitment can be approved.`;
    } else if (readiness.detectedIntent === 'pricing') {
      reply = `For ${thread.country}, our indicative starting range is ${pricing.formattedRange} (not a fixed quotation—final pricing depends on exact scope). Packages include Launch Foundation (${settings.packages[0]?.deliveryTimeline || '7–10 business days'}) and Growth & Booking Engine (${settings.packages[1]?.deliveryTimeline || '12–16 business days'}), with milestones of ${settings.paymentMilestones}. What specific features do you need for ${thread.businessName}?`;
    } else if (readiness.detectedIntent === 'timeline') {
      reply = `Typical delivery is ${settings.defaultDeliveryTimeline}, structured in clear milestones (${settings.paymentMilestones}). Once ${settings.ownerName} confirms your scope, we can share an exact schedule.`;
    } else {
      reply = `We offer custom, mobile-first website design tailored to ${thread.category}, including responsive UI, inquiry/booking flows, SEO structure, and optional ongoing maintenance. ${
        settings.portfolioUrl?.trim() ? `You can review our configured portfolio at ${settings.portfolioUrl.trim()}. ` : ''
      }Would you like an indicative estimate based on your goals?`;
    }

    return {
      reply,
      readiness,
      requiresOwnerApproval,
      discussedPrice: pricing.formattedRange,
      expectedTimeline: settings.defaultDeliveryTimeline,
      requestedFeatures: [],
      generatedBy: 'deterministic_fallback',
    };
  };

  const ai = getGeminiClient();
  if (!ai) {
    return res.json(buildSalesFallback());
  }

  try {
    const historyText = thread.messages
      .slice(-8)
      .map((m) => `${m.sender}: ${m.content}`)
      .join('\n');

    const prompt = `You are the AI Sales & Negotiation Agent for ${settings.businessName} (Founder: ${settings.ownerName}).
Client Business: ${thread.businessName} (${thread.category}, ${thread.country}).
Contact: ${thread.contactPerson || 'Client'}.
Tone: ${settings.aiPersonality}.

CONFIGURED PRICING & GUARDRAILS:
- Indicative starting range for ${thread.country}: ${pricing.formattedRange} (explicitly state this is an indicative starting range, not a fixed quotation).
- Minimum acceptable price floor: ${pricing.symbol}${pricing.minAcceptablePrice} | Max discount allowed without owner: ${settings.maxDiscountPercent}%.
- Guardrail status for latest message: ${requiresOwnerApproval ? `OUTSIDE AUTHORITY: ${guardrailNote}` : 'Within authorized estimate range'}.
- Packages: ${settings.packages.map((p) => `${p.name} (${p.deliveryTimeline}): ${p.features.join(', ')}`).join(' | ')}
- Payment milestones: ${settings.paymentMilestones}
- Portfolio URL: ${settings.portfolioUrl?.trim() || 'NONE_CONFIGURED'}
- Readiness detected: ${readiness.isReadyForProject ? 'CLIENT EXPLICITLY CONFIRMED BUYING INTENT — notify owner for handover!' : 'Still in discovery/negotiation'}

CONVERSATION HISTORY:
${historyText}

LATEST CLIENT MESSAGE:
"${incomingMessage}"

STRICT RULES:
1. Be human-like, crisp, helpful, and professional.
2. NEVER invent testimonials, fake portfolio projects, guarantees, or client results. Only mention Portfolio URL if configured.
3. NEVER accept contracts, out-of-bounds discounts, or payment commitments without ${settings.ownerName}'s approval.
4. Extract any requestedFeatures, clientBudget, discussedPrice, or expectedTimeline mentioned.`;

    const response = await withTimeout(
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: { type: Type.STRING },
              discussedPrice: { type: Type.STRING },
              clientBudget: { type: Type.STRING },
              expectedTimeline: { type: Type.STRING },
              requestedFeatures: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['reply'],
          },
        },
      }),
      7000
    );

    const parsed = JSON.parse((response.text ?? '{}').trim()) as {
      reply?: string;
      discussedPrice?: string;
      clientBudget?: string;
      expectedTimeline?: string;
      requestedFeatures?: string[];
    };

    return res.json({
      reply: parsed.reply || 'Thank you for your message. Let me share our scope and indicative estimate.',
      readiness,
      requiresOwnerApproval,
      discussedPrice: parsed.discussedPrice || null,
      clientBudget: parsed.clientBudget || null,
      expectedTimeline: parsed.expectedTimeline || null,
      requestedFeatures: Array.isArray(parsed.requestedFeatures) ? parsed.requestedFeatures : [],
      generatedBy: 'gemini-4-hydrogen',
    });
  } catch (error) {
    console.warn('Gemini sales fallback engaged:', error instanceof Error ? error.message : String(error));
    return res.json(buildSalesFallback());
  }
});

// Gmail API Send Proxy (uses client-side Bearer access token; no secrets on client/redirect flows)
app.post('/api/gmail/send', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing Gmail OAuth Bearer token.' });
  }

  const { to, subject, body, fromName } = req.body as {
    to: string;
    subject: string;
    body: string;
    fromName?: string;
  };

  if (!to || !subject || !body) {
    return res.status(400).json({ error: 'INVALID_INPUT', message: 'Recipient, subject, and body are required.' });
  }

  const rawLines = [
    `To: ${to}`,
    fromName ? `From: ${fromName} <me>` : '',
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    body,
  ]
    .filter((l, i) => l !== '' || i >= 4)
    .join('\r\n');

  const encodedMessage = Buffer.from(rawLines)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  try {
    const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encodedMessage }),
    });

    const data = await gmailRes.json();
    if (!gmailRes.ok) {
      return res.status(gmailRes.status).json({
        error: 'GMAIL_SEND_FAILED',
        message: (data as any)?.error?.message || 'Gmail API failed to send email.',
      });
    }

    return res.json(data);
  } catch (error) {
    return res.status(500).json({
      error: 'GMAIL_PROXY_ERROR',
      message: error instanceof Error ? error.message : 'Failed to connect to Gmail API',
    });
  }
});

// Gmail API Inbox Reply Monitor Proxy
app.get('/api/gmail/replies', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing Gmail OAuth Bearer token.' });
  }

  try {
    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=in:inbox&maxResults=10',
      { headers: { Authorization: authHeader } }
    );
    const listData = (await listRes.json()) as { messages?: Array<{ id: string; threadId: string }>; error?: { message: string } };
    if (!listRes.ok) {
      return res.status(listRes.status).json({
        error: 'GMAIL_LIST_FAILED',
        message: listData.error?.message || 'Failed to read Gmail inbox.',
      });
    }

    const items = listData.messages || [];
    const details = await Promise.all(
      items.slice(0, 8).map(async (m) => {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: { Authorization: authHeader } }
        );
        const msgJson = (await msgRes.json()) as {
          id: string;
          threadId: string;
          snippet?: string;
          payload?: { headers?: Array<{ name: string; value: string }> };
        };
        const headers = msgJson.payload?.headers || [];
        const getH = (n: string) => headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value || '';
        return {
          id: msgJson.id,
          threadId: msgJson.threadId,
          from: getH('From'),
          subject: getH('Subject'),
          date: getH('Date'),
          snippet: msgJson.snippet || '',
        };
      })
    );

    return res.json({ messages: details });
  } catch (error) {
    return res.status(500).json({
      error: 'GMAIL_REPLIES_ERROR',
      message: error instanceof Error ? error.message : 'Failed to fetch Gmail replies',
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`AK47 Client Hunter AI server running on http://0.0.0.0:${port}`);
  });
}

startServer();
