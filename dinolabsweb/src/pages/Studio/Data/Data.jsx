import * as XLSX from "xlsx";
import React, { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { VariableSizeGrid, FixedSizeGrid } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import "../../../styles/mainStyles/Studio/Data/Data.css";
import { showDialog } from "../../../helpers/Alert.jsx";
import Dropdown from "../../../helpers/Dropdown.jsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRightFromBracket, faFilter, faSquareMinus, faSquarePlus, faSave, faDownload, faUndo, faRedo,
  faCut, faCopy, faPaste, faArrowPointer, faSearch, faSortAlphaDown, faSortAlphaUp,
  faSortNumericDown, faSortNumericUp, faTableCells, faTrash, faCalculator, faCheckCircle,
  faAnglesUp, faAnglesDown, faAnglesLeft, faAnglesRight, faLocationCrosshairs,
  faRulerCombined, faHashtag, faPrint, faRotate, faCircleInfo, faXmark
} from "@fortawesome/free-solid-svg-icons";
const MAX_ADD_AT_ONCE = 10000;
const DEFAULT_ROW_HEIGHT = 24;
const DEFAULT_COL_WIDTH = 120;
const SAVE_BANNER_TIMEOUT_MS = 3000;
const isMacPlatform = () => navigator.platform.toUpperCase().includes("MAC");
const isCellInput = el => el?.classList?.contains("dataTableCellInput");
const clampNum = (v, lo, hi) => Math.max(lo, Math.min(v, hi));
const toKey = (r, c) => `${r},${c}`;
const fromKey = (key) => {
    const comma = key.indexOf(",");

    return [Number(key.slice(0, comma)), Number(key.slice(comma + 1))];
};
const IMPORT_CHUNK_BYTES = 8 * 1024 * 1024;
const PRINT_ROW_LIMIT = 2000;
const SUMMARY_CELL_LIMIT = 200000;
const SUMMARY_UNIQUE_LIMIT = 50000;
const SUMMARY_MEDIAN_SAMPLE = 200000;
const RANGE_STATS_DEBOUNCE_MS = 400;
const CSV_DIFF_ROW_LIMIT = 5000;
const DRAG_COMMIT_THRESHOLD_PX = 4;
const JUMP_GROWTH_LOCK_MS = 400;
const SCROLL_SETTLE_MS = 400;
const RANGE_SCAN_CELL_LIMIT = 2000000;
const OVERLAY_INTERACTIVE_MAX_CELLS = 40000;
const OVERLAY_EDGE_BLEED_PX = 400;
const DELIMITED_EXTENSIONS = {
    csv: ",",
    tsv: "\t",
    tab: "\t",
    psv: "|"
};
const WORKBOOK_EXTENSIONS = ["xlsx", "xlsm", "xlsb", "xls", "ods", "fods", "numbers", "dbf", "prn", "dif", "slk"];
const WORKBOOK_WRITE_TYPES = {
    xlsx: "xlsx",
    xlsm: "xlsm",
    xlsb: "xlsb",
    xls: "biff8",
    ods: "ods",
    fods: "fods",
    dbf: "dbf",
    prn: "prn",
    dif: "dif",
    slk: "sylk"
};
const EXPORT_FORMATS = [
    { label: "Comma Separated Values (.csv)", value: "csv", kind: "text" },
    { label: "Tab Separated Values (.tsv)", value: "tsv", kind: "text" },
    { label: "Pipe Separated Values (.psv)", value: "psv", kind: "text" },
    { label: "JSON Records (.json)", value: "json", kind: "text" },
    { label: "Markdown Table (.md)", value: "md", kind: "text" },
    { label: "Excel Workbook (.xlsx)", value: "xlsx", kind: "book" },
    { label: "Excel Binary Workbook (.xlsb)", value: "xlsb", kind: "book" },
    { label: "OpenDocument Spreadsheet (.ods)", value: "ods", kind: "book" },
    { label: "Web Page (.html)", value: "html", kind: "book" }
];
const CSV_CHUNK_CHARS = 1024 * 1024;
const FILTER_OPTION_LIMIT = 500;
const GROWTH_TRIGGER_PX = 600;
const ROW_GROWTH_STEP = 200;
const COL_GROWTH_STEP = 20;

function splitDelimitedLine(line, delimiter) {
    if (line.indexOf("\"") === -1) {
        return line.split(delimiter).map((cell) => cell.trim());
    }

    const cells = [];

    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (inQuotes) {
            if (char === "\"") {
                if (line[i + 1] === "\"") {
                    current += "\"";
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                current += char;
            }

            continue;
        }

        if (char === "\"") {
            inQuotes = true;
            continue;
        }

        if (char === delimiter) {
            cells.push(current.trim());
            current = "";
            continue;
        }

        current += char;
    }

    cells.push(current.trim());

    return cells;
}

function splitDelimitedRaw(line, delimiter) {
    const out = [];

    let start = 0;
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === "\"") {
            inQuotes = !inQuotes;
            continue;
        }

        if (!inQuotes && char === delimiter) {
            out.push(line.slice(start, i));
            start = i + 1;
        }
    }

    out.push(line.slice(start));

    return out;
}

function encodeDelimitedCell(value, delimiter) {
    const text = value === null || value === undefined ? "" : String(value);

    if (delimiter !== ",") return text.replace(/[\t|\r\n]/g, " ");

    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function lineHoldsRow(line, delimiter) {
    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char !== delimiter && char !== "\r") return true;
    }

    return false;
}

const ANCHOR_INTERVAL = 64;
const WINDOW_ROWS = 512;
const MAX_RESIDENT_WINDOWS = 24;
const RANGE_SCAN_DEBOUNCE_MS = 350;
const EMPTY_ROWS = [];
const ROW_HEADER_OVERSCAN = 12;
const ROW_HEADER_STEP = 4;
const PARTIAL_STATS_INTERVAL_MS = 400;
const SCAN_CHUNK_BYTES = 8 * 1024 * 1024;

function colFromLabel(lbl) { let n = 0; for (let i = 0; i < lbl.length; i++) n = n * 26 + (lbl.charCodeAt(i) - 64); return n - 1; }

function getColumnLabel(colIndex) {
  let label = "", n = colIndex + 1;
  while (n > 0) { n--; label = String.fromCharCode(65 + (n % 26)) + label; n = Math.floor(n / 26); }
  return label;
}

const a1FromRC = (r, c) => `${getColumnLabel(c)}${r + 1}`;

function rcFromA1(ref) { const m = /^([A-Z]+)(\d+)$/.exec(ref.toUpperCase()); if (!m) return null; const col = colFromLabel(m[1]); const row = parseInt(m[2], 10) - 1; if (row < 0 || col < 0) return null; return { row, col }; }

function clampPosition(rect, width = 240, height = 280, offset = 6) {
  let top = rect.bottom + offset, left = rect.left;
  if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
  if (top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - offset);
  return { top, left };
}

function idxFromCumulative(cumulative, pos) { if (pos <= 0) return 0; const total = cumulative[cumulative.length - 1]; if (pos >= total) return cumulative.length - 2; let lo = 0, hi = cumulative.length - 1; while (lo < hi) { const mid = (lo + hi) >> 1; cumulative[mid] <= pos ? (lo = mid + 1) : (hi = mid); } return Math.max(0, lo - 1); }

function idxFromCumulativeExtend(cumulative, pos, defaultSize) { if (pos <= 0) return 0; const total = cumulative[cumulative.length - 1]; if (pos < total) return idxFromCumulative(cumulative, pos); const extra = Math.ceil((pos - total) / defaultSize); return cumulative.length - 2 + Math.max(0, extra); }

function parseBind(str) { if (!str) return null; const parts = String(str).trim().toLowerCase().split("+").map(p => p.trim()); const spec = { key: null, shift: false }; for (const p of parts) { if (p === "shift") spec.shift = true; else if (p) spec.key = p; } return spec.key ? spec : null; }

function matchBind(e, spec, isMac) { if (!spec) return false; const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey; return !!cmdOrCtrl && (!!spec.shift === !!e.shiftKey) && e.key.toLowerCase() === spec.key; }

function areCellPropsEqual(prev, next) {
  if (prev.rowIndex !== next.rowIndex || prev.columnIndex !== next.columnIndex) return false;
  if (prev.data !== next.data) return false;

  const a = prev.style;
  const b = next.style;

  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;
}

const CELL_INNER_STYLE = {
  userSelect: "none",
  WebkitUserSelect: "none",
  MozUserSelect: "none",
  width: "100%",
  height: "100%",
  cursor: "default",
  paddingLeft: "4px",
  paddingRight: "4px",
  display: "flex",
  alignItems: "center",
  minHeight: "100%",
  boxSizing: "border-box"
};

const normalizedBindCache = new WeakMap();
let defaultNormalizedBinds = null;

function normalizeBinds(keyBinds) {
  if (!keyBinds) {
    if (!defaultNormalizedBinds) defaultNormalizedBinds = buildNormalizedBinds(null);
    return defaultNormalizedBinds;
  }

  const cached = normalizedBindCache.get(keyBinds);

  if (cached) return cached;

  const built = buildNormalizedBinds(keyBinds);

  normalizedBindCache.set(keyBinds, built);

  return built;
}

function buildNormalizedBinds(keyBinds) {
  const d = { search: "f", save: "s", selectAll: "a", cut: "x", copy: "c", paste: "v", undo: "z", redo: null };
  const m = { ...d, ...(keyBinds || {}) };
  const one = k => [parseBind(m[k])].filter(Boolean);
  return { search: one("search"), save: one("save"), selectAll: one("selectAll"), cut: one("cut"), copy: one("copy"), paste: one("paste"), undo: one("undo"), redo: m.redo ? one("redo") : [parseBind("y"), parseBind("shift+z")].filter(Boolean) };
}

const bindLabel = (spec) => {
  if (!spec || !spec.key) return "";

  const modifier = isMacPlatform() ? "\u2318" : "Ctrl+";
  const shift = spec.shift ? "\u21e7" : "";

  return `${modifier}${shift}${spec.key.toUpperCase()}`;
};

const attachPopover = (ref) => (node) => {
  ref.current = node;

  if (!node || typeof node.showPopover !== "function") return;

  try {
    if (!node.matches(":popover-open")) node.showPopover();
  } catch { }
};

const stopAll = e => { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.(); };

function tokenizeFormula(src) {
  const s = src.replace(/^\s*=/, "");
  const tokens = [];
  let i = 0;
  const isLetter = ch => /[A-Za-z]/.test(ch);
  const isDigit = ch => /[0-9]/.test(ch);
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { i++; continue; }
    if ("+-*/^(),".includes(ch)) { tokens.push({ t: ch }); i++; continue; }
    if (ch === ":") { tokens.push({ t: ":" }); i++; continue; }
    if (isDigit(ch) || (ch === "." && isDigit(s[i + 1]))) {
      let j = i + 1; while (j < s.length && /[0-9.]/.test(s[j])) j++;
      tokens.push({ t: "num", v: parseFloat(s.slice(i, j)) }); i = j; continue;
    }
    if (isLetter(ch)) {
      let j = i + 1; while (j < s.length && /[A-Za-z]/.test(s[j])) j++;
      const head = s.slice(i, j);
      let k = j; while (k < s.length && isDigit(s[k])) k++;
      if (k > j) { tokens.push({ t: "a1start", v: head }); tokens.push({ t: "rownum", v: parseInt(s.slice(j, k), 10) }); i = k; continue; }
      else { tokens.push({ t: "ident", v: head.toUpperCase() }); i = j; continue; }
    }
    tokens.push({ t: "?" }); i++;
  }
  return tokens;
}

function toRPN(tokens) {
  const out = [], ops = [], funcArgCount = [];
  const prec = { "^": 4, "*": 3, "/": 3, "+": 2, "-": 2 }, rightAssoc = { "^": true };
  const pushOp = (op) => { while (ops.length) { const top = ops[ops.length - 1]; if (top.t === "(" || top.t === "func") break; const pTop = prec[top.t] || 0, pOp = prec[op.t] || 0; if (pTop > pOp || (pTop === pOp && !rightAssoc[op.t])) out.push(ops.pop()); else break; } ops.push(op); };
  const stream = [];
  for (let i = 0; i < tokens.length; i++) { const t = tokens[i]; if (t.t === "a1start" && tokens[i + 1]?.t === "rownum") { stream.push(makeRefToken(t.v, tokens[i + 1].v)); i++; } else stream.push(t); }
  for (let i = 0; i < stream.length; i++) {
    const t = stream[i];
    if (t.t === "ref" && stream[i + 1]?.t === ":" && stream[i + 2]?.t === "ref") { out.push({ t: "range", v: { start: t.v, end: stream[i + 2].v } }); i += 2; continue; }
    if (t.t === "num" || t.t === "ref" || t.t === "range") { out.push(t); continue; }
    if (t.t === "ident") { if (stream[i + 1]?.t === "(") { ops.push({ t: "func", v: t.v }); funcArgCount.push(0); } else { out.push({ t: "err", v: "#NAME?" }); } continue; }
    if (t.t === ",") { while (ops.length && ops[ops.length - 1].t !== "(") out.push(ops.pop()); if (funcArgCount.length) funcArgCount[funcArgCount.length - 1]++; continue; }
    if (t.t === "(") { ops.push(t); continue; }
    if (t.t === ")") { while (ops.length && ops[ops.length - 1].t !== "(") out.push(ops.pop()); if (ops.length && ops[ops.length - 1].t === "(") ops.pop(); if (ops.length && ops[ops.length - 1].t === "func") { const fn = ops.pop(); const nCommas = funcArgCount.pop() || 0; const argc = (stream[i - 1]?.t === "(") ? 0 : (nCommas + 1); out.push({ t: "call", v: fn.v, argc }); } continue; }
    if ("+-*/^".includes(t.t)) { pushOp(t); continue; }
    out.push({ t: "err", v: "#ERROR" });
  }
  while (ops.length) { const op = ops.pop(); if (op.t === "(") { out.push({ t: "err", v: "#ERROR" }); continue; } out.push(op); }
  return out;
}

function makeRefToken(colLabel, rowNumber) { const rc = rcFromA1(`${colLabel}${rowNumber}`); if (!rc) return { t: "err", v: "#REF!" }; return { t: "ref", v: rc }; }

function makeSheetStore(rows, sheetNames, activeSheet) {
    let colCount = 0;

    for (let r = 0; r < rows.length; r++) {
        if (rows[r] && rows[r].length > colCount) colCount = rows[r].length;
    }

    return {
        kind: "sheet",
        file: null,
        delimiter: ",",
        anchors: null,
        anchorCount: 0,
        rows,
        rowCount: rows.length,
        colCount,
        windows: new Map(),
        windowOrder: [],
        pending: new Map(),
        overlay: {},
        sheetNames,
        activeSheet
    };
}

function sheetToRows(sheet) {
    if (!sheet) return [];

    const grid = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: false,
        defval: "",
        blankrows: true
    });

    for (let r = 0; r < grid.length; r++) {
        const row = grid[r];

        if (!row) {
            grid[r] = [];
            continue;
        }

        for (let c = 0; c < row.length; c++) {
            if (row[c] === null || row[c] === undefined) row[c] = "";
            else if (typeof row[c] !== "string") row[c] = String(row[c]);
        }
    }

    while (grid.length && grid[grid.length - 1].every((v) => v === "")) grid.pop();

    return grid;
}

function makeFileStore() {
    return {
        kind: "csv",
        rows: null,
        sheetNames: [],
        activeSheet: null,
        file: null,
        delimiter: ",",
        anchors: null,
        anchorCount: 0,
        rowCount: 0,
        colCount: 0,
        windows: new Map(),
        windowOrder: [],
        pending: new Map(),
        overlay: {},
    };
}

function growAnchors(store) {
    if (!store.anchors) {
        store.anchors = new Float64Array(1024);
        return;
    }

    if (store.anchorCount < store.anchors.length) {
        return;
    }

    const next = new Float64Array(store.anchors.length * 2);

    next.set(store.anchors);

    store.anchors = next;
}

function pushAnchor(store, byteOffset) {
    growAnchors(store);
    store.anchors[store.anchorCount++] = byteOffset;
}

async function indexFile(store, file, delimiter, onProgress, shouldStop) {
    store.file = file;
    store.delimiter = delimiter;
    store.anchors = null;
    store.anchorCount = 0;
    store.rowCount = 0;
    store.colCount = 0;

    const newline = 10;
    const quote = 34;
    const delimiterByte = delimiter.charCodeAt(0);

    let offset = 0;
    let cellsInRow = 1;
    let sawContent = false;
    let inQuotes = false;
    let lastPercent = -1;

    pushAnchor(store, 0);

    while (offset < file.size) {
        if (shouldStop && shouldStop()) {
            return;
        }

        const buffer = await file.slice(offset, offset + SCAN_CHUNK_BYTES).arrayBuffer();
        const bytes = new Uint8Array(buffer);

        for (let i = 0; i < bytes.length; i++) {
            const byte = bytes[i];

            if (byte === quote) {
                inQuotes = !inQuotes;
                sawContent = true;
                continue;
            }

            if (inQuotes) {
                sawContent = true;
                continue;
            }

            if (byte === delimiterByte) {
                cellsInRow++;
                continue;
            }

            if (byte !== newline) {
                if (byte !== 13) sawContent = true;
                continue;
            }

            if (sawContent) {
                store.rowCount++;

                if (cellsInRow > store.colCount) store.colCount = cellsInRow;

                if (store.rowCount % ANCHOR_INTERVAL === 0) {
                    pushAnchor(store, offset + i + 1);
                }
            }

            cellsInRow = 1;
            sawContent = false;
        }

        offset += SCAN_CHUNK_BYTES;

        const percent = Math.min(99, Math.round((offset / file.size) * 100));

        if (onProgress && percent !== lastPercent) {
            lastPercent = percent;
            onProgress(percent);
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
    }

    if (sawContent) {
        store.rowCount++;

        if (cellsInRow > store.colCount) store.colCount = cellsInRow;
    }
}

function storeHasData(store) {
    if (!store) return false;

    return store.kind === "sheet" ? Array.isArray(store.rows) : Boolean(store.file);
}

function makeEmptyStats() {
    return {
        totalCells: 0,
        nullCount: 0,
        naCount: 0,
        numericCount: 0,
        sum: 0,
        min: Infinity,
        max: -Infinity,
        sample: [],
        unique: new Set(),
        complete: false
    };
}

async function computeFileStats(store, onProgress, shouldStop) {
    if (store.kind === "sheet") {
        const stats = makeEmptyStats();

        for (let r = 0; r < store.rows.length; r++) {
            if (shouldStop && shouldStop()) return stats;

            accumulateRow(stats, store.rows[r] || []);

            if (r % 20000 === 0) {
                if (onProgress) onProgress(Math.min(99, Math.round((r / Math.max(1, store.rows.length)) * 100)), stats);
                await new Promise((resolve) => setTimeout(resolve, 0));
            }
        }

        stats.complete = true;

        return stats;
    }

    const stats = makeEmptyStats();

    if (!store.file) {
        return stats;
    }

    const decoder = new TextDecoder("utf-8");

    let offset = 0;
    let carry = "";

    while (offset < store.file.size) {
        if (shouldStop && shouldStop()) {
            return stats;
        }

        const buffer = await store.file.slice(offset, offset + SCAN_CHUNK_BYTES).arrayBuffer();
        const chunk = carry + decoder.decode(new Uint8Array(buffer));
        const lines = chunk.split(/\r?\n/);

        carry = lines.pop() ?? "";

        for (let i = 0; i < lines.length; i++) {
            accumulateRow(stats, splitDelimitedLine(lines[i], store.delimiter));
        }

        offset += SCAN_CHUNK_BYTES;

        if (onProgress) {
            onProgress(Math.min(99, Math.round((offset / store.file.size) * 100)), stats);
        }

        await new Promise((resolve) => setTimeout(resolve, 0));
    }

    if (carry.trim() !== "") {
        accumulateRow(stats, splitDelimitedLine(carry, store.delimiter));
    }

    stats.complete = true;

    return stats;
}

function accumulateRow(stats, cells) {
    for (let c = 0; c < cells.length; c++) {
        const value = cells[c];

        stats.totalCells++;

        if (stats.unique.size < SUMMARY_UNIQUE_LIMIT) {
            stats.unique.add(value);
        }

        if (value === "") {
            stats.nullCount++;
            continue;
        }

        if (value.length < 8) {
            const lowered = value.toLowerCase();

            if (lowered === "n/a" || lowered === "null" || lowered === "na" || lowered === "nan") {
                stats.naCount++;
                continue;
            }
        }

        const num = Number(value);

        if (Number.isFinite(num)) {
            stats.numericCount++;
            stats.sum += num;

            if (num < stats.min) stats.min = num;
            if (num > stats.max) stats.max = num;

            if (stats.sample.length < SUMMARY_MEDIAN_SAMPLE) {
                stats.sample.push(num);
            }
        }
    }
}

function anchorForRow(store, row) {
    const index = Math.min(Math.floor(row / ANCHOR_INTERVAL), Math.max(0, store.anchorCount - 1));

    return { byteOffset: store.anchors[index], firstRow: index * ANCHOR_INTERVAL };
}

function windowIndexForRow(row) {
    return Math.floor(row / WINDOW_ROWS);
}

async function readRowsUncached(store, firstRow, lastRow) {
    if (store.kind === "sheet") {
        const out = [];
        const end = Math.min(lastRow, store.rows.length - 1);

        for (let r = Math.max(0, firstRow); r <= end; r++) out.push([r, store.rows[r] || []]);

        return out;
    }

    const anchor = anchorForRow(store, firstRow);
    const neededAnchor = Math.ceil((lastRow + 1 + ANCHOR_INTERVAL) / ANCHOR_INTERVAL);
    const endByte = neededAnchor < store.anchorCount && store.anchors[neededAnchor] > anchor.byteOffset
        ? store.anchors[neededAnchor]
        : store.file.size;

    const text = await store.file.slice(anchor.byteOffset, endByte).text();
    const lines = text.split(/\r?\n/);
    const out = [];

    for (let i = 0; i < lines.length; i++) {
        const rowIndex = anchor.firstRow + i;

        if (rowIndex >= firstRow && rowIndex <= lastRow) {
            out.push([rowIndex, splitDelimitedLine(lines[i], store.delimiter)]);
        }
    }

    return out;
}

function loadWindow(store, startRow) {
    if (store.kind === "sheet") return Promise.resolve();

    const windowIndex = windowIndexForRow(startRow);

    if (store.windows.has(windowIndex)) {
        return Promise.resolve();
    }

    const inFlight = store.pending.get(windowIndex);

    if (inFlight) {
        return inFlight;
    }

    const run = fetchWindow(store, windowIndex).finally(() => {
        store.pending.delete(windowIndex);
    });

    store.pending.set(windowIndex, run);

    return run;
}

async function fetchWindow(store, windowIndex) {
    const firstRow = windowIndex * WINDOW_ROWS;
    const anchor = anchorForRow(store, firstRow);
    const lastRow = Math.min(firstRow + WINDOW_ROWS, store.rowCount);
    const neededAnchor = Math.ceil((lastRow + ANCHOR_INTERVAL) / ANCHOR_INTERVAL);
    const endByte = neededAnchor < store.anchorCount && store.anchors[neededAnchor] > anchor.byteOffset
        ? store.anchors[neededAnchor]
        : store.file.size;

    const text = await store.file.slice(anchor.byteOffset, endByte).text();
    const lines = text.split(/\r?\n/);
    const rows = new Map();

    for (let i = 0; i < lines.length; i++) {
        const rowIndex = anchor.firstRow + i;

        if (rowIndex >= firstRow && rowIndex < lastRow) {
            rows.set(rowIndex, splitDelimitedLine(lines[i], store.delimiter));
        }
    }

    store.windows.set(windowIndex, rows);
    store.windowOrder.push(windowIndex);

    while (store.windowOrder.length > MAX_RESIDENT_WINDOWS) {
        const evicted = store.windowOrder.shift();

        if (evicted !== windowIndex) {
            store.windows.delete(evicted);
        }
    }
}

function readFileCellByKey(store, key) {
    const comma = key.indexOf(",");

    return readFileCell(store, Number(key.slice(0, comma)), Number(key.slice(comma + 1)));
}

function readFileCell(store, row, col) {
    if (store.kind === "sheet") {
        const overlaid = store.overlay[toKey(row, col)];

        if (overlaid !== undefined) return overlaid;

        const line = store.rows[row];

        return line ? (line[col] ?? "") : "";
    }

    const overlaid = store.overlay[toKey(row, col)];

    if (overlaid !== undefined) {
        return overlaid;
    }

    const rows = store.windows.get(windowIndexForRow(row));

    if (!rows) {
        return "";
    }

    const cached = rows.get(row);

    return cached ? (cached[col] ?? "") : "";
}

function readBaseCell(store, row, col) {
    if (store.kind === "sheet") {
        const line = store.rows[row];

        return line ? (line[col] ?? "") : "";
    }

    if (row >= store.rowCount) return "";

    const rows = store.windows.get(windowIndexForRow(row));

    if (!rows) return null;

    const cached = rows.get(row);

    return cached ? (cached[col] ?? "") : "";
}

function overlaysMatch(store, current, saved) {
    if (current === saved) return true;

    for (const key of new Set([...Object.keys(current), ...Object.keys(saved)])) {
        const a = current[key];
        const b = saved[key];

        if (a === b) continue;

        if (a !== undefined && b !== undefined) {
            if ((a || "") !== (b || "")) return false;
            continue;
        }

        if (!store) return false;

        const comma = key.indexOf(",");
        const base = readBaseCell(store, Number(key.slice(0, comma)), Number(key.slice(comma + 1)));

        if (base === null) return false;
        if (((a ?? base) || "") !== ((b ?? base) || "")) return false;
    }

    return true;
}

function flattenValues(args) {
    const out = [];

    const walk = (value) => {
        if (Array.isArray(value)) {
            value.forEach(walk);
            return;
        }

        out.push(value);
    };

    args.forEach(walk);

    return out;
}

function flattenToNumbers(arg) {
    const values = Array.isArray(arg) ? flattenValues(arg) : [arg];

    return values
        .filter((v) => v !== null && v !== undefined && v !== "")
        .map((v) => Number(v))
        .filter((v) => Number.isFinite(v));
}

function toNum(value) {
    const n = Number(value);

    return Number.isFinite(n) ? n : 0;
}

function toText(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value);
}

function toDate(value) {
    if (value instanceof Date) {
        return value;
    }

    const parsed = new Date(value);

    return Number.isNaN(parsed.getTime()) ? new Date(NaN) : parsed;
}

