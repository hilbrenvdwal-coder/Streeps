-- Chatbot personality presets per groep
-- Adds bot_settings JSONB for personality/behavior config, plus usage tracking
-- for the monthly API call limit. Default empty JSON = current bot behavior.

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS bot_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.groups.bot_settings IS
  'Chatbot personality presets and behavior config. Keys: humor, toon, taalregister, lengte, betrokkenheid, respond_to_gift_messages. NULL/missing keys = default (current behavior).';

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS bot_usage_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS bot_usage_month text;

COMMENT ON COLUMN public.groups.bot_usage_count IS
  'Number of Anthropic API calls made for this group in the current month (bot_usage_month). Auto-resets when bot_usage_month changes.';

COMMENT ON COLUMN public.groups.bot_usage_month IS
  'YYYY-MM string. Edge function compares against current month and resets bot_usage_count to 0 when it rolls over.';
