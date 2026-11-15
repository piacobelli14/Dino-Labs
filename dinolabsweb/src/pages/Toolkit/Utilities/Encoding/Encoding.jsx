import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faKey, faSliders, faRightLeft, faEraser, faCopy,
  faDownload, faTriangleExclamation, faFileImport, faXmark, faArrowsRotate,
  faLock, faLockOpen, faFingerprint
} from "@fortawesome/free-solid-svg-icons";
import Nav from "../../../../helpers/Nav.jsx";
import Dropdown from "../../../../helpers/Dropdown.jsx";
import useAuth from "../../../../UseAuth.jsx";
import "../../../../styles/mainStyles/Toolkit/Utilities/Encoding/Encoding.css";
import "../../../../styles/helperStyles/LoadingSpinner.css";

const ENCODING_MODES = [
  { value: "base64", label: "Base64", reversible: true, file: true },
  { value: "base64url", label: "Base64 URL", reversible: true, file: true },
  { value: "url", label: "URL", reversible: true, file: false },
  { value: "html", label: "HTML Entities", reversible: true, file: false },
  { value: "hex", label: "Hex", reversible: true, file: true },
  { value: "binary", label: "Binary", reversible: true, file: false },
  { value: "unicode", label: "Unicode Escapes", reversible: true, file: false },
  { value: "jwt", label: "JWT Decoder", reversible: false, file: false },
  { value: "hash", label: "Hash", reversible: false, file: true },
  { value: "uuid", label: "UUID Generator", reversible: false, file: false }
];

const HASH_ALGORITHMS = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];

const HEX_SEPARATORS = [
  { value: "", label: "None" },
  { value: " ", label: "Space" },
  { value: ":", label: "Colon" }
];

const NAMED_ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: "\u00a0", copy: "©", reg: "®",
  trade: "™", hellip: "…", mdash: "—", ndash: "–", lsquo: "‘", rsquo: "’", ldquo: "“",
  rdquo: "”", deg: "°", plusmn: "±", times: "×", divide: "÷", micro: "µ", middot: "·",
  euro: "€", pound: "£", yen: "¥", cent: "¢", sect: "§", para: "¶", laquo: "«", raquo: "»"
};

const JWT_TIME_CLAIMS = ["exp", "iat", "nbf", "auth_time"];

const textToBytes = (text) => new TextEncoder().encode(text);

const bytesToText = (bytes) => new TextDecoder("utf-8", { fatal: true }).decode(bytes);

const bytesToBase64 = (bytes) => {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
};

const base64ToBytes = (input) => {
  const cleaned = input.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned) || cleaned.length % 4 === 1) {
    throw new Error("The input is not valid Base64.");
  }
  const padded = cleaned + "=".repeat((4 - (cleaned.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const toBase64Url = (base64) => base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const fromBase64Url = (input) => {
  const cleaned = input.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9_-]*={0,2}$/.test(cleaned)) throw new Error("The input is not valid Base64 URL.");
  return base64ToBytes(cleaned.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, ""));
};

const wrapLines = (text, width) => text.replace(new RegExp(`(.{${width}})`, "g"), "$1\n").replace(/\n$/, "");

const decodeBytesOrThrow = (bytes) => {
  try {
    return bytesToText(bytes);
  } catch {
    throw new Error("The decoded bytes are not valid UTF-8 text. Switch to Hex to inspect raw bytes.");
  }
};

const encodeHtml = (text, encodeNonAscii) => {
  let output = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  if (encodeNonAscii) {
    output = Array.from(output).map((char) => {
      const code = char.codePointAt(0);
      return code > 126 ? `&#x${code.toString(16).toUpperCase()};` : char;
    }).join("");
  }
  return output;
};

const decodeHtml = (text) => text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (match, body) => {
  if (body[0] === "#") {
    const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
    return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
  }
  const named = NAMED_ENTITIES[body.toLowerCase()];
  return named === undefined ? match : named;
});

