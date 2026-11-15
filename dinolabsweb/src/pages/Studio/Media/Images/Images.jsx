import React, { useState, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight, faArrowsLeftRightToLine, faArrowsRotate, faArrowsUpToLine, faBorderTopLeft,
  faCircle, faCropSimple, faDownload, faLeftRight, faMagnifyingGlassMinus,
  faMagnifyingGlassPlus, faMinus, faBrush, faPlus, faRotateLeft,
  faRotateRight, faRulerCombined, faSwatchbook, faTabletScreenButton, faUpDown,
  faEye, faEyeSlash, faLock, faLockOpen, faArrowUp,
  faArrowDown, faTrash, faFileImport, faLayerGroup, faPenToSquare,
  faChevronDown, faChevronRight, faFont, faShapes,
  faSliders, faFloppyDisk, faSquare
} from "@fortawesome/free-solid-svg-icons";
import Tippy from "@tippyjs/react";
import ColorPicker from "../../../../helpers/ColorPicker.jsx";
import { showDialog } from "../../../../helpers/Alert.jsx";
import Dropdown from "../../../../helpers/Dropdown.jsx";
import "../../../../styles/mainStyles/Studio/Media/Images/Images.css";
import "../../../../styles/helperStyles/Slider.css";
import "../../../../styles/helperStyles/Checkbox.css";
import "tippy.js/dist/tippy.css";

const HISTORY_LIMIT = 80;

const NON_EDIT_HISTORY_ENTRIES = [
    "Image loaded.",
    "Crop mode enabled.",
    "Circle crop toggled.",
    "Crop preset applied.",
    "Layer selected.",
    "Drawing mode enabled.",
    "Drawing mode disabled.",
    "Highlighting mode enabled.",
    "Highlighting mode disabled.",
    "Drawing color changed.",
    "Highlighting color changed.",
    "Drawing brush size changed.",
    "Highlighting brush size changed.",
    "Image resized.",
    "Image size changed.",
    "Aspect ratio restored.",
    "Aspect ratio setting changed."
];

const EXPORT_MIME_TYPES = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    avif: "image/avif",
    bmp: "image/bmp",
    ico: "image/x-icon"
};

const BLEND_MODES = [
    "normal", "multiply", "screen", "overlay", "darken", "lighten",
    "color-dodge", "color-burn", "hard-light", "soft-light",
    "difference", "exclusion", "hue", "saturation", "color", "luminosity"
];

const BLEND_MODE_LABELS = {
    normal: "Normal", multiply: "Multiply", screen: "Screen", overlay: "Overlay",
    darken: "Darken", lighten: "Lighten", "color-dodge": "Color Dodge", "color-burn": "Color Burn",
    "hard-light": "Hard Light", "soft-light": "Soft Light", difference: "Difference",
    exclusion: "Exclusion", hue: "Hue", saturation: "Saturation", color: "Color", luminosity: "Luminosity"
};

const SHAPE_KINDS = ["rectangle", "ellipse", "line", "arrow"];

const BASE_ADJUSTMENTS = {
    blackPoint: 0,
    whitePoint: 255,
    gamma: 1,
    exposure: 0,
    temperature: 0,
    tint: 0,
    vibrance: 0,
    sharpen: 0,
    vignette: 0
};

function buildLevelsTable(adjustments) {
    const table = new Uint8ClampedArray(256);
    const black = Math.min(254, adjustments.blackPoint);
    const white = Math.max(black + 1, adjustments.whitePoint);
    const gamma = Math.max(0.1, adjustments.gamma);
    const exposure = 2 ** (adjustments.exposure / 100);

    for (let value = 0; value < 256; value++) {
        const normalized = Math.min(1, Math.max(0, (value - black) / (white - black)));

        table[value] = Math.round(255 * Math.min(1, (normalized ** (1 / gamma)) * exposure));
    }

    return table;
}

function applyPixelAdjustments(context, width, height, adjustments) {
    const settings = { ...BASE_ADJUSTMENTS, ...(adjustments || {}) };
    const untouched = Object.keys(BASE_ADJUSTMENTS).every((key) => settings[key] === BASE_ADJUSTMENTS[key]);

    if (untouched || width <= 0 || height <= 0) return;

    const frame = context.getImageData(0, 0, width, height);
    const data = frame.data;
    const table = buildLevelsTable(settings);
    const warm = settings.temperature / 100;
    const green = settings.tint / 100;
    const vibrance = settings.vibrance / 100;

    for (let index = 0; index < data.length; index += 4) {
        let red = table[data[index]];
        let grn = table[data[index + 1]];
        let blue = table[data[index + 2]];

        if (warm !== 0) {
            red = Math.min(255, Math.max(0, red + warm * 40));
            blue = Math.min(255, Math.max(0, blue - warm * 40));
        }

        if (green !== 0) grn = Math.min(255, Math.max(0, grn + green * 40));

        if (vibrance !== 0) {
            const maximum = Math.max(red, grn, blue);
            const average = (red + grn + blue) / 3;
            const amount = ((maximum - average) / 255) * vibrance;

            red += (maximum - red) * amount;
            grn += (maximum - grn) * amount;
            blue += (maximum - blue) * amount;
        }

        data[index] = red;
        data[index + 1] = grn;
        data[index + 2] = blue;
    }

    if (settings.sharpen > 0) {
        const amount = settings.sharpen / 100;
        const source = new Uint8ClampedArray(data);
        const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                for (let channel = 0; channel < 3; channel++) {
                    let total = 0;
                    let weight = 0;

                    for (let ky = -1; ky <= 1; ky++) {
                        for (let kx = -1; kx <= 1; kx++) {
                            const offset = ((y + ky) * width + (x + kx)) * 4 + channel;

                            total += source[offset] * kernel[weight];
                            weight += 1;
                        }
                    }

                    const target = (y * width + x) * 4 + channel;

                    data[target] = source[target] + (total - source[target]) * amount;
                }
            }
        }
    }

    if (settings.vignette > 0) {
        const strength = settings.vignette / 100;
        const centerX = width / 2;
        const centerY = height / 2;
        const maximumDistance = Math.hypot(centerX, centerY);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const distance = Math.hypot(x - centerX, y - centerY) / maximumDistance;
                const factor = 1 - strength * distance * distance;
                const offset = (y * width + x) * 4;

                data[offset] *= factor;
                data[offset + 1] *= factor;
                data[offset + 2] *= factor;
            }
        }
    }

    context.putImageData(frame, 0, 0);
}

function loadImageElement(source) {
    return new Promise((resolve, reject) => {
        const element = new Image();

        element.crossOrigin = "anonymous";
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error("An image layer could not be loaded."));
        element.src = source;
    });
}

function filterStringFor(values) {
    return [
        `hue-rotate(${values.hue || 0}deg)`,
        `saturate(${values.saturation ?? 100}%)`,
        `brightness(${values.brightness ?? 100}%)`,
        `contrast(${values.contrast ?? 100}%)`,
        `blur(${values.blur || 0}px)`,
        `grayscale(${values.grayscale || 0}%)`,
        `sepia(${values.sepia || 0}%)`,
        values.spread ? `drop-shadow(0 0 ${values.spread}px rgba(0,0,0,0.5))` : ""
    ].join(" ").trim();
}

function roundedPath(context, width, height, radii) {
    const [topLeft, topRight, bottomRight, bottomLeft] = radii;

    context.beginPath();
    context.moveTo(topLeft, 0);
    context.lineTo(width - topRight, 0);
    context.quadraticCurveTo(width, 0, width, topRight);
    context.lineTo(width, height - bottomRight);
    context.quadraticCurveTo(width, height, width - bottomRight, height);
    context.lineTo(bottomLeft, height);
    context.quadraticCurveTo(0, height, 0, height - bottomLeft);
    context.lineTo(0, topLeft);
    context.quadraticCurveTo(0, 0, topLeft, 0);
    context.closePath();
}

function drawShapeOnCanvas(context, shape, width, height) {
    const x = shape.x * width;
    const y = shape.y * height;
    const x2 = shape.x2 * width;
    const y2 = shape.y2 * height;

    context.save();
    context.strokeStyle = shape.color;
    context.fillStyle = shape.fill || "transparent";
    context.lineWidth = shape.strokeWidth || 2;
    context.lineCap = "round";

    if (shape.kind === "rectangle") {
        const left = Math.min(x, x2);
        const top = Math.min(y, y2);

        if (shape.fill && shape.fill !== "transparent") context.fillRect(left, top, Math.abs(x2 - x), Math.abs(y2 - y));

        context.strokeRect(left, top, Math.abs(x2 - x), Math.abs(y2 - y));
    } else if (shape.kind === "ellipse") {
        context.beginPath();
        context.ellipse((x + x2) / 2, (y + y2) / 2, Math.abs(x2 - x) / 2, Math.abs(y2 - y) / 2, 0, 0, Math.PI * 2);

        if (shape.fill && shape.fill !== "transparent") context.fill();

        context.stroke();
    } else {
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x2, y2);
        context.stroke();

        if (shape.kind === "arrow") {
            const angle = Math.atan2(y2 - y, x2 - x);
            const head = Math.max(10, (shape.strokeWidth || 2) * 4);

            context.beginPath();
            context.moveTo(x2, y2);
            context.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
            context.moveTo(x2, y2);
            context.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
            context.stroke();
        }
    }

    context.restore();
}

