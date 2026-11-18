import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFile, faSave, faDownload, faPrint, faCircleInfo, faTrash, faClone,
  faArrowUp, faArrowDown, faPlus, faUndo, faRedo, faBold, faItalic,
  faUnderline, faAlignLeft, faAlignCenter, faAlignRight, faFont, faMinus,
  faPlay, faXmark, faAngleLeft, faAngleRight, faTableCells, faFileCirclePlus, faImage,
  faTextHeight
} from "@fortawesome/free-solid-svg-icons";
import Tippy from "@tippyjs/react";
import ColorPicker from "../../../../helpers/ColorPicker.jsx";
import { showDialog } from "../../../../helpers/Alert.jsx";
import "../../../../styles/mainStyles/Studio/Documents/Slides/Slides.css";

const SAVE_BANNER_TIMEOUT_MS = 3000;
const MENU_WIDTH = 240;
const MENU_HEIGHT = 320;
const MENU_OFFSET = 6;
const WINDOW_EDGE_PADDING = 8;
const EMU_PER_POINT = 12700;
const DEFAULT_SLIDE_WIDTH = 9144000;
const DEFAULT_SLIDE_HEIGHT = 6858000;
const HISTORY_LIMIT = 80;
const HISTORY_DELAY_MS = 300;
const FONT_SIZE_LADDER = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 54, 66, 80, 96];
const SLIDE_RAIL_WIDTH = 168;

const PRESENTATION_EXTENSIONS = ["pptx", "potx", "ppsx", "pptm", "potm", "ppsm"];
const RESIZE_HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const MINIMUM_SHAPE_EMU = 228600;

const IMAGE_MIME_TYPES = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  bmp: "image/bmp", svg: "image/svg+xml", webp: "image/webp", tif: "image/tiff", tiff: "image/tiff"
};

const SLIDE_TEMPLATES = [
  {
    key: "title",
    label: "Title Slide",
    build: (width, height) => [
      textShape("Title", "Presentation Title", width * 0.1, height * 0.32, width * 0.8, height * 0.18, 44, "ctr", true),
      textShape("Subtitle", "Subtitle Or Author", width * 0.1, height * 0.53, width * 0.8, height * 0.1, 22, "ctr", false)
    ]
  },
  {
    key: "titleContent",
    label: "Title And Content",
    build: (width, height) => [
      textShape("Title", "Slide Title", width * 0.08, height * 0.08, width * 0.84, height * 0.15, 36, "l", true),
      textShape("Content", "Add your first point here", width * 0.08, height * 0.28, width * 0.84, height * 0.58, 20, "l", false)
    ]
  },
  {
    key: "twoContent",
    label: "Two Content",
    build: (width, height) => [
      textShape("Title", "Slide Title", width * 0.08, height * 0.08, width * 0.84, height * 0.15, 36, "l", true),
      textShape("Left", "Left column", width * 0.08, height * 0.28, width * 0.4, height * 0.58, 18, "l", false),
      textShape("Right", "Right column", width * 0.52, height * 0.28, width * 0.4, height * 0.58, 18, "l", false)
    ]
  },
  {
    key: "section",
    label: "Section Header",
    build: (width, height) => [
      textShape("Section", "Section Title", width * 0.1, height * 0.4, width * 0.8, height * 0.16, 40, "l", true),
      textShape("Description", "Short description of this section", width * 0.1, height * 0.58, width * 0.8, height * 0.12, 18, "l", false)
    ]
  },
  {
    key: "comparison",
    label: "Comparison",
    build: (width, height) => [
      textShape("Title", "Comparison", width * 0.08, height * 0.08, width * 0.84, height * 0.13, 36, "l", true),
      textShape("LeftHeading", "Option A", width * 0.08, height * 0.26, width * 0.4, height * 0.09, 22, "ctr", true),
      textShape("RightHeading", "Option B", width * 0.52, height * 0.26, width * 0.4, height * 0.09, 22, "ctr", true),
      textShape("LeftBody", "Details", width * 0.08, height * 0.38, width * 0.4, height * 0.46, 18, "l", false),
      textShape("RightBody", "Details", width * 0.52, height * 0.38, width * 0.4, height * 0.46, 18, "l", false)
    ]
  },
  {
    key: "picture",
    label: "Picture With Caption",
    build: (width, height) => [
      textShape("Title", "Picture Title", width * 0.08, height * 0.08, width * 0.84, height * 0.13, 32, "l", true),
      textShape("Caption", "Caption text for the picture", width * 0.08, height * 0.78, width * 0.84, height * 0.1, 16, "l", false)
    ]
  },
  { key: "titleOnly", label: "Title Only", build: (width, height) => [textShape("Title", "Slide Title", width * 0.08, height * 0.08, width * 0.84, height * 0.15, 36, "l", true)] },
  { key: "blank", label: "Blank", build: () => [] }
];

function textShape(name, text, x, y, width, height, size, align, bold) {
  return {
    id: createShapeId(),
    kind: "text",
    name,
    placeholder: null,
    x,
    y,
    width,
    height,
    fill: null,
    paragraphs: [{ align, level: 0, runs: [{ text, bold, italic: false, underline: false, size, font: null, color: null }] }]
  };
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

function clampMenuPosition(rect, width = MENU_WIDTH, height = MENU_HEIGHT, offset = MENU_OFFSET) {
  let top = rect.bottom + offset;
  let left = rect.left;

  if (left + width > window.innerWidth - WINDOW_EDGE_PADDING) {
    left = Math.max(WINDOW_EDGE_PADDING, window.innerWidth - width - WINDOW_EDGE_PADDING);
  }

  if (top + height > window.innerHeight - WINDOW_EDGE_PADDING) {
    top = Math.max(WINDOW_EDGE_PADDING, rect.top - height - offset);
  }

  return { top, left };
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function localChildren(node, name) {
  if (!node) return [];

  return [...node.children].filter((child) => child.localName === name);
}

function localChild(node, name) {
  return localChildren(node, name)[0] || null;
}

function descendant(node, name) {
  if (!node) return null;

  for (const child of node.getElementsByTagName("*")) {
    if (child.localName === name) return child;
  }

  return null;
}

function createShapeId() {
  return `shape-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function pictureXml(shape, index, relationshipId) {
  if (shape.raw) {
    return shape.raw
      .replace(/<a:off x="-?\d+" y="-?\d+"\/>/, `<a:off x="${Math.round(shape.x)}" y="${Math.round(shape.y)}"/>`)
      .replace(/<a:ext cx="\d+" cy="\d+"\/>/, `<a:ext cx="${Math.round(shape.width)}" cy="${Math.round(shape.height)}"/>`)
      .replace(/r:embed="[^"]*"/, `r:embed="${relationshipId}"`);
  }

  return [
    "<p:pic>",
    `<p:nvPicPr><p:cNvPr id="${index + 2}" name="${escapeXml(shape.name)}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>`,
    `<p:blipFill><a:blip r:embed="${relationshipId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>`,
    `<p:spPr>${xfrmXml(shape)}`,
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>',
    "</p:pic>"
  ].join("");
}

const SCHEME_ALIASES = { tx1: "dk1", bg1: "lt1", tx2: "dk2", bg2: "lt2" };

function parseThemeColors(xml) {
  const colors = {};

  if (!xml) return colors;

  const document = new DOMParser().parseFromString(xml, "application/xml");
  const scheme = descendant(document.documentElement, "clrScheme");

  if (!scheme) return colors;

  for (const entry of scheme.children) {
    const srgb = descendant(entry, "srgbClr");
    const sys = descendant(entry, "sysClr");
    const value = srgb ? srgb.getAttribute("val") : sys ? (sys.getAttribute("lastClr") || (sys.getAttribute("val") === "window" ? "FFFFFF" : "000000")) : null;

    if (value) colors[entry.localName] = `#${value.toUpperCase()}`;
  }

  return colors;
}

function adjustedHex(hex, colorNode) {
  const modifiers = {};

  for (const child of colorNode.children) {
    if (["lumMod", "lumOff", "shade", "tint"].includes(child.localName)) {
      modifiers[child.localName] = Number(child.getAttribute("val")) / 100000;
    }
  }

  if (!Object.keys(modifiers).length) return hex;

  let channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));

  if (modifiers.shade != null) channels = channels.map((value) => value * modifiers.shade);
  if (modifiers.tint != null) channels = channels.map((value) => value * modifiers.tint + 255 * (1 - modifiers.tint));
  if (modifiers.lumMod != null) channels = channels.map((value) => value * modifiers.lumMod);
  if (modifiers.lumOff != null) channels = channels.map((value) => value + 255 * modifiers.lumOff);

  return `#${channels.map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0").toUpperCase()).join("")}`;
}

function resolveColorNode(colorNode, theme) {
  if (!colorNode) return null;

  if (colorNode.localName === "srgbClr") return adjustedHex(`#${colorNode.getAttribute("val").toUpperCase()}`, colorNode);

  if (colorNode.localName === "sysClr") {
    const value = colorNode.getAttribute("lastClr") || (colorNode.getAttribute("val") === "window" ? "FFFFFF" : "000000");

    return adjustedHex(`#${value.toUpperCase()}`, colorNode);
  }

  if (colorNode.localName === "schemeClr") {
    const name = colorNode.getAttribute("val");
    const base = (theme || {})[name] || (theme || {})[SCHEME_ALIASES[name]] || (name === "bg1" ? "#FFFFFF" : name === "tx1" ? "#000000" : null);

    return base ? adjustedHex(base, colorNode) : null;
  }

  return null;
}

function solidFillColor(node, theme) {
  const fill = descendant(node, "solidFill");

  if (!fill) return null;

  for (const child of fill.children) {
    const resolved = resolveColorNode(child, theme);

    if (resolved) return resolved;
  }

  return null;
}

