

# Fix Billing, Assets, CRM Auto-Population, Navigation & Edge Function

## Issues Identified

1. **Asset duplication on conversion**: `case-conversion.ts` line 113-126 always inserts attachments without checking if they already exist as assets for that patient. Converting the same request twice (or if attachments were already copied elsewhere) creates duplicates.

2. **Invoice primary user not auto-populated from assignee selection**: The invoice form shows a raw user dropdown but doesn't auto-populate from the patient's assigned entity (company/clinic/lab/doctor). The `clientDetails` gets CRM entity data but `primaryUserId` only copies from `patients.primary_user_id` which may be null.

3. **create-user edge function error**: `auth.getClaims()` is not a valid Supabase JS v2 method — it should use `auth.getUser()` to verify the caller.

4. **Billing navigation**: Sidebar has a single "Billing" link. User wants expandable sub-navigation: Invoices, Expenses, Receipts.

5. **Expenses not standalone**: Currently expenses are tied to an invoice (`invoice_id`). User wants standalone expenses assignable to a user or invoice.

6. **Receipts not a standalone section**: Receipts are only viewable inside an invoice detail. Need a dedicated receipts list.

7. **CRM auto-population incomplete**: When a project is assigned to a company/lab/clinic, the contact person from `settings_entities` should become the primary contact on the invoice, not require manual email entry.

## Implementation Plan

### Step 1: Fix asset duplication in case-conversion.ts
- Before inserting assets, check if assets with the same `file_url` and `case_id` already exist
- Skip duplicates using a `SELECT` query or `ON CONFLICT` approach
- Add idempotency: mark case_request with a `converted_at` timestamp to prevent double conversion

### Step 2: Fix create-user edge function
- Replace `auth.getClaims()` with `auth.getUser()` to get caller identity
- The caller's user ID comes from `data.user.id` instead of `claims.sub`

### Step 3: Invoice assignee auto-population from CRM
- When a patient is selected in Billing.tsx, look up the patient's `clinic_name`, `lab_name`, `company_name`, `doctor_name`
- Query `settings_entities` for the matching entity and use its `contact_person` + `email` as the primary client contact
- Auto-set `primaryUserId` by finding the user whose `user_assignments` match the entity
- Add a "Primary Contact" dropdown that shows entity contacts (from CRM) instead of requiring manual email
- When entity type is company/lab/clinic, auto-fill from `settings_entities.contact_person`, `email`, `address`

### Step 4: Expand billing navigation in Sidebar
- Replace single "Billing" link with expandable section containing:
  - Invoices (`/billing`)
  - Expenses (`/billing/expenses`)  
  - Receipts (`/billing/receipts`)

### Step 5: Standalone expenses page
- Create `/billing/expenses` route and `ExpensesList.tsx` page
- List all expenses (admin sees all, non-admin sees own)
- Allow creating expenses without an invoice (optional `invoice_id`)
- Add `user_id` column to expenses table if not present for assignment
- Admin can assign expense to any user; non-admin creates own

### Step 6: Standalone receipts page
- Create `/billing/receipts` route and `ReceiptsList.tsx` page
- List all receipts across all invoices
- Show linked invoice number, patient, amount, date, method
- RBAC: admin sees all, non-admin sees receipts from their invoices

### Step 7: Invoice mobile responsiveness
- Line items grid: switch from 12-col grid to stacked card layout on mobile
- Show description, qty, rate, amount on mobile; hide HSN, disc%, GST% behind expandable
- Ensure all form fields are touch-friendly with adequate height

## Database Changes

**Migration:**
```sql
-- Add user_id to expenses for standalone expense assignment
-- (expenses table already has no user_id column per schema)
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS patient_id uuid;

-- Add converted_at to case_requests to prevent double conversion
ALTER TABLE public.case_requests ADD COLUMN IF NOT EXISTS converted_at timestamptz;
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/lib/case-conversion.ts` | Fix asset duplication, add converted_at check |
| `supabase/functions/create-user/index.ts` | Fix auth.getClaims → auth.getUser |
| `src/pages/Billing.tsx` | CRM auto-population for assignee, mobile layout |
| `src/components/Sidebar.tsx` | Expand billing to sub-sections |
| `src/pages/ExpensesList.tsx` | New standalone expenses page |
| `src/pages/ReceiptsList.tsx` | New standalone receipts page |
| `src/App.tsx` | Add routes for expenses/receipts |
| Migration | Add user_id/patient_id to expenses, converted_at to case_requests |

