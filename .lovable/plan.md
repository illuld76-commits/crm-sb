

# Comprehensive Enhancement Plan — Presets, Request Types, Workflow & UX

This plan covers all items from the user's request, organized into implementable batches.

---

## Batch 1: Plan Presets Enhancement (Issue 1)

**Goal:** Make the existing plan preset (orthodontic) saveable with a proper name, and add rich section types including tooth movement CSV parser and IPR CSV parser as available section types.

**Changes — `src/pages/PresetForms.tsx`:**
- Rename existing plan preset section types from generic text/textarea/radio/checkbox/dropdown to dental-specific types: `ipr_data`, `tooth_movement`, `feasibility`, `images`, `video`, `audio`, `model_analysis`, `cephalometric`, `notes`
- Each section type maps to what PlanEditor already supports — when a plan is created from a preset, these sections are auto-added
- Add a "Save as Orthodontic Plan" default preset with all current PlanEditor sections pre-configured
- Save the preset with `category: 'plan_preset'` and section definitions in the `fields` JSON column

---

## Batch 2: Request Types as Preset Items + Work Order Form Linking (Issue 2)

**Goal:** Request types should be manageable in Presets. Each request type links to a work order form preset. Users select request types with qty in case submission, and the corresponding form loads.

**Changes — `src/pages/PresetForms.tsx`:**
- Add a new tab **"Request Types"** (`request_type` category)
- Each request type preset has: name, description, linked work order preset ID(s), linked plan preset ID, fee
- Admin can create/edit request types and associate existing work order form presets

**Changes — `src/pages/CaseSubmission.tsx`:**
- Replace the hardcoded request type dropdown with dynamic list from `presets` where `category = 'request_type'` (fallback to work_order presets + hardcoded defaults for backward compat)
- Allow **multiple request types** selection, each with a quantity input
- When a request type is selected, load its linked work order form preset and render the dynamic form fields for user to fill
- Store selected request types + quantities + form data in `case_request.dynamic_data`

**Changes — `src/pages/CaseSubmission.tsx` (admin accept flow):**
- When admin accepts a case request, auto-select the plan preset linked to the submitted request type(s)
- Admin can override/change the plan preset before conversion
- Case name derives from request type name(s)
- Each request type can generate a separate plan under the case

---

## Batch 3: Interactive Tooth Chart for Work Order Forms (Issue 2 continued)

**Goal:** For non-orthodontic dental work (crowns, bridges, veneers, splints), provide an interactive tooth chart in work order form presets where users click teeth and assign work types.

**Changes — New component `src/components/ToothChartSelector.tsx`:**
- Interactive Palmer notation diagram (reuse `PalmerArchDiagram` patterns)
- Click individual teeth or drag-select ranges
- For each selection, user picks work type (crown, bridge, veneer, splint, etc.) from a dropdown
- Displays a summary table: teeth selected → work type → notes
- Outputs structured JSON for storage in `dynamic_data`

**Changes — `src/pages/PresetForms.tsx`:**
- Add `tooth_chart` as a new field type in work order form builder
- When this field type is added to a form, the ToothChartSelector renders at submission time

**Changes — `src/pages/CaseSubmission.tsx`:**
- Render `ToothChartSelector` when a work order form contains a `tooth_chart` field

---

## Batch 4: Multi-Request Case Conversion + Invoicing Link (Issue 2 continued)

**Changes — `src/pages/CaseSubmission.tsx` (updateStatus):**
- When converting to case, create one plan per request type using the linked plan preset
- Plan names = request type names
- Store `case_request_id` on each plan for invoicing linkage

**Changes — `src/pages/Billing.tsx`:**
- When creating invoice from a case that has `case_request_id`, auto-populate line items from request types + quantities + fees from presets

---

## Batch 5: Archives Completeness (Issue 2 tail)

**Changes — `src/pages/AdminArchives.tsx`:**
- Verify all entity types with `is_deleted` flag appear in archives
- Currently missing: communications (no `is_deleted` column). Add client-side note that communications archival requires DB migration.
- Ensure soft-delete is called (not hard-delete) across all delete actions in the app

**Audit across files:** Check all `delete()` calls and convert to `update({ is_deleted: true })` where applicable for: plans, phases, case_requests, invoices, assets, entities.

---

## Batch 6: Unpublish Plans + Admin Controls (Issue from request)

**Changes — `src/pages/PlanEditor.tsx`:**
- Add "Unpublish" button for admin when plan status is `published`
- Sets status back to `saved`, removes public share link access
- Add confirmation dialog before unpublishing

---

## Batch 7: User Dashboard Enhancements (Issue from request)

**Changes — `src/pages/UserDashboard.tsx`:**
- Add case status badges, published plan count, and quick status summary per case card
- Add expandable/collapsible phase→plan tree view (similar to admin Dashboard's `renderExpandedPhases`)
- Add navigation to plan view and share link copy for published plans

---

## Batch 8: User Kanban Access (Issue from request)

**Changes — `src/pages/GlobalKanban.tsx`:**
- Already partially done. Verify non-admin users see only RBAC-filtered cases/plans
- Add Kanban link to user's `BottomNav` and sidebar

**Changes — `src/components/Sidebar.tsx` and `src/components/BottomNav.tsx`:**
- Add Kanban route for non-admin users

---

## Batch 9: Activity Logs & Notifications Integration (Issue from request)

**Changes — audit `logAction` calls across:**
- `CaseSubmission.tsx`: Log on accept, reject, convert, status change with `target_type: 'case_request'`
- `PlanEditor.tsx`: Log on publish, unpublish, save with `target_type: 'plan'`
- `Billing.tsx`: Log on invoice create/send with `target_type: 'invoice'`
- Ensure `target_name` includes case name and request type for context

**Changes — `src/lib/notifications.ts`:**
- Verify `sendNotification` is called at key points
- Add notification on plan publish, case status change, invoice sent

**Changes — `src/pages/UserDashboard.tsx`:**
- Show recent activity logs for user's own cases (filtered by RBAC)

---

## Batch 10: Relational Navigation Verification

**Changes across all pages:**
- Verify `useRelationalNav().openPreview()` calls exist on clickable entity references (invoices, plans, cases, case requests)
- Add missing relational links in Dashboard cards, Kanban cards, Billing rows, and Messages

---

## Implementation Priority

1. **Batch 1** — Plan presets with proper section types
2. **Batch 2** — Request types + work order form linking
3. **Batch 3** — Tooth chart component
4. **Batch 4** — Multi-request conversion + invoicing
5. **Batch 6** — Unpublish plans
6. **Batch 7** — User dashboard enhancements
7. **Batch 8** — User Kanban access
8. **Batch 5** — Archives completeness
9. **Batch 9** — Activity logs & notifications
10. **Batch 10** — Relational navigation

## Technical Notes

- **Files modified:** ~10 existing files
- **New files:** 1 (`ToothChartSelector.tsx`)
- **No DB migrations needed** — all data stored in existing JSON columns (`fields`, `dynamic_data`)
- **Backward compatible** — existing presets and case requests continue working; new request type presets are additive

