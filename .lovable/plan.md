

# Holistic Enhancement Plan — Tooth Chart, Navigation, Billing Integration & CRM

---

## 1. Tooth Chart Improvements

**Files:** `src/components/ToothChartSelector.tsx`

- Add **deciduous dentition** (primary teeth: 55-51, 61-65 upper; 85-81, 71-75 lower) as a toggle section below permanent teeth, same arch layout
- Make SVG **responsive** with proper viewBox scaling for mobile (use `w-full` container, reduce viewBox width on small screens)
- Add **Shift+Click range selection**: track `lastClickedTooth`, on shift+click select all teeth between last and current in same arch
- Improve readability: larger tooth labels, better spacing, color contrast
- Add **form preview mode** in PresetForms: when building a work order form with `tooth_chart` field, show a read-only rendered preview of the form

---

## 2. Patient Search Dropdown Fix

**Files:** `src/pages/CaseSubmission.tsx`, `src/pages/Billing.tsx`

- The dropdown results div exists (lines 483-492) but needs better UX: add `max-h-48 overflow-y-auto` and ensure it shows on focus even when results exist
- Show dropdown immediately when input is focused if there are cached results
- Add a "No results found" state when search returns empty with 2+ chars

---

## 3. Case Request → Plan/Phase Auto-Creation

**Files:** `src/pages/CaseSubmission.tsx`

- When a case request is accepted and linked to a patient, the `updateStatus('accepted')` creates a patient + initial phase but **no plan**
- Fix: After creating the phase, also create a treatment plan using the linked plan preset (from request type's `discount_value` field which stores plan preset ID)
- If no plan preset linked, create a default plan with the request type name

---

## 4. Plan Preset Linking in Request Types

**Files:** `src/pages/PresetForms.tsx`

- The "Linked Work Order Form" and "Linked Plan Preset" dropdowns exist (lines 454-474) but the `discount_value` is used to store the plan preset ID as a number — it needs to store the UUID string
- Fix: Store linked IDs in the `fields` JSON array or use `description` field for plan preset ID, keeping `unit` for work order ID
- Show the orthodontic plan preset that was created — ensure plan presets with `category: 'plan_preset'` appear in the dropdown
- Add ability to add **any treatment plan type** (not just orthodontic) — the plan preset system already supports this, just needs better UX

---

## 5. Sidebar Navigation Restructure

**Files:** `src/components/Sidebar.tsx`

- Restructure the bottom section into a **"Cases" mega-section** that expands to show two sub-sections:
  - **Case Requests** (with count badge, expandable list with status dots)
  - **Cases** (patient list with phase/plan tree)
- Add a dedicated "Case Requests" quick-link button in the top nav links
- Add `max-h` with scroll for long lists to prevent overflow
- Truncate long names with `truncate` class (already done for most)

---

## 6. Quick Navigation Header Dropdown

**Files:** `src/components/Header.tsx`

- Add a **searchable dropdown** in the header (next to title) for quick navigation
- When on a patient/case page, shows dropdown with all accessible cases, phases, plans
- Live search filters the list
- Clicking navigates to that entity without leaving current view context

---

## 7. Billing ↔ Work Order/Phase Integration

**Files:** `src/pages/Billing.tsx`

- When patient is selected, fetch their phases and plans
- Add phase/plan selector dropdown
- Auto-populate line items from linked case request's request type + fees from presets
- Add "Add from Presets" button that shows fee/item presets for quick insertion (like SuiteDash-style item picker)
- Show existing preset items in a searchable dropdown to avoid billing errors

---

## 8. Quick-Add Sections Saveable as Templates

**Files:** `src/pages/PlanEditor.tsx`

- Add "Save as Template" button in PlanEditor that saves current section configuration as a new plan preset
- Links back to PresetForms for management

---

## Implementation Priority

1. Tooth chart (deciduous + mobile + shift-select + preview)
2. Patient search dropdown fix
3. Case request → auto-create plan on accept
4. Plan preset linking fix in request types
5. Sidebar restructure
6. Header quick navigation
7. Billing preset item integration
8. Save sections as template

## Technical Notes

- ~8 files modified, no new files needed
- No DB migrations — all data fits in existing JSON columns
- Backward compatible with existing presets and case requests
- The `discount_value` field hack for storing plan preset ID should be replaced with proper storage in `fields` JSON

