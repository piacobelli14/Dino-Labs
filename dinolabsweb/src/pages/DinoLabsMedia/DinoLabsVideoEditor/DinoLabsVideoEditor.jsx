import React, { useState, useEffect, useRef } from "react";
import "../../../styles/mainStyles/DinoLabsMedia/DinoLabsVideoEditor/DinoLabsVideoEditor.css";
import "../../../styles/helperStyles/Slider.css";
import "../../../styles/helperStyles/Checkbox.css";
import DinoLabsColorPicker from "../../../helpers/ColorPicker.jsx";
import { showDialog } from "../../../helpers/Alert.jsx";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft, faArrowRight, faArrowsLeftRightToLine, faArrowsRotate, faArrowsUpToLine, faBackward,
  faBorderTopLeft, faBrush, faCircle, faCropSimple, faDownload, faFilm, faForward, faLeftRight,
  faMagnifyingGlassMinus, faMagnifyingGlassPlus, faMinus, faPause, faPlay, faPlus, faRepeat,
  faRotateLeft, faRotateRight, faRulerCombined, faSave, faScissors, faSquare, faSquareCaretLeft,
  faSwatchbook, faTabletScreenButton, faTape, faUpDown, faCut, faObjectGroup, faExpand, faCompress,
  faStepBackward, faStepForward, faVolumeUp, faVolumeOff, faFont, faLayerGroup, faMagic, faClone,
  faTrash, faEye, faEyeSlash, faLock, faUnlock, faGripVertical, faSearchPlus, faSearchMinus,
  faAlignLeft, faAlignCenter, faAlignRight, faBold, faItalic, faUnderline, faMusic, faWaveSquare,
  faVolumeXmark, faUndo, faRedo, faSquarePlus,
  faChevronCircleRight,
  faChevronDown,
  faChevronRight,
  faPenToSquare
} from "@fortawesome/free-solid-svg-icons";