function matchesCriteria(value, criteria) {
    const raw = toText(criteria).trim();

    if (raw.startsWith(">=")) {
        return toNum(value) >= toNum(raw.slice(2));
    }

    if (raw.startsWith("<=")) {
        return toNum(value) <= toNum(raw.slice(2));
    }

    if (raw.startsWith("<>")) {
        return toText(value) !== raw.slice(2);
    }

    if (raw.startsWith(">")) {
        return toNum(value) > toNum(raw.slice(1));
    }

    if (raw.startsWith("<")) {
        return toNum(value) < toNum(raw.slice(1));
    }

    if (raw.startsWith("=")) {
        return toText(value) === raw.slice(1);
    }

    if (raw.includes("*") || raw.includes("?")) {
        const pattern = raw
            .replace(/[.+^${}()|[\]\\]/g, "\\$&")
            .replace(/\*/g, ".*")
            .replace(/\?/g, ".");

        return new RegExp(`^${pattern}$`, "i").test(toText(value));
    }

    return toText(value).toLowerCase() === raw.toLowerCase();
}

function minOf(values) {
    let out = Infinity;

    for (let i = 0; i < values.length; i++) {
        if (values[i] < out) out = values[i];
    }

    return out === Infinity ? 0 : out;
}

function maxOf(values) {
    let out = -Infinity;

    for (let i = 0; i < values.length; i++) {
        if (values[i] > out) out = values[i];
    }

    return out === -Infinity ? 0 : out;
}

