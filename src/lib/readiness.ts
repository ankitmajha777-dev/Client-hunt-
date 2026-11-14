import type { ChatMessage, ConversationStage } from '../types/domain';

export interface ReadinessEvaluation {
  isReadyForProject: boolean;
  isOptOut: boolean;
  detectedIntent: ChatMessage['detectedIntent'];
  matchedPhrase: string | null;
  confidence: number;
  suggestedStage: ConversationStage;
}

const BUYING_INTENT_PHRASES = [
  'i want to start',
  "let's build the website",
  'lets build the website',
  'send me the payment details',
  'i am ready to hire you',
  "i'm ready to hire you",
  "let's proceed",
  'lets proceed',
  'can we start this week',
  'ready to proceed',
  'ready to start the project',
  'send the invoice',
  'where do i pay the deposit',
];

const OPT_OUT_PHRASES = [
  'unsubscribe',
  'opt out',
  'opt-out',
  'stop emailing',
  'do not contact',
  "don't contact",
  'remove me from your list',
  'not interested',
  'no longer interested',
];

const NEGOTIATION_PHRASES = [
  'how much',
  'cost',
  'price',
  'pricing',
  'budget',
  'discount',
  'cheaper',
  'quote',
  'estimate',
  'payment',
  'milestone',
];

const REQUIREMENTS_PHRASES = [
  'features',
  'how long',
  'timeline',
  'previous work',
  'portfolio',
  'maintenance',
  'customize',
  'design',
  'booking',
  'menu',
  'seo',
  'mobile',
];

export function evaluateClientReadiness(
  messageText: string,
  currentStage: ConversationStage
): ReadinessEvaluation {
  const normalized = messageText.trim().toLowerCase();

  for (const phrase of OPT_OUT_PHRASES) {
    if (normalized.includes(phrase)) {
      return {
        isReadyForProject: false,
        isOptOut: true,
        detectedIntent: 'opt_out',
        matchedPhrase: phrase,
        confidence: 95,
        suggestedStage: 'Not Interested',
      };
    }
  }

  for (const phrase of BUYING_INTENT_PHRASES) {
    if (normalized.includes(phrase)) {
      return {
        isReadyForProject: true,
        isOptOut: false,
        detectedIntent: 'buying_intent',
        matchedPhrase: phrase,
        confidence: 96,
        suggestedStage: 'Ready for Project',
      };
    }
  }

  if (NEGOTIATION_PHRASES.some((p) => normalized.includes(p))) {
    return {
      isReadyForProject: false,
      isOptOut: false,
      detectedIntent: 'pricing',
      matchedPhrase: null,
      confidence: 78,
      suggestedStage:
        currentStage === 'Ready for Project' ? 'Ready for Project' : 'Negotiation',
    };
  }

  if (REQUIREMENTS_PHRASES.some((p) => normalized.includes(p))) {
    const intent: ChatMessage['detectedIntent'] = normalized.includes('timeline') || normalized.includes('how long')
      ? 'timeline'
      : normalized.includes('previous work') || normalized.includes('portfolio')
        ? 'portfolio'
        : 'features';

    return {
      isReadyForProject: false,
      isOptOut: false,
      detectedIntent: intent,
      matchedPhrase: null,
      confidence: 65,
      suggestedStage:
        currentStage === 'Ready for Project' || currentStage === 'Negotiation'
          ? currentStage
          : 'Requirements Discussion',
    };
  }

  return {
    isReadyForProject: false,
    isOptOut: false,
    detectedIntent: 'general',
    matchedPhrase: null,
    confidence: currentStage === 'Interested' ? 45 : 30,
    suggestedStage:
      currentStage === 'New Lead' || currentStage === 'Contacted'
        ? 'Interested'
        : currentStage,
  };
}