const bytesToHex = (bytes, separator, uppercase) => {
  const parts = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  const joined = parts.join(separator);
  return uppercase ? joined.toUpperCase() : joined;
};

const hexToBytes = (input) => {
  const cleaned = input.replace(/0x/gi, "").replace(/[\s:,-]/g, "");
  if (!/^[0-9a-f]*$/i.test(cleaned)) throw new Error("The input contains characters that are not hexadecimal.");
  if (cleaned.length % 2) throw new Error("Hex input must have an even number of digits.");
  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = parseInt(cleaned.substr(i * 2, 2), 16);
  return bytes;
};

const bytesToBinary = (bytes) => Array.from(bytes, (byte) => byte.toString(2).padStart(8, "0")).join(" ");

const binaryToBytes = (input) => {
  const cleaned = input.replace(/\s+/g, "");
  if (!/^[01]*$/.test(cleaned)) throw new Error("Binary input can only contain 0, 1, and spaces.");
  if (cleaned.length % 8) throw new Error("Binary input must be a multiple of 8 bits.");
  const bytes = new Uint8Array(cleaned.length / 8);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = parseInt(cleaned.substr(i * 8, 8), 2);
  return bytes;
};

const encodeUnicode = (text, escapeAll, braces) => Array.from(text).map((char) => {
  const code = char.codePointAt(0);
  if (!escapeAll && code >= 32 && code <= 126) return char;
  if (braces) return `\\u{${code.toString(16).toUpperCase()}}`;
  if (code > 0xffff) {
    const high = Math.floor((code - 0x10000) / 0x400) + 0xd800;
    const low = ((code - 0x10000) % 0x400) + 0xdc00;
    return `\\u${high.toString(16).toUpperCase()}\\u${low.toString(16).toUpperCase()}`;
  }
  return `\\u${code.toString(16).toUpperCase().padStart(4, "0")}`;
}).join("");

const decodeUnicode = (text) => text
  .replace(/\\u\{([0-9a-f]{1,6})\}/gi, (match, hex) => {
    const code = parseInt(hex, 16);
    return code <= 0x10ffff ? String.fromCodePoint(code) : match;
  })
  .replace(/\\u([0-9a-f]{4})/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
  .replace(/\\x([0-9a-f]{2})/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));

const decodeJwt = (token) => {
  const parts = token.trim().split(".");
  if (parts.length < 2 || parts.length > 3) throw new Error("A JWT must have 2 or 3 dot-separated parts.");
  const parsePart = (part, name) => {
    try {
      return JSON.parse(decodeBytesOrThrow(fromBase64Url(part)));
    } catch {
      throw new Error(`The JWT ${name} is not valid Base64 URL encoded JSON.`);
    }
  };
  const header = parsePart(parts[0], "header");
  const payload = parsePart(parts[1], "payload");
  const now = Date.now() / 1000;
  const claims = JWT_TIME_CLAIMS.filter((claim) => typeof payload[claim] === "number").map((claim) => ({
    claim,
    date: new Date(payload[claim] * 1000).toISOString(),
    relative: payload[claim] - now
  }));
  const expired = typeof payload.exp === "number" ? payload.exp < now : null;
  return { header, payload, claims, expired, signature: parts[2] || "" };
};

