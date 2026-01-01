import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faClock,
  faCalendarDays,
  faGlobe,
  faArrowRightArrowLeft,
  faDownload,
  faCopy,
  faArrowsRotate,
  faStopwatch,
  faHourglass,
  faCalculator,
  faPlay,
  faPause,
  faRotateRight,
  faCalendarWeek,
  faSun,
  faMoon,
  faLocationDot,
  faBolt,
  faClockRotateLeft
} from "@fortawesome/free-solid-svg-icons";
import Tippy from "@tippyjs/react";
import DinoLabsNav from "../../../helpers/Nav";
import "../../../styles/mainStyles/DinoLabsPlugins/DinoLabsPluginsTimestampLab/DinoLabsPluginsTimestampLab.css";
import "../../../styles/helperStyles/Slider.css";

const DinoLabsPluginsTimestampLab = () => {
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

  const timezones = [
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

  const epochTypes = {
    unix: { name: "Unix Epoch", date: new Date(0), description: "January 1, 1970 00:00:00 UTC" },
    windows: { name: "Windows FILETIME", date: new Date(-11644473600000), description: "January 1, 1601 00:00:00 UTC" },
    mac: { name: "Mac HFS+", date: new Date(-2082844800000), description: "January 1, 1904 00:00:00 UTC" },
    cocoa: { name: "Cocoa/NSDate", date: new Date(978307200000), description: "January 1, 2001 00:00:00 UTC" },
    gps: { name: "GPS Epoch", date: new Date(315964800000), description: "January 6, 1980 00:00:00 UTC" }
  };

  const formatTemplates = [
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
    const suffix = diffMs >= 0 ? "from now" : "ago";
    if (years > 0) return `${years} year${years > 1 ? "s" : ""} ${suffix}`;
    if (months > 0) return `${months} month${months > 1 ? "s" : ""} ${suffix}`;
    if (weeks > 0) return `${weeks} week${weeks > 1 ? "s" : ""} ${suffix}`;
    if (days > 0) return `${days} day${days > 1 ? "s" : ""} ${suffix}`;
    if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ${suffix}`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ${suffix}`;
    return `${seconds} second${seconds !== 1 ? "s" : ""} ${suffix}`;
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
    const epochDate = epochTypes[epochType].date;
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
    return timezones.map(tz => ({
      timezone: tz,
      formatted: getFullDateTimeString(currentDate, tz)
    }));
  }, [currentDate, getFullDateTimeString]);

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
      timezones: timezones.reduce((acc, tz) => {
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
    <div className="dinolabsTimestampLabApp" tabIndex={0}>
      <DinoLabsNav activePage="plugins" />

      <div className="dinolabsTimestampLabShell">
        <aside className="dinolabsTimestampLabSidebar">
          <div className="dinolabsTimestampLabSection">
            <div className="dinolabsTimestampLabSectionTitle">
              <FontAwesomeIcon icon={faBolt} />
              <span>Live Timestamp</span>
            </div>

            <div className="dinolabsTimestampLabLiveDisplay">
              <div className="dinolabsTimestampLabLiveValue">
                {Math.floor(liveTimestamp / 1000)}
              </div>
              <div className="dinolabsTimestampLabLiveLabel">Unix Seconds</div>
              <div className="dinolabsTimestampLabLiveValue dinolabsTimestampLabLiveMs">
                {liveTimestamp}
              </div>
              <div className="dinolabsTimestampLabLiveLabel">Milliseconds</div>
            </div>

            <div className="dinolabsTimestampLabRow dinolabsTimestampLabActions">
              <button
                className={`dinolabsTimestampLabBtn ${!isLiveRunning ? "dinolabsTimestampLabSubtle" : ""}`}
                onClick={() => setIsLiveRunning(prev => !prev)}
              >
                <FontAwesomeIcon icon={isLiveRunning ? faPause : faPlay} />
                {isLiveRunning ? "Pause" : "Resume"}
              </button>
            </div>
          </div>

          <div className="dinolabsTimestampLabSection">
            <div className="dinolabsTimestampLabSectionTitle">
              <FontAwesomeIcon icon={faClock} />
              <span>Unix Timestamp Input</span>
            </div>

            <div className="dinolabsTimestampLabRow">
              <label className="dinolabsTimestampLabLabel">Timestamp</label>
              <input
                type="number"
                className="dinolabsTimestampLabInput"
                value={unixInput}
                onChange={(e) => setUnixInput(e.target.value)}
              />
            </div>

            <div className="dinolabsTimestampLabRow">
              <label className="dinolabsTimestampLabLabel">Unit</label>
              <select
                className="dinolabsTimestampLabSelect"
                value={unixUnit}
                onChange={(e) => setUnixUnit(e.target.value)}
              >
                <option value="seconds">Seconds</option>
                <option value="milliseconds">Milliseconds</option>
              </select>
            </div>

            <div className="dinolabsTimestampLabRow dinolabsTimestampLabActions">
              <button className="dinolabsTimestampLabBtn" onClick={setToNow}>
                <FontAwesomeIcon icon={faRotateRight} /> Now
              </button>
              <button className="dinolabsTimestampLabBtn dinolabsTimestampLabSubtle" onClick={resetAll}>
                <FontAwesomeIcon icon={faArrowsRotate} /> Reset
              </button>
            </div>
          </div>

          <div className="dinolabsTimestampLabSection">
            <div className="dinolabsTimestampLabSectionTitle">
              <FontAwesomeIcon icon={faCalendarDays} />
              <span>Date And Time Picker</span>
            </div>

            <div className="dinolabsTimestampLabRow">
              <label className="dinolabsTimestampLabLabel">Date</label>
              <input
                type="date"
                className="dinolabsTimestampLabInput"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
              />
            </div>

            <div className="dinolabsTimestampLabRow">
              <label className="dinolabsTimestampLabLabel">Time</label>
              <input
                type="time"
                className="dinolabsTimestampLabInput"
                value={timeInput}
                onChange={(e) => setTimeInput(e.target.value)}
              />
            </div>

            {dateFromPicker && (
              <div className="dinolabsTimestampLabRow">
                <div className="dinolabsTimestampLabSmall">
                  Unix: {getUnixFromDate(dateFromPicker, "seconds")}
                </div>
              </div>
            )}

            <div className="dinolabsTimestampLabRow dinolabsTimestampLabActions">
              <button
                className="dinolabsTimestampLabBtn"
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

          <div className="dinolabsTimestampLabSection">
            <div className="dinolabsTimestampLabSectionTitle">
              <FontAwesomeIcon icon={faGlobe} />
              <span>Timezone Settings</span>
            </div>

            <div className="dinolabsTimestampLabRow">
              <label className="dinolabsTimestampLabLabel">Source Timezone</label>
              <select
                className="dinolabsTimestampLabSelect"
                value={selectedTimezone}
                onChange={(e) => setSelectedTimezone(e.target.value)}
              >
                {timezones.map(tz => (
                  <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>

            <div className="dinolabsTimestampLabRow">
              <label className="dinolabsTimestampLabLabel">Target Timezone</label>
              <select
                className="dinolabsTimestampLabSelect"
                value={targetTimezone}
                onChange={(e) => setTargetTimezone(e.target.value)}
              >
                {timezones.map(tz => (
                  <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="dinolabsTimestampLabSection">
            <div className="dinolabsTimestampLabSectionTitle">
              <FontAwesomeIcon icon={faCalculator} />
              <span>Date Difference</span>
            </div>

            <div className="dinolabsTimestampLabRow">
              <label className="dinolabsTimestampLabLabel">Start Date</label>
              <input
                type="date"
                className="dinolabsTimestampLabInput"
                value={diffStartDate}
                onChange={(e) => setDiffStartDate(e.target.value)}
              />
            </div>

            <div className="dinolabsTimestampLabRow">
              <label className="dinolabsTimestampLabLabel">End Date</label>
              <input
                type="date"
                className="dinolabsTimestampLabInput"
                value={diffEndDate}
                onChange={(e) => setDiffEndDate(e.target.value)}
              />
            </div>

            {dateDifference && (
              <div className="dinolabsTimestampLabDiffResult">
                <div className="dinolabsTimestampLabDiffItem">
                  <span className="dinolabsTimestampLabDiffValue">{dateDifference.days}</span>
                  <span className="dinolabsTimestampLabDiffLabel">Days</span>
                </div>
                <div className="dinolabsTimestampLabDiffItem">
                  <span className="dinolabsTimestampLabDiffValue">{dateDifference.weeks}</span>
                  <span className="dinolabsTimestampLabDiffLabel">Weeks</span>
                </div>
                <div className="dinolabsTimestampLabDiffItem">
                  <span className="dinolabsTimestampLabDiffValue">{dateDifference.months}</span>
                  <span className="dinolabsTimestampLabDiffLabel">Months</span>
                </div>
              </div>
            )}
          </div>

          <div className="dinolabsTimestampLabSection">
            <div className="dinolabsTimestampLabSectionTitle">
              <FontAwesomeIcon icon={faHourglass} />
              <span>Add Or Subtract Time</span>
            </div>

            <div className="dinolabsTimestampLabRow">
              <label className="dinolabsTimestampLabLabel">Base Date</label>
              <input
                type="date"
                className="dinolabsTimestampLabInput"
                value={addSubtractBase}
                onChange={(e) => setAddSubtractBase(e.target.value)}
              />
            </div>

            <div className="dinolabsTimestampLabRow">
              <label className="dinolabsTimestampLabLabel">Operation</label>
              <select
                className="dinolabsTimestampLabSelect"
                value={addSubtractOperation}
                onChange={(e) => setAddSubtractOperation(e.target.value)}
              >
                <option value="add">Add</option>
                <option value="subtract">Subtract</option>
              </select>
            </div>

            <div className="dinolabsTimestampLabRow">
              <label className="dinolabsTimestampLabLabel">Value</label>
              <input
                type="number"
                className="dinolabsTimestampLabInput"
                value={addSubtractValue}
                onChange={(e) => setAddSubtractValue(parseInt(e.target.value, 10) || 0)}
              />
            </div>

            <div className="dinolabsTimestampLabRow">
              <label className="dinolabsTimestampLabLabel">Unit</label>
              <select
                className="dinolabsTimestampLabSelect"
                value={addSubtractUnit}
                onChange={(e) => setAddSubtractUnit(e.target.value)}
              >
                <option value="seconds">Seconds</option>
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
                <option value="months">Months</option>
                <option value="years">Years</option>
              </select>
            </div>

            {addSubtractResult && (
              <div className="dinolabsTimestampLabRow">
                <div className="dinolabsTimestampLabSmall">
                  Result: {addSubtractResult.toISOString().split("T")[0]}
                </div>
              </div>
            )}
          </div>

          <div className="dinolabsTimestampLabSection">
            <div className="dinolabsTimestampLabSectionTitle">
              <FontAwesomeIcon icon={faStopwatch} />
              <span>Stopwatch</span>
            </div>

            <div className="dinolabsTimestampLabStopwatch">
              <div className="dinolabsTimestampLabStopwatchDisplay">
                {formatStopwatch(stopwatchTime)}
              </div>
            </div>

            <div className="dinolabsTimestampLabRow dinolabsTimestampLabActions">
              <button
                className={`dinolabsTimestampLabBtn ${!isStopwatchRunning ? "" : "dinolabsTimestampLabSubtle"}`}
                onClick={toggleStopwatch}
              >
                <FontAwesomeIcon icon={isStopwatchRunning ? faPause : faPlay} />
                {isStopwatchRunning ? "Pause" : "Start"}
              </button>
              <button
                className="dinolabsTimestampLabBtn dinolabsTimestampLabSubtle"
                onClick={resetStopwatch}
              >
                <FontAwesomeIcon icon={faRotateRight} /> Reset
              </button>
            </div>
          </div>
        </aside>

        <main className="dinolabsTimestampLabMain">
          <div className="dinolabsTimestampLabMainGrid">
            <section className="dinolabsTimestampLabCard">
              <div className="dinolabsTimestampLabCardTitle">
                Converted Formats
              </div>

              {currentDate && (
                <div className="dinolabsTimestampLabFormatGrid">
                  <div className="dinolabsTimestampLabFormatItem">
                    <div className="dinolabsTimestampLabFormatLabel">ISO 8601</div>
                    <div className="dinolabsTimestampLabFormatValue">
                      {getISOString(currentDate)}
                      <button
                        className="dinolabsTimestampLabCopyBtn"
                        onClick={() => copyText(getISOString(currentDate))}
                      >
                        <FontAwesomeIcon icon={faCopy} />
                      </button>
                    </div>
                  </div>

                  <div className="dinolabsTimestampLabFormatItem">
                    <div className="dinolabsTimestampLabFormatLabel">RFC 2822</div>
                    <div className="dinolabsTimestampLabFormatValue">
                      {getRFC2822(currentDate)}
                      <button
                        className="dinolabsTimestampLabCopyBtn"
                        onClick={() => copyText(getRFC2822(currentDate))}
                      >
                        <FontAwesomeIcon icon={faCopy} />
                      </button>
                    </div>
                  </div>

                  <div className="dinolabsTimestampLabFormatItem">
                    <div className="dinolabsTimestampLabFormatLabel">Unix Seconds</div>
                    <div className="dinolabsTimestampLabFormatValue">
                      {getUnixFromDate(currentDate, "seconds")}
                      <button
                        className="dinolabsTimestampLabCopyBtn"
                        onClick={() => copyText(String(getUnixFromDate(currentDate, "seconds")))}
                      >
                        <FontAwesomeIcon icon={faCopy} />
                      </button>
                    </div>
                  </div>

                  <div className="dinolabsTimestampLabFormatItem">
                    <div className="dinolabsTimestampLabFormatLabel">Unix Milliseconds</div>
                    <div className="dinolabsTimestampLabFormatValue">
                      {getUnixFromDate(currentDate, "milliseconds")}
                      <button
                        className="dinolabsTimestampLabCopyBtn"
                        onClick={() => copyText(String(getUnixFromDate(currentDate, "milliseconds")))}
                      >
                        <FontAwesomeIcon icon={faCopy} />
                      </button>
                    </div>
                  </div>

                  <div className="dinolabsTimestampLabFormatItem">
                    <div className="dinolabsTimestampLabFormatLabel">Human Readable ({selectedTimezone})</div>
                    <div className="dinolabsTimestampLabFormatValue">
                      {getFullDateTimeString(currentDate, selectedTimezone)}
                      <button
                        className="dinolabsTimestampLabCopyBtn"
                        onClick={() => copyText(getFullDateTimeString(currentDate, selectedTimezone))}
                      >
                        <FontAwesomeIcon icon={faCopy} />
                      </button>
                    </div>
                  </div>

                  <div className="dinolabsTimestampLabFormatItem">
                    <div className="dinolabsTimestampLabFormatLabel">Relative Time</div>
                    <div className="dinolabsTimestampLabFormatValue">
                      {getRelativeTime(currentDate)}
                      <button
                        className="dinolabsTimestampLabCopyBtn"
                        onClick={() => copyText(getRelativeTime(currentDate))}
                      >
                        <FontAwesomeIcon icon={faCopy} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="dinolabsTimestampLabCard">
              <div className="dinolabsTimestampLabCardTitle">
                Date Metadata
              </div>

              {currentDate && (
                <div className="dinolabsTimestampLabMetaGrid">
                  <div className="dinolabsTimestampLabMetaItem">
                    <FontAwesomeIcon icon={faCalendarWeek} className="dinolabsTimestampLabMetaIcon" />
                    <div className="dinolabsTimestampLabMetaContent">
                      <div className="dinolabsTimestampLabMetaValue">{getWeekNumber(currentDate, weekStartDay)}</div>
                      <div className="dinolabsTimestampLabMetaLabel">Week Number</div>
                    </div>
                  </div>

                  <div className="dinolabsTimestampLabMetaItem">
                    <FontAwesomeIcon icon={faSun} className="dinolabsTimestampLabMetaIcon" />
                    <div className="dinolabsTimestampLabMetaContent">
                      <div className="dinolabsTimestampLabMetaValue">{getDayOfYear(currentDate)}</div>
                      <div className="dinolabsTimestampLabMetaLabel">Day Of Year</div>
                    </div>
                  </div>

                  <div className="dinolabsTimestampLabMetaItem">
                    <FontAwesomeIcon icon={faCalendarDays} className="dinolabsTimestampLabMetaIcon" />
                    <div className="dinolabsTimestampLabMetaContent">
                      <div className="dinolabsTimestampLabMetaValue">Q{getQuarter(currentDate)}</div>
                      <div className="dinolabsTimestampLabMetaLabel">Quarter</div>
                    </div>
                  </div>

                  <div className="dinolabsTimestampLabMetaItem">
                    <FontAwesomeIcon icon={faMoon} className="dinolabsTimestampLabMetaIcon" />
                    <div className="dinolabsTimestampLabMetaContent">
                      <div className="dinolabsTimestampLabMetaValue">{isLeapYear(currentDate.getFullYear()) ? "Yes" : "No"}</div>
                      <div className="dinolabsTimestampLabMetaLabel">Leap Year</div>
                    </div>
                  </div>

                  <div className="dinolabsTimestampLabMetaItem">
                    <FontAwesomeIcon icon={faClockRotateLeft} className="dinolabsTimestampLabMetaIcon" />
                    <div className="dinolabsTimestampLabMetaContent">
                      <div className="dinolabsTimestampLabMetaValue">
                        {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][currentDate.getDay()]}
                      </div>
                      <div className="dinolabsTimestampLabMetaLabel">Day Of Week</div>
                    </div>
                  </div>

                  <div className="dinolabsTimestampLabMetaItem">
                    <FontAwesomeIcon icon={faLocationDot} className="dinolabsTimestampLabMetaIcon" />
                    <div className="dinolabsTimestampLabMetaContent">
                      <div className="dinolabsTimestampLabMetaValue">{currentDate.getTimezoneOffset()} min</div>
                      <div className="dinolabsTimestampLabMetaLabel">UTC Offset</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="dinolabsTimestampLabRow">
                <label className="dinolabsTimestampLabLabel">Week Starts On</label>
                <select
                  className="dinolabsTimestampLabSelect"
                  value={weekStartDay}
                  onChange={(e) => setWeekStartDay(e.target.value)}
                >
                  <option value="sunday">Sunday</option>
                  <option value="monday">Monday</option>
                </select>
              </div>
            </section>

            <section className="dinolabsTimestampLabCard dinolabsTimestampLabCardWide">
              <div className="dinolabsTimestampLabCardTitle">
                Timezone Conversions
              </div>

              {currentDate && (
                <div className="dinolabsTimestampLabTimezoneGrid">
                  {timezoneConversions.map(({ timezone, formatted }) => (
                    <div key={timezone} className="dinolabsTimestampLabTimezoneItem">
                      <div className="dinolabsTimestampLabTimezoneHeader">
                        <span className="dinolabsTimestampLabTimezoneName">{timezone.replace(/_/g, " ")}</span>
                        <button
                          className="dinolabsTimestampLabCopyBtn"
                          onClick={() => copyText(formatted)}
                        >
                          <FontAwesomeIcon icon={faCopy} />
                        </button>
                      </div>
                      <div className="dinolabsTimestampLabTimezoneValue">{formatted}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="dinolabsTimestampLabCard">
              <div className="dinolabsTimestampLabCardTitle">
                Epoch Conversions
              </div>

              <div className="dinolabsTimestampLabRow">
                <label className="dinolabsTimestampLabLabel">Epoch Type</label>
                <select
                  className="dinolabsTimestampLabSelect"
                  value={selectedEpoch}
                  onChange={(e) => setSelectedEpoch(e.target.value)}
                >
                  {Object.entries(epochTypes).map(([key, { name }]) => (
                    <option key={key} value={key}>{name}</option>
                  ))}
                </select>
              </div>

              <div className="dinolabsTimestampLabEpochInfo">
                <div className="dinolabsTimestampLabEpochName">{epochTypes[selectedEpoch].name}</div>
                <div className="dinolabsTimestampLabEpochDesc">{epochTypes[selectedEpoch].description}</div>
              </div>

              {currentDate && (
                <div className="dinolabsTimestampLabFormatItem">
                  <div className="dinolabsTimestampLabFormatLabel">
                    Timestamp ({epochTypes[selectedEpoch].name})
                  </div>
                  <div className="dinolabsTimestampLabFormatValue">
                    {convertToEpoch(currentDate, selectedEpoch)}
                    <button
                      className="dinolabsTimestampLabCopyBtn"
                      onClick={() => copyText(String(convertToEpoch(currentDate, selectedEpoch)))}
                    >
                      <FontAwesomeIcon icon={faCopy} />
                    </button>
                  </div>
                </div>
              )}
            </section>

            <section className="dinolabsTimestampLabCard">
              <div className="dinolabsTimestampLabCardTitle">
                Format Templates
              </div>

              <div className="dinolabsTimestampLabTemplateList">
                {formatTemplates.map(({ name, format }) => (
                  <div key={name} className="dinolabsTimestampLabTemplateItem">
                    <div className="dinolabsTimestampLabTemplateHeader">
                      <span className="dinolabsTimestampLabTemplateName">{name}</span>
                      <span className="dinolabsTimestampLabTemplateFormat">{format}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="dinolabsTimestampLabCard dinolabsTimestampLabCardWide">
              <div className="dinolabsTimestampLabCardTitle">
                Export
              </div>

              <div className="dinolabsTimestampLabExportBlock">
                <div className="dinolabsTimestampLabExportHeader">
                  <div className="dinolabsTimestampLabExportTitle">Timestamp Data (JSON)</div>
                  <div className="dinolabsTimestampLabExportActions">
                    <button className="dinolabsTimestampLabBtn" onClick={() => copyText(exportJson)}>
                      <FontAwesomeIcon icon={faCopy} /> Copy
                    </button>
                    <button
                      className="dinolabsTimestampLabBtn"
                      onClick={() => downloadTextFile("timestamp-data.json", exportJson)}
                    >
                      <FontAwesomeIcon icon={faDownload} /> Download
                    </button>
                  </div>
                </div>
                <pre className="dinolabsTimestampLabCode">{exportJson}</pre>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
};

export default DinoLabsPluginsTimestampLab;