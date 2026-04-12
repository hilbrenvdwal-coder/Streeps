-- Phase 0 — RLS + index optimization
--
-- Wraps every direct auth.uid() call in RLS policies with (SELECT auth.uid())
-- so Postgres caches the value once per statement via initPlan, instead of
-- re-evaluating it per row. Also adds TO authenticated where missing and
-- indexes for the two chat-relevant foreign keys.
--
-- Safe to re-run: every policy is dropped + recreated, every index uses
-- CREATE INDEX IF NOT EXISTS, and the helper functions use CREATE OR REPLACE.

-- ─────────────────────────────────────────────────────────────────────
-- Helper functions — use (SELECT auth.uid()) internally
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_my_conversation_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT conversation_id FROM conversation_members WHERE user_id = (SELECT auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(check_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = check_group_id AND user_id = (SELECT auth.uid()) AND is_admin = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_member(check_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = check_group_id AND user_id = (SELECT auth.uid())
  );
$$;

-- ─────────────────────────────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id);

-- ─────────────────────────────────────────────────────────────────────
-- friendships
-- ─────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can see their own friendships" ON public.friendships;
CREATE POLICY "Users can see their own friendships" ON public.friendships
  FOR SELECT TO authenticated
  USING (((SELECT auth.uid()) = user_id) OR ((SELECT auth.uid()) = friend_id));

DROP POLICY IF EXISTS "Users can create friend requests" ON public.friendships;
CREATE POLICY "Users can create friend requests" ON public.friendships
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update friendships they received" ON public.friendships;
CREATE POLICY "Users can update friendships they received" ON public.friendships
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = friend_id);

DROP POLICY IF EXISTS "Users can delete their own friendships" ON public.friendships;
CREATE POLICY "Users can delete their own friendships" ON public.friendships
  FOR DELETE TO authenticated
  USING (((SELECT auth.uid()) = user_id) OR ((SELECT auth.uid()) = friend_id));

-- ─────────────────────────────────────────────────────────────────────
-- groups
-- ─────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "groups_insert" ON public.groups;
CREATE POLICY "groups_insert" ON public.groups
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = created_by);

DROP POLICY IF EXISTS "groups_select" ON public.groups;
CREATE POLICY "groups_select" ON public.groups
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = groups.id
        AND group_members.user_id = (SELECT auth.uid())
    )
    OR (SELECT auth.uid()) IS NOT NULL
  );

DROP POLICY IF EXISTS "groups_update" ON public.groups;
CREATE POLICY "groups_update" ON public.groups
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = groups.id
        AND group_members.user_id = (SELECT auth.uid())
        AND group_members.is_admin = true
    )
  );

-- ─────────────────────────────────────────────────────────────────────
-- group_members
-- ─────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "group_members_insert" ON public.group_members;
CREATE POLICY "group_members_insert" ON public.group_members
  FOR INSERT TO authenticated
  WITH CHECK (((SELECT auth.uid()) = user_id) OR is_group_admin(group_id));

DROP POLICY IF EXISTS "group_members_update" ON public.group_members;
CREATE POLICY "group_members_update" ON public.group_members
  FOR UPDATE TO authenticated
  USING (((SELECT auth.uid()) = user_id) OR is_group_admin(group_id));

-- ─────────────────────────────────────────────────────────────────────
-- drinks
-- ─────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "drinks_select" ON public.drinks;
CREATE POLICY "drinks_select" ON public.drinks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = drinks.group_id
        AND group_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "drinks_insert" ON public.drinks;
CREATE POLICY "drinks_insert" ON public.drinks
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = drinks.group_id
        AND group_members.user_id = (SELECT auth.uid())
        AND group_members.is_admin = true
    )
  );

DROP POLICY IF EXISTS "drinks_update" ON public.drinks;
CREATE POLICY "drinks_update" ON public.drinks
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = drinks.group_id
        AND group_members.user_id = (SELECT auth.uid())
        AND group_members.is_admin = true
    )
  );

