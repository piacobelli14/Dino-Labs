import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFile, faDownload, faSave, faPrint, faRotate, faCircleInfo, faTrash,
  faArrowUp, faArrowDown, faArrowPointer, faHighlighter, faPen,
  faMinus, faEraser, faSearch, faXmark, faMagnifyingGlassPlus,
  faMagnifyingGlassMinus, faArrowsLeftRight, faArrowsUpDown, faClone,
  faFileCirclePlus, faUndo, faRedo, faPlus, faAngleLeft, faAngleRight,
  faTableCells
} from "@fortawesome/free-solid-svg-icons";
import Tippy from "@tippyjs/react";
import * as pdfjs from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { PDFDocument, rgb, degrees } from "pdf-lib";
import ColorPicker from "../../../../helpers/ColorPicker.jsx";
import { showDialog } from "../../../../helpers/Alert.jsx";
import "../../../../styles/mainStyles/Studio/Documents/PDF/PDF.css";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

const SAVE_BANNER_TIMEOUT_MS = 3000;
const MENU_WIDTH = 240;
const MENU_HEIGHT = 320;
const MENU_OFFSET = 6;
const WINDOW_EDGE_PADDING = 8;
const ZOOM_LADDER = [0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];
const THUMBNAIL_WIDTH = 132;
const INK_MINIMUM_POINTS = 2;
const HISTORY_LIMIT = 80;

const ANNOTATION_TOOLS = [
  { value: "select", label: "Select", icon: faArrowPointer },
  { value: "highlight", label: "Highlight", icon: faHighlighter },
  { value: "ink", label: "Draw", icon: faPen },
  { value: "redact", label: "Redact", icon: faEraser }
];

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

function hexToComponents(value) {
  const hex = String(value || "#4ecdc4").replace("#", "");
  const full = hex.length === 3 ? hex.split("").map((part) => part + part).join("") : hex;
  const parsed = /^[0-9a-fA-F]{6}$/.test(full) ? full : "4ecdc4";

  return [0, 2, 4].map((index) => parseInt(parsed.slice(index, index + 2), 16) / 255);
}

function annotationBounds(annotation) {
  if (annotation.kind === "ink") {
    const xs = annotation.points.map((point) => point.x);
    const ys = annotation.points.map((point) => point.y);

    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys)
    };
  }

  return {
    x: Math.min(annotation.x, annotation.x2 ?? annotation.x),
    y: Math.min(annotation.y, annotation.y2 ?? annotation.y),
    width: Math.abs((annotation.x2 ?? annotation.x) - annotation.x),
    height: Math.abs((annotation.y2 ?? annotation.y) - annotation.y)
  };
}

