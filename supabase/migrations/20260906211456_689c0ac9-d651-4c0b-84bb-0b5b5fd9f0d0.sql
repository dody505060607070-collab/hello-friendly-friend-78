CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE cnt int;
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.email, NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;

  IF lower(COALESCE(NEW.email,'')) = 'dody505060607070@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin') ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;

  SELECT count(*) INTO cnt FROM public.user_roles;
  IF cnt = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $function$;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin' FROM auth.users WHERE lower(email) = 'dody505060607070@gmail.com'
ON CONFLICT DO NOTHING;

UPDATE public.app_settings SET
  company_name = 'الرشودي للعقارات',
  phone = '+966550818020',
  whatsapp_number = '966550818020',
  email = 'info@al-rashudi.com',
  address = 'بريدة، المملكة العربية السعودية',
  about = 'الرشودي للعقارات شركة رائدة في سوق العقارات ببريدة منذ أكثر من 8 سنوات، نقدم أفضل الخيارات السكنية والتجارية بخبرة واحترافية عالية.',
  social_links = '{"tiktok":"https://www.tiktok.com/@al_rashudi","whatsapp":"https://wa.me/966550818020","phone_alt":"+966573672226"}'::jsonb,
  updated_at = now();