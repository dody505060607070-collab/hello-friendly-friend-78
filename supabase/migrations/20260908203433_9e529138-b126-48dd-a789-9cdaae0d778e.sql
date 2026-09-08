ALTER TABLE public.group_messages REPLICA IDENTITY FULL;
ALTER TABLE public.activity_messages REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;