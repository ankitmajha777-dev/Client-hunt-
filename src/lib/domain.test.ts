import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLeadScore, classifyScore, classifyWebsiteTier } from './scoring';
import { evaluateClientReadiness } from './readiness';
import { evaluateNegotiationBounds, getPricingForCountry } from './pricing';
import { buildDemoDataset } from './demoData';
import { computeOverviewStats } from './metrics';
import {
  buildReadyProjectMessage,
  buildSmsHandoverUrl,
  buildWhatsAppHandoverUrl,
  normalizeWhatsAppDigits,
} from './handover';

test('Lead scoring produces 0-100 breakdown with explicit reasons and classifications', () => {
  const premium = calculateLeadScore({
    businessStatus: 'OPERATIONAL',
    website: null,
    websiteTier: 'A',
    rating: 4.8,
    reviewCount: 250,
    phone: '+1 512 555 0100',
    email: 'owner@bistro.example',
    address: '100 Congress Ave, Austin TX',
    category: 'Luxury Restaurants',
  });

  assert.equal(premium.classification, 'Premium Lead');
  assert.ok(premium.total >= 90 && premium.total <= 100);
  assert.equal(premium.websiteOpportunity, 25);
  assert.ok(premium.reasons.some((r) => r.includes('not assumed budget') || r.includes('rather than budget proof')));

  const reject = calculateLeadScore({
    businessStatus: 'CLOSED_TEMPORARILY',
    website: 'https://modern-site.example',
    websiteTier: 'E',
    auditMetrics: {
      availability: 10,
      mobileResponsiveness: 9,
      loadingPerformance: 9,
      visualDesign: 9,
      navigation: 9,
      menuAccessibility: 9,
      contactInformation: 9,
      bookingFunctionality: 9,
      overallQuality: 9,
    },
    rating: 3.1,
    reviewCount: 4,
    phone: null,
    email: null,
    address: '',
    category: 'Retail Businesses',
  });

  assert.equal(reject.classification, 'Reject');
  assert.ok(reject.total < 60);
  assert.equal(classifyScore(89), 'High Quality');
  assert.equal(classifyScore(74), 'Medium');
});

test('Website tier classifies no-website as A and weak websites as B/C', () => {
  assert.equal(classifyWebsiteTier(false), 'A');
  assert.equal(
    classifyWebsiteTier(true, {
      availability: 9,
      mobileResponsiveness: 9,
      loadingPerformance: 9,
      visualDesign: 9,
      navigation: 9,
      menuAccessibility: 9,
      contactInformation: 9,
      bookingFunctionality: 9,
      overallQuality: 9,
    }),
    'E'
  );
});

test('Client readiness detection only marks Ready for Project on explicit buying intent', () => {
  const pricingQ = evaluateClientReadiness('How much does a website cost?', 'Interested');
  assert.equal(pricingQ.isReadyForProject, false);
  assert.equal(pricingQ.suggestedStage, 'Negotiation');

  const ready1 = evaluateClientReadiness("Let's build the website — can we start this week?", 'Negotiation');
  assert.equal(ready1.isReadyForProject, true);
  assert.equal(ready1.suggestedStage, 'Ready for Project');

  const ready2 = evaluateClientReadiness('I am ready to hire you. Send me the payment details.', 'Requirements Discussion');
  assert.equal(ready2.isReadyForProject, true);
  assert.equal(ready2.suggestedStage, 'Ready for Project');

  const optOut = evaluateClientReadiness('Please unsubscribe and remove me from your list', 'Contacted');
  assert.equal(optOut.isOptOut, true);
  assert.equal(optOut.isReadyForProject, false);
  assert.equal(optOut.suggestedStage, 'Not Interested');
});

test('Negotiation bounds enforce owner approval for discounts beyond configured limits', () => {
  const indiaPricing = getPricingForCountry('India');
  assert.equal(indiaPricing.formattedRange, '₹10,000–₹30,000');

  const allowed = evaluateNegotiationBounds({
    country: 'United States',
    proposedPrice: 1500,
    maxDiscountPercent: 15,
  });
  assert.equal(allowed.withinAuthority, true);
  assert.equal(allowed.requiresOwnerApproval, false);

  const blocked = evaluateNegotiationBounds({
    country: 'United States',
    proposedPrice: 600,
    maxDiscountPercent: 15,
  });
  assert.equal(blocked.withinAuthority, false);
  assert.equal(blocked.requiresOwnerApproval, true);
});

test('Demo dataset contains 30 clearly tagged businesses and live stats match counts', () => {
  const demo = buildDemoDataset();
  assert.equal(demo.leads.length, 30);
  assert.ok(demo.leads.every((l) => l.isDemo === true));
  assert.equal(demo.readyProjects.length, 2);

  const stats = computeOverviewStats({
    leads: demo.leads,
    outreachMessages: demo.outreachMessages,
    conversations: demo.conversations,
    readyProjects: demo.readyProjects,
  });

  assert.equal(stats.totalDiscovered, 30);
  assert.equal(stats.readyProjectsCount, 2);
  assert.equal(stats.emailsSent, 6);
  assert.ok(stats.estimatedPipelineUsd > 0);
});

test('Handover formatter normalizes 78530 25466 and includes full client details', () => {
  assert.equal(normalizeWhatsAppDigits('78530 25466'), '917853025466');
  const demo = buildDemoDataset();
  const proj = demo.readyProjects[0];
  const msg = buildReadyProjectMessage(proj, '+1 512-555-0148');

  assert.ok(msg.includes('READY PROJECT!'));
  assert.ok(msg.includes(proj.businessName));
  assert.ok(msg.includes(proj.contactPerson));
  assert.ok(msg.includes(proj.email));
  assert.ok(msg.includes('+1 512-555-0148'));
  assert.ok(msg.includes(proj.discussedPrice));

  const waUrl = buildWhatsAppHandoverUrl('78530 25466', msg);
  assert.ok(waUrl.startsWith('https://wa.me/917853025466?text='));
  const smsUrl = buildSmsHandoverUrl('78530 25466', msg);
  assert.ok(smsUrl.startsWith('sms:+917853025466?body='));
});

