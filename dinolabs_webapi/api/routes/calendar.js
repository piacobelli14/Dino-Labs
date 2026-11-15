const express = require("express");
const crypto = require("crypto");
const { pool } = require("../config/db");
const { authenticateToken } = require("../middleware/auth");

require("dotenv").config();

const router = express.Router();

const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const MAX_OCCURRENCES = 500;

function newInviteToken() {
    return crypto.randomBytes(18).toString("hex");
}

function parseIcsDate(value) {
    const m = String(value).match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/);

    if (!m) {
        return null;
    }

    return new Date(Date.UTC(
        Number(m[1]), Number(m[2]) - 1, Number(m[3]),
        Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0)
    ));
}

function parseRule(rrule) {
    if (!rrule || typeof rrule !== "string") {
        return null;
    }

    const parts = {};

    rrule.replace(/^RRULE:/i, "").split(";").forEach((chunk) => {
        const [key, value] = chunk.split("=");

        if (key && value) {
            parts[key.trim().toUpperCase()] = value.trim();
        }
    });

    if (!parts.FREQ) {
        return null;
    }

    return {
        freq: parts.FREQ.toUpperCase(),
        interval: Math.max(1, parseInt(parts.INTERVAL, 10) || 1),
        count: parts.COUNT ? parseInt(parts.COUNT, 10) : null,
        until: parts.UNTIL ? parseIcsDate(parts.UNTIL) : null,
        byDay: parts.BYDAY ? parts.BYDAY.split(",").map(d => d.trim().toUpperCase()) : null
    };
}

function advanceCursor(from, rule) {
    const next = new Date(from);

    if (rule.freq === "DAILY") {
        next.setUTCDate(next.getUTCDate() + rule.interval);
        return next;
    }

    if (rule.freq === "WEEKLY") {
        if (rule.byDay && rule.byDay.length > 1) {
            next.setUTCDate(next.getUTCDate() + 1);
            return next;
        }

        next.setUTCDate(next.getUTCDate() + 7 * rule.interval);
        return next;
    }

    if (rule.freq === "MONTHLY") {
        next.setUTCMonth(next.getUTCMonth() + rule.interval);
        return next;
    }

    if (rule.freq === "YEARLY") {
        next.setUTCFullYear(next.getUTCFullYear() + rule.interval);
        return next;
    }

    return null;
}

function expandRecurrence(event, rangeStart, rangeEnd) {
    const rule = parseRule(event.rrule);

    if (!rule) {
        return [event];
    }

    const start = new Date(event.startDate);
    const durationMs = Math.max(0, new Date(event.endDate).getTime() - start.getTime());
    const excluded = new Set((event.excludedDates || []).map(d => new Date(d).getTime()));

    const occurrences = [];
    let cursor = new Date(start);
    let produced = 0;

    while (produced < MAX_OCCURRENCES) {
        if (rule.count && produced >= rule.count) {
            break;
        }

        if (rule.until && cursor.getTime() > rule.until.getTime()) {
            break;
        }

        if (cursor.getTime() > rangeEnd.getTime()) {
            break;
        }

        const matchesDay = !rule.byDay || rule.byDay.includes(WEEKDAYS[cursor.getUTCDay()]);

        if (matchesDay && !excluded.has(cursor.getTime())) {
            const occurrenceEnd = new Date(cursor.getTime() + durationMs);

            if (occurrenceEnd.getTime() >= rangeStart.getTime()) {
                occurrences.push({
                    ...event,
                    id: `${event.id}::${cursor.toISOString()}`,
                    seriesId: event.seriesId || event.id,
                    recurrenceDate: cursor.toISOString(),
                    startDate: cursor.toISOString(),
                    endDate: occurrenceEnd.toISOString(),
                    isOccurrence: true
                });
            }

            produced++;
        }

        cursor = advanceCursor(cursor, rule);

        if (!cursor) {
            break;
        }
    }

    return occurrences;
}

function icsStamp(value) {
    return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function icsEscape(text) {
    return String(text || "")
        .replace(/\\/g, "\\\\")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,")
        .replace(/\r?\n/g, "\\n");
}

function foldLine(line) {
    if (line.length <= 73) {
        return line;
    }

    const parts = [line.slice(0, 73)];
    let rest = line.slice(73);

    while (rest.length > 72) {
        parts.push(` ${rest.slice(0, 72)}`);
        rest = rest.slice(72);
    }

    if (rest.length) {
        parts.push(` ${rest}`);
    }

    return parts.join("\r\n");
}

function buildIcs(event, attendees, method) {
    const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//DinoLabs//Calendar//EN",
        "CALSCALE:GREGORIAN",
        `METHOD:${method || "REQUEST"}`,
        "BEGIN:VEVENT",
        `UID:${event.id}@dinolabs`,
        `DTSTAMP:${icsStamp(new Date())}`,
        `DTSTART:${icsStamp(event.startDate)}`,
        `DTEND:${icsStamp(event.endDate)}`,
        `SUMMARY:${icsEscape(event.title)}`,
        `SEQUENCE:${event.sequence || 0}`,
        `STATUS:${(event.status || "confirmed").toUpperCase()}`
    ];

    if (event.description) {
        lines.push(`DESCRIPTION:${icsEscape(event.description)}`);
    }

    if (event.location) {
        lines.push(`LOCATION:${icsEscape(event.location)}`);
    }

    if (event.rrule) {
        lines.push(event.rrule.replace(/^RRULE:/i, "RRULE:"));
    }

    if (event.organizerEmail) {
        lines.push(`ORGANIZER;CN=${icsEscape(event.organizerEmail)}:mailto:${event.organizerEmail}`);
    }

    (attendees || []).forEach((person) => {
        const partstat = {
            accepted: "ACCEPTED",
            declined: "DECLINED",
            tentative: "TENTATIVE"
        }[person.response] || "NEEDS-ACTION";

        lines.push(
            `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=${person.isOptional ? "OPT-PARTICIPANT" : "REQ-PARTICIPANT"};`
            + `PARTSTAT=${partstat};RSVP=TRUE;CN=${icsEscape(person.displayName || person.email)}`
            + `:mailto:${person.email}`
        );
    });

    if (event.reminder > 0) {
        lines.push(
            "BEGIN:VALARM",
            "ACTION:DISPLAY",
            `TRIGGER:-PT${event.reminder}M`,
            `DESCRIPTION:${icsEscape(event.title)}`,
            "END:VALARM"
        );
    }

    lines.push("END:VEVENT", "END:VCALENDAR");

    return lines.map(foldLine).join("\r\n");
}

