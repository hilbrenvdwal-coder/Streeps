-- Feed Batch A — group_follows table + RLS + public group info RPC
--
-- Introduces a "follow" relationship between users and groups for the feed
-- (non-member public view). Binary follow (no update), soft constraint via
-- UNIQUE(user_id, group_id). Select is fully open to authenticated (needed
-- to compute follower counts and check if a user is following a given group
-- without extra RPC round-trips). Insert/delete restricted to the follower.
--
-- Also introduces a SECURITY DEFINER RPC `get_public_group_info` that
-- exposes the minimal public metadata about a group to non-members so the
-- feed can render group cards without leaking member-only data.

-- ─────────────────────────────────────────────────────────────────────
-- Table: public.group_follows
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE public.group_follows (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id    uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, group_id)
);

CREATE INDEX idx_group_follows_user_id  ON public.group_follows(user_id);
CREATE INDEX idx_group_follows_group_id ON public.group_follows(group_id);

ALTER TABLE public.group_follows ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────
-- RLS policies
-- Pattern: (SELECT auth.uid()) so Postgres caches the value per statement
-- ─────────────────────────────────────────────────────────────────────

CREATE POLICY "group_follows_select" ON public.group_follows
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "group_follows_insert" ON public.group_follows
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "group_follows_delete" ON public.group_follows
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- No UPDATE policy — follow is binary.

-- ─────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER RPC: get_public_group_info
-- Returns minimal group info for non-member display (feed cards).
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_public_group_info(p_group_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  avatar_url text,
  member_count integer,
  last_activity_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    g.id,
    g.name,
    g.avatar_url,
    (SELECT COUNT(*)::integer FROM public.group_members WHERE group_id = g.id),
    (SELECT MAX(created_at) FROM public.tallies WHERE group_id = g.id AND removed = false)
  FROM public.groups g
  WHERE g.id = p_group_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_group_info(uuid) TO authenticated;
