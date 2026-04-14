// Receives Resend inbound webhooks, fetches the full email body via
// GET /emails/receiving/{id}, and forwards it to a fixed Gmail address
// via Resend's outbound API. Preserves the original Message-ID via
// In-Reply-To / References headers so replies thread correctly on the
// sender's side.

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

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

function normalizeMessageId(id: string): string {
  const trimmed = id.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('<') && trimmed.endsWith('>')) return trimmed
  return `<${trimmed}>`
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

    const from = extractEmail(data.from ?? data.sender)
    const to = extractEmail(data.to)
    const subject = typeof data.subject === 'string' ? data.subject : '(geen onderwerp)'
    const emailId = typeof data.email_id === 'string' ? data.email_id : (typeof data.id === 'string' ? data.id : '')
    const originalMessageId = typeof data.message_id === 'string' ? normalizeMessageId(data.message_id) : ''

    if (!from || !emailId) {
      return new Response('invalid payload: missing from or email_id', { status: 400, headers: corsHeaders })
    }

    const fetchRes = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}` },
    })

    if (!fetchRes.ok) {
      const errText = await fetchRes.text()
      console.error('[inbound] fetch received email failed:', fetchRes.status, errText)
      return new Response(`fetch failed: ${fetchRes.status} ${errText}`, { status: 500, headers: corsHeaders })
    }

    const fullEmail = await fetchRes.json() as Record<string, unknown>
    const fetchedText = typeof fullEmail.text === 'string' ? fullEmail.text : ''
    const fetchedHtml = typeof fullEmail.html === 'string' ? fullEmail.html : ''

    const forwardHeader =
      `<div style="background:#F4F4F8;border-left:3px solid #FF0085;padding:12px 16px;margin-bottom:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:#4A4A68;">` +
      `<strong style="color:#0E0D1C;">Inkomende mail via contact@streeps.app</strong><br/>` +
      `<strong>Van:</strong> ${esc(from)}<br/>` +
      `<strong>Aan:</strong> ${esc(to || 'contact@streeps.app')}<br/>` +
      `<strong>Onderwerp:</strong> ${esc(subject)}` +
      `</div>`

    const bodyHtml = fetchedHtml
      ? fetchedHtml
      : fetchedText
        ? `<pre style="white-space:pre-wrap;font-family:-apple-system,sans-serif;">${esc(fetchedText)}</pre>`
        : '<p style="color:#999;"><em>(lege mail)</em></p>'

    const combined = forwardHeader + bodyHtml
    const combinedText =
      `--- Inkomende mail via contact@streeps.app ---\n` +
      `Van: ${from}\n` +
      `Aan: ${to || 'contact@streeps.app'}\n` +
      `Onderwerp: ${subject}\n\n` +
      (fetchedText || '(geen plain text body)')

    const outboundPayload: Record<string, unknown> = {
      from: `Streeps Contact <${FORWARD_FROM}>`,
      to: [FORWARD_TO],
      reply_to: from,
      subject: subject,
      html: combined,
      text: combinedText,
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

    if (!sendRes.ok) {
      const errText = await sendRes.text()
      console.error('[inbound] send error:', sendRes.status, errText)
      return new Response(`forward failed: ${sendRes.status}`, { status: 500, headers: corsHeaders })
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[inbound] error:', err)
    return new Response(`error: ${String(err)}`, { status: 500, headers: corsHeaders })
  }
})
