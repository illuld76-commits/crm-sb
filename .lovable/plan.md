
Goal: fix the three broken areas without regressing working modules, and align the case lifecycle with the intended relational workflow: Case Request → Project (Patient) → Phase → Plan → Publish → Billing.

1. Confirmed root causes from the current code

- CRM Contacts cannot add clinics/labs/doctors/companies
  - `src/pages/Settings.tsx` inserts `user_id` into `settings_entities`, but the table has no `user_id` column.
  - The page also hard-deletes records, while the table already supports `is_deleted` soft delete.
  - Result: add/delete actions can fail or behave inconsistently.

- Dental chart range selection is unreliable
  - `ToothChartSelector.tsx` uses a brittle shift-click implementation tied to `onClick` and a single `lastClickedTooth` anchor.
  - It needs deterministic range-anchor logic per arch and safer event handling for SVG interaction.

- Case request flow is incomplete and partly misleading
  - `CaseSubmission.tsx` only supports a single `request_type` string even though the UI state hints at multi-item/request support.
  - It does not capture the required “request name + request type + qty + billing linkage” flow.
  - It does not check Supabase insert/update errors before showing success and navigating away.
  - Conversion logic is duplicated in two places, and the list-page conversion is much weaker than the detail-page conversion.
  - `SubmittedCases.tsx` list visibility is too narrow for non-admin users (`user_id` only), so related users may not see relevant requests.
  - Conversion from request to project/phase/plan is not consistently triggered from the main review flow.

2. Implementation phases

Phase A — Stabilize data writes and visibility
- Fix `Settings.tsx`
  - remove invalid `user_id` field from inserts
  - switch delete to soft delete via `is_deleted = true`
  - only fetch non-deleted entities
  - surface backend errors properly
- Fix `CaseSubmission.tsx`
  - check every insert/update/upload result and stop on failure
  - only show success after confirmed persistence
  - ensure submitted requests always appear in `SubmittedCases` and sidebar panes
- Fix `SubmittedCases.tsx` and sidebar data loading
  - use RBAC-aware filtering instead of `user_id` only
  - include owner/assignment/company-first visibility rules

Phase B — Rebuild the case request model around your real workflow
- Extend case request structure to support:
  - `request_name`
  - linked existing patient or new patient creation path
  - one or more request items with:
    - request type
    - qty
    - linked preset/item pricing snapshot
- Preserve current preset engine and reuse it instead of replacing it.
- Add a structured request payload so billing can be created from the request itself, not guessed later.

Target flow:
```text
Case Request
  ├─ request_name
  ├─ patient = existing patient OR new project/patient details
  ├─ request_items[]
  │    ├─ request_type
  │    ├─ qty
  │    ├─ rate snapshot
  │    └─ linked preset ids
  ├─ work order dynamic form data
  └─ attachments
        ↓
Convert / Accept
        ↓
Project (Patient)
  └─ Phase named from request
       └─ Plan(s) created from linked presets
            ↓
Billing draft created from request_items
```

Phase C — Make request conversion authoritative and reusable
- Create one shared conversion path used by:
  - case detail review screen
  - submitted cases list actions
  - any future approval action
- Conversion responsibilities:
  - create patient if missing, or attach to selected existing patient
  - create phase named from request
  - create linked treatment plan(s) from request type presets
  - copy request attachments into central assets
  - persist relation ids back on `case_requests`
  - generate draft billing rows from request item qty/rate snapshot
- Remove duplicated conversion logic between `CaseSubmission.tsx` and `SubmittedCases.tsx`.

Phase D — RBAC and company-first corrections
- Update case request visibility using existing company-first utilities:
  - admins: all
  - non-admins: own requests, linked patient owners, assigned users, and company peers where relevant
- Reuse this consistently in:
  - case request list
  - patient dropdown search
  - conversion target selection
  - downstream project visibility
- Keep admin assignment unrestricted; non-admin assignment remains peer/admin scoped.

Phase E — Dental chart reliability fix
- Replace current shift-select behavior with:
  - explicit anchor tooth tracking
  - arch identity comparison by membership, not fragile reference behavior
  - `onMouseDown`/pointer-safe handling for SVG teeth
  - optional deselect-range logic that mirrors normal multi-select expectations
- Preserve existing permanent/deciduous chart, legend, and read-only rendering.

Phase F — Billing linkage and project continuity
- When a request is submitted, store billing-relevant request items immediately.
- When converted/accepted:
  - create or update draft invoice from stored request items and qty
  - keep invoice editable later
  - continue CRM auto-population for clinic/doctor/lab/company details
- Ensure future plan approval/publish can still modify billing without losing the original request snapshot.

3. Database changes required

Use schema migrations for structure only:
- `case_requests`
  - add `request_name`
  - add structured request items field (jsonb) for request type + qty + pricing snapshot
  - add ownership fields if missing for better downstream visibility
- potentially normalize secondary ownership where current schema is too limited (`patients.secondary_user_id` is singular while invoice logic already expects plural patterns elsewhere)
- add any needed indexes for request lookup and conversion queries

Data safety/RLS review:
- keep PII tables protected
- tighten broad `USING (true)` policies later, but first make the broken flows functional
- ensure all request/project/billing tables remain usable for authenticated users under company-first visibility

4. Files to update

- `src/pages/Settings.tsx`
- `src/components/ToothChartSelector.tsx`
- `src/pages/CaseSubmission.tsx`
- `src/pages/SubmittedCases.tsx`
- `src/components/Sidebar.tsx`
- `src/pages/PatientDetail.tsx`
- `src/pages/Billing.tsx`
- `src/hooks/useUserScope.tsx`
- `src/lib/access-control.ts`
- shared conversion utility to centralize request→project creation
- one new migration for request model improvements and any ownership normalization

5. QA checklist to prevent another broken cycle

- CRM Contacts
  - add/edit/delete clinic, doctor, lab, company
  - verify records reappear correctly and soft delete works
- Dental chart
  - single click, shift-range in upper/lower/permanent/deciduous
  - add selection, remove selection, read-only display
- Case request
  - new patient flow
  - existing patient search with RBAC and live search
  - request name + request type + qty + attachments save correctly
  - failed save shows error and does not navigate
- Request list and conversion
  - request visible after submit
  - admin can accept and convert from both detail and list views
  - project/phase/plan created exactly once
- Billing
  - draft invoice created from request items with qty
  - CRM details auto-filled
  - invoice still editable afterward
- RBAC
  - admin sees all
  - non-admin sees only allowed patients/requests/assignees/company peers

6. Technical notes

- Biggest immediate bug: success toasts/navigation currently happen even if request persistence fails.
- Biggest structural gap: the current `case_requests` model does not actually represent your intended work-order + qty + billing workflow.
- Best implementation strategy: fix writes first, then unify conversion, then layer the richer request/billing model on top so existing modules keep working while the flow becomes reliable.
