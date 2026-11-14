# Security Specification — AK47 Client Hunter AI

## 1. Data Invariants
1. **Strict Ownership Isolation**: Every document in `businesses`, `leads`, `website_audits`, `outreach_messages`, `conversations`, `projects`, `settings`, and `activity_logs` MUST belong to a single verified owner (`ownerId == request.auth.uid`). No cross-user reads or list queries are allowed.
2. **PII Isolation**: `users/{userId}` contains email and profile data and is readable/writable ONLY by the matching verified `userId`.
3. **Immutable Ownership & Creation Timestamps**: `ownerId` and `createdAt` can never be changed after creation. `createdAt == request.time` on create; `updatedAt == request.time` on update.
4. **Prevent Self-Assigned Roles**: On `users/{userId}` creation, `role` MUST be `'member'` (or `'owner'` only if email matches verified owner, never self-escalated to `'admin'`), and `role` cannot be updated by the user.
5. **Terminal State Locking**: Once a `projects/{projectId}` document reaches `status == 'taken_over'`, subsequent client updates are locked unless performed by an admin.
6. **Relational Integrity**: Creating a `website_audits` or `projects` document validates parent existence (`exists(/databases/.../leads/$(incoming().leadId))` / `businesses/$(incoming().businessId)`).
7. **ID & Size Hardening**: Every document ID matches `^[a-zA-Z0-9_\-]+$` (`<= 128` chars), and every string/array field enforces strict `.size()` bounds.

## 2. The "Dirty Dozen" Attack Payloads
1. **Unauthenticated Read/Write**: Read `leads` with `request.auth == null` -> `PERMISSION_DENIED`.
2. **Unverified Email Spoof**: Write `leads` with `request.auth.token.email_verified == false` -> `PERMISSION_DENIED`.
3. **Cross-Tenant List Query**: Query `leads` without `where('ownerId', '==', uid)` -> `PERMISSION_DENIED`.
4. **Identity Spoofing on Create**: Create `leads` with `ownerId: 'other-uid'` -> `PERMISSION_DENIED`.
5. **Shadow Ghost Field Injection**: Create `leads` with extra `isAdmin: true` field -> `PERMISSION_DENIED`.
6. **ID Poisoning**: Create `leads/../../admin` or 200-char doc ID -> `PERMISSION_DENIED`.
7. **Timestamp Forgery**: Create `leads` with backdated `createdAt` (`!= request.time`) -> `PERMISSION_DENIED`.
8. **Immutable Field Mutation**: Update `leads` attempting to change `ownerId` or `createdAt` -> `PERMISSION_DENIED`.
9. **Value Poisoning**: Update `leads` `stage` to `"HackedStage"` or `name` to a 50KB string -> `PERMISSION_DENIED`.
10. **Terminal State Bypass**: Update `projects/{id}` when `existing().status == 'taken_over'` -> `PERMISSION_DENIED`.
11. **PII Leak**: User A calls `get(/users/userB)` -> `PERMISSION_DENIED`.
12. **Privilege Escalation**: User updates `users/{uid}` `role` to `'admin'` -> `PERMISSION_DENIED`.
