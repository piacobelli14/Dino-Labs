import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faAsterisk, faFlag, faBook, faRightLeft, faFileExport,
  faCopy, faDownload, faTriangleExclamation, faCode, faListOl,
  faHighlighter, faCircleNotch
} from "@fortawesome/free-solid-svg-icons";
import Nav from "../../../../helpers/Nav.jsx";
import useAuth from "../../../../UseAuth.jsx";
import "../../../../styles/mainStyles/Toolkit/Utilities/Regex/Regex.css";
import "../../../../styles/helperStyles/LoadingSpinner.css";

const MATCH_LIMIT = 5000;

const EXECUTION_TIMEOUT_MS = 1500;

const FLAG_OPTIONS = [
  { flag: "g", label: "Global", description: "Find every match instead of stopping at the first one." },
  { flag: "i", label: "Ignore Case", description: "Match letters regardless of case." },
  { flag: "m", label: "Multiline", description: "Make ^ and $ match at line breaks." },
  { flag: "s", label: "Dot All", description: "Let . match line breaks too." },
  { flag: "u", label: "Unicode", description: "Treat the pattern as a sequence of Unicode code points." },
  { flag: "y", label: "Sticky", description: "Only match at the current position." }
];

const PATTERN_LIBRARY = [
  { label: "Email", pattern: "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}", flags: "g" },
  { label: "URL", pattern: "https?:\\/\\/[^\\s/$.?#][^\\s]*", flags: "gi" },
  { label: "IPv4", pattern: "\\b(?:(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\b", flags: "g" },
  { label: "ISO Date", pattern: "\\b(\\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])\\b", flags: "g" },
  { label: "US Phone", pattern: "\\(?\\b\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}\\b", flags: "g" },
  { label: "24-Hour Time", pattern: "\\b([01]\\d|2[0-3]):([0-5]\\d)(?::([0-5]\\d))?\\b", flags: "g" },
  { label: "Hex Color", pattern: "#(?:[0-9a-fA-F]{3}){1,2}\\b", flags: "g" },
  { label: "UUID", pattern: "\\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\b", flags: "gi" },
  { label: "Number", pattern: "-?\\d+(?:\\.\\d+)?", flags: "g" },
  { label: "MRN", pattern: "\\bMRN[:#\\s]*(\\d{6,10})\\b", flags: "gi" },
  { label: "Key Value", pattern: "(?<key>[A-Za-z_]\\w*)=(?<value>[^;\\s]+)", flags: "g" },
  { label: "Repeated Word", pattern: "\\b(\\w+)\\s+\\1\\b", flags: "gi" },
  { label: "Trailing Space", pattern: "[ \\t]+$", flags: "gm" },
  { label: "HTML Tag", pattern: "<\\/?([a-z][a-z0-9]*)\\b[^>]*>", flags: "gi" }
];

const CHEAT_SHEET = [
  [".", "Any Character Except Newline"], ["\\d", "Digit"], ["\\w", "Word Character"], ["\\s", "Whitespace"],
  ["\\b", "Word Boundary"], ["^", "Start Of Input Or Line"], ["$", "End Of Input Or Line"], ["*", "Zero Or More"],
  ["+", "One Or More"], ["?", "Zero Or One"], ["{n,m}", "Between n And m Times"], ["*?", "Lazy Zero Or More"],
  ["[abc]", "Any Of a, b, Or c"], ["[^abc]", "Anything Except a, b, Or c"], ["a|b", "a Or b"], ["( )", "Capture Group"],
  ["(?: )", "Non-Capturing Group"], ["(?<name> )", "Named Group"], ["\\1", "Backreference To Group 1"],
  ["(?= )", "Lookahead"], ["(?! )", "Negative Lookahead"], ["(?<= )", "Lookbehind"], ["(?<! )", "Negative Lookbehind"]
];

const SAMPLE_TEXT = "Study visit on 2026-09-21 at 14:30 for MRN 00482913.\nContact: coordinator@uth.tmc.edu or (713) 500-1555.\nBackup: research.team@example.org, 713.555.0199\nDevice id=wrist-07; firmware=2.4.1; battery=86\nSession ID 3f2b8c1e-9a4d-4b7e-8c21-5d6f7a8b9c0d logged from 10.0.12.44\nThe the sensor was re-seated at 09:05:12 and the the strap tightened.   \nTheme accent #4ecdc4 with fallback #12151b and #fff.";

