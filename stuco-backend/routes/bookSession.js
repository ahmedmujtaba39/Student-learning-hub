import express from "express";
import { google } from "googleapis";
import nodemailer from "nodemailer";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const router = express.Router();

/* ── Google Calendar setup ─────────────────────────────────────────────────
   Requires:
     • stuco-backend/service-account.json  (Google Cloud service account key)
     • GOOGLE_CALENDAR_ID in .env          (e.g. "primary" or a calendar email)
   The service account must have "Make changes to events" permission on that calendar.
   Calendar API must be enabled in your Google Cloud project.
────────────────────────────────────────────────────────────────────────── */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVICE_ACCOUNT_PATH = path.join(__dirname, "../service-account.json");

let calendar = null;

if (existsSync(SERVICE_ACCOUNT_PATH)) {
  const serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, "utf8"));
  const auth = new google.auth.JWT(
    serviceAccount.client_email,
    null,
    serviceAccount.private_key,
    ["https://www.googleapis.com/auth/calendar"]
  );
  calendar = google.calendar({ version: "v3", auth });
} else {
  console.warn("⚠️  service-account.json not found — Google Meet links will be skipped.");
}

/* ── Nodemailer setup ──────────────────────────────────────────────────────
   Requires in .env:
     EMAIL_USER=yourschool@gmail.com
     EMAIL_PASS=your-gmail-app-password   (16-char app password, NOT your login password)
────────────────────────────────────────────────────────────────────────── */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/* ── POST /api/book-session ────────────────────────────────────────────── */
router.post("/", async (req, res) => {
  const { mentorId, mentorName, mentorEmail, studentName, studentEmail, slot } = req.body;

  if (!studentEmail || !studentName || !slot || !mentorName) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  const startTime = new Date(slot);
  const endTime   = new Date(startTime.getTime() + 60 * 60 * 1000); // 1-hour session

  let meetLink = null;

  /* ── Step 1: Create Google Calendar event with Meet ── */
  if (calendar) {
    try {
      const event = await calendar.events.insert({
        calendarId: process.env.GOOGLE_CALENDAR_ID || "primary",
        conferenceDataVersion: 1,
        requestBody: {
          summary: `Tutoring: ${mentorName} & ${studentName}`,
          description: "Peer mentoring session — Student Learning Hub",
          start: { dateTime: startTime.toISOString() },
          end:   { dateTime: endTime.toISOString() },
          attendees: [
            { email: studentEmail },
            ...(mentorEmail ? [{ email: mentorEmail }] : []),
          ],
          conferenceData: {
            createRequest: {
              requestId: `slh-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          },
        },
      });

      meetLink =
        event.data.hangoutLink ||
        event.data.conferenceData?.entryPoints?.find(e => e.entryPointType === "video")?.uri ||
        null;
    } catch (err) {
      console.error("Google Calendar error:", err.message);
      // Don't block the booking — continue without Meet link
    }
  }

  /* ── Step 2: Send confirmation emails ── */
  const formattedTime = startTime.toLocaleString("en-US", {
    weekday: "long", year: "numeric", month: "long",
    day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const meetSection = meetLink
    ? `\n🔗 Google Meet Link: ${meetLink}\n   Join at the scheduled time.`
    : "\n📌 Your mentor will send you a meeting link separately.";

  const studentEmail_body = `Hi ${studentName},

Your mentoring session has been confirmed!

📅 Date & Time : ${formattedTime}
👤 Mentor       : ${mentorName}
${meetSection}

See you there!
— Student Learning Hub`;

  const mentorEmail_body = `Hi ${mentorName},

You have a new session booked!

📅 Date & Time : ${formattedTime}
👤 Student      : ${studentName} (${studentEmail})
${meetSection}

— Student Learning Hub`;

  const emailsSent = [];

  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      await transporter.sendMail({
        from: `"Student Learning Hub" <${process.env.EMAIL_USER}>`,
        to: studentEmail,
        subject: `Session Confirmed with ${mentorName} — ${formattedTime}`,
        text: studentEmail_body,
      });
      emailsSent.push("student");
    } catch (err) {
      console.error("Student email error:", err.message);
    }

    if (mentorEmail) {
      try {
        await transporter.sendMail({
          from: `"Student Learning Hub" <${process.env.EMAIL_USER}>`,
          to: mentorEmail,
          subject: `New Booking from ${studentName} — ${formattedTime}`,
          text: mentorEmail_body,
        });
        emailsSent.push("mentor");
      } catch (err) {
        console.error("Mentor email error:", err.message);
      }
    }
  } else {
    console.warn("⚠️  EMAIL_USER/EMAIL_PASS not set — emails skipped.");
  }

  res.json({ meetLink, emailsSent });
});

export default router;
