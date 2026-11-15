import React, {
    forwardRef,
    useRef,
    useImperativeHandle,
    useEffect,
    useLayoutEffect,
    useState,
    useMemo,
    useCallback,
} from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faChevronRight, faChevronDown, faCut, faCopy, faPaste, faArrowPointer,
    faUndo, faRedo, faLocationCrosshairs
} from "@fortawesome/free-solid-svg-icons";
import {
    getCommentSyntax,
    shouldIndentAfter,
    shouldDedentLine,
    AUTO_CLOSE_PAIRS,
    CLOSING_CHARS
} from "./Parser.jsx";

function saveSelection(containerEl) {
    if (!containerEl) return null;
    return { start: containerEl.selectionStart, end: containerEl.selectionEnd };
}

function restoreSelection(containerEl, savedSel) {
    if (!savedSel || !containerEl) return;
    const { scrollTop, scrollLeft } = containerEl;
    containerEl.selectionStart = savedSel.start;
    containerEl.selectionEnd = savedSel.end;
    containerEl.scrollTop = scrollTop;
    containerEl.scrollLeft = scrollLeft;
}

function offsetToLineCol(text, offset) {
    let idx = 0;
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
        if (offset <= idx + lines[i].length) {
            return { line: i, col: offset - idx };
        }
        idx += lines[i].length + 1;
    }
    return { line: lines.length - 1, col: lines[lines.length - 1].length };
}

function lineColToOffset(text, line, col) {
    const lines = text.split("\n");
    let sum = 0;
    for (let i = 0; i < line && i < lines.length; i++) sum += lines[i].length + 1;
    return sum + Math.min(col, lines[line].length);
}

function unifyIndentation(line) {
    let i = 0;
    while (i < line.length && (line[i] === " " || line[i] === "\t")) i++;
    const leading = line.slice(0, i);
    const rest = line.slice(i);
    let spaceCount = 0;
    for (let j = 0; j < leading.length; j++) spaceCount += leading[j] === "\t" ? 4 : 1;
    return " ".repeat(spaceCount) + rest;
}

function detectFoldableRegions(code) {
    const lines = code.split("\n");
    const regions = [];
    const N = lines.length;
    const indents = new Array(N);
    const blanks = new Array(N);

    const indentOf = (s) => {
        let count = 0;
        for (let i = 0; i < s.length; i++) {
            const ch = s[i];
            if (ch === " ") count += 1;
            else if (ch === "\t") count += 4;
            else break;
        }
        return count;
    };

    const isBlank = (s) => s.trim().length === 0;

    for (let i = 0; i < N; i++) {
        blanks[i] = isBlank(lines[i]);
        indents[i] = blanks[i] ? 0 : indentOf(lines[i]);
    }

    for (let i = 0; i < N - 1; i++) {
        if (blanks[i]) continue;
        let j = i + 1;
        while (j < N && blanks[j]) j++;
        if (j >= N) break;

        const baseIndent = indents[i];
        const nextIndent = indents[j];

        if (nextIndent > baseIndent) {
            let k = j;
            let lastGreater = j;
            while (k < N) {
                if (!blanks[k]) {
                    if (indents[k] > baseIndent) lastGreater = k;
                    else break;
                }
                k++;
            }
            if (lastGreater > i) {
                regions.push({ startLine: i + 1, endLine: lastGreater + 1, type: "block" });
            }
        }
    }
    return regions;
}

function adjustFoldedRegionsForEdit(foldedRegions, editStartLine, editEndLine, linesDelta) {
    const newFoldedRegions = new Set();
    for (const foldedLine of foldedRegions) {
        if (foldedLine < editStartLine) {
            newFoldedRegions.add(foldedLine);
        } else if (foldedLine > editEndLine) {
            const newLine = foldedLine + linesDelta;
            if (newLine > 0) newFoldedRegions.add(newLine);
        }
    }
    return newFoldedRegions;
}

function adjustRegionsListForEdit(regions, editStartLine, editEndLine, linesDelta) {
    if (linesDelta === 0 || regions.length === 0) return regions;
    const updated = [];
    for (const r of regions) {
        if (r.endLine < editStartLine) updated.push(r);
        else if (r.startLine > editEndLine) updated.push({ ...r, startLine: r.startLine + linesDelta, endLine: r.endLine + linesDelta });
        else updated.push(r);
    }
    return updated;
}

function countNewlines(s) {
    if (!s) return 0;
    let n = 0;
    for (let i = 0; i < s.length; i++) if (s[i] === "\n") n++;
    return n;
}

const RENDER_BUFFER = 40;