function parseSlideBackground(xml, theme) {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  const slideRoot = document.documentElement;
  const commonSlide = descendant(slideRoot, "cSld");
  const background = commonSlide ? localChild(commonSlide, "bg") : null;

  if (!background) return null;

  const properties = localChild(background, "bgPr");

  if (properties) return solidFillColor(properties, theme);

  const reference = localChild(background, "bgRef");

  if (!reference) return null;

  for (const child of reference.children) {
    const resolved = resolveColorNode(child, theme);

    if (resolved) return resolved;
  }

  return null;
}

function parseFill(node, theme) {
  if (!node) return { color: null, gradient: null };

  for (const child of node.children) {
    if (child.localName === "noFill") return { color: null, gradient: null };

    if (child.localName === "solidFill") {
      for (const value of child.children) {
        const resolved = resolveColorNode(value, theme);

        if (resolved) return { color: resolved, gradient: null };
      }
    }

    if (child.localName === "gradFill") {
      const stops = [];
      const list = localChild(child, "gsLst");

      for (const stop of list ? localChildren(list, "gs") : []) {
        let color = null;

        for (const value of stop.children) {
          color = resolveColorNode(value, theme);

          if (color) break;
        }

        if (color) stops.push({ position: Number(stop.getAttribute("pos") || 0) / 100000, color });
      }

      stops.sort((left, right) => left.position - right.position);

      const linear = localChild(child, "lin");
      const angle = linear?.getAttribute("ang") ? Number(linear.getAttribute("ang")) / 60000 : 0;

      if (stops.length >= 2) return { color: stops[0].color, gradient: { angle, stops } };
      if (stops.length === 1) return { color: stops[0].color, gradient: null };
    }
  }

  return { color: null, gradient: null };
}

function parseOutline(node, theme) {
  const line = node ? localChild(node, "ln") : null;

  if (!line) return null;

  if (localChild(line, "noFill")) return null;

  const fill = parseFill(line, theme);

  if (!fill.color) return null;

  const width = line.getAttribute("w") ? Number(line.getAttribute("w")) / EMU_PER_POINT : 0.75;

  return { color: fill.color, width };
}

function parseRunProperties(node, theme) {
  if (!node) return {};

  const out = {};

  if (node.getAttribute("b") != null) out.bold = node.getAttribute("b") === "1";
  if (node.getAttribute("i") != null) out.italic = node.getAttribute("i") === "1";
  if (node.getAttribute("u") != null) out.underline = node.getAttribute("u") !== "none";
  if (node.getAttribute("strike") != null) out.strike = node.getAttribute("strike") !== "noStrike";
  if (node.getAttribute("sz") != null) out.size = Number(node.getAttribute("sz")) / 100;
  if (node.getAttribute("spc") != null) out.spacing = Number(node.getAttribute("spc")) / 100;

  const latin = descendant(node, "latin");

  if (latin?.getAttribute("typeface")) out.font = latin.getAttribute("typeface");

  const color = solidFillColor(node, theme);

  if (color) out.color = color;

  return out;
}

function parseParagraphLevel(node, theme) {
  if (!node) return {};

  const out = {};

  if (node.getAttribute("marL") != null) out.marL = Number(node.getAttribute("marL"));
  if (node.getAttribute("indent") != null) out.hang = Number(node.getAttribute("indent"));
  if (node.getAttribute("algn")) out.align = node.getAttribute("algn");

  const bulletNode = [...node.children].find((child) => ["buChar", "buAutoNum", "buNone"].includes(child.localName));

  if (bulletNode) {
    out.bullet = bulletNode.localName === "buNone" ? "none" : bulletNode.localName === "buAutoNum" ? "auto" : bulletNode.getAttribute("char") || "\u2022";
  }

  const defaults = localChild(node, "defRPr");

  if (defaults) out.runDefaults = parseRunProperties(defaults, theme);

  return out;
}

function parseBodyProperties(textBody) {
  const body = textBody ? localChild(textBody, "bodyPr") : null;
  const inset = (name, fallback) => body?.getAttribute(name) != null ? Number(body.getAttribute(name)) : fallback;

  return {
    anchor: body?.getAttribute("anchor") || "t",
    insets: {
      left: inset("lIns", 91440),
      top: inset("tIns", 45720),
      right: inset("rIns", 91440),
      bottom: inset("bIns", 45720)
    }
  };
}

function parseListLevels(textBody, theme) {
  const levels = {};
  const list = textBody ? localChild(textBody, "lstStyle") : null;

  if (!list) return levels;

  for (const child of list.children) {
    const match = child.localName.match(/^lvl(\d)pPr$/);

    if (match) levels[Number(match[1]) - 1] = parseParagraphLevel(child, theme);
  }

  return levels;
}

function parseTransform(propertiesNode) {
  const transform = propertiesNode ? localChild(propertiesNode, "xfrm") : null;
  const offset = transform ? localChild(transform, "off") : null;
  const extent = transform ? localChild(transform, "ext") : null;
  const childOffset = transform ? localChild(transform, "chOff") : null;
  const childExtent = transform ? localChild(transform, "chExt") : null;

  return {
    x: offset ? Number(offset.getAttribute("x")) : 0,
    y: offset ? Number(offset.getAttribute("y")) : 0,
    width: extent ? Number(extent.getAttribute("cx")) : 0,
    height: extent ? Number(extent.getAttribute("cy")) : 0,
    rot: transform?.getAttribute("rot") ? Number(transform.getAttribute("rot")) / 60000 : 0,
    flipH: transform?.getAttribute("flipH") === "1",
    flipV: transform?.getAttribute("flipV") === "1",
    childX: childOffset ? Number(childOffset.getAttribute("x")) : null,
    childY: childOffset ? Number(childOffset.getAttribute("y")) : null,
    childWidth: childExtent ? Number(childExtent.getAttribute("cx")) : null,
    childHeight: childExtent ? Number(childExtent.getAttribute("cy")) : null
  };
}

function mapFrame(frame, group) {
  if (!group) return frame;

  const scaleX = group.childWidth ? group.width / group.childWidth : 1;
  const scaleY = group.childHeight ? group.height / group.childHeight : 1;

  return {
    ...frame,
    x: group.x + (frame.x - (group.childX ?? group.x)) * scaleX,
    y: group.y + (frame.y - (group.childY ?? group.y)) * scaleY,
    width: frame.width * scaleX,
    height: frame.height * scaleY,
    rot: frame.rot + group.rot,
    flipH: frame.flipH !== group.flipH,
    flipV: frame.flipV !== group.flipV
  };
}

function parseParagraphNode(paragraph, theme, levelDefaults) {
  const properties2 = localChild(paragraph, "pPr");
  const level = Number(properties2?.getAttribute("lvl") || 0);
  const levelDefault = levelDefaults[level] || {};
  const paragraphDefault = properties2 ? parseRunProperties(localChild(properties2, "defRPr"), theme) : {};
  const baseRun = { text: "", break: false, bold: false, italic: false, underline: false, strike: false, size: null, spacing: null, font: null, color: null, ...(levelDefault.runDefaults || {}), ...paragraphDefault };
  const runs = [];

  for (const child of paragraph.children) {
    if (child.localName === "r" || child.localName === "fld") {
      const runProperties = localChild(child, "rPr");
      const text = localChild(child, "t");

      runs.push({ ...baseRun, ...parseRunProperties(runProperties, theme), text: text ? text.textContent : "" });
    } else if (child.localName === "br") {
      runs.push({ ...baseRun, text: "", break: true });
    }
  }

  const direct = properties2 ? parseParagraphLevel(properties2, theme) : {};
  const spacingPoints = (name) => {
    const node = properties2 ? localChild(properties2, name) : null;
    const points = node ? localChild(node, "spcPts") : null;
    const value = points ? Number(points.getAttribute("val")) : null;

    return Number.isFinite(value) && value !== null ? value / 100 : 0;
  };
  const lineNode = properties2 ? localChild(properties2, "lnSpc") : null;
  const linePercent = lineNode ? localChild(lineNode, "spcPct") : null;
  const lineValue = linePercent ? Number(linePercent.getAttribute("val")) : null;

  if (!runs.length) {
    const ending = localChild(paragraph, "endParaRPr");

    runs.push({ ...baseRun, ...parseRunProperties(ending, theme) });
  }

  return {
    align: direct.align ?? levelDefault.align ?? "l",
    level,
    marL: direct.marL ?? levelDefault.marL ?? null,
    hang: direct.hang ?? levelDefault.hang ?? null,
    bullet: direct.bullet ?? levelDefault.bullet ?? null,
    spaceBefore: spacingPoints("spcBef"),
    spaceAfter: spacingPoints("spcAft"),
    lineSpacing: Number.isFinite(lineValue) && lineValue !== null ? lineValue / 100000 : null,
    runs
  };
}

function parseSlideShapes(xml, theme) {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  const tree = descendant(document.documentElement, "spTree");
  const shapes = [];

  if (tree) collectShapes(tree, theme, shapes, null);

  return shapes;
}

