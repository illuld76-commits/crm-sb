

# Fix Login & Admin Activation

## Root Cause Analysis

Three distinct issues prevent login:

1. **Password mismatch**: User `inkd@kdx.8shield.net` exists (id: `3a61331d-...`, email confirmed) but the password stored doesn't match what's being entered. The user was created during an earlier signup but likely with a different password. Login returns "Invalid login credentials."

2. **`/admin-activate` is behind ProtectedRoute**: In `App.tsx` line 75, the admin-activate route is nested inside `<ProtectedRoute><Layout />`, requiring authentication to access. The user can't reach it without logging in first — a catch-22.

3. **No admin role**: The `user_roles` table has zero rows for this user. Even after login, they'd have no admin access.

## Fix Plan

### Step 1: Reset the user's password via Edge Function
Create a small `reset-admin-password` edge function that uses the service role key to call `auth.admin.updateUserById()` and set a known password for the existing user. Invoke it once, then delete it.

### Step 2: Move `/admin-activate` to a public route
In `App.tsx`, move the admin-activate route outside the ProtectedRoute wrapper so it can be accessed without authentication:
```
<Route path="/admin-activate" element={<AdminActivate />} />
```
Place it alongside `/auth` as a top-level route.

### Step 3: Add first-admin bootstrap trigger
Create a migration with `handle_first_admin()` function + trigger on `profiles` table. If no admin exists when a profile is created, auto-assign admin role. This ensures the first user always becomes admin.

### Step 4: Insert admin role for existing user
The migration will also directly insert the admin role for user `3a61331d-dea4-421d-bca4-185f9a56112c` as a fallback.

### Step 5: Deploy edge functions
Ensure `create-user` and `validate-license` are deployed and functional.

## Files Modified
- `App.tsx` — Move admin-activate route outside ProtectedRoute
- New migration — Insert admin role + first-admin trigger
- New temp edge function — Reset password (deploy, invoke, delete)
- Deploy `create-user` and `validate-license` edge functions

