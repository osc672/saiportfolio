require("dotenv").config();

const express = require("express");
const path = require("path");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const nodemailer = require("nodemailer");

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, message: "Too many messages sent. Please try again in 15 minutes." }
});

function clean(value, max = 2000) {
  return String(value || "").trim().slice(0, max);
}

app.post("/api/contact", contactLimiter, async (req, res) => {
  const name = clean(req.body.name, 100);
  const email = clean(req.body.email, 254);
  const subject = clean(req.body.subject, 160);
  const message = clean(req.body.message, 5000);
  // Honeypot field: real visitors should leave it blank.
  const website = clean(req.body.website, 200);

  if (website) return res.json({ success: true, message: "Thanks! Your message has been received." });

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ success: false, message: "Please complete all fields." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: "Please enter a valid email address." });
  }

  const required = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "CONTACT_TO"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    console.error("SMTP configuration missing:", missing.join(", "));
    return res.status(503).json({
      success: false,
      message: "Email is not configured yet. Please configure the SMTP values in your .env file."
    });
  }

  const port = Number(process.env.SMTP_PORT);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: String(process.env.SMTP_SECURE || (port === 465)).toLowerCase() === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });

  try {
    await transporter.sendMail({
      from: `"Portfolio Contact" <${process.env.SMTP_USER}>`,
      to: process.env.CONTACT_TO,
      replyTo: { name, address: email },
      subject: `Portfolio enquiry: ${subject}`,
      text: `NEW PORTFOLIO ENQUIRY

Hello Sai Chandu,

You have received a new message through your portfolio contact form.

FROM: ${name}
EMAIL: ${email}
SUBJECT: ${subject}

MESSAGE
${message}

Reply directly to this email to respond to ${name}.`,
      html: `
        <div style="margin:0;padding:34px 12px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#172033">
          <div style="max-width:660px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden">
            <div style="padding:28px 32px;background:#0b1020;color:#ffffff">
              <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9af5d0;font-weight:700">SAI CHANDU · PORTFOLIO</div>
              <h1 style="font-size:25px;line-height:1.25;margin:16px 0 8px">You've got a new message ✨</h1>
              <p style="font-size:14px;line-height:1.7;color:#cbd5e1;margin:0">Someone reached out through your portfolio. Here are their details.</p>
            </div>
            <div style="padding:28px 32px">
              <div style="padding:18px 20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:22px">
                <div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#64748b;font-weight:700;margin-bottom:7px">MESSAGE FROM</div>
                <div style="font-size:20px;font-weight:700;color:#0f172a;margin-bottom:5px">${escapeHtml(name)}</div>
                <a href="mailto:${escapeHtml(email)}" style="font-size:14px;color:#0f766e;text-decoration:none">${escapeHtml(email)}</a>
              </div>
              <div style="margin-bottom:22px">
                <div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#64748b;font-weight:700;margin-bottom:7px">SUBJECT</div>
                <div style="font-size:15px;font-weight:700;color:#172033">${escapeHtml(subject)}</div>
              </div>
              <div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#64748b;font-weight:700;margin-bottom:9px">THE MESSAGE</div>
              <div style="font-size:14px;line-height:1.85;color:#334155;white-space:pre-wrap;padding:18px 20px;background:#f8fafc;border-left:4px solid #34d399;border-radius:4px 10px 10px 4px">${escapeHtml(message)}</div>
              <div style="margin-top:25px">
                <a href="mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`Re: ${subject}`)}" style="display:inline-block;padding:13px 19px;border-radius:8px;background:#0f766e;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700">Reply to ${escapeHtml(name)} &nbsp; ↗</a>
              </div>
              <p style="font-size:11px;line-height:1.7;color:#94a3b8;margin:28px 0 0">This notification was sent by the contact form on your portfolio website.</p>
            </div>
          </div>
        </div>`
    });
    return res.json({ success: true, message: "Message sent successfully! I'll get back to you soon." });
  } catch (error) {
    console.error("SMTP send failed:", error.message);
    return res.status(502).json({
      success: false,
      message: "Email could not be sent. Check your SMTP host, port, username, app password, and provider security settings."
    });
  }
});

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.listen(PORT, () => console.log(`Portfolio running at http://localhost:${PORT}`));