function collectShapes(container, theme, shapes, group) {
  for (const node of container.children) {
    if (node.localName === "grpSp") {
      const groupFrame = mapFrame(parseTransform(localChild(node, "grpSpPr")), group);

      collectShapes(node, theme, shapes, groupFrame);
      continue;
    }

    if (node.localName === "pic") {
      const properties = localChild(node, "spPr");
      const frame = mapFrame(parseTransform(properties), group);
      const nonVisual = localChild(node, "nvPicPr");
      const shapeProperties = nonVisual ? localChild(nonVisual, "cNvPr") : null;
      const blip = descendant(node, "blip");
      const embed = blip ? (blip.getAttribute("r:embed") || blip.getAttributeNS("*", "embed")) : null;

      shapes.push({
        id: shapeProperties?.getAttribute("id") ? `picture-${shapeProperties.getAttribute("id")}-${shapes.length}` : createShapeId(),
        kind: "picture",
        name: shapeProperties?.getAttribute("name") || "Picture",
        placeholder: null,
        embed,
        x: frame.x,
        y: frame.y,
        width: frame.width,
        height: frame.height,
        rot: frame.rot,
        flipH: frame.flipH,
        flipV: frame.flipV,
        fill: null,
        gradient: null,
        outline: parseOutline(properties, theme),
        raw: node.outerHTML,
        paragraphs: []
      });
      continue;
    }

    if (node.localName === "graphicFrame") {
      const shapeProperties = descendant(localChild(node, "nvGraphicFramePr") || node, "cNvPr");
      const transform = localChild(node, "xfrm");
      const offset = transform ? localChild(transform, "off") : null;
      const extent = transform ? localChild(transform, "ext") : null;
      const frame = mapFrame({
        x: offset ? Number(offset.getAttribute("x")) : 0,
        y: offset ? Number(offset.getAttribute("y")) : 0,
        width: extent ? Number(extent.getAttribute("cx")) : 0,
        height: extent ? Number(extent.getAttribute("cy")) : 0,
        rot: 0,
        flipH: false,
        flipV: false
      }, group);
      const table = descendant(node, "tbl");

      if (table) {
        const columns = (localChild(table, "tblGrid") ? localChildren(localChild(table, "tblGrid"), "gridCol") : []).map((column) => Number(column.getAttribute("w") || 0));
        const rows = localChildren(table, "tr").map((row) => ({
          height: Number(row.getAttribute("h") || 0),
          cells: localChildren(row, "tc").map((cell) => {
            const cellProperties = localChild(cell, "tcPr");
            const fill = parseFill(cellProperties, theme);
            const body = localChild(cell, "txBody");

            return {
              span: Number(cell.getAttribute("gridSpan") || 1),
              merged: cell.getAttribute("hMerge") === "1" || cell.getAttribute("vMerge") === "1",
              fill: fill.color,
              paragraphs: body ? localChildren(body, "p").map((paragraph) => parseParagraphNode(paragraph, theme, {})) : []
            };
          })
        }));

        shapes.push({
          id: shapeProperties?.getAttribute("id") ? `table-${shapeProperties.getAttribute("id")}-${shapes.length}` : createShapeId(),
          kind: "table",
          name: shapeProperties?.getAttribute("name") || "Table",
          placeholder: null,
          x: frame.x,
          y: frame.y,
          width: frame.width,
          height: frame.height,
          rot: frame.rot,
          flipH: false,
          flipV: false,
          fill: null,
          gradient: null,
          outline: null,
          columns,
          rows,
          raw: node.outerHTML,
          paragraphs: []
        });
      } else {
        shapes.push({
          id: shapeProperties?.getAttribute("id") ? `frame-${shapeProperties.getAttribute("id")}-${shapes.length}` : createShapeId(),
          kind: "frame",
          name: shapeProperties?.getAttribute("name") || "Graphic",
          placeholder: null,
          x: frame.x,
          y: frame.y,
          width: frame.width,
          height: frame.height,
          rot: frame.rot,
          flipH: false,
          flipV: false,
          fill: null,
          gradient: null,
          outline: null,
          raw: node.outerHTML,
          paragraphs: []
        });
      }
      continue;
    }

    if (node.localName !== "sp") continue;

    const properties = localChild(node, "spPr");
    const frame = mapFrame(parseTransform(properties), group);
    const textBody = localChild(node, "txBody");
    const nonVisual = localChild(node, "nvSpPr");
    const shapeProperties = nonVisual ? localChild(nonVisual, "cNvPr") : null;
    const placeholder = nonVisual ? descendant(nonVisual, "ph") : null;
    const geometryNode = properties ? localChild(properties, "prstGeom") : null;
    const body = parseBodyProperties(textBody);
    const levelDefaults = parseListLevels(textBody, theme);
    const fill = parseFill(properties, theme);
    const paragraphs = textBody ? localChildren(textBody, "p").map((paragraph) => parseParagraphNode(paragraph, theme, levelDefaults)) : [];

    shapes.push({
      id: shapeProperties?.getAttribute("id") ? `shape-${shapeProperties.getAttribute("id")}-${shapes.length}` : createShapeId(),
      kind: "text",
      name: shapeProperties?.getAttribute("name") || "Shape",
      placeholder: placeholder?.getAttribute("type") || null,
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
      rot: frame.rot,
      flipH: frame.flipH,
      flipV: frame.flipV,
      fill: fill.color,
      gradient: fill.gradient,
      outline: parseOutline(properties, theme),
      geometry: geometryNode?.getAttribute("prst") || "rect",
      anchor: body.anchor,
      insets: body.insets,
      paragraphs: paragraphs.length ? paragraphs : [{ align: "l", level: 0, marL: null, hang: null, bullet: null, spaceBefore: 0, spaceAfter: 0, lineSpacing: null, runs: [{ text: "", break: false, bold: false, italic: false, underline: false, strike: false, size: null, spacing: null, font: null, color: null }] }]
    });
  }
}

function shapeFillCss(shape) {
  if (shape.gradient && shape.gradient.stops?.length >= 2) {
    const stops = shape.gradient.stops.map((stop) => `${stop.color} ${Math.round(stop.position * 100)}%`).join(", ");

    return `linear-gradient(${Math.round((shape.gradient.angle + 90) % 360)}deg, ${stops})`;
  }

  return shape.fill || "transparent";
}

function runXml(run) {
  if (run.break) return "<a:br/>";

  const properties = [`lang="en-US"`, `dirty="0"`];

  if (run.bold) properties.push(`b="1"`);
  if (run.italic) properties.push(`i="1"`);
  if (run.underline) properties.push(`u="sng"`);
  if (run.strike) properties.push(`strike="sngStrike"`);
  if (run.size) properties.push(`sz="${Math.round(run.size * 100)}"`);
  if (run.spacing) properties.push(`spc="${Math.round(run.spacing * 100)}"`);

  const children = [];

  if (run.color) children.push(`<a:solidFill><a:srgbClr val="${run.color.replace("#", "").toUpperCase()}"/></a:solidFill>`);
  if (run.font) children.push(`<a:latin typeface="${escapeXml(run.font)}"/>`);

  const runProperties = children.length
    ? `<a:rPr ${properties.join(" ")}>${children.join("")}</a:rPr>`
    : `<a:rPr ${properties.join(" ")}/>`;

  return `<a:r>${runProperties}<a:t>${escapeXml(run.text)}</a:t></a:r>`;
}

function shapeTextBodyXml(shape) {
  const paragraphs = shape.paragraphs.map((paragraph) => {
    const attributes = [];

    if (paragraph.marL != null) attributes.push(`marL="${Math.round(paragraph.marL)}"`);
    if (paragraph.hang != null) attributes.push(`indent="${Math.round(paragraph.hang)}"`);
    if (paragraph.align && paragraph.align !== "l") attributes.push(`algn="${paragraph.align}"`);
    if (paragraph.level) attributes.push(`lvl="${paragraph.level}"`);

    const children = [];

    if (paragraph.lineSpacing) children.push(`<a:lnSpc><a:spcPct val="${Math.round(paragraph.lineSpacing * 100000)}"/></a:lnSpc>`);
    if (paragraph.spaceBefore) children.push(`<a:spcBef><a:spcPts val="${Math.round(paragraph.spaceBefore * 100)}"/></a:spcBef>`);
    if (paragraph.spaceAfter) children.push(`<a:spcAft><a:spcPts val="${Math.round(paragraph.spaceAfter * 100)}"/></a:spcAft>`);
    if (paragraph.bullet === "none") children.push("<a:buNone/>");
    else if (paragraph.bullet === "auto") children.push('<a:buAutoNum type="arabicPeriod"/>');
    else if (paragraph.bullet) children.push(`<a:buChar char="${escapeXml(paragraph.bullet)}"/>`);

    const properties = attributes.length || children.length
      ? (children.length ? `<a:pPr ${attributes.join(" ")}>${children.join("")}</a:pPr>` : `<a:pPr ${attributes.join(" ")}/>`)
      : "";
    const runs = paragraph.runs.filter((run) => run.text !== undefined).map(runXml).join("");

    return `<a:p>${properties}${runs}</a:p>`;
  }).join("");

  return `<p:txBody><a:bodyPr/><a:lstStyle/>${paragraphs}</p:txBody>`;
}

function xfrmXml(shape) {
  const attributes = [];

  if (shape.rot) attributes.push(`rot="${Math.round(shape.rot * 60000)}"`);
  if (shape.flipH) attributes.push(`flipH="1"`);
  if (shape.flipV) attributes.push(`flipV="1"`);

  return [
    `<a:xfrm${attributes.length ? " " + attributes.join(" ") : ""}>`,
    `<a:off x="${Math.round(shape.x)}" y="${Math.round(shape.y)}"/>`,
    `<a:ext cx="${Math.round(shape.width)}" cy="${Math.round(shape.height)}"/></a:xfrm>`
  ].join("");
}

function shapeFillXml(shape) {
  if (shape.gradient && shape.gradient.stops?.length >= 2) {
    const stops = shape.gradient.stops.map((stop) => `<a:gs pos="${Math.round(stop.position * 100000)}"><a:srgbClr val="${stop.color.replace("#", "").toUpperCase()}"/></a:gs>`).join("");

    return `<a:gradFill><a:gsLst>${stops}</a:gsLst><a:lin ang="${Math.round(shape.gradient.angle * 60000)}" scaled="1"/></a:gradFill>`;
  }

  return shape.fill
    ? `<a:solidFill><a:srgbClr val="${shape.fill.replace("#", "").toUpperCase()}"/></a:solidFill>`
    : "<a:noFill/>";
}

function shapeXml(shape, index) {
  const outline = shape.outline
    ? `<a:ln w="${Math.round(shape.outline.width * EMU_PER_POINT)}"><a:solidFill><a:srgbClr val="${shape.outline.color.replace("#", "").toUpperCase()}"/></a:solidFill></a:ln>`
    : "";
  const bodyAttributes = [];

  if (shape.anchor && shape.anchor !== "t") bodyAttributes.push(`anchor="${shape.anchor}"`);

  return [
    "<p:sp>",
    `<p:nvSpPr><p:cNvPr id="${index + 2}" name="${escapeXml(shape.name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>`,
    `<p:spPr>${xfrmXml(shape)}`,
    `<a:prstGeom prst="${shape.geometry || "rect"}"><a:avLst/></a:prstGeom>${shapeFillXml(shape)}${outline}</p:spPr>`,
    shapeTextBodyXml(shape),
    "</p:sp>"
  ].join("");
}