export default function DinoLabsVideoEditor({ fileHandle }) {
  const BASE_ZOOM = 1;
  const BASE_ROTATION = 0;
  const BASE_FLIP = 1;
  const BASE_FILTER_VALUES = { hue: 0, saturation: 100, brightness: 100, contrast: 100, opacity: 100, blur: 0, spread: 0, grayscale: 0, sepia: 0 };
  const MIN_SIZE = 50;
  const MAX_CORNER_RADIUS = 100;
  const RESIZE_HANDLE_SIZE = 6;
  const CROP_HANDLE_SIZE = 8;
  const DEFAULT_VIDEO_SIZE = 300;
  const DEFAULT_FPS = 15;
  const DEFAULT_PLAYBACK_RATES = [0.25, 0.5, 1.0, 1.5, 2.0, 4.0];
  const FRAME_INTERVAL_OPTIONS = [0.1, 0.25, 0.5, 1, 2, 5, 10];

  const formatTime = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    return (h > 0 ? String(h).padStart(2, "0") + ":" : "") + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  };

  const fitToContainer = (frameBarOpen, realW = nativeWidth, realH = nativeHeight) => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth;
    let containerHeight = containerRef.current.clientHeight;
    if (frameBarOpen) containerHeight *= 0.7;
    const maxPossibleWidth = containerWidth * 0.7;
    const maxPossibleHeight = containerHeight * 0.7;
    let initWidth = realW;
    let initHeight = realH;
    const widthRatio = initWidth / maxPossibleWidth;
    const heightRatio = initHeight / maxPossibleHeight;
    if (widthRatio > 1 || heightRatio > 1) {
      const ratio = Math.max(widthRatio, heightRatio);
      initWidth /= ratio;
      initHeight /= ratio;
    }
    setVideoWidth(initWidth);
    setVideoHeight(initHeight);
    setPanX(0);
    setPanY(0);
  };

  const [url, setUrl] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [nativeWidth, setNativeWidth] = useState(DEFAULT_VIDEO_SIZE);
  const [nativeHeight, setNativeHeight] = useState(DEFAULT_VIDEO_SIZE);
  const [videoWidth, setVideoWidth] = useState(DEFAULT_VIDEO_SIZE);
  const [videoHeight, setVideoHeight] = useState(DEFAULT_VIDEO_SIZE);
  const [originalFileSize, setOriginalFileSize] = useState(null);
  const [originalDuration, setOriginalDuration] = useState(null);

  const [layoutCollapsed, setLayoutCollapsed] = useState(true);
  const [dimensionsCollapsed, setDimensionsCollapsed] = useState(true);
  const [stylesCollapsed, setStylesCollapsed] = useState(true);
  const [cornerCollapsed, setCornerCollapsed] = useState(true);

  const [zoom, setZoom] = useState(BASE_ZOOM);
  const [rotation, setRotation] = useState(BASE_ROTATION);
  const [flipX, setFlipX] = useState(BASE_FLIP);
  const [flipY, setFlipY] = useState(BASE_FLIP);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true);

  const [hueGlobal, setHueGlobal] = useState(BASE_FILTER_VALUES.hue);
  const [saturationGlobal, setSaturationGlobal] = useState(BASE_FILTER_VALUES.saturation);
  const [brightnessGlobal, setBrightnessGlobal] = useState(BASE_FILTER_VALUES.brightness);
  const [contrastGlobal, setContrastGlobal] = useState(BASE_FILTER_VALUES.contrast);
  const [opacityGlobal, setOpacityGlobal] = useState(BASE_FILTER_VALUES.opacity);
  const [blurGlobal, setBlurGlobal] = useState(BASE_FILTER_VALUES.blur);
  const [spreadGlobal, setSpreadGlobal] = useState(BASE_FILTER_VALUES.spread);
  const [grayscaleGlobal, setGrayscaleGlobal] = useState(BASE_FILTER_VALUES.grayscale);
  const [sepiaGlobal, setSepiaGlobal] = useState(BASE_FILTER_VALUES.sepia);

  const [borderRadiusGlobal, setBorderRadiusGlobal] = useState(0);
  const [borderTopLeftRadiusGlobal, setBorderTopLeftRadiusGlobal] = useState(0);
  const [borderTopRightRadiusGlobal, setBorderTopRightRadiusGlobal] = useState(0);
  const [borderBottomLeftRadiusGlobal, setBorderBottomLeftRadiusGlobal] = useState(0);
  const [borderBottomRightRadiusGlobal, setBorderBottomRightRadiusGlobal] = useState(0);
  const [syncCornersGlobal, setSyncCornersGlobal] = useState(false);

  const [isCropping, setIsCropping] = useState(false);
  const [cropRect, setCropRect] = useState({ x: 0, y: 0, width: 100, height: 100 });
  const [cropRotation, setCropRotation] = useState(0);
  const [circleCrop, setCircleCrop] = useState(false);
  const [isCropDisabled, setIsCropDisabled] = useState(false);
  const [cropHistory, setCropHistory] = useState([]);
  const [isProcessingCrop, setIsProcessingCrop] = useState(false);

  const [actionMode, setActionMode] = useState("Idle");
  const [resizingCorner, setResizingCorner] = useState(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentPlaybackRate, setCurrentPlaybackRate] = useState(1.0);
  const [isLooping, setIsLooping] = useState(false);
  const [masterVolume, setMasterVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);

  const [frames, setFrames] = useState([]);
  const [originalExtractedFrames, setOriginalExtractedFrames] = useState([]);
  const [isExtractingFrames, setIsExtractingFrames] = useState(false);
  const [framesPanelMode, setFramesPanelMode] = useState("none");
  const [frameInterval, setFrameInterval] = useState(1);
  const [isRebuildingVideoFromFrames, setIsRebuildingVideoFromFrames] = useState(false);

  const [timelineClips, setTimelineClips] = useState([]);
  const [selectedClips, setSelectedClips] = useState([]);
  const [timelineZoom, setTimelineZoom] = useState(50);
  const [showTimeline, setShowTimeline] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(true);

  const [textOverlays, setTextOverlays] = useState([]);
  const [selectedTextOverlay, setSelectedTextOverlay] = useState(-1);
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [textEditorState, setTextEditorState] = useState({
    text: "",
    font: "Arial",
    size: 32,
    color: "#ffffff",
    alignment: "center",
    bold: false,
    italic: false,
    underline: false,
    x: 50,
    y: 50
  });
  const [isTextColorOpen, setIsTextColorOpen] = useState(false);

  const [exportQuality, setExportQuality] = useState("high");
  const [exportFormat, setExportFormat] = useState("mp4");
  const [exportResolution, setExportResolution] = useState("original");
  const [isDownloadingVideo, setIsDownloadingVideo] = useState(false);

  const [audioTracks, setAudioTracks] = useState([]);
  const [transitions, setTransitions] = useState([]);
  const [selectedTransition, setSelectedTransition] = useState("none");
  const [speedRamps, setSpeedRamps] = useState([]);
  const [globalSpeed, setGlobalSpeed] = useState(1.0);

  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const framesContainerRef = useRef(null);
  const aspectRatioRef = useRef(1);
  const resizingRef = useRef(false);
  const lastResizePosRef = useRef({ x: 0, y: 0 });
  const initialSizeRef = useRef({ width: DEFAULT_VIDEO_SIZE, height: DEFAULT_VIDEO_SIZE });
  const initialPosRef = useRef({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const initialMousePosRef = useRef(null);
  const cropResizingRef = useRef(false);
  const cropResizingCorner = useRef(null);
  const cropLastResizePosRef = useRef({ x: 0, y: 0 });
  const cropInitialRectRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const cropRotatingRef = useRef(false);
  const cropInitialRotation = useRef(0);
  const cropRotationStartAngle = useRef(0);
  const cropRotationCenter = useRef({ x: 0, y: 0 });
  const cropDraggingRefLocal = useRef(false);
  const lastCropDragPosRef = useRef({ x: 0, y: 0 });

  const showFrameBar = framesPanelMode !== "none" && framesPanelMode !== "timeline";

  const handleZoomIn = () => setZoom(prev => prev + 0.1);
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.1));
  const handleRotateLeft = () => setRotation(prev => prev - 90);
  const handleRotateRight = () => setRotation(prev => prev + 90);
  const handleFlipHorizontal = () => setFlipX(prev => -prev);
  const handleFlipVertical = () => setFlipY(prev => -prev);

  const restoreAspectRatioWidth = () => setVideoHeight(videoWidth * (nativeHeight / nativeWidth));
  const restoreAspectRatioHeight = () => setVideoWidth(videoHeight * (nativeWidth / nativeHeight));

  const handleTimelineSeek = (time) => {
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const handleClipSelect = (index) => {
    setSelectedClips([index]);
  };

  const handleClipSplit = (index) => {
    const clip = timelineClips[index];
    if (!clip) return;
    const splitTime = currentTime - clip.startTime;
    if (splitTime <= 0 || splitTime >= clip.duration) return;
    const newClips = [...timelineClips];
    const firstPart = { ...clip, duration: splitTime };
    const secondPart = { ...clip, startTime: clip.startTime + splitTime, duration: clip.duration - splitTime };
    newClips.splice(index, 1, firstPart, secondPart);
    setTimelineClips(newClips);
  };

  const handleClipDelete = (index) => {
    const newClips = timelineClips.filter((_, i) => i !== index);
    setTimelineClips(newClips);
    setSelectedClips([]);
  };

  const handleClipMove = (fromIndex, toIndex) => {
    const newClips = [...timelineClips];
    const [movedClip] = newClips.splice(fromIndex, 1);
    newClips.splice(toIndex, 0, movedClip);
    setTimelineClips(newClips);
  };

  const handleAddTextOverlay = () => {
    const newOverlay = {
      id: Date.now(),
      text: "New Text",
      font: "Arial",
      size: 32,
      color: "#ffffff",
      alignment: "center",
      bold: false,
      italic: false,
      underline: false,
      x: 50,
      y: 50,
      startTime: currentTime,
      duration: 5,
      opacity: 100
    };
    setTextOverlays(prev => [...prev, newOverlay]);
    setSelectedTextOverlay(textOverlays.length);
    setTextEditorState(newOverlay);
    saveState();
  };

  const handleUpdateTextOverlay = (index, updates) => {
    const newOverlays = [...textOverlays];
    newOverlays[index] = { ...newOverlays[index], ...updates };
    setTextOverlays(newOverlays);
    saveState();
  };

  const handleDeleteTextOverlay = (index) => {
    setTextOverlays(prev => prev.filter((_, i) => i !== index));
    if (selectedTextOverlay === index) {
      setSelectedTextOverlay(-1);
      setShowTextEditor(false);
    }
    saveState();
  };

  const saveState = () => {
    const state = {
      timelineClips: [...timelineClips],
      textOverlays: [...textOverlays],
      frames: [...frames],
      currentTime,
      videoWidth,
      videoHeight,
      panX,
      panY,
      zoom,
      rotation,
      flipX,
      flipY
    };
    setUndoStack(prev => [...prev.slice(-19), state]);
    setRedoStack([]);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const currentState = {
      timelineClips: [...timelineClips],
      textOverlays: [...textOverlays],
      frames: [...frames],
      currentTime,
      videoWidth,
      videoHeight,
      panX,
      panY,
      zoom,
      rotation,
      flipX,
      flipY
    };
    setRedoStack(prev => [...prev, currentState]);
    const prevState = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    setTimelineClips(prevState.timelineClips);
    setTextOverlays(prevState.textOverlays);
    setFrames(prevState.frames);
    setCurrentTime(prevState.currentTime);
    setVideoWidth(prevState.videoWidth);
    setVideoHeight(prevState.videoHeight);
    setPanX(prevState.panX);
    setPanY(prevState.panY);
    setZoom(prevState.zoom);
    setRotation(prevState.rotation);
    setFlipX(prevState.flipX);
    setFlipY(prevState.flipY);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    const currentState = {
      timelineClips: [...timelineClips],
      textOverlays: [...textOverlays],
      frames: [...frames],
      currentTime,
      videoWidth,
      videoHeight,
      panX,
      panY,
      zoom,
      rotation,
      flipX,
      flipY
    };
    setUndoStack(prev => [...prev, currentState]);
    setTimelineClips(nextState.timelineClips);
    setTextOverlays(nextState.textOverlays);
    setFrames(nextState.frames);
    setCurrentTime(nextState.currentTime);
    setVideoWidth(nextState.videoWidth);
    setVideoHeight(nextState.videoHeight);
    setPanX(nextState.panX);
    setPanY(nextState.panY);
    setZoom(nextState.zoom);
    setRotation(nextState.rotation);
    setFlipX(nextState.flipX);
    setFlipY(nextState.flipY);
  };

  const resetVideo = () => {
    setZoom(BASE_ZOOM);
    setRotation(BASE_ROTATION);
    setFlipX(BASE_FLIP);
    setFlipY(BASE_FLIP);
    setPanX(0);
    setPanY(0);
    setHueGlobal(BASE_FILTER_VALUES.hue);
    setSaturationGlobal(BASE_FILTER_VALUES.saturation);
    setBrightnessGlobal(BASE_FILTER_VALUES.brightness);
    setContrastGlobal(BASE_FILTER_VALUES.contrast);
    setOpacityGlobal(BASE_FILTER_VALUES.opacity);
    setBlurGlobal(BASE_FILTER_VALUES.blur);
    setSpreadGlobal(BASE_FILTER_VALUES.spread);
    setGrayscaleGlobal(BASE_FILTER_VALUES.grayscale);
    setSepiaGlobal(BASE_FILTER_VALUES.sepia);
    setBorderRadiusGlobal(0);
    setBorderTopLeftRadiusGlobal(0);
    setBorderTopRightRadiusGlobal(0);
    setBorderBottomLeftRadiusGlobal(0);
    setBorderBottomRightRadiusGlobal(0);
    setSyncCornersGlobal(false);
    setActionMode("Idle");
    setIsCropping(false);
    setCropRect({ x: 0, y: 0, width: 100, height: 100 });
    setCropRotation(0);
    setCircleCrop(false);
    setIsCropDisabled(false);
    fitToContainer(showFrameBar || showTimeline, nativeWidth, nativeHeight);
    setFrames([]);
    setOriginalExtractedFrames([]);
    setTextOverlays([]);
    setSelectedTextOverlay(-1);
    setShowTextEditor(false);
    setTimelineClips([]);
    setSelectedClips([]);
    setCurrentTime(0);
    saveState();
  };

  const performCanvasVideoCrop = async () => {
    setIsProcessingCrop(true);

    const sourceVideo = document.createElement("video");
    sourceVideo.src = url;
    sourceVideo.crossOrigin = "anonymous";
    sourceVideo.muted = true;
    sourceVideo.preload = "metadata";

    await new Promise(resolve => {
      sourceVideo.onloadedmetadata = resolve;
    });

    const scaleX = sourceVideo.videoWidth / videoWidth;
    const scaleY = sourceVideo.videoHeight / videoHeight;

    const actualCropX = cropRect.x * scaleX;
    const actualCropY = cropRect.y * scaleY;
    const actualCropWidth = cropRect.width * scaleX;
    const actualCropHeight = cropRect.height * scaleY;

    const outputWidth = Math.round(actualCropWidth);
    const outputHeight = Math.round(actualCropHeight);

    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = outputWidth;
    outputCanvas.height = outputHeight;
    const ctx = outputCanvas.getContext("2d");

    const stream = outputCanvas.captureStream(8);
    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp8',
      videoBitsPerSecond: 500000
    });

    const chunks = [];
    recorder.ondataavailable = e => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const recordingDone = new Promise(resolve => {
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        resolve(URL.createObjectURL(blob));
      };
    });

    recorder.start();
    sourceVideo.currentTime = 0;

    await new Promise(resolve => {
      sourceVideo.onseeked = resolve;
    });

    sourceVideo.play();

    const drawFrame = () => {
      if (sourceVideo.ended || sourceVideo.paused) {
        recorder.stop();
        return;
      }

      ctx.clearRect(0, 0, outputWidth, outputHeight);

      ctx.save();

      if (circleCrop) {
        ctx.beginPath();
        ctx.arc(outputWidth / 2, outputHeight / 2, Math.min(outputWidth, outputHeight) / 2, 0, 2 * Math.PI);
        ctx.clip();
      }

      const filterStr = `hue-rotate(${hueGlobal}deg) saturate(${saturationGlobal}%) brightness(${brightnessGlobal}%) contrast(${contrastGlobal}%) blur(${Math.max(0, blurGlobal * 0.5)}px) grayscale(${grayscaleGlobal}%) sepia(${sepiaGlobal}%)`;
      ctx.filter = filterStr;
      ctx.globalAlpha = opacityGlobal / 100;

      ctx.drawImage(
        sourceVideo,
        actualCropX, actualCropY, actualCropWidth, actualCropHeight,
        0, 0, outputWidth, outputHeight
      );

      ctx.restore();

      requestAnimationFrame(drawFrame);
    };

    drawFrame();

    const newUrl = await recordingDone;

    setCropHistory(prev => [...prev, { url, panX, panY, videoWidth, videoHeight, nativeWidth, nativeHeight }]);
    setUrl(newUrl);
    setNativeWidth(outputWidth);
    setNativeHeight(outputHeight);
    fitToContainer(showFrameBar || showTimeline, outputWidth, outputHeight);
    setIsCropping(false);
    setIsProcessingCrop(false);
    setActionMode("Idle");
    saveState();
  };

  const finalizeCrop = async () => {
    if (mediaType !== "video") return;
    setCropHistory(prev => [...prev, { url, panX, panY, videoWidth, videoHeight, nativeWidth, nativeHeight }]);
    await performCanvasVideoCrop();
  };

  const cropClick = async () => {
    if (isCropDisabled) return;
    if (isCropping) {
      if (mediaType === "video") await finalizeCrop();
    } else {
      setCropRect({ x: 0, y: 0, width: videoWidth, height: videoHeight });
      setIsCropping(true);
      setCircleCrop(false);
      setActionMode("Cropping");
    }
  };

  const downloadVideo = async () => {
    const alertResult = await showDialog({
      title: "Export Settings",
      message: "Configure your export settings.",
      inputs: [
        {
          name: "format", type: "select", label: "Format", defaultValue: exportFormat, options: [
            { label: ".mp4", value: "mp4" },
            { label: ".mov", value: "mov" },
            { label: ".webm", value: "webm" },
            { label: ".avi", value: "avi" }
          ]
        },
        {
          name: "quality", type: "select", label: "Quality", defaultValue: exportQuality, options: [
            { label: "Low (480p)", value: "low" },
            { label: "Medium (720p)", value: "medium" },
            { label: "High (1080p)", value: "high" },
            { label: "Ultra (4K)", value: "ultra" }
          ]
        },
        {
          name: "resolution", type: "select", label: "Resolution", defaultValue: exportResolution, options: [
            { label: "Original", value: "original" },
            { label: "720p", value: "720p" },
            { label: "1080p", value: "1080p" },
            { label: "4K", value: "4k" }
          ]
        }
      ],
      showCancel: true
    });

    if (!alertResult) return;

    setExportFormat(alertResult.format || "mp4");
    setExportQuality(alertResult.quality || "high");
    setExportResolution(alertResult.resolution || "original");
    setIsDownloadingVideo(true);

    if (showTimeline && timelineClips.length > 0) {
      const compositeUrl = await renderTimelineToVideo();
      if (compositeUrl) {
        setUrl(compositeUrl);
        if (videoRef.current) {
          videoRef.current.src = compositeUrl;
          videoRef.current.load();
        }
      }
    }

    if (!url) return;

    const fileName = (fileHandle?.name || "export").replace(/\.\w+$/, `.${alertResult.format || "mp4"}`);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setIsDownloadingVideo(false);
  };

  const renderTimelineToVideo = async () => {
    if (timelineClips.length === 0) return null;

    setIsRebuildingVideoFromFrames(true);
    const canvas = document.createElement("canvas");
    canvas.width = videoWidth;
    canvas.height = videoHeight;
    const ctx = canvas.getContext("2d");
    const fps = DEFAULT_FPS;
    const stream = canvas.captureStream(fps);
    const recorder = new MediaRecorder(stream, { mimeType: "video/mp4" });
    const chunks = [];

    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

    return new Promise(resolve => {
      recorder.onstop = () => {
        const newBlob = new Blob(chunks, { type: "video/mp4" });
        const newUrl = URL.createObjectURL(newBlob);
        setIsRebuildingVideoFromFrames(false);
        resolve(newUrl);
      };

      recorder.start();
      const maxDuration = Math.max(...timelineClips.map(clip => clip.startTime + clip.duration));
      let currentFrame = 0;
      const totalFrames = Math.ceil(maxDuration * fps);

      const renderFrame = () => {
        const frameTime = currentFrame / fps;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        timelineClips.forEach(clip => {
          if (frameTime >= clip.startTime && frameTime < clip.startTime + clip.duration) {
            const relativeTime = frameTime - clip.startTime;
            ctx.fillStyle = clip.type === "video" ? "blue" : "green";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
        });

        textOverlays.forEach(overlay => {
          if (frameTime >= overlay.startTime && frameTime < overlay.startTime + overlay.duration) {
            ctx.fillStyle = overlay.color;
            ctx.font = `${overlay.bold ? "bold " : ""}${overlay.italic ? "italic " : ""}${overlay.size}px ${overlay.font}`;
            ctx.textAlign = overlay.alignment;
            ctx.fillText(overlay.text, (overlay.x / 100) * canvas.width, (overlay.y / 100) * canvas.height);
          }
        });

        currentFrame++;
        if (currentFrame < totalFrames) {
          setTimeout(renderFrame, 1000 / fps);
        } else {
          recorder.stop();
        }
      };

      renderFrame();
    });
  };

  const extractFramesFromVideo = async (videoElem) => {
    const framesArray = [];
    if (!videoElem.duration) return [];

    const oldPausedState = videoElem.paused;
    const oldTime = videoElem.currentTime;
    videoElem.pause();

    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 90;
    const ctx = canvas.getContext("2d");
    const totalFramesToExtract = Math.min(100, Math.ceil(videoElem.duration / frameInterval));

    for (let i = 0; i < totalFramesToExtract; i++) {
      const targetTime = i * frameInterval;
      if (targetTime >= videoElem.duration) break;

      videoElem.currentTime = targetTime;
      await new Promise(resolve => setTimeout(resolve, 20));

      try {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(videoElem, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        framesArray.push({ time: targetTime, dataUrl });
      } catch (error) { }
    }

    videoElem.currentTime = oldTime;
    if (!oldPausedState) videoElem.play();
    return framesArray;
  };

  const handleDragStart = (e) => {
    if (isCropping || actionMode !== "Idle") return;
    draggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleDragEnd = () => {
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
    if (isCropping || actionMode !== "Idle") return;
    e.stopPropagation();
    e.preventDefault();
    setResizingCorner(corner);
    resizingRef.current = true;
    initialMousePosRef.current = { x: e.clientX, y: e.clientY };
    lastResizePosRef.current = { x: e.clientX, y: e.clientY };
    initialSizeRef.current = { width: videoWidth, height: videoHeight };
    initialPosRef.current = { x: panX, y: panY };
    if (maintainAspectRatio) aspectRatioRef.current = videoWidth / videoHeight;
  };

  const handleGlobalMouseMove = (e) => {
    if (!resizingRef.current) return;
    const rad = rotation * Math.PI / 180;
    const totalDx = e.clientX - initialMousePosRef.current.x;
    const totalDy = e.clientY - initialMousePosRef.current.y;
    const localTotalDx = Math.cos(rad) * totalDx + Math.sin(rad) * totalDy;
    const localTotalDy = -Math.sin(rad) * totalDx + Math.cos(rad) * totalDy;

    let newWidth, newHeight;
    if (maintainAspectRatio) {
      let handleUnit = { x: 0, y: 0 };
      if (resizingCorner === "bottom-right") handleUnit = { x: 1 / Math.sqrt(2), y: 1 / Math.sqrt(2) };
      else if (resizingCorner === "bottom-left") handleUnit = { x: -1 / Math.sqrt(2), y: 1 / Math.sqrt(2) };
      else if (resizingCorner === "top-right") handleUnit = { x: 1 / Math.sqrt(2), y: -1 / Math.sqrt(2) };
      else if (resizingCorner === "top-left") handleUnit = { x: -1 / Math.sqrt(2), y: -1 / Math.sqrt(2) };

      const effectiveDelta = localTotalDx * handleUnit.x + localTotalDy * handleUnit.y;
      const scale = (initialSizeRef.current.width / 2 + effectiveDelta) / (initialSizeRef.current.width / 2);
      newWidth = initialSizeRef.current.width * scale;
      newHeight = initialSizeRef.current.height * scale;
    } else {
      let horizontalDelta = 0, verticalDelta = 0;
      if (resizingCorner === "bottom-right") { horizontalDelta = localTotalDx; verticalDelta = localTotalDy; }
      else if (resizingCorner === "bottom-left") { horizontalDelta = -localTotalDx; verticalDelta = localTotalDy; }
      else if (resizingCorner === "top-right") { horizontalDelta = localTotalDx; verticalDelta = -localTotalDy; }
      else if (resizingCorner === "top-left") { horizontalDelta = -localTotalDx; verticalDelta = -localTotalDy; }

      newWidth = initialSizeRef.current.width + 2 * horizontalDelta;
      newHeight = initialSizeRef.current.height + 2 * verticalDelta;
    }

    newWidth = Math.max(newWidth, MIN_SIZE);
    newHeight = Math.max(newHeight, MIN_SIZE);
    setVideoWidth(newWidth);
    setVideoHeight(newHeight);
    setPanX(initialPosRef.current.x);
    setPanY(initialPosRef.current.y);
  };

  const handleGlobalMouseUp = () => {
    if (resizingRef.current) saveState();
    resizingRef.current = false;
    setResizingCorner(null);
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
    const corner = cropResizingCorner.current;

    if (corner === "bottom-right") { width += dx; height += dy; }
    else if (corner === "bottom-left") { x += dx; width -= dx; height += dy; }
    else if (corner === "top-right") { y += dy; width += dx; height -= dy; }
    else if (corner === "top-left") { x += dx; y += dy; width -= dx; height -= dy; }

    width = Math.max(width, 10);
    height = Math.max(height, 10);
    setCropRect({ x, y, width, height });
  };

  const handleCropMouseDown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    cropDraggingRefLocal.current = true;
    lastCropDragPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleCropMouseMove = (e) => {
    if (!cropDraggingRefLocal.current) return;
    const dx = e.clientX - lastCropDragPosRef.current.x;
    const dy = e.clientY - lastCropDragPosRef.current.y;
    lastCropDragPosRef.current = { x: e.clientX, y: e.clientY };
    setCropRect(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
  };

  const handleCropMouseUp = () => {
    cropDraggingRefLocal.current = false;
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
    setCropRotation(cropInitialRotation.current + (angle - cropRotationStartAngle.current));
  };

  const handleCropGlobalMouseUpRotation = () => {
    cropRotatingRef.current = false;
  };

  const undoCrop = () => {
    if (cropHistory.length > 0) {
      const prev = cropHistory.pop();
      setCropHistory([...cropHistory]);
      setUrl(prev.url);
      setPanX(prev.panX);
      setPanY(prev.panY);
      setVideoWidth(prev.videoWidth);
      setVideoHeight(prev.videoHeight);
      setNativeWidth(prev.nativeWidth);
      setNativeHeight(prev.nativeHeight);
      setIsCropping(false);
      saveState();
    }
  };

  const handleRewind15 = () => {
    if (videoRef.current) {
      const newTime = Math.max(0, videoRef.current.currentTime - 15);
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handlePlayVideo = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleToggleLoop = () => {
    if (!videoRef.current) return;
    const newVal = !videoRef.current.loop;
    videoRef.current.loop = newVal;
    setIsLooping(newVal);
  };

  const handleSkip15 = () => {
    if (videoRef.current && videoRef.current.duration) {
      const newTime = Math.min(videoRef.current.duration, videoRef.current.currentTime + 15);
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleToggleMute = () => {
    if (!videoRef.current) return;
    const newMuted = !videoRef.current.muted;
    videoRef.current.muted = newMuted;
    setIsMuted(newMuted);
  };

  const handleVolumeChange = (volume) => {
    if (!videoRef.current) return;
    videoRef.current.volume = volume / 100;
    setMasterVolume(volume);
  };

  const handleSetPlaybackRate = (rate) => {
    if (!videoRef.current) return;
    setCurrentPlaybackRate(rate);
    videoRef.current.playbackRate = rate;
  };

  const handleTimelineMode = () => {
    setFramesPanelMode(prev => prev === "timeline" ? "none" : "timeline");
    setShowTimeline(prev => !prev);
  };

  const handleViewFrames = () => setFramesPanelMode(prev => prev === "view" ? "none" : "view");

  const handleSvgMouseDown = (e) => {
    if (actionMode !== "AddText") return;
    if (actionMode === "AddText") {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      const newOverlay = {
        id: Date.now(),
        text: "New Text",
        font: "Arial",
        size: 32,
        color: "#ffffff",
        alignment: "center",
        bold: false,
        italic: false,
        underline: false,
        x: x,
        y: y,
        startTime: currentTime,
        duration: 5,
        opacity: 100
      };
      setTextOverlays(prev => [...prev, newOverlay]);
      setSelectedTextOverlay(textOverlays.length);
      setTextEditorState(newOverlay);
      setShowTextEditor(true);
      setActionMode("Idle");
      saveState();
      return;
    }
  };

  const setSyncCorners = (val) => {
    setSyncCornersGlobal(val);
    if (val) {
      const v = Math.min(borderRadiusGlobal || borderTopLeftRadiusGlobal || 0, MAX_CORNER_RADIUS);
      setBorderRadiusGlobal(v);
      setBorderTopLeftRadiusGlobal(v);
      setBorderTopRightRadiusGlobal(v);
      setBorderBottomLeftRadiusGlobal(v);
      setBorderBottomRightRadiusGlobal(v);
    }
  };

  const setBorderRadius = (val) => {
    const limitVal = Math.min(val, MAX_CORNER_RADIUS);
    if (syncCornersGlobal) {
      setBorderRadiusGlobal(limitVal);
      setBorderTopLeftRadiusGlobal(limitVal);
      setBorderTopRightRadiusGlobal(limitVal);
      setBorderBottomLeftRadiusGlobal(limitVal);
      setBorderBottomRightRadiusGlobal(limitVal);
    } else setBorderRadiusGlobal(limitVal);
  };

  const setBorderTopLeftRadius = (val) => setBorderTopLeftRadiusGlobal(Math.min(val, MAX_CORNER_RADIUS));
  const setBorderTopRightRadius = (val) => setBorderTopRightRadiusGlobal(Math.min(val, MAX_CORNER_RADIUS));
  const setBorderBottomLeftRadius = (val) => setBorderBottomLeftRadiusGlobal(Math.min(val, MAX_CORNER_RADIUS));
  const setBorderBottomRightRadius = (val) => setBorderBottomRightRadiusGlobal(Math.min(val, MAX_CORNER_RADIUS));

  useEffect(() => {
    if (url && originalDuration && !showTimeline) {
      const mainClip = {
        id: "main-video",
        type: "video",
        name: "Main Video",
        url: url,
        startTime: 0,
        duration: originalDuration,
        volume: 100,
        speed: 1.0,
        effects: []
      };
      setTimelineClips([mainClip]);
    }
  }, [url, originalDuration]);

  useEffect(() => {
    let objectUrl;
    const loadMedia = async () => {
      try {
        const file = typeof fileHandle.getFile === "function" ? await fileHandle.getFile() : fileHandle;
        objectUrl = URL.createObjectURL(file);
        setUrl(objectUrl);
        setOriginalFileSize(file.size);
        const extension = file.name.split(".").pop().toLowerCase();
        if (["mp4", "mkv", "avi", "mov", "webm"].includes(extension)) {
          setMediaType("video");
          const tempVideo = document.createElement("video");
          tempVideo.onloadedmetadata = () => {
            setNativeWidth(tempVideo.videoWidth);
            setNativeHeight(tempVideo.videoHeight);
            fitToContainer(false, tempVideo.videoWidth, tempVideo.videoHeight);
            setOriginalDuration(tempVideo.duration);
          };
          tempVideo.src = objectUrl;
        }
      } catch (error) { }
    };
    loadMedia();
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [fileHandle]);

  useEffect(() => {
    const normalizedRotation = rotation % 360;
    setIsCropDisabled(!(normalizedRotation === 0 && flipX === 1 && flipY === 1));
  }, [rotation, flipX, flipY]);

  useEffect(() => {
    fitToContainer(showFrameBar || showTimeline);
  }, [showFrameBar, showTimeline]);

  useEffect(() => {
    if (resizingRef.current) {
      window.addEventListener("mousemove", handleGlobalMouseMove);
      window.addEventListener("mouseup", handleGlobalMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
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
    window.addEventListener("mousemove", handleCropMouseMove);
    window.addEventListener("mouseup", handleCropMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleCropMouseMove);
      window.removeEventListener("mouseup", handleCropMouseUp);
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
    const doExtract = async () => {
      if (mediaType === "video" && videoRef.current && !isProcessingCrop && !isCropping) {
        setIsExtractingFrames(true);
        const newBase = await extractFramesFromVideo(videoRef.current);
        setOriginalExtractedFrames(newBase);
        setFrames([...newBase]);
        setIsExtractingFrames(false);
      }
    };

    if (framesPanelMode !== "none" && framesPanelMode !== "timeline") doExtract();
    else { setFrames([]); setOriginalExtractedFrames([]); }
  }, [framesPanelMode, url, isProcessingCrop, isCropping, frameInterval, mediaType]);

  useEffect(() => {
    const updateTime = () => {
      if (videoRef.current) {
        setCurrentTime(videoRef.current.currentTime);
      }
    };

    const video = videoRef.current;
    if (video) {
      video.addEventListener("timeupdate", updateTime);
      video.addEventListener("loadedmetadata", () => {
        setCurrentTime(0);
        video.loop = true;
        setIsLooping(true);
        video.play();
        setIsPlaying(true);
      });
      return () => {
        video.removeEventListener("timeupdate", updateTime);
      };
    }
  }, [url]);

  useEffect(() => {
    const handleKeyboard = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      switch (e.key) {
        case " ":
          e.preventDefault();
          handlePlayVideo();
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (e.shiftKey) handleRewind15();
          else if (videoRef.current) {
            const newTime = Math.max(0, videoRef.current.currentTime - 1);
            videoRef.current.currentTime = newTime;
            setCurrentTime(newTime);
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (e.shiftKey) handleSkip15();
          else if (videoRef.current && videoRef.current.duration) {
            const newTime = Math.min(videoRef.current.duration, videoRef.current.currentTime + 1);
            videoRef.current.currentTime = newTime;
            setCurrentTime(newTime);
          }
          break;
        case "z":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.shiftKey) handleRedo();
            else handleUndo();
          }
          break;
        case "c":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setActionMode("Cropping");
          }
          break;
        case "t":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setActionMode("AddText");
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [videoRef, currentTime, actionMode]);

  useEffect(() => {
    const autoSave = setInterval(() => {
      if (timelineClips.length > 0 || textOverlays.length > 0) {
        saveState();
      }
    }, 30000);
    return () => clearInterval(autoSave);
  }, [timelineClips, textOverlays]);

  const layoutButtons = [
    { tip: "Zoom In", onClick: handleZoomIn, icon: faMagnifyingGlassPlus },
    { tip: "Zoom Out", onClick: handleZoomOut, icon: faMagnifyingGlassMinus },
    { tip: "Rotate Left", onClick: handleRotateLeft, icon: faRotateLeft },
    { tip: "Rotate Right", onClick: handleRotateRight, icon: faRotateRight },
    { tip: "Flip Horizontally", onClick: handleFlipHorizontal, icon: faLeftRight },
    { tip: "Flip Vertically", onClick: handleFlipVertical, icon: faUpDown },
  ];

  const dimButtons = [
    { tip: "Restore Width Based Aspect Ratio", onClick: restoreAspectRatioWidth, icon: faArrowsLeftRightToLine },
    { tip: "Restore Height Based Aspect Ratio", onClick: restoreAspectRatioHeight, icon: faArrowsUpToLine },
    { tip: "Crop Video", onClick: cropClick, icon: faCropSimple, disabled: isCropDisabled, style: { opacity: isCropDisabled ? "0.6" : "1.0", backgroundColor: isCropping ? "#5C2BE2" : "" } },
    ...(isCropping ? [{ tip: "Circle Crop", onClick: () => setCircleCrop(prev => !prev), icon: faCircle, style: { backgroundColor: circleCrop ? "#5C2BE2" : "" } }] : []),
    { tip: "Undo Crop", onClick: undoCrop, icon: faSquareCaretLeft, disabled: isCropDisabled, style: { opacity: isCropDisabled ? "0.6" : "1.0" } },
  ];

  const presets = [
    { text: "1:1", ratio: 1 },
    { text: "4:3", ratio: 3 / 4 },
    { text: "16:9", ratio: 9 / 16 },
  ];

  const styleControls = [
    { label: "Opacity", value: opacityGlobal, onChange: setOpacityGlobal, min: 0, max: 100, inc: 10 },
    { label: "Hue", value: hueGlobal, onChange: setHueGlobal, min: 0, max: 360, inc: 10 },
    { label: "Saturation", value: saturationGlobal, onChange: setSaturationGlobal, min: 0, max: 360, inc: 10 },
    { label: "Brightness", value: brightnessGlobal, onChange: setBrightnessGlobal, min: 0, max: 360, inc: 10 },
    { label: "Contrast", value: contrastGlobal, onChange: setContrastGlobal, min: 0, max: 360, inc: 10 },
    { label: "Blur", value: blurGlobal, onChange: setBlurGlobal, min: 0, max: 100, inc: 1 },
    { label: "Shadow", value: spreadGlobal, onChange: setSpreadGlobal, min: 0, max: 100, inc: 1 },
    { label: "Grayscale", value: grayscaleGlobal, onChange: setGrayscaleGlobal, min: 0, max: 100, inc: 10 },
    { label: "Sepia", value: sepiaGlobal, onChange: setSepiaGlobal, min: 0, max: 100, inc: 10 },
  ];

  return (
    <div className="dinolabsVideoEditorWrapper">
      {(isProcessingCrop || isExtractingFrames || isRebuildingVideoFromFrames || isDownloadingVideo) && (
        <div className="dinolabsVideoEditorContentCropIndicator">
          <div className="loading-circle" />
        </div>
      )}

      <div className="dinolabsVideoEditorToolbar" style={{ pointerEvents: (showFrameBar && framesPanelMode !== "timeline") ? "none" : "auto", opacity: (showFrameBar && framesPanelMode !== "timeline") ? 0.4 : 1.0 }}>
        <div className="dinolabsVideoEditorHeaderFlexDark" style={{ marginBottom: 0, border: "none" }}>
          <label className="dinolabsVideoEditorCellTitle">
            <FontAwesomeIcon icon={faPenToSquare} /> Edit
          </label>
        </div>
        <div className={!layoutCollapsed ? "dinolabsVideoEditorCellWrapper" : "dinolabsVideoEditorCellWrapperCollapsed"}>
          <div className="dinolabsVideoEditorHeaderFlex">
            <label className="dinolabsVideoEditorCellTitle">
              <FontAwesomeIcon icon={faTabletScreenButton} /> Layout
            </label>
            <div className="dinolabsVideoEditorCellFlexSupplement">
              {!layoutCollapsed && (
                <>
                  <Tippy content="Reset Video" theme="tooltip-light">
                    <button onClick={resetVideo} className="dinolabsVideoEditorToolButtonHeader">
                      <FontAwesomeIcon icon={faArrowsRotate} />
                    </button>
                  </Tippy>
                  <Tippy content="Download Video" theme="tooltip-light">
                    <button onClick={downloadVideo} className="dinolabsVideoEditorToolButtonHeader">
                      <FontAwesomeIcon icon={faDownload} />
                    </button>
                  </Tippy>
                </>
              )}

              <Tippy content="Collapse Layout" theme="tooltip-light">
                <button onClick={() => { setLayoutCollapsed(!layoutCollapsed) }} className="dinolabsVideoEditorToolButtonHeader">
                  <FontAwesomeIcon icon={layoutCollapsed ? faChevronRight : faChevronDown} />
                </button>
              </Tippy>
            </div>
          </div>
          <div className="dinolabsVideoEditorCellFlexStack">
            <label className="dinolabsVideoEditorCellFlexTitle">Position</label>
            <div className="dinolabsVideoEditorCellFlex">
              <input className="dinolabsVideoEditorPositionInput" type="text" value={`X: ${panX}`} onChange={(e) => setPanX(Number(e.target.value.replace(/[^0-9.-]/g, "")))} />
              <input className="dinolabsVideoEditorPositionInput" type="text" value={`Y: ${panY}`} onChange={(e) => setPanY(Number(e.target.value.replace(/[^0-9.-]/g, "")))} />
            </div>
          </div>
          <div className="dinolabsVideoEditorCellFlexStack">
            <div className="dinolabsVideoEditorCellFlex">
              {layoutButtons.map((b, i) => (
                <Tippy key={i} content={b.tip} theme="tooltip-light">
                  <button onClick={b.onClick} className="dinolabsVideoEditorToolButton">
                    <FontAwesomeIcon icon={b.icon} />
                  </button>
                </Tippy>
              ))}
            </div>
          </div>
        </div>

        <div className={!dimensionsCollapsed ? "dinolabsVideoEditorCellWrapper" : "dinolabsVideoEditorCellWrapperCollapsed"}>
          <div className="dinolabsVideoEditorHeaderFlex">
            <label className="dinolabsVideoEditorCellTitle">
              <FontAwesomeIcon icon={faRulerCombined} /> Dimensions
            </label>

            <div className="dinolabsVideoEditorCellFlexSupplement">
              <Tippy content="Collapse Dimensions" theme="tooltip-light">
                <button onClick={() => { setDimensionsCollapsed(!dimensionsCollapsed) }} className="dinolabsVideoEditorToolButtonHeader">
                  <FontAwesomeIcon icon={dimensionsCollapsed ? faChevronRight : faChevronDown} />
                </button>
              </Tippy>
            </div>

          </div>
          <div className="dinolabsVideoEditorCellFlexStack">
            <label className="dinolabsVideoEditorCellFlexTitle">Video Size</label>
            <div className="dinolabsVideoEditorCellFlex">
              <input className="dinolabsVideoEditorPositionInput" type="text" value={`W: ${Math.round(videoWidth)}px`} onChange={(e) => setVideoWidth(Number(e.target.value.replace(/[^0-9.-]/g, "")))} />
              <input className="dinolabsVideoEditorPositionInput" type="text" value={`H: ${Math.round(videoHeight)}px`} onChange={(e) => setVideoHeight(Number(e.target.value.replace(/[^0-9.-]/g, "")))} />
            </div>
          </div>
          <div className="dinolabsVideoEditorCellFlexStack">
            <div className="dinolabsVideoEditorCellFlex">
              {dimButtons.map((b, i) => (
                <Tippy key={i} content={b.tip} theme="tooltip-light">
                  <button onClick={b.onClick} disabled={b.disabled} style={b.style} className="dinolabsVideoEditorToolButton">
                    <FontAwesomeIcon icon={b.icon} />
                  </button>
                </Tippy>
              ))}
            </div>

            <div className="dinolabsVideoEditorCellFlex">
              <label className="dinolabsConfrmationCheck">
                <input type="checkbox" className="dinolabsSettingsCheckbox" checked={maintainAspectRatio} onChange={(e) => setMaintainAspectRatio(e.target.checked)} />
                <span>Preserve Aspect Ratio</span>
              </label>
            </div>
          </div>
          {isCropping && (
            <div className="dinolabsVideoEditorCellFlexStack">
              <label className="dinolabsVideoEditorCellFlexTitle">Crop Presets</label>
              <div className="dinolabsVideoEditorCellFlex">
                {presets.map((p, i) => (
                  <button key={i} className="dinolabsVideoEditorToolButtonText" onClick={() => setCropRect(prev => ({ ...prev, height: prev.width * p.ratio }))}>
                    {p.text}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={!stylesCollapsed ? "dinolabsVideoEditorCellWrapper" : "dinolabsVideoEditorCellWrapperCollapsed"}>
          <div className="dinolabsVideoEditorHeaderFlex">
            <label className="dinolabsVideoEditorCellTitle">
              <FontAwesomeIcon icon={faSwatchbook} /> Styles
            </label>

            <div className="dinolabsVideoEditorCellFlexSupplement">
              <Tippy content="Collapse Styles" theme="tooltip-light">
                <button onClick={() => { setStylesCollapsed(!stylesCollapsed) }} className="dinolabsVideoEditorToolButtonHeader">
                  <FontAwesomeIcon icon={stylesCollapsed ? faChevronRight : faChevronDown} />
                </button>
              </Tippy>
            </div>
          </div>
          {styleControls.map((s) => (
            <div key={s.label} className="dinolabsVideoEditorCellFlexStack">
              <label className="dinolabsVideoEditorCellFlexTitle">{s.label}</label>
              <div className="dinolabsVideoEditorCellFlex">
                <button onClick={() => s.onChange(Math.max(s.value - s.inc, s.min))} className="dinolabsVideoEditorToolButton">
                  <FontAwesomeIcon icon={faMinus} />
                </button>
                <div className="dinolabsVideoEditorSliderWrapper">
                  <input className="dinolabsSettingsSlider" type="range" min={s.min} max={s.max} value={s.value} onChange={(e) => s.onChange(Number(e.target.value))} />
                </div>
                <button onClick={() => s.onChange(Math.min(s.value + s.inc, s.max))} className="dinolabsVideoEditorToolButton">
                  <FontAwesomeIcon icon={faPlus} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className={!cornerCollapsed ? "dinolabsVideoEditorCellWrapper" : "dinolabsVideoEditorCellWrapperCollapsed"}>
          <div className="dinolabsVideoEditorHeaderFlex">
            <label className="dinolabsVideoEditorCellTitle">
              <FontAwesomeIcon icon={faBorderTopLeft} /> Corner Rounding
            </label>

            <div className="dinolabsVideoEditorCellFlexSupplement">
              <Tippy content="Collapse Corner Radii" theme="tooltip-light">
                <button onClick={() => { setCornerCollapsed(!cornerCollapsed) }} className="dinolabsVideoEditorToolButtonHeader">
                  <FontAwesomeIcon icon={cornerCollapsed ? faChevronRight : faChevronDown} />
                </button>
              </Tippy>
            </div>
          </div>
          <div className="dinolabsVideoEditorCellFlexStack">
            <label className="dinolabsVideoEditorCellFlexTitle">Corner Radii</label>
            <div className="dinolabsVideoEditorCellFlex">
              {syncCornersGlobal ? (
                <input className="dinolabsVideoEditorPositionInput" type="text" value={`Corner: ${borderRadiusGlobal}px`} onChange={(e) => {
                  const val = Math.min(Number(e.target.value.replace(/[^0-9]/g, "")), MAX_CORNER_RADIUS);
                  setBorderRadius(val);
                }} />
              ) : (
                <div className="dinolabsCornerInputGridWrapper">
                  <div className="dinolabsCornerInputFlex">
                    <input className="dinolabsVideoEditorPositionInput" type="text" value={`TL: ${borderTopLeftRadiusGlobal}px`} onChange={(e) => setBorderTopLeftRadius(Number(e.target.value.replace(/[^0-9]/g, "")))} />
                    <input className="dinolabsVideoEditorPositionInput" type="text" value={`TR: ${borderTopRightRadiusGlobal}px`} onChange={(e) => setBorderTopRightRadius(Number(e.target.value.replace(/[^0-9]/g, "")))} />
                  </div>
                  <div className="dinolabsCornerInputFlex">
                    <input className="dinolabsVideoEditorPositionInput" type="text" value={`BL: ${borderBottomLeftRadiusGlobal}px`} onChange={(e) => setBorderBottomLeftRadius(Number(e.target.value.replace(/[^0-9]/g, "")))} />
                    <input className="dinolabsVideoEditorPositionInput" type="text" value={`BR: ${borderBottomRightRadiusGlobal}px`} onChange={(e) => setBorderBottomRightRadius(Number(e.target.value.replace(/[^0-9]/g, "")))} />
                  </div>
                </div>
              )}
            </div>
            <div className="dinolabsVideoEditorCellFlex">
              <label className="dinolabsConfrmationCheck">
                <input type="checkbox" className="dinolabsSettingsCheckbox" checked={syncCornersGlobal} onChange={(e) => setSyncCorners(e.target.checked)} />
                <span>Sync Corners</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="dinolabsVideoEditorContainerWrapper">
        <div className="dinolabsVideoInputTopBar">
          <div className="dinolabsVideoEditorAudioControls">
            <Tippy content={isMuted ? "Unmute" : "Mute"} theme="tooltip-light">
              <button className="dinolabsVideoButton" onClick={handleToggleMute}>
                <FontAwesomeIcon icon={isMuted ? faVolumeXmark : faVolumeUp} />
              </button>
            </Tippy>
            <div className="dinolabsVideoEditorSliderWrapper">
              <input type="range" min="0" max="100" value={masterVolume} onChange={(e) => handleVolumeChange(Number(e.target.value))} className="dinolabsSettingsSlider" />
            </div>
          </div>
          <div className="dinolabsVideoEditorPlaybackControls">
            {DEFAULT_PLAYBACK_RATES.map(rate => (
              <Tippy key={rate} content={`${rate}x Playback`} theme="tooltip-light">
                <button className="dinolabsVideoPlaybackButton" onClick={() => handleSetPlaybackRate(rate)} disabled={showFrameBar && framesPanelMode !== "view"} style={{ color: currentPlaybackRate === rate ? "#5c2be2" : "#c0c0c0", opacity: (showFrameBar && framesPanelMode !== "view") ? 0.5 : 1.0 }}>
                  {rate}x
                </button>
              </Tippy>
            ))}
          </div>
        </div>

        <div
          className="dinolabsVideoEditorContainer"
          style={{ cursor: "grab", height: (showFrameBar && showTimeline) ? "20%" : (showTimeline ? "40%" : (showFrameBar ? "60%" : "80%")), minHeight: (showFrameBar && showTimeline) ? "20%" : (showTimeline ? "40%" : (showFrameBar ? "60%" : "80%")), maxHeight: (showFrameBar && showTimeline) ? "20%" : (showTimeline ? "40%" : (showFrameBar ? "60%" : "80%")) }}
          ref={containerRef}
          onMouseDown={handleDragStart}
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
        >
          <div
            className="dinolabsImageResizer"
            style={{
              top: `calc(50% + ${panY}px)`,
              left: `calc(50% + ${panX}px)`,
              width: `${videoWidth}px`,
              height: `${videoHeight}px`,
              transform: `translate(-50%, -50%) scale(${zoom}) rotate(${rotation}deg)`,
              overflow: "visible",
              borderRadius: syncCornersGlobal
                ? `${borderRadiusGlobal}px`
                : `${borderTopLeftRadiusGlobal}px ${borderTopRightRadiusGlobal}px ${borderBottomRightRadiusGlobal}px ${borderBottomLeftRadiusGlobal}px`
            }}
          >
            <video
              src={url}
              ref={videoRef}
              controls
              draggable={false}
              onDragStart={e => e.preventDefault()}
              className="dinolabsVideoEditorContent"
              style={{
                width: "100%",
                height: "100%",
                userSelect: "none",
                borderRadius: "inherit",
                transform: `scale(${flipX}, ${flipY})`,
                filter: `hue-rotate(${hueGlobal}deg) saturate(${saturationGlobal}%) brightness(${brightnessGlobal}%) contrast(${contrastGlobal}%) blur(${blurGlobal}px) grayscale(${grayscaleGlobal}%) sepia(${sepiaGlobal}%) ${spreadGlobal ? `drop-shadow(0 0 ${spreadGlobal}px rgba(0,0,0,0.5))` : ""}`,
                opacity: opacityGlobal / 100
              }}
            />

            {textOverlays.map((overlay, index) => {
              if (currentTime >= overlay.startTime && currentTime < overlay.startTime + overlay.duration) {
                return (
                  <div
                    key={overlay.id}
                    style={{
                      position: "absolute",
                      left: `${overlay.x}%`,
                      top: `${overlay.y}%`,
                      transform: "translate(-50%, -50%)",
                      fontFamily: overlay.font,
                      fontSize: `${overlay.size}px`,
                      color: overlay.color,
                      textAlign: overlay.alignment,
                      fontWeight: overlay.bold ? "bold" : "normal",
                      fontStyle: overlay.italic ? "italic" : "normal",
                      textDecoration: overlay.underline ? "underline" : "none",
                      opacity: overlay.opacity / 100,
                      pointerEvents: selectedTextOverlay === index ? "auto" : "none",
                      cursor: selectedTextOverlay === index ? "move" : "default",
                      border: selectedTextOverlay === index ? "2px dashed #5C2BE2" : "none",
                      padding: "4px",
                      whiteSpace: "pre-wrap",
                      textShadow: "2px 2px 4px rgba(0,0,0,0.5)",
                      zIndex: 100
                    }}
                    onClick={() => setSelectedTextOverlay(index)}
                  >
                    {overlay.text}
                  </div>
                );
              }
              return null;
            })}

            {!isCropping && actionMode === "Idle" && (
              <>
                <div className="dinolabsVideoEditorResizeHandle top-left" onMouseDown={e => handleResizeMouseDown("top-left", e)} style={{ top: `-${RESIZE_HANDLE_SIZE}px`, left: `-${RESIZE_HANDLE_SIZE}px` }} />
                <div className="dinolabsVideoEditorResizeHandle top-right" onMouseDown={e => handleResizeMouseDown("top-right", e)} style={{ top: `-${RESIZE_HANDLE_SIZE}px`, right: `-${RESIZE_HANDLE_SIZE}px` }} />
                <div className="dinolabsVideoEditorResizeHandle bottom-left" onMouseDown={e => handleResizeMouseDown("bottom-left", e)} style={{ bottom: `-${RESIZE_HANDLE_SIZE}px`, left: `-${RESIZE_HANDLE_SIZE}px` }} />
                <div className="dinolabsVideoEditorResizeHandle bottom-right" onMouseDown={e => handleResizeMouseDown("bottom-right", e)} style={{ bottom: `-${RESIZE_HANDLE_SIZE}px`, right: `-${RESIZE_HANDLE_SIZE}px` }} />
              </>
            )}

            {isCropping && (
              <div
                className="dinolabsVideoEditorCropRectangle"
                style={{
                  position: "absolute",
                  border: "0.4vh dashed rgba(31, 174, 245, 1)",
                  backgroundColor: "rgba(0,0,0,0.3)",
                  left: cropRect.x,
                  top: cropRect.y,
                  width: cropRect.width,
                  height: cropRect.height,
                  transform: `rotate(${cropRotation}deg)`,
                  zIndex: 10,
                  borderRadius: circleCrop ? "50%" : "0"
                }}
                onMouseDown={handleCropMouseDown}
              >
                <div className="dinolabsVideoEditorResizeHandle top-left" style={{ pointerEvents: "auto", top: `-${CROP_HANDLE_SIZE}px`, left: `-${CROP_HANDLE_SIZE}px` }} onMouseDown={e => handleCropResizeMouseDown("top-left", e)} />
                <div className="dinolabsVideoEditorResizeHandle top-right" style={{ pointerEvents: "auto", top: `-${CROP_HANDLE_SIZE}px`, right: `-${CROP_HANDLE_SIZE}px` }} onMouseDown={e => handleCropResizeMouseDown("top-right", e)} />
                <div className="dinolabsVideoEditorResizeHandle bottom-left" style={{ pointerEvents: "auto", bottom: `-${CROP_HANDLE_SIZE}px`, left: `-${CROP_HANDLE_SIZE}px` }} onMouseDown={e => handleCropResizeMouseDown("bottom-left", e)} />
                <div className="dinolabsVideoEditorResizeHandle bottom-right" style={{ pointerEvents: "auto", bottom: `-${CROP_HANDLE_SIZE}px`, right: `-${CROP_HANDLE_SIZE}px` }} onMouseDown={e => handleCropResizeMouseDown("bottom-right", e)} />
                <div className="dinolabsVideoEditorRotationHandle top-left" style={{ pointerEvents: "auto", position: "absolute", top: "-30px", left: "-30px" }} onMouseDown={handleCropRotationMouseDown} />
                <div className="dinolabsVideoEditorRotationHandle top-right" style={{ pointerEvents: "auto", position: "absolute", top: "-30px", right: "-30px" }} onMouseDown={handleCropRotationMouseDown} />
                <div className="dinolabsVideoEditorRotationHandle bottom-left" style={{ pointerEvents: "auto", position: "absolute", bottom: "-30px", left: "-30px" }} onMouseDown={handleCropRotationMouseDown} />
                <div className="dinolabsVideoEditorRotationHandle bottom-right" style={{ pointerEvents: "auto", position: "absolute", bottom: "-30px", right: "-30px" }} onMouseDown={handleCropRotationMouseDown} />
              </div>
            )}

            <svg
              viewBox={`0 0 ${nativeWidth} ${nativeHeight}`}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                pointerEvents: actionMode !== "Idle" ? "auto" : "none",
                cursor: actionMode === "AddText" ? "text" : "default",
                transform: `scale(${flipX}, ${flipY})`,
                transformOrigin: "center"
              }}
              onMouseDown={handleSvgMouseDown}
            >
            </svg>
          </div>
        </div>

        {showFrameBar && (
          <div className="dinolabsVideoInputBottomBarFrameSupplement" ref={framesContainerRef}>
            {frames.map((frame, idx) => (
              <div
                key={idx}
                className="dinolabsVideoInputBottomBarFrameSupplementImageWrapper"
                onClick={() => {
                  if (framesPanelMode === "view" && videoRef.current) {
                    videoRef.current.currentTime = frame.time;
                    setCurrentTime(frame.time);
                  }
                }}
              >
                <img src={frame.dataUrl} alt={`Frame ${idx}`} className="dinolabsVideoInputBottomBarFrameSupplementImage" />
                <span className="dinolabsVideoInputBottomBarFrameSupplementImageText">{formatTime(frame.time)}</span>
              </div>
            ))}
          </div>
        )}

        {showTimeline && (
          <div className="dinolabsVideoInputBottomBarTimelineSupplement">
            <div className="dinolabsVideoEditorTimelineHeader">
              <div className="dinolabsVideoEditorTimelineHeaderSupplementLeading"></div>
              <div className="dinolabsVideoEditorTimelineHeaderSupplementTrailing">
                <span>
                  {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, "0")} / {Math.floor((originalDuration || 0) / 60)}:{Math.floor((originalDuration || 0) % 60).toString().padStart(2, "0")}
                </span>
              </div>
            </div>
            <div className="dinolabsVideoEditorTimeline" onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const time = (x / timelineZoom);
              handleTimelineSeek(Math.max(0, Math.min(time, originalDuration || 0)));
            }} style={{ overflowX: "auto", width: "100%" }}>
              <div className="dinolabsVideoEditorTimelineRuler" style={{ minWidth: (originalDuration || 0) * timelineZoom }}>
                {Array.from({ length: Math.ceil((originalDuration || 0) / 5) + 1 }, (_, i) => i * 5).map(time => (
                  <div className="dinolabsVideoEditorTimelineRulerItem" key={time} style={{ left: time * timelineZoom, position: "absolute" }}>
                    {Math.floor(time / 60)}:{(time % 60).toString().padStart(2, "0")}
                  </div>
                ))}
              </div>
              <div className="dinolabsVideoEditorTimelinePlayhead" style={{ left: currentTime * timelineZoom, position: "absolute", zIndex: 10 }} />
              <div className="dinolabsVideoEditorTimelineTrackContainer" style={{ minWidth: (originalDuration || 0) * timelineZoom }}>
                <div className="dinolabsVideoEditorTimelineVideoTracks">
                  <div className="dinolabsVideoEditorTimelineVideoTrackLabel">Video</div>
                  <div className="dinolabsVideoEditorTimelineVideoTrackContent" style={{ height: 60, position: "relative", minWidth: (originalDuration || 0) * timelineZoom }}>
                    {timelineClips.filter(c => c.type === "video" || c.type === "text").map((clip, index) => {
                      const clipWidth = clip.duration * timelineZoom;
                      const clipLeft = clip.startTime * timelineZoom;
                      return (
                        <div
                          key={`video-${index}`}
                          className={`dinolabsVideoEditorTimelineVideoTrackTimelineClip ${selectedClips.includes(index) ? "selected" : ""} ${clip.type}`}
                          style={{
                            left: clipLeft,
                            width: clipWidth,
                            backgroundColor: clip.type === "video" ? "rgba(10, 95, 31, 0.6)" : "rgba(255, 152, 0, 0.8)",
                            border: selectedClips.includes(index) ? "2px solid #5C2BE2" : "1px solid rgba(255,255,255,0.3)",
                          }}
                          onClick={() => handleClipSelect(index)}
                          onDoubleClick={() => handleClipSplit(index)}
                        >
                          <span>{clip.name || `${clip.type} ${index + 1}`}</span>
                          {clipWidth > 80 && (
                            <div className="dinolabsVideoEditorTimelineVideoTrackTimelineClipSection">
                              <button className="dinolabsVideoEditorTimelineVideoTrackTimelineClipSectionDelete" onClick={(e) => { e.stopPropagation(); handleClipDelete(index); }}>
                                <FontAwesomeIcon icon={faTrash} size="xs" color="white" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="dinolabsVideoEditorTimelineVideoTracks">
                  <div className="dinolabsVideoEditorTimelineVideoTrackLabel">Audio</div>
                  <div className="dinolabsVideoEditorTimelineVideoTrackContent" style={{ height: 60, position: "relative", minWidth: (originalDuration || 0) * timelineZoom }}>
                    {timelineClips.filter(c => c.type === "audio").map((clip, index) => {
                      const clipWidth = clip.duration * timelineZoom;
                      const clipLeft = clip.startTime * timelineZoom;
                      return (
                        <div
                          key={`audio-${index}`}
                          className={`dinolabsVideoEditorTimelineVideoTrackTimelineClip ${selectedClips.includes(index) ? "selected" : ""} ${clip.type}`}
                          style={{
                            left: clipLeft,
                            width: clipWidth,
                            backgroundColor: "rgba(33, 150, 243, 0.8)",
                            border: selectedClips.includes(index) ? "2px solid #5C2BE2" : "1px solid rgba(255,255,255,0.3)",
                          }}
                          onClick={() => handleClipSelect(index)}
                          onDoubleClick={() => handleClipSplit(index)}
                        >
                          <span>{clip.name || `${clip.type} ${index + 1}`}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="dinolabsVideoInputBottomBar">
          <div className="dinolabsVideoContentFlex">
            <Tippy content="Rewind 15 Seconds" theme="tooltip-light">
              <button className="dinolabsVideoButtonSupplementLeading" onClick={handleRewind15} disabled={showFrameBar && framesPanelMode !== "view"} style={{ opacity: (showFrameBar && framesPanelMode !== "view") ? 0.5 : 1.0 }}>
                <FontAwesomeIcon icon={faBackward} />
              </button>
            </Tippy>
            <Tippy content="Previous Frame" theme="tooltip-light">
              <button className="dinolabsVideoButton" onClick={() => { if (videoRef.current) { const newTime = Math.max(0, videoRef.current.currentTime - 0.033); videoRef.current.currentTime = newTime; setCurrentTime(newTime); } }} disabled={showFrameBar && framesPanelMode !== "view"} style={{ color: "#c0c0c0", opacity: (showFrameBar && framesPanelMode !== "view") ? 0.5 : 1.0 }}>
                <FontAwesomeIcon icon={faStepBackward} />
              </button>
            </Tippy>
            <Tippy content="Play/Pause Video" theme="tooltip-light">
              <button className="dinolabsVideoButton" onClick={handlePlayVideo} disabled={showFrameBar && framesPanelMode !== "view"} style={{ color: "#c0c0c0", opacity: (showFrameBar && framesPanelMode !== "view") ? 0.5 : 1.0 }}>
                <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
              </button>
            </Tippy>
            <Tippy content="Next Frame" theme="tooltip-light">
              <button className="dinolabsVideoButton" onClick={() => { if (videoRef.current && videoRef.current.duration) { const newTime = Math.min(videoRef.current.duration, videoRef.current.currentTime + 0.033); videoRef.current.currentTime = newTime; setCurrentTime(newTime); } }} disabled={showFrameBar && framesPanelMode !== "view"} style={{ color: "#c0c0c0", opacity: (showFrameBar && framesPanelMode !== "view") ? 0.5 : 1.0 }}>
                <FontAwesomeIcon icon={faStepForward} />
              </button>
            </Tippy>
            <Tippy content="Loop Video" theme="tooltip-light">
              <button className="dinolabsVideoButton" onClick={handleToggleLoop} disabled={showFrameBar && framesPanelMode !== "view"} style={{ color: isLooping ? "#5c2be2" : "#c0c0c0", opacity: (showFrameBar && framesPanelMode !== "view") ? 0.5 : 1.0 }}>
                <FontAwesomeIcon icon={faRepeat} />
              </button>
            </Tippy>
            <Tippy content="Skip 15 Seconds" theme="tooltip-light">
              <button className="dinolabsVideoButtonSupplementTrailing" onClick={handleSkip15} disabled={showFrameBar && framesPanelMode !== "view"} style={{ opacity: (showFrameBar && framesPanelMode !== "view") ? 0.5 : 1.0 }}>
                <FontAwesomeIcon icon={faForward} />
              </button>
            </Tippy>
          </div>

          <div className="dinolabsVideoContentFlexSmall" style={{ justifyContent: "flex-start" }}>
            <Tippy content="Undo (Ctrl+Z)" theme="tooltip-light">
              <button className="dinolabsVideoButton" onClick={handleUndo} disabled={undoStack.length === 0} style={{ opacity: undoStack.length === 0 ? "0.3" : "1.0" }}>
                <FontAwesomeIcon icon={faArrowLeft} />
              </button>
            </Tippy>
            <Tippy content="Redo (Ctrl+Shift+Z)" theme="tooltip-light">
              <button className="dinolabsVideoButton" onClick={handleRedo} disabled={redoStack.length === 0} style={{ opacity: redoStack.length === 0 ? "0.3" : "1.0" }}>
                <FontAwesomeIcon icon={faArrowRight} />
              </button>
            </Tippy>
            <Tippy content="Timeline Editor" theme="tooltip-light">
              <button className="dinolabsVideoButton" disabled={isCropping} style={{ color: showTimeline ? "#5C2BE2" : "#c0c0c0", opacity: isCropping ? "0.6" : "1.0" }} onClick={handleTimelineMode}>
                <FontAwesomeIcon icon={faLayerGroup} />
              </button>
            </Tippy>
            <Tippy content="View Video Frames" theme="tooltip-light">
              <button className="dinolabsVideoButton" disabled={isCropping} style={{ color: framesPanelMode === "view" ? "#5C2BE2" : "#c0c0c0", opacity: isCropping ? "0.6" : "1.0" }} onClick={handleViewFrames}>
                <FontAwesomeIcon icon={faFilm} />
              </button>
            </Tippy>
            {(showFrameBar || showTimeline) && (
              <Tippy content="Frame Extraction Interval" theme="tooltip-light">
                <select className="dinolabsVideoEditorBottomBarInput" value={frameInterval} onChange={(e) => setFrameInterval(Number(e.target.value))} disabled={isExtractingFrames} style={{ opacity: isExtractingFrames ? 0.6 : 1.0 }}>
                  {FRAME_INTERVAL_OPTIONS.map(interval => (
                    <option key={interval} value={interval}>{interval}s</option>
                  ))}
                </select>
              </Tippy>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}