// Receives Resend inbound webhooks, fetches the full email body via
// GET /emails/receiving/{id}, and forwards it to a fixed Gmail address
// via Resend's outbound API. Defensive From display name handling.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, resend-signature',
}

const FORWARD_TO = Deno.env.get('FORWARD_TO_EMAIL') ?? ''
const FORWARD_FROM = Deno.env.get('FORWARD_FROM_EMAIL') ?? 'noreply@streeps.app'
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''

function extractEmail(raw: unknown): string {
  if (!raw) return ''
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw)) return raw.map(extractEmail).join(', ')
  if (typeof raw === 'object') {
    const r = raw as Record<string, unknown>
    if (typeof r.email === 'string') return r.email
    if (typeof r.address === 'string') return r.address
    if (typeof r.value === 'string') return r.value
  }
  return String(raw)
}

function parseFromField(raw: string): { name: string, email: string } {
  const match = raw.match(/^(.*?)\s*<([^>]+)>\s*$/)
  if (match) {
    return {
      name: (match[1] || '').trim().replace(/^["']|["']$/g, ''),
      email: match[2].trim(),
    }
  }
  return { name: '', email: raw.trim() }
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

function normalizeMessageId(id: string): string {
  const trimmed = id.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('<') && trimmed.endsWith('>')) return trimmed
  return `<${trimmed}>`
}

// RFC 5322 safe display name: strip quotes/brackets/newlines, keep ASCII.
function safeDisplayName(name: string): string {
  return name
    .replace(/[<>"\\\r\n\t]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .trim()
    .slice(0, 50)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405, headers: corsHeaders })
  }

  if (!RESEND_API_KEY || !FORWARD_TO) {
    return new Response('server misconfigured', { status: 500, headers: corsHeaders })
  }

  try {
    const body = await req.json() as Record<string, unknown>
    const data = (body.data ?? body) as Record<string, unknown>

    const rawFrom = typeof data.from === 'string' ? data.from : extractEmail(data.from ?? data.sender)
    const parsed = parseFromField(rawFrom)
    const senderEmail = parsed.email
    const to = extractEmail(data.to)
    const subject = typeof data.subject === 'string' ? data.subject : '(geen onderwerp)'
    const emailId = typeof data.email_id === 'string' ? data.email_id : (typeof data.id === 'string' ? data.id : '')
    const originalMessageId = typeof data.message_id === 'string' ? normalizeMessageId(data.message_id) : ''

    if (!senderEmail || !emailId) {
      return new Response('invalid payload: missing from or email_id', { status: 400, headers: corsHeaders })
    }

    const fetchRes = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}` },
    })

    if (!fetchRes.ok) {
      const errText = await fetchRes.text()
      console.error('[inbound] fetch failed:', fetchRes.status, errText)
      return new Response(`fetch failed: ${fetchRes.status}`, { status: 500, headers: corsHeaders })
    }

    const fullEmail = await fetchRes.json() as Record<string, unknown>
    const fetchedText = typeof fullEmail.text === 'string' ? fullEmail.text : ''
    const fetchedHtml = typeof fullEmail.html === 'string' ? fullEmail.html : ''

    const fullFromRaw = typeof fullEmail.from === 'string' ? fullEmail.from : rawFrom
    const fullParsed = parseFromField(fullFromRaw)
    const rawName = fullParsed.name || parsed.name || senderEmail.split('@')[0] || ''
    const cleanName = safeDisplayName(rawName)
    const senderEmailFinal = fullParsed.email || senderEmail

    const bodyHtml = fetchedHtml
      ? fetchedHtml
      : fetchedText
        ? `<pre style="white-space:pre-wrap;font-family:-apple-system,sans-serif;">${esc(fetchedText)}</pre>`
        : '<p style="color:#999;"><em>(lege mail)</em></p>'

    const bodyText = fetchedText || '(geen plain text body)'

    const displayName = cleanName
      ? `"${cleanName} via Streeps"`
      : '"Streeps Contact"'
    const displayFrom = `${displayName} <${FORWARD_FROM}>`

    console.log('[inbound] sending with From:', displayFrom, 'reply_to:', senderEmailFinal)

    const outboundPayload: Record<string, unknown> = {
      from: displayFrom,
      to: [FORWARD_TO],
      reply_to: senderEmailFinal,
      subject: subject,
      html: bodyHtml,
      text: bodyText,
    }
    if (originalMessageId) {
      outboundPayload.headers = {
        'In-Reply-To': originalMessageId,
        'References': originalMessageId,
      }
    }

    const sendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(outboundPayload),
    })

    const sendResBody = await sendRes.text()
    if (!sendRes.ok) {
      console.error('[inbound] send error:', sendRes.status, sendResBody)
      return new Response(`forward failed: ${sendRes.status} ${sendResBody}`, { status: 500, headers: corsHeaders })
    }

    console.log('[inbound] send response:', sendResBody)

    return new Response(JSON.stringify({ ok: true, resend: sendResBody }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[inbound] error:', err)
    return new Response(`error: ${String(err)}`, { status: 500, headers: corsHeaders })
  }
})
