import React, { useState, useEffect, useRef } from "react";
import "../../../styles/mainStyles/DinoLabsMedia/DinoLabsImageEditor/DinoLabsImageEditor.css";
import "../../../styles/helperStyles/Slider.css";
import "../../../styles/helperStyles/Checkbox.css";
import DinoLabsColorPicker from "../../../helpers/ColorPicker.jsx";
import { showDialog } from "../../../helpers/Alert.jsx";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faArrowRight, faArrowsLeftRightToLine, faArrowsRotate, faArrowsUpToLine, faBorderTopLeft, faCircle, faCropSimple, faDownload, faLeftRight, faMagnifyingGlassMinus, faMagnifyingGlassPlus, faMinus, faBrush, faPlus, faRightLeft, faRotateLeft, faRotateRight, faRulerCombined, faSquareCaretLeft, faSwatchbook, faTabletScreenButton, faUpDown, faEye, faEyeSlash, faLock, faLockOpen, faArrowUp, faArrowDown, faTrash, faFileImport, faLayerGroup, faPenToSquare, faChevronDown, faChevronRight } from "@fortawesome/free-solid-svg-icons";

export default function DinoLabsImageEditor({ fileHandle }) {
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

    const addToHistory = async (description = "Edit") => {
        if (preventHistoryUpdate.current) return;
        if (historyUpdateTimeoutRef.current) {
            clearTimeout(historyUpdateTimeoutRef.current);
        }
        historyUpdateTimeoutRef.current = setTimeout(async () => {
            const thumbnail = await generateThumbnail();
            const currentState = { url, mediaType, svgContent, baseZoom, baseRotation, baseFlipX, baseFlipY, baseHue, baseSaturation, baseBrightness, baseContrast, baseOpacity, baseBlur, baseSpread, baseGrayscale, baseSepia, panX, panY, imageWidth, imageHeight, nativeWidth, nativeHeight, borderRadius, borderTopLeftRadius, borderTopRightRadius, borderBottomLeftRadius, borderBottomRightRadius, syncCorners, maintainAspectRatio, paths, undonePaths, drawBrushSize, highlightBrushSize, cropHistory, isCropDisabled, circleCrop, baseVisible, baseLocked, drawColor, highlightColor, isDrawColorOpen, isHighlightColorOpen, actionMode, imageLayers, selectedLayers };
            setHistory(prev => {
                const newHistory = [...prev];
                if (currentHistoryIndex < prev.length - 1) {
                    newHistory.splice(currentHistoryIndex + 1);
                }
                newHistory.push({ state: currentState, thumbnail, description });
                return newHistory;
            });
            setCurrentHistoryIndex(prev => currentHistoryIndex < history.length - 1 ? currentHistoryIndex + 1 : prev + 1);
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

    const undoStroke = () => {
        setDrawingLayers(prev => {
            if (prev.length === 0) return prev;
            const newLayers = [...prev];
            const undoneLayer = newLayers.pop();
            setUndonePaths(ups => [...ups, undoneLayer]);
            addToHistory("Drawing layer undone.");
            return newLayers;
        });
    };

    const redoStroke = () => {
        setUndonePaths(prev => {
            if (prev.length === 0) return prev;
            const newUndone = [...prev];
            const layerToRedo = newUndone.pop();
            setDrawingLayers(layers => [...layers, layerToRedo]);
            addToHistory("Drawing layer redone.");
            return newUndone;
        });
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
        const layerOptions = [
            { label: "All", value: "all" },
            { label: "Base", value: "base" },
            ...imageLayers.map(layer => ({ label: layer.name, value: `image-${layer.id}` })),
            ...paths.map(p => ({ label: p.name, value: `path-${p.id}` }))
        ];

        const alertResultLayer = await showDialog({
            title: "Select Layer to Export",
            message: "Choose the layer or all.",
            inputs: [{ name: "layer", type: "select", label: "Layer", defaultValue: "all", options: layerOptions }],
            showCancel: true
        });

        if (!alertResultLayer) return;

        let fileTypeOptions = [
            { label: ".png", value: "png" },
            { label: ".jpg", value: "jpg" },
            { label: ".jpeg", value: "jpeg" },
            { label: ".webp", value: "webp" }
        ];

        if (mediaType === "svg") {
            fileTypeOptions.push({ label: ".svg", value: "svg" });
        }

        const alertResult = await showDialog({
            title: "Select Image Type and Scale",
            message: "Select the image type and scale.",
            inputs: [
                { name: "fileType", type: "select", label: "Image Type", defaultValue: "png", options: fileTypeOptions },
                { name: "scale", type: "select", label: "Scale", defaultValue: "1x", options: [{ label: "1x", value: "1x" }, { label: "2x", value: "2x" }, { label: "3x", value: "3x" }] }
            ],
            showCancel: true
        });

        if (!alertResult) return;

        const fileType = alertResult.fileType || "png";
        const scale = alertResult.scale || "1x";
        const scaleFactor = scale === "2x" ? 2 : scale === "3x" ? 3 : 1;
        const mimeType = fileType === "webp" ? "image/webp" : (fileType === "jpg" || fileType === "jpeg") ? "image/jpeg" : "image/png";
        const link = document.createElement("a");
        const fileNameBase = fileHandle.name ? fileHandle.name.replace(/\.\w+$/, "") : "edited_image";

        const canvas = document.createElement("canvas");
        canvas.width = nativeWidth * scaleFactor;
        canvas.height = nativeHeight * scaleFactor;
        const ctx = canvas.getContext("2d");
        ctx.scale(scaleFactor, scaleFactor);

        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            if (baseVisible) {
                ctx.save();
                const filterString = `hue-rotate(${baseHue}deg) saturate(${baseSaturation}%) brightness(${baseBrightness}%) contrast(${baseContrast}%) blur(${baseBlur}px) grayscale(${baseGrayscale}%) sepia(${baseSepia}%)${baseSpread ? ` drop-shadow(0 0 ${baseSpread}px rgba(0,0,0,0.5))` : ""}`;
                ctx.filter = filterString;
                ctx.globalAlpha = baseOpacity / 100;
                ctx.drawImage(img, 0, 0, nativeWidth, nativeHeight);
                ctx.restore();
            }

            imageLayers.filter(layer => layer.visible).forEach(layer => {
                const layerImg = new Image();
                layerImg.crossOrigin = "anonymous";
                layerImg.onload = () => {
                    ctx.save();
                    ctx.filter = `hue-rotate(${layer.hue || 0}deg) saturate(${layer.saturation || 100}%) brightness(${layer.brightness || 100}%) contrast(${layer.contrast || 100}%) blur(${layer.blur || 0}px) grayscale(${layer.grayscale || 0}%) sepia(${layer.sepia || 0}%)`;
                    ctx.globalAlpha = (layer.opacity || 100) / 100;
                    ctx.translate(layer.x, layer.y);
                    ctx.rotate((layer.rotation || 0) * Math.PI / 180);
                    ctx.drawImage(layerImg, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
                    ctx.restore();
                };
                layerImg.src = layer.url;
            });

            paths.filter(p => p.visible).forEach(elem => {
                ctx.save();
                ctx.strokeStyle = elem.color;
                ctx.lineWidth = elem.width;
                ctx.lineCap = "round";
                try {
                    const p = new Path2D(elem.d);
                    ctx.stroke(p);
                } catch (error) {
                    return;
                }
                ctx.restore();
            });

            const dataUrl = canvas.toDataURL(mimeType);
            link.href = dataUrl;
            link.download = `${fileNameBase}.${fileType}`;
            link.click();
        };
        img.src = url;
    };

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
        <div className="dinolabsImageEditorWrapper">
            <input type="file" ref={fileInputRef} onChange={handleImageImport} accept="image/*" style={{ display: 'none' }} />
            
            <div className="dinolabsImageEditorToolbar">
                <div className={layersCollapsed ? "dinolabsImageEditorCellWrapperLayersCollapsed" : "dinolabsImageEditorCellWrapperLayers"}>
                    <div className="dinolabsImageEditorHeaderFlexDark" style={{ marginBottom: 0 }}>
                        <label className="dinolabsImageEditorCellTitle">
                            <FontAwesomeIcon icon={faLayerGroup} /> Layers
                        </label>
                        <div className="dinolabsImageEditorCellFlexSupplement">
                            <Tippy content="Collapse Layers" theme="tooltip-light">
                                <button onClick={() => {setLayersCollpased(!layersCollapsed)}} className="dinolabsImageEditorToolButtonHeader">
                                    <FontAwesomeIcon icon={layersCollapsed ? faChevronRight : faChevronDown} />
                                </button>
                            </Tippy>
                        </div>
                    </div>
                    <ul className="dinolabsTextEditorLayerList" style={{ listStyleType: 'none' }}>
                        {drawingLayers.map(layer => (
                            <li key={`drawing-${layer.id}`} className="dinolabsLayerItem" style={{ background: selectedLayers.includes(layer.id) ? "rgba(0,0,0,0.2)" : "" }} onClick={(e) => handleLayerSelect(layer.id, 'drawing', e)}>
                                <Tippy content="Rename Layer" theme="tooltip-light">
                                    <input className="dinolabsImageEditorPositionInput" style={{ maxWidth: "100%" }} value={layer.name} onChange={(e) => {
                                        e.stopPropagation();
                                        setDrawingLayers(prev => prev.map(l => l.id === layer.id ? { ...l, name: e.target.value } : l));
                                        addToHistory("Layer name changed.");
                                    }} onClick={(e) => e.stopPropagation()} />
                                </Tippy>
                                <div className="dinolabsTextEditorLayerListFlex">
                                    <Tippy content={layer.visible ? "Hide Layer" : "Show Layer"} theme="tooltip-light">
                                        <button onClick={(e) => { e.stopPropagation(); setDrawingLayers(prev => prev.map(l => l.id === layer.id ? { ...l, visible: !l.visible } : l)); addToHistory("Layer visibility changed."); }} className="dinolabsImageEditorToolButton">
                                            <FontAwesomeIcon icon={layer.visible ? faEye : faEyeSlash} />
                                        </button>
                                    </Tippy>
                                    <Tippy content={layer.locked ? "Lock Layer" : "Unlock Layer"} theme="tooltip-light">
                                        <button onClick={(e) => { e.stopPropagation(); setDrawingLayers(prev => prev.map(l => l.id === layer.id ? { ...l, locked: !l.locked } : l)); addToHistory("Layer lock changed."); }} className="dinolabsImageEditorToolButton">
                                            <FontAwesomeIcon icon={layer.locked ? faLock : faLockOpen} />
                                        </button>
                                    </Tippy>
                                    <Tippy content="Increase Layer Order" theme="tooltip-light">
                                        <button onClick={(e) => { e.stopPropagation(); moveLayer(layer.id, -1, 'drawing'); }} className="dinolabsImageEditorToolButton">
                                            <FontAwesomeIcon icon={faArrowUp} />
                                        </button>
                                    </Tippy>
                                    <Tippy content="Decrease Layer Order" theme="tooltip-light">
                                        <button onClick={(e) => { e.stopPropagation(); moveLayer(layer.id, 1, 'drawing'); }} className="dinolabsImageEditorToolButton">
                                            <FontAwesomeIcon icon={faArrowDown} />
                                        </button>
                                    </Tippy>
                                    <Tippy content="Delete Layer" theme="tooltip-light">
                                        <button onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id, 'drawing'); }} className="dinolabsImageEditorToolButton">
                                            <FontAwesomeIcon icon={faTrash} />
                                        </button>
                                    </Tippy>
                                </div>
                            </li>
                        ))}
                        {imageLayers.map(layer => (
                            <li key={`image-${layer.id}`} style={{ background: selectedLayers.includes(layer.id) ? "rgba(0,0,0,0.2)" : "" }} onClick={(e) => handleLayerSelect(layer.id, 'image', e)}>
                                <Tippy content="Rename Layer" theme="tooltip-light">
                                    <input className="dinolabsImageEditorPositionInput" style={{ maxWidth: "100%" }} value={layer.name} onChange={(e) => {
                                        e.stopPropagation();
                                        setImageLayers(prev => prev.map(l => l.id === layer.id ? { ...l, name: e.target.value } : l));
                                        addToHistory("Layer name changed.");
                                    }} onClick={(e) => e.stopPropagation()} />
                                </Tippy>
                                <div className="dinolabsTextEditorLayerListFlex">
                                    <Tippy content={layer.visible ? "Hide Layer" : "Show Layer"} theme="tooltip-light">
                                        <button onClick={(e) => { e.stopPropagation(); setImageLayers(prev => prev.map(l => l.id === layer.id ? { ...l, visible: !l.visible } : l)); addToHistory("Layer visibility changed."); }} className="dinolabsImageEditorToolButton">
                                            <FontAwesomeIcon icon={layer.visible ? faEye : faEyeSlash} />
                                        </button>
                                    </Tippy>
                                    <Tippy content={layer.locked ? "Lock Layer" : "Unlock Layer"} theme="tooltip-light">
                                        <button onClick={(e) => { e.stopPropagation(); setImageLayers(prev => prev.map(l => l.id === layer.id ? { ...l, locked: !l.locked } : l)); addToHistory("Layer lock changed."); }} className="dinolabsImageEditorToolButton">
                                            <FontAwesomeIcon icon={layer.locked ? faLock : faLockOpen} />
                                        </button>
                                    </Tippy>
                                    <Tippy content="Increase Layer Order" theme="tooltip-light">
                                        <button onClick={(e) => { e.stopPropagation(); moveLayer(layer.id, -1, 'image'); }} className="dinolabsImageEditorToolButton">
                                            <FontAwesomeIcon icon={faArrowUp} />
                                        </button>
                                    </Tippy>
                                    <Tippy content="Decrease Layer Order" theme="tooltip-light">
                                        <button onClick={(e) => { e.stopPropagation(); moveLayer(layer.id, 1, 'image'); }} className="dinolabsImageEditorToolButton">
                                            <FontAwesomeIcon icon={faArrowDown} />
                                        </button>
                                    </Tippy>
                                    <Tippy content="Delete Layer" theme="tooltip-light">
                                        <button onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id, 'image'); }} className="dinolabsImageEditorToolButton">
                                            <FontAwesomeIcon icon={faTrash} />
                                        </button>
                                    </Tippy>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className={layersCollapsed ? "dinolabsImageEditorCellWrapperStackNonLayersLong" : "dinolabsImageEditorCellWrapperStackNonLayers"}>
                    <div className="dinolabsImageEditorHeaderFlexDark" style={{ marginBottom: 0, border: "none" }}>
                        <label className="dinolabsImageEditorCellTitle">
                            <FontAwesomeIcon icon={faPenToSquare} /> Edit
                        </label>
                    </div>

                    <div className={!layoutCollapsed ? "dinolabsImageEditorCellWrapper" : "dinolabsImageEditorCellWrapperCollapsed"}>
                        <div className="dinolabsImageEditorHeaderFlex">
                            <label className="dinolabsImageEditorCellTitle">
                                <FontAwesomeIcon icon={faTabletScreenButton} /> Layout
                            </label>
                            <div className="dinolabsImageEditorCellFlexSupplement">
                                {!layoutCollapsed && (
                                    <>
                                        <Tippy content="Reset Image" theme="tooltip-light">
                                            <button onClick={resetImage} className="dinolabsImageEditorToolButtonHeader">
                                                <FontAwesomeIcon icon={faArrowsRotate} />
                                            </button>
                                        </Tippy>
                                        <Tippy content="Download Image" theme="tooltip-light">
                                            <button onClick={downloadImage} className="dinolabsImageEditorToolButtonHeader">
                                                <FontAwesomeIcon icon={faDownload} />
                                            </button>
                                        </Tippy>
                                        <Tippy content="Import Image Layer" theme="tooltip-light">
                                            <button onClick={importImageLayer} className="dinolabsImageEditorToolButtonHeader">
                                                <FontAwesomeIcon icon={faFileImport} />
                                            </button>
                                        </Tippy>
                                    </>
                                )}
                                <Tippy content="Collapse Layout" theme="tooltip-light">
                                    <button onClick={() => {setLayoutCollapsed(!layoutCollapsed)}} className="dinolabsImageEditorToolButtonHeader">
                                        <FontAwesomeIcon icon={layoutCollapsed ? faChevronRight : faChevronDown} />
                                    </button>
                                </Tippy>
                            </div>
                        </div>
                        <div className="dinolabsImageEditorCellFlexStack">
                            <label className="dinolabsImageEditorCellFlexTitle"> Position </label>
                            <div className="dinolabsImageEditorCellFlex">
                                <input className="dinolabsImageEditorPositionInput" type="text" value={`X: ${panX}`} onChange={(e) => { const newValue = e.target.value.replace(/[^0-9.-]/g, ""); setPanX(Number(newValue)); addToHistory("Position changed."); }} />
                                <input className="dinolabsImageEditorPositionInput" type="text" value={`Y: ${panY}`} onChange={(e) => { const newValue = e.target.value.replace(/[^0-9.-]/g, ""); setPanY(Number(newValue)); addToHistory("Position changed."); }} />
                            </div>
                        </div>
                        <div className="dinolabsImageEditorCellFlexStack">
                            <div className="dinolabsImageEditorCellFlex">
                                <Tippy content="Zoom In Selected" theme="tooltip-light">
                                    <button onClick={() => updateZoom(0.1)} className="dinolabsImageEditorToolButton">
                                        <FontAwesomeIcon icon={faMagnifyingGlassPlus} />
                                    </button>
                                </Tippy>
                                <Tippy content="Zoom Out Selected" theme="tooltip-light">
                                    <button onClick={() => updateZoom(-0.1)} className="dinolabsImageEditorToolButton">
                                        <FontAwesomeIcon icon={faMagnifyingGlassMinus} />
                                    </button>
                                </Tippy>
                                <Tippy content="Rotate Left Selected" theme="tooltip-light">
                                    <button onClick={() => updateRotation(-90)} className="dinolabsImageEditorToolButton">
                                        <FontAwesomeIcon icon={faRotateLeft} />
                                    </button>
                                </Tippy>
                                <Tippy content="Rotate Right Selected" theme="tooltip-light">
                                    <button onClick={() => updateRotation(90)} className="dinolabsImageEditorToolButton">
                                        <FontAwesomeIcon icon={faRotateRight} />
                                    </button>
                                </Tippy>
                                <Tippy content="Flip Horizontally Selected" theme="tooltip-light">
                                    <button onClick={() => updateFlip('x')} className="dinolabsImageEditorToolButton">
                                        <FontAwesomeIcon icon={faLeftRight} />
                                    </button>
                                </Tippy>
                                <Tippy content="Flip Vertically Selected" theme="tooltip-light">
                                    <button onClick={() => updateFlip('y')} className="dinolabsImageEditorToolButton">
                                        <FontAwesomeIcon icon={faUpDown} />
                                    </button>
                                </Tippy>
                            </div>
                        </div>
                    </div>

                    <div className={!dimensionsCollapsed ? "dinolabsImageEditorCellWrapper" : "dinolabsImageEditorCellWrapperCollapsed"}>
                        <div className="dinolabsImageEditorHeaderFlex">
                            <label className="dinolabsImageEditorCellTitle">
                                <FontAwesomeIcon icon={faRulerCombined} /> Dimensions
                            </label>
                            <div className="dinolabsImageEditorCellFlexSupplement">
                                <Tippy content="Collapse Dimensions" theme="tooltip-light">
                                    <button onClick={() => {setDimensionsCollapsed(!dimensionsCollapsed)}} className="dinolabsImageEditorToolButtonHeader">
                                        <FontAwesomeIcon icon={dimensionsCollapsed ? faChevronRight : faChevronDown} />
                                    </button>
                                </Tippy>
                            </div>
                        </div>
                        <div className="dinolabsImageEditorCellFlexStack">
                            <label className="dinolabsImageEditorCellFlexTitle"> Image Size </label>
                            <div className="dinolabsImageEditorCellFlex">
                                <input className="dinolabsImageEditorPositionInput" type="text" value={`W: ${Math.round(imageWidth)}px`} onChange={(e) => { const newValue = e.target.value.replace(/[^0-9.-]/g, ""); setImageWidth(Number(newValue)); addToHistory("Image size changed."); }} />
                                <input className="dinolabsImageEditorPositionInput" type="text" value={`H: ${Math.round(imageHeight)}px`} onChange={(e) => { const newValue = e.target.value.replace(/[^0-9.-]/g, ""); setImageHeight(Number(newValue)); addToHistory("Image size changed."); }} />
                            </div>
                        </div>
                        <div className="dinolabsImageEditorCellFlexStack">
                            <div className="dinolabsImageEditorCellFlex">
                                <Tippy content="Restore Width Based Aspect Ratio" theme="tooltip-light">
                                    <button onClick={restoreAspectRatioWidth} className="dinolabsImageEditorToolButton">
                                        <FontAwesomeIcon icon={faArrowsLeftRightToLine} />
                                    </button>
                                </Tippy>
                                <Tippy content="Restore Height Based Aspect Ratio" theme="tooltip-light">
                                    <button onClick={restoreAspectRatioHeight} className="dinolabsImageEditorToolButton">
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
                                                const canvasCrop = document.createElement("canvas");
                                                canvasCrop.width = cropRect.width * scaleX;
                                                canvasCrop.height = cropRect.height * scaleY;
                                                const ctxCrop = canvasCrop.getContext("2d");
                                                ctxCrop.drawImage(offscreenCanvas, cropRect.x * scaleX, cropRect.y * scaleY, cropRect.width * scaleX, cropRect.height * scaleY, 0, 0, cropRect.width * scaleX, cropRect.height * scaleY);
                                                const newDataUrl = canvasCrop.toDataURL();

                                                setCropHistory(prev => [...prev, { url, panX, panY, imageWidth, imageHeight, nativeWidth, nativeHeight, paths, undonePaths, baseVisible, baseLocked, imageLayers, hue: baseHue, saturation: baseSaturation, brightness: baseBrightness, contrast: baseContrast, opacity: baseOpacity, blur: baseBlur, spread: baseSpread, grayscale: baseGrayscale, sepia: baseSepia }]);
                                                setUrl(newDataUrl);
                                                setPanX(0);
                                                setPanY(0);
                                                setImageWidth(cropRect.width);
                                                setImageHeight(cropRect.height);
                                                setNativeWidth(cropRect.width * scaleX);
                                                setNativeHeight(cropRect.height * scaleY);
                                                setIsCropping(false);
                                                setPaths([]);
                                                setUndonePaths([]);
                                                setImageLayers([]);
                                                setSelectedLayers(['base']);
                                                setIsDrawColorOpen(false);
                                                setIsHighlightColorOpen(false);
                                                setActionMode("Idle");
                                                addToHistory("Image cropped.");
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
                                        className="dinolabsImageEditorToolButton"
                                    >
                                        <FontAwesomeIcon icon={faCropSimple} />
                                    </button>
                                </Tippy>
                                {isCropping && (
                                    <Tippy content="Circle Crop" theme="tooltip-light">
                                        <button onClick={() => { setCircleCrop(prev => !prev); addToHistory("Circle crop toggled."); }} style={{ background: circleCrop ? "#5C2BE2" : "" }} className="dinolabsImageEditorToolButton" >
                                            <FontAwesomeIcon icon={faCircle} />
                                        </button>
                                    </Tippy>
                                )}
                                <Tippy content="Undo Crop" theme="tooltip-light">
                                    <button onClick={undoCrop} className="dinolabsImageEditorToolButton" disabled={isCropDisabled} style={{ opacity: isCropDisabled ? "0.6" : "1.0" }} >
                                        <FontAwesomeIcon icon={faSquareCaretLeft} />
                                    </button>
                                </Tippy>
                            </div>
                            <div className="dinolabsImageEditorCellFlex">
                                <label className="dinolabsConfrmationCheck">
                                    <input type="checkbox" className="dinolabsSettingsCheckbox" checked={maintainAspectRatio} onChange={(e) => { setMaintainAspectRatio(e.target.checked); addToHistory("Aspect ratio setting changed."); }} />
                                    <span> Preserve Aspect Ratio </span>
                                </label>
                            </div>
                        </div>
                        {isCropping && (
                            <div className="dinolabsImageEditorCellFlexStack">
                                <label className="dinolabsImageEditorCellFlexTitle"> Crop Presets </label>
                                <div className="dinolabsImageEditorCellFlex">
                                    <button className="dinolabsImageEditorToolButtonText" onClick={() => { setCropRect(prev => ({ ...prev, height: prev.width })); addToHistory("Crop preset applied."); }}>1:1</button>
                                    <button className="dinolabsImageEditorToolButtonText" onClick={() => { setCropRect(prev => ({ ...prev, height: prev.width * (3 / 4) })); addToHistory("Crop preset applied."); }}>4:3</button>
                                    <button className="dinolabsImageEditorToolButtonText" onClick={() => { setCropRect(prev => ({ ...prev, height: prev.width * (9 / 16) })); addToHistory("Crop preset applied."); }}>16:9</button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className={!stylesCollapsed ? "dinolabsImageEditorCellWrapper" : "dinolabsImageEditorCellWrapperCollapsed"}>
                        <div className="dinolabsImageEditorHeaderFlex">
                            <label className="dinolabsImageEditorCellTitle">
                                <FontAwesomeIcon icon={faSwatchbook} /> Styles
                            </label>
                            <div className="dinolabsImageEditorCellFlexSupplement">
                                <Tippy content="Collapse Styles" theme="tooltip-light">
                                    <button onClick={() => {setStylesCollapsed(!stylesCollapsed)}} className="dinolabsImageEditorToolButtonHeader">
                                        <FontAwesomeIcon icon={stylesCollapsed ? faChevronRight : faChevronDown} />
                                    </button>
                                </Tippy>
                            </div>
                        </div>

                        <div className="dinolabsImageEditorCellFlexStack">
                            <label className="dinolabsImageEditorCellFlexTitle">Opacity</label>
                            <div className="dinolabsImageEditorCellFlex">
                                <button onClick={() => { updateFilter('opacity', Math.max(currentValues.opacity - 10, 0)); setTimeout(() => addToHistory("Filter applied."), 10); }} className="dinolabsImageEditorToolButton">
                                    <FontAwesomeIcon icon={faMinus} />
                                </button>
                                <div className="dinolabsImageEditorSliderWrapper">
                                    <input className="dinolabsSettingsSlider" type="range" min={0} max={100} value={currentValues.opacity} onInput={(e) => { updateFilter('opacity', Number(e.target.value)); setTimeout(() => addToHistory("Filter applied."), 10); }} onChange={(e) => { updateFilter('opacity', Number(e.target.value)); setTimeout(() => addToHistory("Filter applied."), 10); }} />
                                </div>
                                <button onClick={() => { updateFilter('opacity', Math.min(currentValues.opacity + 10, 100)); setTimeout(() => addToHistory("Filter applied."), 10); }} className="dinolabsImageEditorToolButton">
                                    <FontAwesomeIcon icon={faPlus} />
                                </button>
                            </div>
                        </div>

                        <div className="dinolabsImageEditorCellFlexStack">
                            <label className="dinolabsImageEditorCellFlexTitle">Hue</label>
                            <div className="dinolabsImageEditorCellFlex">
                                <button onClick={() => { updateFilter('hue', Math.max(currentValues.hue - 10, -180)); setTimeout(() => addToHistory("Filter applied."), 10); }} className="dinolabsImageEditorToolButton">
                                    <FontAwesomeIcon icon={faMinus} />
                                </button>
                                <div className="dinolabsImageEditorSliderWrapper">
                                    <input className="dinolabsSettingsSlider" type="range" min={-180} max={180} value={currentValues.hue} onInput={(e) => { updateFilter('hue', Number(e.target.value)); setTimeout(() => addToHistory("Filter applied."), 10); }} onChange={(e) => { updateFilter('hue', Number(e.target.value)); setTimeout(() => addToHistory("Filter applied."), 10); }} />
                                </div>
                                <button onClick={() => { updateFilter('hue', Math.min(currentValues.hue + 10, 180)); setTimeout(() => addToHistory("Filter applied."), 10); }} className="dinolabsImageEditorToolButton">
                                    <FontAwesomeIcon icon={faPlus} />
                                </button>
                            </div>
                        </div>

                        <div className="dinolabsImageEditorCellFlexStack">
                            <label className="dinolabsImageEditorCellFlexTitle">Saturation</label>
                            <div className="dinolabsImageEditorCellFlex">
                                <button onClick={() => { updateFilter('saturation', Math.max(currentValues.saturation - 10, 0)); setTimeout(() => addToHistory("Filter applied."), 10); }} className="dinolabsImageEditorToolButton">
                                    <FontAwesomeIcon icon={faMinus} />
                                </button>
                                <div className="dinolabsImageEditorSliderWrapper">
                                    <input className="dinolabsSettingsSlider" type="range" min={0} max={200} value={currentValues.saturation} onInput={(e) => { updateFilter('saturation', Number(e.target.value)); setTimeout(() => addToHistory("Filter applied."), 10); }} onChange={(e) => { updateFilter('saturation', Number(e.target.value)); setTimeout(() => addToHistory("Filter applied."), 10); }} />
                                </div>
                                <button onClick={() => { updateFilter('saturation', Math.min(currentValues.saturation + 10, 200)); setTimeout(() => addToHistory("Filter applied."), 10); }} className="dinolabsImageEditorToolButton">
                                    <FontAwesomeIcon icon={faPlus} />
                                </button>
                            </div>
                        </div>

                        <div className="dinolabsImageEditorCellFlexStack">
                            <label className="dinolabsImageEditorCellFlexTitle">Brightness</label>
                            <div className="dinolabsImageEditorCellFlex">
                                <button onClick={() => { updateFilter('brightness', Math.max(currentValues.brightness - 10, 0)); setTimeout(() => addToHistory("Filter applied."), 10); }} className="dinolabsImageEditorToolButton">
                                    <FontAwesomeIcon icon={faMinus} />
                                </button>
                                <div className="dinolabsImageEditorSliderWrapper">
                                    <input className="dinolabsSettingsSlider" type="range" min={0} max={200} value={currentValues.brightness} onInput={(e) => { updateFilter('brightness', Number(e.target.value)); setTimeout(() => addToHistory("Filter applied."), 10); }} onChange={(e) => { updateFilter('brightness', Number(e.target.value)); setTimeout(() => addToHistory("Filter applied."), 10); }} />
                                </div>
                                <button onClick={() => { updateFilter('brightness', Math.min(currentValues.brightness + 10, 200)); setTimeout(() => addToHistory("Filter applied."), 10); }} className="dinolabsImageEditorToolButton">
                                    <FontAwesomeIcon icon={faPlus} />
                                </button>
                            </div>
                        </div>

                        <div className="dinolabsImageEditorCellFlexStack">
                            <label className="dinolabsImageEditorCellFlexTitle">Contrast</label>
                            <div className="dinolabsImageEditorCellFlex">
                                <button onClick={() => { updateFilter('contrast', Math.max(currentValues.contrast - 10, 0)); setTimeout(() => addToHistory("Filter applied."), 10); }} className="dinolabsImageEditorToolButton">
                                    <FontAwesomeIcon icon={faMinus} />
                                </button>
                                <div className="dinolabsImageEditorSliderWrapper">
                                    <input className="dinolabsSettingsSlider" type="range" min={0} max={200} value={currentValues.contrast} onInput={(e) => { updateFilter('contrast', Number(e.target.value)); setTimeout(() => addToHistory("Filter applied."), 10); }} onChange={(e) => { updateFilter('contrast', Number(e.target.value)); setTimeout(() => addToHistory("Filter applied."), 10); }} />
                                </div>
                                <button onClick={() => { updateFilter('contrast', Math.min(currentValues.contrast + 10, 200)); setTimeout(() => addToHistory("Filter applied."), 10); }} className="dinolabsImageEditorToolButton">
                                    <FontAwesomeIcon icon={faPlus} />
                                </button>
                            </div>
                        </div>

                        <div className="dinolabsImageEditorCellFlexStack">
                            <label className="dinolabsImageEditorCellFlexTitle">Blur</label>
                            <div className="dinolabsImageEditorCellFlex">
                                <button onClick={() => { updateFilter('blur', Math.max(currentValues.blur - 1, 0)); setTimeout(() => addToHistory("Filter applied."), 10); }} className="dinolabsImageEditorToolButton">
                                    <FontAwesomeIcon icon={faMinus} />
                                </button>
                                <div className="dinolabsImageEditorSliderWrapper">
                                    <input className="dinolabsSettingsSlider" type="range" min={0} max={100} value={currentValues.blur} onInput={(e) => { updateFilter('blur', Number(e.target.value)); setTimeout(() => addToHistory("Filter applied."), 10); }} onChange={(e) => { updateFilter('blur', Number(e.target.value)); setTimeout(() => addToHistory("Filter applied."), 10); }} />
                                </div>
                                <button onClick={() => { updateFilter('blur', Math.min(currentValues.blur + 1, 100)); setTimeout(() => addToHistory("Filter applied."), 10); }} className="dinolabsImageEditorToolButton">
                                    <FontAwesomeIcon icon={faPlus} />
                                </button>
                            </div>
                        </div>

                        <div className="dinolabsImageEditorCellFlexStack">
                            <label className="dinolabsImageEditorCellFlexTitle">Shadow</label>
                            <div className="dinolabsImageEditorCellFlex">
                                <button onClick={() => { updateFilter('spread', Math.max(currentValues.spread - 1, 0)); setTimeout(() => addToHistory("Filter applied."), 10); }} className="dinolabsImageEditorToolButton">
                                    <FontAwesomeIcon icon={faMinus} />
                                </button>
                                <div className="dinolabsImageEditorSliderWrapper">
                                    <input className="dinolabsSettingsSlider" type="range" min={0} max={100} value={currentValues.spread} onInput={(e) => { updateFilter('spread', Number(e.target.value)); setTimeout(() => addToHistory("Filter applied."), 10); }} onChange={(e) => { updateFilter('spread', Number(e.target.value)); setTimeout(() => addToHistory("Filter applied."), 10); }} />
                                </div>
                                <button onClick={() => { updateFilter('spread', Math.min(currentValues.spread + 1, 100)); setTimeout(() => addToHistory("Filter applied."), 10); }} className="dinolabsImageEditorToolButton">
                                    <FontAwesomeIcon icon={faPlus} />
                                </button>
                            </div>
                        </div>

                        <div className="dinolabsImageEditorCellFlexStack">
                            <label className="dinolabsImageEditorCellFlexTitle">Grayscale</label>
                            <div className="dinolabsImageEditorCellFlex">
                                <button onClick={() => { updateFilter('grayscale', Math.max(currentValues.grayscale - 10, 0)); setTimeout(() => addToHistory("Filter applied."), 10); }} className="dinolabsImageEditorToolButton">
                                    <FontAwesomeIcon icon={faMinus} />
                                </button>
                                <div className="dinolabsImageEditorSliderWrapper">
                                    <input className="dinolabsSettingsSlider" type="range" min={0} max={100} value={currentValues.grayscale} onInput={(e) => { updateFilter('grayscale', Number(e.target.value)); setTimeout(() => addToHistory("Filter applied."), 10); }} onChange={(e) => { updateFilter('grayscale', Number(e.target.value)); setTimeout(() => addToHistory("Filter applied."), 10); }} />
                                </div>
                                <button onClick={() => { updateFilter('grayscale', Math.min(currentValues.grayscale + 10, 100)); setTimeout(() => addToHistory("Filter applied."), 10); }} className="dinolabsImageEditorToolButton">
                                    <FontAwesomeIcon icon={faPlus} />
                                </button>
                            </div>
                        </div>

                        <div className="dinolabsImageEditorCellFlexStack">
                            <label className="dinolabsImageEditorCellFlexTitle">Sepia</label>
                            <div className="dinolabsImageEditorCellFlex">
                                <button onClick={() => { updateFilter('sepia', Math.max(currentValues.sepia - 10, 0)); setTimeout(() => addToHistory("Filter applied."), 10); }} className="dinolabsImageEditorToolButton">
                                    <FontAwesomeIcon icon={faMinus} />
                                </button>
                                <div className="dinolabsImageEditorSliderWrapper">
                                    <input className="dinolabsSettingsSlider" type="range" min={0} max={100} value={currentValues.sepia} onInput={(e) => { updateFilter('sepia', Number(e.target.value)); setTimeout(() => addToHistory("Filter applied."), 10); }} onChange={(e) => { updateFilter('sepia', Number(e.target.value)); setTimeout(() => addToHistory("Filter applied."), 10); }} />
                                </div>
                                <button onClick={() => { updateFilter('sepia', Math.min(currentValues.sepia + 10, 100)); setTimeout(() => addToHistory("Filter applied."), 10); }} className="dinolabsImageEditorToolButton">
                                    <FontAwesomeIcon icon={faPlus} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className={!drawingCollapsed ? "dinolabsImageEditorCellWrapper" : "dinolabsImageEditorCellWrapperCollapsed"}>
                        <div className="dinolabsImageEditorHeaderFlex">
                            <label className="dinolabsImageEditorCellTitle">
                                <FontAwesomeIcon icon={faBrush} /> Drawing
                            </label>
                            <div className="dinolabsImageEditorCellFlexSupplement">
                                {!drawingCollapsed && (
                                    <>
                                        <Tippy content="Undo Drawing/Highlighting" theme="tooltip-light">
                                            <button onClick={undoStroke} className="dinolabsImageEditorToolButtonHeader">
                                                <FontAwesomeIcon icon={faArrowLeft} />
                                            </button>
                                        </Tippy>
                                        <Tippy content="Redo Drawing/Highlighting" theme="tooltip-light">
                                            <button onClick={redoStroke} className="dinolabsImageEditorToolButtonHeader">
                                                <FontAwesomeIcon icon={faArrowRight} />
                                            </button>
                                        </Tippy>
                                    </>
                                )}
                                <Tippy content="Collapse Drawing" theme="tooltip-light">
                                    <button onClick={() => {setDrawingCollapsed(!drawingCollapsed)}} className="dinolabsImageEditorToolButtonHeader">
                                        <FontAwesomeIcon icon={drawingCollapsed ? faChevronRight : faChevronDown} />
                                    </button>
                                </Tippy>
                            </div>
                        </div>

                        <div className="dinolabsImageEditorCellFlexStack">
                            <label className="dinolabsImageEditorCellFlexTitle">Draw on Image</label>
                            <div className="dinolabsImageEditorCellFlex">
                                <div className="dinolabsImageEditorCellFlexSubStack">
                                    <div className="dinolabsImageEditorCellFlexSubRow">
                                        <button onClick={() => { setActionMode(prev => prev === "Drawing" ? "Idle" : "Drawing"); addToHistory(`Drawing mode ${actionMode === "Drawing" ? 'disabled' : 'enabled'}.`); }} style={{ background: actionMode === "Drawing" ? "#5C2BE2" : "", opacity: isCropping ? "0.6" : "1.0" }} disabled={isCropping} className="dinolabsImageEditorToolButtonBig" >
                                            Draw
                                        </button>
                                        <Tippy content="Brush Color" theme="tooltip-light">
                                            <Tippy 
                                                content={<DinoLabsColorPicker color={drawColor} onChange={(newColor) => { setDrawColor(newColor); addToHistory("Drawing color changed."); }} />} 
                                                visible={isDrawColorOpen} 
                                                onClickOutside={() => setIsDrawColorOpen(false)} 
                                                interactive={true} 
                                                placement="right" 
                                                className="color-picker-tippy"
                                                appendTo={() => document.body}  
                                            >
                                                <label className="dinolabsImageEditorColorPicker" onClick={() => setIsDrawColorOpen((prev) => !prev)} style={{ background: drawColor }} />
                                            </Tippy>
                                        </Tippy>
                                    </div>
                                    <div className="dinolabsImageEditorBrushSizeFlex">
                                        {[{ size: 1, label: "XS" }, { size: 2, label: "S" }, { size: 4, label: "M" }, { size: 6, label: "L" }, { size: 8, label: "XL" }].map(opt => (
                                            <button key={opt.size} onClick={() => { setDrawBrushSize(opt.size); addToHistory(`Drawing brush size changed to ${opt.label}.`); }} style={{ background: drawBrushSize === opt.size ? "#5C2BE2" : "" }} className="dinolabsImageEditorToolButtonMini" >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="dinolabsImageEditorCellFlexStack">
                            <label className="dinolabsImageEditorCellFlexTitle">Highlight on Image</label>
                            <div className="dinolabsImageEditorCellFlex">
                                <div className="dinolabsImageEditorCellFlexSubStack">
                                    <div className="dinolabsImageEditorCellFlexSubRow">
                                        <button onClick={() => { setActionMode(prev => prev === "Highlighting" ? "Idle" : "Highlighting"); addToHistory(`Highlighting mode ${actionMode === "Highlighting" ? 'disabled' : 'enabled'}.`); }} style={{ background: actionMode === "Highlighting" ? "#5C2BE2" : "", opacity: isCropping ? "0.6" : "1.0" }} disabled={isCropping} className="dinolabsImageEditorToolButtonBig" >
                                            Highlight
                                        </button>
                                        <Tippy content="Highlighter Color" theme="tooltip-light">
                                            <Tippy 
                                                content={<DinoLabsColorPicker color={highlightColor} onChange={(newColor) => { setHighlightColor(newColor); addToHistory("Highlighting color changed."); }} />} 
                                                visible={isHighlightColorOpen} 
                                                onClickOutside={() => setIsHighlightColorOpen(false)} 
                                                interactive={true} 
                                                placement="right" 
                                                className="color-picker-tippy"
                                                appendTo={() => document.body}  
                                            >
                                                <label className="dinolabsImageEditorColorPicker" onClick={() => setIsHighlightColorOpen((prev) => !prev)} style={{ background: highlightColor }} />
                                            </Tippy>
                                        </Tippy>
                                    </div>
                                    <div className="dinolabsImageEditorBrushSizeFlex">
                                        {[{ size: 1, label: "XS" }, { size: 2, label: "S" }, { size: 4, label: "M" }, { size: 6, label: "L" }, { size: 8, label: "XL" }].map(opt => (
                                            <button key={opt.size} onClick={() => { setHighlightBrushSize(opt.size); addToHistory(`Highlighting brush size changed to ${opt.label}.`); }} style={{ background: highlightBrushSize === opt.size ? "#5C2BE2" : "" }} className="dinolabsImageEditorToolButtonMini" >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={!cornerCollapsed ? "dinolabsImageEditorCellWrapper" : "dinolabsImageEditorCellWrapperCollapsed"}>
                        <div className="dinolabsImageEditorHeaderFlex">
                            <label className="dinolabsImageEditorCellTitle">
                                <FontAwesomeIcon icon={faBorderTopLeft} /> Corner Rounding
                            </label>
                            <Tippy content="Collapse Corner Radii" theme="tooltip-light">
                                <button onClick={() => {setCornerCollapsed(!cornerCollapsed)}} className="dinolabsImageEditorToolButtonHeader">
                                    <FontAwesomeIcon icon={cornerCollapsed ? faChevronRight : faChevronDown} />
                                </button>
                            </Tippy>
                        </div>
                        <div className="dinolabsImageEditorCellFlexStack">
                            <label className="dinolabsImageEditorCellFlexTitle"> Corner Radii </label>
                            <div className="dinolabsImageEditorCellFlex">
                                {syncCorners ? (
                                    <input className="dinolabsImageEditorPositionInput" type="text" value={`Corner: ${borderRadius}px`} onChange={(e) => { const newVal = e.target.value.replace(/[^0-9]/g, ""); let val = Number(newVal); val = Math.min(val, MAX_CORNER_RADIUS); setBorderRadius(val); setBorderTopLeftRadius(val); setBorderTopRightRadius(val); setBorderBottomLeftRadius(val); setBorderBottomRightRadius(val); addToHistory("Corner rounding changed."); }} />
                                ) : (
                                    <div className="dinolabsCornerInputGridWrapper">
                                        <div className="dinolabsCornerInputFlex">
                                            <input className="dinolabsImageEditorPositionInput" type="text" value={`TL: ${borderTopLeftRadius}px`} onChange={(e) => { const newVal = e.target.value.replace(/[^0-9]/g, ""); let val = Number(newVal); val = Math.min(val, MAX_CORNER_RADIUS); setBorderTopLeftRadius(val); addToHistory("Corner rounding changed."); }} />
                                            <input className="dinolabsImageEditorPositionInput" type="text" value={`TR: ${borderTopRightRadius}px`} onChange={(e) => { const newVal = e.target.value.replace(/[^0-9]/g, ""); let val = Number(newVal); val = Math.min(val, MAX_CORNER_RADIUS); setBorderTopRightRadius(val); addToHistory("Corner rounding changed."); }} />
                                        </div>
                                        <div className="dinolabsCornerInputFlex">
                                            <input className="dinolabsImageEditorPositionInput" type="text" value={`BL: ${borderBottomLeftRadius}px`} onChange={(e) => { const newVal = e.target.value.replace(/[^0-9]/g, ""); let val = Number(newVal); val = Math.min(val, MAX_CORNER_RADIUS); setBorderBottomLeftRadius(val); addToHistory("Corner rounding changed."); }} />
                                            <input className="dinolabsImageEditorPositionInput" type="text" value={`BR: ${borderBottomRightRadius}px`} onChange={(e) => { const newVal = e.target.value.replace(/[^0-9]/g, ""); let val = Number(newVal); val = Math.min(val, MAX_CORNER_RADIUS); setBorderBottomRightRadius(val); addToHistory("Corner rounding changed."); }} />
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="dinolabsImageEditorCellFlex">
                                <label className="dinolabsConfrmationCheck">
                                    <input type="checkbox" className="dinolabsSettingsCheckbox" checked={syncCorners} onChange={(e) => { setSyncCorners(e.target.checked); if (e.target.checked) { const radius = borderRadius || borderTopLeftRadius || 0; const limited = Math.min(radius, MAX_CORNER_RADIUS); setBorderRadius(limited); setBorderTopLeftRadius(limited); setBorderTopRightRadius(limited); setBorderBottomLeftRadius(limited); setBorderBottomRightRadius(limited); } addToHistory("Corner rounding changed."); }} />
                                    <span> Sync Corners </span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="dinolabsImageEditorContainerWrapper">
                <div
                    className="dinolabsImageEditorContainer"
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
                    <div className="dinolabsImageResizer" style={{ top: `calc(50% + ${panY}px)`, left: `calc(50% + ${panX}px)`, width: `${imageWidth}px`, height: `${imageHeight}px`, transform: `translate(-50%, -50%) scale(${baseZoom}, ${baseZoom}) rotate(${baseRotation}deg)`, borderRadius: syncCorners ? `${borderRadius}px` : `${borderTopLeftRadius}px ${borderTopRightRadius}px ${borderBottomRightRadius}px ${borderBottomLeftRadius}px`, border: selectedLayers.includes('base') && actionMode === "Idle" ? "2px dashed #5C2BE2" : "none" }} >
                        <img src={url} alt="Media content" draggable={false} onDragStart={(e) => e.preventDefault()} onClick={handleBaseImageClick} className="dinolabsImageEditorContent" style={getBaseImageStyle()} />

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
                                        <div className="dinolabsImageEditorResizeHandle top-left" onMouseDown={(e) => handleImageLayerResizeMouseDown(layer.id, "top-left", e)} style={{ top: `-${RESIZE_HANDLE_SIZE}px`, left: `-${RESIZE_HANDLE_SIZE}px` }} />
                                        <div className="dinolabsImageEditorResizeHandle top-right" onMouseDown={(e) => handleImageLayerResizeMouseDown(layer.id, "top-right", e)} style={{ top: `-${RESIZE_HANDLE_SIZE}px`, right: `-${RESIZE_HANDLE_SIZE}px` }} />
                                        <div className="dinolabsImageEditorResizeHandle bottom-left" onMouseDown={(e) => handleImageLayerResizeMouseDown(layer.id, "bottom-left", e)} style={{ bottom: `-${RESIZE_HANDLE_SIZE}px`, left: `-${RESIZE_HANDLE_SIZE}px` }} />
                                        <div className="dinolabsImageEditorResizeHandle bottom-right" onMouseDown={(e) => handleImageLayerResizeMouseDown(layer.id, "bottom-right", e)} style={{ bottom: `-${RESIZE_HANDLE_SIZE}px`, right: `-${RESIZE_HANDLE_SIZE}px` }} />
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
                                <div className="dinolabsImageEditorResizeHandle top-left" onMouseDown={(e) => handleResizeMouseDown("top-left", e)} style={{ top: `-${RESIZE_HANDLE_SIZE}px`, left: `-${RESIZE_HANDLE_SIZE}px` }} />
                                <div className="dinolabsImageEditorResizeHandle top-right" onMouseDown={(e) => handleResizeMouseDown("top-right", e)} style={{ top: `-${RESIZE_HANDLE_SIZE}px`, right: `-${RESIZE_HANDLE_SIZE}px` }} />
                                <div className="dinolabsImageEditorResizeHandle bottom-left" onMouseDown={(e) => handleResizeMouseDown("bottom-left", e)} style={{ bottom: `-${RESIZE_HANDLE_SIZE}px`, left: `-${RESIZE_HANDLE_SIZE}px` }} />
                                <div className="dinolabsImageEditorResizeHandle bottom-right" onMouseDown={(e) => handleResizeMouseDown("bottom-right", e)} style={{ bottom: `-${RESIZE_HANDLE_SIZE}px`, right: `-${RESIZE_HANDLE_SIZE}px` }} />
                            </>
                        )}

                        {isCropping && (
                            <div className="dinolabsImageEditorCropRectangle" style={{ position: "absolute", border: "0.4vh dashed rgba(31, 174, 245, 1)", background: "rgba(0,0,0,0.6)", left: cropRect.x, top: cropRect.y, width: cropRect.width, height: cropRect.height, transform: `rotate(${cropRotation}deg)`, borderRadius: circleCrop ? "50%" : "0", zIndex: 10 }} onMouseDown={handleCropMouseDown} >
                                <div className="dinolabsImageEditorResizeHandle top-left" style={{ pointerEvents: "auto", top: `-${CROP_HANDLE_SIZE}px`, left: `-${CROP_HANDLE_SIZE}px` }} onMouseDown={(e) => handleCropResizeMouseDown("top-left", e)} />
                                <div className="dinolabsImageEditorResizeHandle top-right" style={{ pointerEvents: "auto", top: `-${CROP_HANDLE_SIZE}px`, right: `-${CROP_HANDLE_SIZE}px` }} onMouseDown={(e) => handleCropResizeMouseDown("top-right", e)} />
                                <div className="dinolabsImageEditorResizeHandle bottom-left" style={{ pointerEvents: "auto", bottom: `-${CROP_HANDLE_SIZE}px`, left: `-${CROP_HANDLE_SIZE}px` }} onMouseDown={(e) => handleCropResizeMouseDown("bottom-left", e)} />
                                <div className="dinolabsImageEditorResizeHandle bottom-right" style={{ pointerEvents: "auto", bottom: `-${CROP_HANDLE_SIZE}px`, right: `-${CROP_HANDLE_SIZE}px` }} onMouseDown={(e) => handleCropResizeMouseDown("bottom-right", e)} />
                                <div className="dinolabsImageEditorRotationHandle top-left" style={{ pointerEvents: "auto", position: "absolute", top: "-30px", left: "-30px" }} onMouseDown={handleCropRotationMouseDown} />
                                <div className="dinolabsImageEditorRotationHandle top-right" style={{ pointerEvents: "auto", position: "absolute", top: "-30px", right: "-30px" }} onMouseDown={handleCropRotationMouseDown} />
                                <div className="dinolabsImageEditorRotationHandle bottom-left" style={{ pointerEvents: "auto", position: "absolute", bottom: "-30px", left: "-30px" }} onMouseDown={handleCropRotationMouseDown} />
                                <div className="dinolabsImageEditorRotationHandle bottom-right" style={{ pointerEvents: "auto", position: "absolute", bottom: "-30px", right: "-30px" }} onMouseDown={handleCropRotationMouseDown} />
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="dinolabsVideoInputBottomBar">
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