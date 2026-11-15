import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRightFromBracket, faSave, faDownload, faUndo, faRedo,
  faCut, faCopy, faPaste, faArrowPointer, faSearch,
  faIcons, faFile, faTrash, faClone, faAnglesUp, faAnglesDown,
  faArrowUp, faArrowDown, faArrowRight, faFont, faTextHeight, faBroom,
  faSortAlphaDown, faSortAlphaUp, faRetweet, faHashtag, faRulerCombined,
  faLocationCrosshairs, faCalendarDay, faClock, faMinus, faPrint,
  faRotate, faCircleInfo, faCalculator, faBold, faItalic, faUnderline,
  faStrikethrough, faHighlighter, faSuperscript, faSubscript, faPlus, faSquareRootVariable,
  faAlignLeft, faAlignCenter, faAlignRight, faAlignJustify, faArrowsUpDown, faXmark
} from "@fortawesome/free-solid-svg-icons";
import Tippy from "@tippyjs/react";
import ColorPicker from "../../../../helpers/ColorPicker.jsx";
import { showDialog } from "../../../../helpers/Alert.jsx";
import "../../../../styles/mainStyles/Studio/Documents/Text/Text.css";

const SAVE_BANNER_TIMEOUT_MS = 3000;
const PAGE_GAP_PIXELS = 28;
const POINTS_PER_INCH = 72;
const INDENT_SNAP_POINTS = 9;
const DEFAULT_PAGE_GEOMETRY = { width: 612, height: 792, top: 72, right: 72, bottom: 72, left: 72 };

const TEXT_PALETTE = [
    ["Black", "#12151b"], ["Dark Grey", "#3d4354"], ["Grey", "#6f7789"], ["Red", "#c0392b"],
    ["Orange", "#d35400"], ["Yellow", "#b7950b"], ["Green", "#1e8449"], ["Teal", "#117864"],
    ["Blue", "#1f4e79"], ["Purple", "#6c3483"], ["White", "#ffffff"]
];

const HIGHLIGHT_PALETTE = [
    ["Yellow", "#ffff00"], ["Green", "#b6f5b6"], ["Cyan", "#b6f0f5"], ["Pink", "#ffc7e0"],
    ["Orange", "#ffd9a0"], ["Grey", "#dcdcdc"], ["None", "transparent"]
];

const PLAIN_EXTENSIONS = ["txt", "text", "md", "markdown", "mdown", "log", "rst", "tex", "nfo", "me", "readme"];
const ZIP_DOCUMENT_PARTS = { docx: "word/document.xml", odt: "content.xml" };

function readCompoundFile(buffer) {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    if (view.getUint32(0, true) !== 0xe011cfd0 || view.getUint32(4, true) !== 0xe11ab1a1) return null;

    const sectorShift = view.getUint16(30, true);
    const miniShift = view.getUint16(32, true);
    const sectorSize = 1 << sectorShift;
    const miniSize = 1 << miniShift;
    const fatCount = view.getUint32(44, true);
    const directoryStart = view.getUint32(48, true);
    const miniCutoff = view.getUint32(56, true);
    const miniFatStart = view.getUint32(60, true);
    const difatStart = view.getUint32(68, true);
    const difatCount = view.getUint32(72, true);
    const sectorOffset = (sector) => (sector + 1) * sectorSize;
    const difat = [];

    for (let i = 0; i < 109 && difat.length < fatCount; i++) {
        const sector = view.getUint32(76 + i * 4, true);

        if (sector <= 0xfffffffa) difat.push(sector);
    }

    let nextDifat = difatStart;

    for (let i = 0; i < difatCount && nextDifat <= 0xfffffffa; i++) {
        const base = sectorOffset(nextDifat);

        for (let slot = 0; slot < sectorSize / 4 - 1; slot++) {
            const sector = view.getUint32(base + slot * 4, true);

            if (sector <= 0xfffffffa) difat.push(sector);
        }

        nextDifat = view.getUint32(base + sectorSize - 4, true);
    }

    const fat = [];

    for (const sector of difat) {
        const base = sectorOffset(sector);

        for (let slot = 0; slot < sectorSize / 4; slot++) fat.push(view.getUint32(base + slot * 4, true));
    }

    const chain = (start, table) => {
        const sectors = [];

        let current = start;
        let guard = 0;

        while (current <= 0xfffffffa && guard < 1000000) {
            sectors.push(current);
            current = table[current];
            guard += 1;
        }

        return sectors;
    };

    const readChain = (start, size, table, unit, offsetFor) => {
        const out = new Uint8Array(size);
        const sectors = chain(start, table);

        let written = 0;

        for (const sector of sectors) {
            if (written >= size) break;

            const from = offsetFor(sector);
            const take = Math.min(unit, size - written);

            out.set(bytes.subarray(from, from + take), written);
            written += take;
        }

        return out;
    };

    const directorySectors = chain(directoryStart, fat);
    const entries = new Map();
    const raw = [];

    for (const sector of directorySectors) {
        const base = sectorOffset(sector);

        for (let slot = 0; slot < sectorSize / 128; slot++) {
            const at = base + slot * 128;
            const nameLength = view.getUint16(at + 64, true);

            if (!nameLength) continue;

            let name = "";

            for (let i = 0; i < nameLength / 2 - 1; i++) name += String.fromCharCode(view.getUint16(at + i * 2, true));

            raw.push({
                name,
                type: view.getUint8(at + 66),
                start: view.getUint32(at + 116, true),
                size: view.getUint32(at + 120, true)
            });
        }
    }

    const root = raw.find((entry) => entry.type === 5);
    const miniFat = root ? chain(miniFatStart, fat) : [];
    const miniTable = [];

    for (const sector of miniFat) {
        const base = sectorOffset(sector);

        for (let slot = 0; slot < sectorSize / 4; slot++) miniTable.push(view.getUint32(base + slot * 4, true));
    }

    const miniStream = root ? readChain(root.start, root.size, fat, sectorSize, sectorOffset) : new Uint8Array(0);

    for (const entry of raw) {
        if (entry.type !== 2) continue;

        entries.set(entry.name, entry.size < miniCutoff
            ? readChain(entry.start, entry.size, miniTable, miniSize, (sector) => sector * miniSize)
            : readChain(entry.start, entry.size, fat, sectorSize, sectorOffset));
    }

    if (root) {
        for (const entry of raw) {
            if (entry.type !== 2 || entry.size >= miniCutoff) continue;

            const out = new Uint8Array(entry.size);
            const sectors = chain(entry.start, miniTable);

            let written = 0;

            for (const sector of sectors) {
                if (written >= entry.size) break;

                const from = sector * miniSize;
                const take = Math.min(miniSize, entry.size - written);

                out.set(miniStream.subarray(from, from + take), written);
                written += take;
            }

            entries.set(entry.name, out);
        }
    }

    return entries;
}

function textFromLegacyDoc(buffer) {
    const streams = readCompoundFile(buffer);

    if (!streams) throw new Error("This file is not a readable Word document.");

    const document = streams.get("WordDocument");

    if (!document) throw new Error("This document does not contain any Word content.");

    const view = new DataView(document.buffer, document.byteOffset, document.byteLength);
    const flags = view.getUint16(10, true);
    const table = streams.get((flags & 0x0200) ? "1Table" : "0Table") || streams.get("1Table") || streams.get("0Table");

    if (!table) throw new Error("This document is missing its text table.");

    const fcClx = view.getUint32(0x01a2, true);
    const lcbClx = view.getUint32(0x01a6, true);
    const clx = new DataView(table.buffer, table.byteOffset + fcClx, Math.min(lcbClx, table.byteLength - fcClx));

    let cursor = 0;

    while (cursor < clx.byteLength && clx.getUint8(cursor) === 1) {
        cursor += 1 + 2 + clx.getUint16(cursor + 1, true);
    }

    if (clx.getUint8(cursor) !== 2) throw new Error("This document uses an unsupported text layout.");

    const pieceLength = clx.getUint32(cursor + 1, true);
    const pieceBase = cursor + 5;
    const pieceCount = Math.floor((pieceLength - 4) / 12);
    const positions = [];

    for (let i = 0; i <= pieceCount; i++) positions.push(clx.getUint32(pieceBase + i * 4, true));

    let text = "";

    for (let i = 0; i < pieceCount; i++) {
        const descriptor = pieceBase + (pieceCount + 1) * 4 + i * 8;
        const value = clx.getUint32(descriptor + 2, true);
        const compressed = (value & 0x40000000) !== 0;
        const offset = compressed ? (value & 0x3fffffff) >>> 1 : (value & 0x3fffffff);
        const characters = positions[i + 1] - positions[i];

        if (compressed) {
            for (let c = 0; c < characters; c++) text += String.fromCharCode(document[offset + c]);
        } else {
            for (let c = 0; c < characters; c++) text += String.fromCharCode(view.getUint16(offset + c * 2, true));
        }
    }

    return text;
}

function legacyDocSprms(grpprl) {
    const sprms = new Map();

    let i = 0;

    while (i + 2 <= grpprl.length) {
        const code = grpprl[i] | (grpprl[i + 1] << 8);

        i += 2;

        const spra = code >> 13;
        let size;

        if (spra === 0 || spra === 1) size = 1;
        else if (spra === 2 || spra === 4 || spra === 5) size = 2;
        else if (spra === 3) size = 4;
        else if (spra === 7) size = 3;
        else {
            if (i >= grpprl.length) break;

            size = grpprl[i];
            i += 1;
        }

        if (i + size > grpprl.length) break;

        sprms.set(code, grpprl.slice(i, i + size));
        i += size;
    }

    return sprms;
}

const LEGACY_DOC_TOGGLES = new Map([[0x0835, "bold"], [0x0836, "italic"], [0x0837, "strike"]]);
const LEGACY_DOC_COLORS = ["", "#000000", "#0000FF", "#00FFFF", "#008000", "#FF00FF", "#FF0000", "#FFFF00", "#FFFFFF", "#00008B", "#008B8B", "#006400", "#8B008B", "#8B0000", "#8B8B00", "#A9A9A9", "#D3D3D3"];

function legacyDocApplyChp(props, sprms, base) {
    for (const [code, op] of sprms) {
        if (LEGACY_DOC_TOGGLES.has(code)) {
            const key = LEGACY_DOC_TOGGLES.get(code);
            const value = op[0];

            if (value === 0 || value === 1) props[key] = Boolean(value);
            else if (value === 128) props[key] = Boolean(base?.[key]);
            else if (value === 129) props[key] = !base?.[key];
        }
        else if (code === 0x2A3E) props.underline = op[0] !== 0;
        else if (code === 0x4A43) props.hps = op[0] | (op[1] << 8);
        else if (code === 0x2A48) props.iss = op[0];
        else if (code === 0x4A4F) props.ftc = op[0] | (op[1] << 8);
        else if (code === 0x2A42) props.color = LEGACY_DOC_COLORS[op[0]] || "";
        else if (code === 0x6870) props.color = `#${[op[0], op[1], op[2]].map((part) => part.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
        else if (code === 0x4845) {
            const position = (op[0] | (op[1] << 8)) << 16 >> 16;

            props.iss = position > 0 ? 1 : position < 0 ? 2 : 0;
        }
    }

    return props;
}

function htmlFromLegacyDoc(buffer) {
    try {
        return richHtmlFromLegacyDoc(buffer);
    } catch {
        return plainHtmlFromLegacyDoc(buffer);
    }
}

function richHtmlFromLegacyDoc(buffer) {
    const streams = readCompoundFile(buffer);

    if (!streams) throw new Error("This file is not a readable Word document.");

    const document = streams.get("WordDocument");

    if (!document) throw new Error("This document does not contain any Word content.");

    const view = new DataView(document.buffer, document.byteOffset, document.byteLength);
    const flags = view.getUint16(10, true);
    const table = streams.get((flags & 0x0200) ? "1Table" : "0Table") || streams.get("1Table") || streams.get("0Table");

    if (!table) throw new Error("This document is missing its text table.");

    const tableView = new DataView(table.buffer, table.byteOffset, table.byteLength);
    const read32 = (offset) => view.getUint32(offset, true);
    const fcStshf = read32(0x00A2);
    const lcbStshf = read32(0x00A6);
    const fcChpx = read32(0x00FA);
    const lcbChpx = read32(0x00FE);
    const fcPapx = read32(0x0102);
    const lcbPapx = read32(0x0106);
    const fcFfn = read32(0x0112);
    const lcbFfn = read32(0x0116);
    const fcClx = read32(0x01A2);
    const lcbClx = read32(0x01A6);
    const clx = new DataView(table.buffer, table.byteOffset + fcClx, Math.min(lcbClx, table.byteLength - fcClx));

    let cursor = 0;

    while (cursor < clx.byteLength && clx.getUint8(cursor) === 1) {
        cursor += 1 + 2 + clx.getUint16(cursor + 1, true);
    }

    if (clx.getUint8(cursor) !== 2) throw new Error("This document uses an unsupported text layout.");

    const pieceLength = clx.getUint32(cursor + 1, true);
    const pieceBase = cursor + 5;
    const pieceCount = Math.floor((pieceLength - 4) / 12);
    const positions = [];

    for (let i = 0; i <= pieceCount; i++) positions.push(clx.getUint32(pieceBase + i * 4, true));

    const pieces = [];
    let text = "";

    for (let i = 0; i < pieceCount; i++) {
        const descriptor = pieceBase + (pieceCount + 1) * 4 + i * 8;
        const value = clx.getUint32(descriptor + 2, true);
        const compressed = (value & 0x40000000) !== 0;
        const offset = compressed ? (value & 0x3fffffff) >>> 1 : (value & 0x3fffffff);
        const characters = positions[i + 1] - positions[i];

        pieces.push({ start: positions[i], end: positions[i + 1], offset, compressed });

        if (compressed) {
            for (let c = 0; c < characters; c++) text += String.fromCharCode(document[offset + c]);
        } else {
            for (let c = 0; c < characters; c++) text += String.fromCharCode(view.getUint16(offset + c * 2, true));
        }
    }

    const fcToCp = (fc) => {
        for (const piece of pieces) {
            const width = piece.compressed ? 1 : 2;
            const last = piece.offset + (piece.end - piece.start) * width;

            if (fc >= piece.offset && fc <= last) return piece.start + Math.floor((fc - piece.offset) / width);
        }

        return null;
    };

    const fonts = [];

    if (lcbFfn > 4) {
        const count = tableView.getUint16(fcFfn, true);
        let position = fcFfn + 4;

        for (let i = 0; i < count && position < fcFfn + lcbFfn; i++) {
            const cch = table[position];
            const entry = table.subarray(position + 1, position + 1 + cch);
            let name = "";

            for (let c = 39; c + 1 < entry.length; c += 2) {
                const unit = entry[c] | (entry[c + 1] << 8);

                if (!unit) break;

                name += String.fromCharCode(unit);
            }

            fonts.push(name);
            position += 1 + cch;
        }
    }

    const styles = [];
    let cbStdBase = 10;

    if (lcbStshf > 4) {
        const cbStshi = tableView.getUint16(fcStshf, true);
        const stshiBase = fcStshf + 2;
        const styleCount = tableView.getUint16(stshiBase, true);

        cbStdBase = tableView.getUint16(stshiBase + 2, true) || 10;

        let position = fcStshf + 2 + cbStshi;

        for (let i = 0; i < styleCount && position + 2 <= fcStshf + lcbStshf; i++) {
            const cb = tableView.getUint16(position, true);

            position += 2;

            if (!cb) {
                styles.push(null);
                continue;
            }

            const std = table.subarray(position, position + cb);

            position += cb;

            if (std.length < cbStdBase + 2) {
                styles.push(null);
                continue;
            }

            const fieldB = std[2] | (std[3] << 8);
            const fieldC = std[4] | (std[5] << 8);
            const kind = fieldB & 0x0F;
            const baseStyle = (fieldB >> 4) & 0x0FFF;
            const upxCount = fieldC & 0x0F;
            const nameLength = std[cbStdBase] | (std[cbStdBase + 1] << 8);
            let name = "";

            for (let c = 0; c < nameLength; c++) {
                const at = cbStdBase + 2 + c * 2;

                if (at + 1 >= std.length) break;

                name += String.fromCharCode(std[at] | (std[at + 1] << 8));
            }

            let upxAt = cbStdBase + 2 + nameLength * 2 + 2;

            if (upxAt % 2) upxAt += 1;

            const upxs = [];

            for (let u = 0; u < upxCount; u++) {
                if (upxAt + 2 > std.length) break;

                const cbUpx = std[upxAt] | (std[upxAt + 1] << 8);

                upxAt += 2;
                upxs.push(std.subarray(upxAt, upxAt + cbUpx));
                upxAt += cbUpx;

                if (upxAt % 2) upxAt += 1;
            }

            styles.push({ name, kind, base: baseStyle, upxs });
        }
    }

    const styleChpCache = new Map();
    const styleChp = (istd, seen) => {
        if (istd === 4095 || istd == null || istd >= styles.length) return {};
        if (styleChpCache.has(istd)) return styleChpCache.get(istd);

        const chain = seen || new Set();

        if (chain.has(istd)) return {};

        chain.add(istd);

        const style = styles[istd];

        if (!style) return {};

        const base = style.base !== 4095 ? styleChp(style.base, chain) : {};
        const upx = style.kind === 1 ? (style.upxs[1] || new Uint8Array(0)) : (style.upxs[0] || new Uint8Array(0));
        const resolved = legacyDocApplyChp({ ...base }, legacyDocSprms(upx), base);

        if (!seen) styleChpCache.set(istd, resolved);

        return resolved;
    };
    const stylePapxAlign = (istd, depth = 0) => {
        if (istd === 4095 || istd == null || istd >= styles.length || depth > 12) return null;

        const style = styles[istd];

        if (!style || style.kind !== 1) return null;

        const upx = style.upxs[0];

        if (upx && upx.length > 2) {
            const sprms = legacyDocSprms(upx.subarray(2));

            if (sprms.has(0x2403)) return sprms.get(0x2403)[0];
        }

        return style.base !== 4095 ? stylePapxAlign(style.base, depth + 1) : null;
    };

    const binTable = (fc, lcb, kind) => {
        const runs = [];

        if (lcb <= 4) return runs;

        const count = Math.floor((lcb - 4) / 8);

        for (let i = 0; i < count; i++) {
            const pn = tableView.getUint32(fc + (count + 1) * 4 + i * 4, true);
            const page = document.subarray(pn * 512, (pn + 1) * 512);

            if (page.length < 512) continue;

            const crun = page[511];
            const rgfc = [];

            for (let r = 0; r <= crun; r++) rgfc.push(page[r * 4] | (page[r * 4 + 1] << 8) | (page[r * 4 + 2] << 16) | (page[r * 4 + 3] << 24));

            for (let r = 0; r < crun; r++) {
                if (kind === "chpx") {
                    const slot = page[(crun + 1) * 4 + r];

                    if (!slot) {
                        runs.push({ fcStart: rgfc[r], fcEnd: rgfc[r + 1], sprms: new Map() });
                        continue;
                    }

                    const cb = page[slot * 2];

                    runs.push({ fcStart: rgfc[r], fcEnd: rgfc[r + 1], sprms: legacyDocSprms(page.subarray(slot * 2 + 1, slot * 2 + 1 + cb)) });
                } else {
                    const slot = page[(crun + 1) * 4 + r * 13];

                    if (!slot) {
                        runs.push({ fcStart: rgfc[r], fcEnd: rgfc[r + 1], istd: 0, sprms: new Map() });
                        continue;
                    }

                    let cb = page[slot * 2];
                    let start = slot * 2 + 1;

                    if (cb === 0) {
                        cb = page[slot * 2 + 1] * 2;
                        start = slot * 2 + 2;
                    } else {
                        cb = cb * 2 - 1;
                    }

                    const grpprl = page.subarray(start, start + cb);
                    const istd = grpprl.length >= 2 ? grpprl[0] | (grpprl[1] << 8) : 0;

                    runs.push({ fcStart: rgfc[r], fcEnd: rgfc[r + 1], istd, sprms: legacyDocSprms(grpprl.subarray(2)) });
                }
            }
        }

        return runs;
    };

    const charRuns = binTable(fcChpx, lcbChpx, "chpx").map((run) => ({ ...run, start: fcToCp(run.fcStart), end: fcToCp(run.fcEnd) })).filter((run) => run.start !== null);
    const paraRuns = binTable(fcPapx, lcbPapx, "papx").map((run) => ({ ...run, start: fcToCp(run.fcStart), end: fcToCp(run.fcEnd) })).filter((run) => run.start !== null);
    const paragraphAt = (cp) => paraRuns.find((run) => run.start <= cp && cp < (run.end ?? Infinity)) || null;
    const charAt = (cp) => charRuns.find((run) => run.start <= cp && cp < (run.end ?? Infinity)) || null;
    const normal = styleChp(0);
    const defaultSize = normal.hps || 24;
    const defaultFont = fonts[normal.ftc ?? 0] || "Times New Roman";
    const boundaries = [...new Set([0, ...charRuns.map((run) => run.start), ...paraRuns.map((run) => run.start)])].sort((left, right) => left - right);

    const runHtml = (segment, props) => {
        const size = (props.hps || defaultSize) / 2;
        const font = props.ftc != null ? (fonts[props.ftc] || defaultFont) : defaultFont;
        const declarations = [
            `font-size:${size}pt`,
            `font-weight:${props.bold ? 700 : 400}`,
            `font-style:${props.italic ? "italic" : "normal"}`,
            `text-decoration-line:${[props.underline ? "underline" : "", props.strike ? "line-through" : ""].join(" ").trim() || "none"}`,
            `font-family:'${font.replace(/'/g, "")}', serif`,
            `color:${props.color && props.color !== "#FFFFFF" ? props.color : "#000000"}`
        ].join(";");
        const cleaned = segment
            .replace(/\u0007/g, "\t")
            .replace(/[\u0001\u0002\u0005\u0008\u000e\u0013\u0014\u0015\u001e\u001f]/g, "")
            .replace(/\u000b/g, "\n");

        if (!cleaned) return "";

        const body = escapeXml(cleaned).replace(/\n/g, "<br />");
        let html = `<span class="dw-run" style="${declarations}">${body}</span>`;

        if (props.iss === 1) html = `<sup>${html}</sup>`;
        if (props.iss === 2) html = `<sub>${html}</sub>`;

        return html;
    };

    const paragraphs = [];
    let currentRuns = [];
    let currentStart = 0;

    const flush = (endCp) => {
        const paragraph = paragraphAt(currentStart);
        const align = paragraph ? (paragraph.sprms.get(0x2403)?.[0] ?? stylePapxAlign(paragraph.istd)) : null;
        const style = paragraph && styles[paragraph.istd] ? styles[paragraph.istd] : null;
        const heading = style && /^heading\s*([1-6])$/i.test(style.name) ? Number(style.name.match(/^heading\s*([1-6])$/i)[1]) : null;
        const tag = heading ? `h${heading}` : "p";
        const alignText = align === 1 ? "center" : align === 2 ? "right" : (align === 3 || align === 4) ? "justify" : null;
        const declarations = [`margin-top:0pt`, `margin-bottom:0pt`, `line-height:normal`];

        if (alignText) declarations.push(`text-align:${alignText}`);

        const inner = currentRuns.join("");

        paragraphs.push(`<${tag} class="dw-p" style="${declarations.join(";")}">${inner || "<br />"}</${tag}>`);
        currentRuns = [];
        currentStart = endCp;
    };

    for (let i = 0; i < boundaries.length; i++) {
        const start = boundaries[i];
        const end = i + 1 < boundaries.length ? boundaries[i + 1] : text.length;

        if (start >= text.length) break;

        const run = charAt(start);
        const paragraph = paragraphAt(start);
        const base = styleChp(paragraph ? paragraph.istd : 0);
        const props = legacyDocApplyChp({ ...base }, run ? run.sprms : new Map(), base);
        let segmentStart = start;

        for (let cp = start; cp < end && cp < text.length; cp++) {
            if (text[cp] === "\r" || text[cp] === "\u000c") {
                if (cp > segmentStart) currentRuns.push(runHtml(text.slice(segmentStart, cp), props));

                flush(cp + 1);
                segmentStart = cp + 1;
            }
        }

        if (segmentStart < Math.min(end, text.length)) currentRuns.push(runHtml(text.slice(segmentStart, Math.min(end, text.length)), props));
    }

    if (currentRuns.length) flush(text.length);
    if (!paragraphs.length) throw new Error("This document has no readable paragraphs.");

    return paragraphs.join("");
}

function plainHtmlFromLegacyDoc(buffer) {
    const text = textFromLegacyDoc(buffer);
    const cleaned = text
        .replace(/\u0007/g, "\t")
        .replace(/[\u0001\u0002\u0005\u0008\u000e\u0013\u0014\u0015\u001e\u001f]/g, "")
        .replace(/\u000b/g, "\n")
        .replace(/\u000c/g, "\r");

    return cleaned.split(/\r/).map((paragraph) => {
        const body = paragraph.replace(/\n/g, "<br />");

        return `<p class="dw-p">${body.trim() ? `<span class="dw-run">${escapeXml(body)}</span>` : "<br />"}</p>`;
    }).join("");
}

const EQUATION_SYMBOLS = {
    leftarrow: "\u2190", rightarrow: "\u2192", leftrightarrow: "\u2194", uparrow: "\u2191",
    downarrow: "\u2193", updownarrow: "\u2195", Leftarrow: "\u21d0", Rightarrow: "\u21d2",
    Leftrightarrow: "\u21d4", Uparrow: "\u21d1", Downarrow: "\u21d3", Updownarrow: "\u21d5",
    to: "\u2192",
    alpha: "\u03b1", beta: "\u03b2", gamma: "\u03b3", delta: "\u03b4", epsilon: "\u03f5",
    varepsilon: "\u03b5", zeta: "\u03b6", eta: "\u03b7", theta: "\u03b8", vartheta: "\u03d1",
    iota: "\u03b9", kappa: "\u03ba", lambda: "\u03bb", mu: "\u03bc", nu: "\u03bd", xi: "\u03be",
    pi: "\u03c0", varpi: "\u03d6", rho: "\u03c1", varrho: "\u03f1", sigma: "\u03c3",
    varsigma: "\u03c2", tau: "\u03c4", upsilon: "\u03c5", phi: "\u03d5", varphi: "\u03c6",
    chi: "\u03c7", psi: "\u03c8", omega: "\u03c9", Gamma: "\u0393", Delta: "\u0394",
    Theta: "\u0398", Lambda: "\u039b", Xi: "\u039e", Pi: "\u03a0", Sigma: "\u03a3",
    Upsilon: "\u03a5", Phi: "\u03a6", Psi: "\u03a8", Omega: "\u03a9",
    leq: "\u2264", geq: "\u2265", prec: "\u227a", succ: "\u227b", preceq: "\u2aaf",
    succeq: "\u2ab0", ll: "\u226a", gg: "\u226b", equiv: "\u2261", sim: "\u223c",
    simeq: "\u2243", asymp: "\u224d", approx: "\u2248", ne: "\u2260", neq: "\u2260",
    subset: "\u2282", supset: "\u2283", subseteq: "\u2286", supseteq: "\u2287",
    in: "\u2208", ni: "\u220b", notin: "\u2209",
    times: "\u00d7", div: "\u00f7", cdot: "\u22c5", pm: "\u00b1", mp: "\u2213",
    ast: "\u2217", star: "\u22c6", circ: "\u2218", bullet: "\u2219", oplus: "\u2295",
    ominus: "\u2296", oslash: "\u2298", otimes: "\u2297", odot: "\u2299", dagger: "\u2020",
    ddagger: "\u2021", vee: "\u2228", wedge: "\u2227", cap: "\u2229", cup: "\u222a",
    aleph: "\u2135", Re: "\u211c", Im: "\u2111", top: "\u22a4", bot: "\u22a5",
    infty: "\u221e", partial: "\u2202", forall: "\u2200", exists: "\u2203", neg: "\u00ac",
    triangle: "\u25b3", diamond: "\u22c4", hbar: "\u210f", nabla: "\u2207", propto: "\u221d",
    dots: "\u2026", ldots: "\u2026", cdots: "\u22ef", vdots: "\u22ee", ddots: "\u22f1",
    vdash: "\u22a2", degree: "\u00b0", angle: "\u2220", perp: "\u22a5", parallel: "\u2225"
};

const EQUATION_FUNCTIONS = [
    "sin", "sinh", "arcsin", "cos", "cosh", "arccos", "tan", "tanh", "arctan", "sec", "csc",
    "cot", "coth", "arg", "deg", "ker", "det", "dim", "Pr", "exp", "ln", "lg", "log", "gcd",
    "hom", "inf", "sup", "min", "max"
];

