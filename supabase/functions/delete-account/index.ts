import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Verify JWT from Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Create a client with the user's JWT to verify identity
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const uid = user.id

    // 2. Service role client for admin operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 3a. Find groups where user is the only member → delete entire group cascade
    const { data: userGroups } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', uid)

    const soloGroupIds: string[] = []
    if (userGroups) {
      for (const gm of userGroups) {
        const { count } = await supabase
          .from('group_members')
          .select('id', { count: 'exact', head: true })
          .eq('group_id', gm.group_id)

        if (count === 1) {
          soloGroupIds.push(gm.group_id)
        }
      }
    }

    // Delete solo groups cascade
    for (const groupId of soloGroupIds) {
      // Delete tallies
      await supabase.from('tallies').delete().eq('group_id', groupId)
      // Delete drinks
      await supabase.from('drinks').delete().eq('group_id', groupId)
      // Delete settlement_lines (need settlement ids first)
      const { data: settlements } = await supabase
        .from('settlements')
        .select('id')
        .eq('group_id', groupId)
      if (settlements) {
        for (const s of settlements) {
          await supabase.from('settlement_lines').delete().eq('settlement_id', s.id)
        }
      }
      // Delete settlements
      await supabase.from('settlements').delete().eq('group_id', groupId)
      // Delete group_members
      await supabase.from('group_members').delete().eq('group_id', groupId)
      // Delete conversations + members + messages for this group
      const { data: convos } = await supabase
        .from('conversations')
        .select('id')
        .eq('group_id', groupId)
      if (convos) {
        for (const c of convos) {
          await supabase.from('messages').delete().eq('conversation_id', c.id)
          await supabase.from('conversation_members').delete().eq('conversation_id', c.id)
        }
        await supabase.from('conversations').delete().eq('group_id', groupId)
      }
      // Delete the group itself
      await supabase.from('groups').delete().eq('id', groupId)
    }

    // 3b. Find groups where user is the only admin but there are other members → promote oldest member
    if (userGroups) {
      for (const gm of userGroups) {
        if (soloGroupIds.includes(gm.group_id)) continue // already deleted

        // Check if user is admin in this group
        const { data: membership } = await supabase
          .from('group_members')
          .select('is_admin')
          .eq('group_id', gm.group_id)
          .eq('user_id', uid)
          .single()

        if (!membership?.is_admin) continue

        // Count other admins
        const { count: adminCount } = await supabase
          .from('group_members')
          .select('id', { count: 'exact', head: true })
          .eq('group_id', gm.group_id)
          .eq('is_admin', true)
          .neq('user_id', uid)

        if (adminCount === 0) {
          // Promote oldest non-admin member
          const { data: oldest } = await supabase
            .from('group_members')
            .select('user_id')
            .eq('group_id', gm.group_id)
            .neq('user_id', uid)
            .order('joined_at', { ascending: true })
            .limit(1)
            .single()

          if (oldest) {
            await supabase
              .from('group_members')
              .update({ is_admin: true })
              .eq('group_id', gm.group_id)
              .eq('user_id', oldest.user_id)
          }
        }
      }
    }

    // 4. Nullify user references in tallies
    await supabase.from('tallies').update({ user_id: null }).eq('user_id', uid)
    await supabase.from('tallies').update({ added_by: null }).eq('added_by', uid)
    await supabase.from('tallies').update({ removed_by: null }).eq('removed_by', uid)

    // 5. Nullify user references in settlement_lines
    await supabase.from('settlement_lines').update({ user_id: null }).eq('user_id', uid)

    // 6. Nullify user references in settlements
    await supabase.from('settlements').update({ created_by: null }).eq('created_by', uid)

    // 7. Nullify user references in messages
    await supabase.from('messages').update({ user_id: null }).eq('user_id', uid)

    // 8. Nullify user references in groups
    await supabase.from('groups').update({ created_by: null }).eq('created_by', uid)

    // 9. Delete tally_gifts
    await supabase.from('tally_gifts').delete().eq('giver_id', uid)
    await supabase.from('tally_gifts').delete().eq('recipient_id', uid)

    // 10. Delete friendships
    await supabase.from('friendships').delete().eq('user_id', uid)
    await supabase.from('friendships').delete().eq('friend_id', uid)

    // 11. Delete conversation_members
    await supabase.from('conversation_members').delete().eq('user_id', uid)

    // 12. Delete avatar storage
    const { data: avatarFiles } = await supabase.storage.from('avatars').list(uid)
    if (avatarFiles && avatarFiles.length > 0) {
      const filePaths = avatarFiles.map((f) => `${uid}/${f.name}`)
      await supabase.storage.from('avatars').remove(filePaths)
    }

    // 13. Delete the auth user (cascades to profiles → group_members)
    const { error: deleteError } = await supabase.auth.admin.deleteUser(uid)
    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
