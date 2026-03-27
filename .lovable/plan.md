

# Phase 5 — Login Fix, Company-Circle RBAC, and Relational Ecosystem

## Root Cause: Login Failure

The project was just connected to a **new Lovable Cloud database**. There are **zero users** in `auth.users`. The old credentials (`test1@kdx.8shield.net`) don't exist here. Additionally, the `create-user` and `validate-license` edge functions were never deployed — the `supabase/functions/` directory is empty.

**Fix:** Deploy two edge functions (`create-user` and `validate-license`) and add a signup flow to Auth.tsx so the first admin can bootstrap.

---

## Architecture: SuiteDash Company-First & Circle Principles

### Current State
- Users are scoped by flat `user_assignments` (clinic/doctor/lab/patient assignments)
- Task assignment shows ALL profiles regardless of relationship
- No concept of "company containers" or "circles"

### Target State
- **Company Container**: Each non-admin user belongs to an entity (clinic/doctor/lab/company) via `user_assignments`. Users within the same entity container can see and assign to each other.
- **Admin Bridge**: Admins are visible to everyone and can see everything.
- **Scoped Assignment**: When assigning tasks, cases, or invoices, non-admin users only see users within their own company container(s) + admins.

**Implementation approach**: No new tables needed. We use existing `user_assignments` to derive "company peers." A utility function `getCompanyPeers(userId)` queries `user_assignments` to find all users sharing at least one assignment value with the current user.

---

## Phased Implementation Plan

### Phase 5A: Authentication Bootstrap (Critical — Unblocks Everything)

**1. Deploy `create-user` Edge Function**
- Creates users via Supabase Admin API (service role)
- Inserts profile, role, and assignments in one transaction
- Called from `CreateUserDialog.tsx`

**2. Deploy `validate-license` Edge Function**
- Validates a license token (HMAC-based, generated from `/public/license-generator.html`)
- Assigns `admin` role to the authenticated user
- Called from `AdminActivate.tsx`

**3. Add Signup to Auth.tsx**
- Add a "Sign Up" tab/toggle to the login page
- After signup, user gets `user` role by default
- First user can then use "Activate admin license" to become admin

**4. Enable auto-confirm for email signups** (since this is a managed lab environment where admins create users)

### Phase 5B: Company-Circle Scoped Assignment

**5. Create `getCompanyPeers()` utility** (`src/lib/company-scope.ts`)
```
Given userId → fetch their user_assignments →
  get all assignment_values → find all other users
  with overlapping assignment_values → return those user_ids + all admins
```

**6. Update Task Assignment in PatientDetail.tsx**
- Admin: can assign to anyone (current behavior)
- Non-admin: filter `allProfiles` through `getCompanyPeers()` to show only:
  - Users sharing at least one entity assignment (same clinic, same doctor, same lab, same company)
  - All admin users (the "bridge")

**7. Update Case/Project Assignment (Primary/Secondary User dropdowns)**
- Same scoping logic for `primaryUserId` and `secondaryUserId` dropdowns in PatientDetail
- Admin: all profiles
- Non-admin: company peers + admins only

**8. Update Invoice Assignment in Billing.tsx**
- `primary_user_id` and `secondary_user_ids` dropdowns scoped same way

### Phase 5C: Relational Event Automation

**9. Auto-populate invoice from CRM contacts**
- Already partly done in Billing.tsx but needs to work with the new edge functions
- When patient selected: fetch clinic/doctor/lab entity → fill client_details, gst_number, address

**10. Plan status → Invoice trigger**
- When admin marks plan as "approved" in Kanban or PatientDetail, auto-create a draft invoice if one doesn't exist for that phase
- Fetch preset fees linked to the plan's request type

**11. Activity timeline completeness**
- Already fixed in Phase 4 for non-admin
- Ensure audit_log entries are created for key actions (plan status change, invoice creation, task completion)

### Phase 5D: Missing Edge Cases & Polish

**12. CreateUserDialog — also assign `company` and `lab` types**
- Currently only supports `patient`, `clinic`, `doctor`
- Add `lab` and `company` assignment types

**13. InviteUserDialog — uses `signUp` directly (broken without edge function)**
- Refactor to use the `create-user` edge function instead

**14. Kanban: non-admin should NOT see `draft` column**
- Filter out draft plans for non-admin users (plan sovereignty)

**15. BillingList: non-admin should only see their invoices**
- Filter by `primary_user_id` or `secondary_user_ids` containing current user, or patient scoping

---

## Files Modified/Created

| File | Changes |
|------|---------|
| `supabase/functions/create-user/index.ts` | New — Edge function for admin user creation |
| `supabase/functions/validate-license/index.ts` | New — Edge function for license activation |
| `src/pages/Auth.tsx` | Add signup toggle |
| `src/lib/company-scope.ts` | New — `getCompanyPeers()` utility |
| `src/pages/PatientDetail.tsx` | Scoped task/user assignment dropdowns |
| `src/pages/Billing.tsx` | Scoped user assignment, CRM auto-populate fix |
| `src/components/CreateUserDialog.tsx` | Add lab/company assignment types |
| `src/components/InviteUserDialog.tsx` | Use edge function instead of direct signUp |
| `src/pages/GlobalKanban.tsx` | Hide draft column for non-admin |
| `src/pages/BillingList.tsx` | RBAC filtering for non-admin |

## Implementation Order

1. **5A-1 to 5A-4**: Edge functions + Auth signup (unblocks login)
2. **5B-5 to 5B-8**: Company-circle scoped assignment
3. **5C-9 to 5C-11**: Relational event automation
4. **5D-12 to 5D-15**: Polish and edge cases

## Technical Details

### Edge Function: `create-user`
- Uses `SUPABASE_SERVICE_ROLE_KEY` to call `auth.admin.createUser()`
- Inserts into `profiles`, `user_roles`, and `user_assignments`
- Returns the new user's ID

### Edge Function: `validate-license`
- Reads `ADMIN_LICENSE_SECRET` (or derives from service role key)
- Validates HMAC token against user's email
- Upserts `user_roles` with role='admin'

### Company Peers Query
```sql
SELECT DISTINCT ua2.user_id
FROM user_assignments ua1
JOIN user_assignments ua2
  ON ua1.assignment_value = ua2.assignment_value
  AND ua1.assignment_type = ua2.assignment_type
WHERE ua1.user_id = $currentUserId
UNION
SELECT user_id FROM user_roles WHERE role = 'admin'
```

