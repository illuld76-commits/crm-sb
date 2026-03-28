

# Fix Case Request Flow, Entity Duplicates, and Conversion Pipeline

## Issues Found

### 1. Patient search has no dropdown — only live search
The patient search input only shows results after typing 2+ characters. There is no initial dropdown of all patients. User expects a proper dropdown with live-search filtering.

**Fix**: Show all RBAC-scoped patients when the search input is focused (even with empty text), with live filtering as user types.

### 2. Doctor/Clinic/Lab dropdowns showing same names
The `settings_entities` table stores entities with `entity_type` discriminator. The `filterEntities` function correctly filters by type. However, if the same `entity_name` was added under multiple `entity_type` values (e.g., "ABC" as both clinic and doctor), they appear identically. The real issue is likely that no entities exist with different types, so the admin fallback at lines 299-307 shows all entities of each type — but the entity_type filter IS being applied. The actual bug: the `key` prop on SelectItem uses `e.entity_name` which could collide across types.

**Fix**: Verify the filter logic is correct and add `entity_type` prefix to keys to prevent collision. Also check the actual data in the database.

### 3. Request Type and Request Items are redundant/confusing
Currently there are TWO places to specify request types:
- The "Request Type" single-select dropdown (line 583) — picks ONE type and loads its work order form
- The "Request Items" section (line 660) — lets you add multiple items with qty/rate

These serve different purposes but the user sees duplication. The intended flow is: Request Items is the billable line items list; Request Type is the primary work order type that loads dynamic form fields.

**Fix**: 
- Make "Request Type" the primary selector that ALSO auto-adds to Request Items when selected
- When a request type is selected, auto-add it to `selectedRequestTypes` if not already there
- Remove hardcoded items ("Aligner Treatment", "Retainer", "Refinement") from the Request Type dropdown since they should come from presets
- When multiple request items are added, show their work order forms in side-by-side tabs

### 4. Accepting a case from SubmittedCases list does NOT convert to project
In `SubmittedCases.tsx` line 92-100, `updateStatus` just does a bare status update — it does NOT call `convertCaseToProject`. The conversion only happens:
- From CaseSubmission detail view `updateStatus` (line 233-242)
- From SubmittedCases `convertToCase` button (line 112-126) — but this only shows for accepted cases that don't have a patient_id yet

**Root cause**: Accepting from the list view only changes the status text — no project/phase/plan is created. The "Convert to Case" button appears afterward but requires a second click.

**Fix**: In `SubmittedCases.tsx`, when status changes to 'accepted', also call `convertCaseToProject` to create the project/phase/plan/invoice in one step, same as the detail view does.

### 5. Work order form tabs for multiple request items
Currently only one work order form shows based on `formData.request_type`. When multiple request items are added, their respective work order forms should appear in tabs.

**Fix**: Render a tab per request item that has a linked work order preset, showing each form side by side.

## Implementation Plan

### Step 1: Fix patient search to show dropdown on focus
- `CaseSubmission.tsx`: When input is focused and search is empty, fetch first 10 patients (RBAC-scoped)
- Show the dropdown immediately on focus with all results
- Filter as user types

### Step 2: Fix entity dropdowns — remove hardcoded items from Request Type
- Remove hardcoded "Aligner Treatment", "Retainer", "Refinement", "Other" from the Request Type dropdown
- Only show `request_type` category presets
- Keep only `request_type` presets in Request Items selector too

### Step 3: Auto-sync Request Type with Request Items
- When user selects a Request Type, auto-add it to `selectedRequestTypes` if not already present
- `formData.request_type` becomes the first item's name for backward compatibility

### Step 4: Fix SubmittedCases accept → auto-convert
- In `SubmittedCases.tsx`, change the 'accepted' status action to call `convertCaseToProject` (same as CaseSubmission detail view)
- Remove the separate "Convert to Case" button since acceptance now handles it

### Step 5: Multi-item work order form tabs
- Instead of rendering one work order form based on `formData.request_type`, iterate through `selectedRequestTypes`
- For each item with a linked work order preset, render its form in a tab
- Store dynamic data keyed by request item index

### Step 6: Billing patient search dropdown
- Same fix as CaseSubmission: show all patients on focus, filter as user types

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/CaseSubmission.tsx` | Patient dropdown on focus, remove hardcoded request types, auto-sync request type ↔ request items, multi-item work order tabs |
| `src/pages/SubmittedCases.tsx` | Accept action calls `convertCaseToProject` directly |
| `src/pages/Billing.tsx` | Patient dropdown on focus |

## Technical Details

- Patient search: Change `if (patientSearch.length < 2)` to `if (!patientSearchFocused)` and fetch on focus with empty search loading first 10
- Request Items sync: `useEffect` watches `formData.request_type` changes and auto-adds to `selectedRequestTypes`
- SubmittedCases accept: Replace `updateStatus(c.id, 'accepted')` with a function that calls `convertCaseToProject(c, presets, user.id)` then updates local state
- Work order tabs: Map over `selectedRequestTypes`, find linked work order preset for each, render in `<Tabs>`

