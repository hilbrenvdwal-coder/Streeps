# Streeps — Supabase Email Templates

> Production-ready HTML templates voor Authentication → Emails → Templates in het Supabase dashboard.
> Brand: Streeps (magenta/cyan/green, Unbounded font, dark-header/light-body hybride).

## Design beslissingen

- **Hybride dark header + light body.** De app en landing zijn dark-first, maar mail clients openen vaak in light mode en vooral Outlook is notoir slecht met donkere backgrounds. Een donkere branded header (`#0E0D1C` met aurora accent) gevolgd door een lichte body (witte card, donkere tekst) geeft het Streeps-karakter zonder rendering risico.
- **Table-based layout.** Alle structuur via `<table>` / `<tr>` / `<td>` met `role="presentation"`. Geen flexbox, geen grid, max-width 600px. Werkt in Outlook 2007+.
- **Inline CSS op elk element.** Het `<style>` block in `<head>` wordt door Apple Mail en Gmail gelezen (voor `@media` dark mode + responsive), maar Gmail mobile en Outlook strippen of negeren het deels. Alles wat visueel kritiek is staat ook inline.
- **Gradient CTA.** Button via een gevlijde `<table>` + `<a>` met zowel een `background-color` fallback (`#FF0085`) als een `background-image: linear-gradient(...)` in Streeps brand (magenta → violet → cyan). Outlook ziet de solid magenta; Apple Mail/Gmail zien de volle gradient. Button zelf is pill-shaped (`border-radius: 999px`) in lijn met de landing.
- **Unbounded font.** Via Google Fonts `<link>` (Apple Mail, Gmail web renderen dit, Outlook valt terug). Font-family altijd met volledige systemstack fallback: `'Unbounded', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`.
- **Brand kleuren.** Header gradient accent bar gebruikt de signature `#FF0085 → #8B5CF6 → #00BEAE → #00FE96`. CTA gebruikt `#FF0085 → #8B5CF6 → #00BEAE`. Logo op `https://streeps.app/logo.png` (1024×1024), weergegeven als 72×72 met ronde hoeken.
- **Tone of voice.** Nederlands, "jij"-vorm, informeel maar netjes. Confirm signup is warm en uitnodigend, reset password is zakelijk en duidelijk.

---

## 1. Confirm signup

**Subject:** `Bevestig je Streeps account`

**Body (HTML):**

