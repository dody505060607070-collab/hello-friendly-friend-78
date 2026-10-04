ALTER TABLE public.buildings
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'rent',
  ADD COLUMN IF NOT EXISTS floors_count integer,
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS is_visible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS map_url text;
UPDATE public.buildings SET code = 'B-' || upper(substr(replace(id::text,'-',''),1,6)) WHERE code IS NULL;
ALTER TABLE public.buildings ALTER COLUMN code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS buildings_code_key ON public.buildings (code);
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS floor text;
CREATE OR REPLACE FUNCTION public.get_public_buildings(_code text DEFAULT NULL, _purpose text DEFAULT NULL, _limit integer DEFAULT 60)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.sort_order ASC, r.created_at DESC), '[]'::jsonb)
  FROM (
    SELECT b.id, b.code, b.name, b.city, b.district, b.address, b.description,
      b.purpose, b.floors_count, b.cover_url, b.sort_order, b.created_at, b.latitude, b.longitude, b.map_url,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', p.id, 'code', p.code, 'name', p.name, 'floor', p.floor,
          'purpose', p.purpose, 'rent_period', p.rent_period, 'property_type', p.property_type,
          'status', p.status, 'price_text', p.price_text, 'price_value', p.price_value,
          'description', p.description, 'whatsapp_number', p.whatsapp_number,
          'city', p.city, 'district', p.district, 'link_tour', p.link_tour,
          'latitude', p.latitude, 'longitude', p.longitude,
          'images', COALESCE((SELECT jsonb_agg(jsonb_build_object('url', pi.url, 'is_cover', pi.is_cover, 'sort_order', pi.sort_order) ORDER BY pi.is_cover DESC, pi.sort_order ASC)
            FROM public.property_images pi WHERE pi.property_id = p.id), '[]'::jsonb)
        ) ORDER BY p.floor NULLS LAST, p.name)
        FROM public.properties p WHERE p.building_id = b.id AND p.is_visible AND p.status <> 'archived'
      ), '[]'::jsonb) AS units
    FROM public.buildings b
    WHERE b.is_visible AND (_code IS NULL OR b.code = _code) AND (_purpose IS NULL OR b.purpose = _purpose)
    ORDER BY b.sort_order ASC, b.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(_limit, 60), 1), 100)
  ) AS r;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_buildings(text, text, integer) TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.site_page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL CHECK (char_length(visitor_id) BETWEEN 8 AND 80),
  path text NOT NULL CHECK (char_length(path) BETWEEN 1 AND 500),
  referrer_host text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  visited_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.site_page_views TO anon, authenticated;
GRANT SELECT ON public.site_page_views TO authenticated;
GRANT ALL ON public.site_page_views TO service_role;
ALTER TABLE public.site_page_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "visitors record privacy safe page views" ON public.site_page_views;
CREATE POLICY "visitors record privacy safe page views" ON public.site_page_views FOR INSERT TO anon, authenticated WITH CHECK (user_id IS NULL OR user_id = auth.uid());
DROP POLICY IF EXISTS "authenticated staff view website analytics" ON public.site_page_views;
CREATE POLICY "authenticated staff view website analytics" ON public.site_page_views FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE INDEX IF NOT EXISTS site_page_views_visited_at_idx ON public.site_page_views(visited_at DESC);
CREATE INDEX IF NOT EXISTS site_page_views_path_visited_idx ON public.site_page_views(path, visited_at DESC);
CREATE INDEX IF NOT EXISTS site_page_views_visitor_visited_idx ON public.site_page_views(visitor_id, visited_at DESC);
CREATE INDEX IF NOT EXISTS contract_payments_status_due_date_idx ON public.contract_payments (status, due_date);
CREATE INDEX IF NOT EXISTS contract_payments_contract_status_idx ON public.contract_payments (contract_id, status);
CREATE INDEX IF NOT EXISTS invoices_status_created_at_idx ON public.invoices (status, created_at DESC);