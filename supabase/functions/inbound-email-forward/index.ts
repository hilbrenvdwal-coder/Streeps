// Receives Resend inbound webhooks and forwards parsed emails to a fixed
// Gmail address via Resend's outbound API. Lets us use `contact@streeps.app`
// as a contact address without running a real inbox.

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405, headers: corsHeaders })
  }

  if (!RESEND_API_KEY) {
    console.error('Missing RESEND_API_KEY env var')
    return new Response('server misconfigured', { status: 500, headers: corsHeaders })
  }
  if (!FORWARD_TO) {
    console.error('Missing FORWARD_TO_EMAIL env var')
    return new Response('server misconfigured', { status: 500, headers: corsHeaders })
  }

  try {
    const body = await req.json() as Record<string, unknown>
    console.log('[inbound-email-forward] webhook received:', JSON.stringify(body).slice(0, 500))

    // Resend inbound payload — support a few possible shapes
    const data = (body.data ?? body) as Record<string, unknown>

    const fromRaw = data.from ?? data.sender
    const from = extractEmail(fromRaw)
    const to = extractEmail(data.to)
    const subject = typeof data.subject === 'string' ? data.subject : '(geen onderwerp)'
    const text = typeof data.text === 'string' ? data.text : ''
    const html = typeof data.html === 'string' ? data.html : ''

    if (!from) {
      console.error('[inbound-email-forward] missing from field in payload')
      return new Response('invalid payload: no sender', { status: 400, headers: corsHeaders })
    }

    // Build forwarded email body
    const forwardHeader =
      `<div style="background:#F4F4F8;border-left:3px solid #FF0085;padding:12px 16px;margin-bottom:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:#4A4A68;">` +
      `<strong style="color:#0E0D1C;">Inkomende mail via contact@streeps.app</strong><br/>` +
      `<strong>Van:</strong> ${esc(from)}<br/>` +
      `<strong>Aan:</strong> ${esc(to || 'contact@streeps.app')}<br/>` +
      `<strong>Onderwerp:</strong> ${esc(subject)}` +
      `</div>`

    const forwardedHtml = html || `<pre style="white-space:pre-wrap;font-family:-apple-system,sans-serif;">${esc(text)}</pre>`
    const finalHtml = forwardHeader + forwardedHtml
    const finalText =
      `--- Inkomende mail via contact@streeps.app ---\n` +
      `Van: ${from}\n` +
      `Aan: ${to || 'contact@streeps.app'}\n` +
      `Onderwerp: ${subject}\n\n` +
      (text || '(geen plain text body)')

    const sendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Streeps Contact <${FORWARD_FROM}>`,
        to: [FORWARD_TO],
        reply_to: from,
        subject: `[Streeps] ${subject}`,
        html: finalHtml,
        text: finalText,
      }),
    })

    if (!sendRes.ok) {
      const errText = await sendRes.text()
      console.error('[inbound-email-forward] Resend send error:', sendRes.status, errText)
      return new Response(`forward failed: ${sendRes.status}`, { status: 500, headers: corsHeaders })
    }

    const result = await sendRes.json()
    console.log('[inbound-email-forward] forwarded ok:', result.id ?? 'no id')

    return new Response(JSON.stringify({ ok: true, forwarded_to: FORWARD_TO }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[inbound-email-forward] error:', err)
    return new Response(`error: ${String(err)}`, { status: 500, headers: corsHeaders })
  }
})
