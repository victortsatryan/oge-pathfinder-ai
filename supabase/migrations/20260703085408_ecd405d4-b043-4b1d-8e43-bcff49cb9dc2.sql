INSERT INTO public.user_roles (user_id, role)
VALUES ('f25018a4-b824-4322-86b5-62bfa58e974b'::uuid, 'admin'::app_role)
ON CONFLICT DO NOTHING;