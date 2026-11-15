import React, {
    useState,
    useEffect,
    useRef,
    forwardRef,
    useImperativeHandle,
    useMemo,
    useCallback,
    useDeferredValue,
} from "react";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import {
    faA, faArrowDown, faArrowUp, faCopy, faExclamationTriangle,
    faList, faMagnifyingGlass, faMagnifyingGlassPlus, faSquare, faTableColumns,
    faXmark, faCode, faXmarkSquare, faSquareCheck, faMinusSquare,
    faPlusSquare
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Mirror from "./Mirror.jsx";
import { syntaxHighlight, syntaxHighlightViewportOptimized, getVisibleLineRange, escapeRegExp } from "./Parser.jsx";
import useAuth from "../../../UseAuth.jsx";
import { lintPython } from "./Lint/LintPython.jsx";
import { lintTypeScript } from "./Lint/LintTypeScript.jsx";
import { lintJavaScript } from "./Lint/LintJavaScript.jsx";
import { lintBash } from "./Lint/LintBash.jsx";
import { lintShell } from "./Lint/LintShell.jsx";
import { lintC } from "./Lint/LintC.jsx";
import { lintCSharp } from "./Lint/LintCSharp.jsx";
import { lintCPP } from "./Lint/LintCPP.jsx";
import { lintSwift } from "./Lint/LintSwift.jsx";
import { lintSQL } from "./Lint/LintSQL.jsx";
import { lintMonkeyC } from "./Lint/LintMonkeyC.jsx";
import { lintRust } from "./Lint/LintRust.jsx";
import { lintJSON } from "./Lint/LintJSON.jsx";
import { lintCSS } from "./Lint/LintCSS.jsx";
import { lintHTML } from "./Lint/LintHTML.jsx";
import { lintXML } from "./Lint/LintXML.jsx";
import { lintDockerfile } from "./Lint/LintDockerfile.jsx";
import { lintMakefile } from "./Lint/LintMakefile.jsx";
import { lintMarkdown } from "./Lint/LintMarkdown.jsx";

const languageImageMap = {
    Bash: "bash.svg",
    C: "c.svg",
    "C#": "csharp.svg",
    "C++": "c++.svg",
    CSS: "css.svg",
    HTML: "html.svg",
    Javascript: "javascript.svg",
    JSON: "json.svg",
    Markdown: "markdown.svg",
    "Monkey C": "monkeyc.svg",
    Python: "python.svg",
    Rust: "rust.svg",
    Shell: "shell.svg",
    SQL: "sql.svg",
    Swift: "swift.svg",
    Typescript: "typescript.svg",
};

let editorIdCounter = 0;
const generateEditorId = () => {
    editorIdCounter += 1;
    return `code-editor-${editorIdCounter}`;
};

const SUPPORTED_LANGUAGES = [
    "bash", "c", "c#", "c++", "css",
    "dockerfile", "html", "javascript", "json", "makefile",
    "markdown", "monkey c", "python", "rust", "shell",
    "sql", "swift", "typescript", "xml"
];

const Markdown = forwardRef((props, ref) => {
    const {
        fileContent,
        detectedLanguage,
        forceOpen,
        onForceOpen,
        searchTerm,
        setSearchTerm,
        replaceTerm,
        setReplaceTerm,
        searchPositions,
        setSearchPositions,
        currentSearchIndex,
        setCurrentSearchIndex,
        onSplit,
        disableSplit,
        paneIndex,
        tabId,
        isSearchOpen,
        isReplaceOpen,
        setTabSearchOpen,
        setTabReplaceOpen,
        onEdit,
        onSave,
        fileHandle,
        isGlobalSearchActive,
        keyBinds,
        colorTheme,
        zoomLevel = 1.0,
    } = props;

    const { token, userID, organizationID } = useAuth();

    const scrollContainerRef = useRef(null);
    const searchInputRef = useRef(null);
    const debounceTimer = useRef(null);
    const lintDebounceTimer = useRef(null);
    const highlightDebounceTimer = useRef(null);
    const mirrorRef = useRef(null);
    const editorId = useRef(generateEditorId()).current;
    const isInitializedRef = useRef(false);
    const containerRef = useRef(null);
    const isResizingRef = useRef(false);
    const lastHighlightUpdateRef = useRef(0);
    const contentUpdateTimer = useRef(null);
    const searchUpdateTimer = useRef(null);
    const performanceTimer = useRef(null);
    const batchedUpdatesRef = useRef({
        content: null,
        search: null,
        lint: null
    });
    const contentVersionRef = useRef(0);

    const [editorContent, setEditorContent] = useState("");
    const editorContentRef = useRef("");
    const [currentLanguage, setCurrentLanguage] = useState(detectedLanguage || "Unknown");
    const [contentVersion, setContentVersion] = useState(0);

    const [copySuccess, setCopySuccess] = useState("");
    const [isCopied, setIsCopied] = useState(false);
    const [saveStatus, setSaveStatus] = useState("");

    const [isCaseSensitiveSearch, setIsCaseSensitiveSearch] = useState(true);
    const [isSearchOpenInternal, setIsSearchOpenInternal] = useState(isSearchOpen || false);
    const [isReplaceOpenInternal, setIsReplaceOpenInternal] = useState(isReplaceOpen || false);
    const [isSearchBoxFocused, setIsSearchBoxFocused] = useState(false);

    const [lineHeight, setLineHeight] = useState(24);
    const [fontSize, setFontSize] = useState(13);
    const [screenSize, setScreenSize] = useState(window.innerWidth);

    const [lintErrors, setLintErrors] = useState([]);
    const [mutedLines, setMutedLines] = useState([]);

    const [editorGrow, setEditorGrow] = useState(70);
    const [consoleGrow, setConsoleGrow] = useState(30);
    const [isConsoleOpen, setIsConsoleOpen] = useState(true);

    const highlightedCodeCache = useRef(new Map());
    const [isUpdating, setIsUpdating] = useState(false);

    const dividerHeight = 2;
    const minHeight = 50;

    const visibleLintErrors = useMemo(() => {
        return lintErrors.filter((error) => !mutedLines.includes(error.line));
    }, [lintErrors, mutedLines]);

    const [visibleRange, setVisibleRange] = useState({ startLine: 1, endLine: 50 });
    const [trimTrailingWhitespace, setTrimTrailingWhitespace] = useState(true);
    const scrollUpdateTimer = useRef(null);
    const editUpdateTimer = useRef(null);
    const isScrolling = useRef(false);
    const isEditing = useRef(false);
    const rapidEditCounter = useRef(0);

    const updateVisibleRange = useCallback((scrollContainer, isEditContext = false) => {
        if (scrollContainer && lineHeight) {
            const newRange = getVisibleLineRange(scrollContainer, lineHeight);

            let bufferedRange;
            if (isEditContext) {
                bufferedRange = {
                    startLine: Math.max(1, newRange.startLine - 3),
                    endLine: newRange.endLine + 3
                };
            } else {
                bufferedRange = {
                    startLine: Math.max(1, newRange.startLine - 30),
                    endLine: newRange.endLine + 30
                };
            }

            setVisibleRange((prev) =>
                prev.startLine === bufferedRange.startLine && prev.endLine === bufferedRange.endLine
                    ? prev
                    : bufferedRange
            );
        }
    }, [lineHeight]);

    const handleMirrorScroll = useCallback((scrollContainer) => {
        isScrolling.current = true;

        if (scrollUpdateTimer.current) {
            clearTimeout(scrollUpdateTimer.current);
        }

        updateVisibleRange(scrollContainer, false);

        scrollUpdateTimer.current = setTimeout(() => {
            isScrolling.current = false;
        }, 50);
    }, [updateVisibleRange]);

    const fastContentHash = useCallback((content) => {
        if (!content) return "0:0";

        const len = content.length;
        const step = len > 20000 ? Math.ceil(len / 20000) : 1;
        let hash = 0;

        for (let i = 0; i < len; i += step) {
            hash = ((hash << 5) - hash) + content.charCodeAt(i);
            hash = hash & hash;
        }

        if (step > 1) {
            for (let i = Math.max(0, len - 512); i < len; i++) {
                hash = ((hash << 5) - hash) + content.charCodeAt(i);
                hash = hash & hash;
            }
        }

        return `${len}:${hash}`;
    }, []);

    const clearHighlightCache = useCallback(() => {
        highlightedCodeCache.current.clear();
    }, []);

    const highlightedCode = useMemo(() => {
        if (currentLanguage === "Unknown") {
            return editorContent
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");
        }

        const contentHash = fastContentHash(editorContent + editorContent.length + contentVersion);
        const cacheKey = `${currentLanguage}-${searchTerm}-${isCaseSensitiveSearch}-${contentHash}-${contentVersion}`;

        if (highlightedCodeCache.current.has(cacheKey)) {
            return highlightedCodeCache.current.get(cacheKey);
        }

        const result = syntaxHighlight(
            editorContent,
            currentLanguage.toLowerCase(),
            searchTerm,
            isCaseSensitiveSearch
        );

        if (highlightedCodeCache.current.size >= 15) {
            const firstKey = highlightedCodeCache.current.keys().next().value;
            highlightedCodeCache.current.delete(firstKey);
        }

        highlightedCodeCache.current.set(cacheKey, result);

        return result;
    }, [editorContent, currentLanguage, searchTerm, isCaseSensitiveSearch, contentVersion, fastContentHash]);

    const deferredContent = useDeferredValue(editorContent);

    const fullHighlightedCode = useMemo(() => {
        if (currentLanguage === "Unknown") {
            return deferredContent
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");
        }

        return syntaxHighlight(
            deferredContent,
            currentLanguage.toLowerCase(),
            searchTerm,
            isCaseSensitiveSearch
        );
    }, [deferredContent, currentLanguage, searchTerm, isCaseSensitiveSearch]);

    const isLanguageSupported = useMemo(() => {
        const lang = currentLanguage.toLowerCase();
        return SUPPORTED_LANGUAGES.includes(lang);
    }, [currentLanguage]);

    const isSupported = currentLanguage !== "Unknown" || forceOpen;

    const zoomedFontSize = useMemo(() => {
        return Math.round(fontSize * zoomLevel);
    }, [fontSize, zoomLevel]);

    const zoomedLineHeight = useMemo(() => {
        return Math.round(lineHeight * zoomLevel);
    }, [lineHeight, zoomLevel]);

    const handleContentChange = useCallback((newContent) => {
        if (contentUpdateTimer.current) {
            clearTimeout(contentUpdateTimer.current);
        }

        const previousContent = editorContentRef.current;
        editorContentRef.current = newContent;

        setEditorContent(newContent);
        contentVersionRef.current += 1;
        setContentVersion(contentVersionRef.current);
        isEditing.current = true;
        rapidEditCounter.current++;
        clearHighlightCache();

        contentUpdateTimer.current = setTimeout(() => {
            isEditing.current = false;
            rapidEditCounter.current = Math.max(0, rapidEditCounter.current - 1);
        }, 150);

        batchedUpdatesRef.current.content = newContent;

        if (editUpdateTimer.current) {
            clearTimeout(editUpdateTimer.current);
        }

        editUpdateTimer.current = setTimeout(() => {
            if (batchedUpdatesRef.current.content) {
                onEdit(paneIndex, tabId, { fullCode: previousContent }, { fullCode: batchedUpdatesRef.current.content });
                batchedUpdatesRef.current.content = null;
            }
        }, 200);
    }, [paneIndex, tabId, onEdit, clearHighlightCache]);

    const handleInput = useCallback((event) => {
        const newValue = event.target.value || "";
        handleContentChange(newValue);
    }, [handleContentChange]);

    const performSearch = useCallback(() => {
        if (!searchTerm) {
            setSearchPositions([]);
            setCurrentSearchIndex(-1);
            return;
        }

        if (searchUpdateTimer.current) {
            clearTimeout(searchUpdateTimer.current);
        }

        searchUpdateTimer.current = setTimeout(() => {
            const flags = isCaseSensitiveSearch ? "" : "i";
            const safeTerm = escapeRegExp(searchTerm);

            try {
                const re = new RegExp(safeTerm, flags);
                const lines = editorContent.split("\n");
                const matches = [];
                for (let i = 0; i < lines.length; i++) {
                    if (re.test(lines[i])) {
                        matches.push({ lineNumber: i + 1 });
                    }
                }
                setSearchPositions(matches);
                setCurrentSearchIndex(matches.length > 0 ? 0 : -1);
            } catch {
                setSearchPositions([]);
                setCurrentSearchIndex(-1);
            }
        }, 100);
    }, [searchTerm, isCaseSensitiveSearch, editorContent]);

    const performNextSearch = () => {
        if (searchPositions.length === 0) return;
        let newIndex = currentSearchIndex + 1;
        if (newIndex >= searchPositions.length) {
            newIndex = 0;
        }
        setCurrentSearchIndex(newIndex);
    };

    const performPreviousSearch = () => {
        if (searchPositions.length === 0) return;
        let newIndex = currentSearchIndex - 1;
        if (newIndex < 0) {
            newIndex = searchPositions.length - 1;
        }
        setCurrentSearchIndex(newIndex);
    };

    const performReplace = () => {
        if (currentSearchIndex === -1 || searchPositions.length === 0) return;

        mirrorRef.current?.pushUndoSnapshot?.();

        const currentMatch = searchPositions[currentSearchIndex];
        const lineNumber = currentMatch.lineNumber;
        const lines = editorContent.split("\n");
        const lineIndex = lineNumber - 1;

        const regexFlags = isCaseSensitiveSearch ? "" : "i";
        const regex = new RegExp(escapeRegExp(searchTerm), regexFlags);

        lines[lineIndex] = lines[lineIndex].replace(regex, replaceTerm ?? "");
        const updatedCode = lines.join("\n");

        handleContentChange(updatedCode);

        const newPositions = [...searchPositions];
        newPositions.splice(currentSearchIndex, 1);

        let newIdx = currentSearchIndex;
        if (newIdx >= newPositions.length) {
            newIdx = newPositions.length - 1;
        }
        setSearchPositions(newPositions);
        setCurrentSearchIndex(newIdx);
    };

    const performReplaceAll = () => {
        if (searchPositions.length === 0) return;

        mirrorRef.current?.pushUndoSnapshot?.();

        const flags = isCaseSensitiveSearch ? "g" : "gi";
        const regex = new RegExp(escapeRegExp(searchTerm), flags);
        const updatedCode = editorContent.replace(regex, replaceTerm ?? "");

        handleContentChange(updatedCode);
        setSearchPositions([]);
        setCurrentSearchIndex(-1);
    };

    const openSearch = () => {
        setIsSearchOpenInternal(true);
        setTabSearchOpen(true);
        setIsReplaceOpenInternal(false);
        setTabReplaceOpen(false);

        if (searchInputRef.current) {
            setTimeout(() => searchInputRef.current.focus(), 0);
        }
    };

    const closeSearch = () => {
        setIsSearchOpenInternal(false);
        setTabSearchOpen(false);
        setIsReplaceOpenInternal(false);
        setTabReplaceOpen(false);
        setSearchTerm("");
        setReplaceTerm("");
        setSearchPositions([]);
        setCurrentSearchIndex(-1);
        setIsSearchBoxFocused(false);
        setTimeout(() => {
            mirrorRef.current?.focusEditor();
        }, 0);
    };

    const openReplace = () => {
        setIsReplaceOpenInternal(true);
        setTabReplaceOpen(true);
        setIsSearchOpenInternal(false);
        setTabSearchOpen(false);
    };

    const fallbackCopyToClipboard = (text) => {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.position = "fixed";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        let success = false;
        try {
            success = document.execCommand("copy");
        } catch (error) {}
        document.body.removeChild(textArea);
        return success;
    };

    const copyToClipboard = async () => {
        const text = editorContent;
        let success = false;
        try {
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(text);
                success = true;
            } else {
                success = fallbackCopyToClipboard(text);
            }
        } catch (error) {
        } finally {
            if (success) {
                setCopySuccess("Copied to Clipboard!");
                setIsCopied(true);
            } else {
                setCopySuccess("Failed to Copy!");
            }
            setTimeout(() => {
                setCopySuccess("");
                setIsCopied(false);
            }, 2000);
        }
    };

    const saveFile = async () => {
        if (!fileHandle) {
            setSaveStatus("No File Handle Available.");
            setTimeout(() => setSaveStatus(""), 3000);
            return;
        }
        try {
            setSaveStatus("Saving...");

            const cleaned = trimTrailingWhitespace
                ? editorContent.split("\n").map((line) => line.replace(/[ \t]+$/, "")).join("\n")
                : editorContent;

            if (cleaned !== editorContent) {
                editorContentRef.current = cleaned;
                setEditorContent(cleaned);
                contentVersionRef.current += 1;
                setContentVersion(contentVersionRef.current);
            }

            const writable = await fileHandle.createWritable();
            await writable.write(cleaned);
            await writable.close();

            await fetch(`${import.meta.env.VITE_API_AUTH_URL}/save-file-edit`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    organizationID,
                    userID,
                    language: currentLanguage,
                    script_name: fileHandle.name || "unknown_script_name",
                    timestamp: new Date().toISOString(),
                }),
            });

            if (onSave) {
                onSave(paneIndex, tabId, editorContent);
            }
            setSaveStatus("Save Successful!");
            setTimeout(() => setSaveStatus(""), 3000);
        } catch {
            setSaveStatus("Save Failed!");
            setTimeout(() => setSaveStatus(""), 3000);
        }
    };

    const handleKeyDown = (event) => {
        const isMac = navigator.platform.toUpperCase().includes("MAC");
        const modifier = isMac ? event.metaKey : event.ctrlKey;
        if (modifier && keyBinds) {
            const key = event.key.toLowerCase();
            if (key === keyBinds.save?.toLowerCase()) {
                event.preventDefault();
                saveFile();
            } else if (key === keyBinds.search?.toLowerCase()) {
                event.preventDefault();
                openSearch();
            }
        }
    };

    const clickEnterSearch = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            performNextSearch();
        }
    };

    const applyResize = (clientY) => {
        if (!isResizingRef.current || !containerRef.current) {
            return;
        }

        const containerRect = containerRef.current.getBoundingClientRect();
        const effectiveTotal = containerRect.height - dividerHeight;

        if (effectiveTotal <= 0) {
            return;
        }

        let newEditorHeight = clientY - containerRect.top;

        if (newEditorHeight < minHeight) {
            newEditorHeight = minHeight;
        }

        if (newEditorHeight > effectiveTotal - minHeight) {
            newEditorHeight = effectiveTotal - minHeight;
        }

        const newGrow = (newEditorHeight / effectiveTotal) * 100;

        setEditorGrow(newGrow);
        setConsoleGrow(100 - newGrow);
    };

    const resizeHandlersRef = useRef(null);

    const stopResize = () => {
        isResizingRef.current = false;
        document.body.style.userSelect = "";
        document.body.style.cursor = "";

        const handlers = resizeHandlersRef.current;

        if (handlers) {
            document.removeEventListener("mousemove", handlers.move);
            document.removeEventListener("mouseup", handlers.up);
            document.removeEventListener("touchmove", handlers.touchMove);
            document.removeEventListener("touchend", handlers.up);
            resizeHandlersRef.current = null;
        }
    };

    const beginResize = () => {
        stopResize();

        isResizingRef.current = true;
        setIsConsoleOpen(true);
        document.body.style.userSelect = "none";
        document.body.style.cursor = "row-resize";

        const handlers = {
            move: (event) => applyResize(event.clientY),
            touchMove: (event) => {
                event.preventDefault();
                applyResize(event.touches[0].clientY);
            },
            up: () => stopResize()
        };

        resizeHandlersRef.current = handlers;

        document.addEventListener("mousemove", handlers.move);
        document.addEventListener("mouseup", handlers.up);
        document.addEventListener("touchmove", handlers.touchMove, { passive: false });
        document.addEventListener("touchend", handlers.up);
    };

    const handleMouseDown = (e) => {
        e.preventDefault();
        beginResize();
    };

    const handleTouchStart = (e) => {
        e.preventDefault();
        beginResize();
    };

    useEffect(() => stopResize, []);

    const getVirtualizedItemHeight = (size) => {
        if (size < 499) {
            return { lineHeight: 18, fontSize: 12 };
        } else if (size >= 500 && size <= 699) {
            return { lineHeight: 20, fontSize: 12 };
        } else if (size >= 700 && size <= 1299) {
            return { lineHeight: 24, fontSize: 13 };
        } else if (size >= 1300 && size <= 1699) {
            return { lineHeight: 28, fontSize: 15 };
        } else if (size >= 1700 && size <= 2199) {
            return { lineHeight: 35, fontSize: 18 };
        } else if (size >= 2200 && size <= 2599) {
            return { lineHeight: 45, fontSize: 22 };
        } else if (size >= 2600 && size <= 3899) {
            return { lineHeight: 70, fontSize: 30 };
        } else if (size >= 3900 && size <= 5299) {
            return { lineHeight: 80, fontSize: 35 };
        } else {
            return { lineHeight: 18, fontSize: 12 };
        }
    };

    const getLintErrors = (lang, content) => {
        const language = lang.toLowerCase();
        const linters = {
            bash: lintBash,
            c: lintC,
            "c#": lintCSharp,
            "c++": lintCPP,
            css: lintCSS,
            dockerfile: lintDockerfile,
            html: lintHTML,
            json: lintJSON,
            makefile: lintMakefile,
            markdown: lintMarkdown,
            "monkey c": lintMonkeyC,
            python: lintPython,
            rust: lintRust,
            shell: lintShell,
            sql: lintSQL,
            swift: lintSwift,
            typescript: lintTypeScript,
            xml: lintXML,
        };

        if (language === "javascript") {
            return lintJavaScript(content);
        }

        const linter = linters[language];
        return linter ? linter(content) : [];
    };

    useEffect(() => {
        if (fileContent !== undefined && fileContent !== null) {
            const safeContent = String(fileContent || "");
            if (!isInitializedRef.current || safeContent !== editorContent) {
                editorContentRef.current = safeContent;
                setEditorContent(safeContent);
                contentVersionRef.current += 1;
                setContentVersion(contentVersionRef.current);
                setSearchPositions([]);
                setCurrentSearchIndex(-1);
                isInitializedRef.current = true;
                setVisibleRange({ startLine: 1, endLine: 50 });
                clearHighlightCache();
            }
        } else if (!isInitializedRef.current) {
            editorContentRef.current = "";
            setEditorContent("");
            contentVersionRef.current += 1;
            setContentVersion(contentVersionRef.current);
            isInitializedRef.current = true;
            setVisibleRange({ startLine: 1, endLine: 50 });
            clearHighlightCache();
        }
    }, [fileContent, forceOpen, clearHighlightCache]);

    useEffect(() => {
        const handleResize = () => setScreenSize(window.innerWidth);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        const { lineHeight, fontSize } = getVirtualizedItemHeight(screenSize);
        setLineHeight(lineHeight);
        setFontSize(fontSize);
    }, [screenSize]);

    useEffect(() => {
        const themeLinkId = "mirror-theme-css";
        let link = document.getElementById(themeLinkId);
        if (!link) {
            link = document.createElement("link");
            link.id = themeLinkId;
            link.rel = "stylesheet";
            document.head.appendChild(link);
        }
        let themeFile;
        if (colorTheme === "DarkTheme") {
            themeFile = "DarkTheme.css";
        } else if (colorTheme === "LightTheme") {
            themeFile = "LightTheme.css";
        } else {
            themeFile = "DefaultTheme.css";
        }
        link.href = `../styles/mainStyles/MirrorThemes/${themeFile}`;
    }, [colorTheme]);

    useEffect(() => {
        if (lintDebounceTimer.current) {
            clearTimeout(lintDebounceTimer.current);
        }

        const debounceTime = rapidEditCounter.current > 2 ? 1500 : 800;

        lintDebounceTimer.current = setTimeout(() => {
            setIsUpdating(true);
            const errors = getLintErrors(currentLanguage, editorContent);
            setLintErrors(errors);
            setIsUpdating(false);
        }, debounceTime);

        return () => {
            if (lintDebounceTimer.current) {
                clearTimeout(lintDebounceTimer.current);
            }
        };
    }, [editorContent, currentLanguage]);

    useEffect(() => {
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }
        debounceTimer.current = setTimeout(() => {
            performSearch();
        }, 200);

        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }
        };
    }, [editorContent, searchTerm, isCaseSensitiveSearch, performSearch]);

    useEffect(() => {
        if (
            isSearchBoxFocused &&
            currentSearchIndex >= 0 &&
            currentSearchIndex < searchPositions.length
        ) {
            const match = searchPositions[currentSearchIndex];
            mirrorRef.current?.jumpToLine(match.lineNumber);
        }
    }, [currentSearchIndex, searchPositions, isSearchBoxFocused]);

    useEffect(() => {
        setIsSearchOpenInternal(isSearchOpen);
    }, [isSearchOpen]);

    useEffect(() => {
        setIsReplaceOpenInternal(isReplaceOpen);
    }, [isReplaceOpen]);

    useImperativeHandle(ref, () => ({
        setContent: (newContent) => {
            const safeContent = String(newContent || "");
            editorContentRef.current = safeContent;
            setEditorContent(safeContent);
            contentVersionRef.current += 1;
            setContentVersion(contentVersionRef.current);
            setSearchPositions([]);
            setCurrentSearchIndex(-1);
            clearHighlightCache();
            handleContentChange(safeContent);
        },
        jumpToLine: (lineNumber) => {
            mirrorRef.current?.jumpToLine?.(lineNumber);
        },
        selectAll: () => {
            mirrorRef.current?.selectAll?.();
        },
        pasteAtCursor: (text) => {
            mirrorRef.current?.pasteAtCursor?.(text);
        },
    }));

    if (!isInitializedRef.current) {
        return (
            <div className="codeEditorContainer">
                  <div className="loading-wrapper">
                            <div className="loading-circle" />
                            <label className="loading-title">D</label>
                    </div>
            </div>
        );
    }

    const isSearchVisible = (isSearchOpenInternal || isReplaceOpenInternal) && !isGlobalSearchActive;
    const searchOperationsOpacity = isGlobalSearchActive ? 0.6 : 1.0;
    const searchOperationsCursor = isGlobalSearchActive ? "not-allowed" : "pointer";

    const zoomedTerminalStyle = {
        fontSize: `${Math.round(12 * zoomLevel)}px`,
        lineHeight: `${Math.round(18 * zoomLevel)}px`,
    };

    return (
        <div className="codeEditorContainer" style={{padding: isSupported ? "" : 0}}>
            <div className="codeEditorLanguageIndicator">
                <div className="codeEditorLanguageFlex">

                    {(!isSearchVisible && !isReplaceOpen) && (
                    <label className="codeEditorLanguageText">
                        {languageImageMap[currentLanguage] ? (
                            <img
                                src={`/language-images/${languageImageMap[currentLanguage]}`}
                                alt={`${currentLanguage} icon`}
                                className="language-icon"
                            />
                        ) : (
                            <FontAwesomeIcon icon={faCode} className="language-icon" />
                        )}
                        <strong>{currentLanguage}</strong>
                    </label>
                    )}

                    {(isSearchVisible) && (
                        <div className="codeEditorSearchInputWrapper">
                            {isSearchVisible && (
                                <div className="codeEditorLanguageFlexSupplement">
                                    <input
                                        type="text"
                                        placeholder="Search..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        onKeyDown={clickEnterSearch}
                                        ref={searchInputRef}
                                        className="codeEditorSearchBox"
                                        onFocus={() => setIsSearchBoxFocused(true)}
                                        onBlur={() => setIsSearchBoxFocused(false)}
                                    />

                                    <div className="codeEditorSearchOperationsButtonWrapperMini">
                                        <Tippy content="Case Sensitive" theme="tooltip-light">
                                            <button
                                                type="button"
                                                className="codeEditorSearchOperationsButton"
                                                onClick={() => setIsCaseSensitiveSearch(!isCaseSensitiveSearch)}
                                                onMouseDown={(e) => e.preventDefault()}
                                            >
                                                <FontAwesomeIcon
                                                    icon={faA}
                                                    style={{ color: isCaseSensitiveSearch ? "#4ecdc4" : "" }}
                                                />
                                            </button>
                                        </Tippy>

                                        <Tippy content="Next" theme="tooltip-light">
                                            <button
                                                type="button"
                                                className="codeEditorSearchOperationsButton"
                                                onClick={performNextSearch}
                                                onMouseDown={(e) => e.preventDefault()}
                                            >
                                                <FontAwesomeIcon icon={faArrowDown} />
                                            </button>
                                        </Tippy>

                                        <Tippy content="Previous" theme="tooltip-light">
                                            <button
                                                type="button"
                                                className="codeEditorSearchOperationsButton"
                                                onClick={performPreviousSearch}
                                                onMouseDown={(e) => e.preventDefault()}
                                            >
                                                <FontAwesomeIcon icon={faArrowUp} />
                                            </button>
                                        </Tippy>
                                    </div>
                                </div>
                            )}

                            {isReplaceOpenInternal && !isGlobalSearchActive && (
                                <div className="codeEditorLanguageFlexSupplement">
                                    <input
                                        type="text"
                                        placeholder="Replace..."
                                        value={replaceTerm}
                                        onChange={(e) => setReplaceTerm(e.target.value)}
                                        className="codeEditorSearchBox"
                                        onFocus={() => setIsSearchBoxFocused(true)}
                                        onBlur={() => setIsSearchBoxFocused(false)}
                                    />

                                    <div className="codeEditorSearchOperationsButtonWrapperMini">
                                        <Tippy content="Replace Selection" theme="tooltip-light">
                                            <button
                                                type="button"
                                                className="codeEditorSearchOperationsButton"
                                                onClick={performReplace}
                                                onMouseDown={(e) => e.preventDefault()}
                                            >
                                                <FontAwesomeIcon icon={faSquare} />
                                            </button>
                                        </Tippy>

                                        <Tippy content="Replace All Occurrences" theme="tooltip-light">
                                            <button
                                                type="button"
                                                className="codeEditorSearchOperationsButton"
                                                onClick={performReplaceAll}
                                                onMouseDown={(e) => e.preventDefault()}
                                            >
                                                <FontAwesomeIcon icon={faList} />
                                            </button>
                                        </Tippy>
                                    </div>
                                </div>
                            )}

                            {searchPositions.length > 0 && currentSearchIndex >= 0 && (
                                <span className="codeEditorSearchMatchIndicator">
                                    {currentSearchIndex + 1} of {searchPositions.length} Results Found
                                </span>
                            )}
                            {searchPositions.length === 0 && (
                                <span className="codeEditorSearchMatchIndicator">No Matches Found</span>
                            )}

                        </div>
                    )}

                    <div className="codeEditorSearchButtonFlex">
                        {isSearchOpenInternal && !isGlobalSearchActive ? (
                            <Tippy content="Close" theme="tooltip-light">
                                <button
                                    type="button"
                                    className="codeEditorSearchButton"
                                    onClick={closeSearch}
                                    onMouseDown={(e) => e.preventDefault()}
                                >
                                    <FontAwesomeIcon icon={faXmark} />
                                </button>
                            </Tippy>
                        ) : (
                            <Tippy content="Search" theme="tooltip-light">
                                <button
                                    type="button"
                                    className="codeEditorSearchButton"
                                    onClick={() => {
                                        if (!isGlobalSearchActive) {
                                            openSearch();
                                        }
                                    }}
                                    style={{
                                        opacity: searchOperationsOpacity,
                                        cursor: searchOperationsCursor,
                                    }}
                                    onMouseDown={(e) => e.preventDefault()}
                                >
                                    <FontAwesomeIcon icon={faMagnifyingGlass} />
                                </button>
                            </Tippy>
                        )}

                        {isReplaceOpenInternal && !isGlobalSearchActive ? (
                            <Tippy content="Close" theme="tooltip-light">
                                <button
                                    type="button"
                                    className="codeEditorSearchButton"
                                    onClick={closeSearch}
                                    onMouseDown={(e) => e.preventDefault()}
                                >
                                    <FontAwesomeIcon icon={faXmark} />
                                </button>
                            </Tippy>
                        ) : (
                            <Tippy content="Search & Replace" theme="tooltip-light">
                                <button
                                    type="button"
                                    className="codeEditorSearchButton"
                                    onClick={() => {
                                        if (!isGlobalSearchActive) {
                                            openReplace();
                                        }
                                    }}
                                    style={{
                                        opacity: searchOperationsOpacity,
                                        cursor: searchOperationsCursor,
                                    }}
                                    onMouseDown={(e) => e.preventDefault()}
                                >
                                    <FontAwesomeIcon icon={faMagnifyingGlassPlus} />
                                </button>
                            </Tippy>
                        )}

                        <Tippy content={copySuccess || "Copy to Clipboard"} theme="tooltip-light">
                            <button
                                type="button"
                                className="codeEditorSearchButton"
                                onClick={copyToClipboard}
                                onMouseDown={(e) => e.preventDefault()}
                                disabled={isCopied}
                                style={{
                                    opacity: searchOperationsOpacity,
                                    cursor: searchOperationsCursor,
                                }}
                            >
                                <FontAwesomeIcon icon={isCopied ? faSquareCheck : faCopy} />
                            </button>
                        </Tippy>

                        <Tippy content="Split Tabs" theme="tooltip-light">
                            <button
                                type="button"
                                className="codeEditorSearchButton"
                                onClick={onSplit}
                                disabled={disableSplit || isGlobalSearchActive}
                                style={{
                                    cursor: disableSplit || isGlobalSearchActive ? "not-allowed" : "pointer",
                                    opacity: disableSplit || isGlobalSearchActive ? 0.5 : 1,
                                }}
                                onMouseDown={(e) => e.preventDefault()}
                            >
                                <FontAwesomeIcon icon={faTableColumns} />
                            </button>
                        </Tippy>

                    </div>
                </div>
            </div>

            {isSupported ? (
                <div className="codeEditorSpace" ref={containerRef}>
                    <div
                        className={isConsoleOpen ? "codeContentWrapper" : "codeContentWrapper expanded"}
                        ref={scrollContainerRef}
                        style={{ flexGrow: editorGrow }}
                    >
                        <Mirror
                            key="main-editor"
                            ref={mirrorRef}
                            viewCode={editorContent}
                            setViewCode={() => {}}
                            handleInput={handleInput}
                            handleKeyDown={handleKeyDown}
                            highlightedCode={highlightedCode}
                            fullHighlightedCode={fullHighlightedCode}
                            language={currentLanguage}
                            fontSize={zoomedFontSize}
                            lineHeight={zoomedLineHeight}
                            editorId={editorId}
                            disableFocus={isSearchBoxFocused}
                            keyBinds={keyBinds}
                            lintErrors={visibleLintErrors}
                            handleScroll={handleMirrorScroll}
                        />
                    </div>

                    <div
                        className="draggableConsoleDivider"
                        style={{ flexBasis: dividerHeight, display: isConsoleOpen ? "" : "none" }}
                        onMouseDown={handleMouseDown}
                        onTouchStart={handleTouchStart}
                    />

                    <div
                        className={isConsoleOpen ? "codeConsoleWrapper" : "codeConsoleWrapper collapsed"}
                        style={{ flexGrow: isConsoleOpen ? consoleGrow : 0 }}
                    >
                        {isLanguageSupported && (
                            <div className="codeConsoleHeader">
                                <div className="codeConsoleNavigatorButtonsFlex">
                                    <button
                                        className="codeConsoleNavigatorButton active"
                                        onClick={() => setIsConsoleOpen((prev) => !prev)}
                                    >
                                        Problems
                                    </button>
                                </div>

                                    <div className="codeLintErrorWrapper">
                                        <label className="codeLintErrorCount">
                                            <span>Errors:</span> {lintErrors.length} (Muted: {mutedLines.length})
                                        </label>
                                        <Tippy content="Unmute" theme="tooltip-light">
                                            <button
                                                type="button"
                                                className="codeEditorSearchButton"
                                                onClick={() => setMutedLines([])}
                                            >
                                                <FontAwesomeIcon icon={faXmarkSquare}/>
                                            </button>
                                        </Tippy>
                                        <Tippy content={isConsoleOpen ? "Hide" : "Show"} theme="tooltip-light">
                                            <button
                                                type="button"
                                                className="codeEditorSearchButton"
                                                onClick={() => setIsConsoleOpen((prev) => !prev)}
                                            >
                                                <FontAwesomeIcon icon={isConsoleOpen ? faMinusSquare : faPlusSquare}/>
                                            </button>
                                        </Tippy>
                                    </div>

                            </div>
                        )}

                        {isConsoleOpen && isLanguageSupported && visibleLintErrors.length > 0 && (
                            visibleLintErrors.map((err, idx) => (
                                <div
                                    className="codeLintMessage"
                                    key={idx}
                                    style={{
                                        fontSize: `${Math.round(12 * zoomLevel)}px`,
                                        opacity: isUpdating ? 0.6 : 1
                                    }}
                                >
                                    <div
                                        onClick={() => mirrorRef.current?.jumpToLine(err.line)}
                                    >
                                        Line {err.line} - Col {err.col}: {err.message}
                                    </div>
                                    <button
                                        className="codeLintMessageMuteButton"
                                        onClick={() => setMutedLines((prev) => [...prev, err.line])}
                                    >
                                        Mute
                                    </button>
                                </div>
                            ))
                        )}

                    </div>
                </div>
            ) : (
                <div className="codeUnsupportedWrapper">
                    <div className="codeUnsupportedCard">
                        <FontAwesomeIcon
                            icon={faExclamationTriangle}
                            className="codeUnsupportedIcon"
                        />
                        <label className="codeUnsupportedMessage">
                            The content of this file type is unsupported.
                        </label>
                        <button className="codeTryToOpenButton" onClick={onForceOpen}>
                            Try to Open Anyway
                        </button>
                    </div>
                </div>
            )}

            {saveStatus && (
                <div className="codeSaveStatusIndicator">{saveStatus}</div>
            )}
        </div>
    );
});

export default Markdown;