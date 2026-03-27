

# Comprehensive Application Audit & Full-Scope Implementation

This plan addresses all reported issues and missing features across the entire application. It is split into 10 workstreams, each targeting a specific area.

---

## 1. Seed Default Industry-Standard Presets

**File:** `src/pages/PresetForms.tsx`

Currently there are no `plan_preset` or `request_type` records in the DB, so the entire preset-driven workflow is broken.

**Add a "Seed Defaults" button** (visible when no plan_presets exist) that inserts:

**Plan Presets** (`category: 'plan_preset'`):
- **Orthodontic Plan** — sections: IPR Data, Tooth Movement, Feasibility, Images, Model Analysis, Cephalometric, Audio, Video, Notes
- **Crown & Bridge Plan** — sections: Images, Notes, Feasibility
- **Implant Plan** — sections: Images, Model Analysis, Cephalometric, Feasibility, Notes
- **Surgical Plan** — sections: Images, Video, Notes, Feasibility
- **Dental Lab Work Plan** — sections: Images, Model Analysis, Notes, Feasibility
- **General Restorative Plan** — sections: Images, Notes, Feasibility

**Work Order Presets** (`category: 'work_order'`):
- Standard Aligner, Retainer, Crown/Bridge, Implant Guide, Splint, Surgical Guide — each with relevant dental field templates

**Request Types** (`category: 'request_type'`):
- Standard Aligner (linked to Aligner work order + Orthodontic plan preset)
- Crown & Bridge (linked to Crown/Bridge work order + Crown & Bridge plan preset)
- Implant (linked to Implant Guide work order + Implant plan preset)
- Surgical (linked to Surgical Guide work order + Surgical plan preset)

**Fee/Item Presets** (`category: 'fee'` / `category: 'item'`):
- Full Upper Aligner, Full Lower Aligner, Retainer Set, Crown PFM, Crown Zirconia, Implant Guide, Splint

**Also add**: An "Edit Links" UI in the existing preset list — each request type row shows its linked work order and plan preset as clickable dropdowns that can be re-assigned inline.

---

## 2. Fix Dashboard — Projects Not Showing

**File:** `src/pages/Dashboard.tsx`

**Issues found:**
- RBAC filtering runs before `useUserScope` finishes loading — `canAccessPatient` returns false during the loading state
- The `fetchData` call on line 86 runs on mount regardless of scope loading state

**Fixes:**
- Guard `fetchData` with `if (scopeLoading) return;` and add `scopeLoading` to the useEffect dependency
- Re-run data fetch when scope finishes loading
- Add the `is_deleted` filter: `.eq('is_deleted', false)` to the phases query (some phases may have `is_deleted`)
- Ensure `treatment_plans` query also adds `.eq('is_deleted', false)`

---

## 3. Fix Global Kanban — Empty Board

**File:** `src/pages/GlobalKanban.tsx`

**Issues:**
- Kanban already has `.eq('is_deleted', false)` on plans — good
- But patients query uses `.is('archived_at', null)` which excludes some
- The `canAccessPatient` check at line 97-100 likely fails because `useUserScope` hasn't loaded yet when `useEffect` runs on mount

**Fixes:**
- Add scope loading guard: don't fetch until `scopeLoading === false`
- Add `scopeLoading` and `isAdmin` to useEffect dependency array
- Verify case_requests are also RBAC-filtered (currently filters by `user_id` for non-admin, which is correct)

---

## 4. Published Plan Visibility to Users

**File:** `src/pages/PatientDetail.tsx`

**Issues:**
- Plans filter: `visibleActivePhasePlans` — need to verify it includes published plans for non-admin users
- Published plan share link (Copy + Open Report) buttons only show when `plan.share_token && plan.status === 'published'` — this is correct but share_token may not be set

**Fixes:**
- In `PatientDetail.tsx`, verify `visibleActivePhasePlans` does NOT filter out published plans for non-admin users (check around line 716)
- On plan publish in `PlanEditor.tsx`, ensure share_token is generated and saved
- Add phase link in the header: show which phase the plan belongs to, with a badge linking back

**File:** `src/pages/PlanEditor.tsx`
- On publish, if no share_token exists, generate one: `crypto.randomUUID()` and save it

---

## 5. Assets — Relational Context Chips

**File:** `src/pages/PatientDetail.tsx` (Assets tab, lines 913-1008)

**Current state:** Assets show flat cards with no context about where they came from.

**Add relational badges to each asset card:**
- For `case_request_attachment` category: show `Badge` "Case Request" with the request type
- For plan section files: show `Badge` "Plan: {plan_name}" and "Phase: {phase_name}"
- For direct uploads: show `Badge` "Direct Upload"