const describeRelativeSeconds = (seconds) => {
  const abs = Math.abs(seconds);
  const units = [["Day", 86400], ["Hour", 3600], ["Minute", 60], ["Second", 1]];
  const [unit, size] = units.find(([, length]) => abs >= length) || units[units.length - 1];
  const value = Math.floor(abs / size);
  const label = `${value} ${unit}${value === 1 ? "" : "s"}`;
  return seconds >= 0 ? `In ${label}` : `${label} Ago`;
};

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const transformText = (mode, direction, input, options) => {
  const encode = direction === "encode";
  if (mode === "base64" || mode === "base64url") {
    if (encode) {
      const base64 = bytesToBase64(options.fileBytes || textToBytes(input));
      const output = mode === "base64url" ? toBase64Url(base64) : base64;
      return options.wrap && mode === "base64" ? wrapLines(output, 76) : output;
    }
    const bytes = mode === "base64url" ? fromBase64Url(input) : base64ToBytes(input);
    return decodeBytesOrThrow(bytes);
  }
  if (mode === "url") {
    if (encode) return options.urlComponent ? encodeURIComponent(input) : encodeURI(input);
    try {
      return options.urlComponent ? decodeURIComponent(input.replace(/\+/g, " ")) : decodeURI(input);
    } catch {
      throw new Error("The input contains a malformed percent-encoded sequence.");
    }
  }
  if (mode === "html") return encode ? encodeHtml(input, options.htmlNonAscii) : decodeHtml(input);
  if (mode === "hex") {
    if (encode) return bytesToHex(options.fileBytes || textToBytes(input), options.hexSeparator, options.uppercase);
    return decodeBytesOrThrow(hexToBytes(input));
  }
  if (mode === "binary") return encode ? bytesToBinary(textToBytes(input)) : decodeBytesOrThrow(binaryToBytes(input));
  if (mode === "unicode") return encode ? encodeUnicode(input, options.escapeAll, options.braces) : decodeUnicode(input);
  return "";
};

const hashBytes = async (bytes, algorithm) => {
  const digest = await crypto.subtle.digest(algorithm, bytes);
  return new Uint8Array(digest);
};

const generateUuids = (count, uppercase, hyphens) => Array.from({ length: count }, () => {
  let id = crypto.randomUUID();
  if (!hyphens) id = id.replace(/-/g, "");
  return uppercase ? id.toUpperCase() : id;
});

