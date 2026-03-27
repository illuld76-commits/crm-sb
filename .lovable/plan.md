

# Comprehensive Application Audit & Fixes — Phase 2

This plan addresses all reported issues: invoice deletion, Global Assets empty, preset editability, auto-population on billing, list/grid view toggles, and the conceptual Items/Fees/Work Orders distinction.

---

## Conceptual Clarity (for reference)

- **Items**: Fixed products (Aligner Upper, Crown Zirconia) with a base `unit_price`. Selected during case submission.
- **Work Orders**: Job instruction templates containing form fields. Calculate total based on items/units in submission.
- **Fees**: Non-product charges applied at invoicing time (Design Fee, Shipping, GST). Applied by admin to the final bill.

Currently the DB stores all three in the `presets` table with `category` distinguishing them. This is fine and doesn't need schema changes.

---

## 1. Invoice Delete for Admin

**File:** `src/pages/Billing.tsx`

Add a "Delete Invoice" button (soft delete) in the top action bar, visible only to admins. Sets `is_deleted: true` and navigates back to `/billing`.

**File:** `src/pages/BillingList.tsx`

Add a delete icon button on each invoice row for admins.

---

## 2. Billing Auto-Population from Project

**File:** `src/pages/Billing.tsx`

When a patient is selected via search, also fetch:
- `primary_user_id` and `secondary_user_id` from the `patients` table to auto-set primary/secondary user assignment
- `clinic_name` and `doctor_name` to pre-fill client details address/name
- If a case_request exists for this patient, auto-populate line items from its `request_type` preset (already partially done but only via `case_request_id` on plans which doesn't exist — fix to use `patient_id` lookup on `case_requests` instead)

---

## 3. Fix Global Assets — Show All Files

**File:** `src/pages/GlobalAssets.tsx`

The `assets` table is empty. Files exist in `plan_sections.file_url` and `case_requests.attachments`. Fix by fetching from ALL sources:

1. Query `plan_sections` with `file_url IS NOT NULL`, join to get patient name via phase → patient
2. Query `case_requests` and extract `attachments` arrays
3. Query `assets` table (existing)
4. Merge all into a single list with source badges

---

## 4. Preset Editability

**File:** `src/pages/PresetForms.tsx`

Currently presets can only be deleted. Add an "Edit" button on each preset card that:
- Loads the preset's data into the form fields at the top
- Changes the "Add" button to "Update"
- On save, runs `supabase.update()` instead of `insert()`

Track `editingPresetId` state — when set, the form is in edit mode.

---

## 5. List/Grid View Toggle with Search & Filters

**Files:** `src/pages/BillingList.tsx`, `src/pages/GlobalAssets.tsx`, `src/pages/GlobalKanban.tsx`

Add a view toggle (Grid/List) and ensure all list views have:
- Live search input
- Status filter dropdown
- Sort dropdown

`BillingList.tsx` already has search + sort + filter. Add Grid/List toggle.
`GlobalAssets.tsx` already has search + category filter. Add List view option.
`GlobalKanban.tsx` already has search + sort + doctor filter. The case requests tab needs a list view option.

---

## 6. Auto-Save Orthodontic Plan as Default Preset

**File:** `src/pages/PresetForms.tsx`

The existing seed logic already creates an "Orthodontic Plan" preset. No change needed for seeding.

For the PlanEditor's existing plan sections: add an "Export as Preset" button (already exists based on memory). Verify it works and saves with `category: 'plan_preset'`.

---

## 7. Dental Chart as Quick-Add Section in Plan Presets

**File:** `src/pages/PresetForms.tsx`

In the Plan Preset tab's form builder, add "Quick Add Sections" panel (similar to Dental Field Templates for Work Orders) with clickable badges:
- Dental Chart (tooth_chart)
- IPR Data (ipr_data)
- Tooth Movement (tooth_movement)
- Feasibility (feasibility)
- Images (images)
- Model Analysis (model_analysis)
- Cephalometric (cephalometric)
- Audio (audio)
- Video (video)
- Notes (notes)

These are already field types but need a quick-add panel specifically in the plan_preset tab.

---

## Files Modified

1. `src/pages/Billing.tsx` — delete button, auto-populate from project owner
2. `src/pages/BillingList.tsx` — delete button, grid/list toggle
3. `src/pages/GlobalAssets.tsx` — fetch from plan_sections + case_requests, list view toggle
4. `src/pages/PresetForms.tsx` — edit existing presets, quick-add sections panel for plan presets
5. `src/pages/GlobalKanban.tsx` — list view option for case requests tab

## Implementation Order

1. Invoice delete (Billing + BillingList)
2. Billing auto-populate from project
3. Global Assets fix (recursive fetch)
4. Preset editability
5. Quick-add sections for plan presets
6. View toggles across lists

