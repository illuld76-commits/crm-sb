

# RBAC-Scoped Dropdowns & Cross-Module Access Control

## Problem

Non-admin users see ALL doctors, clinics, and labs in dropdowns across the app, even when they are only assigned to one clinic. The `user_assignments` table already tracks who can see what, but no module uses it to filter dropdown options or restrict data access. Patient search also returns unscoped results.

## Solution: Create a shared RBAC context hook and apply it everywhere

### 1. New hook: `src/hooks/useUserScope.tsx`

A reusable hook that, for non-admin users:
- Fetches their `user_assignments` (clinic, doctor, lab, patient, company)
- Returns scoped lists: `allowedClinics`, `allowedDoctors`, `allowedLabs`, `allowedPatientIds`
- For admins, returns `null` (meaning "show all")
- Caches in state so it's fetched once per session

```
useUserScope() → {
  allowedClinics: string[] | null,  // null = admin, all access
  allowedDoctors: string[] | null,
  allowedLabs: string[] | null,
  allowedPatientIds: string[] | null,
  filterEntities: (entities, type) => filtered,
  canAccessPatient: (patient) => boolean,
  loading: boolean
}
```

### 2. CaseSubmission.tsx — Filter dropdowns

- Doctor dropdown: only show doctors from `allowedDoctors` (or all for admin)
- Clinic dropdown: only show clinics from `allowedClinics`
- Lab dropdown: only show labs from `allowedLabs`
- Patient search: filter results by `checkAccess()` for non-admins
- Auto-fill clinic/doctor from user's single assignment if they have exactly one

### 3. Billing.tsx — Filter patient search

- Patient search results filtered by user's assignments
- Phase/plan selection already scoped to selected patient, so that's fine

### 4. PatientDetail.tsx — Filter entity dropdowns

- Same pattern: doctor/clinic/lab dropdowns scoped to user's assignments
- Non-admin users can only edit entities they have access to

### 5. GlobalKanban.tsx, Messages.tsx, BillingList.tsx — Verify scoping

- Ensure queries filter by user's accessible patients/cases
- Already partially done via `checkAccess()` in Layout, but verify direct queries in these pages

### 6. Sidebar.tsx — Scoped navigation data

- Already uses Layout's filtered data — verify case requests pane also filters by user_id for non-admins

### 7. Auto-fill for single-assignment users

- If a user has exactly 1 clinic assignment, auto-set `clinic_name` in case request form and make it read-only
- Same for doctor/lab if they have exactly 1

## Files to modify

1. **New:** `src/hooks/useUserScope.tsx` — shared RBAC scope hook
2. `src/pages/CaseSubmission.tsx` — filter dropdowns + patient search + auto-fill
3. `src/pages/Billing.tsx` — filter patient search
4. `src/pages/PatientDetail.tsx` — filter entity dropdowns
5. `src/pages/GlobalKanban.tsx` — verify data scoping
6. `src/pages/BillingList.tsx` — verify data scoping

## Technical approach

- The hook reads from `user_assignments` (already exists) and `settings_entities`
- For admin users, no filtering is applied (all data visible)
- For non-admin users, dropdowns show only assigned entities
- Patient search adds a client-side filter using `checkAccess()` from `access-control.ts`
- No DB migrations needed — uses existing tables and columns