const EQUATION_STRUCTURES = {
    frac: { slots: 2, build: (a, b) => `<mfrac>${a}${b}</mfrac>`, latex: (a, b) => `\\frac{${a}}{${b}}` },
    sqrt: { slots: 1, build: (a) => `<msqrt>${a}</msqrt>`, latex: (a) => `\\sqrt{${a}}` },
    rootof: { slots: 2, build: (a, b) => `<mroot>${a}${b}</mroot>`, latex: (a, b) => `\\sqrt[${b}]{${a}}` },
    superscript: { slots: 2, build: (a, b) => `<msup>${a}${b}</msup>`, latex: (a, b) => `${a}^{${b}}` },
    subscript: { slots: 2, build: (a, b) => `<msub>${a}${b}</msub>`, latex: (a, b) => `${a}_{${b}}` },
    subsuperscript: { slots: 3, build: (a, b, c) => `<msubsup>${a}${b}${c}</msubsup>`, latex: (a, b, c) => `${a}_{${b}}^{${c}}` },
    abs: { slots: 1, build: (a) => `<mrow><mo>|</mo>${a}<mo>|</mo></mrow>`, latex: (a) => `\\left|${a}\\right|` },
    rbracelr: { slots: 1, build: (a) => `<mrow><mo>(</mo>${a}<mo>)</mo></mrow>`, latex: (a) => `\\left(${a}\\right)` },
    bracelr: { slots: 1, build: (a) => `<mrow><mo>[</mo>${a}<mo>]</mo></mrow>`, latex: (a) => `\\left[${a}\\right]` },
    sbracelr: { slots: 1, build: (a) => `<mrow><mo>{</mo>${a}<mo>}</mo></mrow>`, latex: (a) => `\\left\\{${a}\\right\\}` },
    binom: { slots: 2, build: (a, b) => `<mrow><mo>(</mo><mfrac linethickness="0">${a}${b}</mfrac><mo>)</mo></mrow>`, latex: (a, b) => `\\binom{${a}}{${b}}` },
    binomab: { slots: 2, build: (a, b) => `<mrow><mo>(</mo><mfrac linethickness="0">${a}${b}</mfrac><mo>)</mo></mrow>`, latex: (a, b) => `\\binom{${a}}{${b}}` },
    choose: { slots: 2, build: (a, b) => `<mrow><mo>(</mo><mfrac linethickness="0">${a}${b}</mfrac><mo>)</mo></mrow>`, latex: (a, b) => `\\binom{${a}}{${b}}` },
    dot: { slots: 1, build: (a) => `<mover accent="true">${a}<mo>&#775;</mo></mover>`, latex: (a) => `\\dot{${a}}` },
    ddot: { slots: 1, build: (a) => `<mover accent="true">${a}<mo>&#776;</mo></mover>`, latex: (a) => `\\ddot{${a}}` },
    tilde: { slots: 1, build: (a) => `<mover accent="true">${a}<mo>~</mo></mover>`, latex: (a) => `\\tilde{${a}}` },
    hat: { slots: 1, build: (a) => `<mover accent="true">${a}<mo>^</mo></mover>`, latex: (a) => `\\hat{${a}}` },
    widehat: { slots: 1, build: (a) => `<mover accent="true">${a}<mo stretchy="true">^</mo></mover>`, latex: (a) => `\\widehat{${a}}` },
    bar: { slots: 1, build: (a) => `<mover accent="true">${a}<mo>&#175;</mo></mover>`, latex: (a) => `\\bar{${a}}` },
    vec: { slots: 1, build: (a) => `<mover accent="true">${a}<mo>&#8407;</mo></mover>`, latex: (a) => `\\vec{${a}}` },
    overline: { slots: 1, build: (a) => `<mover accent="true">${a}<mo stretchy="true">&#175;</mo></mover>`, latex: (a) => `\\overline{${a}}` },
    underline: { slots: 1, build: (a) => `<munder accentunder="true">${a}<mo stretchy="true">&#818;</mo></munder>`, latex: (a) => `\\underline{${a}}` }
};

const EQUATION_OPERATORS = {
    sum: "\u2211", prod: "\u220f", coprod: "\u2210", bigcap: "\u22c2", bigcup: "\u22c3",
    int: "\u222b", oint: "\u222e", iint: "\u222c", iiint: "\u222d"
};

const EQUATION_LIMITS = { lim: "lim", liminf: "lim inf", limsup: "lim sup" };

function latexFromMathml(node) {
    if (!node) return "";

    if (node.nodeType === 3) return node.nodeValue.replace(/\u200b/g, "");

    const children = [...node.childNodes];
    const parts = children.map(latexFromMathml);
    const joined = parts.join("");

    switch (node.localName) {
        case "mfrac":
            return node.getAttribute("linethickness") === "0"
                ? `\\binom{${parts[0] || ""}}{${parts[1] || ""}}`
                : `\\frac{${parts[0] || ""}}{${parts[1] || ""}}`;
        case "msqrt":
            return `\\sqrt{${joined}}`;
        case "mroot":
            return `\\sqrt[${parts[1] || ""}]{${parts[0] || ""}}`;
        case "msup":
            return `${parts[0] || ""}^{${parts[1] || ""}}`;
        case "msub":
            return `${parts[0] || ""}_{${parts[1] || ""}}`;
        case "msubsup":
            return `${parts[0] || ""}_{${parts[1] || ""}}^{${parts[2] || ""}}`;
        case "munder":
            return `${parts[0] || ""}_{${parts[1] || ""}}`;
        case "mover":
            return `\\overset{${parts[1] || ""}}{${parts[0] || ""}}`;
        case "munderover":
            return `${parts[0] || ""}_{${parts[1] || ""}}^{${parts[2] || ""}}`;
        case "mtable":
            return `\\begin{matrix}${children.map((row) => [...row.childNodes].map(latexFromMathml).join(" & ")).join(" \\\\ ")}\\end{matrix}`;
        default:
            return joined;
    }
}

const LATEX_BIG_OPERATORS = {
    sum: "\u2211", prod: "\u220f", coprod: "\u2210", bigcap: "\u22c2", bigcup: "\u22c3",
    bigvee: "\u22c1", bigwedge: "\u22c0", bigoplus: "\u2a01", bigotimes: "\u2a02",
    bigodot: "\u2a00", biguplus: "\u2a04", bigsqcup: "\u2a06",
    int: "\u222b", iint: "\u222c", iiint: "\u222d", iiiint: "\u2a0c", oint: "\u222e",
    oiint: "\u222f", oiiint: "\u2230"
};

const LATEX_LIMIT_WORDS = {
    lim: "lim", liminf: "lim inf", limsup: "lim sup", inf: "inf", sup: "sup",
    min: "min", max: "max", argmin: "arg min", argmax: "arg max"
};

const LATEX_ACCENTS = {
    dot: "\u02d9", ddot: "\u00a8", dddot: "\u20db", tilde: "~", widetilde: "~",
    hat: "^", widehat: "^", bar: "\u00af", overline: "\u00af", vec: "\u20d7",
    acute: "\u00b4", grave: "`", check: "\u02c7", breve: "\u02d8", ring: "\u02da",
    overrightarrow: "\u20d7", overleftarrow: "\u20d6", overbrace: "\u23de"
};

const LATEX_UNDER_ACCENTS = { underline: "\u0332", underbrace: "\u23df", utilde: "~" };

const LATEX_DELIMITERS = {
    "(": "(", ")": ")", "[": "[", "]": "]", "\\{": "{", "\\}": "}", "|": "|",
    "\\|": "\u2016", "\\langle": "\u27e8", "\\rangle": "\u27e9",
    "\\lceil": "\u2308", "\\rceil": "\u2309", "\\lfloor": "\u230a",
    "\\rfloor": "\u230b", "\\lvert": "|", "\\rvert": "|", "\\lVert": "\u2016",
    "\\rVert": "\u2016", ".": ""
};

const LATEX_EXTRA_SYMBOLS = {
    emptyset: "\u2205", varnothing: "\u2205", nexists: "\u2204", complement: "\u2201",
    setminus: "\u2216", surd: "\u221a", angle: "\u2220", measuredangle: "\u2221",
    sphericalangle: "\u2222", mid: "\u2223", nmid: "\u2224", parallel: "\u2225",
    nparallel: "\u2226", therefore: "\u2234", because: "\u2235", ratio: "\u2236",
    proportion: "\u2237", sim: "\u223c", backsim: "\u223d", cong: "\u2245",
    ncong: "\u2247", doteq: "\u2250", fallingdotseq: "\u2252", risingdotseq: "\u2253",
    eqcirc: "\u2257", circeq: "\u2257", triangleq: "\u225c", lneq: "\u2a87",
    gneq: "\u2a88", nless: "\u226e", ngtr: "\u226f", nleq: "\u2270", ngeq: "\u2271",
    lesssim: "\u2272", gtrsim: "\u2273", lessgtr: "\u2276", gtrless: "\u2277",
    nsubseteq: "\u2288", nsupseteq: "\u2289", subsetneq: "\u228a", supsetneq: "\u228b",
    uplus: "\u228e", sqsubset: "\u228f", sqsupset: "\u2290", sqsubseteq: "\u2291",
    sqsupseteq: "\u2292", sqcap: "\u2293", sqcup: "\u2294", boxplus: "\u229e",
    boxminus: "\u229f", boxtimes: "\u22a0", boxdot: "\u22a1", models: "\u22a7",
    Vdash: "\u22a9", Vvdash: "\u22aa", nvdash: "\u22ac", nVdash: "\u22ae",
    lhd: "\u22b2", rhd: "\u22b3", unlhd: "\u22b4", unrhd: "\u22b5",
    curlyvee: "\u22ce", curlywedge: "\u22cf", ltimes: "\u22c9", rtimes: "\u22ca",
    leftthreetimes: "\u22cb", rightthreetimes: "\u22cc", pitchfork: "\u22d4",
    lll: "\u22d8", ggg: "\u22d9", between: "\u226c", mapsto: "\u21a6",
    longmapsto: "\u27fc", hookleftarrow: "\u21a9", hookrightarrow: "\u21aa",
    leftharpoonup: "\u21bc", leftharpoondown: "\u21bd", rightharpoonup: "\u21c0",
    rightharpoondown: "\u21c1", rightleftharpoons: "\u21cc", leftrightharpoons: "\u21cb",
    nearrow: "\u2197", searrow: "\u2198", swarrow: "\u2199", nwarrow: "\u2196",
    longleftarrow: "\u27f5", longrightarrow: "\u27f6", longleftrightarrow: "\u27f7",
    Longleftarrow: "\u27f8", Longrightarrow: "\u27f9", Longleftrightarrow: "\u27fa",
    nleftarrow: "\u219a", nrightarrow: "\u219b", nLeftarrow: "\u21cd",
    nRightarrow: "\u21cf", nleftrightarrow: "\u21ae", rightsquigarrow: "\u21dd",
    circlearrowleft: "\u21ba", circlearrowright: "\u21bb", curvearrowleft: "\u21b6",
    curvearrowright: "\u21b7", upharpoonright: "\u21be", downharpoonright: "\u21c2",
    ell: "\u2113", wp: "\u2118", imath: "\u0131", jmath: "\u0237", Finv: "\u2132",
    Game: "\u2141", mho: "\u2127", eth: "\u00f0", beth: "\u2136", gimel: "\u2137",
    daleth: "\u2138", prime: "\u2032", dprime: "\u2033", backprime: "\u2035",
    flat: "\u266d", natural: "\u266e", sharp: "\u266f", clubsuit: "\u2663",
    diamondsuit: "\u2662", heartsuit: "\u2661", spadesuit: "\u2660",
    checkmark: "\u2713", maltese: "\u2720", S: "\u00a7", P: "\u00b6",
    copyright: "\u00a9", pounds: "\u00a3", euro: "\u20ac", yen: "\u00a5",
    cent: "\u00a2", permil: "\u2030", nabla: "\u2207", Box: "\u25a1",
    blacksquare: "\u25a0", bigcirc: "\u25cb", blacktriangle: "\u25b2",
    blacktriangledown: "\u25bc", blacktriangleleft: "\u25c0",
    blacktriangleright: "\u25b6", lozenge: "\u25ca", blacklozenge: "\u29eb",
    star: "\u22c6", bigstar: "\u2605", dag: "\u2020", ddag: "\u2021",
    colon: ":", semicolon: ";", comma: ",", quad: "\u2003", qquad: "\u2003\u2003",
    varnothingset: "\u2205", aleph: "\u2135", Alef: "\u2135"
};

const LATEX_BLACKBOARD = {
    R: "\u211d", N: "\u2115", Z: "\u2124", Q: "\u211a", C: "\u2102", P: "\u2119",
    H: "\u210d", F: "\U0001d53d", E: "\u2130", A: "\U0001d538", B: "\U0001d539"
};

function latexTokens(source) {
    const tokens = [];

    let index = 0;

    while (index < source.length) {
        const character = source[index];

        if (character === "\\") {
            const match = /^\\([a-zA-Z]+|.)/.exec(source.slice(index));

            if (!match) break;

            tokens.push({ type: "command", value: match[1] });
            index += match[0].length;
            continue;
        }

        if (/\s/.test(character)) {
            index += 1;
            continue;
        }

        if (/[0-9]/.test(character)) {
            const match = /^[0-9]+(\.[0-9]+)?/.exec(source.slice(index));

            tokens.push({ type: "number", value: match[0] });
            index += match[0].length;
            continue;
        }

        tokens.push({ type: "character", value: character });
        index += 1;
    }

    return tokens;
}

function mathmlFromLatex(source) {
    const tokens = latexTokens(String(source || ""));

    let cursor = 0;

    const peek = () => tokens[cursor];
    const take = () => tokens[cursor++];

    const wrap = (nodes) => (nodes.length === 1 ? nodes[0] : `<mrow>${nodes.join("")}</mrow>`);

    const parseGroup = () => {
        const token = peek();

        if (!token) return "<mrow></mrow>";

        if (token.type === "character" && token.value === "{") {
            take();

            const nodes = [];

            while (peek() && !(peek().type === "character" && peek().value === "}")) {
                const node = parseAtom();

                if (node) nodes.push(node);
            }

            take();

            return wrap(nodes.length ? nodes : ["<mrow></mrow>"]);
        }

        return parseAtom() || "<mrow></mrow>";
    };

    const parseOptional = () => {
        const token = peek();

        if (token && token.type === "character" && token.value === "[") {
            take();

            const nodes = [];

            while (peek() && !(peek().type === "character" && peek().value === "]")) {
                const node = parseAtom();

                if (node) nodes.push(node);
            }

            take();

            return wrap(nodes.length ? nodes : ["<mrow></mrow>"]);
        }

        return null;
    };

    const parseScripts = (base) => {
        let result = base;
        let sub = null;
        let sup = null;

        for (let pass = 0; pass < 2; pass++) {
            const token = peek();

            if (!token || token.type !== "character") break;

            if (token.value === "_" && sub === null) {
                take();
                sub = parseGroup();
                continue;
            }

            if (token.value === "^" && sup === null) {
                take();
                sup = parseGroup();
                continue;
            }

            break;
        }

        if (sub !== null && sup !== null) result = `<msubsup>${base}${sub}${sup}</msubsup>`;
        else if (sub !== null) result = `<msub>${base}${sub}</msub>`;
        else if (sup !== null) result = `<msup>${base}${sup}</msup>`;

        return result;
    };

    const parseCommand = (name) => {
        if (name === "frac" || name === "dfrac" || name === "tfrac" || name === "cfrac") {
            return `<mfrac>${parseGroup()}${parseGroup()}</mfrac>`;
        }

        if (name === "binom" || name === "choose" || name === "dbinom") {
            return `<mrow><mo>(</mo><mfrac linethickness="0">${parseGroup()}${parseGroup()}</mfrac><mo>)</mo></mrow>`;
        }

        if (name === "sqrt") {
            const degree = parseOptional();
            const radicand = parseGroup();

            return degree ? `<mroot>${radicand}${degree}</mroot>` : `<msqrt>${radicand}</msqrt>`;
        }

        if (name === "rootof") {
            const radicand = parseGroup();

            return `<mroot>${radicand}${parseGroup()}</mroot>`;
        }

        if (LATEX_ACCENTS[name]) {
            return `<mover accent="true">${parseGroup()}<mo>${escapeXml(LATEX_ACCENTS[name])}</mo></mover>`;
        }

        if (LATEX_UNDER_ACCENTS[name]) {
            return `<munder accentunder="true">${parseGroup()}<mo>${escapeXml(LATEX_UNDER_ACCENTS[name])}</mo></munder>`;
        }

        if (LATEX_BIG_OPERATORS[name]) {
            return parseScripts(`<mo>${escapeXml(LATEX_BIG_OPERATORS[name])}</mo>`)
                .replace("<msubsup>", "<munderover>")
                .replace("</msubsup>", "</munderover>")
                .replace("<msub>", "<munder>")
                .replace("</msub>", "</munder>")
                .replace("<msup>", "<mover>")
                .replace("</msup>", "</mover>");
        }

        if (LATEX_LIMIT_WORDS[name]) {
            const label = `<mi mathvariant="normal">${escapeXml(LATEX_LIMIT_WORDS[name])}</mi>`;
            const token = peek();

            if (token && token.type === "character" && token.value === "_") {
                take();

                return `<munder>${label}${parseGroup()}</munder>`;
            }

            return label;
        }

        if (EQUATION_FUNCTIONS.includes(name)) {
            return parseScripts(`<mi mathvariant="normal">${escapeXml(name)}</mi>`);
        }

        if (name === "left" || name === "right") {
            const token = take();
            const key = token ? (token.type === "command" ? `\\${token.value}` : token.value) : "";
            const glyph = LATEX_DELIMITERS[key] ?? key;

            return glyph ? `<mo stretchy="true">${escapeXml(glyph)}</mo>` : "";
        }

        if (name === "mathbb" || name === "Bbb") {
            const group = parseGroup();
            const letter = group.replace(/<[^>]*>/g, "");

            return `<mi>${escapeXml(LATEX_BLACKBOARD[letter] || letter)}</mi>`;
        }

        if (name === "mathrm" || name === "text" || name === "textrm" || name === "operatorname") {
            const group = parseGroup();

            return `<mi mathvariant="normal">${escapeXml(group.replace(/<[^>]*>/g, ""))}</mi>`;
        }

        if (name === "mathbf" || name === "bm" || name === "boldsymbol") {
            return `<mstyle mathvariant="bold">${parseGroup()}</mstyle>`;
        }

        if (name === "mathit") return `<mstyle mathvariant="italic">${parseGroup()}</mstyle>`;
        if (name === "mathcal") return `<mstyle mathvariant="script">${parseGroup()}</mstyle>`;
        if (name === "mathfrak") return `<mstyle mathvariant="fraktur">${parseGroup()}</mstyle>`;
        if (name === "mathsf") return `<mstyle mathvariant="sans-serif">${parseGroup()}</mstyle>`;
        if (name === "mathtt") return `<mstyle mathvariant="monospace">${parseGroup()}</mstyle>`;

        if (name === "begin" || name === "end") {
            const group = parseGroup().replace(/<[^>]*>/g, "");

            if (name === "end") return "";

            const rows = [];
            let cells = [];
            let nodes = [];

            const flushCell = () => { cells.push(`<mtd>${wrap(nodes.length ? nodes : ["<mrow></mrow>"])}</mtd>`); nodes = []; };
            const flushRow = () => { flushCell(); rows.push(`<mtr>${cells.join("")}</mtr>`); cells = []; };

            while (peek()) {
                const token = peek();

                if (token.type === "command" && token.value === "end") {
                    take();
                    parseGroup();
                    break;
                }

                if (token.type === "command" && token.value === "\\") {
                    take();
                    flushRow();
                    continue;
                }

                if (token.type === "character" && token.value === "&") {
                    take();
                    flushCell();
                    continue;
                }

                const node = parseAtom();

                if (node) nodes.push(node);
            }

            if (nodes.length || cells.length) flushRow();

            const table = `<mtable>${rows.join("")}</mtable>`;
            const fences = {
                pmatrix: ["(", ")"], bmatrix: ["[", "]"], Bmatrix: ["{", "}"],
                vmatrix: ["|", "|"], Vmatrix: ["\u2016", "\u2016"], cases: ["{", ""]
            }[group];

            if (!fences) return table;

            return `<mrow><mo stretchy="true">${escapeXml(fences[0])}</mo>${table}${fences[1] ? `<mo stretchy="true">${escapeXml(fences[1])}</mo>` : ""}</mrow>`;
        }

        const glyph = EQUATION_SYMBOLS[name] || LATEX_EXTRA_SYMBOLS[name] || EQUATION_OPERATORS[name];

        if (glyph) return parseScripts(`<mo>${escapeXml(glyph)}</mo>`);

        if (name === ",") return '<mspace width="0.17em"/>';
        if (name === ";") return '<mspace width="0.28em"/>';
        if (name === "!") return '<mspace width="-0.17em"/>';
        if (name === " ") return '<mspace width="0.25em"/>';

        return `<mi mathvariant="normal">${escapeXml(name)}</mi>`;
    };

    function parseAtom() {
        const token = take();

        if (!token) return null;

        if (token.type === "command") return parseCommand(token.value);

        if (token.type === "number") return parseScripts(`<mn>${escapeXml(token.value)}</mn>`);

        const character = token.value;

        if (character === "{") {
            cursor -= 1;

            return parseScripts(parseGroup());
        }

        if (character === "}" || character === "&") return null;

        if (character === "_" || character === "^") {
            cursor -= 1;

            return parseScripts("<mrow></mrow>");
        }

        if (character === EQUATION_PLACEHOLDER) return parseScripts('<mi class="dw-ph">&#9633;</mi>');

        if (/[a-zA-Z]/.test(character)) return parseScripts(`<mi>${escapeXml(character)}</mi>`);

        return parseScripts(`<mo>${escapeXml(character)}</mo>`);
    }

    const nodes = [];

    while (cursor < tokens.length) {
        const node = parseAtom();

        if (node) nodes.push(node);
    }

    return `<math xmlns="http://www.w3.org/1998/Math/MathML" display="inline"><mrow>${nodes.join("")}</mrow></math>`;
}

const EQUATION_PLACEHOLDER = "\u25a1";

const EQUATION_PALETTES = [
    {
        key: "structures",
        label: "Fractions And Roots",
        glyph: "\u221a",
        entries: [
            { insert: "\\frac{\u25a1}{\u25a1}" },
            { insert: "\\frac{\\partial \u25a1}{\\partial \u25a1}" },
            { insert: "\\binom{\u25a1}{\u25a1}" },
            { insert: "\\sqrt{\u25a1}" },
            { insert: "\\sqrt[\u25a1]{\u25a1}" },
            { insert: "\\frac{\\sqrt{\u25a1}}{\u25a1}" },
            { insert: "\\frac{\u25a1}{\\sqrt{\u25a1}}" },
            { insert: "\\frac{\u25a1 + \u25a1}{\u25a1 - \u25a1}" }
        ]
    },
    {
        key: "scripts",
        label: "Scripts And Indices",
        glyph: "x\u00b2",
        entries: [
            { insert: "{\u25a1}^{\u25a1}" },
            { insert: "{\u25a1}_{\u25a1}" },
            { insert: "{\u25a1}_{\u25a1}^{\u25a1}" },
            { insert: "{\u25a1}^{2}" },
            { insert: "{\u25a1}^{3}" },
            { insert: "{\u25a1}^{-1}" },
            { insert: "{\u25a1}^{\\frac{1}{2}}" },
            { insert: "e^{\u25a1}" },
            { insert: "10^{\u25a1}" },
            { insert: "{\u25a1}^{\\prime}" },
            { insert: "{\u25a1}_{i}" },
            { insert: "{\u25a1}_{n}" }
        ]
    },
    {
        key: "operators",
        label: "Sums And Integrals",
        glyph: "\u2211",
        entries: [
            { insert: "\\sum_{\u25a1}^{\u25a1}{\u25a1}" },
            { insert: "\\sum_{i=1}^{n}{\u25a1}" },
            { insert: "\\prod_{\u25a1}^{\u25a1}{\u25a1}" },
            { insert: "\\int_{\u25a1}^{\u25a1}{\u25a1}" },
            { insert: "\\int{\u25a1}" },
            { insert: "\\iint_{\u25a1}{\u25a1}" },
            { insert: "\\oint_{\u25a1}{\u25a1}" },
            { insert: "\\lim_{\u25a1 \\to \u25a1}{\u25a1}" },
            { insert: "\\bigcup_{\u25a1}^{\u25a1}{\u25a1}" },
            { insert: "\\bigcap_{\u25a1}^{\u25a1}{\u25a1}" },
            { insert: "\\max_{\u25a1}{\u25a1}" },
            { insert: "\\min_{\u25a1}{\u25a1}" }
        ]
    },
    {
        key: "brackets",
        label: "Brackets",
        glyph: "(\u25a1)",
        entries: [
            { insert: "\\left(\u25a1\\right)" },
            { insert: "\\left[\u25a1\\right]" },
            { insert: "\\left\\{\u25a1\\right\\}" },
            { insert: "\\left|\u25a1\\right|" },
            { insert: "\\left\\|\u25a1\\right\\|" },
            { insert: "\\left\\langle\u25a1\\right\\rangle" },
            { insert: "\\left\\lceil\u25a1\\right\\rceil" },
            { insert: "\\left\\lfloor\u25a1\\right\\rfloor" },
            { insert: "\\left(\\frac{\u25a1}{\u25a1}\\right)" },
            { insert: "\\left(\u25a1\\right)^{\u25a1}" }
        ]
    },
    {
        key: "matrices",
        label: "Matrices And Cases",
        glyph: "\u25a6",
        entries: [
            { insert: "\\begin{pmatrix}\u25a1 & \u25a1 \\\\ \u25a1 & \u25a1\\end{pmatrix}" },
            { insert: "\\begin{bmatrix}\u25a1 & \u25a1 \\\\ \u25a1 & \u25a1\\end{bmatrix}" },
            { insert: "\\begin{vmatrix}\u25a1 & \u25a1 \\\\ \u25a1 & \u25a1\\end{vmatrix}" },
            { insert: "\\begin{pmatrix}\u25a1 \\\\ \u25a1\\end{pmatrix}" },
            { insert: "\\begin{pmatrix}\u25a1 & \u25a1\\end{pmatrix}" },
            { insert: "\\begin{pmatrix}\u25a1 & \u25a1 & \u25a1 \\\\ \u25a1 & \u25a1 & \u25a1 \\\\ \u25a1 & \u25a1 & \u25a1\\end{pmatrix}" },
            { insert: "\\begin{cases}\u25a1 \\\\ \u25a1\\end{cases}" }
        ]
    },
    {
        key: "accents",
        label: "Accents And Bars",
        glyph: "x\u20d7",
        entries: [
            { insert: "\\vec{\u25a1}" },
            { insert: "\\hat{\u25a1}" },
            { insert: "\\bar{\u25a1}" },
            { insert: "\\dot{\u25a1}" },
            { insert: "\\ddot{\u25a1}" },
            { insert: "\\tilde{\u25a1}" },
            { insert: "\\overline{\u25a1}" },
            { insert: "\\underline{\u25a1}" },
            { insert: "\\overrightarrow{\u25a1}" },
            { insert: "\\overbrace{\u25a1}" },
            { insert: "\\underbrace{\u25a1}" }
        ]
    },
    {
        key: "functions",
        label: "Functions",
        glyph: "sin",
        entries: [
            ...["sin", "cos", "tan", "sec", "csc", "cot", "arcsin", "arccos", "arctan", "sinh", "cosh", "tanh"]
                .map((name) => ({ insert: `\\${name}{\u25a1}` })),
            { insert: "\\ln{\u25a1}" },
            { insert: "\\log{\u25a1}" },
            { insert: "\\log_{\u25a1}{\u25a1}" },
            { insert: "\\exp{\u25a1}" },
            { insert: "\\det{\u25a1}" },
            { insert: "\\dim{\u25a1}" },
            { insert: "\\gcd{\u25a1}" },
            { insert: "\\Pr{\u25a1}" }
        ]
    },
    {
        key: "greek",
        label: "Greek Letters",
        glyph: "\u03b1",
        entries: ["alpha", "beta", "gamma", "delta", "epsilon", "varepsilon", "zeta", "eta", "theta", "vartheta", "iota", "kappa", "lambda", "mu", "nu", "xi", "pi", "varpi", "rho", "varrho", "sigma", "varsigma", "tau", "upsilon", "phi", "varphi", "chi", "psi", "omega", "Gamma", "Delta", "Theta", "Lambda", "Xi", "Pi", "Sigma", "Upsilon", "Phi", "Psi", "Omega"]
    },
    {
        key: "relations",
        label: "Relations",
        glyph: "\u2264",
        entries: ["leq", "geq", "nleq", "ngeq", "ll", "gg", "prec", "succ", "preceq", "succeq", "equiv", "sim", "simeq", "cong", "asymp", "approx", "doteq", "triangleq", "propto", "ne", "lesssim", "gtrsim", "in", "ni", "notin", "subset", "supset", "subseteq", "supseteq", "nsubseteq", "sqsubseteq", "mid", "nmid", "parallel", "perp", "models", "vdash", "therefore", "because"]
    },
    {
        key: "misc",
        label: "Operators And Symbols",
        glyph: "\u00b1",
        entries: ["times", "div", "cdot", "pm", "mp", "ast", "star", "circ", "bullet", "oplus", "ominus", "otimes", "odot", "setminus", "wedge", "vee", "cap", "cup", "uplus", "sqcap", "sqcup", "neg", "partial", "nabla", "infty", "degree", "prime", "hbar", "ell", "Re", "Im", "aleph", "dots", "cdots", "vdots", "ddots", "quad"]
    },
    {
        key: "arrows",
        label: "Arrows",
        glyph: "\u2192",
        entries: ["leftarrow", "rightarrow", "leftrightarrow", "uparrow", "downarrow", "updownarrow", "Leftarrow", "Rightarrow", "Leftrightarrow", "longleftarrow", "longrightarrow", "longleftrightarrow", "Longrightarrow", "mapsto", "longmapsto", "hookleftarrow", "hookrightarrow", "nearrow", "searrow", "swarrow", "nwarrow", "rightleftharpoons", "to"]
    },
    {
        key: "sets",
        label: "Number Sets And Logic",
        glyph: "\u211d",
        entries: [
            { insert: "\\mathbb{R}" },
            { insert: "\\mathbb{N}" },
            { insert: "\\mathbb{Z}" },
            { insert: "\\mathbb{Q}" },
            { insert: "\\mathbb{C}" },
            { insert: "\\mathbb{P}" },
            { insert: "\\emptyset" },
            { insert: "\\forall \u25a1" },
            { insert: "\\exists \u25a1" },
            { insert: "\\nexists \u25a1" },
            { insert: "\\top" },
            { insert: "\\bot" },
            { insert: "\u25a1 \\in \\mathbb{R}" },
            { insert: "\u25a1 \\subseteq \u25a1" }
        ]
    }
];

function equationPaletteEntry(entry) {
    if (typeof entry !== "string") return { ...entry, glyph: entry.glyph || entry.insert };

    return { glyph: `\\${entry}`, insert: `\\${entry}` };
}

