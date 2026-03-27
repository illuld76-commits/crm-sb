

# Full Application Audit & Fix Plan

## Issues Identified

1. **Tooth chart in case view mode**: `dynamic_data` renders tooth_chart as `String([object Object])` instead of the read-only `ToothChartSelector`
2. **Case accepted but not in Projects**: The `updateStatus('accepted')` does create a patient + phase + plan, but Dashboard doesn't re-fetch or navigate; also `case_request_id` column doesn't exist on `treatment_plans` so the `autoLoadPresetFromPhase` query always fails
3. **Plan always shows default orthodontic sections**: The preset auto-load chain is broken because `case_request_id` is not a real column, so preset linking never works
4. **Assets tab doesn't show case request attachments**: PatientDetail only queries the `assets` table and `plan_sections` files — it never looks at the linked `case_requests.attachments`
5. **Global Kanban empty**: Plans show but the query filters may exclude them; also case requests tab filtering may hide results
6. **Plan presets not visible**: The orthodontic plan preset visibility depends on having `category='plan_preset'` presets in the DB — currently only `work_order` presets exist (visible in network response)

## Fixes

### 1. Case Detail View — Render Tooth Chart Properly
**File:** `src/pages/CaseSubmission.tsx` (lines 496-508)

Replace the generic `String(val)` dynamic_data renderer with special handling:
- If key is `tooth_chart`, render `<ToothChartSelector value={val} onChange={()=>{}} readOnly />`
- For other keys, keep existing `String(val)` behavior

### 2. Fix Case Request → Project Conversion
**File:** `src/pages/CaseSubmission.tsx` (lines 195-260, 391-425)

The conversion works but has issues:
- Store the request type preset info in the plan's `notes` field (JSON) since `case_request_id` column doesn't exist on `treatment_plans`
- After accepting, navigate to the created project so admin sees it
- Also copy case request attachments to the `assets` table for the new patient

### 3. Fix Plan Preset Auto-Load
**File:** `src/pages/PlanEditor.tsx` (lines 126-149)

The `autoLoadPresetFromPhase` searches for `case_request_id` column which doesn't exist. Fix:
- Instead, find the case request linked to this patient by matching `patient_id` on `case_requests`
- Then look up the request type preset chain to find the plan preset
- Also add a manual preset selector dropdown that's always visible (admin can change preset)

### 4. Show Case Request Attachments in Project Assets
**File:** `src/pages/PatientDetail.tsx` (lines 258-264, 894-990)

- After loading patient data, also query `case_requests` where `patient_id = patientId`
- Extract their `.attachments` arrays and merge into the assets display
- Show them with a "Case Request" badge to distinguish from plan section files

### 5. Fix Global Kanban Data Loading
**File:** `src/pages/GlobalKanban.tsx` (lines 69-111)

- The data load looks correct but `is_deleted` filter on plans is missing — add `.eq('is_deleted', false)` to treatment_plans query
- Case requests query already filters `is_deleted`
- Verify plans aren't empty by checking the actual data flow

### 6. Dashboard RBAC Scoping
**File:** `src/pages/Dashboard.tsx` (lines 86-131)

- Dashboard fetches ALL patients without RBAC filtering
- Add `useUserScope` hook and filter patients by `canAccessPatient` for non-admin users
- This ensures projects created from case requests appear for the right users

### 7. Plan Preset Selector in Plan Editor
**File:** `src/pages/PlanEditor.tsx`

- Add a visible "Load Preset" dropdown at the top of the editor (currently only auto-loads)
- Populate with all `plan_preset` category presets
- Admin can switch presets at any time, which clears and re-applies sections

### 8. Missing Orthodontic Plan Preset Seeding
**File:** `src/pages/PresetForms.tsx`

- The presets list shows no `plan_preset` items (network data only has `work_order` items)
- Add a "Create Default Orthodontic Preset" button that seeds an orthodontic plan preset with IPR, Tooth Movement, Feasibility, Images sections
- This makes the preset visible in request type linking dropdown

## Files Modified

1. `src/pages/CaseSubmission.tsx` — tooth chart view, attachment copy on accept, navigation after accept
2. `src/pages/PlanEditor.tsx` — fix auto-load, add manual preset selector
3. `src/pages/PatientDetail.tsx` — show case request attachments in assets
4. `src/pages/GlobalKanban.tsx` — fix plan query filter
5. `src/pages/Dashboard.tsx` — add RBAC scoping
6. `src/pages/PresetForms.tsx` — add default preset seeding

## No DB Migrations

All fixes use existing columns and tables. The `case_request_id` approach is abandoned in favor of matching via `patient_id` on `case_requests`.

