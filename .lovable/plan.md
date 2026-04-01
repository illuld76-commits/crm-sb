

# Fix Flickering Dropdowns & Cross-Module Audit

## Root Cause: Flickering Request Items Dropdown

**Line 165-177 in CaseSubmission.tsx**: The `useEffect` that auto-syncs `formData.request_type` into `selectedRequestTypes` has `selectedRequestTypes` in its dependency array. Every time a user changes a request item dropdown value, `setSelectedRequestTypes` fires → the effect re-runs → it checks and potentially modifies `selectedRequestTypes` again → re-render loop causing flicker.

**Fix**: Remove `selectedRequestTypes` from the dependency array. Use a ref or functional check inside the effect to avoid the loop.

## All Issues to Fix

### 1. CaseSubmission — Flickering Request Type/Items Dropdowns
- **Line 177**: Remove `selectedRequestTypes` from useEffect deps
- Use `setSelectedRequestTypes(prev => ...)` with a functional update that checks if the item already exists inside the updater, avoiding the dependency entirely

### 2. CaseSubmission — Request Type auto-add creates duplicates
- The same useEffect (line 165-177) can add duplicates because `selectedRequestTypes.some(rt => rt.name === formData.request_type)` runs with stale closure when the effect re-triggers
- Fix: Use functional `setSelectedRequestTypes(prev => { if (prev.some(...)) return prev; return [...prev, newItem]; })`

### 3. Dashboard Terminology — Remaining "Case" Labels
- `Dashboard.tsx` still has "All Cases", "Case archived", "Case deleted" etc.
- Replace with "Project" terminology

### 4. Billing — Phase fetch on prefill from query params
- When `prefillPatientId` is set via query params (line 163-171), phases are NOT fetched. Only `selectPatient()` and existing invoice load paths fetch phases.
- Fix: After setting prefill patient, also fetch phases

### 5. GlobalKanban / WorkOrderDetail / Messages / GlobalAssets — Terminology
- Remaining "Patient" references in UI labels need "Project" replacement

## Implementation Plan

### Step 1: Fix CaseSubmission flickering (CRITICAL)
In the useEffect at line 165-177, change to:
```typescript
useEffect(() => {
  if (!formData.request_type || formData.request_type === 'Other') return;
  setSelectedRequestTypes(prev => {
    if (prev.some(rt => rt.name === formData.request_type)) return prev;
    const preset = presets.find(p => p.category === 'request_type' && p.name === formData.request_type);
    return [...prev, createRequestTypeItem(
      formData.request_type,
      preset?.id || '',
      1,
      preset?.fee_usd || preset?.unit_price || 0,
    )];
  });
}, [formData.request_type, presets]);
// REMOVED selectedRequestTypes from deps — functional update handles it
```

### Step 2: Dashboard terminology
Replace "Case"/"Cases" with "Project"/"Projects" in visible UI strings in `Dashboard.tsx`.

### Step 3: Billing prefill phase fetch
After setting `prefillPatientId` (line 166), also fetch phases:
```typescript
if (prefillPatientId) {
  setPatientId(prefillPatientId);
  supabase.from('phases').select('id, phase_name').eq('patient_id', prefillPatientId)
    .eq('is_deleted', false).order('phase_order').then(({ data }) => {
      setPatientPhases(data || []);
    });
}
```

### Step 4: Remaining terminology cleanup
Quick pass through `GlobalKanban.tsx`, `WorkOrderDetail.tsx`, `Messages.tsx`, `GlobalAssets.tsx` — replace user-visible "Patient" labels with "Project".

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/CaseSubmission.tsx` | Fix flickering: remove `selectedRequestTypes` from useEffect deps, use functional update |
| `src/pages/Dashboard.tsx` | Terminology: Case → Project |
| `src/pages/Billing.tsx` | Fetch phases on prefill from query params |
| `src/pages/GlobalKanban.tsx` | Terminology cleanup |
| `src/pages/WorkOrderDetail.tsx` | Terminology cleanup |
| `src/pages/Messages.tsx` | Terminology cleanup |
| `src/pages/GlobalAssets.tsx` | Terminology cleanup |