const Mirror = forwardRef(function Mirror(
    {
        viewCode,
        setViewCode,
        handleInput,
        handleKeyDown,
        highlightedCode,
        fullHighlightedCode,
        fontSize,
        lineHeight,
        editorId,
        disableFocus,
        keyBinds,
        lintErrors = [],
        handleScroll,
        language = "javascript",
    },
    ref
) {
    const containerRef = useRef(null);
    const [renderWindow, setRenderWindow] = useState({ start: 0, end: 120 });
    const highlightRef = useRef(null);
    const textareaRef = useRef(null);
    const lastSavedSelRef = useRef(null);
    const pendingScrollRef = useRef(null);
    const isInternalOperationRef = useRef(false);
    const undoStackRef = useRef([]);
    const redoStackRef = useRef([]);
    const commandChainRef = useRef(Promise.resolve());
    const previousCodeRef = useRef("");
    const foldableRegionsRef = useRef([]);
    const isFoldingRef = useRef(false);
    const isEditingRef = useRef(false);
    const forceRecalcRef = useRef(false);
    const isMinimapDraggingRef = useRef(false);
    const minimapWrapperRef = useRef(null);
    const minimapContentRef = useRef(null);
    const minimapViewportRef = useRef(null);
    const foldingDebounceTimer = useRef(null);
    const minimapDebounceTimer = useRef(null);
    const lastCodeHashRef = useRef("");
    const highlightUpdateTimer = useRef(null);
    const scrollUpdateTimer = useRef(null);
    const renderTimer = useRef(null);
    const batchUpdateTimer = useRef(null);
    const currentCodeVersionRef = useRef(0);

    const [contextMenuState, setContextMenuState] = useState({ visible: false, x: 0, y: 0 });
    const [goToLineOpen, setGoToLineOpen] = useState(false);
    const [goToLineValue, setGoToLineValue] = useState("");
    const [caretInfo, setCaretInfo] = useState({ line: 1, column: 1, selected: 0 });
    const [foldedRegions, setFoldedRegions] = useState(new Set());
    const [breakpoints, setBreakpoints] = useState(new Set());
    const [gutterPx, setGutterPx] = useState(72);
    const [minimapHost, setMinimapHost] = useState(null);
    const [minimapRect, setMinimapRect] = useState({ top: 0, left: 0, width: 92, height: 0 });
    const [minimapReady, setMinimapReady] = useState(false);
    const [isUpdatingHighlight, setIsUpdatingHighlight] = useState(false);
    const [codeVersion, setCodeVersion] = useState(0);

    const minimapWidthPx = 92;

    const measureGutter = useCallback(() => {
        const totalLines = viewCode ? viewCode.split("\n").length : 1;
        const digits = Math.max(2, String(totalLines).length);

        const lineNumberWidth = digits * fontSize * 0.7;
        const chevronWidth = fontSize * 1.2;
        const indicatorWidth = fontSize * 0.8;
        const spacing = fontSize * 0.15;
        const leftPadding = fontSize * 0.3;
        const rightPadding = fontSize * 0.2;
        const codeGap = fontSize * 0.5;

        const totalWidth = leftPadding + lineNumberWidth + chevronWidth + indicatorWidth + (spacing * 2) + rightPadding + codeGap;

        setGutterPx(Math.max(60, Math.ceil(totalWidth)));
    }, [viewCode, fontSize]);

    const getCodeHash = useCallback((code) => {
        if (!code) return "0:0";

        const len = code.length;
        const step = len > 20000 ? Math.ceil(len / 20000) : 1;
        let hash = 0;

        for (let i = 0; i < len; i += step) {
            hash = ((hash << 5) - hash) + code.charCodeAt(i);
            hash = hash & hash;
        }

        if (step > 1) {
            for (let i = Math.max(0, len - 512); i < len; i++) {
                hash = ((hash << 5) - hash) + code.charCodeAt(i);
                hash = hash & hash;
            }
        }

        return `${len}:${hash}`;
    }, []);

    const foldableRegions = useMemo(() => {
        const currentCode = viewCode || "";
        const currentHash = getCodeHash(currentCode);

        if (lastCodeHashRef.current === currentHash && foldableRegionsRef.current.length > 0 && !forceRecalcRef.current) {
            return foldableRegionsRef.current;
        }

        const regions = detectFoldableRegions(currentCode);
        foldableRegionsRef.current = regions;
        previousCodeRef.current = currentCode;
        lastCodeHashRef.current = currentHash;
        forceRecalcRef.current = false;

        return regions;
    }, [viewCode, getCodeHash, codeVersion]);

    const { displayCode, displayHighlightedCode, lineMapping } = useMemo(() => {
        if (!viewCode) return { displayCode: "", displayHighlightedCode: "", lineMapping: new Map() };

        const lines = viewCode.split("\n");
        const highlightLines = highlightedCode && highlightedCode.includes("<br")
            ? highlightedCode.split(/<br\s*\/?>/gi)
            : highlightedCode ? highlightedCode.split(/\r\n|\r|\n/) : lines.map(line => line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));

        const visibleLines = [];
        const visibleHighlightLines = [];
        const mapping = new Map();

        const hiddenLines = new Set();

        for (const region of foldableRegions) {
            if (!foldedRegions.has(region.startLine)) {
                continue;
            }

            for (let n = region.startLine + 1; n <= region.endLine; n++) {
                hiddenLines.add(n);
            }
        }

        for (let i = 0; i < lines.length; i++) {
            const lineNumber = i + 1;

            if (!hiddenLines.has(lineNumber)) {
                mapping.set(visibleLines.length + 1, lineNumber);
                visibleLines.push(lines[i]);

                const highlightLine = highlightLines[i] ||
                    lines[i].replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                visibleHighlightLines.push(highlightLine);
            }
        }

        return {
            displayCode: visibleLines.join("\n"),
            displayHighlightedCode: visibleHighlightLines.join("\n"),
            lineMapping: mapping,
        };
    }, [viewCode, highlightedCode, foldedRegions, foldableRegions, codeVersion]);

    const foldableStartLines = useMemo(
        () => new Set(foldableRegions.map((region) => region.startLine)),
        [foldableRegions]
    );

    const canFoldLine = useCallback(
        (originalLineNumber) => foldableStartLines.has(originalLineNumber),
        [foldableStartLines]
    );

    const isLineFolded = useCallback((originalLineNumber) => foldedRegions.has(originalLineNumber), [foldedRegions]);
    const hasBreakpoint = useCallback((originalLineNumber) => breakpoints.has(originalLineNumber), [breakpoints]);

    const toggleFold = useCallback((originalLineNumber) => {
        isFoldingRef.current = true;
        setFoldedRegions((prev) => {
            const s = new Set(prev);
            if (s.has(originalLineNumber)) s.delete(originalLineNumber);
            else s.add(originalLineNumber);
            return s;
        });
        setCodeVersion(v => v + 1);
        setTimeout(() => (isFoldingRef.current = false), 100);
    }, []);

    const toggleBreakpoint = useCallback((originalLineNumber) => {
        setBreakpoints((prev) => {
            const s = new Set(prev);
            if (s.has(originalLineNumber)) s.delete(originalLineNumber);
            else s.add(originalLineNumber);
            return s;
        });
    }, []);

    function queueCommand(fn) {
        commandChainRef.current = commandChainRef.current.then(fn);
    }

    function pushUndoSnapshot() {
        const sel = saveSelection(textareaRef.current);
        undoStackRef.current.push({ code: viewCode, sel });
    }

    function applyLineEditAdjustments(editStartLine, editEndLine, linesDelta, updatedCode, affectedOverlaps) {
        if (linesDelta !== 0) {
            setFoldedRegions((prev) => adjustFoldedRegionsForEdit(prev, editStartLine, editEndLine, linesDelta));
            setBreakpoints((prev) => adjustFoldedRegionsForEdit(prev, editStartLine, editEndLine, linesDelta));
            const shifted = adjustRegionsListForEdit(foldableRegionsRef.current, editStartLine, editEndLine, linesDelta);
            foldableRegionsRef.current = shifted;
        }
        previousCodeRef.current = updatedCode;
        if (affectedOverlaps) forceRecalcRef.current = true;
        currentCodeVersionRef.current += 1;
        setCodeVersion(currentCodeVersionRef.current);
    }

    function editOverlapWithRegions(editStartLine, editEndLine) {
        return foldableRegionsRef.current.some((r) => !(r.endLine < editStartLine || r.startLine > editEndLine));
    }

    function updateContentViaParent(newCode, newSelection = null, scrollSnapshot = null) {
        isInternalOperationRef.current = true;
        if (newSelection) lastSavedSelRef.current = newSelection;
        if (scrollSnapshot) pendingScrollRef.current = scrollSnapshot;
        currentCodeVersionRef.current += 1;
        setCodeVersion(currentCodeVersionRef.current);
        handleInput({ target: { value: newCode } });
    }

    const resolveLineHeight = useCallback(() => {
        if (typeof lineHeight === "number" && isFinite(lineHeight) && lineHeight > 0) return lineHeight;
        if (typeof lineHeight === "string") {
            const parsed = parseFloat(lineHeight);
            if (isFinite(parsed) && parsed > 0) return parsed;
        }
        const el = textareaRef.current;
        if (el) {
            const cs = getComputedStyle(el);
            const lh = parseFloat(cs.lineHeight);
            if (isFinite(lh) && lh > 0) return lh;
        }
        return 16;
    }, [lineHeight]);

    const syncMinimapViewport = useCallback(() => {
        const wrapper = minimapWrapperRef.current;
        const viewport = minimapViewportRef.current;
        const container = containerRef.current;

        if (!wrapper || !viewport || !container) return;

        const minimapHeight = wrapper.clientHeight;
        const containerHeight = container.clientHeight;
        const containerScrollHeight = container.scrollHeight;
        const containerScrollTop = container.scrollTop;

        if (containerScrollHeight <= containerHeight) {
            viewport.style.top = "0px";
            viewport.style.height = `${minimapHeight}px`;
            return;
        }

        const visibleRatio = containerHeight / containerScrollHeight;
        const viewportHeight = Math.max(20, Math.round(visibleRatio * minimapHeight));

        const scrollRatio = containerScrollTop / (containerScrollHeight - containerHeight);
        const maxViewportTop = minimapHeight - viewportHeight;
        const viewportTop = Math.round(scrollRatio * maxViewportTop);

        viewport.style.height = `${viewportHeight}px`;
        viewport.style.top = `${Math.max(0, viewportTop)}px`;
    }, []);

    const syncMinimapContent = useCallback(() => {
        const container = containerRef.current;
        const minimapContent = minimapContentRef.current;

        if (!container || !minimapContent) return;

        const containerScrollHeight = container.scrollHeight;
        const containerHeight = container.clientHeight;
        const containerScrollTop = container.scrollTop;
        const scale = 0.16;
        minimapContent.style.transformOrigin = "top left";

        if (containerScrollHeight <= containerHeight) {
            minimapContent.style.transform = `scale(${scale})`;
            return;
        }

        const scrollRatio = containerScrollTop / (containerScrollHeight - containerHeight);
        const contentHeight = minimapContent.scrollHeight * scale;
        const visibleHeight = minimapContent.parentElement.clientHeight;

        if (contentHeight <= visibleHeight) {
            minimapContent.style.transform = `scale(${scale})`;
            return;
        }

        const maxTranslate = (contentHeight - visibleHeight) / scale;
        const translateY = -scrollRatio * maxTranslate;

        minimapContent.style.transform = `scale(${scale}) translateY(${translateY}px)`;
    }, []);

    const renderMinimapContent = useCallback(() => {
        const node = minimapContentRef.current;
        if (!node) return;

        if (minimapDebounceTimer.current) {
            clearTimeout(minimapDebounceTimer.current);
        }

        minimapDebounceTimer.current = setTimeout(() => {
            requestAnimationFrame(() => {
                const minimapCode = fullHighlightedCode || displayHighlightedCode || "";
                const lines = minimapCode.split(/\r\n|\r|\n/);
                const html = lines
                    .map((line) => (line.trim() === "" ? "\u200B" : line))
                    .join("<br>");

                node.innerHTML = `<pre class="minimapPre" style="font-size: ${fontSize}px; line-height: ${lineHeight}px; margin: 0; padding: 0;">${html}</pre>`;

                requestAnimationFrame(() => {
                    syncMinimapViewport();
                    syncMinimapContent();
                });
            });
        }, 200);
    }, [fullHighlightedCode, displayHighlightedCode, fontSize, lineHeight, syncMinimapViewport, syncMinimapContent]);

    const handleAnyScroll = useCallback(() => {
        const container = containerRef.current;

        if (container) {
            const rowHeight = lineHeight || 20;
            const first = Math.floor(container.scrollTop / rowHeight);
            const count = Math.ceil(container.clientHeight / rowHeight);

            setRenderWindow((prev) => {
                const start = Math.max(0, first - RENDER_BUFFER);
                const end = first + count + RENDER_BUFFER;

                if (Math.abs(prev.start - start) < RENDER_BUFFER / 2 && Math.abs(prev.end - end) < RENDER_BUFFER / 2) {
                    return prev;
                }

                return { start, end };
            });
        }

        if (highlightRef.current && container) {
            highlightRef.current.scrollTop = container.scrollTop;
        }

        if (textareaRef.current && container) {
            textareaRef.current.scrollTop = container.scrollTop;
        }

        if (scrollUpdateTimer.current) {
            clearTimeout(scrollUpdateTimer.current);
        }

        scrollUpdateTimer.current = setTimeout(() => {
            if (handleScroll && container) {
                requestAnimationFrame(() => {
                    handleScroll(container);
                });
            }

            requestAnimationFrame(() => {
                syncMinimapViewport();
                syncMinimapContent();
            });
        }, 16);
    }, [syncMinimapViewport, syncMinimapContent, handleScroll, lineHeight]);

    const minimapDragToScroll = useCallback((e) => {
        const wrapper = minimapWrapperRef.current;
        const container = containerRef.current;
        if (!wrapper || !container) return;

        const rect = wrapper.getBoundingClientRect();
        const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
        const clickRatio = y / rect.height;

        const maxScroll = container.scrollHeight - container.clientHeight;
        container.scrollTop = clickRatio * maxScroll;

        requestAnimationFrame(() => {
            syncMinimapViewport();
            syncMinimapContent();
        });
    }, [syncMinimapViewport, syncMinimapContent]);

    const updateMinimapRect = useCallback(() => {
        const own = containerRef.current;
        if (!own) return;

        let anchor = own.closest(".codeContentWrapper");
        if (!anchor || !(anchor instanceof HTMLElement)) anchor = own.closest(".codeEditorContainer");
        if (!anchor || !(anchor instanceof HTMLElement)) anchor = own;

        const rect = anchor.getBoundingClientRect();
        const left = rect.right - minimapWidthPx;

        let adjustedTop = rect.top;
        let adjustedHeight = rect.height;

        if (anchor.classList.contains("codeEditorContainer")) {
            const editorWrapper = anchor.querySelector(".codeContentWrapper");
            if (editorWrapper) {
                const editorRect = editorWrapper.getBoundingClientRect();
                adjustedTop = editorRect.top;
                adjustedHeight = editorRect.height;
            } else {
                const cs = window.getComputedStyle(anchor);
                const topPadding = parseFloat(cs.paddingTop) || 0;
                adjustedTop = rect.top + topPadding;
                adjustedHeight = rect.height - topPadding * 2;
            }
        }

        setMinimapRect({ top: adjustedTop, left, width: minimapWidthPx, height: adjustedHeight });
        setMinimapReady(true);
    }, [minimapWidthPx]);

    const convertDisplayToOriginalOffset = useCallback(
        (displayOffset) => {
            if (!displayCode || !viewCode) return displayOffset;

            const displayLines = displayCode.split("\n");
            let currentDisplayOffset = 0;

            for (let displayLineIndex = 0; displayLineIndex < displayLines.length; displayLineIndex++) {
                const displayLine = displayLines[displayLineIndex];
                const displayLineLength = displayLine.length;

                if (displayOffset <= currentDisplayOffset + displayLineLength) {
                    const offsetInDisplayLine = displayOffset - currentDisplayOffset;
                    const originalLineNumber = lineMapping.get(displayLineIndex + 1);

                    if (originalLineNumber) {
                        const originalLines = viewCode.split("\n");
                        let tempOffset = 0;
                        for (let i = 0; i < originalLineNumber - 1; i++) tempOffset += originalLines[i].length + 1;
                        return tempOffset + Math.min(offsetInDisplayLine, originalLines[originalLineNumber - 1]?.length || 0);
                    }
                }
                currentDisplayOffset += displayLineLength + 1;
            }
            return viewCode.length;
        },
        [displayCode, viewCode, lineMapping]
    );

    const convertOriginalToDisplayOffset = useCallback(
        (originalOffset, code = viewCode) => {
            if (!displayCode || !code) return originalOffset;
            if (foldedRegions.size === 0) return originalOffset;

            const originalLines = code.split("\n");
            const displayLines = displayCode.split("\n");
            let currentOriginalOffset = 0;
            let originalLineNumber = 1;

            for (let i = 0; i < originalLines.length; i++) {
                const lineLength = originalLines[i].length;
                if (originalOffset <= currentOriginalOffset + lineLength) {
                    originalLineNumber = i + 1;
                    break;
                }
                currentOriginalOffset += lineLength + 1;
            }

            let displayLineNumber = null;
            for (const [displayLine, origLine] of lineMapping.entries()) {
                if (origLine === originalLineNumber) {
                    displayLineNumber = displayLine;
                    break;
                }
            }

            if (!displayLineNumber) {
                let nearestVisible = 1;
                for (const [displayLine, origLine] of lineMapping.entries()) {
                    if (origLine > originalLineNumber) {
                        nearestVisible = displayLine;
                        break;
                    }
                    nearestVisible = displayLine;
                }
                let displayOffset = 0;
                for (let i = 0; i < nearestVisible - 1; i++) displayOffset += displayLines[i].length + 1;
                return displayOffset;
            }

            let displayOffset = 0;
            for (let i = 0; i < displayLineNumber - 1; i++) displayOffset += displayLines[i].length + 1;
            const offsetInOriginalLine = originalOffset - currentOriginalOffset;
            displayOffset += Math.min(offsetInOriginalLine, displayLines[displayLineNumber - 1].length);
            return displayOffset;
        },
        [displayCode, viewCode, lineMapping, foldedRegions]
    );

    function createEditOperation(operationFn) {
        return new Promise((resolve) => {
            isEditingRef.current = true;
            const textEl = textareaRef.current;
            if (!textEl) return resolve();

            pushUndoSnapshot();
            const scrollSnap = { top: textEl.scrollTop, left: textEl.scrollLeft };

            operationFn(textEl, scrollSnap, resolve);
            setTimeout(() => (isEditingRef.current = false), 10);
        });
    }

    function doUndo() {
        return new Promise((resolve) => {
            if (!undoStackRef.current.length) return resolve();
            const textEl = textareaRef.current;
            if (!textEl) return resolve();

            const currentSel = saveSelection(textEl);
            redoStackRef.current.push({ code: viewCode, sel: currentSel });
            const prev = undoStackRef.current.pop();
            const scrollSnap = { top: textEl.scrollTop, left: textEl.scrollLeft };

            const currLines = viewCode.split("\n").length;
            const prevLines = (prev.code || "").split("\n").length;
            const linesDelta = prevLines - currLines;

            applyLineEditAdjustments(1, Number.MAX_SAFE_INTEGER, linesDelta, prev.code, true);
            updateContentViaParent(prev.code, prev.sel, scrollSnap);
            resolve();
        });
    }

    function doRedo() {
        return new Promise((resolve) => {
            if (!redoStackRef.current.length) return resolve();
            const textEl = textareaRef.current;
            if (!textEl) return resolve();

            const currentSel = saveSelection(textEl);
            undoStackRef.current.push({ code: viewCode, sel: currentSel });
            const next = redoStackRef.current.pop();
            const scrollSnap = { top: textEl.scrollTop, left: textEl.scrollLeft };

            const currLines = viewCode.split("\n").length;
            const nextLines = (next.code || "").split("\n").length;
            const linesDelta = nextLines - currLines;

            applyLineEditAdjustments(1, Number.MAX_SAFE_INTEGER, linesDelta, next.code, true);
            updateContentViaParent(next.code, next.sel, scrollSnap);
            resolve();
        });
    }

    function doPaste(selStart, selEnd) {
        return createEditOperation(async (textEl, scrollSnap, resolve) => {
            const clipText = await navigator.clipboard.readText();
            const originalStart = convertDisplayToOriginalOffset(selStart);
            const originalEnd = convertDisplayToOriginalOffset(selEnd);
            const original = viewCode;
            const removed = original.slice(originalStart, originalEnd);

            let updated = original.slice(0, originalStart) + original.slice(originalEnd);
            updated = updated.slice(0, originalStart) + clipText + updated.slice(originalStart);

            const newCaretOriginal = originalStart + clipText.length;
            const newCaretDisplay = convertOriginalToDisplayOffset(newCaretOriginal, updated);

            const startLC = offsetToLineCol(original, originalStart);
            const endLC = offsetToLineCol(original, originalEnd);
            const editStartLine = Math.min(startLC.line, endLC.line) + 1;
            const editEndLine = Math.max(startLC.line, endLC.line) + 1;
            const linesDelta = countNewlines(clipText) - countNewlines(removed);
            const overlaps = editOverlapWithRegions(editStartLine, editEndLine);

            applyLineEditAdjustments(editStartLine, editEndLine, linesDelta, updated, overlaps);
            updateContentViaParent(updated, { start: newCaretDisplay, end: newCaretDisplay }, scrollSnap);
            resolve();
        });
    }

    function doCut(selStart, selEnd) {
        return createEditOperation(async (textEl, scrollSnap, resolve) => {
            if (selStart === selEnd) return resolve();

            const originalStart = convertDisplayToOriginalOffset(selStart);
            const originalEnd = convertDisplayToOriginalOffset(selEnd);
            const original = viewCode;
            const cutText = original.slice(originalStart, originalEnd);

            await navigator.clipboard.writeText(cutText);

            const updated = original.slice(0, originalStart) + original.slice(originalEnd);
            const newCaretDisplay = convertOriginalToDisplayOffset(originalStart, updated);

            const startLC = offsetToLineCol(original, originalStart);
            const endLC = offsetToLineCol(original, originalEnd);
            const editStartLine = Math.min(startLC.line, endLC.line) + 1;
            const editEndLine = Math.max(startLC.line, endLC.line) + 1;
            const linesDelta = -countNewlines(cutText);
            const overlaps = editOverlapWithRegions(editStartLine, editEndLine);

            applyLineEditAdjustments(editStartLine, editEndLine, linesDelta, updated, overlaps);
            updateContentViaParent(updated, { start: newCaretDisplay, end: newCaretDisplay }, scrollSnap);
            resolve();
        });
    }

    function doCopy(selStart, selEnd) {
        return new Promise(async (resolve) => {
            if (selStart === selEnd) return resolve();

            const originalStart = convertDisplayToOriginalOffset(selStart);
            const originalEnd = convertDisplayToOriginalOffset(selEnd);
            const selectedText = viewCode.slice(originalStart, originalEnd);

            await navigator.clipboard.writeText(selectedText);
            resolve();
        });
    }

    function doSelectAll() {
        return new Promise((resolve) => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                textareaRef.current.select();
            }
            resolve();
        });
    }

    function lineBoundsAt(text, offset) {
        const start = text.lastIndexOf("\n", offset - 1) + 1;
        const nl = text.indexOf("\n", offset);
        const end = nl === -1 ? text.length : nl;
        return { start, end };
    }

    function doAutoClose(openChar, closeChar) {
        return createEditOperation((textEl, scrollSnap, resolve) => {
            const selObj = saveSelection(textEl);
            if (!selObj) return resolve();

            const originalStart = convertDisplayToOriginalOffset(selObj.start);
            const text = viewCode;
            const nextChar = text[originalStart] || "";

            if (openChar === closeChar && (nextChar === closeChar || /[\w]/.test(text[originalStart - 1] || ""))) {
                const typed = text.slice(0, originalStart) + openChar + text.slice(originalStart);
                const at = convertOriginalToDisplayOffset(originalStart + 1, typed);
                updateContentViaParent(typed, { start: at, end: at }, scrollSnap);
                return resolve();
            }

            const newText = text.slice(0, originalStart) + openChar + closeChar + text.slice(originalStart);
            const caret = convertOriginalToDisplayOffset(originalStart + 1, newText);

            updateContentViaParent(newText, { start: caret, end: caret }, scrollSnap);
            resolve();
        });
    }

    function doSkipClosing(closeChar) {
        return createEditOperation((textEl, scrollSnap, resolve) => {
            const selObj = saveSelection(textEl);
            if (!selObj) return resolve();

            const at = convertOriginalToDisplayOffset(convertDisplayToOriginalOffset(selObj.start) + 1, viewCode);
            updateContentViaParent(viewCode, { start: at, end: at }, scrollSnap);
            resolve();
        });
    }

    function doToggleComment() {
        return createEditOperation((textEl, scrollSnap, resolve) => {
            const selObj = saveSelection(textEl);
            if (!selObj) return resolve();

            const syntax = getCommentSyntax(language);
            const marker = syntax.line;

            if (!marker) {
                return resolve();
            }

            const text = viewCode;
            const originalStart = convertDisplayToOriginalOffset(selObj.start);
            const originalEnd = convertDisplayToOriginalOffset(selObj.end);

            const first = lineBoundsAt(text, originalStart).start;
            const last = lineBoundsAt(text, originalEnd).end;

            const block = text.slice(first, last);
            const rows = block.split("\n");
            const meaningful = rows.filter((r) => r.trim() !== "");
            const allCommented = meaningful.length > 0
                && meaningful.every((r) => r.trim().startsWith(marker));

            const updated = rows.map((row) => {
                if (row.trim() === "") {
                    return row;
                }

                if (allCommented) {
                    return row.replace(new RegExp("^(\\s*)" + marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s?"), "$1");
                }

                const indent = row.match(/^\s*/)[0];
                return indent + marker + " " + row.slice(indent.length);
            }).join("\n");

            const newText = text.slice(0, first) + updated + text.slice(last);
            const delta = updated.length - block.length;

            const newStart = convertOriginalToDisplayOffset(originalStart, newText);
            const newEnd = convertOriginalToDisplayOffset(Math.max(originalStart, originalEnd + delta), newText);

            updateContentViaParent(newText, { start: newStart, end: newEnd }, scrollSnap);
            resolve();
        });
    }

    function doDuplicateLine() {
        return createEditOperation((textEl, scrollSnap, resolve) => {
            const selObj = saveSelection(textEl);
            if (!selObj) return resolve();

            const text = viewCode;
            const originalStart = convertDisplayToOriginalOffset(selObj.start);
            const bounds = lineBoundsAt(text, originalStart);
            const row = text.slice(bounds.start, bounds.end);

            const newText = text.slice(0, bounds.end) + "\n" + row + text.slice(bounds.end);
            const caret = convertOriginalToDisplayOffset(originalStart + row.length + 1, newText);

            updateContentViaParent(newText, { start: caret, end: caret }, scrollSnap);
            resolve();
        });
    }

    function doMoveLine(direction) {
        return createEditOperation((textEl, scrollSnap, resolve) => {
            const selObj = saveSelection(textEl);
            if (!selObj) return resolve();

            const text = viewCode;
            const originalStart = convertDisplayToOriginalOffset(selObj.start);
            const rows = text.split("\n");
            const { line } = offsetToLineCol(text, originalStart);
            const index = line;
            const target = index + direction;

            if (target < 0 || target >= rows.length) {
                return resolve();
            }

            const swapped = [...rows];
            const held = swapped[index];
            swapped[index] = swapped[target];
            swapped[target] = held;

            const newText = swapped.join("\n");
            const column = originalStart - lineColToOffset(text, line, 0);
            const caretOriginal = lineColToOffset(newText, target, 0) + column;
            const caret = convertOriginalToDisplayOffset(caretOriginal, newText);

            updateContentViaParent(newText, { start: caret, end: caret }, scrollSnap);
            resolve();
        });
    }

    function doWrapSelection(openChar, closeChar) {
        return createEditOperation((textEl, scrollSnap, resolve) => {
            const selObj = saveSelection(textEl);
            if (!selObj) return resolve();

            const { start, end } = selObj;
            if (start === end) return resolve();

            const originalStart = convertDisplayToOriginalOffset(start);
            const originalEnd = convertDisplayToOriginalOffset(end);
            const text = viewCode;
            const selected = text.slice(originalStart, originalEnd);

            const newText = text.slice(0, originalStart) + openChar + selected + closeChar + text.slice(originalEnd);

            const { line: startLine } = offsetToLineCol(text, originalStart);
            const { line: endLine } = offsetToLineCol(text, originalEnd);
            const overlaps = editOverlapWithRegions(startLine + 1, endLine + 1);

            applyLineEditAdjustments(startLine + 1, endLine + 1, 0, newText, overlaps);

            const newSelStart = convertOriginalToDisplayOffset(originalStart + openChar.length, newText);
            const newSelEnd = convertOriginalToDisplayOffset(originalEnd + openChar.length, newText);

            updateContentViaParent(newText, { start: newSelStart, end: newSelEnd }, scrollSnap);
            resolve();
        });
    }

    function doEnter() {
        return createEditOperation((textEl, scrollSnap, resolve) => {
            const selObj = saveSelection(textEl);
            if (!selObj) return resolve();

            const { start, end } = selObj;
            const originalStart = convertDisplayToOriginalOffset(start);
            const originalEnd = convertDisplayToOriginalOffset(end);
            const text = viewCode;
            const { line } = offsetToLineCol(text, originalStart);
            const lineStartOffset = lineColToOffset(text, line, 0);
            const lineFragment = text.slice(lineStartOffset, originalStart);
            const indentMatch = lineFragment.match(/^[ \t]+/);
            const indentation = indentMatch ? indentMatch[0] : "";
            const unit = indentation.includes("\t") ? "\t" : "  ";

            const beforeCaret = lineFragment;
            const afterCaret = text.slice(originalEnd, text.indexOf("\n", originalEnd) === -1 ? text.length : text.indexOf("\n", originalEnd));

            const opensBlock = shouldIndentAfter(beforeCaret, language);
            const closesNext = shouldDedentLine(afterCaret);

            let insertion;
            let caretPadding;

            if (opensBlock && closesNext) {
                insertion = "\n" + indentation + unit + "\n" + indentation;
                caretPadding = 1 + indentation.length + unit.length;
            } else if (opensBlock) {
                insertion = "\n" + indentation + unit;
                caretPadding = insertion.length;
            } else {
                insertion = "\n" + indentation;
                caretPadding = insertion.length;
            }

            const newText = text.slice(0, originalStart) + insertion + text.slice(originalEnd);
            const newPositionOriginal = originalStart + caretPadding;
            const newPositionDisplay = convertOriginalToDisplayOffset(newPositionOriginal, newText);

            const editStartLine = line + 1;
            const editEndLine = line + 1;
            const linesDelta = countNewlines(insertion) - countNewlines(text.slice(originalStart, originalEnd));
            const overlaps = editOverlapWithRegions(editStartLine, editEndLine);

            applyLineEditAdjustments(editStartLine, editEndLine, linesDelta, newText, overlaps);
            updateContentViaParent(newText, { start: newPositionDisplay, end: newPositionDisplay }, scrollSnap);
            resolve();
        });
    }

    function doBackspace() {
        return createEditOperation((textEl, scrollSnap, resolve) => {
            const selObj = saveSelection(textareaRef.current);
            if (!selObj) return resolve();

            let { start, end } = selObj;
            const originalStart = convertDisplayToOriginalOffset(start);
            const originalEnd = convertDisplayToOriginalOffset(end);
            const original = viewCode;

            if (originalStart !== originalEnd) {
                const removed = original.slice(originalStart, originalEnd);
                const updated = original.slice(0, originalStart) + original.slice(originalEnd);
                const newDisplayStart = convertOriginalToDisplayOffset(originalStart, updated);

                const startLC = offsetToLineCol(original, originalStart);
                const endLC = offsetToLineCol(original, originalEnd);
                const editStartLine = Math.min(startLC.line, endLC.line) + 1;
                const editEndLine = Math.max(startLC.line, endLC.line) + 1;
                const linesDelta = -countNewlines(removed);
                const overlaps = editOverlapWithRegions(editStartLine, editEndLine);

                applyLineEditAdjustments(editStartLine, editEndLine, linesDelta, updated, overlaps);
                updateContentViaParent(updated, { start: newDisplayStart, end: newDisplayStart }, scrollSnap);
            } else if (originalStart > 0) {
                const removedChar = original[originalStart - 1];
                const updated = original.slice(0, originalStart - 1) + original.slice(originalStart);
                const newCaretOriginal = originalStart - 1;
                const newCaretDisplay = convertOriginalToDisplayOffset(newCaretOriginal, updated);

                if (removedChar !== "\n") {
                    previousCodeRef.current = updated;
                    updateContentViaParent(updated, { start: newCaretDisplay, end: newCaretDisplay }, scrollSnap);
                } else {
                    const currLC = offsetToLineCol(original, originalStart);
                    const editLine = currLC.line + 1;
                    const overlaps = editOverlapWithRegions(editLine, editLine);

                    applyLineEditAdjustments(editLine, editLine, -1, updated, overlaps);
                    updateContentViaParent(updated, { start: newCaretDisplay, end: newCaretDisplay }, scrollSnap);
                }
            }
            resolve();
        });
    }

    function doDelete() {
        return createEditOperation((textEl, scrollSnap, resolve) => {
            const selObj = saveSelection(textEl);
            if (!selObj) return resolve();

            let { start, end } = selObj;
            const originalStart = convertDisplayToOriginalOffset(start);
            const originalEnd = convertDisplayToOriginalOffset(end);
            const original = viewCode;

            if (originalStart !== originalEnd) {
                const removed = original.slice(originalStart, originalEnd);
                const updated = original.slice(0, originalStart) + original.slice(originalEnd);
                const newCaretDisplay = convertOriginalToDisplayOffset(originalStart, updated);

                const startLC = offsetToLineCol(original, originalStart);
                const endLC = offsetToLineCol(original, originalEnd);
                const editStartLine = Math.min(startLC.line, endLC.line) + 1;
                const editEndLine = Math.max(startLC.line, endLC.line) + 1;
                const linesDelta = -countNewlines(removed);
                const overlaps = editOverlapWithRegions(editStartLine, editEndLine);

                applyLineEditAdjustments(editStartLine, editEndLine, linesDelta, updated, overlaps);
                updateContentViaParent(updated, { start: newCaretDisplay, end: newCaretDisplay }, scrollSnap);
            } else if (originalStart < original.length) {
                const removedChar = original[originalStart];
                const updated = original.slice(0, originalStart) + original.slice(originalStart + 1);
                const newCaretDisplay = convertOriginalToDisplayOffset(originalStart, updated);

                const currLC = offsetToLineCol(original, originalStart);
                const editLine = currLC.line + 1;
                const linesDelta = removedChar === "\n" ? -1 : 0;
                const overlaps = editOverlapWithRegions(editLine, editLine);

                applyLineEditAdjustments(editLine, editLine, linesDelta, updated, overlaps);
                updateContentViaParent(updated, { start: newCaretDisplay, end: newCaretDisplay }, scrollSnap);
            }
            resolve();
        });
    }

    function doTab(shiftKey) {
        return new Promise((resolve) => {
            const textEl = textareaRef.current;
            if (!textEl) return resolve();

            const selObj = saveSelection(textEl);
            if (!selObj) return resolve();

            pushUndoSnapshot();
            const scrollSnap = { top: textEl.scrollTop, left: textEl.scrollLeft };

            let { start, end } = selObj;
            if (start > end) [start, end] = [end, start];

            const originalStart = convertDisplayToOriginalOffset(start);
            const originalEnd = convertDisplayToOriginalOffset(end);
            const code = viewCode;

            if (originalStart === originalEnd) {
                if (!shiftKey) {
                    const updated = code.slice(0, originalStart) + "    " + code.slice(originalStart);
                    const newCaretOriginal = originalStart + 4;
                    const newCaretDisplay = convertOriginalToDisplayOffset(newCaretOriginal, updated);
                    previousCodeRef.current = updated;
                    updateContentViaParent(updated, { start: newCaretDisplay, end: newCaretDisplay }, scrollSnap);
                } else {
                    let backtrack = 0;
                    let idx = originalStart - 1;
                    while (backtrack < 4 && idx >= 0 && code[idx] === " ") {
                        idx--;
                        backtrack++;
                    }
                    if (backtrack > 0) {
                        const updated = code.slice(0, originalStart - backtrack) + code.slice(originalStart);
                        const newCaretOriginal = originalStart - backtrack;
                        const newCaretDisplay = convertOriginalToDisplayOffset(newCaretOriginal, updated);
                        previousCodeRef.current = updated;
                        updateContentViaParent(updated, { start: newCaretDisplay, end: newCaretDisplay }, scrollSnap);
                    }
                }
            } else {
                const startLC = offsetToLineCol(code, originalStart);
                const endLC = offsetToLineCol(code, originalEnd);
                const startLine = Math.min(startLC.line, endLC.line);
                const endLine = Math.max(startLC.line, endLC.line);
                const lines = code.split("\n");

                for (let i = startLine; i <= endLine; i++) {
                    if (!shiftKey) lines[i] = "    " + lines[i];
                    else if (lines[i].startsWith("    ")) lines[i] = lines[i].slice(4);
                    else if (lines[i].startsWith("\t")) lines[i] = lines[i].slice(1);
                }

                const updated = lines.join("\n");
                const shiftAmount = shiftKey ? -4 : 4;
                let newStartLC = { ...startLC };
                let newEndLC = { ...endLC };
                newStartLC.col = Math.max(0, newStartLC.col + shiftAmount);
                newEndLC.col = Math.max(0, newEndLC.col + shiftAmount);

                const newSelStartOriginal = lineColToOffset(updated, newStartLC.line, newStartLC.col);
                const newSelEndOriginal = lineColToOffset(updated, newEndLC.line, newEndLC.col);
                const newSelStartDisplay = convertOriginalToDisplayOffset(newSelStartOriginal, updated);
                const newSelEndDisplay = convertOriginalToDisplayOffset(newSelEndOriginal, updated);

                previousCodeRef.current = updated;
                updateContentViaParent(updated, { start: newSelStartDisplay, end: newSelEndDisplay }, scrollSnap);
            }
            resolve();
        });
    }

    function handleKeyDownInternal(e) {
        const selObj = saveSelection(textareaRef.current);
        if (!selObj) return handleKeyDown(e);

        let { start, end } = selObj;
        if (start > end) [start, end] = [end, start];

        const isCtrlOrCmd = e.ctrlKey || e.metaKey;
        const keyLower = e.key.toLowerCase();

        if (!keyBinds) return handleKeyDown(e);

        const keyActions = {
            [keyBinds.undo?.toLowerCase()]: () => doUndo(),
            [keyBinds.redo?.toLowerCase()]: () => doRedo(),
            [keyBinds.paste?.toLowerCase()]: () => doPaste(start, end),
            [keyBinds.cut?.toLowerCase()]: () => doCut(start, end),
            [keyBinds.copy?.toLowerCase()]: () => doCopy(start, end),
            [keyBinds.selectAll?.toLowerCase()]: () => doSelectAll(),
        };

        if (!isCtrlOrCmd && AUTO_CLOSE_PAIRS[e.key] && start !== end) {
            e.preventDefault();
            queueCommand(() => doWrapSelection(e.key, AUTO_CLOSE_PAIRS[e.key]));
            return;
        }

        if (!isCtrlOrCmd && AUTO_CLOSE_PAIRS[e.key] && start === end) {
            e.preventDefault();
            queueCommand(() => doAutoClose(e.key, AUTO_CLOSE_PAIRS[e.key]));
            return;
        }

        if (!isCtrlOrCmd && CLOSING_CHARS.has(e.key) && start === end) {
            const ahead = viewCode[convertDisplayToOriginalOffset(start)];

            if (ahead === e.key) {
                e.preventDefault();
                queueCommand(() => doSkipClosing(e.key));
                return;
            }
        }

        if (isCtrlOrCmd && e.key === "/") {
            e.preventDefault();
            queueCommand(() => doToggleComment());
            return;
        }

        if (e.altKey && e.shiftKey && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            queueCommand(() => doDuplicateLine());
            return;
        }

        if (e.altKey && !e.shiftKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
            e.preventDefault();
            queueCommand(() => doMoveLine(e.key === "ArrowUp" ? -1 : 1));
            return;
        }

        if (isCtrlOrCmd && e.key.toLowerCase() === "g") {
            e.preventDefault();
            setGoToLineOpen(true);
            return;
        }

        const specialKeys = {
            "Enter": () => doEnter(),
            "Backspace": () => doBackspace(),
            "Delete": () => doDelete(),
            "Tab": () => doTab(e.shiftKey),
        };

        if (isCtrlOrCmd && keyActions[keyLower]) {
            e.preventDefault();
            queueCommand(keyActions[keyLower]);
        } else if (specialKeys[e.key]) {
            e.preventDefault();
            queueCommand(specialKeys[e.key]);
        } else {
            handleKeyDown(e);
        }
    }

    const refreshCaretState = useCallback(() => {
        const textEl = textareaRef.current;

        if (!textEl) {
            return;
        }

        const value = textEl.value || "";
        const caret = textEl.selectionStart;
        const before = value.slice(0, caret);

        setCaretInfo({
            line: before.split("\n").length,
            column: caret - (before.lastIndexOf("\n") + 1) + 1,
            selected: Math.abs(textEl.selectionEnd - textEl.selectionStart)
        });

    }, []);

    const ensureCaretVisible = useCallback(() => {
        const textEl = textareaRef.current;
        const container = containerRef.current;

        if (!textEl || !container) {
            return;
        }

        const rowHeight = resolveLineHeight();
        const value = textEl.value || "";
        const caret = textEl.selectionStart;
        const before = value.slice(0, caret);
        const lineIndex = before.split("\n").length - 1;
        const column = caret - (before.lastIndexOf("\n") + 1);

        const caretTop = lineIndex * rowHeight;
        const caretBottom = caretTop + rowHeight;

        if (caretTop < container.scrollTop) {
            container.scrollTop = caretTop;
        } else if (caretBottom > container.scrollTop + container.clientHeight) {
            container.scrollTop = caretBottom - container.clientHeight;
        }

        const advance = fontSize * 0.6;
        const caretLeft = column * advance;
        const viewport = Math.max(0, container.clientWidth - gutterPx - minimapWidthPx);
        const margin = advance * 4;

        if (caretLeft - margin < container.scrollLeft) {
            container.scrollLeft = Math.max(0, caretLeft - margin);
        } else if (caretLeft + margin > container.scrollLeft + viewport) {
            container.scrollLeft = caretLeft + margin - viewport;
        }
    }, [resolveLineHeight, fontSize, gutterPx, minimapWidthPx]);

    const handleTextAreaChange = useCallback(
        (event) => {
            if (!isInternalOperationRef.current) {
                isEditingRef.current = true;

                const newDisplayValue = event.target.value || "";
                handleInput({ target: { value: newDisplayValue } });
                previousCodeRef.current = newDisplayValue;
                currentCodeVersionRef.current += 1;
                setCodeVersion(currentCodeVersionRef.current);

                if (batchUpdateTimer.current) {
                    clearTimeout(batchUpdateTimer.current);
                }

                batchUpdateTimer.current = setTimeout(() => {
                    isEditingRef.current = false;
                }, 50);

                ensureCaretVisible();
            }
        },
        [handleInput, ensureCaretVisible]
    );

    function handleContextMenu(e) {
        e.preventDefault();
        const menuWidth = 120;
        const menuHeight = 180;
        let x = e.clientX;
        let y = e.clientY;

        if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth;
        if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight;

        setContextMenuState({ visible: true, x, y });
    }

    const contextMenuBindLabel = (bind) => {
        if (!bind) return "";

        const modifier = navigator.platform.toUpperCase().includes("MAC") ? "\u2318" : "Ctrl+";

        return `${modifier}${String(bind).toUpperCase()}`;
    };

    function ensureVisible(lineNumber) {
        const textEl = textareaRef.current;
        let container = containerRef.current;

        if (container && container.scrollHeight <= container.clientHeight) {
            let node = textEl ? textEl.parentElement : null;

            while (node) {
                if (node.scrollHeight > node.clientHeight + 1) {
                    container = node;
                    break;
                }

                node = node.parentElement;
            }
        }

        if (!container) {
            return;
        }

        let displayLineNum = null;

        for (const [displayLine, originalLine] of lineMapping.entries()) {
            if (originalLine === lineNumber) {
                displayLineNum = displayLine;
                break;
            }
        }

        if (!displayLineNum) {
            displayLineNum = lineNumber;
        }

        const rowHeight = resolveLineHeight();
        const target = (displayLineNum - 1) * rowHeight;
        const centred = target - Math.max(0, container.clientHeight / 2 - rowHeight / 2);

        if (textEl) {
            const lines = (textEl.value || "").split("\n");
            let offset = 0;

            for (let i = 0; i < Math.min(displayLineNum - 1, lines.length); i++) {
                offset += lines[i].length + 1;
            }

            textEl.focus();
            textEl.setSelectionRange(offset, offset);
            refreshCaretState();
        }

        requestAnimationFrame(() => {
            container.scrollTop = Math.max(0, centred);
        });
    }

    function handleKeyUp() {
        refreshCaretState();
    }

    const contextMenuActions = {
        copy: () => {
            const sel = saveSelection(textareaRef.current);
            if (!sel) return;

            let { start, end } = sel;
            if (start > end) [start, end] = [end, start];

            if (start !== end) {
                const originalStart = convertDisplayToOriginalOffset(start);
                const originalEnd = convertDisplayToOriginalOffset(end);
                const selectedText = viewCode.slice(originalStart, originalEnd);
                navigator.clipboard.writeText(selectedText);
            } else {
                navigator.clipboard.writeText(viewCode);
            }
        },
        paste: () => {
            const selObj = saveSelection(textareaRef.current);
            if (!selObj) return;

            let { start, end } = selObj;
            if (start > end) [start, end] = [end, start];

            navigator.clipboard.readText().then((clipText) => {
                queueCommand(async () => {
                    pushUndoSnapshot();
                    const textEl = textareaRef.current;
                    if (!textEl) return;

                    const scrollSnap = { top: textEl.scrollTop, left: textEl.scrollLeft };
                    const originalStart = convertDisplayToOriginalOffset(start);
                    const originalEnd = convertDisplayToOriginalOffset(end);
                    const original = viewCode;
                    const removed = original.slice(originalStart, originalEnd);

                    let updated = original.slice(0, originalStart) + original.slice(originalEnd);
                    updated = updated.slice(0, originalStart) + clipText + updated.slice(originalStart);

                    const newCaretOriginal = originalStart + clipText.length;
                    const newCaretDisplay = convertOriginalToDisplayOffset(newCaretOriginal, updated);

                    const startLC = offsetToLineCol(original, originalStart);
                    const endLC = offsetToLineCol(original, originalEnd);
                    const editStartLine = Math.min(startLC.line, endLC.line) + 1;
                    const editEndLine = Math.max(startLC.line, endLC.line) + 1;
                    const linesDelta = countNewlines(clipText) - countNewlines(removed);
                    const overlaps = editOverlapWithRegions(editStartLine, editEndLine);

                    applyLineEditAdjustments(editStartLine, editEndLine, linesDelta, updated, overlaps);
                    updateContentViaParent(updated, { start: newCaretDisplay, end: newCaretDisplay }, scrollSnap);
                });
            });
        },
        cut: () => {
            const selObj = saveSelection(textareaRef.current);
            if (!selObj) return;

            let { start, end } = selObj;
            if (start !== end) queueCommand(() => doCut(start, end));
        },
        undo: () => queueCommand(() => doUndo()),
        redo: () => queueCommand(() => doRedo()),
    };

    useLayoutEffect(() => {
        measureGutter();
    }, [measureGutter]);

    useLayoutEffect(() => {
        const container = containerRef.current;

        if (!container) {
            return;
        }

        if (highlightRef.current) {
            highlightRef.current.scrollTop = container.scrollTop;
        }
    }, [displayCode]);

    useLayoutEffect(() => {
        if (textareaRef.current) {
            if (pendingScrollRef.current) {
                const { top, left } = pendingScrollRef.current;
                textareaRef.current.scrollTop = top;
                textareaRef.current.scrollLeft = left;
                pendingScrollRef.current = null;
            }
            if (lastSavedSelRef.current) {
                restoreSelection(textareaRef.current, lastSavedSelRef.current);
                lastSavedSelRef.current = null;
                ensureCaretVisible();
            }
        }
        if (isInternalOperationRef.current) isInternalOperationRef.current = false;
    }, [displayCode]);

    useEffect(() => {
        if (isFoldingRef.current) return;
        if (foldableRegions.length === 0 && foldedRegions.size > 0) setFoldedRegions(new Set());
    }, [foldableRegions, foldedRegions]);

    useEffect(() => {
        const hideContextMenu = () => setContextMenuState({ visible: false, x: 0, y: 0 });
        window.addEventListener("click", hideContextMenu);
        return () => window.removeEventListener("click", hideContextMenu);
    }, []);

    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;

        function handleCopyOrCut(e) {
            e.preventDefault();
            const sel = saveSelection(el);
            if (!sel) return;

            let { start, end } = sel;
            if (start > end) [start, end] = [end, start];

            const originalStart = convertDisplayToOriginalOffset(start);
            const originalEnd = convertDisplayToOriginalOffset(end);
            const selectedText = viewCode.slice(originalStart, originalEnd);

            if (selectedText.length > 0) {
                e.clipboardData.setData("text/plain", selectedText);
                if (e.type === "cut") queueCommand(() => doCut(start, end));
            }
        }

        el.addEventListener("copy", handleCopyOrCut);
        el.addEventListener("cut", handleCopyOrCut);

        return () => {
            el.removeEventListener("copy", handleCopyOrCut);
            el.removeEventListener("cut", handleCopyOrCut);
        };
    }, [viewCode, displayCode, convertDisplayToOriginalOffset]);

    useEffect(() => {
        const ro = new ResizeObserver(() => measureGutter());
        if (containerRef.current) ro.observe(containerRef.current);
        window.addEventListener("resize", measureGutter);

        return () => {
            ro.disconnect();
            window.removeEventListener("resize", measureGutter);
        };
    }, [measureGutter]);

    useEffect(() => {
        const host = document.createElement("div");
        host.className = "minimapPortalHost";
        document.body.appendChild(host);
        setMinimapHost(host);

        return () => {
            if (document.body.contains(host)) {
                document.body.removeChild(host);
            }
        };
    }, []);

    useEffect(() => {
        updateMinimapRect();
        const ro = new ResizeObserver(() => {
            updateMinimapRect();
            requestAnimationFrame(() => {
                syncMinimapViewport();
                syncMinimapContent();
            });
        });

        if (containerRef.current) ro.observe(containerRef.current);

        const onWin = () => {
            updateMinimapRect();
            requestAnimationFrame(() => {
                syncMinimapViewport();
                syncMinimapContent();
            });
        };

        window.addEventListener("resize", onWin, { passive: true });
        window.addEventListener("scroll", onWin, { passive: true });

        return () => {
            ro.disconnect();
            window.removeEventListener("resize", onWin);
            window.removeEventListener("scroll", onWin);
        };
    }, [updateMinimapRect, syncMinimapViewport, syncMinimapContent]);

    useEffect(() => {
        if (!minimapReady) return;
        renderMinimapContent();
    }, [minimapReady, renderMinimapContent]);

    useEffect(() => {
        const container = containerRef.current;
        if (container) {
            container.addEventListener("scroll", handleAnyScroll, { passive: true });
        }

        return () => {
            if (container) {
                container.removeEventListener("scroll", handleAnyScroll);
            }
        };
    }, [handleAnyScroll]);

    useEffect(() => {
        if (!highlightRef.current) return;

        if (highlightUpdateTimer.current) {
            clearTimeout(highlightUpdateTimer.current);
        }

        highlightUpdateTimer.current = setTimeout(() => {
            if (renderTimer.current) {
                cancelAnimationFrame(renderTimer.current);
            }

            renderTimer.current = requestAnimationFrame(() => {
                setIsUpdatingHighlight(true);

                const splitted = displayHighlightedCode.split(/\r\n|\r|\n/);
                const highlightLines = splitted.map((line) => (line.trim() === "" ? "\u200B" : line));
                let finalHTML = "";

                for (let i = 0; i < highlightLines.length; i++) {
                    if (highlightLines[i] === "\u200B") finalHTML += `<span class="hlLine">\u200B<br></span>`;
                    else finalHTML += `<span class="hlLine">${highlightLines[i]}\n</span>`;
                }

                if (highlightRef.current) {
                    highlightRef.current.innerHTML = finalHTML;
                }

                setIsUpdatingHighlight(false);
            });
        }, 0);

        return () => {
            if (highlightUpdateTimer.current) {
                clearTimeout(highlightUpdateTimer.current);
            }
            if (renderTimer.current) {
                cancelAnimationFrame(renderTimer.current);
            }
        };
    }, [displayHighlightedCode, codeVersion]);

    const lines = useMemo(
        () => displayHighlightedCode
            .split(/\r\n|\r|\n/)
            .map((l) => (l === "" ? "\u200B" : l)),
        [displayHighlightedCode]
    );

    const lintErrorLines = useMemo(
        () => new Set(lintErrors.map((e) => e.line)),
        [lintErrors]
    );

    useEffect(() => {
        const container = containerRef.current;
        const rowHeight = lineHeight || 20;
        const visible = container ? Math.ceil(container.clientHeight / rowHeight) : 60;

        setRenderWindow({ start: 0, end: visible + RENDER_BUFFER });
    }, [editorId, lineHeight]);

    const windowStart = Math.max(0, Math.min(renderWindow.start, Math.max(0, lines.length - 1)));
    const windowEnd = Math.min(lines.length, renderWindow.end);

    const lineElements = useMemo(() => {
        return lines.slice(windowStart, windowEnd).map((lineHtml, offset) => {
            const i = windowStart + offset;
            const displayLineNumber = i + 1;
            const originalLineNumber = lineMapping.get(displayLineNumber);
            const hasError = lintErrorLines.has(originalLineNumber);
            const canFold = originalLineNumber ? canFoldLine(originalLineNumber) : false;
            const isFolded = originalLineNumber ? isLineFolded(originalLineNumber) : false;
            const showFoldIndicator = !!(originalLineNumber && isFolded);
            const showErrorIndicator = !!hasError;
            const showBreakpoint = originalLineNumber ? hasBreakpoint(originalLineNumber) : false;

            return (
                <div
                    key={`line-${displayLineNumber}-${editorId}-${codeVersion}`}
                    data-line-number={displayLineNumber}
                    data-original-line={originalLineNumber}
                    className={`codeLine${hasError ? " errorHighlight" : ""}${isFolded ? " foldedLine" : ""}`}
                    style={{ fontSize: `${fontSize}px`, lineHeight: `${lineHeight}px` }}
                >
                    {isFolded && <div className="foldedGuide" style={{ height: `${lineHeight}px` }} />}
                    <div
                        className={`lineNumberMarginWrapper${showBreakpoint ? " hasBreakpoint" : ""}`}
                        onClick={() => originalLineNumber && toggleBreakpoint(originalLineNumber)}
                        style={{
                            cursor: originalLineNumber ? "pointer" : "default",
                            fontSize: `${fontSize}px`,
                            lineHeight: `${lineHeight}px`,
                            display: "flex",
                            alignItems: "center",
                            gap: `${Math.max(2, fontSize * 0.15)}px`,
                            paddingLeft: `${Math.max(2, fontSize * 0.1)}px`,
                            paddingRight: `${Math.max(2, fontSize * 0.1)}px`
                        }}
                    >
                        <span style={{
                            fontSize: `${fontSize}px`,
                            minWidth: `${Math.max(20, fontSize * 1.5)}px`,
                            textAlign: "right"
                        }}>
                            {originalLineNumber || displayLineNumber}
                        </span>
                        {canFold ? (
                            <span
                                className="foldChevron"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    originalLineNumber && toggleFold(originalLineNumber);
                                }}
                                aria-label={isFolded ? "Expand" : "Collapse"}
                                title={isFolded ? "Expand" : "Collapse"}
                                style={{ fontSize: `${Math.max(10, fontSize * 0.9)}px` }}
                            >
                                <FontAwesomeIcon
                                    icon={isFolded ? faChevronRight : faChevronDown}
                                    style={{ fontSize: `${Math.max(10, fontSize * 0.9)}px` }}
                                />
                            </span>
                        ) : (
                            <span className="chevronSpacer" style={{ fontSize: `${fontSize}px` }} />
                        )}
                        <span className="indicatorCluster" style={{ fontSize: `${Math.max(8, fontSize * 0.6)}px` }}>
                            {(showErrorIndicator && !showFoldIndicator) && <span title="Lint Error" aria-label="Lint Error" className="errorIndicatorDot" />}
                            {showFoldIndicator && <span title="Folded Block" aria-label="Folded Block" className="foldIndicatorDot" />}

                        </span>
                    </div>
                    <div
                        className="lineEditorWrapper"
                        dangerouslySetInnerHTML={{ __html: lineHtml + "\n" }}
                        style={{ paddingLeft: `${fontSize * 0.5}px` }}
                    />
                </div>
            );
        });
    }, [lines, windowStart, windowEnd, lineMapping, lintErrorLines, canFoldLine, isLineFolded, hasBreakpoint, fontSize, lineHeight, editorId, toggleBreakpoint, toggleFold, codeVersion, gutterPx]);

    useImperativeHandle(ref, () => ({
        selectAll() { doSelectAll(); },
        pasteAtCursor(text) {
            const selObj = saveSelection(textareaRef.current);
            if (!selObj) return;
            pushUndoSnapshot();
            queueCommand(async () => {
                const textEl = textareaRef.current;
                if (!textEl) return;
                const scrollSnap = { top: textEl.scrollTop, left: textEl.scrollLeft };
                let { start, end } = selObj;
                if (start > end) [start, end] = [end, start];
                const originalStart = convertDisplayToOriginalOffset(start);
                const originalEnd = convertDisplayToOriginalOffset(end);
                const original = viewCode;
                const removed = original.slice(originalStart, originalEnd);
                let updated = original.slice(0, originalStart) + original.slice(originalEnd);
                updated = updated.slice(0, originalStart) + text + updated.slice(originalStart);
                const newCaretOriginal = originalStart + text.length;
                const newCaretDisplay = convertOriginalToDisplayOffset(newCaretOriginal, updated);
                const startLC = offsetToLineCol(original, originalStart);
                const endLC = offsetToLineCol(original, originalEnd);
                const editStartLine = Math.min(startLC.line, endLC.line) + 1;
                const editEndLine = Math.max(startLC.line, endLC.line) + 1;
                const linesDelta = countNewlines(text) - countNewlines(removed);
                const overlaps = editOverlapWithRegions(editStartLine, editEndLine);
                applyLineEditAdjustments(editStartLine, editEndLine, linesDelta, updated, overlaps);
                updateContentViaParent(updated, { start: newCaretDisplay, end: newCaretDisplay }, scrollSnap);
            });
        },
        getCodeContent() { return viewCode; },
        jumpToLine(lineNum) { ensureVisible(lineNum); },
        ensureVisible(lineNum) { ensureVisible(lineNum); },
        doUndo,
        doRedo,
        pushUndoSnapshot,
        doPasteAtCursor() {
            const sel = saveSelection(textareaRef.current);
            if (!sel) return;
            queueCommand(() => doPaste(sel.start, sel.end));
        },
        doCutSelection() {
            const sel = saveSelection(textareaRef.current);
            if (!sel) return;
            let { start, end } = sel;
            if (start !== end) queueCommand(() => doCut(start, end));
        },
        doCopySelection() {
            const sel = saveSelection(textareaRef.current);
            if (!sel) return;
            let { start, end } = sel;
            if (start < end) queueCommand(() => doCopy(start, end));
        },
        doSelectAll,
        toggleFold,
        foldAll() {
            const allFoldableLines = foldableRegions.map((region) => region.startLine);
            setFoldedRegions(new Set(allFoldableLines));
            setCodeVersion(v => v + 1);
        },
        unfoldAll() {
            setFoldedRegions(new Set());
            setCodeVersion(v => v + 1);
        },
        toggleBreakpoint(lineNum) { toggleBreakpoint(lineNum); },
        addBreakpoint(lineNum) {
            setBreakpoints(prev => new Set([...prev, lineNum]));
        },
        removeBreakpoint(lineNum) {
            setBreakpoints(prev => {
                const newSet = new Set(prev);
                newSet.delete(lineNum);
                return newSet;
            });
        },
        clearAllBreakpoints() { setBreakpoints(new Set()); },
        getBreakpoints() { return Array.from(breakpoints); },
        hasBreakpoint(lineNum) { return breakpoints.has(lineNum); },
    }));

    return (
        <>
            <div
                ref={containerRef}
                onContextMenu={handleContextMenu}
                onScroll={handleAnyScroll}
                className="scriptEditorContainer"
                style={{ "--gutter": `${gutterPx}px`, "--minimapW": `${minimapWidthPx}px` }}
            >
                <div className="scriptEditorSubContainer">
                    {windowStart > 0 && (
                        <div style={{ height: `${windowStart * lineHeight}px`, flexShrink: 0 }} />
                    )}
                    {lineElements}
                    {windowEnd < lines.length && (
                        <div style={{ height: `${(lines.length - windowEnd) * lineHeight}px`, flexShrink: 0 }} />
                    )}
                    <pre
                        ref={highlightRef}
                        style={{
                            fontSize: `${fontSize}px`,
                            lineHeight: `${lineHeight}px`,
                            paddingLeft: `${fontSize * 0.5}px`,
                            opacity: isUpdatingHighlight ? 0.7 : 1,
                            transition: "opacity 0.1s ease"
                        }}
                    />
                    <textarea
                        ref={textareaRef}
                        value={displayCode || ""}
                        onChange={handleTextAreaChange}
                        onKeyDown={handleKeyDownInternal}
                        onKeyUp={handleKeyUp}
                        onSelect={refreshCaretState}
                        onMouseUp={refreshCaretState}
                        onFocus={refreshCaretState}
                        spellCheck={false}
                        autoCorrect="off"
                        autoCapitalize="off"
                        autoComplete="off"
                        data-gramm="false"
                        data-gramm_editor="false"
                        data-enable-grammarly="false"
                        wrap="off"
                        style={{
                            fontSize: `${fontSize}px`,
                            lineHeight: `${lineHeight}px`,
                            paddingLeft: `${fontSize * 0.5}px`
                        }}
                        disabled={disableFocus}
                    />
                </div>
                {goToLineOpen && (
                    <div className="codeGoToLine">
                        <div className="codeEditorSearchInputWrapper">
                            <div className="codeEditorLanguageFlexSupplement">
                                <input
                                    type="text"
                                    className="codeEditorSearchBox"
                                    autoFocus
                                    autoCorrect="off"
                                    autoCapitalize="off"
                                    spellCheck={false}
                                    value={goToLineValue}
                                    placeholder={`Line 1 to ${viewCode.split("\n").length}`}
                                    onChange={(event) => setGoToLineValue(event.target.value.replace(/[^0-9]/g, ""))}
                                    onKeyDown={(event) => {
                                        if (event.key === "Escape") {
                                            setGoToLineOpen(false);
                                            setGoToLineValue("");
                                        }

                                        if (event.key === "Enter") {
                                            const target = parseInt(goToLineValue, 10);

                                            if (target >= 1) {
                                                ensureVisible(Math.min(target, viewCode.split("\n").length));
                                            }

                                            setGoToLineOpen(false);
                                            setGoToLineValue("");
                                        }
                                    }}
                                    onBlur={() => {
                                        setGoToLineOpen(false);
                                        setGoToLineValue("");
                                    }}
                                />

                                <div className="codeEditorSearchOperationsButtonWrapperMini">
                                    <button
                                        type="button"
                                        className="codeEditorSearchOperationsButton"
                                        onMouseDown={(event) => {
                                            event.preventDefault();

                                            const target = parseInt(goToLineValue, 10);

                                            if (target >= 1) {
                                                ensureVisible(Math.min(target, viewCode.split("\n").length));
                                            }

                                            setGoToLineOpen(false);
                                            setGoToLineValue("");
                                        }}
                                    >
                                        Go
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {contextMenuState.visible && createPortal(
                    <div
                        ref={(node) => {
                            if (!node || typeof node.showPopover !== "function") return;

                            try {
                                if (!node.matches(":popover-open")) node.showPopover();
                            } catch { }
                        }}
                        popover="manual"
                        className="codeContextMenu"
                        style={{ position: "fixed", top: contextMenuState.y, left: contextMenuState.x }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {[
                            { label: "Cut", icon: faCut, bind: keyBinds?.cut, action: contextMenuActions.cut },
                            { label: "Copy", icon: faCopy, bind: keyBinds?.copy, action: contextMenuActions.copy },
                            { label: "Paste", icon: faPaste, bind: keyBinds?.paste, action: contextMenuActions.paste },
                            { separator: true },
                            { label: "Select All", icon: faArrowPointer, bind: keyBinds?.selectAll, action: () => doSelectAll() },
                            { separator: true },
                            { label: "Undo", icon: faUndo, bind: keyBinds?.undo, action: contextMenuActions.undo },
                            { label: "Redo", icon: faRedo, bind: keyBinds?.redo, action: contextMenuActions.redo },
                            { separator: true },
                            { label: "Go To Line", icon: faLocationCrosshairs, action: () => setGoToLineOpen(true) }
                        ].map((entry, index) => entry.separator ? (
                            <div key={`codeContextSeparator-${index}`} className="codeContextMenuSeparator" />
                        ) : (
                            <div
                                key={entry.label}
                                className="codeContextMenuItem"
                                onClick={() => {
                                    setContextMenuState({ visible: false, x: 0, y: 0 });
                                    entry.action();
                                }}
                            >
                                <span className="codeContextMenuItemLabel">
                                    <FontAwesomeIcon icon={entry.icon} />
                                    {entry.label}
                                </span>
                                {entry.bind && (
                                    <span className="codeContextMenuItemBind">{contextMenuBindLabel(entry.bind)}</span>
                                )}
                            </div>
                        ))}
                    </div>,
                    document.body
                )}
            </div>

            <div className="codeStatusBar">
                <span className="codeStatusItem">
                    Line {caretInfo.line}, Column {caretInfo.column}
                </span>
                {caretInfo.selected > 0 && (
                    <span className="codeStatusItem">
                        {caretInfo.selected} Selected
                    </span>
                )}
            </div>

            {minimapHost &&
                createPortal(
                    <div
                        className="minimapContainer"
                        ref={minimapWrapperRef}
                        style={{
                            position: "fixed",
                            top: `${minimapRect.top}px`,
                            left: `${minimapRect.left}px`,
                            width: `${minimapRect.width}px`,
                            height: `${minimapRect.height}px`,
                        }}
                        onMouseDown={(e) => { isMinimapDraggingRef.current = true; minimapDragToScroll(e); }}
                        onMouseMove={(e) => { if (isMinimapDraggingRef.current) minimapDragToScroll(e); }}
                        onMouseUp={() => { isMinimapDraggingRef.current = false; }}
                        onMouseLeave={() => { isMinimapDraggingRef.current = false; }}
                    >
                        <div className="minimapContent" ref={minimapContentRef} />
                        <div className="minimapViewport" ref={minimapViewportRef} />
                    </div>,
                    minimapHost
                )}
        </>
    );
});

export default Mirror;