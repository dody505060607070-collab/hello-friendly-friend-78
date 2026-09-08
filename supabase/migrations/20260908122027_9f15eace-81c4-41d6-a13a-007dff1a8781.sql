ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS link_youtube text,
  ADD COLUMN IF NOT EXISTS link_tiktok text,
  ADD COLUMN IF NOT EXISTS link_instagram text,
  ADD COLUMN IF NOT EXISTS link_snapchat text,
  ADD COLUMN IF NOT EXISTS link_x text,
  ADD COLUMN IF NOT EXISTS link_facebook text,
  ADD COLUMN IF NOT EXISTS link_tour text;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS location_text text,
  ADD COLUMN IF NOT EXISTS location_lat numeric(10,7),
  ADD COLUMN IF NOT EXISTS location_lng numeric(10,7);