const REGEX_WORKER_SOURCE = `
self.onmessage = (event) => {
  const { id, pattern, flags, text, replacement, limit } = event.data;
  try {
    const regex = new RegExp(pattern, flags);
    const matches = [];
    let truncated = false;
    const record = (match) => {
      matches.push({
        index: match.index,
        value: match[0],
        groups: Array.from(match).slice(1).map((group) => (group === undefined ? null : group)),
        named: match.groups ? Object.assign({}, match.groups) : null
      });
    };
    if (flags.includes("g") || flags.includes("y")) {
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(text)) !== null) {
        if (matches.length >= limit) {
          truncated = true;
          break;
        }
        record(match);
        if (match[0] === "") {
          const step = flags.includes("u") && text.codePointAt(regex.lastIndex) > 0xffff ? 2 : 1;
          regex.lastIndex += step;
          if (regex.lastIndex > text.length) break;
        }
      }
    } else {
      const match = regex.exec(text);
      if (match) record(match);
    }
    const replaced = replacement === null ? null : text.replace(new RegExp(pattern, flags), replacement);
    self.postMessage({ id, matches, truncated, replaced });
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};
`;

const countCaptureGroups = (pattern, flags) => {
  try {
    return new RegExp(`${pattern}|`, flags.replace(/[gy]/g, "")).exec("").length - 1;
  } catch {
    return 0;
  }
};

