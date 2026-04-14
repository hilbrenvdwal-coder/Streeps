import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const rawCode = url.searchParams.get('code') ?? ''
    const code = rawCode.replace(/[^A-Za-z0-9\-_]/g, '').toLowerCase()

    if (!code || code.length < 4 || code.length > 64) {
      return new Response(
        JSON.stringify({ error: 'invalid_code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: group, error } = await supabase
      .from('groups')
      .select('id, name, avatar_url')
      .eq('invite_code', code)
      .maybeSingle()

    if (error) {
      console.error('DB error:', error)
      return new Response(
        JSON.stringify({ error: 'db_error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!group) {
      return new Response(
        JSON.stringify({ error: 'not_found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const memberCount = await supabase
      .from('group_members')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', group.id)

    return new Response(
      JSON.stringify({
        id: group.id,
        name: group.name,
        avatar_url: group.avatar_url,
        member_count: memberCount.count ?? 0,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Handler error:', err)
    return new Response(
      JSON.stringify({ error: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
