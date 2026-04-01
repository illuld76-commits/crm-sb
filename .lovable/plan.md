

# Fix Invoice Email, Phase Billing, Patient Dropdown & Terminology

## Issues Found

### 1. Invoice email not auto-populated
In `Billing.tsx` line 258, `clientDetails.email` is set from `crm.client?.email || patientFull?.contact_email`. The CRM email comes from `settings_entities.email` for the matched entity (company/clinic/doctor). If no entity has an email set, and the patient has no `contact_email`, the field stays empty. The user expects the **primary assigned user's email** to auto-populate.

**Fix**: After resolving CRM contacts, also look up the primary user's email from `auth` (via profiles or the user metadata). Since we have `primaryUserId`, fetch the profile's email or the auth user email. Actually, profiles don't store email — we need to query `auth.users` which isn't accessible from client. Instead, use `supabase.auth.admin` which also isn't available. The practical fix: store email on profiles table (it's not there now), OR use the CRM entity email more aggressively. Best approach: when `primaryUserId` is resolved, look up `profiles` for `display_name`, and also check if any `user_assignments` link to entities with emails. Simpler: the `clientDetails.email` should fall back to the **selected primary user's profile**. Since auth email isn't in profiles, we should add a lookup: fetch the user's email from the `case_requests` table's `user_id` linked profile, or from `settings_entities` where the user is assigned. Most direct fix: use `supabase.rpc` or fetch from `auth.users` via edge function. **Pragmatic fix**: populate email from the CRM entity (company > clinic > doctor priority) AND also try to get email from the patient's `contact_email` field. If neither exists, show a toast prompting the user to add email to the CRM entity or patient record.

Actually, the real issue is simpler: **the CRM entity likely has no email set** because the Settings CRM form may not have saved it. Let me verify the flow works when entity email exists — it should. The fix is to also populate from the **primary user's profile email**. We should query `supabase.auth.getUser()` for the primary user — but that's admin-only. Alternative: add email field to profiles table, populated from `auth.users.email` via the `handle_new_user` trigger.

**Plan**: 
1. Migration: add `email` column to `profiles` table
2. Update `handle_new_user` trigger to also store `NEW.email`
3. In `Billing.tsx selectPatient()`, after resolving primaryUserId, fetch their profile email as fallback

### 2. Phase suggestion in billing not working
Looking at lines 280-346, when a patient is selected, phases ARE fetched and shown (line 624-648). The phase dropdown appears when `patientId && patientPhases.length > 0`. This should work. The issue may be that `patientPhases` isn't populated when loading an existing invoice. In the existing invoice load path (lines 173-201), phases are NOT fetched — only when `selectPatient` is called. Fix: when loading an existing invoice with `patient_id`, also fetch phases.

### 3. Patient dropdown in CaseSubmission not working for existing patients
Line 682: `patientSearchFocused && patientResults.length >= 0` — this is always true when focused (length >= 0 is always true). The dropdown shows but the issue is the results aren't populated when search is empty. Looking at line 180-191, the query runs on focus and fetches up to 20 patients even with empty search. This should work. The real issue might be that `canAccessPatient` filters out all results for non-admin users with no assignments yet. For admin, it should show all. Need to verify.

### 4. Entity dropdowns showing same options
The `getScopedEntities` function at line 399-405 correctly filters by `entity_type`. If doctor/clinic/lab all show the same names, it means the database has entities with the same `entity_name` under different `entity_type` values, OR the data hasn't been entered correctly. The code is correct — this is likely a data issue. However, for admin fallback where `allowed` is null (admin), it returns all typed entities correctly.

### 5. Cross-form errors in work order tabs
When navigating between tabs, the `dynamicFormData` state is shared correctly via keyed records. The issue is likely that `Select` components don't reset their visual state when switching tabs. Radix `Tabs` unmounts inactive tab content by default, which should handle this. Check if `TabsContent` has `forceMount` — it shouldn't need it.

### 6. Terminology: "Patient" → "Project"
Many pages still use "Patient" terminology. Need systematic replacement in UI labels across Dashboard, UserDashboard, GlobalKanban, PatientDetail, SubmittedCases, BillingList, WorkOrderDetail, Messages, GlobalAssets.

## Implementation Plan

### Step 1: Migration — add email to profiles + update trigger
```sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- Backfill from auth.users
UPDATE public.profiles p SET email = u.email FROM auth.users u WHERE p.user_id = u.id AND p.email IS NULL;

-- Update trigger to include email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email), NEW.email);
  RETURN NEW;
END;
$$;
```

### Step 2: Billing.tsx fixes
- In `selectPatient()`: after setting `primaryUserId`, fetch that user's profile email as fallback for `clientDetails.email`
- In existing invoice load (lines 173-201): after loading invoice, if `patient_id` exists, fetch phases and plans
- Fix `clientDetails.name` to use entity name (company/clinic) instead of patient name when CRM resolves a client entity

### Step 3: CaseSubmission patient dropdown
- The dropdown code looks correct. Verify that when focused with empty search, it fetches patients. The condition `patientSearch.length >= 1` on line 183 means empty search returns ALL patients (no filter applied). This is correct. If not working, check if `canAccessPatient` is the blocker for admin (should return true).

### Step 4: Terminology replacement
Replace "Patient" with "Project" in UI labels across:
- `Dashboard.tsx`, `UserDashboard.tsx`, `ClientDashboard.tsx`
- `GlobalKanban.tsx`, `PatientDetail.tsx` (header/labels only)
- `SubmittedCases.tsx`, `BillingList.tsx`
- `WorkOrderDetail.tsx`, `Messages.tsx`, `GlobalAssets.tsx`
- `Sidebar.tsx`, `BottomNav.tsx`

### Step 5: Cross-form error fix
Ensure each tab's form fields use the correct `dataKey` (item ID). The current code already does this via `rt.id` keying. If issues persist, add `key={wf.id}` to force re-render on tab switch.

## Files to Modify

| File | Changes |
|------|---------|
| Migration | Add email to profiles, update trigger |
| `src/pages/Billing.tsx` | Fetch profile email for primary user, load phases on existing invoice, terminology |
| `src/pages/CaseSubmission.tsx` | Minor terminology fixes |
| `src/pages/Dashboard.tsx` | Terminology: Patient → Project |
| `src/pages/UserDashboard.tsx` | Terminology |
| `src/pages/ClientDashboard.tsx` | Terminology |
| `src/pages/GlobalKanban.tsx` | Terminology |
| `src/pages/PatientDetail.tsx` | Terminology in labels |
| `src/pages/SubmittedCases.tsx` | Terminology |
| `src/pages/BillingList.tsx` | Terminology |
| `src/pages/WorkOrderDetail.tsx` | Terminology |
| `src/pages/Messages.tsx` | Terminology |
| `src/pages/GlobalAssets.tsx` | Terminology |
| `src/components/Sidebar.tsx` | Terminology |
| `src/components/BottomNav.tsx` | Terminology |
| `src/lib/case-conversion.ts` | Resolve primary user email for invoice client_details |

