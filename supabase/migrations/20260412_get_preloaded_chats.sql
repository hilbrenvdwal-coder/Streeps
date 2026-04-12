-- Phase 1 — get_preloaded_chats RPC
--
-- Returns all valid conversations for the current user with their
-- preview metadata (name, avatar, last message, unread count) AND the
-- newest p_messages_per_chat messages per chat, all in a single
-- round-trip. Replaces the ~7 sequential queries that useConversations
-- currently does, and seeds the client preload cache so opening a
-- chat is instant after the overview loads.
--
-- Safe to re-run: CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.get_preloaded_chats(p_messages_per_chat int DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  WITH my_convs AS (
    SELECT
      c.id,
      c.type,
      c.group_id,
      c.created_at AS conv_created_at,
      cm.last_read_at,
      g.name AS group_name,
      g.avatar_url AS group_avatar
    FROM public.conversation_members cm
    JOIN public.conversations c ON c.id = cm.conversation_id
    LEFT JOIN public.groups g ON g.id = c.group_id
    WHERE cm.user_id = v_user_id
      AND (
        c.type <> 'group'
        OR EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.group_id = c.group_id AND gm.user_id = v_user_id
        )
      )
  ),
  conv_with_other AS (
    SELECT
      mc.*,
      CASE
        WHEN mc.type = 'group' THEN NULL::uuid
        ELSE (
          SELECT cm2.user_id FROM public.conversation_members cm2
          WHERE cm2.conversation_id = mc.id AND cm2.user_id <> v_user_id
          LIMIT 1
        )
      END AS other_user_id
    FROM my_convs mc
  ),
  conv_with_profile AS (
    SELECT
      cwo.*,
      p.full_name AS other_full_name,
      p.avatar_url AS other_avatar_url
    FROM conv_with_other cwo
    LEFT JOIN public.profiles p ON p.id = cwo.other_user_id
  ),
  conv_final AS (
    SELECT
      cwp.id,
      cwp.type,
      cwp.group_id,
      cwp.other_user_id,
      COALESCE(cwp.group_name, cwp.other_full_name, 'Onbekend') AS name,
      COALESCE(cwp.group_avatar, cwp.other_avatar_url) AS avatar_url,
      -- Last message info
      (
        SELECT jsonb_build_object(
          'content', lm.content,
          'created_at', lm.created_at,
          'user_id', lm.user_id,
          'sender_name', (SELECT pp.full_name FROM public.profiles pp WHERE pp.id = lm.user_id)
        )
        FROM public.messages lm
        WHERE lm.conversation_id = cwp.id
        ORDER BY lm.created_at DESC
        LIMIT 1
      ) AS last_message_obj,
      COALESCE(
        (SELECT MAX(lm.created_at) FROM public.messages lm WHERE lm.conversation_id = cwp.id),
        cwp.conv_created_at
      ) AS last_message_at,
      (
        SELECT COUNT(*)::int
        FROM public.messages um
        WHERE um.conversation_id = cwp.id
          AND um.user_id <> v_user_id
          AND um.created_at > COALESCE(cwp.last_read_at, '1970-01-01'::timestamptz)
      ) AS unread,
      -- Newest N messages with profile join, ordered newest-first
      (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'id', m.id,
            'conversation_id', m.conversation_id,
            'user_id', m.user_id,
            'content', m.content,
            'created_at', m.created_at,
            'message_type', m.message_type,
            'metadata', m.metadata,
            'profile', CASE
              WHEN p.id IS NOT NULL THEN jsonb_build_object(
                'id', p.id,
                'full_name', p.full_name,
                'avatar_url', p.avatar_url
              )
              ELSE NULL
            END
          ) ORDER BY m.created_at DESC
        ), '[]'::jsonb)
        FROM (
          SELECT *
          FROM public.messages
          WHERE conversation_id = cwp.id
          ORDER BY created_at DESC
          LIMIT p_messages_per_chat
        ) m
        LEFT JOIN public.profiles p ON p.id = m.user_id
      ) AS recent_messages
    FROM conv_with_profile cwp
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', cf.id,
      'type', cf.type,
      'group_id', cf.group_id,
      'other_user_id', cf.other_user_id,
      'name', cf.name,
      'avatar_url', cf.avatar_url,
      'last_message', cf.last_message_obj->>'content',
      'last_message_at', cf.last_message_at,
      'last_message_by', cf.last_message_obj->>'sender_name',
      'unread', cf.unread,
      'messages', cf.recent_messages
    ) ORDER BY cf.last_message_at DESC NULLS LAST
  ), '[]'::jsonb)
  INTO result
  FROM conv_final cf;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_preloaded_chats(int) TO authenticated;
