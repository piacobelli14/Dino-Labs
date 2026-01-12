import React, { useState, useRef, useCallback, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faScissors,
  faImage,
  faSliders,
  faCog,
  faDownload,
  faCopy,
  faTrash,
  faEye,
  faFileArrowUp,
  faImages,
  faMagicWandSparkles,
  faArrowsRotate,
  faPaintBrush,
  faEyeDropper,
  faAdjust
} from "@fortawesome/free-solid-svg-icons";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import DinoLabsNav from "../../../helpers/Nav";
import DinoLabsColorPicker from "../../../helpers/ColorPicker.jsx";
import "../../../styles/mainStyles/DinoLabsPlugins/DinoLabsPluginsBackgroundRemover/DinoLabsPluginsBackgroundRemover.css";
import "../../../styles/helperStyles/Slider.css";

const DinoLabsPluginsBackgroundRemover = () => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [tolerance, setTolerance] = useState(30);
  const [smoothing, setSmoothing] = useState(2);
  const [outputFormat, setOutputFormat] = useState("png");
  const [removalMode, setRemovalMode] = useState("smart");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [replaceBackground, setReplaceBackground] = useState(false);
  const [replacementColor, setReplacementColor] = useState("#ffffff");
  const [featherEdge, setFeatherEdge] = useState(true);
  const [processedFiles, setProcessedFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [colorPickerOpen, setColorPickerOpen] = useState({
    background: false,
    replacement: false
  });

  const fileInputRef = useRef(null);

  const formatOptions = [
    { value: "png", label: "PNG", extension: ".png" },
    { value: "jpeg", label: "JPEG", extension: ".jpg" },
    { value: "webp", label: "WebP", extension: ".webp" }
  ];

  const removalModes = [
    { value: "smart", label: "Smart Removal" },
    { value: "color", label: "Color Key" },
    { value: "edge", label: "Edge Detection" },
    { value: "corner", label: "Corner Sampling" }
  ];

  const tolerancePresets = [
    { name: "Low", value: 10 },
    { name: "Medium", value: 30 },
    { name: "High", value: 60 },
    { name: "Maximum", value: 100 }
  ];

  const handleFileSelect = useCallback((event) => {
    const files = Array.from(event.target.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    const fileObjects = imageFiles.map(file => ({
      id: Date.now() + Math.random(),
      originalFile: file,
      name: file.name,
      size: file.size,
      type: file.type,
      url: URL.createObjectURL(file),
      processed: false
    }));

    setSelectedFiles(prev => [...prev, ...fileObjects]);
  }, []);

  const removeFile = useCallback((fileId) => {
    setSelectedFiles(prev => {
      const updated = prev.filter(f => f.id !== fileId);
      const fileToRemove = prev.find(f => f.id === fileId);
      if (fileToRemove?.url) {
        URL.revokeObjectURL(fileToRemove.url);
      }
      return updated;
    });
    setProcessedFiles(prev => prev.filter(f => f.originalId !== fileId));
  }, []);

  const clearAllFiles = useCallback(() => {
    selectedFiles.forEach(file => {
      if (file.url) URL.revokeObjectURL(file.url);
    });
    processedFiles.forEach(file => {
      if (file.url) URL.revokeObjectURL(file.url);
    });
    setSelectedFiles([]);
    setProcessedFiles([]);
    setProcessingProgress(0);
  }, [selectedFiles, processedFiles]);

  const toggleColorPicker = (pickerType) => {
    setColorPickerOpen(prev => ({
      ...prev,
      [pickerType]: !prev[pickerType]
    }));
  };

  const closeColorPicker = (pickerType) => {
    setColorPickerOpen(prev => ({
      ...prev,
      [pickerType]: false
    }));
  };

  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

  const colorDistance = (c1, c2) => {
    return Math.sqrt(Math.pow(c1.r - c2.r, 2) + Math.pow(c1.g - c2.g, 2) + Math.pow(c1.b - c2.b, 2));
  };

  const removeBackground = useCallback(async (file) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        
        ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const width = canvas.width;
        const height = canvas.height;
        
        const mask = new Uint8Array(width * height);
        const visited = new Uint8Array(width * height);
        
        const getPixelIndex = (x, y) => y * width + x;
        
        const getPixelColor = (pixelIdx) => {
          const i = pixelIdx * 4;
          return { r: data[i], g: data[i + 1], b: data[i + 2] };
        };
        
        let targetColors = [];
        
        switch (removalMode) {
          case "color":
            targetColors = [hexToRgb(backgroundColor)];
            break;
          case "corner":
            const cornerIndices = [
              0,
              width - 1,
              (height - 1) * width,
              (height - 1) * width + width - 1
            ];
            targetColors = cornerIndices.map(idx => getPixelColor(idx));
            break;
          case "edge":
            const edgeSamples = [];
            const sampleStep = Math.max(1, Math.floor(width / 20));
            for (let x = 0; x < width; x += sampleStep) {
              edgeSamples.push(getPixelColor(getPixelIndex(x, 0)));
              edgeSamples.push(getPixelColor(getPixelIndex(x, height - 1)));
            }
            for (let y = 0; y < height; y += sampleStep) {
              edgeSamples.push(getPixelColor(getPixelIndex(0, y)));
              edgeSamples.push(getPixelColor(getPixelIndex(width - 1, y)));
            }
            targetColors = edgeSamples;
            break;
          default:
            const smartCorners = [
              0,
              width - 1,
              (height - 1) * width,
              (height - 1) * width + width - 1
            ];
            const smartSamples = [];
            for (const cornerIdx of smartCorners) {
              const cx = cornerIdx % width;
              const cy = Math.floor(cornerIdx / width);
              for (let dx = 0; dx < Math.min(10, width); dx++) {
                for (let dy = 0; dy < Math.min(10, height); dy++) {
                  let sx = cx + (cx === 0 ? dx : -dx);
                  let sy = cy + (cy === 0 ? dy : -dy);
                  if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
                    smartSamples.push(getPixelColor(getPixelIndex(sx, sy)));
                  }
                }
              }
            }
            targetColors = smartSamples;
            break;
        }
        
        const matchesAnyTarget = (pixelIdx) => {
          const pixel = getPixelColor(pixelIdx);
          for (const target of targetColors) {
            if (colorDistance(pixel, target) <= tolerance) {
              return true;
            }
          }
          return false;
        };
        
        const getMinDistanceToTargets = (pixelIdx) => {
          const pixel = getPixelColor(pixelIdx);
          let minDist = Infinity;
          for (const target of targetColors) {
            const dist = colorDistance(pixel, target);
            if (dist < minDist) {
              minDist = dist;
            }
          }
          return minDist;
        };
        
        if (removalMode === "color") {
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const idx = getPixelIndex(x, y);
              if (matchesAnyTarget(idx)) {
                mask[idx] = 255;
              }
            }
          }
        } else {
          const queue = new Int32Array(width * height);
          let queueStart = 0;
          let queueEnd = 0;
          
          for (let x = 0; x < width; x++) {
            const topIdx = getPixelIndex(x, 0);
            const bottomIdx = getPixelIndex(x, height - 1);
            
            if (matchesAnyTarget(topIdx) && !visited[topIdx]) {
              queue[queueEnd++] = topIdx;
              visited[topIdx] = 1;
            }
            if (matchesAnyTarget(bottomIdx) && !visited[bottomIdx]) {
              queue[queueEnd++] = bottomIdx;
              visited[bottomIdx] = 1;
            }
          }
          
          for (let y = 1; y < height - 1; y++) {
            const leftIdx = getPixelIndex(0, y);
            const rightIdx = getPixelIndex(width - 1, y);
            
            if (matchesAnyTarget(leftIdx) && !visited[leftIdx]) {
              queue[queueEnd++] = leftIdx;
              visited[leftIdx] = 1;
            }
            if (matchesAnyTarget(rightIdx) && !visited[rightIdx]) {
              queue[queueEnd++] = rightIdx;
              visited[rightIdx] = 1;
            }
          }
          
          while (queueStart < queueEnd) {
            const pixelIdx = queue[queueStart++];
            mask[pixelIdx] = 255;
            
            const x = pixelIdx % width;
            const y = Math.floor(pixelIdx / width);
            
            if (x > 0) {
              const neighborIdx = pixelIdx - 1;
              if (!visited[neighborIdx] && matchesAnyTarget(neighborIdx)) {
                visited[neighborIdx] = 1;
                queue[queueEnd++] = neighborIdx;
              }
            }
            if (x < width - 1) {
              const neighborIdx = pixelIdx + 1;
              if (!visited[neighborIdx] && matchesAnyTarget(neighborIdx)) {
                visited[neighborIdx] = 1;
                queue[queueEnd++] = neighborIdx;
              }
            }
            if (y > 0) {
              const neighborIdx = pixelIdx - width;
              if (!visited[neighborIdx] && matchesAnyTarget(neighborIdx)) {
                visited[neighborIdx] = 1;
                queue[queueEnd++] = neighborIdx;
              }
            }
            if (y < height - 1) {
              const neighborIdx = pixelIdx + width;
              if (!visited[neighborIdx] && matchesAnyTarget(neighborIdx)) {
                visited[neighborIdx] = 1;
                queue[queueEnd++] = neighborIdx;
              }
            }
            
            if (x > 0 && y > 0) {
              const neighborIdx = pixelIdx - width - 1;
              if (!visited[neighborIdx] && matchesAnyTarget(neighborIdx)) {
                visited[neighborIdx] = 1;
                queue[queueEnd++] = neighborIdx;
              }
            }
            if (x < width - 1 && y > 0) {
              const neighborIdx = pixelIdx - width + 1;
              if (!visited[neighborIdx] && matchesAnyTarget(neighborIdx)) {
                visited[neighborIdx] = 1;
                queue[queueEnd++] = neighborIdx;
              }
            }
            if (x > 0 && y < height - 1) {
              const neighborIdx = pixelIdx + width - 1;
              if (!visited[neighborIdx] && matchesAnyTarget(neighborIdx)) {
                visited[neighborIdx] = 1;
                queue[queueEnd++] = neighborIdx;
              }
            }
            if (x < width - 1 && y < height - 1) {
              const neighborIdx = pixelIdx + width + 1;
              if (!visited[neighborIdx] && matchesAnyTarget(neighborIdx)) {
                visited[neighborIdx] = 1;
                queue[queueEnd++] = neighborIdx;
              }
            }
          }
        }
        
        if (featherEdge && smoothing > 0) {
          const distanceField = new Float32Array(width * height);
          distanceField.fill(Infinity);
          
          const edgeQueue = new Int32Array(width * height);
          let edgeStart = 0;
          let edgeEnd = 0;
          
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const idx = getPixelIndex(x, y);
              if (mask[idx] === 0) continue;
              
              let isEdge = false;
              if (x > 0 && mask[idx - 1] === 0) isEdge = true;
              else if (x < width - 1 && mask[idx + 1] === 0) isEdge = true;
              else if (y > 0 && mask[idx - width] === 0) isEdge = true;
              else if (y < height - 1 && mask[idx + width] === 0) isEdge = true;
              
              if (isEdge) {
                distanceField[idx] = 0;
                edgeQueue[edgeEnd++] = idx;
              }
            }
          }
          
          while (edgeStart < edgeEnd) {
            const idx = edgeQueue[edgeStart++];
            const currentDist = distanceField[idx];
            
            if (currentDist >= smoothing) continue;
            
            const x = idx % width;
            const y = Math.floor(idx / width);
            
            const checkNeighbor = (neighborIdx) => {
              if (mask[neighborIdx] === 255 && distanceField[neighborIdx] > currentDist + 1) {
                distanceField[neighborIdx] = currentDist + 1;
                edgeQueue[edgeEnd++] = neighborIdx;
              }
            };
            
            if (x > 0) checkNeighbor(idx - 1);
            if (x < width - 1) checkNeighbor(idx + 1);
            if (y > 0) checkNeighbor(idx - width);
            if (y < height - 1) checkNeighbor(idx + width);
          }
          
          for (let i = 0; i < mask.length; i++) {
            if (mask[i] === 255 && distanceField[i] < smoothing) {
              const featherAlpha = distanceField[i] / smoothing;
              mask[i] = Math.round(255 * (1 - featherAlpha * featherAlpha));
            }
          }
        }
        
        const replacementRgb = replaceBackground ? hexToRgb(replacementColor) : null;
        
        for (let i = 0; i < mask.length; i++) {
          const dataIdx = i * 4;
          const maskValue = mask[i];
          
          if (maskValue > 0) {
            const alpha = maskValue / 255;
            
            if (replaceBackground && replacementRgb) {
              data[dataIdx] = Math.round(data[dataIdx] * (1 - alpha) + replacementRgb.r * alpha);
              data[dataIdx + 1] = Math.round(data[dataIdx + 1] * (1 - alpha) + replacementRgb.g * alpha);
              data[dataIdx + 2] = Math.round(data[dataIdx + 2] * (1 - alpha) + replacementRgb.b * alpha);
              data[dataIdx + 3] = 255;
            } else {
              data[dataIdx + 3] = Math.round(255 * (1 - alpha));
            }
          }
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        const mimeType = outputFormat === 'jpeg' ? 'image/jpeg' : 
                        outputFormat === 'png' ? 'image/png' : 'image/webp';
        
        canvas.toBlob((blob) => {
          const processedFile = {
            id: Date.now() + Math.random(),
            originalId: file.id,
            name: file.name.replace(/\.[^/.]+$/, formatOptions.find(f => f.value === outputFormat).extension),
            originalSize: file.size,
            processedSize: blob.size,
            blob: blob,
            url: URL.createObjectURL(blob),
            width: canvas.width,
            height: canvas.height,
            format: outputFormat
          };
          resolve(processedFile);
        }, mimeType, outputFormat === 'jpeg' ? 0.9 : undefined);
      };
      img.src = file.url;
    });
  }, [tolerance, smoothing, outputFormat, removalMode, backgroundColor, replaceBackground, replacementColor, featherEdge]);

  const processFiles = useCallback(async () => {
    if (selectedFiles.length === 0) return;

    setIsProcessing(true);
    setProcessingProgress(0);
    setProcessedFiles([]);

    const newProcessedFiles = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      try {
        const processedFile = await removeBackground(selectedFiles[i]);
        newProcessedFiles.push(processedFile);
        setProcessingProgress(((i + 1) / selectedFiles.length) * 100);
        setProcessedFiles(prev => [...prev, processedFile]);
      } catch (error) {}
    }

    setIsProcessing(false);
  }, [selectedFiles, removeBackground]);

  const downloadFile = useCallback((processedFile) => {
    const a = document.createElement('a');
    a.href = processedFile.url;
    a.download = processedFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  const downloadAllFiles = useCallback(() => {
    processedFiles.forEach(file => {
      setTimeout(() => downloadFile(file), 100);
    });
  }, [processedFiles, downloadFile]);

  const resetSettings = useCallback(() => {
    setTolerance(30);
    setSmoothing(2);
    setOutputFormat("png");
    setRemovalMode("smart");
    setBackgroundColor("#ffffff");
    setReplaceBackground(false);
    setReplacementColor("#ffffff");
    setFeatherEdge(true);
  }, []);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const totalOriginalSize = useMemo(() => 
    selectedFiles.reduce((total, file) => total + file.size, 0), [selectedFiles]);

  const totalProcessedSize = useMemo(() => 
    processedFiles.reduce((total, file) => total + file.processedSize, 0), [processedFiles]);

  return (
    <div className="dinolabsBackgroundRemoverApp" tabIndex={0}>
      <DinoLabsNav activePage="plugins" />

      <div className="dinolabsBackgroundRemoverShell">
        <aside className="dinolabsBackgroundRemoverSidebar">
          
          <div className="dinolabsBackgroundRemoverSection">
            <div className="dinolabsBackgroundRemoverSectionTitle">
              <FontAwesomeIcon icon={faFileArrowUp} />
              <span>Image Input</span>
            </div>

            <div className="dinolabsBackgroundRemoverRow">
              <label className="dinolabsBackgroundRemoverLabel">Select Images</label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileSelect}
                className="dinolabsBackgroundRemoverFileInput"
              />
              <button 
                className="dinolabsBackgroundRemoverBtn"
                onClick={() => fileInputRef.current?.click()}
              >
                <FontAwesomeIcon icon={faImage} /> Choose Images
              </button>
            </div>

            <div className="dinolabsBackgroundRemoverRow">
              <div className="dinolabsBackgroundRemoverStats">
                <div className="dinolabsBackgroundRemoverStat">
                  <span className="dinolabsBackgroundRemoverStatLabel">Images Selected</span>
                  <span className="dinolabsBackgroundRemoverStatValue">{selectedFiles.length}</span>
                </div>
                <div className="dinolabsBackgroundRemoverStat">
                  <span className="dinolabsBackgroundRemoverStatLabel">Total Size</span>
                  <span className="dinolabsBackgroundRemoverStatValue">{formatFileSize(totalOriginalSize)}</span>
                </div>
              </div>
            </div>

            <div className="dinolabsBackgroundRemoverRow dinolabsBackgroundRemoverActions">
              <button 
                className="dinolabsBackgroundRemoverBtn dinolabsBackgroundRemoverSubtle" 
                onClick={clearAllFiles}
                disabled={selectedFiles.length === 0}
              >
                <FontAwesomeIcon icon={faTrash} /> Clear All
              </button>
            </div>
          </div>

          <div className="dinolabsBackgroundRemoverSection">
            <div className="dinolabsBackgroundRemoverSectionTitle">
              <FontAwesomeIcon icon={faSliders} />
              <span>Removal Settings</span>
            </div>

            <div className="dinolabsBackgroundRemoverRow">
              <label className="dinolabsBackgroundRemoverLabel">Removal Mode</label>
              <select 
                className="dinolabsBackgroundRemoverSelect" 
                value={removalMode} 
                onChange={(e) => setRemovalMode(e.target.value)}
              >
                {removalModes.map(mode => (
                  <option key={mode.value} value={mode.value}>
                    {mode.label}
                  </option>
                ))}
              </select>
            </div>

            {removalMode === 'color' && (
              <div className="dinolabsBackgroundRemoverRow">
                <label className="dinolabsBackgroundRemoverLabel">Background Color</label>
                <div className="dinolabsBackgroundRemoverColorRow">
                  <Tippy 
                    content={
                      <DinoLabsColorPicker 
                        color={backgroundColor} 
                        onChange={(newColor) => setBackgroundColor(newColor)} 
                      />
                    } 
                    visible={colorPickerOpen.background} 
                    onClickOutside={() => closeColorPicker('background')} 
                    interactive={true} 
                    placement="right-start"
                    offset={[0, 10]}
                    appendTo={document.body}
                    className="color-picker-tippy"
                  >
                    <button
                      className="dinolabsBackgroundRemoverColorPicker"
                      style={{ backgroundColor: backgroundColor }}
                      onClick={() => toggleColorPicker('background')}
                      title="Change Background Color"
                    />
                  </Tippy>
                  <input
                    type="text"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="dinolabsBackgroundRemoverInput"
                  />
                </div>
              </div>
            )}

            <div className="dinolabsBackgroundRemoverRow">
              <label className="dinolabsBackgroundRemoverLabel">Tolerance</label>
              <input
                type="range"
                min="1"
                max="100"
                value={tolerance}
                onChange={(e) => setTolerance(+e.target.value)}
                className="dinolabsSettingsSlider"
              />
              <div className="dinolabsBackgroundRemoverSmall">{tolerance}</div>
            </div>

            <div className="dinolabsBackgroundRemoverRow">
              <label className="dinolabsBackgroundRemoverLabel">Tolerance Presets</label>
              <div className="dinolabsBackgroundRemoverPresets">
                {tolerancePresets.map(preset => (
                  <button
                    key={preset.name}
                    className={`dinolabsBackgroundRemoverPresetBtn ${
                      tolerance === preset.value ? 'active' : ''
                    }`}
                    onClick={() => setTolerance(preset.value)}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="dinolabsBackgroundRemoverRow">
              <label className="dinolabsBackgroundRemoverLabel">Edge Smoothing</label>
              <input
                type="range"
                min="0"
                max="10"
                value={smoothing}
                onChange={(e) => setSmoothing(+e.target.value)}
                className="dinolabsSettingsSlider"
              />
              <div className="dinolabsBackgroundRemoverSmall">{smoothing}px</div>
            </div>

            <div className="dinolabsBackgroundRemoverRow">
              <label className="dinolabsBackgroundRemoverCheckbox">
                <input
                  type="checkbox"
                  checked={featherEdge}
                  onChange={(e) => setFeatherEdge(e.target.checked)}
                  className="dinolabsSettingsCheckbox"
                />
                <span>Feather Edges</span>
              </label>
            </div>
          </div>

          <div className="dinolabsBackgroundRemoverSection">
            <div className="dinolabsBackgroundRemoverSectionTitle">
              <FontAwesomeIcon icon={faPaintBrush} />
              <span>Background Options</span>
            </div>

            <div className="dinolabsBackgroundRemoverRow">
              <label className="dinolabsBackgroundRemoverCheckbox">
                <input
                  type="checkbox"
                  checked={replaceBackground}
                  onChange={(e) => setReplaceBackground(e.target.checked)}
                  className="dinolabsSettingsCheckbox"
                />
                <span>Replace Background</span>
              </label>
            </div>

            {replaceBackground && (
              <div className="dinolabsBackgroundRemoverRow">
                <label className="dinolabsBackgroundRemoverLabel">Replacement Color</label>
                <div className="dinolabsBackgroundRemoverColorRow">
                  <Tippy 
                    content={
                      <DinoLabsColorPicker 
                        color={replacementColor} 
                        onChange={(newColor) => setReplacementColor(newColor)} 
                      />
                    } 
                    visible={colorPickerOpen.replacement} 
                    onClickOutside={() => closeColorPicker('replacement')} 
                    interactive={true} 
                    placement="right-start"
                    offset={[0, 10]}
                    appendTo={document.body}
                    className="color-picker-tippy"
                  >
                    <button
                      className="dinolabsBackgroundRemoverColorPicker"
                      style={{ backgroundColor: replacementColor }}
                      onClick={() => toggleColorPicker('replacement')}
                      title="Change Replacement Color"
                    />
                  </Tippy>
                  <input
                    type="text"
                    value={replacementColor}
                    onChange={(e) => setReplacementColor(e.target.value)}
                    className="dinolabsBackgroundRemoverInput"
                  />
                </div>
              </div>
            )}

            <div className="dinolabsBackgroundRemoverRow">
              <label className="dinolabsBackgroundRemoverLabel">Output Format</label>
              <select 
                className="dinolabsBackgroundRemoverSelect" 
                value={outputFormat} 
                onChange={(e) => setOutputFormat(e.target.value)}
              >
                {formatOptions.map(format => (
                  <option key={format.value} value={format.value}>
                    {format.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="dinolabsBackgroundRemoverSection">
            <div className="dinolabsBackgroundRemoverSectionTitle">
              <FontAwesomeIcon icon={faCog} />
              <span>Processing</span>
            </div>

            <div className="dinolabsBackgroundRemoverRow dinolabsBackgroundRemoverActions">
              <button 
                className="dinolabsBackgroundRemoverBtn"
                onClick={processFiles}
                disabled={selectedFiles.length === 0 || isProcessing}
              >
                <FontAwesomeIcon icon={faMagicWandSparkles} /> 
                {isProcessing ? 'Processing...' : 'Remove Backgrounds'}
              </button>
              <button 
                className="dinolabsBackgroundRemoverBtn dinolabsBackgroundRemoverSubtle" 
                onClick={resetSettings}
              >
                <FontAwesomeIcon icon={faArrowsRotate} /> Reset
              </button>
            </div>

            {isProcessing && (
              <div className="dinolabsBackgroundRemoverRow">
                <div className="dinolabsBackgroundRemoverProgress">
                  <div 
                    className="dinolabsBackgroundRemoverProgressBar"
                    style={{ width: `${processingProgress}%` }}
                  />
                </div>
                <div className="dinolabsBackgroundRemoverSmall">
                  {Math.round(processingProgress)}% Complete
                </div>
              </div>
            )}
          </div>
        </aside>

        <main className="dinolabsBackgroundRemoverMain">
          <div className="dinolabsBackgroundRemoverMainGrid">
            
            <section className="dinolabsBackgroundRemoverCard">
              <div className="dinolabsBackgroundRemoverCardTitle">
                Original Images
              </div>
              
              {selectedFiles.length === 0 ? (
                <div className="dinolabsBackgroundRemoverEmpty">
                  <FontAwesomeIcon icon={faImages} />
                  <p>No images selected. Choose images to get started.</p>
                </div>
              ) : (
                <div className="dinolabsBackgroundRemoverImageGrid">
                  {selectedFiles.map(file => (
                    <div key={file.id} className="dinolabsBackgroundRemoverImageCard">
                      <div 
                        className="dinolabsBackgroundRemoverImagePreview"
                        style={{ backgroundImage: `url(${file.url})` }}
                      />
                      <div className="dinolabsBackgroundRemoverImageInfo">
                        <div className="dinolabsBackgroundRemoverImageName">{file.name}</div>
                        <div className="dinolabsBackgroundRemoverImageMeta">
                          {formatFileSize(file.size)} • {file.type.split('/')[1]?.toUpperCase()}
                        </div>
                      </div>
                      <button
                        className="dinolabsBackgroundRemoverImageRemove"
                        onClick={() => removeFile(file.id)}
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="dinolabsBackgroundRemoverCard">
              <div className="dinolabsBackgroundRemoverCardTitle">
                Processed Images
                {processedFiles.length > 0 && (
                  <button 
                    className="dinolabsBackgroundRemoverBtn dinolabsBackgroundRemoverDownloadAll"
                    onClick={downloadAllFiles}
                  >
                    <FontAwesomeIcon icon={faDownload} /> Download All
                  </button>
                )}
              </div>

              {processedFiles.length === 0 ? (
                <div className="dinolabsBackgroundRemoverEmpty">
                  <FontAwesomeIcon icon={faScissors} />
                  <p>Processed images will appear here after background removal.</p>
                </div>
              ) : (
                <>
                  <div className="dinolabsBackgroundRemoverSummary">
                    <div className="dinolabsBackgroundRemoverSummaryStats">
                      <div className="dinolabsBackgroundRemoverSummaryStat">
                        <span className="dinolabsBackgroundRemoverSummaryLabel">Original Size</span>
                        <span className="dinolabsBackgroundRemoverSummaryValue">{formatFileSize(totalOriginalSize)}</span>
                      </div>
                      <div className="dinolabsBackgroundRemoverSummaryStat">
                        <span className="dinolabsBackgroundRemoverSummaryLabel">Processed Size</span>
                        <span className="dinolabsBackgroundRemoverSummaryValue">{formatFileSize(totalProcessedSize)}</span>
                      </div>
                      <div className="dinolabsBackgroundRemoverSummaryStat">
                        <span className="dinolabsBackgroundRemoverSummaryLabel">Images Processed</span>
                        <span className="dinolabsBackgroundRemoverSummaryValue">{processedFiles.length}</span>
                      </div>
                    </div>
                  </div>

                  <div className="dinolabsBackgroundRemoverImageGrid">
                    {processedFiles.map(file => (
                      <div key={file.id} className="dinolabsBackgroundRemoverImageCard">
                        <div 
                          className="dinolabsBackgroundRemoverImagePreview dinolabsBackgroundRemoverTransparencyBg"
                          style={{ backgroundImage: `url(${file.url})` }}
                        />
                        <div className="dinolabsBackgroundRemoverImageInfo">
                          <div className="dinolabsBackgroundRemoverImageName">{file.name}</div>
                          <div className="dinolabsBackgroundRemoverImageMeta">
                            {formatFileSize(file.processedSize)} • {file.format.toUpperCase()}
                          </div>
                          <div className="dinolabsBackgroundRemoverImageDimensions">
                            {file.width} × {file.height}px
                          </div>
                        </div>
                        <button
                          className="dinolabsBackgroundRemoverImageDownload"
                          onClick={() => downloadFile(file)}
                        >
                          <FontAwesomeIcon icon={faDownload} />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
};

export default DinoLabsPluginsBackgroundRemover;