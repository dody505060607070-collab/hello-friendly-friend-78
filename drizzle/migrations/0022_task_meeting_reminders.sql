ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS meeting_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS meeting_place text,
  ADD COLUMN IF NOT EXISTS meeting_notes text,
  ADD COLUMN IF NOT EXISTS meeting_owner_name text,
  ADD COLUMN IF NOT EXISTS meeting_owner_phone text,
  ADD COLUMN IF NOT EXISTS meeting_visitor_name text,
  ADD COLUMN IF NOT EXISTS meeting_visitor_phone text,
  ADD COLUMN IF NOT EXISTS meeting_agent_name text,
  ADD COLUMN IF NOT EXISTS meeting_agent_phone text,
  ADD COLUMN IF NOT EXISTS meeting_interval_hours integer NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS meeting_last_sent_at timestamptz;
CREATE INDEX IF NOT EXISTS tasks_meeting_enabled_idx ON public.tasks (meeting_enabled) WHERE meeting_enabled;