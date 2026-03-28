

# Integrated Fix: Responsiveness, Billing-CRM Linkage, Secondary User Visibility & Cross-Module Consistency

## Issues Identified

### 1. Slow data/media updates (responsiveness)
- `PatientDetail.tsx` loads everything in one giant `loadPatient()` call with no realtime subscription. After uploading media via `CommunicationHub`, the assets/sections only show when the user re-enters the patient view.
- No realtime subscriptions on `assets`, `invoices`, `plan_sections`, or `communications` in PatientDetail.

### 2. Billing not linked to phase/plan from case request type
- `Billing.tsx` line 276-310: Auto-population from `case_requests.request_items` only works when creating a new invoice AND the patient already has plans with `case_request_id` set. The logic falls through silently if presets don't match by name exactly.
- Client email not auto-populated because `clientDetails.email` is set from `settings_entities` lookup, but the entity match fails if `clinic_name` is empty or doesn't match exactly.

### 3. Secondary user (view-only) visibility missing
- Invoice RBAC in `BillingList.tsx` only checks `user_id` or `canAccessPatient` — doesn't check `secondary_user_ids` stored on the invoice. Secondary users assigned to view billing can't see their invoices.
- `ReceiptsList.tsx` similarly only checks `user_id` on invoices, not secondary assignments.

### 4. CRM "Company First" not fully integrated into billing
- When a project is assigned to a company/clinic/lab, the primary contact from `settings_entities` should auto-fill — partially done but email often empty because the entity lookup in `selectPatient()` uses `clinic_name` from search results which may be null.
- No auto-lookup of company's primary contact user from `user_assignments`.

## Implementation Plan

### Step 1: Add realtime subscriptions to PatientDetail
- Subscribe to `assets`, `communications`, `invoices`, and `plan_sections` tables filtered by `case_id`/`patient_id`
- On INSERT/UPDATE events, merge new records into state without full reload
- Add cleanup on unmount

### Step 2: Fix billing auto-population from case request
- In `Billing.tsx` `selectPatient()`, after fetching phases/plans, also fetch `case_requests` directly by `patient_id` to get `request_items`
- Use `request_items` (jsonb array) to populate line items with qty and rate from the stored snapshot
- Populate `caseRequestId` so the invoice links back
- Fix entity email lookup: query all entity types (clinic, doctor, lab, company) from the patient record and use the first one with a valid email
- Auto-resolve `primaryUserId` by looking up `user_assignments` where `assignment_value` matches the entity name

### Step 3: Secondary user visibility in billing
- `BillingList.tsx`: Add check for `secondary_user_ids` — if the current user's ID is in the invoice's `secondary_user_ids` array, show it (view-only)
- `ReceiptsList.tsx`: Same — check `secondary_user_ids` on linked invoices
- `ExpensesList.tsx`: Check if expense's `patient_id` links to an accessible patient OR if the user appears in related invoice's `secondary_user_ids`
- Mark secondary-user invoices as read-only in `Billing.tsx`

### Step 4: Company-first contact resolution
- Create a shared utility `src/lib/crm-resolve.ts` that:
  - Takes a patient record (with clinic/lab/company/doctor names)
  - Queries `settings_entities` for all matching entities
  - Returns the primary contact info (name, email, address, GST, state)
  - Resolves the primary user by matching `user_assignments` where `assignment_type` matches entity type and `assignment_value` matches entity name
- Use this utility in:
  - `Billing.tsx` `selectPatient()`
  - `case-conversion.ts` when creating draft invoices
  - `PatientDetail.tsx` for display purposes

### Step 5: Ensure invoice shows phase/plan suggestions
- In `Billing.tsx`, when patient is selected, fetch treatment plans and show them as selectable badges that auto-add their associated preset line items
- Show case request type context in the invoice form as informational chips

### Step 6: Mobile responsiveness for invoice line items
- On mobile (`< sm`), render line items as stacked cards instead of grid columns
- Show description, qty, rate, amount; collapse HSN/disc/GST behind an expand toggle

### Step 7: Cross-module verification
- Verify `create-user` edge function deploys without error (code looks correct now)
- Ensure `CommunicationHub` realtime channel properly receives new messages with attachments
- Verify `case-conversion.ts` idempotency (`converted_at` check) prevents duplicate assets

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/lib/crm-resolve.ts` | New — shared CRM contact resolution utility |
| `src/pages/PatientDetail.tsx` | Add realtime subscriptions for assets/invoices/sections |
| `src/pages/Billing.tsx` | Fix auto-population, add secondary user visibility, mobile layout |
| `src/pages/BillingList.tsx` | Add secondary_user_ids check for RBAC |
| `src/pages/ReceiptsList.tsx` | Add secondary_user_ids check for RBAC |
| `src/pages/ExpensesList.tsx` | Add patient/invoice-based RBAC check |
| `src/lib/case-conversion.ts` | Use crm-resolve for invoice creation |
| `src/components/CommunicationHub.tsx` | Verify realtime channel works (minor fix if needed) |

## Database Changes
None required — all needed columns exist (`secondary_user_ids` on invoices, `request_items` on case_requests, etc.)

