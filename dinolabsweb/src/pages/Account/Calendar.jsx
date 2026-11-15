import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalendarDays, faChevronLeft, faChevronRight, faPlus, faEdit,
  faTrash, faClock, faBell, faLocationDot, faUser,
  faSave, faTimes, faCalendarWeek, faCalendarDay, faSearch,
  faFilter, faEllipsisV, faCopy, faShareNodes, faDownload,
  faPrint, faRefresh, faArrowsRotate, faGlobe
} from "@fortawesome/free-solid-svg-icons";
import Nav from "../../helpers/Nav.jsx";
import Dropdown from "../../helpers/Dropdown.jsx";
import useAuth from "../../UseAuth.jsx";
import { showDialog } from "../../helpers/Alert.jsx";
import "../../styles/mainStyles/Account/Calendar.css";
import "../../styles/helperStyles/LoadingSpinner.css";
import "../../styles/helperStyles/Disconnected.css";

const Calendar = () => {
  const navigate = useNavigate();
  const { token, userID, loading, organizationID } = useAuth();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("month");
  const [showEventModal, setShowEventModal] = useState(false);
  const [showDayEventsModal, setShowDayEventsModal] = useState(false);
  const [selectedDayEvents, setSelectedDayEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showMiniCalendar, setShowMiniCalendar] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [draggedEvent, setDraggedEvent] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showExpandedEvents, setShowExpandedEvents] = useState({});
  const [isLoaded, setIsLoaded] = useState(false);
  const [backendError, setBackendError] = useState(false);
  const [events, setEvents] = useState([]);
  const [userTimezone, setUserTimezone] = useState("America/New_York");
  const [holidays, setHolidays] = useState([]);
  const [showHolidays, setShowHolidays] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [contacts, setContacts] = useState([]);
  const [inviteeDraft, setInviteeDraft] = useState("");
  const [resendState, setResendState] = useState({});
  const [locationQuery, setLocationQuery] = useState("");
  const [coords, setCoords] = useState(null);
  const [locationSuggestions, setLocationSuggestions] = useState([]);

  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    startDate: new Date(),
    endDate: new Date(),
    location: "",
    attendees: [],
    reminder: 15,
    color: "#3B82F6",
    type: "event",
    rrule: "",
    sendInvites: true
  });

  const eventModalRef = useRef(null);
  const inviteFailureRef = useRef(false);
  const calendarRef = useRef(null);

  const RECURRENCE_OPTIONS = [
    { label: "Never", rule: "" },
    { label: "Daily", rule: "RRULE:FREQ=DAILY" },
    { label: "Weekly", rule: "RRULE:FREQ=WEEKLY" },
    { label: "Weekdays", rule: "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" },
    { label: "Monthly", rule: "RRULE:FREQ=MONTHLY" },
    { label: "Yearly", rule: "RRULE:FREQ=YEARLY" }
  ];

  const eventTypes = [
    { value: "event", label: "Event", color: "#3B82F6" },
    { value: "meeting", label: "Meeting", color: "#10B981" },
    { value: "reminder", label: "Reminder", color: "#F59E0B" },
    { value: "deadline", label: "Deadline", color: "#EF4444" },
    { value: "personal", label: "Personal", color: "#8B5CF6" },
    { value: "review", label: "Review", color: "#14B8A6" },
    { value: "presentation", label: "Presentation", color: "#F97316" }
  ];

  const reminderOptions = [
    { value: 0, label: "At Time Of Event" },
    { value: 5, label: "5 Minutes Before" },
    { value: 15, label: "15 Minutes Before" },
    { value: 30, label: "30 Minutes Before" },
    { value: 60, label: "1 Hour Before" },
    { value: 1440, label: "1 Day Before" },
    { value: 10080, label: "1 Week Before" }
  ];

  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 0; hour < 24; hour++) {
      slots.push({
        hour,
        label: hour === 0 ? "12 AM" : hour === 12 ? "12 PM" : hour < 12 ? `${hour} AM` : `${hour - 12} PM`
      });
    }
    return slots;
  }, []);

  const detectBrowserTimezone = () => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (error) {
      return "America/New_York";
    }
  };

  const fetchUserTimezone = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/user-info`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ userID, organizationID })
      });
      const data = await response.json();
      const userData = data[0];
      
      if (userData && userData.timezone) {
        setUserTimezone(userData.timezone);
      } else {
        const browserTimezone = detectBrowserTimezone();
        setUserTimezone(browserTimezone);
      }
    } catch (error) {
      const browserTimezone = detectBrowserTimezone();
      setUserTimezone(browserTimezone);
    }
  };

  const formatDateInTimezone = (date, timezone, options = {}) => {
    const defaultOptions = {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit", 
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    };
    
    return new Date(date).toLocaleString("en-CA", { ...defaultOptions, ...options });
  };

  const formatTimeInTimezone = (date, timezone) => {
    return new Date(date).toLocaleString("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  };

  const formatDateForBackend = (date) => {
    return new Date(date).toISOString();
  };

  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || "").toLowerCase();

      if (tag === "input" || tag === "textarea" || e.metaKey || e.ctrlKey) {
        return;
      }

      if (showEventModal || showDayEventsModal) {
        if (e.key === "Escape") {
          setShowEventModal(false);
          setShowDayEventsModal(false);
        }
        return;
      }

      if (e.key === "ArrowLeft") {
        navigateDate(-1);
      } else if (e.key === "ArrowRight") {
        navigateDate(1);
      } else if (e.key === "t" || e.key === "T") {
        goToToday();
      } else if (e.key === "m" || e.key === "M") {
        setViewMode("month");
      } else if (e.key === "w" || e.key === "W") {
        setViewMode("week");
      } else if (e.key === "d" || e.key === "D") {
        setViewMode("day");
      } else if (e.key === "n" || e.key === "N") {
        openEventModal();
      }
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [showEventModal, showDayEventsModal, viewMode, currentDate]);

  useEffect(() => {
    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      },
      () => {
        setCoords(null);
      },
      { maximumAge: 600000, timeout: 8000 }
    );
  }, []);

  useEffect(() => {
    const needle = locationQuery.trim();

    if (!showEventModal) {
      return undefined;
    }

    if (needle.length < 2) {
      setLocationSuggestions([]);
      return undefined;
    }

    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const token = localStorage.getItem("token");

        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/calendar-locations`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            userID,
            organizationID,
            query: needle,
            latitude: coords ? coords.latitude : null,
            longitude: coords ? coords.longitude : null
          })
        });

        if (!response.ok || cancelled) {
          return;
        }

        const data = await response.json();

        if (!cancelled) {
          setLocationSuggestions(data.locations || []);
        }
      } catch (error) {
        return;
      }
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [locationQuery, coords, showEventModal, userID, organizationID]);

  const resendInvite = async (eventID, email) => {
    setResendState(prev => ({ ...prev, [email]: "sending" }));

    try {
      const token = localStorage.getItem("token");

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/calendar-events/resend-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userID, organizationID, eventID, email })
      });

      const data = await response.json().catch(() => ({}));
      const failure = (data.invites || []).find(invite => !invite.sent);

      if (!response.ok || failure) {
        setResendState(prev => ({ ...prev, [email]: "failed" }));

        await showDialog({
          title: "Invitation Was Not Sent",
          message: (failure && failure.reason) || data.detail || data.message
            || "That invitation could not be sent."
        });

        return;
      }

      setResendState(prev => ({ ...prev, [email]: "sent" }));
      await fetchCalendarEvents();

      setTimeout(() => {
        setResendState(prev => {
          const next = { ...prev };
          delete next[email];
          return next;
        });
      }, 4000);
    } catch (error) {
      setResendState(prev => ({ ...prev, [email]: "failed" }));
    }
  };

  const parseBackendDate = (dateString) => {
    return new Date(dateString.replace(" ", "T"));
  };

  const getTimeInTimezone = (date, timezone) => {
    const dateStr = new Date(date).toLocaleString("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
    
    const [datePart, timePart] = dateStr.split(", ");
    const [month, day, year] = datePart.split("/");
    const [hour, minute, second] = timePart.split(":");
    
    return {
      year: parseInt(year),
      month: parseInt(month),
      day: parseInt(day),
      hour: parseInt(hour),
      minute: parseInt(minute),
      second: parseInt(second)
    };
  };

  useEffect(() => {
    if (!loading && !token) navigate("/login");
  }, [token, loading, navigate]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        await fetchUserTimezone();
        await fetchCalendarEvents();
        await fetchContacts();
        setIsLoaded(true);
      } catch (error) {
        setBackendError(true);
        setIsLoaded(true);
      }
    };
    if (!loading && token) fetchData();
  }, [userID, loading, token]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (document.getElementById("noti-alert-root")) {
        return;
      }
      
      if (event.target && !event.target.isConnected) {
        return;
      }

      if (eventModalRef.current && !eventModalRef.current.contains(event.target)) {
        closeEventModal();
      }
    };

    if (showEventModal) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showEventModal]);

  const fetchCalendarEvents = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/calendar-events`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ userID, organizationID })
      });

      if (!response.ok) {
        throw new Error("Failed To Fetch Calendar Events.");
      }

      const data = await response.json();
      const formattedEvents = data.events.map(event => ({
        ...event,
        startDate: parseBackendDate(event.startDate),
        endDate: parseBackendDate(event.endDate)
      }));
      setEvents(formattedEvents);
      setHolidays(data.holidays || []);
    } catch (error) {
      if (error instanceof TypeError) {
        setBackendError(true);
      }
      throw error;
    }
  };

  const createCalendarEvent = async (eventData) => {
    try {
      const token = localStorage.getItem("token");
      
      const eventToSend = {
        ...eventData,
        startDate: formatDateForBackend(eventData.startDate),
        endDate: formatDateForBackend(eventData.endDate)
      };
      
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/calendar-events/create`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ userID, organizationID, event: eventToSend })
      });

      const data = await response.json();

      if (!response.ok) {
        await showDialog({
          title: "Error",
          message: data.detail || data.message || "Failed To Create Calendar Event."
        });
        return null;
      }

      const failed = (data.invites || []).filter(invite => !invite.sent);

      if (failed.length > 0) {
        inviteFailureRef.current = true;

        await showDialog({
          title: "Invitations Were Not Sent",
          message: failed.map(invite => `${invite.email || "No invitees"}: ${invite.reason}`).join("\n")
            + "\n\nThe event was saved. The form is still open so you can correct the invitees."
        });
      }

      return {
        ...data.event,
        startDate: parseBackendDate(data.event.startDate),
        endDate: parseBackendDate(data.event.endDate)
      };
    } catch (error) {
      if (!backendError) {
        await showDialog({ title: "Error", message: "Unable To Create Calendar Event. Please Try Again." });
      }
      return null;
    }
  };

  const updateCalendarEvent = async (eventID, eventData) => {
    try {
      const token = localStorage.getItem("token");
      
      const eventToSend = {
        ...eventData,
        startDate: formatDateForBackend(eventData.startDate),
        endDate: formatDateForBackend(eventData.endDate)
      };
      
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/calendar-events/update`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ userID, organizationID, eventID, event: eventToSend })
      });

      const data = await response.json();

      if (!response.ok) {
        await showDialog({
          title: "Error",
          message: data.detail || data.message || "Failed To Update Calendar Event."
        });
        return null;
      }

      const failedUpdates = (data.invites || []).filter(invite => !invite.sent);

      if (failedUpdates.length > 0) {
        inviteFailureRef.current = true;

        await showDialog({
          title: "Invitations Were Not Sent",
          message: failedUpdates.map(invite => `${invite.email || "No invitees"}: ${invite.reason}`).join("\n")
            + "\n\nThe event was saved. The form is still open so you can correct the invitees."
        });
      }

      return {
        ...data.event,
        startDate: parseBackendDate(data.event.startDate),
        endDate: parseBackendDate(data.event.endDate)
      };
    } catch (error) {
      if (!backendError) {
        await showDialog({ title: "Error", message: "Unable To Update Calendar Event. Please Try Again." });
      }
      return null;
    }
  };

  const deleteCalendarEvent = async (eventID) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/calendar-events/delete`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ userID, organizationID, eventID })
      });

      const data = await response.json();

      if (!response.ok) {
        await showDialog({ title: "Error", message: data.message || "Failed To Delete Calendar Event." });
        return false;
      }

      return true;
    } catch (error) {
      if (!backendError) {
        await showDialog({ title: "Error", message: "Unable To Delete Calendar Event. Please Try Again." });
      }
      return false;
    }
  };

  const duplicateCalendarEvent = async (eventID) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/calendar-events/duplicate`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ userID, organizationID, eventID })
      });

      const data = await response.json();

      if (!response.ok) {
        await showDialog({ title: "Error", message: data.message || "Failed To Duplicate Calendar Event." });
        return null;
      }

      return {
        ...data.event,
        startDate: parseBackendDate(data.event.startDate),
        endDate: parseBackendDate(data.event.endDate)
      };
    } catch (error) {
      if (!backendError) {
        await showDialog({ title: "Error", message: "Unable To Duplicate Calendar Event. Please Try Again." });
      }
      return null;
    }
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    for (let i = 0; i < startingDayOfWeek; i++) {
      const prevDate = new Date(year, month, -startingDayOfWeek + i + 1);
      days.push({ date: prevDate, isCurrentMonth: false });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push({ date: new Date(year, month, day), isCurrentMonth: true });
    }

    const remainingSlots = 42 - days.length;
    for (let i = 1; i <= remainingSlots; i++) {
      const nextDate = new Date(year, month + 1, i);
      days.push({ date: nextDate, isCurrentMonth: false });
    }

    return days;
  };

  const getWeekDays = (date) => {
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day;
    startOfWeek.setDate(diff);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const inviteeSuggestions = useMemo(() => {
    const needle = inviteeDraft.trim().toLowerCase();

    if (needle.length < 2) {
      return [];
    }

    return contacts
      .filter(person => !newEvent.attendees.includes(person.email))
      .filter(person => person.email.includes(needle)
        || String(person.name || "").toLowerCase().includes(needle))
      .slice(0, 6);
  }, [contacts, inviteeDraft, newEvent.attendees]);

  const addInvitee = (raw) => {
    const email = String(raw || "").trim().toLowerCase().replace(/,$/, "");

    if (!email || email.indexOf("@") < 1) {
      setInviteeDraft("");
      return;
    }

    if (!newEvent.attendees.includes(email)) {
      setNewEvent(prev => ({ ...prev, attendees: [...prev.attendees, email] }));
    }

    setInviteeDraft("");
  };

  const fetchContacts = async () => {
    try {
      const token = localStorage.getItem("token");

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/calendar-contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userID, organizationID })
      });

      if (response.ok) {
        const data = await response.json();
        setContacts(data.contacts || []);
      }
    } catch (error) {
      return;
    }
  };

  const searchResults = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();

    if (!needle) {
      return [];
    }

    return events
      .filter(event => [event.title, event.description, event.location]
        .concat(event.attendees || [])
        .some(field => String(field || "").toLowerCase().includes(needle)))
      .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
      .slice(0, 40);
  }, [events, searchTerm]);

  const matchesSearch = (event) => {
    const needle = searchTerm.trim().toLowerCase();

    if (!needle) {
      return true;
    }

    return [event.title, event.description, event.location]
      .concat((event.attendees || []))
      .some(field => String(field || "").toLowerCase().includes(needle));
  };

  const getHolidayForDate = (date) => {
    if (!showHolidays) {
      return null;
    }

    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    return holidays.find(h => h.date === key) || null;
  };

  const getEventsForDate = (date) => {
    return events.filter(event => {
      const eventStartDate = new Date(event.startDate);
      const eventEndDate = new Date(event.endDate);
      const checkDate = new Date(date);
      
      checkDate.setHours(0, 0, 0, 0);
      const eventStartDay = new Date(eventStartDate);
      eventStartDay.setHours(0, 0, 0, 0);
      const eventEndDay = new Date(eventEndDate);
      eventEndDay.setHours(23, 59, 59, 999);
      
      return checkDate >= eventStartDay && checkDate <= eventEndDay && matchesSearch(event);
    });
  };

  const getEventsForWeek = (startDate) => {
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);
    
    return events.filter(event => {
      const eventStartDate = new Date(event.startDate);
      const eventEndDate = new Date(event.endDate);
      return (eventStartDate <= endDate && eventEndDate >= startDate);
    });
  };

  const getFilteredEvents = () => {
    return events;
  };

  const getDateKey = (date) => {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  };

  const getEventPosition = (event, date, isWeekView = false) => {
    const startDate = new Date(event.startDate);
    const endDate = new Date(event.endDate);
    
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    const startDay = new Date(startDate);
    startDay.setHours(0, 0, 0, 0);
    const endDay = new Date(endDate);
    endDay.setHours(0, 0, 0, 0);
    
    let displayStartHour = 0;
    let displayStartMinute = 0;
    let displayEndHour = 23;
    let displayEndMinute = 59;
    
    const isStartDay = checkDate.getTime() === startDay.getTime();
    const isEndDay = checkDate.getTime() === endDay.getTime();
    const isMiddleDay = checkDate > startDay && checkDate < endDay;
    
    if (isStartDay && !isEndDay) {
      displayStartHour = startDate.getHours();
      displayStartMinute = startDate.getMinutes();
      displayEndHour = 23;
      displayEndMinute = 59;
    } else if (isEndDay && !isStartDay) {
      displayStartHour = 0;
      displayStartMinute = 0;
      displayEndHour = endDate.getHours();
      displayEndMinute = endDate.getMinutes();
    } else if (isStartDay && isEndDay) {
      displayStartHour = startDate.getHours();
      displayStartMinute = startDate.getMinutes();
      displayEndHour = endDate.getHours();
      displayEndMinute = endDate.getMinutes();
    } else if (isMiddleDay) {
      displayStartHour = 0;
      displayStartMinute = 0;
      displayEndHour = 23;
      displayEndMinute = 59;
    }
    
    // Both views use 64px per hour (60px slot + 4px margin)
    const pixelsPerHour = 64;
    const pixelsPerMinute = pixelsPerHour / 60;
    
    const top = (displayStartHour * pixelsPerHour) + (displayStartMinute * pixelsPerMinute);
    
    // Add 1 to the end minute to extend through the full minute
    // So 11:59 becomes 12:00 (end of that minute)
    const effectiveEndMinute = displayEndMinute + 1;
    const effectiveEndHour = displayEndHour + Math.floor(effectiveEndMinute / 60);
    const finalEndMinute = effectiveEndMinute % 60;
    
    const endPosition = (effectiveEndHour * pixelsPerHour) + (finalEndMinute * pixelsPerMinute);
    
    const height = Math.max(endPosition - top, 30);

    return { top, height };
  };

  const getEventDisplayTime = (event, date) => {
    const startDate = new Date(event.startDate);
    const endDate = new Date(event.endDate);

    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    
    const startDay = new Date(startDate);
    startDay.setHours(0, 0, 0, 0);
    
    const endDay = new Date(endDate);
    endDay.setHours(0, 0, 0, 0);
    
    const isStartDay = checkDate.getTime() === startDay.getTime();
    const isEndDay = checkDate.getTime() === endDay.getTime();
    const isSingleDayEvent = startDay.getTime() === endDay.getTime();
    
    if (isSingleDayEvent) {
      return `${formatTimeInTimezone(startDate, userTimezone)} - ${formatTimeInTimezone(endDate, userTimezone)}`;
    } else if (isStartDay) {
      return `${formatTimeInTimezone(startDate, userTimezone)} - 11:59 PM`;
    } else if (isEndDay) {
      return `12:00 AM - ${formatTimeInTimezone(endDate, userTimezone)}`;
    } else {
      return "12:00 AM - 11:59 PM";
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      timeZone: userTimezone,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  const formatTime = (date) => {
    return formatTimeInTimezone(date, userTimezone);
  };

  const isToday = (date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isSelectedDate = (date) => {
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const navigateWeek = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction * 7));
    setCurrentDate(newDate);
  };

  const navigateDay = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + direction);
    setCurrentDate(newDate);
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const handleDateClick = (date) => {
    setSelectedDate(date);
    if (viewMode === "month") {
      setCurrentDate(date);
    }
  };

  const handleTimeSlotClick = (hour) => {
    const newDate = new Date(selectedDate);
    newDate.setHours(hour, 0, 0, 0);
    openEventModal(null, newDate);
  };

  const openDayEventsModal = (date, events) => {
    setSelectedDayEvents(events);
    setSelectedDate(date);
    setShowDayEventsModal(true);
  };

  const closeDayEventsModal = () => {
    setShowDayEventsModal(false);
    setSelectedDayEvents([]);
  };

  const toggleExpandedEvents = (dateKey) => {
    setShowExpandedEvents(prev => ({
      ...prev,
      [dateKey]: !prev[dateKey]
    }));
  };

  const openEventModal = (event = null, date = null) => {
    if (event) {
      setSelectedEvent(event);
      
      const startDate = new Date(event.startDate);
      const endDate = new Date(event.endDate);
      
      const startDay = new Date(startDate);
      startDay.setHours(0, 0, 0, 0);
      const endDay = new Date(endDate);
      endDay.setHours(0, 0, 0, 0);
      
      const isMultiDay = startDay.getTime() !== endDay.getTime();
      
      if (isMultiDay) {
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 0, 0);
      }
      
      setNewEvent({ 
        ...event,
        startDate: startDate,
        endDate: endDate
      });
      setIsEditing(true);
    } else {
      const startDate = date ? new Date(date) : new Date(selectedDate);
      const endDate = new Date(startDate.getTime());
      endDate.setHours(startDate.getHours() + 1);
      
      setSelectedEvent(null);
      setNewEvent({
        title: "",
        description: "",
        startDate: startDate,
        endDate: endDate,
        location: "",
        attendees: [],
        rrule: "",
        sendInvites: true,
        reminder: 15,
        color: "#3B82F6",
        type: "event"
      });
      setIsEditing(false);
    }
    setShowEventModal(true);
  };

  const closeEventModal = () => {
    setShowEventModal(false);
    setSelectedEvent(null);
    setIsEditing(false);
  };

  const saveEvent = async () => {
    if (!newEvent.title.trim()) {
      await showDialog({ title: "Error", message: "Please Enter A Valid Event Title." });
      return;
    }

    const startTime = new Date(newEvent.startDate).getTime();
    const endTime = new Date(newEvent.endDate).getTime();
    
    if (endTime <= startTime) {
      await showDialog({ title: "Error", message: "End Time Must Be After Start Time." });
      return;
    }
    
    const timeDiff = endTime - startTime;
    const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
    if (daysDiff > 7) {
      const proceed = await showDialog({ 
        title: "Long Event", 
        message: `This Event Is ${Math.ceil(daysDiff)} Days Long. Are You Sure This Is Correct?`, 
        showCancel: true 
      });
      if (proceed === null) {
        return;
      }
    }

    try {
      if (isEditing) {
        inviteFailureRef.current = false;
        const updatedEvent = await updateCalendarEvent(selectedEvent.id, newEvent);
        if (updatedEvent) {
          setEvents(events.map(event => 
            event.id === selectedEvent.id ? updatedEvent : event
          ));

          if (!inviteFailureRef.current) {
            closeEventModal();
          } else {
            setSelectedEvent(updatedEvent);
          }
        }
      } else {
        inviteFailureRef.current = false;
        const newCreatedEvent = await createCalendarEvent(newEvent);
        if (newCreatedEvent) {
          setEvents([...events, newCreatedEvent]);

          if (!inviteFailureRef.current) {
            closeEventModal();
          } else {
            setSelectedEvent(newCreatedEvent);
            setIsEditing(true);
          }
        }
      }
    } catch (error) {
      await showDialog({ title: "Error", message: "An Unexpected Error Occurred. Please Try Again." });
    }
  };

  const deleteEvent = async () => {
    if (selectedEvent) {
      const success = await deleteCalendarEvent(selectedEvent.id);
      if (success) {
        setEvents(events.filter(event => event.id !== selectedEvent.id));
        closeEventModal();
      }
    }
  };

  const duplicateEvent = async () => {
    if (selectedEvent) {
      const duplicatedEvent = await duplicateCalendarEvent(selectedEvent.id);
      if (duplicatedEvent) {
        setEvents([...events, duplicatedEvent]);
        closeEventModal();
      }
    }
  };

  const exportEvents = () => {
    const eventsJson = JSON.stringify(getFilteredEvents(), null, 2);
    const blob = new Blob([eventsJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "calendar-events.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const retryFetch = () => {
    setIsLoaded(false);
    setBackendError(false);
    const fetchData = async () => {
      try {
        await fetchUserTimezone();
        await fetchCalendarEvents();
        await fetchContacts();
        setIsLoaded(true);
      } catch (error) {
        setBackendError(true);
        setIsLoaded(true);
      }
    };
    fetchData();
  };

  const CustomDateTimePicker = ({ value, onChange, label }) => {
    const [showPicker, setShowPicker] = useState(false);
    const [selectedDate, setSelectedDate] = useState(value || new Date());
    const [viewDate, setViewDate] = useState(value || new Date());
    const pickerRef = useRef(null);

    useEffect(() => {
      if (value) {
        setSelectedDate(new Date(value));
        setViewDate(new Date(value));
      }
    }, [value]);

    useEffect(() => {
      const handleClickOutside = (event) => {
        if (pickerRef.current && !pickerRef.current.contains(event.target)) {
          setShowPicker(false);
        }
      };

      if (showPicker) {
        document.addEventListener("mousedown", handleClickOutside);
      }

      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [showPicker]);

    const getTimeComponents = () => {
      const timeStr = formatTimeInTimezone(selectedDate, userTimezone);
      
      const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (match) {
        return {
          hour12: parseInt(match[1]),
          minute: parseInt(match[2]),
          ampm: match[3].toUpperCase()
        };
      }
      
      return {
        hour12: 12,
        minute: 0,
        ampm: "AM"
      };
    };

    const getDaysInMonth = (date) => {
      const year = date.getFullYear();
      const month = date.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const daysInMonth = lastDay.getDate();
      const startingDayOfWeek = firstDay.getDay();

      const days = [];
      
      for (let i = 0; i < startingDayOfWeek; i++) {
        const prevDate = new Date(year, month, -startingDayOfWeek + i + 1);
        days.push({ date: prevDate, isCurrentMonth: false });
      }

      for (let day = 1; day <= daysInMonth; day++) {
        days.push({ date: new Date(year, month, day), isCurrentMonth: true });
      }

      const remainingSlots = 42 - days.length;
      for (let i = 1; i <= remainingSlots; i++) {
        const nextDate = new Date(year, month + 1, i);
        days.push({ date: nextDate, isCurrentMonth: false });
      }

      return days;
    };

    const navigateMonth = (direction) => {
      const newDate = new Date(viewDate);
      newDate.setMonth(viewDate.getMonth() + direction);
      setViewDate(newDate);
    };

    const handleDateSelect = (date) => {
      const newDateTime = new Date(selectedDate.getTime());
      newDateTime.setFullYear(date.getFullYear());
      newDateTime.setMonth(date.getMonth());
      newDateTime.setDate(date.getDate());
      newDateTime.setSeconds(0, 0);
      setSelectedDate(newDateTime);
      onChange(newDateTime);
    };

    const handleTimeChange = (type, value) => {
      const newDateTime = new Date(selectedDate.getTime());
      
      if (type === "hour") {
        const hour12 = parseInt(value);
        const ampmValue = getTimeComponents().ampm;
        
        let hour24;
        if (ampmValue === "AM") {
          hour24 = hour12 === 12 ? 0 : hour12;
        } else {
          hour24 = hour12 === 12 ? 12 : hour12 + 12;
        }
        
        newDateTime.setHours(hour24, newDateTime.getMinutes(), 0, 0);
      } else if (type === "minute") {
        newDateTime.setMinutes(parseInt(value), 0, 0);
      } else if (type === "ampm") {
        const currentHour12 = newDateTime.getHours() % 12 || 12;
        
        let hour24;
        if (value === "AM") {
          hour24 = currentHour12 === 12 ? 0 : currentHour12;
        } else {
          hour24 = currentHour12 === 12 ? 12 : currentHour12 + 12;
        }
        
        newDateTime.setHours(hour24, newDateTime.getMinutes(), 0, 0);
      }
      
      setSelectedDate(newDateTime);
      onChange(newDateTime);
    };

    const formatDisplayValue = () => {
      return selectedDate.toLocaleString("en-US", {
        timeZone: userTimezone,
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      });
    };

    const isToday = (date) => {
      const today = new Date();
      return (
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear()
      );
    };

    const isSelected = (date) => {
      return (
        date.getDate() === selectedDate.getDate() &&
        date.getMonth() === selectedDate.getMonth() &&
        date.getFullYear() === selectedDate.getFullYear()
      );
    };

    const days = getDaysInMonth(viewDate);
    const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const timeComponents = getTimeComponents();

    return (
      <div className="codeCalendarFormGroup">
        <label>{label}</label>
        <div className="customDateTimePickerWrapper" ref={pickerRef}>
          <div
            className="customDateTimePickerDisplay"
            onClick={() => setShowPicker(!showPicker)}
          >
            {formatDisplayValue()}
            <FontAwesomeIcon icon={faCalendarDays} />
          </div>
          
          {showPicker && (
            <div className="customDateTimePickerDropdown">
              <div className="customDatePickerHeader">
                <button
                  type="button"
                  className="customDatePickerNavButton"
                  onClick={() => navigateMonth(-1)}
                >
                  <FontAwesomeIcon icon={faChevronLeft} />
                </button>
                <h4>
                  {viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </h4>
                <button
                  type="button"
                  className="customDatePickerNavButton"
                  onClick={() => navigateMonth(1)}
                >
                  <FontAwesomeIcon icon={faChevronRight} />
                </button>
              </div>
              
              <div className="customDatePickerWeekHeader">
                {weekDays.map(day => (
                  <div key={day} className="customDatePickerWeekDay">
                    {day}
                  </div>
                ))}
              </div>
              
              <div className="customDatePickerDaysGrid">
                {days.map((dayObj, index) => (
                  <div
                    key={index}
                    className={`customDatePickerDay ${!dayObj.isCurrentMonth ? "otherMonth" : ""} ${isToday(dayObj.date) ? "today" : ""} ${isSelected(dayObj.date) ? "selected" : ""}`}
                    onClick={() => handleDateSelect(dayObj.date)}
                  >
                    {dayObj.date.getDate()}
                  </div>
                ))}
              </div>
              
              <div className="customTimePickerSection">
                <div className="customTimePickerLabel">Time ({userTimezone})</div>
                <div className="customTimePickerInputs">
                  <Dropdown
                    className="customTimePickerDropdown"
                    value={timeComponents.hour12.toString().padStart(2, "0")}
                    onChange={(label) => handleTimeChange("hour", label)}
                    options={Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, "0"))}
                    placeholder="Hour"
                  />
                  <span className="customTimePickerSeparator">:</span>
                  <Dropdown
                    className="customTimePickerDropdown"
                    value={timeComponents.minute.toString().padStart(2, "0")}
                    onChange={(label) => handleTimeChange("minute", label)}
                    options={Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"))}
                    placeholder="Minute"
                  />
                  <Dropdown
                    className="customTimePickerDropdown"
                    value={timeComponents.ampm}
                    onChange={(label) => handleTimeChange("ampm", label)}
                    options={["AM", "PM"]}
                    placeholder="Period"
                  />
                </div>
              </div>
              
              <div className="customDateTimePickerActions">
                <button
                  type="button"
                  className="customDateTimePickerButton secondary"
                  onClick={() => setShowPicker(false)}
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    const days = getDaysInMonth(currentDate);
    const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    return (
      <div className="codeCalendarGrid">
        <div className="codeCalendarWeekHeader">
          {weekDays.map(day => (
            <div key={day} className="codeCalendarWeekDay">
              {day}
            </div>
          ))}
        </div>
        <div className="codeCalendarDaysGrid">
          {days.map((dayObj, index) => {
            const dayEvents = getEventsForDate(dayObj.date);
            const holiday = getHolidayForDate(dayObj.date);

            return (
              <div
                key={index}
                className={`codeCalendarDay ${!dayObj.isCurrentMonth ? "otherMonth" : ""} ${isToday(dayObj.date) ? "today" : ""} ${isSelectedDate(dayObj.date) ? "selected" : ""} ${holiday ? "holiday" : ""}`}
                onClick={() => handleDateClick(dayObj.date)}
              >
                <div className="codeCalendarDayNumber">
                  {dayObj.date.getDate()}
                </div>

                {holiday && (
                  <div className="codeCalendarHoliday" title={holiday.name}>
                    {holiday.name}
                  </div>
                )}

                <div className="codeCalendarDayEvents">
                  {dayEvents.slice(0, 3).map(event => (
                    <div
                      key={event.id}
                      className="codeCalendarDayChip"
                      style={{ borderLeftColor: event.color }}
                      title={event.title}
                      onClick={(e) => {
                        e.stopPropagation();
                        openEventModal(event);
                      }}
                    >
                      {event.rrule ? <FontAwesomeIcon icon={faArrowsRotate} /> : null}
                      <span className="codeCalendarDayChipText">{event.title}</span>
                    </div>
                  ))}

                  {dayEvents.length > 3 && (
                    <div
                      className="codeCalendarEventCount"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDayEventsModal(dayObj.date, dayEvents);
                      }}
                    >
                      {dayEvents.length - 3} More
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const weekDays = getWeekDays(currentDate);
    const weekEvents = getEventsForWeek(weekDays[0]);

    return (
      <div className="codeCalendarWeekView">
        <div className="codeCalendarWeekHeader">
          <div className="codeCalendarTimeColumn"></div>
          {weekDays.map(day => (
            <div
              key={day.toISOString()}
              className={`codeCalendarWeekDay ${isToday(day) ? "today" : ""} ${isSelectedDate(day) ? "selected" : ""}`}
              onClick={() => handleDateClick(day)}
            >
              <div className="codeCalendarWeekDayName">
                {day.toLocaleDateString("en-US", { weekday: "short" })}
              </div>
              <div className="codeCalendarWeekDayNumber">
                {day.getDate()}
              </div>
            </div>
          ))}
        </div>
        <div className="codeCalendarWeekContent">
          <div className="codeCalendarTimeColumn">
            {timeSlots.map(slot => (
              <div key={slot.hour} className="codeCalendarTimeSlot">
                <span className="codeCalendarTimeLabel">{slot.label}</span>
              </div>
            ))}
          </div>
          {weekDays.map(day => (
            <div key={day.toISOString()} className="codeCalendarDayColumn">
              {timeSlots.map(slot => (
                <div
                  key={slot.hour}
                  className="codeCalendarHourSlot"
                  onClick={() => {
                    setSelectedDate(day);
                    handleTimeSlotClick(slot.hour);
                  }}
                >
                  {slot.hour === currentTime.getHours() && isToday(day) && (
                    <div className="codeCalendarCurrentTimeLine" />
                  )}
                </div>
              ))}
              {getEventsForDate(day).map(event => {
                const position = getEventPosition(event, day, true);
                return (
                  <div
                    key={event.id}
                    className="codeCalendarWeekEvent"
                    style={{
                      top: `${position.top}px`,
                      height: `${position.height}px`,
                      backgroundColor: event.color
                    }}
                    onClick={() => openEventModal(event)}
                  >
                    <div className="codeCalendarEventTitle">
                      {event.title}
                    </div>
                    <div className="codeCalendarEventTime">
                      {getEventDisplayTime(event, day)}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const dayEvents = getEventsForDate(selectedDate);

    return (
      <div className="codeCalendarDayView">
        <div className="codeCalendarDayHeader">
          <h3>{formatDate(selectedDate)}</h3>
        </div>
        <div className="codeCalendarDayContent">
          <div className="codeCalendarTimeColumn">
            {timeSlots.map(slot => (
              <div key={slot.hour} className="codeCalendarTimeSlot">
                <span className="codeCalendarTimeLabel">{slot.label}</span>
              </div>
            ))}
          </div>
          <div className="codeCalendarDayColumn">
            {timeSlots.map(slot => (
              <div
                key={slot.hour}
                className="codeCalendarHourSlot"
                onClick={() => handleTimeSlotClick(slot.hour)}
              >
                {slot.hour === currentTime.getHours() && isToday(selectedDate) && (
                  <div className="codeCalendarCurrentTimeLine" />
                )}
              </div>
            ))}
            {dayEvents.map(event => {
              const position = getEventPosition(event, selectedDate, false);
              return (
                <div
                  key={event.id}
                  className="codeCalendarDayEvent"
                  style={{
                    top: `${position.top}px`,
                    height: `${position.height}px`,
                    backgroundColor: event.color
                  }}
                  onClick={() => openEventModal(event)}
                >
                  <div className="codeCalendarEventTitle">
                    {event.title}
                  </div>
                  <div className="codeCalendarEventTime">
                    {getEventDisplayTime(event, selectedDate)}
                  </div>
                  {event.location && (
                    <div className="codeCalendarEventLocation">
                      <FontAwesomeIcon icon={faLocationDot} /> {event.location}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderMiniCalendar = () => {
    const days = getDaysInMonth(currentDate);
    const weekDays = ["S", "M", "T", "W", "T", "F", "S"];

    return (
      <div className="codeCalendarMini">
        <div className="codeCalendarMiniHeader">
          <button
            className="codeCalendarNavButton"
            onClick={() => navigateMonth(-1)}
          >
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>
          <h4>
            {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </h4>
          <button
            className="codeCalendarNavButton"
            onClick={() => navigateMonth(1)}
          >
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </div>
        <div className="codeCalendarMiniWeekHeader">
          {weekDays.map((day, index) => (
            <div key={index} className="codeCalendarMiniWeekDay">
              {day}
            </div>
          ))}
        </div>
        <div className="codeCalendarMiniDays">
          {days.map((dayObj, index) => (
            <div
              key={index}
              className={`codeCalendarMiniDay ${!dayObj.isCurrentMonth ? "otherMonth" : ""} ${isToday(dayObj.date) ? "today" : ""} ${isSelectedDate(dayObj.date) ? "selected" : ""}`}
              onClick={() => handleDateClick(dayObj.date)}
            >
              {dayObj.date.getDate()}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDayEventsModal = () => {
    if (!showDayEventsModal) return null;

    return (
      <div className="codeCalendarModalOverlay">
        <div className="codeCalendarModal" ref={eventModalRef}>
          <div className="codeCalendarModalHeader">
            <h3>Events For {formatDate(selectedDate)}</h3>
            <button
              className="codeCalendarModalClose"
              onClick={closeDayEventsModal}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>

          <div className="codeCalendarModalContent">
            <div className="codeCalendarDayEventsList">
              {selectedDayEvents.map(event => (
                <div key={event.id} className="codeCalendarDayEventItem">
                  <div className="codeCalendarDayEventInfo">
                    <div 
                      className="codeCalendarDayEventColor"
                      style={{ backgroundColor: event.color }}
                    />
                    <div className="codeCalendarDayEventDetails">
                      <div className="codeCalendarDayEventTitle">{event.title}</div>
                      <div className="codeCalendarDayEventTime">
                        {getEventDisplayTime(event, selectedDate)}
                      </div>
                      {event.location && (
                        <div className="codeCalendarDayEventLocation">
                          <FontAwesomeIcon icon={faLocationDot} /> {event.location}
                        </div>
                      )}
                      {event.description && (
                        <div className="codeCalendarDayEventDescription">
                          {event.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="codeCalendarDayEventActions">
                    <button
                      className="codeCalendarButton secondary"
                      onClick={() => {
                        closeDayEventsModal();
                        openEventModal(event);
                      }}
                    >
                      <FontAwesomeIcon icon={faEdit} />
                    </button>
                    <button
                      className="codeCalendarButton danger"
                      onClick={async () => {
                        const success = await deleteCalendarEvent(event.id);
                        if (success) {
                          setEvents(events.filter(e => e.id !== event.id));
                          closeDayEventsModal();
                        }
                      }}
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="codeCalendarModalActions">
            <button
              className="codeCalendarButton primary"
              onClick={() => {
                closeDayEventsModal();
                openEventModal();
              }}
            >
              <FontAwesomeIcon icon={faPlus} /> Add New Event
            </button>
            <button
              className="codeCalendarButton secondary"
              onClick={closeDayEventsModal}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderEventModal = () => {
    if (!showEventModal) return null;

    return (
      <div className="codeCalendarModalOverlay">
        <div className="codeCalendarModal" ref={eventModalRef}>
          <div className="codeCalendarModalHeader">
            <h3>{isEditing ? "Edit Event" : "Create New Event"}</h3>
            <button
              className="codeCalendarModalClose"
              onClick={closeEventModal}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>

          <div className="codeCalendarModalContent">
            <div className="codeCalendarFormGroup">
              <label>Event Title</label>
              <input
                type="text"
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                placeholder="Enter Event Title..."
                className="codeCalendarInput"
              />
            </div>

            <div className="codeCalendarFormGroup">
              <label>Description</label>
              <textarea
                value={newEvent.description}
                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                placeholder="Enter Event Description..."
                className="codeCalendarTextarea"
                rows="3"
              />
            </div>

            <div className="codeCalendarFormRow">
              <CustomDateTimePicker
                value={newEvent.startDate}
                onChange={(date) => setNewEvent({ ...newEvent, startDate: date })}
                label="Start Date & Time"
              />
              <CustomDateTimePicker
                value={newEvent.endDate}
                onChange={(date) => setNewEvent({ ...newEvent, endDate: date })}
                label="End Date & Time"
              />
            </div>

            <div className="codeCalendarFormGroup">
              <label>Location</label>
              <input
                type="text"
                value={newEvent.location}
                onChange={(e) => {
                  setNewEvent({ ...newEvent, location: e.target.value });
                  setLocationQuery(e.target.value);
                }}
                onFocus={() => setLocationQuery(newEvent.location)}
                placeholder="Enter Event Location..."
                className="codeCalendarInput"
              />

              {locationSuggestions.length > 0 && (
                <div className="codeCalendarSuggestions">
                  {locationSuggestions.map(place => (
                    <button
                      key={`${place.source}-${place.label}`}
                      className="codeCalendarSuggestion"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setNewEvent(prev => ({ ...prev, location: place.label }));
                        setLocationQuery("");
                        setLocationSuggestions([]);
                      }}
                    >
                      <span className="codeCalendarSuggestionEmail">{place.label}</span>
                      {place.detail && (
                        <span className="codeCalendarSuggestionName">{place.detail}</span>
                      )}
                      <span className="codeCalendarSuggestionTag">
                        {place.source === "history" ? "Used" : "Nearby"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="codeCalendarFormRow">
              <div className="codeCalendarFormGroup">
                <label>Event Type</label>
                <Dropdown
                  className="codeCalendarDropdown"
                  value={(eventTypes.find(type => type.value === newEvent.type) || {}).label || ""}
                  onChange={(label) => {
                    const selectedType = eventTypes.find(type => type.label === label);
                    setNewEvent({
                      ...newEvent,
                      type: selectedType ? selectedType.value : newEvent.type,
                      color: selectedType ? selectedType.color : "#3B82F6"
                    });
                  }}
                  options={eventTypes.map(type => type.label)}
                  placeholder="Event Type"
                />
              </div>
              <div className="codeCalendarFormGroup">
                <label>Reminder</label>
                <Dropdown
                  className="codeCalendarDropdown"
                  value={(reminderOptions.find(option => option.value === Number(newEvent.reminder)) || {}).label || ""}
                  onChange={(label) => {
                    const selectedOption = reminderOptions.find(option => option.label === label);
                    if (selectedOption) {
                      setNewEvent({ ...newEvent, reminder: selectedOption.value });
                    }
                  }}
                  options={reminderOptions.map(option => option.label)}
                  placeholder="Reminder"
                />
              </div>
            </div>

            <div className="codeCalendarFormGroup">
              <label>Event Color</label>
              <div className="codeCalendarColorPicker">
                {eventTypes.map(type => (
                  <button
                    key={type.color}
                    className={`codeCalendarColorOption ${newEvent.color === type.color ? "selected" : ""}`}
                    style={{ backgroundColor: type.color }}
                    onClick={() => setNewEvent({ ...newEvent, color: type.color })}
                  />
                ))}
              </div>
            </div>

            <div className="codeCalendarFormGroup">
              <label>Repeats</label>
              <div className="codeCalendarRepeatRow">
                {RECURRENCE_OPTIONS.map(option => (
                  <button
                    key={option.label}
                    className={`codeCalendarRepeatOption ${newEvent.rrule === option.rule ? "selected" : ""}`}
                    onClick={() => setNewEvent({ ...newEvent, rrule: option.rule })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="codeCalendarFormGroup">
              <label>Invitees</label>
              {newEvent.attendees.length > 0 && (
                <div className="codeCalendarChipRow">
                  {newEvent.attendees.map(email => (
                    <span key={email} className="codeCalendarChip">
                      <span className="codeCalendarChipText">{email}</span>
                      <button
                        className="codeCalendarChipRemove"
                        onClick={() => setNewEvent({
                          ...newEvent,
                          attendees: newEvent.attendees.filter(a => a !== email)
                        })}
                        title="Remove this invitee."
                      >
                        <FontAwesomeIcon icon={faTimes} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <input
                type="text"
                value={inviteeDraft}
                onChange={(e) => setInviteeDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
                    if (inviteeDraft.trim()) {
                      e.preventDefault();
                      addInvitee(inviteeDraft);
                    }
                  }

                  if (e.key === "Backspace" && !inviteeDraft && newEvent.attendees.length > 0) {
                    setNewEvent({
                      ...newEvent,
                      attendees: newEvent.attendees.slice(0, -1)
                    });
                  }
                }}
                onBlur={() => inviteeDraft.trim() && addInvitee(inviteeDraft)}
                placeholder="Type An Email And Press Enter..."
                className="codeCalendarInput"
              />

              {inviteeSuggestions.length > 0 && (
                <div className="codeCalendarSuggestions">
                  {inviteeSuggestions.map(person => (
                    <button
                      key={person.email}
                      className="codeCalendarSuggestion"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        addInvitee(person.email);
                      }}
                    >
                      <span className="codeCalendarSuggestionEmail">{person.email}</span>
                      {person.name && (
                        <span className="codeCalendarSuggestionName">{person.name}</span>
                      )}
                      <span className="codeCalendarSuggestionTag">
                        {person.source === "history" ? `Invited ${person.timesInvited}` : "Team"}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {selectedEvent && (selectedEvent.invitees || []).length > 0 && (
                <div className="codeCalendarInviteeList">
                  <span className="codeCalendarInviteeHeading">Responses</span>
                  {selectedEvent.invitees.map(person => (
                    <div key={person.email} className="codeCalendarInviteeRow">
                      <span
                        className="codeCalendarRsvpDot"
                        style={{
                          background: person.response === "accepted" ? "#10B981"
                            : person.response === "declined" ? "#EF4444"
                            : person.response === "tentative" ? "#F59E0B"
                            : "#6f7789"
                        }}
                      />
                      <span className="codeCalendarInviteeEmail">{person.email}</span>
                      <span className="codeCalendarInviteeStatus">
                        {person.inviteError ? "Not Sent"
                          : person.response === "accepted" ? "Going"
                          : person.response === "declined" ? "Declined"
                          : person.response === "tentative" ? "Maybe"
                          : "Awaiting"}
                      </span>
                      <button
                        className={`codeCalendarInviteeResend ${resendState[person.email] === "sent" ? "sent" : ""} ${resendState[person.email] === "failed" ? "failed" : ""}`}
                        disabled={resendState[person.email] === "sending"}
                        onClick={() => resendInvite(selectedEvent.id, person.email)}
                        title={person.inviteError || "Send this invitation again."}
                      >
                        {resendState[person.email] === "sending" ? "Sending"
                          : resendState[person.email] === "sent" ? "Sent"
                          : resendState[person.email] === "failed" ? "Failed"
                          : "Resend"}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="codeCalendarInviteeSwitch">
              <button
                className="calendarSwitchRow"
                onClick={() => setNewEvent({ ...newEvent, sendInvites: newEvent.sendInvites === false })}
              >
                <span className="calendarSwitchLabel">Email Each New Invitee</span>
                <span className={`calendarSwitch ${newEvent.sendInvites !== false ? "on" : ""}`}>
                  <span className="calendarSwitchKnob" />
                </span>
              </button>
              </div>
            </div>
          </div>

          <div className="codeCalendarModalActions">
            {isEditing && (
              <>
                <button
                  className="codeCalendarButton secondary"
                  onClick={duplicateEvent}
                >
                  <FontAwesomeIcon icon={faCopy} /> Duplicate
                </button>
                <button
                  className="codeCalendarButton danger"
                  onClick={deleteEvent}
                >
                  <FontAwesomeIcon icon={faTrash} /> Delete
                </button>
              </>
            )}
            <button
              className="codeCalendarButton secondary"
              onClick={closeEventModal}
            >
              Cancel
            </button>
            <button
              className="codeCalendarButton primary"
              onClick={saveEvent}
            >
              <FontAwesomeIcon icon={faSave} /> Save Event
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="calendarPageWrapper">
      <Nav activePage="calendar" />
      {isLoaded ? (
        backendError ? (
          <div className="disconnectedNoResults" style={{ height: "100%" }}>
            <div className="disconnectedNoResultCell">
              <FontAwesomeIcon icon={faGlobe} size="3x" className="disconnectedNoResultsIcon" />
              <div className="disconnectedNoResultsText">Unable To Connect To The Server. Please Check Your Internet Connection And Try Again.</div>
              <div className="disconnectedNoResultsButtons">
                <button className="disconnectedNoResultsRefresh" onClick={retryFetch}>
                  Retry
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="calendarCellHeaderContainer">
            <div className="calendarCellContentWrapper">
              <div className="calendarContentSideBar">
                <div className="calendarSideBarButtonWrapper">
                  <div className="calendarSection">
                    <button
                      className={`calendarActionButton primary ${!selectedDate ? "disabled" : ""}`}
                      onClick={() => selectedDate && openEventModal()}
                      disabled={!selectedDate}
                      style={{"marginBottom": 0}}
                    >
                      <FontAwesomeIcon icon={faPlus} /> Create Event
                    </button>
                  </div>

                  <div className="calendarSection">
                    <div className="calendarSectionTitle">
                      <FontAwesomeIcon icon={faSearch} />
                      <span>Find</span>
                    </div>
                    <input
                      className="calendarSearchInput"
                      placeholder="Search Events"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />

                    {searchTerm.trim().length > 0 && (
                      <div className="calendarSearchResults">
                        {searchResults.length === 0 ? (
                          <div className="calendarSearchEmpty">No Events Match That Search</div>
                        ) : (
                          searchResults.map(event => (
                            <button
                              key={event.id}
                              className="calendarSearchResult"
                              onClick={() => {
                                const target = new Date(event.startDate);
                                setCurrentDate(target);
                                setSelectedDate(target);
                                openEventModal(event);
                              }}
                            >
                              <span
                                className="calendarSearchDot"
                                style={{ background: event.color }}
                              />
                              <span className="calendarSearchBody">
                                <span className="calendarSearchTitle">{event.title}</span>
                                <span className="calendarSearchWhen">
                                  {new Date(event.startDate).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric"
                                  })}
                                </span>
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <div className="calendarSection">
                    <div className="calendarSectionTitle">
                      <FontAwesomeIcon icon={faCalendarDays} />
                      <span>View</span>
                    </div>
                    <div className="calendarViewButtons">
                      <button
                        className={`calendarActionButton ${viewMode === "month" ? "active" : ""}`}
                        onClick={() => setViewMode("month")}
                      >
                        <FontAwesomeIcon icon={faCalendarDays} /> Month
                      </button>
                      <button
                        className={`calendarActionButton ${viewMode === "week" ? "active" : ""}`}
                        onClick={() => setViewMode("week")}
                      >
                        <FontAwesomeIcon icon={faCalendarWeek} /> Week
                      </button>
                      <button
                        className={`calendarActionButton ${viewMode === "day" ? "active" : ""}`}
                        onClick={() => setViewMode("day")}
                      >
                        <FontAwesomeIcon icon={faCalendarDay} /> Day
                      </button>
                    </div>
                  </div>

                  {showMiniCalendar && renderMiniCalendar()}

                  <div className="calendarSection">
                    <div className="calendarSectionTitle">
                      <FontAwesomeIcon icon={faDownload} />
                      <span>Actions</span>
                    </div>
                    <div className="calendarActionButtons">
                      <button
                        className="calendarActionButton secondary"
                        onClick={exportEvents}
                      >
                        <FontAwesomeIcon icon={faDownload} /> Export
                      </button>
                      <button
                        className="calendarActionButton secondary"
                        onClick={goToToday}
                      >
                        <FontAwesomeIcon icon={faCalendarDay} /> Today
                      </button>
                    </div>
                  </div>

                  <div className="calendarSection">
                    <div className="calendarSectionTitle">
                      <FontAwesomeIcon icon={faFilter} />
                      <span>Display</span>
                    </div>
                    <div className="calendarActionButtons">
                      <button
                        className="calendarSwitchRow"
                        onClick={() => setShowMiniCalendar(!showMiniCalendar)}
                      >
                        <span className="calendarSwitchLabel">Mini Calendar</span>
                        <span className={`calendarSwitch ${showMiniCalendar ? "on" : ""}`}>
                          <span className="calendarSwitchKnob" />
                        </span>
                      </button>
                      <button
                        className="calendarSwitchRow"
                        onClick={() => setShowHolidays(!showHolidays)}
                      >
                        <span className="calendarSwitchLabel">Holidays</span>
                        <span className={`calendarSwitch ${showHolidays ? "on" : ""}`}>
                          <span className="calendarSwitchKnob" />
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="calendarSection">
                    <div className="calendarSectionTitle">
                      <FontAwesomeIcon icon={faFilter} />
                      <span>Event Types</span>
                    </div>
                    <div className="calendarEventTypes">
                      {eventTypes.map(type => (
                        <div key={type.value} className="calendarEventType">
                          <div
                            className="calendarEventTypeColor"
                            style={{ backgroundColor: type.color }}
                          />
                          <span>{type.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="calendarSection">
                    <div className="calendarSectionTitle">
                      <FontAwesomeIcon icon={faClock} />
                      <span>Timezone</span>
                    </div>
                    <div className="calendarTimezoneInfo">
                      <span>{userTimezone}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="calendarContentMainFlex">
                <div className="calendarContentMainScroll">
                  <div className="calendarMainHeader">
                    <div className="calendarNavigation">
                      <button
                        className="calendarNavButton"
                        onClick={() => {
                          if (viewMode === "month") navigateMonth(-1);
                          else if (viewMode === "week") navigateWeek(-1);
                          else navigateDay(-1);
                        }}
                      >
                        <FontAwesomeIcon icon={faChevronLeft} />
                      </button>
                      
                      <h2 className="calendarCurrentDate">
                        {viewMode === "month" && currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                        {viewMode === "week" && (
                          <>
                            {getWeekDays(currentDate)[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            {" - "}
                            {getWeekDays(currentDate)[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </>
                        )}
                        {viewMode === "day" && formatDate(selectedDate)}
                      </h2>
                      
                      <button
                        className="calendarNavButton"
                        onClick={() => {
                          if (viewMode === "month") navigateMonth(1);
                          else if (viewMode === "week") navigateWeek(1);
                          else navigateDay(1);
                        }}
                      >
                        <FontAwesomeIcon icon={faChevronRight} />
                      </button>
                    </div>

                    <div className="calendarHeaderActions">
                      <button
                        className={`calendarActionButton secondary ${!selectedDate ? "disabled" : ""}`}
                        onClick={goToToday}
                      >
                        <FontAwesomeIcon icon={faCalendarDay} /> Today
                      </button>
                      <button
                        className={`calendarActionButton primary ${!selectedDate ? "disabled" : ""}`}
                        onClick={() => selectedDate && openEventModal()}
                        disabled={!selectedDate}
                      >
                        <FontAwesomeIcon icon={faPlus} /> Add Event
                      </button>
                    </div>
                  </div>

                  <div className="calendarMainContent" ref={calendarRef}>
                    {viewMode === "month" && renderMonthView()}
                    {viewMode === "week" && renderWeekView()}
                    {viewMode === "day" && renderDayView()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      ) : (
        <div className="calendarCellHeaderContainer" style={{ justifyContent: "center" }}>
          <div className="loading-wrapper">
            <div className="loading-circle" />
            <label className="loading-title">
              Loading
            </label>
          </div>
        </div>
      )}
      
      {renderEventModal()}
      {renderDayEventsModal()}

    </div>
  );
};

export default Calendar;