

# Phase 3 — Comprehensive Gap Fix & Missing Feature Implementation

Based on thorough analysis of the current codebase against all stated requirements, here is what is missing, incomplete, or broken.

---

## Issues Found

### A. ClientDashboard RBAC Race Condition
`ClientDashboard.tsx` line 90 calls `fetchData()` on mount (`useEffect(() => { fetchData(); }, [])`) without waiting for `useUserScope` to finish loading. The `canAccessPatient` function returns incorrect results during the loading phase, potentially showing zero patients. The network data confirms the user has patient "sample" with clinic "MKDBC" and assignment to "MKDBC", but the dashboard may filter it out if scope loads after the fetch.

**Fix:** Add `scopeLoading` guard identical to what was done in `Dashboard.tsx`.

### B. Dashboard Activity Timeline — Empty
The admin `Dashboard.tsx` has KPI cards but NO activity timeline or recent activity feed. The `ClientDashboard` has one via comms + notifications, but the admin dashboard is missing this entirely.

**Fix:** Add an "Activity" tab or section to `Dashboard.tsx` fetching from `audit_log` and `notifications`.

### C. Dashboard List View — No Expandable Rows
In the admin Dashboard list view (table mode), clicking a row navigates to PatientDetail but there's no inline expand button to show phases/plans like in grid mode. The `renderExpandedPhases` function is only called inside grid card rendering.

**Fix:** Add expand/collapse toggle to list view rows showing phases and plans inline.

### D. Kanban — Non-Admin Can't See Published Plans
Network data shows user has role "user" with clinic assignment "MKDBC". The Kanban query at line 75 fetches patients but the RBAC filter at line 100-103 uses `canAccessPatient(p._patient)`. The patient has `clinic_name: "MKDBC"` and user has assignment to "MKDBC", so this should work. However, the `case_requests` filter at line 109 uses `c.user_id === user?.id` which is correct. The actual issue: plans with status "published" should show approve/reject buttons for non-admin (already exists at line 371). Need to verify the plan card shows for non-admin — the plan "dental form test" is status "published" and should appear. The patient query needs to include `clinic_name` etc. for `checkAccess` — already does at line 75. This looks functional.

BUT: The `phases` query at line 76 doesn't filter `is_deleted`. Plans from deleted phases may show.

**Fix:** Add `.eq('is_deleted', false)` to phases query in Kanban.

### E. Messages RBAC — No User Scope Filtering
`Messages.tsx` fetches all communications without RBAC filtering. Non-admin users can see messages from all cases.

**Fix:** Filter conversations by scoped patient IDs.

### F. GlobalAssets RBAC — No User Scope Filtering
`GlobalAssets.tsx` fetches all plan_sections and case_requests without RBAC. Non-admin users can see all files.

**Fix:** Filter assets by scoped patients.

### G. Missing Task Management UI
`types.ts` defines `Task` interface but no task UI exists anywhere. This was identified earlier but never built.

**Fix:** Add a Tasks tab in `PatientDetail.tsx` with CRUD for tasks per project.

### H. Plan Sovereignty — Draft Plans Visible to Non-Admin
Non-admin users can currently see draft plans in `PatientDetail.tsx` and `ClientDashboard.tsx`. Only published/ongoing/approved/rejected plans should be visible to non-admin users.

**Fix:** Filter plans in ClientDashboard and PatientDetail for non-admin to exclude "draft" status.

### I. Real-Time Notification Bell
`NotificationBell.tsx` likely fetches on mount only. No Supabase realtime subscription.

**Fix:** Add realtime subscription for notifications table.

### J. SubmittedCases — No Grid/List Toggle
`SubmittedCases.tsx` only has list view, no grid/list toggle.

**Fix:** Add view toggle consistent with other pages.

---

## Implementation Plan

### 1. Fix ClientDashboard RBAC Loading Guard
**File:** `src/pages/ClientDashboard.tsx`
- Import `useUserScope` loading state
- Change `useEffect(() => { fetchData(); }, [])` to guard with `if (scopeLoading) return;` and depend on `[scopeLoading]`

### 2. Add Activity Timeline to Admin Dashboard
**File:** `src/pages/Dashboard.tsx`
- Add an "Activity" section below KPI cards
- Fetch from `audit_log` table (latest 20 entries) 
- Render as a simple timeline with action, target_name, user_name, created_at

### 3. Add Expand/Collapse to Dashboard List View
**File:** `src/pages/Dashboard.tsx`
- In the list view table rows, add an expand button that shows `renderExpandedPhases(p.id)` inline beneath the row

### 4. Filter Draft Plans for Non-Admin
**File:** `src/pages/ClientDashboard.tsx`
- Filter `plans` to exclude `status === 'draft'` for non-admin users in the enrichedPlans mapping

**File:** `src/pages/PatientDetail.tsx`
- In plan rendering, hide draft plans from non-admin users (only show published, ongoing, approved, rejected, completed, hold)

### 5. Messages RBAC Scoping
**File:** `src/pages/Messages.tsx`
- Import `useUserScope` and filter conversations to only include case_ids belonging to scoped patients

### 6. GlobalAssets RBAC Scoping
**File:** `src/pages/GlobalAssets.tsx`
- Import `useUserScope` and filter plan_sections + case_requests to only scoped patients for non-admin users

### 7. Kanban Phases Filter Fix
**File:** `src/pages/GlobalKanban.tsx`
- Add `.eq('is_deleted', false)` to the phases query

### 8. Task Management UI
**File:** `src/pages/PatientDetail.tsx`
- Add a "Tasks" sub-section in the Activity tab or as a new tab
- CRUD: create task with title, description, assignee (dropdown from allProfiles), due_date, status
- Display as a checklist with status toggles
- Requires creating `tasks` table via migration (id, patient_id, title, description, assigned_to, due_date, status, created_at, created_by)

### 9. SubmittedCases Grid/List Toggle
**File:** `src/pages/SubmittedCases.tsx`
- Add `viewMode` state and grid/list toggle button
- Add grid card rendering for case requests

### 10. NotificationBell Realtime
**File:** `src/components/NotificationBell.tsx`
- Add Supabase realtime subscription on `notifications` table filtered by user_id

---

## Files Modified

1. `src/pages/ClientDashboard.tsx` — RBAC guard, filter draft plans
2. `src/pages/Dashboard.tsx` — activity timeline, list view expand
3. `src/pages/GlobalKanban.tsx` — phases is_deleted filter
4. `src/pages/Messages.tsx` — RBAC scoping
5. `src/pages/GlobalAssets.tsx` — RBAC scoping
6. `src/pages/PatientDetail.tsx` — draft plan filtering, task UI
7. `src/pages/SubmittedCases.tsx` — grid/list toggle
8. `src/components/NotificationBell.tsx` — realtime subscription
9. New migration — `tasks` table

## Implementation Order

1. ClientDashboard RBAC fix + draft plan filter (immediate visibility fix)
2. Dashboard activity timeline + list view expand
3. Kanban phases filter
4. Messages + GlobalAssets RBAC scoping
5. Draft plan sovereignty in PatientDetail
6. SubmittedCases grid/list toggle
7. NotificationBell realtime
8. Task management (migration + UI)