-- ─────────────────────────────────────────────────────────────────────
-- tallies
-- ─────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "tallies_select" ON public.tallies;
CREATE POLICY "tallies_select" ON public.tallies
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = tallies.group_id
        AND group_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "tallies_insert" ON public.tallies;
CREATE POLICY "tallies_insert" ON public.tallies
  FOR INSERT TO authenticated
  WITH CHECK (
    (((SELECT auth.uid()) = user_id) AND ((SELECT auth.uid()) = added_by))
    OR EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = tallies.group_id
        AND group_members.user_id = (SELECT auth.uid())
        AND group_members.is_admin = true
    )
  );

DROP POLICY IF EXISTS "tallies_update" ON public.tallies;
CREATE POLICY "tallies_update" ON public.tallies
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = tallies.group_id
        AND group_members.user_id = (SELECT auth.uid())
        AND group_members.is_admin = true
    )
  );

-- ─────────────────────────────────────────────────────────────────────
-- settlements
-- ─────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "settlements_select" ON public.settlements;
CREATE POLICY "settlements_select" ON public.settlements
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = settlements.group_id
        AND group_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "settlements_insert" ON public.settlements;
CREATE POLICY "settlements_insert" ON public.settlements
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = settlements.group_id
        AND group_members.user_id = (SELECT auth.uid())
        AND group_members.is_admin = true
    )
  );

-- ─────────────────────────────────────────────────────────────────────
-- settlement_lines
-- ─────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "settlement_lines_select" ON public.settlement_lines;
CREATE POLICY "settlement_lines_select" ON public.settlement_lines
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.settlements s
      JOIN public.group_members gm ON gm.group_id = s.group_id
      WHERE s.id = settlement_lines.settlement_id
        AND gm.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "settlement_lines_insert" ON public.settlement_lines;
CREATE POLICY "settlement_lines_insert" ON public.settlement_lines
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.settlements s
      JOIN public.group_members gm ON gm.group_id = s.group_id
      WHERE s.id = settlement_lines.settlement_id
        AND gm.user_id = (SELECT auth.uid())
        AND gm.is_admin = true
    )
  );

DROP POLICY IF EXISTS "Users can mark own settlement lines as paid" ON public.settlement_lines;
CREATE POLICY "Users can mark own settlement lines as paid" ON public.settlement_lines
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ─────────────────────────────────────────────────────────────────────
-- tally_gifts
-- ─────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Group members can view gifts" ON public.tally_gifts;
CREATE POLICY "Group members can view gifts" ON public.tally_gifts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = tally_gifts.group_id
        AND group_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create gifts" ON public.tally_gifts;
CREATE POLICY "Users can create gifts" ON public.tally_gifts
  FOR INSERT TO authenticated
  WITH CHECK (giver_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Recipients can redeem gifts" ON public.tally_gifts;
CREATE POLICY "Recipients can redeem gifts" ON public.tally_gifts
  FOR UPDATE TO authenticated
  USING (recipient_id = (SELECT auth.uid()));

-- ─────────────────────────────────────────────────────────────────────
-- messages
-- ─────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "send messages" ON public.messages;
CREATE POLICY "send messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ─────────────────────────────────────────────────────────────────────
-- conversation_members
-- ─────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "update own membership" ON public.conversation_members;
CREATE POLICY "update own membership" ON public.conversation_members
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ─────────────────────────────────────────────────────────────────────
-- message_reactions
-- ─────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Members can view reactions" ON public.message_reactions;
CREATE POLICY "Members can view reactions" ON public.message_reactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.conversation_members cm ON cm.conversation_id = m.conversation_id
      WHERE m.id = message_reactions.message_id
        AND cm.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can add reactions" ON public.message_reactions;
CREATE POLICY "Users can add reactions" ON public.message_reactions
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can remove own reactions" ON public.message_reactions;
CREATE POLICY "Users can remove own reactions" ON public.message_reactions
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ─────────────────────────────────────────────────────────────────────
-- Foreign-key indexes (chat-relevant)
-- ─────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON public.message_reactions(user_id);