function resolveBaseUrl(req) {
    const configured = process.env.API_BASE_URL
        || process.env.VITE_API_BASE_URL
        || process.env.VITE_API_AUTH_URL;

    if (configured) {
        return String(configured).replace(/\/+$/, "");
    }

    if (req) {
        const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
        const host = req.headers["x-forwarded-host"] || req.headers.host;

        if (host) {
            return `${proto}://${host}`;
        }
    }

    return "";
}

function htmlEscape(text) {
    return String(text == null ? "" : text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function addToCalendarLinks(event) {
    const stamp = (value) => new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

    const outlook = new URLSearchParams({
        path: "/calendar/action/compose",
        rru: "addevent",
        subject: event.title || "",
        body: event.description || "",
        location: event.location || "",
        startdt: new Date(event.startDate).toISOString(),
        enddt: new Date(event.endDate).toISOString()
    });

    const google = new URLSearchParams({
        action: "TEMPLATE",
        text: event.title || "",
        details: event.description || "",
        location: event.location || "",
        dates: `${stamp(event.startDate)}/${stamp(event.endDate)}`
    });

    return {
        outlook: `https://outlook.office.com/calendar/0/deeplink/compose?${outlook.toString()}`,
        google: `https://calendar.google.com/calendar/render?${google.toString()}`
    };
}

function inviteHtml(event, person, method, baseUrl) {
    baseUrl = String(baseUrl || "").replace(/\/+$/, "");

    const cancelled = method === "CANCEL";
    const calendarLinks = addToCalendarLinks(event);

    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    const zone = event.timezone || "America/Chicago";

    const dayLine = start.toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: zone
    });

    const timeLine = `${start.toLocaleTimeString("en-US", {
        hour: "numeric", minute: "2-digit", timeZone: zone
    })} to ${end.toLocaleTimeString("en-US", {
        hour: "numeric", minute: "2-digit", timeZone: zone, timeZoneName: "short"
    })}`;

    const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
    const length = minutes >= 60
        ? `${Math.floor(minutes / 60)} hour${Math.floor(minutes / 60) === 1 ? "" : "s"}`
          + (minutes % 60 ? ` ${minutes % 60} minutes` : "")
        : `${minutes} minutes`;

    const detail = (label, value) => value
        ? `<tr>
             <td style="padding:0 0 22px 0;">
               <div style="color:#6f7789;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.09em;padding-bottom:7px;">${htmlEscape(label)}</div>
               <div style="color:#ebf0f8;font-size:15px;font-weight:500;line-height:1.6;">${htmlEscape(value)}</div>
             </td>
           </tr>`
        : "";

    const button = (answer, label, colour, tint) =>
        `<td style="padding:0 10px 0 0;">
           <a href="${baseUrl}/calendar-events/respond?token=${person.inviteToken}&amp;response=${answer}"
              style="display:inline-block;padding:12px 26px;background:${tint};border:2px solid ${colour};border-radius:6px;color:${colour};font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.02em;">${label}</a>
         </td>`;

    const outlookLink = "https://outlook.office.com/calendar/0/deeplink/compose?"
        + new URLSearchParams({
            path: "/calendar/action/compose",
            rru: "addevent",
            subject: event.title || "",
            startdt: new Date(event.startDate).toISOString(),
            enddt: new Date(event.endDate).toISOString(),
            location: event.location || "",
            body: event.description || ""
        }).toString();

    const googleLink = "https://calendar.google.com/calendar/render?"
        + new URLSearchParams({
            action: "TEMPLATE",
            text: event.title || "",
            dates: `${new Date(event.startDate).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`
                   + `/${new Date(event.endDate).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
            location: event.location || "",
            details: event.description || ""
        }).toString();

    const addLinks = cancelled
        ? ""
        : `<tr>
             <td style="padding:6px 0 0 0;border-top:1px solid #3d4354;">
               <div style="color:#6f7789;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.09em;padding:22px 0 6px 0;">Add To Your Calendar</div>
               <div style="color:#8b93a7;font-size:13px;font-weight:500;line-height:1.6;padding-bottom:16px;">Replying above tells the organizer. Use a link below to put the event on your own calendar.</div>
               <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                 <td style="padding:0 10px 0 0;">
                   <a href="${outlookLink}" style="display:inline-block;padding:11px 22px;background:rgba(107,166,255,0.15);border:2px solid #6ba6ff;border-radius:6px;color:#6ba6ff;font-size:13px;font-weight:700;text-decoration:none;">Outlook</a>
                 </td>
                 <td style="padding:0 10px 0 0;">
                   <a href="${googleLink}" style="display:inline-block;padding:11px 22px;background:rgba(145,155,175,0.14);border:2px solid #919baf;border-radius:6px;color:#aab4c8;font-size:13px;font-weight:700;text-decoration:none;">Google</a>
                 </td>
               </tr></table>
             </td>
           </tr>`;

    const actions = cancelled
        ? ""
        : `<tr>
             <td style="padding:8px 0 0 0;border-top:1px solid #3d4354;">
               <div style="color:#6f7789;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.09em;padding:22px 0 6px 0;">Will You Attend</div>
               <div style="color:#8b93a7;font-size:13px;font-weight:500;line-height:1.6;padding-bottom:16px;">Choose one below. Your answer is recorded straight away and the organizer is updated.</div>
               <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                 ${button("accepted", "Yes", "#10b981", "rgba(16,185,129,0.15)")}
                 ${button("tentative", "Maybe", "#f59e0b", "rgba(245,158,11,0.15)")}
                 ${button("declined", "No", "#ef4444", "rgba(239,68,68,0.15)")}
               </tr></table>
             </td>
           </tr>`;

    return `<!doctype html>
<html>
  <body style="margin:0;padding:44px 16px;background-color:#0a0c10;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#151922;background-image:linear-gradient(160deg,#1a1f29 0%,#12151b 100%);border:1px solid #3d4354;border-radius:10px;overflow:hidden;">

          <tr>
            <td style="padding:22px 36px;background-color:#0d1015;border-bottom:2px solid #3d4354;">
              <div style="color:#4ecdc4;font-size:12px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;">Dino Labs</div>
            </td>
          </tr>

          <tr>
            <td style="padding:34px 36px 0 36px;">
              <div style="color:#6f7789;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.09em;padding-bottom:12px;">${cancelled ? "Event Cancelled" : "You Are Invited"}</div>
              <div style="color:#ebf0f8;font-size:24px;font-weight:700;line-height:1.35;${cancelled ? "text-decoration:line-through;color:#6f7789;" : ""}">${htmlEscape(event.title)}</div>
              <div style="color:#8b93a7;font-size:14px;font-weight:500;line-height:1.6;padding-top:12px;">
                ${cancelled
                  ? "This event has been removed from the calendar. No reply is needed."
                  : `${htmlEscape(event.organizerEmail || "The organizer")} added you to this event. The details are below.`}
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:30px 36px 34px 36px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${detail("When", `${dayLine}, ${timeLine}`)}
                ${detail("How Long", length)}
                ${detail("Where", event.location)}
                ${detail("Details", event.description)}
                ${actions}
                ${addLinks}
              </table>
            </td>
          </tr>

          ${cancelled ? "" : `<tr>
            <td style="padding:0 36px 30px 36px;">
              <div style="color:#6f7789;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.09em;padding-bottom:6px;">Add To Your Calendar</div>
              <div style="color:#8b93a7;font-size:13px;font-weight:500;line-height:1.6;padding-bottom:14px;">Replying above tells the organizer. Use a link below to put the event on your own calendar.</div>
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td style="padding:0 10px 0 0;">
                  <a href="${calendarLinks.outlook}" style="display:inline-block;padding:10px 20px;background:rgba(107,166,255,0.12);border:2px solid #6ba6ff;border-radius:6px;color:#6ba6ff;font-size:13px;font-weight:700;text-decoration:none;">Outlook</a>
                </td>
                <td style="padding:0 10px 0 0;">
                  <a href="${calendarLinks.google}" style="display:inline-block;padding:10px 20px;background:rgba(107,166,255,0.12);border:2px solid #6ba6ff;border-radius:6px;color:#6ba6ff;font-size:13px;font-weight:700;text-decoration:none;">Google</a>
                </td>
              </tr></table>
            </td>
          </tr>`}

          <tr>
            <td style="padding:20px 36px;background-color:#0d1015;border-top:1px solid #3d4354;">
              <div style="color:#6f7789;font-size:12px;font-weight:500;line-height:1.7;">
                ${cancelled
                  ? "This notice was sent by the Dino Labs calendar. The attached file removes the event from Apple Calendar."
                  : "This invitation was sent by the Dino Labs calendar. The attached file works with Apple Calendar."}
              </div>
            </td>
          </tr>

        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

async function sendInvite(event, person, attendees, method, baseUrl) {
    if (!process.env.RESEND_API_KEY) {
        return { sent: false, error: "RESEND_API_KEY is not set on the server." };
    }

    if (typeof fetch !== "function") {
        return { sent: false, error: "This Node version has no global fetch. Node 18 or newer is required." };
    }

    const from = process.env.RESEND_FROM_EMAIL || process.env.MAIN_FROM_EMAIL;

    if (!from) {
        return { sent: false, error: "Neither RESEND_FROM_EMAIL nor MAIN_FROM_EMAIL is set." };
    }

    const ics = buildIcs(event, attendees, method);
    const cancelled = method === "CANCEL";

    try {
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.RESEND_API_KEY}`
            },
            body: JSON.stringify({
                from: from,
                to: [person.email],
                subject: cancelled ? `Cancelled: ${event.title}` : `Invitation: ${event.title}`,
                html: inviteHtml(event, person, method, baseUrl),
                attachments: [{
                    filename: "invite.ics",
                    content: Buffer.from(ics, "utf8").toString("base64"),
                    content_type: `text/calendar; charset=utf-8; method=${method || "REQUEST"}`
                }]
            })
        });

        if (!response.ok) {
            const body = await response.text();
            return { sent: false, error: `Resend returned ${response.status}. ${body}`.slice(0, 300) };
        }

        return { sent: true, error: null };
    } catch (error) {
        return { sent: false, error: String(error.message || error).slice(0, 300) };
    }
}

function normalizeOrgId(val) {
    if (val === undefined || val === null) return null;
    const s = String(val).trim().toLowerCase();
    if (s === "" || s === "null" || s === "undefined") return null;
    return /^\d+$/.test(s) ? Number(s) : val;
}

router.post("/calendar-events", authenticateToken, async (req, res, next) => {
    const { userID, rangeStart, rangeEnd } = req.body;
    let { organizationID } = req.body;
    organizationID = normalizeOrgId(organizationID);

    req.on("close", () => { return; });

    try {
        const getEventsQuery = `
            SELECT 
                e.id,
                e.title,
                e.description,
                to_char(e.start_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as start_date,
                to_char(e.end_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as end_date,
                e.timezone,
                e.all_day,
                e.location,
                e.attendees,
                e.organizer_email,
                e.reminder_minutes,
                e.color,
                e.event_type,
                e.status,
                e.rrule,
                e.series_id,
                e.excluded_dates,
                e.sequence,
                e.created_at,
                e.updated_at,
                COALESCE(
                    (SELECT json_agg(json_build_object(
                        'email', a.email,
                        'displayName', a.display_name,
                        'response', a.response,
                        'isOrganizer', a.is_organizer,
                        'isOptional', a.is_optional,
                        'invitedAt', a.invite_sent_at,
                        'inviteError', a.invite_error
                     ) ORDER BY a.is_organizer DESC, a.email ASC)
                       FROM calendar_attendees a WHERE a.event_id = e.id),
                    '[]'::json
                ) as invitees
            FROM calendar_events e
            WHERE e.username = $1 AND (e.orgid = $2 OR ($2 IS NULL AND e.orgid IS NULL))
            ORDER BY e.start_date ASC
        `;

        const getEventsInfo = await pool.query(getEventsQuery, [userID, organizationID]);

        if (getEventsInfo.error) {
            return res.status(500).json({ message: "Unable To Fetch Calendar Events At This Time. Please Try Again Later." });
        }

        const windowStart = rangeStart ? new Date(rangeStart) : new Date(Date.now() - 365 * 86400000);
        const windowEnd = rangeEnd ? new Date(rangeEnd) : new Date(Date.now() + 365 * 86400000);

        const formattedEvents = [];

        getEventsInfo.rows.forEach((row) => {
            const base = {
                id: row.id,
                title: row.title,
                description: row.description,
                startDate: row.start_date,
                endDate: row.end_date,
                timezone: row.timezone,
                allDay: row.all_day,
                location: row.location,
                attendees: row.attendees || [],
                invitees: row.invitees || [],
                organizerEmail: row.organizer_email,
                reminder: row.reminder_minutes,
                color: row.color,
                type: row.event_type,
                status: row.status,
                rrule: row.rrule,
                seriesId: row.series_id,
                excludedDates: row.excluded_dates || [],
                sequence: row.sequence,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            };

            expandRecurrence(base, windowStart, windowEnd).forEach(occurrence => {
                formattedEvents.push(occurrence);
            });
        });

        formattedEvents.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

        let holidays = [];

        const prefs = await pool.query(
            "SELECT show_holidays, holiday_country FROM calendar_preferences WHERE username = $1",
            [userID]
        );

        const wantsHolidays = prefs.rowCount === 0 || prefs.rows[0].show_holidays;
        const country = prefs.rowCount ? prefs.rows[0].holiday_country : "US";

        if (wantsHolidays) {
            const years = [];

            for (let y = windowStart.getUTCFullYear(); y <= windowEnd.getUTCFullYear(); y++) {
                years.push(y);
            }

            for (const year of years) {
                await ensureHolidays(country, year);
            }

            const holidayRows = await pool.query(
                `SELECT to_char(holiday_date, 'YYYY-MM-DD') as holiday_date, name, local_name
                   FROM calendar_holidays
                  WHERE country_code = $1 AND year = ANY($2::int[])
                  ORDER BY holiday_date ASC`,
                [country, years]
            );

            holidays = holidayRows.rows.map(row => ({
                id: `holiday-${row.holiday_date}-${row.name}`,
                date: row.holiday_date,
                name: row.name,
                localName: row.local_name
            }));
        }

        return res.status(200).json({ events: formattedEvents, holidays: holidays });
    } catch (error) {
        if (!res.headersSent) {
            return res.status(500).json({
                message: "Error Connecting To The Database. Please Try Again Later.",
                detail: String(error && error.message ? error.message : error).slice(0, 300)
            });
        }
        next(error);
    }
});

async function syncAttendees(eventID, orgid, emails, organizerEmail, ownerUsername) {
    const clean = [];
    const seen = new Set();

    (emails || []).forEach((raw) => {
        const email = String(raw || "").trim().toLowerCase();

        if (!email || email.indexOf("@") < 1 || seen.has(email)) {
            return;
        }

        seen.add(email);
        clean.push(email);
    });

    await pool.query(
        "DELETE FROM calendar_attendees WHERE event_id = $1 AND NOT (LOWER(email) = ANY($2::text[]))",
        [eventID, clean.length ? clean : [""]]
    );

    for (const email of clean) {
        await pool.query(
            `INSERT INTO calendar_attendees (event_id, orgid, email, username, is_organizer, invite_token)
             SELECT $1, $2, $3, u.username, $4, $5
               FROM (SELECT $3::text AS e) x
               LEFT JOIN users u ON LOWER(u.email) = $3
             ON CONFLICT (event_id, email) DO NOTHING`,
            [eventID, orgid, email, organizerEmail ? email === String(organizerEmail).toLowerCase() : false, newInviteToken()]
        );
    }

    for (const email of clean) {
        await pool.query(
            `INSERT INTO calendar_contacts (orgid, username, email, times_invited, last_invited_at)
             VALUES ($1, $2, $3, 1, CURRENT_TIMESTAMP)
             ON CONFLICT (username, email) DO UPDATE SET
                times_invited = calendar_contacts.times_invited + 1,
                last_invited_at = CURRENT_TIMESTAMP`,
            [orgid, ownerUsername, email]
        );
    }

    const rows = await pool.query(
        `SELECT email, display_name, response, is_organizer, is_optional, invite_token, invite_sent_at
           FROM calendar_attendees WHERE event_id = $1 ORDER BY is_organizer DESC, email ASC`,
        [eventID]
    );

    return rows.rows.map(row => ({
        email: row.email,
        displayName: row.display_name,
        response: row.response,
        isOrganizer: row.is_organizer,
        isOptional: row.is_optional,
        inviteToken: row.invite_token,
        invitedAt: row.invite_sent_at
    }));
}

async function dispatchInvites(event, attendees, method, baseUrl) {
    const report = [];

    if (!attendees || attendees.length === 0) {
        return report;
    }

    for (const person of attendees) {
        if (person.isOrganizer) {
            continue;
        }

        if (method !== "CANCEL" && person.invitedAt) {
            continue;
        }

        const result = await sendInvite(event, person, attendees, method, baseUrl);

        report.push({
            email: person.email,
            sent: result.sent,
            reason: result.sent ? "Sent." : result.error
        });

        await pool.query(
            `UPDATE calendar_attendees
                SET invite_sent_at = CASE WHEN $3 THEN CURRENT_TIMESTAMP ELSE invite_sent_at END,
                    invite_error = $4
              WHERE event_id = $1 AND email = $2`,
            [event.id, person.email, result.sent, result.error]
        );
    }

    return report;
}

async function ensureHolidays(country, year) {
    const existing = await pool.query(
        "SELECT COUNT(*)::int AS count FROM calendar_holidays WHERE country_code = $1 AND year = $2",
        [country, year]
    );

    if (existing.rows[0].count > 0) {
        return;
    }

    try {
        const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`);

        if (!response.ok) {
            return;
        }

        const days = await response.json();

        for (const day of days) {
            await pool.query(
                `INSERT INTO calendar_holidays (country_code, year, holiday_date, name, local_name, is_national)
                 VALUES ($1, $2, $3::date, $4, $5, $6)
                 ON CONFLICT (country_code, holiday_date, name) DO NOTHING`,
                [country, year, day.date, day.name, day.localName, day.global !== false]
            );
        }
    } catch (error) {
        return;
    }
}

router.post("/calendar-events/create", authenticateToken, async (req, res, next) => {
    const { userID, event } = req.body;
    let { organizationID } = req.body;
    organizationID = normalizeOrgId(organizationID);

    req.on("close", () => { return; });

    try {
        if (!event.title || !event.title.trim()) {
            return res.status(400).json({ message: "Event Title Is Required." });
        }

        const startDate = new Date(event.startDate);
        const endDate = new Date(event.endDate);
        
        if (startDate.getTime() >= endDate.getTime()) {
            return res.status(400).json({ message: "End Time Must Be After Start Time." });
        }

        const createEventQuery = `
            INSERT INTO calendar_events (
                orgid, 
                username, 
                title, 
                description, 
                start_date, 
                end_date, 
                location, 
                attendees, 
                reminder_minutes, 
                color, 
                event_type,
                timezone,
                all_day,
                organizer_email,
                rrule
            )
            VALUES ($1, $2, $3, $4, $5::timestamptz, $6::timestamptz, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING id, title, description, 
                     to_char(start_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as start_date, 
                     to_char(end_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as end_date, 
                     location, attendees, reminder_minutes, color, event_type, timezone, all_day,
                     organizer_email, rrule, status, sequence, created_at, updated_at
        `;

        const organizer = await pool.query("SELECT email FROM users WHERE username = $1", [userID]);
        const organizerEmail = organizer.rowCount ? organizer.rows[0].email : null;

        const createEventInfo = await pool.query(createEventQuery, [
            organizationID,
            userID,
            event.title.trim(),
            event.description || "",
            event.startDate,
            event.endDate,
            event.location || "",
            event.attendees || [],
            event.reminder || 15,
            event.color || "#3B82F6",
            event.type || "event",
            event.timezone || "America/Chicago",
            event.allDay === true,
            organizerEmail,
            event.rrule || null
        ]);

        if (createEventInfo.error) {
            return res.status(500).json({ message: "Unable To Create Calendar Event At This Time. Please Try Again Later." });
        }

        const newEvent = createEventInfo.rows[0];
        const formattedEvent = {
            id: newEvent.id,
            title: newEvent.title,
            description: newEvent.description,
            startDate: newEvent.start_date,
            endDate: newEvent.end_date,
            timezone: newEvent.timezone,
            allDay: newEvent.all_day,
            location: newEvent.location,
            attendees: newEvent.attendees || [],
            organizerEmail: newEvent.organizer_email,
            reminder: newEvent.reminder_minutes,
            color: newEvent.color,
            type: newEvent.event_type,
            status: newEvent.status,
            rrule: newEvent.rrule,
            sequence: newEvent.sequence,
            createdAt: newEvent.created_at,
            updatedAt: newEvent.updated_at
        };

        const invitees = await syncAttendees(newEvent.id, organizationID, event.attendees, organizerEmail, userID);
        formattedEvent.invitees = invitees;

        let inviteReport = [];

        if (event.sendInvites !== false) {
            inviteReport = await dispatchInvites(formattedEvent, invitees, "REQUEST", resolveBaseUrl(req));
        }

        return res.status(200).json({ 
            message: "Calendar Event Created Successfully.",
            event: formattedEvent,
            invites: inviteReport
        });
    } catch (error) {
        if (!res.headersSent) {
            return res.status(500).json({
                message: "Error Connecting To The Database. Please Try Again Later.",
                detail: String(error && error.message ? error.message : error).slice(0, 300)
            });
        }
        next(error);
    }
});

router.post("/calendar-events/update", authenticateToken, async (req, res, next) => {
    const { userID, eventID, event } = req.body;
    let { organizationID } = req.body;
    organizationID = normalizeOrgId(organizationID);

    req.on("close", () => { return; });

    try {
        if (!event.title || !event.title.trim()) {
            return res.status(400).json({ message: "Event Title Is Required." });
        }

        const startDate = new Date(event.startDate);
        const endDate = new Date(event.endDate);
        
        if (startDate.getTime() >= endDate.getTime()) {
            return res.status(400).json({ message: "End Time Must Be After Start Time." });
        }

        const updateEventQuery = `
            UPDATE calendar_events
            SET 
                title = $3,
                description = $4,
                start_date = $5::timestamptz,
                end_date = $6::timestamptz,
                location = $7,
                attendees = $8,
                reminder_minutes = $9,
                color = $10,
                event_type = $11,
                timezone = $13,
                all_day = $14,
                rrule = $15,
                sequence = sequence + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 
              AND username = $2 
              AND (orgid = $12 OR ($12 IS NULL AND orgid IS NULL))
            RETURNING id, title, description, 
                     to_char(start_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as start_date,
                     to_char(end_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as end_date,
                     location, attendees, reminder_minutes, color, event_type, timezone, all_day,
                     organizer_email, rrule, status, sequence, created_at, updated_at
        `;

        const updateEventInfo = await pool.query(updateEventQuery, [
            eventID,
            userID,
            event.title.trim(),
            event.description || "",
            event.startDate,
            event.endDate,
            event.location || "",
            event.attendees || [],
            event.reminder || 15,
            event.color || "#3B82F6",
            event.type || "event",
            organizationID,
            event.timezone || "America/Chicago",
            event.allDay === true,
            event.rrule || null
        ]);

        if (updateEventInfo.rowCount === 0) {
            return res.status(404).json({ message: "Calendar Event Not Found Or Access Denied." });
        }

        const updatedEvent = updateEventInfo.rows[0];
        const formattedEvent = {
            id: updatedEvent.id,
            title: updatedEvent.title,
            description: updatedEvent.description,
            startDate: updatedEvent.start_date,
            endDate: updatedEvent.end_date,
            timezone: updatedEvent.timezone,
            allDay: updatedEvent.all_day,
            location: updatedEvent.location,
            attendees: updatedEvent.attendees || [],
            organizerEmail: updatedEvent.organizer_email,
            reminder: updatedEvent.reminder_minutes,
            color: updatedEvent.color,
            type: updatedEvent.event_type,
            status: updatedEvent.status,
            rrule: updatedEvent.rrule,
            sequence: updatedEvent.sequence,
            createdAt: updatedEvent.created_at,
            updatedAt: updatedEvent.updated_at
        };

        const invitees = await syncAttendees(
            updatedEvent.id, organizationID, event.attendees, updatedEvent.organizer_email, userID
        );

        await pool.query(
            `UPDATE calendar_events
                SET title = $2, description = $3, start_date = $4::timestamptz,
                    end_date = $5::timestamptz, location = $6, timezone = $7,
                    all_day = $8, updated_at = CURRENT_TIMESTAMP
              WHERE source_event_id = $1`,
            [
                updatedEvent.id, event.title.trim(), event.description || "",
                event.startDate, event.endDate, event.location || "",
                event.timezone || "America/Chicago", event.allDay === true
            ]
        );

        formattedEvent.invitees = invitees;

        let inviteReport = [];

        if (event.sendInvites !== false) {
            inviteReport = await dispatchInvites(formattedEvent, invitees, "REQUEST", resolveBaseUrl(req));
        }

        return res.status(200).json({ 
            message: "Calendar Event Updated Successfully.",
            event: formattedEvent,
            invites: inviteReport
        });
    } catch (error) {
        if (!res.headersSent) {
            return res.status(500).json({
                message: "Error Connecting To The Database. Please Try Again Later.",
                detail: String(error && error.message ? error.message : error).slice(0, 300)
            });
        }
        next(error);
    }
});

router.post("/calendar-events/delete", authenticateToken, async (req, res, next) => {
    const { userID, eventID } = req.body;
    let { organizationID } = req.body;
    organizationID = normalizeOrgId(organizationID);

    req.on("close", () => { return; });

    try {
        const doomed = await pool.query(
            `SELECT id, title, description, location, timezone, reminder_minutes, sequence, organizer_email,
                    to_char(start_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as start_date,
                    to_char(end_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as end_date
               FROM calendar_events
              WHERE id = $1 AND username = $2 AND (orgid = $3 OR ($3 IS NULL AND orgid IS NULL))`,
            [eventID, userID, organizationID]
        );

        if (doomed.rowCount > 0) {
            const row = doomed.rows[0];

            const people = await pool.query(
                `SELECT email, display_name, response, is_organizer, is_optional, invite_token, invite_sent_at
                   FROM calendar_attendees WHERE event_id = $1 AND invite_sent_at IS NOT NULL`,
                [eventID]
            );

            const attendees = people.rows.map(person => ({
                email: person.email,
                displayName: person.display_name,
                response: person.response,
                isOrganizer: person.is_organizer,
                isOptional: person.is_optional,
                inviteToken: person.invite_token,
                invitedAt: person.invite_sent_at
            }));

            if (attendees.length) {
                await dispatchInvites({
                    id: row.id,
                    title: row.title,
                    description: row.description,
                    location: row.location,
                    timezone: row.timezone,
                    reminder: row.reminder_minutes,
                    sequence: (row.sequence || 0) + 1,
                    organizerEmail: row.organizer_email,
                    startDate: row.start_date,
                    endDate: row.end_date,
                    status: "cancelled"
                }, attendees, "CANCEL", resolveBaseUrl(req));
            }
        }

        await pool.query("DELETE FROM calendar_events WHERE source_event_id = $1", [eventID]);

        const deleteEventQuery = `
            DELETE FROM calendar_events
            WHERE id = $1 
              AND username = $2 
              AND (orgid = $3 OR ($3 IS NULL AND orgid IS NULL))
        `;

        const deleteEventInfo = await pool.query(deleteEventQuery, [eventID, userID, organizationID]);

        if (deleteEventInfo.rowCount === 0) {
            return res.status(404).json({ message: "Calendar Event Not Found Or Access Denied." });
        }

        return res.status(200).json({ message: "Calendar Event Deleted Successfully." });
    } catch (error) {
        if (!res.headersSent) {
            return res.status(500).json({
                message: "Error Connecting To The Database. Please Try Again Later.",
                detail: String(error && error.message ? error.message : error).slice(0, 300)
            });
        }
        next(error);
    }
});

router.post("/calendar-events/duplicate", authenticateToken, async (req, res, next) => {
    const { userID, eventID } = req.body;
    let { organizationID } = req.body;
    organizationID = normalizeOrgId(organizationID);

    req.on("close", () => { return; });

    try {
        const getEventQuery = `
            SELECT 
                title,
                description,
                start_date,
                end_date,
                timezone,
                all_day,
                location,
                attendees,
                organizer_email,
                reminder_minutes,
                color,
                event_type,
                rrule
            FROM calendar_events
            WHERE id = $1 
              AND username = $2 
              AND (orgid = $3 OR ($3 IS NULL AND orgid IS NULL))
        `;

        const getEventInfo = await pool.query(getEventQuery, [eventID, userID, organizationID]);

        if (getEventInfo.rowCount === 0) {
            return res.status(404).json({ message: "Calendar Event Not Found Or Access Denied." });
        }

        const originalEvent = getEventInfo.rows[0];

        const duplicateEventQuery = `
            INSERT INTO calendar_events (
                orgid, 
                username, 
                title, 
                description, 
                start_date, 
                end_date, 
                location, 
                attendees, 
                reminder_minutes, 
                color, 
                event_type,
                timezone,
                all_day,
                organizer_email,
                rrule
            )
            VALUES ($1, $2, $3, $4, $5::timestamptz, $6::timestamptz, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING id, title, description, 
                     to_char(start_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as start_date,
                     to_char(end_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as end_date,
                     location, attendees, reminder_minutes, color, event_type, timezone, all_day,
                     organizer_email, rrule, status, sequence, created_at, updated_at
        `;

        const shifted = await pool.query(
            `SELECT ($1::timestamptz + INTERVAL '1 day') AS start_date,
                    ($2::timestamptz + INTERVAL '1 day') AS end_date`,
            [originalEvent.start_date, originalEvent.end_date]
        );

        const duplicateEventInfo = await pool.query(duplicateEventQuery, [
            organizationID,
            userID,
            originalEvent.title + " (Copy)",
            originalEvent.description,
            shifted.rows[0].start_date,
            shifted.rows[0].end_date,
            originalEvent.location,
            originalEvent.attendees,
            originalEvent.reminder_minutes,
            originalEvent.color,
            originalEvent.event_type,
            originalEvent.timezone,
            originalEvent.all_day,
            originalEvent.organizer_email,
            originalEvent.rrule
        ]);

        const duplicatedEvent = duplicateEventInfo.rows[0];
        const formattedEvent = {
            id: duplicatedEvent.id,
            title: duplicatedEvent.title,
            description: duplicatedEvent.description,
            startDate: duplicatedEvent.start_date,
            endDate: duplicatedEvent.end_date,
            timezone: duplicatedEvent.timezone,
            allDay: duplicatedEvent.all_day,
            location: duplicatedEvent.location,
            attendees: duplicatedEvent.attendees || [],
            organizerEmail: duplicatedEvent.organizer_email,
            reminder: duplicatedEvent.reminder_minutes,
            color: duplicatedEvent.color,
            type: duplicatedEvent.event_type,
            status: duplicatedEvent.status,
            rrule: duplicatedEvent.rrule,
            sequence: duplicatedEvent.sequence,
            invitees: [],
            createdAt: duplicatedEvent.created_at,
            updatedAt: duplicatedEvent.updated_at
        };

        return res.status(200).json({ 
            message: "Calendar Event Duplicated Successfully.",
            event: formattedEvent
        });
    } catch (error) {
        if (!res.headersSent) {
            return res.status(500).json({
                message: "Error Connecting To The Database. Please Try Again Later.",
                detail: String(error && error.message ? error.message : error).slice(0, 300)
            });
        }
        next(error);
    }
});

router.get("/calendar-events/respond", async (req, res, next) => {
    const { token, response } = req.query;

    const allowed = ["accepted", "declined", "tentative"];

    if (!token || !allowed.includes(String(response))) {
        return res.status(400).send(respondPage("That response link is not valid.", false));
    }

    try {
        const before = await pool.query(
            `SELECT a.event_id, a.email, a.response, a.responded_at,
                    COALESCE(a.username, u.username) AS username
               FROM calendar_attendees a
               LEFT JOIN users u ON LOWER(u.email) = LOWER(a.email)
              WHERE a.invite_token = $1`,
            [token]
        );

        if (before.rowCount === 0) {
            return res.status(404).send(respondPage("That invitation could not be found.", false));
        }

        const previous = before.rows[0];

        await pool.query(
            `UPDATE calendar_attendees
                SET response = $2, responded_at = CURRENT_TIMESTAMP, username = COALESCE(username, $3)
              WHERE invite_token = $1`,
            [token, response, previous.username]
        );

        await mirrorToAttendee(previous.event_id, previous.username, response);

        const event = await pool.query(
            "SELECT title FROM calendar_events WHERE id = $1",
            [previous.event_id]
        );

        const title = event.rowCount ? event.rows[0].title : "this event";

        const wording = {
            accepted: "You are going",
            declined: "You declined",
            tentative: "You replied maybe"
        };

        const already = previous.responded_at != null;
        const same = previous.response === response;

        if (already && same) {
            return res.status(200).send(respondPage(
                `${wording[response]} to ${title}.`,
                true,
                `You already replied on ${new Date(previous.responded_at).toLocaleDateString("en-US", {
                    month: "long", day: "numeric", year: "numeric"
                })}. Nothing has changed.`
            ));
        }

        if (already) {
            return res.status(200).send(respondPage(
                `${wording[response]} to ${title}.`,
                true,
                `Your answer was changed from ${wording[previous.response] || "no reply"} `
                + `to ${wording[response]}. The organizer can see the update.`
            ));
        }

        return res.status(200).send(respondPage(
            `${wording[response]} to ${title}.`,
            true,
            "Your answer has been recorded and the organizer can see it."
        ));
    } catch (error) {
        if (!res.headersSent) {
            return res.status(500).send(respondPage("That response could not be saved.", false));
        }
        next(error);
    }
});

async function mirrorToAttendee(eventID, attendeeUsername, response) {
    if (!attendeeUsername) {
        return;
    }

    if (response === "declined") {
        await pool.query(
            "DELETE FROM calendar_events WHERE source_event_id = $1 AND username = $2",
            [eventID, attendeeUsername]
        );

        return;
    }

    const origin = await pool.query(
        `SELECT orgid, title, description, start_date, end_date, timezone, all_day,
                location, organizer_email, reminder_minutes, color, event_type, rrule
           FROM calendar_events WHERE id = $1`,
        [eventID]
    );

    if (origin.rowCount === 0) {
        return;
    }

    const row = origin.rows[0];

    await pool.query(
        `INSERT INTO calendar_events
            (orgid, username, title, description, start_date, end_date, timezone, all_day,
             location, organizer_email, reminder_minutes, color, event_type, rrule,
             status, source_event_id)
         SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
          WHERE NOT EXISTS (
                SELECT 1 FROM calendar_events WHERE source_event_id = $16 AND username = $2
          )`,
        [
            row.orgid, attendeeUsername, row.title, row.description, row.start_date,
            row.end_date, row.timezone, row.all_day, row.location, row.organizer_email,
            row.reminder_minutes, row.color, row.event_type, row.rrule,
            response === "tentative" ? "tentative" : "confirmed",
            eventID
        ]
    );

    await pool.query(
        `UPDATE calendar_events
            SET status = $3, title = $4, description = $5, start_date = $6, end_date = $7,
                location = $8, updated_at = CURRENT_TIMESTAMP
          WHERE source_event_id = $1 AND username = $2`,
        [
            eventID, attendeeUsername,
            response === "tentative" ? "tentative" : "confirmed",
            row.title, row.description, row.start_date, row.end_date, row.location
        ]
    );
}

function respondPage(message, good, detail) {
    return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8">
    <link rel="icon" type="image/svg+xml" href="/assets/dinolabs.png" />
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <title>Dino Labs</title>
  </head>
  <body style="margin:0;padding:44px 16px;background-color:#0a0c10;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="min-height:70vh;">
      <tr><td align="center" valign="middle">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background-color:#151922;background-image:linear-gradient(160deg,#1a1f29 0%,#12151b 100%);border:1px solid #3d4354;border-radius:10px;overflow:hidden;">
          <tr>
            <td style="padding:22px 36px;background-color:#0d1015;border-bottom:2px solid #3d4354;">
              <div style="color:#4ecdc4;font-size:12px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;">Dino Labs</div>
            </td>
          </tr>
          <tr>
            <td style="padding:38px 36px;text-align:center;">
              <div style="font-size:34px;color:${good ? "#10b981" : "#ef4444"};line-height:1;">${good ? "&#10003;" : "&#10005;"}</div>
              <div style="padding-top:18px;color:#ebf0f8;font-size:17px;font-weight:700;line-height:1.5;">${htmlEscape(message)}</div>
              <div style="padding-top:12px;color:#6f7789;font-size:13px;font-weight:500;line-height:1.6;">${htmlEscape(detail || "You can close this window.")}</div>
              ${detail ? `<div style="padding-top:14px;color:#4a5163;font-size:12px;font-weight:500;">You can close this window.</div>` : ""}
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

router.post("/calendar-events/resend-invite", authenticateToken, async (req, res, next) => {
    const { userID, eventID, email } = req.body;
    let { organizationID } = req.body;
    organizationID = normalizeOrgId(organizationID);

    req.on("close", () => { return; });

    try {
        const found = await pool.query(
            `SELECT id, title, description, location, timezone, reminder_minutes, sequence, organizer_email,
                    rrule, status,
                    to_char(start_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as start_date,
                    to_char(end_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as end_date
               FROM calendar_events
              WHERE id = $1 AND username = $2 AND (orgid = $3 OR ($3 IS NULL AND orgid IS NULL))`,
            [eventID, userID, organizationID]
        );

        if (found.rowCount === 0) {
            return res.status(404).json({ message: "Calendar Event Not Found Or Access Denied." });
        }

        await pool.query(
            "UPDATE calendar_attendees SET invite_sent_at = NULL WHERE event_id = $1 AND LOWER(email) = LOWER($2)",
            [eventID, email]
        );

        const people = await pool.query(
            `SELECT email, display_name, response, is_organizer, is_optional, invite_token, invite_sent_at
               FROM calendar_attendees WHERE event_id = $1 ORDER BY is_organizer DESC, email ASC`,
            [eventID]
        );

        const attendees = people.rows.map(person => ({
            email: person.email,
            displayName: person.display_name,
            response: person.response,
            isOrganizer: person.is_organizer,
            isOptional: person.is_optional,
            inviteToken: person.invite_token,
            invitedAt: person.invite_sent_at
        }));

        const row = found.rows[0];

        await dispatchInvites({
            id: row.id,
            title: row.title,
            description: row.description,
            location: row.location,
            timezone: row.timezone,
            reminder: row.reminder_minutes,
            sequence: row.sequence,
            organizerEmail: row.organizer_email,
            rrule: row.rrule,
            status: row.status,
            startDate: row.start_date,
            endDate: row.end_date
        }, attendees, "REQUEST", resolveBaseUrl(req));

        return res.status(200).json({ message: "The Invitation Was Sent Again." });
    } catch (error) {
        if (!res.headersSent) {
            return res.status(500).json({
                message: "Error Connecting To The Database. Please Try Again Later.",
                detail: String(error && error.message ? error.message : error).slice(0, 300)
            });
        }
        next(error);
    }
});

router.post("/calendar-contacts", authenticateToken, async (req, res, next) => {
    const { userID } = req.body;
    let { organizationID } = req.body;
    organizationID = normalizeOrgId(organizationID);

    req.on("close", () => { return; });

    try {
        const contacts = await pool.query(
            `SELECT email, display_name, times_invited, last_invited_at
               FROM calendar_contacts
              WHERE username = $1
              ORDER BY times_invited DESC, last_invited_at DESC NULLS LAST
              LIMIT 200`,
            [userID]
        );

        const colleagues = await pool.query(
            `SELECT email, first_name, last_name
               FROM users
              WHERE orgid = $1 AND email IS NOT NULL AND TRIM(email) <> ''
              LIMIT 200`,
            [organizationID]
        );

        const seen = new Set();
        const people = [];

        contacts.rows.forEach((row) => {
            const email = String(row.email || "").toLowerCase();

            if (!email || seen.has(email)) {
                return;
            }

            seen.add(email);

            people.push({
                email: email,
                name: row.display_name || "",
                timesInvited: row.times_invited,
                source: "history"
            });
        });

        colleagues.rows.forEach((row) => {
            const email = String(row.email || "").toLowerCase();

            if (!email || seen.has(email)) {
                return;
            }

            seen.add(email);

            people.push({
                email: email,
                name: [row.first_name, row.last_name].filter(Boolean).join(" "),
                timesInvited: 0,
                source: "organization"
            });
        });

        return res.status(200).json({ contacts: people });
    } catch (error) {
        if (!res.headersSent) {
            return res.status(500).json({
                message: "Error Connecting To The Database. Please Try Again Later.",
                detail: String(error && error.message ? error.message : error).slice(0, 300)
            });
        }
        next(error);
    }
});

router.post("/calendar-locations", authenticateToken, async (req, res, next) => {
    const { userID, query, latitude, longitude } = req.body;

    req.on("close", () => { return; });

    try {
        const needle = String(query || "").trim();
        const results = [];
        const seen = new Set();

        const past = await pool.query(
            `SELECT location, COUNT(*)::int AS uses, MAX(start_date) AS last_used
               FROM calendar_events
              WHERE username = $1
                AND location IS NOT NULL
                AND TRIM(location) <> ''
                AND ($2 = '' OR location ILIKE '%' || $2 || '%')
              GROUP BY location
              ORDER BY COUNT(*) DESC, MAX(start_date) DESC
              LIMIT 5`,
            [userID, needle]
        );

        past.rows.forEach((row) => {
            const key = row.location.trim().toLowerCase();

            if (seen.has(key)) {
                return;
            }

            seen.add(key);

            results.push({
                label: row.location,
                detail: `Used ${row.uses} ${row.uses === 1 ? "time" : "times"}`,
                source: "history"
            });
        });

        if (needle.length >= 3) {
            const params = new URLSearchParams({ q: needle, limit: "6" });

            if (latitude != null && longitude != null) {
                params.set("lat", String(latitude));
                params.set("lon", String(longitude));
                params.set("location_bias_scale", "0.2");
            }

            try {
                const response = await fetch(`https://photon.komoot.io/api/?${params.toString()}`, {
                    headers: { "User-Agent": "DinoLabs/1.0 (calendar)" }
                });

                if (response.ok) {
                    const found = await response.json();

                    (found.features || []).forEach((feature) => {
                        const p = feature.properties || {};

                        const label = [p.name, p.housenumber && p.street ? `${p.housenumber} ${p.street}` : p.street]
                            .filter(Boolean)
                            .join(", ");

                        const detail = [p.city || p.district, p.state, p.country].filter(Boolean).join(", ");
                        const full = label || detail;

                        if (!full || seen.has(full.toLowerCase())) {
                            return;
                        }

                        seen.add(full.toLowerCase());

                        results.push({
                            label: full,
                            detail: label ? detail : "",
                            source: "map"
                        });
                    });
                }
            } catch (error) {
                return;
            }
        }

        return res.status(200).json({ locations: results.slice(0, 10) });
    } catch (error) {
        if (!res.headersSent) {
            return res.status(500).json({
                message: "Error Connecting To The Database. Please Try Again Later.",
                detail: String(error && error.message ? error.message : error).slice(0, 300)
            });
        }
        next(error);
    }
});

router.post("/calendar-preferences", authenticateToken, async (req, res, next) => {
    const { userID, preferences } = req.body;
    let { organizationID } = req.body;
    organizationID = normalizeOrgId(organizationID);

    req.on("close", () => { return; });

    try {
        if (!preferences) {
            const existing = await pool.query(
                "SELECT * FROM calendar_preferences WHERE username = $1",
                [userID]
            );

            if (existing.rowCount === 0) {
                return res.status(200).json({
                    preferences: {
                        timezone: "America/Chicago",
                        weekStartsOn: 0,
                        showHolidays: true,
                        holidayCountry: "US",
                        showWeekends: true,
                        dayStartHour: 7,
                        dayEndHour: 20,
                        defaultReminder: 15,
                        defaultDuration: 30
                    }
                });
            }

            const row = existing.rows[0];

            return res.status(200).json({
                preferences: {
                    timezone: row.timezone,
                    weekStartsOn: row.week_starts_on,
                    showHolidays: row.show_holidays,
                    holidayCountry: row.holiday_country,
                    showWeekends: row.show_weekends,
                    dayStartHour: row.day_start_hour,
                    dayEndHour: row.day_end_hour,
                    defaultReminder: row.default_reminder,
                    defaultDuration: row.default_duration
                }
            });
        }

        await pool.query(
            `INSERT INTO calendar_preferences
                (username, orgid, timezone, week_starts_on, show_holidays, holiday_country,
                 show_weekends, day_start_hour, day_end_hour, default_reminder, default_duration, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
             ON CONFLICT (username) DO UPDATE SET
                timezone = EXCLUDED.timezone,
                week_starts_on = EXCLUDED.week_starts_on,
                show_holidays = EXCLUDED.show_holidays,
                holiday_country = EXCLUDED.holiday_country,
                show_weekends = EXCLUDED.show_weekends,
                day_start_hour = EXCLUDED.day_start_hour,
                day_end_hour = EXCLUDED.day_end_hour,
                default_reminder = EXCLUDED.default_reminder,
                default_duration = EXCLUDED.default_duration,
                updated_at = CURRENT_TIMESTAMP`,
            [
                userID,
                organizationID,
                preferences.timezone || "America/Chicago",
                preferences.weekStartsOn != null ? preferences.weekStartsOn : 0,
                preferences.showHolidays !== false,
                preferences.holidayCountry || "US",
                preferences.showWeekends !== false,
                preferences.dayStartHour != null ? preferences.dayStartHour : 7,
                preferences.dayEndHour != null ? preferences.dayEndHour : 20,
                preferences.defaultReminder != null ? preferences.defaultReminder : 15,
                preferences.defaultDuration != null ? preferences.defaultDuration : 30
            ]
        );

        return res.status(200).json({ message: "Calendar Preferences Saved Successfully." });
    } catch (error) {
        if (!res.headersSent) {
            return res.status(500).json({
                message: "Error Connecting To The Database. Please Try Again Later.",
                detail: String(error && error.message ? error.message : error).slice(0, 300)
            });
        }
        next(error);
    }
});

module.exports = router;