```html
<!doctype html>
<html lang="nl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>Bevestig je Streeps account</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@500;700;800&family=Manrope:wght@400;500;600&display=swap" rel="stylesheet" />
    <style>
      /* Client resets */
      body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
      table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
      img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
      body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
      a { text-decoration: none; }

      /* Mobile */
      @media screen and (max-width: 600px) {
        .container { width: 100% !important; max-width: 100% !important; }
        .px-lg { padding-left: 24px !important; padding-right: 24px !important; }
        .py-lg { padding-top: 32px !important; padding-bottom: 32px !important; }
        .h1 { font-size: 28px !important; line-height: 1.15 !important; }
        .cta a { padding: 16px 28px !important; font-size: 15px !important; }
      }

      /* Dark mode (Apple Mail, iOS Mail) */
      @media (prefers-color-scheme: dark) {
        .body-bg { background-color: #141414 !important; background-image: linear-gradient(180deg, #1A1D2E 0%, #141414 100%) !important; }
        .card { background-color: #1A1A2E !important; }
        .card-text { color: #FFFFFF !important; }
        .card-text-muted { color: #C8C8D4 !important; }
        .divider { border-color: rgba(255,255,255,0.08) !important; }
        .footer-text { color: #A0A0B8 !important; }
      }
    </style>
  </head>
  <body class="body-bg" style="margin:0;padding:0;background-color:#141414;background-image:linear-gradient(180deg,#1A1D2E 0%,#141414 100%);font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <!-- Preheader (hidden) -->
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#141414;">
      Welkom bij Streeps. Bevestig je account en begin met streepjes zetten.
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="body-bg" style="background-color:#141414;background-image:linear-gradient(180deg,#1A1D2E 0%,#141414 100%);">
      <tr>
        <td align="center" style="padding:32px 16px;">

          <!-- Container -->
          <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">

            <!-- ─── Dark branded header ─── -->
            <tr>
              <td style="background-color:#0E0D1C;border-radius:24px 24px 0 0;padding:0;" align="center">
                <!-- Logo + wordmark -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center" class="py-lg" style="padding:44px 24px 40px 24px;">
                      <img src="https://streeps.app/logo.png" width="72" height="72" alt="Streeps" style="display:block;width:72px;height:72px;border-radius:18px;box-shadow:0 0 32px rgba(255,0,133,0.35);" />
                      <div style="height:18px;line-height:18px;font-size:18px;">&nbsp;</div>
                      <div style="font-family:'Unbounded',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-weight:800;font-size:26px;letter-spacing:-0.02em;color:#FFFFFF;">Streeps</div>
                      <div style="height:6px;line-height:6px;font-size:6px;">&nbsp;</div>
                      <div style="font-family:'Unbounded',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-weight:500;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#A0A0B8;">streepjes voor je vrienden</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- ─── Light card body ─── -->
            <tr>
              <td class="card px-lg py-lg" style="background-color:#1A1A2E;padding:48px 44px 40px 44px;">
                <h1 class="h1 card-text" style="margin:0 0 16px 0;font-family:'Unbounded',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-weight:800;font-size:32px;line-height:1.15;letter-spacing:-0.02em;color:#FFFFFF;">
                  Welkom bij Streeps
                </h1>
                <p class="card-text-muted" style="margin:0 0 28px 0;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-weight:400;font-size:16px;line-height:1.6;color:#C8C8D4;">
                  Je bent er bijna. Bevestig je e-mailadres en je kunt meteen streepjes zetten met je vrienden, rondjes bijhouden en afrekenen zonder gezeik.
                </p>

                <!-- CTA button (table-based for Outlook) -->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 28px 0;">
                  <tr>
                    <td class="cta" align="center" style="background-color:#FF0085;background-image:linear-gradient(120deg,#FF0085 0%,#8B5CF6 50%,#00BEAE 100%);border-radius:999px;">
                      <!--[if mso]>
                      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{{ .ConfirmationURL }}" style="height:52px;v-text-anchor:middle;width:260px;" arcsize="100%" stroke="f" fillcolor="#FF0085">
                        <w:anchorlock/>
                        <center style="color:#FFFFFF;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:bold;">Bevestig mijn account</center>
                      </v:roundrect>
                      <![endif]-->
                      <!--[if !mso]><!-- -->
                      <a href="{{ .ConfirmationURL }}" target="_blank" style="display:inline-block;padding:18px 36px;font-family:'Unbounded',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-weight:700;font-size:15px;letter-spacing:0.01em;color:#FFFFFF;text-decoration:none;border-radius:999px;">
                        Bevestig mijn account
                      </a>
                      <!--<![endif]-->
                    </td>
                  </tr>
                </table>

                <p class="card-text-muted" style="margin:0 0 12px 0;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-weight:400;font-size:13px;line-height:1.6;color:#848494;">
                  Werkt de knop niet? Plak dan deze link in je browser:
                </p>
                <p style="margin:0 0 28px 0;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-weight:500;font-size:13px;line-height:1.5;word-break:break-all;">
                  <a href="{{ .ConfirmationURL }}" style="color:#FF0085;text-decoration:underline;">{{ .ConfirmationURL }}</a>
                </p>

                <!-- Divider -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td class="divider" style="border-top:1px solid rgba(255,255,255,0.08);line-height:1px;font-size:1px;">&nbsp;</td>
                  </tr>
                </table>

                <p class="card-text-muted" style="margin:24px 0 0 0;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-weight:400;font-size:13px;line-height:1.6;color:#848494;">
                  Heb jij geen account aangemaakt? Dan kun je deze mail rustig negeren.
                </p>
              </td>
            </tr>

            <!-- ─── Footer ─── -->
            <tr>
              <td style="background-color:#1A1A2E;border-radius:0 0 24px 24px;padding:0 44px 40px 44px;" align="center">
                <p class="footer-text" style="margin:0;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-weight:500;font-size:12px;line-height:1.6;color:#A0A0B8;">
                  Streeps &middot; <a href="https://streeps.app" style="color:#A0A0B8;text-decoration:underline;">streeps.app</a>
                </p>
                <p class="footer-text" style="margin:6px 0 0 0;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-weight:400;font-size:11px;line-height:1.6;color:#A0A0B8;">
                  Streepjes voor vriendengroepen. Rondjes, afrekenen en een beetje chaos.
                </p>
              </td>
            </tr>

          </table>

          <!-- Container end -->
        </td>
      </tr>
    </table>
  </body>
</html>
```

