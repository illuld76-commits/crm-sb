

# Phase 4 — CRM Contacts, Timeline Fix, Task RBAC & Missing Features

## Analysis Summary

### Issues Found

**1. Activity Timeline in PatientDetail is empty** — Bug at line 294: `const planIds2 = plans.map(...)` uses the `plans` state variable, which hasn't been updated yet at that point in `loadPatient()`. The `setPlans(planData)` call happens earlier but React state is async — `plans` is still the old empty array. Additionally, timeline is admin-only (`if (isAdmin)`), so non-admin users see nothing.

**2. Settings/Master Data has no CRM fields** — `settings_entities` only stores `entity_name` and `entity_type`. No address, email, phone, GST number, or contact person. This means billing can't auto-populate merchant/client details from the entity record. Currently it just uses patient name as client details.

**3. Task assignment has no RBAC** — Tasks show `allProfiles` (all users) as assignees regardless of role. Non-admin users can assign tasks to anyone. Tasks should scope assignees based on project ownership.

**4. Invoice assignment not linked to contacts** — When billing auto-populates, it sets client name from patient_name and address from clinic+doctor strings. It should pull full contact details (email, address, GST) from the entity's CRM record.

**5. Email integration** — No edge functions exist (`supabase/functions` directory is empty/missing). Notifications are in-app only via the `notifications` table + `sendNotification()`. Email delivery is not wired up.

**6. Non-admin users can't see timeline** — The audit_log fetch is wrapped in `if (isAdmin)`, so non-admin users always see "No activity recorded."

---

## Implementation Plan

### 1. Extend `settings_entities` with CRM Contact Fields (Migration)

Add columns to `settings_entities`:
- `contact_person` text
- `email` text  
- `phone` text
- `address` text
- `gst_number` text
- `city` text
- `state` text
- `country` text
- `notes` text

This turns Settings into a proper CRM Contacts module — each Doctor, Clinic, Lab, Company becomes a full contact record with address and tax info, like SuiteDash's contact management.

### 2. Upgrade Settings Page to CRM Contacts Manager

**File:** `src/pages/Settings.tsx`

Replace the simple name-only add form with a full contact form:
- Name, Contact Person, Email, Phone, Address (multi-line), City, State, Country, GST Number, Notes
- Expandable/collapsible card per entity showing all details
- Edit button to modify existing entity details (currently only delete exists)
- Search/filter within each tab

### 3. Fix Activity Timeline Bug in PatientDetail

**File:** `src/pages/PatientDetail.tsx`

**Bug fix (line 294):** Replace `plans.map(...)` with `(planData || []).map(...)` — use the local variable from the fetch, not the stale state.

**RBAC fix:** Remove the `if (isAdmin)` guard around audit_log fetch. For non-admin users, fetch `communications` for this case instead (they can see their own activity). Also fetch `notifications` for the patient's owner to show relevant events.

### 4. Wire Billing to CRM Contact Details

**File:** `src/pages/Billing.tsx`

In `selectPatient()`, after getting patient's `clinic_name`/`doctor_name`, look up the matching `settings_entities` record to pull full contact details:
- Set `clientDetails.address` from entity's address fields
- Set `clientDetails.email` from entity's email
- Auto-fill GST number from the clinic/doctor entity
- Auto-fill merchant details from the lab entity (the lab doing the work)

### 5. Task Assignment RBAC

**File:** `src/pages/PatientDetail.tsx`

- For admin: show all profiles (current behavior)
- For non-admin: show only profiles that are assigned to the same clinic/doctor/lab as the current patient (filter `allProfiles` through user_assignments matching the patient's entities)
- Also: fetch `allProfiles` for non-admin users too (currently guarded by `if (isAdmin)`)

### 6. Activity Timeline for Non-Admin Users

**File:** `src/pages/PatientDetail.tsx`

For non-admin users, populate timeline from:
- `communications` table (messages for this case)
- `notifications` table filtered to current user
- Plan remarks (`plan_remarks`) for visible plans

Merge and sort by `created_at` descending.

### 7. Email Notification Status Note

Email integration requires setting up an email domain and scaffolding transactional email edge functions. This is a separate infrastructure step. Current state: notifications are in-app only. Will add a note in the plan about this being a follow-up configuration step, not a code change.

---

## Files Modified

1. **Migration** — Add CRM columns to `settings_entities`
2. `src/pages/Settings.tsx` — Full CRM contact form with edit, address, GST, search
3. `src/pages/PatientDetail.tsx` — Fix timeline bug (planIds2), remove admin-only guard, add non-admin timeline sources, fix task RBAC
4. `src/pages/Billing.tsx` — Fetch entity CRM details for client/merchant auto-population
5. `src/pages/TeamManagement.tsx` — Show entity contact details in assignment view

## Implementation Order

1. Migration (CRM columns)
2. Settings CRM upgrade
3. PatientDetail timeline fix + non-admin timeline
4. Billing CRM auto-populate
5. Task assignment RBAC