function slideXml(shapes, pictureRelationships = {}, background = null) {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"',
    ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',
    ' xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">',
    background ? `<p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="${background.replace("#", "").toUpperCase()}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>` : "<p:cSld><p:spTree>",
    '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>',
    "<p:grpSpPr><a:xfrm><a:off x=\"0\" y=\"0\"/><a:ext cx=\"0\" cy=\"0\"/>",
    "<a:chOff x=\"0\" y=\"0\"/><a:chExt cx=\"0\" cy=\"0\"/></a:xfrm></p:grpSpPr>",
    shapes.map((shape, index) => {
      if (shape.kind === "picture") return pictureXml(shape, index, pictureRelationships[shape.id] || "rId1");
      if (shape.kind === "table" || shape.kind === "frame") return shape.raw || "";

      return shapeXml(shape, index);
    }).join(""),
    "</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>"
  ].join("");
}

function shapeText(shape) {
  return shape.paragraphs.map((paragraph) => paragraph.runs.map((run) => run.text).join("")).join("\n");
}

function applyTextToShape(shape, text) {
  const lines = String(text).split("\n");
  const template = shape.paragraphs[0]?.runs[0] || { bold: false, italic: false, underline: false, size: null, font: null, color: null };

  return {
    ...shape,
    paragraphs: lines.map((line, index) => {
      const source = shape.paragraphs[index] || shape.paragraphs[shape.paragraphs.length - 1] || {};

      return {
        align: "l",
        level: 0,
        marL: null,
        hang: null,
        bullet: null,
        spaceBefore: 0,
        spaceAfter: 0,
        lineSpacing: null,
        ...source,
        runs: [{ ...(source.runs?.[0] || template), text: line }]
      };
    })
  };
}

const BULLET_GLYPHS = ["\u2022", "\u25E6", "\u25AA"];
const DEFAULT_BULLET_INDENT = 342900;

function paragraphBulletText(shape, paragraph, ordinal) {
  if (paragraph.bullet === "none") return null;
  if (paragraph.bullet === "auto") return `${ordinal}.`;
  if (paragraph.bullet) return paragraph.bullet;
  if (!shape.placeholder || ["title", "ctrTitle", "subTitle"].includes(shape.placeholder)) return null;

  return BULLET_GLYPHS[(paragraph.level || 0) % BULLET_GLYPHS.length];
}

function renderShapeParagraphs(shape, scale) {
  let ordinal = 0;

  return shape.paragraphs.map((paragraph, index) => {
    ordinal = paragraph.bullet === "auto" ? ordinal + 1 : 0;

    const bullet = paragraphBulletText(shape, paragraph, ordinal);
    const marL = paragraph.marL != null ? paragraph.marL : (paragraph.level || 0) * DEFAULT_BULLET_INDENT + (bullet ? DEFAULT_BULLET_INDENT : 0);
    const hang = paragraph.hang != null ? paragraph.hang : (bullet ? -DEFAULT_BULLET_INDENT : 0);
    const firstRun = paragraph.runs[0] || {};
    const empty = paragraph.runs.every((run) => !run.text && !run.break);
    const style = {
      margin: 0,
      textAlign: paragraph.align === "ctr" ? "center" : paragraph.align === "r" ? "right" : paragraph.align === "just" ? "justify" : "left",
      paddingLeft: `${Math.max(0, (marL / EMU_PER_POINT) * scale)}px`,
      textIndent: `${(hang / EMU_PER_POINT) * scale}px`,
      marginTop: paragraph.spaceBefore ? `${paragraph.spaceBefore * scale}px` : 0,
      marginBottom: paragraph.spaceAfter ? `${paragraph.spaceAfter * scale}px` : 0,
      lineHeight: paragraph.lineSpacing || 1.2,
      fontSize: `${(firstRun.size || 18) * scale}px`,
      fontWeight: firstRun.bold ? 700 : 400,
      fontStyle: firstRun.italic ? "italic" : "normal",
      color: firstRun.color || "inherit"
    };

    if (bullet) style["--slides-bullet"] = `"${bullet.replace(/"/g, "") } "`;

    return (
      <div key={index} className="slidesSlidesParagraph" style={style}>
        {empty ? "\u200B" : paragraph.runs.map((run, runIndex) => run.break ? <br key={runIndex} /> : run.text ? (
          <span
            key={runIndex}
            style={{
              fontWeight: run.bold ? 700 : 400,
              fontStyle: run.italic ? "italic" : "normal",
              textDecoration: [run.underline ? "underline" : "", run.strike ? "line-through" : ""].join(" ").trim() || "none",
              fontSize: `${(run.size || 18) * scale}px`,
              letterSpacing: run.spacing ? `${run.spacing * scale}px` : undefined,
              fontFamily: run.font ? `${run.font}, sans-serif` : undefined,
              color: run.color || "inherit"
            }}
          >{run.text}</span>
        ) : null)}
      </div>
    );
  });
}

