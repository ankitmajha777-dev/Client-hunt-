import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { auth, db } from './firebase';
import type {
  ActivityLog,
  AgencySettings,
  ConversationThread,
  LeadRecord,
  OutreachMessage,
  ReadyProject,
  WebsiteAudit,
} from '../types/domain';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 120);
  return cleaned || `id_${Date.now()}`;
}

function clampStr(val: string | null | undefined, max: number): string {
  if (!val) return '';
  return val.slice(0, max);
}

export async function ensureUserProfile(user: User): Promise<void> {
  const uid = sanitizeId(user.uid);
  const ref = doc(db, 'users', uid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid,
        displayName: clampStr(user.displayName || user.email || 'Workspace User', 120),
        email: clampStr(user.email || '', 200),
        role: 'member',
        photoURL: user.photoURL ? clampStr(user.photoURL, 600) : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        displayName: clampStr(user.displayName || user.email || 'Workspace User', 120),
        email: clampStr(user.email || '', 200),
        photoURL: user.photoURL ? clampStr(user.photoURL, 600) : null,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
  }
}

export async function loadLiveWorkspace(uid: string): Promise<{
  leads: LeadRecord[];
  audits: WebsiteAudit[];
  outreachMessages: OutreachMessage[];
  conversations: ConversationThread[];
  readyProjects: ReadyProject[];
  activityLogs: ActivityLog[];
  settings: AgencySettings | null;
}> {
  const fetchOwned = async <T>(colName: string): Promise<T[]> => {
    try {
      const q = query(collection(db, colName), where('ownerId', '==', uid));
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as T);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, colName);
    }
  };

  const [leads, audits, outreachMessages, conversations, readyProjects, activityLogs] =
    await Promise.all([
      fetchOwned<LeadRecord>('leads'),
      fetchOwned<WebsiteAudit>('website_audits'),
      fetchOwned<OutreachMessage>('outreach_messages'),
      fetchOwned<ConversationThread>('conversations'),
      fetchOwned<ReadyProject>('projects'),
      fetchOwned<ActivityLog>('activity_logs'),
    ]);

  let settings: AgencySettings | null = null;
  try {
    const settingsSnap = await getDoc(doc(db, 'settings', uid));
    if (settingsSnap.exists()) {
      settings = settingsSnap.data() as AgencySettings;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `settings/${uid}`);
  }

  return {
    leads,
    audits,
    outreachMessages,
    conversations,
    readyProjects,
    activityLogs,
    settings,
  };
}