const extractGroupNames = (pattern) => {
  const names = [];
  const finder = /\(\?<([A-Za-z_$][\w$]*)>/g;
  let found;
  while ((found = finder.exec(pattern)) !== null) names.push(found[1]);
  return names;
};

const toPythonPattern = (pattern) => pattern
  .replace(/\(\?<([A-Za-z_]\w*)>/g, "(?P<$1>")
  .replace(/\\k<([A-Za-z_]\w*)>/g, "(?P=$1)");

const buildCodeSnippets = (pattern, flags, replacement) => {
  const jsFlags = flags;
  const pythonFlags = [
    flags.includes("i") ? "re.IGNORECASE" : null,
    flags.includes("m") ? "re.MULTILINE" : null,
    flags.includes("s") ? "re.DOTALL" : null
  ].filter(Boolean);
  const escapedJs = pattern.replace(/\//g, "\\/");
  const pythonPattern = toPythonPattern(pattern).replace(/"/g, "\\\"");
  const javascript = [
    `const pattern = /${escapedJs}/${jsFlags};`,
    flags.includes("g") ? "const matches = [...text.matchAll(pattern)];" : "const match = text.match(pattern);",
    replacement !== "" ? `const replaced = text.replace(pattern, ${JSON.stringify(replacement)});` : null
  ].filter(Boolean).join("\n");
  const python = [
    "import re",
    `pattern = re.compile(r"${pythonPattern}"${pythonFlags.length ? `, ${pythonFlags.join(" | ")}` : ""})`,
    flags.includes("g") ? "matches = list(pattern.finditer(text))" : "match = pattern.search(text)",
    replacement !== "" ? `replaced = pattern.sub(r"${replacement.replace(/\$&/g, "\\g<0>").replace(/\$(\d+)/g, "\\$1").replace(/\$<([A-Za-z_]\w*)>/g, "\\g<$1>").replace(/"/g, "\\\"")}", text${flags.includes("g") ? "" : ", count=1"})` : null
  ].filter(Boolean).join("\n");
  return { javascript, python };
};

const escapeCsv = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
};

const matchesToCsv = (matches, groupCount, groupNames) => {
  const header = ["Match", "Index", "Length", "Value", ...Array.from({ length: groupCount }, (_, i) => `Group ${i + 1}`), ...groupNames];
  const rows = matches.map((match, index) => [
    index + 1, match.index, match.value.length, match.value,
    ...Array.from({ length: groupCount }, (_, i) => match.groups[i]),
    ...groupNames.map((name) => (match.named ? match.named[name] : null))
  ]);
  return [header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
};

const copyText = (text) => navigator.clipboard.writeText(text);

const downloadTextFile = (content, filename, type) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const buildSegments = (text, matches) => {
  const segments = [];
  let cursor = 0;
  matches.forEach((match, index) => {
    if (match.index > cursor) segments.push({ text: text.slice(cursor, match.index), match: null });
    if (match.value.length) segments.push({ text: match.value, match: index });
    else segments.push({ text: "", match: index, empty: true });
    cursor = Math.max(cursor, match.index + match.value.length);
  });
  if (cursor < text.length) segments.push({ text: text.slice(cursor), match: null });
  return segments;
};

const Regex = () => {
  const navigate = useNavigate();
  const { token, loading } = useAuth();

  const [pattern, setPattern] = useState(PATTERN_LIBRARY[0].pattern);
  const [flags, setFlags] = useState("g");
  const [testText, setTestText] = useState(SAMPLE_TEXT);
  const [replacement, setReplacement] = useState("");
  const [replaceEnabled, setReplaceEnabled] = useState(false);
  const [result, setResult] = useState({ matches: [], truncated: false, replaced: null });
  const [runError, setRunError] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [snippetLanguage, setSnippetLanguage] = useState("javascript");

  const workerRef = useRef(null);
  const requestIdRef = useRef(0);
  const timeoutRef = useRef(null);
  const debounceRef = useRef(null);

  const compileError = useMemo(() => {
    if (!pattern) return "";
    try {
      new RegExp(pattern, flags);
      return "";
    } catch (error) {
      return error.message;
    }
  }, [pattern, flags]);

  const groupCount = useMemo(() => (compileError ? 0 : countCaptureGroups(pattern, flags)), [pattern, flags, compileError]);
  const groupNames = useMemo(() => extractGroupNames(pattern), [pattern]);
  const snippets = useMemo(() => buildCodeSnippets(pattern, flags, replaceEnabled ? replacement : ""), [pattern, flags, replacement, replaceEnabled]);
  const segments = useMemo(() => buildSegments(testText, result.matches), [testText, result.matches]);

  const createWorker = useCallback(() => {
    const blob = new Blob([REGEX_WORKER_SOURCE], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    URL.revokeObjectURL(url);
    worker.onmessage = (event) => {
      const data = event.data;
      if (data.id !== requestIdRef.current) return;
      clearTimeout(timeoutRef.current);
      setIsRunning(false);
      if (data.error) {
        setRunError(data.error);
        setResult({ matches: [], truncated: false, replaced: null });
        return;
      }
      setRunError("");
      setResult({ matches: data.matches, truncated: data.truncated, replaced: data.replaced });
    };
    workerRef.current = worker;
    return worker;
  }, []);

  useEffect(() => {
    createWorker();
    return () => {
      clearTimeout(timeoutRef.current);
      clearTimeout(debounceRef.current);
      if (workerRef.current) workerRef.current.terminate();
    };
  }, [createWorker]);

  useEffect(() => {
    if (!loading && !token) navigate("/login");
  }, [token, loading, navigate]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    setSelectedMatch(null);
    if (!pattern || compileError) {
      setResult({ matches: [], truncated: false, replaced: null });
      setRunError("");
      setIsRunning(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      const id = requestIdRef.current + 1;
      requestIdRef.current = id;
      setIsRunning(true);
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        if (requestIdRef.current !== id) return;
        if (workerRef.current) workerRef.current.terminate();
        createWorker();
        setIsRunning(false);
        setResult({ matches: [], truncated: false, replaced: null });
        setRunError(`The pattern took longer than ${EXECUTION_TIMEOUT_MS / 1000} seconds and was stopped. It may cause catastrophic backtracking.`);
      }, EXECUTION_TIMEOUT_MS);
      workerRef.current.postMessage({
        id,
        pattern,
        flags,
        text: testText,
        replacement: replaceEnabled ? replacement : null,
        limit: MATCH_LIMIT
      });
    }, 150);
  }, [pattern, flags, testText, replacement, replaceEnabled, compileError, createWorker]);

  const toggleFlag = (flag) => {
    setFlags((previous) => {
      const next = previous.includes(flag) ? previous.replace(flag, "") : previous + flag;
      return FLAG_OPTIONS.map((option) => option.flag).filter((option) => next.includes(option)).join("");
    });
  };

  const applyPreset = (preset) => {
    setPattern(preset.pattern);
    setFlags(preset.flags);
  };

  const errorMessage = compileError || runError;
  const statusLabel = !pattern ? "Empty" : errorMessage ? "Invalid" : isRunning ? "Running" : "Valid";
  const matchCount = result.matches.length;
  const activeSnippet = snippets[snippetLanguage];

  return (
    <div className="toolkitRegexLabApp">
      <Nav activePage="regex" />

      {loading ? (
        <div className="toolkitRegexLabCellHeaderContainer" style={{ justifyContent: "center" }}>
          <div className="loading-wrapper">
            <div className="loading-circle" />
            <label className="loading-title">
              Loading
            </label>
          </div>
        </div>
      ) : (
        <>
          <div className="toolkitRegexLabToolBar">
            <div className="toolkitRegexLabTitle">
              <FontAwesomeIcon icon={faAsterisk} />
              <span>Regex</span>
            </div>

            <div className="toolkitRegexLabStatusGroup">
              <span className={`toolkitRegexLabStatusItem${errorMessage ? " toolkitRegexLabStatusError" : pattern ? " toolkitRegexLabStatusAccent" : ""}`}>
                <span>{statusLabel}</span>
              </span>
              <span className="toolkitRegexLabStatusItem">
                <span>{flags ? `Flags ${flags}` : "No Flags"}</span>
              </span>
              <span className="toolkitRegexLabStatusItem">
                <span>{matchCount}{result.truncated ? "+" : ""} {matchCount === 1 ? "Match" : "Matches"}</span>
              </span>
              <span className="toolkitRegexLabStatusItem">
                <span>{groupCount} {groupCount === 1 ? "Group" : "Groups"}</span>
              </span>
            </div>
          </div>

          <div className="toolkitRegexLabShell">
            <aside className="toolkitRegexLabSidebar">
              <section className="toolkitRegexLabSection">
                <div className="toolkitRegexLabSectionTitle">
                  <FontAwesomeIcon icon={faAsterisk} />
                  Pattern
                </div>

                <div className="toolkitRegexLabRow">
                  <label className="toolkitRegexLabLabel">Expression</label>
                  <div className={`toolkitRegexLabPatternField${errorMessage ? " toolkitRegexLabPatternFieldError" : ""}`}>
                    <span className="toolkitRegexLabPatternSlash">/</span>
                    <input
                      className="toolkitRegexLabPatternInput"
                      type="text"
                      value={pattern}
                      onChange={(e) => setPattern(e.target.value)}
                      placeholder="Enter a regular expression."
                      spellCheck={false}
                      autoCorrect="off"
                      autoCapitalize="off"
                    />
                    <span className="toolkitRegexLabPatternSlash">/{flags}</span>
                  </div>
                </div>

                {errorMessage && (
                  <div className="toolkitRegexLabErrorText">
                    <FontAwesomeIcon icon={faTriangleExclamation} />
                    <span>{errorMessage}</span>
                  </div>
                )}
              </section>

              <section className="toolkitRegexLabSection">
                <div className="toolkitRegexLabSectionTitle">
                  <FontAwesomeIcon icon={faFlag} />
                  Flags
                </div>

                <div className="toolkitRegexLabPresets">
                  {FLAG_OPTIONS.map((option) => (
                    <button
                      key={option.flag}
                      type="button"
                      className={`toolkitRegexLabPresetBtn${flags.includes(option.flag) ? " active" : ""}`}
                      onClick={() => toggleFlag(option.flag)}
                      title={option.description}
                    >
                      {option.label} ({option.flag})
                    </button>
                  ))}
                </div>
              </section>

              <section className="toolkitRegexLabSection">
                <div className="toolkitRegexLabSectionTitle">
                  <FontAwesomeIcon icon={faRightLeft} />
                  Replace
                </div>

                <label className="toolkitRegexLabCheckbox">
                  <input type="checkbox" checked={replaceEnabled} onChange={(e) => setReplaceEnabled(e.target.checked)} />
                  <span>Enable Replace Preview</span>
                </label>

                <div className="toolkitRegexLabRow">
                  <label className="toolkitRegexLabLabel">Replacement</label>
                  <input
                    className="toolkitRegexLabInput toolkitRegexLabMono"
                    type="text"
                    value={replacement}
                    onChange={(e) => setReplacement(e.target.value)}
                    placeholder="Use $1, $<name>, or $& for the match."
                    disabled={!replaceEnabled}
                    spellCheck={false}
                  />
                </div>
              </section>

              <section className="toolkitRegexLabSection">
                <div className="toolkitRegexLabSectionTitle">
                  <FontAwesomeIcon icon={faBook} />
                  Pattern Library
                </div>

                <div className="toolkitRegexLabPresets">
                  {PATTERN_LIBRARY.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      className={`toolkitRegexLabPresetBtn${pattern === preset.pattern ? " active" : ""}`}
                      onClick={() => applyPreset(preset)}
                      title={`/${preset.pattern}/${preset.flags}`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </section>

              <section className="toolkitRegexLabSection">
                <div className="toolkitRegexLabSectionTitle">
                  <FontAwesomeIcon icon={faListOl} />
                  Quick Reference
                </div>

                <div className="toolkitRegexLabReference">
                  {CHEAT_SHEET.map(([tokenText, meaning]) => (
                    <button
                      key={tokenText}
                      type="button"
                      className="toolkitRegexLabReferenceRow"
                      onClick={() => setPattern((previous) => previous + tokenText.replace(/ /g, ""))}
                      title="Append this token to the pattern."
                    >
                      <code>{tokenText}</code>
                      <span>{meaning}</span>
                    </button>
                  ))}
                </div>
              </section>
            </aside>

            <main className="toolkitRegexLabMain">
              <div className="toolkitRegexLabMainGrid">
                <section className="toolkitRegexLabCard toolkitRegexLabCardWide">
                  <div className="toolkitRegexLabCardTitle">
                    <span>Test Text</span>
                    <span className="toolkitRegexLabCardMeta">
                      {testText.length} Characters, {testText ? testText.split("\n").length : 0} Lines
                    </span>
                  </div>
                  <textarea
                    className="toolkitRegexLabTextArea toolkitRegexLabMono"
                    value={testText}
                    onChange={(e) => setTestText(e.target.value)}
                    placeholder="Paste the text you want to search."
                    spellCheck={false}
                  />
                </section>

                <section className="toolkitRegexLabCard toolkitRegexLabCardWide">
                  <div className="toolkitRegexLabCardTitle">
                    <span>
                      <FontAwesomeIcon icon={faHighlighter} /> Highlighted Matches
                    </span>
                    {isRunning && <FontAwesomeIcon icon={faCircleNotch} spin className="toolkitRegexLabSpinner" />}
                  </div>
                  {!testText ? (
                    <div className="toolkitRegexLabEmpty">
                      <FontAwesomeIcon icon={faHighlighter} />
                      <p>Add some test text to see matches highlighted.</p>
                    </div>
                  ) : (
                    <div className="toolkitRegexLabHighlight toolkitRegexLabMono">
                      {segments.map((segment, index) => (segment.match === null ? (
                        <span key={index}>{segment.text}</span>
                      ) : (
                        <mark
                          key={index}
                          className={`toolkitRegexLabMark${segment.match % 2 ? " toolkitRegexLabMarkAlt" : ""}${segment.empty ? " toolkitRegexLabMarkEmpty" : ""}${selectedMatch === segment.match ? " toolkitRegexLabMarkSelected" : ""}`}
                          onClick={() => setSelectedMatch(segment.match)}
                          title={`Match ${segment.match + 1} At Index ${result.matches[segment.match].index}`}
                        >
                          {segment.text}
                        </mark>
                      )))}
                    </div>
                  )}
                  {result.truncated && (
                    <div className="toolkitRegexLabWarningText">
                      Only the first {MATCH_LIMIT} matches are shown.
                    </div>
                  )}
                </section>

                <section className="toolkitRegexLabCard toolkitRegexLabCardWide">
                  <div className="toolkitRegexLabCardTitle">
                    <span>Match Details</span>
                    <div className="toolkitRegexLabCardActions">
                      <button
                        type="button"
                        className="toolkitRegexLabBtn toolkitRegexLabSubtle toolkitRegexLabCardAction"
                        onClick={() => copyText(matchesToCsv(result.matches, groupCount, groupNames))}
                        disabled={!matchCount}
                      >
                        <FontAwesomeIcon icon={faCopy} /> Copy CSV
                      </button>
                      <button
                        type="button"
                        className="toolkitRegexLabBtn toolkitRegexLabSubtle toolkitRegexLabCardAction"
                        onClick={() => downloadTextFile(JSON.stringify(result.matches, null, 2), "regex_matches.json", "application/json")}
                        disabled={!matchCount}
                      >
                        <FontAwesomeIcon icon={faDownload} /> Download JSON
                      </button>
                    </div>
                  </div>
                  {!matchCount ? (
                    <div className="toolkitRegexLabEmpty">
                      <FontAwesomeIcon icon={faListOl} />
                      <p>{errorMessage ? "Fix the pattern to see match details." : "No matches were found."}</p>
                    </div>
                  ) : (
                    <div className="toolkitRegexLabTableWrap">
                      <table className="toolkitRegexLabTable">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Index</th>
                            <th>Match</th>
                            {Array.from({ length: groupCount }, (_, i) => (
                              <th key={`g${i}`}>Group {i + 1}</th>
                            ))}
                            {groupNames.map((name) => (
                              <th key={`n${name}`}>{name}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {result.matches.slice(0, 500).map((match, index) => (
                            <tr
                              key={index}
                              className={selectedMatch === index ? "toolkitRegexLabRowSelected" : ""}
                              onClick={() => setSelectedMatch(index)}
                            >
                              <td>{index + 1}</td>
                              <td>{match.index}</td>
                              <td className="toolkitRegexLabMono">{match.value === "" ? <span className="toolkitRegexLabMuted">Empty</span> : match.value}</td>
                              {Array.from({ length: groupCount }, (_, i) => (
                                <td key={`g${i}`} className="toolkitRegexLabMono">
                                  {match.groups[i] === null ? <span className="toolkitRegexLabMuted">Unmatched</span> : match.groups[i]}
                                </td>
                              ))}
                              {groupNames.map((name) => (
                                <td key={`n${name}`} className="toolkitRegexLabMono">
                                  {match.named && match.named[name] !== undefined ? match.named[name] : <span className="toolkitRegexLabMuted">Unmatched</span>}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section className="toolkitRegexLabCard">
                  <div className="toolkitRegexLabCardTitle">
                    <span>Replace Preview</span>
                    <button
                      type="button"
                      className="toolkitRegexLabBtn toolkitRegexLabSubtle toolkitRegexLabCardAction"
                      onClick={() => copyText(result.replaced || "")}
                      disabled={result.replaced === null}
                    >
                      <FontAwesomeIcon icon={faCopy} /> Copy
                    </button>
                  </div>
                  {result.replaced === null ? (
                    <div className="toolkitRegexLabEmpty">
                      <FontAwesomeIcon icon={faRightLeft} />
                      <p>Enable the replace preview to see the output here.</p>
                    </div>
                  ) : (
                    <pre className="toolkitRegexLabOutput">{result.replaced}</pre>
                  )}
                </section>

                <section className="toolkitRegexLabCard">
                  <div className="toolkitRegexLabCardTitle">
                    <span>
                      <FontAwesomeIcon icon={faCode} /> Code
                    </span>
                    <div className="toolkitRegexLabCardActions">
                      <button
                        type="button"
                        className={`toolkitRegexLabPresetBtn toolkitRegexLabCardAction${snippetLanguage === "javascript" ? " active" : ""}`}
                        onClick={() => setSnippetLanguage("javascript")}
                      >
                        JavaScript
                      </button>
                      <button
                        type="button"
                        className={`toolkitRegexLabPresetBtn toolkitRegexLabCardAction${snippetLanguage === "python" ? " active" : ""}`}
                        onClick={() => setSnippetLanguage("python")}
                      >
                        Python
                      </button>
                    </div>
                  </div>
                  <div className="toolkitRegexLabExportBlock">
                    <div className="toolkitRegexLabExportHeader">
                      <span className="toolkitRegexLabExportTitle">{snippetLanguage === "javascript" ? "JavaScript" : "Python"}</span>
                      <div className="toolkitRegexLabExportActions">
                        <button type="button" className="toolkitRegexLabBtn" onClick={() => copyText(activeSnippet)}>
                          <FontAwesomeIcon icon={faCopy} /> Copy
                        </button>
                      </div>
                    </div>
                    <pre className="toolkitRegexLabCode">{activeSnippet}</pre>
                  </div>
                  <div className="toolkitRegexLabHint">
                    <FontAwesomeIcon icon={faFileExport} />
                    <span>Named groups are converted to Python syntax automatically.</span>
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

export default Regex;