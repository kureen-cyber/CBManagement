/**
 * Optional email via Resend HTTP API.
 * Set RESEND_API_KEY and optionally EMAIL_FROM (defaults to onboarding@resend.dev).
 */

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendEmail(input: SendEmailInput): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.info("[email] skipped (no RESEND_API_KEY)", input.subject, "→", input.to);
    return { ok: true, skipped: true };
  }

  const from = process.env.EMAIL_FROM?.trim() || "CBManagement <onboarding@resend.dev>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html || `<pre style="font-family:sans-serif">${escapeHtml(input.text)}</pre>`,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[email] resend error", res.status, body);
      return { ok: false, error: body || res.statusText };
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "send failed";
    console.error("[email]", message);
    return { ok: false, error: message };
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function resolveCompanyAlertEmail(opts: {
  companyId: string;
  fallbackUserEmail?: string | null;
}): Promise<string | null> {
  const email = String(opts.fallbackUserEmail || "").trim();
  return email || null;
}