export async function saveLeadToFirestore(uid: string, lead: LeadRecord): Promise<void> {
  const id = sanitizeId(lead.id);
  const path = `leads/${id}`;
  try {
    await setDoc(doc(db, 'businesses', id), {
      id,
      ownerId: uid,
      placeId: clampStr(lead.placeId, 200),
      name: clampStr(lead.name, 200),
      address: clampStr(lead.address, 400),
      city: clampStr(lead.city, 120),
      country: clampStr(lead.country, 80),
      category: clampStr(lead.category, 120),
      phone: lead.phone ? clampStr(lead.phone, 60) : null,
      email: lead.email ? clampStr(lead.email, 200) : null,
      website: lead.website ? clampStr(lead.website, 500) : null,
      googleMapsUri: clampStr(lead.googleMapsUri, 500),
      rating: lead.rating,
      reviewCount: lead.reviewCount,
      businessStatus: lead.businessStatus,
      location: lead.location,
      isDemo: lead.isDemo,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await setDoc(doc(db, 'leads', id), {
      id,
      ownerId: uid,
      placeId: clampStr(lead.placeId, 200),
      name: clampStr(lead.name, 200),
      address: clampStr(lead.address, 400),
      city: clampStr(lead.city, 120),
      country: clampStr(lead.country, 80),
      category: clampStr(lead.category, 120),
      phone: lead.phone ? clampStr(lead.phone, 60) : null,
      email: lead.email ? clampStr(lead.email, 200) : null,
      contactPerson: lead.contactPerson ? clampStr(lead.contactPerson, 120) : null,
      website: lead.website ? clampStr(lead.website, 500) : null,
      googleMapsUri: clampStr(lead.googleMapsUri, 500),
      rating: lead.rating,
      reviewCount: lead.reviewCount,
      businessStatus: lead.businessStatus,
      location: lead.location,
      websiteTier: lead.websiteTier,
      score: {
        ...lead.score,
        reasons: lead.score.reasons.slice(0, 15).map((r) => clampStr(r, 300)),
      },
      stage: lead.stage,
      verified: lead.verified,
      optedOut: lead.optedOut,
      isDemo: lead.isDemo,
      discoveredAt: clampStr(lead.discoveredAt, 64),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateLeadFieldsInFirestore(
  leadId: string,
  fields: Partial<Pick<LeadRecord, 'stage' | 'verified' | 'websiteTier' | 'score' | 'email' | 'phone' | 'contactPerson' | 'optedOut'>>
): Promise<void> {
  const id = sanitizeId(leadId);
  const path = `leads/${id}`;
  try {
    await updateDoc(doc(db, 'leads', id), {
      ...fields,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteLeadInFirestore(leadId: string): Promise<void> {
  const id = sanitizeId(leadId);
  try {
    await deleteDoc(doc(db, 'leads', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `leads/${id}`);
  }
}

export async function saveAuditToFirestore(uid: string, audit: WebsiteAudit): Promise<void> {
  const id = sanitizeId(audit.id);
  const businessId = sanitizeId(audit.businessId);
  const path = `website_audits/${id}`;
  try {
    await setDoc(doc(db, 'website_audits', id), {
      id,
      ownerId: uid,
      businessId,
      websiteUrl: audit.websiteUrl ? clampStr(audit.websiteUrl, 500) : null,
      tier: audit.tier,
      metrics: audit.metrics,
      findings: audit.findings.slice(0, 20).map((f) => clampStr(f, 300)),
      opportunities: audit.opportunities.slice(0, 20).map((o) => clampStr(o, 300)),
      auditedAt: clampStr(audit.auditedAt, 64),
      isDemo: audit.isDemo,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function saveOutreachToFirestore(uid: string, msg: OutreachMessage): Promise<void> {
  const id = sanitizeId(msg.id);
  const leadId = sanitizeId(msg.leadId);
  const path = `outreach_messages/${id}`;
  try {
    await setDoc(doc(db, 'outreach_messages', id), {
      id,
      ownerId: uid,
      leadId,
      businessName: clampStr(msg.businessName, 200),
      recipientEmail: msg.recipientEmail ? clampStr(msg.recipientEmail, 200) : null,
      subject: clampStr(msg.subject, 300),
      body: clampStr(msg.body, 10000),
      status: msg.status,
      channel: msg.channel,
      followUpCount: msg.followUpCount,
      sentAt: msg.sentAt ? clampStr(msg.sentAt, 64) : null,
      gmailMessageId: msg.gmailMessageId ? clampStr(msg.gmailMessageId, 200) : null,
      gmailThreadId: msg.gmailThreadId ? clampStr(msg.gmailThreadId, 200) : null,
      isDemo: msg.isDemo,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function saveConversationToFirestore(
  uid: string,
  conv: ConversationThread,
  isNew: boolean
): Promise<void> {
  const id = sanitizeId(conv.id);
  const leadId = sanitizeId(conv.leadId);
  const path = `conversations/${id}`;
  try {
    if (isNew) {
      await setDoc(doc(db, 'conversations', id), {
        id,
        ownerId: uid,
        leadId,
        businessName: clampStr(conv.businessName, 200),
        contactPerson: conv.contactPerson ? clampStr(conv.contactPerson, 120) : null,
        email: conv.email ? clampStr(conv.email, 200) : null,
        country: clampStr(conv.country, 80),
        category: clampStr(conv.category, 120),
        stage: conv.stage,
        discussedPrice: conv.discussedPrice ? clampStr(conv.discussedPrice, 100) : null,
        clientBudget: conv.clientBudget ? clampStr(conv.clientBudget, 100) : null,
        expectedTimeline: conv.expectedTimeline ? clampStr(conv.expectedTimeline, 100) : null,
        requestedFeatures: conv.requestedFeatures.slice(0, 30),
        readinessConfidence: conv.readinessConfidence,
        readinessTriggerPhrase: conv.readinessTriggerPhrase
          ? clampStr(conv.readinessTriggerPhrase, 300)
          : null,
        messages: conv.messages.slice(-100),
        isDemo: conv.isDemo,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'conversations', id), {
        stage: conv.stage,
        discussedPrice: conv.discussedPrice ? clampStr(conv.discussedPrice, 100) : null,
        clientBudget: conv.clientBudget ? clampStr(conv.clientBudget, 100) : null,
        expectedTimeline: conv.expectedTimeline ? clampStr(conv.expectedTimeline, 100) : null,
        requestedFeatures: conv.requestedFeatures.slice(0, 30),
        readinessConfidence: conv.readinessConfidence,
        readinessTriggerPhrase: conv.readinessTriggerPhrase
          ? clampStr(conv.readinessTriggerPhrase, 300)
          : null,
        messages: conv.messages.slice(-100),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function saveReadyProjectToFirestore(uid: string, proj: ReadyProject): Promise<void> {
  const id = sanitizeId(proj.id);
  const leadId = sanitizeId(proj.leadId);
  const conversationId = sanitizeId(proj.conversationId);
  const path = `projects/${id}`;
  try {
    await setDoc(doc(db, 'projects', id), {
      id,
      ownerId: uid,
      leadId,
      conversationId,
      businessName: clampStr(proj.businessName, 200),
      contactPerson: clampStr(proj.contactPerson, 120),
      email: clampStr(proj.email, 200),
      clientPhone: proj.clientPhone ? clampStr(proj.clientPhone, 60) : null,
      country: clampStr(proj.country, 80),
      category: clampStr(proj.category, 120),
      projectRequirements: clampStr(proj.projectRequirements, 5000),
      requestedFeatures: proj.requestedFeatures.slice(0, 30),
      clientBudget: clampStr(proj.clientBudget, 100),
      discussedPrice: clampStr(proj.discussedPrice, 100),
      expectedTimeline: clampStr(proj.expectedTimeline, 100),
      conversationHistory: proj.conversationHistory.slice(-100),
      status: proj.status,
      takenOverBy: proj.takenOverBy ? clampStr(proj.takenOverBy, 120) : null,
      takenOverAt: proj.takenOverAt ? clampStr(proj.takenOverAt, 64) : null,
      isDemo: proj.isDemo,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function takeOverProjectInFirestore(
  projectId: string,
  takenOverBy: string,
  takenOverAt: string
): Promise<void> {
  const id = sanitizeId(projectId);
  const path = `projects/${id}`;
  try {
    await updateDoc(doc(db, 'projects', id), {
      status: 'taken_over',
      takenOverBy: clampStr(takenOverBy, 120),
      takenOverAt: clampStr(takenOverAt, 64),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveSettingsToFirestore(
  uid: string,
  settings: AgencySettings
): Promise<void> {
  const path = `settings/${uid}`;
  try {
    const ref = doc(db, 'settings', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        ...settings,
        ownerId: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        ownerName: clampStr(settings.ownerName, 120),
        businessName: clampStr(settings.businessName, 120),
        contactEmail: clampStr(settings.contactEmail, 200),
        portfolioUrl: clampStr(settings.portfolioUrl, 500),
        targetCountries: settings.targetCountries.slice(0, 10),
        targetCategories: settings.targetCategories.slice(0, 30),
        aiPersonality: settings.aiPersonality,
        maxDiscountPercent: settings.maxDiscountPercent,
        paymentMilestones: clampStr(settings.paymentMilestones, 300),
        defaultDeliveryTimeline: clampStr(settings.defaultDeliveryTimeline, 200),
        regionalPricing: settings.regionalPricing.slice(0, 10),
        packages: settings.packages.slice(0, 10),
        automation: settings.automation,
        notifications: settings.notifications,
        optOutEmails: settings.optOutEmails.slice(0, 500),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function appendActivityLogToFirestore(uid: string, log: ActivityLog): Promise<void> {
  const id = sanitizeId(log.id);
  const path = `activity_logs/${id}`;
  try {
    await setDoc(doc(db, 'activity_logs', id), {
      id,
      ownerId: uid,
      type: log.type,
      title: clampStr(log.title, 300),
      detail: clampStr(log.detail, 2000),
      timestamp: clampStr(log.timestamp, 64),
      isDemo: log.isDemo,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}
