import type { ReadyProject } from '../types/domain';

export function normalizeWhatsAppDigits(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, '');
  if (!digits) return '';
  // Default 10-digit Indian mobile numbers like "78530 25466" to country code 91
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `91${digits}`;
  }
  return digits;
}

export function formatDisplayPhone(rawPhone: string): string {
  const digits = normalizeWhatsAppDigits(rawPhone);
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return rawPhone.trim();
}

export function buildReadyProjectMessage(
  project: ReadyProject,
  clientPhone?: string | null
): string {
  const phoneDisplay = clientPhone || project.clientPhone || 'Not listed';
  const latestClientQuote = [...project.conversationHistory]
    .reverse()
    .find((m) => m.sender === 'client')?.content;

  return [
    'READY PROJECT! (Client Ready to Pay / Start)',
    `Business Name: ${project.businessName}`,
    `Contact Person: ${project.contactPerson}`,
    `Client Email: ${project.email}`,
    `Client Phone: ${phoneDisplay}`,
    `Country: ${project.country}`,
    `Category: ${project.category}`,
    `Client Budget: ${project.clientBudget}`,
    `Discussed Price: ${project.discussedPrice}`,
    `Expected Timeline: ${project.expectedTimeline}`,
    `Requested Features: ${project.requestedFeatures.join(', ')}`,
    `Requirements: ${project.projectRequirements}`,
    latestClientQuote ? `Latest Client Message: "${latestClientQuote}"` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildWhatsAppHandoverUrl(targetPhone: string, message: string): string {
  const digits = normalizeWhatsAppDigits(targetPhone);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function buildSmsHandoverUrl(targetPhone: string, message: string): string {
  const digits = normalizeWhatsAppDigits(targetPhone);
  const telTarget = digits ? `+${digits}` : targetPhone.trim();
  return `sms:${telTarget}?body=${encodeURIComponent(message)}`;
}
