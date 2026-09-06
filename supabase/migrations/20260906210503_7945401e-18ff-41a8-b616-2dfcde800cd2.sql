DROP POLICY IF EXISTS "read property images" ON public.property_images;
DROP POLICY IF EXISTS "read property videos" ON public.property_videos;
DROP POLICY IF EXISTS "read property guarantees" ON public.property_guarantees;

DROP POLICY IF EXISTS "public read images of visible properties" ON public.property_images;
DROP POLICY IF EXISTS "public read videos of visible properties" ON public.property_videos;
DROP POLICY IF EXISTS "public read guarantees of visible properties" ON public.property_guarantees;

CREATE POLICY "public read images of visible properties" ON public.property_images FOR SELECT TO anon
USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.is_visible AND p.status <> 'archived'));
CREATE POLICY "public read videos of visible properties" ON public.property_videos FOR SELECT TO anon
USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.is_visible AND p.status <> 'archived'));
CREATE POLICY "public read guarantees of visible properties" ON public.property_guarantees FOR SELECT TO anon
USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.is_visible AND p.status <> 'archived'));