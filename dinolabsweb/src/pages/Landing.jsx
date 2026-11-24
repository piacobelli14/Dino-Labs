import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCode, faFileLines, faTable, faDisplay, faFilePdf, faImage, faMusic, faFilm, faCube,
  faUserPlus, faRightToBracket, faGauge, faUpload, faTrash, faExclamationCircle
} from "@fortawesome/free-solid-svg-icons";
import { fileTypeMap } from "./Studio/FileTypeMap.jsx";
import Nav from "../helpers/Nav.jsx";
import useAuth from "../UseAuth.jsx";
import Markdown from "./Studio/Code/Markdown.jsx";
import Tabular from "./Studio/Data/Data.jsx";
import Text from "./Studio/Documents/Text/Text.jsx";
import Slides from "./Studio/Documents/Slides/Slides.jsx";
import PDF from "./Studio/Documents/PDF/PDF.jsx";
import Image from "./Studio/Media/Images/Images.jsx";
import Video from "./Studio/Media/Video/Video.jsx";
import Audio from "./Studio/Media/Audio/Audio.jsx";
import ThreeD from "./Studio/ThreeD/ThreeD.jsx";
import "../styles/mainStyles/Studio/Studio.css";
import "../styles/mainStyles/Studio/Code/Markdown.css";
import "../styles/mainStyles/Studio/Code/MirrorThemes/DefaultTheme.css";
import "../styles/mainStyles/Studio/Code/MirrorThemes/DarkTheme.css";
import "../styles/mainStyles/Studio/Code/MirrorThemes/LightTheme.css";
import "../styles/helperStyles/Tooltip.css";
import "../styles/helperStyles/HighlightKill.css";
import "../styles/mainStyles/Landing.css";
import "../styles/helperStyles/LoadingSpinner.css";
import "../styles/helperStyles/Tooltip.css";

const SOURCES = {
  routes: {
    register: "/register",
    login: "/login",
    studio: "/studio"
  },
  layout: {
    copyFraction: 0.32,
    copyMaxPx: 480,
    stackBelowPx: 1000
  },
  keyBinds: { save: "s", undo: "z", redo: "y", cut: "x", copy: "c", paste: "v", search: "f", selectAll: "a" },
  colorTheme: "default",
  zoomLevel: 1,
  description: "Upload any file and it opens in the real editor made for it, from code and documents to images, audio, video and 3D models. The full studio adds whole repositories and saving back to disk.",
  types: [
    { key: "code", label: "Code", short: "Code", icon: faCode, extensions: null, description: "Upload a source file to open it in the real code editor. The full studio adds whole repositories, split panes and saving back to disk." },
    { key: "text", label: "Documents", short: "Docs", icon: faFileLines, extensions: ["txt", "text", "md", "markdown", "mdown", "log", "rst", "tex", "nfo", "rtf", "doc", "docx", "odt"], description: "Upload a document to open it in the real rich text editor. The full studio adds saving back to disk and every other editor alongside it." },
    { key: "data", label: "Spreadsheets", short: "Sheets", icon: faTable, extensions: ["csv", "tsv", "tab", "psv", "xlsx", "xlsm", "xls", "ods"], description: "Upload a spreadsheet to open it in the real table editor. The full studio adds saving back to disk and every other editor alongside it." },
    { key: "slides", label: "Slides", short: "Slides", icon: faDisplay, extensions: ["pptx", "pptm", "potx", "potm", "ppsx", "ppsm", "ppt", "pot", "pps"], description: "Upload a presentation to open it in the real slide editor. The full studio adds saving back to disk and every other editor alongside it." },
    { key: "pdf", label: "PDF", short: "PDF", icon: faFilePdf, extensions: ["pdf"], description: "Upload a PDF to open it in the real PDF editor. The full studio adds saving back to disk and every other editor alongside it." },
    { key: "image", label: "Images", short: "Images", icon: faImage, extensions: ["png", "jpg", "jpeg", "gif", "svg", "bmp"], description: "Upload an image to open it in the real image editor. The full studio adds saving back to disk and every other editor alongside it." },
    { key: "audio", label: "Audio", short: "Audio", icon: faMusic, extensions: ["mp3", "wav", "flac"], description: "Upload an audio file to open it in the real audio editor. The full studio adds saving back to disk and every other editor alongside it." },
    { key: "video", label: "Video", short: "Video", icon: faFilm, extensions: ["mp4", "mkv", "avi", "mov", "webm"], description: "Upload a video to open it in the real video editor. The full studio adds saving back to disk and every other editor alongside it." },
    { key: "threeD", label: "3D Models", short: "3D", icon: faCube, extensions: ["stl", "3mf", "obj", "ply", "off", "gltf", "glb", "dae", "x3d", "amf", "blend"], description: "Upload a 3D model to open it in the real model viewer. The full studio adds saving back to disk and every other editor alongside it." }
  ]
};

const extensionOf = (name) => (String(name || "").includes(".") ? String(name).split(".").pop().toLowerCase() : "");