async function compositeDocument(options) {
    const {
        url, nativeWidth, nativeHeight, scaleFactor = 1, baseVisible, baseFilters, baseOpacity,
        baseRotation, baseFlipX, baseFlipY, radii, adjustments, imageLayers = [],
        paths = [], shapeLayers = []
    } = options;
    const canvas = document.createElement("canvas");

    canvas.width = Math.max(1, Math.round(nativeWidth * scaleFactor));
    canvas.height = Math.max(1, Math.round(nativeHeight * scaleFactor));

    const context = canvas.getContext("2d");

    context.scale(scaleFactor, scaleFactor);

    if (radii && radii.some((radius) => radius > 0)) {
        roundedPath(context, nativeWidth, nativeHeight, radii);
        context.clip();
    }

    if (baseVisible) {
        const base = await loadImageElement(url);

        context.save();
        context.filter = baseFilters;
        context.globalAlpha = baseOpacity / 100;
        context.translate(nativeWidth / 2, nativeHeight / 2);
        context.rotate(((baseRotation || 0) * Math.PI) / 180);
        context.scale(baseFlipX || 1, baseFlipY || 1);
        context.drawImage(base, -nativeWidth / 2, -nativeHeight / 2, nativeWidth, nativeHeight);
        context.restore();
    }

    for (const layer of imageLayers.filter((entry) => entry.visible)) {
        const element = await loadImageElement(layer.url);

        context.save();
        context.filter = filterStringFor(layer);
        context.globalAlpha = (layer.opacity ?? 100) / 100;
        context.globalCompositeOperation = layer.blend && layer.blend !== "normal" ? layer.blend : "source-over";
        context.translate(layer.x, layer.y);
        context.rotate(((layer.rotation || 0) * Math.PI) / 180);
        context.scale((layer.zoom || 1) * (layer.flipX || 1), (layer.zoom || 1) * (layer.flipY || 1));
        context.drawImage(element, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
        context.restore();
    }

    for (const entry of paths.filter((path) => path.visible !== false)) {
        context.save();
        context.strokeStyle = entry.color;
        context.lineWidth = entry.width;
        context.lineCap = "round";
        context.lineJoin = "round";

        try {
            context.stroke(new Path2D(entry.d));
        } catch (pathError) {
            context.restore();
            continue;
        }

        context.restore();
    }

    for (const shape of shapeLayers.filter((entry) => entry.visible !== false)) {
        drawShapeOnCanvas(context, shape, nativeWidth, nativeHeight);
    }

    applyPixelAdjustments(context, canvas.width, canvas.height, adjustments);

    return canvas;
}

export default function image({ fileHandle, onSaveStatusChange, onDirtyChange }) {
    const BASE_ZOOM = 1;
    const BASE_ROTATION = 0;
    const BASE_FLIP = 1;
    const BASE_FILTER_VALUES = { hue: 0, saturation: 100, brightness: 100, contrast: 100, opacity: 100, blur: 0, spread: 0, grayscale: 0, sepia: 0 };
    const MIN_SIZE = 50;
    const MAX_CORNER_RADIUS = 100;
    const RESIZE_HANDLE_SIZE = 6;
    const CROP_HANDLE_SIZE = 8;

    const drawRoundedRect = (ctx, x, y, width, height, radius) => {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    };

    const getPathBounds = (pathData) => {
        try {
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.style.visibility = "hidden";
            svg.style.position = "absolute";
            document.body.appendChild(svg);
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", pathData);
            svg.appendChild(path);
            const bbox = path.getBBox();
            document.body.removeChild(svg);
            return { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height };
        } catch (error) {
            return { x: 0, y: 0, width: 100, height: 100 };
        }
    };

    const getSvgPoint = (e) => {
        const svg = e.currentTarget;
        const point = svg.createSVGPoint();
        point.x = e.clientX;
        point.y = e.clientY;
        const ctm = svg.getScreenCTM().inverse();
        return point.matrixTransform(ctm);
    };

    const [url, setUrl] = useState(null);
    const [mediaType, setMediaType] = useState(null);
    const [svgContent, setSvgContent] = useState(null);
    const [nativeWidth, setNativeWidth] = useState(450);
    const [nativeHeight, setNativeHeight] = useState(450);
    const [imageWidth, setImageWidth] = useState(450);
    const [imageHeight, setImageHeight] = useState(450);

    const [layersCollapsed, setLayersCollpased] = useState(true);
    const [layoutCollapsed, setLayoutCollapsed] = useState(true);
    const [dimensionsCollapsed, setDimensionsCollapsed] = useState(true);
    const [stylesCollapsed, setStylesCollapsed] = useState(true);
    const [drawingCollapsed, setDrawingCollapsed] = useState(true);
    const [cornerCollapsed, setCornerCollapsed] = useState(true);

    const [baseZoom, setBaseZoom] = useState(BASE_ZOOM);
    const [baseRotation, setBaseRotation] = useState(BASE_ROTATION);
    const [baseFlipX, setBaseFlipX] = useState(BASE_FLIP);
    const [baseFlipY, setBaseFlipY] = useState(BASE_FLIP);
    const [baseHue, setBaseHue] = useState(BASE_FILTER_VALUES.hue);
    const [baseSaturation, setBaseSaturation] = useState(BASE_FILTER_VALUES.saturation);
    const [baseBrightness, setBaseBrightness] = useState(BASE_FILTER_VALUES.brightness);
    const [baseContrast, setBaseContrast] = useState(BASE_FILTER_VALUES.contrast);
    const [baseOpacity, setBaseOpacity] = useState(BASE_FILTER_VALUES.opacity);
    const [baseBlur, setBaseBlur] = useState(BASE_FILTER_VALUES.blur);
    const [baseSpread, setBaseSpread] = useState(BASE_FILTER_VALUES.spread);
    const [baseGrayscale, setBaseGrayscale] = useState(BASE_FILTER_VALUES.grayscale);
    const [baseSepia, setBaseSepia] = useState(BASE_FILTER_VALUES.sepia);
    const [baseVisible, setBaseVisible] = useState(true);
    const [baseLocked, setBaseLocked] = useState(false);

    const [panX, setPanX] = useState(0);
    const [panY, setPanY] = useState(0);
    const [maintainAspectRatio, setMaintainAspectRatio] = useState(true);
    const [resizingCorner, setResizingCorner] = useState(null);

    const [borderRadius, setBorderRadius] = useState(0);
    const [borderTopLeftRadius, setBorderTopLeftRadius] = useState(0);
    const [borderTopRightRadius, setBorderTopRightRadius] = useState(0);
    const [borderBottomLeftRadius, setBorderBottomLeftRadius] = useState(0);
    const [borderBottomRightRadius, setBorderBottomRightRadius] = useState(0);
    const [syncCorners, setSyncCorners] = useState(false);

    const [isCropping, setIsCropping] = useState(false);
    const [cropRect, setCropRect] = useState({ x: 0, y: 0, width: 100, height: 100 });
    const [cropRotation, setCropRotation] = useState(0);
    const [isCropDisabled, setIsCropDisabled] = useState(false);
    const [circleCrop, setCircleCrop] = useState(false);
    const [cropHistory, setCropHistory] = useState([]);

    const [actionMode, setActionMode] = useState("Idle");
    const [drawColor, setDrawColor] = useState("#5C2BE2");
    const [highlightColor, setHighlightColor] = useState("#00ff624d");
    const [drawBrushSize, setDrawBrushSize] = useState(4);
    const [highlightBrushSize, setHighlightBrushSize] = useState(4);
    const [isDrawColorOpen, setIsDrawColorOpen] = useState(false);
    const [isHighlightColorOpen, setIsHighlightColorOpen] = useState(false);

    const [paths, setPaths] = useState([]);
    const [undonePaths, setUndonePaths] = useState([]);
    const [tempPath, setTempPath] = useState(null);
    const [drawingLayers, setDrawingLayers] = useState([]);

    const [imageLayers, setImageLayers] = useState([]);
    const [selectedLayers, setSelectedLayers] = useState(['base']);
    const [resizingImageLayer, setResizingImageLayer] = useState(null);

    const [shapeLayers, setShapeLayers] = useState([]);
    const [adjustments, setAdjustments] = useState({ ...BASE_ADJUSTMENTS });
    const [baseBlend, setBaseBlend] = useState("normal");
    const [adjustmentsCollapsed, setAdjustmentsCollapsed] = useState(true);
    const [insertCollapsed, setInsertCollapsed] = useState(true);
    const [shapeKind, setShapeKind] = useState("rectangle");
    const [shapeColor, setShapeColor] = useState("#5C2BE2");
    const [shapeFill, setShapeFill] = useState("transparent");
    const [shapeStrokeWidth, setShapeStrokeWidth] = useState(3);
    const [isShapeColorOpen, setIsShapeColorOpen] = useState(false);
    const [saveBanner, setSaveBanner] = useState(null);
    const shapeDraftRef = useRef(null);
    const saveBannerTimerRef = useRef(null);
    const surfaceRef = useRef(null);
    const adjustmentCanvasRef = useRef(null);
    const adjustmentFrameRef = useRef(null);

    const [history, setHistory] = useState([]);
    const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1);
    const [isDraggingOver, setIsDraggingOver] = useState(false);

    const containerRef = useRef(null);
    const fileInputRef = useRef(null);
    const draggingRef = useRef(false);
    const lastMousePosRef = useRef({ x: 0, y: 0 });
    const resizingRef = useRef(false);
    const lastResizePosRef = useRef({ x: 0, y: 0 });
    const initialSizeRef = useRef({ width: 450, height: 450 });
    const initialPosRef = useRef({ x: 0, y: 0 });
    const aspectRatioRef = useRef(1);
    const isDrawingRef = useRef(false);
    const currentPathPoints = useRef([]);
    const cropResizingRef = useRef(false);
    const cropResizingCorner = useRef(null);
    const cropLastResizePosRef = useRef({ x: 0, y: 0 });
    const cropInitialRectRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
    const cropRotatingRef = useRef(false);
    const cropInitialRotation = useRef(0);
    const cropRotationStartAngle = useRef(0);
    const cropRotationCenter = useRef({ x: 0, y: 0 });
    const cropDraggingRef = useRef(false);
    const lastCropDragPosRef = useRef({ x: 0, y: 0 });
    const historyUpdateTimeoutRef = useRef(null);
    const preventHistoryUpdate = useRef(false);
    const drawingLayerDraggingRef = useRef(false);
    const lastDrawingLayerPosRef = useRef({ x: 0, y: 0 });
    const resizingDrawingLayer = useRef(null);
    const drawingLayerResizingRef = useRef(false);
    const initialDrawingLayerZoomRef = useRef(1);
    const imageLayerResizingRef = useRef(false);
    const imageLayerDraggingRef = useRef(false);
    const lastImageLayerPosRef = useRef({ x: 0, y: 0 });
    const initialImageLayerSizeRef = useRef({ width: 0, height: 0 });
    const initialImageLayerPosRef = useRef({ x: 0, y: 0 });

    const getCurrentLayerValues = () => {
        if (selectedLayers.length === 0) return {};
        if (selectedLayers.includes('base') && selectedLayers.length === 1) {
            return { zoom: baseZoom, rotation: baseRotation, flipX: baseFlipX, flipY: baseFlipY, hue: baseHue, saturation: baseSaturation, brightness: baseBrightness, contrast: baseContrast, opacity: baseOpacity, blur: baseBlur, spread: baseSpread, grayscale: baseGrayscale, sepia: baseSepia };
        }
        if (selectedLayers.length === 1 && !selectedLayers.includes('base')) {
            const imageLayer = imageLayers.find(l => l.id === selectedLayers[0]);
            if (imageLayer) {
                return { zoom: imageLayer.zoom || 1, rotation: imageLayer.rotation || 0, flipX: imageLayer.flipX || 1, flipY: imageLayer.flipY || 1, hue: imageLayer.hue || 0, saturation: imageLayer.saturation || 100, brightness: imageLayer.brightness || 100, contrast: imageLayer.contrast || 100, opacity: imageLayer.opacity || 100, blur: imageLayer.blur || 0, spread: imageLayer.spread || 0, grayscale: imageLayer.grayscale || 0, sepia: imageLayer.sepia || 0 };
            }
            const drawingLayer = drawingLayers.find(l => l.id === selectedLayers[0]);
            if (drawingLayer) {
                return { zoom: drawingLayer.zoom || 1, rotation: drawingLayer.rotation || 0, flipX: drawingLayer.flipX || 1, flipY: drawingLayer.flipY || 1, hue: drawingLayer.hue || 0, saturation: drawingLayer.saturation || 100, brightness: drawingLayer.brightness || 100, contrast: drawingLayer.contrast || 100, opacity: drawingLayer.opacity || 100, blur: drawingLayer.blur || 0, spread: drawingLayer.spread || 0, grayscale: drawingLayer.grayscale || 0, sepia: drawingLayer.sepia || 0 };
            }
        }
        return { zoom: 1, rotation: 0, flipX: 1, flipY: 1, hue: 0, saturation: 100, brightness: 100, contrast: 100, opacity: 100, blur: 0, spread: 0, grayscale: 0, sepia: 0 };
    };

    const currentValues = getCurrentLayerValues();

    const calculateInitialSize = (w, h) => {
        const containerWidth = containerRef.current?.clientWidth || 800;
        const containerHeight = containerRef.current?.clientHeight || 600;
        const maxPossibleWidth = containerWidth * 0.7;
        const maxPossibleHeight = containerHeight * 0.7;
        let initWidth = w;
        let initHeight = h;
        const widthRatio = initWidth / maxPossibleWidth;
        const heightRatio = initHeight / maxPossibleHeight;
        if (widthRatio > 1 || heightRatio > 1) {
            const ratio = Math.max(widthRatio, heightRatio);
            initWidth /= ratio;
            initHeight /= ratio;
        }
        setImageWidth(initWidth);
        setImageHeight(initHeight);
    };

    const generateThumbnail = () => {
        return new Promise((resolve) => {
            const thumbSize = 100;
            const rad = baseRotation * Math.PI / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            const halfW = nativeWidth / 2;
            const halfH = nativeHeight / 2;
            const corners = [{ x: -halfW, y: -halfH }, { x: halfW, y: -halfH }, { x: halfW, y: halfH }, { x: -halfW, y: halfH }];
            const transformedCorners = corners.map(c => {
                let x = c.x * cos - c.y * sin;
                let y = c.x * sin + c.y * cos;
                x *= baseZoom * baseFlipX;
                y *= baseZoom * baseFlipY;
                return { x, y };
            });
            const xs = transformedCorners.map(c => c.x);
            const ys = transformedCorners.map(c => c.y);
            const minX = Math.min(...xs);
            const minY = Math.min(...ys);
            const maxX = Math.max(...xs);
            const maxY = Math.max(...ys);
            const boundWidth = maxX - minX;
            const boundHeight = maxY - minY;
            const scaleFactor = thumbSize / Math.max(boundWidth, boundHeight);
            const canvas = document.createElement("canvas");
            canvas.width = boundWidth * scaleFactor;
            canvas.height = boundHeight * scaleFactor;
            const ctx = canvas.getContext("2d");
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.scale(scaleFactor, scaleFactor);
            ctx.rotate(rad);
            ctx.scale(baseZoom * baseFlipX, baseZoom * baseFlipY);

            let filterString = `hue-rotate(${baseHue}deg) saturate(${baseSaturation}%) brightness(${baseBrightness}%) contrast(${baseContrast}%) blur(${baseBlur}px) grayscale(${baseGrayscale}%) sepia(${baseSepia}%)`;
            if (baseSpread) filterString += ` drop-shadow(0 0 ${baseSpread}px rgba(0,0,0,0.5))`;
            ctx.filter = filterString;
            ctx.globalAlpha = baseOpacity / 100;

            const roundedRect = new Path2D();
            const scaleRatio = nativeWidth / imageWidth;
            if (circleCrop) {
                const radius = Math.min(nativeWidth, nativeHeight) / 2;
                roundedRect.arc(0, 0, radius, 0, 2 * Math.PI);
            } else if (syncCorners) {
                let radius = borderRadius * scaleRatio;
                radius = Math.min(radius, nativeWidth / 2, nativeHeight / 2);
                drawRoundedRect(ctx, -nativeWidth / 2, -nativeHeight / 2, nativeWidth, nativeHeight, radius);
            } else {
                const tl = Math.min(borderTopLeftRadius * scaleRatio, nativeWidth / 2, nativeHeight / 2);
                const tr = Math.min(borderTopRightRadius * scaleRatio, nativeWidth / 2, nativeHeight / 2);
                const br = Math.min(borderBottomRightRadius * scaleRatio, nativeWidth / 2, nativeHeight / 2);
                const bl = Math.min(borderBottomLeftRadius * scaleRatio, nativeWidth / 2, nativeHeight / 2);
                roundedRect.moveTo(-nativeWidth / 2 + tl, -nativeHeight / 2);
                roundedRect.lineTo(nativeWidth / 2 - tr, -nativeHeight / 2);
                roundedRect.quadraticCurveTo(nativeWidth / 2, -nativeHeight / 2, nativeWidth / 2, -nativeHeight / 2 + tr);
                roundedRect.lineTo(nativeWidth / 2, nativeHeight / 2 - br);
                roundedRect.quadraticCurveTo(nativeWidth / 2, nativeHeight / 2, nativeWidth / 2 - br, nativeHeight / 2);
                roundedRect.lineTo(-nativeWidth / 2 + bl, nativeHeight / 2);
                roundedRect.quadraticCurveTo(-nativeWidth / 2, nativeHeight / 2, -nativeWidth / 2, nativeHeight / 2 - bl);
                roundedRect.lineTo(-nativeWidth / 2, -nativeHeight / 2 + tl);
                roundedRect.quadraticCurveTo(-nativeWidth / 2, -nativeHeight / 2, -nativeWidth / 2 + tl, -nativeHeight / 2);
            }
            ctx.clip(roundedRect);

            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                if (baseVisible) {
                    ctx.drawImage(img, -nativeWidth / 2, -nativeHeight / 2, nativeWidth, nativeHeight);
                }
                resolve(canvas.toDataURL("image/png"));
            };
            img.src = url;
        });
    };

    const addToHistory = async (description = "Edit", overrides = null) => {
        if (preventHistoryUpdate.current) return;

        const isEdit = !NON_EDIT_HISTORY_ENTRIES.includes(description)
            && !/^(Drawing|Highlighting) (mode|brush size)/.test(description);

        if (isEdit) notifySaveStatus("Unsaved Changes");

        if (historyUpdateTimeoutRef.current) {
            clearTimeout(historyUpdateTimeoutRef.current);
        }
        historyUpdateTimeoutRef.current = setTimeout(async () => {
            const thumbnail = await generateThumbnail();
            const currentState = { url, mediaType, svgContent, baseZoom, baseRotation, baseFlipX, baseFlipY, baseHue, baseSaturation, baseBrightness, baseContrast, baseOpacity, baseBlur, baseSpread, baseGrayscale, baseSepia, panX, panY, imageWidth, imageHeight, nativeWidth, nativeHeight, borderRadius, borderTopLeftRadius, borderTopRightRadius, borderBottomLeftRadius, borderBottomRightRadius, syncCorners, maintainAspectRatio, paths, undonePaths, drawBrushSize, highlightBrushSize, cropHistory, isCropDisabled, circleCrop, baseVisible, baseLocked, drawColor, highlightColor, isDrawColorOpen, isHighlightColorOpen, actionMode, imageLayers, selectedLayers, shapeLayers, adjustments, drawingLayers, ...(overrides || {}) };
            setHistory(prev => {
                const newHistory = [...prev];
                if (currentHistoryIndex < prev.length - 1) {
                    newHistory.splice(currentHistoryIndex + 1);
                }
                newHistory.push({ state: currentState, thumbnail, description });
                return newHistory.slice(-HISTORY_LIMIT);
            });
            setCurrentHistoryIndex(prev => Math.min(prev + 1, HISTORY_LIMIT - 1));
        }, 300);
    };

    const resetImage = () => {
        setBaseZoom(BASE_ZOOM);
        setBaseRotation(BASE_ROTATION);
        setBaseFlipX(BASE_FLIP);
        setBaseFlipY(BASE_FLIP);
        setBaseHue(BASE_FILTER_VALUES.hue);
        setBaseSaturation(BASE_FILTER_VALUES.saturation);
        setBaseBrightness(BASE_FILTER_VALUES.brightness);
        setBaseContrast(BASE_FILTER_VALUES.contrast);
        setBaseOpacity(BASE_FILTER_VALUES.opacity);
        setBaseBlur(BASE_FILTER_VALUES.blur);
        setBaseSpread(BASE_FILTER_VALUES.spread);
        setBaseGrayscale(BASE_FILTER_VALUES.grayscale);
        setBaseSepia(BASE_FILTER_VALUES.sepia);
        setPanX(0);
        setPanY(0);
        setBorderRadius(0);
        setBorderTopLeftRadius(0);
        setBorderTopRightRadius(0);
        setBorderBottomLeftRadius(0);
        setBorderBottomRightRadius(0);
        setPaths([]);
        setUndonePaths([]);
        setDrawingLayers([]);
        setImageLayers([]);
        setSelectedLayers(['base']);
        calculateInitialSize(nativeWidth, nativeHeight);
        setIsCropDisabled(false);
        addToHistory("Image reset to original state.");
    };

    const updateZoom = (delta) => {
        selectedLayers.forEach(layerId => {
            if (layerId === 'base') {
                setBaseZoom(prev => Math.max(prev + delta, 0.1));
            } else {
                const isImageLayer = imageLayers.find(l => l.id === layerId);
                const isDrawingLayer = drawingLayers.find(l => l.id === layerId);
                if (isImageLayer) {
                    setImageLayers(prev => prev.map(layer => layer.id === layerId ? { ...layer, zoom: Math.max((layer.zoom || 1) + delta, 0.1) } : layer));
                } else if (isDrawingLayer) {
                    setDrawingLayers(prev => prev.map(layer => layer.id === layerId ? { ...layer, zoom: Math.max((layer.zoom || 1) + delta, 0.1) } : layer));
                }
            }
        });
    };

    const updateRotation = (delta) => {
        selectedLayers.forEach(layerId => {
            if (layerId === 'base') {
                setBaseRotation(prev => prev + delta);
                setIsCropping(false);
            } else {
                const isImageLayer = imageLayers.find(l => l.id === layerId);
                const isDrawingLayer = drawingLayers.find(l => l.id === layerId);
                if (isImageLayer) {
                    setImageLayers(prev => prev.map(layer => layer.id === layerId ? { ...layer, rotation: (layer.rotation || 0) + delta } : layer));
                } else if (isDrawingLayer) {
                    setDrawingLayers(prev => prev.map(layer => layer.id === layerId ? { ...layer, rotation: (layer.rotation || 0) + delta } : layer));
                }
            }
        });
    };

    const updateFlip = (axis) => {
        selectedLayers.forEach(layerId => {
            if (layerId === 'base') {
                if (axis === 'x') {
                    setBaseFlipX(prev => -prev);
                } else {
                    setBaseFlipY(prev => -prev);
                }
                setIsCropping(false);
            } else {
                const isImageLayer = imageLayers.find(l => l.id === layerId);
                const isDrawingLayer = drawingLayers.find(l => l.id === layerId);
                if (isImageLayer) {
                    setImageLayers(prev => prev.map(layer => {
                        if (layer.id === layerId) {
                            if (axis === 'x') {
                                return { ...layer, flipX: (layer.flipX || 1) * -1, x: nativeWidth - layer.x };
                            } else {
                                return { ...layer, flipY: (layer.flipY || 1) * -1, y: nativeHeight - layer.y };
                            }
                        }
                        return layer;
                    }));
                } else if (isDrawingLayer) {
                    setDrawingLayers(prev => prev.map(layer => {
                        if (layer.id === layerId) {
                            if (axis === 'x') {
                                return { ...layer, flipX: (layer.flipX || 1) * -1 };
                            } else {
                                return { ...layer, flipY: (layer.flipY || 1) * -1 };
                            }
                        }
                        return layer;
                    }));
                }
            }
        });
    };

    const updateFilter = (property, value) => {
        if (selectedLayers.some(id => drawingLayers.find(l => l.id === id))) {
            setDrawingLayers(prev => prev.map(layer => selectedLayers.includes(layer.id) ? { ...layer, [property]: value } : layer));
        }
        if (selectedLayers.includes('base')) {
            switch (property) {
                case 'hue': setBaseHue(value); break;
                case 'saturation': setBaseSaturation(value); break;
                case 'brightness': setBaseBrightness(value); break;
                case 'contrast': setBaseContrast(value); break;
                case 'opacity': setBaseOpacity(value); break;
                case 'blur': setBaseBlur(value); break;
                case 'spread': setBaseSpread(value); break;
                case 'grayscale': setBaseGrayscale(value); break;
                case 'sepia': setBaseSepia(value); break;
            }
        }
        if (selectedLayers.some(id => imageLayers.find(l => l.id === id))) {
            setImageLayers(prev => prev.map(layer => selectedLayers.includes(layer.id) ? { ...layer, [property]: value } : layer));
        }
        addToHistory("Filter applied.");
    };

    const restoreAspectRatioWidth = () => {
        if (selectedLayers.includes('base')) {
            const newHeight = imageWidth * (nativeHeight / nativeWidth);
            setImageHeight(newHeight);
        }
        selectedLayers.forEach(layerId => {
            if (layerId !== 'base') {
                setImageLayers(prev => prev.map(layer => layer.id === layerId ? { ...layer, height: layer.width * (layer.height / layer.width) } : layer));
            }
        });
        addToHistory("Aspect ratio restored.");
    };

    const restoreAspectRatioHeight = () => {
        if (selectedLayers.includes('base')) {
            const newWidth = imageHeight * (nativeWidth / nativeHeight);
            setImageWidth(newWidth);
        }
        selectedLayers.forEach(layerId => {
            if (layerId !== 'base') {
                setImageLayers(prev => prev.map(layer => layer.id === layerId ? { ...layer, width: layer.height * (layer.width / layer.height) } : layer));
            }
        });
        addToHistory("Aspect ratio restored.");
    };

    const importImageLayer = () => {
        fileInputRef.current?.click();
    };

    const handleImageImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const imageUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const newLayer = {
                id: Date.now(),
                name: `Layer ${imageLayers.length + 1}`,
                url: imageUrl,
                x: nativeWidth / 2,
                y: nativeHeight / 2,
                width: Math.min(img.naturalWidth, nativeWidth / 2),
                height: Math.min(img.naturalHeight, nativeHeight / 2),
                rotation: 0,
                zoom: 1,
                flipX: 1,
                flipY: 1,
                opacity: 100,
                hue: 0,
                saturation: 100,
                brightness: 100,
                contrast: 100,
                blur: 0,
                spread: 0,
                grayscale: 0,
                sepia: 0,
                visible: true,
                locked: false
            };
            setImageLayers(prev => [...prev, newLayer]);
            setSelectedLayers([newLayer.id]);
            addToHistory("Image layer imported.");
        };
        img.src = imageUrl;
        e.target.value = '';
    };

    const deleteLayer = (layerId, layerType) => {
        if (layerType === 'image') {
            setImageLayers(prev => prev.filter(layer => layer.id !== layerId));
            setSelectedLayers(prev => prev.filter(id => id !== layerId));
            if (selectedLayers.includes(layerId) && selectedLayers.length === 1) {
                setSelectedLayers(['base']);
            }
        } else if (layerType === 'drawing') {
            setDrawingLayers(prev => prev.filter(layer => layer.id !== layerId));
            setSelectedLayers(prev => prev.filter(id => id !== layerId));
            if (selectedLayers.includes(layerId) && selectedLayers.length === 1) {
                setSelectedLayers(['base']);
            }
        }
        addToHistory("Layer deleted.");
    };

    const moveLayer = (id, delta, layerType) => {
        if (layerType === 'image') {
            setImageLayers(prev => {
                const index = prev.findIndex(layer => layer.id === id);
                if (index === -1) return prev;
                const layer = prev[index];
                if (layer.locked) return prev;
                const newIndex = index + delta;
                if (newIndex < 0 || newIndex >= prev.length) return prev;
                const newPrev = [...prev];
                const temp = newPrev[newIndex];
                newPrev[newIndex] = newPrev[index];
                newPrev[index] = temp;
                return newPrev;
            });
        } else if (layerType === 'drawing') {
            setDrawingLayers(prev => {
                const index = prev.findIndex(layer => layer.id === id);
                if (index === -1) return prev;
                const layer = prev[index];
                if (layer.locked) return prev;
                const newIndex = index + delta;
                if (newIndex < 0 || newIndex >= prev.length) return prev;
                const newPrev = [...prev];
                const temp = newPrev[newIndex];
                newPrev[newIndex] = newPrev[index];
                newPrev[index] = temp;
                return newPrev;
            });
        }
        addToHistory("Layer order changed.");
    };

    const handleLayerSelect = (layerId, layerType, e) => {
        if (e && (e.ctrlKey || e.metaKey)) {
            if (layerType === 'base') {
                setSelectedLayers(prev => prev.includes('base') ? prev.filter(id => id !== 'base') : [...prev, 'base']);
            } else if (layerType === 'image' || layerType === 'drawing') {
                setSelectedLayers(prev => prev.includes(layerId) ? prev.filter(id => id !== layerId) : [...prev, layerId]);
            }
        } else {
            if (layerType === 'base') {
                setSelectedLayers(['base']);
            } else if (layerType === 'image' || layerType === 'drawing') {
                setSelectedLayers([layerId]);
            }
        }
        addToHistory("Layer selected.");
    };

    const applyHistoryState = (state) => {
        if (!state) return;

        preventHistoryUpdate.current = true;

        setUrl(state.url);

        if (state.isCropping !== undefined) setIsCropping(state.isCropping);
        if (state.actionMode !== undefined) setActionMode(state.actionMode);
        setMediaType(state.mediaType);
        setSvgContent(state.svgContent);
        setBaseZoom(state.baseZoom);
        setBaseRotation(state.baseRotation);
        setBaseFlipX(state.baseFlipX);
        setBaseFlipY(state.baseFlipY);
        setBaseHue(state.baseHue);
        setBaseSaturation(state.baseSaturation);
        setBaseBrightness(state.baseBrightness);
        setBaseContrast(state.baseContrast);
        setBaseOpacity(state.baseOpacity);
        setBaseBlur(state.baseBlur);
        setBaseSpread(state.baseSpread);
        setBaseGrayscale(state.baseGrayscale);
        setBaseSepia(state.baseSepia);
        setPanX(state.panX);
        setPanY(state.panY);
        setImageWidth(state.imageWidth);
        setImageHeight(state.imageHeight);
        setNativeWidth(state.nativeWidth);
        setNativeHeight(state.nativeHeight);
        setBorderRadius(state.borderRadius);
        setBorderTopLeftRadius(state.borderTopLeftRadius);
        setBorderTopRightRadius(state.borderTopRightRadius);
        setBorderBottomLeftRadius(state.borderBottomLeftRadius);
        setBorderBottomRightRadius(state.borderBottomRightRadius);
        setSyncCorners(state.syncCorners);
        setMaintainAspectRatio(state.maintainAspectRatio);
        setPaths(state.paths || []);
        setUndonePaths(state.undonePaths || []);
        setCropHistory(state.cropHistory || []);
        setIsCropDisabled(state.isCropDisabled);
        setCircleCrop(state.circleCrop);
        setBaseVisible(state.baseVisible);
        setBaseLocked(state.baseLocked);
        setImageLayers(state.imageLayers || []);
        setDrawingLayers(state.drawingLayers || []);
        setSelectedLayers(state.selectedLayers || ["base"]);

        if (state.shapeLayers) setShapeLayers(state.shapeLayers);
        if (state.adjustments) setAdjustments(state.adjustments);

        requestAnimationFrame(() => { preventHistoryUpdate.current = false; });
    };

    const undo = () => {
        if (currentHistoryIndex <= 0) return;

        const target = currentHistoryIndex - 1;

        setCurrentHistoryIndex(target);
        applyHistoryState(history[target]?.state);
        notifySaveStatus("Unsaved Changes");
    };

    const redo = () => {
        if (currentHistoryIndex >= history.length - 1) return;

        const target = currentHistoryIndex + 1;

        setCurrentHistoryIndex(target);
        applyHistoryState(history[target]?.state);
        notifySaveStatus("Unsaved Changes");
    };

    const undoCrop = () => {
        if (cropHistory.length > 0) {
            const previous = cropHistory[cropHistory.length - 1];
            setCropHistory(prev => prev.slice(0, prev.length - 1));
            setUrl(previous.url);
            setPanX(previous.panX);
            setPanY(previous.panY);
            setImageWidth(previous.imageWidth);
            setImageHeight(previous.imageHeight);
            setNativeWidth(previous.nativeWidth);
            setNativeHeight(previous.nativeHeight);
            setPaths(previous.paths);
            setUndonePaths(previous.undonePaths);
            setBaseVisible(previous.baseVisible);
            setBaseLocked(previous.baseLocked);
            setImageLayers(previous.imageLayers || []);
            setBaseHue(previous.hue || 0);
            setBaseSaturation(previous.saturation || 100);
            setBaseBrightness(previous.brightness || 100);
            setBaseContrast(previous.contrast || 100);
            setBaseOpacity(previous.opacity || 100);
            setBaseBlur(previous.blur || 0);
            setBaseSpread(previous.spread || 0);
            setBaseGrayscale(previous.grayscale || 0);
            setBaseSepia(previous.sepia || 0);
            setIsCropping(false);
            addToHistory("Crop undone.");
        }
    };

    const downloadImage = async () => {

        let fileTypeOptions = [
            { label: ".png", value: "png" },
            { label: ".jpg", value: "jpg" },
            { label: ".jpeg", value: "jpeg" },
            { label: ".webp", value: "webp" },
            { label: ".avif", value: "avif" },
            { label: ".bmp", value: "bmp" },
            { label: ".ico", value: "ico" }
        ];

        if (mediaType === "svg") {
            fileTypeOptions.push({ label: ".svg", value: "svg" });
        }

        const alertResult = await showDialog({
            title: "Select Image Type and Scale",
            message: "Select the image type and scale.",
            inputs: [
                { name: "fileType", type: "select", label: "Image Type", defaultValue: "png", options: fileTypeOptions },
                { name: "scale", type: "select", label: "Scale", defaultValue: "1x", options: [{ label: "1x", value: "1x" }, { label: "2x", value: "2x" }, { label: "3x", value: "3x" }] },
                { name: "quality", type: "select", label: "Quality", defaultValue: "92", options: [{ label: "100%", value: "100" }, { label: "92%", value: "92" }, { label: "80%", value: "80" }, { label: "60%", value: "60" }] }
            ],
            showCancel: true
        });

        if (!alertResult) return;

        const fileType = alertResult.fileType || "png";
        const scale = alertResult.scale || "1x";
        const scaleFactor = scale === "2x" ? 2 : scale === "3x" ? 3 : 1;
        const quality = Number(alertResult.quality || 92) / 100;
        const mimeType = EXPORT_MIME_TYPES[fileType] || "image/png";
        const fileNameBase = fileHandle.name ? fileHandle.name.replace(/\.\w+$/, "") : "edited_image";

        try {
            const canvas = await renderDocument(scaleFactor);
            let blob = await new Promise((resolve) => canvas.toBlob(resolve, mimeType, quality));

            if (blob && blob.type !== mimeType && mimeType !== "image/png") {
                await showDialog({
                    title: "Export Format Unavailable",
                    message: `This browser cannot write ${fileType.toUpperCase()} files, so the image was exported as PNG instead.`,
                    showCancel: false
                });
                blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
            }
            const link = document.createElement("a");
            const objectUrl = URL.createObjectURL(blob);

            link.href = objectUrl;
            link.download = `${fileNameBase}.${fileType}`;
            link.click();
            URL.revokeObjectURL(objectUrl);
        } catch (exportError) {
            await showDialog({ title: "Export Failed", message: exportError?.message || String(exportError), showCancel: false });
        }
    };

    const renderDocument = async (scaleFactor = 1) => compositeDocument({
        url,
        nativeWidth,
        nativeHeight,
        scaleFactor,
        baseVisible,
        baseFilters: filterStringFor({
            hue: baseHue,
            saturation: baseSaturation,
            brightness: baseBrightness,
            contrast: baseContrast,
            blur: baseBlur,
            grayscale: baseGrayscale,
            sepia: baseSepia,
            spread: baseSpread
        }),
        baseOpacity,
        baseRotation,
        baseFlipX,
        baseFlipY,
        radii: syncCorners
            ? [borderRadius, borderRadius, borderRadius, borderRadius]
            : [borderTopLeftRadius, borderTopRightRadius, borderBottomRightRadius, borderBottomLeftRadius],
        adjustments,
        imageLayers,
        paths: [
            ...paths.filter((entry) => entry.visible !== false),
            ...drawingLayers.filter((layer) => layer.visible !== false).map((layer) => ({
                d: layer.d,
                color: layer.color,
                width: layer.strokeWidth || layer.width || 3,
                visible: true
            }))
        ],
        shapeLayers
    });

    const notifySaveStatus = (status) => {
        setSaveBanner(status);
        onSaveStatusChange?.(status);
        onDirtyChange?.(status === "Unsaved Changes");

        if (saveBannerTimerRef.current) clearTimeout(saveBannerTimerRef.current);

        saveBannerTimerRef.current = setTimeout(() => setSaveBanner(null), 3000);
    };

    const handleSave = async () => {
        try {
            const writableHandle = fileHandle && typeof fileHandle.createWritable === "function"
                ? fileHandle
                : (window.showSaveFilePicker
                    ? await window.showSaveFilePicker({
                        suggestedName: fileHandle?.name || "edited_image.png",
                        types: [{
                            description: "Image",
                            accept: { "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"], "image/webp": [".webp"] }
                        }]
                    })
                    : null);

            if (!writableHandle) {
                throw new Error("This image cannot be written in place. Use Download to export a copy.");
            }

            if (writableHandle.queryPermission) {
                const state = await writableHandle.queryPermission({ mode: "readwrite" });

                if (state !== "granted") {
                    const granted = await writableHandle.requestPermission({ mode: "readwrite" });

                    if (granted !== "granted") throw new Error("Permission to write to this file was declined.");
                }
            }

            const extension = (writableHandle.name || fileHandle?.name || "").split(".").pop()?.toLowerCase();
            const mimeType = extension === "webp"
                ? "image/webp"
                : (extension === "jpg" || extension === "jpeg") ? "image/jpeg" : "image/png";
            const canvas = await renderDocument(1);
            const blob = await new Promise((resolve) => canvas.toBlob(resolve, mimeType, 0.95));
            const writable = await writableHandle.createWritable({ keepExistingData: false });

            await writable.write(blob);
            await writable.close();

            notifySaveStatus("Saved Changes");
        } catch (saveError) {
            await showDialog({ title: "Save Failed", message: saveError?.message || String(saveError), showCancel: false });
        }
    };

    const surfacePoint = (event) => {
        const surface = surfaceRef.current?.getBoundingClientRect();

        if (!surface) return null;

        return {
            x: (event.clientX - surface.left) / surface.width,
            y: (event.clientY - surface.top) / surface.height
        };
    };

    const handleShapePointerDown = (event) => {
        if (actionMode !== "Shape") return;

        const point = surfacePoint(event);

        if (!point) return;

        event.stopPropagation();

        const shape = {
            id: `shape-${Date.now()}`,
            kind: shapeKind,
            name: `${shapeKind.charAt(0).toUpperCase()}${shapeKind.slice(1)} ${shapeLayers.length + 1}`,
            x: point.x,
            y: point.y,
            x2: point.x,
            y2: point.y,
            color: shapeColor,
            fill: shapeFill,
            strokeWidth: shapeStrokeWidth,
            visible: true
        };

        shapeDraftRef.current = shape.id;
        setShapeLayers((previous) => [...previous, shape]);
    };

    const handleShapePointerMove = (event) => {
        if (!shapeDraftRef.current) return;

        const point = surfacePoint(event);

        if (!point) return;

        setShapeLayers((previous) => previous.map((shape) => (shape.id === shapeDraftRef.current
            ? { ...shape, x2: point.x, y2: point.y }
            : shape)));
    };

    const handleShapePointerUp = () => {
        if (!shapeDraftRef.current) return;

        shapeDraftRef.current = null;
        addToHistory("Shape added.");
    };

    const removeShapeLayer = (id) => {
        setShapeLayers((previous) => previous.filter((shape) => shape.id !== id));
        addToHistory("Shape removed.");
    };

    const updateAdjustment = (key, value) => {
        setAdjustments((previous) => ({ ...previous, [key]: value }));
        notifySaveStatus("Unsaved Changes");
    };

    const resetAdjustments = () => {
        setAdjustments({ ...BASE_ADJUSTMENTS });
        addToHistory("Adjustments reset.");
        notifySaveStatus("Unsaved Changes");
    };

    useEffect(() => {
        const onKeyDown = (event) => {
            const modifier = event.metaKey || event.ctrlKey;

            if (!modifier) return;

            const key = event.key.toLowerCase();

            if (key === "z") {
                event.preventDefault();
                event.stopPropagation();

                if (event.shiftKey) redo();
                else undo();

                return;
            }

            if (key === "y") {
                event.preventDefault();
                event.stopPropagation();
                redo();

                return;
            }

            if (key !== "s") return;

            event.preventDefault();
            event.stopPropagation();
            handleSave();
        };

        window.addEventListener("keydown", onKeyDown, true);

        return () => window.removeEventListener("keydown", onKeyDown, true);
    });

    const adjustmentsActive = Object.keys(BASE_ADJUSTMENTS).some((key) => adjustments[key] !== BASE_ADJUSTMENTS[key]);

    useEffect(() => {
        if (!adjustmentsActive || !url) return undefined;

        let cancelled = false;

        if (adjustmentFrameRef.current) clearTimeout(adjustmentFrameRef.current);

        adjustmentFrameRef.current = setTimeout(async () => {
            const canvas = adjustmentCanvasRef.current;

            if (!canvas) return;

            try {
                const element = await loadImageElement(url);

                if (cancelled) return;

                const ratio = window.devicePixelRatio || 1;
                const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
                const height = Math.max(1, Math.round(canvas.clientHeight * ratio));

                canvas.width = width;
                canvas.height = height;

                const context = canvas.getContext("2d", { willReadFrequently: true });

                context.clearRect(0, 0, width, height);
                context.filter = filterStringFor({
                    hue: baseHue,
                    saturation: baseSaturation,
                    brightness: baseBrightness,
                    contrast: baseContrast,
                    blur: baseBlur,
                    grayscale: baseGrayscale,
                    sepia: baseSepia
                });
                context.globalAlpha = baseOpacity / 100;
                context.drawImage(element, 0, 0, width, height);
                context.filter = "none";
                applyPixelAdjustments(context, width, height, adjustments);
            } catch (previewError) {
                return;
            }
        }, 90);

        return () => {
            cancelled = true;

            if (adjustmentFrameRef.current) clearTimeout(adjustmentFrameRef.current);
        };
    }, [adjustmentsActive, adjustments, url, baseHue, baseSaturation, baseBrightness, baseContrast, baseBlur, baseGrayscale, baseSepia, baseOpacity, imageWidth, imageHeight]);

    const handleDragStart = (e) => {
        if (actionMode !== "Idle") return;
        if (isCropping) return;
        if (!selectedLayers.includes('base')) return;
        draggingRef.current = true;
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleDragEnd = () => {
        if (draggingRef.current) {
            addToHistory("Image moved.");
        }
        draggingRef.current = false;
    };

    const handleDragMove = (e) => {
        if (!draggingRef.current) return;
        const dx = e.clientX - lastMousePosRef.current.x;
        const dy = e.clientY - lastMousePosRef.current.y;
        setPanX(prev => prev + dx);
        setPanY(prev => prev + dy);
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleResizeMouseDown = (corner, e) => {
        if (actionMode !== "Idle") return;
        if (isCropping) return;
        if (!selectedLayers.includes('base')) return;
        e.stopPropagation();
        e.preventDefault();
        setResizingCorner(corner);
        resizingRef.current = true;
        lastResizePosRef.current = { x: e.clientX, y: e.clientY };
        initialSizeRef.current = { width: imageWidth, height: imageHeight };
        initialPosRef.current = { x: panX, y: panY };
        if (maintainAspectRatio) {
            aspectRatioRef.current = imageWidth / imageHeight;
        }
    };

    const handleGlobalMouseMove = (e) => {
        if (!resizingRef.current) return;
        const dx = e.clientX - lastResizePosRef.current.x;
        const dy = e.clientY - lastResizePosRef.current.y;
        const rad = baseRotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const localDx = cos * dx + sin * dy;
        const localDy = -sin * dx + cos * dy;
        let newWidth = initialSizeRef.current.width;
        let newHeight = initialSizeRef.current.height;

        if (maintainAspectRatio) {
            const ratio = aspectRatioRef.current;
            if (resizingCorner === "bottom-right") {
                newWidth = initialSizeRef.current.width + localDx;
                newHeight = newWidth / ratio;
            } else if (resizingCorner === "bottom-left") {
                newWidth = initialSizeRef.current.width - localDx;
                newHeight = newWidth / ratio;
            } else if (resizingCorner === "top-right") {
                newWidth = initialSizeRef.current.width + localDx;
                newHeight = newWidth / ratio;
            } else if (resizingCorner === "top-left") {
                newWidth = initialSizeRef.current.width - localDx;
                newHeight = newWidth / ratio;
            }
        } else {
            if (resizingCorner === "bottom-right") {
                newWidth = initialSizeRef.current.width + localDx;
                newHeight = initialSizeRef.current.height + localDy;
            } else if (resizingCorner === "bottom-left") {
                newWidth = initialSizeRef.current.width - localDx;
                newHeight = initialSizeRef.current.height + localDy;
            } else if (resizingCorner === "top-right") {
                newWidth = initialSizeRef.current.width + localDx;
                newHeight = initialSizeRef.current.height - localDy;
            } else if (resizingCorner === "top-left") {
                newWidth = initialSizeRef.current.width - localDx;
                newHeight = initialSizeRef.current.height - localDy;
            }
        }
        newWidth = Math.max(newWidth, MIN_SIZE);
        newHeight = Math.max(newHeight, MIN_SIZE);
        setImageWidth(newWidth);
        setImageHeight(newHeight);
        setPanX(initialPosRef.current.x);
        setPanY(initialPosRef.current.y);
    };

    const handleGlobalMouseUp = () => {
        if (resizingRef.current) {
            addToHistory("Image resized.");
        }
        resizingRef.current = false;
        setResizingCorner(null);
    };

    const handleSvgMouseDown = (e) => {
        const { x, y } = getSvgPoint(e);
        if (actionMode === "Drawing" || actionMode === "Highlighting") {
            isDrawingRef.current = true;
            currentPathPoints.current = [{ x, y }];
            setUndonePaths([]);
        }
    };

    const handleSvgMouseMove = (e) => {
        if (isDrawingRef.current && (actionMode === "Drawing" || actionMode === "Highlighting")) {
            const { x, y } = getSvgPoint(e);
            currentPathPoints.current.push({ x, y });
            const pts = currentPathPoints.current;
            if (pts.length > 1) {
                let d = `M ${pts[0].x} ${pts[0].y}`;
                for (let i = 1; i < pts.length - 1; i++) {
                    let x_mid = (pts[i].x + pts[i + 1].x) / 2;
                    let y_mid = (pts[i].y + pts[i + 1].y) / 2;
                    d += ` Q ${pts[i].x} ${pts[i].y} ${x_mid} ${y_mid}`;
                }
                d += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
                setTempPath({
                    d,
                    color: actionMode === "Drawing" ? drawColor : highlightColor,
                    width: (actionMode === "Drawing" ? drawBrushSize : highlightBrushSize) * 3
                });
            }
        }
    };

    const handleSvgMouseUp = (e) => {
        if (isDrawingRef.current && (actionMode === "Drawing" || actionMode === "Highlighting")) {
            isDrawingRef.current = false;
            const pts = currentPathPoints.current;

            if (pts.length > 1) {
                let d = `M ${pts[0].x} ${pts[0].y}`;
                for (let i = 1; i < pts.length - 1; i++) {
                    let x_mid = (pts[i].x + pts[i + 1].x) / 2;
                    let y_mid = (pts[i].y + pts[i + 1].y) / 2;
                    d += ` Q ${pts[i].x} ${pts[i].y} ${x_mid} ${y_mid}`;
                }
                d += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;

                const newDrawingLayer = {
                    id: Date.now(),
                    name: `${actionMode === "Drawing" ? "Drawing" : "Highlight"} ${drawingLayers.length + 1}`,
                    type: actionMode.toLowerCase(),
                    d,
                    color: actionMode === "Drawing" ? drawColor : highlightColor,
                    strokeWidth: (actionMode === "Drawing" ? drawBrushSize : highlightBrushSize) * 3,
                    x: 0,
                    y: 0,
                    rotation: 0,
                    zoom: 1,
                    flipX: 1,
                    flipY: 1,
                    opacity: 100,
                    hue: 0,
                    saturation: 100,
                    brightness: 100,
                    contrast: 100,
                    blur: 0,
                    spread: 0,
                    grayscale: 0,
                    sepia: 0,
                    visible: true,
                    locked: false
                };

                setDrawingLayers(prev => [...prev, newDrawingLayer]);
                setSelectedLayers([newDrawingLayer.id]);
            }
            setTempPath(null);
            currentPathPoints.current = [];
            addToHistory(`${actionMode === "Drawing" ? "Drawing" : "Highlighting"} stroke added.`);
            notifySaveStatus("Unsaved Changes");
        }
    };

    const handleCropResizeMouseDown = (corner, e) => {
        e.stopPropagation();
        e.preventDefault();
        cropResizingRef.current = true;
        cropResizingCorner.current = corner;
        cropLastResizePosRef.current = { x: e.clientX, y: e.clientY };
        cropInitialRectRef.current = { ...cropRect };
    };

    const handleCropGlobalMouseMove = (e) => {
        if (!cropResizingRef.current) return;
        const dx = e.clientX - cropLastResizePosRef.current.x;
        const dy = e.clientY - cropLastResizePosRef.current.y;
        let { x, y, width, height } = cropInitialRectRef.current;

        if (cropResizingCorner.current === "bottom-right") {
            width += dx;
            height += dy;
        } else if (cropResizingCorner.current === "bottom-left") {
            x += dx;
            width -= dx;
            height += dy;
        } else if (cropResizingCorner.current === "top-right") {
            y += dy;
            width += dx;
            height -= dy;
        } else if (cropResizingCorner.current === "top-left") {
            x += dx;
            y += dy;
            width -= dx;
            height -= dy;
        }

        setCropRect({ x, y, width: Math.max(width, 10), height: Math.max(height, 10) });
    };

    const handleCropMouseDown = (e) => {
        e.stopPropagation();
        e.preventDefault();
        cropDraggingRef.current = true;
        lastCropDragPosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleCropMouseMove = (e) => {
        if (!cropDraggingRef.current) return;
        const dx = e.clientX - lastCropDragPosRef.current.x;
        const dy = e.clientY - lastCropDragPosRef.current.y;
        lastCropDragPosRef.current = { x: e.clientX, y: e.clientY };
        setCropRect(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
    };

    const handleCropMouseUp = () => {
        cropDraggingRef.current = false;
    };

    const handleCropRotationMouseDown = (e) => {
        e.stopPropagation();
        e.preventDefault();
        cropRotatingRef.current = true;
        const rect = e.currentTarget.parentElement.getBoundingClientRect();
        cropRotationCenter.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        const dx = e.clientX - cropRotationCenter.current.x;
        const dy = e.clientY - cropRotationCenter.current.y;
        cropRotationStartAngle.current = Math.atan2(dy, dx) * (180 / Math.PI);
        cropInitialRotation.current = cropRotation;
    };

    const handleCropGlobalMouseMoveRotation = (e) => {
        if (!cropRotatingRef.current) return;
        const dx = e.clientX - cropRotationCenter.current.x;
        const dy = e.clientY - cropRotationCenter.current.y;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        const deltaAngle = angle - cropRotationStartAngle.current;
        setCropRotation(cropInitialRotation.current + deltaAngle);
    };

    const handleCropGlobalMouseUpRotation = () => {
        cropRotatingRef.current = false;
    };

    const getBaseImageStyle = () => {
        return {
            width: "100%",
            height: "100%",
            filter: `hue-rotate(${baseHue}deg) saturate(${baseSaturation}%) brightness(${baseBrightness}%) contrast(${baseContrast}%) blur(${baseBlur}px) grayscale(${baseGrayscale}%) sepia(${baseSepia}%) ${baseSpread ? `drop-shadow(0 0 ${baseSpread}px rgba(0,0,0,0.5))` : ""}`,
            userSelect: "none",
            borderRadius: "inherit",
            opacity: baseOpacity / 100,
            transform: `scale(${baseFlipX}, ${baseFlipY})`,
            visibility: baseVisible ? "visible" : "hidden",
            cursor: actionMode === "Idle" ? "pointer" : "default"
        };
    };

    const getImageLayerStyle = (layer) => {
        return {
            position: "absolute",
            left: `${(layer.x / nativeWidth) * 100}%`,
            top: `${(layer.y / nativeHeight) * 100}%`,
            width: `${(layer.width / nativeWidth) * 100}%`,
            height: `${(layer.height / nativeHeight) * 100}%`,
            transform: `translate(-50%, -50%) rotate(${layer.rotation || 0}deg) scale(${(layer.zoom || 1) * (layer.flipX || 1)}, ${(layer.zoom || 1) * (layer.flipY || 1)})`,
            opacity: (layer.opacity || 100) / 100,
            cursor: actionMode === "Idle" ? (selectedLayers.includes(layer.id) ? "move" : "pointer") : "default",
            border: selectedLayers.includes(layer.id) && actionMode === "Idle" ? "2px dashed #5C2BE2" : "none",
            pointerEvents: layer.locked ? "none" : "auto",
            filter: `hue-rotate(${layer.hue || 0}deg) saturate(${layer.saturation || 100}%) brightness(${layer.brightness || 100}%) contrast(${layer.contrast || 100}%) blur(${layer.blur || 0}px) grayscale(${layer.grayscale || 0}%) sepia(${layer.sepia || 0}%) ${(layer.spread || 0) ? `drop-shadow(0 0 ${layer.spread}px rgba(0,0,0,0.5))` : ""}`
        };
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.types.includes('Files')) {
            e.dataTransfer.dropEffect = 'copy';
            setIsDraggingOver(true);
        }
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;
        if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
            setIsDraggingOver(false);
        }
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
        const files = Array.from(e.dataTransfer.files);
        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        if (imageFiles.length === 0) return;

        for (const file of imageFiles) {
            const imageUrl = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                const newLayer = {
                    id: Date.now() + Math.random(),
                    name: `Layer ${imageLayers.length + 1}`,
                    url: imageUrl,
                    x: nativeWidth / 2,
                    y: nativeHeight / 2,
                    width: Math.min(img.naturalWidth, nativeWidth / 2),
                    height: Math.min(img.naturalHeight, nativeHeight / 2),
                    rotation: 0,
                    zoom: 1,
                    flipX: 1,
                    flipY: 1,
                    opacity: 100,
                    hue: 0,
                    saturation: 100,
                    brightness: 100,
                    contrast: 100,
                    blur: 0,
                    spread: 0,
                    grayscale: 0,
                    sepia: 0,
                    visible: true,
                    locked: false
                };
                setImageLayers(prev => [...prev, newLayer]);
                setSelectedLayers([newLayer.id]);
                addToHistory("Image layer imported via drag and drop.");
            };
            img.src = imageUrl;
        }
    };

    const handleBaseImageClick = (e) => {
        if (actionMode === "Idle") {
            e.stopPropagation();
            if (e.ctrlKey || e.metaKey) {
                setSelectedLayers(prev => prev.includes('base') ? prev.filter(id => id !== 'base') : [...prev, 'base']);
            } else {
                setSelectedLayers(['base']);
            }
            addToHistory("Layer selected.");
        }
    };

    const handleImageLayerClick = (layerId, e) => {
        if (actionMode === "Idle") {
            e.stopPropagation();
            if (e.ctrlKey || e.metaKey) {
                setSelectedLayers(prev => prev.includes(layerId) ? prev.filter(id => id !== layerId) : [...prev, layerId]);
            } else {
                setSelectedLayers([layerId]);
            }
            addToHistory("Layer selected.");
        }
    };

    const handleImageLayerMouseDown = (layerId, e) => {
        if (actionMode !== "Idle") return;
        e.stopPropagation();
        if (e.ctrlKey || e.metaKey) {
            setSelectedLayers(prev => prev.includes(layerId) ? prev.filter(id => id !== layerId) : [...prev, layerId]);
        } else if (!selectedLayers.includes(layerId)) {
            setSelectedLayers([layerId]);
        }
        imageLayerDraggingRef.current = true;
        lastImageLayerPosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleImageLayerResizeMouseDown = (layerId, corner, e) => {
        if (actionMode !== "Idle") return;
        e.stopPropagation();
        e.preventDefault();
        if (!selectedLayers.includes(layerId)) {
            setSelectedLayers([layerId]);
        }
        setResizingImageLayer({ layerId, corner });
        imageLayerResizingRef.current = true;
        lastImageLayerPosRef.current = { x: e.clientX, y: e.clientY };
        const layer = imageLayers.find(l => l.id === layerId);
        if (layer) {
            initialImageLayerSizeRef.current = { width: layer.width, height: layer.height };
            initialImageLayerPosRef.current = { x: layer.x, y: layer.y };
        }
    };

    const handleImageLayerGlobalMouseMove = (e) => {
        if (imageLayerDraggingRef.current && selectedLayers.some(id => id !== 'base')) {
            const dx = e.clientX - lastImageLayerPosRef.current.x;
            const dy = e.clientY - lastImageLayerPosRef.current.y;
            setImageLayers(prev => prev.map(layer => selectedLayers.includes(layer.id) ? { ...layer, x: layer.x + dx, y: layer.y + dy } : layer));
            lastImageLayerPosRef.current = { x: e.clientX, y: e.clientY };
        }

        if (imageLayerResizingRef.current && resizingImageLayer) {
            const dx = e.clientX - lastImageLayerPosRef.current.x;
            const dy = e.clientY - lastImageLayerPosRef.current.y;
            setImageLayers(prev => prev.map(layer => {
                if (layer.id === resizingImageLayer.layerId) {
                    let newWidth = initialImageLayerSizeRef.current.width;
                    let newHeight = initialImageLayerSizeRef.current.height;
                    let newX = initialImageLayerPosRef.current.x;
                    let newY = initialImageLayerPosRef.current.y;

                    if (resizingImageLayer.corner === "bottom-right") {
                        newWidth += dx;
                        newHeight += dy;
                    } else if (resizingImageLayer.corner === "bottom-left") {
                        newWidth -= dx;
                        newHeight += dy;
                        newX += dx / 2;
                    } else if (resizingImageLayer.corner === "top-right") {
                        newWidth += dx;
                        newHeight -= dy;
                        newY += dy / 2;
                    } else if (resizingImageLayer.corner === "top-left") {
                        newWidth -= dx;
                        newHeight -= dy;
                        newX += dx / 2;
                        newY += dy / 2;
                    }

                    return { ...layer, width: Math.max(newWidth, 10), height: Math.max(newHeight, 10), x: newX, y: newY };
                }
                return layer;
            }));
        }
    };

    const handleImageLayerGlobalMouseUp = () => {
        if (imageLayerDraggingRef.current || imageLayerResizingRef.current) {
            addToHistory("Layer transformed.");
        }
        imageLayerDraggingRef.current = false;
        imageLayerResizingRef.current = false;
        setResizingImageLayer(null);
    };

    useEffect(() => {
        let objectUrl;
        const loadMedia = async () => {
            try {
                const file = typeof fileHandle.getFile === "function" ? await fileHandle.getFile() : fileHandle;
                objectUrl = URL.createObjectURL(file);
                setUrl(objectUrl);
                const extension = file.name.split(".").pop().toLowerCase();
                if (extension === "svg") {
                    setMediaType("svg");
                    const response = await fetch(objectUrl);
                    const svgText = await response.text();
                    setSvgContent(svgText);
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(svgText, "image/svg+xml");
                    const svgElement = doc.documentElement;
                    let svgWidth = parseFloat(svgElement.getAttribute("width"));
                    let svgHeight = parseFloat(svgElement.getAttribute("height"));
                    if (!svgWidth || !svgHeight) {
                        const viewBox = svgElement.getAttribute("viewBox");
                        if (viewBox) {
                            const vbValues = viewBox.split(" ");
                            svgWidth = parseFloat(vbValues[2]);
                            svgHeight = parseFloat(vbValues[3]);
                        }
                    }
                    setNativeWidth(svgWidth);
                    setNativeHeight(svgHeight);
                    calculateInitialSize(svgWidth, svgHeight);
                } else if (["png", "jpg", "jpeg", "gif", "bmp"].includes(extension)) {
                    setMediaType("image");
                    const img = new Image();
                    img.onload = () => {
                        setNativeWidth(img.naturalWidth);
                        setNativeHeight(img.naturalHeight);
                        calculateInitialSize(img.naturalWidth, img.naturalHeight);
                    };
                    img.src = objectUrl;
                }
            } catch (error) {
                return;
            }
        };
        loadMedia();
        setTimeout(() => {
            addToHistory("Image loaded.");
        }, 1000);
        return () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [fileHandle]);

    useEffect(() => {
        const normalizedRotation = baseRotation % 360;
        const isAtOriginalPosition = normalizedRotation === 0;
        if (isAtOriginalPosition && baseFlipX === 1 && baseFlipY === 1) {
            setIsCropDisabled(false);
        } else {
            setIsCropDisabled(true);
        }
    }, [baseRotation, baseFlipX, baseFlipY]);

    useEffect(() => {
        const onMouseMove = (e) => handleGlobalMouseMove(e);
        const onMouseUp = () => handleGlobalMouseUp();
        if (resizingRef.current) {
            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);
        }
        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, [resizingCorner]);

    useEffect(() => {
        const onMouseMove = (e) => handleCropGlobalMouseMove(e);
        const onMouseUp = () => { cropResizingRef.current = false; };
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, []);

    useEffect(() => {
        const onMouseMove = (e) => handleCropMouseMove(e);
        const onMouseUp = (e) => handleCropMouseUp(e);
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, []);

    useEffect(() => {
        window.addEventListener("mousemove", handleCropGlobalMouseMoveRotation);
        window.addEventListener("mouseup", handleCropGlobalMouseUpRotation);
        return () => {
            window.removeEventListener("mousemove", handleCropGlobalMouseMoveRotation);
            window.removeEventListener("mouseup", handleCropGlobalMouseUpRotation);
        };
    }, []);

    useEffect(() => {
        window.addEventListener("mousemove", handleImageLayerGlobalMouseMove);
        window.addEventListener("mouseup", handleImageLayerGlobalMouseUp);
        return () => {
            window.removeEventListener("mousemove", handleImageLayerGlobalMouseMove);
            window.removeEventListener("mouseup", handleImageLayerGlobalMouseUp);
        };
    }, [selectedLayers, resizingImageLayer]);

    return (
        <div className="imageImageEditorWrapper">
            <input type="file" ref={fileInputRef} onChange={handleImageImport} accept="image/*" style={{ display: 'none' }} />

            {saveBanner && <div className="imageImageEditorSaveBanner">{saveBanner}</div>}

            <div className="imageImageEditorToolbar">
                <div className={layersCollapsed ? "imageImageEditorCellWrapperLayersCollapsed" : "imageImageEditorCellWrapperLayers"}>
                    <div className="imageImageEditorHeaderFlexDark" style={{ marginBottom: 0 }}>
                        <label className="imageImageEditorCellTitle">
                            <FontAwesomeIcon icon={faLayerGroup} /> Layers
                        </label>
                        <div className="imageImageEditorCellFlexSupplement">
                            <Tippy content="Collapse Layers" theme="tooltip-light">
                                <button onClick={() => {setLayersCollpased(!layersCollapsed)}} className="imageImageEditorToolButtonHeader">
                                    <FontAwesomeIcon icon={layersCollapsed ? faChevronRight : faChevronDown} />
                                </button>
                            </Tippy>
                        </div>
                    </div>
                    <ul className="imageTextEditorLayerList" style={{ listStyleType: 'none' }}>
                        {drawingLayers.map(layer => (
                            <li key={`drawing-${layer.id}`} className="imageLayerItem" style={{ background: selectedLayers.includes(layer.id) ? "rgba(0,0,0,0.2)" : "" }} onClick={(e) => handleLayerSelect(layer.id, 'drawing', e)}>
                                <Tippy content="Rename Layer" theme="tooltip-light">
                                    <input className="imageImageEditorPositionInput" style={{ maxWidth: "100%" }} value={layer.name} onChange={(e) => {
                                        e.stopPropagation();
                                        setDrawingLayers(prev => prev.map(l => l.id === layer.id ? { ...l, name: e.target.value } : l));
                                        addToHistory("Layer name changed.");
                                    }} onClick={(e) => e.stopPropagation()} />
                                </Tippy>
                                <div className="imageTextEditorLayerListFlex">
                                    <Tippy content={layer.visible ? "Hide Layer" : "Show Layer"} theme="tooltip-light">
                                        <button onClick={(e) => { e.stopPropagation(); setDrawingLayers(prev => prev.map(l => l.id === layer.id ? { ...l, visible: !l.visible } : l)); addToHistory("Layer visibility changed."); }} className="imageImageEditorToolButton">
                                            <FontAwesomeIcon icon={layer.visible ? faEye : faEyeSlash} />
                                        </button>
                                    </Tippy>
                                    <Tippy content={layer.locked ? "Lock Layer" : "Unlock Layer"} theme="tooltip-light">
                                        <button onClick={(e) => { e.stopPropagation(); setDrawingLayers(prev => prev.map(l => l.id === layer.id ? { ...l, locked: !l.locked } : l)); addToHistory("Layer lock changed."); }} className="imageImageEditorToolButton">
                                            <FontAwesomeIcon icon={layer.locked ? faLock : faLockOpen} />
                                        </button>
                                    </Tippy>
                                    <Tippy content="Increase Layer Order" theme="tooltip-light">
                                        <button onClick={(e) => { e.stopPropagation(); moveLayer(layer.id, -1, 'drawing'); }} className="imageImageEditorToolButton">
                                            <FontAwesomeIcon icon={faArrowUp} />
                                        </button>
                                    </Tippy>
                                    <Tippy content="Decrease Layer Order" theme="tooltip-light">
                                        <button onClick={(e) => { e.stopPropagation(); moveLayer(layer.id, 1, 'drawing'); }} className="imageImageEditorToolButton">
                                            <FontAwesomeIcon icon={faArrowDown} />
                                        </button>
                                    </Tippy>
                                    <Tippy content="Delete Layer" theme="tooltip-light">
                                        <button onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id, 'drawing'); }} className="imageImageEditorToolButton">
                                            <FontAwesomeIcon icon={faTrash} />
                                        </button>
                                    </Tippy>
                                </div>
                            </li>
                        ))}
                        {imageLayers.map(layer => (
                            <li key={`image-${layer.id}`} style={{ background: selectedLayers.includes(layer.id) ? "rgba(0,0,0,0.2)" : "" }} onClick={(e) => handleLayerSelect(layer.id, 'image', e)}>
                                <Tippy content="Rename Layer" theme="tooltip-light">
                                    <input className="imageImageEditorPositionInput" style={{ maxWidth: "100%" }} value={layer.name} onChange={(e) => {
                                        e.stopPropagation();
                                        setImageLayers(prev => prev.map(l => l.id === layer.id ? { ...l, name: e.target.value } : l));
                                        addToHistory("Layer name changed.");
                                    }} onClick={(e) => e.stopPropagation()} />
                                </Tippy>
                                <div className="imageTextEditorLayerListFlex">
                                    <Tippy content={layer.visible ? "Hide Layer" : "Show Layer"} theme="tooltip-light">
                                        <button onClick={(e) => { e.stopPropagation(); setImageLayers(prev => prev.map(l => l.id === layer.id ? { ...l, visible: !l.visible } : l)); addToHistory("Layer visibility changed."); }} className="imageImageEditorToolButton">
                                            <FontAwesomeIcon icon={layer.visible ? faEye : faEyeSlash} />
                                        </button>
                                    </Tippy>
                                    <Tippy content={layer.locked ? "Lock Layer" : "Unlock Layer"} theme="tooltip-light">
                                        <button onClick={(e) => { e.stopPropagation(); setImageLayers(prev => prev.map(l => l.id === layer.id ? { ...l, locked: !l.locked } : l)); addToHistory("Layer lock changed."); }} className="imageImageEditorToolButton">
                                            <FontAwesomeIcon icon={layer.locked ? faLock : faLockOpen} />
                                        </button>
                                    </Tippy>
                                    <Tippy content="Increase Layer Order" theme="tooltip-light">
                                        <button onClick={(e) => { e.stopPropagation(); moveLayer(layer.id, -1, 'image'); }} className="imageImageEditorToolButton">
                                            <FontAwesomeIcon icon={faArrowUp} />
                                        </button>
                                    </Tippy>
                                    <Tippy content="Decrease Layer Order" theme="tooltip-light">
                                        <button onClick={(e) => { e.stopPropagation(); moveLayer(layer.id, 1, 'image'); }} className="imageImageEditorToolButton">
                                            <FontAwesomeIcon icon={faArrowDown} />
                                        </button>
                                    </Tippy>
                                    <Tippy content="Delete Layer" theme="tooltip-light">
                                        <button onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id, 'image'); }} className="imageImageEditorToolButton">
                                            <FontAwesomeIcon icon={faTrash} />
                                        </button>
                                    </Tippy>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className={layersCollapsed ? "imageImageEditorCellWrapperStackNonLayersLong" : "imageImageEditorCellWrapperStackNonLayers"}>
                    <div className="imageImageEditorHeaderFlexDark" style={{ marginBottom: 0, border: "none" }}>
                        <label className="imageImageEditorCellTitle">
                            <FontAwesomeIcon icon={faPenToSquare} /> Edit
                        </label>
                    </div>

                    <div className={!layoutCollapsed ? "imageImageEditorCellWrapper" : "imageImageEditorCellWrapperCollapsed"}>
                        <div className="imageImageEditorHeaderFlex">
                            <label className="imageImageEditorCellTitle">
                                <FontAwesomeIcon icon={faTabletScreenButton} /> Layout
                            </label>
                            <div className="imageImageEditorCellFlexSupplement">
                                {!layoutCollapsed && (
                                    <>
                                        <Tippy content="Reset Image" theme="tooltip-light">
                                            <button onClick={resetImage} className="imageImageEditorToolButtonHeader">
                                                <FontAwesomeIcon icon={faArrowsRotate} />
                                            </button>
                                        </Tippy>
                                        <Tippy content="Save Image" theme="tooltip-light">
                                            <button onClick={handleSave} className="imageImageEditorToolButtonHeader">
                                                <FontAwesomeIcon icon={faFloppyDisk} />
                                            </button>
                                        </Tippy>
                                        <Tippy content="Download Image" theme="tooltip-light">
                                            <button onClick={downloadImage} className="imageImageEditorToolButtonHeader">
                                                <FontAwesomeIcon icon={faDownload} />
                                            </button>
                                        </Tippy>
                                        <Tippy content="Import Image Layer" theme="tooltip-light">
                                            <button onClick={importImageLayer} className="imageImageEditorToolButtonHeader">
                                                <FontAwesomeIcon icon={faFileImport} />
                                            </button>
                                        </Tippy>
                                    </>
                                )}
                                <Tippy content="Collapse Layout" theme="tooltip-light">
                                    <button onClick={() => {setLayoutCollapsed(!layoutCollapsed)}} className="imageImageEditorToolButtonHeader">
                                        <FontAwesomeIcon icon={layoutCollapsed ? faChevronRight : faChevronDown} />
                                    </button>
                                </Tippy>
                            </div>
                        </div>
                        <div className="imageImageEditorCellGroup">
                        <div className="imageImageEditorCellFlexStack">
                            <label className="imageImageEditorCellFlexTitle"> Position </label>
                            <div className="imageImageEditorCellFlex">
                                <input className="imageImageEditorPositionInput" type="text" value={`X: ${panX}`} onChange={(e) => { const newValue = e.target.value.replace(/[^0-9.-]/g, ""); setPanX(Number(newValue)); addToHistory("Position changed."); }} />
                                <input className="imageImageEditorPositionInput" type="text" value={`Y: ${panY}`} onChange={(e) => { const newValue = e.target.value.replace(/[^0-9.-]/g, ""); setPanY(Number(newValue)); addToHistory("Position changed."); }} />
                            </div>
                        </div>
                        <div className="imageImageEditorCellFlexStack">
                            <div className="imageImageEditorCellFlex">
                                <Tippy content="Zoom In Selected" theme="tooltip-light">
                                    <button onClick={() => updateZoom(0.1)} className="imageImageEditorToolButton">
                                        <FontAwesomeIcon icon={faMagnifyingGlassPlus} />
                                    </button>
                                </Tippy>
                                <Tippy content="Zoom Out Selected" theme="tooltip-light">
                                    <button onClick={() => updateZoom(-0.1)} className="imageImageEditorToolButton">
                                        <FontAwesomeIcon icon={faMagnifyingGlassMinus} />
                                    </button>
                                </Tippy>
                                <Tippy content="Rotate Left Selected" theme="tooltip-light">
                                    <button onClick={() => updateRotation(-90)} className="imageImageEditorToolButton">
                                        <FontAwesomeIcon icon={faRotateLeft} />
                                    </button>
                                </Tippy>
                                <Tippy content="Rotate Right Selected" theme="tooltip-light">
                                    <button onClick={() => updateRotation(90)} className="imageImageEditorToolButton">
                                        <FontAwesomeIcon icon={faRotateRight} />
                                    </button>
                                </Tippy>
                                <Tippy content="Flip Horizontally Selected" theme="tooltip-light">
                                    <button onClick={() => updateFlip('x')} className="imageImageEditorToolButton">
                                        <FontAwesomeIcon icon={faLeftRight} />
                                    </button>
                                </Tippy>
                                <Tippy content="Flip Vertically Selected" theme="tooltip-light">
                                    <button onClick={() => updateFlip('y')} className="imageImageEditorToolButton">
                                        <FontAwesomeIcon icon={faUpDown} />
                                    </button>
                                </Tippy>
                            </div>
                        </div>
                        </div>
                    </div>

                    <div className={!dimensionsCollapsed ? "imageImageEditorCellWrapper" : "imageImageEditorCellWrapperCollapsed"}>
                        <div className="imageImageEditorHeaderFlex">
                            <label className="imageImageEditorCellTitle">
                                <FontAwesomeIcon icon={faRulerCombined} /> Dimensions
                            </label>
                            <div className="imageImageEditorCellFlexSupplement">
                                <Tippy content="Collapse Dimensions" theme="tooltip-light">
                                    <button onClick={() => {setDimensionsCollapsed(!dimensionsCollapsed)}} className="imageImageEditorToolButtonHeader">
                                        <FontAwesomeIcon icon={dimensionsCollapsed ? faChevronRight : faChevronDown} />
                                    </button>
                                </Tippy>
                            </div>
                        </div>
                        <div className="imageImageEditorCellGroup">
                        <div className="imageImageEditorCellFlexStack">
                            <label className="imageImageEditorCellFlexTitle"> Image Size </label>
                            <div className="imageImageEditorCellFlex">
                                <input className="imageImageEditorPositionInput" type="text" value={`W: ${Math.round(imageWidth)}px`} onChange={(e) => { const newValue = e.target.value.replace(/[^0-9.-]/g, ""); setImageWidth(Number(newValue)); addToHistory("Image size changed."); }} />
                                <input className="imageImageEditorPositionInput" type="text" value={`H: ${Math.round(imageHeight)}px`} onChange={(e) => { const newValue = e.target.value.replace(/[^0-9.-]/g, ""); setImageHeight(Number(newValue)); addToHistory("Image size changed."); }} />
                            </div>
                        </div>
                        <div className="imageImageEditorCellFlexStack">
                            <div className="imageImageEditorCellFlex">
                                <Tippy content="Restore Width Based Aspect Ratio" theme="tooltip-light">
                                    <button onClick={restoreAspectRatioWidth} className="imageImageEditorToolButton">
                                        <FontAwesomeIcon icon={faArrowsLeftRightToLine} />
                                    </button>
                                </Tippy>
                                <Tippy content="Restore Height Based Aspect Ratio" theme="tooltip-light">
                                    <button onClick={restoreAspectRatioHeight} className="imageImageEditorToolButton">
                                        <FontAwesomeIcon icon={faArrowsUpToLine} />
                                    </button>
                                </Tippy>
                                <Tippy content="Crop Image" theme="tooltip-light">
                                    <button onClick={async () => {
                                        if (actionMode === "Drawing" || actionMode === "Highlighting") return;
                                        if (isCropDisabled) return;
                                        if (isCropping) {
                                            const img = new Image();
                                            img.onload = () => {
                                                const offscreenCanvas = document.createElement("canvas");
                                                offscreenCanvas.width = nativeWidth;
                                                offscreenCanvas.height = nativeHeight;
                                                const offscreenCtx = offscreenCanvas.getContext("2d");

                                                if (baseVisible) {
                                                    offscreenCtx.filter = `hue-rotate(${baseHue}deg) saturate(${baseSaturation}%) brightness(${baseBrightness}%) contrast(${baseContrast}%) blur(${baseBlur}px) grayscale(${baseGrayscale}%) sepia(${baseSepia}%)`;
                                                    offscreenCtx.globalAlpha = baseOpacity / 100;
                                                    offscreenCtx.drawImage(img, 0, 0, nativeWidth, nativeHeight);
                                                    offscreenCtx.filter = 'none';
                                                    offscreenCtx.globalAlpha = 1;
                                                }

                                                imageLayers.filter(layer => layer.visible).forEach(layer => {
                                                    const layerImg = new Image();
                                                    layerImg.crossOrigin = "anonymous";
                                                    layerImg.onload = () => {
                                                        offscreenCtx.save();
                                                        offscreenCtx.filter = `hue-rotate(${layer.hue || 0}deg) saturate(${layer.saturation || 100}%) brightness(${layer.brightness || 100}%) contrast(${layer.contrast || 100}%) blur(${layer.blur || 0}px) grayscale(${layer.grayscale || 0}%) sepia(${layer.sepia || 0}%)`;
                                                        offscreenCtx.globalAlpha = (layer.opacity || 100) / 100;
                                                        offscreenCtx.translate(layer.x, layer.y);
                                                        offscreenCtx.rotate((layer.rotation || 0) * Math.PI / 180);
                                                        offscreenCtx.drawImage(layerImg, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
                                                        offscreenCtx.restore();
                                                    };
                                                    layerImg.src = layer.url;
                                                });

                                                const scaleX = nativeWidth / imageWidth;
                                                const scaleY = nativeHeight / imageHeight;
                                                const cropCenterX = (cropRect.x + cropRect.width / 2) * scaleX;
                                                const cropCenterY = (cropRect.y + cropRect.height / 2) * scaleY;
                                                const halfWidth = (cropRect.width * scaleX) / 2;
                                                const halfHeight = (cropRect.height * scaleY) / 2;
                                                const radians = (cropRotation * Math.PI) / 180;
                                                const cosine = Math.cos(radians);
                                                const sine = Math.sin(radians);
                                                const corners = [
                                                    [-halfWidth, -halfHeight],
                                                    [halfWidth, -halfHeight],
                                                    [halfWidth, halfHeight],
                                                    [-halfWidth, halfHeight]
                                                ].map(([cornerX, cornerY]) => ({
                                                    x: cropCenterX + cornerX * cosine - cornerY * sine,
                                                    y: cropCenterY + cornerX * sine + cornerY * cosine
                                                }));
                                                const boundsLeft = Math.min(...corners.map((corner) => corner.x));
                                                const boundsTop = Math.min(...corners.map((corner) => corner.y));
                                                const boundsRight = Math.max(...corners.map((corner) => corner.x));
                                                const boundsBottom = Math.max(...corners.map((corner) => corner.y));
                                                const canvasCrop = document.createElement("canvas");

                                                canvasCrop.width = Math.max(1, Math.round(boundsRight - boundsLeft));
                                                canvasCrop.height = Math.max(1, Math.round(boundsBottom - boundsTop));

                                                const ctxCrop = canvasCrop.getContext("2d");

                                                ctxCrop.drawImage(offscreenCanvas, -boundsLeft, -boundsTop);
                                                ctxCrop.globalCompositeOperation = "destination-in";
                                                ctxCrop.beginPath();

                                                if (circleCrop) {
                                                    ctxCrop.ellipse(
                                                        cropCenterX - boundsLeft,
                                                        cropCenterY - boundsTop,
                                                        halfWidth,
                                                        halfHeight,
                                                        radians,
                                                        0,
                                                        Math.PI * 2
                                                    );
                                                } else {
                                                    corners.forEach((corner, index) => {
                                                        const pointX = corner.x - boundsLeft;
                                                        const pointY = corner.y - boundsTop;

                                                        if (index === 0) ctxCrop.moveTo(pointX, pointY);
                                                        else ctxCrop.lineTo(pointX, pointY);
                                                    });
                                                    ctxCrop.closePath();
                                                }

                                                ctxCrop.fill();
                                                ctxCrop.globalCompositeOperation = "source-over";

                                                const newDataUrl = canvasCrop.toDataURL();

                                                setCropHistory(prev => [...prev, { url, panX, panY, imageWidth, imageHeight, nativeWidth, nativeHeight, paths, undonePaths, baseVisible, baseLocked, imageLayers, hue: baseHue, saturation: baseSaturation, brightness: baseBrightness, contrast: baseContrast, opacity: baseOpacity, blur: baseBlur, spread: baseSpread, grayscale: baseGrayscale, sepia: baseSepia }]);
                                                setUrl(newDataUrl);
                                                setPanX(0);
                                                setPanY(0);
                                                setImageWidth(canvasCrop.width / scaleX);
                                                setImageHeight(canvasCrop.height / scaleY);
                                                setNativeWidth(canvasCrop.width);
                                                setNativeHeight(canvasCrop.height);
                                                setIsCropping(false);
                                                setCropRotation(0);
                                                setPaths([]);
                                                setUndonePaths([]);
                                                setImageLayers([]);
                                                setSelectedLayers(['base']);
                                                setIsDrawColorOpen(false);
                                                setIsHighlightColorOpen(false);
                                                setActionMode("Idle");
                                                setDrawingLayers([]);
                                                addToHistory("Image cropped.", {
                                                    url: newDataUrl,
                                                    panX: 0,
                                                    panY: 0,
                                                    imageWidth: canvasCrop.width / scaleX,
                                                    imageHeight: canvasCrop.height / scaleY,
                                                    nativeWidth: canvasCrop.width,
                                                    nativeHeight: canvasCrop.height,
                                                    paths: [],
                                                    undonePaths: [],
                                                    imageLayers: [],
                                                    selectedLayers: ["base"],
                                                    isCropping: false,
                                                    actionMode: "Idle"
                                                });
                                            };
                                            img.src = url;
                                        } else {
                                            setCropRect({ x: 0, y: 0, width: imageWidth, height: imageHeight });
                                            setIsCropping(true);
                                            setCircleCrop(false);
                                            setIsDrawColorOpen(false);
                                            setIsHighlightColorOpen(false);
                                            setActionMode("Cropping");
                                            addToHistory("Crop mode enabled.");
                                        }
                                    }}
                                        disabled={(isCropDisabled || actionMode === "Drawing" || actionMode === "Highlighting")}
                                        style={{ opacity: (isCropDisabled || actionMode === "Drawing" || actionMode === "Highlighting") ? "0.6" : "1.0", background: isCropping ? "#5C2BE2" : "" }}
                                        className="imageImageEditorToolButton"
                                    >
                                        <FontAwesomeIcon icon={faCropSimple} />
                                    </button>
                                </Tippy>
                                {isCropping && (
                                    <Tippy content="Circle Crop" theme="tooltip-light">
                                        <button onClick={() => { setCircleCrop(prev => !prev); addToHistory("Circle crop toggled."); }} style={{ background: circleCrop ? "#5C2BE2" : "" }} className="imageImageEditorToolButton" >
                                            <FontAwesomeIcon icon={faCircle} />
                                        </button>
                                    </Tippy>
                                )}
                            </div>
                            <div className="imageImageEditorCellFlex">
                                <label className="imageConfrmationCheck">
                                    <input type="checkbox" className="imageSettingsCheckbox" checked={maintainAspectRatio} onChange={(e) => { setMaintainAspectRatio(e.target.checked); addToHistory("Aspect ratio setting changed."); }} />
                                    <span> Preserve Aspect Ratio </span>
                                </label>
                            </div>
                        </div>
                        {isCropping && (
                            <div className="imageImageEditorCellFlexStack">
                                <label className="imageImageEditorCellFlexTitle"> Crop Presets </label>
                                <div className="imageImageEditorCellFlex">
                                    <button className="imageImageEditorToolButtonText" onClick={() => { setCropRect(prev => ({ ...prev, height: prev.width })); addToHistory("Crop preset applied."); }}>1:1</button>
                                    <button className="imageImageEditorToolButtonText" onClick={() => { setCropRect(prev => ({ ...prev, height: prev.width * (3 / 4) })); addToHistory("Crop preset applied."); }}>4:3</button>
                                    <button className="imageImageEditorToolButtonText" onClick={() => { setCropRect(prev => ({ ...prev, height: prev.width * (9 / 16) })); addToHistory("Crop preset applied."); }}>16:9</button>
                                </div>
                            </div>
                        )}
                        </div>
                    </div>

                    <div className={!stylesCollapsed ? "imageImageEditorCellWrapper" : "imageImageEditorCellWrapperCollapsed"}>
                        <div className="imageImageEditorHeaderFlex">
                            <label className="imageImageEditorCellTitle">
                                <FontAwesomeIcon icon={faSwatchbook} /> Styles
                            </label>
                            <div className="imageImageEditorCellFlexSupplement">
                                <Tippy content="Collapse Styles" theme="tooltip-light">
                                    <button onClick={() => {setStylesCollapsed(!stylesCollapsed)}} className="imageImageEditorToolButtonHeader">
                                        <FontAwesomeIcon icon={stylesCollapsed ? faChevronRight : faChevronDown} />
                                    </button>
                                </Tippy>
                            </div>
                        </div>
                        <div className="imageImageEditorCellGroup">

                        <div className="imageImageEditorCellFlexStack">
                            <label className="imageImageEditorCellFlexTitle">Opacity</label>
                            <div className="imageImageEditorCellFlex">
                                <button onClick={() => { updateFilter('opacity', Math.max(currentValues.opacity - 10, 0)); setTimeout(() => addToHistory("Filter applied."), 10); }} className="imageImageEditorToolButton">
                                    <FontAwesomeIcon icon={faMinus} />
                                </button>
                                <div className="imageImageEditorSliderWrapper">
                                    <input className="imageImageEditorSlider" type="range" min={0} max={100} value={currentValues.opacity} onInput={(e) => { updateFilter('opacity', Number(e.target.value)); setTimeout(() => addToHistory("Filter applied."), 10); }} onChange={(e) => { updateFilter('opacity', Number(e.target.value)); setTimeout(() => addToHistory("Filter applied."), 10); }} />
                                </div>
                                <button onClick={() => { updateFilter('opacity', Math.min(currentValues.opacity + 10, 100)); setTimeout(() => addToHistory("Filter applied."), 10); }} className="imageImageEditorToolButton">
                                    <FontAwesomeIcon icon={faPlus} />
                                </button>
                            </div>
                        </div>

                        <div className="imageImageEditorCellFlexStack">
                            <label className="imageImageEditorCellFlexTitle">Hue</label>
                            <div className="imageImageEditorCellFlex">
                                <button onClick={() => { updateFilter('hue', Math.max(currentValues.hue - 10, -180)); setTimeout(() => addToHistory("Filter applied."), 10); }} className="imageImageEditorToolButton">
                                    <FontAwesomeIcon icon={faMinus} />
                                </button>
                                <div className="imageImageEditorSliderWrapper">
                                    <input className="imageImageEditorSlider" type="range" min={-180} max={180} value={currentValues.hue} onInput={(e) => { updateFilter('hue', Number(e.target.value)); setTimeout(() => addToHistory("Filter applied."), 10); }} onChange={(e) => { updateFilter('hue', Number(e.target.value)); setTimeout(() => addToHistory("Filter applied."), 10); }} />
                                </div>
                                <button onClick={() => { updateFilter('hue', Math.min(currentValues.hue + 10, 180)); setTimeout(() => addToHistory("Filter applied."), 10); }} className="imageImageEditorToolButton">
                                    <FontAwesomeIcon icon={faPlus} />
                                </button>
                            </div>
                        </div>

                        <div className="imageImageEditorCellFlexStack">
                            <label className="imageImageEditorCellFlexTitle">Saturation</label>
                            <div className="imageImageEditorCellFlex">
                                <button onClick={() => { updateFilter('saturation', Math.max(currentValues.saturation - 10, 0)); setTimeout(() => addToHistory("Filter applied."), 10); }} className="imageImageEditorToolButton">
                                    <FontAwesomeIcon icon={faMinus} />
                                </button>
                                <div className="imageImageEditorSliderWrapper">
                                    <input className="imageImageEditorSlider" type="range" min={0} max={200} value={currentValues.saturation} onInput={(e) => { updateFilter('saturation', Number(e.target.value)); setTimeout(() => addToHistory("Filter applied."), 10); }} onChange={(e) => { updateFilter('saturation', Number(e.target.value)); setTimeout(() => addToHistory("Filter applied."), 10); }} />
                                </div>
                                <button onClick={() => { updateFilter('saturation', Math.min(currentValues.saturation + 10, 200)); setTimeout(() => addToHistory("Filter applied."), 10); }} className="imageImageEditorToolButton">
                                    <FontAwesomeIcon icon={faPlus} />
                                </button>
                            </div>
                        </div>

                        <div className="imageImageEditorCellFlexStack">
                            <label className="imageImageEditorCellFlexTitle">Brightness</label>
                            <div className="imageImageEditorCellFlex">
                                <button onClick={() => { updateFilter('brightness', Math.max(currentValues.brightness - 10, 0)); setTimeout(() => addToHistory("Filter applied."), 10); }} className="imageImageEditorToolButton">
                                    <FontAwesomeIcon icon={faMinus} />
                                </button>
                                <div className="imageImageEditorSliderWrapper">
                                    <input className="imageImageEditorSlider" type="range" min={0} max={200} value={currentValues.brightness} onInput={(e) => { updateFilter('brightness', Number(e.target.value)); setTimeout(() => addToHistory("Filter applied."), 10); }} onChange={(e) => { updateFilter('brightness', Number(e.target.value)); setTimeout(() => addToHistory("Filter applied."), 10); }} />
                                </div>
                                <button onClick={() => { updateFilter('brightness', Math.min(currentValues.brightness + 10, 200)); setTimeout(() => addToHistory("Filter applied."), 10); }} className="imageImageEditorToolButton">
                                    <FontAwesomeIcon icon={faPlus} />
                                </button>
                            </div>
                        </div>

                        <div className="imageImageEditorCellFlexStack">
                            <label className="imageImageEditorCellFlexTitle">Contrast</label>
                            <div className="imageImageEditorCellFlex">
                                <button onClick={() => { updateFilter('contrast', Math.max(currentValues.contrast - 10, 0)); setTimeout(() => addToHistory("Filter applied."), 10); }} className="imageImageEditorToolButton">
                                    <FontAwesomeIcon icon={faMinus} />
                                </button>
                                <div className="imageImageEditorSliderWrapper">
                                    <input className="imageImageEditorSlider" type="range" min={0} max={200} value={currentValues.contrast} onInput={(e) => { updateFilter('contrast', Number(e.target.value)); setTimeout(() => addToHistory("Filter applied."), 10); }} onChange={(e) => { updateFilter('contrast', Number(e.target.value)); setTimeout(() => addToHistory("Filter applied."), 10); }} />
                                </div>
                                <button onClick={() => { updateFilter('contrast', Math.min(currentValues.contrast + 10, 200)); setTimeout(() => addToHistory("Filter applied."), 10); }} className="imageImageEditorToolButton">
                                    <FontAwesomeIcon icon={faPlus} />
                                </button>
                            </div>
                        </div>

                        <div className="imageImageEditorCellFlexStack">
                            <label className="imageImageEditorCellFlexTitle">Blur</label>
                            <div className="imageImageEditorCellFlex">
                                <button onClick={() => { updateFilter('blur', Math.max(currentValues.blur - 1, 0)); setTimeout(() => addToHistory("Filter applied."), 10); }} className="imageImageEditorToolButton">
                                    <FontAwesomeIcon icon={faMinus} />
                                </button>
                                <div className="imageImageEditorSliderWrapper">
                                    <input className="imageImageEditorSlider" type="range" min={0} max={100} value={currentValues.blur} onInput={(e) => { updateFilter('blur', Number(e.target.value)); setTimeout(() => addToHistory("Filter applied."), 10); }} onChange={(e) => { updateFilter('blur', Number(e.target.value)); setTimeout(() => addToHistory("Filter applied."), 10); }} />
                                </div>
                                <button onClick={() => { updateFilter('blur', Math.min(currentValues.blur + 1, 100)); setTimeout(() => addToHistory("Filter applied."), 10); }} className="imageImageEditorToolButton">
                                    <FontAwesomeIcon icon={faPlus} />
                                </button>
                            </div>
                        </div>

                        <div className="imageImageEditorCellFlexStack">
                            <label className="imageImageEditorCellFlexTitle">Shadow</label>
                            <div className="imageImageEditorCellFlex">
                                <button onClick={() => { updateFilter('spread', Math.max(currentValues.spread - 1, 0)); setTimeout(() => addToHistory("Filter applied."), 10); }} className="imageImageEditorToolButton">
                                    <FontAwesomeIcon icon={faMinus} />
                                </button>
                                <div className="imageImageEditorSliderWrapper">
                                    <input className="imageImageEditorSlider" type="range" min={0} max={100} value={currentValues.spread} onInput={(e) => { updateFilter('spread', Number(e.target.value)); setTimeout(() => addToHistory("Filter applied."), 10); }} onChange={(e) => { updateFilter('spread', Number(e.target.value)); setTimeout(() => addToHistory("Filter applied."), 10); }} />
                                </div>
                                <button onClick={() => { updateFilter('spread', Math.min(currentValues.spread + 1, 100)); setTimeout(() => addToHistory("Filter applied."), 10); }} className="imageImageEditorToolButton">
                                    <FontAwesomeIcon icon={faPlus} />
                                </button>
                            </div>
                        </div>

                        <div className="imageImageEditorCellFlexStack">
                            <label className="imageImageEditorCellFlexTitle">Grayscale</label>
                            <div className="imageImageEditorCellFlex">
                                <button onClick={() => { updateFilter('grayscale', Math.max(currentValues.grayscale - 10, 0)); setTimeout(() => addToHistory("Filter applied."), 10); }} className="imageImageEditorToolButton">
                                    <FontAwesomeIcon icon={faMinus} />
                                </button>
                                <div className="imageImageEditorSliderWrapper">
                                    <input className="imageImageEditorSlider" type="range" min={0} max={100} value={currentValues.grayscale} onInput={(e) => { updateFilter('grayscale', Number(e.target.value)); setTimeout(() => addToHistory("Filter applied."), 10); }} onChange={(e) => { updateFilter('grayscale', Number(e.target.value)); setTimeout(() => addToHistory("Filter applied."), 10); }} />
                                </div>
                                <button onClick={() => { updateFilter('grayscale', Math.min(currentValues.grayscale + 10, 100)); setTimeout(() => addToHistory("Filter applied."), 10); }} className="imageImageEditorToolButton">
                                    <FontAwesomeIcon icon={faPlus} />
                                </button>
                            </div>
                        </div>

                        <div className="imageImageEditorCellFlexStack">
                            <label className="imageImageEditorCellFlexTitle">Sepia</label>
                            <div className="imageImageEditorCellFlex">
                                <button onClick={() => { updateFilter('sepia', Math.max(currentValues.sepia - 10, 0)); setTimeout(() => addToHistory("Filter applied."), 10); }} className="imageImageEditorToolButton">
                                    <FontAwesomeIcon icon={faMinus} />
                                </button>
                                <div className="imageImageEditorSliderWrapper">
                                    <input className="imageImageEditorSlider" type="range" min={0} max={100} value={currentValues.sepia} onInput={(e) => { updateFilter('sepia', Number(e.target.value)); setTimeout(() => addToHistory("Filter applied."), 10); }} onChange={(e) => { updateFilter('sepia', Number(e.target.value)); setTimeout(() => addToHistory("Filter applied."), 10); }} />
                                </div>
                                <button onClick={() => { updateFilter('sepia', Math.min(currentValues.sepia + 10, 100)); setTimeout(() => addToHistory("Filter applied."), 10); }} className="imageImageEditorToolButton">
                                    <FontAwesomeIcon icon={faPlus} />
                                </button>
                            </div>
                        </div>
                        </div>
                    </div>

                    <div className={!insertCollapsed ? "imageImageEditorCellWrapper" : "imageImageEditorCellWrapperCollapsed"}>
                        <div className="imageImageEditorHeaderFlex">
                            <label className="imageImageEditorCellTitle">
                                <FontAwesomeIcon icon={faFont} /> Insert
                            </label>
                            <div className="imageImageEditorCellFlexSupplement">
                                <Tippy content="Collapse Insert" theme="tooltip-light">
                                    <button onClick={() => setInsertCollapsed(!insertCollapsed)} className="imageImageEditorToolButtonHeader">
                                        <FontAwesomeIcon icon={insertCollapsed ? faChevronRight : faChevronDown} />
                                    </button>
                                </Tippy>
                            </div>
                        </div>
                        <div className="imageImageEditorCellGroup">
                                <div className="imageImageEditorCellFlexStack">
                                    <label className="imageImageEditorCellFlexTitle">Shape Tool</label>
                                    <div className="imageImageEditorCellFlex">
                                        <button
                                            onClick={() => setActionMode((previous) => (previous === "Shape" ? "Idle" : "Shape"))}
                                            style={{ background: actionMode === "Shape" ? "#5C2BE2" : "" }}
                                            className="imageImageEditorToolButtonBig"
                                        >
                                            <FontAwesomeIcon icon={faShapes} /> Draw Shape
                                        </button>
                                        <Tippy
                                            content={<ColorPicker color={shapeColor} onChange={setShapeColor} />}
                                            visible={isShapeColorOpen}
                                            onClickOutside={() => setIsShapeColorOpen(false)}
                                            interactive={true}
                                            placement="top"
                                            className="color-picker-tippy"
                                            appendTo={() => document.body}
                                        >
                                            <button onClick={() => setIsShapeColorOpen(!isShapeColorOpen)} className="imageImageEditorToolButton" style={{ color: shapeColor }}>
                                                <FontAwesomeIcon icon={faSwatchbook} />
                                            </button>
                                        </Tippy>
                                    </div>
                                </div>

                            <div className="imageImageEditorCellFlexStack">
                                <label className="imageImageEditorCellFlexTitle">Shape Type</label>
                                <div className="imageImageEditorCellFlex">
                                    {[
                                        { kind: "rectangle", icon: faSquare, label: "Rectangle" },
                                        { kind: "ellipse", icon: faCircle, label: "Ellipse" },
                                        { kind: "line", icon: faMinus, label: "Line" },
                                        { kind: "arrow", icon: faArrowRight, label: "Arrow" }
                                    ].map((entry) => (
                                        <Tippy key={entry.kind} content={entry.label} theme="tooltip-light">
                                            <button
                                                className="imageImageEditorToolButton"
                                                style={{ background: shapeKind === entry.kind ? "#5C2BE2" : "" }}
                                                onClick={() => setShapeKind(entry.kind)}
                                            >
                                                <FontAwesomeIcon icon={entry.icon} />
                                            </button>
                                        </Tippy>
                                    ))}
                                </div>
                            </div>

                            <div className="imageImageEditorCellFlexStack">
                                <label className="imageImageEditorCellFlexTitle">Shape Weight</label>
                                <div className="imageImageEditorCellFlex">
                                    <button onClick={() => setShapeStrokeWidth(Math.max(1, shapeStrokeWidth - 1))} className="imageImageEditorToolButton">
                                        <FontAwesomeIcon icon={faMinus} />
                                    </button>
                                    <div className="imageImageEditorSliderWrapper">
                                        <input className="imageImageEditorSlider" type="range" min={1} max={24} value={shapeStrokeWidth} onChange={(e) => setShapeStrokeWidth(Number(e.target.value))} />
                                    </div>
                                    <button onClick={() => setShapeStrokeWidth(Math.min(24, shapeStrokeWidth + 1))} className="imageImageEditorToolButton">
                                        <FontAwesomeIcon icon={faPlus} />
                                    </button>
                                </div>
                            </div>

                            <div className="imageImageEditorCellFlexStack">
                                <label className="imageImageEditorCellFlexTitle">Shape Fill</label>
                                <div className="imageImageEditorCellFlex">
                                    <button
                                        onClick={() => setShapeFill("transparent")}
                                        style={{ background: shapeFill === "transparent" ? "#5C2BE2" : "" }}
                                        className="imageImageEditorToolButtonBig"
                                    >
                                        No Fill
                                    </button>
                                    <button
                                        onClick={() => setShapeFill(shapeColor)}
                                        style={{ background: shapeFill !== "transparent" ? "#5C2BE2" : "" }}
                                        className="imageImageEditorToolButtonBig"
                                    >
                                        Solid Fill
                                    </button>
                                </div>
                            </div>
                        </div>

                    </div>



                        <div className={!adjustmentsCollapsed ? "imageImageEditorCellWrapper" : "imageImageEditorCellWrapperCollapsed"}>
                            <div className="imageImageEditorHeaderFlex">
                                <label className="imageImageEditorCellTitle">
                                    <FontAwesomeIcon icon={faSliders} /> Adjustments
                                </label>
                                <div className="imageImageEditorCellFlexSupplement">
                                    <Tippy content="Collapse Adjustments" theme="tooltip-light">
                                        <button onClick={() => setAdjustmentsCollapsed(!adjustmentsCollapsed)} className="imageImageEditorToolButtonHeader">
                                            <FontAwesomeIcon icon={adjustmentsCollapsed ? faChevronRight : faChevronDown} />
                                        </button>
                                    </Tippy>
                                </div>
                            </div>

                            <div className="imageImageEditorCellGroup">
                                <div className="imageImageEditorCellFlexStack">
                                    <label className="imageImageEditorCellFlexTitle">Black Point</label>
                                    <div className="imageImageEditorCellFlex">
                                        <button onClick={() => updateAdjustment("blackPoint", Math.max(0, Number((adjustments.blackPoint - 1).toFixed(2))))} className="imageImageEditorToolButton">
                                            <FontAwesomeIcon icon={faMinus} />
                                        </button>
                                        <div className="imageImageEditorSliderWrapper">
                                            <input className="imageImageEditorSlider" type="range" min={0} max={254} step={1} value={adjustments.blackPoint} onChange={(e) => updateAdjustment("blackPoint", Number(e.target.value))} onMouseUp={() => addToHistory("Black Point changed.")} />
                                        </div>
                                        <button onClick={() => updateAdjustment("blackPoint", Math.min(254, Number((adjustments.blackPoint + 1).toFixed(2))))} className="imageImageEditorToolButton">
                                            <FontAwesomeIcon icon={faPlus} />
                                        </button>
                                    </div>
                                </div>

                            <div className="imageImageEditorCellFlexStack">
                                <label className="imageImageEditorCellFlexTitle">White Point</label>
                                <div className="imageImageEditorCellFlex">
                                    <button onClick={() => updateAdjustment("whitePoint", Math.max(1, Number((adjustments.whitePoint - 1).toFixed(2))))} className="imageImageEditorToolButton">
                                        <FontAwesomeIcon icon={faMinus} />
                                    </button>
                                    <div className="imageImageEditorSliderWrapper">
                                        <input className="imageImageEditorSlider" type="range" min={1} max={255} step={1} value={adjustments.whitePoint} onChange={(e) => updateAdjustment("whitePoint", Number(e.target.value))} onMouseUp={() => addToHistory("White Point changed.")} />
                                    </div>
                                    <button onClick={() => updateAdjustment("whitePoint", Math.min(255, Number((adjustments.whitePoint + 1).toFixed(2))))} className="imageImageEditorToolButton">
                                        <FontAwesomeIcon icon={faPlus} />
                                    </button>
                                </div>
                            </div>

                            <div className="imageImageEditorCellFlexStack">
                                <label className="imageImageEditorCellFlexTitle">Gamma</label>
                                <div className="imageImageEditorCellFlex">
                                    <button onClick={() => updateAdjustment("gamma", Math.max(0.1, Number((adjustments.gamma - 0.05).toFixed(2))))} className="imageImageEditorToolButton">
                                        <FontAwesomeIcon icon={faMinus} />
                                    </button>
                                    <div className="imageImageEditorSliderWrapper">
                                        <input className="imageImageEditorSlider" type="range" min={0.1} max={3} step={0.05} value={adjustments.gamma} onChange={(e) => updateAdjustment("gamma", Number(e.target.value))} onMouseUp={() => addToHistory("Gamma changed.")} />
                                    </div>
                                    <button onClick={() => updateAdjustment("gamma", Math.min(3, Number((adjustments.gamma + 0.05).toFixed(2))))} className="imageImageEditorToolButton">
                                        <FontAwesomeIcon icon={faPlus} />
                                    </button>
                                </div>
                            </div>

                            <div className="imageImageEditorCellFlexStack">
                                <label className="imageImageEditorCellFlexTitle">Exposure</label>
                                <div className="imageImageEditorCellFlex">
                                    <button onClick={() => updateAdjustment("exposure", Math.max(-100, Number((adjustments.exposure - 5).toFixed(2))))} className="imageImageEditorToolButton">
                                        <FontAwesomeIcon icon={faMinus} />
                                    </button>
                                    <div className="imageImageEditorSliderWrapper">
                                        <input className="imageImageEditorSlider" type="range" min={-100} max={100} step={5} value={adjustments.exposure} onChange={(e) => updateAdjustment("exposure", Number(e.target.value))} onMouseUp={() => addToHistory("Exposure changed.")} />
                                    </div>
                                    <button onClick={() => updateAdjustment("exposure", Math.min(100, Number((adjustments.exposure + 5).toFixed(2))))} className="imageImageEditorToolButton">
                                        <FontAwesomeIcon icon={faPlus} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="imageImageEditorCellGroup">
                                <div className="imageImageEditorCellFlexStack">
                                    <label className="imageImageEditorCellFlexTitle">Temperature</label>
                                    <div className="imageImageEditorCellFlex">
                                        <button onClick={() => updateAdjustment("temperature", Math.max(-100, Number((adjustments.temperature - 5).toFixed(2))))} className="imageImageEditorToolButton">
                                            <FontAwesomeIcon icon={faMinus} />
                                        </button>
                                        <div className="imageImageEditorSliderWrapper">
                                            <input className="imageImageEditorSlider" type="range" min={-100} max={100} step={5} value={adjustments.temperature} onChange={(e) => updateAdjustment("temperature", Number(e.target.value))} onMouseUp={() => addToHistory("Temperature changed.")} />
                                        </div>
                                        <button onClick={() => updateAdjustment("temperature", Math.min(100, Number((adjustments.temperature + 5).toFixed(2))))} className="imageImageEditorToolButton">
                                            <FontAwesomeIcon icon={faPlus} />
                                        </button>
                                    </div>
                                </div>

                            <div className="imageImageEditorCellFlexStack">
                                <label className="imageImageEditorCellFlexTitle">Tint</label>
                                <div className="imageImageEditorCellFlex">
                                    <button onClick={() => updateAdjustment("tint", Math.max(-100, Number((adjustments.tint - 5).toFixed(2))))} className="imageImageEditorToolButton">
                                        <FontAwesomeIcon icon={faMinus} />
                                    </button>
                                    <div className="imageImageEditorSliderWrapper">
                                        <input className="imageImageEditorSlider" type="range" min={-100} max={100} step={5} value={adjustments.tint} onChange={(e) => updateAdjustment("tint", Number(e.target.value))} onMouseUp={() => addToHistory("Tint changed.")} />
                                    </div>
                                    <button onClick={() => updateAdjustment("tint", Math.min(100, Number((adjustments.tint + 5).toFixed(2))))} className="imageImageEditorToolButton">
                                        <FontAwesomeIcon icon={faPlus} />
                                    </button>
                                </div>
                            </div>

                            <div className="imageImageEditorCellFlexStack">
                                <label className="imageImageEditorCellFlexTitle">Vibrance</label>
                                <div className="imageImageEditorCellFlex">
                                    <button onClick={() => updateAdjustment("vibrance", Math.max(-100, Number((adjustments.vibrance - 5).toFixed(2))))} className="imageImageEditorToolButton">
                                        <FontAwesomeIcon icon={faMinus} />
                                    </button>
                                    <div className="imageImageEditorSliderWrapper">
                                        <input className="imageImageEditorSlider" type="range" min={-100} max={100} step={5} value={adjustments.vibrance} onChange={(e) => updateAdjustment("vibrance", Number(e.target.value))} onMouseUp={() => addToHistory("Vibrance changed.")} />
                                    </div>
                                    <button onClick={() => updateAdjustment("vibrance", Math.min(100, Number((adjustments.vibrance + 5).toFixed(2))))} className="imageImageEditorToolButton">
                                        <FontAwesomeIcon icon={faPlus} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="imageImageEditorCellGroup">
                                <div className="imageImageEditorCellFlexStack">
                                    <label className="imageImageEditorCellFlexTitle">Sharpen</label>
                                    <div className="imageImageEditorCellFlex">
                                        <button onClick={() => updateAdjustment("sharpen", Math.max(0, Number((adjustments.sharpen - 5).toFixed(2))))} className="imageImageEditorToolButton">
                                            <FontAwesomeIcon icon={faMinus} />
                                        </button>
                                        <div className="imageImageEditorSliderWrapper">
                                            <input className="imageImageEditorSlider" type="range" min={0} max={100} step={5} value={adjustments.sharpen} onChange={(e) => updateAdjustment("sharpen", Number(e.target.value))} onMouseUp={() => addToHistory("Sharpen changed.")} />
                                        </div>
                                        <button onClick={() => updateAdjustment("sharpen", Math.min(100, Number((adjustments.sharpen + 5).toFixed(2))))} className="imageImageEditorToolButton">
                                            <FontAwesomeIcon icon={faPlus} />
                                        </button>
                                    </div>
                                </div>

                            <div className="imageImageEditorCellFlexStack">
                                <label className="imageImageEditorCellFlexTitle">Vignette</label>
                                <div className="imageImageEditorCellFlex">
                                    <button onClick={() => updateAdjustment("vignette", Math.max(0, Number((adjustments.vignette - 5).toFixed(2))))} className="imageImageEditorToolButton">
                                        <FontAwesomeIcon icon={faMinus} />
                                    </button>
                                    <div className="imageImageEditorSliderWrapper">
                                        <input className="imageImageEditorSlider" type="range" min={0} max={100} step={5} value={adjustments.vignette} onChange={(e) => updateAdjustment("vignette", Number(e.target.value))} onMouseUp={() => addToHistory("Vignette changed.")} />
                                    </div>
                                    <button onClick={() => updateAdjustment("vignette", Math.min(100, Number((adjustments.vignette + 5).toFixed(2))))} className="imageImageEditorToolButton">
                                        <FontAwesomeIcon icon={faPlus} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="imageImageEditorCellGroup">
                            <div className="imageImageEditorCellFlexStack">
                                <label className="imageImageEditorCellFlexTitle">Blend Mode</label>
                                <div className="imageImageEditorCellFlex">
                                    <Dropdown
                                        value={BLEND_MODE_LABELS[baseBlend]}
                                        onChange={(option) => {
                                            const mode = BLEND_MODES.find((entry) => BLEND_MODE_LABELS[entry] === option) || baseBlend;
                                            setBaseBlend(mode);
                                            setImageLayers((previous) => previous.map((layer) => (selectedLayers.includes(layer.id) ? { ...layer, blend: mode } : layer)));
                                            addToHistory("Blend mode changed.");
                                        }}
                                        options={BLEND_MODES.map((mode) => BLEND_MODE_LABELS[mode])}
                                        placeholder="Blend Mode"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={!drawingCollapsed ? "imageImageEditorCellWrapper" : "imageImageEditorCellWrapperCollapsed"}>
                        <div className="imageImageEditorHeaderFlex">
                            <label className="imageImageEditorCellTitle">
                                <FontAwesomeIcon icon={faBrush} /> Drawing
                            </label>
                            <div className="imageImageEditorCellFlexSupplement">
                                <Tippy content="Collapse Drawing" theme="tooltip-light">
                                    <button onClick={() => {setDrawingCollapsed(!drawingCollapsed)}} className="imageImageEditorToolButtonHeader">
                                        <FontAwesomeIcon icon={drawingCollapsed ? faChevronRight : faChevronDown} />
                                    </button>
                                </Tippy>
                            </div>
                        </div>
                        <div className="imageImageEditorCellGroup">

                        <div className="imageImageEditorCellFlexStack">
                            <label className="imageImageEditorCellFlexTitle">Draw on Image</label>
                            <div className="imageImageEditorCellFlex">
                                <div className="imageImageEditorCellFlexSubStack">
                                    <div className="imageImageEditorCellFlexSubRow">
                                        <button onClick={() => { setActionMode(prev => prev === "Drawing" ? "Idle" : "Drawing"); addToHistory(`Drawing mode ${actionMode === "Drawing" ? 'disabled' : 'enabled'}.`); }} style={{ background: actionMode === "Drawing" ? "#5C2BE2" : "", opacity: isCropping ? "0.6" : "1.0" }} disabled={isCropping} className="imageImageEditorToolButtonBig" >
                                            Draw
                                        </button>
                                        <Tippy content="Brush Color" theme="tooltip-light">
                                            <Tippy
                                                content={<ColorPicker color={drawColor} onChange={(newColor) => { setDrawColor(newColor); addToHistory("Drawing color changed."); }} />}
                                                visible={isDrawColorOpen}
                                                onClickOutside={() => setIsDrawColorOpen(false)}
                                                interactive={true}
                                                placement="right"
                                                className="color-picker-tippy"
                                                appendTo={() => document.body}
                                            >
                                                <label className="imageImageEditorColorPicker" onClick={() => setIsDrawColorOpen((prev) => !prev)} style={{ background: drawColor }} />
                                            </Tippy>
                                        </Tippy>
                                    </div>
                                    <div className="imageImageEditorBrushSizeFlex">
                                        {[{ size: 1, label: "XS" }, { size: 2, label: "S" }, { size: 4, label: "M" }, { size: 6, label: "L" }, { size: 8, label: "XL" }].map(opt => (
                                            <button key={opt.size} onClick={() => { setDrawBrushSize(opt.size); addToHistory(`Drawing brush size changed to ${opt.label}.`); }} style={{ background: drawBrushSize === opt.size ? "#5C2BE2" : "" }} className="imageImageEditorToolButtonMini" >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="imageImageEditorCellFlexStack">
                            <label className="imageImageEditorCellFlexTitle">Highlight on Image</label>
                            <div className="imageImageEditorCellFlex">
                                <div className="imageImageEditorCellFlexSubStack">
                                    <div className="imageImageEditorCellFlexSubRow">
                                        <button onClick={() => { setActionMode(prev => prev === "Highlighting" ? "Idle" : "Highlighting"); addToHistory(`Highlighting mode ${actionMode === "Highlighting" ? 'disabled' : 'enabled'}.`); }} style={{ background: actionMode === "Highlighting" ? "#5C2BE2" : "", opacity: isCropping ? "0.6" : "1.0" }} disabled={isCropping} className="imageImageEditorToolButtonBig" >
                                            Highlight
                                        </button>
                                        <Tippy content="Highlighter Color" theme="tooltip-light">
                                            <Tippy
                                                content={<ColorPicker color={highlightColor} onChange={(newColor) => { setHighlightColor(newColor); addToHistory("Highlighting color changed."); }} />}
                                                visible={isHighlightColorOpen}
                                                onClickOutside={() => setIsHighlightColorOpen(false)}
                                                interactive={true}
                                                placement="right"
                                                className="color-picker-tippy"
                                                appendTo={() => document.body}
                                            >
                                                <label className="imageImageEditorColorPicker" onClick={() => setIsHighlightColorOpen((prev) => !prev)} style={{ background: highlightColor }} />
                                            </Tippy>
                                        </Tippy>
                                    </div>
                                    <div className="imageImageEditorBrushSizeFlex">
                                        {[{ size: 1, label: "XS" }, { size: 2, label: "S" }, { size: 4, label: "M" }, { size: 6, label: "L" }, { size: 8, label: "XL" }].map(opt => (
                                            <button key={opt.size} onClick={() => { setHighlightBrushSize(opt.size); addToHistory(`Highlighting brush size changed to ${opt.label}.`); }} style={{ background: highlightBrushSize === opt.size ? "#5C2BE2" : "" }} className="imageImageEditorToolButtonMini" >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                        </div>

                    </div>

                    <div className={!cornerCollapsed ? "imageImageEditorCellWrapper" : "imageImageEditorCellWrapperCollapsed"}>
                        <div className="imageImageEditorHeaderFlex">
                            <label className="imageImageEditorCellTitle">
                                <FontAwesomeIcon icon={faBorderTopLeft} /> Corner Rounding
                            </label>
                            <Tippy content="Collapse Corner Radii" theme="tooltip-light">
                                <button onClick={() => {setCornerCollapsed(!cornerCollapsed)}} className="imageImageEditorToolButtonHeader">
                                    <FontAwesomeIcon icon={cornerCollapsed ? faChevronRight : faChevronDown} />
                                </button>
                            </Tippy>
                        </div>
                        <div className="imageImageEditorCellGroup">
                        <div className="imageImageEditorCellFlexStack">
                            <label className="imageImageEditorCellFlexTitle"> Corner Radii </label>
                            <div className="imageImageEditorCellFlex">
                                {syncCorners ? (
                                    <input className="imageImageEditorPositionInput" type="text" value={`Corner: ${borderRadius}px`} onChange={(e) => { const newVal = e.target.value.replace(/[^0-9]/g, ""); let val = Number(newVal); val = Math.min(val, MAX_CORNER_RADIUS); setBorderRadius(val); setBorderTopLeftRadius(val); setBorderTopRightRadius(val); setBorderBottomLeftRadius(val); setBorderBottomRightRadius(val); addToHistory("Corner rounding changed."); }} />
                                ) : (
                                    <div className="imageCornerInputGridWrapper">
                                        <div className="imageCornerInputFlex">
                                            <input className="imageImageEditorPositionInput" type="text" value={`TL: ${borderTopLeftRadius}px`} onChange={(e) => { const newVal = e.target.value.replace(/[^0-9]/g, ""); let val = Number(newVal); val = Math.min(val, MAX_CORNER_RADIUS); setBorderTopLeftRadius(val); addToHistory("Corner rounding changed."); }} />
                                            <input className="imageImageEditorPositionInput" type="text" value={`TR: ${borderTopRightRadius}px`} onChange={(e) => { const newVal = e.target.value.replace(/[^0-9]/g, ""); let val = Number(newVal); val = Math.min(val, MAX_CORNER_RADIUS); setBorderTopRightRadius(val); addToHistory("Corner rounding changed."); }} />
                                        </div>
                                        <div className="imageCornerInputFlex">
                                            <input className="imageImageEditorPositionInput" type="text" value={`BL: ${borderBottomLeftRadius}px`} onChange={(e) => { const newVal = e.target.value.replace(/[^0-9]/g, ""); let val = Number(newVal); val = Math.min(val, MAX_CORNER_RADIUS); setBorderBottomLeftRadius(val); addToHistory("Corner rounding changed."); }} />
                                            <input className="imageImageEditorPositionInput" type="text" value={`BR: ${borderBottomRightRadius}px`} onChange={(e) => { const newVal = e.target.value.replace(/[^0-9]/g, ""); let val = Number(newVal); val = Math.min(val, MAX_CORNER_RADIUS); setBorderBottomRightRadius(val); addToHistory("Corner rounding changed."); }} />
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="imageImageEditorCellFlex">
                                <label className="imageConfrmationCheck">
                                    <input type="checkbox" className="imageSettingsCheckbox" checked={syncCorners} onChange={(e) => { setSyncCorners(e.target.checked); if (e.target.checked) { const radius = borderRadius || borderTopLeftRadius || 0; const limited = Math.min(radius, MAX_CORNER_RADIUS); setBorderRadius(limited); setBorderTopLeftRadius(limited); setBorderTopRightRadius(limited); setBorderBottomLeftRadius(limited); setBorderBottomRightRadius(limited); } addToHistory("Corner rounding changed."); }} />
                                    <span> Sync Corners </span>
                                </label>
                            </div>
                        </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="imageImageEditorContainerWrapper">
                <div
                    className="imageImageEditorContainer"
                    style={{
                        cursor: actionMode === "Drawing" || actionMode === "Highlighting" ? "crosshair" : "grab",
                        height: "90%",
                        border: isDraggingOver ? "2px dashed #5C2BE2" : "none",
                        background: isDraggingOver ? "rgba(92, 43, 226, 0.05)" : "",
                        transition: "all 0.2s ease"
                    }}
                    ref={containerRef}
                    onMouseDown={handleDragStart}
                    onMouseMove={handleDragMove}
                    onMouseUp={handleDragEnd}
                    onMouseLeave={handleDragEnd}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={(e) => {
                        if (actionMode === "Idle") {
                            setSelectedLayers(['base']);
                            addToHistory("Layer selected.");
                        }
                    }}
                >
                    <div ref={surfaceRef} className="imageImageResizer" style={{ top: `calc(50% + ${panY}px)`, left: `calc(50% + ${panX}px)`, width: `${imageWidth}px`, height: `${imageHeight}px`, transform: `translate(-50%, -50%) scale(${baseZoom}, ${baseZoom}) rotate(${baseRotation}deg)`, borderRadius: syncCorners ? `${borderRadius}px` : `${borderTopLeftRadius}px ${borderTopRightRadius}px ${borderBottomRightRadius}px ${borderBottomLeftRadius}px`, border: selectedLayers.includes('base') && actionMode === "Idle" ? "2px dashed #5C2BE2" : "none" }} >
                        <img
                            src={url}
                            alt="Media content"
                            draggable={false}
                            onDragStart={(e) => e.preventDefault()}
                            onClick={handleBaseImageClick}
                            className="imageImageEditorContent"
                            style={{ ...getBaseImageStyle(), visibility: baseVisible && !adjustmentsActive ? "visible" : "hidden" }}
                        />

                        {adjustmentsActive && baseVisible && (
                            <canvas
                                ref={adjustmentCanvasRef}
                                className="imageImageEditorAdjustmentCanvas"
                                style={{
                                    transform: `scale(${baseFlipX}, ${baseFlipY})`,
                                    borderRadius: "inherit",
                                    mixBlendMode: baseBlend === "normal" ? "normal" : baseBlend
                                }}
                            />
                        )}

                        {actionMode === "Shape" && (
                            <div
                                className="imageImageEditorShapeSurface"
                                onPointerDown={handleShapePointerDown}
                                onPointerMove={handleShapePointerMove}
                                onPointerUp={handleShapePointerUp}
                                onPointerCancel={handleShapePointerUp}
                            />
                        )}

                        <svg className="imageImageEditorShapeLayer" viewBox="0 0 100 100" preserveAspectRatio="none">
                            {shapeLayers.filter((shape) => shape.visible !== false).map((shape) => {
                                const left = Math.min(shape.x, shape.x2) * 100;
                                const top = Math.min(shape.y, shape.y2) * 100;
                                const width = Math.abs(shape.x2 - shape.x) * 100;
                                const height = Math.abs(shape.y2 - shape.y) * 100;

                                if (shape.kind === "rectangle") {
                                    return (
                                        <rect
                                            key={shape.id}
                                            x={left}
                                            y={top}
                                            width={width}
                                            height={height}
                                            fill={shape.fill || "transparent"}
                                            stroke={shape.color}
                                            strokeWidth={shape.strokeWidth}
                                            vectorEffect="non-scaling-stroke"
                                        />
                                    );
                                }

                                if (shape.kind === "ellipse") {
                                    return (
                                        <ellipse
                                            key={shape.id}
                                            cx={left + width / 2}
                                            cy={top + height / 2}
                                            rx={width / 2}
                                            ry={height / 2}
                                            fill={shape.fill || "transparent"}
                                            stroke={shape.color}
                                            strokeWidth={shape.strokeWidth}
                                            vectorEffect="non-scaling-stroke"
                                        />
                                    );
                                }

                                const angle = Math.atan2(shape.y2 - shape.y, shape.x2 - shape.x);
                                const head = 4;

                                return (
                                    <g key={shape.id}>
                                        <line
                                            x1={shape.x * 100}
                                            y1={shape.y * 100}
                                            x2={shape.x2 * 100}
                                            y2={shape.y2 * 100}
                                            stroke={shape.color}
                                            strokeWidth={shape.strokeWidth}
                                            strokeLinecap="round"
                                            vectorEffect="non-scaling-stroke"
                                        />
                                        {shape.kind === "arrow" && (
                                            <polyline
                                                points={`${shape.x2 * 100 - head * Math.cos(angle - Math.PI / 6)},${shape.y2 * 100 - head * Math.sin(angle - Math.PI / 6)} ${shape.x2 * 100},${shape.y2 * 100} ${shape.x2 * 100 - head * Math.cos(angle + Math.PI / 6)},${shape.y2 * 100 - head * Math.sin(angle + Math.PI / 6)}`}
                                                fill="none"
                                                stroke={shape.color}
                                                strokeWidth={shape.strokeWidth}
                                                strokeLinecap="round"
                                                vectorEffect="non-scaling-stroke"
                                            />
                                        )}
                                    </g>
                                );
                            })}
                        </svg>

                        {imageLayers.filter(layer => layer.visible).map(layer => (
                            <div
                                key={`image-layer-${layer.id}`}
                                style={getImageLayerStyle(layer)}
                                onMouseDown={(e) => handleImageLayerMouseDown(layer.id, e)}
                                onClick={(e) => handleImageLayerClick(layer.id, e)}
                            >
                                <img
                                    src={layer.url}
                                    alt={layer.name}
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "contain",
                                        userSelect: "none",
                                        pointerEvents: "none"
                                    }}
                                    draggable={false}
                                />

                                {selectedLayers.includes(layer.id) && actionMode === "Idle" && !layer.locked && (
                                    <>
                                        <div className="imageImageEditorResizeHandle top-left" onMouseDown={(e) => handleImageLayerResizeMouseDown(layer.id, "top-left", e)} style={{ top: `-${RESIZE_HANDLE_SIZE}px`, left: `-${RESIZE_HANDLE_SIZE}px` }} />
                                        <div className="imageImageEditorResizeHandle top-right" onMouseDown={(e) => handleImageLayerResizeMouseDown(layer.id, "top-right", e)} style={{ top: `-${RESIZE_HANDLE_SIZE}px`, right: `-${RESIZE_HANDLE_SIZE}px` }} />
                                        <div className="imageImageEditorResizeHandle bottom-left" onMouseDown={(e) => handleImageLayerResizeMouseDown(layer.id, "bottom-left", e)} style={{ bottom: `-${RESIZE_HANDLE_SIZE}px`, left: `-${RESIZE_HANDLE_SIZE}px` }} />
                                        <div className="imageImageEditorResizeHandle bottom-right" onMouseDown={(e) => handleImageLayerResizeMouseDown(layer.id, "bottom-right", e)} style={{ bottom: `-${RESIZE_HANDLE_SIZE}px`, right: `-${RESIZE_HANDLE_SIZE}px` }} />
                                    </>
                                )}
                            </div>
                        ))}

                        {drawingLayers.filter(layer => layer.visible).map((layer) => {
                            const bounds = getPathBounds(layer.d);
                            const padding = Math.max(layer.strokeWidth || 3, 10);

                            return (
                                <div
                                    key={`drawing-layer-container-${layer.id}`}
                                    style={{
                                        position: "absolute",
                                        left: `${((bounds.x - padding + (layer.x || 0)) / nativeWidth) * 100}%`,
                                        top: `${((bounds.y - padding + (layer.y || 0)) / nativeHeight) * 100}%`,
                                        width: `${((bounds.width + padding * 2) / nativeWidth) * 100}%`,
                                        height: `${((bounds.height + padding * 2) / nativeHeight) * 100}%`,
                                        transform: `rotate(${layer.rotation || 0}deg) scale(${(layer.zoom || 1) * (layer.flipX || 1)}, ${(layer.zoom || 1) * (layer.flipY || 1)})`,
                                        opacity: (layer.opacity || 100) / 100,
                                        filter: `hue-rotate(${layer.hue || 0}deg) saturate(${layer.saturation || 100}%) brightness(${layer.brightness || 100}%) contrast(${layer.contrast || 100}%) blur(${layer.blur || 0}px) grayscale(${layer.grayscale || 0}%) sepia(${layer.sepia || 0}%) ${(layer.spread || 0) ? `drop-shadow(0 0 ${layer.spread}px rgba(0,0,0,0.5))` : ""}`,
                                        outline: selectedLayers.includes(layer.id) && actionMode === "Idle" ? "2px dashed #5C2BE2" : "none",
                                        outlineOffset: "0px",
                                        pointerEvents: layer.locked ? "none" : "auto",
                                        cursor: actionMode === "Idle" ? (selectedLayers.includes(layer.id) ? "move" : "pointer") : "default"
                                    }}
                                    onClick={(e) => {
                                        if (actionMode === "Idle") {
                                            e.stopPropagation();
                                            if (e.ctrlKey || e.metaKey) {
                                                setSelectedLayers(prev => prev.includes(layer.id) ? prev.filter(id => id !== layer.id) : [...prev, layer.id]);
                                            } else {
                                                setSelectedLayers([layer.id]);
                                            }
                                            addToHistory("Layer selected.");
                                        }
                                    }}
                                >
                                    <svg
                                        viewBox={`${bounds.x - padding} ${bounds.y - padding} ${bounds.width + padding * 2} ${bounds.height + padding * 2}`}
                                        style={{
                                            position: "absolute",
                                            top: 0,
                                            left: 0,
                                            width: "100%",
                                            height: "100%",
                                            overflow: "visible"
                                        }}
                                    >
                                        <path
                                            d={layer.d}
                                            stroke={layer.color}
                                            strokeWidth={layer.strokeWidth}
                                            fill="none"
                                            strokeLinecap="round"
                                            vectorEffect="non-scaling-stroke"
                                        />
                                    </svg>
                                </div>
                            );
                        })}

                        {(actionMode === "Drawing" || actionMode === "Highlighting") && (
                            <svg viewBox={`0 0 ${nativeWidth} ${nativeHeight}`} style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                height: "100%",
                                pointerEvents: "auto"
                            }} onMouseDown={handleSvgMouseDown} onMouseMove={handleSvgMouseMove} onMouseUp={handleSvgMouseUp} >
                                {tempPath && (
                                    <path d={tempPath.d} stroke={tempPath.color} strokeWidth={tempPath.width} fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                                )}
                            </svg>
                        )}

                        {!isCropping && actionMode === "Idle" && selectedLayers.includes('base') && (
                            <>
                                <div className="imageImageEditorResizeHandle top-left" onMouseDown={(e) => handleResizeMouseDown("top-left", e)} style={{ top: `-${RESIZE_HANDLE_SIZE}px`, left: `-${RESIZE_HANDLE_SIZE}px` }} />
                                <div className="imageImageEditorResizeHandle top-right" onMouseDown={(e) => handleResizeMouseDown("top-right", e)} style={{ top: `-${RESIZE_HANDLE_SIZE}px`, right: `-${RESIZE_HANDLE_SIZE}px` }} />
                                <div className="imageImageEditorResizeHandle bottom-left" onMouseDown={(e) => handleResizeMouseDown("bottom-left", e)} style={{ bottom: `-${RESIZE_HANDLE_SIZE}px`, left: `-${RESIZE_HANDLE_SIZE}px` }} />
                                <div className="imageImageEditorResizeHandle bottom-right" onMouseDown={(e) => handleResizeMouseDown("bottom-right", e)} style={{ bottom: `-${RESIZE_HANDLE_SIZE}px`, right: `-${RESIZE_HANDLE_SIZE}px` }} />
                            </>
                        )}

                        {isCropping && (
                            <div className="imageImageEditorCropRectangle" style={{ position: "absolute", border: "0.4vh dashed rgba(31, 174, 245, 1)", background: "rgba(0,0,0,0.6)", left: cropRect.x, top: cropRect.y, width: cropRect.width, height: cropRect.height, transform: `rotate(${cropRotation}deg)`, borderRadius: circleCrop ? "50%" : "0", zIndex: 10 }} onMouseDown={handleCropMouseDown} >
                                <div className="imageImageEditorResizeHandle top-left" style={{ pointerEvents: "auto", top: `-${CROP_HANDLE_SIZE}px`, left: `-${CROP_HANDLE_SIZE}px` }} onMouseDown={(e) => handleCropResizeMouseDown("top-left", e)} />
                                <div className="imageImageEditorResizeHandle top-right" style={{ pointerEvents: "auto", top: `-${CROP_HANDLE_SIZE}px`, right: `-${CROP_HANDLE_SIZE}px` }} onMouseDown={(e) => handleCropResizeMouseDown("top-right", e)} />
                                <div className="imageImageEditorResizeHandle bottom-left" style={{ pointerEvents: "auto", bottom: `-${CROP_HANDLE_SIZE}px`, left: `-${CROP_HANDLE_SIZE}px` }} onMouseDown={(e) => handleCropResizeMouseDown("bottom-left", e)} />
                                <div className="imageImageEditorResizeHandle bottom-right" style={{ pointerEvents: "auto", bottom: `-${CROP_HANDLE_SIZE}px`, right: `-${CROP_HANDLE_SIZE}px` }} onMouseDown={(e) => handleCropResizeMouseDown("bottom-right", e)} />
                                <div className="imageImageEditorRotationHandle top-left" style={{ pointerEvents: "auto", position: "absolute", top: "-30px", left: "-30px" }} onMouseDown={handleCropRotationMouseDown} />
                                <div className="imageImageEditorRotationHandle top-right" style={{ pointerEvents: "auto", position: "absolute", top: "-30px", right: "-30px" }} onMouseDown={handleCropRotationMouseDown} />
                                <div className="imageImageEditorRotationHandle bottom-left" style={{ pointerEvents: "auto", position: "absolute", bottom: "-30px", left: "-30px" }} onMouseDown={handleCropRotationMouseDown} />
                                <div className="imageImageEditorRotationHandle bottom-right" style={{ pointerEvents: "auto", position: "absolute", bottom: "-30px", right: "-30px" }} onMouseDown={handleCropRotationMouseDown} />
                            </div>
                        )}
                    </div>
                </div>

                <div className="imageVideoInputBottomBar">
                    {(actionMode !== "" && actionMode && actionMode !== "Idle") && (
                        <small>
                            {actionMode} Mode Active
                        </small>
                    )}
                </div>
            </div>
        </div>
    );
}