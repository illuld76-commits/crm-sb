-- 1. Create SECURITY DEFINER function to check roles (prevents recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 2. Drop recursive policies on user_roles
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- 3. Recreate with SECURITY DEFINER function
CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 4. Fix user_assignments recursive policy
DROP POLICY IF EXISTS "Admins can manage assignments" ON public.user_assignments;

CREATE POLICY "Admins can manage assignments"
ON public.user_assignments
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 5. Fix other tables that reference user_roles directly
DROP POLICY IF EXISTS "Admins can manage entities" ON public.settings_entities;
CREATE POLICY "Admins can manage entities"
ON public.settings_entities
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage templates" ON public.notification_templates;
CREATE POLICY "Admins can manage templates"
ON public.notification_templates
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage presets" ON public.presets;
CREATE POLICY "Admins can manage presets"
ON public.presets
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));