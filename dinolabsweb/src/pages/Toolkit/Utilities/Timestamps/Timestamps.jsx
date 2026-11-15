import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faClock, faCalendarDays, faGlobe, faArrowRightArrowLeft, faDownload,
  faCopy, faArrowsRotate, faStopwatch, faHourglass, faCalculator,
  faPlay, faPause, faRotateRight, faCalendarWeek, faSun,
  faMoon, faLocationDot, faBolt, faClockRotateLeft
} from "@fortawesome/free-solid-svg-icons";
import Tippy from "@tippyjs/react";
import Nav from "../../../../helpers/Nav.jsx";
import Dropdown from "../../../../helpers/Dropdown.jsx";
import useAuth from "../../../../UseAuth.jsx";
import "../../../../styles/mainStyles/Toolkit/Utilities/Timestamps/Timestamps.css";
import "../../../../styles/helperStyles/Slider.css";
import "../../../../styles/helperStyles/LoadingSpinner.css";

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "America/Buenos_Aires",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Rome",
  "Europe/Madrid",
  "Europe/Amsterdam",
  "Europe/Stockholm",
  "Europe/Moscow",
  "Europe/Istanbul",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Perth",
  "Pacific/Auckland",
  "Pacific/Fiji",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Lagos"
];

const EPOCH_TYPES = {
  unix: { name: "Unix Epoch", date: new Date(0), description: "January 1, 1970 00:00:00 UTC" },
  windows: { name: "Windows FILETIME", date: new Date(-11644473600000), description: "January 1, 1601 00:00:00 UTC" },
  mac: { name: "Mac HFS+", date: new Date(-2082844800000), description: "January 1, 1904 00:00:00 UTC" },
  cocoa: { name: "Cocoa/NSDate", date: new Date(978307200000), description: "January 1, 2001 00:00:00 UTC" },
  gps: { name: "GPS Epoch", date: new Date(315964800000), description: "January 6, 1980 00:00:00 UTC" }
};

const UNIX_UNIT_OPTIONS = [
  { value: "seconds", label: "Seconds" },
  { value: "milliseconds", label: "Milliseconds" }
];

const OPERATION_OPTIONS = [
  { value: "add", label: "Add" },
  { value: "subtract", label: "Subtract" }
];

const TIME_UNIT_OPTIONS = [
  { value: "seconds", label: "Seconds" },
  { value: "minutes", label: "Minutes" },
  { value: "hours", label: "Hours" },
  { value: "days", label: "Days" },
  { value: "weeks", label: "Weeks" },
  { value: "months", label: "Months" },
  { value: "years", label: "Years" }
];

const WEEK_START_OPTIONS = [
  { value: "sunday", label: "Sunday" },
  { value: "monday", label: "Monday" }
];

const timezoneLabel = (tz) => tz.replace(/_/g, " ");

const optionLabel = (options, value) => (options.find((option) => option.value === value) || options[0]).label;

const optionValue = (options, label) => (options.find((option) => option.label === label) || options[0]).value;

const FORMAT_TEMPLATES = [
  { name: "ISO 8601", format: "YYYY-MM-DDTHH:mm:ss.sssZ" },
  { name: "ISO Date", format: "YYYY-MM-DD" },
  { name: "US Format", format: "MM/DD/YYYY" },
  { name: "EU Format", format: "DD/MM/YYYY" },
  { name: "Full DateTime", format: "YYYY-MM-DD HH:mm:ss" },
  { name: "12-Hour Time", format: "YYYY-MM-DD hh:mm:ss A" },
  { name: "RFC 2822", format: "ddd, DD MMM YYYY HH:mm:ss ZZ" },
  { name: "Unix Timestamp", format: "X" },
  { name: "Milliseconds", format: "x" }
];

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch {}
};

