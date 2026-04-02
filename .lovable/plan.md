

# Company-First Entity Model: Billing, Assignment & Access Refactoring

## Current Architecture vs. What's Needed

**Current state**: `user_assignments` maps users to entity *names* (strings like "TEZ", "Pan Dental"). There is no concept of a "primary user" within an entity. The CRM resolver (`crm-resolve.ts`) picks the *first* user assignment matching an entity name — not a designated primary contact. Billing dropdown searches by *project name*, not by Company/Entity.

**What's needed**: A "Company-First" model where:
- Entities (Company/Clinic/Lab) are the primary data owners
- Each entity can have a designated "Primary" user
- Selecting an entity in billing auto-tags its primary user
- All users linked to an entity get visibility of data tagged to that entity
- Admin can search by Company OR Individual when creating invoices

## Implementation Strategy (Minimal Architecture Change)

Rather than overhauling, we extend the existing `user_assignments` table with a single new column: `is_primary`. This preserves the current many-to-many mapping while adding the "Company-First" primary user concept.

### Database Change

**Migration**: Add `is_primary` boolean column to `user_assignments`:
```sql
ALTER TABLE public.user_assignments
  ADD COLUMN is_primary boolean NOT NULL DEFAULT false;
```

No new tables needed. The existing `settings_entities` + `user_assignments` already model the many-to-many relationship between users and entities.

### Step 1: Update `crm-resolve.ts` — Primary User Resolution

Currently line 88-96 picks the first `user_assignments` row matching the entity. Change to:
- Query with `ORDER BY is_primary DESC, created_at ASC`
- This ensures the primary user is returned first
- Also return `primaryUserEmail` by joining profiles

### Step 2: Update Billing — "Smart" Entity Dropdown

Replace the current project-name-only search with a **dual search** that allows searching by:
- Entity name (Company / Clinic / Lab / Doctor)
- Individual user (from profiles)

When admin selects:
1. **An Entity**: Auto-populate client details from `settings_entities`, auto-tag the `is_primary=true` user from `user_assignments`, populate email from their profile
2. **An Individual user**: Populate from their profile, set them as primary user

Add a new "Bill To" section before the project search:
```
[Bill To: Entity ▼]  →  dropdown showing all settings_entities + individual profiles
```

### Step 3: Update Billing — Shared Visibility ("Circle")

When an invoice is saved with a Company/Clinic/Lab entity as the client:
- Set `primary_user_id` to the entity's primary user
- Auto-populate `secondary_user_ids` with ALL other users assigned to that same entity

This is already partially working via the `canAccessPatient` check, but the invoice viewing in `BillingList.tsx` and `ReceiptsList.tsx` needs to also check if the current user shares an entity assignment with the invoice's entity.

### Step 4: Update Team Management — Mark Primary Users

In `TeamManagement.tsx`, add a star/toggle on each assignment badge to mark a user as `is_primary` for that entity. Only one user per entity should be primary.

### Step 5: Update Case Submission — Collaborator Field

Add a "Collaborators / Secondary Users" multi-select in the case submission form (similar to the billing one). When a case is linked to an entity, all users in that entity circle automatically get view access.

### Step 6: Update `company-scope.ts` — Use Primary Flag

`getCompanyPeers` already finds users sharing assignment values. No structural change needed, but it should now also expose which peer is primary for a given entity.

## Files to Modify

| File | Changes |
|------|---------|
| **Migration** | Add `is_primary` boolean to `user_assignments` |
| `src/lib/crm-resolve.ts` | Query `is_primary DESC` for primary user resolution; return primary user email |
| `src/pages/Billing.tsx` | Add "Bill To" entity/individual dropdown; auto-tag primary + secondary users from entity circle |
| `src/pages/BillingList.tsx` | Filter invoices by entity-circle membership (not just primary/secondary IDs) |
| `src/pages/TeamManagement.tsx` | Add primary user toggle on assignment badges |
| `src/pages/CaseSubmission.tsx` | Add collaborator/secondary user multi-select field |
| `src/components/CreateUserDialog.tsx` | Add `is_primary` checkbox when adding assignments |
| `src/lib/company-scope.ts` | Minor: expose primary user per entity |
| `src/hooks/useUserScope.tsx` | No structural change needed |

## Key Behaviours After Implementation

1. **Creating a Bill**: Admin types "TEZ" in Bill To → dropdown shows "TEZ (Clinic)" → selects it → primary user KD auto-tagged, email `kd@kdx.8shield.net` auto-filled, all other TEZ-assigned users added as secondary viewers
2. **Creating a Case**: User with clinic=TEZ assignment sees TEZ pre-filled, can add collaborators from their circle
3. **Viewing Bills**: Any user assigned to TEZ sees all invoices where client entity = TEZ
4. **Team Management**: Admin marks KD as primary for TEZ clinic → star icon on badge

## What Is NOT Changing
- Database table structure (no new tables)
- RLS policies (already permissive for authenticated)
- Route structure
- Existing RBAC hook architecture

