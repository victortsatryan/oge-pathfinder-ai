-- Bootstrap: promote the only existing user to admin so Pathy Studio is accessible.
INSERT INTO public.user_roles (user_id, role)
SELECT 'd194296d-b993-43c5-a3f5-ffa14a18580a'::uuid, 'admin'::app_role
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = 'd194296d-b993-43c5-a3f5-ffa14a18580a'::uuid AND role = 'admin'::app_role
);