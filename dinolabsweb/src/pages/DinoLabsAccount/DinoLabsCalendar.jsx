import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalendarDays,
  faChevronLeft,
  faChevronRight,
  faPlus,
  faEdit,
  faTrash,
  faClock,
  faBell,
  faLocationDot,
  faUser,
  faSave,
  faTimes,
  faCalendarWeek,
  faCalendarDay,
  faSearch,
  faFilter,
  faEllipsisV,
  faCopy,
  faShareNodes,
  faDownload,
  faPrint,
  faRefresh,
  faArrowsRotate,
  faGlobe
} from "@fortawesome/free-solid-svg-icons";
import DinoLabsNav from "../../helpers/Nav";
import useAuth from "../../UseAuth";
import { showDialog } from "../../helpers/Alert.jsx";
import "../../styles/mainStyles/DinoLabsAccount/DinoLabsCalendar.css";
import "../../styles/helperStyles/LoadingSpinner.css";
import "../../styles/helperStyles/Disconnected.css";

const DinoLabsCalendar = () => {
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

  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    startDate: new Date(),
    endDate: new Date(),
    location: "",
    attendees: [],
    reminder: 15,
    color: "#3B82F6",
    type: "event"
  });

  const eventModalRef = useRef(null);
  const calendarRef = useRef(null);

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
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
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
      const alertOverlay = document.querySelector(".dinolabsAlertOverlay");
      if (alertOverlay) {
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
        await showDialog({ title: "Error", message: data.message || "Failed To Create Calendar Event." });
        return null;
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
        await showDialog({ title: "Error", message: data.message || "Failed To Update Calendar Event." });
        return null;
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
      
      return checkDate >= eventStartDay && checkDate <= eventEndDay;
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
        const updatedEvent = await updateCalendarEvent(selectedEvent.id, newEvent);
        if (updatedEvent) {
          setEvents(events.map(event => 
            event.id === selectedEvent.id ? updatedEvent : event
          ));
          closeEventModal();
        }
      } else {
        const newCreatedEvent = await createCalendarEvent(newEvent);
        if (newCreatedEvent) {
          setEvents([...events, newCreatedEvent]);
          closeEventModal();
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
    const ampmRef = useRef(null);

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
        const ampmValue = ampmRef.current ? ampmRef.current.value : (newDateTime.getHours() >= 12 ? "PM" : "AM");
        
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
      <div className="dinolabsCalendarFormGroup">
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
                  <select
                    value={timeComponents.hour12}
                    onChange={(e) => handleTimeChange("hour", e.target.value)}
                    className="customTimePickerSelect"
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {(i + 1).toString().padStart(2, "0")}
                      </option>
                    ))}
                  </select>
                  <span className="customTimePickerSeparator">:</span>
                  <select
                    value={timeComponents.minute}
                    onChange={(e) => handleTimeChange("minute", e.target.value)}
                    className="customTimePickerSelect"
                  >
                    {Array.from({ length: 60 }, (_, i) => (
                      <option key={i} value={i}>
                        {i.toString().padStart(2, "0")}
                      </option>
                    ))}
                  </select>
                  <select
                    ref={ampmRef}
                    value={timeComponents.ampm}
                    onChange={(e) => handleTimeChange("ampm", e.target.value)}
                    className="customTimePickerSelect"
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
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
      <div className="dinolabsCalendarGrid">
        <div className="dinolabsCalendarWeekHeader">
          {weekDays.map(day => (
            <div key={day} className="dinolabsCalendarWeekDay">
              {day}
            </div>
          ))}
        </div>
        <div className="dinolabsCalendarDaysGrid">
          {days.map((dayObj, index) => {
            const dayEvents = getEventsForDate(dayObj.date);
            
            return (
              <div
                key={index}
                className={`dinolabsCalendarDay ${!dayObj.isCurrentMonth ? "otherMonth" : ""} ${isToday(dayObj.date) ? "today" : ""} ${isSelectedDate(dayObj.date) ? "selected" : ""}`}
                onClick={() => handleDateClick(dayObj.date)}
              >
                <div className="dinolabsCalendarDayNumber">
                  {dayObj.date.getDate()}
                </div>
                <div className="dinolabsCalendarDayEvents">
                  {dayEvents.length > 0 && (
                    <div
                      className="dinolabsCalendarEventCount"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDayEventsModal(dayObj.date, dayEvents);
                      }}
                    >
                      {dayEvents.length} {dayEvents.length === 1 ? "Event" : "Events"}
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
      <div className="dinolabsCalendarWeekView">
        <div className="dinolabsCalendarWeekHeader">
          <div className="dinolabsCalendarTimeColumn"></div>
          {weekDays.map(day => (
            <div
              key={day.toISOString()}
              className={`dinolabsCalendarWeekDay ${isToday(day) ? "today" : ""} ${isSelectedDate(day) ? "selected" : ""}`}
              onClick={() => handleDateClick(day)}
            >
              <div className="dinolabsCalendarWeekDayName">
                {day.toLocaleDateString("en-US", { weekday: "short" })}
              </div>
              <div className="dinolabsCalendarWeekDayNumber">
                {day.getDate()}
              </div>
            </div>
          ))}
        </div>
        <div className="dinolabsCalendarWeekContent">
          <div className="dinolabsCalendarTimeColumn">
            {timeSlots.map(slot => (
              <div key={slot.hour} className="dinolabsCalendarTimeSlot">
                <span className="dinolabsCalendarTimeLabel">{slot.label}</span>
              </div>
            ))}
          </div>
          {weekDays.map(day => (
            <div key={day.toISOString()} className="dinolabsCalendarDayColumn">
              {timeSlots.map(slot => (
                <div
                  key={slot.hour}
                  className="dinolabsCalendarHourSlot"
                  onClick={() => {
                    setSelectedDate(day);
                    handleTimeSlotClick(slot.hour);
                  }}
                >
                  {slot.hour === currentTime.getHours() && isToday(day) && (
                    <div className="dinolabsCalendarCurrentTimeLine" />
                  )}
                </div>
              ))}
              {getEventsForDate(day).map(event => {
                const position = getEventPosition(event, day, true);
                return (
                  <div
                    key={event.id}
                    className="dinolabsCalendarWeekEvent"
                    style={{
                      top: `${position.top}px`,
                      height: `${position.height}px`,
                      backgroundColor: event.color
                    }}
                    onClick={() => openEventModal(event)}
                  >
                    <div className="dinolabsCalendarEventTitle">
                      {event.title}
                    </div>
                    <div className="dinolabsCalendarEventTime">
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
      <div className="dinolabsCalendarDayView">
        <div className="dinolabsCalendarDayHeader">
          <h3>{formatDate(selectedDate)}</h3>
        </div>
        <div className="dinolabsCalendarDayContent">
          <div className="dinolabsCalendarTimeColumn">
            {timeSlots.map(slot => (
              <div key={slot.hour} className="dinolabsCalendarTimeSlot">
                <span className="dinolabsCalendarTimeLabel">{slot.label}</span>
              </div>
            ))}
          </div>
          <div className="dinolabsCalendarDayColumn">
            {timeSlots.map(slot => (
              <div
                key={slot.hour}
                className="dinolabsCalendarHourSlot"
                onClick={() => handleTimeSlotClick(slot.hour)}
              >
                {slot.hour === currentTime.getHours() && isToday(selectedDate) && (
                  <div className="dinolabsCalendarCurrentTimeLine" />
                )}
              </div>
            ))}
            {dayEvents.map(event => {
              const position = getEventPosition(event, selectedDate, false);
              return (
                <div
                  key={event.id}
                  className="dinolabsCalendarDayEvent"
                  style={{
                    top: `${position.top}px`,
                    height: `${position.height}px`,
                    backgroundColor: event.color
                  }}
                  onClick={() => openEventModal(event)}
                >
                  <div className="dinolabsCalendarEventTitle">
                    {event.title}
                  </div>
                  <div className="dinolabsCalendarEventTime">
                    {getEventDisplayTime(event, selectedDate)}
                  </div>
                  {event.location && (
                    <div className="dinolabsCalendarEventLocation">
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
      <div className="dinolabsCalendarMini">
        <div className="dinolabsCalendarMiniHeader">
          <button
            className="dinolabsCalendarNavButton"
            onClick={() => navigateMonth(-1)}
          >
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>
          <h4>
            {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </h4>
          <button
            className="dinolabsCalendarNavButton"
            onClick={() => navigateMonth(1)}
          >
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </div>
        <div className="dinolabsCalendarMiniWeekHeader">
          {weekDays.map(day => (
            <div key={day} className="dinolabsCalendarMiniWeekDay">
              {day}
            </div>
          ))}
        </div>
        <div className="dinolabsCalendarMiniDays">
          {days.map((dayObj, index) => (
            <div
              key={index}
              className={`dinolabsCalendarMiniDay ${!dayObj.isCurrentMonth ? "otherMonth" : ""} ${isToday(dayObj.date) ? "today" : ""} ${isSelectedDate(dayObj.date) ? "selected" : ""}`}
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
      <div className="dinolabsCalendarModalOverlay">
        <div className="dinolabsCalendarModal" ref={eventModalRef}>
          <div className="dinolabsCalendarModalHeader">
            <h3>Events For {formatDate(selectedDate)}</h3>
            <button
              className="dinolabsCalendarModalClose"
              onClick={closeDayEventsModal}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>

          <div className="dinolabsCalendarModalContent">
            <div className="dinolabsCalendarDayEventsList">
              {selectedDayEvents.map(event => (
                <div key={event.id} className="dinolabsCalendarDayEventItem">
                  <div className="dinolabsCalendarDayEventInfo">
                    <div 
                      className="dinolabsCalendarDayEventColor"
                      style={{ backgroundColor: event.color }}
                    />
                    <div className="dinolabsCalendarDayEventDetails">
                      <div className="dinolabsCalendarDayEventTitle">{event.title}</div>
                      <div className="dinolabsCalendarDayEventTime">
                        {getEventDisplayTime(event, selectedDate)}
                      </div>
                      {event.location && (
                        <div className="dinolabsCalendarDayEventLocation">
                          <FontAwesomeIcon icon={faLocationDot} /> {event.location}
                        </div>
                      )}
                      {event.description && (
                        <div className="dinolabsCalendarDayEventDescription">
                          {event.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="dinolabsCalendarDayEventActions">
                    <button
                      className="dinolabsCalendarButton secondary"
                      onClick={() => {
                        closeDayEventsModal();
                        openEventModal(event);
                      }}
                    >
                      <FontAwesomeIcon icon={faEdit} />
                    </button>
                    <button
                      className="dinolabsCalendarButton danger"
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

          <div className="dinolabsCalendarModalActions">
            <button
              className="dinolabsCalendarButton primary"
              onClick={() => {
                closeDayEventsModal();
                openEventModal();
              }}
            >
              <FontAwesomeIcon icon={faPlus} /> Add New Event
            </button>
            <button
              className="dinolabsCalendarButton secondary"
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
      <div className="dinolabsCalendarModalOverlay">
        <div className="dinolabsCalendarModal" ref={eventModalRef}>
          <div className="dinolabsCalendarModalHeader">
            <h3>{isEditing ? "Edit Event" : "Create New Event"}</h3>
            <button
              className="dinolabsCalendarModalClose"
              onClick={closeEventModal}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>

          <div className="dinolabsCalendarModalContent">
            <div className="dinolabsCalendarFormGroup">
              <label>Event Title</label>
              <input
                type="text"
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                placeholder="Enter Event Title..."
                className="dinolabsCalendarInput"
              />
            </div>

            <div className="dinolabsCalendarFormGroup">
              <label>Description</label>
              <textarea
                value={newEvent.description}
                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                placeholder="Enter Event Description..."
                className="dinolabsCalendarTextarea"
                rows="3"
              />
            </div>

            <div className="dinolabsCalendarFormRow">
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

            <div className="dinolabsCalendarFormGroup">
              <label>Location</label>
              <input
                type="text"
                value={newEvent.location}
                onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                placeholder="Enter Event Location..."
                className="dinolabsCalendarInput"
              />
            </div>

            <div className="dinolabsCalendarFormRow">
              <div className="dinolabsCalendarFormGroup">
                <label>Event Type</label>
                <select
                  value={newEvent.type}
                  onChange={(e) => {
                    const selectedType = eventTypes.find(type => type.value === e.target.value);
                    setNewEvent({ 
                      ...newEvent, 
                      type: e.target.value,
                      color: selectedType ? selectedType.color : "#3B82F6"
                    });
                  }}
                  className="dinolabsCalendarSelect"
                >
                  {eventTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="dinolabsCalendarFormGroup">
                <label>Reminder</label>
                <select
                  value={newEvent.reminder}
                  onChange={(e) => setNewEvent({ ...newEvent, reminder: parseInt(e.target.value) })}
                  className="dinolabsCalendarSelect"
                >
                  {reminderOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="dinolabsCalendarFormGroup">
              <label>Event Color</label>
              <div className="dinolabsCalendarColorPicker">
                {eventTypes.map(type => (
                  <button
                    key={type.color}
                    className={`dinolabsCalendarColorOption ${newEvent.color === type.color ? "selected" : ""}`}
                    style={{ backgroundColor: type.color }}
                    onClick={() => setNewEvent({ ...newEvent, color: type.color })}
                  />
                ))}
              </div>
            </div>

            <div className="dinolabsCalendarFormGroup">
              <label>Attendees</label>
              <input
                type="text"
                value={newEvent.attendees.join(", ")}
                onChange={(e) => setNewEvent({ 
                  ...newEvent, 
                  attendees: e.target.value.split(",").map(s => s.trim()).filter(s => s.length > 0)
                })}
                placeholder="Enter Attendee Names (Comma Separated)..."
                className="dinolabsCalendarInput"
              />
            </div>
          </div>

          <div className="dinolabsCalendarModalActions">
            {isEditing && (
              <>
                <button
                  className="dinolabsCalendarButton secondary"
                  onClick={duplicateEvent}
                >
                  <FontAwesomeIcon icon={faCopy} /> Duplicate
                </button>
                <button
                  className="dinolabsCalendarButton danger"
                  onClick={deleteEvent}
                >
                  <FontAwesomeIcon icon={faTrash} /> Delete
                </button>
              </>
            )}
            <button
              className="dinolabsCalendarButton secondary"
              onClick={closeEventModal}
            >
              Cancel
            </button>
            <button
              className="dinolabsCalendarButton primary"
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
      <DinoLabsNav activePage="calendar" />
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
                      <button
                        className="calendarActionButton secondary"
                        onClick={() => setShowMiniCalendar(!showMiniCalendar)}
                      >
                        <FontAwesomeIcon icon={faCalendarDays} /> Mini Calendar
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
              Dino Labs Calendar
            </label>
          </div>
        </div>
      )}
      
      {renderEventModal()}
      {renderDayEventsModal()}
    </div>
  );
};

export default DinoLabsCalendar;