const typeForExtension = (extension) => (SOURCES.types.find((type) => type.extensions && type.extensions.includes(extension)) || SOURCES.types[0]).key;

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

const errorText = (error) => String(error && error.message ? error.message : error).replace(/\.$/, "");

const toBytes = async (data) => {
  if (typeof data === "string") return new TextEncoder().encode(data);
  if (data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  return new Uint8Array(0);
};

const createMemoryHandle = (file) => {
  let current = file;
  return {
    kind: "file",
    get name() {
      return current.name;
    },
    getFile: async () => current,
    createWritable: async (options = {}) => {
      let bytes = options.keepExistingData ? new Uint8Array(await current.arrayBuffer()) : new Uint8Array(0);
      let position = 0;
      const resize = (size) => {
        if (size === bytes.length) return;
        const next = new Uint8Array(size);
        next.set(bytes.subarray(0, Math.min(size, bytes.length)));
        bytes = next;
      };
      const put = async (data) => {
        const chunk = await toBytes(data);
        if (position + chunk.length > bytes.length) resize(position + chunk.length);
        bytes.set(chunk, position);
        position += chunk.length;
      };
      return {
        write: async (data) => {
          const command = data && typeof data === "object" && !(data instanceof Blob) && !(data instanceof ArrayBuffer) && !ArrayBuffer.isView(data) ? data : null;
          if (!command) {
            await put(data);
            return;
          }
          if (command.type === "seek") position = command.position;
          else if (command.type === "truncate") resize(command.size);
          else {
            if (Number.isFinite(command.position)) position = command.position;
            await put(command.data);
          }
        },
        seek: async (next) => {
          position = next;
        },
        truncate: async (size) => {
          resize(size);
          position = Math.min(position, size);
        },
        close: async () => {
          current = new File([bytes], current.name, { type: current.type, lastModified: Date.now() });
        },
        abort: async () => null
      };
    }
  };
};

const CodeDemo = ({ entry }) => {
  const editorRef = useRef(null);
  const [content, setContent] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState({ searchTerm: "", replaceTerm: "", searchPositions: [], currentSearchIndex: -1, isSearchOpen: false, isReplaceOpen: false });

  const patch = useCallback((values) => setSearch((current) => ({ ...current, ...values })), []);

  useEffect(() => {
    let cancelled = false;
    entry.file.text().then((text) => {
      if (!cancelled) setContent(text);
    }).catch((reason) => {
      if (!cancelled) setError(`The file could not be read because of the error "${errorText(reason)}".`);
    });
    return () => {
      cancelled = true;
    };
  }, [entry]);

  if (error) return <div className="landingViewerOverlay"><div className="landingErrorBox"><FontAwesomeIcon icon={faExclamationCircle} /><span>{error}</span></div></div>;
  if (content === null) return <div className="landingViewerOverlay"><div className="loading-circle" /></div>;

  const meta = fileTypeMap[entry.extension];

  return (
    <Markdown
      fileContent={content}
      detectedLanguage={meta ? meta.language : "Unknown"}
      forceOpen
      onForceOpen={() => null}
      searchTerm={search.searchTerm}
      setSearchTerm={(term) => patch({ searchTerm: term })}
      replaceTerm={search.replaceTerm}
      setReplaceTerm={(term) => patch({ replaceTerm: term })}
      searchPositions={search.searchPositions}
      setSearchPositions={(positions) => patch({ searchPositions: positions })}
      currentSearchIndex={search.currentSearchIndex}
      setCurrentSearchIndex={(index) => patch({ currentSearchIndex: index })}
      onSplit={() => null}
      disableSplit
      paneIndex={0}
      tabId={entry.id}
      isSearchOpen={search.isSearchOpen}
      isReplaceOpen={search.isReplaceOpen}
      setTabSearchOpen={(isOpen) => patch({ isSearchOpen: isOpen })}
      setTabReplaceOpen={(isOpen) => patch({ isReplaceOpen: isOpen })}
      ref={editorRef}
      onEdit={() => null}
      onSave={() => null}
      fileHandle={entry.handle}
      isGlobalSearchActive={false}
      keyBinds={SOURCES.keyBinds}
      colorTheme={SOURCES.colorTheme}
      zoomLevel={SOURCES.zoomLevel}
    />
  );
};

const EditorDemo = ({ type, entry }) => {
  const shared = { fileHandle: entry.handle, onDirtyChange: () => null, onSaveStatusChange: () => null };
  if (type === "text") return <Text fileHandle={entry.handle} keyBinds={SOURCES.keyBinds} onEdit={() => null} onSave={() => null} onDirtyChange={() => null} />;
  if (type === "data") return <Tabular fileHandle={entry.handle} keyBinds={SOURCES.keyBinds} onEdit={() => null} onSave={() => null} onDirtyChange={() => null} />;
  if (type === "slides") return <Slides {...shared} />;
  if (type === "pdf") return <PDF {...shared} />;
  if (type === "image") return <Image {...shared} />;
  if (type === "audio") return <Audio {...shared} />;
  if (type === "video") return <Video {...shared} />;
  if (type === "threeD") return <ThreeD {...shared} />;
  return <CodeDemo entry={entry} />;
};

const Landing = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const inputRef = useRef(null);
  const [entry, setEntry] = useState(null);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [copyWidth, setCopyWidth] = useState(0);

  const type = entry ? SOURCES.types.find((item) => item.key === entry.type) : null;

  useEffect(() => {
    const measure = () => setCopyWidth(window.innerWidth >= SOURCES.layout.stackBelowPx ? Math.round(Math.min(SOURCES.layout.copyMaxPx, window.innerWidth * SOURCES.layout.copyFraction)) : 0);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const loadFile = useCallback((file) => {
    if (!file) return;
    const extension = extensionOf(file.name);
    const key = typeForExtension(extension);
    setEntry({ id: `${key}-${Date.now()}`, type: key, file, extension, handle: createMemoryHandle(file) });
    setError(null);
  }, []);

  const onPick = (event) => {
    loadFile(event.target.files && event.target.files[0]);
    event.target.value = "";
  };

  const onDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer && event.dataTransfer.files ? event.dataTransfer.files[0] : null;
    if (!file) {
      setError("That drop did not contain a file.");
      return;
    }
    loadFile(file);
  };

  const openPrimary = () => navigate(token ? SOURCES.routes.studio : SOURCES.routes.register);

  const stats = [
    ["Editor", type ? type.label : "—"],
    ["File Size", entry ? formatBytes(entry.file.size) : "—"],
    ["File Type", entry && entry.extension ? entry.extension.toUpperCase() : "—"]
  ];

  return (
    <div className="landingPage">
      <Nav activePage="landing" />

      <div className="landingScene">
        <div className="landingStudioRow">
          <div className="landingStudioCopy" style={copyWidth ? { width: copyWidth } : undefined}>
            <h1 className="landingHeadline">Every File <span className="landingHeadlineAccent">Edited In Your Browser</span></h1>
            <p className="landingLead">{type ? type.description : SOURCES.description}</p>
            <div className="landingActions">
              <button className="landingButton landingButtonSolid" onClick={openPrimary}>
                <FontAwesomeIcon icon={token ? faGauge : faUserPlus} /> <span>{token ? "Open Studio" : "Create An Account"}</span>
              </button>
              {!token && (
                <button className="landingButton landingButtonGhost" onClick={() => navigate(SOURCES.routes.login)}>
                  <FontAwesomeIcon icon={faRightToBracket} /> <span>Sign In</span>
                </button>
              )}
            </div>
            <div className="landingActions">
              <button className="landingButton landingButtonGhost" onClick={() => inputRef.current && inputRef.current.click()}>
                <FontAwesomeIcon icon={faUpload} /> <span>{entry ? "Replace File" : "Upload File"}</span>
              </button>
              {entry && (
                <button className="landingButton landingButtonGhost" onClick={() => setEntry(null)}>
                  <FontAwesomeIcon icon={faTrash} /> <span>Remove File</span>
                </button>
              )}
            </div>
            <div className="landingStats">
              {stats.map(([label, value]) => (
                <div key={label} className="landingStat">
                  <span className="landingStatValue">{value}</span>
                  <span className="landingStatLabel">{label}</span>
                </div>
              ))}
            </div>
            <span className="landingUpdated">{entry ? entry.file.name : "No File Loaded"}</span>
          </div>

          <div
            className={`landingViewer landingStudioViewer ${dragging ? "landingStudioViewerDragging" : ""}`}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            {entry && (
              <div key={entry.id} className="landingEditor">
                <div className="studioMarkdownPane">
                  <EditorDemo type={entry.type} entry={entry} />
                </div>
              </div>
            )}
            {!entry && (
              <div className="landingViewerOverlay landingDropOverlay">
                <div className="landingDrop">
                  <span className="landingDropIcon"><FontAwesomeIcon icon={faUpload} /></span>
                  <span className="landingDropTitle">Upload A Sample File</span>
                  <span className="landingDropText">Drop a file here or choose one from your computer and it opens in the editor made for it.</span>
                  <button className="landingButton landingButtonSolid" onClick={() => inputRef.current && inputRef.current.click()}>
                    <FontAwesomeIcon icon={faUpload} /> <span>Choose A File</span>
                  </button>
                  <div className="landingDropTypes">
                    {SOURCES.types.map((item) => (
                      <span key={item.key} className="landingDropType">
                        <span className="landingDropTypeIcon"><FontAwesomeIcon icon={item.icon} /></span>
                        <span className="landingDropTypeLabel">{item.short}</span>
                      </span>
                    ))}
                  </div>
                  {error && <div className="landingErrorBox"><FontAwesomeIcon icon={faExclamationCircle} /><span>{error}</span></div>}
                </div>
              </div>
            )}
            <input ref={inputRef} type="file" onChange={onPick} style={{ display: "none" }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Landing;