function scopeStylesTo(cssText, scope) {
    try {
        const sheet = new CSSStyleSheet();

        sheet.replaceSync(cssText);

        const emit = (rules) => [...rules].map((rule) => {
            if (rule.type === CSSRule.STYLE_RULE) {
                const selectors = rule.selectorText.split(",").map((part) => {
                    const trimmed = part.trim();

                    if (/^(html|body)$/i.test(trimmed)) return scope;

                    return `${scope} ${trimmed}`;
                }).join(", ");

                return `${selectors}{${rule.style.cssText}}`;
            }

            if (rule.type === CSSRule.MEDIA_RULE) return `@media ${rule.conditionText}{${emit(rule.cssRules)}}`;
            if (rule.type === CSSRule.FONT_FACE_RULE) return rule.cssText;

            return "";
        }).join("\n");

        return emit(sheet.cssRules);
    } catch {
        return cssText.replace(/(^|\})\s*([^{}@\/][^{]*)\{/g, (match, close, selector) => `${close} ${selector.split(",").map((part) => `${scope} ${part.trim()}`).join(", ")}{`);
    }
}

function documentFormatFor(name) {
    const ext = String(name || "").split(".").pop().toLowerCase();

    if (ext === "docx") return { ext, kind: "docx", label: "Word Document", rich: true };
    if (ext === "doc") return { ext, kind: "doc", label: "Word 97-2003 Document", rich: true, readOnly: true };
    if (ext === "html" || ext === "htm") return { ext, kind: "html", label: "HTML Document", rich: true };
    if (ext === "odt") return { ext, kind: "odt", label: "OpenDocument Text", rich: false };
    if (ext === "rtf") return { ext, kind: "rtf", label: "Rich Text", rich: false };
    if (PLAIN_EXTENSIONS.includes(ext)) return { ext, kind: "plain", label: "Plain Text", rich: false };

    return null;
}

const HEADING_PATTERN = /^heading\s*([1-6])$/i;
const HALF_POINTS_PER_POINT = 2;
const TWIPS_PER_POINT = 20;
const LINE_UNITS_PER_LINE = 240;
const TOGGLE_PROPERTIES = ["b", "i", "strike", "caps", "smallCaps", "vanish", "emboss", "imprint", "outline", "shadow"];
const APPLICATION_RUN_DEFAULTS = { "font-size": "10pt", "font-weight": "400", "font-style": "normal", "text-decoration-line": "none" };
const EQUATION_TEMPLATES = [
    { label: "Fraction", preview: "a\u2044b", latex: "\\frac{a}{b}" },
    { label: "Power", preview: "x\u00b2", latex: "x^{2}" },
    { label: "Subscript", preview: "x\u2081", latex: "x_{1}" },
    { label: "Sub And Super", preview: "x\u2081\u00b2", latex: "x_{1}^{2}" },
    { label: "Square Root", preview: "\u221ax", latex: "\\sqrt{x}" },
    { label: "Nth Root", preview: "\u221bx", latex: "\\sqrt[n]{x}" },
    { label: "Summation", preview: "\u2211", latex: "\\sum_{i=1}^{n}{a_{i}}" },
    { label: "Product", preview: "\u220f", latex: "\\prod_{i=1}^{n}{a_{i}}" },
    { label: "Integral", preview: "\u222b", latex: "\\int{f(x)\\,dx}" },
    { label: "Definite Integral", preview: "\u222b\u2090\u1d47", latex: "\\int_{a}^{b}{f(x)\\,dx}" },
    { label: "Limit", preview: "lim", latex: "\\lim_{x \\to 0}{f(x)}" },
    { label: "Derivative", preview: "dy\u2044dx", latex: "\\frac{dy}{dx}" },
    { label: "Partial Derivative", preview: "\u2202y\u2044\u2202x", latex: "\\frac{\\partial y}{\\partial x}" },
    { label: "Binomial", preview: "(\u207f\u2096)", latex: "\\binom{n}{k}" },
    { label: "Vector", preview: "v\u20d7", latex: "\\vec{v}" },
    { label: "Matrix", preview: "[\u22ef]", latex: "\\begin{matrix}a & b \\\\ c & d\\end{matrix}" }
];
const APPLICATION_PARAGRAPH_DEFAULTS = { "margin-top": "0pt", "margin-bottom": "0pt", "line-height": "normal" };

const THEME_COLOR_SLOTS = {
    dk1: "dk1", lt1: "lt1", dk2: "dk2", lt2: "lt2",
    text1: "dk1", background1: "lt1", text2: "dk2", background2: "lt2",
    accent1: "accent1", accent2: "accent2", accent3: "accent3",
    accent4: "accent4", accent5: "accent5", accent6: "accent6",
    hyperlink: "hlink", followedHyperlink: "folHlink"
};

function parseWordTheme(themeXml) {
    const theme = { colors: {}, majorFont: null, minorFont: null };

    if (!themeXml) return theme;

    const document = new DOMParser().parseFromString(themeXml, "application/xml");

    for (const node of document.getElementsByTagName("*")) {
        if (node.localName === "clrScheme") {
            for (const slot of node.children) {
                for (const value of slot.children) {
                    const hex = value.getAttribute("lastClr") || value.getAttribute("val");

                    if (hex && /^[0-9a-fA-F]{6}$/.test(hex)) theme.colors[slot.localName] = hex.toUpperCase();
                }
            }
        }

        if (node.localName === "majorFont" || node.localName === "minorFont") {
            for (const child of node.children) {
                if (child.localName !== "latin") continue;

                const typeface = child.getAttribute("typeface");

                if (typeface) theme[node.localName] = typeface;
            }
        }
    }

    return theme;
}

function applyThemeTone(hex, tint, shade) {
    if (!hex) return hex;

    const factor = tint ? parseInt(tint, 16) / 255 : shade ? parseInt(shade, 16) / 255 : null;

    if (factor === null || !Number.isFinite(factor)) return hex;

    const channels = [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16));
    const mixed = channels.map((value) => tint
        ? Math.round(255 - (255 - value) * factor)
        : Math.round(value * factor));

    return mixed.map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0")).join("").toUpperCase();
}

function themeColorFor(theme, node, prefix) {
    const name = node?.getAttribute(`w:${prefix}`) ?? node?.getAttributeNS("*", prefix);

    if (!name || name === "none") return null;

    const slot = THEME_COLOR_SLOTS[name];

    if (!slot) return null;

    const tint = node.getAttribute(`w:${prefix}Tint`) ?? node.getAttributeNS("*", `${prefix}Tint`);
    const shade = node.getAttribute(`w:${prefix}Shade`) ?? node.getAttributeNS("*", `${prefix}Shade`);

    return applyThemeTone(theme.colors[slot], tint, shade);
}

function themeFontFor(theme, node) {
    const ascii = node?.getAttribute("w:asciiTheme") ?? node?.getAttributeNS("*", "asciiTheme");
    const hAnsi = node?.getAttribute("w:hAnsiTheme") ?? node?.getAttributeNS("*", "hAnsiTheme");
    const name = ascii || hAnsi;

    if (!name) return null;

    if (name.startsWith("major")) return theme.majorFont;
    if (name.startsWith("minor")) return theme.minorFont;

    return null;
}

function wordAttribute(node, name) {
    if (!node) return null;

    return node.getAttribute(`w:${name}`) ?? node.getAttributeNS("*", name);
}

function wordChild(node, name) {
    if (!node) return null;

    for (const child of node.children) if (child.localName === name) return child;

    return null;
}

function wordChildren(node, name) {
    const out = [];

    if (!node) return out;

    for (const child of node.children) if (child.localName === name) out.push(child);

    return out;
}

function onOffValue(node) {
    const value = wordAttribute(node, "val");

    if (value === null || value === undefined) return true;

    return !["0", "false", "off"].includes(String(value).toLowerCase());
}

function styleSlug(id) {
    return `dw-${String(id).replace(/[^A-Za-z0-9_-]/g, "-")}`;
}

function packMetadata(node) {
    return node ? encodeURIComponent(new XMLSerializer().serializeToString(node)) : "";
}

function unpackMetadata(value) {
    if (!value) return "";

    try {
        return decodeURIComponent(value);
    } catch {
        return "";
    }
}

function runPropertiesToCss(properties, declarations = {}, theme = { colors: {} }) {
    if (!properties) return declarations;

    const fonts = wordChild(properties, "rFonts");
    const size = wordChild(properties, "sz");
    const color = wordChild(properties, "color");
    const highlight = wordChild(properties, "highlight");
    const shading = wordChild(properties, "shd");
    const underline = wordChild(properties, "u");
    const bold = wordChild(properties, "b");
    const italic = wordChild(properties, "i");
    const strike = wordChild(properties, "strike");
    const doubleStrike = wordChild(properties, "dstrike");
    const caps = wordChild(properties, "caps");
    const smallCaps = wordChild(properties, "smallCaps");
    const spacing = wordChild(properties, "spacing");

    const family = wordAttribute(fonts, "ascii") || wordAttribute(fonts, "hAnsi") || themeFontFor(theme, fonts);

    if (family) declarations["font-family"] = fontStackFor(family);

    const sizeValue = Number(wordAttribute(size, "val"));

    if (Number.isFinite(sizeValue) && sizeValue > 0) declarations["font-size"] = `${sizeValue / HALF_POINTS_PER_POINT}pt`;

    const colorValue = wordAttribute(color, "val");
    const colorTheme = themeColorFor(theme, color, "themeColor");

    if (colorValue && colorValue !== "auto") declarations.color = `#${colorValue}`;
    else if (colorTheme) declarations.color = `#${colorTheme}`;

    const highlightValue = wordAttribute(highlight, "val");

    if (highlightValue && highlightValue !== "none") {
        declarations["background-color"] = HIGHLIGHT_COLORS[highlightValue]
            ? `#${HIGHLIGHT_COLORS[highlightValue]}`
            : highlightValue;
    }

    const shadingValue = wordAttribute(shading, "fill");
    const shadingTheme = themeColorFor(theme, shading, "themeFill");
    const shadingPattern = wordAttribute(shading, "val");
    const shadingForeground = wordAttribute(shading, "color");

    if (shadingPattern === "solid" && shadingForeground && shadingForeground !== "auto") {
        declarations["background-color"] = `#${shadingForeground}`;
    } else if (shadingValue && shadingValue !== "auto") declarations["background-color"] = `#${shadingValue}`;
    else if (shadingTheme) declarations["background-color"] = `#${shadingTheme}`;

    if (bold) declarations["font-weight"] = onOffValue(bold) ? "700" : "400";
    if (italic) declarations["font-style"] = onOffValue(italic) ? "italic" : "normal";

    const underlineValue = wordAttribute(underline, "val");
    const decorations = [];

    if (underline && underlineValue !== "none") decorations.push("underline");
    if ((strike && onOffValue(strike)) || (doubleStrike && onOffValue(doubleStrike))) decorations.push("line-through");

    if (decorations.length) declarations["text-decoration-line"] = decorations.join(" ");
    else if (underlineValue === "none" || (strike && !onOffValue(strike))) declarations["text-decoration-line"] = "none";

    if (caps && onOffValue(caps)) declarations["text-transform"] = "uppercase";
    if (smallCaps && onOffValue(smallCaps)) declarations["font-variant-caps"] = "small-caps";

    const spacingValue = Number(wordAttribute(spacing, "val"));

    if (Number.isFinite(spacingValue) && spacingValue) declarations["letter-spacing"] = `${spacingValue / TWIPS_PER_POINT}pt`;

    return declarations;
}

function paragraphPropertiesToCss(properties, declarations = {}, theme = { colors: {} }) {
    if (!properties) return declarations;

    const spacing = wordChild(properties, "spacing");
    const indent = wordChild(properties, "ind");
    const alignment = wordAttribute(wordChild(properties, "jc"), "val");
    const shading = wordChild(properties, "shd");

    const twips = (node, name) => {
        const raw = wordAttribute(node, name);

        if (raw === null || raw === undefined || raw === "") return null;

        const value = Number(raw);

        return Number.isFinite(value) ? value : null;
    };

    if (spacing) {
        const before = twips(spacing, "before");
        const after = twips(spacing, "after");
        const line = twips(spacing, "line");
        const rule = wordAttribute(spacing, "lineRule") || "auto";
        const autoBefore = wordChild(properties, "spacing") && onOffValue(spacing) && wordAttribute(spacing, "beforeAutospacing");
        const autoAfter = wordAttribute(spacing, "afterAutospacing");
        const autoOn = (value) => value !== null && !["0", "false", "off"].includes(String(value).toLowerCase());

        if (autoOn(autoBefore)) declarations["margin-top"] = "0pt";
        else if (before !== null) declarations["margin-top"] = `${before / TWIPS_PER_POINT}pt`;

        if (autoOn(autoAfter)) declarations["margin-bottom"] = "0pt";
        else if (after !== null) declarations["margin-bottom"] = `${after / TWIPS_PER_POINT}pt`;

        if (line !== null && line > 0) {
            declarations["line-height"] = rule === "auto"
                ? String(Math.round((line / LINE_UNITS_PER_LINE) * 1000) / 1000)
                : `${line / TWIPS_PER_POINT}pt`;
        }
    }

    if (indent) {
        const left = twips(indent, "left") ?? twips(indent, "start");
        const right = twips(indent, "right") ?? twips(indent, "end");
        const firstLine = twips(indent, "firstLine");
        const hanging = twips(indent, "hanging");

        if (left !== null) declarations["margin-left"] = `${left / TWIPS_PER_POINT}pt`;
        if (right !== null) declarations["margin-right"] = `${right / TWIPS_PER_POINT}pt`;
        if (hanging) declarations["text-indent"] = `-${hanging / TWIPS_PER_POINT}pt`;
        else if (firstLine) declarations["text-indent"] = `${firstLine / TWIPS_PER_POINT}pt`;
    }

    if (alignment === "center") declarations["text-align"] = "center";
    if (alignment === "right" || alignment === "end") declarations["text-align"] = "right";
    if (alignment === "both" || alignment === "distribute") declarations["text-align"] = "justify";
    if (alignment === "left" || alignment === "start") declarations["text-align"] = "left";

    const shadingValue = wordAttribute(shading, "fill");
    const shadingTheme = themeColorFor(theme, shading, "themeFill");

    if (shadingValue && shadingValue !== "auto") declarations["background-color"] = `#${shadingValue}`;
    else if (shadingTheme) declarations["background-color"] = `#${shadingTheme}`;

    return declarations;
}

function declarationsToText(declarations) {
    return escapeXml(Object.entries(declarations)
        .map(([name, value]) => `${name}:${value} !important`)
        .join(";"));
}

function parseWordStyles(stylesXml, themeXml) {
    const catalog = {
        styles: new Map(),
        defaultParagraph: null,
        defaultCharacter: null,
        documentRun: { ...APPLICATION_RUN_DEFAULTS },
        documentParagraph: { ...APPLICATION_PARAGRAPH_DEFAULTS },
        theme: parseWordTheme(themeXml)
    };

    if (catalog.theme.minorFont) catalog.documentRun["font-family"] = fontStackFor(catalog.theme.minorFont);

    if (!stylesXml) return catalog;

    const document = new DOMParser().parseFromString(stylesXml, "application/xml");
    const root = document.documentElement;
    const defaults = wordChild(root, "docDefaults");

    if (defaults) {
        runPropertiesToCss(wordChild(wordChild(defaults, "rPrDefault"), "rPr"), catalog.documentRun, catalog.theme);
        paragraphPropertiesToCss(wordChild(wordChild(defaults, "pPrDefault"), "pPr"), catalog.documentParagraph, catalog.theme);
    }

    for (const node of wordChildren(root, "style")) {
        const id = wordAttribute(node, "styleId");

        if (!id) continue;

        const type = wordAttribute(node, "type") || "paragraph";
        const entry = {
            id,
            type,
            name: wordAttribute(wordChild(node, "name"), "val") || id,
            basedOn: wordAttribute(wordChild(node, "basedOn"), "val"),
            runProperties: wordChild(node, "rPr"),
            paragraphProperties: wordChild(node, "pPr")
        };

        catalog.styles.set(id, entry);

        if (wordAttribute(node, "default") && onOffValue(node)) {
            if (type === "paragraph") catalog.defaultParagraph = id;
            if (type === "character") catalog.defaultCharacter = id;
        }
    }

    return catalog;
}

function styleChain(catalog, id) {
    const chain = [];
    const seen = new Set();

    let current = id;

    while (current && catalog.styles.has(current) && !seen.has(current)) {
        seen.add(current);

        const entry = catalog.styles.get(current);

        chain.unshift(entry);
        current = entry.basedOn;
    }

    return chain;
}

function mergeSplitBlocks(root) {
    for (const split of root.querySelectorAll("[data-dw-split]")) {
        const previous = split.previousElementSibling;

        if (!previous) {
            split.removeAttribute("data-dw-split");
            continue;
        }

        while (split.firstChild) previous.appendChild(split.firstChild);

        split.remove();
    }
}

function paginateEditor(editor, geometry) {
    const pending = [...editor.querySelectorAll("img")].filter((image) => !image.complete);

    if (pending.length) return pending;

    const selection = window.getSelection();
    let caret = null;

    if (document.activeElement === editor && selection && selection.rangeCount > 0) {
        const live = selection.getRangeAt(0);

        if (editor.contains(live.startContainer)) {
            const probe = live.cloneRange();

            probe.selectNodeContents(editor);
            probe.setEnd(live.startContainer, live.startOffset);
            caret = probe.toString().replace(/\u200b/g, "").length;
        }
    }

    const existingLayer = editor.querySelector(".dw-page-layer");

    editor.querySelectorAll(".dw-page-gap").forEach((node) => node.remove());
    mergeSplitBlocks(editor);
    editor.normalize();

    for (const pushed of editor.querySelectorAll("[data-dw-push]")) {
        pushed.style.marginTop = pushed.getAttribute("data-dw-push") || "";
        pushed.removeAttribute("data-dw-push");
    }

    const pointToPixel = 96 / 72;
    const pageHeight = geometry.height * pointToPixel;
    const topMargin = geometry.top * pointToPixel;
    const bottomMargin = geometry.bottom * pointToPixel;
    const usable = pageHeight - topMargin - bottomMargin;

    if (!Number.isFinite(usable) || usable <= 40) return null;

    const breakables = (node) => {
        if (/^(ul|ol)$/i.test(node.tagName) && node.children.length) {
            return [...node.children].flatMap((child) => breakables(child));
        }

        return [node];
    };

    const editorTop = () => editor.getBoundingClientRect().top;
    const topOf = (node) => node.getBoundingClientRect().top - editorTop();
    const heightOf = (node) => node.getBoundingClientRect().height;
    const lineHeightOf = (node) => {
        const parsed = parseFloat(window.getComputedStyle(node).lineHeight);

        if (Number.isFinite(parsed) && parsed > 4) return parsed;

        const size = parseFloat(window.getComputedStyle(node).fontSize);

        return Number.isFinite(size) ? size * 1.2 : 19;
    };
    const splittable = (node) => /^(p|h1|h2|h3|h4|h5|h6)$/i.test(node.tagName) && !node.querySelector("table, img, math");

    const boundaryAtOffset = (block, characters) => {
        const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
        let remaining = characters;
        let node;

        while ((node = walker.nextNode())) {
            const length = node.nodeValue.length;

            if (remaining <= length) return { node, offset: remaining };

            remaining -= length;
        }

        return null;
    };

    const splitBlockAt = (block, limit) => {
        const text = block.textContent;

        if (!text) return null;

        const range = document.createRange();
        const overLimit = (characters) => {
            const boundary = boundaryAtOffset(block, characters);

            if (!boundary) return true;

            range.setStart(boundary.node, boundary.offset);
            range.setEnd(boundary.node, boundary.offset);

            const rects = range.getClientRects();
            const rect = rects.length ? rects[rects.length - 1] : range.getBoundingClientRect();

            return rect.bottom - editorTop() > limit;
        };

        let low = 0;
        let high = text.length;

        while (low < high) {
            const middle = Math.floor((low + high) / 2);

            if (overLimit(middle)) high = middle;
            else low = middle + 1;
        }

        const index = low;

        if (index <= 0 || index >= text.length) return null;

        const breakWord = text.lastIndexOf(" ", index);
        const safe = breakWord > 0 ? breakWord + 1 : index;
        const boundary = boundaryAtOffset(block, Math.min(safe, text.length - 1));

        if (!boundary) return null;

        const tailRange = document.createRange();

        tailRange.setStart(boundary.node, boundary.offset);
        tailRange.setEndAfter(block.lastChild);

        const contents = tailRange.extractContents();

        if (!contents.textContent) return null;

        const tail = block.cloneNode(false);

        tail.appendChild(contents);
        tail.setAttribute("data-dw-split", "1");
        tail.removeAttribute("data-dw-push");
        tail.style.removeProperty("margin-top");
        tail.style.setProperty("text-indent", "0pt", "important");
        tail.style.setProperty("margin-top", "0px", "important");
        block.after(tail);

        return tail;
    };

    const pushTo = (block, target) => {
        block.setAttribute("data-dw-push", block.style.marginTop || "");

        let applied = Math.max(0, target - topOf(block));

        for (let attempt = 0; attempt < 4; attempt++) {
            block.style.setProperty("margin-top", `${applied}px`, "important");

            const drift = target - topOf(block);

            if (Math.abs(drift) <= 1) break;

            applied = Math.max(0, applied + drift);
        }
    };

    let blocks = [...editor.children]
        .filter((node) => !node.classList.contains("dw-page-layer"))
        .flatMap((node) => breakables(node));

    if (!blocks.length) return null;

    for (const span of editor.querySelectorAll(".dw-break-page")) {
        const host = span.closest("p, h1, h2, h3, h4, h5, h6, li");

        if (!host || host.parentElement !== editor) continue;
        if (!span.nextSibling && span.parentElement === host) continue;

        const tailRange = document.createRange();

        tailRange.setStartAfter(span);
        tailRange.setEndAfter(host.lastChild);

        const contents = tailRange.extractContents();

        if (!contents.textContent && !contents.querySelector?.("*")) continue;

        const tail = host.cloneNode(false);

        tail.appendChild(contents);
        tail.setAttribute("data-dw-split", "1");
        tail.setAttribute("data-dw-break-before", "1");
        tail.style.setProperty("text-indent", "0pt", "important");
        host.after(tail);
    }

    blocks = [...editor.children]
        .filter((node) => !node.classList.contains("dw-page-layer"))
        .flatMap((node) => breakables(node));

    const pageBoxes = [{ top: 0, height: pageHeight }];
    const currentPage = () => pageBoxes[pageBoxes.length - 1];
    const contentBottom = () => currentPage().top + currentPage().height - bottomMargin;

    let index = 0;
    let guard = 0;

    while (index < blocks.length && guard < 6000) {
        guard += 1;

        const block = blocks[index];
        const height = heightOf(block);
        const top = topOf(block);
        const bottom = top + height;
        const page = currentPage();
        const pageStart = page.top + topMargin;
        const forced = block.hasAttribute("data-dw-break-before") && top > pageStart + 2 && height > 0;

        if (!forced && (height <= 0 || bottom <= contentBottom() + 0.5)) {
            index += 1;
            continue;
        }

        const target = page.top + page.height + PAGE_GAP_PIXELS + topMargin;

        if (!forced && height > usable) {
            page.height = Math.max(page.height, bottom + bottomMargin - page.top);
            index += 1;
            continue;
        }

        if (!forced && splittable(block)) {
            const line = lineHeightOf(block);
            const remaining = contentBottom() - top;
            const overflowAmount = bottom - contentBottom();

            if (remaining >= line * 2 && overflowAmount >= line && height >= line * 3) {
                const tail = splitBlockAt(block, contentBottom() - 2);

                if (tail) {
                    blocks.splice(index + 1, 0, tail);
                    index += 1;
                    continue;
                }
            }
        }

        pushTo(block, target);
        pageBoxes.push({ top: page.top + page.height + PAGE_GAP_PIXELS, height: pageHeight });
        index += 1;
    }

    for (const block of blocks) {
        const height = heightOf(block);

        if (height <= 0) continue;

        const top = topOf(block);
        const bottom = top + height;
        const page = pageBoxes.findIndex((box) => top >= box.top && top < box.top + box.height);

        if (page < 0) continue;

        const box = pageBoxes[page];
        const overflow = bottom - (box.top + box.height);

        if (overflow <= 0) continue;

        box.height += overflow;

        for (let next = page + 1; next < pageBoxes.length; next++) pageBoxes[next].top += overflow;
    }

    const lastBlock = blocks[blocks.length - 1];
    const documentBottom = topOf(lastBlock) + heightOf(lastBlock) + bottomMargin;
    const tail = currentPage();

    tail.height = Math.max(tail.height, documentBottom - tail.top);

    const layer = document.createElement("div");

    layer.className = "dw-page-layer";
    layer.setAttribute("contenteditable", "false");

    for (const box of pageBoxes) {
        const sheet = document.createElement("div");

        sheet.className = "dw-page";
        sheet.style.top = `${box.top}px`;
        sheet.style.height = `${box.height}px`;
        layer.appendChild(sheet);
    }

    if (existingLayer) existingLayer.replaceWith(layer);
    else editor.insertBefore(layer, editor.firstChild);

    editor.style.minHeight = `${tail.top + tail.height}px`;

    if (caret !== null && selection) {
        const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, {
            acceptNode: (node) => node.parentElement?.closest(".dw-page-layer") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
        });
        let remaining = caret;
        let node;
        let placed = false;

        while ((node = walker.nextNode())) {
            const clean = node.nodeValue.replace(/\u200b/g, "").length;

            if (remaining <= clean) {
                let offset = 0;
                let seen = 0;

                while (offset < node.nodeValue.length && seen < remaining) {
                    if (node.nodeValue[offset] !== "\u200b") seen += 1;

                    offset += 1;
                }

                const restored = document.createRange();

                restored.setStart(node, offset);
                restored.collapse(true);
                selection.removeAllRanges();
                selection.addRange(restored);
                placed = true;
                break;
            }

            remaining -= clean;
        }

        if (!placed && editor.lastChild) {
            const restored = document.createRange();

            restored.selectNodeContents(editor);
            restored.collapse(false);
            selection.removeAllRanges();
            selection.addRange(restored);
        }
    }

    return null;
}

function mergeRunLayer(target, properties, theme) {
    if (!properties) return target;

    for (const name of TOGGLE_PROPERTIES) {
        const node = wordChild(properties, name);

        if (node) target[name] = onOffValue(node);
    }

    const direct = runPropertiesToCss(properties, {}, theme);

    for (const [key, value] of Object.entries(direct)) target.css[key] = value;

    const vertical = wordAttribute(wordChild(properties, "vertAlign"), "val");

    if (vertical) target.vertAlign = vertical === "baseline" ? null : vertical;

    return target;
}

function resolveRunStyle(catalog, paragraphStyleId, runProperties, inheritedBackground, hyperlink) {
    const characterStyleId = wordAttribute(wordChild(runProperties, "rStyle"), "val");
    const resolved = { css: { ...catalog.documentRun }, vertAlign: null };

    for (const entry of styleChain(catalog, paragraphStyleId || catalog.defaultParagraph)) {
        mergeRunLayer(resolved, entry.runProperties, catalog.theme);
    }

    for (const entry of styleChain(catalog, characterStyleId)) mergeRunLayer(resolved, entry.runProperties, catalog.theme);

    mergeRunLayer(resolved, runProperties, catalog.theme);

    const background = resolved.css["background-color"] || inheritedBackground;
    const luminance = background ? colorLuminance(background) : null;

    if (luminance !== null && luminance < 0.45 && !resolved.css.color) resolved.css.color = "#FFFFFF";

    if (hyperlink && !resolved.css.color) {
        resolved.css.color = catalog.theme.colors.hlink ? `#${catalog.theme.colors.hlink}` : "#0563C1";

        if (!resolved.css["text-decoration-line"] || resolved.css["text-decoration-line"] === "none") {
            resolved.css["text-decoration-line"] = "underline";
        }
    }

    if (!resolved.css.color) resolved.css.color = "#000000";

    if (resolved.b !== undefined) resolved.css["font-weight"] = resolved.b ? "700" : "400";
    if (resolved.i !== undefined) resolved.css["font-style"] = resolved.i ? "italic" : "normal";
    if (resolved.caps) resolved.css["text-transform"] = "uppercase";

    return resolved;
}

function resolveParagraphStyle(catalog, styleId, paragraphProperties) {
    const css = { ...catalog.documentParagraph };

    for (const entry of styleChain(catalog, styleId || catalog.defaultParagraph)) {
        paragraphPropertiesToCss(entry.paragraphProperties, css, catalog.theme);
    }

    paragraphPropertiesToCss(paragraphProperties, css, catalog.theme);

    return css;
}

function styleSheetFromCatalog(catalog, scope) {
    const rules = [];

    if (Object.keys(catalog.documentRun).length) rules.push(`${scope}{${declarationsToText(catalog.documentRun)}}`);
    if (Object.keys(catalog.documentParagraph).length) rules.push(`${scope} .dw-p{${declarationsToText(catalog.documentParagraph)}}`);

    for (const entry of catalog.styles.values()) {
        const declarations = {};

        for (const link of styleChain(catalog, entry.id)) {
            paragraphPropertiesToCss(link.paragraphProperties, declarations, catalog.theme);
            runPropertiesToCss(link.runProperties, declarations, catalog.theme);
        }

        if (!Object.keys(declarations).length) continue;

        rules.push(`${scope} .${styleSlug(entry.id)}{${declarationsToText(declarations)}}`);
    }

    return rules.join("\n");
}

function headingLevelFor(catalog, styleId) {
    if (!styleId) return null;

    const direct = HEADING_PATTERN.exec(styleId);

    if (direct) return direct[1];

    const entry = catalog.styles.get(styleId);
    const named = entry ? HEADING_PATTERN.exec(entry.name) : null;

    return named ? named[1] : null;
}

