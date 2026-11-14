import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rulesContent = fs.readFileSync('firestore.rules', 'utf8');

test('firestore.rules contains default-deny catch-all and all 9 collections', () => {
  assert.match(rulesContent, /match \/\{document=\*\*\} \{\s*allow read, write: if false;/);
  const collections = [
    'users',
    'businesses',
    'leads',
    'website_audits',
    'outreach_messages',
    'conversations',
    'projects',
    'settings',
    'activity_logs',
  ];
  for (const col of collections) {
    assert.ok(rulesContent.includes(`match /${col}/`), `Missing rules for ${col}`);
  }
});

test('firestore.rules enforces email verification, ID validation, and owner isolation', () => {
  assert.ok(rulesContent.includes('request.auth.token.email_verified == true'));
  assert.ok(rulesContent.includes('isValidId('));
  assert.ok(rulesContent.includes('existing().ownerId == request.auth.uid'));
  assert.ok(rulesContent.includes("existing().status == 'pending_takeover'"));
  assert.ok(rulesContent.includes("incoming().status == 'taken_over'"));
});
