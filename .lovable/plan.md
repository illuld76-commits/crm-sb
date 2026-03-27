

# Holistic Relational Workflow Overhaul

This plan rethinks the core data flow: **Case Request → Project (Patient) → Phase (from request name) → Plan (from request type + preset) → Billing → Payments**, with proper relational navigation, RBAC, and archives throughout.

---

## Core Terminology Shift

- **"Patient"** is renamed to **"Project"** in navigation/UI labels (DB table stays `patients`)
- **"Cases and Projects"** becomes the single mega-button in the sidebar
- Expands to 3 sub-buttons: **New Case Request**, **Case Requests**, **Projects**
- Each sub-button opens a slidable pane with live search + scrollable list

---

## 1. Sidebar Navigation Overhaul

**File:** `src/components/Sidebar.tsx`

- Remove the long flat list of nav links. Keep only essential top-level: Dashboard, Kanban, Messages, Notifications, Profile, Billing, Global Assets, Activity Logs
- Admin-only: Team, Settings, Archives, Presets, Notif. Templates
- Replace the bottom "Cases" section with a **"Cases & Projects"** expandable button
- When clicked, shows 3 sub-items:
  - **New Case Request** → navigates to `/case-submission`
  - **Case Requests** → opens a slide-out pane (or inline expandable) with live search + scrollable list of case requests with status dots
  - **Projects** → opens a slide-out pane with live search + scrollable list of patients with expandable phase → plan tree
- Each pane: `max-h` with scroll, live search input at top, items are clickable links

---

## 2. Case Request → Project/Phase/Plan Auto-Creation Fix

**File:** `src/pages/CaseSubmission.tsx`

**Problem:** Accepting a case request creates a patient + "Initial Treatment" phase but the plan doesn't reliably appear, and linking to existing patients doesn't create proper phases/plans.

**Fix the `updateStatus('accepted')` flow:**

### For NEW patient (no existing link):
1. Create patient record
2. Create phase with `phase_name = case request name` (not "Initial Treatment")
3. Create plan with `plan_name = request type name`, linked to the plan preset from the request type
4. Store `case_request_id` on the plan for traceability

### For EXISTING patient (linked via search):
1. Create new phase under existing patient with `phase_name = case request name`
2. Create plan with `plan_name = request type name` using linked preset
3. Update case request with `patient_id`

### Auto-populate demographics for existing patient:
- When user selects existing patient in `selectExistingPatient()`, also fetch and fill `patient_age`, `patient_sex` from the patient record (currently only fills name/doctor/clinic)

---

## 3. Plan Preset Visibility Fix

**File:** `src/pages/PresetForms.tsx`

**Problem:** Orthodontic plan preset not visible; "Linked Work Order Type" field is a text input instead of a dropdown.

**Fixes:**
- Change "Linked Work Order Type" from `<Input>` to a `<Select>` dropdown populated with `presets.filter(p => p.category === 'work_order')`
- Store the selected work order preset ID in the `unit` field (consistent with request types)
- On page load, ensure existing plan presets (including any previously saved orthodontic plan) appear in the list
- Show a default "Orthodontic Plan" entry if none exists (seed on first load or show a "Create Default" button)

---

## 4. Plan Editor — Load Preset by Request Type

**File:** `src/pages/PlanEditor.tsx`

- When creating a new plan (via `?phaseId=`), check if the phase was created from a case request
- If so, look up the request type's linked plan preset and pre-populate sections from it
- Admin can change the preset via a dropdown at the top of the editor
- Plan name defaults to request type name but is editable

---

## 5. Billing Auto-Population from Case/Plan

**File:** `src/pages/Billing.tsx`

- When patient is selected and phase/plan chosen, look up linked case request via `case_request_id` on the plan
- Auto-populate line items from: request type name as description, fee from preset, qty from case request
- All fields remain editable for admin
- Add "Add from Presets" picker (already partially exists) — ensure it shows fee/item presets in a searchable dropdown

---

## 6. Archives Completeness Audit

**Files:** `src/pages/AdminArchives.tsx` + audit all delete actions

- Audit every `.delete()` call across the app and convert to `.update({ is_deleted: true })` where `is_deleted` column exists
- In AdminArchives, query all tables with `is_deleted = true`: `case_requests`, `treatment_plans`, `phases`, `invoices`, `presets`, `communications`
- Add tabs/filters for each entity type
- Each item shows: restore button, permanent delete button

---

## 7. Remarks/Chat Attachment Integration

**Files:** `src/components/CommunicationHub.tsx`, `src/pages/PlanEditor.tsx` (remarks section)

- Ensure file attachment upload exists on both plan remarks and chat messages
- When a case request is linked to a patient, its attachments should appear in the patient's Assets tab
- All uploaded files across case requests, remarks, and chat should be queryable from the patient's asset hub

---

## 8. Relational Navigation Verification

**Files:** Multiple pages

- In `Dashboard.tsx`: case cards link to patient detail; plan badges link to plan editor; case request badges link to case detail
- In `GlobalKanban.tsx`: cards link to plan editor and patient detail
- In `Billing.tsx`/`BillingList.tsx`: invoice rows link to patient and plan
- In `CaseSubmission.tsx`: "View linked patient" already exists; add "View linked plan" and "View linked phase" buttons
- In `PatientDetail.tsx`: phases show linked case request badge with link back

---

## 9. RBAC Consistency

- Non-admin users see only their RBAC-accessible projects in sidebar, Kanban, billing, activity logs, and notifications
- `GlobalKanban.tsx` already filters — verify it works
- `AuditLogs.tsx`: filter by user's accessible patient IDs for non-admin
- `Notifications.tsx`: already user-scoped

---

## Implementation Order

1. **Sidebar overhaul** (navigation UX, most visible)
2. **Case request → project/phase/plan fix** (core workflow)
3. **Auto-populate demographics for existing patient**
4. **Plan preset visibility + linked work order dropdown fix**
5. **Plan editor preset loading**
6. **Billing auto-population**
7. **Archives audit + soft-delete fixes**
8. **Remarks attachments**
9. **Relational navigation links**
10. **RBAC consistency check**

## Technical Notes

- ~8 files modified, 0 new files
- No DB migrations needed — uses existing columns (`is_deleted`, `dynamic_data`, `case_request_id`, etc.)
- Terminology change is UI-only (labels), no DB schema changes
- Backward compatible with existing data

