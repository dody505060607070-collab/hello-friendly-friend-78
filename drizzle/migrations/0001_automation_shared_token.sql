ALTER TABLE public.automation_config ADD COLUMN IF NOT EXISTS shared_token text;
UPDATE public.automation_config SET shared_token = encode(gen_random_bytes(24), 'hex') WHERE shared_token IS NULL;