**Variabelen gebruikt:** `{{ .ConfirmationURL }}`

---

## 2. Reset password

**Subject:** `Stel je Streeps wachtwoord opnieuw in`

**Body (HTML):**

```html
<!doctype html>
<html lang="nl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>Stel je Streeps wachtwoord opnieuw in</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@500;700;800&family=Manrope:wght@400;500;600&display=swap" rel="stylesheet" />
    <style>
      /* Client resets */
      body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
      table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
      img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
      body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
      a { text-decoration: none; }

      /* Mobile */
      @media screen and (max-width: 600px) {
        .container { width: 100% !important; max-width: 100% !important; }
        .px-lg { padding-left: 24px !important; padding-right: 24px !important; }
        .py-lg { padding-top: 32px !important; padding-bottom: 32px !important; }
        .h1 { font-size: 28px !important; line-height: 1.15 !important; }
        .cta a { padding: 16px 28px !important; font-size: 15px !important; }
      }

      /* Dark mode (Apple Mail, iOS Mail) */
      @media (prefers-color-scheme: dark) {
        .body-bg { background-color: #141414 !important; background-image: linear-gradient(180deg, #1A1D2E 0%, #141414 100%) !important; }
        .card { background-color: #1A1A2E !important; }
        .card-text { color: #FFFFFF !important; }
        .card-text-muted { color: #C8C8D4 !important; }
        .divider { border-color: rgba(255,255,255,0.08) !important; }
        .footer-text { color: #A0A0B8 !important; }
        .notice { background-color: rgba(255,0,77,0.12) !important; color: #FF9AAE !important; }
      }
    </style>
  </head>
  <body class="body-bg" style="margin:0;padding:0;background-color:#141414;background-image:linear-gradient(180deg,#1A1D2E 0%,#141414 100%);font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <!-- Preheader (hidden) -->
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#141414;">
      Je hebt een wachtwoord reset aangevraagd voor Streeps.
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="body-bg" style="background-color:#141414;background-image:linear-gradient(180deg,#1A1D2E 0%,#141414 100%);">
      <tr>
        <td align="center" style="padding:32px 16px;">

          <!-- Container -->
          <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">

            <!-- ─── Dark branded header ─── -->
            <tr>
              <td style="background-color:#0E0D1C;border-radius:24px 24px 0 0;padding:0;" align="center">
                <!-- Logo + wordmark -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center" class="py-lg" style="padding:44px 24px 40px 24px;">
                      <img src="https://streeps.app/logo.png" width="72" height="72" alt="Streeps" style="display:block;width:72px;height:72px;border-radius:18px;box-shadow:0 0 32px rgba(255,0,133,0.35);" />
                      <div style="height:18px;line-height:18px;font-size:18px;">&nbsp;</div>
                      <div style="font-family:'Unbounded',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-weight:800;font-size:26px;letter-spacing:-0.02em;color:#FFFFFF;">Streeps</div>
                      <div style="height:6px;line-height:6px;font-size:6px;">&nbsp;</div>
                      <div style="font-family:'Unbounded',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-weight:500;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#A0A0B8;">wachtwoord opnieuw instellen</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- ─── Light card body ─── -->
            <tr>
              <td class="card px-lg py-lg" style="background-color:#1A1A2E;padding:48px 44px 40px 44px;">
                <h1 class="h1 card-text" style="margin:0 0 16px 0;font-family:'Unbounded',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-weight:800;font-size:32px;line-height:1.15;letter-spacing:-0.02em;color:#FFFFFF;">
                  Nieuw wachtwoord instellen
                </h1>
                <p class="card-text-muted" style="margin:0 0 28px 0;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-weight:400;font-size:16px;line-height:1.6;color:#C8C8D4;">
                  Je hebt een wachtwoord reset aangevraagd voor je Streeps account. Klik op de knop hieronder om een nieuw wachtwoord te kiezen.
                </p>

                <!-- CTA button (table-based for Outlook) -->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 28px 0;">
                  <tr>
                    <td class="cta" align="center" style="background-color:#FF0085;background-image:linear-gradient(120deg,#FF0085 0%,#8B5CF6 50%,#00BEAE 100%);border-radius:999px;">
                      <!--[if mso]>
                      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{{ .ConfirmationURL }}" style="height:52px;v-text-anchor:middle;width:260px;" arcsize="100%" stroke="f" fillcolor="#FF0085">
                        <w:anchorlock/>
                        <center style="color:#FFFFFF;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:bold;">Nieuw wachtwoord instellen</center>
                      </v:roundrect>
                      <![endif]-->
                      <!--[if !mso]><!-- -->
                      <a href="{{ .ConfirmationURL }}" target="_blank" style="display:inline-block;padding:18px 36px;font-family:'Unbounded',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-weight:700;font-size:15px;letter-spacing:0.01em;color:#FFFFFF;text-decoration:none;border-radius:999px;">
                        Nieuw wachtwoord instellen
                      </a>
                      <!--<![endif]-->
                    </td>
                  </tr>
                </table>

                <p class="card-text-muted" style="margin:0 0 12px 0;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-weight:400;font-size:13px;line-height:1.6;color:#848494;">
                  Werkt de knop niet? Plak dan deze link in je browser:
                </p>
                <p style="margin:0 0 28px 0;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-weight:500;font-size:13px;line-height:1.5;word-break:break-all;">
                  <a href="{{ .ConfirmationURL }}" style="color:#FF0085;text-decoration:underline;">{{ .ConfirmationURL }}</a>
                </p>

                <!-- Security notice -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0 0;">
                  <tr>
                    <td class="notice" style="background-color:rgba(255,0,77,0.12);border-left:3px solid #FF004D;border-radius:8px;padding:16px 18px;">
                      <p style="margin:0;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-weight:500;font-size:13px;line-height:1.6;color:#FF9AAE;">
                        <strong style="color:#FF004D;">Niet jij geweest?</strong> Dan kun je deze mail negeren en blijft je wachtwoord onveranderd. Deze link is beperkt geldig.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- ─── Footer ─── -->
            <tr>
              <td style="background-color:#1A1A2E;border-radius:0 0 24px 24px;padding:0 44px 40px 44px;" align="center">
                <p class="footer-text" style="margin:0;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-weight:500;font-size:12px;line-height:1.6;color:#A0A0B8;">
                  Streeps &middot; <a href="https://streeps.app" style="color:#A0A0B8;text-decoration:underline;">streeps.app</a>
                </p>
                <p class="footer-text" style="margin:6px 0 0 0;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-weight:400;font-size:11px;line-height:1.6;color:#A0A0B8;">
                  Streepjes voor vriendengroepen. Rondjes, afrekenen en een beetje chaos.
                </p>
              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>
  </body>
</html>
```