const IMAGE_MIME_TYPES = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
    bmp: "image/bmp", tif: "image/tiff", tiff: "image/tiff", svg: "image/svg+xml",
    webp: "image/webp", emf: "image/emf", wmf: "image/wmf"
};
const EMU_PER_PIXEL = 9525;
const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const HIGHLIGHT_COLORS = {
    black: "000000", blue: "0000FF", cyan: "00FFFF", darkBlue: "000080",
    darkCyan: "008080", darkGray: "808080", darkGreen: "008000",
    darkMagenta: "800080", darkRed: "800000", darkYellow: "808000",
    green: "00FF00", lightGray: "C0C0C0", magenta: "FF00FF",
    red: "FF0000", white: "FFFFFF", yellow: "FFFF00"
};

function colorLuminance(value) {
    const hex = String(value).replace("#", "");

    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;

    const [r, g, b] = [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const SERIF_FONTS = ["times", "cambria", "georgia", "garamond", "book antiqua", "palatino", "century", "minion", "constantia", "bookman", "serif"];

function fontStackFor(family) {
    const name = family.replace(/["']/g, "").trim();
    const generic = SERIF_FONTS.some((candidate) => name.toLowerCase().includes(candidate)) ? "serif" : "sans-serif";

    return `${/[^\w -]/.test(name) ? `"${name}"` : name}, ${generic}`;
}
const LIST_STYLE_TYPES = {
    bullet: "disc", decimal: "decimal", decimalZero: "decimal-leading-zero",
    lowerLetter: "lower-alpha", upperLetter: "upper-alpha",
    lowerRoman: "lower-roman", upperRoman: "upper-roman", none: "none"
};

function parseRelationships(relsXml) {
    const map = new Map();

    if (!relsXml) return map;

    const document = new DOMParser().parseFromString(relsXml, "application/xml");

    for (const node of document.getElementsByTagName("*")) {
        if (node.localName !== "Relationship") continue;

        const id = node.getAttribute("Id");
        const target = node.getAttribute("Target");

        if (id && target) map.set(id, { target, mode: node.getAttribute("TargetMode") || "Internal" });
    }

    return map;
}

function mediaDataUri(media, relationship) {
    if (!media || !relationship) return null;

    const target = relationship.target.replace(/^\.\.\//, "").replace(/^\//, "");
    const bytes = media.get(target) || media.get(`word/${target}`);

    if (!bytes) return null;

    const extension = target.split(".").pop().toLowerCase();
    const mime = IMAGE_MIME_TYPES[extension] || "application/octet-stream";

    let binary = "";

    for (let i = 0; i < bytes.length; i += 8192) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    }

    return `data:${mime};base64,${btoa(binary)}`;
}

const EMF_DIB_RECORDS = { 76: 76, 77: 76, 80: 40, 81: 40 };

function bitmapFromMetafile(bytes) {
    if (!bytes || bytes.length < 88) return null;

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    let offset = 0;

    while (offset + 8 <= bytes.length) {
        const type = view.getUint32(offset, true);
        const size = view.getUint32(offset + 4, true);

        if (size < 8 || offset + size > bytes.length) break;

        if (EMF_DIB_RECORDS[type] !== undefined) {
            const base = offset + 8 + EMF_DIB_RECORDS[type];
            const offBmi = view.getUint32(base, true);
            const cbBmi = view.getUint32(base + 4, true);
            const offBits = view.getUint32(base + 8, true);
            const cbBits = view.getUint32(base + 12, true);

            if (cbBmi >= 40 && cbBits > 0 && offset + offBits + cbBits <= bytes.length) {
                const header = bytes.subarray(offset + offBmi, offset + offBmi + cbBmi);
                const pixels = bytes.subarray(offset + offBits, offset + offBits + cbBits);
                const file = new Uint8Array(14 + cbBmi + cbBits);
                const fileView = new DataView(file.buffer);

                file[0] = 0x42;
                file[1] = 0x4d;
                fileView.setUint32(2, file.length, true);
                fileView.setUint32(10, 14 + cbBmi, true);
                file.set(header, 14);
                file.set(pixels, 14 + cbBmi);

                let binary = "";

                for (let i = 0; i < file.length; i += 8192) {
                    binary += String.fromCharCode.apply(null, file.subarray(i, i + 8192));
                }

                return `data:image/bmp;base64,${btoa(binary)}`;
            }
        }

        offset += size;
    }

    return null;
}

function drawingHtml(node, context) {
    let blip = null;
    let extent = null;

    for (const child of node.getElementsByTagName("*")) {
        if (child.localName === "blip") blip = child;
        if (child.localName === "extent" && !extent) extent = child;
    }

    if (!blip) {
        for (const child of node.getElementsByTagName("*")) {
            if (child.localName === "imagedata") blip = child;
        }
    }

    if (!blip) return "";

    const id = blip.getAttribute("r:embed") || blip.getAttributeNS("*", "embed")
        || blip.getAttribute("r:id") || blip.getAttributeNS("*", "id");
    const source = mediaDataUri(context.media, context.relationships.get(id));

    if (!source) return "";

    const width = extent ? Math.round(Number(extent.getAttribute("cx")) / EMU_PER_PIXEL) : null;
    const height = extent ? Math.round(Number(extent.getAttribute("cy")) / EMU_PER_PIXEL) : null;
    const dimensions = width && height ? ` width="${width}" height="${height}"` : "";

    if (source.startsWith("data:image/emf") || source.startsWith("data:image/wmf")) {
        const relationship = context.relationships.get(id);
        const target = relationship.target.replace(/^\.\.\//, "").replace(/^\//, "");
        const bytes = context.media.get(target) || context.media.get(`word/${target}`);
        const bitmap = bitmapFromMetafile(bytes);

        if (bitmap) return `<img class="dw-image" src="${bitmap}"${dimensions} alt="" />`;

        const size = width && height ? ` style="width:${width}px;height:${height}px"` : "";

        return `<span class="dw-image-placeholder"${size}>Image Could Not Be Displayed.</span>`;
    }

    return `<img class="dw-image" src="${source}"${dimensions} alt="" />`;
}

function numberingLevels(numberingXml) {
    const formats = new Map();

    if (!numberingXml) return formats;

    const document = new DOMParser().parseFromString(numberingXml, "application/xml");
    const abstracts = new Map();

    for (const node of document.getElementsByTagName("*")) {
        if (node.localName !== "abstractNum") continue;

        const levels = new Map();

        for (const level of wordChildren(node, "lvl")) {
            const indent = wordChild(wordChild(level, "pPr"), "ind");

            levels.set(wordAttribute(level, "ilvl") || "0", {
                format: wordAttribute(wordChild(level, "numFmt"), "val") || "decimal",
                start: wordAttribute(wordChild(level, "start"), "val") || "1",
                indent: indent ? Number(wordAttribute(indent, "left") ?? wordAttribute(indent, "start")) : null,
                hanging: indent ? Number(wordAttribute(indent, "hanging")) : null
            });
        }

        abstracts.set(wordAttribute(node, "abstractNumId"), levels);
    }

    for (const node of document.getElementsByTagName("*")) {
        if (node.localName !== "num") continue;

        formats.set(wordAttribute(node, "numId"), abstracts.get(wordAttribute(wordChild(node, "abstractNumId"), "val")) || new Map());
    }

    return formats;
}

function resolvedNumbering(catalog, paragraphProperties, styleId) {
    const direct = wordChild(paragraphProperties, "numPr");
    const directId = wordAttribute(wordChild(direct, "numId"), "val");

    if (directId !== null && directId !== undefined) {
        return directId === "0" ? null : { numId: directId, ilvl: wordAttribute(wordChild(direct, "ilvl"), "val") || "0" };
    }

    for (const entry of styleChain(catalog, styleId || catalog.defaultParagraph).slice().reverse()) {
        const numbering = wordChild(entry.paragraphProperties, "numPr");
        const numId = wordAttribute(wordChild(numbering, "numId"), "val");

        if (numId && numId !== "0") {
            return { numId, ilvl: wordAttribute(wordChild(numbering, "ilvl"), "val") || "0" };
        }
    }

    return null;
}

const OMML_NARY = { "\u2211": "\\sum", "\u220f": "\\prod", "\u222b": "\\int", "\u222c": "\\iint", "\u222d": "\\iiint", "\u222e": "\\oint", "\u22c3": "\\bigcup", "\u22c2": "\\bigcap" };
const OMML_ACCENT = { "\u0305": "\\overline", "\u00af": "\\overline", "\u20d7": "\\vec", "\u0302": "\\hat", "\u0307": "\\dot", "\u0308": "\\ddot", "\u0303": "\\tilde" };

function mathChildren(node) {
    return [...node.children];
}

function mathGroup(node) {
    const inner = mathChildren(node).map(ommlToLatex).join("");

    return inner.length === 1 ? inner : `{${inner}}`;
}

function mathBraced(node) {
    return `{${node ? mathChildren(node).map(ommlToLatex).join("") : ""}}`;
}

function ommlToLatex(node) {
    if (!node) return "";

    switch (node.localName) {
        case "oMathPara":
        case "oMath":
        case "e":
        case "num":
        case "den":
        case "lim":
            return mathChildren(node).map(ommlToLatex).join("");
        case "r": {
            let text = "";

            for (const child of node.children) if (child.localName === "t") text += child.textContent;

            return text;
        }
        case "f": {
            const numerator = wordChild(node, "num");
            const denominator = wordChild(node, "den");

            return `\\frac${mathBraced(numerator)}${mathBraced(denominator)}`;
        }
        case "sSup": {
            const base = wordChild(node, "e");
            const exponent = wordChild(node, "sup");

            return `${base ? mathGroup(base) : ""}^${exponent ? mathGroup(exponent) : "{}"}`;
        }
        case "sSub": {
            const base = wordChild(node, "e");
            const index = wordChild(node, "sub");

            return `${base ? mathGroup(base) : ""}_${index ? mathGroup(index) : "{}"}`;
        }
        case "sSubSup": {
            const base = wordChild(node, "e");
            const index = wordChild(node, "sub");
            const exponent = wordChild(node, "sup");

            return `${base ? mathGroup(base) : ""}_${index ? mathGroup(index) : "{}"}^${exponent ? mathGroup(exponent) : "{}"}`;
        }
        case "rad": {
            const properties = wordChild(node, "radPr");
            const hide = wordChild(properties, "degHide");
            const degree = wordChild(node, "deg");
            const radicand = wordChild(node, "e");
            const degreeText = degree ? mathChildren(degree).map(ommlToLatex).join("") : "";
            const hidden = (hide && onOffValue(hide)) || !degree || !degreeText;

            return hidden
                ? `\\sqrt${mathBraced(radicand)}`
                : `\\sqrt[${degreeText}]${mathBraced(radicand)}`;
        }
        case "nary": {
            const properties = wordChild(node, "naryPr");
            const character = wordAttributeMath(wordChild(properties, "chr"), "val") || "\u2211";
            const lower = wordChild(node, "sub");
            const upper = wordChild(node, "sup");
            const body = wordChild(node, "e");
            const operator = OMML_NARY[character] || `\\operatorname{${character}}`;
            const lowerText = lower ? mathChildren(lower).map(ommlToLatex).join("") : "";
            const upperText = upper ? mathChildren(upper).map(ommlToLatex).join("") : "";

            return `${operator}${lowerText ? `_{${lowerText}}` : ""}${upperText ? `^{${upperText}}` : ""}${body ? mathBraced(body) : ""}`;
        }
        case "d": {
            const properties = wordChild(node, "dPr");
            const open = wordAttributeMath(wordChild(properties, "begChr"), "val") ?? "(";
            const close = wordAttributeMath(wordChild(properties, "endChr"), "val") ?? ")";
            const inner = wordChildren(node, "e").map((part) => mathChildren(part).map(ommlToLatex).join("")).join(",");

            return `\\left${open === "{" ? "\\{" : open || "."}${inner}\\right${close === "}" ? "\\}" : close || "."}`;
        }
        case "func": {
            const name = wordChild(node, "fName");
            const body = wordChild(node, "e");
            const nameText = name ? mathChildren(name).map(ommlToLatex).join("") : "";

            return `\\operatorname{${nameText}}${mathBraced(body)}`;
        }
        case "acc": {
            const properties = wordChild(node, "accPr");
            const character = wordAttributeMath(wordChild(properties, "chr"), "val") || "\u0302";
            const body = wordChild(node, "e");

            return `${OMML_ACCENT[character] || "\\hat"}${mathBraced(body)}`;
        }
        case "bar": {
            const body = wordChild(node, "e");

            return `\\overline${mathBraced(body)}`;
        }
        case "m": {
            const rows = wordChildren(node, "mr")
                .map((row) => wordChildren(row, "e").map((cell) => mathChildren(cell).map(ommlToLatex).join("")).join(" & "))
                .join(" \\\\ ");

            return `\\begin{matrix}${rows}\\end{matrix}`;
        }
        case "eqArr":
            return wordChildren(node, "e").map((part) => mathChildren(part).map(ommlToLatex).join("")).join(" \\\\ ");
        default:
            return mathChildren(node).map(ommlToLatex).join("");
    }
}

function wordAttributeMath(node, name) {
    if (!node) return null;

    return node.getAttribute(`m:${name}`) ?? node.getAttributeNS("*", name);
}

function mathmlFromOmml(node) {
    if (!node) return "";

    const children = () => mathChildren(node).map(mathmlFromOmml).join("");
    const row = (element) => {
        const inner = element ? mathChildren(element).map(mathmlFromOmml).join("") : "";

        return `<mrow>${inner}</mrow>`;
    };

    switch (node.localName) {
        case "oMathPara":
        case "oMath":
        case "e":
        case "num":
        case "den":
        case "lim":
            return children();
        case "r": {
            let text = "";

            for (const child of node.children) if (child.localName === "t") text += child.textContent;

            if (!text) return "";

            return text.split(/([^\s\w.])/).filter(Boolean).map((piece) => {
                if (/^[0-9.]+$/.test(piece)) return `<mn>${escapeXml(piece)}</mn>`;
                if (/^[\s]+$/.test(piece)) return "<mspace width=\"0.25em\"/>";
                if (/^\w+$/.test(piece)) return `<mi>${escapeXml(piece)}</mi>`;

                return `<mo>${escapeXml(piece)}</mo>`;
            }).join("");
        }
        case "f":
            return `<mfrac>${row(wordChild(node, "num"))}${row(wordChild(node, "den"))}</mfrac>`;
        case "sSup":
            return `<msup>${row(wordChild(node, "e"))}${row(wordChild(node, "sup"))}</msup>`;
        case "sSub":
            return `<msub>${row(wordChild(node, "e"))}${row(wordChild(node, "sub"))}</msub>`;
        case "sSubSup":
            return `<msubsup>${row(wordChild(node, "e"))}${row(wordChild(node, "sub"))}${row(wordChild(node, "sup"))}</msubsup>`;
        case "rad": {
            const hide = wordChild(wordChild(node, "radPr"), "degHide");
            const degree = wordChild(node, "deg");
            const degreeText = degree ? mathChildren(degree).map(ommlToLatex).join("") : "";

            if ((hide && onOffValue(hide)) || !degree || !degreeText) return `<msqrt>${row(wordChild(node, "e"))}</msqrt>`;

            return `<mroot>${row(wordChild(node, "e"))}${row(degree)}</mroot>`;
        }
        case "nary": {
            const character = wordAttributeMath(wordChild(wordChild(node, "naryPr"), "chr"), "val") || "\u2211";
            const lower = wordChild(node, "sub");
            const upper = wordChild(node, "sup");
            const operator = `<mo>${escapeXml(character)}</mo>`;
            const limits = upper
                ? `<munderover>${operator}${row(lower)}${row(upper)}</munderover>`
                : lower ? `<munder>${operator}${row(lower)}</munder>` : operator;

            return `${limits}${row(wordChild(node, "e"))}`;
        }
        case "d": {
            const properties = wordChild(node, "dPr");
            const open = wordAttributeMath(wordChild(properties, "begChr"), "val") ?? "(";
            const close = wordAttributeMath(wordChild(properties, "endChr"), "val") ?? ")";
            const inner = wordChildren(node, "e").map((part) => row(part)).join('<mo>,</mo>');

            return `<mrow><mo>${escapeXml(open)}</mo>${inner}<mo>${escapeXml(close)}</mo></mrow>`;
        }
        case "func": {
            const name = wordChild(node, "fName");

            return `<mrow><mi>${escapeXml(name ? mathChildren(name).map(ommlToLatex).join("") : "")}</mi>${row(wordChild(node, "e"))}</mrow>`;
        }
        case "acc":
            return `<mover accent="true">${row(wordChild(node, "e"))}<mo>${escapeXml(wordAttributeMath(wordChild(wordChild(node, "accPr"), "chr"), "val") || "\u0302")}</mo></mover>`;
        case "bar":
            return `<mover accent="true">${row(wordChild(node, "e"))}<mo>&#175;</mo></mover>`;
        case "m": {
            const rows = wordChildren(node, "mr")
                .map((line) => `<mtr>${wordChildren(line, "e").map((cell) => `<mtd>${row(cell)}</mtd>`).join("")}</mtr>`)
                .join("");

            return `<mtable>${rows}</mtable>`;
        }
        case "eqArr":
            return `<mtable>${wordChildren(node, "e").map((part) => `<mtr><mtd>${row(part)}</mtd></mtr>`).join("")}</mtable>`;
        default:
            return children();
    }
}

function mathHtmlFromOmml(node) {
    const latex = ommlToLatex(node).trim();
    const block = node.localName === "oMathPara";
    const metadata = packMetadata(node);
    const mathml = mathmlFromOmml(node);
    const rendered = mathml
        ? `<math xmlns="http://www.w3.org/1998/Math/MathML" display="${block ? "block" : "inline"}">${mathml}</math>`
        : escapeXml(latex);

    return `<span class="dw-math" data-latex="${escapeXml(latex)}" data-w-omml="${metadata}">${rendered}</span>`;
}

function runHtmlFromWordRun(run, catalog, paragraphStyleId, context, inheritedBackground, hyperlink) {
    const properties = wordChild(run, "rPr");
    const vanish = wordChild(properties, "vanish");

    if (vanish && onOffValue(vanish)) return "";

    const pieces = [];

    for (const child of run.children) {
        if (child.localName === "t") pieces.push(escapeXml(child.textContent));
        else if (child.localName === "br") pieces.push(wordAttribute(child, "type") === "page" ? '<span class="dw-break-page" style="display:block"></span>' : "<br />");
        else if (child.localName === "tab") pieces.push('<span class="dw-tab" style="display:inline-block;min-width:36pt">&#9;</span>');
        else if (child.localName === "noBreakHyphen") pieces.push("&#8209;");
        else if (child.localName === "sym") pieces.push("&#9633;");
        else if (["drawing", "pict", "object"].includes(child.localName)) pieces.push(drawingHtml(child, context));
    }

    const text = pieces.join("");

    if (!text) return "";

    const styleId = wordAttribute(wordChild(properties, "rStyle"), "val") || catalog.defaultCharacter;
    const resolved = resolveRunStyle(catalog, paragraphStyleId, properties, inheritedBackground, hyperlink);
    const declarations = resolved.css;
    const vertical = resolved.vertAlign;
    const classes = ["dw-run"];

    if (styleId) classes.push(styleSlug(styleId));

    const style = declarationsToText(declarations);
    const metadata = packMetadata(properties);
    const attributes = [`class="${classes.join(" ")}"`];

    if (style) attributes.push(`style="${style}"`);
    if (metadata) attributes.push(`data-w-rpr="${metadata}"`);

    let html = `<span ${attributes.join(" ")}>${text}</span>`;

    if (vertical === "superscript") html = `<sup>${html}</sup>`;
    if (vertical === "subscript") html = `<sub>${html}</sub>`;

    return html;
}

function paragraphHtmlFromWordParagraph(paragraph, catalog, numbering, context, inheritedBackground) {
    const properties = wordChild(paragraph, "pPr");
    const styleId = wordAttribute(wordChild(properties, "pStyle"), "val") || catalog.defaultParagraph;
    const paragraphCss = resolveParagraphStyle(catalog, styleId, properties);
    const shade = paragraphCss["background-color"] || inheritedBackground;
    const runs = [];

    for (const child of paragraph.children) {
        if (child.localName === "r") runs.push(runHtmlFromWordRun(child, catalog, styleId, context, shade));
        else if (child.localName === "oMath" || child.localName === "oMathPara") runs.push(mathHtmlFromOmml(child));
        else if (child.localName === "hyperlink") {
            const id = child.getAttribute("r:id") || child.getAttributeNS("*", "id");
            const anchor = wordAttribute(child, "anchor");
            const relationship = id ? context.relationships.get(id) : null;
            const href = relationship ? relationship.target : anchor ? `#${anchor}` : null;
            const inner = [];

            for (const part of child.getElementsByTagName("*")) {
                if (part.localName === "r") inner.push(runHtmlFromWordRun(part, catalog, styleId, context, shade, Boolean(href)));
            }

            runs.push(href
                ? `<a class="dw-link" href="${escapeXml(href)}" target="_blank" rel="noreferrer">${inner.join("")}</a>`
                : inner.join(""));
        }
        else if (["smartTag", "ins", "sdt"].includes(child.localName)) {
            for (const inner of child.getElementsByTagName("*")) {
                if (inner.localName === "r") runs.push(runHtmlFromWordRun(inner, catalog, styleId, context, shade));
            }
        }
    }

    const contextual = wordChild(properties, "contextualSpacing");
    const inner = runs.join("") || '<span class="dw-run">&#8203;</span>';
    const declarations = paragraphCss;
    const classes = ["dw-p"];

    if (!declarations["margin-top"]) declarations["margin-top"] = "0pt";
    if (!declarations["margin-bottom"]) declarations["margin-bottom"] = "0pt";
    if (!declarations["line-height"]) declarations["line-height"] = "normal";

    if (contextual && onOffValue(contextual)) classes.push("dw-contextual");
    if (styleId) classes.push(styleSlug(styleId));

    const metadata = packMetadata(properties);
    const breakBefore = wordChild(properties, "pageBreakBefore");
    const listing = resolvedNumbering(catalog, properties, styleId);
    const heading = headingLevelFor(catalog, styleId);
    const tag = listing ? "li" : heading ? `h${heading}` : "p";
    const level = listing ? numbering.get(listing.numId)?.get(listing.ilvl) : null;
    const format = level?.format || (listing ? "decimal" : null);

    if (level) {
        const left = Number.isFinite(level.indent) && level.indent !== null ? level.indent : 0;
        const hanging = Number.isFinite(level.hanging) && level.hanging ? level.hanging : 0;

        declarations["margin-left"] = `${(left - hanging) / TWIPS_PER_POINT}pt`;
        declarations["padding-left"] = `${hanging / TWIPS_PER_POINT}pt`;
        declarations["text-indent"] = "0";
        declarations["list-style-position"] = "outside";
        declarations["list-style-type"] = LIST_STYLE_TYPES[format] || "decimal";
    }

    const attributes = [`class="${classes.join(" ")}"`];
    const inlineStyle = declarationsToText(declarations);

    if (inlineStyle) attributes.push(`style="${inlineStyle}"`);
    if (metadata) attributes.push(`data-w-ppr="${metadata}"`);
    if (breakBefore && onOffValue(breakBefore)) attributes.push('data-dw-break-before="1"');

    if (listing) {
        attributes.push(`data-num-id="${escapeXml(listing.numId)}"`, `data-ilvl="${escapeXml(listing.ilvl)}"`);
    }

    return {
        list: listing ? (format === "bullet" || format === "none" ? "ul" : "ol") : null,
        level: listing ? Number(listing.ilvl) || 0 : 0,
        numId: listing ? listing.numId : null,
        start: level?.start && level.start !== "1" ? level.start : null,
        html: `<${tag} ${attributes.join(" ")}>${inner}</${tag}>`
    };
}

function tableHtmlFromWordTable(table, catalog, numbering, context) {
    const cellMargins = wordChild(wordChild(table, "tblPr"), "tblCellMar");
    const marginFor = (name, fallback) => {
        const node = wordChild(cellMargins, name);
        const value = node ? Number(wordAttribute(node, "w")) : null;

        return Number.isFinite(value) && value !== null ? value / TWIPS_PER_POINT : fallback;
    };
    const padding = [
        marginFor("top", 0),
        marginFor("right", 5.4),
        marginFor("bottom", 0),
        marginFor("left", 5.4)
    ].map((value) => `${value}pt`).join(" ");
    const borders = wordChild(wordChild(table, "tblPr"), "tblBorders");
    const borderValue = (node) => {
        if (!node) return null;

        const kind = wordAttribute(node, "val");

        if (!kind || kind === "none" || kind === "nil") return "none";

        const size = Number(wordAttribute(node, "sz"));
        const width = Number.isFinite(size) && size > 0 ? Math.max(0.5, size / 8) : 0.5;
        const line = ["dashed", "dashSmallGap", "dashDotStroked"].includes(kind) ? "dashed" : kind === "dotted" ? "dotted" : ["double", "doubleWave", "triple"].includes(kind) ? "double" : "solid";
        const color = wordAttribute(node, "color");

        return `${width}pt ${line} #${color && color !== "auto" ? color : "000000"}`;
    };
    const tableEdges = {
        top: borderValue(wordChild(borders, "top")),
        left: borderValue(wordChild(borders, "left")),
        bottom: borderValue(wordChild(borders, "bottom")),
        right: borderValue(wordChild(borders, "right")),
        insideH: borderValue(wordChild(borders, "insideH")),
        insideV: borderValue(wordChild(borders, "insideV"))
    };
    const grid = wordChildren(table, "tr").map((row) => {
        let column = 0;

        return wordChildren(row, "tc").map((cell) => {
            const cellProperties = wordChild(cell, "tcPr");
            const span = Number(wordAttribute(wordChild(cellProperties, "gridSpan"), "val")) || 1;
            const merge = wordChild(cellProperties, "vMerge");
            const entry = { cell, cellProperties, span, column, merged: Boolean(merge), restart: !merge || wordAttribute(merge, "val") === "restart" };

            column += span;

            return entry;
        });
    });
    const rows = [];

    grid.forEach((cells, rowIndex) => {
        const built = [];

        for (const entry of cells) {
            if (entry.merged && !entry.restart) continue;

            let rowSpan = 1;

            if (entry.merged && entry.restart) {
                for (let next = rowIndex + rowSpan; next < grid.length; next++) {
                    const continued = grid[next].find((candidate) => candidate.column === entry.column && candidate.merged && !candidate.restart);

                    if (!continued) break;

                    rowSpan++;
                }
            }

            const { cell, cellProperties, span } = entry;
            const shading = wordAttribute(wordChild(cellProperties, "shd"), "fill");
            const width = Number(wordAttribute(wordChild(cellProperties, "tcW"), "w"));
            const declarations = {};

            declarations.padding = padding;

            const cellBorders = wordChild(cellProperties, "tcBorders");
            const lastRow = rowIndex + rowSpan >= grid.length;
            const lastColumn = entry === cells[cells.length - 1];
            const side = (name, fallback) => borderValue(wordChild(cellBorders, name)) ?? fallback ?? "none";

            declarations["border-top"] = side("top", rowIndex === 0 ? tableEdges.top : tableEdges.insideH);
            declarations["border-left"] = side("left", entry.column === 0 ? tableEdges.left : tableEdges.insideV);
            declarations["border-bottom"] = side("bottom", lastRow ? tableEdges.bottom : tableEdges.insideH);
            declarations["border-right"] = side("right", lastColumn ? tableEdges.right : tableEdges.insideV);

            if (shading && shading !== "auto") declarations["background-color"] = `#${shading}`;
            if (Number.isFinite(width) && width > 0) declarations.width = `${width / TWIPS_PER_POINT}pt`;

            const blocks = [];

            for (const child of cell.children) {
                if (child.localName === "p") blocks.push(paragraphHtmlFromWordParagraph(child, catalog, numbering, context, declarations["background-color"]).html);
                else if (child.localName === "tbl") blocks.push(tableHtmlFromWordTable(child, catalog, numbering, context));
            }

            const style = declarationsToText(declarations);
            const attributes = ['class="dw-td"'];

            if (span > 1) attributes.push(`colspan="${span}"`);
            if (rowSpan > 1) attributes.push(`rowspan="${rowSpan}"`);
            if (style) attributes.push(`style="${style}"`);

            built.push(`<td ${attributes.join(" ")}>${blocks.join("") || "<p class=\"dw-p\"><br /></p>"}</td>`);
        }

        rows.push(`<tr class="dw-tr">${built.join("")}</tr>`);
    });

    return `<table class="dw-table" style="border-collapse:collapse">[TBODY]</table>`.replace("[TBODY]", `<tbody>${rows.join("")}</tbody>`);
}

function htmlFromWordXml(xml, numberingXml, stylesXml, themeXml, relsXml, media) {
    const document = new DOMParser().parseFromString(xml, "application/xml");
    const catalog = parseWordStyles(stylesXml, themeXml);
    const numbering = numberingLevels(numberingXml);
    const context = { relationships: parseRelationships(relsXml), media: media || new Map() };
    const body = wordChild(document.documentElement, "body");

    if (!body) return "";

    const out = [];
    const openLists = [];
    const listCounters = new Map();

    const closeList = () => {
        while (openLists.length) out.push(`</${openLists.pop().tag}>`);
    };

    for (const child of body.children) {
        if (child.localName === "p") {
            if (wordChild(wordChild(child, "pPr"), "sectPr") && !wordChildren(child, "r").length) continue;

            const block = paragraphHtmlFromWordParagraph(child, catalog, numbering, context);

            if (block.list) {
                while (openLists.length && openLists[openLists.length - 1].level > block.level) {
                    out.push(`</${openLists.pop().tag}>`);
                }

                const current = openLists[openLists.length - 1];
                const counterKey = `${block.numId}:${block.level}`;
                const resumeAt = listCounters.get(counterKey);
                const startValue = resumeAt || (block.start ? Number(block.start) : null);
                const openTag = `<${block.list} class="dw-list" style="margin:0;padding-left:0;list-style-position:outside"${startValue && startValue > 1 ? ` start="${startValue}"` : ""}>`;

                if (!current || current.level < block.level) {
                    out.push(openTag);
                    openLists.push({ tag: block.list, level: block.level, key: counterKey });
                } else if (current.tag !== block.list) {
                    out.push(`</${openLists.pop().tag}>`);
                    out.push(openTag);
                    openLists.push({ tag: block.list, level: block.level, key: counterKey });
                }

                listCounters.set(counterKey, (resumeAt || (block.start ? Number(block.start) : 1)) + 1);
                out.push(block.html);
                continue;
            }

            closeList();
            out.push(block.html);
            continue;
        }

        if (child.localName === "tbl") {
            closeList();
            out.push(tableHtmlFromWordTable(child, catalog, numbering, context));
        }
    }

    closeList();

    return out.join("");
}

function runPropertiesFromElement(element) {
    const stored = unpackMetadata(element.getAttribute?.("data-w-rpr"));

    if (stored) return stored;

    const properties = [];
    const style = element.style;
    const computedBold = style?.fontWeight === "bold" || Number(style?.fontWeight) >= 600;
    const computedItalic = style?.fontStyle === "italic";
    const decoration = `${style?.textDecorationLine || ""} ${style?.textDecoration || ""}`;
    const inTag = (name) => Boolean(element.closest?.(name));

    if (computedBold || inTag("strong,b")) properties.push('<w:b w:val="1"/>');
    if (computedItalic || inTag("em,i")) properties.push('<w:i w:val="1"/>');
    if (decoration.includes("underline") || inTag("u,ins")) properties.push('<w:u w:val="single"/>');
    if (decoration.includes("line-through") || inTag("s,strike,del")) properties.push('<w:strike w:val="1"/>');
    if (inTag("sup")) properties.push('<w:vertAlign w:val="superscript"/>');
    if (inTag("sub")) properties.push('<w:vertAlign w:val="subscript"/>');

    if (style?.color) {
        const parts = style.color.match(/\d+/g);

        if (parts && parts.length >= 3) {
            const hex = parts.slice(0, 3).map((part) => Number(part).toString(16).padStart(2, "0")).join("").toUpperCase();

            properties.push(`<w:color w:val="${hex}"/>`);
        }
    }

    if (style?.fontSize) {
        const points = parseFloat(style.fontSize);

        if (Number.isFinite(points)) {
            const halves = Math.round(points * HALF_POINTS_PER_POINT);

            properties.push(`<w:sz w:val="${halves}"/><w:szCs w:val="${halves}"/>`);
        }
    }

    if (style?.fontFamily) {
        const family = escapeXml(style.fontFamily.split(",")[0].replace(/["']/g, "").trim());

        properties.push(`<w:rFonts w:ascii="${family}" w:hAnsi="${family}"/>`);
    }

    return properties.length ? `<w:rPr>${properties.join("")}</w:rPr>` : "";
}

function hasOwnFormatting(element) {
    if (!element || element.nodeType !== 1) return false;

    if (["strong", "b", "em", "i", "u", "ins", "s", "strike", "del", "sup", "sub", "font"].includes(element.localName)) return true;

    const style = element.style;

    return Boolean(style && (style.fontWeight || style.fontStyle || style.textDecorationLine || style.textDecoration
        || style.color || style.backgroundColor || style.fontSize || style.fontFamily));
}

function wordRunsFromNode(node, carrier, overridden) {
    if (node.nodeType === 3) {
        const text = node.nodeValue.replace(/\u200b/g, "");

        if (!text) return "";

        const properties = runPropertiesFromChain(node);
        const segments = text.split("\t")
            .map((piece) => `<w:t xml:space="preserve">${escapeXml(piece)}</w:t>`)
            .join("<w:tab/>");

        return `<w:r>${properties}${segments}</w:r>`;
    }

    if (node.nodeType !== 1) return "";
    if (node.localName === "br") return "<w:r><w:br/></w:r>";
    if (node.classList?.contains("dw-break-page")) return '<w:r><w:br w:type="page"/></w:r>';

    if (node.classList?.contains("dw-math")) {
        const stored = unpackMetadata(node.getAttribute("data-w-omml"));

        if (stored) return stored;

        const latex = node.getAttribute("data-latex") || node.textContent || "";

        return `<w:r><w:t xml:space="preserve">${escapeXml(latex)}</w:t></w:r>`;
    }

    const nextCarrier = node.hasAttribute?.("data-w-rpr") ? node : carrier;
    const nextOverridden = overridden || (carrier ? hasOwnFormatting(node) : false);

    let out = "";

    for (const child of node.childNodes) out += wordRunsFromNode(child, nextCarrier, nextOverridden);

    return out;
}

function runPropertiesFromChain(textNode) {
    const merged = {};
    const element = textNode.parentElement;

    if (!element) return "";

    const style = window.getComputedStyle(element);
    const inTag = (names) => Boolean(element.closest(names));

    merged.bold = style.fontWeight === "bold" || Number(style.fontWeight) >= 600;
    merged.italic = style.fontStyle === "italic";

    const decoration = `${style.textDecorationLine || ""} ${style.textDecoration || ""}`;

    merged.underline = decoration.includes("underline");
    merged.strike = decoration.includes("line-through");

    if (inTag("sup")) merged.vertAlign = "superscript";
    if (inTag("sub")) merged.vertAlign = "subscript";
    if (style.verticalAlign === "super") merged.vertAlign = "superscript";
    if (style.verticalAlign === "sub") merged.vertAlign = "subscript";

    merged.color = cssColorToHex(style.color);

    const background = style.backgroundColor;

    if (background && background !== "rgba(0, 0, 0, 0)" && background !== "transparent") {
        merged.shading = cssColorToHex(background);
    }

    const points = parseFloat(style.fontSize);

    if (Number.isFinite(points)) merged.size = Math.round((points * 72 / 96) * HALF_POINTS_PER_POINT);

    if (style.fontFamily) merged.font = style.fontFamily.split(",")[0].replace(/["']/g, "").trim();

    const properties = [];

    if (merged.bold !== undefined) properties.push(`<w:b w:val="${merged.bold ? 1 : 0}"/>`);
    if (merged.italic !== undefined) properties.push(`<w:i w:val="${merged.italic ? 1 : 0}"/>`);
    if (merged.underline !== undefined) properties.push(`<w:u w:val="${merged.underline ? "single" : "none"}"/>`);
    if (merged.strike !== undefined) properties.push(`<w:strike w:val="${merged.strike ? 1 : 0}"/>`);
    if (merged.vertAlign) properties.push(`<w:vertAlign w:val="${merged.vertAlign}"/>`);
    if (merged.font) properties.push(`<w:rFonts w:ascii="${escapeXml(merged.font)}" w:hAnsi="${escapeXml(merged.font)}"/>`);
    if (merged.color) properties.push(`<w:color w:val="${merged.color}"/>`);
    if (merged.size) properties.push(`<w:sz w:val="${merged.size}"/><w:szCs w:val="${merged.size}"/>`);
    if (merged.shading) properties.push(`<w:shd w:val="clear" w:color="auto" w:fill="${merged.shading}"/>`);

    return properties.length ? `<w:rPr>${properties.join("")}</w:rPr>` : "";
}

function cssColorToHex(value) {
    const parts = String(value).match(/\d+/g);

    if (!parts || parts.length < 3) return null;

    return parts.slice(0, 3).map((part) => Number(part).toString(16).padStart(2, "0")).join("").toUpperCase();
}

function wordParagraphFromBlock(block) {
    const tag = block.localName;
    const heading = tag && /^h[1-6]$/.test(tag) ? tag.slice(1) : null;
    const stored = unpackMetadata(block.getAttribute("data-w-ppr"));
    const properties = [];

    if (!stored && typeof window !== "undefined") {
        const computed = window.getComputedStyle(block);
        const before = Math.round(parseFloat(computed.marginTop) * 72 / 96 * TWIPS_PER_POINT);
        const after = Math.round(parseFloat(computed.marginBottom) * 72 / 96 * TWIPS_PER_POINT);
        const left = Math.round(parseFloat(computed.marginLeft) * 72 / 96 * TWIPS_PER_POINT);

        if (Number.isFinite(before) || Number.isFinite(after)) {
            properties.push(`<w:spacing w:before="${Number.isFinite(before) ? before : 0}" w:after="${Number.isFinite(after) ? after : 0}"/>`);
        }

        if (Number.isFinite(left) && left > 0) properties.push(`<w:ind w:left="${left}"/>`);

        if (computed.textAlign === "center") properties.push('<w:jc w:val="center"/>');
        if (computed.textAlign === "right") properties.push('<w:jc w:val="right"/>');
        if (computed.textAlign === "justify") properties.push('<w:jc w:val="both"/>');
    }

    if (!stored) {
        if (heading) properties.push(`<w:pStyle w:val="Heading${heading}"/>`);

        if (tag === "li") {
            const numberId = block.getAttribute("data-num-id") || "1";
            const level = block.getAttribute("data-ilvl") || "0";

            properties.push(`<w:numPr><w:ilvl w:val="${escapeXml(level)}"/><w:numId w:val="${escapeXml(numberId)}"/></w:numPr>`);
        }

    }

    const wrapper = stored || (properties.length ? `<w:pPr>${properties.join("")}</w:pPr>` : "");

    let runs = "";

    for (const child of block.childNodes) runs += wordRunsFromNode(child, null, false);

    return `<w:p>${wrapper}${runs}</w:p>`;
}

function wordTableFromElement(table) {
    const rows = [];

    for (const row of table.querySelectorAll("tr")) {
        const cells = [];

        for (const cell of row.querySelectorAll("td,th")) {
            const span = Number(cell.getAttribute("colspan"));
            const blocks = [...cell.children].filter((child) => /^(p|h[1-6]|li)$/.test(child.localName));
            const content = blocks.length
                ? blocks.map(wordParagraphFromBlock).join("")
                : `<w:p><w:r><w:t xml:space="preserve">${escapeXml(cell.textContent || "")}</w:t></w:r></w:p>`;
            const properties = span > 1 ? `<w:tcPr><w:gridSpan w:val="${span}"/></w:tcPr>` : "";

            cells.push(`<w:tc>${properties}${content}</w:tc>`);
        }

        rows.push(`<w:tr>${cells.join("")}</w:tr>`);
    }

    return `<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="auto"/><w:left w:val="single" w:sz="4" w:color="auto"/><w:bottom w:val="single" w:sz="4" w:color="auto"/><w:right w:val="single" w:sz="4" w:color="auto"/><w:insideH w:val="single" w:sz="4" w:color="auto"/><w:insideV w:val="single" w:sz="4" w:color="auto"/></w:tblBorders></w:tblPr>${rows.join("")}</w:tbl>`;
}

function wordXmlFromHtml(html, sectionProperties) {
    const parsed = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
    const pieces = [];

    const walk = (parent) => {
        for (const child of parent.children) {
            if (child.localName === "ul" || child.localName === "ol") {
                walk(child);
                continue;
            }

            if (child.localName === "table") {
                pieces.push(wordTableFromElement(child));
                continue;
            }

            if (child.localName === "div") {
                walk(child);
                continue;
            }

            pieces.push(wordParagraphFromBlock(child));
        }
    };

    walk(parsed.body);

    const body = pieces.length
        ? pieces.join("")
        : `<w:p><w:r><w:t xml:space="preserve">${escapeXml(parsed.body.textContent || "")}</w:t></w:r></w:p>`;
    const section = sectionProperties || '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>';

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}${section}</w:body></w:document>`;
}

function pageGeometryFrom(sectionXml) {
    if (!sectionXml) return null;

    const document = new DOMParser().parseFromString(`<root xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${sectionXml}</root>`, "application/xml");
    const section = document.documentElement.firstElementChild;
    const size = wordChild(section, "pgSz");
    const margin = wordChild(section, "pgMar");

    if (!size) return null;

    const width = Number(wordAttribute(size, "w"));

    if (!Number.isFinite(width) || width <= 0) return null;

    const pick = (name, fallback) => {
        const value = Number(wordAttribute(margin, name));

        return Number.isFinite(value) && value >= 0 ? value : fallback;
    };

    return {
        width: width / TWIPS_PER_POINT,
        height: Number(wordAttribute(size, "h")) / TWIPS_PER_POINT || null,
        top: pick("top", 1440) / TWIPS_PER_POINT,
        right: pick("right", 1440) / TWIPS_PER_POINT,
        bottom: pick("bottom", 1440) / TWIPS_PER_POINT,
        left: pick("left", 1440) / TWIPS_PER_POINT
    };
}

function sectionPropertiesFrom(xml) {
    const match = /<w:sectPr[\s\S]*?<\/w:sectPr>/.exec(xml);

    return match ? match[0] : null;
}

const crcTable = (() => {
    const table = new Uint32Array(256);

    for (let i = 0; i < 256; i++) {
        let value = i;

        for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;

        table[i] = value >>> 0;
    }

    return table;
})();

function crc32(bytes) {
    let crc = 0xffffffff;

    for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);

    return (crc ^ 0xffffffff) >>> 0;
}

async function inflateRaw(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));

    return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unzipEntries(buffer) {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    let directoryStart = -1;

    for (let i = view.byteLength - 22; i >= 0; i--) {
        if (view.getUint32(i, true) === 0x06054b50) {
            directoryStart = view.getUint32(i + 16, true);
            break;
        }
    }

    if (directoryStart < 0) throw new Error("This file is not a readable document container.");

    const entries = [];

    let offset = directoryStart;

    while (offset < view.byteLength && view.getUint32(offset, true) === 0x02014b50) {
        const method = view.getUint16(offset + 10, true);
        const compressedSize = view.getUint32(offset + 20, true);
        const nameLength = view.getUint16(offset + 28, true);
        const extraLength = view.getUint16(offset + 30, true);
        const commentLength = view.getUint16(offset + 32, true);
        const localOffset = view.getUint32(offset + 42, true);
        const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
        const localNameLength = view.getUint16(localOffset + 26, true);
        const localExtraLength = view.getUint16(localOffset + 28, true);
        const dataStart = localOffset + 30 + localNameLength + localExtraLength;
        const raw = bytes.subarray(dataStart, dataStart + compressedSize);

        entries.push({ name, method, data: raw });
        offset += 46 + nameLength + extraLength + commentLength;
    }

    const result = new Map();

    for (const entry of entries) {
        result.set(entry.name, entry.method === 8 ? await inflateRaw(entry.data) : new Uint8Array(entry.data));
    }

    return result;
}

function zipEntries(entries) {
    const encoder = new TextEncoder();
    const locals = [];
    const centrals = [];

    let offset = 0;

    for (const [name, data] of entries) {
        const nameBytes = encoder.encode(name);
        const checksum = crc32(data);
        const local = new Uint8Array(30 + nameBytes.length + data.length);
        const localView = new DataView(local.buffer);

        localView.setUint32(0, 0x04034b50, true);
        localView.setUint16(4, 20, true);
        localView.setUint32(14, checksum, true);
        localView.setUint32(18, data.length, true);
        localView.setUint32(22, data.length, true);
        localView.setUint16(26, nameBytes.length, true);
        local.set(nameBytes, 30);
        local.set(data, 30 + nameBytes.length);

        const central = new Uint8Array(46 + nameBytes.length);
        const centralView = new DataView(central.buffer);

        centralView.setUint32(0, 0x02014b50, true);
        centralView.setUint16(4, 20, true);
        centralView.setUint16(6, 20, true);
        centralView.setUint32(16, checksum, true);
        centralView.setUint32(20, data.length, true);
        centralView.setUint32(24, data.length, true);
        centralView.setUint16(28, nameBytes.length, true);
        centralView.setUint32(42, offset, true);
        central.set(nameBytes, 46);

        locals.push(local);
        centrals.push(central);
        offset += local.length;
    }

    const centralSize = centrals.reduce((total, part) => total + part.length, 0);
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);

    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(8, centrals.length, true);
    endView.setUint16(10, centrals.length, true);
    endView.setUint32(12, centralSize, true);
    endView.setUint32(16, offset, true);

    return new Blob([...locals, ...centrals, end], { type: "application/octet-stream" });
}

function escapeXml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function decodeXmlEntities(value) {
    return value
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, "\"")
        .replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (match, code) => String.fromCodePoint(Number(code)))
        .replace(/&amp;/g, "&");
}

function textFromWordXml(xml) {
    const paragraphs = xml.match(/<w:p[ >][\s\S]*?<\/w:p>|<w:p\/>/g) || [];

    return paragraphs.map((paragraph) => {
        const pieces = paragraph
            .replace(/<w:br\s*\/>/g, "\n")
            .replace(/<w:tab\s*\/>/g, "\t")
            .match(/<w:t[^>]*>[\s\S]*?<\/w:t>|\n|\t/g) || [];

        return pieces.map((piece) => piece === "\n" || piece === "\t"
            ? piece
            : decodeXmlEntities(piece.replace(/<[^>]+>/g, ""))).join("");
    }).join("\n");
}

function wordXmlFromText(text) {
    const body = text.split("\n").map((line) => {
        if (!line) return "<w:p/>";

        return `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`;
    }).join("");

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
}

function textFromOpenDocumentXml(xml) {
    const paragraphs = xml.match(/<text:(p|h)[ >][\s\S]*?<\/text:(p|h)>|<text:p\/>/g) || [];

    return paragraphs.map((paragraph) => decodeXmlEntities(paragraph
        .replace(/<text:line-break\s*\/>/g, "\n")
        .replace(/<text:tab\s*\/>/g, "\t")
        .replace(/<text:s\s*\/>/g, " ")
        .replace(/<[^>]+>/g, ""))).join("\n");
}

function openDocumentXmlFromText(text) {
    const body = text.split("\n").map((line) => `<text:p text:style-name="Standard">${escapeXml(line)}</text:p>`).join("");

    return `<?xml version="1.0" encoding="UTF-8"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.2"><office:body><office:text>${body}</office:text></office:body></office:document-content>`;
}

function minimalOdtEntries(text) {
    const encoder = new TextEncoder();
    const entries = new Map();

    entries.set("mimetype", encoder.encode("application/vnd.oasis.opendocument.text"));
    entries.set("META-INF/manifest.xml", encoder.encode(`<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>`));
    entries.set("content.xml", encoder.encode(openDocumentXmlFromText(text)));

    return entries;
}

const RTF_SKIP_DESTINATIONS = [
    "fonttbl", "colortbl", "stylesheet", "info", "listtable", "listoverridetable",
    "rsidtbl", "generator", "pict", "themedata", "colorschememapping", "latentstyles",
    "datastore", "xmlnstbl", "filetbl", "revtbl", "protusertbl", "fchars", "lchars"
];

function textFromRtf(source) {
    let out = "";
    let depth = 0;
    let skipDepth = -1;
    let index = 0;

    while (index < source.length) {
        const char = source[index];

        if (char === "{") {
            depth++;
            index++;
            continue;
        }

        if (char === "}") {
            depth--;

            if (skipDepth >= 0 && depth < skipDepth) skipDepth = -1;

            index++;
            continue;
        }

        if (char === "\\") {
            const next = source[index + 1];

            if (next === "*") {
                if (skipDepth < 0) skipDepth = depth;

                index += 2;
                continue;
            }

            if (next === "\\" || next === "{" || next === "}") {
                if (skipDepth < 0) out += next;

                index += 2;
                continue;
            }

            if (next === "'") {
                if (skipDepth < 0) out += String.fromCharCode(parseInt(source.slice(index + 2, index + 4), 16));

                index += 4;
                continue;
            }

            const match = /^([a-zA-Z]+)(-?\d+)? ?/.exec(source.slice(index + 1));

            if (!match) {
                index += 2;
                continue;
            }

            const word = match[1];
            const param = match[2] === undefined ? null : Number(match[2]);

            index += 1 + match[0].length;

            if (RTF_SKIP_DESTINATIONS.includes(word)) {
                if (skipDepth < 0) skipDepth = depth;
                continue;
            }

            if (skipDepth >= 0) continue;

            if (word === "par" || word === "line") out += "\n";
            else if (word === "tab") out += "\t";
            else if (word === "u" && param !== null) {
                out += String.fromCharCode(param < 0 ? param + 65536 : param);

                if (source[index] === "?") index += 1;
            }

            continue;
        }

        if (char === "\n" || char === "\r") {
            index++;
            continue;
        }

        if (skipDepth < 0) out += char;

        index++;
    }

    return out.replace(/^\n+/, "");
}

function rtfFromText(text) {
    const body = text.split("\n").map((line) => line
        .replace(/[\\{}]/g, (match) => `\\${match}`)
        .replace(/[\u0080-\uffff]/g, (match) => `\\u${match.charCodeAt(0)}?`)
        .replace(/\t/g, "\\tab ")).join("\\par\n");

    return `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Helvetica;}}\\fs24\n${body}\n}`;
}

function textFromHtml(source) {
    const parsed = new DOMParser().parseFromString(source, "text/html");

    parsed.querySelectorAll("script, style").forEach((node) => node.remove());
    parsed.querySelectorAll("br").forEach((node) => node.replaceWith("\n"));
    parsed.querySelectorAll("p, div, li, h1, h2, h3, h4, h5, h6, tr").forEach((node) => node.append("\n"));

    return (parsed.body?.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
}

function htmlFromText(text, title) {
    const body = text.split("\n").map((line) => line.trim() ? `<p>${escapeXml(line)}</p>` : "<p><br /></p>").join("\n");

    return `<!doctype html>\n<html>\n<head>\n<meta charset="utf-8" />\n<title>${escapeXml(title || "Untitled")}</title>\n</head>\n<body>\n${body}\n</body>\n</html>\n`;
}

function minimalDocxEntries(text) {
    const encoder = new TextEncoder();
    const entries = new Map();

    entries.set("[Content_Types].xml", encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`));
    entries.set("_rels/.rels", encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`));
    entries.set("word/_rels/document.xml.rels", encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`));
    entries.set("word/document.xml", encoder.encode(wordXmlFromText(text)));

    return entries;
}

const DRAW_STROKE_RATIO = 0.018;
const GLYPH_GRID = 16;
const GLYPH_RENDER_SIZE = 72;
const DRAW_MATCH_LIMIT = 12;

function featuresFromContext(context, width, height) {
    const { data } = context.getImageData(0, 0, width, height);

    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (data[(y * width + x) * 4 + 3] > 40) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }

    if (maxX < 0) return null;

    const boxWidth = maxX - minX + 1;
    const boxHeight = maxY - minY + 1;
    const cells = new Float32Array(GLYPH_GRID * GLYPH_GRID);

    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            const alpha = data[(y * width + x) * 4 + 3];

            if (alpha <= 40) continue;

            const cellX = Math.min(GLYPH_GRID - 1, Math.floor(((x - minX) / boxWidth) * GLYPH_GRID));
            const cellY = Math.min(GLYPH_GRID - 1, Math.floor(((y - minY) / boxHeight) * GLYPH_GRID));

            cells[cellY * GLYPH_GRID + cellX] += alpha / 255;
        }
    }

    let norm = 0;

    for (let i = 0; i < cells.length; i++) norm += cells[i] * cells[i];

    norm = Math.sqrt(norm);

    if (norm === 0) return null;

    for (let i = 0; i < cells.length; i++) cells[i] /= norm;

    return { cells, aspect: boxWidth / boxHeight };
}

function featureScore(a, b) {
    let dot = 0;

    for (let i = 0; i < a.cells.length; i++) dot += a.cells[i] * b.cells[i];

    const penalty = Math.min(1, Math.abs(Math.log((a.aspect || 1) / (b.aspect || 1))) / 2);

    return dot * (1 - penalty * 0.35);
}

const greekNames = [
    "Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta", "Iota", "Kappa",
    "Lambda", "Mu", "Nu", "Xi", "Omicron", "Pi", "Rho", "Sigma", "Tau", "Upsilon",
    "Phi", "Chi", "Psi", "Omega"
];

const combiningNames = {
    "\u0300": "grave",
    "\u0301": "acute",
    "\u0302": "circumflex",
    "\u0303": "tilde",
    "\u0308": "diaeresis umlaut",
    "\u030a": "ring",
    "\u0327": "cedilla",
    "\u0304": "macron",
    "\u0306": "breve",
    "\u0307": "dot"
};

const symbolNames = {
    "∀": "for all universal",
    "∁": "complement",
    "∂": "partial differential derivative",
    "∃": "there exists existential",
    "∄": "there does not exist",
    "∅": "empty set null",
    "∆": "delta increment laplacian",
    "∇": "nabla del gradient",
    "∈": "element of member in",
    "∉": "not an element of",
    "∋": "contains as member",
    "∏": "product",
    "∐": "coproduct",
    "∑": "sum summation sigma",
    "−": "minus subtract",
    "±": "plus minus",
    "÷": "divide division obelus",
    "×": "times multiply cross",
    "⋅": "dot operator multiply",
    "√": "square root radical",
    "∛": "cube root",
    "∜": "fourth root",
    "∝": "proportional to",
    "∞": "infinity",
    "∠": "angle",
    "∧": "logical and wedge",
    "∨": "logical or vee",
    "¬": "not negation",
    "∩": "intersection cap",
    "∪": "union cup",
    "∫": "integral",
    "∬": "double integral",
    "∭": "triple integral",
    "∮": "contour integral",
    "∴": "therefore",
    "∵": "because since",
    "∼": "tilde operator similar",
    "≅": "congruent to",
    "≈": "almost equal approximately",
    "≠": "not equal",
    "≡": "identical equivalent",
    "≤": "less than or equal",
    "≥": "greater than or equal",
    "≪": "much less than",
    "≫": "much greater than",
    "⊂": "subset of",
    "⊃": "superset of",
    "⊆": "subset of or equal",
    "⊇": "superset of or equal",
    "⊕": "circled plus direct sum",
    "⊗": "circled times tensor",
    "⊥": "perpendicular up tack",
    "⌈": "left ceiling",
    "⌉": "right ceiling",
    "⌊": "left floor",
    "⌋": "right floor",
    "…": "ellipsis dots",
    "—": "em dash",
    "–": "en dash",
    "«": "left guillemet quote",
    "»": "right guillemet quote",
    "¡": "inverted exclamation",
    "¿": "inverted question",
    "§": "section",
    "¶": "pilcrow paragraph",
    "•": "bullet",
    "†": "dagger",
    "‡": "double dagger",
    "Æ": "ae ligature ash",
    "æ": "ae ligature ash",
    "ß": "sharp s eszett",
    "Ç": "c cedilla",
    "ç": "c cedilla",
    "Ñ": "n tilde",
    "ñ": "n tilde"
};

function symbolKeywords(symbol, greekIndex) {
    const parts = [symbol, symbol.codePointAt(0).toString(16)];

    if (symbolNames[symbol]) parts.push(symbolNames[symbol]);

    if (greekIndex !== undefined && greekIndex >= 0) {
        const name = greekNames[greekIndex % greekNames.length];

        parts.push(greekIndex < greekNames.length ? `${name} capital uppercase greek` : `${name} small lowercase greek`);
    }

    const decomposed = symbol.normalize("NFD");

    if (decomposed.length > 1) {
        parts.push(decomposed[0]);

        for (const mark of decomposed.slice(1)) {
            if (combiningNames[mark]) parts.push(`${decomposed[0]} ${combiningNames[mark]}`);
        }
    }

    return parts.join(" ").toLowerCase();
}


const mathSymbols = [
    "∀", "∁", "∂", "∃", "∄", "∅", "∆", "∇", "∈", "∉", "∊", "∋", "∌", "∍", "∎", "∏", "∐", "∑",
    "−", "±", "÷", "×", "⋅", "√", "∛", "∜", "∝", "∞", "∟", "∠", "∢", "∣", "∧", "∨", "¬", "∩",
    "∪", "∫", "∬", "∭", "∮", "∯", "∰", "∱", "∲", "∳", "∴", "∵", "∶", "∷", "∸", "∹", "∺",
    "∻", "∼", "∽", "≁", "≂", "≃", "≃", "≄", "≅", "≆", "≇", "≈", "≉", "≊", "≋", "≌", "≍", "≎", "≏",
    "≐", "≑", "≒", "≓", "≔", "≕", "≖", "≗", "≘", "≙", "≚", "≛", "≜", "≝", "≞", "≟", "≠", "≡",
    "≤", "≥", "≦", "≧", "≨", "≩", "≪", "≫", "≬", "≭", "≮", "≯", "≰", "≱",
    "∎", "⊂", "⊃", "⊄", "⊅", "⊆", "⊇", "⊈", "⊉", "⊊", "⊋", "⊏", "⊐", "⊑", "⊒", "⊓", "⊔", "⊕",
    "⊖", "⊗", "⊘", "⊙", "⊚", "⊛", "⊜", "⊝", "⊞", "⊟", "⊠", "⊡", "⊢", "⊣", "⊤", "⊥", "⊦", "⊧",
    "⊨", "⊩", "⊪", "⊫", "⊬", "⊭", "⊮", "⊯", "⊰", "⊱", "⊲", "⊳", "⊴", "⊵", "⊶", "⊷", "⊸", "⊹",
    "⊺", "⊻", "⊼", "⊽", "⊾", "⊿", "⋀", "⋁", "⋂", "⋃", "⋄", "⋅", "⋆", "⋇", "⋈", "⋉", "⋊", "⋋",
    "⋌", "⋍", "⋎", "⋏", "⋐", "⋑", "⋒", "⋓", "⋔", "⋕", "⋖", "⋗", "⋘", "⋙", "⋚", "⋛", "⋜", "⋝",
    "⋞", "⋟", "⋠", "⋡", "⋢", "⋣", "⋤", "⋥", "⋦", "⋧", "⋨", "⋩", "⋪", "⋫", "⋬", "⋭", "⋮", "⋯",
    "⋰", "⋱", "⋲", "⋳", "⋴", "⋵", "⋶", "⋷", "⋸", "⋹", "⋺", "⋻", "⋼", "⋽", "⋾", "⋿"
];
const latinSymbols = [
    "À", "Á", "Â", "Ã", "Ä", "Å", "Æ", "Ç", "È", "É", "Ê", "Ë", "Ì", "Í", "Î", "Ï", "Ñ", "Ò", "Ó", "Ô",
    "Õ", "Ö", "Ù", "Ú", "Û", "Ü", "Ý", "ß", "à", "á", "â", "ã", "ä", "å", "æ", "ç", "è", "é", "ê", "ë",
    "ì", "í", "î", "ï", "ñ", "ò", "ó", "ô", "õ", "ö", "ù", "ú", "û", "ü", "ý", "ÿ"
];
const greekSymbols = [
    "Α", "Β", "Γ", "Δ", "Ε", "Ζ", "Η", "Θ", "Ι", "Κ", "Λ", "Μ", "Ν", "Ξ", "Ο", "Π", "Ρ", "Σ", "Τ", "Υ",
    "Φ", "Χ", "Ψ", "Ω", "α", "β", "γ", "δ", "ε", "ζ", "η", "θ", "ι", "κ", "λ", "μ", "ν", "ξ", "ο", "π",
    "ρ", "σ", "τ", "υ", "φ", "χ", "ψ", "ω"
];
const punctuationSymbols = [
    "…", "—", "–", "'", "'", "«", "»", "¡", "¿", "§", "¶", "•", "†", "‡"
];

const isMacPlatform = () => navigator.platform.toUpperCase().includes("MAC");
const stopAll = e => { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.(); };
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
function parseBind(str) { if (!str) return null; const parts = String(str).trim().toLowerCase().split("+").map(p => p.trim()); const spec = { key: null, shift: false }; for (const p of parts) { if (p === "shift") spec.shift = true; else if (p) spec.key = p; } return spec.key ? spec : null; }
function matchBind(e, spec, isMac) { if (!spec) return false; const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey; return !!cmdOrCtrl && (!!spec.shift === !!e.shiftKey) && e.key.toLowerCase() === spec.key; }
function normalizeBinds(keyBinds) {
  const d = { search: "f", save: "s", selectAll: "a", cut: "x", copy: "c", paste: "v", undo: "z", redo: null };
  const m = { ...d, ...(keyBinds || {}) };
  const one = k => [parseBind(m[k])].filter(Boolean);
  return { search: one("search"), save: one("save"), selectAll: one("selectAll"), cut: one("cut"), copy: one("copy"), paste: one("paste"), undo: one("undo"), redo: m.redo ? one("redo") : [parseBind("y"), parseBind("shift+z")].filter(Boolean) };
}
function clampPosition(rect, width = 180, height = 200, offset = 6) {
  let top = rect.bottom + offset, left = rect.left;
  if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
  if (top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - offset);
  return { top, left };
}

function useDebounce(callback, delay) {
  const timeoutRef = useRef(null);
  return useCallback((...args) => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => callback(...args), delay);
  }, [callback, delay]);
}

export default function Text({ fileHandle, keyBinds, onSaveStatusChange, onSave, onEdit }) {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("idle");
  const editorRef = useRef(null);
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
  const [openMenu, setOpenMenu] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const menuPortalRef = useRef(null);
  const fileBtnRef = useRef(null);
  const editBtnRef = useRef(null);
  const insertBtnRef = useRef(null);
  const toolsBtnRef = useRef(null);
  const [ctxMenu, setCtxMenu] = useState({ open: false, x: 0, y: 0, items: [] });
  const ctxMenuRef = useRef(null);
  const contentRef = useRef(null);
  const formatRef = useRef(null);
  const containerRef = useRef(null);
  const sectionRef = useRef(null);
  const pendingDocumentRef = useRef(null);

  const [reloadEpoch, setReloadEpoch] = useState(0);
  const [documentStyleSheet, setDocumentStyleSheet] = useState("");
  const [pageGeometry, setPageGeometry] = useState(null);
  const pageGeometryRef = useRef(null);
  const paginateRef = useRef(null);
  const richRef = useRef(false);
  const formatBtnRef = useRef(null);
  const navigateBtnRef = useRef(null);
  const sortBtnRef = useRef(null);
  const [showSpecialPicker, setShowSpecialPicker] = useState(false);
  const [specialCategory, setSpecialCategory] = useState("math");
  const [specialSearch, setSpecialSearch] = useState("");
  const specialPickerRef = useRef(null);
  const drawCanvasRef = useRef(null);
  const drawStrokesRef = useRef([]);
  const drawPointsRef = useRef([]);
  const isSketchingRef = useRef(false);
  const glyphFeaturesRef = useRef(null);
  const [drawMatches, setDrawMatches] = useState([]);

  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const isUndoRedoAction = useRef(false);
  const saveTimeout = useRef(null);

  const notifySaveStatus = useCallback((statusMessage, additionalData = {}) => {
    onSaveStatusChange?.({
      hasUnsavedChanges,
      status: statusMessage,
      operation: additionalData.operation || 'edit',
    });
  }, [onSaveStatusChange, hasUnsavedChanges]);

  const debouncedNotifySaveStatus = useDebounce(notifySaveStatus, 100);

  useEffect(() => {
    setHasUnsavedChanges(history.length > 0 && historyIndex >= 0);
  }, [history, historyIndex]);

  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);

  useEffect(() => {
    historyRef.current = history;
    historyIndexRef.current = historyIndex;
  }, [history, historyIndex]);

  const recordHistory = useCallback((previous, next) => {
    clearTimeout(saveTimeout.current);

    const entries = historyRef.current.slice(0, historyIndexRef.current + 1);

    if (!entries.length || entries[entries.length - 1] !== previous) entries.push(previous);

    entries.push(next);

    historyRef.current = entries;
    historyIndexRef.current = entries.length - 1;

    setHistory(entries);
    setHistoryIndex(entries.length - 1);
  }, []);

  const saveToHistory = useCallback((content) => {
    if (isUndoRedoAction.current) return;

    clearTimeout(saveTimeout.current);

    const currentHistory = history;
    const currentIndex = historyIndex;

    saveTimeout.current = setTimeout(() => {
      const trimmedHistory = currentHistory.slice(0, currentIndex + 1);

      if (trimmedHistory.length === 0 || trimmedHistory[trimmedHistory.length - 1] !== content) {
        setHistory([...trimmedHistory, content]);
        setHistoryIndex(currentIndex + 1);
      }
    }, 300);
  }, [history, historyIndex]);

  useEffect(() => {
    async function loadFile() {
      try {
        if (!fileHandle) { setLoading(false); return; }
        const file = await fileHandle.getFile();
        const format = documentFormatFor(file.name);

        if (!format) throw new Error(`Unsupported file type: .${file.name.split(".").pop().toLowerCase()}`);

        formatRef.current = format;
        containerRef.current = null;

        richRef.current = Boolean(format.rich);
        sectionRef.current = null;

        setDocumentStyleSheet("");
        pageGeometryRef.current = null;
        setPageGeometry(null);

        let t = "";

        if (format.kind === "doc") {
          richRef.current = true;
          sectionRef.current = null;
          pageGeometryRef.current = null;
          setPageGeometry(null);
          setDocumentStyleSheet("");
          pendingDocumentRef.current = htmlFromLegacyDoc(await file.arrayBuffer());
          setHistory([pendingDocumentRef.current]);
          setHistoryIndex(0);
          setLoading(false);
          return;
        }

        if (format.kind === "docx" || format.kind === "odt") {
          const entries = await unzipEntries(await file.arrayBuffer());
          const partName = ZIP_DOCUMENT_PARTS[format.kind];
          const part = entries.get(partName);

          if (!part) throw new Error("This document does not hold any readable body text.");

          const decoder = new TextDecoder();
          const xml = decoder.decode(part);

          containerRef.current = entries;

          if (format.kind === "docx") {
            const numbering = entries.get("word/numbering.xml");
            const styles = entries.get("word/styles.xml");
            const stylesText = styles ? decoder.decode(styles) : null;
            const themePart = entries.get("word/theme/theme1.xml");
            const themeText = themePart ? decoder.decode(themePart) : null;
            const relsPart = entries.get("word/_rels/document.xml.rels");
            const relsText = relsPart ? decoder.decode(relsPart) : null;
            const media = new Map();

            for (const [name, bytes] of entries) {
              if (name.startsWith("word/media/")) media.set(name.replace(/^word\//, ""), bytes);
            }

            sectionRef.current = sectionPropertiesFrom(xml);
            pageGeometryRef.current = pageGeometryFrom(sectionRef.current);
            setPageGeometry(pageGeometryRef.current);
            setDocumentStyleSheet(styleSheetFromCatalog(parseWordStyles(stylesText, themeText), ".textTextEditor"));

            pendingDocumentRef.current = htmlFromWordXml(
              xml,
              numbering ? decoder.decode(numbering) : null,
              stylesText,
              themeText,
              relsText,
              media
            );

            setHistory([pendingDocumentRef.current]);
            setHistoryIndex(0);
            setLoading(false);
            return;
          }

          t = textFromOpenDocumentXml(xml);
        } else if (format.kind === "rtf") {
          t = textFromRtf(await file.text());
        } else if (format.kind === "html") {
          const source = await file.text();
          const parsed = new DOMParser().parseFromString(source, "text/html");
          const css = [...parsed.querySelectorAll("style")].map((node) => node.textContent || "").join("\n");

          parsed.querySelectorAll("script, style").forEach((node) => node.remove());

          if (css.trim()) setDocumentStyleSheet(scopeStylesTo(css, ".textTextEditor"));

          t = parsed.body?.innerHTML || "";
        } else {
          t = await file.text();
        }

        pendingDocumentRef.current = t;
        setHistory([t]);
        setHistoryIndex(0);
      } catch (error) { setError(error.message); } finally { setLoading(false); }
    }
    loadFile();
  }, [fileHandle, reloadEpoch]);

  const paginate = useCallback(() => {
    const editor = editorRef.current;
    const geometry = pageGeometryRef.current || DEFAULT_PAGE_GEOMETRY;

    if (!editor || !richRef.current) return;

    const pending = paginateEditor(editor, geometry);

    if (pending?.length) {
      Promise.all(pending.map((image) => image.decode().catch(() => null))).then(() => paginateRef.current?.());
    }
  }, []);

  paginateRef.current = paginate;

  const readEditor = useCallback(() => {
    const editor = editorRef.current;

    if (!editor) return "";

    if (!richRef.current) return editor.textContent || "";

    const clone = editor.cloneNode(true);

    clone.querySelectorAll(".dw-page-layer, .dw-page-gap").forEach((node) => node.remove());
    mergeSplitBlocks(clone);
    clone.normalize();

    for (const pushed of clone.querySelectorAll("[data-dw-push]")) {
      pushed.style.marginTop = pushed.getAttribute("data-dw-push") || "";
      pushed.removeAttribute("data-dw-push");

      if (!pushed.getAttribute("style")) pushed.removeAttribute("style");
    }

    return clone.innerHTML;
  }, []);

  const writeEditor = useCallback((value) => {
    const editor = editorRef.current;

    if (!editor) return;

    if (richRef.current) {
      editor.innerHTML = value;
      paginateRef.current?.();
    } else {
      editor.textContent = value;
    }
  }, []);

  useEffect(() => {
    if (loading || pendingDocumentRef.current === null) return;

    const editor = editorRef.current;

    if (!editor) return;

    writeEditor(pendingDocumentRef.current);
    pendingDocumentRef.current = null;
    requestAnimationFrame(() => paginate());
  }, [loading, writeEditor, paginate]);

  const serializeDocument = useCallback(async (content, kind) => {

    if (kind === "doc") {
      throw new Error("Word 97-2003 documents cannot be written back. Use Download to save a copy as .docx.");
    }

    if (kind === "docx" || kind === "odt") {
      const partName = ZIP_DOCUMENT_PARTS[kind];
      const xml = kind === "docx"
        ? (richRef.current ? wordXmlFromHtml(content, sectionRef.current) : wordXmlFromText(content))
        : openDocumentXmlFromText(richRef.current ? textFromHtml(content) : content);
      const entries = containerRef.current
        ? new Map(containerRef.current)
        : (kind === "docx" ? minimalDocxEntries(content) : minimalOdtEntries(content));

      entries.set(partName, new TextEncoder().encode(xml));

      const required = kind === "docx" ? "[Content_Types].xml" : "META-INF/manifest.xml";

      if (!entries.has(required)) throw new Error("This document is missing the parts needed to write it back.");

      return zipEntries(entries);
    }

    const plain = richRef.current ? textFromHtml(content) : content;

    if (kind === "rtf") return new Blob([rtfFromText(plain)], { type: "application/rtf" });

    if (kind === "html") {
      const markup = richRef.current
        ? `<!doctype html>\n<html>\n<head>\n<meta charset="utf-8" />\n<title>${escapeXml(fileHandle?.name || "Untitled")}</title>\n</head>\n<body>\n${content}\n</body>\n</html>\n`
        : htmlFromText(content, fileHandle?.name);

      return new Blob([markup], { type: "text/html" });
    }

    return new Blob([plain], { type: "text/plain" });
  }, [fileHandle]);

  const handleInput = useCallback((e) => {
    if (isUndoRedoAction.current) return;

    const editor = editorRef.current;
    if (!editor) return;

    const currentContent = readEditor();

    saveToHistory(currentContent);

    onEdit?.({ fullCode: history[historyIndex] || "" }, { fullCode: currentContent });
    debouncedNotifySaveStatus("Unsaved Changes");
  }, [saveToHistory, onEdit, debouncedNotifySaveStatus, history, historyIndex, readEditor]);

  const handleSave = useCallback(() => {
    if (!fileHandle) {
      setSaveStatus("no-handle");
      notifySaveStatus("No file handle available.", { operation: "save" });
      setTimeout(() => {
        setSaveStatus("idle");
        notifySaveStatus("", { operation: "save" });
      }, SAVE_BANNER_TIMEOUT_MS);
      return;
    }
    setSaveStatus("saving");
    notifySaveStatus("Saving...", { operation: "save" });
    (async () => {
      try {
        const content = readEditor();
        const payload = await serializeDocument(content, formatRef.current?.kind || "plain");
        const writable = await fileHandle.createWritable();
        await writable.write(payload);
        await writable.close();
        setSaveStatus("saved");
        setHistory([]);
        setHistoryIndex(-1);
        notifySaveStatus("Saved!", { operation: "save" });
        onSave?.(content);
        setTimeout(() => {
          setSaveStatus("idle");
          notifySaveStatus("", { operation: "save" });
        }, SAVE_BANNER_TIMEOUT_MS);
      } catch {
        setSaveStatus("failed");
        notifySaveStatus("Save failed!", { operation: "save" });
        setTimeout(() => {
          setSaveStatus("idle");
          notifySaveStatus("", { operation: "save" });
        }, SAVE_BANNER_TIMEOUT_MS);
      }
    })();
  }, [fileHandle, onSave, notifySaveStatus, serializeDocument, readEditor]);

  const handleDownload = useCallback(async () => {
    const result = await showDialog({
      title: "Download as...",
      message: "Select file type:",
      inputs: [{
        name: "type",
        type: "select",
        options: [
          { label: "Text (.txt)", value: "txt" },
          { label: "Markdown (.md)", value: "md" },
          { label: "Word Document (.docx)", value: "docx" },
          { label: "OpenDocument Text (.odt)", value: "odt" },
          { label: "Rich Text (.rtf)", value: "rtf" },
          { label: "HTML Document (.html)", value: "html" }
        ]
      }],
      showCancel: true
    });
    if (result) {
      const content = readEditor();
      const kind = result.type === "txt" || result.type === "md" ? "plain" : result.type;
      const blob = await serializeDocument(content, kind);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (fileHandle?.name?.replace(/\.[^/.]+$/, "") || "Untitled") + "." + result.type;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [fileHandle, readEditor, serializeDocument]);

  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) return;

    const editor = editorRef.current;
    if (!editor) return;

    isUndoRedoAction.current = true;

    const newIndex = historyIndex - 1;
    const content = history[newIndex];

    writeEditor(content);
    setHistoryIndex(newIndex);

    editor.focus();
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(editor);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);

    onEdit?.({ fullCode: readEditor() }, { fullCode: content });
    debouncedNotifySaveStatus("Unsaved Changes", { operation: "undo" });

    setTimeout(() => {
      isUndoRedoAction.current = false;
    }, 100);
  }, [historyIndex, history, onEdit, debouncedNotifySaveStatus, writeEditor, readEditor]);

  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;

    const editor = editorRef.current;
    if (!editor) return;

    isUndoRedoAction.current = true;

    const newIndex = historyIndex + 1;
    const content = history[newIndex];

    writeEditor(content);
    setHistoryIndex(newIndex);

    editor.focus();
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(editor);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);

    onEdit?.({ fullCode: readEditor() }, { fullCode: content });
    debouncedNotifySaveStatus("Unsaved Changes", { operation: "redo" });

    setTimeout(() => {
      isUndoRedoAction.current = false;
    }, 100);
  }, [historyIndex, history, onEdit, debouncedNotifySaveStatus, writeEditor, readEditor]);

  const handleCut = () => {
    const editor = editorRef.current;
    if (!editor) return;

    const currentContent = editor.textContent || "";
    saveToHistory(currentContent);

    document.execCommand("cut");

    setTimeout(() => {
      const newContent = editor.textContent || "";
      onEdit?.({ fullCode: currentContent }, { fullCode: newContent });
      debouncedNotifySaveStatus("Unsaved Changes", { operation: "cut" });
    }, 0);
  };

  const handleCopy = () => document.execCommand("copy");

  const handlePaste = () => {
    const editor = editorRef.current;
    if (!editor) return;

    const currentContent = editor.textContent || "";
    saveToHistory(currentContent);

    document.execCommand("paste");

    setTimeout(() => {
      const newContent = editor.textContent || "";
      onEdit?.({ fullCode: currentContent }, { fullCode: newContent });
      debouncedNotifySaveStatus("Unsaved Changes", { operation: "paste" });
    }, 0);
  };

  const handleSelectAll = () => {
    if (editorRef.current) {
      const range = document.createRange();
      range.selectNodeContents(editorRef.current);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
  };
  const [indents, setIndents] = useState({ first: 0, left: 0, right: 0 });
  const [lineSpacing, setLineSpacing] = useState("1.15");
  const [equationMenu, setEquationMenu] = useState(null);
  const [showEquationEditor, setShowEquationEditor] = useState(false);
  const [equationSource, setEquationSource] = useState("");
  const equationInputRef = useRef(null);
  const indentDragRef = useRef(null);
  const savedRangeRef = useRef(null);

  const rememberSelection = useCallback(() => {
    const editor = editorRef.current;
    const selection = window.getSelection();

    if (!editor || !selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);

    if (editor.contains(range.commonAncestorContainer)) savedRangeRef.current = range.cloneRange();
  }, []);

  const restoreSelection = useCallback(() => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    const saved = savedRangeRef.current;

    if (!editor || !selection) return;

    const live = selection.rangeCount ? selection.getRangeAt(0) : null;

    if (live && editor.contains(live.commonAncestorContainer)) return;
    if (!saved) return;

    selection.removeAllRanges();
    selection.addRange(saved.cloneRange());
  }, []);

  const appendEquationSnippet = useCallback((snippet) => {
    const input = equationInputRef.current;

    if (!input) {
      setEquationSource((previous) => previous + snippet);
      return;
    }

    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const selected = input.value.slice(start, end);
    const body = selected && snippet.includes(EQUATION_PLACEHOLDER)
      ? snippet.replace(EQUATION_PLACEHOLDER, selected)
      : snippet;
    const next = `${input.value.slice(0, start)}${body}${input.value.slice(end)}`;
    const slot = body.indexOf(EQUATION_PLACEHOLDER);

    setEquationSource(next);
    requestAnimationFrame(() => {
      input.focus();

      if (slot >= 0) input.setSelectionRange(start + slot, start + slot + 1);
      else input.setSelectionRange(start + body.length, start + body.length);
    });
  }, []);

  const selectNextPlaceholder = useCallback((direction = 1) => {
    const input = equationInputRef.current;

    if (!input) return;

    const value = input.value;
    const spots = [];

    for (let index = 0; index < value.length; index++) {
      if (value[index] === EQUATION_PLACEHOLDER) spots.push(index);
    }

    if (!spots.length) return;

    const caret = input.selectionStart ?? 0;
    const forward = spots.find((spot) => spot > caret);
    const backward = [...spots].reverse().find((spot) => spot < caret);
    const target = direction > 0 ? (forward ?? spots[0]) : (backward ?? spots[spots.length - 1]);

    input.focus();
    input.setSelectionRange(target, target + 1);
  }, []);

  const commitEquation = useCallback(() => {
    const editor = editorRef.current;
    const source = equationSource.split(EQUATION_PLACEHOLDER).join("").trim();

    if (!editor || !source) return;

    restoreSelection();

    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0 || !editor.contains(selection.getRangeAt(0).commonAncestorContainer)) {
      const fallback = document.createRange();

      fallback.selectNodeContents(editor);
      fallback.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(fallback);
    }

    const previous = readEditor();
    const range = window.getSelection().getRangeAt(0);
    const field = document.createElement("span");

    field.className = "dw-math";
    field.setAttribute("data-latex", source);
    field.innerHTML = mathmlFromLatex(source);

    range.deleteContents();
    range.insertNode(field);

    const after = document.createRange();

    after.setStartAfter(field);
    after.collapse(true);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(after);

    setShowEquationEditor(false);
    setEquationSource("");
    setEquationMenu(null);
    saveToHistory(readEditor());
    onEdit?.({ fullCode: previous }, { fullCode: readEditor() });
    debouncedNotifySaveStatus("Unsaved Changes");
    paginateRef.current?.();
  }, [equationSource, restoreSelection, readEditor, saveToHistory, onEdit, debouncedNotifySaveStatus]);

  const applyInlineStyle = useCallback((declarations) => {
    const editor = editorRef.current;

    restoreSelection();

    const selection = window.getSelection();

    if (!editor || !selection || selection.rangeCount === 0 || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);

    if (!editor.contains(range.commonAncestorContainer)) return;

    const previous = readEditor();
    const properties = Object.entries(declarations).map(([name, value]) => [
      name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
      value
    ]);
    const root = range.commonAncestorContainer.nodeType === 1
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentNode;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const targets = [];

    while (walker.nextNode()) {
      const node = walker.currentNode;

      if (!range.intersectsNode(node)) continue;
      if (!node.nodeValue || !node.nodeValue.replace(/[\s\u200b]/g, "")) continue;
      if (node.parentElement?.closest(".dw-page-layer, .dw-page-gap")) continue;

      targets.push(node);
    }

    if (!targets.length) return;

    const wrappers = [];

    for (const node of targets) {
      const start = node === range.startContainer ? range.startOffset : 0;
      const end = node === range.endContainer ? range.endOffset : node.nodeValue.length;

      if (end <= start) continue;

      const piece = document.createRange();

      piece.setStart(node, start);
      piece.setEnd(node, end);

      const wrapper = document.createElement("span");

      wrapper.className = "dw-run";

      for (const [name, value] of properties) wrapper.style.setProperty(name, value, "important");

      wrapper.appendChild(piece.extractContents());
      piece.insertNode(wrapper);
      wrappers.push(wrapper);
    }

    if (!wrappers.length) return;

    const restored = document.createRange();

    restored.setStartBefore(wrappers[0]);
    restored.setEndAfter(wrappers[wrappers.length - 1]);
    selection.removeAllRanges();
    selection.addRange(restored);

    saveToHistory(readEditor());
    onEdit?.({ fullCode: previous }, { fullCode: readEditor() });
    debouncedNotifySaveStatus("Unsaved Changes");
    paginateRef.current?.();
  }, [readEditor, saveToHistory, onEdit, debouncedNotifySaveStatus, restoreSelection]);

  const selectedParagraphs = useCallback(() => {
    const editor = editorRef.current;
    const selection = window.getSelection();

    if (!editor || !selection || selection.rangeCount === 0) return [];

    const range = selection.getRangeAt(0);
    const candidates = [...editor.querySelectorAll(".dw-p, li, h1, h2, h3, h4, h5, h6")];
    const inside = candidates.filter((node) => range.intersectsNode(node) && !node.closest(".dw-page-gap"));

    if (inside.length) return inside.filter((node) => !inside.some((other) => other !== node && other.contains(node)));

    const anchor = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
    const block = anchor?.closest(".dw-p, li, h1, h2, h3, h4, h5, h6");

    return block ? [block] : [];
  }, []);

  const readIndents = useCallback(() => {
    const [block] = selectedParagraphs();

    if (!block || indentDragRef.current) return;

    const style = window.getComputedStyle(block);
    const toPoints = (value) => Math.round((parseFloat(value) || 0) * 72 / 96);

    setIndents({
      first: toPoints(style.textIndent),
      left: toPoints(style.marginLeft) + toPoints(style.paddingLeft),
      right: toPoints(style.marginRight)
    });
  }, [selectedParagraphs]);

  const applyIndents = useCallback((next) => {
    restoreSelection();

    const blocks = selectedParagraphs();

    if (!blocks.length) return;

    const previous = readEditor();

    for (const block of blocks) {
      block.style.setProperty("margin-left", `${Math.max(0, next.left)}pt`, "important");
      block.style.setProperty("margin-right", `${Math.max(0, next.right)}pt`, "important");
      block.style.setProperty("text-indent", `${next.first}pt`, "important");
      block.style.setProperty("padding-left", "0pt", "important");
    }

    setIndents(next);
    saveToHistory(readEditor());
    onEdit?.({ fullCode: previous }, { fullCode: readEditor() });
    debouncedNotifySaveStatus("Unsaved Changes");
    paginateRef.current?.();
  }, [selectedParagraphs, readEditor, saveToHistory, onEdit, debouncedNotifySaveStatus]);

  const applyParagraphStyle = useCallback((declarations) => {
    restoreSelection();

    const blocks = selectedParagraphs();

    if (!blocks.length) return;

    const previous = readEditor();
    const properties = Object.entries(declarations).map(([name, value]) => [
      name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
      value
    ]);

    for (const block of blocks) {
      for (const [name, value] of properties) block.style.setProperty(name, value, "important");
    }

    saveToHistory(readEditor());
    onEdit?.({ fullCode: previous }, { fullCode: readEditor() });
    debouncedNotifySaveStatus("Unsaved Changes");
    paginateRef.current?.();
  }, [selectedParagraphs, readEditor, saveToHistory, onEdit, debouncedNotifySaveStatus, restoreSelection]);

  const stepLineSpacing = useCallback((direction) => {
    const ladder = ["1", "1.15", "1.5", "2", "2.5", "3"];
    const index = Math.max(0, ladder.indexOf(lineSpacing));
    const next = ladder[Math.min(ladder.length - 1, Math.max(0, index + direction))];

    setLineSpacing(next);
    applyParagraphStyle({ lineHeight: next });
  }, [lineSpacing, applyParagraphStyle]);

  const startIndentDrag = useCallback((handle) => (event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    indentDragRef.current = { handle, startX: event.clientX, start: { ...indents } };
  }, [indents]);

  const moveIndentDrag = useCallback((event) => {
    const drag = indentDragRef.current;

    if (!drag) return;

    const page = pageGeometryRef.current || DEFAULT_PAGE_GEOMETRY;
    const delta = (event.clientX - drag.startX) * 72 / 96;
    const snapped = Math.round(delta / INDENT_SNAP_POINTS) * INDENT_SNAP_POINTS;
    const content = page.width - page.left - page.right;
    const minimum = 36;
    const next = { ...drag.start };

    if (drag.handle === "left") {
      next.left = Math.min(Math.max(0, drag.start.left + snapped), Math.max(0, content - drag.start.right - minimum));
      next.first = Math.min(Math.max(-next.left, drag.start.first), Math.max(0, content - next.left - drag.start.right - minimum));
    } else if (drag.handle === "first") {
      next.first = Math.min(
        Math.max(-drag.start.left, drag.start.first + snapped),
        Math.max(0, content - drag.start.left - drag.start.right - minimum)
      );
    } else {
      next.right = Math.min(Math.max(0, drag.start.right - snapped), Math.max(0, content - drag.start.left - minimum));
    }

    setIndents(next);
  }, []);

  const endIndentDrag = useCallback(() => {
    if (!indentDragRef.current) return;

    indentDragRef.current = null;
    applyIndents(indents);
  }, [applyIndents, indents]);

  const toggleInlineStyle = useCallback((property, onValue, offValue) => {
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

    const anchor = selection.getRangeAt(0).startContainer;
    const element = anchor.nodeType === 1 ? anchor : anchor.parentElement;
    const current = element ? window.getComputedStyle(element)[property] : "";

    let active = false;

    if (property === "fontWeight") active = current === "bold" || Number(current) >= 600;
    else if (property === "fontStyle") active = current === "italic";
    else active = String(current).includes(onValue);

    applyInlineStyle({ [property]: active ? offValue : onValue });
  }, [applyInlineStyle]);

  const runCommand = useCallback((command, value = null) => {
    const editor = editorRef.current;

    if (!editor) return;

    editor.focus();

    try {
      if (command === "bold") return toggleInlineStyle("fontWeight", "700", "400");
      if (command === "italic") return toggleInlineStyle("fontStyle", "italic", "normal");
      if (command === "underline") return toggleInlineStyle("textDecorationLine", "underline", "none");
      if (command === "strikeThrough") return toggleInlineStyle("textDecorationLine", "line-through", "none");
      if (command === "foreColor") return applyInlineStyle({ color: value });
      if (command === "hiliteColor") return applyInlineStyle({ backgroundColor: value });

      document.execCommand("styleWithCSS", false, true);
      document.execCommand(command, false, value);
    } catch { }

    const previous = historyRef.current[historyIndexRef.current] ?? "";

    saveToHistory(readEditor());
    onEdit?.({ fullCode: previous }, { fullCode: readEditor() });
    debouncedNotifySaveStatus("Unsaved Changes");
  }, [saveToHistory, readEditor, onEdit, debouncedNotifySaveStatus, toggleInlineStyle, applyInlineStyle]);

  const pickInlineValue = useCallback(async (title, message, options, apply) => {
    const selection = window.getSelection();

    if (!selection || selection.isCollapsed) {
      await showDialog({ title, message: "Select some text first, then choose a value." });
      return;
    }

    const range = selection.getRangeAt(0).cloneRange();
    const result = await showDialog({
      title,
      message,
      inputs: [{ name: "value", type: "select", options }],
      showCancel: true
    });

    if (!result || !result.value) return;

    const restored = window.getSelection();

    restored.removeAllRanges();
    restored.addRange(range);

    apply(result.value);
  }, []);

  const getEditorText = useCallback(() => editorRef.current?.textContent || "", []);

  const getCaretOffset = useCallback(() => {
    const editor = editorRef.current;
    const selection = window.getSelection();

    if (!editor || !selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);

    if (!editor.contains(range.startContainer)) return null;

    const probe = range.cloneRange();

    probe.selectNodeContents(editor);
    probe.setEnd(range.startContainer, range.startOffset);

    const start = probe.toString().length;

    return { start, end: start + range.toString().length };
  }, []);

  const setCaretOffset = useCallback((start, end = start) => {
    const editor = editorRef.current;

    if (!editor) return;

    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);

    let offset = 0;
    let startNode = null;
    let startPos = 0;
    let endNode = null;
    let endPos = 0;

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const length = node.textContent.length;

      if (!startNode && offset + length >= start) {
        startNode = node;
        startPos = start - offset;
      }

      if (!endNode && offset + length >= end) {
        endNode = node;
        endPos = end - offset;
      }

      offset += length;
    }

    const range = document.createRange();

    if (startNode) {
      range.setStart(startNode, Math.min(startPos, startNode.textContent.length));
    } else {
      range.selectNodeContents(editor);
      range.collapse(false);
    }

    if (endNode) {
      range.setEnd(endNode, Math.min(endPos, endNode.textContent.length));
    } else if (startNode) {
      range.setEnd(startNode, Math.min(startPos, startNode.textContent.length));
    }

    const selection = window.getSelection();

    selection.removeAllRanges();
    selection.addRange(range);
  }, []);

  const scrollCaretIntoView = useCallback(() => {
    const container = contentRef.current;
    const selection = window.getSelection();

    if (!container || !selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const rects = range.getClientRects();
    const rect = rects.length ? rects[0] : range.getBoundingClientRect();
    const bounds = container.getBoundingClientRect();

    if (rect.top < bounds.top + 80) {
      container.scrollTop += rect.top - bounds.top - 80;
    } else if (rect.bottom > bounds.bottom - 80) {
      container.scrollTop += rect.bottom - bounds.bottom + 80;
    }
  }, []);

  const [statusCounts, setStatusCounts] = useState({ words: 0, characters: 0 });
  const [statusPosition, setStatusPosition] = useState("Line 1, Column 1");
  const [fontColor, setFontColor] = useState("#12151b");
  const [highlightColor, setHighlightColor] = useState("#ffff00");
  const [isFontColorOpen, setIsFontColorOpen] = useState(false);
  const [isHighlightColorOpen, setIsHighlightColorOpen] = useState(false);
  const [fontSizeLabel, setFontSizeLabel] = useState("11");
  const [fontWeightLabel, setFontWeightLabel] = useState("Regular");
  const sizeLadder = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72];

  const commitFontSize = useCallback((value) => {
    const size = Math.max(4, Math.min(400, Number(value) || 11));

    setFontSizeLabel(String(size));
    applyInlineStyle({ fontSize: `${size}pt` });
  }, [applyInlineStyle]);

  const stepFontSize = useCallback((direction) => {
    const current = Number(fontSizeLabel) || 11;

    if (direction > 0) {
      const next = sizeLadder.find((size) => size > current);

      commitFontSize(next ?? Math.min(400, current + 1));
      return;
    }

    const previous = [...sizeLadder].reverse().find((size) => size < current);

    commitFontSize(previous ?? Math.max(4, current - 1));
  }, [fontSizeLabel, commitFontSize]);

  const refreshStatus = useCallback(() => {
    const text = editorRef.current?.textContent || "";
    const trimmed = text.trim();

    setStatusCounts({
      words: trimmed ? trimmed.split(/\s+/).length : 0,
      characters: text.length
    });

    const caret = getCaretOffset();

    if (!caret) return;

    const before = text.slice(0, caret.start);

    setStatusPosition(`Line ${before.split("\n").length.toLocaleString()}, Column ${(caret.start - (before.lastIndexOf("\n") + 1) + 1).toLocaleString()}`);
  }, [getCaretOffset]);

  const repaginate = useDebounce(paginate, 120);

  useEffect(() => {
    if (loading) return;

    refreshStatus();

    const onSelection = () => { refreshStatus(); readIndents(); rememberSelection(); };
    const onInput = () => { refreshStatus(); repaginate(); };
    const editor = editorRef.current;

    document.addEventListener("selectionchange", onSelection);
    window.addEventListener("resize", repaginate);
    editor?.addEventListener("input", onInput);
    editor?.addEventListener("load", repaginate, true);

    return () => {
      document.removeEventListener("selectionchange", onSelection);
      window.removeEventListener("resize", repaginate);
      editor?.removeEventListener("input", onInput);
      editor?.removeEventListener("load", repaginate, true);
    };
  }, [loading, refreshStatus, repaginate, readIndents, rememberSelection]);

  const commitText = useCallback((nextText, caret) => {
    const editor = editorRef.current;

    if (!editor) return;

    const previous = editor.textContent || "";

    if (nextText === previous) return;

    editor.textContent = nextText;
    recordHistory(previous, nextText);

    if (caret) {
      setCaretOffset(caret.start, caret.end ?? caret.start);
      scrollCaretIntoView();
    }

    onEdit?.({ fullCode: previous }, { fullCode: nextText });
    debouncedNotifySaveStatus("Unsaved Changes");
  }, [recordHistory, setCaretOffset, scrollCaretIntoView, onEdit, debouncedNotifySaveStatus]);

  const lineBoundsAt = (text, offset) => {
    const start = text.lastIndexOf("\n", offset - 1) + 1;
    const nextBreak = text.indexOf("\n", offset);

    return { start, end: nextBreak === -1 ? text.length : nextBreak };
  };

  const transformRange = useCallback((transform) => {
    const editor = editorRef.current;

    if (!editor) return;

    editor.focus();

    const text = getEditorText();
    const caret = getCaretOffset();
    const hasSelection = Boolean(caret) && caret.end > caret.start;
    const start = hasSelection ? caret.start : 0;
    const end = hasSelection ? caret.end : text.length;
    const replaced = transform(text.slice(start, end));

    commitText(text.slice(0, start) + replaced + text.slice(end), { start, end: start + replaced.length });
  }, [getEditorText, getCaretOffset, commitText]);

  const transformLines = useCallback((transform) => {
    const editor = editorRef.current;

    if (!editor) return;

    editor.focus();

    const text = getEditorText();
    const caret = getCaretOffset();
    const hasSelection = Boolean(caret) && caret.end > caret.start;
    const head = hasSelection ? lineBoundsAt(text, caret.start).start : 0;
    const tail = hasSelection ? lineBoundsAt(text, caret.end).end : text.length;
    const replaced = transform(text.slice(head, tail).split("\n")).join("\n");

    commitText(text.slice(0, head) + replaced + text.slice(tail), { start: head, end: head + replaced.length });
  }, [getEditorText, getCaretOffset, commitText]);

  const handleDeleteSelection = useCallback(() => {
    const editor = editorRef.current;

    if (!editor) return;

    editor.focus();

    const caret = getCaretOffset();

    if (!caret || caret.end === caret.start) return;

    const text = getEditorText();

    commitText(text.slice(0, caret.start) + text.slice(caret.end), { start: caret.start });
  }, [getCaretOffset, getEditorText, commitText]);

  const handleDuplicateLine = useCallback(() => {
    const editor = editorRef.current;

    if (!editor) return;

    editor.focus();

    const text = getEditorText();
    const caret = getCaretOffset();
    const offset = caret ? caret.start : 0;
    const bounds = lineBoundsAt(text, offset);
    const line = text.slice(bounds.start, bounds.end);

    commitText(`${text.slice(0, bounds.end)}\n${line}${text.slice(bounds.end)}`, { start: offset + line.length + 1 });
  }, [getEditorText, getCaretOffset, commitText]);

  const handleDeleteLine = useCallback(() => {
    const editor = editorRef.current;

    if (!editor) return;

    editor.focus();

    const text = getEditorText();
    const caret = getCaretOffset();
    const offset = caret ? caret.start : 0;
    const bounds = lineBoundsAt(text, offset);
    const cutStart = bounds.end < text.length ? bounds.start : Math.max(0, bounds.start - 1);
    const cutEnd = bounds.end < text.length ? bounds.end + 1 : bounds.end;

    commitText(text.slice(0, cutStart) + text.slice(cutEnd), { start: cutStart });
  }, [getEditorText, getCaretOffset, commitText]);

  const moveLine = useCallback((direction) => {
    const editor = editorRef.current;

    if (!editor) return;

    editor.focus();

    const text = getEditorText();
    const caret = getCaretOffset();
    const offset = caret ? caret.start : 0;
    const lines = text.split("\n");
    const bounds = lineBoundsAt(text, offset);
    const index = text.slice(0, bounds.start).split("\n").length - 1;
    const target = index + direction;

    if (target < 0 || target >= lines.length) return;

    const column = offset - bounds.start;
    const reordered = [...lines];

    reordered[index] = lines[target];
    reordered[target] = lines[index];

    const nextText = reordered.join("\n");
    const nextStart = reordered.slice(0, target).reduce((total, line) => total + line.length + 1, 0);

    commitText(nextText, { start: nextStart + Math.min(column, reordered[target].length) });
  }, [getEditorText, getCaretOffset, commitText]);

  const goToLine = useCallback(async () => {
    const total = getEditorText().split("\n").length;
    const result = await showDialog({
      title: "Go To Line",
      message: `Enter a line number between 1 and ${total.toLocaleString()}.`,
      inputs: [{ name: "line", type: "text", defaultValue: "" }],
      showCancel: true
    });

    if (!result || !result.line) return;

    const requested = parseInt(String(result.line).trim(), 10);

    if (!Number.isFinite(requested) || requested < 1) {
      await showDialog({ title: "Go To Line", message: "That line number could not be read." });
      return;
    }

    const lines = getEditorText().split("\n");
    const index = Math.min(requested, lines.length) - 1;
    const offset = lines.slice(0, index).reduce((total, line) => total + line.length + 1, 0);

    editorRef.current?.focus();
    setCaretOffset(offset, offset + lines[index].length);
    scrollCaretIntoView();
  }, [getEditorText, setCaretOffset, scrollCaretIntoView]);

  const jumpToEdge = useCallback((position) => {
    const text = getEditorText();
    const offset = position === "start" ? 0 : text.length;

    editorRef.current?.focus();
    setCaretOffset(offset);

    if (contentRef.current) {
      contentRef.current.scrollTop = position === "start" ? 0 : contentRef.current.scrollHeight;
    }
  }, [getEditorText, setCaretOffset]);

  const handleCurrentPosition = useCallback(async () => {
    const caret = getCaretOffset();

    if (!caret) {
      await showDialog({ title: "Current Position", message: "The cursor is not in the document." });
      return;
    }

    const before = getEditorText().slice(0, caret.start);
    const line = before.split("\n").length;
    const column = caret.start - (before.lastIndexOf("\n") + 1) + 1;
    const selected = caret.end - caret.start;

    await showDialog({
      title: "Current Position",
      message: selected > 0
        ? `Line ${line.toLocaleString()}, column ${column.toLocaleString()}, with ${selected.toLocaleString()} characters selected.`
        : `Line ${line.toLocaleString()}, column ${column.toLocaleString()}.`
    });
  }, [getCaretOffset, getEditorText]);

  const handleReloadFromDisk = useCallback(async () => {
    if (!fileHandle) {
      await showDialog({ title: "Reload From Disk", message: "No file handle is available." });
      return;
    }

    const result = await showDialog({
      title: "Reload From Disk",
      message: "Unsaved changes in this document will be discarded. Do you want to continue?",
      showCancel: true
    });

    if (!result) return;

    setHistory([]);
    setHistoryIndex(-1);
    setHasUnsavedChanges(false);
    notifySaveStatus("", { operation: "reload" });
    setError(null);
    setLoading(true);
    setReloadEpoch((epoch) => epoch + 1);
  }, [fileHandle, notifySaveStatus]);

  const handleFileInformation = useCallback(async () => {
    const text = getEditorText();
    const lines = text.split("\n").length;
    const characters = text.length;

    if (!fileHandle) {
      await showDialog({
        title: "File Information",
        message: `Untitled document holding ${characters.toLocaleString()} characters across ${lines.toLocaleString()} lines.`
      });
      return;
    }

    try {
      const file = await fileHandle.getFile();

      await showDialog({
        title: "File Information",
        message: `${file.name}\nSize on disk: ${(file.size / 1024).toFixed(1)} KB\nLast modified: ${new Date(file.lastModified).toLocaleString()}\nIn the editor: ${characters.toLocaleString()} characters across ${lines.toLocaleString()} lines.`
      });
    } catch (error) {
      await showDialog({ title: "File Information", message: error?.message || "This file could not be read." });
    }
  }, [fileHandle, getEditorText]);

  const handlePrint = useCallback(() => {
    const text = getEditorText();
    const frame = window.open("", "_blank", "width=820,height=1000");

    if (!frame) {
      showDialog({ title: "Print", message: "The print window could not be opened. Allow pop-ups for this site and try again." });
      return;
    }

    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    frame.document.write(`<!doctype html><html><head><title>${fileHandle?.name || "Untitled Text"}</title><style>body{margin:0}pre{margin:0;padding:72px 88px;white-space:pre-wrap;word-wrap:break-word;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:15px;font-weight:600;line-height:1.6;color:#12151b}</style></head><body><pre>${escaped}</pre></body></html>`);
    frame.document.close();
    frame.focus();
    frame.print();
  }, [getEditorText, fileHandle]);

  const documentCounts = useCallback(() => {
    const text = editorRef.current?.textContent || "";
    const trimmed = text.trim();

    return {
      words: trimmed ? trimmed.split(/\s+/).length : 0,
      characters: text.length,
      charactersWithoutSpaces: text.replace(/\s/g, "").length,
      lines: text.split("\n").length,
      paragraphs: trimmed ? trimmed.split(/\n\s*\n/).length : 0,
      sentences: trimmed ? (trimmed.match(/[^.!?]+[.!?]+/g) || [trimmed]).length : 0
    };
  }, []);

  const handleStatistics = useCallback(() => {
    const counts = documentCounts();
    const minutes = Math.max(1, Math.round(counts.words / 200));

    showDialog({
      title: "Statistics",
      message: `Words: ${counts.words.toLocaleString()}\nCharacters: ${counts.characters.toLocaleString()}\nCharacters without spaces: ${counts.charactersWithoutSpaces.toLocaleString()}\nSentences: ${counts.sentences.toLocaleString()}\nParagraphs: ${counts.paragraphs.toLocaleString()}\nLines: ${counts.lines.toLocaleString()}\nReading time: about ${minutes} minute${minutes === 1 ? "" : "s"}.`
    });
  }, [documentCounts]);

  const handleWordCount = useCallback(async () => {
    const caret = getCaretOffset();
    const text = editorRef.current?.textContent || "";
    const counts = documentCounts();

    if (caret && caret.end > caret.start) {
      const selected = text.slice(caret.start, caret.end).trim();
      const words = selected ? selected.split(/\s+/).length : 0;

      await showDialog({
        title: "Word Count",
        message: `Words in selection: ${words.toLocaleString()} of ${counts.words.toLocaleString()} in the document.`
      });
      return;
    }

    await showDialog({ title: "Word Count", message: `Words in document: ${counts.words.toLocaleString()}.` });
  }, [getCaretOffset, documentCounts]);

  const handleCharacterCount = useCallback(async () => {
    const caret = getCaretOffset();
    const counts = documentCounts();

    if (caret && caret.end > caret.start) {
      await showDialog({
        title: "Character Count",
        message: `Characters in selection: ${(caret.end - caret.start).toLocaleString()} of ${counts.characters.toLocaleString()} in the document.`
      });
      return;
    }

    await showDialog({
      title: "Character Count",
      message: `Characters in document: ${counts.characters.toLocaleString()}, or ${counts.charactersWithoutSpaces.toLocaleString()} without whitespace.`
    });
  }, [getCaretOffset, documentCounts]);

  const handleLineCount = useCallback(async () => {
    const counts = documentCounts();

    await showDialog({ title: "Line Count", message: `Lines in document: ${counts.lines.toLocaleString()}.` });
  }, [documentCounts]);

  const insertSymbol = useCallback(symbol => {
    const editor = editorRef.current;
    if (!editor) return;

    const currentContent = editor.textContent || "";
    saveToHistory(currentContent);

    editor.focus();
    document.execCommand('insertText', false, symbol);

    setTimeout(() => {
      const newContent = editor.textContent || "";
      onEdit?.({ fullCode: currentContent }, { fullCode: newContent });
      debouncedNotifySaveStatus("Unsaved Changes", { operation: "insertSymbol" });
    }, 10);
  }, [saveToHistory, debouncedNotifySaveStatus, onEdit]);

  const insertDate = useCallback(() => {
    insertSymbol(new Date().toLocaleDateString());
  }, [insertSymbol]);

  const insertDateAndTime = useCallback(() => {
    insertSymbol(new Date().toLocaleString());
  }, [insertSymbol]);

  const insertHorizontalRule = useCallback(() => {
    insertSymbol("\n---\n");
  }, [insertSymbol]);

  const toTitleCase = (value) => value.replace(/\w[^\s]*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());

  useEffect(() => {
    const isMac = isMacPlatform();

    function handler(e) {
      const ae = document.activeElement;
      if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA") && ae !== editorRef.current) return;
      if (ae && ae.isContentEditable && ae !== editorRef.current) return;

      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (cmdOrCtrl) {
        const binds = normalizeBinds(keyBinds);

        if (binds.search.some(b => matchBind(e, b, isMac))) {
          stopAll(e);
          setShowSearchPanel(true);
          return;
        }
        if (binds.save.some(b => matchBind(e, b, isMac))) {
          stopAll(e);
          handleSave();
          return;
        }
        if (binds.selectAll.some(b => matchBind(e, b, isMac))) {
          stopAll(e);
          handleSelectAll();
          return;
        }
        if (binds.cut.some(b => matchBind(e, b, isMac))) {
          stopAll(e);
          handleCut();
          return;
        }
        if (binds.copy.some(b => matchBind(e, b, isMac))) {
          stopAll(e);
          handleCopy();
          return;
        }
        if (binds.paste.some(b => matchBind(e, b, isMac))) {
          stopAll(e);
          handlePaste();
          return;
        }
        if (binds.undo.some(b => matchBind(e, b, isMac))) {
          stopAll(e);
          handleUndo();
          return;
        }
        if (binds.redo.some(b => matchBind(e, b, isMac))) {
          stopAll(e);
          handleRedo();
          return;
        }
      }
    }

    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [
    keyBinds, handleSave, handleUndo, handleRedo, handleCut, handleCopy,
    handlePaste, handleSelectAll
  ]);

  function highlightMatches() {
    const editor = editorRef.current;
    if (!editor) return;

    editor.querySelectorAll('.search-match, .search-match-active').forEach(span => {
      const parent = span.parentNode;
      while (span.firstChild) parent.insertBefore(span.firstChild, span);
      parent.removeChild(span);
      parent.normalize();
    });

    if (!searchResults.length || !searchTerm) return;

    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      textNodes.push({ node, offset: 0 });
    }

    let globalOffset = 0;
    textNodes.forEach(({ node }, nodeIndex) => {
      const text = caseSensitive ? node.textContent : node.textContent.toLowerCase();
      const search = caseSensitive ? searchTerm : searchTerm.toLowerCase();
      const matches = [];
      let pos = 0;

      while (true) {
        const idx = text.indexOf(search, pos);
        if (idx === -1) break;
        matches.push({ start: idx, end: idx + searchTerm.length });
        pos = idx + 1;
      }

      if (matches.length) {
        const fragment = document.createDocumentFragment();
        let lastPos = 0;

        matches.forEach((match, matchIndex) => {
          const matchGlobalOffset = globalOffset + match.start;
          const matchEndGlobalOffset = globalOffset + match.end;
          const globalIndex = searchResults.findIndex(r => r.start === matchGlobalOffset && r.end === matchEndGlobalOffset);

          if (lastPos < match.start) {
            fragment.appendChild(document.createTextNode(node.textContent.slice(lastPos, match.start)));
          }

          const span = document.createElement('span');
          span.className = globalIndex === currentResultIndex ? 'search-match-active' : 'search-match';
          span.style.backgroundColor = globalIndex === currentResultIndex ? 'rgba(255, 255, 0, 0.5)' : 'rgba(255, 165, 0, 0.3)';
          span.style.borderRadius = '2px';
          span.textContent = node.textContent.slice(match.start, match.end);
          fragment.appendChild(span);

          lastPos = match.end;
        });

        if (lastPos < node.textContent.length) {
          fragment.appendChild(document.createTextNode(node.textContent.slice(lastPos)));
        }

        node.parentNode.replaceChild(fragment, node);
      }

      globalOffset += node.textContent.length;
    });

    if (currentResultIndex >= 0 && searchResults[currentResultIndex]) {
      const activeSpan = editor.querySelector('.search-match-active');
      if (activeSpan) {
        activeSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  function findAllMatches(term) {
    setSearchResults([]);
    setCurrentResultIndex(-1);
    if (!term) return;
    const editor = editorRef.current;
    if (!editor) return;
    const results = [];
    let concatenatedLength = 0;
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = caseSensitive ? node.textContent : node.textContent.toLowerCase();
      const search = caseSensitive ? term : term.toLowerCase();
      let pos = 0;
      while (true) {
        const idx = text.indexOf(search, pos);
        if (idx === -1) break;
        results.push({ start: concatenatedLength + idx, end: concatenatedLength + idx + term.length });
        pos = idx + 1;
      }
      concatenatedLength += node.textContent.length;
    }
    setSearchResults(results);
    if (results.length) {
      setCurrentResultIndex(0);
    }
  }

  useEffect(() => {
    if (searchTerm) {
      findAllMatches(searchTerm);
    } else {
      setSearchResults([]);
      setCurrentResultIndex(-1);
    }
  }, [searchTerm, caseSensitive]);

  const goToNext = () => {
    if (!searchResults.length) return;
    const idx = (currentResultIndex + 1) % searchResults.length;
    setCurrentResultIndex(idx);
  };

  const goToPrevious = () => {
    if (!searchResults.length) return;
    const idx = (currentResultIndex - 1 + searchResults.length) % searchResults.length;
    setCurrentResultIndex(idx);
  };

  const replaceCurrent = () => {
    if (currentResultIndex < 0 || !searchResults[currentResultIndex]) return;
    const editor = editorRef.current;
    if (!editor) return;

    const currentContent = editor.textContent || "";
    saveToHistory(currentContent);

    const { start, end } = searchResults[currentResultIndex];

    const text = editor.textContent;
    const newText = text.substring(0, start) + replaceTerm + text.substring(end);
    editor.textContent = newText;

    onEdit?.({ fullCode: currentContent }, { fullCode: newText });
    debouncedNotifySaveStatus("Unsaved Changes", { operation: "replace" });
    setTimeout(() => findAllMatches(searchTerm), 0);
  };

  const replaceAll = () => {
    if (!searchResults.length) return;
    const editor = editorRef.current;
    if (!editor) return;

    const currentContent = editor.textContent || "";
    saveToHistory(currentContent);

    let text = editor.textContent;

    const sortedResults = [...searchResults].sort((a, b) => b.start - a.start);
    for (const result of sortedResults) {
      text = text.substring(0, result.start) + replaceTerm + text.substring(result.end);
    }

    editor.textContent = text;

    onEdit?.({ fullCode: currentContent }, { fullCode: text });
    debouncedNotifySaveStatus("Unsaved Changes", { operation: "replaceAll" });
    setTimeout(() => findAllMatches(searchTerm), 0);
  };

  useEffect(() => {
    highlightMatches();
  }, [searchResults, currentResultIndex]);

  useEffect(() => {
    if (searchPanelDragging) {
      const move = e => setSearchPanelPos({ x: e.clientX - searchPanelOffset.x, y: e.clientY - searchPanelOffset.y });
      const up = () => setSearchPanelDragging(false);
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
      return () => {
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
      };
    }
  }, [searchPanelDragging, searchPanelOffset]);

  const startSearchDrag = e => {
    setSearchPanelDragging(true);
    setSearchPanelOffset({ x: e.clientX - searchPanelPos.x, y: e.clientY - searchPanelPos.y });
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showSpecialPicker && specialPickerRef.current && !specialPickerRef.current.contains(e.target)) {
        setShowSpecialPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSpecialPicker]);

  useEffect(() => {
    const down = e => {
      if (openMenu && !menuPortalRef.current?.contains(e.target) && !e.target.closest(".textOperationsButton")) setOpenMenu(null);
    };
    document.addEventListener("mousedown", down, true);
    return () => document.removeEventListener("mousedown", down, true);
  }, [openMenu]);

  const openTopMenu = (name, btnRef) => {
    setOpenMenu(prev => prev === name ? null : name);
    if (btnRef.current) setMenuPosition(clampPosition(btnRef.current.getBoundingClientRect()));
  };

  const renderDropdownMenu = (menuName, items) => {
    if (openMenu !== menuName) return null;
    return createPortal(
      <div className="textTextDropdownMenu" ref={menuPortalRef} style={{ top: menuPosition.top, left: menuPosition.left }}>
        {items.map((item, i) => (
          <div className="textTextDropdownMenuItem" key={i} onClick={() => { item.action(); setOpenMenu(null); }}>
            {item.icon && <FontAwesomeIcon icon={item.icon} />}
            {item.text}
          </div>
        ))}
      </div>,
      document.body
    );
  };

  useEffect(() => {
    const down = e => { if (ctxMenu.open && !ctxMenuRef.current?.contains(e.target)) setCtxMenu(c => ({ ...c, open: false })); };
    document.addEventListener("mousedown", down, true);
    return () => document.removeEventListener("mousedown", down, true);
  }, [ctxMenu.open]);

  const openContextMenu = e => {
    e.preventDefault();
    const binds = normalizeBinds(keyBinds);
    const hasSelection = Boolean(window.getSelection()?.toString());
    const items = [
      { icon: faSave, text: "Save", bind: binds.save[0], action: handleSave },
      { icon: faDownload, text: "Download", action: handleDownload },
      { sep: true },
      ...(hasSelection
        ? [
          { icon: faCut, text: "Cut", bind: binds.cut[0], action: handleCut },
          { icon: faCopy, text: "Copy", bind: binds.copy[0], action: handleCopy },
          { icon: faPaste, text: "Paste", bind: binds.paste[0], action: handlePaste },
          { icon: faTrash, text: "Delete Selection", action: handleDeleteSelection }
        ]
        : [
          { icon: faArrowPointer, text: "Select All", bind: binds.selectAll[0], action: handleSelectAll },
          { icon: faPaste, text: "Paste", bind: binds.paste[0], action: handlePaste }
        ]),
      { sep: true },
      { icon: faUndo, text: "Undo", bind: binds.undo[0], action: handleUndo },
      { icon: faRedo, text: "Redo", bind: binds.redo[0], action: handleRedo },
      { sep: true },
      { icon: faSearch, text: "Search / Replace", bind: binds.search[0], action: () => setShowSearchPanel(true) }
    ];
    let x = e.clientX, y = e.clientY;
    setCtxMenu({ open: true, x, y, items });
    requestAnimationFrame(() => {
      const node = ctxMenuRef.current;
      if (node) {
        const w = node.offsetWidth, h = node.offsetHeight;
        if (x + w > window.innerWidth - 8) x = window.innerWidth - w - 8;
        if (y + h > window.innerHeight - 8) y = window.innerHeight - h - 8;
        setCtxMenu(c => ({ ...c, x, y }));
      }
    });
  };

  const allSymbols = useCallback(() => {
    const entries = [];

    mathSymbols.forEach((symbol) => entries.push({ symbol, category: "math", keywords: symbolKeywords(symbol) }));
    latinSymbols.forEach((symbol) => entries.push({ symbol, category: "latin", keywords: symbolKeywords(symbol) }));
    greekSymbols.forEach((symbol, index) => entries.push({ symbol, category: "greek", keywords: symbolKeywords(symbol, index) }));
    punctuationSymbols.forEach((symbol) => entries.push({ symbol, category: "punctuation", keywords: symbolKeywords(symbol) }));

    return entries;
  }, []);

  const paintSketch = useCallback(() => {
    const canvas = drawCanvasRef.current;

    if (!canvas) return;

    const ratio = window.devicePixelRatio || 1;
    const wanted = Math.max(1, Math.round(canvas.clientWidth * ratio));
    const wantedHeight = Math.max(1, Math.round(canvas.clientHeight * ratio));

    if (canvas.clientWidth > 0 && (canvas.width !== wanted || canvas.height !== wantedHeight)) {
      canvas.width = wanted;
      canvas.height = wantedHeight;
    }

    if (!canvas.width || !canvas.height) return;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    const width = canvas.width;
    const height = canvas.height;
    const lineWidth = Math.max(4, Math.round(width * DRAW_STROKE_RATIO));

    context.clearRect(0, 0, width, height);
    context.strokeStyle = "#ebf0f8";
    context.fillStyle = "#ebf0f8";
    context.lineWidth = lineWidth;
    context.lineCap = "round";
    context.lineJoin = "round";

    const strokes = [...drawStrokesRef.current];

    if (drawPointsRef.current.length) strokes.push(drawPointsRef.current);

    for (const stroke of strokes) {
      const points = stroke.map((point) => ({ x: point.x * width, y: point.y * height }));

      if (points.length === 1) {
        context.beginPath();
        context.arc(points[0].x, points[0].y, lineWidth / 2, 0, Math.PI * 2);
        context.fill();
        continue;
      }

      context.beginPath();
      context.moveTo(points[0].x, points[0].y);

      for (let i = 1; i < points.length - 1; i++) {
        const midX = (points[i].x + points[i + 1].x) / 2;
        const midY = (points[i].y + points[i + 1].y) / 2;

        context.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
      }

      context.lineTo(points[points.length - 1].x, points[points.length - 1].y);
      context.stroke();
    }
  }, []);

  const ensureGlyphFeatures = useCallback(() => {
    if (glyphFeaturesRef.current) return glyphFeaturesRef.current;

    const canvas = document.createElement("canvas");

    canvas.width = GLYPH_RENDER_SIZE;
    canvas.height = GLYPH_RENDER_SIZE;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    const catalog = [];
    const seen = new Set();

    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = `${Math.round(GLYPH_RENDER_SIZE * 0.66)}px "Times New Roman", serif`;

    for (const entry of allSymbols()) {
      if (seen.has(entry.symbol)) continue;

      seen.add(entry.symbol);
      context.clearRect(0, 0, GLYPH_RENDER_SIZE, GLYPH_RENDER_SIZE);
      context.fillStyle = "#ffffff";
      context.fillText(entry.symbol, GLYPH_RENDER_SIZE / 2, GLYPH_RENDER_SIZE / 2);

      const features = featuresFromContext(context, GLYPH_RENDER_SIZE, GLYPH_RENDER_SIZE);

      if (features) catalog.push({ symbol: entry.symbol, features });
    }

    glyphFeaturesRef.current = catalog;

    return catalog;
  }, [allSymbols]);

  const recognizeSketch = useCallback(() => {
    const canvas = drawCanvasRef.current;

    if (!canvas) return;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    const drawn = featuresFromContext(context, canvas.width, canvas.height);

    if (!drawn) {
      setDrawMatches([]);
      return;
    }

    setDrawMatches(ensureGlyphFeatures()
      .map((entry) => ({ symbol: entry.symbol, score: featureScore(drawn, entry.features) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, DRAW_MATCH_LIMIT));
  }, [ensureGlyphFeatures]);

  const sizeSketchCanvas = useCallback(() => {
    const canvas = drawCanvasRef.current;

    if (!canvas) return false;

    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(canvas.clientHeight * ratio));

    if (canvas.width === width && canvas.height === height) return false;

    canvas.width = width;
    canvas.height = height;

    return true;
  }, []);

  const sketchPoint = (event) => {
    const rect = drawCanvasRef.current.getBoundingClientRect();

    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height
    };
  };

  const handleSketchDown = (event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    isSketchingRef.current = true;
    drawPointsRef.current = [sketchPoint(event)];
    paintSketch();
  };

  const handleSketchMove = (event) => {
    if (!isSketchingRef.current) return;

    drawPointsRef.current.push(sketchPoint(event));
    paintSketch();
  };

  const handleSketchLeave = () => {
    if (!isSketchingRef.current) return;

    handleSketchUp();
  };

  const handleSketchUp = () => {
    if (!isSketchingRef.current) return;

    isSketchingRef.current = false;

    if (drawPointsRef.current.length) {
      drawStrokesRef.current = [...drawStrokesRef.current, drawPointsRef.current];
      drawPointsRef.current = [];
    }

    paintSketch();

    try {
      recognizeSketch();
    } catch {
      setDrawMatches([]);
    }
  };

  const clearSketch = useCallback(() => {
    drawStrokesRef.current = [];
    drawPointsRef.current = [];
    isSketchingRef.current = false;
    setDrawMatches([]);
    paintSketch();
  }, [paintSketch]);

  const undoSketchStroke = useCallback(() => {
    drawStrokesRef.current = drawStrokesRef.current.slice(0, -1);
    drawPointsRef.current = [];
    paintSketch();

    if (drawStrokesRef.current.length) recognizeSketch();
    else setDrawMatches([]);
  }, [paintSketch]);

  useEffect(() => {
    if (!showSpecialPicker || specialCategory !== "draw" || specialSearch.trim()) return;

    const canvas = drawCanvasRef.current;

    if (!canvas) return;

    const sync = () => {
      if (sizeSketchCanvas()) paintSketch();
    };

    sync();

    const observer = new ResizeObserver(sync);

    observer.observe(canvas);

    return () => observer.disconnect();
  }, [showSpecialPicker, specialCategory, specialSearch, sizeSketchCanvas, paintSketch]);

  const closeSpecialPicker = useCallback(() => {
    setShowSpecialPicker(false);
    setSpecialSearch("");
    clearSketch();
  }, [clearSketch]);

  const insertMath = useCallback((latex) => {
    const editor = editorRef.current;

    if (!editor) return;

    editor.focus();

    try {
      if (richRef.current) {
        document.execCommand("insertHTML", false,
          `<span class="dw-math" data-latex="${escapeXml(latex)}">${escapeXml(`$${latex}$`)}</span>&#8203;`);
      } else {
        document.execCommand("insertText", false, `$${latex}$`);
      }
    } catch { }

    setShowSpecialPicker(false);
    setSpecialSearch("");
    saveToHistory(readEditor());
    debouncedNotifySaveStatus("Unsaved Changes");
  }, [saveToHistory, readEditor, debouncedNotifySaveStatus]);

  const chooseSymbol = useCallback((symbol) => {
    insertSymbol(symbol);
    closeSpecialPicker();
  }, [insertSymbol, closeSpecialPicker]);

  const renderSpecialPicker = () => {
    if (!showSpecialPicker) return null;

    const query = specialSearch.trim().toLowerCase();
    const categories = [
      { value: "math", label: "Math" },
      { value: "latin", label: "Latin" },
      { value: "greek", label: "Greek" },
      { value: "punctuation", label: "Punctuation" },
      { value: "draw", label: "Draw" }
    ];
    const matches = query
      ? allSymbols().filter((entry) => entry.keywords.includes(query))
      : allSymbols().filter((entry) => entry.category === specialCategory);
    const showingSketch = specialCategory === "draw" && !query;

    return createPortal(
      <div className="textTextModalScrim">
        <div ref={specialPickerRef} className="textTextModal">
          <div className="textTextModalHeader">
            <label className="textTextModalTitle">Insert Special Character</label>
            <button className="textTextModalClose" title="Close" onClick={closeSpecialPicker}>
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>

          <div className="textTextModalBody">
            <div className="textTextModalSidebar">
              {categories.map((category) => (
                <button
                  key={category.value}
                  className={specialCategory === category.value && !query ? "textTextModalSidebarItem current" : "textTextModalSidebarItem"}
                  onClick={() => { setSpecialCategory(category.value); setSpecialSearch(""); }}
                >
                  {category.label}
                </button>
              ))}
            </div>

            <div className="textTextModalContent">
              <input
                className="textTextModalSearch"
                type="text"
                value={specialSearch}
                placeholder="Search By Name, Character, Or Code Point"
                onChange={(e) => setSpecialSearch(e.target.value)}
              />

              {showingSketch ? (
                <div className="textTextModalDraw">
                  <div className="textTextDrawCanvasFrame">
                    <canvas
                      ref={drawCanvasRef}
                      onPointerDown={handleSketchDown}
                      onPointerMove={handleSketchMove}
                      onPointerUp={handleSketchUp}
                      onPointerCancel={handleSketchUp}
                    />
                  </div>

                  <div className="textTextModalGrid textTextModalGridShort">
                    {drawMatches.map((match) => (
                      <button
                        key={match.symbol}
                        className="textTextModalCell"
                        title={`${Math.round(match.score * 100)}% Match`}
                        onClick={() => chooseSymbol(match.symbol)}
                      >
                        {match.symbol}
                      </button>
                    ))}
                  </div>

                  <div className="textTextModalFooter">
                    <button className="textTextModalButton" onClick={undoSketchStroke}>
                      <FontAwesomeIcon icon={faUndo} /> Undo Stroke
                    </button>
                    <button className="textTextModalButton" onClick={clearSketch}>
                      <FontAwesomeIcon icon={faTrash} /> Clear
                    </button>
                  </div>
                </div>
              ) : (
                <div className="textTextModalGrid">
                  {matches.length === 0 ? (
                    <label className="textTextModalEmpty">No characters match that search.</label>
                  ) : matches.map((entry, position) => (
                    <button
                      key={`${entry.category}-${entry.symbol}-${position}`}
                      className="textTextModalCell"
                      title={entry.keywords}
                      onClick={() => chooseSymbol(entry.symbol)}
                    >
                      {entry.symbol}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  if (loading) return <div className="loading-wrapper">
                <div className="loading-circle" />
                <label className="loading-title">Loading</label>
            </div>;
  if (error) return <div className="loading-wrapper">
                <label className="loading-title">This File Could Not Be Opened.</label>
                <label className="loading-title">{error}</label>
            </div>;

  const saveBannerText = saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved!" : saveStatus === "failed" ? "Save failed!" : saveStatus === "no-handle" ? "No file handle" : "";

  return (
    <div className="textTextContentWrapper" onContextMenu={openContextMenu}>
      <div className="textTextToolbarWrapper">
        <div className="textTextToolBar">
          <div className="textTextTitleWrapper">
            <div className="textTextFileNameStack">
              <label className="textTextFileNameInput"><FontAwesomeIcon icon={faFile} /> {fileHandle?.name || "Untitled Text"}</label>
              <div className="textTextOperationsButtonsWrapper">
                <button ref={fileBtnRef} className="textTextOperationsButton" onClick={() => openTopMenu("file", fileBtnRef)}>File</button>
                {renderDropdownMenu("file", [
                  { icon: faSave, text: "Save", action: handleSave },
                  { icon: faDownload, text: "Download", action: handleDownload },
                  { icon: faPrint, text: "Print", action: handlePrint },
                  { icon: faRotate, text: "Reload From Disk", action: handleReloadFromDisk },
                  { icon: faCircleInfo, text: "File Information", action: handleFileInformation }
                ])}
                <button ref={editBtnRef} className="textTextOperationsButton" onClick={() => openTopMenu("edit", editBtnRef)}>Edit</button>
                {renderDropdownMenu("edit", [
                  { icon: faUndo, text: "Undo", action: handleUndo },
                  { icon: faRedo, text: "Redo", action: handleRedo },
                  { icon: faCut, text: "Cut", action: handleCut },
                  { icon: faCopy, text: "Copy", action: handleCopy },
                  { icon: faPaste, text: "Paste", action: handlePaste },
                  { icon: faArrowPointer, text: "Select All", action: handleSelectAll },
                  { icon: faTrash, text: "Delete Selection", action: handleDeleteSelection },
                  { icon: faClone, text: "Duplicate Line", action: handleDuplicateLine },
                  { icon: faTrash, text: "Delete Line", action: handleDeleteLine },
                  { icon: faArrowUp, text: "Move Line Up", action: () => moveLine(-1) },
                  { icon: faArrowDown, text: "Move Line Down", action: () => moveLine(1) },
                  { icon: faSearch, text: "Search / Replace", action: () => setShowSearchPanel(true) },
                  { sep: true },
                  { icon: faAnglesUp, text: "Jump To Start", action: () => jumpToEdge("start") },
                  { icon: faAnglesDown, text: "Jump To End", action: () => jumpToEdge("end") },
                  { icon: faLocationCrosshairs, text: "Go To Line", action: goToLine },
                  { icon: faLocationCrosshairs, text: "Current Position", action: handleCurrentPosition }
                ])}
                <button ref={insertBtnRef} className="textTextOperationsButton" onClick={() => openTopMenu("insert", insertBtnRef)}>Insert</button>
                {renderDropdownMenu("insert", [
                  { icon: faIcons, text: "Special Character", action: () => setShowSpecialPicker(true) },
                  { icon: faSquareRootVariable, text: "Equation", action: () => { rememberSelection(); setShowEquationEditor(true); } },
                  { icon: faCalendarDay, text: "Current Date", action: insertDate },
                  { icon: faClock, text: "Current Date And Time", action: insertDateAndTime },
                  { icon: faMinus, text: "Horizontal Rule", action: insertHorizontalRule }
                ])}
                <button ref={formatBtnRef} className="textTextOperationsButton" onClick={() => openTopMenu("format", formatBtnRef)}>Format</button>
                {renderDropdownMenu("format", [
                  { icon: faBold, text: "Bold", action: () => runCommand("bold") },
                  { icon: faItalic, text: "Italic", action: () => runCommand("italic") },
                  { icon: faUnderline, text: "Underline", action: () => runCommand("underline") },
                  { icon: faStrikethrough, text: "Strikethrough", action: () => runCommand("strikeThrough") },
                  { icon: faSuperscript, text: "Superscript", action: () => runCommand("superscript") },
                  { icon: faSubscript, text: "Subscript", action: () => runCommand("subscript") },
                  {
                    icon: faTextHeight, text: "Font Size", action: () => pickInlineValue(
                      "Font Size",
                      "Choose a size for the selected text.",
                      [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72].map((size) => ({ label: `${size} pt`, value: String(size) })),
                      (value) => applyInlineStyle({ fontSize: `${value}pt` })
                    )
                  },
                  {
                    icon: faBold, text: "Font Weight", action: () => pickInlineValue(
                      "Font Weight",
                      "Choose a weight for the selected text.",
                      [["300", "Light"], ["400", "Regular"], ["500", "Medium"], ["600", "Semibold"], ["700", "Bold"], ["800", "Heavy"]]
                        .map(([value, label]) => ({ label, value })),
                      (value) => applyInlineStyle({ fontWeight: value })
                    )
                  },
                  {
                    icon: faFont, text: "Font Family", action: () => pickInlineValue(
                      "Font Family",
                      "Choose a font for the selected text.",
                      ["Aptos", "Calibri", "Cambria", "Georgia", "Helvetica", "Times New Roman", "Courier New", "Arial"]
                        .map((font) => ({ label: font, value: font })),
                      (value) => applyInlineStyle({ fontFamily: value })
                    )
                  },
                  { icon: faFont, text: "Uppercase", action: () => transformRange(value => value.toUpperCase()) },
                  { icon: faFont, text: "Lowercase", action: () => transformRange(value => value.toLowerCase()) },
                  { icon: faTextHeight, text: "Title Case", action: () => transformRange(toTitleCase) },
                  { icon: faBroom, text: "Trim Trailing Whitespace", action: () => transformLines(lines => lines.map(line => line.replace(/[ \t]+$/, ""))) },
                  { icon: faBroom, text: "Remove Blank Lines", action: () => transformLines(lines => lines.filter(line => line.trim() !== "")) },
                  { icon: faBroom, text: "Collapse Blank Lines", action: () => transformRange(value => value.replace(/\n{3,}/g, "\n\n")) },
                  { sep: true },
                  { icon: faSortAlphaDown, text: "Sort Lines A–Z", action: () => transformLines(lines => [...lines].sort((a, b) => a.localeCompare(b))) },
                  { icon: faSortAlphaUp, text: "Sort Lines Z–A", action: () => transformLines(lines => [...lines].sort((a, b) => b.localeCompare(a))) },
                  { icon: faRetweet, text: "Reverse Lines", action: () => transformLines(lines => [...lines].reverse()) },
                  { icon: faBroom, text: "Remove Duplicate Lines", action: () => transformLines(lines => [...new Set(lines)]) }
                ])}
                <button ref={toolsBtnRef} className="textTextOperationsButton" onClick={() => openTopMenu("tools", toolsBtnRef)}>Tools</button>
                {renderDropdownMenu("tools", [
                  { icon: faCalculator, text: "Statistics", action: handleStatistics },
                  { icon: faHashtag, text: "Word Count", action: handleWordCount },
                  { icon: faHashtag, text: "Character Count", action: handleCharacterCount },
                  { icon: faHashtag, text: "Line Count", action: handleLineCount },
                  { icon: faRulerCombined, text: "Document Information", action: handleFileInformation }
                ])}
              </div>
            </div>
          </div>
          <div className="textTextEditingButtonsWrapper">
            <div className="textTextStatusGroup">
              <span className="textTextStatusItem">
                <FontAwesomeIcon icon={faHashtag} />
                <span>{statusCounts.words.toLocaleString()} Words</span>
              </span>
              <span className="textTextStatusItem">
                <FontAwesomeIcon icon={faLocationCrosshairs} />
                <span>{statusPosition}</span>
              </span>
            </div>
            <div className="textTextStatusActions">
              {[
                { icon: faBold, label: "Bold", action: () => runCommand("bold") },
                { icon: faItalic, label: "Italic", action: () => runCommand("italic") },
                { icon: faUnderline, label: "Underline", action: () => runCommand("underline") },
                { icon: faStrikethrough, label: "Strikethrough", action: () => runCommand("strikeThrough") },
                { icon: faSuperscript, label: "Superscript", action: () => runCommand("superscript") },
                { icon: faSubscript, label: "Subscript", action: () => runCommand("subscript") },
                { icon: faBroom, label: "Clear Formatting", action: () => runCommand("removeFormat") }
              ].map((entry) => (
                <Tippy key={entry.label} content={entry.label} theme="tooltip-light">
                  <button className="textTextEditingButton textTextStatusIconButton" onMouseDown={(e) => e.preventDefault()} onClick={entry.action}>
                    <FontAwesomeIcon icon={entry.icon} />
                  </button>
                </Tippy>
              ))}
            </div>
            <div className="textTextStatusActions">
              <Tippy content="Decrease Font Size" theme="tooltip-light">
                <button className="textTextEditingButton textTextStatusIconButton" onMouseDown={(e) => e.preventDefault()} onClick={() => stepFontSize(-1)}>
                  <FontAwesomeIcon icon={faMinus} />
                </button>
              </Tippy>
              <input
                className="textTextSizeInput"
                type="text"
                inputMode="numeric"
                value={fontSizeLabel}
                onChange={(e) => setFontSizeLabel(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
                onBlur={() => commitFontSize(fontSizeLabel)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitFontSize(fontSizeLabel); } }}
              />
              <Tippy content="Increase Font Size" theme="tooltip-light">
                <button className="textTextEditingButton textTextStatusIconButton" onMouseDown={(e) => e.preventDefault()} onClick={() => stepFontSize(1)}>
                  <FontAwesomeIcon icon={faPlus} />
                </button>
              </Tippy>
            </div>

            <div className="textTextStatusActions">
              {[
                { icon: faAlignLeft, label: "Align Left", value: "left" },
                { icon: faAlignCenter, label: "Align Center", value: "center" },
                { icon: faAlignRight, label: "Align Right", value: "right" },
                { icon: faAlignJustify, label: "Justify", value: "justify" }
              ].map((entry) => (
                <Tippy key={entry.value} content={entry.label} theme="tooltip-light">
                  <button
                    className="textTextEditingButton textTextStatusIconButton"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyParagraphStyle({ textAlign: entry.value })}
                  >
                    <FontAwesomeIcon icon={entry.icon} />
                  </button>
                </Tippy>
              ))}
              <Tippy content="Decrease Line Spacing" theme="tooltip-light">
                <button
                  className="textTextEditingButton textTextStatusIconButton"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => stepLineSpacing(-1)}
                >
                  <FontAwesomeIcon icon={faArrowsUpDown} />
                  <span className="textTextStepperSign">&minus;</span>
                </button>
              </Tippy>
              <span className="textTextSpacingValue">{lineSpacing}</span>
              <Tippy content="Increase Line Spacing" theme="tooltip-light">
                <button
                  className="textTextEditingButton textTextStatusIconButton"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => stepLineSpacing(1)}
                >
                  <FontAwesomeIcon icon={faArrowsUpDown} />
                  <span className="textTextStepperSign">+</span>
                </button>
              </Tippy>
            </div>

            <div className="textTextStatusActions">
              <Tippy content="Font Color" theme="tooltip-light">
                <Tippy
                  content={<ColorPicker color={fontColor} onChange={(next) => { setFontColor(next); runCommand("foreColor", next); }} />}
                  visible={isFontColorOpen}
                  onClickOutside={() => setIsFontColorOpen(false)}
                  interactive={true}
                  placement="top"
                  className="color-picker-tippy"
                  appendTo={() => document.body}
                >
                  <label className="textTextEditorColorControl" onMouseDown={(e) => e.preventDefault()} onClick={() => setIsFontColorOpen((prev) => !prev)}>
                    <FontAwesomeIcon icon={faFont} />
                    <span className="textTextEditorColorSwatch" style={{ background: fontColor }} />
                  </label>
                </Tippy>
              </Tippy>
              <Tippy content="Highlight Color" theme="tooltip-light">
                <Tippy
                  content={<ColorPicker color={highlightColor} onChange={(next) => { setHighlightColor(next); runCommand("hiliteColor", next); }} />}
                  visible={isHighlightColorOpen}
                  onClickOutside={() => setIsHighlightColorOpen(false)}
                  interactive={true}
                  placement="top"
                  className="color-picker-tippy"
                  appendTo={() => document.body}
                >
                  <label className="textTextEditorColorControl" onMouseDown={(e) => e.preventDefault()} onClick={() => setIsHighlightColorOpen((prev) => !prev)}>
                    <FontAwesomeIcon icon={faHighlighter} />
                    <span className="textTextEditorColorSwatch" style={{ background: highlightColor }} />
                  </label>
                </Tippy>
              </Tippy>
            </div>
          </div>

        {richRef.current && (() => {
          const page = pageGeometry || DEFAULT_PAGE_GEOMETRY;
          const marks = [];

          for (let position = 0; position <= page.width; position += INDENT_SNAP_POINTS) {
            const isInch = position % POINTS_PER_INCH === 0;
            const inches = Math.round((position - page.left) / POINTS_PER_INCH);

            marks.push(
              <span
                key={`tick-${position}`}
                className={isInch ? "textTextRulerTick major" : "textTextRulerTick"}
                style={{ left: `${position}pt` }}
              />
            );

            if (isInch && inches > 0 && position < page.width - page.right) {
              marks.push(
                <span key={`label-${position}`} className="textTextRulerLabel" style={{ left: `${position}pt` }}>
                  {inches}
                </span>
              );
            }
          }

          return (
            <div className="textTextRuler" style={{ maxWidth: `${page.width}pt` }}>
              <div className="textTextRulerMargin" style={{ width: `${page.left}pt` }} />
              <div className="textTextRulerMargin right" style={{ width: `${page.right}pt` }} />
              {marks}
              <span
                className="textTextRulerHandle first"
                title="First Line Indent"
                style={{ left: `${page.left + indents.left + indents.first}pt` }}
                onPointerDown={startIndentDrag("first")}
                onPointerMove={moveIndentDrag}
                onPointerUp={endIndentDrag}
                onPointerCancel={endIndentDrag}
              />
              <span
                className="textTextRulerHandle left"
                title="Left Indent"
                style={{ left: `${page.left + indents.left}pt` }}
                onPointerDown={startIndentDrag("left")}
                onPointerMove={moveIndentDrag}
                onPointerUp={endIndentDrag}
                onPointerCancel={endIndentDrag}
              />
              <span
                className="textTextRulerHandle right"
                title="Right Indent"
                style={{ left: `${page.width - page.right - indents.right}pt` }}
                onPointerDown={startIndentDrag("right")}
                onPointerMove={moveIndentDrag}
                onPointerUp={endIndentDrag}
                onPointerCancel={endIndentDrag}
              />
            </div>
          );
        })()}
        </div>
      </div>

      {documentStyleSheet && <style>{documentStyleSheet}</style>}

      <div className="textTextContent" ref={contentRef}>

        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          suppressContentEditableWarning={true}
          className={`textTextEditor${richRef.current ? " textTextEditorRich" : ""}`}
          style={richRef.current ? {
            maxWidth: `${(pageGeometry || DEFAULT_PAGE_GEOMETRY).width}pt`,
            minHeight: `${(pageGeometry || DEFAULT_PAGE_GEOMETRY).height}pt`,
            paddingTop: `${(pageGeometry || DEFAULT_PAGE_GEOMETRY).top}pt`,
            paddingRight: `${(pageGeometry || DEFAULT_PAGE_GEOMETRY).right}pt`,
            paddingBottom: `${(pageGeometry || DEFAULT_PAGE_GEOMETRY).bottom}pt`,
            paddingLeft: `${(pageGeometry || DEFAULT_PAGE_GEOMETRY).left}pt`
          } : undefined}
          data-placeholder="Start typing..."
        />
      </div>

      {showEquationEditor && createPortal(
        <div className="textTextModalScrim">
          <div className="textTextModal textTextModalWide">
            <div className="textTextModalHeader">
              <label className="textTextModalTitle">Insert Equation</label>
              <button
                className="textTextModalClose"
                title="Close"
                onClick={() => { setShowEquationEditor(false); setEquationSource(""); setEquationMenu(null); }}
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <div className="textTextModalBody">
              <div className="textTextModalSidebar">
                {EQUATION_PALETTES.map((palette) => (
                  <button
                    key={palette.key}
                    className={(equationMenu || "structures") === palette.key ? "textTextModalSidebarItem current" : "textTextModalSidebarItem"}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setEquationMenu(palette.key)}
                  >
                    <span className="textTextModalSidebarGlyph">{palette.glyph}</span>
                    {palette.label}
                  </button>
                ))}
              </div>

              <div className="textTextModalContent">
                <div className="textTextModalGrid textTextModalTemplateGrid">
                  {(EQUATION_PALETTES.find((palette) => palette.key === (equationMenu || "structures"))?.entries || [])
                    .map(equationPaletteEntry)
                    .map((entry) => (
                      <button
                        key={`${entry.insert}-${entry.glyph}`}
                        className="textTextModalCell textTextModalTemplate"
                        title={entry.insert}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => appendEquationSnippet(entry.insert)}
                        dangerouslySetInnerHTML={{ __html: mathmlFromLatex(entry.insert) }}
                      />
                    ))}
                </div>

                <div className="textTextModalPreview">
                  <div dangerouslySetInnerHTML={{ __html: equationSource.trim() ? mathmlFromLatex(equationSource) : "" }} />
                </div>

                <div className="textTextModalFooter">
                  <input
                    ref={equationInputRef}
                    className="textTextModalSearch textTextModalSource"
                    type="text"
                    value={equationSource}
                    spellCheck={false}
                    placeholder="Pick A Structure, Then Fill Each Box"
                    onChange={(e) => setEquationSource(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Tab") {
                        e.preventDefault();
                        selectNextPlaceholder(e.shiftKey ? -1 : 1);
                        return;
                      }

                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitEquation();
                      }
                    }}
                  />
                  <Tippy content="Next Box" theme="tooltip-light">
                    <button className="textTextModalButton" onMouseDown={(e) => e.preventDefault()} onClick={() => selectNextPlaceholder(1)}>
                      <FontAwesomeIcon icon={faArrowRight} /> Next Box
                    </button>
                  </Tippy>
                  <button className="textTextModalButton" onClick={() => setEquationSource("")}>
                    <FontAwesomeIcon icon={faTrash} /> Clear
                  </button>
                  <button className="textTextModalButton textTextModalButtonPrimary" onClick={commitEquation}>
                    <FontAwesomeIcon icon={faSquareRootVariable} /> Insert
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showSearchPanel && (
        <div
          ref={searchPanelRef}
          className="textTextEditingSearchBoxWrapper"
          style={{ position: "absolute", top: searchPanelPos.y - 80, left: searchPanelPos.x, zIndex: 10 }}
          onMouseDown={startSearchDrag}
        >
          <div className="textTextEditingSearchHeader">
            <label className="textTextEditingSearchTitle">Search And Replace</label>
            <button
              className="textTextEditingSearchClose"
              title="Close"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => { setShowSearchPanel(false); setSearchResults([]); setCurrentResultIndex(-1); }}
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
          <div className="textTextEditngSearchBarWrapper">
            <label className="textTextEditingSearchLabel">Search: <span><input className="textSettingsCheckbox" type="checkbox" checked={caseSensitive} onChange={e => setCaseSensitive(e.target.checked)} />Case Sensitive</span></label>
            <input className="textTextEditingSearchInput" type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            <div className="textTextEditingSearchOperationsButtonWrapper">
              <button className="textTextEditingSearchOperationsButton" onClick={() => findAllMatches(searchTerm)}>Search</button>
              <button className="textTextEditingSearchOperationsButton" onClick={goToPrevious}>Prev</button>
              <button className="textTextEditingSearchOperationsButton" onClick={goToNext}>Next</button>
            </div>
          </div>
          <div className="textTextEditngSearchBarWrapper">
            <label className="textTextEditingSearchLabel">Replace:</label>
            <input className="textTextEditingSearchInput" type="text" value={replaceTerm} onChange={e => setReplaceTerm(e.target.value)} />
            <div className="textTextEditingSearchOperationsButtonWrapper">
              <button className="textTextEditingSearchOperationsButton" onClick={replaceCurrent}>Replace</button>
              <button className="textTextEditingSearchOperationsButton" onClick={replaceAll}>Replace All</button>
            </div>
          </div>

        </div>
      )}
      {ctxMenu.open && createPortal(
        <div
          ref={attachPopover(ctxMenuRef)}
          popover="manual"
          className="textContextMenu"
          style={{ position: "fixed", left: ctxMenu.x, top: ctxMenu.y }}
          onClick={e => e.stopPropagation()}
        >
          {ctxMenu.items.map((it, i) => it.sep ? (
            <div key={`textContextSeparator-${i}`} className="textContextMenuSeparator" />
          ) : (
            <div key={`textContextItem-${i}`} className="textContextMenuItem" onClick={() => { setCtxMenu(c => ({ ...c, open: false })); it.action(); }}>
              <span className="textContextMenuItemLabel">
                {it.icon && <FontAwesomeIcon icon={it.icon} />}
                {it.text}
              </span>
              {it.bind && <span className="textContextMenuItemBind">{bindLabel(it.bind)}</span>}
            </div>
          ))}
        </div>,
        document.body
      )}
      {renderSpecialPicker()}
      {saveBannerText && <div className="codeSaveStatusIndicator" style={{ zIndex: 10003 }}>{saveBannerText}</div>}
    </div>
  );
}