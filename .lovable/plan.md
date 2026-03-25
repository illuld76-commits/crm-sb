

# Comprehensive Enhancement Plan for inkd-Portal

This plan addresses all 17 issues raised, organized into implementable batches.

---

## Batch A: Media Preview & File Management Fixes (Issues 2, 3, 4, 10)

**Problem:** Clicking images/media in published plan links and chat doesn't open a larger preview. Admin lacks view/download toggle controls globally. No global asset browser.

**Changes:**
- **ReportView.tsx**: Wrap image sections in clickable handlers that open `FilePreviewModal` with close-on-Esc support (already exists in modal component).
- **CommunicationHub.tsx**: Add click-to-preview on chat attachment thumbnails using `FilePreviewModal`. Add Esc/close button support.
- **PatientDetail.tsx (Assets tab)**: Add click-to-preview on asset thumbnails. Admin view/download toggles already exist (lines 928-941) -- verify they work for all asset types.
- **New page: GlobalAssets.tsx**: A searchable, filterable global asset browser page with live search, category filter, and file type filter. Admin can bulk-toggle view/download. Add route `/assets` and sidebar link.

---

## Batch B: Dashboard & Plan Editor Fixes (Issues 1, 12)

**Problem:** Publish arrow button missing in dashboard expanded case view. Plans editable immediately on open, risking accidental changes.

**Changes:**
- **Dashboard.tsx (renderExpandedPhases)**: Add share/publish button for published plans (currently only shows `Copy` icon for report link but no publish action arrow). Restore the external link / share icon.
- **PlanEditor.tsx**: Add a read-only mode by default. When plan status is `published` or `saved`, load in view mode. Show an "Edit" button to unlock editing. Track `isEditing` state.

---

## Batch C: Activity Timeline Fix (Issue 5)

**Problem:** Timeline doesn't show audit logs with user IDs for the specific case.

**Changes:**
- **PatientDetail.tsx**: The audit log fetch currently filters by `target_id = patient.id`. Expand query to also include logs where `target_type` is `plan`, `phase`, `case_request`, `invoice`, etc. AND the target belongs to this case (join via phase/plan IDs). Display `user_id` alongside `user_name` in timeline entries.

---

## Batch D: Mobile Responsiveness Audit (Issue 5b)

**Problem:** Not all modules are mobile-compatible.

**Changes across all pages:**
- **Dashboard.tsx**: KPI row already `grid-cols-2 lg:grid-cols-4` (good). Ensure filter bar wraps on mobile. Case cards already responsive.
- **GlobalKanban.tsx**: Add horizontal scroll for Kanban columns on mobile. Make cards stack properly.
- **BillingList.tsx / Billing.tsx**: Ensure invoice cards and form inputs are full-width on mobile. Invoice detail sheet should be full-screen on mobile.
- **ReportView.tsx / JourneyView.tsx**: Already responsive; verify media sections.
- **PatientDetail.tsx**: Tab list should scroll horizontally on mobile (5 tabs). Phase tree should be collapsible.
- **Messages.tsx**: Split view (conversation list + chat) should stack vertically on mobile.
- **SubmittedCases.tsx**: Cards should be full-width on mobile.
- **BottomNav.tsx**: Already exists for mobile -- verify all key routes accessible.

---

## Batch E: Case Request Existing Patient Dropdown (Issue 6)

**Problem:** When creating a case request for an existing patient, no dropdown/live search appears.

**Changes:**
- **CaseSubmission.tsx**: The patient search already exists (lines 41-44, 78-80) but needs improvement. Replace the text-input-based search with a proper searchable Select/Combobox component that shows matching patients as a dropdown list on 2+ character input. Show patient name, doctor, and clinic in results.

---

## Batch F: RBAC Verification & Additional User Assignment (Issues 7, 8)

**Problem:** Need to verify RBAC is consistent. Admin should be able to assign additional users to cases.

**Changes:**
- **RBAC audit**: Verify all data-fetching pages filter by `checkAccess()` for non-admin users. Key pages: Dashboard, GlobalKanban, BillingList, Messages, SubmittedCases.
- **PatientDetail.tsx**: Add "Assign Additional User" button for admin. Shows a user picker (from profiles) to set `primary_user_id` or `secondary_user_id`, or create a new `user_assignments` record linking user to this patient/clinic/doctor/lab/company. This user then gets RBAC-based access.
- **TeamManagement.tsx**: Enhance assignment creation to support assigning to additional entities beyond current types.

---

## Batch G: Relational Navigation & Archives Completeness (Issue 9)

