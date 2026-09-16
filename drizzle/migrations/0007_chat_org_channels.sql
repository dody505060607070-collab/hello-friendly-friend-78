-- Multi-company employee chat: Mithraa + Al-Rashoudi sharing one backend
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS org text NOT NULL DEFAULT 'mithraa';

ALTER TABLE public.group_messages
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'mithraa';

CREATE INDEX IF NOT EXISTS group_messages_channel_created_idx
  ON public.group_messages (channel, created_at);

CREATE OR REPLACE FUNCTION public.user_org(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((SELECT org FROM public.profiles WHERE id = _user_id), 'mithraa')
$$;

GRANT EXECUTE ON FUNCTION public.user_org(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "staff read group chat" ON public.group_messages;
CREATE POLICY "staff read group chat"
ON public.group_messages
FOR SELECT
TO authenticated
USING (
  is_staff(auth.uid())
  AND (
    channel = 'shared'
    OR channel = public.user_org(auth.uid())
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
);

DROP POLICY IF EXISTS "staff send group chat" ON public.group_messages;
CREATE POLICY "staff send group chat"
ON public.group_messages
FOR INSERT
TO authenticated
WITH CHECK (
  is_staff(auth.uid())
  AND sender_id = auth.uid()
  AND (
    channel = 'shared'
    OR channel = public.user_org(auth.uid())
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
);
