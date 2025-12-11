import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "../../../styles/mainStyles/DinoLabsMedia/DinoLabsPDFEditor/DinoLabsPDFEditor.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFile, faDownload } from "@fortawesome/free-solid-svg-icons";

export default function DinoLabsPdfViewer({ fileHandle }) {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [displayName, setDisplayName] = useState("Untitled.pdf");
  const [openMenu, setOpenMenu] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  const menuPortalRef = useRef(null);
  const fileBtnRef = useRef(null);

  const MENU_WIDTH = 180;
  const MENU_HEIGHT = 200;
  const MENU_OFFSET = 6;
  const WINDOW_EDGE_PADDING = 8;

  function clampPosition(rect, width = MENU_WIDTH, height = MENU_HEIGHT, offset = MENU_OFFSET) {
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

  async function loadFile() {
    setError(null);
    setLoading(true);
    setPdfUrl(null);

    try {
      if (!fileHandle) {
        setLoading(false);
        return;
      }
      
      const file = await fileHandle.getFile();
      const name = file.name || "Untitled.pdf";
      
      setDisplayName(name);

      const ext = name.split(".").pop()?.toLowerCase();
      if (ext !== "pdf") {
        throw new Error(`Unsupported file type: .${ext}`);
      }

      const createdUrl = URL.createObjectURL(file);
      setPdfUrl(createdUrl);
    } catch (error) {
      setError(error?.message || String(error));
    } finally {
      setLoading(false);
    }
  }

  const handleDownload = () => {
    if (!pdfUrl) return;
    
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = displayName || "Untitled.pdf";
    a.click();
  };

  const openTopMenu = (name, btnRef) => {
    setOpenMenu((prev) => (prev === name ? null : name));
    if (btnRef.current) {
      setMenuPosition(clampPosition(btnRef.current.getBoundingClientRect()));
    }
  };

  const renderDropdownMenu = (menuName, items) => {
    if (openMenu !== menuName) return null;
    
    return createPortal(
      <div 
        className="dinolabsPDFDropdownMenu" 
        ref={menuPortalRef} 
        style={{ top: menuPosition.top, left: menuPosition.left }}
      >
        {items.map((item, i) => (
          <div
            className="dinolabsPDFDropdownMenuItem"
            key={i}
            onClick={() => {
              item.action();
              setOpenMenu(null);
            }}
          >
            {item.icon && <FontAwesomeIcon icon={item.icon} />}
            {item.text}
          </div>
        ))}
      </div>,
      document.body
    );
  };

  useEffect(() => {
    let createdUrl = null;

    async function handleFileLoad() {
      await loadFile();
      if (pdfUrl) {
        createdUrl = pdfUrl;
      }
    }

    handleFileLoad();
    
    return () => {
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [fileHandle]);

  useEffect(() => {
    const handleMouseDown = (e) => {
      if (openMenu && !menuPortalRef.current?.contains(e.target) && !e.target.closest(".dinolabsOperationsButton")) {
        setOpenMenu(null);
      }
    };
    
    document.addEventListener("mousedown", handleMouseDown, true);
    return () => document.removeEventListener("mousedown", handleMouseDown, true);
  }, [openMenu]);

  const LoadingUI = (
    <div className="loading-wrapper">
      <div className="loading-circle" />
      <label className="loading-title">Dino Labs</label>
    </div>
  );

  return (
    <div className="dinolabsPDFContentWrapper">
      <div className="dinolabsPDFToolbarWrapper">
        <div className="dinolabsPDFToolBar">
          <div className="dinolabsPDFTitleWrapper">
            <div className="dinolabsPDFFileNameStack">
              <label className="dinolabsPDFFileNameInput">
                <FontAwesomeIcon icon={faFile} /> {displayName}
              </label>

              <div className="dinolabsPDFOperationsButtonsWrapper">
                <button 
                  ref={fileBtnRef} 
                  className="dinolabsPDFOperationsButton" 
                  onClick={() => openTopMenu("file", fileBtnRef)}
                >
                  File
                </button>
                
                {renderDropdownMenu("file", [
                  { 
                    icon: faDownload, 
                    text: "Export", 
                    action: handleDownload 
                  }
                ])}
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading && LoadingUI}

      <div className="dinolabsPDFContent" style={{ overflow: "auto", textAlign: "center" }}>
        {pdfUrl && !error && !loading && (
          <iframe
            title="PDF"
            src={`${pdfUrl}#page=1&zoom=page-width&view=FitH&navpanes=0`}
            style={{
              width: "100%",
              height: "calc(100vh - 140px)", 
              border: "none",
              background: "#1f1f1f",
            }}
          />
        )}
      </div>
    </div>
  );
}