**Variabelen gebruikt:** `{{ .ConfirmationURL }}`

---

## Hoe te installeren in Supabase

1. Open: https://supabase.com/dashboard/project/ozyfedcosrgukiyscvsd
2. Ga naar **Authentication → Emails → Templates**
3. Selecteer template **"Confirm signup"**:
   - Vervang **Subject** door: `Bevestig je Streeps account`
   - Vervang **Message body** door de volledige HTML uit sectie 1
   - Klik **Save**
4. Selecteer template **"Reset password"**:
   - Vervang **Subject** door: `Stel je Streeps wachtwoord opnieuw in`
   - Vervang **Message body** door de volledige HTML uit sectie 2
   - Klik **Save**

> **Let op:** Supabase gebruikt Go templating. De tokens `{{ .ConfirmationURL }}` moeten LETTERLIJK in de HTML blijven staan — Supabase vervangt ze server-side. Niet escapen, niet aanpassen.

## Testen

**Confirm signup:**
1. Open een incognito window op de Streeps app/website
2. Registreer een testaccount met een mailbox die je kunt bereiken (bij voorkeur een Gmail, iCloud en een Outlook adres)
3. Check in elke inbox hoe de mail rendert:
   - **Gmail web** — gradient CTA + Unbounded zichtbaar
   - **Apple Mail (macOS/iOS)** — gradient + dark-mode variant zichtbaar
   - **Outlook (desktop/web)** — solid magenta CTA als fallback, systemfont, maar layout intact

**Reset password:**
1. Ga op de login screen naar "Wachtwoord vergeten"
2. Vul het testaccount in
3. Check de mail in dezelfde inboxen

**Render checks:**
- Logo laadt vanaf `https://streeps.app/logo.png`
- CTA button werkt en opent `{{ .ConfirmationURL }}` in de browser
- Tekst leesbaar in zowel light als dark mode
- Mobile: alles stacked, padding comfortabel, CTA tapbaar (>= 44px hoog)
- Outlook desktop: button rendert via VML roundrect als solid magenta pill
