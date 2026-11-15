// Supabase Edge Function: send-quote-request
// Standalone version — no database, no admin login. Receives a quote request
// straight from the website's form and emails it to ONE fixed inbox via Brevo.
//
// Required secrets (set these in Supabase: Edge Functions -> Secrets):
//   BREVO_API_KEY     - your free Brevo API key
//   SENDER_EMAIL      - the email you verified as a Brevo sender (often your own Gmail)
//   (Requests are always delivered to RECEIVER_EMAIL below. NOTIFY_TO_EMAIL is no longer used.)
//   BUSINESS_NAME     - your business name, shown in the email (e.g. "Joe's Plumbing")

const RECEIVER_EMAIL = "sfutie4@gmail.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function text(value: unknown, fallback = "") {
  return value == null || value === "" ? fallback : String(value);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return map[char] || char;
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return response({ ok: false, error: "POST required" }, 405);
  }

  try {
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    const senderEmail = Deno.env.get("SENDER_EMAIL");
    const notifyToEmail = RECEIVER_EMAIL;
    const businessName = Deno.env.get("BUSINESS_NAME") || "Your Business";

    if (!brevoApiKey) return response({ ok: false, error: "Missing BREVO_API_KEY secret" }, 500);
    if (!senderEmail) return response({ ok: false, error: "Missing SENDER_EMAIL secret" }, 500);

    const body = await req.json().catch(() => ({}));

    const id = text(body.id, "REQ-" + Date.now());
    const customer = body.customer || {};
    const vehicle = body.vehicle || {};
    const customerName = text(customer.name, "Not provided");
    const customerPhone = text(customer.phone, "Not provided");
    const customerEmail = text(customer.email, "Not provided");
    const rego = text(vehicle.rego, "").toUpperCase();
    const vehicleName = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Not provided";
    const mobileRequested = body.mobileServiceRequested === true;
    const message = text(body.message, "No message provided.");

    if (customerName === "Not provided" && customerEmail === "Not provided" && customerPhone === "Not provided") {
      return response({ ok: false, error: "No customer contact details were provided" }, 400);
    }

    const subject = `New Request — ${rego || customerName}`;

    const emailText = `${businessName.toUpperCase()}

NEW CUSTOMER REQUEST
Request #: ${id}

CUSTOMER DETAILS
Name: ${customerName}
Phone: ${customerPhone}
Email: ${customerEmail}

VEHICLE DETAILS
REGO: ${rego || "Not provided"}
Vehicle: ${vehicleName}

MOBILE SERVICE REQUEST
${mobileRequested ? "Requested" : "Not requested"}

MESSAGE
${message}`;

    const emailHtml = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#eef1f6;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:28px 12px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e2e6ea;">
<tr><td style="padding:26px 28px;background:#111827;color:#fff;"><div style="font-size:20px;font-weight:bold;">${escapeHtml(businessName)}</div></td></tr>
<tr><td style="padding:22px 28px 6px;"><div style="font-size:19px;font-weight:bold;color:#111827;">📩 New Customer Request</div><div style="font-size:12px;color:#6b7280;margin-top:4px;">Request #${escapeHtml(id)}</div></td></tr>
<tr><td style="padding:16px 28px 4px;"><div style="font-size:14px;font-weight:bold;color:#111827;margin-bottom:8px;">Customer Details</div>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;">
<tr><td style="padding:10px 14px;"><div style="font-size:10px;color:#6b7280;">NAME</div><div style="font-size:14px;font-weight:bold;color:#111827;">${escapeHtml(customerName)}</div></td></tr>
<tr><td style="padding:10px 14px;border-top:1px solid #e5e7eb;"><div style="font-size:10px;color:#6b7280;">PHONE</div><div style="font-size:14px;color:#111827;">${escapeHtml(customerPhone)}</div></td></tr>
<tr><td style="padding:10px 14px;border-top:1px solid #e5e7eb;"><div style="font-size:10px;color:#6b7280;">EMAIL</div><div style="font-size:14px;color:#111827;">${escapeHtml(customerEmail)}</div></td></tr>
</table></td></tr>
<tr><td style="padding:18px 28px 4px;"><div style="font-size:14px;font-weight:bold;color:#111827;margin-bottom:8px;">Vehicle</div>
<table width="100%"><tr><td width="60%" style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:12px;vertical-align:top;"><div style="font-size:10px;color:#6b7280;">VEHICLE</div><div style="font-size:14px;font-weight:bold;color:#111827;">${escapeHtml(vehicleName)}</div></td><td width="4%"></td><td width="36%" style="background:#fff7ed;border:2px solid #f59e0b;border-radius:10px;padding:12px;vertical-align:top;"><div style="font-size:10px;color:#92400e;font-weight:bold;">REGO</div><div style="font-size:18px;font-weight:bold;color:#111827;">${escapeHtml(rego || "—")}</div></td></tr></table></td></tr>
<tr><td style="padding:18px 28px 4px;"><div style="font-size:14px;font-weight:bold;color:#111827;margin-bottom:8px;">Mobile Service</div><div style="padding:10px 14px;border-radius:10px;background:${mobileRequested ? "#ecfdf5" : "#f8fafc"};border:1px solid ${mobileRequested ? "#a7f3d0" : "#e5e7eb"};color:${mobileRequested ? "#065f46" : "#4b5563"};font-size:13px;font-weight:bold;">${mobileRequested ? "✓ Mobile service requested" : "Not requested"}</div></td></tr>
<tr><td style="padding:18px 28px 26px;"><div style="font-size:14px;font-weight:bold;color:#111827;margin-bottom:8px;">Message</div><div style="background:#f8fafc;border-left:4px solid #111827;border-radius:8px;padding:14px;font-size:13px;line-height:1.6;color:#374151;white-space:pre-wrap;">${escapeHtml(message)}</div></td></tr>
</table></td></tr></table></body></html>`;

    const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": brevoApiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: { name: businessName, email: senderEmail },
        to: [{ email: notifyToEmail }],
        subject,
        textContent: emailText,
        htmlContent: emailHtml,
      }),
    });

    const brevoResult = await brevoResponse.json().catch(() => ({}));

    if (!brevoResponse.ok) {
      console.error("Brevo send failed:", brevoResult);
      return response({ ok: false, error: "Email could not be sent", details: brevoResult }, 502);
    }

    return response({ ok: true, id });
  } catch (error) {
    console.error("send-quote-request crashed:", error);
    return response({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