function meanOf(values) {
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function sampleVariance(values) {
    if (values.length < 2) {
        return 0;
    }

    const mean = meanOf(values);

    return values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (values.length - 1);
}

function populationVariance(values) {
    if (!values.length) {
        return 0;
    }

    const mean = meanOf(values);

    return values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
}

function percentileOf(values, fraction) {
    const sorted = [...values].sort((a, b) => a - b);

    if (!sorted.length) {
        return 0;
    }

    const position = (sorted.length - 1) * Math.min(Math.max(fraction, 0), 1);
    const lower = Math.floor(position);
    const upper = Math.ceil(position);

    if (lower === upper) {
        return sorted[lower];
    }

    return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function pairedSeries(a, b) {
    const left = flattenToNumbers(a);
    const right = flattenToNumbers(b);
    const length = Math.min(left.length, right.length);

    return { left: left.slice(0, length), right: right.slice(0, length), length };
}

function linearFit(knownY, knownX) {
    const { left: ys, right: xs, length } = pairedSeries(knownY, knownX);

    if (length < 2) {
        return { slope: 0, intercept: 0, r: 0 };
    }

    const meanX = meanOf(xs);
    const meanY = meanOf(ys);

    let covariance = 0;
    let varianceX = 0;
    let varianceY = 0;

    for (let i = 0; i < length; i++) {
        const dx = xs[i] - meanX;
        const dy = ys[i] - meanY;

        covariance += dx * dy;
        varianceX += dx * dx;
        varianceY += dy * dy;
    }

    const slope = varianceX === 0 ? 0 : covariance / varianceX;
    const denominator = Math.sqrt(varianceX * varianceY);

    return {
        slope,
        intercept: meanY - slope * meanX,
        r: denominator === 0 ? 0 : covariance / denominator
    };
}

function lookupIn(needle, table, index, approximate, horizontal) {
    if (!Array.isArray(table)) {
        return "#N/A";
    }

    const grid = Array.isArray(table[0]) ? table : [table];
    const series = horizontal ? grid[0] : grid.map((row) => (Array.isArray(row) ? row[0] : row));
    const column = Math.max(1, Math.trunc(toNum(index))) - 1;

    let best = -1;

    for (let i = 0; i < series.length; i++) {
        if (matchesCriteria(series[i], needle)) {
            best = i;
            break;
        }

        if (approximate && toNum(series[i]) <= toNum(needle)) {
            best = i;
        }
    }

    if (best < 0) {
        return "#N/A";
    }

    if (horizontal) {
        const row = grid[column];
        return row === undefined ? "#N/A" : (Array.isArray(row) ? row[best] : row);
    }

    const row = grid[best];

    if (!Array.isArray(row)) {
        return column === 0 ? row : "#N/A";
    }

    return row[column] === undefined ? "#N/A" : row[column];
}

function paymentFor(rate, periods, present, future, dueAtStart) {
    const r = toNum(rate);
    const n = toNum(periods);
    const pv = toNum(present);
    const fv = toNum(future);

    if (n === 0) {
        return 0;
    }

    if (r === 0) {
        return -(pv + fv) / n;
    }

    const growth = (1 + r) ** n;
    const raw = -(pv * growth + fv) / (((growth - 1) / r) * (dueAtStart ? 1 + r : 1));

    return raw;
}

const FORMULA_FUNCTIONS = {
    SUM: (...args) => flattenToNumbers(args).reduce((a, b) => a + b, 0),
    SUMSQ: (...args) => flattenToNumbers(args).reduce((a, b) => a + b * b, 0),
    PRODUCT: (...args) => flattenToNumbers(args).reduce((a, b) => a * b, 1),
    QUOTIENT: (a, b) => (toNum(b) === 0 ? "#DIV/0!" : Math.trunc(toNum(a) / toNum(b))),
    MOD: (a, b) => (toNum(b) === 0 ? "#DIV/0!" : toNum(a) - Math.floor(toNum(a) / toNum(b)) * toNum(b)),
    ABS: (x) => Math.abs(toNum(x)),
    SIGN: (x) => Math.sign(toNum(x)),
    SQRT: (x) => (toNum(x) < 0 ? "#NUM!" : Math.sqrt(toNum(x))),
    POWER: (base, exponent) => toNum(base) ** toNum(exponent),
    EXP: (x) => Math.exp(toNum(x)),
    LN: (x) => (toNum(x) <= 0 ? "#NUM!" : Math.log(toNum(x))),
    LOG: (x, base = 10) => (toNum(x) <= 0 ? "#NUM!" : Math.log(toNum(x)) / Math.log(toNum(base))),
    LOG10: (x) => (toNum(x) <= 0 ? "#NUM!" : Math.log10(toNum(x))),
    INT: (x) => Math.floor(toNum(x)),
    TRUNC: (x, digits = 0) => {
        const factor = 10 ** Math.trunc(toNum(digits));
        return Math.trunc(toNum(x) * factor) / factor;
    },
    ROUND: (x, digits = 0) => {
        const factor = 10 ** Math.trunc(toNum(digits));
        return Math.round(toNum(x) * factor) / factor;
    },
    ROUNDUP: (x, digits = 0) => {
        const factor = 10 ** Math.trunc(toNum(digits));
        const n = toNum(x) * factor;
        return (n < 0 ? Math.floor(n) : Math.ceil(n)) / factor;
    },
    ROUNDDOWN: (x, digits = 0) => {
        const factor = 10 ** Math.trunc(toNum(digits));
        const n = toNum(x) * factor;
        return (n < 0 ? Math.ceil(n) : Math.floor(n)) / factor;
    },
    MROUND: (x, multiple) => (toNum(multiple) === 0 ? 0 : Math.round(toNum(x) / toNum(multiple)) * toNum(multiple)),
    FLOOR: (x, significance = 1) => (toNum(significance) === 0 ? 0 : Math.floor(toNum(x) / toNum(significance)) * toNum(significance)),
    CEILING: (x, significance = 1) => (toNum(significance) === 0 ? 0 : Math.ceil(toNum(x) / toNum(significance)) * toNum(significance)),
    EVEN: (x) => {
        const n = Math.ceil(Math.abs(toNum(x)) / 2) * 2;
        return toNum(x) < 0 ? -n : n;
    },
    ODD: (x) => {
        const abs = Math.abs(toNum(x));
        const n = Math.ceil((abs - 1) / 2) * 2 + 1;
        return toNum(x) < 0 ? -n : n;
    },
    FACT: (x) => {
        const n = Math.trunc(toNum(x));
        if (n < 0) return "#NUM!";
        let out = 1;
        for (let i = 2; i <= n; i++) out *= i;
        return out;
    },
    COMBIN: (n, k) => {
        const total = Math.trunc(toNum(n));
        const choose = Math.trunc(toNum(k));
        if (choose < 0 || total < choose) return "#NUM!";
        let out = 1;
        for (let i = 1; i <= choose; i++) out = (out * (total - choose + i)) / i;
        return Math.round(out);
    },
    PERMUT: (n, k) => {
        const total = Math.trunc(toNum(n));
        const pick = Math.trunc(toNum(k));
        if (pick < 0 || total < pick) return "#NUM!";
        let out = 1;
        for (let i = 0; i < pick; i++) out *= total - i;
        return out;
    },
    GCD: (...args) => {
        const values = flattenToNumbers(args).map((v) => Math.abs(Math.trunc(v)));
        const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
        return values.reduce((a, b) => gcd(a, b), 0);
    },
    LCM: (...args) => {
        const values = flattenToNumbers(args).map((v) => Math.abs(Math.trunc(v)));
        const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
        return values.reduce((a, b) => (a === 0 || b === 0 ? 0 : Math.abs(a * b) / gcd(a, b)), 1);
    },
    SUMPRODUCT: (...args) => {
        const series = args.map((arg) => flattenToNumbers(arg));
        if (!series.length) return 0;
        const length = minOf(series.map((s) => s.length));
        let total = 0;
        for (let i = 0; i < length; i++) {
            total += series.reduce((acc, s) => acc * s[i], 1);
        }
        return total;
    },

    PI: () => Math.PI,
    RADIANS: (x) => (toNum(x) * Math.PI) / 180,
    DEGREES: (x) => (toNum(x) * 180) / Math.PI,
    SIN: (x) => Math.sin(toNum(x)),
    COS: (x) => Math.cos(toNum(x)),
    TAN: (x) => Math.tan(toNum(x)),
    ASIN: (x) => Math.asin(toNum(x)),
    ACOS: (x) => Math.acos(toNum(x)),
    ATAN: (x) => Math.atan(toNum(x)),
    ATAN2: (x, y) => Math.atan2(toNum(y), toNum(x)),
    SINH: (x) => Math.sinh(toNum(x)),
    COSH: (x) => Math.cosh(toNum(x)),
    TANH: (x) => Math.tanh(toNum(x)),
    CSC: (x) => (Math.sin(toNum(x)) === 0 ? "#DIV/0!" : 1 / Math.sin(toNum(x))),
    SEC: (x) => (Math.cos(toNum(x)) === 0 ? "#DIV/0!" : 1 / Math.cos(toNum(x))),
    COT: (x) => (Math.tan(toNum(x)) === 0 ? "#DIV/0!" : 1 / Math.tan(toNum(x))),
    RAND: () => Math.random(),
    RANDBETWEEN: (low, high) => {
        const a = Math.ceil(toNum(low));
        const b = Math.floor(toNum(high));
        return a + Math.floor(Math.random() * (b - a + 1));
    },

    AVERAGE: (...args) => meanOf(flattenToNumbers(args)),
    AVERAGEA: (...args) => {
        const values = flattenValues(args).filter((v) => v !== null && v !== undefined && v !== "");
        return values.length ? values.reduce((acc, v) => acc + toNum(v), 0) / values.length : 0;
    },
    AVEDEV: (...args) => {
        const values = flattenToNumbers(args);
        const mean = meanOf(values);
        return values.length ? values.reduce((acc, v) => acc + Math.abs(v - mean), 0) / values.length : 0;
    },
    DEVSQ: (...args) => {
        const values = flattenToNumbers(args);
        const mean = meanOf(values);
        return values.reduce((acc, v) => acc + (v - mean) ** 2, 0);
    },
    MIN: (...args) => {
        const values = flattenToNumbers(args);
        return minOf(values);
    },
    MAX: (...args) => {
        const values = flattenToNumbers(args);
        return maxOf(values);
    },
    MEDIAN: (...args) => percentileOf(flattenToNumbers(args), 0.5),
    MODE: (...args) => {
        const values = flattenToNumbers(args);
        const counts = new Map();
        let best = "#N/A";
        let bestCount = 1;
        for (const v of values) {
            const next = (counts.get(v) || 0) + 1;
            counts.set(v, next);
            if (next > bestCount) {
                bestCount = next;
                best = v;
            }
        }
        return best;
    },
    COUNT: (...args) => flattenToNumbers(args).length,
    COUNTA: (...args) => flattenValues(args).filter((v) => v !== null && v !== undefined && v !== "").length,
    COUNTBLANK: (...args) => flattenValues(args).filter((v) => v === null || v === undefined || v === "").length,
    STDEV: (...args) => Math.sqrt(sampleVariance(flattenToNumbers(args))),
    STDEVP: (...args) => Math.sqrt(populationVariance(flattenToNumbers(args))),
    VAR: (...args) => sampleVariance(flattenToNumbers(args)),
    VARP: (...args) => populationVariance(flattenToNumbers(args)),
    GEOMEAN: (...args) => {
        const values = flattenToNumbers(args).filter((v) => v > 0);
        if (!values.length) return "#NUM!";
        return Math.exp(meanOf(values.map((v) => Math.log(v))));
    },
    HARMEAN: (...args) => {
        const values = flattenToNumbers(args).filter((v) => v !== 0);
        if (!values.length) return "#NUM!";
        return values.length / values.reduce((acc, v) => acc + 1 / v, 0);
    },
    SKEW: (...args) => {
        const values = flattenToNumbers(args);
        const n = values.length;
        if (n < 3) return "#DIV/0!";
        const mean = meanOf(values);
        const sd = Math.sqrt(sampleVariance(values));
        if (sd === 0) return "#DIV/0!";
        const sum = values.reduce((acc, v) => acc + ((v - mean) / sd) ** 3, 0);
        return (n / ((n - 1) * (n - 2))) * sum;
    },
    KURT: (...args) => {
        const values = flattenToNumbers(args);
        const n = values.length;
        if (n < 4) return "#DIV/0!";
        const mean = meanOf(values);
        const sd = Math.sqrt(sampleVariance(values));
        if (sd === 0) return "#DIV/0!";
        const sum = values.reduce((acc, v) => acc + ((v - mean) / sd) ** 4, 0);
        return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * sum
            - (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
    },
    LARGE: (range, k) => {
        const sorted = flattenToNumbers(range).sort((a, b) => b - a);
        const index = Math.trunc(toNum(k)) - 1;
        return sorted[index] === undefined ? "#NUM!" : sorted[index];
    },
    SMALL: (range, k) => {
        const sorted = flattenToNumbers(range).sort((a, b) => a - b);
        const index = Math.trunc(toNum(k)) - 1;
        return sorted[index] === undefined ? "#NUM!" : sorted[index];
    },
    RANK: (value, range, ascending = 0) => {
        const values = flattenToNumbers(range).sort((a, b) => (toNum(ascending) ? a - b : b - a));
        const index = values.indexOf(toNum(value));
        return index < 0 ? "#N/A" : index + 1;
    },
    PERCENTILE: (range, fraction) => percentileOf(flattenToNumbers(range), toNum(fraction)),
    QUARTILE: (range, quarter) => percentileOf(flattenToNumbers(range), Math.min(Math.max(toNum(quarter), 0), 4) / 4),
    PERCENTRANK: (range, value) => {
        const values = flattenToNumbers(range).sort((a, b) => a - b);
        if (values.length < 2) return 0;
        const below = values.filter((v) => v < toNum(value)).length;
        return below / (values.length - 1);
    },
    TRIMMEAN: (range, fraction) => {
        const values = flattenToNumbers(range).sort((a, b) => a - b);
        const cut = Math.floor((values.length * Math.min(Math.max(toNum(fraction), 0), 1)) / 2);
        return meanOf(values.slice(cut, values.length - cut));
    },
    CORREL: (a, b) => linearFit(b, a).r,
    RSQ: (a, b) => linearFit(a, b).r ** 2,
    SLOPE: (knownY, knownX) => linearFit(knownY, knownX).slope,
    INTERCEPT: (knownY, knownX) => linearFit(knownY, knownX).intercept,
    FORECAST: (x, knownY, knownX) => {
        const fit = linearFit(knownY, knownX);
        return fit.intercept + fit.slope * toNum(x);
    },
    COVAR: (a, b) => {
        const { left, right, length } = pairedSeries(a, b);
        if (!length) return 0;
        const meanA = meanOf(left);
        const meanB = meanOf(right);
        let total = 0;
        for (let i = 0; i < length; i++) total += (left[i] - meanA) * (right[i] - meanB);
        return total / length;
    },

    COUNTIF: (range, criteria) => flattenValues([range]).filter((v) => matchesCriteria(v, criteria)).length,
    COUNTIFS: (...args) => {
        const pairs = [];
        for (let i = 0; i + 1 < args.length; i += 2) {
            pairs.push({ values: flattenValues([args[i]]), criteria: args[i + 1] });
        }
        if (!pairs.length) return 0;
        const length = minOf(pairs.map((p) => p.values.length));
        let count = 0;
        for (let i = 0; i < length; i++) {
            if (pairs.every((p) => matchesCriteria(p.values[i], p.criteria))) count++;
        }
        return count;
    },
    SUMIF: (range, criteria, sumRange = range) => {
        const keys = flattenValues([range]);
        const targets = flattenValues([sumRange]);
        let total = 0;
        for (let i = 0; i < keys.length; i++) {
            if (matchesCriteria(keys[i], criteria)) total += toNum(targets[i]);
        }
        return total;
    },
    SUMIFS: (sumRange, ...rest) => {
        const targets = flattenValues([sumRange]);
        const pairs = [];
        for (let i = 0; i + 1 < rest.length; i += 2) {
            pairs.push({ values: flattenValues([rest[i]]), criteria: rest[i + 1] });
        }
        let total = 0;
        for (let i = 0; i < targets.length; i++) {
            if (pairs.every((p) => matchesCriteria(p.values[i], p.criteria))) total += toNum(targets[i]);
        }
        return total;
    },
    AVERAGEIF: (range, criteria, averageRange = range) => {
        const keys = flattenValues([range]);
        const targets = flattenValues([averageRange]);
        const picked = [];
        for (let i = 0; i < keys.length; i++) {
            if (matchesCriteria(keys[i], criteria)) picked.push(toNum(targets[i]));
        }
        return picked.length ? meanOf(picked) : "#DIV/0!";
    },
    MAXIFS: (maxRange, ...rest) => {
        const targets = flattenValues([maxRange]);
        const pairs = [];
        for (let i = 0; i + 1 < rest.length; i += 2) {
            pairs.push({ values: flattenValues([rest[i]]), criteria: rest[i + 1] });
        }
        const picked = targets.filter((_, i) => pairs.every((p) => matchesCriteria(p.values[i], p.criteria)));
        return maxOf(picked.map(toNum));
    },
    MINIFS: (minRange, ...rest) => {
        const targets = flattenValues([minRange]);
        const pairs = [];
        for (let i = 0; i + 1 < rest.length; i += 2) {
            pairs.push({ values: flattenValues([rest[i]]), criteria: rest[i + 1] });
        }
        const picked = targets.filter((_, i) => pairs.every((p) => matchesCriteria(p.values[i], p.criteria)));
        return minOf(picked.map(toNum));
    },

    LEN: (text) => toText(text).length,
    LEFT: (text, count = 1) => toText(text).slice(0, Math.max(0, Math.trunc(toNum(count)))),
    RIGHT: (text, count = 1) => {
        const n = Math.max(0, Math.trunc(toNum(count)));
        return n === 0 ? "" : toText(text).slice(-n);
    },
    MID: (text, start, count) => {
        const from = Math.max(0, Math.trunc(toNum(start)) - 1);
        return toText(text).slice(from, from + Math.max(0, Math.trunc(toNum(count))));
    },
    UPPER: (text) => toText(text).toUpperCase(),
    LOWER: (text) => toText(text).toLowerCase(),
    PROPER: (text) => toText(text).replace(/\w\S*/g, (word) => word[0].toUpperCase() + word.slice(1).toLowerCase()),
    TRIM: (text) => toText(text).replace(/\s+/g, " ").trim(),
    CLEAN: (text) => toText(text).replace(/[\x00-\x1F\x7F]/g, ""),
    CONCAT: (...args) => flattenValues(args).map(toText).join(""),
    CONCATENATE: (...args) => flattenValues(args).map(toText).join(""),
    TEXTJOIN: (delimiter, ignoreEmpty, ...rest) => {
        const parts = flattenValues(rest).map(toText);
        const kept = ignoreEmpty === false ? parts : parts.filter((p) => p !== "");
        return kept.join(toText(delimiter));
    },
    SUBSTITUTE: (text, find, replacement, occurrence) => {
        const source = toText(text);
        const needle = toText(find);
        if (needle === "") return source;
        if (occurrence === undefined) return source.split(needle).join(toText(replacement));
        const target = Math.trunc(toNum(occurrence));
        let seen = 0;
        let index = source.indexOf(needle);
        while (index !== -1) {
            seen++;
            if (seen === target) {
                return source.slice(0, index) + toText(replacement) + source.slice(index + needle.length);
            }
            index = source.indexOf(needle, index + needle.length);
        }
        return source;
    },
    REPLACE: (text, start, count, replacement) => {
        const source = toText(text);
        const from = Math.max(0, Math.trunc(toNum(start)) - 1);
        return source.slice(0, from) + toText(replacement) + source.slice(from + Math.max(0, Math.trunc(toNum(count))));
    },
    FIND: (needle, haystack, start = 1) => {
        const index = toText(haystack).indexOf(toText(needle), Math.max(0, Math.trunc(toNum(start)) - 1));
        return index < 0 ? "#VALUE!" : index + 1;
    },
    SEARCH: (needle, haystack, start = 1) => {
        const index = toText(haystack).toLowerCase().indexOf(toText(needle).toLowerCase(), Math.max(0, Math.trunc(toNum(start)) - 1));
        return index < 0 ? "#VALUE!" : index + 1;
    },
    REPT: (text, count) => toText(text).repeat(Math.max(0, Math.trunc(toNum(count)))),
    EXACT: (a, b) => toText(a) === toText(b),
    VALUE: (text) => {
        const n = Number(toText(text).replace(/[$,%\s]/g, ""));
        return Number.isFinite(n) ? n : "#VALUE!";
    },
    NUMBERVALUE: (text) => {
        const n = Number(toText(text).replace(/[^0-9.eE+-]/g, ""));
        return Number.isFinite(n) ? n : "#VALUE!";
    },
    CHAR: (code) => String.fromCharCode(Math.trunc(toNum(code))),
    CODE: (text) => {
        const source = toText(text);
        return source.length ? source.charCodeAt(0) : "#VALUE!";
    },
    TEXT: (value, format) => {
        const pattern = toText(format);
        const n = Number(value);
        if (!Number.isFinite(n)) return toText(value);
        const decimals = pattern.includes(".") ? (pattern.split(".")[1].match(/0/g) || []).length : 0;
        const fixed = n.toFixed(decimals);
        return pattern.includes(",") ? Number(fixed).toLocaleString(undefined, { minimumFractionDigits: decimals }) : fixed;
    },

    TRUE: () => true,
    FALSE: () => false,
    IF: (condition, whenTrue, whenFalse = false) => (condition ? whenTrue : whenFalse),
    IFS: (...args) => {
        for (let i = 0; i + 1 < args.length; i += 2) {
            if (args[i]) return args[i + 1];
        }
        return "#N/A";
    },
    SWITCH: (value, ...rest) => {
        for (let i = 0; i + 1 < rest.length; i += 2) {
            if (toText(rest[i]) === toText(value)) return rest[i + 1];
        }
        return rest.length % 2 === 1 ? rest[rest.length - 1] : "#N/A";
    },
    IFERROR: (value, fallback) => (typeof value === "string" && value.startsWith("#") ? fallback : value),
    IFNA: (value, fallback) => (value === "#N/A" ? fallback : value),
    AND: (...args) => flattenValues(args).every((v) => Boolean(v)),
    OR: (...args) => flattenValues(args).some((v) => Boolean(v)),
    XOR: (...args) => flattenValues(args).filter((v) => Boolean(v)).length % 2 === 1,
    NOT: (value) => !value,
    ISBLANK: (value) => value === null || value === undefined || value === "",
    ISNUMBER: (value) => Number.isFinite(Number(value)) && toText(value).trim() !== "",
    ISTEXT: (value) => typeof value === "string" && !Number.isFinite(Number(value)),
    ISERROR: (value) => typeof value === "string" && value.startsWith("#"),
    ISEVEN: (value) => Math.trunc(toNum(value)) % 2 === 0,
    ISODD: (value) => Math.abs(Math.trunc(toNum(value))) % 2 === 1,

    CHOOSE: (index, ...options) => {
        const pick = Math.trunc(toNum(index)) - 1;
        return options[pick] === undefined ? "#VALUE!" : options[pick];
    },
    VLOOKUP: (needle, table, index, approximate = false) => lookupIn(needle, table, index, Boolean(approximate), false),
    HLOOKUP: (needle, table, index, approximate = false) => lookupIn(needle, table, index, Boolean(approximate), true),
    MATCH: (needle, range, type = 1) => {
        const values = flattenValues([range]);
        if (toNum(type) === 0) {
            const exact = values.findIndex((v) => matchesCriteria(v, needle));
            return exact < 0 ? "#N/A" : exact + 1;
        }
        let best = -1;
        for (let i = 0; i < values.length; i++) {
            if (toNum(type) > 0 ? toNum(values[i]) <= toNum(needle) : toNum(values[i]) >= toNum(needle)) best = i;
        }
        return best < 0 ? "#N/A" : best + 1;
    },
    INDEX: (range, row, column = 1) => {
        if (!Array.isArray(range)) return range;
        const grid = Array.isArray(range[0]) ? range : [range];
        const r = Math.max(1, Math.trunc(toNum(row))) - 1;
        const c = Math.max(1, Math.trunc(toNum(column))) - 1;
        if (grid.length === 1 && !Array.isArray(range[0])) {
            const flat = flattenValues([range]);
            return flat[Math.max(r, c)] === undefined ? "#REF!" : flat[Math.max(r, c)];
        }
        const target = grid[r];
        if (!Array.isArray(target)) return target === undefined ? "#REF!" : target;
        return target[c] === undefined ? "#REF!" : target[c];
    },
    XLOOKUP: (needle, lookupRange, returnRange, fallback = "#N/A") => {
        const keys = flattenValues([lookupRange]);
        const values = flattenValues([returnRange]);
        const index = keys.findIndex((v) => matchesCriteria(v, needle));
        return index < 0 || values[index] === undefined ? fallback : values[index];
    },
    ROWS: (range) => {
        if (!Array.isArray(range)) return 1;
        return Array.isArray(range[0]) ? range.length : flattenValues([range]).length;
    },
    COLUMNS: (range) => {
        if (!Array.isArray(range)) return 1;
        return Array.isArray(range[0]) ? range[0].length : 1;
    },
    UNIQUE: (...args) => {
        const seen = new Set();
        const out = [];
        for (const value of flattenValues(args)) {
            const key = toText(value);
            if (!seen.has(key)) {
                seen.add(key);
                out.push(value);
            }
        }
        return out.length === 1 ? out[0] : out;
    },

    NOW: () => new Date().toISOString(),
    TODAY: () => new Date().toISOString().slice(0, 10),
    DATE: (year, month, day) => new Date(toNum(year), Math.trunc(toNum(month)) - 1, toNum(day)).toISOString().slice(0, 10),
    TIME: (hour, minute, second) => {
        const total = Math.trunc(toNum(hour)) * 3600 + Math.trunc(toNum(minute)) * 60 + Math.trunc(toNum(second));
        const h = String(Math.floor(total / 3600) % 24).padStart(2, "0");
        const m = String(Math.floor(total / 60) % 60).padStart(2, "0");
        const s = String(total % 60).padStart(2, "0");
        return `${h}:${m}:${s}`;
    },
    YEAR: (value) => {
        const d = toDate(value);
        return Number.isNaN(d.getTime()) ? "#VALUE!" : d.getFullYear();
    },
    MONTH: (value) => {
        const d = toDate(value);
        return Number.isNaN(d.getTime()) ? "#VALUE!" : d.getMonth() + 1;
    },
    DAY: (value) => {
        const d = toDate(value);
        return Number.isNaN(d.getTime()) ? "#VALUE!" : d.getDate();
    },
    HOUR: (value) => {
        const d = toDate(value);
        return Number.isNaN(d.getTime()) ? "#VALUE!" : d.getHours();
    },
    MINUTE: (value) => {
        const d = toDate(value);
        return Number.isNaN(d.getTime()) ? "#VALUE!" : d.getMinutes();
    },
    SECOND: (value) => {
        const d = toDate(value);
        return Number.isNaN(d.getTime()) ? "#VALUE!" : d.getSeconds();
    },
    WEEKDAY: (value, type = 1) => {
        const d = toDate(value);
        if (Number.isNaN(d.getTime())) return "#VALUE!";
        const day = d.getDay();
        return toNum(type) === 2 ? (day === 0 ? 7 : day) : day + 1;
    },
    WEEKNUM: (value) => {
        const d = toDate(value);
        if (Number.isNaN(d.getTime())) return "#VALUE!";
        const start = new Date(d.getFullYear(), 0, 1);
        return Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7);
    },
    DAYS: (end, start) => {
        const a = toDate(end);
        const b = toDate(start);
        if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return "#VALUE!";
        return Math.round((a - b) / 86400000);
    },
    EDATE: (value, months) => {
        const d = toDate(value);
        if (Number.isNaN(d.getTime())) return "#VALUE!";
        const out = new Date(d);
        out.setMonth(out.getMonth() + Math.trunc(toNum(months)));
        return out.toISOString().slice(0, 10);
    },
    EOMONTH: (value, months) => {
        const d = toDate(value);
        if (Number.isNaN(d.getTime())) return "#VALUE!";
        const out = new Date(d.getFullYear(), d.getMonth() + Math.trunc(toNum(months)) + 1, 0);
        return out.toISOString().slice(0, 10);
    },
    NETWORKDAYS: (start, end) => {
        const a = toDate(start);
        const b = toDate(end);
        if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return "#VALUE!";
        const step = a <= b ? 1 : -1;
        let count = 0;
        const cursor = new Date(a);
        while (step > 0 ? cursor <= b : cursor >= b) {
            const day = cursor.getDay();
            if (day !== 0 && day !== 6) count++;
            cursor.setDate(cursor.getDate() + step);
        }
        return count * step;
    },

    PMT: (rate, periods, present, future = 0, dueAtStart = 0) => paymentFor(rate, periods, present, future, Boolean(toNum(dueAtStart))),
    FV: (rate, periods, payment, present = 0, dueAtStart = 0) => {
        const r = toNum(rate);
        const n = toNum(periods);
        const pmt = toNum(payment);
        const pv = toNum(present);
        if (r === 0) return -(pv + pmt * n);
        const growth = (1 + r) ** n;
        return -(pv * growth + pmt * ((growth - 1) / r) * (toNum(dueAtStart) ? 1 + r : 1));
    },
    PV: (rate, periods, payment, future = 0, dueAtStart = 0) => {
        const r = toNum(rate);
        const n = toNum(periods);
        const pmt = toNum(payment);
        const fv = toNum(future);
        if (r === 0) return -(fv + pmt * n);
        const growth = (1 + r) ** n;
        return -(fv + pmt * ((growth - 1) / r) * (toNum(dueAtStart) ? 1 + r : 1)) / growth;
    },
    NPER: (rate, payment, present, future = 0) => {
        const r = toNum(rate);
        const pmt = toNum(payment);
        const pv = toNum(present);
        const fv = toNum(future);
        if (r === 0) return pmt === 0 ? "#NUM!" : -(pv + fv) / pmt;
        const numerator = pmt - fv * r;
        const denominator = pmt + pv * r;
        if (numerator <= 0 || denominator <= 0) return "#NUM!";
        return Math.log(numerator / denominator) / Math.log(1 + r);
    },
    NPV: (rate, ...values) => {
        const r = toNum(rate);
        return flattenToNumbers(values).reduce((acc, v, i) => acc + v / (1 + r) ** (i + 1), 0);
    },
    IRR: (values, guess = 0.1) => {
        const flows = flattenToNumbers([values]);
        if (flows.length < 2) return "#NUM!";
        let rate = toNum(guess);
        for (let i = 0; i < 80; i++) {
            let npv = 0;
            let slope = 0;
            for (let k = 0; k < flows.length; k++) {
                npv += flows[k] / (1 + rate) ** k;
                slope -= (k * flows[k]) / (1 + rate) ** (k + 1);
            }
            if (Math.abs(npv) < 1e-9) return rate;
            if (slope === 0) break;
            rate -= npv / slope;
        }
        return "#NUM!";
    },
    SLN: (cost, salvage, life) => (toNum(life) === 0 ? "#DIV/0!" : (toNum(cost) - toNum(salvage)) / toNum(life)),

    DELTA: (a, b = 0) => (toNum(a) === toNum(b) ? 1 : 0),
    GESTEP: (value, step = 0) => (toNum(value) >= toNum(step) ? 1 : 0),
    BITAND: (a, b) => Math.trunc(toNum(a)) & Math.trunc(toNum(b)),
    BITOR: (a, b) => Math.trunc(toNum(a)) | Math.trunc(toNum(b)),
    BITXOR: (a, b) => Math.trunc(toNum(a)) ^ Math.trunc(toNum(b)),
    BITLSHIFT: (a, shift) => Math.trunc(toNum(a)) << Math.trunc(toNum(shift)),
    BITRSHIFT: (a, shift) => Math.trunc(toNum(a)) >> Math.trunc(toNum(shift)),
    DEC2BIN: (value) => (Math.trunc(toNum(value)) >>> 0).toString(2),
    DEC2HEX: (value) => (Math.trunc(toNum(value)) >>> 0).toString(16).toUpperCase(),
    DEC2OCT: (value) => (Math.trunc(toNum(value)) >>> 0).toString(8),
    BIN2DEC: (text) => {
        const n = parseInt(toText(text), 2);
        return Number.isNaN(n) ? "#NUM!" : n;
    },
    HEX2DEC: (text) => {
        const n = parseInt(toText(text), 16);
        return Number.isNaN(n) ? "#NUM!" : n;
    },
    OCT2DEC: (text) => {
        const n = parseInt(toText(text), 8);
        return Number.isNaN(n) ? "#NUM!" : n;
    }
};

const FORMULA_FUNCTION_NAMES = Object.keys(FORMULA_FUNCTIONS).sort();

function evalRPN(rpn, getCell) {
  const st = [];
  const fns = FORMULA_FUNCTIONS;
  for (const t of rpn) {
    if (t.t === "num") st.push(t.v);
    else if (t.t === "ref") { const v = getCell(t.v.row, t.v.col); st.push(v); }
    else if (t.t === "range") { const { start, end } = t.v; const r1 = Math.min(start.row, end.row), r2 = Math.max(start.row, end.row); const c1 = Math.min(start.col, end.col), c2 = Math.max(start.col, end.col); const arr = []; for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) arr.push(getCell(r, c)); st.push(arr); }
    else if ("+-*/^".includes(t.t)) { const b = st.pop(); const a = st.pop(); const A = toNum(a), B = toNum(b); st.push(t.t === "+" ? A + B : t.t === "-" ? A - B : t.t === "*" ? A * B : t.t === "/" ? (B === 0 ? 0 : A / B) : Math.pow(A, B)); }
    else if (t.t === "call") { const args = []; for (let k = 0; k < t.argc; k++) args.unshift(st.pop()); const fn = fns[t.v] || (() => { throw new Error("#NAME?"); }); st.push(fn(...args)); }
    else if (t.t === "err") { return t.v; }
  }
  return st.length ? st[0] : 0;
}
function evaluateFormulaString(src, getCell) {
  try {
    const rpn = toRPN(tokenizeFormula(src));
    const val = evalRPN(rpn, getCell);
    return (typeof val === "number" && Number.isFinite(val)) ? String(val) : (Array.isArray(val) ? String(val[0] ?? 0) : String(val ?? ""));
  } catch { return "#ERROR"; }
}
function computeTable(store) {
    const cache = new Map();
    const visiting = new Set();

    function evaluateCell(key) {
        if (cache.has(key)) return cache.get(key);
        if (visiting.has(key)) { cache.set(key, "#CYCLE!"); return "#CYCLE!"; }

        visiting.add(key);

        const raw = readFileCellByKey(store, key);
        let result = raw ?? "";

        if (typeof raw === "string" && raw.charCodeAt(0) === 61) {
            result = evaluateFormulaString(raw.trim(), (r, c) => {
                const v = evaluateCell(toKey(r, c));
                const num = parseFloat(v);
                return Number.isFinite(num) ? num : 0;
            });
        }

        visiting.delete(key);
        cache.set(key, result);

        return result;
    }

    const out = {};

    for (const key of Object.keys(store.overlay)) {
        const raw = store.overlay[key];

        if (typeof raw === "string" && raw.charCodeAt(0) === 61) {
            out[key] = evaluateCell(key);
        }
    }

    return out;
}

function extractFirstRefOrRange(formula) {
  if (typeof formula !== "string" || !formula.trim().startsWith("=")) return null;
  const s = formula.trim().slice(1).toUpperCase();
  const mRange = s.match(/([A-Z]+[0-9]+)\s*:\s*([A-Z]+[0-9]+)/);
  if (mRange) {
    const a = rcFromA1(mRange[1]); const b = rcFromA1(mRange[2]);
    if (a && b) return { top: Math.min(a.row, b.row), left: Math.min(a.col, b.col), bottom: Math.max(a.row, b.row), right: Math.max(a.col, b.col) };
  }
  const mRef = s.match(/([A-Z]+[0-9]+)/);
  if (mRef) {
    const a = rcFromA1(mRef[1]); if (a) return { top: a.row, left: a.col, bottom: a.row, right: a.col };
  }
  return null;
}
function isExpectingFunctionRange(value, caret) {
  if (typeof value !== "string" || !value.trim().startsWith("=")) return false;
  const upToCaret = value.slice(0, caret ?? value.length);
  const opens = (upToCaret.match(/\(/g) || []).length;
  const closes = (upToCaret.match(/\)/g) || []).length;
  return opens > closes;
}
const Cell = React.memo(function Cell({ columnIndex, rowIndex, style, data }) {
  const {
    tableDataRef, storeRef, activeCell, cellEditingValue, handleCellMouseDown, handleCellDoubleClick,
    onCellValueChange, handleCellBlur, moveActiveCellHorizontally, moveActiveCellVertically,
    isCellHighlightedBySearch, filteredRows, hasActiveFilter, activeInputRef, keyBinds, cellHistoryRef, computedTableData, commitActiveCellIfNeeded, setFormulaBarValue
  } = data;
  const actualRowIndex = hasActiveFilter ? filteredRows[rowIndex] : rowIndex;
  if (actualRowIndex === undefined) return <div style={style} />;
  const cellIsActive = activeCell.row === actualRowIndex && activeCell.col === columnIndex;
  const sh = isCellHighlightedBySearch(actualRowIndex, columnIndex);
  let backgroundColor = "transparent", border = "1px solid #444";
  if (sh === "matched") backgroundColor = "rgba(255,255,0,0.2)";
  else if (sh === "current") backgroundColor = "rgba(255,255,0,0.5)";
  else if (cellIsActive) { backgroundColor = "rgba(0,122,255,0.3)"; border = "2px solid #007acc"; }
  const outerStyle = { ...style, backgroundColor, boxSizing: "border-box", border };
  const rawKey = toKey(actualRowIndex, columnIndex);
  const rawVal = readFileCellByKey(storeRef.current, rawKey) || "";
  const displayVal = (cellIsActive ? cellEditingValue : (computedTableData[rawKey] ?? rawVal)) || "";
  const binds = normalizeBinds(keyBinds);
  function setInputValueAndKeepCaret(input, value, toEnd = true) {
    cellHistoryRef.current.suppress = true;
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    if (input.classList?.contains("dataTableCellInput")) {
      setFormulaBarValue?.(value);
    }
    cellHistoryRef.current.suppress = false;
    try { if (toEnd) input.setSelectionRange(value.length, value.length); } catch { }
  }
  async function handleInCellShortcut(e) {
    const isMac = isMacPlatform();
    const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
    if (!cmdOrCtrl) return false;
    const input = e.currentTarget;
    const val = input.value;
    const selStart = input.selectionStart ?? 0;
    const selEnd = input.selectionEnd ?? 0;
    const hasSel = selEnd > selStart;
    if (binds.search.some(b => matchBind(e, b, isMac))) { stopAll(e); input.blur(); return true; }
    if (binds.save.some(b => matchBind(e, b, isMac))) { stopAll(e); input.blur(); return true; }
    if (binds.selectAll.some(b => matchBind(e, b, isMac))) { stopAll(e); try { input.setSelectionRange(0, val.length); } catch { } return true; }
    if (binds.copy.some(b => matchBind(e, b, isMac))) { stopAll(e); const toCopy = hasSel ? val.slice(selStart, selEnd) : val; await navigator.clipboard?.writeText?.(toCopy); return true; }
    if (binds.cut.some(b => matchBind(e, b, isMac))) {
      stopAll(e);
      const toCut = hasSel ? val.slice(selStart, selEnd) : val;
      await navigator.clipboard?.writeText?.(toCut);
      const newVal = hasSel ? (val.slice(0, selStart) + val.slice(selEnd)) : "";
      const h = cellHistoryRef.current; if (h.undo[h.undo.length - 1] !== newVal) h.undo.push(newVal); h.redo = [];
      setInputValueAndKeepCaret(input, newVal, true);
      return true;
    }
    if (binds.paste.some(b => matchBind(e, b, isMac))) {
      stopAll(e);
      let pasteText = ""; try { pasteText = await navigator.clipboard.readText(); } catch { }
      const newVal = val.slice(0, selStart) + pasteText + val.slice(selEnd);
      const h = cellHistoryRef.current; if (h.undo[h.undo.length - 1] !== newVal) h.undo.push(newVal); h.redo = [];
      setInputValueAndKeepCaret(input, newVal, true);
      return true;
    }
    if (binds.undo.some(b => matchBind(e, b, isMac)) && !e.shiftKey) {
      stopAll(e);
      const h = cellHistoryRef.current;
      if (h.undo.length > 1) {
        const cur = h.undo.pop();
        h.redo.push(cur);
        const prev = h.undo[h.undo.length - 1];
        setInputValueAndKeepCaret(input, prev, true);
        onCellValueChange({ target: { value: prev } });
      }
      return true;
    }
    if (binds.redo.some(b => matchBind(e, b, isMac))) {
      stopAll(e);
      const h = cellHistoryRef.current;
      if (h.redo.length > 0) {
        const next = h.redo.pop();
        h.undo.push(next);
        setInputValueAndKeepCaret(input, next, true);
        onCellValueChange({ target: { value: next } });
      }
      return true;
    }
    return false;
  }
  return (
    <div
      style={outerStyle}
      className={cellIsActive ? "dataTableCell" : "dataTableCell dataTableCellIdle"}
      onMouseDown={e => handleCellMouseDown(actualRowIndex, columnIndex, e)}
      onDoubleClick={() => handleCellDoubleClick(actualRowIndex, columnIndex)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {cellIsActive ? (
        <div style={CELL_INNER_STYLE}>
          <input
            type="text"
            className="dataTableCellInput"
            ref={activeInputRef}
            value={cellEditingValue}
            onChange={onCellValueChange}
            onBlur={handleCellBlur}
            onKeyDown={async e => {
              const handled = await handleInCellShortcut(e);
              if (handled) return;
              if (e.key === "Enter") {
                e.preventDefault();
                commitActiveCellIfNeeded();
              }
              else if (e.key === "Tab") {
                e.preventDefault();
                e.currentTarget.blur();
                moveActiveCellHorizontally(e.shiftKey ? -1 : 1);
              }
              else if (e.key === "Escape") {
                e.preventDefault();
                commitActiveCellIfNeeded();
              }
              else if (e.key === "ArrowRight" && !e.shiftKey && e.currentTarget.selectionStart === e.currentTarget.selectionEnd && e.currentTarget.selectionStart === e.currentTarget.value.length) {
                e.preventDefault();
                e.currentTarget.blur();
                moveActiveCellHorizontally(1);
              }
              else if (e.key === "ArrowLeft" && !e.shiftKey && e.currentTarget.selectionStart === e.currentTarget.selectionEnd && e.currentTarget.selectionStart === 0) {
                e.preventDefault();
                e.currentTarget.blur();
                moveActiveCellHorizontally(-1);
              }
              else if (e.key === "ArrowDown" && !e.shiftKey && e.currentTarget.selectionStart === e.currentTarget.selectionEnd && e.currentTarget.selectionStart === e.currentTarget.value.length) {
                e.preventDefault();
                e.currentTarget.blur();
                moveActiveCellVertically(1);
              }
              else if (e.key === "ArrowUp" && !e.shiftKey && e.currentTarget.selectionStart === e.currentTarget.selectionEnd && e.currentTarget.selectionStart === 0) {
                e.preventDefault();
                e.currentTarget.blur();
                moveActiveCellVertically(-1);
              }
            }}
            style={{ userSelect: "text", WebkitUserSelect: "text", MozUserSelect: "text", width: "100%", border: "none", background: "transparent", outline: "none", color: "#f5f5f5" }}
            autoFocus
          />
        </div>
      ) : (displayVal || "\u00A0")}
    </div>
  );
}, areCellPropsEqual);

export default function Tabular({ fileHandle, keyBinds, onSaveStatusChange, onSave, onEdit, onDirtyChange }) {
  const [tableData, setTableData] = useState({});
  const storeRef = useRef(makeFileStore());
  const fileStatsRef = useRef(null);
  const cancelledRef = useRef(false);
  const workbookRef = useRef(null);
  const sheetOverlaysRef = useRef({});
  const savedOverlaysRef = useRef({});
  const onDirtyChangeRef = useRef(onDirtyChange);
  onDirtyChangeRef.current = onDirtyChange;
  const [sheetNames, setSheetNames] = useState([]);
  const [activeSheet, setActiveSheet] = useState(null);
  const unmountedRef = useRef(false);
  const [statsEpoch, setStatsEpoch] = useState(0);
  const [statsProgress, setStatsProgress] = useState(null);
  const [headerRange, setHeaderRange] = useState({ first: 0 });
  const headerRangeRef = useRef(0);
  const [rangeStats, setRangeStats] = useState(null);
  const statsInFlightRef = useRef(null);
  const rangeScanGenerationRef = useRef(0);
  const scrollSettleTimerRef = useRef(null);
  const [scrollSettleTick, setScrollSettleTick] = useState(0);
  const lastVisibleRowRef = useRef(0);
  const tableDataRef = useRef(tableData);
  const [error, setError] = useState(null);
  const hasLoadedFile = useRef(false);
  const [reloadEpoch, setReloadEpoch] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(null);
  const [numRows, setNumRows] = useState(1000);
  const growLockRef = useRef(false);
  const [numCols, setNumCols] = useState(100);
  const [activeCell, setActiveCell] = useState({ row: null, col: null });
  const [cellEditingValue, setCellEditingValue] = useState("");
  const activeInputRef = useRef(null);
  const cellHistoryRef = useRef({ key: null, undo: [], redo: [], suppress: false });
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [clipboardData, setClipboardData] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const menuPortalRef = useRef(null);
  const fileBtnRef = useRef(null);
  const editBtnRef = useRef(null);
  const toolsBtnRef = useRef(null);
  const sortBtnRef = useRef(null);
  const navigateBtnRef = useRef(null);
  const [saveStatus, setSaveStatus] = useState("idle");
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [replaceTerm, setReplaceTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(-1);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [searchPanelPos, setSearchPanelPos] = useState({ x: 100, y: 100 });
  const [searchPanelDragging, setSearchPanelDragging] = useState(false);
  const [searchPanelOffset, setSearchPanelOffset] = useState({ x: 0, y: 0 });
  const searchPanelRef = useRef(null);
  const [selection, setSelection] = useState(null);
  const [selectionEpoch, setSelectionEpoch] = useState(0);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionType, setSelectionType] = useState(null);
  const [justFinishedSelecting, setJustFinishedSelecting] = useState(false);
  const [skipClear, setSkipClear] = useState(false);
  const [selectionDrag, setSelectionDrag] = useState({ active: false, startX: 0, startY: 0, offsetX: 0, offsetY: 0, originalSelection: null, block: null, grabRowOffset: 0, grabColOffset: 0, grabVisibleOffset: 0 });
  const dragRef = useRef(null);
  const previewRef = useRef(null);
  const [isMoving, setIsMoving] = useState(false);
  const [rowHeights, setRowHeights] = useState([]);
  const [colWidths, setColWidths] = useState([]);
  const [headerDrag, setHeaderDrag] = useState(null);
  const [columnFilters, setColumnFilters] = useState({});
  const [openFilterCol, setOpenFilterCol] = useState(null);
  const [filterDropdownPos, setFilterDropdownPos] = useState({ top: 0, left: 0 });
  const filterPortalRef = useRef(null);
  const [filterSearch, setFilterSearch] = useState("");
  const [selectionResize, setSelectionResize] = useState({ active: false, handle: null, startX: 0, startY: 0, initialSelection: null });
  const gridContainerRef = useRef(null);
  const tableWrapperContainerRef = useRef(null);
  const dataGridRef = useRef(null);
  const gridOuterRef = useRef(null);
  const scrollPos = useRef({ left: 0, top: 0 });
  const columnHeaderRef = useRef(null);
  const rowHeaderRef = useRef(null);
  const selectionOverlayRef = useRef(null);
  const [autoSizerDims, setAutoSizerDims] = useState({ width: 0, height: 0 });
  const suppressNextOverlayClickRef = useRef(false);
  const [ctxMenu, setCtxMenu] = useState({ open: false, x: 0, y: 0, items: [] });
  const ctxMenuRef = useRef(null);
  const [formulaPick, setFormulaPick] = useState({ active: false, start: null, end: null });
  const formulaBarRef = useRef(null);
  const SUPPORTED_FUNCS = FORMULA_FUNCTION_NAMES;
  const interactingWithFormulaBarRef = useRef(false);
  const [formulaBarValue, setFormulaBarValue] = useState("");
  const [summaryCollapsed, setSummaryCollapsed] = useState(true);
  const [qualityCollapsed, setQualityCollapsed] = useState(true);
  const computedTableData = useMemo(() => computeTable(storeRef.current), [tableData]);
  const currentFormulaBarContent = useMemo(() => {
    if (activeCell.row !== null && activeCell.col !== null) {
      return cellEditingValue;
    }
    if (selection && selection.top === selection.bottom && selection.left === selection.right) {
      return readFileCell(storeRef.current, selection.top, selection.left) || "";
    }
    return "";
  }, [activeCell.row, activeCell.col, cellEditingValue, selection, tableData]);
  useEffect(() => {
    if (document.activeElement !== formulaBarRef.current) {
      setFormulaBarValue(currentFormulaBarContent);
    }
  }, [currentFormulaBarContent]);
  const saveBannerText =
    saveStatus === "saving" ? "Saving..." :
      saveStatus === "saved" ? "Save successful!" :
        saveStatus === "no-handle" ? "No file handle available." :
          saveStatus === "failed" ? "Save failed!" :
            "";
  useEffect(() => { tableDataRef.current = tableData; storeRef.current.overlay = tableData; }, [tableData]);
  const activateCell = useCallback((row, col) => {
    setSelection(null);
    setActiveCell({ row, col });
    const v = readFileCell(storeRef.current, row, col) || "";
    setCellEditingValue(v);
    setFormulaBarValue(v);
    cellHistoryRef.current = { key: toKey(row, col), undo: [v], redo: [], suppress: false };
  }, []);
  const commitActiveCellIfNeeded = useCallback(() => {
    const { row, col } = activeCell;
    if (row === null || col === null) return;
    const key = toKey(row, col);
    const currentVal =
      (document.activeElement === activeInputRef.current ? activeInputRef.current?.value :
        (document.activeElement === formulaBarRef.current ? formulaBarRef.current?.value : null)) ?? cellEditingValue;
    const oldVal = readFileCellByKey(storeRef.current, key) || "";
    if (oldVal !== currentVal) {
      setUndoStack(prev => [...prev, tableDataRef.current]);
      setRedoStack([]);
      const next = { ...tableDataRef.current, [key]: currentVal };
      applyOverlay(next);
      onSaveStatusChange?.("Unsaved Changes");
      emitEditDiff({ ...tableDataRef.current, [key]: oldVal }, next);
    }
    cellHistoryRef.current = { key: null, undo: [], redo: [], suppress: false };
    setActiveCell({ row: null, col: null });
    setFormulaBarValue("");
  }, [activeCell, cellEditingValue, onEdit, onSaveStatusChange]);
  const withTableMutation = useCallback((mutator) => {
    commitActiveCellIfNeeded();
    const base = tableDataRef.current;
    const next = { ...base };
    mutator(next);
    setUndoStack(prev => [...prev, base]);
    setRedoStack([]);
    applyOverlay(next);
    onSaveStatusChange?.("Unsaved Changes");
    emitEditDiff(base, next);
  }, [commitActiveCellIfNeeded, onEdit, onSaveStatusChange]);
  const clearUIHighlightsAndStates = useCallback(() => {
    commitActiveCellIfNeeded();
    setSelection(null);
    setSearchResults([]);
    setCurrentResultIndex(-1);
    setShowSearchPanel(false);
    setFormulaBarValue("");
  }, [commitActiveCellIfNeeded]);
  const ensureInBounds = useCallback((row, col, effRows, effCols) => ({ row: clampNum(row, 0, effRows - 1), col: clampNum(col, 0, effCols - 1) }), []);
  function reportDirty(overlay) {
    if (typeof onDirtyChangeRef.current !== "function") return;

    const store = storeRef.current;
    const saved = savedOverlaysRef.current;
    const activeKey = store.activeSheet ?? "";
    let dirty = !overlaysMatch(store, overlay, saved[activeKey] || {});

    if (!dirty) {
      for (const name of Object.keys(sheetOverlaysRef.current)) {
        if (name === activeKey) continue;
        if (!overlaysMatch(null, sheetOverlaysRef.current[name] || {}, saved[name] || {})) {
          dirty = true;
          break;
        }
      }
    }

    onDirtyChangeRef.current(dirty);
  }

  function emitEditDiff(beforeOverlay, afterOverlay) {
    if (typeof onEdit === "function") {
      const store = storeRef.current;

      if (store.rowCount > CSV_DIFF_ROW_LIMIT) {
        onEdit({}, {});
      } else {
        const before = generateCSV(beforeOverlay);
        const after = generateCSV(afterOverlay);

        if (before !== after) onEdit({ fullCode: before }, { fullCode: after });
      }
    }

    reportDirty(afterOverlay);
  }

  async function exportWorkbookBlob(bookType) {
    const held = workbookRef.current;
    const store = storeRef.current;

    if (!held) throw new Error("This workbook is no longer available to export.");

    sheetOverlaysRef.current[store.activeSheet] = store.overlay;

    await new Promise((resolve) => setTimeout(resolve, 0));

    const workbook = held.workbook;

    for (const name of held.names) {
      const overlay = sheetOverlaysRef.current[name];

      if (!overlay || Object.keys(overlay).length === 0) continue;

      const sheet = workbook.Sheets[name];

      if (!sheet) continue;

      const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
      const dense = Array.isArray(sheet["!data"]) ? sheet["!data"] : null;

      for (const key of Object.keys(overlay)) {
        const [row, col] = fromKey(key);

        if (dense) {
          if (!dense[row]) dense[row] = [];

          dense[row][col] = { t: "s", v: overlay[key] };
        } else {
          sheet[XLSX.utils.encode_cell({ r: row, c: col })] = { t: "s", v: overlay[key] };
        }

        if (row > range.e.r) range.e.r = row;
        if (col > range.e.c) range.e.c = col;
      }

      sheet["!ref"] = XLSX.utils.encode_range(range);
    }

    const out = XLSX.write(workbook, { bookType, type: "array" });

    return new Blob([out], { type: "application/octet-stream" });
  }

  async function buildWorkbookBlob() {
    const ext = (fileHandle?.name || "").split(".").pop().toLowerCase();

    if (!WORKBOOK_WRITE_TYPES[ext]) {
      throw new Error(`Saving back to .${ext} is not supported. Use Download to export this sheet instead.`);
    }

    return exportWorkbookBlob(WORKBOOK_WRITE_TYPES[ext]);
  }

  async function planDelimitedSave(format) {
    const store = storeRef.current;

    if (store.kind === "sheet" || !store.file || !store.anchors || !store.anchorCount) return null;

    const delimiter = format === "tsv" ? "\t" : format === "psv" ? "|" : ",";

    if (delimiter !== store.delimiter) return null;

    const editedRows = new Set();

    for (const key of Object.keys(store.overlay)) {
      const [row, col] = fromKey(key);

      if (row >= store.rowCount || col >= store.colCount) return null;

      editedRows.add(row);
    }

    if (editedRows.size === 0) return { kind: "noop" };

    const file = store.file;
    const encoder = new TextEncoder();
    const blocks = [];

    for (let anchor = 0; anchor < store.anchorCount; anchor++) {
      const firstRow = anchor * ANCHOR_INTERVAL;

      let dirty = false;

      for (let row = firstRow; row < firstRow + ANCHOR_INTERVAL; row++) {
        if (editedRows.has(row)) {
          dirty = true;
          break;
        }
      }

      if (!dirty) continue;

      const startByte = store.anchors[anchor];
      const endByte = anchor + 1 < store.anchorCount ? store.anchors[anchor + 1] : file.size;
      const text = await file.slice(startByte, endByte).text();
      const eol = text.indexOf("\r\n") === -1 ? "\n" : "\r\n";
      const trailing = text.endsWith("\n");
      const lines = text.split(/\r?\n/);

      if (trailing) lines.pop();

      let rowIndex = firstRow;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (!lineHoldsRow(line, delimiter)) continue;

        if (editedRows.has(rowIndex)) {
          const cells = splitDelimitedRaw(line, delimiter);

          for (let col = 0; col < store.colCount; col++) {
            const overlaid = store.overlay[toKey(rowIndex, col)];

            if (overlaid === undefined) continue;

            while (cells.length <= col) cells.push("");

            cells[col] = encodeDelimitedCell(overlaid, delimiter);
          }

          lines[i] = cells.join(delimiter);
        }

        rowIndex++;
      }

      blocks.push({
        startByte,
        endByte,
        bytes: encoder.encode(lines.join(eol) + (trailing ? eol : ""))
      });
    }

    if (blocks.length === 0) return { kind: "noop" };

    if (blocks.every((block) => block.bytes.byteLength === block.endByte - block.startByte)) {
      return {
        kind: "spot",
        writes: blocks.map((block) => ({ position: block.startByte, data: block.bytes }))
      };
    }

    const position = blocks[0].startByte;
    const parts = [];

    let cursor = position;
    let size = 0;

    for (const block of blocks) {
      if (block.startByte > cursor) {
        parts.push(file.slice(cursor, block.startByte));
        size += block.startByte - cursor;
      }

      parts.push(block.bytes);
      size += block.bytes.byteLength;
      cursor = block.endByte;
    }

    if (cursor < file.size) {
      parts.push(file.slice(cursor, file.size));
      size += file.size - cursor;
    }

    return { kind: "tail", position, blob: new Blob(parts), endSize: position + size };
  }

  async function writeDelimitedPlan(plan) {
    if (plan.kind === "noop") return;

    const needsExistingData = plan.kind === "spot" || plan.position > 0;
    const writable = await fileHandle.createWritable({ keepExistingData: needsExistingData });

    try {
      if (plan.kind === "spot") {
        for (const entry of plan.writes) {
          await writable.write({ type: "write", position: entry.position, data: entry.data });
        }
      } else {
        await writable.write({ type: "write", position: plan.position, data: plan.blob });
        await writable.truncate(plan.endSize);
      }
    } catch (error) {
      await writable.abort?.();

      throw error;
    }

    await writable.close();
  }

  async function buildTextExport(format) {
    const store = storeRef.current;
    const maxRow = Math.max(store.rowCount - 1, 0);

    let maxCol = Math.max(store.colCount - 1, 0);

    for (const key of Object.keys(store.overlay)) {
      const [, col] = fromKey(key);

      if (col > maxCol) maxCol = col;
    }
    const chunks = [];

    let header = [];
    let buffer = "";

    const delimiter = format === "tsv" ? "\t" : format === "psv" ? "|" : ",";

    const quote = (value) => {
      const text = value === null || value === undefined ? "" : String(value);

      if (format === "tsv" || format === "psv") return text.replace(/[\t|\r\n]/g, " ");

      return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };

    for (let block = 0; block <= maxRow; block += WINDOW_ROWS) {
      const blockEnd = Math.min(block + WINDOW_ROWS - 1, maxRow);
      const rows = await readRowsUncached(store, block, blockEnd);

      for (const [rowIndex, cells] of rows) {
        const values = [];

        for (let c = 0; c <= maxCol; c++) {
          const overlaid = store.overlay[toKey(rowIndex, c)];

          values.push(overlaid !== undefined ? overlaid : (cells[c] ?? ""));
        }

        if (rowIndex === 0 && (format === "json" || format === "md")) {
          header = values.map((v, i) => (String(v).trim() === "" ? `Column ${i + 1}` : String(v)));

          if (format === "md") {
            buffer += `| ${header.join(" | ")} |\n`;
            buffer += `| ${header.map(() => "---").join(" | ")} |\n`;
          }

          continue;
        }

        if (format === "json") {
          const record = {};

          for (let c = 0; c < values.length; c++) record[header[c] || `Column ${c + 1}`] = values[c];

          buffer += `${chunks.length === 0 && buffer === "" ? "" : ",\n"}${JSON.stringify(record)}`;
        } else if (format === "md") {
          buffer += `| ${values.map((v) => String(v).replace(/\|/g, "\\|")).join(" | ")} |\n`;
        } else {
          buffer += `${values.map(quote).join(delimiter)}\n`;
        }

        if (buffer.length >= CSV_CHUNK_CHARS) {
          chunks.push(buffer);
          buffer = "";

          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
    }

    if (buffer.length) chunks.push(buffer);

    if (format === "json") return new Blob(["[\n", ...chunks, "\n]\n"], { type: "application/json" });

    return new Blob(chunks, { type: format === "md" ? "text/markdown" : "text/plain" });
  }

  function saveTextFormat() {
    const ext = (fileHandle?.name || "").split(".").pop().toLowerCase();
    const delimiter = DELIMITED_EXTENSIONS[ext];

    if (delimiter === "\t") return "tsv";
    if (delimiter === "|") return "psv";

    return "csv";
  }

  function generateCSV(overlayOverride) {
    const store = overlayOverride
      ? { ...storeRef.current, overlay: overlayOverride }
      : storeRef.current;
    const maxRow = Math.max(store.rowCount - 1, 0);
    let maxCol = Math.max(store.colCount - 1, 0);

    for (const key of Object.keys(store.overlay)) {
      const comma = key.indexOf(",");
      const col = Number(key.slice(comma + 1));

      if (col > maxCol) maxCol = col;
    }
    const lines = [];

    let lastNonEmptyRow = -1;

    for (let r = 0; r <= maxRow; r++) {
      const rowCells = [];
      let rowHas = false;

      for (let c = 0; c <= maxCol; c++) {
        const v = readFileCell(store, r, c) || "";

        if (v !== "") rowHas = true;

        rowCells.push(/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
      }

      lines.push(rowCells.join(","));

      if (rowHas) lastNonEmptyRow = r;
    }

    return lines.slice(0, lastNonEmptyRow + 1).join("\n");
  }

  const applyTableData = useCallback((next) => {
    emitEditDiff(tableDataRef.current, next);
    applyOverlay(next);
    onSaveStatusChange?.("Unsaved Changes");
  }, [onEdit, onSaveStatusChange]);
  useEffect(() => {
    if (activeCell.row === null && selection && selection.top === selection.bottom && selection.left === selection.right) {
      const value = readFileCell(storeRef.current, selection.top, selection.left) || "";
      if (document.activeElement !== formulaBarRef.current) {
        setFormulaBarValue(value);
      }
    } else if (!selection && activeCell.row === null) {
      if (document.activeElement !== formulaBarRef.current) {
        setFormulaBarValue("");
      }
    }
  }, [selection, activeCell.row, tableData]);
  useEffect(() => { setSelectionEpoch(e => e + 1); }, [selection?.top, selection?.left, selection?.bottom, selection?.right]);
  const minNeededCols = useMemo(() => autoSizerDims.width ? Math.ceil(autoSizerDims.width / DEFAULT_COL_WIDTH) + 5 : 20, [autoSizerDims.width]);
  const minNeededRows = useMemo(() => autoSizerDims.height ? Math.ceil(autoSizerDims.height / DEFAULT_ROW_HEIGHT) + 10 : 50, [autoSizerDims.height]);
  const effectiveRows = useMemo(() => Math.max(numRows, minNeededRows), [numRows, minNeededRows]);
  const effectiveCols = useMemo(() => Math.max(numCols, minNeededCols), [numCols, minNeededCols]);
  useEffect(() => { setRowHeights(prev => { const out = prev.slice(0, effectiveRows); while (out.length < effectiveRows) out.push(DEFAULT_ROW_HEIGHT); return out; }); }, [effectiveRows]);
  useEffect(() => { setColWidths(prev => { const out = prev.slice(0, effectiveCols); while (out.length < effectiveCols) out.push(DEFAULT_COL_WIDTH); return out; }); }, [effectiveCols]);
  const rowHeightsCumulative = useMemo(() => { const cum = [0]; for (let i = 0; i < rowHeights.length; i++) cum.push(cum[i] + (rowHeights[i] || DEFAULT_ROW_HEIGHT)); return cum; }, [rowHeights]);
  const colWidthsCumulative = useMemo(() => { const cum = [0]; for (let i = 0; i < colWidths.length; i++) cum.push(cum[i] + (colWidths[i] || DEFAULT_COL_WIDTH)); return cum; }, [colWidths]);
  const filterOptions = useMemo(() => {
    if (openFilterCol === null) return {};

    const store = storeRef.current;
    const sets = [];

    for (let c = 0; c < effectiveCols; c++) sets.push(new Set());

    for (const rows of store.windows.values()) {
      for (const [, cells] of rows) {
        for (let c = 0; c < cells.length && c < effectiveCols; c++) {
          const v = cells[c];
          if (v && v.trim() !== "" && sets[c].size < FILTER_OPTION_LIMIT) sets[c].add(v);
        }
      }
    }

    for (const key of Object.keys(store.overlay)) {
      const comma = key.indexOf(",");
      const c = Number(key.slice(comma + 1));

      if (c < effectiveCols) {
        const v = store.overlay[key];
        if (v && v.trim() !== "" && sets[c].size < FILTER_OPTION_LIMIT) sets[c].add(v);
      }
    }

    const options = {};
    for (let c = 0; c < effectiveCols; c++) options[c] = Array.from(sets[c]);
    return options;
  }, [tableData, effectiveCols, openFilterCol]);
  const hasActiveFilter = useMemo(() => Object.values(columnFilters).some(arr => Array.isArray(arr) && arr.length > 0), [columnFilters]);

  const [windowEpoch, setWindowEpoch] = useState(0);

  const applyOverlay = useCallback((nextOverlay) => {
    tableDataRef.current = nextOverlay;
    storeRef.current.overlay = nextOverlay;
    setTableData(nextOverlay);
    setWindowEpoch(n => n + 1);
  }, []);

  const ensureRowWindow = useCallback((firstVisibleRow) => {
    const store = storeRef.current;

    if (!store.file || store.rowCount === 0) return;

    const centre = windowIndexForRow(Math.max(0, firstVisibleRow));
    const lastWindow = windowIndexForRow(Math.max(0, store.rowCount - 1));
    const wanted = [];

    for (let w = centre - 1; w <= centre + 2; w++) {
      if (w >= 0 && w <= lastWindow && !store.windows.has(w) && !store.pending.has(w)) {
        wanted.push(w);
      }
    }

    if (wanted.length === 0) return;

    Promise.all(wanted.map(w => loadWindow(store, w * WINDOW_ROWS)))
      .then(() => setWindowEpoch(n => n + 1))
      .catch(() => { });
  }, []);

  const statsRequestedRef = useRef(false);

  const ensureFileStats = useCallback(async () => {
    if (fileStatsRef.current?.complete) {
      return fileStatsRef.current;
    }

    if (statsInFlightRef.current) {
      return statsInFlightRef.current;
    }

    const store = storeRef.current;

    if (!storeHasData(store)) {
      return null;
    }

    setStatsProgress(0);

    let lastPublish = 0;

    const onTick = (percent, partial) => {
      setStatsProgress(percent);

      if (!partial) return;

      const now = Date.now();

      if (now - lastPublish < PARTIAL_STATS_INTERVAL_MS) return;

      lastPublish = now;
      fileStatsRef.current = { ...partial, complete: false };
      setStatsEpoch(n => n + 1);
    };

    const run = computeFileStats(store, onTick, () => unmountedRef.current)
      .then((stats) => {
        setStatsProgress(null);
        statsInFlightRef.current = null;

        if (stats.complete) {
          fileStatsRef.current = stats;
          setStatsEpoch(n => n + 1);
        } else {
          statsRequestedRef.current = false;
        }

        return stats;
      })
      .catch(() => {
        setStatsProgress(null);
        statsInFlightRef.current = null;
        statsRequestedRef.current = false;
        return null;
      });

    statsInFlightRef.current = run;

    return run;
  }, []);

  const computeRangeStats = useCallback(async (range) => {
    const store = storeRef.current;

    if (!storeHasData(store)) return null;

    const generation = ++rangeScanGenerationRef.current;

    const numbers = [];
    const unique = new Set();

    let totalCells = 0;
    let nullCount = 0;
    let naCount = 0;
    let numericCount = 0;
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;

    const colsWide = range.right - range.left + 1;
    const rowBudget = Math.max(WINDOW_ROWS, Math.floor(RANGE_SCAN_CELL_LIMIT / Math.max(1, colsWide)));
    const firstRow = Math.max(0, range.top);
    const lastDataRow = Math.min(range.bottom, Math.max(0, store.rowCount - 1), firstRow + rowBudget - 1);

    let truncated = range.bottom > lastDataRow;

    for (let first = firstRow; first <= lastDataRow; first += WINDOW_ROWS) {
      if (generation !== rangeScanGenerationRef.current) return null;

      const last = Math.min(first + WINDOW_ROWS - 1, lastDataRow);
      const rows = await readRowsUncached(store, first, last);

      if (generation !== rangeScanGenerationRef.current) return null;

      for (const [rowIndex, cells] of rows) {
        for (let c = range.left; c <= range.right; c++) {
          const overlaid = store.overlay[toKey(rowIndex, c)];
          const value = overlaid !== undefined ? overlaid : (cells[c] ?? "");

          totalCells++;

          if (unique.size < SUMMARY_UNIQUE_LIMIT) unique.add(value);

          if (value === "") {
            nullCount++;
            continue;
          }

          if (value.length < 8) {
            const lowered = value.toLowerCase();

            if (lowered === "n/a" || lowered === "null" || lowered === "na" || lowered === "nan") {
              naCount++;
              continue;
            }
          }

          const num = Number(value);

          if (Number.isFinite(num)) {
            numericCount++;
            sum += num;
            if (num < min) min = num;
            if (num > max) max = num;
            if (numbers.length < SUMMARY_MEDIAN_SAMPLE) numbers.push(num);
          }
        }
      }
    }

    const sorted = numbers.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const mean = numericCount ? sum / numericCount : 0;

    let squared = 0;
    for (let n = 0; n < sorted.length; n++) squared += (sorted[n] - mean) ** 2;

    return {
      count: numericCount,
      mean,
      median: sorted.length ? (sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]) : 0,
      stdDev: sorted.length ? Math.sqrt(squared / sorted.length) : 0,
      min: numericCount ? min : 0,
      max: numericCount ? max : 0,
      nullCount,
      naCount,
      missingPercent: totalCells ? ((nullCount + naCount) / totalCells) * 100 : 0,
      uniqueValues: unique.size,
      duplicateCount: Math.max(0, totalCells - unique.size),
      complete: !truncated,
      truncated
    };
  }, []);

  const countSelectedCells = useCallback(async (range) => {
    const store = storeRef.current;

    if (!storeHasData(store)) return 0;

    let count = 0;

    const lastDataRow = Math.max(0, store.rowCount - 1);

    for (let first = Math.max(0, range.top); first <= Math.min(range.bottom, lastDataRow); first += WINDOW_ROWS) {
      const last = Math.min(first + WINDOW_ROWS - 1, range.bottom, lastDataRow);
      const rows = await readRowsUncached(store, first, last);

      for (const [rowIndex, cells] of rows) {
        for (let c = range.left; c <= range.right; c++) {
          const overlaid = store.overlay[toKey(rowIndex, c)];
          const value = overlaid !== undefined ? overlaid : (cells[c] ?? "");

          if (value.trim() !== "") count++;
        }
      }
    }

    return count;
  }, []);

  useEffect(() => {
    if (loading) return;
    if (summaryCollapsed && qualityCollapsed) return;
    if (statsRequestedRef.current) return;

    statsRequestedRef.current = true;
    ensureFileStats();
  }, [loading, summaryCollapsed, qualityCollapsed, ensureFileStats, statsEpoch]);



  const lastDataRow = useCallback(() => Math.max(0, (storeRef.current.rowCount || 1) - 1), []);
  const lastDataCol = useCallback(() => {
    const store = storeRef.current;

    let widest = 0;

    for (const rows of store.windows.values()) {
      for (const [, cells] of rows) {
        let lastFilled = -1;

        for (let c = cells.length - 1; c >= 0; c--) {
          if (cells[c] !== "") {
            lastFilled = c;
            break;
          }
        }

        if (lastFilled + 1 > widest) widest = lastFilled + 1;
      }
    }

    for (const key of Object.keys(store.overlay)) {
      if (store.overlay[key] === "") continue;

      const comma = key.indexOf(",");
      const col = Number(key.slice(comma + 1));

      if (col + 1 > widest) widest = col + 1;
    }

    if (widest === 0) return Math.max(0, (store.colCount || 1) - 1);

    return widest - 1;
  }, []);

  const coversWholeFile = useCallback((range) => {
    if (!range) return false;

    const store = storeRef.current;
    const lastRow = Math.max(0, store.rowCount - 1);

    return range.top <= 0
      && range.left <= 0
      && range.bottom >= lastRow
      && range.right >= lastDataCol();
  }, [lastDataCol]);

  useEffect(() => {
    if (loading || (summaryCollapsed && qualityCollapsed)) return;

    const isRange = Boolean(selection)
      && (selection.top !== selection.bottom || selection.left !== selection.right);

    if (!isRange || coversWholeFile(selection)) {
      setRangeStats(null);
      return;
    }

    let stale = false;

    const timer = setTimeout(() => {
      if (stale) return;

      setStatsProgress(0);

      computeRangeStats(selection)
        .then((result) => {
          if (stale) return;
          setStatsProgress(null);
          setRangeStats(result);
        })
        .catch(() => {
          if (stale) return;
          setStatsProgress(null);
        });
    }, RANGE_STATS_DEBOUNCE_MS);

    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [selection, loading, summaryCollapsed, qualityCollapsed, computeRangeStats, ensureRowWindow, scrollSettleTick]);

  const growToFitScroll = useCallback((scrollLeft, scrollTop, viewportWidth, viewportHeight) => {
    if (hasActiveFilter || growLockRef.current) return;

    const totalHeight = rowHeightsCumulative[rowHeightsCumulative.length - 1] || 0;
    const totalWidth = colWidthsCumulative[colWidthsCumulative.length - 1] || 0;

    let grew = false;

    if (totalHeight > viewportHeight && scrollTop > 0
      && totalHeight - (scrollTop + viewportHeight) < GROWTH_TRIGGER_PX) {
      setNumRows(current => Math.max(current, effectiveRows) + ROW_GROWTH_STEP);
      grew = true;
    }

    if (totalWidth > viewportWidth && scrollLeft > 0
      && totalWidth - (scrollLeft + viewportWidth) < GROWTH_TRIGGER_PX) {
      setNumCols(current => Math.max(current, effectiveCols) + COL_GROWTH_STEP);
      grew = true;
    }

    if (grew) {
      growLockRef.current = true;
      setTimeout(() => { growLockRef.current = false; }, 250);
    }
  }, [hasActiveFilter, rowHeightsCumulative, colWidthsCumulative, effectiveRows, effectiveCols]);
  const filteredRows = useMemo(() => {
    if (!hasActiveFilter) return EMPTY_ROWS;
    const result = [];
    const activeCols = Object.keys(columnFilters).map(Number).filter(c => (columnFilters[c] || []).length > 0);
    for (let r = 0; r < effectiveRows; r++) {
      let include = true;
      for (const col of activeCols) {
        const allowed = columnFilters[col];
        const cell = (readFileCell(storeRef.current, r, col) || "").trim();
        if (!allowed.includes(cell)) { include = false; break; }
      }
      if (include) result.push(r);
    }
    return result;
  }, [tableData, columnFilters, effectiveRows, hasActiveFilter]);
  const filteredRowHeightsCumulative = useMemo(() => {
    const cum = [0];
    for (let i = 0; i < filteredRows.length; i++) { const ar = filteredRows[i]; cum.push(cum[i] + (rowHeights[ar] || DEFAULT_ROW_HEIGHT)); }
    return cum;
  }, [filteredRows, rowHeights]);
  const visibleToActualRow = useCallback((i) => hasActiveFilter ? (filteredRows[i] ?? 0) : i, [hasActiveFilter, filteredRows]);
  const actualToVisibleIndex = useCallback((ar) => hasActiveFilter ? filteredRows.indexOf(ar) : ar, [hasActiveFilter, filteredRows]);
  const nextVisibleActualRow = useCallback((ar, delta) => {
    if (!hasActiveFilter) return clampNum(ar + delta, 0, effectiveRows - 1);
    const i = actualToVisibleIndex(ar);
    if (i === -1) return filteredRows[delta > 0 ? 0 : Math.max(0, filteredRows.length - 1)] ?? 0;
    const newI = clampNum(i + delta, 0, filteredRows.length - 1);
    return filteredRows[newI] ?? ar;
  }, [hasActiveFilter, filteredRows, effectiveRows, actualToVisibleIndex]);
  const forEachSelectedCell = useCallback((sel, fn) => {
    if (!sel) return;
    const rows = hasActiveFilter
      ? (() => {
        const s = actualToVisibleIndex(sel.top), e = actualToVisibleIndex(sel.bottom);
        if (s === -1 || e === -1) return [];
        const [from, to] = [Math.min(s, e), Math.max(s, e)];
        return filteredRows.slice(from, to + 1);
      })()
      : Array.from({ length: sel.bottom - sel.top + 1 }, (_, i) => sel.top + i);
    for (const r of rows) for (let c = sel.left; c <= sel.right; c++) fn(r, c);
  }, [hasActiveFilter, actualToVisibleIndex, filteredRows]);
  const getSelectedActualRowList = useCallback(sel => {
    const out = [];
    forEachSelectedCell(sel, (r, c) => { if (c === sel.left) out.push(r); });
    return Array.from(new Set(out));
  }, [forEachSelectedCell]);
  const addRow = useCallback(() => { setNumRows(n => n + 1); }, []);
  const addColumn = useCallback(() => { setNumCols(n => n + 1); }, []);
  const handleUndo = useCallback(() => {
    commitActiveCellIfNeeded();
    if (!undoStack.length) return;
    const currentState = { ...tableDataRef.current };
    const previousState = undoStack[undoStack.length - 1];
    setUndoStack(s => s.slice(0, -1));
    setRedoStack(r => [...r, currentState]);
    applyOverlay(previousState);
    onSaveStatusChange?.("Unsaved Changes");
    emitEditDiff(currentState, previousState);
  }, [undoStack, commitActiveCellIfNeeded, onEdit, onSaveStatusChange]);
  const handleRedo = useCallback(() => {
    commitActiveCellIfNeeded();
    if (!redoStack.length) return;
    const currentState = { ...tableDataRef.current };
    const nextState = redoStack[redoStack.length - 1];
    setRedoStack(r => r.slice(0, -1));
    setUndoStack(s => [...s, currentState]);
    applyOverlay(nextState);
    onSaveStatusChange?.("Unsaved Changes");
    emitEditDiff(currentState, nextState);
  }, [redoStack, commitActiveCellIfNeeded, onEdit, onSaveStatusChange]);
  const handleSelectAll = useCallback(() => {
    commitActiveCellIfNeeded();
    if (hasActiveFilter) {
      if (!filteredRows.length) { setSelection(null); return; }
      setSelection({ top: filteredRows[0], left: 0, bottom: filteredRows[filteredRows.length - 1], right: effectiveCols - 1 });
    } else {
      setSelection({ top: 0, left: 0, bottom: effectiveRows - 1, right: effectiveCols - 1 });
    }
  }, [commitActiveCellIfNeeded, hasActiveFilter, filteredRows, effectiveCols, effectiveRows]);
  const readSelectionValues = useCallback(async (range) => {
    const store = storeRef.current;
    const clip = {};

    if (!storeHasData(store)) return clip;

    const firstRow = Math.max(0, range.top);
    const lastRow = Math.min(range.bottom, Math.max(0, store.rowCount - 1));

    for (let block = firstRow; block <= lastRow; block += WINDOW_ROWS) {
      const blockEnd = Math.min(block + WINDOW_ROWS - 1, lastRow);
      const rows = await readRowsUncached(store, block, blockEnd);

      for (const [rowIndex, cells] of rows) {
        for (let c = range.left; c <= range.right; c++) {
          const key = toKey(rowIndex, c);
          const overlaid = store.overlay[key];

          clip[key] = overlaid !== undefined ? overlaid : (cells[c] ?? "");
        }
      }
    }

    return clip;
  }, []);

  const handleCut = useCallback(async () => {
    commitActiveCellIfNeeded();
    if (!selection) return;
    setClipboardData(await readSelectionValues(selection));
    withTableMutation(next => { forEachSelectedCell(selection, (r, c) => { next[toKey(r, c)] = ""; }); });
  }, [selection, forEachSelectedCell, withTableMutation, commitActiveCellIfNeeded]);
  const handleCopy = useCallback(async () => {
    commitActiveCellIfNeeded();
    if (!selection) return;
    setClipboardData(await readSelectionValues(selection));
  }, [selection, readSelectionValues, commitActiveCellIfNeeded]);
  const handleClearSelection = useCallback(() => {
    if (!selection) return;
    withTableMutation(next => { forEachSelectedCell(selection, (r, c) => { next[toKey(r, c)] = ""; }); });
  }, [selection, withTableMutation, forEachSelectedCell]);
  const handlePaste = useCallback(async () => {
    commitActiveCellIfNeeded();
    if (!selection || !clipboardData) return;
    const keys = Object.keys(clipboardData);
    let minR = Infinity, minC = Infinity, maxR = -Infinity, maxC = -Infinity;
    keys.forEach(k => { const [r, c] = fromKey(k); minR = Math.min(minR, r); maxR = Math.max(maxR, r); minC = Math.min(minC, c); maxC = Math.max(maxC, c); });
    const rs = maxR - minR + 1, cs = maxC - minC + 1;
    const destR = selection.top, destC = selection.left;
    let shouldAlert = false;
    outer: for (let r = 0; r < rs; r++) for (let c = 0; c < cs; c++) {
      const dk = toKey(destR + r, destC + c);
      const dv = (readFileCellByKey(storeRef.current, dk) || "").trim();
      const sv = (clipboardData[toKey(minR + r, minC + c)] || "").trim();
      if (dv !== "" && dv !== sv) { shouldAlert = true; break outer; }
    }
    if (shouldAlert) {
      const res = await showDialog({ title: "System Alert", message: "The data being pasted over will be replaced. Do you want to continue?", showCancel: true });
      if (res === null) return;
    }
    withTableMutation(next => {
      for (let r = 0; r < rs; r++) for (let c = 0; c < cs; c++) {
        const sk = toKey(minR + r, minC + c), dk = toKey(destR + r, destC + c);
        const v = clipboardData[sk];
        next[dk] = v !== undefined ? v : "";
      }
    });
    setActiveCell({ row: null, col: null });
    document.activeElement?.blur?.();
  }, [selection, clipboardData, commitActiveCellIfNeeded, withTableMutation]);
  const sortTableByColumn = useCallback(async (command) => {
    setOpenMenu(null);
    commitActiveCellIfNeeded();

    const sel = selection || (hasActiveFilter && filteredRows.length
      ? { top: filteredRows[0], left: 0, bottom: filteredRows[filteredRows.length - 1], right: effectiveCols - 1 }
      : { top: 0, left: 0, bottom: effectiveRows - 1, right: effectiveCols - 1 });
    const sortCol = sel.left, startRow = sel.top, endRow = sel.bottom;
    const store = storeRef.current;
    const rowCells = new Map();

    for (let block = startRow; block <= endRow; block += WINDOW_ROWS) {
      const blockEnd = Math.min(block + WINDOW_ROWS - 1, endRow);
      const rows = await readRowsUncached(store, block, blockEnd);

      for (const [rowIndex, cells] of rows) rowCells.set(rowIndex, cells);
    }

    const cellAt = (row, col) => {
      const overlaid = store.overlay[toKey(row, col)];

      if (overlaid !== undefined) return overlaid;

      const cells = rowCells.get(row);

      return cells ? (cells[col] ?? "") : "";
    };

    const rowsToSort = []; for (let i = 0; i <= (endRow - startRow); i++) rowsToSort.push(startRow + i);
    rowsToSort.sort((a, b) => {
      const aVal = cellAt(a, sortCol), bVal = cellAt(b, sortCol);
      const aE = !aVal || aVal === "", bE = !bVal || bVal === "";
      if (aE && !bE) return 1; if (!aE && bE) return -1; if (aE && bE) return 0;
      if (command === "sortAZ" || command === "sortZA") { const aS = aVal.toString().toLowerCase(), bS = bVal.toString().toLowerCase(); return command === "sortAZ" ? aS.localeCompare(bS) : bS.localeCompare(aS); }
      else { const aN = parseFloat(aVal) || 0, bN = parseFloat(bVal) || 0; return command === "sortNumericAsc" ? aN - bN : bN - aN; }
    });

    const ordered = rowsToSort.map((sourceRow) => {
      const values = [];

      for (let col = 0; col < effectiveCols; col++) values.push(cellAt(sourceRow, col));

      return values;
    });

    withTableMutation(newTableData => {
      for (let idx = 0; idx < ordered.length; idx++) {
        const targetRow = startRow + idx;

        for (let col = 0; col < effectiveCols; col++) {
          newTableData[toKey(targetRow, col)] = ordered[idx][col];
        }
      }
    });
  }, [selection, hasActiveFilter, filteredRows, effectiveCols, effectiveRows, withTableMutation, commitActiveCellIfNeeded]);
  function highlightAll(term) {
    commitActiveCellIfNeeded();
    if (!term) { setSearchResults([]); setCurrentResultIndex(-1); return; }
    const results = [], cmpTerm = caseSensitive ? term : term.toLowerCase();
    Object.keys(tableDataRef.current).forEach(k => {
      const orig = readFileCellByKey(storeRef.current, k); if (!orig) return;
      const cmpVal = caseSensitive ? orig : orig.toLowerCase();
      let s = 0; while (true) {
        const p = cmpVal.indexOf(cmpTerm, s); if (p === -1) break;
        const [r, c] = fromKey(k); results.push({ row: r, col: c, indexInCell: p, length: term.length }); s = p + term.length;
      }
    });
    setSearchResults(results); setCurrentResultIndex(results.length ? 0 : -1);
  }
  const goToNext = () => { if (searchResults.length) setCurrentResultIndex(i => (i + 1) % searchResults.length); };
  const goToPrevious = () => { if (searchResults.length) setCurrentResultIndex(i => (i - 1 + searchResults.length) % searchResults.length); };
  function replaceCurrent() {
    commitActiveCellIfNeeded();
    if (currentResultIndex < 0 || currentResultIndex >= searchResults.length) return;
    const r = searchResults[currentResultIndex];
    const oldVal = readFileCell(storeRef.current, r.row, r.col) || "";
    const nv = oldVal.slice(0, r.indexInCell) + replaceTerm + oldVal.slice(r.indexInCell + r.length);
    withTableMutation(next => { next[toKey(r.row, r.col)] = nv; });
    setTimeout(() => highlightAll(searchTerm), 0);
  }
  function replaceAll() {
    commitActiveCellIfNeeded();
    if (!searchResults.length) return;
    withTableMutation(next => {
      for (const r of searchResults) {
        const k = toKey(r.row, r.col), ov = next[k] || ""; if (!ov) continue;
        next[k] = caseSensitive ? ov.replaceAll(searchTerm, replaceTerm)
          : ov.replace(new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), replaceTerm);
      }
    });
    setTimeout(() => highlightAll(searchTerm), 0);
  }
  const getRowHeight = useCallback((index) => { const ar = hasActiveFilter ? filteredRows[index] : index; return ar !== undefined ? (rowHeights[ar] || DEFAULT_ROW_HEIGHT) : DEFAULT_ROW_HEIGHT; }, [hasActiveFilter, filteredRows, rowHeights]);
  const getColWidth = useCallback((index) => colWidths[index] || DEFAULT_COL_WIDTH, [colWidths]);

  const hasCustomSizes = useMemo(() => {
    for (let i = 0; i < rowHeights.length; i++) {
      if (rowHeights[i] !== undefined && rowHeights[i] !== DEFAULT_ROW_HEIGHT) return true;
    }

    for (let i = 0; i < colWidths.length; i++) {
      if (colWidths[i] !== undefined && colWidths[i] !== DEFAULT_COL_WIDTH) return true;
    }

    return false;
  }, [rowHeights, colWidths]);

  const visibleRowHeaderIndices = useMemo(() => {
    const total = hasActiveFilter ? filteredRows.length : effectiveRows;

    if (total === 0) return EMPTY_ROWS;

    const viewportHeight = autoSizerDims.height || 600;
    const first = Math.max(0, headerRange.first - ROW_HEADER_OVERSCAN);
    const span = Math.ceil(viewportHeight / DEFAULT_ROW_HEIGHT) + ROW_HEADER_OVERSCAN * 2;
    const last = Math.min(total - 1, first + span);
    const out = [];

    for (let r = first; r <= last; r++) out.push(r);

    return out;
  }, [hasActiveFilter, filteredRows, effectiveRows, autoSizerDims.height, headerRange.first]);
  const getVisibleRowIndexFromPosition = useCallback((y) => { if (hasActiveFilter) return idxFromCumulative(filteredRowHeightsCumulative, y); return idxFromCumulativeExtend(rowHeightsCumulative, y, DEFAULT_ROW_HEIGHT); }, [hasActiveFilter, filteredRowHeightsCumulative, rowHeightsCumulative]);
  const getColIndexFromPosition = useCallback((x) => { return idxFromCumulativeExtend(colWidthsCumulative, x, DEFAULT_COL_WIDTH); }, [colWidthsCumulative]);

  const jumpTo = useCallback(async (rowIndex, colIndex, align = "start") => {
    commitActiveCellIfNeeded();

    const store = storeRef.current;
    const targetRow = Math.max(0, rowIndex);
    const targetCol = Math.max(0, colIndex);

    growLockRef.current = true;

    const primeWindowsAround = async (row) => {
      if (!storeHasData(store)) return;

      const centre = windowIndexForRow(row);
      const lastWindow = windowIndexForRow(Math.max(0, store.rowCount - 1));
      const wanted = [];

      for (let w = centre - 1; w <= centre + 2; w++) {
        if (w >= 0 && w <= lastWindow) wanted.push(w);
      }

      await Promise.all(wanted.map(w => loadWindow(store, w * WINDOW_ROWS)));
    };

    const syncHeadersToScroll = () => {
      const outer = gridOuterRef.current;

      if (!outer) return null;

      const top = outer.scrollTop;
      const left = outer.scrollLeft;

      if (columnHeaderRef.current?.firstChild) {
        columnHeaderRef.current.firstChild.style.transform = `translateX(-${left}px)`;
      }

      if (rowHeaderRef.current?.firstChild) {
        rowHeaderRef.current.firstChild.style.transform = `translateY(-${top}px)`;
      }

      scrollPos.current = { left, top };

      return { top, left };
    };

    await primeWindowsAround(targetRow);

    dataGridRef.current?.scrollToItem?.({ rowIndex: targetRow, columnIndex: targetCol, align });

    await new Promise((resolve) => requestAnimationFrame(() => resolve()));

    const landed = syncHeadersToScroll();
    const landedRow = landed ? getVisibleRowIndexFromPosition(landed.top) : targetRow;

    lastVisibleRowRef.current = landedRow;
    headerRangeRef.current = landedRow;
    setHeaderRange({ first: landedRow });

    await primeWindowsAround(landedRow);

    setSelection({ top: targetRow, left: targetCol, bottom: targetRow, right: targetCol });
    setWindowEpoch(n => n + 1);

    window.setTimeout(() => {
      growLockRef.current = false;
    }, JUMP_GROWTH_LOCK_MS);
  }, [commitActiveCellIfNeeded, rowHeightsCumulative, colWidthsCumulative, getVisibleRowIndexFromPosition, getColIndexFromPosition]);

  useEffect(() => {
    if (loading) return;

    ensureRowWindow(getVisibleRowIndexFromPosition(scrollPos.current?.top || 0));
  }, [loading, effectiveRows, ensureRowWindow, getVisibleRowIndexFromPosition]);
  const buildRefTextForPick = useCallback((start, end) => {
    if (!start || !end) return "";
    const r1 = Math.min(start.row, end.row), r2 = Math.max(start.row, end.row);
    const c1 = Math.min(start.col, end.col), c2 = Math.max(start.col, end.col);
    if (!hasActiveFilter) {
      return (r1 === r2 && c1 === c2)
        ? a1FromRC(r1, c1)
        : `${a1FromRC(r1, c1)}:${a1FromRC(r2, c2)}`;
    }
    const v1 = actualToVisibleIndex(r1);
    const v2 = actualToVisibleIndex(r2);
    if (v1 === -1 && v2 === -1) return "";
    const from = Math.max(0, Math.min(v1 === -1 ? 0 : v1, v2 === -1 ? filteredRows.length - 1 : v2));
    const to = Math.min(filteredRows.length - 1, Math.max(v1 === -1 ? 0 : v1, v2 === -1 ? filteredRows.length - 1 : v2));
    const visibleActuals = filteredRows.slice(from, to + 1);
    if (!visibleActuals.length) return "";
    const blocks = [];
    let bStart = visibleActuals[0], last = visibleActuals[0];
    for (let i = 1; i < visibleActuals.length; i++) {
      const cur = visibleActuals[i];
      if (cur !== last + 1) { blocks.push([bStart, last]); bStart = cur; }
      last = cur;
    }
    blocks.push([bStart, last]);
    const parts = blocks.map(([br1, br2]) =>
      (br1 === br2 && c1 === c2)
        ? a1FromRC(br1, c1)
        : `${a1FromRC(br1, c1)}:${a1FromRC(br2, c2)}`
    );
    return parts.join(",");
  }, [hasActiveFilter, filteredRows, actualToVisibleIndex]);
  function insertRefIntoActiveInput(refText, { overrideInCurrentArgument = true } = {}) {
    const target = (document.activeElement === activeInputRef.current)
      ? activeInputRef.current
      : (document.activeElement === formulaBarRef.current ? formulaBarRef.current : activeInputRef.current);
    if (!target) return;
    const original = target.value;
    let base = original;
    let start = target.selectionStart ?? original.length;
    let end = target.selectionEnd ?? start;
    if (!original.trim().startsWith("=")) {
      base = "=" + original.replace(/^\s+/, "");
      const delta = base.length - original.length;
      start += delta; end += delta;
    }
    let newVal;
    if (overrideInCurrentArgument && isExpectingFunctionRange(base, start)) {
      const leftPart = base.slice(0, start);
      const rightPart = base.slice(start);
      const lastParen = leftPart.lastIndexOf("(");
      const lastComma = leftPart.lastIndexOf(",");
      const argStart = Math.max(lastParen, lastComma) + 1;
      const nextComma = rightPart.indexOf(",");
      const nextParen = rightPart.indexOf(")");
      let argEndInRight = rightPart.length;
      if (nextComma !== -1) argEndInRight = Math.min(argEndInRight, nextComma);
      if (nextParen !== -1) argEndInRight = Math.min(argEndInRight, nextParen);
      const argEnd = start + argEndInRight;
      newVal = base.slice(0, argStart) + refText + base.slice(argEnd);
      const caret = argStart + refText.length;
      setCellEditingValue(newVal);
      const h = cellHistoryRef.current;
      if (h.undo[h.undo.length - 1] !== newVal) { h.undo.push(newVal); h.redo = []; }
      requestAnimationFrame(() => { try { target.focus(); target.setSelectionRange(caret, caret); } catch { } });
      return;
    }
    const before = base.slice(0, start);
    const after = base.slice(end);
    newVal = before + refText + after;
    setCellEditingValue(newVal);
    const h = cellHistoryRef.current;
    if (h.undo[h.undo.length - 1] !== newVal) { h.undo.push(newVal); h.redo = []; }
    requestAnimationFrame(() => {
      try { target.focus(); const caret = before.length + refText.length; target.setSelectionRange(caret, caret); } catch { }
    });
  }
  const isFormulaEditing = () => {
    const val = (document.activeElement === activeInputRef.current ? activeInputRef.current?.value : (document.activeElement === formulaBarRef.current ? formulaBarRef.current?.value : "")) || cellEditingValue || "";
    return !!val.trim().startsWith("=");
  };
  const currentFormulaPreview = useMemo(() => {
    let row = activeCell.row, col = activeCell.col, text = cellEditingValue;
    if (row === null || col === null) {
      if (selection && selection.top === selection.bottom && selection.left === selection.right) {
        row = selection.top; col = selection.left;
        text = readFileCell(storeRef.current, row, col) || "";
      } else {
        return null;
      }
    }
    const r = extractFirstRefOrRange(text);
    return r;
  }, [activeCell.row, activeCell.col, cellEditingValue, selection]);
  const summaryStats = useMemo(() => {
    const store = storeRef.current;

    const isRange = Boolean(selection)
      && (selection.top !== selection.bottom || selection.left !== selection.right);

    const idle = {
      count: 0, mean: 0, median: 0, stdDev: 0, min: 0, max: 0,
      nullCount: 0, naCount: 0, missingPercent: 0, uniqueValues: 0, duplicateCount: 0
    };

    if (summaryCollapsed && qualityCollapsed) return idle;

    if (isRange) {
      return rangeStats || idle;
    }

    {
      if (!fileStatsRef.current) {
        return idle;
      }
      const f = fileStatsRef.current;

      if (f.numericCount === 0) {
        return {
          ...idle,
          nullCount: f.nullCount,
          naCount: f.naCount,
          missingPercent: f.totalCells ? ((f.nullCount + f.naCount) / f.totalCells) * 100 : 0,
          uniqueValues: f.unique.size,
          duplicateCount: Math.max(0, f.totalCells - f.unique.size)
        };
      }

      const mean = f.sum / f.numericCount;
      const sample = (f.sample || []).slice().sort((a, b) => a - b);
      const mid = Math.floor(sample.length / 2);
      const median = sample.length % 2 === 0 ? (sample[mid - 1] + sample[mid]) / 2 : sample[mid];

      let squared = 0;
      for (let n = 0; n < sample.length; n++) squared += (sample[n] - mean) ** 2;

      return {
        count: f.numericCount,
        mean,
        median,
        stdDev: sample.length ? Math.sqrt(squared / sample.length) : 0,
        min: f.min,
        max: f.max,
        nullCount: f.nullCount,
        naCount: f.naCount,
        missingPercent: f.totalCells ? ((f.nullCount + f.naCount) / f.totalCells) * 100 : 0,
        uniqueValues: f.unique.size,
        duplicateCount: Math.max(0, f.totalCells - f.unique.size)
      };
    }

  }, [selection, rangeStats, summaryCollapsed, qualityCollapsed, statsEpoch]);
  function handleCellMouseDown(rowIndex, colIndex, e) {
    if (e.button !== 0) return;
    if ((document.activeElement === activeInputRef.current || document.activeElement === formulaBarRef.current) && isFormulaEditing()) {
      const target = document.activeElement;
      const caret = target?.selectionStart ?? undefined;
      if (isExpectingFunctionRange(target?.value ?? cellEditingValue, caret)) {
        e.preventDefault(); e.stopPropagation();
        setFormulaPick({ active: true, start: { row: rowIndex, col: colIndex }, end: { row: rowIndex, col: colIndex } });
        return;
      } else {
        commitActiveCellIfNeeded();
        setSelection({ top: rowIndex, left: colIndex, bottom: rowIndex, right: colIndex });
        return;
      }
    }
    setSkipClear(true);
    if (e.detail >= 2) {
      e.preventDefault(); e.stopPropagation();
      commitActiveCellIfNeeded();
      setSelection(null);
      activateCell(rowIndex, colIndex);
      return;
    }
    commitActiveCellIfNeeded();
    const isSingle = selection && selection.top === selection.bottom && selection.left === selection.right &&
      selection.top === rowIndex && selection.left === colIndex;
    if (isSingle && !e.shiftKey) {
      e.preventDefault(); e.stopPropagation();
      setSelection(null);
      if (!(activeCell.row === rowIndex && activeCell.col === colIndex)) activateCell(rowIndex, colIndex);
      return;
    }
    if (e.shiftKey && selection) {
      setSelection({
        top: Math.min(selection.top, rowIndex),
        left: Math.min(selection.left, colIndex),
        bottom: Math.max(selection.bottom, rowIndex),
        right: Math.max(selection.right, colIndex)
      });
      return;
    }
    setIsSelecting(true);
    setSelectionStart({ row: rowIndex, col: colIndex });
    setSelectionType("cell");
    setSelection({ top: rowIndex, left: colIndex, bottom: rowIndex, right: colIndex });
  }
  function handleColumnHeaderMouseDown(e, colIndex) {
    if ((document.activeElement === activeInputRef.current || document.activeElement === formulaBarRef.current) && isFormulaEditing()) {
      const target = document.activeElement;
      const caret = target?.selectionStart ?? undefined;
      if (isExpectingFunctionRange(target?.value ?? cellEditingValue, caret)) {
        e.preventDefault(); e.stopPropagation();
        const first = hasActiveFilter ? (filteredRows[0] ?? 0) : 0;
        const last = hasActiveFilter ? ((filteredRows[filteredRows.length - 1]) ?? (effectiveRows - 1)) : (effectiveRows - 1);
        setFormulaPick({ active: true, start: { row: first, col: colIndex }, end: { row: last, col: colIndex } });
        return;
      }
    }
    commitActiveCellIfNeeded(); e.preventDefault();
    const first = hasActiveFilter ? (filteredRows[0] ?? 0) : 0;
    const last = hasActiveFilter ? ((filteredRows[filteredRows.length - 1]) ?? (effectiveRows - 1)) : (effectiveRows - 1);
    if (e.shiftKey && selection && selection.top === first && selection.bottom === last) {
      setSelection({ top: first, left: Math.min(selection.left, colIndex), bottom: last, right: Math.max(selection.right, colIndex) });
      return;
    }
    setIsSelecting(true);
    setSelectionStart({ row: first, col: colIndex });
    setSelectionType("column");
    setSelection({ top: first, left: colIndex, bottom: last, right: colIndex });
  }
  function handleRowHeaderMouseDown(e, rowIndex) {
    if ((document.activeElement === activeInputRef.current || document.activeElement === formulaBarRef.current) && isFormulaEditing()) {
      const target = document.activeElement;
      const caret = target?.selectionStart ?? undefined;
      if (isExpectingFunctionRange(target?.value ?? cellEditingValue, caret)) {
        e.preventDefault(); e.stopPropagation();
        setFormulaPick({ active: true, start: { row: rowIndex, col: 0 }, end: { row: rowIndex, col: effectiveCols - 1 } });
        return;
      }
    }
    commitActiveCellIfNeeded(); e.preventDefault();
    if (e.shiftKey && selection && selection.left === 0 && selection.right === effectiveCols - 1) {
      setSelection({ top: Math.min(selection.top, rowIndex), left: 0, bottom: Math.max(selection.bottom, rowIndex), right: effectiveCols - 1 });
      return;
    }
    setIsSelecting(true);
    setSelectionStart({ row: rowIndex, col: 0 });
    setSelectionType("row");
    setSelection({ top: rowIndex, left: 0, bottom: rowIndex, right: effectiveCols - 1 });
  }
  const onCellValueChange = e => {
    const v = e.target.value;
    setCellEditingValue(v);
    setFormulaBarValue(v);
    const h = cellHistoryRef.current;
    if (!h.suppress) {
      const last = h.undo[h.undo.length - 1];
      if (last !== v) { h.undo.push(v); h.redo = []; }
    }
  };
  const handleCellBlur = e => {
    const maybeNext = e.relatedTarget || document.activeElement;
    if (maybeNext) {
      const nextCell = maybeNext.closest?.(".dataTableCell");
      const thisCell = e.target.closest?.(".dataTableCell");
      const inFormulaBar = !!maybeNext.closest?.(".dataFormulaBarWrapper");
      if (inFormulaBar) return;
      if (nextCell === thisCell) return;
    }
    commitActiveCellIfNeeded();
  };
  const isCellInSelection = (r, c) => !!selection && r >= selection.top && r <= selection.bottom && c >= selection.left && c <= selection.right;
  const searchHitKeys = useMemo(() => {
    const keys = new Set();

    for (let i = 0; i < searchResults.length; i++) {
      keys.add(toKey(searchResults[i].row, searchResults[i].col));
    }

    return keys;
  }, [searchResults]);

  const currentHitKey = useMemo(() => {
    const hit = currentResultIndex >= 0 && currentResultIndex < searchResults.length
      ? searchResults[currentResultIndex]
      : null;

    return hit ? toKey(hit.row, hit.col) : null;
  }, [searchResults, currentResultIndex]);

  const isCellHighlightedBySearch = useCallback((r, c) => {
    if (searchHitKeys.size === 0) return false;

    const key = toKey(r, c);

    if (!searchHitKeys.has(key)) return false;

    return key === currentHitKey ? "current" : "matched";
  }, [searchHitKeys, currentHitKey]);
  function moveActiveCellHorizontally(offset) {
    if (activeCell.row === null || activeCell.col === null) return;
    let newCol = activeCell.col + offset;
    if (newCol >= effectiveCols && offset > 0) { addColumn(); newCol = effectiveCols; }
    newCol = clampNum(newCol, 0, effectiveCols - 1);
    activateCell(activeCell.row, newCol);
    setSelection({ top: activeCell.row, left: newCol, bottom: activeCell.row, right: newCol });
  }
  function moveActiveCellVertically(offset) {
    if (activeCell.row === null || activeCell.col === null) return;
    const newRow = nextVisibleActualRow(activeCell.row, offset);
    activateCell(newRow, activeCell.col);
    setSelection({ top: newRow, left: activeCell.col, bottom: newRow, right: activeCell.col });
  }
  useEffect(() => {
    unmountedRef.current = false;

    return () => {
      unmountedRef.current = true;

      if (scrollSettleTimerRef.current) {
        window.clearTimeout(scrollSettleTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    cancelledRef.current = false;

    if (hasLoadedFile.current) return;

    hasLoadedFile.current = true;
    savedOverlaysRef.current = {};
    onDirtyChangeRef.current?.(false);

    async function loadFile() {
      try {
        const file = typeof fileHandle?.getFile === "function" ? await fileHandle.getFile() : fileHandle;
        if (!file) { setLoading(false); return; }
        const ext = file.name.split(".").pop().toLowerCase();
        const isDelimited = Object.prototype.hasOwnProperty.call(DELIMITED_EXTENSIONS, ext);

        if (!isDelimited && !WORKBOOK_EXTENSIONS.includes(ext)) throw new Error(`Unsupported file type: .${ext}`);

        if (WORKBOOK_EXTENSIONS.includes(ext)) {
          setLoadProgress(2);

          await new Promise((resolve) => requestAnimationFrame(() => resolve()));

          if (typeof XLSX?.read !== "function" || typeof XLSX?.utils?.sheet_to_json !== "function") {
            throw new Error("The spreadsheet reader did not load, so this workbook cannot be opened. Export it to CSV and open that instead.");
          }

          const buffer = await file.arrayBuffer();

          if (cancelledRef.current) return;

          setLoadProgress(20);

          await new Promise((resolve) => requestAnimationFrame(() => resolve()));

          const workbook = XLSX.read(new Uint8Array(buffer), { type: "array", cellStyles: false });
          const names = workbook.SheetNames || [];

          if (names.length === 0) throw new Error("This workbook has no sheets.");
          if (cancelledRef.current) return;

          setLoadProgress(60);

          await new Promise((resolve) => requestAnimationFrame(() => resolve()));

          workbookRef.current = { workbook, names };

          const firstSheet = names[0];
          const rows = sheetToRows(workbook.Sheets[firstSheet]);

          if (cancelledRef.current) return;

          const store = makeSheetStore(rows, names, firstSheet);

          storeRef.current = store;
          tableDataRef.current = store.overlay;

          setSheetNames(names);
          setActiveSheet(firstSheet);
          setTableData(store.overlay);
          setNumRows(Math.max(store.rowCount, 1));
          setNumCols(Math.max(store.colCount, 1));
          setWindowEpoch(n => n + 1);
          setLoadProgress(null);

          return;
        }

        const delimiter = DELIMITED_EXTENSIONS[ext] || ",";
        const store = makeFileStore();

        await indexFile(store, file, delimiter, setLoadProgress, () => cancelledRef.current);

        if (cancelledRef.current) return;

        await loadWindow(store, 0);
        await loadWindow(store, WINDOW_ROWS);

        storeRef.current = store;
        tableDataRef.current = store.overlay;

        setTableData(store.overlay);
        setNumRows(Math.max(store.rowCount, 1));
        setNumCols(Math.max(store.colCount, 1));


      } catch (error) { if (!cancelledRef.current) setError(error.message); } finally { if (!cancelledRef.current) { setLoadProgress(null); setLoading(false); } }
    }
    fileHandle ? loadFile() : setLoading(false);

    return () => { cancelledRef.current = true; };
  }, [fileHandle, reloadEpoch]);
  useEffect(() => {
    const isMac = isMacPlatform();
    function ensureSingleSelection() {
      if (activeCell.row !== null && activeCell.col !== null) return { row: activeCell.row, col: activeCell.col };
      if (selection) return { row: selection.top, col: selection.left };
      const startRow = hasActiveFilter ? (filteredRows[0] ?? 0) : 0;
      return { row: startRow, col: 0 };
    }
    function clampRC(rc) { return ensureInBounds(rc.row, rc.col, effectiveRows, effectiveCols); }
    function startEditAt(row, col) { commitActiveCellIfNeeded(); activateCell(row, col); }
    function handler(e) {
      const ae = document.activeElement;
      if ((ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable) && !isCellInput(ae))) return;
      if (isCellInput(ae)) {
        if (!(isMac ? e.metaKey : e.ctrlKey)) return;
        const cellBinds = normalizeBinds(keyBinds);
        const history = cellHistoryRef.current;
        if (cellBinds.undo.some(b => matchBind(e, b, isMac)) && !e.shiftKey && history.undo.length <= 1) { stopAll(e); handleUndo(); return; }
        if (cellBinds.redo.some(b => matchBind(e, b, isMac)) && history.redo.length === 0) { stopAll(e); handleRedo(); return; }
        return;
      }
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      if (cmdOrCtrl) {
        const binds = normalizeBinds(keyBinds);
        if (binds.search.some(b => matchBind(e, b, isMac))) { stopAll(e); commitActiveCellIfNeeded(); setShowSearchPanel(true); return; }
        if (binds.save.some(b => matchBind(e, b, isMac))) { stopAll(e); commitActiveCellIfNeeded(); handleSave(); return; }
        if (binds.selectAll.some(b => matchBind(e, b, isMac))) { stopAll(e); handleSelectAll(); return; }
        if (binds.cut.some(b => matchBind(e, b, isMac))) { stopAll(e); selection && handleCut(); return; }
        if (binds.copy.some(b => matchBind(e, b, isMac))) { stopAll(e); selection && handleCopy(); return; }
        if (binds.paste.some(b => matchBind(e, b, isMac))) { stopAll(e); selection && handlePaste(); return; }
        if (binds.undo.some(b => matchBind(e, b, isMac))) { stopAll(e); handleUndo(); return; }
        if (binds.redo.some(b => matchBind(e, b, isMac))) { stopAll(e); handleRedo(); return; }
        return;
      }
      if (e.key === "Backspace") {
        if (selection && selection.top === selection.bottom && selection.left === selection.right) {
          stopAll(e); commitActiveCellIfNeeded();
          const k = toKey(selection.top, selection.left);
          if (readFileCellByKey(storeRef.current, k) !== "") withTableMutation(next => { next[k] = ""; });
          return;
        }
      }
      const k = e.key;
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Tab"].includes(k)) return;
      stopAll(e);
      let { row, col } = ensureSingleSelection();
      if (k === "ArrowUp") row = nextVisibleActualRow(row, -1);
      else if (k === "ArrowDown") row = nextVisibleActualRow(row, 1);
      else if (k === "ArrowLeft") col -= 1;
      else if (k === "ArrowRight") col += 1;
      else if (k === "Tab") col += (e.shiftKey ? -1 : 1);
      if (k === "Enter") { const t = clampRC({ row, col }); startEditAt(t.row, t.col); return; }
      const t = clampRC({ row, col });
      setActiveCell({ row: null, col: null });
      setSelection({ top: t.row, left: t.col, bottom: t.row, right: t.col });
    }
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [
    keyBinds, selection, activeCell, undoStack, redoStack, effectiveRows, effectiveCols,
    hasActiveFilter, filteredRows, nextVisibleActualRow, withTableMutation, handleUndo, handleRedo,
    handleCut, handleCopy, handlePaste, handleSelectAll, commitActiveCellIfNeeded, activateCell, ensureInBounds
  ]);
  useEffect(() => {
    function posRelativeToContainer(e) {
      const rect = gridContainerRef.current?.getBoundingClientRect();
      if (!rect) return { rx: 0, ry: 0, rect: null };
      return { rx: e.clientX - rect.left + scrollPos.current.left, ry: e.clientY - rect.top + scrollPos.current.top, rect };
    }
    function onMouseMove(e) {
      if (searchPanelDragging) { setSearchPanelPos({ x: e.clientX - searchPanelOffset.x, y: e.clientY - searchPanelOffset.y }); return; }
      if (headerDrag && gridContainerRef.current) {
        if (headerDrag.type === "column") {
          const newWidth = Math.max(20, headerDrag.initialWidth + (e.clientX - headerDrag.startX));
          setColWidths(prev => { const copy = [...prev]; copy[headerDrag.col] = newWidth; dataGridRef.current?.resetAfterColumnIndex?.(0, true); return copy; });
        } else {
          const newHeight = Math.max(10, headerDrag.initialHeight + (e.clientY - headerDrag.startY));
          setRowHeights(prev => { const copy = [...prev]; copy[headerDrag.row] = newHeight; dataGridRef.current?.resetAfterRowIndex?.(0, true); return copy; });
        }
      }
      if (formulaPick.active && gridContainerRef.current) {
        const { rx, ry } = posRelativeToContainer(e);
        const vr = getVisibleRowIndexFromPosition(ry);
        const ar = visibleToActualRow(vr);
        const c = getColIndexFromPosition(rx);
        setFormulaPick(fp => ({ ...fp, end: { row: ar, col: c } }));
      }
      if (selectionResize.active && gridContainerRef.current) {
        const { rx, ry } = posRelativeToContainer(e);
        const visibleRow = getVisibleRowIndexFromPosition(ry);
        let newRowActual = visibleToActualRow(visibleRow);
        let newCol = getColIndexFromPosition(rx);
        const initial = selectionResize.initialSelection;
        let newBottom = Math.max(newRowActual, initial.top);
        let newRight = Math.max(newCol, initial.left);
        if (!hasActiveFilter && newBottom >= numRows) {
          const add = newBottom - numRows + 1;
          const added = Math.min(add, MAX_ADD_AT_ONCE);
          setNumRows(prev => prev + added);
          if (added < add) newBottom = prev + added - 1;
        }
        if (newRight >= numCols) {
          const add = newRight - numCols + 1;
          const added = Math.min(add, MAX_ADD_AT_ONCE);
          setNumCols(prev => prev + added);
          if (added < add) newRight = prev + added - 1;
        }
        setSelection({ top: initial.top, left: initial.left, bottom: newBottom, right: newRight });
      }
      if (dragRef.current?.active && previewRef.current) {
        previewRef.current.style.transform = `translate(${e.clientX - dragRef.current.startX}px, ${e.clientY - dragRef.current.startY}px)`;
      }
      if (!isSelecting || !selectionStart) return;
      const { rx, ry } = posRelativeToContainer(e);
      if (selectionType === "column") {
        const currentCol = getColIndexFromPosition(rx);
        const first = hasActiveFilter ? (filteredRows[0] ?? 0) : 0;
        const last = hasActiveFilter ? ((filteredRows[filteredRows.length - 1]) ?? (effectiveRows - 1)) : (effectiveRows - 1);
        setSelection({ top: first, left: Math.min(selectionStart.col, currentCol), bottom: last, right: Math.max(selectionStart.col, currentCol) });
      } else if (selectionType === "row") {
        const currentRow = visibleToActualRow(getVisibleRowIndexFromPosition(ry));
        setSelection({ top: Math.min(selectionStart.row, currentRow), left: 0, bottom: Math.max(selectionStart.row, currentRow), right: effectiveCols - 1 });
      } else if (selectionType === "cell") {
        const currentRow = visibleToActualRow(getVisibleRowIndexFromPosition(ry));
        const currentCol = getColIndexFromPosition(rx);
        setSelection({ top: Math.min(selectionStart.row, currentRow), left: Math.min(selectionStart.col, currentCol), bottom: Math.max(selectionStart.row, currentRow), right: Math.max(selectionStart.col, currentCol) });
      }
    }
    async function onMouseUp(e) {
      setSearchPanelDragging(false);
      if (formulaPick.active) {
        const { start, end } = formulaPick;
        if (start && end) {
          const refText = buildRefTextForPick(start, end);
          if (refText) insertRefIntoActiveInput(refText, { overrideInCurrentArgument: true });
        }
        setFormulaPick({ active: false, start: null, end: null });
      }
      if (isSelecting && selection) { setJustFinishedSelecting(true); setTimeout(() => setJustFinishedSelecting(false), 100); }
      if (selectionResize.active) { setJustFinishedSelecting(true); suppressNextOverlayClickRef.current = true; setTimeout(() => setJustFinishedSelecting(false), 100); }
      setIsSelecting(false);
      setSelectionStart(null);
      setSelectionType(null);
      setHeaderDrag(null);
      if (selectionResize.active) setSelectionResize({ active: false, handle: null, startX: 0, startY: 0, initialSelection: null });
      if (dragRef.current?.active) {
        previewRef.current?.remove?.();
        previewRef.current = null;
        const dragState = dragRef.current;
        dragRef.current = null;

        const travelledX = Math.abs(e.clientX - dragState.startX);
        const travelledY = Math.abs(e.clientY - dragState.startY);
        const wasRealDrag = travelledX >= DRAG_COMMIT_THRESHOLD_PX || travelledY >= DRAG_COMMIT_THRESHOLD_PX;

        if (gridContainerRef.current && wasRealDrag) {
          const { rx, ry } = (() => {
            const rect = gridContainerRef.current.getBoundingClientRect();
            return { rx: e.clientX - rect.left + scrollPos.current.left, ry: e.clientY - rect.top + scrollPos.current.top };
          })();
          const targetVisibleRow = getVisibleRowIndexFromPosition(ry);
          const targetRowActual = visibleToActualRow(targetVisibleRow);
          const targetCol = getColIndexFromPosition(rx);
          const rowsOrig = getSelectedActualRowList(dragState.originalSelection);
          if (!rowsOrig.length) return;
          let rowOffsetVisible = hasActiveFilter
            ? targetVisibleRow - (actualToVisibleIndex(rowsOrig[0]) + dragState.grabVisibleOffset)
            : targetRowActual - (dragState.originalSelection.top + dragState.grabRowOffset);
          let rowsDestActual = [];
          if (hasActiveFilter) {
            const sVis = actualToVisibleIndex(rowsOrig[0]);
            const eVis = actualToVisibleIndex(rowsOrig[rowsOrig.length - 1]);
            if (sVis === -1 || eVis === -1) return;
            let dStart = clampNum(sVis + rowOffsetVisible, 0, filteredRows.length - 1);
            let dEnd = clampNum(eVis + rowOffsetVisible, 0, filteredRows.length - 1);
            const from = Math.min(dStart, dEnd), to = Math.max(dStart, dEnd);
            rowsDestActual = filteredRows.slice(from, to + 1);
            if (rowsDestActual.length !== rowsOrig.length) rowsDestActual = rowsDestActual.slice(0, Math.min(rowsOrig.length, rowsDestActual.length));
          } else {
            const newTop = dragState.originalSelection.top + rowOffsetVisible;
            rowsDestActual = Array.from({ length: rowsOrig.length }, (_, i) => newTop + i);
            const maxNeeded = rowsDestActual[rowsDestActual.length - 1];
            if (maxNeeded >= numRows) { const add = maxNeeded - numRows + 1; const added = Math.min(add, MAX_ADD_AT_ONCE); setNumRows(n => n + added); }
          }
          const colOffset = targetCol - dragState.originalSelection.left - dragState.grabColOffset;
          const destLeft = Math.max(0, dragState.originalSelection.left + colOffset);
          const destRight = Math.min(effectiveCols - 1, destLeft + (dragState.originalSelection.right - dragState.originalSelection.left));
          let shouldAlert = false;
          const colsSpan = destRight - destLeft + 1;
          const destRowsRead = await readRowsUncached(
            storeRef.current,
            minOf(rowsDestActual),
            maxOf(rowsDestActual)
          );
          const destByRow = new Map(destRowsRead);

          outer: for (let i = 0; i < rowsDestActual.length; i++) {
            const destCells = destByRow.get(rowsDestActual[i]);

            for (let j = 0; j < colsSpan; j++) {
              const destR = rowsDestActual[i], destC = destLeft + j;
              const inOrig = destR >= dragState.originalSelection.top && destR <= dragState.originalSelection.bottom &&
                destC >= dragState.originalSelection.left && destC <= dragState.originalSelection.right;
              if (inOrig) continue;

              const overlaid = storeRef.current.overlay[toKey(destR, destC)];
              const dV = (overlaid !== undefined ? overlaid : (destCells ? (destCells[destC] ?? "") : "")).trim();

              if (dV !== "") { shouldAlert = true; break outer; }
            }
          }
          let proceed = true;
          if (shouldAlert) {
            const res = await showDialog({ title: "System Alert", message: "The data being moved will replace existing data. Do you want to continue?", showCancel: true });
            if (res === null) proceed = false;
          }
          if (proceed) {
            const sourceData = {};
            const sourceRows = await readRowsUncached(
              storeRef.current,
              minOf(rowsOrig),
              maxOf(rowsOrig)
            );
            const sourceByRow = new Map(sourceRows);

            for (const r of rowsOrig) {
              const cells = sourceByRow.get(r);

              for (let c = dragState.originalSelection.left; c <= dragState.originalSelection.right; c++) {
                const key = toKey(r, c);
                const overlaid = storeRef.current.overlay[key];

                sourceData[key] = overlaid !== undefined ? overlaid : (cells ? (cells[c] ?? "") : "");
              }
            }
            withTableMutation(next => {
              for (const r of rowsOrig) {
                for (let c = dragState.originalSelection.left; c <= dragState.originalSelection.right; c++) {
                  next[toKey(r, c)] = "";
                }
              }
              const colsSpan = dragState.originalSelection.right - dragState.originalSelection.left + 1;
              const rowsCount = Math.min(rowsOrig.length, rowsDestActual.length);
              for (let i = 0; i < rowsCount; i++) {
                const srcR = rowsOrig[i], destR = rowsDestActual[i];
                for (let j = 0; j < colsSpan; j++) {
                  const srcC = dragState.originalSelection.left + j, destC = destLeft + j;
                  const sourceKey = toKey(srcR, srcC);
                  const destKey = toKey(destR, destC);
                  const value = sourceData[sourceKey];
                  next[destKey] = value !== undefined ? value : "";
                }
              }
            });
            setSelection({ top: rowsDestActual[0], left: destLeft, bottom: rowsDestActual[rowsDestActual.length - 1], right: destRight });
            setActiveCell({ row: null, col: null });
            setIsMoving(true);
          }
        }
      }
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [
    searchPanelDragging, searchPanelOffset, isSelecting, selectionStart, selectionType,
    effectiveRows, effectiveCols, selectionResize.active, headerDrag,
    hasActiveFilter, numRows, numCols, filteredRows, visibleToActualRow, actualToVisibleIndex,
    getVisibleRowIndexFromPosition, getColIndexFromPosition, withTableMutation, formulaPick, buildRefTextForPick, getSelectedActualRowList
  ]);
  useEffect(() => {
    if (isMoving) {
      setSelectionDrag({ active: false, startX: 0, startY: 0, offsetX: 0, offsetY: 0, originalSelection: null, block: null, grabRowOffset: 0, grabColOffset: 0, grabVisibleOffset: 0 });
      setIsMoving(false);
    }
  }, [isMoving]);
  useEffect(() => {
    function handleDocMouseDown(e) {
      const target = e.target;
      const inGrid = !!target.closest?.(".dataTableGridContainer");
      const inFormulaBar = !!target.closest?.(".dataFormulaBarWrapper");
      if (interactingWithFormulaBarRef.current) return;
      if (!inGrid && !inFormulaBar) {
        if (document.activeElement === activeInputRef.current || document.activeElement === formulaBarRef.current) {
          commitActiveCellIfNeeded();
        }
      }
    }
    document.addEventListener("mousedown", handleDocMouseDown, true);
    return () => document.removeEventListener("mousedown", handleDocMouseDown, true);
  }, [commitActiveCellIfNeeded]);
  const overlayIsInteractive = useMemo(() => {
    if (!selection) return false;

    const rows = selection.bottom - selection.top + 1;
    const cols = selection.right - selection.left + 1;

    return rows * cols <= OVERLAY_INTERACTIVE_MAX_CELLS;
  }, [selection]);

  const switchSheet = useCallback((name) => {
    const held = workbookRef.current;
    const store = storeRef.current;

    if (!store || !store.sheetNames?.length) return;
    if (name === store.activeSheet) return;

    try {
      commitActiveCellIfNeeded();
    } catch {
      showDialog({ title: "System Alert", message: "The active cell could not be committed before switching sheets." });
    }

    const grid = held?.workbook?.Sheets?.[name];

    let rows = [];

    if (grid) {
      try {
        rows = sheetToRows(grid);
      } catch {
        rows = [];
        showDialog({ title: "System Alert", message: `The sheet "${name}" could not be read.` });
      }
    } else {
      showDialog({ title: "System Alert", message: `The sheet "${name}" is no longer available in this workbook.` });
    }

    const next = makeSheetStore(rows, store.sheetNames, name);

    sheetOverlaysRef.current[store.activeSheet] = store.overlay;
    next.overlay = sheetOverlaysRef.current[name] || {};

    storeRef.current = next;
    tableDataRef.current = next.overlay;
    fileStatsRef.current = null;
    statsRequestedRef.current = false;

    const outer = gridOuterRef.current;

    if (outer) {
      outer.scrollTop = 0;
      outer.scrollLeft = 0;
    }

    if (columnHeaderRef.current?.firstChild) {
      columnHeaderRef.current.firstChild.style.transform = "translateX(0px)";
    }

    if (rowHeaderRef.current?.firstChild) {
      rowHeaderRef.current.firstChild.style.transform = "translateY(0px)";
    }

    scrollPos.current = { left: 0, top: 0 };
    headerRangeRef.current = 0;

    dataGridRef.current?.resetAfterRowIndex?.(0, false);
    dataGridRef.current?.resetAfterColumnIndex?.(0, false);
    dataGridRef.current?.scrollTo?.({ scrollLeft: 0, scrollTop: 0 });

    setHeaderRange({ first: 0 });
    setColumnFilters({});
    setOpenFilterCol(null);
    setSearchResults([]);
    setCurrentResultIndex(-1);
    setActiveSheet(name);
    setSelection(null);
    setActiveCell({ row: null, col: null });
    setTableData(next.overlay);
    setNumRows(Math.max(next.rowCount, 1));
    setNumCols(Math.max(next.colCount, 1));
    setWindowEpoch(n => n + 1);
  }, [commitActiveCellIfNeeded]);

  const selectionBounds = useCallback((sel) => {
    if (!sel) return { top: 0, left: 0, width: 0, height: 0 };
    if (hasActiveFilter) {
      const sTopVis = actualToVisibleIndex(sel.top);
      const sBotVis = actualToVisibleIndex(sel.bottom);
      const startIndex = Math.min(sTopVis, sBotVis);
      const endIndex = Math.max(sTopVis, sBotVis);
      const top = startIndex >= 0 ? filteredRowHeightsCumulative[startIndex] : 0;
      const left = colWidthsCumulative[sel.left];
      const width = colWidthsCumulative[sel.right + 1] - colWidthsCumulative[sel.left];
      const height = endIndex >= 0 ? filteredRowHeightsCumulative[endIndex + 1] - filteredRowHeightsCumulative[startIndex] : 0;
      return { top, left, width, height };
    }
    const top = rowHeightsCumulative[sel.top];
    const left = colWidthsCumulative[sel.left];
    const width = colWidthsCumulative[sel.right + 1] - colWidthsCumulative[sel.left];
    const height = rowHeightsCumulative[sel.bottom + 1] - rowHeightsCumulative[sel.top];
    return { top, left, width, height };
  }, [hasActiveFilter, actualToVisibleIndex, filteredRowHeightsCumulative, rowHeightsCumulative, colWidthsCumulative]);

  const overlayRect = useCallback((sel, scrollLeft, scrollTop, interactive) => {
    const bounds = selectionBounds(sel);
    const rawTop = bounds.top - scrollTop;
    const rawLeft = bounds.left - scrollLeft;

    if (interactive) {
      return { top: rawTop, left: rawLeft, width: bounds.width, height: bounds.height };
    }

    const outer = gridOuterRef.current;
    const viewWidth = outer ? outer.clientWidth : 0;
    const viewHeight = outer ? outer.clientHeight : 0;

    if (!viewWidth || !viewHeight) {
      return { top: rawTop, left: rawLeft, width: bounds.width, height: bounds.height };
    }

    const top = Math.max(rawTop, -OVERLAY_EDGE_BLEED_PX);
    const left = Math.max(rawLeft, -OVERLAY_EDGE_BLEED_PX);
    const bottom = Math.min(rawTop + bounds.height, viewHeight + OVERLAY_EDGE_BLEED_PX);
    const right = Math.min(rawLeft + bounds.width, viewWidth + OVERLAY_EDGE_BLEED_PX);

    return {
      top,
      left,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top)
    };
  }, [selectionBounds]);
  function handleSelectionMouseDown(e) {
    if (e.target.classList.contains("dataTableSelectionHandleBottomRight")) return;
    e.stopPropagation();
    e.preventDefault();
    if (!selection || !gridContainerRef.current) return;
    const rows = getSelectedActualRowList(selection);
    if (!rows.length) return;
    const snapshot = rows.map(r => {
      const rowData = [];
      for (let c = selection.left; c <= selection.right; c++) rowData.push(readFileCell(storeRef.current, r, c) ?? "");
      return rowData;
    });
    const containerRect = gridContainerRef.current.getBoundingClientRect();
    const grabScreenX = e.clientX, grabScreenY = e.clientY;
    const visibleGrabRow = getVisibleRowIndexFromPosition(grabScreenY - containerRect.top + scrollPos.current.top);
    const grabRowActual = visibleToActualRow(visibleGrabRow);
    const grabCol = getColIndexFromPosition(grabScreenX - containerRect.left + scrollPos.current.left);
    const selStartVis = actualToVisibleIndex(rows[0]);
    const grabVis = actualToVisibleIndex(grabRowActual);
    const grabVisibleOffset = Math.max(0, grabVis - selStartVis);
    const grabRowOffset = grabRowActual - selection.top;
    const grabColOffset = grabCol - selection.left;
    dragRef.current = { active: true, startX: grabScreenX, startY: grabScreenY, originalSelection: selection, block: snapshot, grabRowOffset, grabColOffset, grabVisibleOffset };
    const prev = document.createElement("div");
    prev.style.position = "absolute";
    prev.style.zIndex = "5";
    prev.style.pointerEvents = "none";
    prev.style.border = "2px solid #007acc";
    prev.style.backgroundColor = "rgba(0,122,255,0.5)";
    const { top, left, width, height } = selectionBounds(selection);
    const screenTop = top - scrollPos.current.top;
    const screenLeft = left - scrollPos.current.left;
    Object.assign(prev.style, { top: `${screenTop}px`, left: `${screenLeft}px`, width: `${width}px`, height: `${height}px` });
    gridContainerRef.current.appendChild(prev);
    previewRef.current = prev;
  }
  function startSelectionResize(_, e) {
    e.preventDefault(); e.stopPropagation(); if (!selection) return;
    commitActiveCellIfNeeded(); setActiveCell({ row: null, col: null });
    setSkipClear(true);
    suppressNextOverlayClickRef.current = true;
    setSelectionResize({ active: true, handle: "bottom-right", startX: e.clientX, startY: e.clientY, initialSelection: { ...selection } });
  }
  function handleSelectionDoubleClick(e) {
    e.stopPropagation();
    if (!gridContainerRef.current) return;
    const rect = gridContainerRef.current.getBoundingClientRect();
    const rx = e.clientX - rect.left + scrollPos.current.left;
    const ry = e.clientY - rect.top + scrollPos.current.top;
    const clickedRowActual = visibleToActualRow(getVisibleRowIndexFromPosition(ry));
    const clickedCol = getColIndexFromPosition(rx);
    activateCell(clickedRowActual, clickedCol);
  }
  function handleSelectionClick(e) {
    e.stopPropagation();
    if (suppressNextOverlayClickRef.current || justFinishedSelecting) { suppressNextOverlayClickRef.current = false; return; }
    if (!selection) return;
    const isSingle = selection.top === selection.bottom && selection.left === selection.right;
    if (isSingle) { setSelection(null); activateCell(selection.top, selection.left); }
    else { setSelection(null); }
  }
  useLayoutEffect(() => {
    if (selection && selectionOverlayRef.current) {
      const b = overlayRect(selection, scrollPos.current.left, scrollPos.current.top, overlayIsInteractive);
      Object.assign(selectionOverlayRef.current.style, {
        top: `${b.top}px`,
        left: `${b.left}px`,
        width: `${b.width}px`,
        height: `${b.height}px`,
        pointerEvents: overlayIsInteractive ? "auto" : "none"
      });
    }
  }, [selection, selectionBounds, overlayRect, overlayIsInteractive, hasActiveFilter]);
  const itemData = useMemo(() => ({
    tableDataRef, storeRef, activeCell, cellEditingValue,
    filteredRows, hasActiveFilter, handleCellMouseDown, handleCellDoubleClick: activateCell,
    onCellValueChange, handleCellBlur, moveActiveCellHorizontally,
    moveActiveCellVertically, isCellHighlightedBySearch, activeInputRef, keyBinds, cellHistoryRef,
    computedTableData, setFormulaBarValue, commitActiveCellIfNeeded, windowEpoch
  }), [
    tableData, tableDataRef, storeRef, activeCell, cellEditingValue,
    filteredRows, hasActiveFilter, keyBinds, computedTableData, commitActiveCellIfNeeded, windowEpoch
  ]);
  const cellRenderer = useCallback((props) => <Cell {...props} data={itemData} />, [itemData]);
  useEffect(() => {
    const onDocDown = (e) => {
      const inMenu = menuPortalRef.current && menuPortalRef.current.contains(e.target);
      const inFilter = filterPortalRef.current && filterPortalRef.current.contains(e.target);
      const inButtons = !!e.target.closest(".dataOperationsButtonsWrapper");
      const inFilterTrigger = !!e.target.closest(".dataTabularHeaderFilterContainer");
      if (!inMenu && !inFilter && !inButtons && !inFilterTrigger) { setOpenMenu(null); setOpenFilterCol(null); }
    };
    const onEsc = (e) => { if (e.key === "Escape") { setOpenMenu(null); setOpenFilterCol(null); setCtxMenu(m => ({ ...m, open: false })); } };
    const onResize = () => { setOpenMenu(null); setOpenFilterCol(null); };
    document.addEventListener("mousedown", onDocDown, true);
    document.addEventListener("keydown", onEsc, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDocDown, true);
      document.removeEventListener("keydown", onEsc, true);
      window.removeEventListener("resize", onResize);
    };
  }, []);
  const renderDropdownMenu = (menuName, items) => {
    if (openMenu !== menuName) return null;
    return createPortal(
      <div
        ref={attachPopover(menuPortalRef)}
        popover="manual"
        className="dataTabularDropdownMenu"
        style={{ position: "fixed", top: menuPosition.top, left: menuPosition.left }}
        onClick={(e) => e.stopPropagation()}
      >
        {items.map((item, i) => (
          <div className="dataTabularDropdownMenuItem"
            key={i}
            onClick={() => { item.action(); setOpenMenu(null); }}
          >
            {item.icon && <FontAwesomeIcon icon={item.icon} />}
            {item.text}
          </div>
        ))}
      </div>,
      document.body
    );
  };
  function openTopMenu(name, btnRef) {
    setOpenMenu(prev => {
      const next = prev === name ? null : name;
      if (next && btnRef?.current) setMenuPosition(clampPosition(btnRef.current.getBoundingClientRect(), 220, 280, 6));
      return next;
    });
  }
  function openFilterDropdown(e, colIndex) {
    e.stopPropagation();
    setFilterDropdownPos(clampPosition(e.currentTarget.getBoundingClientRect(), 260, 320, 6));
    setFilterSearch("");
    setOpenFilterCol(colIndex);
  }
  function applyColumnFilters(updater) {
    setColumnFilters(prev => { const next = updater(prev); setTimeout(clearUIHighlightsAndStates, 0); return next; });
  }
  function toggleFilterOption(colIndex, value) {
    applyColumnFilters(prev => {
      const cur = prev[colIndex] || [];
      const exists = cur.includes(value);
      const nextSel = exists ? cur.filter(v => v !== value) : [...cur, value];
      const out = { ...prev, [colIndex]: nextSel };
      if (!nextSel.length) delete out[colIndex];
      return out;
    });
  }
  function selectAllFilter(colIndex) {
    const opts = filterOptions[colIndex] || [];
    if (opts.length === 0) return;
    applyColumnFilters(prev => ({ ...prev, [colIndex]: [...opts] }));
  }
  function clearFilter(colIndex) { applyColumnFilters(prev => { const n = { ...prev }; delete n[colIndex]; return n; }); }
  function clearAllFilters() { setColumnFilters({}); clearUIHighlightsAndStates(); setOpenFilterCol(null); }
  const renderFilterDropdown = () => {
    if (openFilterCol === null) return null;
    const col = openFilterCol;
    const options = (filterOptions[col] || []).filter(opt => String(opt).toLowerCase().includes(filterSearch.trim().toLowerCase()));
    const selected = new Set(columnFilters[col] || []);
    return createPortal(
      <div className="dataTabularDropdownMenu"
        ref={attachPopover(filterPortalRef)}
        popover="manual"
        style={{
          position: "fixed", top: filterDropdownPos.top, left: filterDropdownPos.left, width: 260, maxHeight: 360,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="dataTabularDropdownMenuHeader">
          <div className="dataTabularDropdownMenuHeaderSearch">
            <FontAwesomeIcon icon={faFilter} />
            <strong>Filter: {getColumnLabel(col)}</strong>
          </div>
          <div className="dataTabularDropdownMenuSearch">
            <input
              type="text"
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              placeholder="Search values..."
            />
          </div>
        </div>
        <div className="dataTabularDropdownMenuSelection">
          <button onClick={() => selectAllFilter(col)}>Select All</button>
          <button onClick={() => clearFilter(col)}>Clear</button>
        </div>
        <div className="dataTabularDropdownMenuSelectionList">
          {options.length === 0 ? (
            <div className="dataTabularDropdownMenuSelectionListNoValue">No values</div>
          ) : options.map(opt => (
            <label
              className="dataTabularDropdownMenuSelectionListLabel"
              key={opt}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = "#333"}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
            >
              <input className="dataSettingsCheckbox" type="checkbox" checked={selected.has(opt)} onChange={() => toggleFilterOption(col, opt)} />
              <span>{opt}</span>
            </label>
          ))}
        </div>
        <div className="dataTabularDropdownMenuSelectionBottom">
          <span>{selected.size > 0 ? `${selected.size} value${selected.size === 1 ? "" : "s"} selected` : "All values"}</span>
          <button onClick={() => setOpenFilterCol(null)}>Close</button>
        </div>
      </div>,
      document.body
    );
  };
  useEffect(() => {
    function onDocMouseDown(e) {
      if (!ctxMenu.open) return;
      if (!e.target.closest?.(".dataContextMenu")) setCtxMenu(m => ({ ...m, open: false }));
    }
    function closeOnWindowChange() { setCtxMenu(m => ({ ...m, open: false })); }
    window.addEventListener("mousedown", onDocMouseDown, true);
    window.addEventListener("scroll", closeOnWindowChange, true);
    window.addEventListener("resize", closeOnWindowChange, true);
    return () => {
      window.removeEventListener("mousedown", onDocMouseDown, true);
      window.removeEventListener("scroll", closeOnWindowChange, true);
      window.removeEventListener("resize", closeOnWindowChange, true);
    };
  }, [ctxMenu.open]);
  const openContextMenu = useCallback((e, kind) => {
    e.preventDefault(); e.stopPropagation();
    const items = [];
    const binds = normalizeBinds(keyBinds);
    items.push({ icon: faSave, text: "Save", bind: binds.save[0], action: handleSave });
    items.push({ icon: faDownload, text: "Download", action: handleDownload });
    items.push({ separator: true });
    if (selection) {
      items.push({ icon: faCut, text: "Cut", bind: binds.cut[0], action: handleCut });
      items.push({ icon: faCopy, text: "Copy", bind: binds.copy[0], action: handleCopy });
      items.push({ icon: faPaste, text: "Paste", bind: binds.paste[0], action: handlePaste });
      items.push({ icon: faTrash, text: "Clear Selection", action: handleClearSelection });
    } else {
      items.push({ icon: faArrowPointer, text: "Select All", bind: binds.selectAll[0], action: handleSelectAll });
      items.push({ icon: faPaste, text: "Paste", bind: binds.paste[0], action: handlePaste });
    }
    if (kind === "column") {
      items.push({ separator: true });
      items.push({ icon: faSortAlphaDown, text: "Sort A–Z", action: () => sortTableByColumn("sortAZ") });
      items.push({ icon: faSortAlphaUp, text: "Sort Z–A", action: () => sortTableByColumn("sortZA") });
      items.push({ icon: faSortNumericDown, text: "Sort 0–9", action: () => sortTableByColumn("sortNumericAsc") });
      items.push({ icon: faSortNumericUp, text: "Sort 9–0", action: () => sortTableByColumn("sortNumericDesc") });
    }
    items.push({ separator: true });
    items.push({ icon: faSquarePlus, text: "Add Row", action: addRow });
    items.push({ icon: faSquarePlus, text: "Add Column", action: addColumn });
    items.push({ separator: true });
    items.push({ icon: faSearch, text: "Search / Replace", bind: binds.search[0], action: () => { commitActiveCellIfNeeded(); setShowSearchPanel(true); } });
    const rendered = items.map(it => it.separator ? { text: "—separator—", action: () => { }, sep: true } : it);
    const rawX = e.clientX, rawY = e.clientY;
    setCtxMenu({ open: true, x: rawX, y: rawY, items: rendered });
    requestAnimationFrame(() => {
      const node = ctxMenuRef.current; if (!node) return;
      const pad = 8, w = node.offsetWidth || 240, h = node.offsetHeight || 200;
      let x = rawX, y = rawY;
      if (x + w + pad > window.innerWidth) x = Math.max(pad, window.innerWidth - w - pad);
      if (y + h + pad > window.innerHeight) y = Math.max(pad, window.innerHeight - h - pad);
      setCtxMenu(m => ({ ...m, x, y }));
    });
  }, [selection, keyBinds, addRow, addColumn, handleCut, handleCopy, handlePaste, handleClearSelection, handleSelectAll, sortTableByColumn, commitActiveCellIfNeeded]);
  async function handleReloadFromDisk() {
    setOpenMenu(null);

    if (!fileHandle) {
      await showDialog({ title: "Reload From Disk", message: "No file handle is available." });
      return;
    }

    const confirmed = await showDialog({
      title: "Reload From Disk",
      message: "Unsaved edits in this file will be discarded. Do you want to continue?",
      showCancel: true
    });

    if (!confirmed) return;

    commitActiveCellIfNeeded();

    workbookRef.current = null;
    sheetOverlaysRef.current = {};
    fileStatsRef.current = null;
    statsRequestedRef.current = false;
    storeRef.current = makeFileStore();
    tableDataRef.current = storeRef.current.overlay;
    hasLoadedFile.current = false;
    cancelledRef.current = false;

    setError(null);
    setTableData({});
    setSheetNames([]);
    setActiveSheet(null);
    setColumnFilters({});
    setOpenFilterCol(null);
    setSearchResults([]);
    setCurrentResultIndex(-1);
    setSelection(null);
    setActiveCell({ row: null, col: null });
    setNumRows(1);
    setNumCols(1);
    setWindowEpoch(n => n + 1);
    setLoading(true);
    setReloadEpoch(n => n + 1);
  }

  async function handleFileInformation() {
    setOpenMenu(null);

    const store = storeRef.current;
    const rows = store.rowCount || 0;
    const cols = store.colCount || 0;
    const shape = `${rows.toLocaleString()} rows by ${cols.toLocaleString()} columns, for ${(rows * cols).toLocaleString()} cells in total.`;
    const sheets = store.sheetNames?.length
      ? `\nSheets: ${store.sheetNames.length.toLocaleString()} (${activeSheet} is open).`
      : "";

    if (!fileHandle) {
      await showDialog({ title: "File Information", message: `Untitled table holding ${shape}${sheets}` });
      return;
    }

    try {
      const file = await fileHandle.getFile();

      await showDialog({
        title: "File Information",
        message: `${file.name}\nSize on disk: ${(file.size / 1048576).toFixed(2)} MB\nLast modified: ${new Date(file.lastModified).toLocaleString()}\nIn the editor: ${shape}${sheets}`
      });
    } catch (error) {
      await showDialog({ title: "File Information", message: error.message || "This file could not be read." });
    }
  }

  async function handlePrint() {
    setOpenMenu(null);

    const store = storeRef.current;
    const bounds = selection
      ? { top: selection.top, left: selection.left, bottom: selection.bottom, right: selection.right }
      : { top: 0, left: 0, bottom: Math.min(store.rowCount - 1, PRINT_ROW_LIMIT - 1), right: Math.max(store.colCount - 1, 0) };

    if (bounds.bottom < bounds.top || bounds.right < bounds.left) {
      await showDialog({ title: "Print", message: "There is nothing in this file to print." });
      return;
    }

    const rowTotal = bounds.bottom - bounds.top + 1;

    if (rowTotal > PRINT_ROW_LIMIT) {
      const confirmed = await showDialog({
        title: "Print",
        message: `This range holds ${rowTotal.toLocaleString()} rows. Only the first ${PRINT_ROW_LIMIT.toLocaleString()} will be printed. Do you want to continue?`,
        showCancel: true
      });

      if (!confirmed) return;

      bounds.bottom = bounds.top + PRINT_ROW_LIMIT - 1;
    }

    const escape = (value) => String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const lines = [];

    for (let block = bounds.top; block <= bounds.bottom; block += WINDOW_ROWS) {
      const blockEnd = Math.min(block + WINDOW_ROWS - 1, bounds.bottom);
      const rows = await readRowsUncached(store, block, blockEnd);

      for (const [rowIndex, cells] of rows) {
        const columns = [];

        for (let col = bounds.left; col <= bounds.right; col++) {
          const overlaid = store.overlay[toKey(rowIndex, col)];

          columns.push(`<td>${escape(overlaid !== undefined ? overlaid : (cells[col] ?? ""))}</td>`);
        }

        lines.push(`<tr><th>${(rowIndex + 1).toLocaleString()}</th>${columns.join("")}</tr>`);
      }
    }

    const headers = [];

    for (let col = bounds.left; col <= bounds.right; col++) headers.push(`<th>${getColumnLabel(col)}</th>`);

    const frame = window.open("", "_blank", "width=1000,height=1000");

    if (!frame) {
      await showDialog({ title: "Print", message: "The print window could not be opened. Allow pop-ups for this site and try again." });
      return;
    }

    frame.document.write(`<!doctype html><html><head><title>${escape(fileHandle?.name || "Untitled Table")}</title><style>body{margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#12151b}h1{font-size:14px;margin:0 0 12px 0}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #999;padding:4px 6px;text-align:left;vertical-align:top}thead th{background:#eee}tbody th{background:#f6f6f6;text-align:right;font-weight:700}</style></head><body><h1>${escape(fileHandle?.name || "Untitled Table")}${activeSheet ? ` &mdash; ${escape(activeSheet)}` : ""}</h1><table><thead><tr><th></th>${headers.join("")}</tr></thead><tbody>${lines.join("")}</tbody></table></body></html>`);
    frame.document.close();
    frame.focus();
    frame.print();
  }

  function handleSave() {
    if (!fileHandle) {
      setSaveStatus("no-handle");
      onSaveStatusChange?.("No file handle available.");
      setTimeout(() => { setSaveStatus("idle"); onSaveStatusChange?.(""); }, SAVE_BANNER_TIMEOUT_MS);
      return;
    }
    setSaveStatus("saving"); onSaveStatusChange?.("Saving...");
    (async () => {
      try {
        const store = storeRef.current;
        const format = saveTextFormat();
        const plan = store.sheetNames.length ? null : await planDelimitedSave(format);

        if (plan) {
          await writeDelimitedPlan(plan);
        } else {
          const payload = store.sheetNames.length ? await buildWorkbookBlob() : await buildTextExport(format);
          const writable = await fileHandle.createWritable();
          await writable.write(payload); await writable.close();
        }
        setSaveStatus("saved");
        onSaveStatusChange?.("Save successful!");
        typeof onSave === "function" && onSave("");
        savedOverlaysRef.current = { ...sheetOverlaysRef.current, [store.activeSheet ?? ""]: store.overlay };
        onDirtyChangeRef.current?.(false);
        setTimeout(() => { setSaveStatus("idle"); onSaveStatusChange?.(""); }, SAVE_BANNER_TIMEOUT_MS);
      } catch {
        setSaveStatus("failed"); onSaveStatusChange?.("Save failed!");
        setTimeout(() => { setSaveStatus("idle"); onSaveStatusChange?.(""); }, SAVE_BANNER_TIMEOUT_MS);
      }
    })();
  }
  async function handleDownload() {
    setOpenMenu(null);

    const isWorkbook = storeRef.current.sheetNames.length > 0;
    const options = EXPORT_FORMATS.filter((format) => format.kind === "text" || isWorkbook)
      .map(({ label, value }) => ({ label, value }));

    const result = await showDialog({
      title: "Download As", message: "Select a file type to download this file as.",
      inputs: [{ name: "fileType", type: "select", options }], showCancel: true
    });

    if (!result) return;

    const chosen = EXPORT_FORMATS.find((format) => format.value === result.fileType);

    if (!chosen) return;

    setSaveStatus("saving");
    onSaveStatusChange?.("Preparing Download...");

    try {
      const fileName = fileHandle?.name ? fileHandle.name.replace(/\.[^/.]+$/, "") : "Untitled";
      const blob = chosen.kind === "book"
        ? await exportWorkbookBlob(chosen.value)
        : await buildTextExport(chosen.value);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `${fileName}.${chosen.value}`;
      link.click();
      URL.revokeObjectURL(url);

      setSaveStatus("saved");
      onSaveStatusChange?.("Download ready!");
    } catch (error) {
      setSaveStatus("error");
      onSaveStatusChange?.(error.message || "This file could not be exported.");
    }

    setTimeout(() => { setSaveStatus("idle"); onSaveStatusChange?.(""); }, SAVE_BANNER_TIMEOUT_MS);
  }

  if (loading) return <div className="loading-wrapper">
    <div className="loading-circle" />
    <label className="loading-title">{loadProgress === null ? "Loading" : `Loading ${loadProgress}%`}</label>
  </div>;
  if (error) return <div className="loading-wrapper">
    <label className="loading-title">This File Could Not Be Opened.</label>
    <label className="loading-title">{error}</label>
  </div>;
  const activeFilterCount = Object.values(columnFilters).reduce((acc, v) => acc + ((v && v.length) ? 1 : 0), 0);

  const statusCellLabel = (() => {
    const row = activeCell.row !== null ? activeCell.row : selection?.top;
    const col = activeCell.col !== null ? activeCell.col : selection?.left;

    if (row === undefined || row === null || col === undefined || col === null) {
      return "No Cell Selected";
    }

    return a1FromRC(row, col);
  })();

  const statusSelectionLabel = (() => {
    if (!selection) return "No Selection";

    const rows = selection.bottom - selection.top + 1;
    const cols = selection.right - selection.left + 1;

    if (rows === 1 && cols === 1) return "1 Cell Selected";

    return `${rows.toLocaleString()} \u00D7 ${cols.toLocaleString()} Selected`;
  })();
  return (
    <div
      className="dataTabularContentWrapper"
      onClick={e => {
        if (skipClear || justFinishedSelecting) { setSkipClear(false); return; }
        if (e.target.closest(".dataTabularToolbarWrapper") || e.target.closest(".dataEditingSearchBoxWrapper")) return;
        if (e.target.closest(".dataFormulaBarWrapper")) {
          if (activeCell.row === null && selection && selection.top === selection.bottom && selection.left === selection.right) {
            activateCell(selection.top, selection.left);
          }
          return;
        }
        if (e.target.closest(".dataTableColumnHeaderCell") || e.target.closest(".dataTableRowHeaderCell") || e.target.closest(".dataTableCornerHeader")) return;
        if (e.target.closest(".dataTableSelectionOverlay")) return;
        if (e.target.closest(".dataTabularColumnResizeHandle")) return;
        if (e.target.closest(".dataTabularRowResizeHandle")) return;
        if (e.detail > 1) return;
        if (activeCell.row === null && activeCell.col === null && selection) setSelection(null);
        else if (activeCell.row !== null || activeCell.col !== null) {
          const cell = e.target.closest(".dataTableCell");
          const input = e.target.closest(".dataTableCellInput");
          const inFormulaBar = !!e.target.closest(".dataFormulaBarWrapper");
          if (!cell && !input && !inFormulaBar) commitActiveCellIfNeeded();
        }
      }}
      onContextMenu={(e) => openContextMenu(e, "blank")}
      style={{ position: "relative" }}
    >
      <div className="dataTabularToolbarWrapper">
        <div className="dataTabularToolBar">
          <div className="dataTabularTitleWrapper">
            <div className="dataTabularFileNameStack">
              <label className="dataTabularFileNameInput"><FontAwesomeIcon icon={faTableCells} /> {fileHandle?.name || "Untitled Table"}</label>
              <div className="dataTabularOperationsButtonsWrapper">
                <div style={{ position: "relative" }}>
                  <button ref={fileBtnRef} className="dataTabularOperationsButton" onClick={(e) => { e.stopPropagation(); openTopMenu("file", fileBtnRef); }}>File</button>
                  {renderDropdownMenu("file", [
                    { icon: faSave, text: saveStatus === "idle" ? "Save File" : saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved!" : saveStatus === "failed" ? "Save failed!" : "Save File", action: handleSave },
                    { icon: faDownload, text: "Download", action: handleDownload },
                    { icon: faPrint, text: "Print", action: handlePrint },
                    { icon: faRotate, text: "Reload From Disk", action: handleReloadFromDisk },
                    { icon: faCircleInfo, text: "File Information", action: handleFileInformation }
                  ])}
                </div>
                <div style={{ position: "relative" }}>
                  <button ref={editBtnRef} className="dataTabularOperationsButton" onClick={(e) => { e.stopPropagation(); openTopMenu("edit", editBtnRef); }}>Edit</button>
                  {renderDropdownMenu("edit", [
                    { icon: faUndo, text: "Undo", action: () => { commitActiveCellIfNeeded(); handleUndo(); } },
                    { icon: faRedo, text: "Redo", action: () => { commitActiveCellIfNeeded(); handleRedo(); } },
                    { icon: faCut, text: "Cut", action: handleCut },
                    { icon: faCopy, text: "Copy", action: handleCopy },
                    { icon: faPaste, text: "Paste", action: handlePaste },
                    { icon: faArrowPointer, text: "Select All", action: handleSelectAll },
                    { icon: faSearch, text: "Search/Replace", action: () => { commitActiveCellIfNeeded(); setShowSearchPanel(true); } }
                  ])}
                </div>
                <div style={{ position: "relative" }}>
                  <button ref={toolsBtnRef} className="dataTabularOperationsButton" onClick={(e) => { e.stopPropagation(); openTopMenu("tools", toolsBtnRef); }}>Tools</button>
                  {renderDropdownMenu("tools", [
                    {
                      icon: faHashtag, text: "Cell Count", action: async () => {
                        setOpenMenu(null);
                        if (selection) {
                          const count = await countSelectedCells(selection);
                          await showDialog({ title: "Cell Count", message: `Non-empty cells in selection: ${count.toLocaleString()}` });
                        } else {
                          const stats = await ensureFileStats();
                          const count = stats.totalCells - stats.nullCount;
                          await showDialog({ title: "Cell Count", message: `Non-empty cells in table: ${count.toLocaleString()}` });
                        }
                      }
                    },
                    {
                      icon: faHashtag, text: "Row Count", action: async () => {
                        setOpenMenu(null);
                        const rows = storeRef.current.rowCount || 0;
                        const message = selection
                          ? `Rows in selection: ${(selection.bottom - selection.top + 1).toLocaleString()} of ${rows.toLocaleString()} in the file.`
                          : `Rows in file: ${rows.toLocaleString()}.`;
                        await showDialog({ title: "Row Count", message });
                      }
                    },
                    {
                      icon: faHashtag, text: "Column Count", action: async () => {
                        setOpenMenu(null);
                        const cols = storeRef.current.colCount || 0;
                        const message = selection
                          ? `Columns in selection: ${(selection.right - selection.left + 1).toLocaleString()} of ${cols.toLocaleString()} in the file.`
                          : `Columns in file: ${cols.toLocaleString()}.`;
                        await showDialog({ title: "Column Count", message });
                      }
                    },
                    {
                      icon: faRulerCombined, text: "File Dimensions", action: async () => {
                        setOpenMenu(null);
                        const rows = storeRef.current.rowCount || 0;
                        const cols = storeRef.current.colCount || 0;
                        await showDialog({
                          title: "File Dimensions",
                          message: `${rows.toLocaleString()} rows by ${cols.toLocaleString()} columns, for ${(rows * cols).toLocaleString()} cells in total.`
                        });
                      }
                    },
                    {
                      icon: faLocationCrosshairs, text: "Current Cell", action: async () => {
                        setOpenMenu(null);
                        const row = activeCell.row !== null ? activeCell.row : selection?.top;
                        const col = activeCell.col !== null ? activeCell.col : selection?.left;
                        if (row === undefined || row === null) {
                          await showDialog({ title: "Current Cell", message: "No cell is selected." });
                          return;
                        }
                        await showDialog({
                          title: "Current Cell",
                          message: `${a1FromRC(row, col)} is row ${(row + 1).toLocaleString()}, column ${(col + 1).toLocaleString()}.`
                        });
                      }
                    },
                    {
                      icon: faSearch, text: "Go To Cell", action: async () => {
                        setOpenMenu(null);
                        const res = await showDialog({
                          title: "Go To Cell",
                          message: "Enter a cell reference such as B250.",
                          inputs: [{ name: "reference", type: "text", defaultValue: "" }],
                          showCancel: true
                        });
                        if (!res || !res.reference) return;
                        const target = rcFromA1(String(res.reference).trim().toUpperCase());
                        if (!target) {
                          await showDialog({ title: "Go To Cell", message: "That cell reference could not be read." });
                          return;
                        }
                        await jumpTo(target.row, target.col);
                      }
                    }
                  ])}
                </div>
                <div style={{ position: "relative" }}>
                  <button ref={navigateBtnRef} className="dataTabularOperationsButton" onClick={(e) => { e.stopPropagation(); openTopMenu("navigate", navigateBtnRef); }}>Navigate</button>
                  {renderDropdownMenu("navigate", [
                    { icon: faAnglesUp, text: "Jump To Top", action: async () => { setOpenMenu(null); await jumpTo(0, selection ? selection.left : 0); } },
                    { icon: faAnglesDown, text: "Jump To Bottom", action: async () => { setOpenMenu(null); await jumpTo(lastDataRow(), selection ? selection.left : 0, "end"); } },
                    { icon: faAnglesLeft, text: "Jump To First Column", action: async () => { setOpenMenu(null); await jumpTo(selection ? selection.top : 0, 0); } },
                    { icon: faAnglesRight, text: "Jump To Last Column", action: async () => { setOpenMenu(null); await jumpTo(selection ? selection.top : 0, lastDataCol(), "end"); } },
                    { icon: faLocationCrosshairs, text: "Jump To First Cell", action: async () => { setOpenMenu(null); await jumpTo(0, 0); } },
                    { icon: faLocationCrosshairs, text: "Jump To Last Cell", action: async () => { setOpenMenu(null); await jumpTo(lastDataRow(), lastDataCol(), "end"); } }
                  ])}
                </div>
                <div style={{ position: "relative" }}>
                  <button ref={sortBtnRef} className="dataTabularOperationsButton" onClick={(e) => { e.stopPropagation(); openTopMenu("sort", sortBtnRef); }}>Sort</button>
                  {renderDropdownMenu("sort", [
                    { icon: faSortAlphaDown, text: "Sort A–Z", action: () => sortTableByColumn("sortAZ") },
                    { icon: faSortAlphaUp, text: "Sort Z–A", action: () => sortTableByColumn("sortZA") },
                    { icon: faSortNumericDown, text: "Sort 0–9", action: () => sortTableByColumn("sortNumericAsc") },
                    { icon: faSortNumericUp, text: "Sort 9–0", action: () => sortTableByColumn("sortNumericDesc") }
                  ])}
                </div>
              </div>
            </div>
          </div>
          <div className="dataTableEditingButtonsWrapper">
            <div className="dataTableStatusGroup">
              <span className="dataTableStatusItem">
                <FontAwesomeIcon icon={faRulerCombined} />
                <span>{(storeRef.current.rowCount || 0).toLocaleString()} &times; {(storeRef.current.colCount || 0).toLocaleString()}</span>
              </span>
              <span className="dataTableStatusItem">
                <FontAwesomeIcon icon={faLocationCrosshairs} />
                <span>{statusCellLabel}</span>
              </span>
              <span className="dataTableStatusItem">
                <FontAwesomeIcon icon={faArrowPointer} />
                <span>{statusSelectionLabel}</span>
              </span>
              {statsProgress !== null && (
                <span className="dataTableStatusItem dataTableStatusBusy">
                  <FontAwesomeIcon icon={faCalculator} />
                  <span>Scanning {statsProgress}%</span>
                </span>
              )}
              {hasActiveFilter && (
                <span className="dataTableStatusItem">
                  <FontAwesomeIcon icon={faFilter} />
                  <span>{filteredRows.length.toLocaleString()} Rows Shown</span>
                </span>
              )}
            </div>
            <div className="dataTableStatusActions">
              <Tippy content="Jump To Top" theme="tooltip-light">
                <button className="dataTableEditingButton dataTableStatusIconButton" onClick={() => jumpTo(0, 0)}>
                  <FontAwesomeIcon icon={faAnglesUp} />
                </button>
              </Tippy>
              <Tippy content="Jump To Bottom" theme="tooltip-light">
                <button className="dataTableEditingButton dataTableStatusIconButton" onClick={() => jumpTo(lastDataRow(), 0, "end")}>
                  <FontAwesomeIcon icon={faAnglesDown} />
                </button>
              </Tippy>
              <button className="dataTableEditingButton" onClick={clearAllFilters} disabled={!hasActiveFilter} style={{ opacity: hasActiveFilter ? 1 : 0.5 }}>
                <FontAwesomeIcon icon={faSquareMinus} /> <span style={{ marginLeft: 6 }}>Filters{hasActiveFilter ? ` (${activeFilterCount})` : ""}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div
        className="dataFormulaBarWrapper"
        onMouseDown={(e) => { interactingWithFormulaBarRef.current = true; e.stopPropagation(); }}
        onMouseUp={(e) => { e.stopPropagation(); setTimeout(() => { interactingWithFormulaBarRef.current = false; }, 0); }}
        onClick={(e) => e.stopPropagation()}
      >
        <Dropdown
          value=""
          onChange={(fn) => {
            if (!fn) return;
            if (activeCell.row !== null && activeCell.col !== null) {
              const target = formulaBarRef.current || activeInputRef.current;
              if (!target) return;
              const original = target.value;
              let base = original;
              let start = target.selectionStart ?? original.length;
              let end = target.selectionEnd ?? start;
              if (!original.trim().startsWith("=")) {
                base = "=" + original.replace(/^\s+/, "");
                const delta = base.length - original.length;
                start += delta; end += delta;
              }
              const insert = `${fn}(`;
              const newVal = base.slice(0, start) + insert + base.slice(end);
              setCellEditingValue(newVal);
              setFormulaBarValue(newVal);
              const caret = (start + insert.length);
              requestAnimationFrame(() => { try { target.focus(); target.setSelectionRange(caret, caret); } catch { } });
            } else if (selection && selection.top === selection.bottom && selection.left === selection.right) {
              const row = selection.top, col = selection.left;
              const currentVal = readFileCell(storeRef.current, row, col) || "";
              const newVal = currentVal.trim().startsWith("=") ? currentVal : `=${fn}(`;
              activateCell(row, col);
              setCellEditingValue(newVal);
              setFormulaBarValue(newVal);
            }
          }}
          options={SUPPORTED_FUNCS}
          placeholder="Functions"
          className="dataFormulaFunctionDropdown"
        />
        <input
          ref={formulaBarRef}
          className="dataFormulaBarInput"
          type="text"
          value={formulaBarValue}
          onMouseDown={(e) => { interactingWithFormulaBarRef.current = true; e.stopPropagation(); }}
          onFocus={() => {
            interactingWithFormulaBarRef.current = true;
            if (activeCell.row === null && selection && selection.top === selection.bottom && selection.left === selection.right) {
              const row = selection.top, col = selection.left;
              activateCell(row, col);
            }
          }}
          onBlur={(e) => {
            if (!e.relatedTarget?.closest?.(".dataFormulaBarWrapper")) {
              setTimeout(() => { interactingWithFormulaBarRef.current = false; }, 0);
            }
          }}
          onChange={e => {
            const v = e.target.value;
            setFormulaBarValue(v);
            setCellEditingValue(v);
            const h = cellHistoryRef.current;
            if (h.undo[h.undo.length - 1] !== v) { h.undo.push(v); h.redo = []; }
          }}
          onKeyDown={e => {
            if (e.key === "Enter") { e.preventDefault(); commitActiveCellIfNeeded(); }
            if (e.key === "Escape") { e.preventDefault(); commitActiveCellIfNeeded(); }
          }}
          placeholder={activeCell.row !== null ? "Type a value or =FORMULA(A1:B5)" : "Select a cell to edit"}
          disabled={activeCell.row === null}
        />
      </div>
      <div
        className="dataTabularWrapperContainer"
        ref={tableWrapperContainerRef}
        onContextMenu={(e) => openContextMenu(e, "blank")}
      >
        <div className="dataTabularWrapper"
          onMouseDown={e => { if (e.target.tagName !== "INPUT" && window.getSelection) window.getSelection().removeAllRanges(); }}
          onDragStart={e => { if (e.target.tagName !== "INPUT") e.preventDefault(); }}
        >
          <div className="dataTableCornerHeader"
            style={{ zIndex: 10 }}
            onMouseDown={e => {
              commitActiveCellIfNeeded();
              if (hasActiveFilter) {
                if (!filteredRows.length) { setSelection(null); return; }
                const allSel = selection?.top === filteredRows[0] && selection?.left === 0 && selection?.bottom === filteredRows[filteredRows.length - 1] && selection?.right === effectiveCols - 1;
                setSelection(allSel ? null : { top: filteredRows[0], left: 0, bottom: filteredRows[filteredRows.length - 1], right: effectiveCols - 1 });
              } else {
                const allSel = selection?.top === 0 && selection?.left === 0 && selection?.bottom === effectiveRows - 1 && selection?.right === effectiveCols - 1;
                setSelection(allSel ? null : { top: 0, left: 0, bottom: effectiveRows - 1, right: effectiveCols - 1 });
              }
              e.preventDefault();
            }}
            onContextMenu={(e) => openContextMenu(e, "blank")}
          />
          <div
            ref={columnHeaderRef}
            style={{ zIndex: 10 }}
            className="dataTableColumnHeaderContainer"
            onContextMenu={(e) => {
              const headerCell = e.target.closest(".dataTableColumnHeaderCell");
              headerCell ? openContextMenu(e, "column") : openContextMenu(e, "blank");
            }}
          >
            <div className="dataTableColumnHeaderContent" style={{ width: colWidthsCumulative[effectiveCols] || effectiveCols * DEFAULT_COL_WIDTH }}>
              {Array.from({ length: effectiveCols }).map((_, colIndex) => {
                const leftOffset = colWidthsCumulative[colIndex] || colIndex * DEFAULT_COL_WIDTH;
                const width = colWidths[colIndex] || DEFAULT_COL_WIDTH;
                const isSelectedHeader = selection && colIndex >= selection.left && colIndex <= selection.right &&
                  (hasActiveFilter
                    ? (selection.top === (filteredRows[0] ?? 0) && selection.bottom === (filteredRows[filteredRows.length - 1] ?? 0))
                    : (selection.top === 0 && selection.bottom === effectiveRows - 1)
                  );
                const filterActive = (columnFilters[colIndex] || []).length > 0;
                const triggerBg = isSelectedHeader ? "#444" : (filterActive ? "#3a2f56" : "#292929");
                return (
                  <div key={colIndex} className="dataColumnHeaderCellWrapper" style={{ left: leftOffset, width }}>
                    <div className="dataTableColumnHeaderCell" style={{ backgroundColor: isSelectedHeader ? "#444" : "#333" }} onMouseDown={e => handleColumnHeaderMouseDown(e, colIndex)} onContextMenu={(e) => openContextMenu(e, "column", { colIndex })}>{getColumnLabel(colIndex)}</div>
                    <div className="dataTabularHeaderFilterContainer" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                      <div className="dataTabularHeaderFilterIcon" style={{ backgroundColor: isSelectedHeader ? "#444" : "#313131" }}>
                        <FontAwesomeIcon icon={faFilter} />
                      </div>
                      <button
                        className="dataTabularHeaderFilter"
                        style={{ backgroundColor: triggerBg, color: "#f5f5f5", border: "none", cursor: "pointer" }}
                        onClick={(e) => openFilterDropdown(e, colIndex)}
                      >
                        {(columnFilters[colIndex]?.length > 0) ? `${columnFilters[colIndex].length} selected` : "All"}
                      </button>
                    </div>
                    <div
                      className="dataTabularColumnResizeHandle"
                      style={{
                        position: "absolute",
                        right: 0,
                        top: 0,
                        width: 4,
                        height: "100%",
                        cursor: "col-resize",
                        background: "transparent"
                      }}
                      onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setHeaderDrag({ type: "column", col: colIndex, startX: e.clientX, initialWidth: colWidths[colIndex] || DEFAULT_COL_WIDTH }); }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <div ref={rowHeaderRef} style={{ zIndex: 10 }} className="dataTableRowHeaderContainer" onContextMenu={(e) => openContextMenu(e, "row")}>
            <div className="dataTableRowHeaderContent" style={{ height: hasActiveFilter ? filteredRowHeightsCumulative[filteredRows.length] : (rowHeightsCumulative[effectiveRows] || effectiveRows * DEFAULT_ROW_HEIGHT) }}>
              {visibleRowHeaderIndices.map((gridRowIndex) => {
                const actualRow = hasActiveFilter ? filteredRows[gridRowIndex] : gridRowIndex;
                const topOffset = hasActiveFilter ? filteredRowHeightsCumulative[gridRowIndex] : (rowHeightsCumulative[gridRowIndex] || gridRowIndex * DEFAULT_ROW_HEIGHT);
                const height = rowHeights[actualRow] || DEFAULT_ROW_HEIGHT;
                const isSelectedRow = selection && actualRow >= selection.top && actualRow <= selection.bottom && selection.left === 0 && selection.right === effectiveCols - 1;
                return (
                  <div
                    key={gridRowIndex}
                    className="dataTableRowHeaderCell"
                    style={{ top: topOffset, height, backgroundColor: isSelectedRow ? "#3a3a3a" : "#2c2c2c" }}
                    onMouseDown={e => handleRowHeaderMouseDown(e, actualRow)}
                    onContextMenu={(e) => openContextMenu(e, "row", { rowIndex: actualRow })}
                  >
                    {actualRow + 1}
                    <div
                      className="dataTabularRowResizeHandle"
                      style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        width: "100%",
                        height: 4,
                        cursor: "row-resize",
                        background: "transparent"
                      }}
                      onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setHeaderDrag({ type: "row", row: actualRow, startY: e.clientY, initialHeight: rowHeights[actualRow] || DEFAULT_ROW_HEIGHT }); }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <div
            ref={gridContainerRef}
            className="dataTableGridContainer"
            onContextMenu={(e) => openContextMenu(e, "blank")}
          >
            <AutoSizer>
              {({ width, height }) => {
                if (width !== autoSizerDims.width || height !== autoSizerDims.height) {
                  queueMicrotask(() => setAutoSizerDims({ width, height }));
                }
                const GridComponent = hasCustomSizes ? VariableSizeGrid : FixedSizeGrid;
                const sizeProps = hasCustomSizes
                  ? { columnWidth: getColWidth, rowHeight: getRowHeight }
                  : { columnWidth: DEFAULT_COL_WIDTH, rowHeight: DEFAULT_ROW_HEIGHT };

                return (
                  <GridComponent
                    ref={dataGridRef}
                    outerRef={gridOuterRef}
                    columnCount={effectiveCols}
                    rowCount={hasActiveFilter ? filteredRows.length : effectiveRows}
                    {...sizeProps}
                    width={width}
                    height={height}
                    itemData={itemData}
                    itemKey={({ columnIndex, rowIndex }) => `${rowIndex}:${columnIndex}`}
                    overscanRowCount={12}
                    overscanColumnCount={4}
                    onScroll={({ scrollLeft, scrollTop }) => {
                      growToFitScroll(scrollLeft, scrollTop, width, height);
                      rangeScanGenerationRef.current++;

                      if (scrollSettleTimerRef.current) {
                        window.clearTimeout(scrollSettleTimerRef.current);
                      }

                      scrollSettleTimerRef.current = window.setTimeout(() => {
                        scrollSettleTimerRef.current = null;
                        setScrollSettleTick(n => n + 1);
                      }, SCROLL_SETTLE_MS);
                      const firstRow = getVisibleRowIndexFromPosition(scrollTop);
                      lastVisibleRowRef.current = firstRow;
                      ensureRowWindow(firstRow);

                      if (Math.abs(firstRow - headerRangeRef.current) >= ROW_HEADER_STEP) {
                        headerRangeRef.current = firstRow;
                        setHeaderRange({ first: firstRow });
                      }
                      if (columnHeaderRef.current?.firstChild) columnHeaderRef.current.firstChild.style.transform = `translateX(-${scrollLeft}px)`;
                      if (rowHeaderRef.current?.firstChild) rowHeaderRef.current.firstChild.style.transform = `translateY(-${scrollTop}px)`;
                      scrollPos.current = { left: scrollLeft, top: scrollTop };
                      if (selection && selectionOverlayRef.current) {
                        const b = overlayRect(selection, scrollLeft, scrollTop, overlayIsInteractive);
                        const style = selectionOverlayRef.current.style;

                        style.top = `${b.top}px`;
                        style.left = `${b.left}px`;
                        style.width = `${b.width}px`;
                        style.height = `${b.height}px`;
                      }
                    }}
                  >
                    {cellRenderer}
                  </GridComponent>
                );
              }}
            </AutoSizer>
            {selection && (activeCell.row === null || selection.top !== selection.bottom || selection.left !== selection.right) && (
              <div style={{ position: "absolute", top: 0, left: 0 }}>
                <div
                  ref={selectionOverlayRef}
                  className="dataTableSelectionOverlay"
                  onMouseDown={handleSelectionMouseDown}
                  onClick={handleSelectionClick}
                  onDoubleClick={handleSelectionDoubleClick}
                  onContextMenu={(e) => openContextMenu(e, "selection")}
                  style={{ zIndex: 1, pointerEvents: overlayIsInteractive ? "auto" : "none", cursor: selectionDrag.active ? "grabbing" : "grab", transform: selectionDrag.active ? `translate(${selectionDrag.offsetX}px, ${selectionDrag.offsetY}px)` : "none" }}
                >
                  <div className="dataTableSelectionHandleBottomRight" onMouseDown={e => startSelectionResize("bottom-right", e)} />
                </div>
              </div>
            )}
            {formulaPick.active && formulaPick.start && formulaPick.end && (
              <div style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", zIndex: 3 }}>
                {(() => {
                  const s = formulaPick.start, e = formulaPick.end;
                  const r1 = Math.min(s.row, e.row), r2 = Math.max(s.row, e.row);
                  const c1 = Math.min(s.col, e.col), c2 = Math.max(s.col, e.col);
                  if (!hasActiveFilter) {
                    const bounds = selectionBounds({ top: r1, left: c1, bottom: r2, right: c2 });
                    if (bounds.width <= 0 || bounds.height <= 0) return null;
                    const top = bounds.top - scrollPos.current.top;
                    const left = bounds.left - scrollPos.current.left;
                    return (
                      <div
                        className="dataTableSelectionFormulaOverlay"
                        style={{ top, left, width: bounds.width, height: bounds.height }}
                      />
                    );
                  }
                  const v1 = actualToVisibleIndex(r1);
                  const v2 = actualToVisibleIndex(r2);
                  if (v1 === -1 && v2 === -1 || !filteredRows.length) return null;
                  const from = Math.max(0, Math.min(v1 === -1 ? 0 : v1, v2 === -1 ? filteredRows.length - 1 : v2));
                  const to = Math.min(filteredRows.length - 1, Math.max(v1 === -1 ? 0 : v1, v2 === -1 ? filteredRows.length - 1 : v2));
                  const visibleActuals = filteredRows.slice(from, to + 1);
                  if (!visibleActuals.length) return null;
                  const blocks = [];
                  let bStart = visibleActuals[0], last = visibleActuals[0];
                  for (let i = 1; i < visibleActuals.length; i++) {
                    const cur = visibleActuals[i];
                    if (cur !== last + 1) { blocks.push([bStart, last]); bStart = cur; }
                    last = cur;
                  }
                  blocks.push([bStart, last]);
                  return blocks.map(([br1, br2], i) => {
                    const b = selectionBounds({ top: br1, left: c1, bottom: br2, right: c2 });
                    if (b.width <= 0 || b.height <= 0) return null;
                    const t = b.top - scrollPos.current.top;
                    const l = b.left - scrollPos.current.left;
                    return (
                      <div
                        key={i}
                        className="dataTableSelectionFormulaOverlay"
                        style={{ top: t, left: l, width: b.width, height: b.height }}
                      />
                    );
                  }).filter(Boolean);
                })()}
              </div>
            )}
            {currentFormulaPreview && !formulaPick.active && (
              <div style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", zIndex: 2 }}>
                {(() => {
                  const bounds = selectionBounds(currentFormulaPreview);
                  const top = bounds.top - scrollPos.current.top;
                  const left = bounds.left - scrollPos.current.left;
                  return (
                    <div
                      className="dataTableSelectionRangeOverlay"
                      style={{
                        top, left, width: bounds.width, height: bounds.height
                      }}
                    />
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
      {sheetNames.length > 0 && (
        <div className="dataTableSheetBar">
          <div className="dataTableSheetBarTabs">
            {sheetNames.map((name) => (
              <button
                key={name}
                className={name === activeSheet ? "dataTableSheetTab current" : "dataTableSheetTab"}
                onClick={() => switchSheet(name)}
                title={name}
              >
                {name}
              </button>
            ))}
          </div>
          <span className="dataTableSheetBarCount">
            {sheetNames.length === 1 ? "1 Sheet" : `${sheetNames.length} Sheets`}
          </span>
        </div>
      )}
      <div className="dataTableSummaryStatsWrapper">
        <div className="dataTableSummaryStatsSubWrapper">
          <div className="dataTableSummaryTitleWrapper" style={{ cursor: "pointer", color: "#cdd4e4", marginBottom: qualityCollapsed ? 0 : "" }} onClick={() => setQualityCollapsed(!qualityCollapsed)}>
            <FontAwesomeIcon icon={qualityCollapsed ? faSquarePlus : faSquareMinus} />
            <FontAwesomeIcon icon={faCheckCircle} style={{ color: "#10b981" }} />
            <strong>Data Quality</strong>
          </div>
          {!qualityCollapsed && <div className="dataTableSummaryStatList">
            {statsProgress !== null && <div><strong>Scanning File:</strong> {statsProgress}% Complete</div>}
            <div><strong>Null Count:</strong> {summaryStats.nullCount.toLocaleString()}</div>
            <div><strong>N/A Count:</strong> {summaryStats.naCount.toLocaleString()}</div>
            <div><strong>Missing:</strong> {summaryStats.missingPercent.toFixed(1)}%</div>
            <div><strong>Unique Values:</strong> {summaryStats.uniqueValues.toLocaleString()}</div>
            <div><strong>Duplicate Count:</strong> {summaryStats.duplicateCount.toLocaleString()}</div>
          </div>}
        </div>
        <div className="dataTableSummaryStatsSubWrapper">
          <div className="dataTableSummaryTitleWrapper" style={{ cursor: "pointer", color: "#cdd4e4", marginBottom: summaryCollapsed ? 0 : "" }} onClick={() => setSummaryCollapsed(!summaryCollapsed)}>
            <FontAwesomeIcon icon={summaryCollapsed ? faSquarePlus : faSquareMinus} />
            <FontAwesomeIcon icon={faCalculator} style={{ color: "#5c2be2" }} />
            <strong>Summary Statistics</strong>
          </div>
          {!summaryCollapsed && <div className="dataTableSummaryStatList">
            {statsProgress !== null && <div><strong>Scanning File:</strong> {statsProgress}% Complete</div>}
            <div><strong>Count:</strong> {summaryStats.count.toLocaleString()}</div>
            <div><strong>Mean:</strong> {summaryStats.mean.toFixed(2)}</div>
            <div><strong>Median:</strong> {summaryStats.median.toFixed(2)}</div>
            <div><strong>Standard Deviation:</strong> {summaryStats.stdDev.toFixed(2)}</div>
            <div><strong>Min:</strong> {summaryStats.min.toFixed(2)} <strong>Max:</strong> {summaryStats.max.toFixed(2)}</div>
          </div>}
        </div>
       
      </div>
      {showSearchPanel && (
        <div
          ref={searchPanelRef}
          className="dataTableEditingSearchBoxWrapper"
          style={{ position: "absolute", top: searchPanelPos.y - 80, left: searchPanelPos.x, zIndex: 10 }}
          onMouseDown={e => {
            if (e.target !== searchPanelRef.current) return;
            setSearchPanelDragging(true);
            setSearchPanelOffset({ x: e.clientX - searchPanelPos.x, y: e.clientY - searchPanelPos.y });
          }}
        >
          <div className="dataTableEditingSearchHeader">
            <label className="dataTableEditingSearchTitle">Search And Replace</label>
            <button
              className="dataTableEditingSearchClose"
              title="Close"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => { setShowSearchPanel(false); setSearchResults([]); setCurrentResultIndex(-1); }}
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
          <div className="dataTableEditngSearchBarWrapper">
            <label className="dataTableEditingSearchLabel">Search: <span><input className="dataSettingsCheckbox" type="checkbox" checked={caseSensitive} onChange={e => setCaseSensitive(e.target.checked)} />Case Sensitive</span></label>
            <input className="dataTableEditingSearchInput" type="text" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); if (e.target.value.trim()) highlightAll(e.target.value); }} />
            <div className="dataTableEditingSearchOperationsButtonWrapper">
              <button className="dataTableEditingSearchOperationsButton" onClick={() => highlightAll(searchTerm)}>Search</button>
              <button className="dataTableEditingSearchOperationsButton" onClick={goToPrevious}>Prev</button>
              <button className="dataTableEditingSearchOperationsButton" onClick={goToNext}>Next</button>
            </div>
          </div>
          <div className="dataTableEditngSearchBarWrapper">
            <label className="dataTableEditingSearchLabel">Replace:</label>
            <input className="dataTableEditingSearchInput" type="text" value={replaceTerm} onChange={e => setReplaceTerm(e.target.value)} />
            <div className="dataTableEditingSearchOperationsButtonWrapper">
              <button className="dataTableEditingSearchOperationsButton" onClick={replaceCurrent}>Replace</button>
              <button className="dataTableEditingSearchOperationsButton" onClick={replaceAll}>Replace All</button>
            </div>
          </div>

        </div>
      )}
      {ctxMenu.open && createPortal(
        <div
          ref={attachPopover(ctxMenuRef)}
          popover="manual"
          className="dataContextMenu"
          style={{ position: "fixed", left: ctxMenu.x, top: ctxMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {ctxMenu.items.map((it, i) => it.sep ? (
            <div key={`sep-${i}`} className="dataContextMenuSeparator" />
          ) : (
            <div
              key={`item-${i}`}
              className="dataContextMenuItem"
              onClick={() => { setCtxMenu(m => ({ ...m, open: false })); it.action(); }}
            >
              <span className="dataContextMenuItemLabel">
                {it.icon && <FontAwesomeIcon icon={it.icon} />}
                {it.text}
              </span>
              {it.bind && <span className="dataContextMenuItemBind">{bindLabel(it.bind)}</span>}
            </div>
          ))}
        </div>,
        document.body
      )}
      {renderFilterDropdown()}
      {saveBannerText && (<div className="codeSaveStatusIndicator">{saveBannerText}</div>)}
    </div>
  );
}