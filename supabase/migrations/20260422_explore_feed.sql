-- ============================================================
-- Explore Feed: RPCs for follow feed, group suggestions, search
-- + extend get_public_group_info with follower_count
-- ============================================================

-- -------------------------------------------------------
-- 1. get_follow_feed
--    Returns recent tallies from groups the caller is a
--    member of OR follows. No user_id in output (privacy).
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_follow_feed(p_days_back integer DEFAULT 9)
RETURNS TABLE(
  group_id       uuid,
  group_name     text,
  group_avatar_url text,
  drink_id       uuid,
  drink_emoji    text,
  drink_name     text,
  created_at     timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    g.id                          AS group_id,
    g.name                        AS group_name,
    g.avatar_url                  AS group_avatar_url,
    d.id                          AS drink_id,
    d.emoji                       AS drink_emoji,
    d.name                        AS drink_name,
    t.created_at
  FROM public.tallies t
  JOIN public.groups  g ON g.id = t.group_id
  LEFT JOIN public.drinks d ON d.id = t.drink_id
  WHERE
    t.removed = false
    AND t.created_at >= now() - make_interval(days => p_days_back)
    AND t.group_id IN (
      -- groups where the caller is a member
      SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
      UNION
      -- groups the caller follows
      SELECT group_id FROM public.group_follows  WHERE user_id = auth.uid()
    )
  ORDER BY t.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_follow_feed(integer) TO authenticated;


-- -------------------------------------------------------
-- 2. get_group_suggestions
--    Groups where friends are member/follower, excluding
--    groups the caller is already a member/follower of.
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_group_suggestions(p_limit integer DEFAULT 4)
RETURNS TABLE(
  group_id         uuid,
  group_name       text,
  group_avatar_url text,
  member_count     integer,
  last_activity_at timestamptz,
  friend_names     text[],
  friend_count     integer,
  friends_relation text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH my_friends AS (
    -- All accepted friends of the caller (bidirectional)
    SELECT
      CASE WHEN f.user_id = auth.uid() THEN f.friend_id ELSE f.user_id END AS friend_uid,
      p.full_name
    FROM public.friendships f
    JOIN public.profiles p
      ON p.id = CASE WHEN f.user_id = auth.uid() THEN f.friend_id ELSE f.user_id END
    WHERE f.status = 'accepted'
      AND (f.user_id = auth.uid() OR f.friend_id = auth.uid())
  ),
  friend_groups AS (
    -- Groups where any friend is a member
    SELECT
      gm.group_id,
      mf.friend_uid,
      mf.full_name,
      'member'::text AS relation
    FROM public.group_members gm
    JOIN my_friends mf ON mf.friend_uid = gm.user_id
    UNION ALL
    -- Groups where any friend follows
    SELECT
      gf.group_id,
      mf.friend_uid,
      mf.full_name,
      'follower'::text AS relation
    FROM public.group_follows gf
    JOIN my_friends mf ON mf.friend_uid = gf.user_id
  ),
  excluded_groups AS (
    -- Groups the caller is already a member of OR follows
    SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
    UNION
    SELECT group_id FROM public.group_follows  WHERE user_id = auth.uid()
  ),
  aggregated AS (
    SELECT
      fg.group_id,
      COUNT(DISTINCT fg.friend_uid)::integer                         AS friend_count,
      ARRAY(
        SELECT DISTINCT fn2.full_name
        FROM friend_groups fn2
        WHERE fn2.group_id = fg.group_id
        ORDER BY fn2.full_name
        LIMIT 3
      )                                                               AS friend_names,
      CASE
        WHEN bool_or(fg.relation = 'member') AND bool_or(fg.relation = 'follower') THEN 'mixed'
        WHEN bool_or(fg.relation = 'member')   THEN 'member'
        ELSE 'follower'
      END                                                             AS friends_relation
    FROM friend_groups fg
    WHERE fg.group_id NOT IN (SELECT group_id FROM excluded_groups)
    GROUP BY fg.group_id
  )
  SELECT
    g.id                                                              AS group_id,
    g.name                                                            AS group_name,
    g.avatar_url                                                      AS group_avatar_url,
    (SELECT COUNT(*)::integer FROM public.group_members WHERE group_id = g.id) AS member_count,
    (SELECT MAX(t.created_at) FROM public.tallies t
     WHERE t.group_id = g.id AND t.removed = false)                  AS last_activity_at,
    a.friend_names,
    a.friend_count,
    a.friends_relation
  FROM aggregated a
  JOIN public.groups g ON g.id = a.group_id
  ORDER BY a.friend_count DESC,
           (SELECT MAX(t.created_at) FROM public.tallies t WHERE t.group_id = g.id AND t.removed = false) DESC NULLS LAST
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_group_suggestions(integer) TO authenticated;


-- -------------------------------------------------------
-- 3. search_groups_by_name
--    Case-insensitive ILIKE search. Starts-with ranked first.
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_groups_by_name(p_query text, p_limit integer DEFAULT 10)
RETURNS TABLE(
  id               uuid,
  name             text,
  avatar_url       text,
  member_count     integer,
  last_activity_at timestamptz,
  follower_count   integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    g.id,
    g.name,
    g.avatar_url,
    (SELECT COUNT(*)::integer FROM public.group_members WHERE group_id = g.id) AS member_count,
    (SELECT MAX(t.created_at) FROM public.tallies t
     WHERE t.group_id = g.id AND t.removed = false)                           AS last_activity_at,
    (SELECT COUNT(*)::integer FROM public.group_follows  WHERE group_id = g.id) AS follower_count
  FROM public.groups g
  WHERE g.name ILIKE '%' || p_query || '%'
  ORDER BY
    (g.name ILIKE p_query || '%') DESC,
    (SELECT COUNT(*) FROM public.group_members WHERE group_id = g.id) DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.search_groups_by_name(text, integer) TO authenticated;


-- -------------------------------------------------------
-- 4. Extend get_public_group_info — add follower_count
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_group_info(p_group_id uuid)
RETURNS TABLE(
  id               uuid,
  name             text,
  avatar_url       text,
  member_count     integer,
  last_activity_at timestamptz,
  follower_count   integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    g.id,
    g.name,
    g.avatar_url,
    (SELECT COUNT(*)::integer FROM public.group_members WHERE group_id = g.id),
    (SELECT MAX(created_at)   FROM public.tallies WHERE group_id = g.id AND removed = false),
    (SELECT COUNT(*)::integer FROM public.group_follows  WHERE group_id = g.id)
  FROM public.groups g
  WHERE g.id = p_group_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_group_info(uuid) TO authenticated;