function createAnnotationId() {
  return `annotation-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function PdfPageView({ page, zoom, render, renderText, renderLinks, registerNode, onPointerDown, onPointerMove, onPointerUp, children }) {
  const canvasRef = useRef(null);
  const textRef = useRef(null);
  const linkRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function draw() {
      if (!canvasRef.current) return;

      const viewport = await render(page.number, canvasRef.current, zoom, page.rotation, () => cancelled);

      if (cancelled || !viewport) return;
      if (textRef.current && renderText) await renderText(page.number, textRef.current, viewport, () => cancelled);
      if (cancelled) return;
      if (linkRef.current && renderLinks) await renderLinks(page.number, linkRef.current, viewport, () => cancelled);
    }

    draw().catch(() => null);

    return () => { cancelled = true; };
  }, [page.number, page.rotation, zoom, render, renderText, renderLinks]);

  return (
    <div className="pdfPDFPage" ref={registerNode}>
      <div
        className="pdfPDFPageSurface"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <canvas ref={canvasRef} />
        <div className="pdfPDFTextLayer" ref={textRef} />
        <div className="pdfPDFLinkLayer" ref={linkRef} />
        <div className="pdfPDFAnnotationLayer">{children}</div>
      </div>
      <label className="pdfPDFPageLabel">Page {page.number}</label>
    </div>
  );
}

function PdfThumbnailView({ page, index, current, render, onSelect }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function draw() {
      if (!canvasRef.current) return;

      await render(page.number, canvasRef.current, null, page.rotation, () => cancelled, THUMBNAIL_WIDTH);
    }

    draw().catch(() => null);

    return () => { cancelled = true; };
  }, [page.number, page.rotation, render]);

  return (
    <button className={current ? "pdfPDFThumbnail current" : "pdfPDFThumbnail"} onClick={onSelect}>
      <canvas ref={canvasRef} />
      <label>{index + 1}</label>
    </button>
  );
}

export default function PDF({ fileHandle, onSaveStatusChange, onSave, onDirtyChange }) {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("Untitled.pdf");
  const [pageCount, setPageCount] = useState(0);
  const [pages, setPages] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [fitMode, setFitMode] = useState("width");
  const [tool, setTool] = useState("select");
  const [annotationColor, setAnnotationColor] = useState("#4ecdc4");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [annotations, setAnnotations] = useState({});
  const [selectedAnnotation, setSelectedAnnotation] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [openMenu, setOpenMenu] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [isColorOpen, setIsColorOpen] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(-1);
  const [saveBanner, setSaveBanner] = useState(null);

  const firstPageNumber = pages.length ? pages[0].number : 0;

  const documentRef = useRef(null);
  const bytesRef = useRef(null);
  const contentRef = useRef(null);
  const pageRefs = useRef({});
  const drawingRef = useRef(null);
  const renderTasksRef = useRef(new Map());
  const menuPortalRef = useRef(null);
  const fileBtnRef = useRef(null);
  const editBtnRef = useRef(null);
  const viewBtnRef = useRef(null);
  const pagesBtnRef = useRef(null);
  const annotateBtnRef = useRef(null);
  const bannerTimerRef = useRef(null);

  const notifySaveStatus = useCallback((status) => {
    setSaveBanner(status);
    onSaveStatusChange?.(status);
    onDirtyChange?.(status === "Unsaved Changes");

    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);

    bannerTimerRef.current = setTimeout(() => setSaveBanner(null), SAVE_BANNER_TIMEOUT_MS);
  }, [onSaveStatusChange, onDirtyChange]);

  const recordHistory = useCallback((nextAnnotations, nextPages) => {
    setHistory((previous) => {
      const trimmed = previous.slice(0, historyIndex + 1);
      const entry = {
        annotations: JSON.parse(JSON.stringify(nextAnnotations)),
        pages: nextPages.map((page) => ({ ...page }))
      };
      const appended = [...trimmed, entry].slice(-HISTORY_LIMIT);

      setHistoryIndex(appended.length - 1);

      return appended;
    });
  }, [historyIndex]);

  const commitChange = useCallback((nextAnnotations, nextPages) => {
    setAnnotations(nextAnnotations);
    setPages(nextPages);
    recordHistory(nextAnnotations, nextPages);
    notifySaveStatus("Unsaved Changes");
  }, [recordHistory, notifySaveStatus]);

  const renderPageCanvas = useCallback(async (pageNumber, canvas, scale, rotation, isCancelled, targetWidth) => {
    const source = documentRef.current;

    if (!source || !canvas) return null;

    const page = await source.getPage(pageNumber);

    if (isCancelled?.()) return null;

    const spin = (page.rotate + (rotation || 0)) % 360;
    const base = page.getViewport({ scale: 1, rotation: spin });
    const effective = targetWidth ? targetWidth / base.width : scale;
    const viewport = page.getViewport({ scale: effective, rotation: spin });
    const context = canvas.getContext("2d");
    const ratio = window.devicePixelRatio || 1;
    const pending = renderTasksRef.current.get(canvas);

    if (pending) {
      pending.cancel();
      renderTasksRef.current.delete(canvas);
    }

    canvas.width = Math.floor(viewport.width * ratio);
    canvas.height = Math.floor(viewport.height * ratio);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    const task = page.render({ canvasContext: context, viewport });

    renderTasksRef.current.set(canvas, task);

    try {
      await task.promise;
    } catch (renderError) {
      if (renderError?.name !== "RenderingCancelledException") throw renderError;
    } finally {
      if (renderTasksRef.current.get(canvas) === task) renderTasksRef.current.delete(canvas);
    }

    return viewport;
  }, []);

  const renderTextLayer = useCallback(async (pageNumber, container, viewport, isCancelled) => {
    const source = documentRef.current;

    if (!source || !container) return;

    try {
      const page = await source.getPage(pageNumber);

      if (isCancelled?.()) return;

      container.replaceChildren();
      container.style.setProperty("--scale-factor", viewport.scale);

      if (pdfjs.TextLayer) {
        await new pdfjs.TextLayer({
          textContentSource: page.streamTextContent ? page.streamTextContent() : await page.getTextContent(),
          container,
          viewport
        }).render();
      } else if (pdfjs.renderTextLayer) {
        const textContent = await page.getTextContent();

        await pdfjs.renderTextLayer({ textContent, container, viewport, textDivs: [] }).promise;
      }
    } catch (layerError) {
      if (layerError?.name !== "AbortException") console.warn("The text layer could not be rendered.", layerError);
    }
  }, []);

  const goToPageRef = useRef(null);

  const renderLinkLayer = useCallback(async (pageNumber, container, viewport, isCancelled) => {
    const source = documentRef.current;

    if (!source || !container) return;

    try {
      const page = await source.getPage(pageNumber);
      const items = await page.getAnnotations({ intent: "display" });

      if (isCancelled?.()) return;

      container.replaceChildren();

      for (const item of items) {
        if (item.subtype !== "Link" || !item.rect) continue;

        const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(item.rect);
        const anchor = document.createElement("a");

        anchor.className = "pdfPDFLink";
        anchor.style.left = `${Math.min(x1, x2)}px`;
        anchor.style.top = `${Math.min(y1, y2)}px`;
        anchor.style.width = `${Math.abs(x2 - x1)}px`;
        anchor.style.height = `${Math.abs(y2 - y1)}px`;

        if (item.url) {
          anchor.href = item.url;
          anchor.target = "_blank";
          anchor.rel = "noreferrer";
          anchor.title = item.url;
        } else if (item.dest) {
          const destination = item.dest;

          anchor.href = "#";
          anchor.addEventListener("click", async (event) => {
            event.preventDefault();

            try {
              const explicit = typeof destination === "string" ? await source.getDestination(destination) : destination;
              const index = await source.getPageIndex(explicit[0]);

              goToPageRef.current?.(index + 1);
            } catch { }
          });
        } else {
          continue;
        }

        container.appendChild(anchor);
      }
    } catch { }
  }, []);

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
        const name = file.name || "Untitled.pdf";

        setDisplayName(name);

        if (!name.toLowerCase().endsWith(".pdf")) {
          throw new Error("This file is not a PDF document.");
        }

        const buffer = await file.arrayBuffer();

        bytesRef.current = new Uint8Array(buffer.slice(0));

        const source = await pdfjs.getDocument({
          data: new Uint8Array(buffer.slice(0)),
          cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`
        }).promise;

        if (cancelled) return;

        documentRef.current = source;

        const initial = Array.from({ length: source.numPages }, (entry, index) => ({
          id: `page-${index + 1}`,
          number: index + 1,
          rotation: 0
        }));

        setPageCount(source.numPages);
        setPages(initial);
        setAnnotations({});
        setHistory([{ annotations: {}, pages: initial.map((page) => ({ ...page })) }]);
        setHistoryIndex(0);
        setCurrentPage(1);
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
    const content = contentRef.current;

    if (!content || fitMode === "none" || !documentRef.current || !firstPageNumber) return;

    let cancelled = false;

    async function fit() {
      const available = content.clientWidth - 48;
      const availableHeight = content.clientHeight - 48;

      if (cancelled || available <= 0 || availableHeight <= 0) return;

      const page = await documentRef.current.getPage(firstPageNumber);
      const viewport = page.getViewport({ scale: 1 });

      if (cancelled) return;

      const next = fitMode === "width"
        ? available / viewport.width
        : Math.min(available / viewport.width, availableHeight / viewport.height);

      setZoom((previous) => {
        const clamped = Math.max(0.1, Math.min(6, next));

        return Math.abs(previous - clamped) > 0.005 ? clamped : previous;
      });
    }

    fit().catch(() => null);

    const observer = new ResizeObserver(() => fit().catch(() => null));

    observer.observe(content);

    return () => { cancelled = true; observer.disconnect(); };
  }, [fitMode, firstPageNumber]);

  useEffect(() => {
    const content = contentRef.current;

    if (!content) return;

    const onScroll = () => {
      const middle = content.scrollTop + content.clientHeight / 2;

      let closest = pages.length ? pages[0].number : 1;

      for (const page of pages) {
        const node = pageRefs.current[page.id];

        if (node && node.offsetTop <= middle) closest = page.number;
      }

      setCurrentPage(closest);
    };

    content.addEventListener("scroll", onScroll);

    return () => content.removeEventListener("scroll", onScroll);
  }, [pages]);

  useEffect(() => {
    const handleMouseDown = (event) => {
      if (openMenu && !menuPortalRef.current?.contains(event.target) && !event.target.closest(".pdfPDFOperationsButton")) {
        setOpenMenu(null);
      }
    };

    document.addEventListener("mousedown", handleMouseDown, true);

    return () => document.removeEventListener("mousedown", handleMouseDown, true);
  }, [openMenu]);

  const openTopMenu = (name, buttonRef) => {
    setOpenMenu((previous) => (previous === name ? null : name));

    if (buttonRef.current) setMenuPosition(clampMenuPosition(buttonRef.current.getBoundingClientRect()));
  };

  const renderDropdownMenu = (menuName, items) => {
    if (openMenu !== menuName) return null;

    return createPortal(
      <div className="pdfPDFDropdownMenu" ref={menuPortalRef} style={{ top: menuPosition.top, left: menuPosition.left }}>
        {items.map((item, index) => (item.separator ? (
          <div className="pdfPDFDropdownMenuSeparator" key={`separator-${index}`} />
        ) : (
          <div
            className="pdfPDFDropdownMenuItem"
            key={item.text}
            onClick={() => { item.action(); setOpenMenu(null); }}
          >
            {item.icon && <FontAwesomeIcon icon={item.icon} />}
            <span className="pdfPDFDropdownMenuItemLabel">{item.text}</span>
          </div>
        )))}
      </div>,
      document.body
    );
  };

  const goToPage = useCallback((number) => {
    const target = pages.find((page) => page.number === number);
    const node = target ? pageRefs.current[target.id] : null;

    if (node && contentRef.current) contentRef.current.scrollTo({ top: node.offsetTop - 16, behavior: "smooth" });
  }, [pages]);

  useEffect(() => {
    goToPageRef.current = goToPage;
  }, [goToPage]);

  const stepZoom = useCallback((direction) => {
    setFitMode("none");
    setZoom((previous) => {
      if (direction > 0) return ZOOM_LADDER.find((step) => step > previous + 0.001) ?? previous;

      return [...ZOOM_LADDER].reverse().find((step) => step < previous - 0.001) ?? previous;
    });

    const content = contentRef.current;

    if (content) content.scrollTop = Math.max(0, content.scrollTop);
  }, []);

  const pointerToPageSpace = (event, pageId) => {
    const node = pageRefs.current[pageId];

    if (!node) return null;

    const surface = node.querySelector(".pdfPDFPageSurface");

    if (!surface) return null;

    const rect = surface.getBoundingClientRect();

    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height
    };
  };

  const handlePagePointerDown = (event, page) => {
    if (tool === "select") {
      setSelectedAnnotation(null);
      return;
    }

    const point = pointerToPageSpace(event, page.id);

    if (!point) return;

    event.currentTarget.setPointerCapture?.(event.pointerId);

    drawingRef.current = {
      page: page.number,
      entry: tool === "ink"
        ? { id: createAnnotationId(), kind: "ink", points: [point], color: annotationColor, size: strokeWidth }
        : {
          id: createAnnotationId(),
          kind: tool,
          x: point.x,
          y: point.y,
          x2: point.x,
          y2: point.y,
          color: annotationColor,
          size: strokeWidth
        }
    };

    setAnnotations((previous) => ({
      ...previous,
      [page.number]: [...(previous[page.number] || []), drawingRef.current.entry]
    }));
  };

  const handlePagePointerMove = (event, page) => {
    const drawing = drawingRef.current;

    if (!drawing || drawing.page !== page.number) return;

    const point = pointerToPageSpace(event, page.id);

    if (!point) return;

    setAnnotations((previous) => {
      const list = [...(previous[page.number] || [])];
      const index = list.findIndex((entry) => entry.id === drawing.entry.id);

      if (index < 0) return previous;

      const entry = { ...list[index] };

      if (entry.kind === "ink") entry.points = [...entry.points, point];
      else {
        entry.x2 = point.x;
        entry.y2 = point.y;
      }

      list[index] = entry;
      drawing.entry = entry;

      return { ...previous, [page.number]: list };
    });
  };

  const handlePagePointerUp = () => {
    const drawing = drawingRef.current;

    drawingRef.current = null;

    if (!drawing) return;

    setAnnotations((previous) => {
      const list = previous[drawing.page] || [];
      const entry = list.find((candidate) => candidate.id === drawing.entry.id);
      const next = entry && entry.kind === "ink" && entry.points.length < INK_MINIMUM_POINTS
        ? { ...previous, [drawing.page]: list.filter((candidate) => candidate.id !== entry.id) }
        : previous;

      recordHistory(next, pages);
      notifySaveStatus("Unsaved Changes");

      return next;
    });
  };

  const deleteAnnotation = useCallback((pageNumber, id) => {
    const next = {
      ...annotations,
      [pageNumber]: (annotations[pageNumber] || []).filter((entry) => entry.id !== id)
    };

    setSelectedAnnotation(null);
    commitChange(next, pages);
  }, [annotations, pages, commitChange]);

  const clearPageAnnotations = useCallback(() => {
    commitChange({ ...annotations, [currentPage]: [] }, pages);
  }, [annotations, currentPage, pages, commitChange]);

  const rotatePage = useCallback((amount) => {
    const next = pages.map((page) => (page.number === currentPage
      ? { ...page, rotation: (((page.rotation + amount) % 360) + 360) % 360 }
      : page));

    commitChange(annotations, next);
  }, [pages, currentPage, annotations, commitChange]);

  const movePage = useCallback((direction) => {
    const index = pages.findIndex((page) => page.number === currentPage);
    const target = index + direction;

    if (index < 0 || target < 0 || target >= pages.length) return;

    const next = [...pages];

    next.splice(target, 0, next.splice(index, 1)[0]);
    commitChange(annotations, next);
  }, [pages, currentPage, annotations, commitChange]);

  const duplicatePage = useCallback(() => {
    const index = pages.findIndex((page) => page.number === currentPage);

    if (index < 0) return;

    const source = pages[index];
    const next = [...pages];

    next.splice(index + 1, 0, { ...source, id: `${source.id}-copy-${Date.now()}` });
    commitChange(annotations, next);
  }, [pages, currentPage, annotations, commitChange]);

  const deletePage = useCallback(async () => {
    if (pages.length <= 1) {
      await showDialog({
        title: "Delete Page",
        message: "A document must keep at least one page.",
        showCancel: false
      });

      return;
    }

    const confirmed = await showDialog({
      title: "Delete Page",
      message: `Delete page ${currentPage} of this document?`,
      showCancel: true
    });

    if (!confirmed) return;

    const remaining = { ...annotations };

    delete remaining[currentPage];
    commitChange(remaining, pages.filter((page) => page.number !== currentPage));
  }, [pages, currentPage, annotations, commitChange]);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;

    const entry = history[historyIndex - 1];

    setHistoryIndex(historyIndex - 1);
    setAnnotations(JSON.parse(JSON.stringify(entry.annotations)));
    setPages(entry.pages.map((page) => ({ ...page })));
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;

    const entry = history[historyIndex + 1];

    setHistoryIndex(historyIndex + 1);
    setAnnotations(JSON.parse(JSON.stringify(entry.annotations)));
    setPages(entry.pages.map((page) => ({ ...page })));
  }, [history, historyIndex]);

  const buildDocument = useCallback(async () => {
    const source = await PDFDocument.load(bytesRef.current);
    const output = await PDFDocument.create();
    const copied = await output.copyPages(source, pages.map((page) => page.number - 1));

    pages.forEach((page, index) => {
      const target = copied[index];

      target.setRotation(degrees((target.getRotation().angle + page.rotation) % 360));
      output.addPage(target);

      const list = annotations[page.number] || [];
      const { width, height } = target.getSize();

      for (const entry of list) {
        const [red, green, blue] = hexToComponents(entry.color);
        const color = rgb(red, green, blue);
        const bounds = annotationBounds(entry);
        const x = bounds.x * width;
        const y = height - (bounds.y + bounds.height) * height;
        const boxWidth = bounds.width * width;
        const boxHeight = bounds.height * height;

        if (entry.kind === "highlight") {
          target.drawRectangle({ x, y, width: boxWidth, height: boxHeight, color, opacity: 0.35 });
        } else if (entry.kind === "redact") {
          target.drawRectangle({ x, y, width: boxWidth, height: boxHeight, color: rgb(0, 0, 0) });
        } else if (entry.kind === "ink") {
          for (let step = 1; step < entry.points.length; step++) {
            target.drawLine({
              start: { x: entry.points[step - 1].x * width, y: height - entry.points[step - 1].y * height },
              end: { x: entry.points[step].x * width, y: height - entry.points[step].y * height },
              color,
              thickness: entry.size
            });
          }
        }
      }
    });

    return output.save();
  }, [pages, annotations]);

  const handleSave = useCallback(async () => {
    try {
      const bytes = await buildDocument();
      const writable = await fileHandle.createWritable();

      await writable.write(bytes);
      await writable.close();

      bytesRef.current = bytes;
      notifySaveStatus("Saved Changes");
      onSave?.();
    } catch (saveError) {
      await showDialog({
        title: "Save Failed",
        message: saveError?.message || String(saveError),
        showCancel: false
      });
    }
  }, [buildDocument, fileHandle, notifySaveStatus, onSave]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const modifier = event.metaKey || event.ctrlKey;

      if (!modifier || event.key.toLowerCase() !== "s") return;

      event.preventDefault();
      event.stopPropagation();
      handleSave();
    };

    window.addEventListener("keydown", onKeyDown, true);

    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [handleSave]);

  const handleDownload = useCallback(async () => {
    const bytes = await buildDocument();
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = displayName;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [buildDocument, displayName]);

  const handlePrint = useCallback(async () => {
    const bytes = await buildDocument();
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const frame = document.createElement("iframe");

    frame.style.position = "fixed";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "none";
    frame.src = url;
    document.body.appendChild(frame);

    frame.onload = () => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    };
  }, [buildDocument]);

  const handleFileInformation = useCallback(async () => {
    const metadata = await documentRef.current?.getMetadata().catch(() => null);
    const annotationCount = Object.values(annotations).reduce((sum, list) => sum + list.length, 0);

    await showDialog({
      title: "File Information",
      message: [
        `Name: ${displayName}`,
        `Pages: ${pages.length} of ${pageCount} original`,
        `Annotations: ${annotationCount}`,
        `Title: ${metadata?.info?.Title || "None"}`,
        `Author: ${metadata?.info?.Author || "None"}`,
        `Producer: ${metadata?.info?.Producer || "None"}`,
        `PDF Version: ${metadata?.info?.PDFFormatVersion || "Unknown"}`
      ].join("\n"),
      showCancel: false
    });
  }, [displayName, pages.length, pageCount, annotations]);

  const runSearch = useCallback(async (query) => {
    const source = documentRef.current;

    if (!source || !query.trim()) {
      setSearchResults([]);
      setCurrentResultIndex(-1);

      return;
    }

    const needle = query.trim().toLowerCase();
    const found = [];

    for (const page of pages) {
      const target = await source.getPage(page.number);
      const content = await target.getTextContent();
      const text = content.items.map((item) => item.str).join(" ").toLowerCase();

      let index = text.indexOf(needle);

      while (index >= 0) {
        found.push({ page: page.number, index });
        index = text.indexOf(needle, index + needle.length);
      }
    }

    setSearchResults(found);
    setCurrentResultIndex(found.length ? 0 : -1);

    if (found.length) goToPage(found[0].page);
  }, [pages, goToPage]);

  const stepSearch = useCallback((direction) => {
    if (!searchResults.length) return;

    const next = (currentResultIndex + direction + searchResults.length) % searchResults.length;

    setCurrentResultIndex(next);
    goToPage(searchResults[next].page);
  }, [searchResults, currentResultIndex, goToPage]);

  const removeSelectedAnnotation = useCallback(() => {
    for (const [pageNumber, list] of Object.entries(annotations)) {
      if (list.some((entry) => entry.id === selectedAnnotation)) {
        deleteAnnotation(Number(pageNumber), selectedAnnotation);

        return;
      }
    }
  }, [annotations, selectedAnnotation, deleteAnnotation]);

  const renderAnnotation = (page, entry) => {
    const bounds = annotationBounds(entry);
    const selected = selectedAnnotation === entry.id;
    const base = {
      left: `${bounds.x * 100}%`,
      top: `${bounds.y * 100}%`,
      width: `${bounds.width * 100}%`,
      height: `${bounds.height * 100}%`
    };

    if (entry.kind === "ink") {
      const points = entry.points.map((point) => `${point.x * 100},${point.y * 100}`).join(" ");

      return (
        <svg
          key={entry.id}
          className={selected ? "pdfPDFAnnotation selected" : "pdfPDFAnnotation"}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          onClick={() => tool === "select" && setSelectedAnnotation(entry.id)}
        >
          <polyline
            points={points}
            fill="none"
            stroke={entry.color}
            strokeWidth={entry.size}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      );
    }

    return (
      <div
        key={entry.id}
        className={selected ? "pdfPDFAnnotationShape selected" : "pdfPDFAnnotationShape"}
        style={{
          ...base,
          background: entry.kind === "highlight" ? `${entry.color}59` : "#000000",
          borderRadius: "2px"
        }}
        onClick={() => tool === "select" && setSelectedAnnotation(entry.id)}
      />
    );
  };

  const renderPage = (page) => (
    <PdfPageView
      key={page.id}
      page={page}
      zoom={zoom}
      render={renderPageCanvas}
      renderText={renderTextLayer}
      renderLinks={renderLinkLayer}
      registerNode={(node) => { pageRefs.current[page.id] = node; }}
      onPointerDown={(event) => handlePagePointerDown(event, page)}
      onPointerMove={(event) => handlePagePointerMove(event, page)}
      onPointerUp={handlePagePointerUp}
    >
      {(annotations[page.number] || []).map((entry) => renderAnnotation(page, entry))}
    </PdfPageView>
  );

  const renderThumbnail = (page, index) => (
    <PdfThumbnailView
      key={page.id}
      page={page}
      index={index}
      current={currentPage === page.number}
      render={renderPageCanvas}
      onSelect={() => goToPage(page.number)}
    />
  );

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

  return (
    <div className="pdfPDFContentWrapper">
      <div className="pdfPDFToolbarWrapper">
        <div className="pdfPDFToolBar">
          <div className="pdfPDFTitleWrapper">
            <div className="pdfPDFFileNameStack">
              <label className="pdfPDFFileNameInput">
                <FontAwesomeIcon icon={faFile} /> {displayName}
              </label>

              <div className="pdfPDFOperationsButtonsWrapper">
                <button ref={fileBtnRef} className="pdfPDFOperationsButton" onClick={() => openTopMenu("file", fileBtnRef)}>
                  File
                </button>
                {renderDropdownMenu("file", [
                  { icon: faSave, text: "Save", action: handleSave },
                  { icon: faDownload, text: "Download", action: handleDownload },
                  { icon: faPrint, text: "Print", action: handlePrint },
                  { separator: true },
                  { icon: faCircleInfo, text: "File Information", action: handleFileInformation }
                ])}

                <button ref={editBtnRef} className="pdfPDFOperationsButton" onClick={() => openTopMenu("edit", editBtnRef)}>
                  Edit
                </button>
                {renderDropdownMenu("edit", [
                  { icon: faUndo, text: "Undo", action: undo },
                  { icon: faRedo, text: "Redo", action: redo },
                  { separator: true },
                  { icon: faTrash, text: "Clear Page Annotations", action: clearPageAnnotations },
                  { icon: faSearch, text: "Search Document", action: () => setShowSearchPanel(true) }
                ])}

                <button ref={viewBtnRef} className="pdfPDFOperationsButton" onClick={() => openTopMenu("view", viewBtnRef)}>
                  View
                </button>
                {renderDropdownMenu("view", [
                  { icon: faMagnifyingGlassPlus, text: "Zoom In", action: () => stepZoom(1) },
                  { icon: faMagnifyingGlassMinus, text: "Zoom Out", action: () => stepZoom(-1) },
                  { icon: faArrowsLeftRight, text: "Fit Width", action: () => setFitMode("width") },
                  { icon: faArrowsUpDown, text: "Fit Page", action: () => setFitMode("page") },
                  { separator: true },
                  {
                    icon: faTableCells,
                    text: showThumbnails ? "Hide Page Thumbnails" : "Show Page Thumbnails",
                    action: () => setShowThumbnails((previous) => !previous)
                  }
                ])}

                <button ref={pagesBtnRef} className="pdfPDFOperationsButton" onClick={() => openTopMenu("pages", pagesBtnRef)}>
                  Pages
                </button>
                {renderDropdownMenu("pages", [
                  { icon: faRotate, text: "Rotate Right", action: () => rotatePage(90) },
                  { icon: faRotate, text: "Rotate Left", action: () => rotatePage(-90) },
                  { separator: true },
                  { icon: faArrowUp, text: "Move Page Up", action: () => movePage(-1) },
                  { icon: faArrowDown, text: "Move Page Down", action: () => movePage(1) },
                  { separator: true },
                  { icon: faClone, text: "Duplicate Page", action: duplicatePage },
                  { icon: faTrash, text: "Delete Page", action: deletePage }
                ])}

                <button ref={annotateBtnRef} className="pdfPDFOperationsButton" onClick={() => openTopMenu("annotate", annotateBtnRef)}>
                  Annotate
                </button>
                {renderDropdownMenu("annotate", ANNOTATION_TOOLS.map((entry) => ({
                  icon: entry.icon,
                  text: entry.label,
                  action: () => setTool(entry.value)
                })))}
              </div>
            </div>
          </div>

          <div className="pdfPDFEditingButtonsWrapper">
            <div className="pdfPDFStatusGroup">
              <span className="pdfPDFStatusItem">
                <FontAwesomeIcon icon={faFile} />
                <span>Page {currentPage} Of {pages.length}</span>
              </span>
              <span className="pdfPDFStatusItem">
                <FontAwesomeIcon icon={faMagnifyingGlassPlus} />
                <span>{Math.round(zoom * 100)}%</span>
              </span>
            </div>

            <div className="pdfPDFStatusActions">
              <Tippy content="Previous Page" theme="tooltip-light">
                <button className="pdfPDFEditingButton pdfPDFStatusIconButton" onClick={() => goToPage(Math.max(1, currentPage - 1))}>
                  <FontAwesomeIcon icon={faAngleLeft} />
                </button>
              </Tippy>
              <Tippy content="Next Page" theme="tooltip-light">
                <button className="pdfPDFEditingButton pdfPDFStatusIconButton" onClick={() => goToPage(Math.min(pages.length, currentPage + 1))}>
                  <FontAwesomeIcon icon={faAngleRight} />
                </button>
              </Tippy>
              <Tippy content="Zoom Out" theme="tooltip-light">
                <button className="pdfPDFEditingButton pdfPDFStatusIconButton" onClick={() => stepZoom(-1)}>
                  <FontAwesomeIcon icon={faMagnifyingGlassMinus} />
                </button>
              </Tippy>
              <Tippy content="Zoom In" theme="tooltip-light">
                <button className="pdfPDFEditingButton pdfPDFStatusIconButton" onClick={() => stepZoom(1)}>
                  <FontAwesomeIcon icon={faMagnifyingGlassPlus} />
                </button>
              </Tippy>
            </div>

            <div className="pdfPDFStatusActions">
              {ANNOTATION_TOOLS.map((entry) => (
                <Tippy key={entry.value} content={entry.label} theme="tooltip-light">
                  <button
                    className={tool === entry.value ? "pdfPDFEditingButton pdfPDFStatusIconButton current" : "pdfPDFEditingButton pdfPDFStatusIconButton"}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => setTool(entry.value)}
                  >
                    <FontAwesomeIcon icon={entry.icon} />
                  </button>
                </Tippy>
              ))}
            </div>

            <div className="pdfPDFStatusActions">
              <Tippy
                content={<ColorPicker color={annotationColor} onChange={setAnnotationColor} />}
                visible={isColorOpen}
                onClickOutside={() => setIsColorOpen(false)}
                interactive={true}
                placement="top"
                className="color-picker-tippy"
                appendTo={() => document.body}
              >
                <label
                  className="pdfPDFColorControl"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setIsColorOpen((previous) => !previous)}
                >
                  <FontAwesomeIcon icon={faPen} />
                  <span className="pdfPDFColorSwatch" style={{ background: annotationColor }} />
                </label>
              </Tippy>

              <Tippy content="Thinner Stroke" theme="tooltip-light">
                <button className="pdfPDFEditingButton pdfPDFStatusIconButton" onClick={() => setStrokeWidth((previous) => Math.max(1, previous - 1))}>
                  <FontAwesomeIcon icon={faMinus} />
                </button>
              </Tippy>
              <span className="pdfPDFStrokeValue">{strokeWidth}</span>
              <Tippy content="Thicker Stroke" theme="tooltip-light">
                <button className="pdfPDFEditingButton pdfPDFStatusIconButton" onClick={() => setStrokeWidth((previous) => Math.min(24, previous + 1))}>
                  <FontAwesomeIcon icon={faPlus} />
                </button>
              </Tippy>
            </div>
          </div>
        </div>
      </div>

      {saveBanner && <div className="pdfPDFSaveBanner">{saveBanner}</div>}

      <div className="pdfPDFWorkspace">
        {showThumbnails && (
          <div className="pdfPDFThumbnailRail">
            {pages.map((page, index) => renderThumbnail(page, index))}
            <button className="pdfPDFThumbnailAction" onClick={duplicatePage}>
              <FontAwesomeIcon icon={faFileCirclePlus} /> Duplicate Page
            </button>
          </div>
        )}

        <div className={`pdfPDFContent pdfPDFTool-${tool}`} ref={contentRef}>
          {pages.map((page) => renderPage(page))}
        </div>
      </div>

      {selectedAnnotation && (
        <div className="pdfPDFAnnotationBar">
          <label>Annotation Selected</label>
          <button className="pdfPDFEditingButton pdfPDFStatusIconButton" onClick={removeSelectedAnnotation}>
            <FontAwesomeIcon icon={faTrash} /> Delete
          </button>
          <button className="pdfPDFEditingButton pdfPDFStatusIconButton" onClick={() => setSelectedAnnotation(null)}>
            <FontAwesomeIcon icon={faXmark} /> Deselect
          </button>
        </div>
      )}

      {showSearchPanel && (
        <div className="pdfPDFEditingSearchBoxWrapper">
          <div className="pdfPDFEditingSearchHeader">
            <label className="pdfPDFEditingSearchTitle">Search Document</label>
            <button
              className="pdfPDFEditingSearchClose"
              title="Close"
              onClick={() => { setShowSearchPanel(false); setSearchResults([]); setCurrentResultIndex(-1); }}
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>

          <input
            className="pdfPDFEditingSearchInput"
            type="text"
            value={searchQuery}
            placeholder="Search Text In This Document"
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                runSearch(searchQuery);
              }
            }}
          />

          <div className="pdfPDFEditingSearchOperationsButtonWrapper">
            <button className="pdfPDFEditingSearchOperationsButton" onClick={() => runSearch(searchQuery)}>
              <FontAwesomeIcon icon={faSearch} /> Find
            </button>
            <button className="pdfPDFEditingSearchOperationsButton" onClick={() => stepSearch(-1)}>
              <FontAwesomeIcon icon={faAngleLeft} /> Previous
            </button>
            <button className="pdfPDFEditingSearchOperationsButton" onClick={() => stepSearch(1)}>
              <FontAwesomeIcon icon={faAngleRight} /> Next
            </button>
          </div>

          <label className="pdfPDFEditingSearchLabel">
            {searchResults.length
              ? `Match ${currentResultIndex + 1} Of ${searchResults.length} On Page ${searchResults[currentResultIndex]?.page}`
              : "No Matches Found."}
          </label>
        </div>
      )}
    </div>
  );
}