export default function Slides({ fileHandle, onSave, onSaveStatusChange, onDirtyChange }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [displayName, setDisplayName] = useState("Untitled.pptx");
  const [slides, setSlides] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [selectedShape, setSelectedShape] = useState(null);
  const [slideSize, setSlideSize] = useState({ width: DEFAULT_SLIDE_WIDTH, height: DEFAULT_SLIDE_HEIGHT });
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [openMenu, setOpenMenu] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [isColorOpen, setIsColorOpen] = useState(false);
  const [textColor, setTextColor] = useState("#12151b");
  const [fontSize, setFontSize] = useState(18);
  const [showRail, setShowRail] = useState(true);
  const [presenting, setPresenting] = useState(false);
  const [saveBanner, setSaveBanner] = useState(null);
  const [pictures, setPictures] = useState({});
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const imageInputRef = useRef(null);
  const resizeRef = useRef(null);
  const presentFrameRef = useRef(null);
  const [presentStageWidth, setPresentStageWidth] = useState(0);

  const entriesRef = useRef(null);
  const stageRef = useRef(null);
  const dragRef = useRef(null);
  const menuPortalRef = useRef(null);
  const fileBtnRef = useRef(null);
  const editBtnRef = useRef(null);
  const insertBtnRef = useRef(null);
  const slideBtnRef = useRef(null);
  const bannerTimerRef = useRef(null);
  const [stageScale, setStageScale] = useState(1);
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const historyTimerRef = useRef(null);
  const savedSnapshotRef = useRef(null);
  const lastDirtyRef = useRef(false);
  const latestSlidesRef = useRef(slides);

  latestSlidesRef.current = slides;

  const notifySaveStatus = useCallback((status) => {
    setSaveBanner(status);
    onSaveStatusChange?.(status);

    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);

    bannerTimerRef.current = setTimeout(() => setSaveBanner(null), SAVE_BANNER_TIMEOUT_MS);
  }, [onSaveStatusChange]);

  const recordHistory = useCallback((next) => {
    if (historyTimerRef.current) {
      clearTimeout(historyTimerRef.current);
      historyTimerRef.current = null;
    }

    const snapshot = JSON.stringify(next);
    const trimmed = historyRef.current.slice(0, historyIndexRef.current + 1);

    if (!trimmed.length || trimmed[trimmed.length - 1] === snapshot) return;

    const appended = [...trimmed, snapshot].slice(-HISTORY_LIMIT);

    historyRef.current = appended;
    historyIndexRef.current = appended.length - 1;
    setHistory(appended);
    setHistoryIndex(appended.length - 1);
  }, []);

  const commitSlides = useCallback((next) => {
    setSlides(next);
    recordHistory(next);
    notifySaveStatus("Unsaved Changes");
  }, [recordHistory, notifySaveStatus]);

  useEffect(() => {
    if (!historyRef.current.length || dragRef.current || resizeRef.current) return undefined;

    historyTimerRef.current = setTimeout(() => recordHistory(latestSlidesRef.current), HISTORY_DELAY_MS);

    return () => clearTimeout(historyTimerRef.current);
  }, [slides, recordHistory]);

  useEffect(() => {
    if (savedSnapshotRef.current === null) return;

    const dirty = JSON.stringify(slides) !== savedSnapshotRef.current;

    if (dirty === lastDirtyRef.current) return;

    lastDirtyRef.current = dirty;
    onDirtyChange?.(dirty);
  }, [slides, history, onDirtyChange]);

  useEffect(() => {
    let cancelled = false;

    async function loadFile() {
      setError(null);
      setLoading(true);

      try {
        if (!fileHandle) {
          setLoading(false);
          return;
        }

        const file = await fileHandle.getFile();
        const name = file.name || "Untitled.pptx";
        const extension = name.split(".").pop()?.toLowerCase();

        setDisplayName(name);

        if (extension === "ppt" || extension === "pps" || extension === "pot") {
          throw new Error("PowerPoint 97-2003 presentations cannot be opened. Save the file as .pptx and try again.");
        }

        if (!PRESENTATION_EXTENSIONS.includes(extension)) {
          throw new Error("This file is not a PowerPoint presentation.");
        }

        const entries = await unzipEntries(await file.arrayBuffer());

        if (cancelled) return;

        entriesRef.current = entries;

        const decoder = new TextDecoder();
        const presentationPart = entries.get("ppt/presentation.xml");

        if (!presentationPart) throw new Error("This presentation is missing its content.");

        const presentation = new DOMParser().parseFromString(decoder.decode(presentationPart), "application/xml");
        const size = descendant(presentation.documentElement, "sldSz");

        setSlideSize({
          width: Number(size?.getAttribute("cx")) || DEFAULT_SLIDE_WIDTH,
          height: Number(size?.getAttribute("cy")) || DEFAULT_SLIDE_HEIGHT
        });

        const paths = [...entries.keys()]
          .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
          .sort((left, right) => {
            const leftNumber = Number(left.match(/slide(\d+)\.xml$/)[1]);
            const rightNumber = Number(right.match(/slide(\d+)\.xml$/)[1]);

            return leftNumber - rightNumber;
          });

        const themePath = [...entries.keys()].find((entry) => /^ppt\/theme\/theme\d+\.xml$/.test(entry));
        const themeColors = themePath ? parseThemeColors(decoder.decode(entries.get(themePath))) : {};
        const parsed = paths.map((path, index) => {
          const source = decoder.decode(entries.get(path));

          return {
            id: `slide-${index + 1}`,
            path,
            background: parseSlideBackground(source, themeColors),
            shapes: parseSlideShapes(source, themeColors)
          };
        });
        const loadedPictures = {};

        for (const slide of parsed) {
          const relsPart = entries.get(`ppt/slides/_rels/${slide.path.split("/").pop()}.rels`);

          if (!relsPart) continue;

          const relsDocument = new DOMParser().parseFromString(decoder.decode(relsPart), "application/xml");
          const targets = new Map();

          for (const relationship of relsDocument.getElementsByTagName("*")) {
            if (relationship.localName !== "Relationship") continue;

            targets.set(relationship.getAttribute("Id"), relationship.getAttribute("Target"));
          }

          for (const shape of slide.shapes) {
            if (shape.kind !== "picture" || !shape.embed) continue;

            const target = targets.get(shape.embed);

            if (!target) continue;

            const mediaPath = `ppt/${target.replace(/^\.\.\//, "")}`;
            const bytes = entries.get(mediaPath) || entries.get(target.replace(/^\//, ""));

            if (!bytes) continue;

            const extension = mediaPath.split(".").pop()?.toLowerCase() || "png";
            const mime = IMAGE_MIME_TYPES[extension] || "image/png";

            loadedPictures[shape.id] = {
              bytes,
              extension,
              mime,
              url: URL.createObjectURL(new Blob([bytes], { type: mime }))
            };
          }
        }

        setPictures(loadedPictures);
        setSlides(parsed);
        historyRef.current = [JSON.stringify(parsed)];
        historyIndexRef.current = 0;
        savedSnapshotRef.current = historyRef.current[0];
        setHistory(historyRef.current);
        setHistoryIndex(0);
        setCurrentSlide(0);
        setSelectedShape(null);
      } catch (loadError) {
        if (!cancelled) setError(loadError?.message || String(loadError));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadFile();

    return () => { cancelled = true; };
  }, [fileHandle]);

  useEffect(() => {
    const stage = stageRef.current;

    if (!stage) return;

    const measure = () => {
      const available = stage.clientWidth - 48;
      const availableHeight = stage.clientHeight - 48;

      if (available <= 0 || availableHeight <= 0) return;

      const widthScale = available / (slideSize.width / EMU_PER_POINT);
      const heightScale = availableHeight / (slideSize.height / EMU_PER_POINT);

      setStageScale(Math.max(0.1, Math.min(widthScale, heightScale)));
    };

    measure();

    const observer = new ResizeObserver(measure);

    observer.observe(stage);

    return () => observer.disconnect();
  }, [slideSize]);

  useEffect(() => {
    const handleMouseDown = (event) => {
      if (openMenu && !menuPortalRef.current?.contains(event.target) && !event.target.closest(".slidesSlidesOperationsButton")) {
        setOpenMenu(null);
      }
    };

    document.addEventListener("mousedown", handleMouseDown, true);

    return () => document.removeEventListener("mousedown", handleMouseDown, true);
  }, [openMenu]);

  useEffect(() => {
    if (!presenting) return undefined;

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    document.body.classList.add("slidesSlidesPresentingBody");

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.classList.remove("slidesSlidesPresentingBody");
    };
  }, [presenting]);

  useEffect(() => {
    if (!presenting) return;

    const node = presentFrameRef.current;

    if (node) {
      const measure = () => {
        const ratio = slideSize.width / slideSize.height;

        setPresentStageWidth(Math.max(0, Math.min(node.clientWidth, node.clientHeight * ratio)));
      };

      measure();

      const observer = new ResizeObserver(measure);

      observer.observe(node);

      return () => observer.disconnect();
    }

    return undefined;
  }, [presenting, slideSize]);

  useEffect(() => {
    if (!presenting) return;

    const onKey = (event) => {
      if (event.key === "Escape") setPresenting(false);
      if (event.key === "ArrowRight" || event.key === " ") setCurrentSlide((previous) => Math.min(slides.length - 1, previous + 1));
      if (event.key === "ArrowLeft") setCurrentSlide((previous) => Math.max(0, previous - 1));
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [presenting, slides.length]);

  const openTopMenu = (name, buttonRef) => {
    setOpenMenu((previous) => (previous === name ? null : name));

    if (buttonRef.current) setMenuPosition(clampMenuPosition(buttonRef.current.getBoundingClientRect()));
  };

  const renderDropdownMenu = (menuName, items) => {
    if (openMenu !== menuName) return null;

    return createPortal(
      <div className="slidesSlidesDropdownMenu" ref={menuPortalRef} style={{ top: menuPosition.top, left: menuPosition.left }}>
        {items.map((item, index) => (item.separator ? (
          <div className="slidesSlidesDropdownMenuSeparator" key={`separator-${index}`} />
        ) : (
          <div className="slidesSlidesDropdownMenuItem" key={item.text} onClick={() => { item.action(); setOpenMenu(null); }}>
            {item.icon && <FontAwesomeIcon icon={item.icon} />}
            <span className="slidesSlidesDropdownMenuItemLabel">{item.text}</span>
          </div>
        )))}
      </div>,
      document.body
    );
  };

  const updateShape = useCallback((shapeId, updater) => {
    const next = slides.map((slide, index) => (index === currentSlide
      ? { ...slide, shapes: slide.shapes.map((shape) => (shape.id === shapeId ? updater(shape) : shape)) }
      : slide));

    commitSlides(next);
  }, [slides, currentSlide, commitSlides]);

  const applyRunStyle = useCallback((patch) => {
    if (!selectedShape) return;

    updateShape(selectedShape, (shape) => ({
      ...shape,
      paragraphs: shape.paragraphs.map((paragraph) => ({
        ...paragraph,
        runs: paragraph.runs.map((run) => ({ ...run, ...patch }))
      }))
    }));
  }, [selectedShape, updateShape]);

  const applyParagraphStyle = useCallback((patch) => {
    if (!selectedShape) return;

    updateShape(selectedShape, (shape) => ({
      ...shape,
      paragraphs: shape.paragraphs.map((paragraph) => ({ ...paragraph, ...patch }))
    }));
  }, [selectedShape, updateShape]);

  const addTextBox = useCallback(() => {
    const shape = {
      id: createShapeId(),
      name: "Text Box",
      placeholder: null,
      x: slideSize.width * 0.12,
      y: slideSize.height * 0.2,
      width: slideSize.width * 0.5,
      height: slideSize.height * 0.15,
      fill: null,
      paragraphs: [{ align: "l", level: 0, runs: [{ text: "New Text Box", bold: false, italic: false, underline: false, size: fontSize, font: null, color: textColor }] }]
    };

    commitSlides(slides.map((slide, index) => (index === currentSlide
      ? { ...slide, shapes: [...slide.shapes, shape] }
      : slide)));
    setSelectedShape(shape.id);
  }, [slides, currentSlide, slideSize, fontSize, textColor, commitSlides]);

  const addSlideFromTemplate = useCallback((template) => {
    const slide = {
      id: `slide-new-${Date.now()}`,
      path: null,
      shapes: template.build(slideSize.width, slideSize.height)
    };
    const next = [...slides];

    next.splice(currentSlide + 1, 0, slide);
    commitSlides(next);
    setCurrentSlide(currentSlide + 1);
    setSelectedShape(null);
    setTemplateMenuOpen(false);
  }, [slides, currentSlide, slideSize, commitSlides]);

  const insertPicture = useCallback(async (file) => {
    if (!file) return;

    const extension = file.name.split(".").pop()?.toLowerCase() || "png";
    const mime = IMAGE_MIME_TYPES[extension];

    if (!mime) {
      await showDialog({ title: "Insert Picture", message: "That image format is not supported.", showCancel: false });

      return;
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    const dimensions = await new Promise((resolve) => {
      const image = new Image();

      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => resolve({ width: 4, height: 3 });
      image.src = url;
    });
    const ratio = dimensions.height / dimensions.width;
    const width = slideSize.width * 0.45;
    const shape = {
      id: createShapeId(),
      kind: "picture",
      name: file.name,
      placeholder: null,
      x: slideSize.width * 0.1,
      y: slideSize.height * 0.2,
      width,
      height: width * ratio,
      fill: null,
      paragraphs: []
    };

    setPictures((previous) => ({ ...previous, [shape.id]: { bytes, url, extension, mime } }));
    commitSlides(slides.map((slide, index) => (index === currentSlide
      ? { ...slide, shapes: [...slide.shapes, shape] }
      : slide)));
    setSelectedShape(shape.id);
  }, [slides, currentSlide, slideSize, commitSlides]);

  const startResize = useCallback((event, shape, handle) => {
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setSelectedShape(shape.id);

    resizeRef.current = {
      id: shape.id,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      origin: { x: shape.x, y: shape.y, width: shape.width, height: shape.height }
    };
  }, []);

  const moveResize = useCallback((event) => {
    const resize = resizeRef.current;

    if (!resize) return;

    const deltaX = ((event.clientX - resize.startX) / stageScale) * EMU_PER_POINT;
    const deltaY = ((event.clientY - resize.startY) / stageScale) * EMU_PER_POINT;
    const origin = resize.origin;
    const next = { ...origin };

    if (resize.handle.includes("e")) next.width = Math.max(MINIMUM_SHAPE_EMU, origin.width + deltaX);
    if (resize.handle.includes("s")) next.height = Math.max(MINIMUM_SHAPE_EMU, origin.height + deltaY);

    if (resize.handle.includes("w")) {
      const width = Math.max(MINIMUM_SHAPE_EMU, origin.width - deltaX);

      next.x = origin.x + (origin.width - width);
      next.width = width;
    }

    if (resize.handle.includes("n")) {
      const height = Math.max(MINIMUM_SHAPE_EMU, origin.height - deltaY);

      next.y = origin.y + (origin.height - height);
      next.height = height;
    }

    setSlides((previous) => previous.map((slide, index) => (index === currentSlide
      ? { ...slide, shapes: slide.shapes.map((shape) => (shape.id === resize.id ? { ...shape, ...next } : shape)) }
      : slide)));
  }, [stageScale, currentSlide]);

  const endResize = useCallback(() => {
    if (!resizeRef.current) return;

    resizeRef.current = null;
    commitSlides(slides);
  }, [slides, commitSlides]);

  const deleteShape = useCallback(() => {
    if (!selectedShape) return;

    commitSlides(slides.map((slide, index) => (index === currentSlide
      ? { ...slide, shapes: slide.shapes.filter((shape) => shape.id !== selectedShape) }
      : slide)));
    setSelectedShape(null);
  }, [slides, currentSlide, selectedShape, commitSlides]);

  const addSlide = useCallback(() => {
    const blank = { id: `slide-new-${Date.now()}`, path: null, shapes: [] };
    const next = [...slides];

    next.splice(currentSlide + 1, 0, blank);
    commitSlides(next);
    setCurrentSlide(currentSlide + 1);
    setSelectedShape(null);
  }, [slides, currentSlide, commitSlides]);

  const duplicateSlide = useCallback(() => {
    const source = slides[currentSlide];

    if (!source) return;

    const copy = JSON.parse(JSON.stringify(source));
    const next = [...slides];

    copy.id = `slide-copy-${Date.now()}`;
    copy.path = null;
    next.splice(currentSlide + 1, 0, copy);
    commitSlides(next);
    setCurrentSlide(currentSlide + 1);
  }, [slides, currentSlide, commitSlides]);

  const deleteSlide = useCallback(async () => {
    if (slides.length <= 1) {
      await showDialog({ title: "Delete Slide", message: "A presentation must keep at least one slide.", showCancel: false });

      return;
    }

    const confirmed = await showDialog({
      title: "Delete Slide",
      message: `Delete slide ${currentSlide + 1} of this presentation?`,
      showCancel: true
    });

    if (!confirmed) return;

    commitSlides(slides.filter((slide, index) => index !== currentSlide));
    setCurrentSlide(Math.max(0, currentSlide - 1));
    setSelectedShape(null);
  }, [slides, currentSlide, commitSlides]);

  const moveSlide = useCallback((direction) => {
    const target = currentSlide + direction;

    if (target < 0 || target >= slides.length) return;

    const next = [...slides];

    next.splice(target, 0, next.splice(currentSlide, 1)[0]);
    commitSlides(next);
    setCurrentSlide(target);
  }, [slides, currentSlide, commitSlides]);

  const stepHistory = useCallback((direction) => {
    if (dragRef.current || resizeRef.current) return;

    recordHistory(latestSlidesRef.current);

    const target = historyIndexRef.current + direction;
    const snapshot = historyRef.current[target];

    if (snapshot === undefined) return;

    const restored = JSON.parse(snapshot);

    historyIndexRef.current = target;
    setHistoryIndex(target);
    setSlides(restored);
    setCurrentSlide((previous) => Math.max(0, Math.min(restored.length - 1, previous)));
  }, [recordHistory]);

  const undo = useCallback(() => stepHistory(-1), [stepHistory]);

  const redo = useCallback(() => stepHistory(1), [stepHistory]);

  const startShapeDrag = (event, shape) => {
    if (presenting) return;

    event.stopPropagation();
    setSelectedShape(shape.id);

    if (event.target.isContentEditable) return;

    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = { id: shape.id, startX: event.clientX, startY: event.clientY, originX: shape.x, originY: shape.y };
  };

  const moveShapeDrag = (event) => {
    const drag = dragRef.current;

    if (!drag) return;

    const deltaX = ((event.clientX - drag.startX) / stageScale) * EMU_PER_POINT;
    const deltaY = ((event.clientY - drag.startY) / stageScale) * EMU_PER_POINT;

    setSlides((previous) => previous.map((slide, index) => (index === currentSlide
      ? {
        ...slide,
        shapes: slide.shapes.map((shape) => (shape.id === drag.id
          ? { ...shape, x: Math.max(0, drag.originX + deltaX), y: Math.max(0, drag.originY + deltaY) }
          : shape))
      }
      : slide)));
  };

  const endShapeDrag = () => {
    if (!dragRef.current) return;

    dragRef.current = null;
    commitSlides(slides);
  };

  const buildFile = useCallback(async () => {
    const entries = new Map(entriesRef.current);
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const templatePath = slides.find((slide) => slide.path)?.path || "ppt/slides/slide1.xml";
    const templateRels = entries.get(`ppt/slides/_rels/${templatePath.split("/").pop()}.rels`);

    for (const path of [...entries.keys()]) {
      if (/^ppt\/slides\/slide\d+\.xml$/.test(path)) entries.delete(path);
      if (/^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/.test(path)) entries.delete(path);
    }

    const mediaNames = new Map();

    slides.forEach((slide, index) => {
      const path = `ppt/slides/slide${index + 1}.xml`;
      const relationships = {};
      const extra = [];

      slide.shapes.forEach((shape, shapeIndex) => {
        if (shape.kind !== "picture") return;

        const picture = pictures[shape.id];

        if (!picture) return;

        let mediaName = mediaNames.get(shape.id);

        if (!mediaName) {
          mediaName = `image${mediaNames.size + 1000}.${picture.extension}`;
          mediaNames.set(shape.id, mediaName);
          entries.set(`ppt/media/${mediaName}`, picture.bytes);
        }

        const relationshipId = `rIdPic${index + 1}x${shapeIndex + 1}`;

        relationships[shape.id] = relationshipId;
        extra.push(`<Relationship Id="${relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${mediaName}"/>`);
      });

      entries.set(path, encoder.encode(slideXml(slide.shapes, relationships, slide.background || null)));

      const baseRels = templateRels
        ? decoder.decode(templateRels)
        : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
      const cleaned = baseRels.replace(/<Relationship[^>]*Type="[^"]*\/image"[^>]*\/>/g, "");

      entries.set(
        `ppt/slides/_rels/slide${index + 1}.xml.rels`,
        encoder.encode(cleaned.replace("</Relationships>", `${extra.join("")}</Relationships>`))
      );
    });

    const presentationPart = entries.get("ppt/presentation.xml");
    const relsPart = entries.get("ppt/_rels/presentation.xml.rels");

    if (presentationPart && relsPart) {
      const relsText = decoder.decode(relsPart);
      const relationships = [...relsText.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="slides\/slide\d+\.xml"[^>]*\/>/g)];
      const others = relsText.replace(/<Relationship[^>]*Target="slides\/slide\d+\.xml"[^>]*\/>/g, "");
      const template = relationships[0]?.[0] || '<Relationship Id="rId100" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>';
      const rebuilt = slides.map((slide, index) => template
        .replace(/Id="[^"]+"/, `Id="rIdSlide${index + 1}"`)
        .replace(/Target="slides\/slide\d+\.xml"/, `Target="slides/slide${index + 1}.xml"`)).join("");

      entries.set("ppt/_rels/presentation.xml.rels", encoder.encode(others.replace("</Relationships>", `${rebuilt}</Relationships>`)));

      const presentationText = decoder.decode(presentationPart);
      const list = slides.map((slide, index) => `<p:sldId id="${256 + index}" r:id="rIdSlide${index + 1}"/>`).join("");

      entries.set("ppt/presentation.xml", encoder.encode(
        presentationText.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/, `<p:sldIdLst>${list}</p:sldIdLst>`)
      ));
    }

    const contentTypes = entries.get("[Content_Types].xml");

    if (contentTypes) {
      const text = decoder.decode(contentTypes).replace(/<Override[^>]*PartName="\/ppt\/slides\/slide\d+\.xml"[^>]*\/>/g, "");
      const overrides = slides.map((slide, index) =>
        `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("");
      const extensions = new Set([...mediaNames.values()].map((name) => name.split(".").pop()));
      const defaults = [...extensions]
        .filter((extension) => !text.includes(`Extension="${extension}"`))
        .map((extension) => `<Default Extension="${extension}" ContentType="${IMAGE_MIME_TYPES[extension] || "image/png"}"/>`)
        .join("");

      entries.set("[Content_Types].xml", encoder.encode(
        text.replace("</Types>", `${defaults}${overrides}</Types>`)
      ));
    }

    return zipEntries(entries);
  }, [slides, pictures]);

  const handleSave = useCallback(async () => {
    try {
      if (!fileHandle) throw new Error("This presentation has no file handle to write back to.");

      if (fileHandle.queryPermission) {
        const state = await fileHandle.queryPermission({ mode: "readwrite" });

        if (state !== "granted") {
          const granted = await fileHandle.requestPermission({ mode: "readwrite" });

          if (granted !== "granted") throw new Error("Permission to write to this file was declined.");
        }
      }

      const blob = await buildFile();
      const writable = await fileHandle.createWritable({ keepExistingData: false });

      await writable.write(blob);
      await writable.close();

      entriesRef.current = await unzipEntries(await blob.arrayBuffer());
      savedSnapshotRef.current = JSON.stringify(latestSlidesRef.current);
      lastDirtyRef.current = false;
      onDirtyChange?.(false);
      notifySaveStatus("Saved Changes");
      onSave?.();
    } catch (saveError) {
      await showDialog({ title: "Save Failed", message: saveError?.message || String(saveError), showCancel: false });
    }
  }, [buildFile, fileHandle, notifySaveStatus, onSave, onDirtyChange]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const modifier = event.metaKey || event.ctrlKey;

      if (!modifier) return;

      const key = event.key.toLowerCase();

      if (key === "z" || key === "y") {
        const target = event.target;

        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;

        event.preventDefault();
        event.stopPropagation();

        if (key === "y" || event.shiftKey) redo();
        else undo();

        return;
      }

      if (key !== "s") return;

      event.preventDefault();
      event.stopPropagation();
      handleSave();
    };

    window.addEventListener("keydown", onKeyDown, true);

    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [handleSave, undo, redo]);

  const handleDownload = useCallback(async () => {
    const blob = await buildFile();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = displayName;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [buildFile, displayName]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleFileInformation = useCallback(async () => {
    const shapes = slides.reduce((total, slide) => total + slide.shapes.length, 0);
    const words = slides.reduce((total, slide) => total + slide.shapes.reduce((count, shape) =>
      count + shapeText(shape).split(/\s+/).filter(Boolean).length, 0), 0);

    await showDialog({
      title: "File Information",
      message: [
        `Name: ${displayName}`,
        `Slides: ${slides.length}`,
        `Shapes: ${shapes}`,
        `Words: ${words}`,
        `Slide Size: ${Math.round(slideSize.width / EMU_PER_POINT)} By ${Math.round(slideSize.height / EMU_PER_POINT)} Points`
      ].join("\n"),
      showCancel: false
    });
  }, [displayName, slides, slideSize]);

  const stepFontSize = useCallback((direction) => {
    const next = direction > 0
      ? FONT_SIZE_LADDER.find((size) => size > fontSize) ?? fontSize
      : [...FONT_SIZE_LADDER].reverse().find((size) => size < fontSize) ?? fontSize;

    setFontSize(next);
    applyRunStyle({ size: next });
  }, [fontSize, applyRunStyle]);

  const slide = slides[currentSlide];
  const stageWidth = (slideSize.width / EMU_PER_POINT) * stageScale;
  const stageHeight = (slideSize.height / EMU_PER_POINT) * stageScale;
  const presentScale = presentStageWidth ? presentStageWidth / (slideSize.width / EMU_PER_POINT) : stageScale;

  const renderShape = (shape, scale = stageScale) => {
    const transforms = [];

    if (shape.rot) transforms.push(`rotate(${shape.rot}deg)`);
    if (shape.flipH) transforms.push("scaleX(-1)");
    if (shape.flipV) transforms.push("scaleY(-1)");

    const radius = shape.geometry === "ellipse"
      ? "50%"
      : shape.geometry === "roundRect" || shape.geometry === "round2SameRect"
        ? `${Math.round(Math.min(shape.width, shape.height) / EMU_PER_POINT * scale * 0.16)}px`
        : undefined;
    const style = {
      left: `${(shape.x / slideSize.width) * 100}%`,
      top: `${(shape.y / slideSize.height) * 100}%`,
      width: `${(shape.width / slideSize.width) * 100}%`,
      height: `${(shape.height / slideSize.height) * 100}%`,
      background: shapeFillCss(shape),
      transform: transforms.length ? transforms.join(" ") : undefined,
      borderRadius: radius,
      boxShadow: shape.outline ? `inset 0 0 0 ${Math.max(1, shape.outline.width * scale / 0.75)}px ${shape.outline.color}` : undefined
    };
    const selected = selectedShape === shape.id && !presenting;
    const handles = selected ? RESIZE_HANDLES.map((handle) => (
      <span
        key={handle}
        className={`slidesSlidesHandle slidesSlidesHandle-${handle}`}
        onPointerDown={(event) => startResize(event, shape, handle)}
        onPointerMove={moveResize}
        onPointerUp={endResize}
        onPointerCancel={endResize}
      />
    )) : null;

    if (shape.kind === "table") {
      const totalColumns = shape.columns.reduce((sum, value) => sum + value, 0) || 1;

      return (
        <div key={shape.id} className={selected ? "slidesSlidesShape selected" : "slidesSlidesShape"} style={style}
          onPointerDown={(event) => startShapeDrag(event, shape)} onPointerMove={moveShapeDrag} onPointerUp={endShapeDrag} onPointerCancel={endShapeDrag}>
          <table className="slidesSlidesTableShape">
            <colgroup>
              {shape.columns.map((column, columnIndex) => <col key={columnIndex} style={{ width: `${(column / totalColumns) * 100}%` }} />)}
            </colgroup>
            <tbody>
              {shape.rows.map((row, rowIndex) => (
                <tr key={rowIndex} style={{ height: `${(row.height / EMU_PER_POINT) * scale}px` }}>
                  {row.cells.filter((cell) => !cell.merged).map((cell, cellIndex) => (
                    <td key={cellIndex} colSpan={cell.span > 1 ? cell.span : undefined} style={{ background: cell.fill || "transparent" }}>
                      {renderShapeParagraphs({ placeholder: null, paragraphs: cell.paragraphs }, scale)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {handles}
        </div>
      );
    }

    if (shape.kind === "frame") {
      return (
        <div key={shape.id} className={selected ? "slidesSlidesShape selected" : "slidesSlidesShape"} style={style}
          onPointerDown={(event) => startShapeDrag(event, shape)} onPointerMove={moveShapeDrag} onPointerUp={endShapeDrag} onPointerCancel={endShapeDrag}>
          <span className="slidesSlidesPicturePlaceholder">{shape.name}</span>
          {handles}
        </div>
      );
    }

    if (shape.kind === "picture") {
      return (
        <div
          key={shape.id}
          className={selected ? "slidesSlidesShape selected" : "slidesSlidesShape"}
          style={style}
          onPointerDown={(event) => startShapeDrag(event, shape)}
          onPointerMove={moveShapeDrag}
          onPointerUp={endShapeDrag}
          onPointerCancel={endShapeDrag}
        >
          {pictures[shape.id]?.url
            ? <img className="slidesSlidesPicture" src={pictures[shape.id].url} alt={shape.name} draggable={false} />
            : <span className="slidesSlidesPicturePlaceholder">{shape.name}</span>}
          {handles}
        </div>
      );
    }

    return (
      <div
        key={shape.id}
        className={selected ? "slidesSlidesShape selected" : "slidesSlidesShape"}
        style={style}
        onPointerDown={(event) => startShapeDrag(event, shape)}
        onPointerMove={moveShapeDrag}
        onPointerUp={endShapeDrag}
        onPointerCancel={endShapeDrag}
      >
        <div
          className="slidesSlidesShapeText"
          contentEditable={!presenting}
          suppressContentEditableWarning={true}
          style={{
            color: "#12151b",
            padding: `${((shape.insets?.top ?? 45720) / EMU_PER_POINT) * scale}px ${((shape.insets?.right ?? 91440) / EMU_PER_POINT) * scale}px ${((shape.insets?.bottom ?? 45720) / EMU_PER_POINT) * scale}px ${((shape.insets?.left ?? 91440) / EMU_PER_POINT) * scale}px`,
            display: "flex",
            flexDirection: "column",
            justifyContent: shape.anchor === "ctr" ? "center" : shape.anchor === "b" ? "flex-end" : "flex-start"
          }}
          onBlur={(event) => {
            const text = event.currentTarget.innerText.replace(/\u200B/g, "").replace(/\n$/, "");

            if (text !== shapeText(shape)) updateShape(shape.id, (target) => applyTextToShape(target, text));
          }}
        >
          {renderShapeParagraphs(shape, scale)}
        </div>
        {handles}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="loading-wrapper">
        <div className="loading-circle" />
        <label className="loading-title">Loading</label>
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading-wrapper">
        <label className="loading-title">{error}</label>
      </div>
    );
  }

  if (presenting) {
    return createPortal(
      <div className="slidesSlidesPresentation">
        <div className="slidesSlidesPresentationFrame" ref={presentFrameRef}>
          <div
            className="slidesSlidesPresentationStage"
            style={{
              width: `${presentStageWidth}px`,
              height: `${(presentStageWidth * slideSize.height) / slideSize.width}px`,
              background: slide?.background || "#ffffff"
            }}
          >
            {(slide?.shapes || []).map((shape) => renderShape(shape, presentScale))}
          </div>
        </div>

        <div className="slidesSlidesPresentationProgress">
          <span style={{ width: `${((currentSlide + 1) / Math.max(1, slides.length)) * 100}%` }} />
        </div>

        <div className="slidesSlidesPresentationBar" onClick={(event) => event.stopPropagation()}>
          <Tippy content="Previous Slide" theme="tooltip-light">
            <button className="slidesSlidesPresentationButton" onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}>
              <FontAwesomeIcon icon={faAngleLeft} />
            </button>
          </Tippy>
          <label className="slidesSlidesPresentationCount">{currentSlide + 1} / {slides.length}</label>
          <Tippy content="Next Slide" theme="tooltip-light">
            <button className="slidesSlidesPresentationButton" onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))}>
              <FontAwesomeIcon icon={faAngleRight} />
            </button>
          </Tippy>
          <Tippy content="Exit Presentation" theme="tooltip-light">
            <button className="slidesSlidesPresentationButton" onClick={() => setPresenting(false)}>
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </Tippy>
        </div>
      </div>,
      document.body
    );
  }

  return (
    <div className="slidesSlidesContentWrapper">
      <div className="slidesSlidesToolbarWrapper">
        <div className="slidesSlidesToolBar">
          <div className="slidesSlidesTitleWrapper">
            <div className="slidesSlidesFileNameStack">
              <label className="slidesSlidesFileNameInput">
                <FontAwesomeIcon icon={faFile} /> {displayName}
              </label>

              <div className="slidesSlidesOperationsButtonsWrapper">
                <button ref={fileBtnRef} className="slidesSlidesOperationsButton" onClick={() => openTopMenu("file", fileBtnRef)}>
                  File
                </button>
                {renderDropdownMenu("file", [
                  { icon: faSave, text: "Save", action: handleSave },
                  { icon: faDownload, text: "Download", action: handleDownload },
                  { icon: faPrint, text: "Print", action: handlePrint },
                  { separator: true },
                  { icon: faCircleInfo, text: "File Information", action: handleFileInformation }
                ])}

                <button ref={editBtnRef} className="slidesSlidesOperationsButton" onClick={() => openTopMenu("edit", editBtnRef)}>
                  Edit
                </button>
                {renderDropdownMenu("edit", [
                  { icon: faUndo, text: "Undo", action: undo },
                  { icon: faRedo, text: "Redo", action: redo },
                  { separator: true },
                  { icon: faTrash, text: "Delete Selected Shape", action: deleteShape }
                ])}

                <button ref={insertBtnRef} className="slidesSlidesOperationsButton" onClick={() => openTopMenu("insert", insertBtnRef)}>
                  Insert
                </button>
                {renderDropdownMenu("insert", [
                  { icon: faFont, text: "Text Box", action: addTextBox },
                  { icon: faImage, text: "Picture", action: () => imageInputRef.current?.click() },
                  { separator: true },
                  { icon: faFileCirclePlus, text: "Blank Slide", action: addSlide },
                  { icon: faTableCells, text: "Slide From Template", action: () => setTemplateMenuOpen(true) }
                ])}

                <button ref={slideBtnRef} className="slidesSlidesOperationsButton" onClick={() => openTopMenu("slide", slideBtnRef)}>
                  Slide
                </button>
                {renderDropdownMenu("slide", [
                  { icon: faArrowUp, text: "Move Slide Up", action: () => moveSlide(-1) },
                  { icon: faArrowDown, text: "Move Slide Down", action: () => moveSlide(1) },
                  { separator: true },
                  { icon: faClone, text: "Duplicate Slide", action: duplicateSlide },
                  { icon: faTrash, text: "Delete Slide", action: deleteSlide },
                  { separator: true },
                  { icon: faTableCells, text: showRail ? "Hide Slide Rail" : "Show Slide Rail", action: () => setShowRail((previous) => !previous) },
                  { icon: faPlay, text: "Present", action: () => setPresenting(true) }
                ])}
              </div>
            </div>
          </div>

          <div className="slidesSlidesEditingButtonsWrapper">
            <div className="slidesSlidesStatusGroup">
              <span className="slidesSlidesStatusItem">
                <FontAwesomeIcon icon={faFile} />
                <span>Slide {currentSlide + 1} Of {slides.length}</span>
              </span>
              <span className="slidesSlidesStatusItem">
                <FontAwesomeIcon icon={faTextHeight} />
                <span>{slide ? slide.shapes.length : 0} Shapes</span>
              </span>
            </div>

            <div className="slidesSlidesStatusActions">
              {[
                { icon: faBold, label: "Bold", action: () => applyRunStyle({ bold: true }) },
                { icon: faItalic, label: "Italic", action: () => applyRunStyle({ italic: true }) },
                { icon: faUnderline, label: "Underline", action: () => applyRunStyle({ underline: true }) }
              ].map((entry) => (
                <Tippy key={entry.label} content={entry.label} theme="tooltip-light">
                  <button
                    className="slidesSlidesEditingButton slidesSlidesStatusIconButton"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={entry.action}
                  >
                    <FontAwesomeIcon icon={entry.icon} />
                  </button>
                </Tippy>
              ))}
            </div>

            <div className="slidesSlidesStatusActions">
              {[
                { icon: faAlignLeft, label: "Align Left", value: "l" },
                { icon: faAlignCenter, label: "Align Center", value: "ctr" },
                { icon: faAlignRight, label: "Align Right", value: "r" }
              ].map((entry) => (
                <Tippy key={entry.value} content={entry.label} theme="tooltip-light">
                  <button
                    className="slidesSlidesEditingButton slidesSlidesStatusIconButton"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyParagraphStyle({ align: entry.value })}
                  >
                    <FontAwesomeIcon icon={entry.icon} />
                  </button>
                </Tippy>
              ))}
            </div>

            <div className="slidesSlidesStatusActions">
              <Tippy content="Decrease Font Size" theme="tooltip-light">
                <button
                  className="slidesSlidesEditingButton slidesSlidesStatusIconButton"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => stepFontSize(-1)}
                >
                  <FontAwesomeIcon icon={faMinus} />
                </button>
              </Tippy>
              <span className="slidesSlidesStrokeValue">{fontSize}</span>
              <Tippy content="Increase Font Size" theme="tooltip-light">
                <button
                  className="slidesSlidesEditingButton slidesSlidesStatusIconButton"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => stepFontSize(1)}
                >
                  <FontAwesomeIcon icon={faPlus} />
                </button>
              </Tippy>
            </div>

            <div className="slidesSlidesStatusActions">
              <Tippy
                content={<ColorPicker color={textColor} onChange={(next) => { setTextColor(next); applyRunStyle({ color: next }); }} />}
                visible={isColorOpen}
                onClickOutside={() => setIsColorOpen(false)}
                interactive={true}
                placement="top"
                className="color-picker-tippy"
                appendTo={() => document.body}
              >
                <label
                  className="slidesSlidesColorControl"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setIsColorOpen((previous) => !previous)}
                >
                  <FontAwesomeIcon icon={faFont} />
                  <span className="slidesSlidesColorSwatch" style={{ background: textColor }} />
                </label>
              </Tippy>

              <Tippy content="Present" theme="tooltip-light">
                <button
                  className="slidesSlidesEditingButton slidesSlidesStatusIconButton"
                  onClick={() => setPresenting(true)}
                >
                  <FontAwesomeIcon icon={faPlay} />
                </button>
              </Tippy>
            </div>
          </div>
        </div>
      </div>

      <input
        ref={imageInputRef}
        className="slidesSlidesHiddenInput"
        type="file"
        accept="image/png,image/jpeg,image/gif,image/bmp,image/svg+xml,image/webp,image/tiff"
        onChange={(event) => {
          const file = event.target.files?.[0];

          event.target.value = "";
          insertPicture(file);
        }}
      />

      {templateMenuOpen && createPortal(
        <div className="slidesSlidesModalScrim" onClick={() => setTemplateMenuOpen(false)}>
          <div className="slidesSlidesModal" onClick={(event) => event.stopPropagation()}>
            <div className="slidesSlidesModalHeader">
              <label className="slidesSlidesModalTitle">New Slide From Template</label>
              <button className="slidesSlidesModalClose" title="Close" onClick={() => setTemplateMenuOpen(false)}>
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <div className="slidesSlidesTemplateGrid">
              {SLIDE_TEMPLATES.map((template) => (
                <button key={template.key} className="slidesSlidesTemplateCard" onClick={() => addSlideFromTemplate(template)}>
                  <div className="slidesSlidesTemplatePreview" style={{ aspectRatio: `${slideSize.width} / ${slideSize.height}` }}>
                    {template.build(slideSize.width, slideSize.height).map((shape) => (
                      <span
                        key={shape.id}
                        className="slidesSlidesTemplateBlock"
                        style={{
                          left: `${(shape.x / slideSize.width) * 100}%`,
                          top: `${(shape.y / slideSize.height) * 100}%`,
                          width: `${(shape.width / slideSize.width) * 100}%`,
                          height: `${(shape.height / slideSize.height) * 100}%`
                        }}
                      />
                    ))}
                  </div>
                  <label>{template.label}</label>
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {saveBanner && <div className="slidesSlidesSaveBanner">{saveBanner}</div>}

      <div className="slidesSlidesWorkspace">
        {showRail && (
          <div className="slidesSlidesRail">
            {slides.map((entry, index) => (
              <button
                key={entry.id}
                className={index === currentSlide ? "slidesSlidesRailItem current" : "slidesSlidesRailItem"}
                onClick={() => { setCurrentSlide(index); setSelectedShape(null); }}
              >
                <div className="slidesSlidesRailPreview" style={{ aspectRatio: `${slideSize.width} / ${slideSize.height}`, background: entry.background || "#ffffff" }}>
                  {entry.shapes.map((shape) => {
                    const position = {
                      left: `${(shape.x / slideSize.width) * 100}%`,
                      top: `${(shape.y / slideSize.height) * 100}%`,
                      width: `${(shape.width / slideSize.width) * 100}%`,
                      height: `${(shape.height / slideSize.height) * 100}%`
                    };

                    if (shape.kind === "picture") {
                      return pictures[shape.id]?.url
                        ? <img key={shape.id} className="slidesSlidesRailPicture" style={position} src={pictures[shape.id].url} alt="" />
                        : <span key={shape.id} className="slidesSlidesRailShape" style={{ ...position, background: "#e6e8ec" }} />;
                    }

                    if (shape.kind === "table" || shape.kind === "frame") {
                      return <span key={shape.id} className="slidesSlidesRailShape" style={{ ...position, background: "#eceef2", boxShadow: "inset 0 0 0 1px #cdd2dc" }} />;
                    }

                    return (
                      <span
                        key={shape.id}
                        className="slidesSlidesRailShape"
                        style={{
                          ...position,
                          background: shapeFillCss(shape),
                          color: "#12151b"
                        }}
                      >
                        {renderShapeParagraphs(shape, SLIDE_RAIL_WIDTH / (slideSize.width / EMU_PER_POINT))}
                      </span>
                    );
                  })}
                </div>
                <label>{index + 1}</label>
              </button>
            ))}
            <button className="slidesSlidesRailAction" onClick={addSlide}>
              <FontAwesomeIcon icon={faPlus} /> New Slide
            </button>
          </div>
        )}

        <div className="slidesSlidesStage" ref={stageRef} onPointerDown={() => setSelectedShape(null)}>
          <div
            className="slidesSlidesSurface"
            style={{ width: `${stageWidth}px`, height: `${stageHeight}px`, background: slide?.background || "#ffffff" }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {(slide?.shapes || []).map((shape) => renderShape(shape, stageScale))}
          </div>
        </div>
      </div>
    </div>
  );
}