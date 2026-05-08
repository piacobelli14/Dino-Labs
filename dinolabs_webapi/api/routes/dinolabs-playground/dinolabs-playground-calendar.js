const express = require("express");
const { pool } = require("../../config/db");
const { authenticateToken } = require("../../middleware/auth");

require("dotenv").config();

const router = express.Router();

function normalizeOrgId(val) {
    if (val === undefined || val === null) return null;
    const s = String(val).trim().toLowerCase();
    if (s === "" || s === "null" || s === "undefined") return null;
    return /^\d+$/.test(s) ? Number(s) : val;
}

router.post("/calendar-events", authenticateToken, async (req, res, next) => {
    const { userID } = req.body;
    let { organizationID } = req.body;
    organizationID = normalizeOrgId(organizationID);

    req.on("close", () => { return; });

    try {
        const getEventsQuery = `
            SELECT 
                id,
                title,
                description,
                to_char(start_date, 'YYYY-MM-DD HH24:MI:SS') as start_date,
                to_char(end_date, 'YYYY-MM-DD HH24:MI:SS') as end_date,
                location,
                attendees,
                reminder_minutes,
                color,
                event_type,
                created_at,
                updated_at
            FROM calendar_events
            WHERE username = $1 AND (orgid = $2 OR ($2 IS NULL AND orgid IS NULL))
            ORDER BY start_date ASC
        `;

        const getEventsInfo = await pool.query(getEventsQuery, [userID, organizationID]);
        
        if (getEventsInfo.error) {
            return res.status(500).json({ message: "Unable To Fetch Calendar Events At This Time. Please Try Again Later." });
        }

        const formattedEvents = getEventsInfo.rows.map(row => ({
            id: row.id,
            title: row.title,
            description: row.description,
            startDate: row.start_date,
            endDate: row.end_date,
            location: row.location,
            attendees: row.attendees || [],
            reminder: row.reminder_minutes,
            color: row.color,
            type: row.event_type,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }));

        return res.status(200).json({ events: formattedEvents });
    } catch (error) {
        if (!res.headersSent) {
            return res.status(500).json({ message: "Error Connecting To The Database. Please Try Again Later." });
        }
        next(error);
    }
});

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
                event_type
            )
            VALUES ($1, $2, $3, $4, $5::timestamp, $6::timestamp, $7, $8, $9, $10, $11)
            RETURNING id, title, description, 
                     to_char(start_date, 'YYYY-MM-DD HH24:MI:SS') as start_date, 
                     to_char(end_date, 'YYYY-MM-DD HH24:MI:SS') as end_date, 
                     location, attendees, reminder_minutes, color, event_type, created_at, updated_at
        `;

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
            event.type || "event"
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
            location: newEvent.location,
            attendees: newEvent.attendees || [],
            reminder: newEvent.reminder_minutes,
            color: newEvent.color,
            type: newEvent.event_type,
            createdAt: newEvent.created_at,
            updatedAt: newEvent.updated_at
        };

        return res.status(200).json({ 
            message: "Calendar Event Created Successfully.",
            event: formattedEvent
        });
    } catch (error) {
        if (!res.headersSent) {
            return res.status(500).json({ message: "Error Connecting To The Database. Please Try Again Later." });
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
                start_date = $5::timestamp,
                end_date = $6::timestamp,
                location = $7,
                attendees = $8,
                reminder_minutes = $9,
                color = $10,
                event_type = $11,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 
              AND username = $2 
              AND (orgid = $12 OR ($12 IS NULL AND orgid IS NULL))
            RETURNING id, title, description, 
                     to_char(start_date, 'YYYY-MM-DD HH24:MI:SS') as start_date,
                     to_char(end_date, 'YYYY-MM-DD HH24:MI:SS') as end_date,
                     location, attendees, reminder_minutes, color, event_type, created_at, updated_at
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
            organizationID
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
            location: updatedEvent.location,
            attendees: updatedEvent.attendees || [],
            reminder: updatedEvent.reminder_minutes,
            color: updatedEvent.color,
            type: updatedEvent.event_type,
            createdAt: updatedEvent.created_at,
            updatedAt: updatedEvent.updated_at
        };

        return res.status(200).json({ 
            message: "Calendar Event Updated Successfully.",
            event: formattedEvent
        });
    } catch (error) {
        if (!res.headersSent) {
            return res.status(500).json({ message: "Error Connecting To The Database. Please Try Again Later." });
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
            return res.status(500).json({ message: "Error Connecting To The Database. Please Try Again Later." });
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
                to_char(start_date, 'YYYY-MM-DD HH24:MI:SS') as start_date,
                to_char(end_date, 'YYYY-MM-DD HH24:MI:SS') as end_date,
                location,
                attendees,
                reminder_minutes,
                color,
                event_type
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
        const startDate = new Date(originalEvent.start_date);
        const endDate = new Date(originalEvent.end_date);
        
        startDate.setDate(startDate.getDate() + 1);
        endDate.setDate(endDate.getDate() + 1);

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
                event_type
            )
            VALUES ($1, $2, $3, $4, $5::timestamp, $6::timestamp, $7, $8, $9, $10, $11)
            RETURNING id, title, description, 
                     to_char(start_date, 'YYYY-MM-DD HH24:MI:SS') as start_date,
                     to_char(end_date, 'YYYY-MM-DD HH24:MI:SS') as end_date,
                     location, attendees, reminder_minutes, color, event_type, created_at, updated_at
        `;

        const formatDateForPostgres = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const day = String(date.getDate()).padStart(2, "0");
            const hours = String(date.getHours()).padStart(2, "0");
            const minutes = String(date.getMinutes()).padStart(2, "0");
            const seconds = String(date.getSeconds()).padStart(2, "0");
            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        };

        const duplicateEventInfo = await pool.query(duplicateEventQuery, [
            organizationID,
            userID,
            originalEvent.title + " (Copy)",
            originalEvent.description,
            formatDateForPostgres(startDate),
            formatDateForPostgres(endDate),
            originalEvent.location,
            originalEvent.attendees,
            originalEvent.reminder_minutes,
            originalEvent.color,
            originalEvent.event_type
        ]);

        const duplicatedEvent = duplicateEventInfo.rows[0];
        const formattedEvent = {
            id: duplicatedEvent.id,
            title: duplicatedEvent.title,
            description: duplicatedEvent.description,
            startDate: duplicatedEvent.start_date,
            endDate: duplicatedEvent.end_date,
            location: duplicatedEvent.location,
            attendees: duplicatedEvent.attendees || [],
            reminder: duplicatedEvent.reminder_minutes,
            color: duplicatedEvent.color,
            type: duplicatedEvent.event_type,
            createdAt: duplicatedEvent.created_at,
            updatedAt: duplicatedEvent.updated_at
        };

        return res.status(200).json({ 
            message: "Calendar Event Duplicated Successfully.",
            event: formattedEvent
        });
    } catch (error) {
        if (!res.headersSent) {
            return res.status(500).json({ message: "Error Connecting To The Database. Please Try Again Later." });
        }
        next(error);
    }
});

module.exports = router;