**Implementation:** When rendering asset cards, look up the source:
- `asset.category === 'case_request_attachment'` → badge "Case Request"
- `allFiles` (plan section files) → find the section's plan via `sections` state, then find phase name
- `assets` table items → badge by category

Also add clickable chips that navigate to the relevant entity (plan editor, case request view).

---

## 6. PatientDetail — Nested Workbench Navigation (already partially done)

**Current state:** PatientDetail already has the nested structure: Phase tabs → Plan tabs → Sub-tabs (Details/Files/Chat). This matches the requested "Workbench Drill-Down."

**Missing pieces to fix:**
- The static header needs `flex-wrap` and responsive classes — already has `flex-col sm:flex-row` (line 549), verify no overflow on mobile
- Add linked case request badge on each phase (if phase was created from a case request, show a small chip)
- Show published plan link prominently in the plan header area

---

## 7. Plan Preset Auto-Load & Selector Fix

**File:** `src/pages/PlanEditor.tsx`

**Current issues:**
- `autoLoadPresetFromPhase` works but only if presets exist in DB (they don't yet — fixed by workstream 1)
- The manual preset selector dropdown exists but may not render if `planPresets` is empty

**Fixes (post-seeding):**
- Ensure the preset dropdown is always visible (even when `planPresets.length === 0`, show "No presets available — create in Settings")
- When a plan is created from case acceptance, the `notes` JSON metadata should reliably chain to the correct preset

---

## 8. Billing Auto-Trigger on Plan Acceptance

**File:** `src/pages/GlobalKanban.tsx` (plan status change handler) + `src/pages/PatientDetail.tsx`

**When a user changes plan status to "approved":**
- Auto-create a draft invoice linked to the patient/phase/plan
- Pre-populate line items from the plan's linked request type preset fee
- Show a toast: "Draft invoice created"

**Implementation:** In the Kanban's `onDragEnd` handler (when plan moves to "approved" column), insert a draft invoice:
```
{ patient_id, phase_id: plan.phase_id, status: 'draft', amount_usd: preset_fee, ... }
```

---

## 9. Request Type ↔ Preset Link Management

**File:** `src/pages/PresetForms.tsx`

**Current state:** Request types store `linked_work_order_id` in `unit` and `linked_plan_preset_id` in `description` — this works but is fragile and the existing preset list doesn't show these links.

**Add to existing preset list rows:**
- For each request type row, show the linked work order name and linked plan preset name as badges
- Add an "Edit" button on each row that opens inline dropdowns to change the linked work order and plan preset
- For plan preset rows, show the linked work order type name

---

## 10. SuiteDash-Inspired Features Gap Analysis

**Features the app already has:**
- RBAC with user assignments, Admin/User/Clinic/Doctor/Lab roles
- Case management with phases and plans
- Billing with invoices, receipts, presets
- Communication hub with mentions, reactions, pinning
- Kanban board with drag-and-drop
- Asset management with view/download permissions
- Notification system with templates
- Audit logs and activity timeline
- Soft-delete with archives

**Missing SuiteDash-like features that can be added:**
- **Client portal / external user view**: Non-admin users currently see the full app. A simplified "Client Dashboard" page already exists at `src/pages/ClientDashboard.tsx` but may not be properly routed
- **Task management**: The `Task` type exists in `types.ts` but no task UI exists — add a simple task list per project
- **Automated status change notifications**: Email templates exist but the trigger logic to actually send them on status changes needs wiring
- **Batch invoicing**: Ability to generate invoices for multiple cases at once
- **Custom branding**: Logo upload per clinic/company for white-labeling reports

These are noted for future implementation but not included in this batch.

---

## Files Modified

1. `src/pages/PresetForms.tsx` — seed defaults + edit links UI
2. `src/pages/Dashboard.tsx` — RBAC loading guard fix
3. `src/pages/GlobalKanban.tsx` — RBAC loading guard + auto-invoice on approval
4. `src/pages/PatientDetail.tsx` — asset relational chips, phase-case-request badges, published plan link
5. `src/pages/PlanEditor.tsx` — share_token on publish, preset selector always visible
6. `src/pages/Billing.tsx` — minor: support auto-created draft invoices

## Implementation Order

1. Seed default presets (unblocks everything else)
2. Dashboard RBAC loading fix
3. Kanban RBAC loading fix
4. Published plan visibility + share_token
5. Asset relational context chips
6. Preset link management UI
7. Billing auto-trigger on plan approval
8. Plan editor preset selector fix

