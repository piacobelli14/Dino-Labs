import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import "../../styles/mainStyles/DinoLabsTextEditor/DinoLabsTextEditor.css";
import { showDialog } from "../../helpers/Alert.jsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRightFromBracket, faSave, faDownload, faUndo, faRedo,
  faCut, faCopy, faPaste, faArrowPointer, faSearch, faIcons,
  faFile
} from "@fortawesome/free-solid-svg-icons";

const SAVE_BANNER_TIMEOUT_MS = 3000;

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

export default function DinoLabsTextEditor({ fileHandle, keyBinds, onSaveStatusChange, onSave, onEdit }) {
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
  const [showSpecialPicker, setShowSpecialPicker] = useState(false);
  const [specialCategory, setSpecialCategory] = useState("math");
  const specialPickerRef = useRef(null);
  
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
        const ext = file.name.split(".").pop().toLowerCase();
        if (!["txt", "md"].includes(ext)) throw new Error(`Unsupported file type: .${ext}`);
        const t = await file.text();
        if (editorRef.current) {
          editorRef.current.textContent = t;
          setHistory([t]);
          setHistoryIndex(0);
        }
      } catch (error) { setError(error.message); } finally { setLoading(false); }
    }
    loadFile();
  }, [fileHandle]);

  const handleInput = useCallback((e) => {
    if (isUndoRedoAction.current) return;
    
    const editor = editorRef.current;
    if (!editor) return;
    
    const currentContent = editor.textContent || "";
    
    saveToHistory(currentContent);
    
    onEdit?.({ fullCode: history[historyIndex] || "" }, { fullCode: currentContent });
    debouncedNotifySaveStatus("Unsaved Changes");
  }, [saveToHistory, onEdit, debouncedNotifySaveStatus, history, historyIndex]);

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
        const editor = editorRef.current;
        const content = editor ? editor.textContent : '';
        const writable = await fileHandle.createWritable();
        await writable.write(content);
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
  }, [fileHandle, onSave, notifySaveStatus]);

  const handleDownload = useCallback(async () => {
    const result = await showDialog({
      title: "Download as...",
      message: "Select file type:",
      inputs: [{ name: "type", type: "select", options: [{ label: "Text (.txt)", value: "txt" }, { label: "Markdown (.md)", value: "md" }] }],
      showCancel: true
    });
    if (result) {
      const editor = editorRef.current;
      const content = editor ? editor.textContent : '';
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (fileHandle?.name?.replace(/\.[^/.]+$/, "") || "Untitled") + "." + result.type;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [fileHandle]);

  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) return;
    
    const editor = editorRef.current;
    if (!editor) return;

    isUndoRedoAction.current = true;
    
    const newIndex = historyIndex - 1;
    const content = history[newIndex];
    
    editor.textContent = content;
    setHistoryIndex(newIndex);
    
    editor.focus();
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(editor);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    
    onEdit?.({ fullCode: editor.textContent }, { fullCode: content });
    debouncedNotifySaveStatus("Unsaved Changes", { operation: "undo" });
    
    setTimeout(() => {
      isUndoRedoAction.current = false;
    }, 100);
  }, [historyIndex, history, onEdit, debouncedNotifySaveStatus]);

  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    
    const editor = editorRef.current;
    if (!editor) return;

    isUndoRedoAction.current = true;
    
    const newIndex = historyIndex + 1;
    const content = history[newIndex];
    
    editor.textContent = content;
    setHistoryIndex(newIndex);
    
    editor.focus();
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(editor);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    
    onEdit?.({ fullCode: editor.textContent }, { fullCode: content });
    debouncedNotifySaveStatus("Unsaved Changes", { operation: "redo" });
    
    setTimeout(() => {
      isUndoRedoAction.current = false;
    }, 100);
  }, [historyIndex, history, onEdit, debouncedNotifySaveStatus]);

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

  const handleStatistics = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const plainText = editor.textContent || '';
    const words = plainText.trim().split(/\s+/).length;
    const chars = plainText.length;
    const lines = plainText.split("\n").length;
    showDialog({ title: "Statistics", message: `Words: ${words}\nCharacters: ${chars}\nLines: ${lines}` });
  }, []);

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
      if (openMenu && !menuPortalRef.current?.contains(e.target) && !e.target.closest(".dinolabsOperationsButton")) setOpenMenu(null);
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
      <div className="dinolabsTextDropdownMenu" ref={menuPortalRef} style={{ top: menuPosition.top, left: menuPosition.left }}>
        {items.map((item, i) => (
          <div className="dinolabsTextDropdownMenuItem" key={i} onClick={() => { item.action(); setOpenMenu(null); }}>
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
    const items = [
      { icon: faUndo, text: "Undo", action: handleUndo },
      { icon: faRedo, text: "Redo", action: handleRedo },
      { icon: faCut, text: "Cut", action: handleCut },
      { icon: faCopy, text: "Copy", action: handleCopy },
      { icon: faPaste, text: "Paste", action: handlePaste },
      { icon: faArrowPointer, text: "Select All", action: handleSelectAll },
      { icon: faSearch, text: "Search/Replace", action: () => setShowSearchPanel(true) },
      { icon: faIcons, text: "Insert Special Character", action: () => setShowSpecialPicker(true) },
      { icon: faSave, text: "Save", action: handleSave },
      { icon: faDownload, text: "Download", action: handleDownload }
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

  const renderSpecialPicker = () => {
    if (!showSpecialPicker) return null;
    const symbols = specialCategory === "math" ? mathSymbols :
                    specialCategory === "latin" ? latinSymbols :
                    specialCategory === "greek" ? greekSymbols :
                    punctuationSymbols;
    return createPortal(
      <div ref={specialPickerRef} className="dinolabsTextEquationPicker">
        <div className="dinolabsTextEquationNavButtons">
          <button
            onClick={() => setSpecialCategory("math")}
            style={{
              backgroundColor: specialCategory === "math" ? "#444" : "#333"
            }}
          >
            Math
          </button>
          <button
            onClick={() => setSpecialCategory("latin")}
            style={{
              backgroundColor: specialCategory === "latin" ? "#444" : "#333"
            }}
          >
            Latin
          </button>
          <button
            onClick={() => setSpecialCategory("greek")}
            style={{
              backgroundColor: specialCategory === "greek" ? "#444" : "#333"
            }}
          >
            Greek
          </button>
          <button
            onClick={() => setSpecialCategory("punctuation")}
            style={{
              backgroundColor: specialCategory === "punctuation" ? "#444" : "#333"
            }}
          >
            Punctuation
          </button>
          <button
            onClick={() => setShowSpecialPicker(false)}
            style={{
              backgroundColor: "#666"
            }}
          >
            Close
          </button>
        </div>
       
        <div className="dinolabsTextEquationSelectionButtons" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(30px, 1fr))" }}>
          {symbols.map(s => (
            <button
              key={s}
              onClick={() => { insertSymbol(s); setShowSpecialPicker(false); }}
              style={{
                fontSize: "16px",
                height: "20px" 
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = "#444"}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = "#333"}
            >
              {s}
            </button>
          ))}
        </div>
      </div>,
      document.body
    );
  };

  if (loading) return <div className="loading-wrapper">
                <div className="loading-circle" />
                <label className="loading-title">Dino Labs</label>
            </div>;
  if (error) return <div className="loading-wrapper">
                <div className="loading-circle" />
                <label className="loading-title">Dino Labs</label>
            </div>;

  const saveBannerText = saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved!" : saveStatus === "failed" ? "Save failed!" : saveStatus === "no-handle" ? "No file handle" : "";

  return (
    <div className="dinolabsTextContentWrapper" onContextMenu={openContextMenu}>
      <div className="dinolabsTextToolbarWrapper">
        <div className="dinolabsTextToolBar">
          <div className="dinolabsTextTitleWrapper">
            <div className="dinolabsTextFileNameStack">
              <label className="dinolabsTextFileNameInput"><FontAwesomeIcon icon={faFile} /> {fileHandle?.name || "Untitled Text"}</label>
              <div className="dinolabsTextOperationsButtonsWrapper">
                <button ref={fileBtnRef} className="dinolabsTextOperationsButton" onClick={() => openTopMenu("file", fileBtnRef)}>File</button>
                {renderDropdownMenu("file", [
                  { icon: faSave, text: "Save", action: handleSave },
                  { icon: faDownload, text: "Download", action: handleDownload }
                ])}
                <button ref={editBtnRef} className="dinolabsTextOperationsButton" onClick={() => openTopMenu("edit", editBtnRef)}>Edit</button>
                {renderDropdownMenu("edit", [
                  { icon: faUndo, text: "Undo", action: handleUndo },
                  { icon: faRedo, text: "Redo", action: handleRedo },
                  { icon: faCut, text: "Cut", action: handleCut },
                  { icon: faCopy, text: "Copy", action: handleCopy },
                  { icon: faPaste, text: "Paste", action: handlePaste },
                  { icon: faArrowPointer, text: "Select All", action: handleSelectAll },
                  { icon: faSearch, text: "Search/Replace", action: () => setShowSearchPanel(true) }
                ])}
                <button ref={insertBtnRef} className="dinolabsTextOperationsButton" onClick={() => openTopMenu("insert", insertBtnRef)}>Insert</button>
                {renderDropdownMenu("insert", [
                  { icon: faIcons, text: "Special Character", action: () => setShowSpecialPicker(true) }
                ])}
                <button ref={toolsBtnRef} className="dinolabsTextOperationsButton" onClick={() => openTopMenu("tools", toolsBtnRef)}>Tools</button>
                {renderDropdownMenu("tools", [
                  { text: "Statistics", action: handleStatistics }
                ])}
              </div>
            </div>
          </div>
        </div>
      </div>
     
      <div className="dinolabsTextContent">
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          suppressContentEditableWarning={true}
          className="dinolabsTextEditor"
          data-placeholder="Start typing..."
        />
      </div>
     
      {showSearchPanel && (
        <div 
          ref={searchPanelRef} 
          className="dinolabsTextEditingSearchBoxWrapper" 
          style={{ position: "absolute", top: searchPanelPos.y - 80, left: searchPanelPos.x, zIndex: 10 }} 
          onMouseDown={startSearchDrag}
        >
          <div className="dinolabsTextEditngSearchBarWrapper">
            <label className="dinolabsTextEditingSearchLabel">Search: <span><input className="dinolabsSettingsCheckbox" type="checkbox" checked={caseSensitive} onChange={e => setCaseSensitive(e.target.checked)} />Case Sensitive</span></label>
            <input className="dinolabsTextEditingSearchInput" type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            <div className="dinolabsTextEditingSearchOperationsButtonWrapper">
              <button className="dinolabsTextEditingSearchOperationsButton" onClick={() => findAllMatches(searchTerm)}>Search</button>
              <button className="dinolabsTextEditingSearchOperationsButton" onClick={goToPrevious}>Prev</button>
              <button className="dinolabsTextEditingSearchOperationsButton" onClick={goToNext}>Next</button>
            </div>
          </div>
          <div className="dinolabsTextEditngSearchBarWrapper">
            <label className="dinolabsTextEditingSearchLabel">Replace:</label>
            <input className="dinolabsTextEditingSearchInput" type="text" value={replaceTerm} onChange={e => setReplaceTerm(e.target.value)} />
            <div className="dinolabsTextEditingSearchOperationsButtonWrapper">
              <button className="dinolabsTextEditingSearchOperationsButton" onClick={replaceCurrent}>Replace</button>
              <button className="dinolabsTextEditingSearchOperationsButton" onClick={replaceAll}>Replace All</button>
            </div>
          </div>
          <div className="dinolabsTextEditingSearchOperationsButtonWrapper" style={{ justifyContent: "center" }}>
            <button className="dinolabsTextEditingSearchOperationsButton" style={{"width": "100%"}} onClick={() => { setShowSearchPanel(false); setSearchResults([]); setCurrentResultIndex(-1); }}>
              <FontAwesomeIcon icon={faArrowRightFromBracket} style={{ transform: "scaleX(-1)" }} /> Close Search
            </button>
          </div>
        </div>
      )}
      {ctxMenu.open && createPortal(
        <div ref={ctxMenuRef} className="dinolabsContextMenu" style={{ left: ctxMenu.x, top: ctxMenu.y }} onClick={e => e.stopPropagation()}>
          {ctxMenu.items.map((it, i) => (
            <div key={i} className="dinolabsContextMenuItem" onClick={() => { setCtxMenu(c => ({ ...c, open: false })); it.action(); }}>
              {it.icon && <FontAwesomeIcon icon={it.icon} />}
              <span>{it.text}</span>
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