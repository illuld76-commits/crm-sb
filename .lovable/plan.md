

# Fix Request Items Dropdown Flickering & Outstanding Issues

## Problem 1: Request Items Dropdown Flickering (CRITICAL)

**Root cause identified from video and code analysis:**

The `useEffect` at line 165-177 depends on `presets`, which loads asynchronously (line 88). The sequence is:
1. Component mounts → `presets` is `[]`
2. User interacts with request item dropdowns
3. Presets finish loading → `setPresets(data)` triggers re-render
4. The auto-sync effect re-runs because `presets` changed
5. This calls `setSelectedRequestTypes(prev => ...)` — even if it returns `prev` unchanged, React schedules a state update check
6. The Select dropdown loses focus / re-renders = **flicker**

Additionally, the `createRequestTypeItem` function (line 60) generates a new `crypto.randomUUID()` every time it's called. If the auto-sync effect ever adds a new item, it creates a brand-new ID, causing React to unmount/remount that item's DOM.

**Fix:**
- Split preset loading into its own stable `useEffect` with a `presetsLoaded` ref
- Guard the auto-sync effect so it only runs ONCE per `request_type` change using a ref to track the last synced value
- This eliminates the re-render loop entirely

```typescript
const lastSyncedRequestType = useRef('');

useEffect(() => {
  if (!formData.request_type || formData.request_type === 'Other') return;
  if (formData.request_type === lastSyncedRequestType.current) return;
  if (presets.length === 0) return; // Wait for presets to load
  
  lastSyncedRequestType.current = formData.request_type;
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
```

## Problem 2: Auth Lock Warning (Console Spam)

The console shows repeated "Lock not released within 5000ms" warnings from Supabase auth. This is a known React Strict Mode issue. 

**Fix:** No code change needed — this is a development-only warning that doesn't affect production. The lock recovery mechanism works correctly.

## Problem 3: Previously Requested Items Still Pending

From the conversation history, these items were requested but may still need verification:

| Item | Status |
|------|--------|
| Entity dropdowns scoped by user assignments | Done (last edit) |
| Dashboard terminology Case → Project | Done |
| Billing email auto-population | Done |
| Billing phase suggestion | Done |
| Forgot password link | Done |
| Expenses RBAC | Done |
| Billing view-only for non-admin | Done |
| WorkOrderDetail/GlobalKanban/GlobalAssets terminology | Done |

No additional missing features identified beyond the flickering fix.

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/CaseSubmission.tsx` | Add `useRef` import, add `lastSyncedRequestType` ref, guard auto-sync effect to prevent re-runs |

