

# Revised Fix Plan: Billing RBAC, Email Integration, Patient Dropdown & Terminology

## Corrections Applied from User Feedback

1. **Only admin can create invoices** — keep `requireAdmin` on `billing/new` route and the `!isAdmin && isNew` check in `saveInvoice`. No change needed here (already correct).
2. **Invoice/receipt/expense viewing** — based on assignment (primary user gets details populated, secondary users can view). Already partially implemented in `BillingList.tsx` and `ReceiptsList.tsx`. Need to verify `ExpensesList.tsx` also checks this.
3. **Email integration** — user explicitly said NO to email integration. Skip entirely.
4. **Case request for new OR existing project** — already supported via patient search. The dropdown UX needs the loading-state fix.
5. **Cross-module RBAC** — users should only access data assigned to them across ALL modules.

## What Needs to Change

### 1. CaseSubmission Patient Dropdown — Loading State Fix
- Add `searching` boolean state so dropdown doesn't flash "No projects found" during debounce
- When focused with empty search, show "Loading..." until results arrive
- After results arrive empty, show "No projects found"

### 2. Dashboard Terminology Cleanup
- Replace remaining "Case" labels with "Project" in UI-visible strings
- "All Cases" → "All Projects", "Case archived" → "Project archived", etc.
- Rename "Due This Week" KPI to "Active Cases" (it counts active requests, not due items)

### 3. CaseSubmission useEffect Dependency Fix
- Remove `presets` from the main `useEffect` dependency array to prevent double-fetching on mount

### 4. Auth — Forgot Password Link
- Add "Forgot Password?" button to `Auth.tsx` calling `supabase.auth.resetPasswordForEmail()`

### 5. ExpensesList RBAC Verification
- Verify non-admin filtering includes checking `primary_user_id` / `secondary_user_ids` from linked invoices, not just `user_id` on the expense itself. If an expense is linked to an invoice, the primary/secondary users of that invoice should see it.

### 6. Billing.tsx — Non-Admin View-Only for Non-Draft
- When a non-admin opens an existing invoice (via `billing/:invoiceId`), they should be able to VIEW it if they are primary or secondary user, but NOT edit unless it's draft and they are the primary user
- The route `billing/:invoiceId` is NOT wrapped in `requireAdmin` (correct), so non-admins can view
- Add a clear "View Only" indicator for non-admin secondary users

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/CaseSubmission.tsx` | Add `searching` state for dropdown; remove `presets` from useEffect deps |
| `src/pages/Dashboard.tsx` | Terminology: Case → Project in UI labels; rename "Due This Week" to "Active Cases" |
| `src/pages/Auth.tsx` | Add Forgot Password link with `resetPasswordForEmail` |
| `src/pages/ExpensesList.tsx` | Verify/fix RBAC to include invoice-linked primary/secondary user visibility |
| `src/pages/Billing.tsx` | Add view-only badge for non-admin secondary users viewing non-draft invoices |

## What Is NOT Changing (Confirmed Correct)
- `billing/new` stays admin-only (`requireAdmin`)
- `saveInvoice` keeps `!isAdmin && isNew` block
- No email sending integration
- Case request supports both new and existing projects (already works)