**Problem:** Cross-entity navigation missing. Archives don't show all deleted entity types.

**Changes:**
- **RelationalPreviewDrawer.tsx**: Enhance to support previewing invoices, case requests, plans, phases, and communications. Add clickable links/badges throughout the app that call `openPreview()`.
- **AdminArchives.tsx**: Already handles cases, plans, phases, case_requests, entities, invoices, assets. Add support for: deleted users (soft-delete profiles), deleted communications, deleted work orders. Add bulk select with checkboxes for multi-restore/delete.
- **Audit logs**: Enhance `logAction` calls throughout the app to include richer `target_type` and `target_name` for better activity tracking.

---

## Batch H: Audio Transcription Fix (Issue 11)

**Problem:** Speech-to-text transcript quality is poor.

**Changes:**
- **AudioRecorder.tsx**: Currently calls a Supabase edge function `transcribe-audio`. The issue is likely the edge function implementation. Options:
  1. Use the Web Speech API (`webkitSpeechRecognition`) as a client-side fallback for real-time transcription.
  2. Improve the edge function to use a better STT model (e.g., ElevenLabs Scribe or OpenAI Whisper).
- Add a note in the UI that transcription can be manually edited before approval (already exists).

---

## Batch I: Messages Read/Unread & Search (Issue 13)

**Problem:** No read/unread logic for messages. No live search filter.

**Changes:**
- **Database**: Add `read_by` jsonb column to `communications` table (or a separate `message_reads` table with `user_id` + `message_id`).
- **Messages.tsx**: Implement read/unread badge on conversation list. Mark as read when conversation is opened. Add live search filter input to filter conversations by patient name or message content.
- **CommunicationHub.tsx**: Mark messages as read on view.

---

## Batch J: Remark Attachments & User Kanban Access (Issues 14, 15)

**Problem:** Users can't add attachments to workbench remarks. Users can't access Kanban for their own cases.

**Changes:**
- **PatientDetail.tsx (Workbench remarks)**: Add file attachment support to the remark input. Upload to Supabase storage, store attachment metadata in remark record or a linked table.
- **GlobalKanban.tsx**: Remove admin-only restriction. Non-admin users see only their RBAC-accessible cases/plans. Add case request view-only cards. Add approve/reject toggle for plans (updates plan status).
- **Dashboard for users**: Add expandable case list view with phase/plan tree navigation. Users can view and share published plan links.

---

## Batch K: Plan Presets & Work Order Linking (Issue 16)

**Problem:** Plan presets should be manageable in Presets section. Work orders should link to plan presets.

**Changes:**
- **PresetForms.tsx**: Add a "Plan Presets" tab alongside existing presets. Admin can create/edit plan preset templates (aligner, orthodontic, etc.) with default sections.
- **CaseSubmission.tsx**: When linking to existing case, show a work order name input. When a work order type is selected, auto-apply the corresponding plan preset.
- **WorkOrderDetail.tsx**: Link work orders to plan presets. Show which preset was used.

---

## Batch L: Notifications Verification (Issue 17)

**Problem:** Confirm notifications are working.

**Changes:**
- Verify `sendNotification()` calls exist at all key action points: case request submission, acceptance, plan publish, message received, @mention, invoice creation.
- Verify `NotificationBell` component fetches and displays unread notifications.
- Verify `Notifications.tsx` page shows full notification history.

---

## Implementation Priority Order

1. **Batch B** (Dashboard fix + Plan edit lock) -- quick fixes
2. **Batch A** (Media preview) -- high-impact UX
3. **Batch C** (Timeline fix) -- data correctness
4. **Batch E** (Patient dropdown) -- workflow fix
5. **Batch D** (Mobile audit) -- across all modules
6. **Batch F** (RBAC + user assignment) -- access control
7. **Batch G** (Relational nav + archives) -- large scope
8. **Batch I** (Messages read/unread) -- communication
9. **Batch J** (Remarks attachments + user Kanban) -- user features
10. **Batch H** (Audio transcription) -- quality improvement
11. **Batch K** (Plan presets + work orders) -- advanced workflow
12. **Batch L** (Notifications check) -- verification

---

## Technical Notes

- **Files modified**: ~15 existing files, ~2 new files (GlobalAssets page, message_reads migration)
- **Database migrations needed**: `message_reads` table, `read_by` or similar for communications, plan presets table
- **No backend changes**: All logic stays client-side with Supabase queries
- **Mobile approach**: Use Tailwind responsive classes (`sm:`, `md:`, `lg:`) and `overflow-x-auto` for horizontal scroll on Kanban

