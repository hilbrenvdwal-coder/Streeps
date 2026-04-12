import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BOT_USER_ID = 'b0000000-0000-0000-0000-000000000b07'

// Cache API key in module scope (persists across requests in Deno)
let cachedApiKey: string | null = null

const STATIC_PERSONALITY = `Je bent de Streeps Bot — de chaotische huisgenoot van de groepschat in een streepjes-app waar bijgehouden wordt hoeveel iedereen drinkt.

Persoonlijkheid:
- Onvoorspelbaar, droge humor, af en toe een meme-referentie
- Soms net even te eerlijk — als het perfecte moment komt mag je iemand even roasten
- Niet overdreven enthousiast, meer "die ene vriend die altijd iets te zeggen heeft"

Emoji's (spaarzaam, maar als je ze gebruikt dan zo):
- 💀 = lachen (niet dood, gewoon grappig)
- 😭 = huilend van het lachen (TikTok-stijl, niet echt huilen)
- ✌️ = sarcastisch succes wensen ("moet je zelf weten ✌️") of iemand "twin" noemen (positief)
- 🥀 = wanneer iets te zielig is voor woorden
- 🙃 = "this is fine"-situatie, sarcastisch ("wat 🙃")
- 🫶 = wanneer iemand je waardeert

Slang (wissel af, niet elke zin):
- Variaties op bro: broski, brochachi, bradda, maat, gozer, kerel
- "twin" = als iemand relatable is
- "fr" = for real

Hoe je met data omgaat (STRIKT):
- Noem streepjes/stand ALLEEN als de gebruiker ernaar vraagt, of als het echt een perfecte roast-opening is
- Herhaal NOOIT stand-info die je al eerder in dit gesprek hebt genoemd — check je vorige berichten
- Recent activity (24u) mag je gebruiken voor een spontane opmerking, maar max 1x per ~5 berichten
- Als iemand iets off-topic zegt, ga daar gewoon op in zonder data erbij te slepen
- Als je twijfelt of je data moet noemen: doe het niet
- Als iemand expliciet vraagt ("hoeveel heb ik", "wat is de stand"): geef het gewoon

Off-topic:
- Ga mee met random vragen in je eigen stijl
- Na een paar off-topic berichten mag je sarcastisch terugsturen naar het drinken

Lengte — match de energie, niet een regel:

**Belangrijker dan kort zijn: wees interessant.** Liever een 4-zinnen-grap die écht landt dan een krampachtig geforceerde one-liner. Creativiteit gaat vóór brevity.

Kort (1-2 zinnen) — pakt natuurlijk voor:
- Reacties op one-liners, small talk, casual groeten
- Quick shots waar de setup al in het bericht staat

Middellang (3-5 zinnen) — de sweet spot voor veel momenten:
- Een roast die meer setup nodig heeft om te landen
- Een observatie + kleine twist
- Een grap met een follow-up
- Een mini-verhaal of bit

Lang (6+ zinnen) wanneer verdiend:
- "Leg eens uit" / "hoe werkt X" / expliciete uitleg-vragen
- Overzichtsvragen ("wat is de stand", "wie zijn er")
- Een verhaal of bit dat ademruimte nodig heeft om grappig te worden
- Iemand deelt iets persoonlijks of emotioneels

Denk aan een echte vriend in een groepschat: hij typt soms één zin, soms drie, soms een heel klein verhaaltje. Hij houdt zich niet aan een regel — hij matcht de energie. Doe dat ook.

Vermijd wél altijd:
- Meta-uitleg of disclaimers ("ik denk dat...", "laat me even...")
- Lijstjes met bullet points of nummering in casual chat
- Herhaling van dezelfde grap die je al eerder maakte
- Forced short antwoord als het moment iets meer vraagt

ANTI-HALLUCINATIE (STRIKT):
- Gebruik ALLEEN de data die in je context staat (Stand, Recent, Dranken, leden)
- Verzin NOOIT namen, streepjes, drankjes of andere data
- Als je iets niet weet of de data niet hebt: zeg dat eerlijk ("weet ik niet bro", "geen data over")
- Als iemand vraagt wie er in de groep zit: noem ALLEEN de namen uit je Stand-data
- Als er geen Stand-data is: zeg dat je het niet kunt zien`

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const record = payload.record

    if (!record || !record.content) return new Response('no content', { status: 200 })
    if (record.user_id === BOT_USER_ID) return new Response('skip', { status: 200 })

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get conversation type + group_id
    const { data: conv } = await supabase
      .from('conversations')
      .select('type, group_id')
      .eq('id', record.conversation_id)
      .single()

    const isDM = conv?.type === 'dm'
    const hasTrigger = record.content.toLowerCase().includes('@bot')

    if (!isDM && !hasTrigger) return new Response('no trigger', { status: 200 })

    // Check if bot is enabled for this group
    if (!isDM && conv?.group_id) {
      const { data: grp } = await supabase.from('groups').select('bot_enabled').eq('id', conv.group_id).single()
      if (grp && grp.bot_enabled === false) return new Response('bot disabled', { status: 200 })
    }

    if (isDM) {
      const { data: membership } = await supabase
        .from('conversation_members')
        .select('id')
        .eq('conversation_id', record.conversation_id)
        .eq('user_id', BOT_USER_ID)
        .single()
      if (!membership) return new Response('not a bot DM', { status: 200 })
    }

    // Check monthly bot message limit (500/month per group)
    const startOfMonth = new Date()
    startOfMonth.setUTCDate(1)
    startOfMonth.setUTCHours(0, 0, 0, 0)

    const { count: monthlyCount } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', BOT_USER_ID)
      .eq('conversation_id', record.conversation_id)
      .gte('created_at', startOfMonth.toISOString())

    if ((monthlyCount ?? 0) >= 500) {
      return new Response('monthly limit reached', { status: 200 })
    }

    // Get API key (cached in module scope)
    if (!cachedApiKey) {
      const { data: key, error: secretErr } = await supabase.rpc('get_secret', { secret_name: 'ANTHROPIC_API_KEY' })
      if (!key || secretErr) {
        console.error('Vault error:', secretErr)
        return new Response('missing api key', { status: 500 })
      }
      cachedApiKey = key
    }

    // Get sender profile
    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', record.user_id)
      .single()
    const senderName = senderProfile?.full_name || 'Iemand'

    // Get group context if group chat
    let groupContext = '', membersStr = '', drinksStr = '', recentStr = ''
    if (conv?.group_id) {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

      const [groupRes, membersRes, talliesRes, drinksRes, recentRes] = await Promise.all([
        supabase.from('groups').select('name, name_category_1, name_category_2, name_category_3, name_category_4').eq('id', conv.group_id).single(),
        supabase.from('group_members').select('user_id, profiles(full_name)').eq('group_id', conv.group_id),
        supabase.from('tallies').select('user_id').eq('group_id', conv.group_id).eq('removed', false).is('settlement_id', null),
        supabase.from('drinks').select('name, emoji').eq('group_id', conv.group_id).eq('is_available', true),
        supabase.from('tallies').select('user_id, category, created_at').eq('group_id', conv.group_id).eq('removed', false).gte('created_at', yesterday).order('created_at', { ascending: false }).limit(50),
      ])

      if (groupRes.data) groupContext = ` in de groep "${groupRes.data.name}"`

      const categoryNames: Record<number, string> = {}
      if (groupRes.data) {
        for (let i = 1; i <= 4; i++) {
          const name = (groupRes.data as any)[`name_category_${i}`]
          if (name) categoryNames[i] = name
        }
      }

      const memberNames: Record<string, string> = {}
      ;(membersRes.data || []).forEach((m: any) => { memberNames[m.user_id] = m.profiles?.full_name || '?' })
      const tallyCounts: Record<string, number> = {}
      ;(talliesRes.data || []).forEach((t: any) => { tallyCounts[t.user_id] = (tallyCounts[t.user_id] || 0) + 1 })
      membersStr = Object.entries(memberNames)
        .map(([uid, name]) => `${name}(${tallyCounts[uid] || 0})`)
        .join(', ')

      drinksStr = (drinksRes.data || [])
        .map((d: any) => d.emoji ? `${d.emoji} ${d.name}` : d.name)
        .join(', ')

      // Build recent 24h tally history per member
      if (recentRes.data && recentRes.data.length > 0) {
        const recentByUser: Record<string, Record<string, number>> = {}
        ;(recentRes.data as any[]).forEach((t) => {
          const uid = t.user_id
          const catName = categoryNames[t.category] || `cat${t.category}`
          if (!recentByUser[uid]) recentByUser[uid] = {}
          recentByUser[uid][catName] = (recentByUser[uid][catName] || 0) + 1
        })
        recentStr = Object.entries(recentByUser)
          .map(([uid, cats]) => {
            const name = memberNames[uid] || '?'
            const parts = Object.entries(cats).map(([cat, n]) => `${n}x ${cat}`)
            return `${name}: ${parts.join(', ')}`
          })
          .join(' | ')
      }
    }

    const timeStr = new Date().toLocaleString('nl-NL', {
      weekday: 'long', hour: '2-digit', minute: '2-digit',
      timeZone: 'Europe/Amsterdam',
    })

    // Get last 6 messages, excluding gift messages
    const { data: history } = await supabase
      .from('messages')
      .select('content, user_id, created_at, message_type')
      .eq('conversation_id', record.conversation_id)
      .neq('message_type', 'gift')
      .order('created_at', { ascending: false })
      .limit(6)

    const messages = (history || []).reverse().map((m: any) => ({
      role: m.user_id === BOT_USER_ID ? 'assistant' as const : 'user' as const,
      content: m.content.replace(/@bot\s*/gi, '').trim() || m.content,
    })).filter((m) => m.content.length > 0)

    const dynamicContext = `Je praat met ${senderName}${groupContext}. Het is ${timeStr}.${membersStr ? `\nStand: ${membersStr}` : ''}${recentStr ? `\nRecent (24u): ${recentStr}` : ''}${drinksStr ? `\nDranken: ${drinksStr}` : ''}`

    // Call Claude API with prompt caching
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cachedApiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        system: [
          { type: 'text', text: STATIC_PERSONALITY, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: dynamicContext },
        ],
        messages,
      }),
    })

    if (!apiRes.ok) {
      const errBody = await apiRes.text()
      console.error('Anthropic API error:', apiRes.status, errBody)
      // Clear cached key on auth errors
      if (apiRes.status === 401) cachedApiKey = null
      return new Response(`anthropic error: ${apiRes.status} ${errBody}`, { status: 500 })
    }

    const data = await apiRes.json()
    const botReply = data.content?.[0]?.text || ''

    if (botReply) {
      const { error: insertErr } = await supabase.from('messages').insert({
        conversation_id: record.conversation_id,
        user_id: BOT_USER_ID,
        content: botReply,
      })
      if (insertErr) console.error('Insert error:', insertErr)
    }

    return new Response('ok', { status: 200 })
  } catch (err) {
    console.error('Chat bot error:', err)
    return new Response('error: ' + String(err), { status: 500 })
  }
})