const downloadTextFile = (filename, text) => {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const Timestamps = () => {
  const navigate = useNavigate();
  const { token, loading } = useAuth();

  const [unixInput, setUnixInput] = useState(Math.floor(Date.now() / 1000));
  const [unixUnit, setUnixUnit] = useState("seconds");
  const [humanInput, setHumanInput] = useState("");
  const [selectedTimezone, setSelectedTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [targetTimezone, setTargetTimezone] = useState("UTC");
  const [dateInput, setDateInput] = useState("");
  const [timeInput, setTimeInput] = useState("");
  const [customFormat, setCustomFormat] = useState("YYYY-MM-DD HH:mm:ss");
  const [diffStartDate, setDiffStartDate] = useState("");
  const [diffEndDate, setDiffEndDate] = useState("");
  const [addSubtractBase, setAddSubtractBase] = useState("");
  const [addSubtractValue, setAddSubtractValue] = useState(0);
  const [addSubtractUnit, setAddSubtractUnit] = useState("days");
  const [addSubtractOperation, setAddSubtractOperation] = useState("add");
  const [liveTimestamp, setLiveTimestamp] = useState(Date.now());
  const [isLiveRunning, setIsLiveRunning] = useState(true);
  const [stopwatchTime, setStopwatchTime] = useState(0);
  const [isStopwatchRunning, setIsStopwatchRunning] = useState(false);
  const [selectedEpoch, setSelectedEpoch] = useState("unix");
  const [weekStartDay, setWeekStartDay] = useState("sunday");

  const intervalRef = useRef(null);
  const stopwatchRef = useRef(null);

  useEffect(() => {
    if (!loading && !token) navigate("/login");
  }, [token, loading, navigate]);

  useEffect(() => {
    if (isLiveRunning) {
      intervalRef.current = setInterval(() => {
        setLiveTimestamp(Date.now());
      }, 100);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isLiveRunning]);

  useEffect(() => {
    if (isStopwatchRunning) {
      stopwatchRef.current = setInterval(() => {
        setStopwatchTime(prev => prev + 10);
      }, 10);
    }
    return () => {
      if (stopwatchRef.current) {
        clearInterval(stopwatchRef.current);
      }
    };
  }, [isStopwatchRunning]);

  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    setDateInput(`${year}-${month}-${day}`);
    setTimeInput(`${hours}:${minutes}`);
    setDiffStartDate(`${year}-${month}-${day}`);
    setDiffEndDate(`${year}-${month}-${day}`);
    setAddSubtractBase(`${year}-${month}-${day}`);
  }, []);

  const parseUnixTimestamp = useCallback((value, unit) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) return null;
    if (unit === "milliseconds") {
      return new Date(num);
    }
    return new Date(num * 1000);
  }, []);

  const getUnixFromDate = useCallback((date, unit) => {
    if (!date || isNaN(date.getTime())) return "";
    if (unit === "milliseconds") {
      return date.getTime();
    }
    return Math.floor(date.getTime() / 1000);
  }, []);

  const formatDateForTimezone = useCallback((date, timezone, options = {}) => {
    if (!date || isNaN(date.getTime())) return "";
    try {
      const defaultOptions = {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        ...options
      };
      return new Intl.DateTimeFormat("en-CA", defaultOptions).format(date).replace(",", "");
    } catch {
      return "";
    }
  }, []);

  const getFullDateTimeString = useCallback((date, timezone) => {
    if (!date || isNaN(date.getTime())) return "";
    try {
      const options = {
        timeZone: timezone,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
        timeZoneName: "short"
      };
      const result = new Intl.DateTimeFormat("en-US", options).format(date);
      return result || date.toLocaleString("en-US", options);
    } catch {
      try {
        return date.toLocaleString("en-US", { timeZone: timezone });
      } catch {
        return date.toISOString();
      }
    }
  }, []);

  const getISOString = useCallback((date) => {
    if (!date || isNaN(date.getTime())) return "";
    return date.toISOString();
  }, []);

  const getRFC2822 = useCallback((date) => {
    if (!date || isNaN(date.getTime())) return "";
    return date.toUTCString();
  }, []);

  const getRelativeTime = useCallback((date) => {
    if (!date || isNaN(date.getTime())) return "";
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const absDiff = Math.abs(diffMs);
    const seconds = Math.floor(absDiff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);
    const suffix = diffMs >= 0 ? "From Now" : "Ago";
    if (years > 0) return `${years} Year${years > 1 ? "s" : ""} ${suffix}`;
    if (months > 0) return `${months} Month${months > 1 ? "s" : ""} ${suffix}`;
    if (weeks > 0) return `${weeks} Week${weeks > 1 ? "s" : ""} ${suffix}`;
    if (days > 0) return `${days} Day${days > 1 ? "s" : ""} ${suffix}`;
    if (hours > 0) return `${hours} Hour${hours > 1 ? "s" : ""} ${suffix}`;
    if (minutes > 0) return `${minutes} Minute${minutes > 1 ? "s" : ""} ${suffix}`;
    return `${seconds} Second${seconds !== 1 ? "s" : ""} ${suffix}`;
  }, []);

  const calculateDateDifference = useCallback((start, end) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return null;
    }
    const diffMs = Math.abs(endDate.getTime() - startDate.getTime());
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30.44);
    const diffYears = Math.floor(diffDays / 365.25);
    return {
      milliseconds: diffMs,
      seconds: diffSeconds,
      minutes: diffMinutes,
      hours: diffHours,
      days: diffDays,
      weeks: diffWeeks,
      months: diffMonths,
      years: diffYears,
      breakdown: {
        years: Math.floor(diffDays / 365),
        months: Math.floor((diffDays % 365) / 30),
        days: diffDays % 30,
        hours: diffHours % 24,
        minutes: diffMinutes % 60,
        seconds: diffSeconds % 60
      }
    };
  }, []);

  const addSubtractFromDate = useCallback((baseDate, value, unit, operation) => {
    const date = new Date(baseDate);
    if (isNaN(date.getTime())) return null;
    const multiplier = operation === "add" ? 1 : -1;
    const adjustedValue = value * multiplier;
    switch (unit) {
      case "seconds":
        date.setSeconds(date.getSeconds() + adjustedValue);
        break;
      case "minutes":
        date.setMinutes(date.getMinutes() + adjustedValue);
        break;
      case "hours":
        date.setHours(date.getHours() + adjustedValue);
        break;
      case "days":
        date.setDate(date.getDate() + adjustedValue);
        break;
      case "weeks":
        date.setDate(date.getDate() + adjustedValue * 7);
        break;
      case "months":
        date.setMonth(date.getMonth() + adjustedValue);
        break;
      case "years":
        date.setFullYear(date.getFullYear() + adjustedValue);
        break;
      default:
        break;
    }
    return date;
  }, []);

  const getWeekNumber = useCallback((date, startDay) => {
    if (!date || isNaN(date.getTime())) return "";
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = startDay === "monday" ? (d.getUTCDay() || 7) : d.getUTCDay() + 1;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
  }, []);

  const getDayOfYear = useCallback((date) => {
    if (!date || isNaN(date.getTime())) return "";
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start;
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
  }, []);

  const isLeapYear = useCallback((year) => {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  }, []);

  const getQuarter = useCallback((date) => {
    if (!date || isNaN(date.getTime())) return "";
    return Math.floor(date.getMonth() / 3) + 1;
  }, []);

  const formatStopwatch = useCallback((ms) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const centiseconds = Math.floor((ms % 1000) / 10);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
  }, []);

  const convertToEpoch = useCallback((date, epochType) => {
    if (!date || isNaN(date.getTime())) return "";
    const epochDate = EPOCH_TYPES[epochType].date;
    const diff = date.getTime() - epochDate.getTime();
    if (epochType === "windows") {
      return Math.floor(diff * 10000);
    }
    return Math.floor(diff / 1000);
  }, []);

  const currentDate = useMemo(() => {
    return parseUnixTimestamp(unixInput, unixUnit);
  }, [unixInput, unixUnit, parseUnixTimestamp]);

  const dateFromPicker = useMemo(() => {
    if (!dateInput) return null;
    const dateStr = timeInput ? `${dateInput}T${timeInput}` : dateInput;
    return new Date(dateStr);
  }, [dateInput, timeInput]);

  const dateDifference = useMemo(() => {
    return calculateDateDifference(diffStartDate, diffEndDate);
  }, [diffStartDate, diffEndDate, calculateDateDifference]);

  const addSubtractResult = useMemo(() => {
    return addSubtractFromDate(addSubtractBase, addSubtractValue, addSubtractUnit, addSubtractOperation);
  }, [addSubtractBase, addSubtractValue, addSubtractUnit, addSubtractOperation, addSubtractFromDate]);

  const timezoneConversions = useMemo(() => {
    if (!currentDate) return [];
    return TIMEZONES.map(tz => ({
      timezone: tz,
      formatted: getFullDateTimeString(currentDate, tz)
    }));
  }, [currentDate, getFullDateTimeString]);

  const setToNow = () => {
    const now = Date.now();
    if (unixUnit === "milliseconds") {
      setUnixInput(now);
    } else {
      setUnixInput(Math.floor(now / 1000));
    }
  };

  const resetAll = () => {
    const now = new Date();
    const timestamp = Math.floor(now.getTime() / 1000);
    setUnixInput(timestamp);
    setUnixUnit("seconds");
    setSelectedTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    setTargetTimezone("UTC");
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    setDateInput(`${year}-${month}-${day}`);
    setTimeInput(`${hours}:${minutes}`);
    setCustomFormat("YYYY-MM-DD HH:mm:ss");
    setDiffStartDate(`${year}-${month}-${day}`);
    setDiffEndDate(`${year}-${month}-${day}`);
    setAddSubtractBase(`${year}-${month}-${day}`);
    setAddSubtractValue(0);
    setAddSubtractUnit("days");
    setAddSubtractOperation("add");
    setStopwatchTime(0);
    setIsStopwatchRunning(false);
    setSelectedEpoch("unix");
    setWeekStartDay("sunday");
  };

  const toggleStopwatch = () => {
    setIsStopwatchRunning(prev => !prev);
  };

  const resetStopwatch = () => {
    setIsStopwatchRunning(false);
    setStopwatchTime(0);
  };

  const exportData = useMemo(() => {
    if (!currentDate) return {};
    return {
      input: {
        unix: unixInput,
        unit: unixUnit
      },
      conversions: {
        iso8601: getISOString(currentDate),
        rfc2822: getRFC2822(currentDate),
        unixSeconds: getUnixFromDate(currentDate, "seconds"),
        unixMilliseconds: getUnixFromDate(currentDate, "milliseconds"),
        relative: getRelativeTime(currentDate)
      },
      timezones: TIMEZONES.reduce((acc, tz) => {
        acc[tz] = formatDateForTimezone(currentDate, tz);
        return acc;
      }, {}),
      metadata: {
        dayOfYear: getDayOfYear(currentDate),
        weekNumber: getWeekNumber(currentDate, weekStartDay),
        quarter: getQuarter(currentDate),
        isLeapYear: isLeapYear(currentDate.getFullYear())
      }
    };
  }, [currentDate, unixInput, unixUnit, getISOString, getRFC2822, getUnixFromDate, getRelativeTime, formatDateForTimezone, getDayOfYear, getWeekNumber, getQuarter, isLeapYear, weekStartDay]);

  const exportJson = useMemo(() => JSON.stringify(exportData, null, 2), [exportData]);

  return (
    <div className="toolkitTimestampLabApp" tabIndex={0}>
      <Nav activePage="timestamps" />

      {loading ? (
        <div className="toolkitTimestampLabCellHeaderContainer" style={{ justifyContent: "center" }}>
          <div className="loading-wrapper">
            <div className="loading-circle" />
            <label className="loading-title">
              Loading
            </label>
          </div>
        </div>
      ) : (
        <>
          <div className="toolkitTimestampLabToolBar">
            <div className="toolkitTimestampLabTitle">
              <FontAwesomeIcon icon={faClock} />
              <span>Timestamps</span>
            </div>

            <div className="toolkitTimestampLabStatusGroup">
              <span className="toolkitTimestampLabStatusItem">
                <span>{unixUnit === "milliseconds" ? "Milliseconds" : "Seconds"}</span>
              </span>
              <span className="toolkitTimestampLabStatusItem">
                <FontAwesomeIcon icon={faGlobe} />
                <span>{selectedTimezone.replace(/_/g, " ")}</span>
              </span>
              <span className="toolkitTimestampLabStatusItem">
                <span>{targetTimezone.replace(/_/g, " ")}</span>
              </span>
              <span className={`toolkitTimestampLabStatusItem${isLiveRunning ? " toolkitTimestampLabStatusAccent" : ""}`}>
                <FontAwesomeIcon icon={faBolt} />
                <span>{isLiveRunning ? "Live" : "Paused"}</span>
              </span>
            </div>
          </div>

          <div className="toolkitTimestampLabShell">
            <aside className="toolkitTimestampLabSidebar">
              <div className="toolkitTimestampLabSection">
                <div className="toolkitTimestampLabSectionTitle">
                  <FontAwesomeIcon icon={faBolt} />
                  <span>Live Timestamp</span>
                </div>

                <div className="toolkitTimestampLabLiveDisplay">
                  <div className="toolkitTimestampLabLiveValue">
                    {Math.floor(liveTimestamp / 1000)}
                  </div>
                  <div className="toolkitTimestampLabLiveLabel">Unix Seconds</div>
                  <div className="toolkitTimestampLabLiveValue toolkitTimestampLabLiveMs">
                    {liveTimestamp}
                  </div>
                  <div className="toolkitTimestampLabLiveLabel">Milliseconds</div>
                </div>

                <div className="toolkitTimestampLabRow toolkitTimestampLabActions">
                  <button
                    className={`toolkitTimestampLabBtn ${!isLiveRunning ? "toolkitTimestampLabSubtle" : ""}`}
                    onClick={() => setIsLiveRunning(prev => !prev)}
                  >
                    <FontAwesomeIcon icon={isLiveRunning ? faPause : faPlay} />
                    {isLiveRunning ? "Pause" : "Resume"}
                  </button>
                </div>
              </div>

              <div className="toolkitTimestampLabSection">
                <div className="toolkitTimestampLabSectionTitle">
                  <FontAwesomeIcon icon={faClock} />
                  <span>Unix Timestamp Input</span>
                </div>

                <div className="toolkitTimestampLabRow">
                  <label className="toolkitTimestampLabLabel">Timestamp</label>
                  <input
                    type="number"
                    className="toolkitTimestampLabInput"
                    value={unixInput}
                    onChange={(e) => setUnixInput(e.target.value)}
                  />
                </div>

                <div className="toolkitTimestampLabRow">
                  <label className="toolkitTimestampLabLabel">Unit</label>
                  <Dropdown
                    value={optionLabel(UNIX_UNIT_OPTIONS, unixUnit)}
                    onChange={(option) => setUnixUnit(optionValue(UNIX_UNIT_OPTIONS, option))}
                    options={UNIX_UNIT_OPTIONS.map((option) => option.label)}
                    placeholder="Unit"
                  />
                </div>

                <div className="toolkitTimestampLabRow toolkitTimestampLabActions">
                  <button className="toolkitTimestampLabBtn" onClick={setToNow}>
                    <FontAwesomeIcon icon={faRotateRight} /> Now
                  </button>
                  <button className="toolkitTimestampLabBtn toolkitTimestampLabSubtle" onClick={resetAll}>
                    <FontAwesomeIcon icon={faArrowsRotate} /> Reset
                  </button>
                </div>
              </div>

              <div className="toolkitTimestampLabSection">
                <div className="toolkitTimestampLabSectionTitle">
                  <FontAwesomeIcon icon={faCalendarDays} />
                  <span>Date And Time Picker</span>
                </div>

                <div className="toolkitTimestampLabRow">
                  <label className="toolkitTimestampLabLabel">Date</label>
                  <input
                    type="date"
                    className="toolkitTimestampLabInput"
                    value={dateInput}
                    onChange={(e) => setDateInput(e.target.value)}
                  />
                </div>

                <div className="toolkitTimestampLabRow">
                  <label className="toolkitTimestampLabLabel">Time</label>
                  <input
                    type="time"
                    className="toolkitTimestampLabInput"
                    value={timeInput}
                    onChange={(e) => setTimeInput(e.target.value)}
                  />
                </div>

                {dateFromPicker && (
                  <div className="toolkitTimestampLabRow">
                    <div className="toolkitTimestampLabSmall">
                      Unix: {getUnixFromDate(dateFromPicker, "seconds")}
                    </div>
                  </div>
                )}

                <div className="toolkitTimestampLabRow toolkitTimestampLabActions">
                  <button
                    className="toolkitTimestampLabBtn"
                    onClick={() => {
                      if (dateFromPicker) {
                        setUnixInput(getUnixFromDate(dateFromPicker, unixUnit));
                      }
                    }}
                  >
                    <FontAwesomeIcon icon={faArrowRightArrowLeft} /> Use This Date
                  </button>
                </div>
              </div>

              <div className="toolkitTimestampLabSection">
                <div className="toolkitTimestampLabSectionTitle">
                  <FontAwesomeIcon icon={faGlobe} />
                  <span>Timezone Settings</span>
                </div>

                <div className="toolkitTimestampLabRow">
                  <label className="toolkitTimestampLabLabel">Source Timezone</label>
                  <Dropdown
                    value={timezoneLabel(selectedTimezone)}
                    onChange={(option) => setSelectedTimezone(TIMEZONES.find((tz) => timezoneLabel(tz) === option) || selectedTimezone)}
                    options={TIMEZONES.map(timezoneLabel)}
                    placeholder="Source Timezone"
                  />
                </div>

                <div className="toolkitTimestampLabRow">
                  <label className="toolkitTimestampLabLabel">Target Timezone</label>
                  <Dropdown
                    value={timezoneLabel(targetTimezone)}
                    onChange={(option) => setTargetTimezone(TIMEZONES.find((tz) => timezoneLabel(tz) === option) || targetTimezone)}
                    options={TIMEZONES.map(timezoneLabel)}
                    placeholder="Target Timezone"
                  />
                </div>
              </div>

              <div className="toolkitTimestampLabSection">
                <div className="toolkitTimestampLabSectionTitle">
                  <FontAwesomeIcon icon={faCalculator} />
                  <span>Date Difference</span>
                </div>

                <div className="toolkitTimestampLabRow">
                  <label className="toolkitTimestampLabLabel">Start Date</label>
                  <input
                    type="date"
                    className="toolkitTimestampLabInput"
                    value={diffStartDate}
                    onChange={(e) => setDiffStartDate(e.target.value)}
                  />
                </div>

                <div className="toolkitTimestampLabRow">
                  <label className="toolkitTimestampLabLabel">End Date</label>
                  <input
                    type="date"
                    className="toolkitTimestampLabInput"
                    value={diffEndDate}
                    onChange={(e) => setDiffEndDate(e.target.value)}
                  />
                </div>

                {dateDifference && (
                  <div className="toolkitTimestampLabDiffResult">
                    <div className="toolkitTimestampLabDiffItem">
                      <span className="toolkitTimestampLabDiffValue">{dateDifference.days}</span>
                      <span className="toolkitTimestampLabDiffLabel">Days</span>
                    </div>
                    <div className="toolkitTimestampLabDiffItem">
                      <span className="toolkitTimestampLabDiffValue">{dateDifference.weeks}</span>
                      <span className="toolkitTimestampLabDiffLabel">Weeks</span>
                    </div>
                    <div className="toolkitTimestampLabDiffItem">
                      <span className="toolkitTimestampLabDiffValue">{dateDifference.months}</span>
                      <span className="toolkitTimestampLabDiffLabel">Months</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="toolkitTimestampLabSection">
                <div className="toolkitTimestampLabSectionTitle">
                  <FontAwesomeIcon icon={faHourglass} />
                  <span>Add Or Subtract Time</span>
                </div>

                <div className="toolkitTimestampLabRow">
                  <label className="toolkitTimestampLabLabel">Base Date</label>
                  <input
                    type="date"
                    className="toolkitTimestampLabInput"
                    value={addSubtractBase}
                    onChange={(e) => setAddSubtractBase(e.target.value)}
                  />
                </div>

                <div className="toolkitTimestampLabRow">
                  <label className="toolkitTimestampLabLabel">Operation</label>
                  <Dropdown
                    value={optionLabel(OPERATION_OPTIONS, addSubtractOperation)}
                    onChange={(option) => setAddSubtractOperation(optionValue(OPERATION_OPTIONS, option))}
                    options={OPERATION_OPTIONS.map((option) => option.label)}
                    placeholder="Operation"
                  />
                </div>

                <div className="toolkitTimestampLabRow">
                  <label className="toolkitTimestampLabLabel">Value</label>
                  <input
                    type="number"
                    className="toolkitTimestampLabInput"
                    value={addSubtractValue}
                    onChange={(e) => setAddSubtractValue(parseInt(e.target.value, 10) || 0)}
                  />
                </div>

                <div className="toolkitTimestampLabRow">
                  <label className="toolkitTimestampLabLabel">Unit</label>
                  <Dropdown
                    value={optionLabel(TIME_UNIT_OPTIONS, addSubtractUnit)}
                    onChange={(option) => setAddSubtractUnit(optionValue(TIME_UNIT_OPTIONS, option))}
                    options={TIME_UNIT_OPTIONS.map((option) => option.label)}
                    placeholder="Unit"
                  />
                </div>

                {addSubtractResult && (
                  <div className="toolkitTimestampLabRow">
                    <div className="toolkitTimestampLabSmall">
                      Result: {addSubtractResult.toISOString().split("T")[0]}
                    </div>
                  </div>
                )}
              </div>

              <div className="toolkitTimestampLabSection">
                <div className="toolkitTimestampLabSectionTitle">
                  <FontAwesomeIcon icon={faStopwatch} />
                  <span>Stopwatch</span>
                </div>

                <div className="toolkitTimestampLabStopwatch">
                  <div className="toolkitTimestampLabStopwatchDisplay">
                    {formatStopwatch(stopwatchTime)}
                  </div>
                </div>

                <div className="toolkitTimestampLabRow toolkitTimestampLabActions">
                  <button
                    className={`toolkitTimestampLabBtn ${!isStopwatchRunning ? "" : "toolkitTimestampLabSubtle"}`}
                    onClick={toggleStopwatch}
                  >
                    <FontAwesomeIcon icon={isStopwatchRunning ? faPause : faPlay} />
                    {isStopwatchRunning ? "Pause" : "Start"}
                  </button>
                  <button
                    className="toolkitTimestampLabBtn toolkitTimestampLabSubtle"
                    onClick={resetStopwatch}
                  >
                    <FontAwesomeIcon icon={faRotateRight} /> Reset
                  </button>
                </div>
              </div>
            </aside>

            <main className="toolkitTimestampLabMain">
              <div className="toolkitTimestampLabMainGrid">
                <section className="toolkitTimestampLabCard">
                  <div className="toolkitTimestampLabCardTitle">
                    Converted Formats
                  </div>

                  {currentDate && (
                    <div className="toolkitTimestampLabFormatGrid">
                      <div className="toolkitTimestampLabFormatItem">
                        <div className="toolkitTimestampLabFormatLabel">ISO 8601</div>
                        <div className="toolkitTimestampLabFormatValue">
                          {getISOString(currentDate)}
                          <button
                            className="toolkitTimestampLabCopyBtn"
                            onClick={() => copyText(getISOString(currentDate))}
                          >
                            <FontAwesomeIcon icon={faCopy} />
                          </button>
                        </div>
                      </div>

                      <div className="toolkitTimestampLabFormatItem">
                        <div className="toolkitTimestampLabFormatLabel">RFC 2822</div>
                        <div className="toolkitTimestampLabFormatValue">
                          {getRFC2822(currentDate)}
                          <button
                            className="toolkitTimestampLabCopyBtn"
                            onClick={() => copyText(getRFC2822(currentDate))}
                          >
                            <FontAwesomeIcon icon={faCopy} />
                          </button>
                        </div>
                      </div>

                      <div className="toolkitTimestampLabFormatItem">
                        <div className="toolkitTimestampLabFormatLabel">Unix Seconds</div>
                        <div className="toolkitTimestampLabFormatValue">
                          {getUnixFromDate(currentDate, "seconds")}
                          <button
                            className="toolkitTimestampLabCopyBtn"
                            onClick={() => copyText(String(getUnixFromDate(currentDate, "seconds")))}
                          >
                            <FontAwesomeIcon icon={faCopy} />
                          </button>
                        </div>
                      </div>

                      <div className="toolkitTimestampLabFormatItem">
                        <div className="toolkitTimestampLabFormatLabel">Unix Milliseconds</div>
                        <div className="toolkitTimestampLabFormatValue">
                          {getUnixFromDate(currentDate, "milliseconds")}
                          <button
                            className="toolkitTimestampLabCopyBtn"
                            onClick={() => copyText(String(getUnixFromDate(currentDate, "milliseconds")))}
                          >
                            <FontAwesomeIcon icon={faCopy} />
                          </button>
                        </div>
                      </div>

                      <div className="toolkitTimestampLabFormatItem">
                        <div className="toolkitTimestampLabFormatLabel">Human Readable ({selectedTimezone})</div>
                        <div className="toolkitTimestampLabFormatValue">
                          {getFullDateTimeString(currentDate, selectedTimezone)}
                          <button
                            className="toolkitTimestampLabCopyBtn"
                            onClick={() => copyText(getFullDateTimeString(currentDate, selectedTimezone))}
                          >
                            <FontAwesomeIcon icon={faCopy} />
                          </button>
                        </div>
                      </div>

                      <div className="toolkitTimestampLabFormatItem">
                        <div className="toolkitTimestampLabFormatLabel">Relative Time</div>
                        <div className="toolkitTimestampLabFormatValue">
                          {getRelativeTime(currentDate)}
                          <button
                            className="toolkitTimestampLabCopyBtn"
                            onClick={() => copyText(getRelativeTime(currentDate))}
                          >
                            <FontAwesomeIcon icon={faCopy} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </section>

                <section className="toolkitTimestampLabCard">
                  <div className="toolkitTimestampLabCardTitle">
                    Date Metadata
                  </div>

                  {currentDate && (
                    <div className="toolkitTimestampLabMetaGrid">
                      <div className="toolkitTimestampLabMetaItem">
                        <FontAwesomeIcon icon={faCalendarWeek} className="toolkitTimestampLabMetaIcon" />
                        <div className="toolkitTimestampLabMetaContent">
                          <div className="toolkitTimestampLabMetaValue">{getWeekNumber(currentDate, weekStartDay)}</div>
                          <div className="toolkitTimestampLabMetaLabel">Week Number</div>
                        </div>
                      </div>

                      <div className="toolkitTimestampLabMetaItem">
                        <FontAwesomeIcon icon={faSun} className="toolkitTimestampLabMetaIcon" />
                        <div className="toolkitTimestampLabMetaContent">
                          <div className="toolkitTimestampLabMetaValue">{getDayOfYear(currentDate)}</div>
                          <div className="toolkitTimestampLabMetaLabel">Day Of Year</div>
                        </div>
                      </div>

                      <div className="toolkitTimestampLabMetaItem">
                        <FontAwesomeIcon icon={faCalendarDays} className="toolkitTimestampLabMetaIcon" />
                        <div className="toolkitTimestampLabMetaContent">
                          <div className="toolkitTimestampLabMetaValue">Q{getQuarter(currentDate)}</div>
                          <div className="toolkitTimestampLabMetaLabel">Quarter</div>
                        </div>
                      </div>

                      <div className="toolkitTimestampLabMetaItem">
                        <FontAwesomeIcon icon={faMoon} className="toolkitTimestampLabMetaIcon" />
                        <div className="toolkitTimestampLabMetaContent">
                          <div className="toolkitTimestampLabMetaValue">{isLeapYear(currentDate.getFullYear()) ? "Yes" : "No"}</div>
                          <div className="toolkitTimestampLabMetaLabel">Leap Year</div>
                        </div>
                      </div>

                      <div className="toolkitTimestampLabMetaItem">
                        <FontAwesomeIcon icon={faClockRotateLeft} className="toolkitTimestampLabMetaIcon" />
                        <div className="toolkitTimestampLabMetaContent">
                          <div className="toolkitTimestampLabMetaValue">
                            {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][currentDate.getDay()]}
                          </div>
                          <div className="toolkitTimestampLabMetaLabel">Day Of Week</div>
                        </div>
                      </div>

                      <div className="toolkitTimestampLabMetaItem">
                        <FontAwesomeIcon icon={faLocationDot} className="toolkitTimestampLabMetaIcon" />
                        <div className="toolkitTimestampLabMetaContent">
                          <div className="toolkitTimestampLabMetaValue">{currentDate.getTimezoneOffset()} min</div>
                          <div className="toolkitTimestampLabMetaLabel">UTC Offset</div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="toolkitTimestampLabRow">
                    <label className="toolkitTimestampLabLabel">Week Starts On</label>
                    <Dropdown
                      value={optionLabel(WEEK_START_OPTIONS, weekStartDay)}
                      onChange={(option) => setWeekStartDay(optionValue(WEEK_START_OPTIONS, option))}
                      options={WEEK_START_OPTIONS.map((option) => option.label)}
                      placeholder="Week Starts On"
                    />
                  </div>
                </section>

                <section className="toolkitTimestampLabCard toolkitTimestampLabCardWide">
                  <div className="toolkitTimestampLabCardTitle">
                    Timezone Conversions
                  </div>

                  {currentDate && (
                    <div className="toolkitTimestampLabTimezoneGrid">
                      {timezoneConversions.map(({ timezone, formatted }) => (
                        <div key={timezone} className="toolkitTimestampLabTimezoneItem">
                          <div className="toolkitTimestampLabTimezoneHeader">
                            <span className="toolkitTimestampLabTimezoneName">{timezone.replace(/_/g, " ")}</span>
                            <button
                              className="toolkitTimestampLabCopyBtn"
                              onClick={() => copyText(formatted)}
                            >
                              <FontAwesomeIcon icon={faCopy} />
                            </button>
                          </div>
                          <div className="toolkitTimestampLabTimezoneValue">{formatted}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="toolkitTimestampLabCard">
                  <div className="toolkitTimestampLabCardTitle">
                    Epoch Conversions
                  </div>

                  <div className="toolkitTimestampLabRow">
                    <label className="toolkitTimestampLabLabel">Epoch Type</label>
                    <Dropdown
                      value={EPOCH_TYPES[selectedEpoch].name}
                      onChange={(option) => setSelectedEpoch((Object.entries(EPOCH_TYPES).find(([, { name }]) => name === option) || ["unix"])[0])}
                      options={Object.values(EPOCH_TYPES).map(({ name }) => name)}
                      placeholder="Epoch Type"
                    />
                  </div>

                  <div className="toolkitTimestampLabEpochInfo">
                    <div className="toolkitTimestampLabEpochName">{EPOCH_TYPES[selectedEpoch].name}</div>
                    <div className="toolkitTimestampLabEpochDesc">{EPOCH_TYPES[selectedEpoch].description}</div>
                  </div>

                  {currentDate && (
                    <div className="toolkitTimestampLabFormatItem">
                      <div className="toolkitTimestampLabFormatLabel">
                        Timestamp ({EPOCH_TYPES[selectedEpoch].name})
                      </div>
                      <div className="toolkitTimestampLabFormatValue">
                        {convertToEpoch(currentDate, selectedEpoch)}
                        <button
                          className="toolkitTimestampLabCopyBtn"
                          onClick={() => copyText(String(convertToEpoch(currentDate, selectedEpoch)))}
                        >
                          <FontAwesomeIcon icon={faCopy} />
                        </button>
                      </div>
                    </div>
                  )}
                </section>

                <section className="toolkitTimestampLabCard">
                  <div className="toolkitTimestampLabCardTitle">
                    Format Templates
                  </div>

                  <div className="toolkitTimestampLabTemplateList">
                    {FORMAT_TEMPLATES.map(({ name, format }) => (
                      <div key={name} className="toolkitTimestampLabTemplateItem">
                        <div className="toolkitTimestampLabTemplateHeader">
                          <span className="toolkitTimestampLabTemplateName">{name}</span>
                          <span className="toolkitTimestampLabTemplateFormat">{format}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="toolkitTimestampLabCard toolkitTimestampLabCardWide">
                  <div className="toolkitTimestampLabCardTitle">
                    Export
                  </div>

                  <div className="toolkitTimestampLabExportBlock">
                    <div className="toolkitTimestampLabExportHeader">
                      <div className="toolkitTimestampLabExportTitle">Timestamp Data (JSON)</div>
                      <div className="toolkitTimestampLabExportActions">
                        <button className="toolkitTimestampLabBtn" onClick={() => copyText(exportJson)}>
                          <FontAwesomeIcon icon={faCopy} /> Copy
                        </button>
                        <button
                          className="toolkitTimestampLabBtn"
                          onClick={() => downloadTextFile("timestamp-data.json", exportJson)}
                        >
                          <FontAwesomeIcon icon={faDownload} /> Download
                        </button>
                      </div>
                    </div>
                    <pre className="toolkitTimestampLabCode">{exportJson}</pre>
                  </div>
                </section>
              </div>
            </main>
          </div>
        </>
      )}
    </div>
  );
};

export default Timestamps;