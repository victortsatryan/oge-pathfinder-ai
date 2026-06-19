
CREATE OR REPLACE FUNCTION public.assign_self_role(_role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _role NOT IN ('student'::app_role, 'teacher'::app_role) THEN
    RAISE EXCEPTION 'Self-assignment allowed only for student or teacher';
  END IF;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), _role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_self_role(app_role) TO authenticated;