const SAMPLE_INPUTS = {
  base64: "Participant 0042 — heart rate 72 bpm ✓",
  base64url: "Participant 0042 — heart rate 72 bpm ✓",
  url: "https://example.org/search?q=heart rate&unit=bpm",
  html: "<b>Resting HR</b> < 60 & \"normal\" range",
  hex: "Hello, Nightingale!",
  binary: "Hi",
  unicode: "Temp 37°C ✓ 🧠",
  jwt: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QgVXNlciIsInJvbGUiOiJyZXNlYXJjaGVyIiwiaWF0IjoxNzU4NDAwMDAwLCJleHAiOjQxMDI0NDQ4MDB9.c2lnbmF0dXJl",
  hash: "The quick brown fox jumps over the lazy dog",
  uuid: ""
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

const Encoding = () => {
  const navigate = useNavigate();
  const { token, loading } = useAuth();

  const [mode, setMode] = useState("base64");
  const [direction, setDirection] = useState("encode");
  const [input, setInput] = useState(SAMPLE_INPUTS.base64);
  const [file, setFile] = useState(null);
  const [wrap, setWrap] = useState(false);
  const [urlComponent, setUrlComponent] = useState(true);
  const [htmlNonAscii, setHtmlNonAscii] = useState(false);
  const [hexSeparator, setHexSeparator] = useState(" ");
  const [uppercase, setUppercase] = useState(false);
  const [escapeAll, setEscapeAll] = useState(false);
  const [braces, setBraces] = useState(false);
  const [hashAlgorithm, setHashAlgorithm] = useState("SHA-256");
  const [hashResults, setHashResults] = useState({});
  const [hashError, setHashError] = useState("");
  const [uuidCount, setUuidCount] = useState(5);
  const [uuidUppercase, setUuidUppercase] = useState(false);
  const [uuidHyphens, setUuidHyphens] = useState(true);
  const [uuids, setUuids] = useState(() => generateUuids(5, false, true));
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!loading && !token) navigate("/login");
  }, [token, loading, navigate]);

  const modeOption = ENCODING_MODES.find((option) => option.value === mode);
  const fileAllowed = modeOption.file && (mode === "hash" || direction === "encode");
  const activeFile = fileAllowed ? file : null;

  const transformed = useMemo(() => {
    if (!modeOption.reversible) return { output: "", error: "" };
    try {
      return {
        output: transformText(mode, direction, input, {
          wrap, urlComponent, htmlNonAscii, hexSeparator, uppercase, escapeAll, braces,
          fileBytes: activeFile ? activeFile.bytes : null
        }),
        error: ""
      };
    } catch (error) {
      return { output: "", error: error.message };
    }
  }, [mode, direction, input, wrap, urlComponent, htmlNonAscii, hexSeparator, uppercase, escapeAll, braces, activeFile, modeOption]);

  const jwt = useMemo(() => {
    if (mode !== "jwt" || !input.trim()) return { data: null, error: "" };
    try {
      return { data: decodeJwt(input), error: "" };
    } catch (error) {
      return { data: null, error: error.message };
    }
  }, [mode, input]);

  useEffect(() => {
    if (mode !== "hash") return undefined;
    let cancelled = false;
    const bytes = activeFile ? activeFile.bytes : textToBytes(input);
    Promise.all(HASH_ALGORITHMS.map((algorithm) => hashBytes(bytes, algorithm)))
      .then((digests) => {
        if (cancelled) return;
        const next = {};
        HASH_ALGORITHMS.forEach((algorithm, index) => {
          next[algorithm] = { hex: bytesToHex(digests[index], "", uppercase), base64: bytesToBase64(digests[index]) };
        });
        setHashResults(next);
        setHashError("");
      })
      .catch(() => {
        if (!cancelled) setHashError("Hashing requires a secure context such as HTTPS or localhost.");
      });
    return () => {
      cancelled = true;
    };
  }, [mode, input, activeFile, uppercase]);

  const selectMode = (value) => {
    setMode(value);
    const option = ENCODING_MODES.find((item) => item.value === value);
    if (!option.reversible) setDirection("encode");
    if (!file) setInput(SAMPLE_INPUTS[value]);
  };

  const swap = () => {
    if (!modeOption.reversible || transformed.error) return;
    setInput(transformed.output);
    setDirection((previous) => (previous === "encode" ? "decode" : "encode"));
    setFile(null);
  };

  const loadFile = (event) => {
    const selected = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!selected) return;
    const reader = new FileReader();
    reader.onload = () => {
      setFile({ name: selected.name, size: selected.size, type: selected.type, bytes: new Uint8Array(reader.result) });
    };
    reader.readAsArrayBuffer(selected);
  };

  const outputText = mode === "uuid" ? uuids.join("\n") : mode === "hash" ? (hashResults[hashAlgorithm] ? hashResults[hashAlgorithm].hex : "") : transformed.output;
  const errorMessage = mode === "jwt" ? jwt.error : mode === "hash" ? hashError : transformed.error;
  const inputBytes = activeFile ? activeFile.size : textToBytes(input).length;
  const outputBytes = textToBytes(outputText).length;

  return (
    <div className="toolkitEncodingLabApp">
      <Nav activePage="encoding" />

      {loading ? (
        <div className="toolkitEncodingLabCellHeaderContainer" style={{ justifyContent: "center" }}>
          <div className="loading-wrapper">
            <div className="loading-circle" />
            <label className="loading-title">
              Loading
            </label>
          </div>
        </div>
      ) : (
        <>
          <div className="toolkitEncodingLabToolBar">
            <div className="toolkitEncodingLabTitle">
              <FontAwesomeIcon icon={faKey} />
              <span>Encoding</span>
            </div>

            <div className="toolkitEncodingLabStatusGroup">
              <span className="toolkitEncodingLabStatusItem">
                <span>{modeOption.label}</span>
              </span>
              {modeOption.reversible && (
                <span className="toolkitEncodingLabStatusItem">
                  <FontAwesomeIcon icon={direction === "encode" ? faLock : faLockOpen} />
                  <span>{direction === "encode" ? "Encode" : "Decode"}</span>
                </span>
              )}
              <span className="toolkitEncodingLabStatusItem">
                <span>In {formatBytes(inputBytes)}</span>
              </span>
              <span className="toolkitEncodingLabStatusItem">
                <span>Out {formatBytes(outputBytes)}</span>
              </span>
              <span className={`toolkitEncodingLabStatusItem ${errorMessage ? "toolkitEncodingLabStatusError" : "toolkitEncodingLabStatusAccent"}`}>
                <span>{errorMessage ? "Error" : "Ready"}</span>
              </span>
            </div>
          </div>

          <div className="toolkitEncodingLabShell">
            <aside className="toolkitEncodingLabSidebar">
              <section className="toolkitEncodingLabSection">
                <div className="toolkitEncodingLabSectionTitle">
                  <FontAwesomeIcon icon={faKey} />
                  Format
                </div>

                <div className="toolkitEncodingLabPresets">
                  {ENCODING_MODES.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`toolkitEncodingLabPresetBtn${mode === option.value ? " active" : ""}`}
                      onClick={() => selectMode(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </section>

              {modeOption.reversible && (
                <section className="toolkitEncodingLabSection">
                  <div className="toolkitEncodingLabSectionTitle">
                    <FontAwesomeIcon icon={faRightLeft} />
                    Direction
                  </div>

                  <div className="toolkitEncodingLabPresets">
                    <button
                      type="button"
                      className={`toolkitEncodingLabPresetBtn${direction === "encode" ? " active" : ""}`}
                      onClick={() => setDirection("encode")}
                    >
                      <FontAwesomeIcon icon={faLock} /> Encode
                    </button>
                    <button
                      type="button"
                      className={`toolkitEncodingLabPresetBtn${direction === "decode" ? " active" : ""}`}
                      onClick={() => setDirection("decode")}
                    >
                      <FontAwesomeIcon icon={faLockOpen} /> Decode
                    </button>
                  </div>

                  <div className="toolkitEncodingLabActions">
                    <button type="button" className="toolkitEncodingLabBtn toolkitEncodingLabSubtle" onClick={swap} disabled={!!transformed.error || !transformed.output}>
                      <FontAwesomeIcon icon={faArrowsRotate} /> Use Output As Input
                    </button>
                  </div>
                </section>
              )}

              {(mode === "base64" || mode === "url" || mode === "html" || mode === "hex" || mode === "unicode" || mode === "hash") && (
                <section className="toolkitEncodingLabSection">
                  <div className="toolkitEncodingLabSectionTitle">
                    <FontAwesomeIcon icon={faSliders} />
                    Options
                  </div>

                  {mode === "base64" && (
                    <label className="toolkitEncodingLabCheckbox">
                      <input type="checkbox" checked={wrap} onChange={(e) => setWrap(e.target.checked)} disabled={direction !== "encode"} />
                      <span>Wrap Lines At 76 Characters</span>
                    </label>
                  )}

                  {mode === "url" && (
                    <div className="toolkitEncodingLabPresets">
                      <button type="button" className={`toolkitEncodingLabPresetBtn${urlComponent ? " active" : ""}`} onClick={() => setUrlComponent(true)} title="Encodes reserved characters such as / ? & =.">
                        Component
                      </button>
                      <button type="button" className={`toolkitEncodingLabPresetBtn${!urlComponent ? " active" : ""}`} onClick={() => setUrlComponent(false)} title="Keeps the URL structure intact.">
                        Full URL
                      </button>
                    </div>
                  )}

                  {mode === "html" && (
                    <label className="toolkitEncodingLabCheckbox">
                      <input type="checkbox" checked={htmlNonAscii} onChange={(e) => setHtmlNonAscii(e.target.checked)} disabled={direction !== "encode"} />
                      <span>Encode Non-ASCII Characters</span>
                    </label>
                  )}

                  {mode === "hex" && (
                    <div className="toolkitEncodingLabRow">
                      <label className="toolkitEncodingLabLabel">Byte Separator</label>
                      <div className="toolkitEncodingLabPresets toolkitEncodingLabPresetsThirds">
                        {HEX_SEPARATORS.map((option) => (
                          <button
                            key={option.label}
                            type="button"
                            className={`toolkitEncodingLabPresetBtn${hexSeparator === option.value ? " active" : ""}`}
                            onClick={() => setHexSeparator(option.value)}
                            disabled={direction !== "encode"}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {(mode === "hex" || mode === "hash") && (
                    <label className="toolkitEncodingLabCheckbox">
                      <input type="checkbox" checked={uppercase} onChange={(e) => setUppercase(e.target.checked)} />
                      <span>Uppercase Hex</span>
                    </label>
                  )}

                  {mode === "unicode" && (
                    <>
                      <label className="toolkitEncodingLabCheckbox">
                        <input type="checkbox" checked={escapeAll} onChange={(e) => setEscapeAll(e.target.checked)} disabled={direction !== "encode"} />
                        <span>Escape Every Character</span>
                      </label>
                      <label className="toolkitEncodingLabCheckbox">
                        <input type="checkbox" checked={braces} onChange={(e) => setBraces(e.target.checked)} disabled={direction !== "encode"} />
                        <span>Use Code Point Braces</span>
                      </label>
                    </>
                  )}

                  {mode === "hash" && (
                    <div className="toolkitEncodingLabRow">
                      <label className="toolkitEncodingLabLabel">Primary Algorithm</label>
                      <Dropdown
                        value={hashAlgorithm}
                        onChange={(option) => setHashAlgorithm(option)}
                        options={HASH_ALGORITHMS}
                        placeholder="Primary Algorithm"
                      />
                    </div>
                  )}
                </section>
              )}

              {mode === "uuid" && (
                <section className="toolkitEncodingLabSection">
                  <div className="toolkitEncodingLabSectionTitle">
                    <FontAwesomeIcon icon={faFingerprint} />
                    Generator
                  </div>

                  <div className="toolkitEncodingLabRow">
                    <div className="toolkitEncodingLabRowHeader">
                      <label className="toolkitEncodingLabLabel">Count</label>
                      <span className="toolkitEncodingLabValue">{uuidCount}</span>
                    </div>
                    <input type="range" min="1" max="100" step="1" value={uuidCount} onChange={(e) => setUuidCount(Number(e.target.value))} />
                  </div>

                  <label className="toolkitEncodingLabCheckbox">
                    <input type="checkbox" checked={uuidUppercase} onChange={(e) => setUuidUppercase(e.target.checked)} />
                    <span>Uppercase</span>
                  </label>

                  <label className="toolkitEncodingLabCheckbox">
                    <input type="checkbox" checked={uuidHyphens} onChange={(e) => setUuidHyphens(e.target.checked)} />
                    <span>Include Hyphens</span>
                  </label>

                  <div className="toolkitEncodingLabActions">
                    <button type="button" className="toolkitEncodingLabBtn" onClick={() => setUuids(generateUuids(uuidCount, uuidUppercase, uuidHyphens))}>
                      <FontAwesomeIcon icon={faArrowsRotate} /> Generate
                    </button>
                  </div>
                </section>
              )}

              {fileAllowed && (
                <section className="toolkitEncodingLabSection">
                  <div className="toolkitEncodingLabSectionTitle">
                    <FontAwesomeIcon icon={faFileImport} />
                    File
                  </div>

                  <input ref={fileInputRef} type="file" className="toolkitEncodingLabFileInput" onChange={loadFile} />

                  {file ? (
                    <div className="toolkitEncodingLabFileChip">
                      <span className="toolkitEncodingLabFileName">{file.name}</span>
                      <span className="toolkitEncodingLabFileSize">{formatBytes(file.size)}</span>
                      <button type="button" className="toolkitEncodingLabIconBtn" onClick={() => setFile(null)} title="Remove File">
                        <FontAwesomeIcon icon={faXmark} />
                      </button>
                    </div>
                  ) : (
                    <div className="toolkitEncodingLabActions">
                      <button type="button" className="toolkitEncodingLabBtn toolkitEncodingLabSubtle" onClick={() => fileInputRef.current && fileInputRef.current.click()}>
                        <FontAwesomeIcon icon={faFileImport} /> Choose File
                      </button>
                    </div>
                  )}
                </section>
              )}
            </aside>

            <main className="toolkitEncodingLabMain">
              <div className="toolkitEncodingLabMainGrid">
                {mode !== "uuid" && (
                  <section className="toolkitEncodingLabCard">
                    <div className="toolkitEncodingLabCardTitle">
                      <span>Input</span>
                      <div className="toolkitEncodingLabCardActions">
                        <button
                          type="button"
                          className="toolkitEncodingLabBtn toolkitEncodingLabSubtle toolkitEncodingLabCardAction"
                          onClick={() => {
                            setInput("");
                            setFile(null);
                          }}
                        >
                          <FontAwesomeIcon icon={faEraser} /> Clear
                        </button>
                      </div>
                    </div>
                    {activeFile ? (
                      <div className="toolkitEncodingLabEmpty">
                        <FontAwesomeIcon icon={faFileImport} />
                        <p>{`Using ${activeFile.name} (${formatBytes(activeFile.size)}) as the input.`}</p>
                      </div>
                    ) : (
                      <textarea
                        className="toolkitEncodingLabTextArea toolkitEncodingLabMono"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={mode === "jwt" ? "Paste a JSON Web Token." : direction === "encode" ? "Enter text to encode." : "Enter text to decode."}
                        spellCheck={false}
                      />
                    )}
                  </section>
                )}

                {mode === "jwt" ? (
                  <section className="toolkitEncodingLabCard">
                    <div className="toolkitEncodingLabCardTitle">
                      <span>Decoded Token</span>
                      {jwt.data && jwt.data.expired !== null && (
                        <span className={`toolkitEncodingLabBadge ${jwt.data.expired ? "bad" : "good"}`}>
                          {jwt.data.expired ? "Expired" : "Active"}
                        </span>
                      )}
                    </div>
                    {jwt.error ? (
                      <div className="toolkitEncodingLabEmpty toolkitEncodingLabError">
                        <FontAwesomeIcon icon={faTriangleExclamation} />
                        <p>{jwt.error}</p>
                      </div>
                    ) : !jwt.data ? (
                      <div className="toolkitEncodingLabEmpty">
                        <FontAwesomeIcon icon={faKey} />
                        <p>Paste a token to see its header and payload.</p>
                      </div>
                    ) : (
                      <>
                        <div className="toolkitEncodingLabExportBlock">
                          <div className="toolkitEncodingLabExportHeader">
                            <span className="toolkitEncodingLabExportTitle">Header</span>
                            <div className="toolkitEncodingLabExportActions">
                              <button type="button" className="toolkitEncodingLabBtn" onClick={() => copyText(JSON.stringify(jwt.data.header, null, 2))}>
                                <FontAwesomeIcon icon={faCopy} /> Copy
                              </button>
                            </div>
                          </div>
                          <pre className="toolkitEncodingLabCode">{JSON.stringify(jwt.data.header, null, 2)}</pre>
                        </div>
                        <div className="toolkitEncodingLabExportBlock">
                          <div className="toolkitEncodingLabExportHeader">
                            <span className="toolkitEncodingLabExportTitle">Payload</span>
                            <div className="toolkitEncodingLabExportActions">
                              <button type="button" className="toolkitEncodingLabBtn" onClick={() => copyText(JSON.stringify(jwt.data.payload, null, 2))}>
                                <FontAwesomeIcon icon={faCopy} /> Copy
                              </button>
                            </div>
                          </div>
                          <pre className="toolkitEncodingLabCode">{JSON.stringify(jwt.data.payload, null, 2)}</pre>
                        </div>
                        {jwt.data.claims.length > 0 && (
                          <div className="toolkitEncodingLabClaimList">
                            {jwt.data.claims.map((claim) => (
                              <div key={claim.claim} className="toolkitEncodingLabClaimRow">
                                <span className="toolkitEncodingLabClaimName">{claim.claim}</span>
                                <span className="toolkitEncodingLabClaimDate">{claim.date}</span>
                                <span className="toolkitEncodingLabClaimRelative">{describeRelativeSeconds(claim.relative)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="toolkitEncodingLabHint">
                          <FontAwesomeIcon icon={faTriangleExclamation} />
                          <span>The signature is shown but not verified, since verification needs the signing key.</span>
                        </div>
                      </>
                    )}
                  </section>
                ) : mode === "hash" ? (
                  <section className="toolkitEncodingLabCard">
                    <div className="toolkitEncodingLabCardTitle">Digests</div>
                    {hashError ? (
                      <div className="toolkitEncodingLabEmpty toolkitEncodingLabError">
                        <FontAwesomeIcon icon={faTriangleExclamation} />
                        <p>{hashError}</p>
                      </div>
                    ) : (
                      <div className="toolkitEncodingLabDigestList">
                        {HASH_ALGORITHMS.map((algorithm) => (
                          <div key={algorithm} className={`toolkitEncodingLabDigest${algorithm === hashAlgorithm ? " toolkitEncodingLabDigestActive" : ""}`}>
                            <div className="toolkitEncodingLabDigestHeader">
                              <span className="toolkitEncodingLabDigestName">{algorithm}</span>
                              <button
                                type="button"
                                className="toolkitEncodingLabIconBtn"
                                onClick={() => hashResults[algorithm] && copyText(hashResults[algorithm].hex)}
                                title="Copy Hex Digest"
                              >
                                <FontAwesomeIcon icon={faCopy} />
                              </button>
                            </div>
                            <span className="toolkitEncodingLabDigestValue toolkitEncodingLabMono">{hashResults[algorithm] ? hashResults[algorithm].hex : "…"}</span>
                            <span className="toolkitEncodingLabDigestAlt toolkitEncodingLabMono">{hashResults[algorithm] ? hashResults[algorithm].base64 : ""}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                ) : (
                  <section className={`toolkitEncodingLabCard${mode === "uuid" ? " toolkitEncodingLabCardWide" : ""}`}>
                    <div className="toolkitEncodingLabCardTitle">
                      <span>{mode === "uuid" ? "UUIDs" : "Output"}</span>
                      <div className="toolkitEncodingLabCardActions">
                        <button
                          type="button"
                          className="toolkitEncodingLabBtn toolkitEncodingLabSubtle toolkitEncodingLabCardAction"
                          onClick={() => copyText(outputText)}
                          disabled={!outputText}
                        >
                          <FontAwesomeIcon icon={faCopy} /> Copy
                        </button>
                        <button
                          type="button"
                          className="toolkitEncodingLabBtn toolkitEncodingLabCardAction"
                          onClick={() => downloadTextFile(outputText, `${mode}_${direction}.txt`, "text/plain")}
                          disabled={!outputText}
                        >
                          <FontAwesomeIcon icon={faDownload} /> Download
                        </button>
                      </div>
                    </div>
                    {errorMessage ? (
                      <div className="toolkitEncodingLabEmpty toolkitEncodingLabError">
                        <FontAwesomeIcon icon={faTriangleExclamation} />
                        <p>{errorMessage}</p>
                      </div>
                    ) : (
                      <pre className="toolkitEncodingLabOutput toolkitEncodingLabMono">{outputText || " "}</pre>
                    )}
                  </section>
                )}
              </div>
            </main>
          </div>
        </>
      )}
    </div>
  );
};

export default Encoding;