import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faDatabase, faPlus, faTrash, faPlay, faTable,
  faCode, faColumns, faKey, faLink, faUnlink,
  faSave, faTimes, faChevronLeft, faChevronRight, faChevronDown,
  faChevronUp, faRefresh, faDownload, faCopy, faGlobe,
  faAngleDown, faAngleRight, faEye, faHistory, faSearch,
  faExpand, faCompress, faTableColumns, faBroom, faArrowsLeftRight
} from "@fortawesome/free-solid-svg-icons";
import { FixedSizeList as List } from "react-window";
import Nav from "../../helpers/Nav.jsx";
import Dropdown from "../../helpers/Dropdown.jsx";
import useAuth from "../../UseAuth.jsx";
import { showDialog } from "../../helpers/Alert.jsx";
import Markdown from "../Studio/Code/Markdown.jsx";
import "../../styles/mainStyles/Account/Database.css";
import "../../styles/mainStyles/Studio/Code/Markdown.css";
import "../../styles/mainStyles/Studio/Code/MirrorThemes/DefaultTheme.css";
import "../../styles/helperStyles/LoadingSpinner.css";
import "../../styles/helperStyles/Disconnected.css";

const EDITOR_KEY_BINDS = {
    save: "",
    undo: "z",
    redo: "y",
    cut: "x",
    copy: "c",
    paste: "v",
    search: "f",
    selectAll: "a"
};

let sqlEditorIdCounter = 0;
const generateSqlEditorId = () => {
    sqlEditorIdCounter += 1;
    return `database-sql-editor-${sqlEditorIdCounter}`;
};

const SqlEditor = ({ value, onChange, onExecute }) => {
    const editorRef = useRef(null);
    const editorId = useRef(generateSqlEditorId()).current;

    const [searchTerm, setSearchTerm] = useState("");
    const [replaceTerm, setReplaceTerm] = useState("");
    const [searchPositions, setSearchPositions] = useState([]);
    const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isReplaceOpen, setIsReplaceOpen] = useState(false);

    const handleEdit = useCallback((_paneIndex, _tabId, _previous, next) => {
        if (!next || next.fullCode === undefined) return;
        onChange({ target: { value: next.fullCode } });
    }, [onChange]);

    const handleSave = useCallback(() => {}, []);

    const handleSplit = useCallback(() => {}, []);

    const handleKeyDownCapture = useCallback((event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();

            if (onExecute) {
                onExecute();
            }
        }
    }, [onExecute]);

    return (
        <div className="dbSqlEditorHost" onKeyDownCapture={handleKeyDownCapture}>
            <Markdown
                ref={editorRef}
                fileContent={value}
                detectedLanguage="SQL"
                forceOpen={true}
                onForceOpen={() => {}}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                replaceTerm={replaceTerm}
                setReplaceTerm={setReplaceTerm}
                searchPositions={searchPositions}
                setSearchPositions={setSearchPositions}
                currentSearchIndex={currentSearchIndex}
                setCurrentSearchIndex={setCurrentSearchIndex}
                onSplit={handleSplit}
                disableSplit={true}
                paneIndex={0}
                tabId={editorId}
                isSearchOpen={isSearchOpen}
                isReplaceOpen={isReplaceOpen}
                setTabSearchOpen={setIsSearchOpen}
                setTabReplaceOpen={setIsReplaceOpen}
                onEdit={handleEdit}
                onSave={handleSave}
                fileHandle={null}
                isGlobalSearchActive={false}
                keyBinds={EDITOR_KEY_BINDS}
                colorTheme="default"
                zoomLevel={1}
            />
        </div>
    );
};

const SCHEMA_COLUMN_FIELDS = [
    { key: "name", label: "Name", sortable: true },
    { key: "type", label: "Type", sortable: true },
    { key: "nullable", label: "Nullable", sortable: true },
    { key: "default", label: "Default", mono: true }
];

const SCHEMA_CONSTRAINT_FIELDS = [
    { key: "name", label: "Name", sortable: true },
    { key: "type", label: "Type", sortable: true },
    { key: "column", label: "Column", sortable: true },
    { key: "references", label: "References" }
];

const SCHEMA_INDEX_FIELDS = [
    { key: "name", label: "Name", sortable: true },
    { key: "definition", label: "Definition", mono: true }
];

const GRID_HEADER_HEIGHT = 44;
const GRID_GUTTER_WIDTH = 60;
const GRID_VALUE_CHAR_WIDTH = 7.6;
const GRID_LABEL_CHAR_WIDTH = 9.2;
const GRID_CELL_PADDING = 36;
const GRID_MIN_COLUMN = 112;
const GRID_MAX_COLUMN = 460;
const GRID_MAX_RESIZE = 960;
const GRID_SAMPLE_ROWS = 150;

const DEFAULT_ROW_LIMIT = 100;

const ROW_LIMIT_OPTIONS = [100, 1000, 5000, 0];

const maskSqlLiterals = (sql) => sql.replace(/\$([A-Za-z_]*)\$[\s\S]*?\$\1\$|'(?:[^']|'')*'?|"(?:[^"]|"")*"?|--[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/g, (match) => match.replace(/[^\n]/g, " "));

const applyDefaultLimit = (sql, limit) => {
    if (!limit) return { query: sql, applied: false };
    const trimmed = sql.replace(/[\s;]+$/, "");
    const masked = maskSqlLiterals(trimmed);
    if (masked.includes(";") || !/^\s*select\b/i.test(masked)) return { query: sql, applied: false };
    let depth = 0;
    let topLevel = "";
    for (const char of masked) {
        if (char === "(") depth += 1;
        else if (char === ")") depth = Math.max(0, depth - 1);
        topLevel += depth === 0 ? char : " ";
    }
    if (/\b(limit|fetch|into)\b/i.test(topLevel) || /\bfor\s+(update|share|no\s+key\s+update|key\s+share)\b/i.test(topLevel)) {
        return { query: sql, applied: false };
    }
    return { query: `${trimmed}\nLIMIT ${limit}`, applied: true };
};

const GRID_DENSITY_ORDER = ["compact", "standard", "relaxed"];

const GRID_DENSITY_HEIGHTS = {
    compact: 32,
    standard: 40,
    relaxed: 52
};

const GRID_DENSITY_LABELS = {
    compact: "Compact",
    standard: "Standard",
    relaxed: "Relaxed"
};

const stringifyCellValue = (value) => {
    if (value === null || value === undefined) {
        return "NULL";
    }

    if (typeof value === "object") {
        return JSON.stringify(value);
    }

    return String(value);
};

const copyCellValue = (value) => {
    const text = value === null || value === undefined
        ? ""
        : typeof value === "object"
            ? JSON.stringify(value, null, 2)
            : String(value);

    navigator.clipboard.writeText(text);
};

const compareCellValues = (left, right) => {
    const leftEmpty = left === null || left === undefined;
    const rightEmpty = right === null || right === undefined;

    if (leftEmpty && rightEmpty) {
        return 0;
    }

    if (leftEmpty) {
        return 1;
    }

    if (rightEmpty) {
        return -1;
    }

    if (typeof left === "number" && typeof right === "number") {
        return left - right;
    }

    return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
};

const measureColumnWidths = (columns, rows) => {
    const sample = rows.slice(0, GRID_SAMPLE_ROWS);

    return columns.map((column) => {
        const labelWidth = String(column.label || "").length * GRID_LABEL_CHAR_WIDTH + GRID_CELL_PADDING + (column.sortable ? 22 : 0);

        let longestValue = 0;

        for (const row of sample) {
            const length = stringifyCellValue(row[column.key]).length;

            if (length > longestValue) {
                longestValue = length;
            }
        }

        const valueWidth = longestValue * GRID_VALUE_CHAR_WIDTH + GRID_CELL_PADDING;
        const measured = Math.round(Math.max(labelWidth, valueWidth));

        return Math.max(GRID_MIN_COLUMN, Math.min(GRID_MAX_COLUMN, measured));
    });
};

const renderCellValue = (value) => {
    if (value === null || value === undefined) {
        return <span className="dbGridNull">NULL</span>;
    }

    if (typeof value === "boolean") {
        return <span className={`dbGridFlag ${value ? "isTrue" : "isFalse"}`}>{String(value)}</span>;
    }

    if (typeof value === "number") {
        return <span className="dbGridNumber">{String(value)}</span>;
    }

    if (typeof value === "object") {
        return <span className="dbGridJson">{JSON.stringify(value)}</span>;
    }

    const text = String(value);

    if (text === "") {
        return <span className="dbGridPlaceholder">Empty</span>;
    }

    return <span className="dbGridText">{text}</span>;
};

const DataGrid = ({
    columns,
    rows,
    emptyMessage,
    onCellClick,
    onRowClick,
    sortColumn,
    sortDirection,
    onSort,
    clientSort,
    searchable,
    visibleRows,
    actions
}) => {
    const listRef = useRef(null);
    const bodyRef = useRef(null);
    const surfaceRef = useRef(null);
    const resizeRef = useRef(null);

    const [measuredHeight, setMeasuredHeight] = useState(0);
    const [density, setDensity] = useState("standard");
    const [filterTerm, setFilterTerm] = useState("");
    const [hiddenColumns, setHiddenColumns] = useState({});
    const [widthOverrides, setWidthOverrides] = useState({});
    const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [localSort, setLocalSort] = useState({ key: null, direction: "asc" });
    const [activeCell, setActiveCell] = useState(null);
    const [selectedRows, setSelectedRows] = useState({});

    const rowHeight = GRID_DENSITY_HEIGHTS[density];

    const shownColumns = useMemo(
        () => columns.filter((column) => !hiddenColumns[column.key]),
        [columns, hiddenColumns]
    );

    const filteredRows = useMemo(() => {
        if (!searchable || !filterTerm.trim()) {
            return rows;
        }

        const needle = filterTerm.trim().toLowerCase();

        return rows.filter((row) =>
            shownColumns.some((column) => stringifyCellValue(row[column.key]).toLowerCase().includes(needle))
        );
    }, [rows, shownColumns, filterTerm, searchable]);

    const displayRows = useMemo(() => {
        if (onSort || !clientSort || !localSort.key) {
            return filteredRows;
        }

        const ordered = [...filteredRows];
        const direction = localSort.direction === "asc" ? 1 : -1;

        ordered.sort((left, right) => compareCellValues(left[localSort.key], right[localSort.key]) * direction);

        return ordered;
    }, [filteredRows, onSort, clientSort, localSort]);

    const activeSortKey = onSort ? sortColumn : localSort.key;
    const activeSortDirection = onSort ? sortDirection : localSort.direction;

    const measuredWidths = useMemo(
        () => measureColumnWidths(shownColumns, displayRows),
        [shownColumns, displayRows]
    );

    const widths = useMemo(
        () => shownColumns.map((column, index) => widthOverrides[column.key] || measuredWidths[index]),
        [shownColumns, widthOverrides, measuredWidths]
    );

    const template = useMemo(
        () => `${GRID_GUTTER_WIDTH}px ${widths.map((width) => `${width}px`).join(" ")}`,
        [widths]
    );

    const trackWidth = useMemo(
        () => widths.reduce((total, width) => total + width, GRID_GUTTER_WIDTH),
        [widths]
    );

    const selectedCount = useMemo(
        () => Object.values(selectedRows).filter(Boolean).length,
        [selectedRows]
    );

    useEffect(() => {
        if (visibleRows) {
            return;
        }

        const node = bodyRef.current;

        if (!node) {
            return;
        }

        const measure = () => {
            const available = Math.max(0, Math.floor(node.clientHeight));
            setMeasuredHeight((previous) => (Math.abs(previous - available) > 1 ? available : previous));
        };

        measure();

        const observer = new ResizeObserver(measure);
        observer.observe(node);

        return () => observer.disconnect();
    }, [visibleRows, isExpanded, rows.length]);

    useEffect(() => {
        setSelectedRows({});
        setActiveCell(null);
    }, [rows]);

    useEffect(() => {
        if (!isColumnMenuOpen) {
            return;
        }

        const close = () => setIsColumnMenuOpen(false);

        window.addEventListener("click", close);

        return () => window.removeEventListener("click", close);
    }, [isColumnMenuOpen]);

    const cycleDensity = () => {
        const next = GRID_DENSITY_ORDER[(GRID_DENSITY_ORDER.indexOf(density) + 1) % GRID_DENSITY_ORDER.length];
        setDensity(next);
    };

    const toggleColumn = (key) => {
        setHiddenColumns((previous) => ({ ...previous, [key]: !previous[key] }));
    };

    const handleHeaderClick = (column) => {
        if (column.sortable === false) {
            return;
        }

        if (onSort) {
            onSort(column.key);
            return;
        }

        if (!clientSort) {
            return;
        }

        setLocalSort((previous) => {
            if (previous.key !== column.key) {
                return { key: column.key, direction: "asc" };
            }

            if (previous.direction === "asc") {
                return { key: column.key, direction: "desc" };
            }

            return { key: null, direction: "asc" };
        });
    };

    const beginResize = (event, column, currentWidth) => {
        event.preventDefault();
        event.stopPropagation();

        resizeRef.current = { key: column.key, startX: event.clientX, startWidth: currentWidth };

        const onMove = (moveEvent) => {
            const state = resizeRef.current;

            if (!state) {
                return;
            }

            const next = Math.max(
                GRID_MIN_COLUMN,
                Math.min(GRID_MAX_RESIZE, state.startWidth + (moveEvent.clientX - state.startX))
            );

            setWidthOverrides((previous) => ({ ...previous, [state.key]: next }));
        };

        const onUp = () => {
            resizeRef.current = null;
            document.body.style.cursor = "";
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
        };

        document.body.style.cursor = "col-resize";
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
    };

    const autoFitColumn = (event, column) => {
        event.preventDefault();
        event.stopPropagation();

        setWidthOverrides((previous) => {
            const next = { ...previous };
            delete next[column.key];
            return next;
        });
    };

    const toggleRowSelection = (index) => {
        setSelectedRows((previous) => ({ ...previous, [index]: !previous[index] }));
    };

    const copySelectedRows = () => {
        const chosen = displayRows.filter((row, index) => selectedRows[index]);
        const payload = chosen.length ? chosen : displayRows;

        navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    };

    const moveActiveCell = (rowStep, columnStep) => {
        setActiveCell((previous) => {
            const current = previous || { row: 0, column: 0 };
            const nextRow = Math.max(0, Math.min(displayRows.length - 1, current.row + rowStep));
            const nextColumn = Math.max(0, Math.min(shownColumns.length - 1, current.column + columnStep));

            if (listRef.current) {
                listRef.current.scrollToItem(nextRow, "smart");
            }

            return { row: nextRow, column: nextColumn };
        });
    };

    const handleSurfaceKeyDown = (event) => {
        if (event.target instanceof HTMLInputElement) {
            return;
        }

        if (event.key === "ArrowDown") {
            event.preventDefault();
            moveActiveCell(1, 0);
            return;
        }

        if (event.key === "ArrowUp") {
            event.preventDefault();
            moveActiveCell(-1, 0);
            return;
        }

        if (event.key === "ArrowRight") {
            event.preventDefault();
            moveActiveCell(0, 1);
            return;
        }

        if (event.key === "ArrowLeft") {
            event.preventDefault();
            moveActiveCell(0, -1);
            return;
        }

        if (!activeCell) {
            return;
        }

        const column = shownColumns[activeCell.column];
        const row = displayRows[activeCell.row];

        if (!column || !row) {
            return;
        }

        if (event.key === "Enter" && onCellClick) {
            event.preventDefault();
            onCellClick(column, row);
            return;
        }

        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c") {
            event.preventDefault();
            copyCellValue(row[column.key]);
        }
    };

    const renderRow = useCallback(({ index, style }) => {
        const row = displayRows[index];
        const isSelected = Boolean(selectedRows[index]);

        return (
            <div
                className={`dbGridRow${index % 2 === 1 ? " isAlt" : ""}${isSelected ? " isSelected" : ""}`}
                style={{ ...style, width: trackWidth, gridTemplateColumns: template }}
            >
                <div
                    className="dbGridIndex"
                    onClick={() => toggleRowSelection(index)}
                    onDoubleClick={onRowClick ? () => onRowClick(row, shownColumns) : undefined}
                    title="Click to select this row. Double click to inspect it."
                >
                    {index + 1}
                </div>
                {shownColumns.map((column, columnIndex) => {
                    const isActive = Boolean(
                        activeCell && activeCell.row === index && activeCell.column === columnIndex
                    );

                    return (
                        <div
                            key={column.key}
                            className={`dbGridCell${column.mono ? " mono" : ""}${onCellClick ? " clickable" : ""}${isActive ? " isActive" : ""}`}
                            title={stringifyCellValue(row[column.key])}
                            onClick={() => {
                                setActiveCell({ row: index, column: columnIndex });

                                if (onCellClick) {
                                    onCellClick(column, row);
                                }
                            }}
                        >
                            {renderCellValue(row[column.key])}
                        </div>
                    );
                })}
            </div>
        );
    }, [displayRows, shownColumns, template, trackWidth, onCellClick, onRowClick, selectedRows, activeCell]);

    const bodyHeight = visibleRows
        ? Math.min(Math.max(displayRows.length, 1), visibleRows) * rowHeight
        : measuredHeight;

    const hiddenCount = columns.length - shownColumns.length;

    return (
        <div className={`dbGrid${visibleRows ? " isStatic" : ""}${isExpanded ? " isExpanded" : ""}`}>
            <div className="dbGridBar">
                {searchable && (
                    <div className="dbGridSearch">
                        <FontAwesomeIcon icon={faSearch} className="dbGridSearchIcon" />
                        <input
                            className="dbGridSearchInput"
                            placeholder="Filter These Rows"
                            value={filterTerm}
                            onChange={(event) => setFilterTerm(event.target.value)}
                        />
                        {filterTerm && (
                            <button className="dbGridSearchClear" onClick={() => setFilterTerm("")} title="Clear This Filter">
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        )}
                    </div>
                )}

                <div className="dbStatusGroup">
                    <span className="dbStatusItem">
                        <span>
                            {displayRows.length === rows.length
                                ? `${rows.length} Rows`
                                : `${displayRows.length} Of ${rows.length} Rows`}
                        </span>
                    </span>
                    <span className="dbStatusItem"><span>{shownColumns.length} Columns</span></span>
                    {selectedCount > 0 && (
                        <span className="dbStatusItem isAccent"><span>{selectedCount} Selected</span></span>
                    )}
                </div>

                <div className="dbGridBarActions">
                    {actions}
                    <button className="dbOperationsButton dbGridIconButton" onClick={copySelectedRows} title="Copy Rows As JSON">
                        <FontAwesomeIcon icon={faCopy} />
                    </button>
                    <button className="dbOperationsButton dbGridIconButton" onClick={cycleDensity} title={`Row Density: ${GRID_DENSITY_LABELS[density]}`}>
                        <FontAwesomeIcon icon={faTable} />
                    </button>
                    <div className="dbGridColumnPicker" onClick={(event) => event.stopPropagation()}>
                        <button
                            className={`dbOperationsButton dbGridIconButton${hiddenCount > 0 ? " isActive" : ""}`}
                            onClick={() => setIsColumnMenuOpen((previous) => !previous)}
                            title="Choose Visible Columns"
                        >
                            <FontAwesomeIcon icon={faTableColumns} />
                            {hiddenCount > 0 && <span className="dbGridBarBadge">{hiddenCount}</span>}
                        </button>
                        {isColumnMenuOpen && (
                            <div className="dbGridColumnMenu">
                                <div className="dbGridColumnMenuHeader">
                                    <span>Visible Columns</span>
                                    <button className="dbOperationsButton" onClick={() => setHiddenColumns({})}>
                                        Show All
                                    </button>
                                </div>
                                <div className="dbGridColumnMenuList">
                                    {columns.map((column) => (
                                        <label key={column.key} className="dbGridColumnOption">
                                            <input
                                                type="checkbox"
                                                className="dbGridColumnCheckbox"
                                                checked={!hiddenColumns[column.key]}
                                                onChange={() => toggleColumn(column.key)}
                                            />
                                            <span>{column.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <button className="dbOperationsButton dbGridIconButton" onClick={() => setWidthOverrides({})} title="Reset Column Widths">
                        <FontAwesomeIcon icon={faArrowsLeftRight} />
                    </button>
                    {!visibleRows && (
                        <button
                            className={`dbOperationsButton dbGridIconButton${isExpanded ? " isActive" : ""}`}
                            onClick={() => setIsExpanded((previous) => !previous)}
                            title={isExpanded ? "Exit Full Screen" : "Expand To Full Screen"}
                        >
                            <FontAwesomeIcon icon={isExpanded ? faCompress : faExpand} />
                        </button>
                    )}
                </div>
            </div>

            <div
                className="dbGridSurface"
                ref={surfaceRef}
                tabIndex={0}
                onKeyDown={handleSurfaceKeyDown}
            >
                <div className="dbGridScroll">
                    <div
                        className="dbGridTrack"
                        style={{
                            width: trackWidth,
                            height: visibleRows ? bodyHeight + GRID_HEADER_HEIGHT : undefined
                        }}
                    >
                        <div className="dbGridHeader" style={{ gridTemplateColumns: template }}>
                            <div className="dbGridIndex isHeader">#</div>
                            {shownColumns.map((column, columnIndex) => {
                                const isSortable = column.sortable !== false && (Boolean(onSort) || Boolean(clientSort));
                                const isSorted = isSortable && activeSortKey === column.key;

                                return (
                                    <div
                                        key={column.key}
                                        className={`dbGridHeaderCell${isSortable ? " sortable" : ""}${isSorted ? " sorted" : ""}`}
                                        title={column.label}
                                        onClick={() => handleHeaderClick(column)}
                                    >
                                        <span className="dbGridHeaderLabel">{column.label}</span>
                                        {isSorted && (
                                            <FontAwesomeIcon
                                                className="dbGridSortIcon"
                                                icon={activeSortDirection === "asc" ? faChevronUp : faChevronDown}
                                            />
                                        )}
                                        <span
                                            className="dbGridResizeHandle"
                                            onPointerDown={(event) => beginResize(event, column, widths[columnIndex])}
                                            onDoubleClick={(event) => autoFitColumn(event, column)}
                                            title="Drag to resize. Double click to auto fit."
                                        />
                                    </div>
                                );
                            })}
                        </div>

                        <div className="dbGridBody" ref={bodyRef}>
                            {displayRows.length > 0 ? (
                                <List
                                    ref={listRef}
                                    height={bodyHeight}
                                    itemCount={displayRows.length}
                                    itemSize={rowHeight}
                                    width={trackWidth}
                                    itemKey={(index) => index}
                                    className="dbGridList"
                                >
                                    {renderRow}
                                </List>
                            ) : (
                                <div className="dbGridEmpty" style={{ width: trackWidth }}>
                                    {filterTerm ? "No rows match this filter." : emptyMessage}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Database = () => {
    const navigate = useNavigate();
    const { token, userID, loading, organizationID } = useAuth();

    const [isLoaded, setIsLoaded] = useState(false);
    const [backendError, setBackendError] = useState(false);
    const [savedConnections, setSavedConnections] = useState([]);
    const [activeConnection, setActiveConnection] = useState(null);
    const [activeConnectionID, setActiveConnectionID] = useState(null);
    const [connectionConfig, setConnectionConfig] = useState(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [showConnectionModal, setShowConnectionModal] = useState(false);
    const [connectionMode, setConnectionMode] = useState("params");
    const [tables, setTables] = useState([]);
    const [selectedTable, setSelectedTable] = useState(null);
    const [tableSchema, setTableSchema] = useState(null);
    const [tableData, setTableData] = useState(null);
    const [tableStats, setTableStats] = useState(null);
    const [activeTab, setActiveTab] = useState("editor");
    const [sqlQuery, setSqlQuery] = useState("SELECT * FROM ");
    const [rowLimit, setRowLimit] = useState(DEFAULT_ROW_LIMIT);
    const [queryResult, setQueryResult] = useState(null);
    const [isExecuting, setIsExecuting] = useState(false);
    const [queryHistory, setQueryHistory] = useState([]);
    const [expandedSchemas, setExpandedSchemas] = useState({ public: true });
    const [tablePage, setTablePage] = useState(1);
    const [tablePageSize, setTablePageSize] = useState(50);
    const [tableSortColumn, setTableSortColumn] = useState(null);
    const [tableSortDirection, setTableSortDirection] = useState("asc");
    const [isLoadingTables, setIsLoadingTables] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [editorFullscreen, setEditorFullscreen] = useState(false);
    const [connectionSearch, setConnectionSearch] = useState("");
    const [tableSearch, setTableSearch] = useState("");
    const [openCell, setOpenCell] = useState(null);
    const [openRow, setOpenRow] = useState(null);

    const executeQueryRef = useRef(null);

    const [newConnection, setNewConnection] = useState({
        name: "",
        url: "",
        host: "",
        port: "5432",
        database: "",
        user: "",
        password: "",
        sslMode: "require"
    });

    const editorRef = useRef(null);

    const sslModes = [
        { value: "disable", label: "Disable" },
        { value: "allow", label: "Allow" },
        { value: "prefer", label: "Prefer" },
        { value: "require", label: "Require" },
        { value: "verify-ca", label: "Verify CA" },
        { value: "verify-full", label: "Verify Full" }
    ];

    useEffect(() => {
        if (!loading && !token) navigate("/login");
    }, [token, loading, navigate]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                await fetchSavedConnections();
                setIsLoaded(true);
            } catch (error) {
                setBackendError(true);
                setIsLoaded(true);
            }
        };
        if (!loading && token) fetchData();
    }, [userID, loading, token]);


    const getConnectionPayload = () => {
        if (activeConnectionID) {
            return { userID, organizationID, connectionID: activeConnectionID };
        } else if (connectionConfig) {
            return { userID, organizationID, connectionConfig };
        }
        return null;
    };

    const fetchSavedConnections = async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/database/connections`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ userID, organizationID })
            });
            if (!response.ok) throw new Error("The saved connections could not be fetched.");
            const data = await response.json();
            setSavedConnections(data.connections || []);
        } catch (error) {
            if (error instanceof TypeError) setBackendError(true);
            throw error;
        }
    };

    const testConnection = async () => {
        setIsConnecting(true);
        try {
            const token = localStorage.getItem("token");
            const payload = connectionMode === "url"
                ? { connectionUrl: newConnection.url }
                : {
                    host: newConnection.host,
                    port: parseInt(newConnection.port) || 5432,
                    database: newConnection.database,
                    user: newConnection.user,
                    password: newConnection.password,
                    sslMode: newConnection.sslMode
                };

            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/database/test-connection`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (data.success) {
                await showDialog({ title: "Success", message: "The connection test was successful." });
            } else {
                await showDialog({ title: "Error", message: data.message || "The connection test failed." });
            }
        } catch (error) {
            await showDialog({ title: "Error", message: "The connection test failed. Please check your parameters." });
        }
        setIsConnecting(false);
    };

    const persistConnection = async (label, config) => {
        try {
            const token = localStorage.getItem("token");

            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/database/connections/save`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    userID,
                    organizationID,
                    connectionName: label,
                    host: config.host,
                    port: config.port,
                    database: config.database,
                    user: config.user,
                    password: config.password,
                    sslMode: config.sslMode
                })
            });

            if (!response.ok) {
                return null;
            }

            const data = await response.json();

            await fetchSavedConnections();

            return data.connectionID || data.id || null;
        } catch (error) {
            return null;
        }
    };

    const saveConnection = async () => {
        if (!newConnection.name.trim()) {
            await showDialog({ title: "Error", message: "A connection name is required." });
            return;
        }
        setIsConnecting(true);
        try {
            const token = localStorage.getItem("token");
            const payload = {
                userID,
                organizationID,
                connectionName: newConnection.name,
                ...(connectionMode === "url"
                    ? { connectionUrl: newConnection.url }
                    : {
                        host: newConnection.host,
                        port: parseInt(newConnection.port) || 5432,
                        database: newConnection.database,
                        user: newConnection.user,
                        password: newConnection.password,
                        sslMode: newConnection.sslMode
                    })
            };

            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/database/connections/save`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (response.ok) {
                await fetchSavedConnections();
                closeConnectionModal();
                await showDialog({ title: "Success", message: "The connection was saved successfully." });
            } else {
                await showDialog({ title: "Error", message: data.message || "The connection could not be saved." });
            }
        } catch (error) {
            await showDialog({ title: "Error", message: "The connection could not be saved." });
        }
        setIsConnecting(false);
    };

    const deleteConnection = async (connectionID) => {
        const confirm = await showDialog({ title: "Confirm Delete", message: "Are you sure you want to delete this connection?", showCancel: true });
        if (confirm === null) return;
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/database/connections/delete`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ userID, organizationID, connectionID })
            });
            if (response.ok) {
                await fetchSavedConnections();
                if (activeConnectionID === connectionID) {
                    disconnectDatabase();
                }
            }
        } catch (error) {
            await showDialog({ title: "Error", message: "The connection could not be deleted." });
        }
    };

    const connectToDatabase = async (connection) => {
        setIsConnecting(true);
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/database/connect`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ userID, organizationID, connectionID: connection.id })
            });
            const data = await response.json();
            if (data.success) {
                setActiveConnection(connection);
                setActiveConnectionID(connection.id);
                setConnectionConfig(null);
                await fetchTablesWithID(connection.id);
                setActiveTab("editor");
            } else {
                await showDialog({ title: "Error", message: data.message || "The connection failed." });
            }
        } catch (error) {
            await showDialog({ title: "Error", message: "The connection failed." });
        }
        setIsConnecting(false);
    };

    const connectWithParams = async () => {
        setIsConnecting(true);
        try {
            const token = localStorage.getItem("token");
            let config;
            if (connectionMode === "url") {
                const regex = /^postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:\/]+):?(\d+)?\/(.+)$/;
                const match = newConnection.url.match(regex);
                if (!match) {
                    await showDialog({ title: "Error", message: "The connection URL format is invalid." });
                    setIsConnecting(false);
                    return;
                }
                config = {
                    user: decodeURIComponent(match[1]),
                    password: decodeURIComponent(match[2]),
                    host: match[3],
                    port: parseInt(match[4]) || 5432,
                    database: match[5].split("?")[0],
                    sslMode: "require"
                };
            } else {
                config = {
                    host: newConnection.host,
                    port: parseInt(newConnection.port) || 5432,
                    database: newConnection.database,
                    user: newConnection.user,
                    password: newConnection.password,
                    sslMode: newConnection.sslMode
                };
            }

            const payload = {
                userID,
                organizationID,
                host: config.host,
                port: config.port,
                database: config.database,
                user: config.user,
                password: config.password,
                sslMode: config.sslMode
            };

            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/database/connect`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (data.success) {
                const label = newConnection.name.trim()
                    || `${config.database} On ${config.host}`;

                const saved = await persistConnection(label, config);

                setActiveConnection({
                    connection_name: label,
                    host: config.host,
                    port: config.port,
                    database_name: config.database
                });

                setActiveConnectionID(saved);
                setConnectionConfig(config);
                await fetchTablesWithConfig(config);
                setShowConnectionModal(false);
                setActiveTab("editor");
            } else {
                await showDialog({ title: "Error", message: data.message || "The connection failed." });
            }
        } catch (error) {
            await showDialog({ title: "Error", message: "The connection failed." });
        }
        setIsConnecting(false);
    };

    const disconnectDatabase = () => {
        setActiveConnection(null);
        setActiveConnectionID(null);
        setConnectionConfig(null);
        setTables([]);
        setSelectedTable(null);
        setTableSchema(null);
        setTableData(null);
        setTableStats(null);
        setQueryResult(null);
        setTableSearch("");
    };

    const fetchTablesWithID = async (connID) => {
        setIsLoadingTables(true);
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/database/tables`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ userID, organizationID, connectionID: connID })
            });
            const data = await response.json();
            if (response.ok) {
                setTables(data.tables || []);
                const schemas = [...new Set((data.tables || []).map(t => t.schema))];
                const expanded = {};
                schemas.forEach(s => { expanded[s] = s === "public"; });
                setExpandedSchemas(expanded);
            }
        } catch (error) {
        }
        setIsLoadingTables(false);
    };

    const fetchTablesWithConfig = async (config) => {
        setIsLoadingTables(true);
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/database/tables`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ userID, organizationID, connectionConfig: config })
            });
            const data = await response.json();
            if (response.ok) {
                setTables(data.tables || []);
                const schemas = [...new Set((data.tables || []).map(t => t.schema))];
                const expanded = {};
                schemas.forEach(s => { expanded[s] = s === "public"; });
                setExpandedSchemas(expanded);
            }
        } catch (error) {
        }
        setIsLoadingTables(false);
    };

    const refreshTables = async () => {
        if (activeConnectionID) {
            await fetchTablesWithID(activeConnectionID);
        } else if (connectionConfig) {
            await fetchTablesWithConfig(connectionConfig);
        }
    };

    const fetchTableSchema = async (tableName, schemaName) => {
        try {
            const token = localStorage.getItem("token");
            const payload = getConnectionPayload();
            if (!payload) return;
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/database/schema`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ ...payload, tableName, schemaName })
            });
            const data = await response.json();
            if (response.ok) {
                setTableSchema(data);
            }
        } catch (error) {
        }
    };

    const fetchTableData = async (tableName, schemaName, page = 1, sortCol = null, sortDir = "asc", pageSize = tablePageSize) => {
        setIsLoadingData(true);
        try {
            const token = localStorage.getItem("token");
            const payload = getConnectionPayload();
            if (!payload) return;
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/database/table-data`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    ...payload,
                    tableName,
                    schemaName,
                    page,
                    pageSize,
                    sortColumn: sortCol,
                    sortDirection: sortDir
                })
            });
            const data = await response.json();
            if (response.ok) {
                setTableData(data);
                setTablePage(page);
            }
        } catch (error) {
        }
        setIsLoadingData(false);
    };

    const fetchTableStats = async (tableName, schemaName) => {
        try {
            const token = localStorage.getItem("token");
            const payload = getConnectionPayload();
            if (!payload) return;
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/database/table-stats`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ ...payload, tableName, schemaName })
            });
            const data = await response.json();
            if (response.ok) {
                setTableStats(data.stats);
            }
        } catch (error) {
        }
    };

    const selectTable = async (table) => {
        setSelectedTable(table);
        setTableSortColumn(null);
        setTableSortDirection("asc");
        setTablePage(1);
        setTableSchema(null);
        setTableData(null);
        setTableStats(null);
        await Promise.all([
            fetchTableSchema(table.name, table.schema),
            fetchTableData(table.name, table.schema, 1, null, "asc"),
            fetchTableStats(table.name, table.schema)
        ]);
        setSqlQuery(`SELECT * FROM "${table.schema}"."${table.name}" LIMIT 100;`);
    };

    useEffect(() => {
        executeQueryRef.current = executeQuery;
    });

    useEffect(() => {
        const onKey = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();

                if (executeQueryRef.current) {
                    executeQueryRef.current();
                }
            }

            if (e.key === "Escape") {
                if (openCell) {
                    setOpenCell(null);
                }

                if (openRow) {
                    setOpenRow(null);
                }
            }
        };

        window.addEventListener("keydown", onKey);

        return () => window.removeEventListener("keydown", onKey);
    }, [openCell, openRow]);

    const executeQuery = async () => {
        if (!sqlQuery.trim()) return;
        setIsExecuting(true);
        setQueryResult(null);
        const startTime = Date.now();
        try {
            const token = localStorage.getItem("token");
            const payload = getConnectionPayload();
            if (!payload) {
                setQueryResult({ success: false, error: "There is no active connection.", executionTime: 0 });
                setIsExecuting(false);
                return;
            }
            const { query: preparedQuery, applied: limitApplied } = applyDefaultLimit(sqlQuery, rowLimit);
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/database/query`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ ...payload, query: preparedQuery })
            });
            const data = await response.json();
            const execTime = Date.now() - startTime;
            if (data.success) {
                setQueryResult({
                    success: true,
                    rows: data.rows || [],
                    fields: data.fields || [],
                    rowCount: data.rowCount,
                    command: data.command,
                    executionTime: execTime,
                    limitApplied: limitApplied ? rowLimit : null
                });
                setQueryHistory(prev => [{ query: sqlQuery, timestamp: new Date(), success: true, rowCount: data.rowCount }, ...prev.slice(0, 49)]);
                if (data.command === "CREATE" || data.command === "DROP" || data.command === "ALTER") {
                    await refreshTables();
                }
            } else {
                setQueryResult({
                    success: false,
                    error: data.message,
                    detail: data.detail,
                    hint: data.hint,
                    executionTime: execTime
                });
                setQueryHistory(prev => [{ query: sqlQuery, timestamp: new Date(), success: false, error: data.message }, ...prev.slice(0, 49)]);
            }
        } catch (error) {
            setQueryResult({ success: false, error: error.message, executionTime: Date.now() - startTime });
        }
        setIsExecuting(false);
    };

    const handleSort = (column) => {
        let newDir = "asc";
        if (tableSortColumn === column) {
            newDir = tableSortDirection === "asc" ? "desc" : "asc";
        }
        setTableSortColumn(column);
        setTableSortDirection(newDir);
        if (selectedTable) {
            fetchTableData(selectedTable.name, selectedTable.schema, 1, column, newDir);
        }
    };

    const toggleSchema = (schema) => {
        setExpandedSchemas(prev => ({ ...prev, [schema]: !prev[schema] }));
    };

    const openConnectionModal = () => {
        setNewConnection({ name: "", url: "", host: "", port: "5432", database: "", user: "", password: "", sslMode: "require" });
        setConnectionMode("params");
        setShowConnectionModal(true);
    };

    const closeConnectionModal = () => {
        if (isConnecting) {
            return;
        }

        setShowConnectionModal(false);
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
    };

    const exportResults = () => {
        if (!queryResult?.rows?.length) return;
        const headers = queryResult.fields.map(f => f.name);
        const csv = [headers.join(","), ...queryResult.rows.map(row => headers.map(h => JSON.stringify(row[h] ?? "")).join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "query-results.csv";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const retryFetch = () => {
        setIsLoaded(false);
        setBackendError(false);
        const fetchData = async () => {
            try {
                await fetchSavedConnections();
                setIsLoaded(true);
            } catch (error) {
                setBackendError(true);
                setIsLoaded(true);
            }
        };
        fetchData();
    };

    const filteredConnections = useMemo(() => {
        if (!connectionSearch.trim()) return savedConnections;
        const searchLower = connectionSearch.toLowerCase();
        return savedConnections.filter(conn => 
            conn.connection_name?.toLowerCase().includes(searchLower) ||
            conn.host?.toLowerCase().includes(searchLower) ||
            conn.database_name?.toLowerCase().includes(searchLower)
        );
    }, [savedConnections, connectionSearch]);

    const filteredTables = useMemo(() => {
        if (!tableSearch.trim()) return tables;
        const searchLower = tableSearch.toLowerCase();
        return tables.filter(table => 
            table.name?.toLowerCase().includes(searchLower) ||
            table.schema?.toLowerCase().includes(searchLower)
        );
    }, [tables, tableSearch]);

    const groupedTables = useMemo(() => {
        const grouped = {};
        filteredTables.forEach(table => {
            if (!grouped[table.schema]) grouped[table.schema] = [];
            grouped[table.schema].push(table);
        });
        return grouped;
    }, [filteredTables]);

    const resultColumns = useMemo(() => {
        if (!queryResult?.fields?.length) {
            return [];
        }

        return queryResult.fields.map((field) => ({ key: field.name, label: field.name, sortable: true }));
    }, [queryResult]);

    const tableDataColumns = useMemo(() => {
        if (!tableData?.fields?.length) {
            return [];
        }

        return tableData.fields.map((field) => ({ key: field.name, label: field.name, sortable: true }));
    }, [tableData]);

    const inspectCell = (column, row) => {
        setOpenCell({ column: column.key, value: row[column.key] });
    };

    const inspectRow = (row, columns) => {
        setOpenRow({ row, columns });
    };

    const changePageSize = (size) => {
        setTablePageSize(size);

        if (selectedTable) {
            fetchTableData(selectedTable.name, selectedTable.schema, 1, tableSortColumn, tableSortDirection, size);
        }
    };

    const clearEditor = () => {
        setSqlQuery("");
    };

    const schemaColumnRows = useMemo(() => {
        if (!tableSchema?.columns?.length) {
            return [];
        }

        return tableSchema.columns.map((column) => ({
            name: column.column_name,
            type: `${column.data_type}${column.character_maximum_length ? `(${column.character_maximum_length})` : ""}`,
            nullable: column.is_nullable,
            default: column.column_default || "-"
        }));
    }, [tableSchema]);

    const schemaConstraintRows = useMemo(() => {
        if (!tableSchema?.constraints?.length) {
            return [];
        }

        return tableSchema.constraints.map((constraint) => ({
            name: constraint.constraint_name,
            type: constraint.constraint_type,
            column: constraint.column_name,
            references: constraint.foreign_table_name
                ? `${constraint.foreign_table_name}.${constraint.foreign_column_name}`
                : "-"
        }));
    }, [tableSchema]);

    const schemaIndexRows = useMemo(() => {
        if (!tableSchema?.indexes?.length) {
            return [];
        }

        return tableSchema.indexes.map((index) => ({
            name: index.indexname,
            definition: index.indexdef
        }));
    }, [tableSchema]);

    const renderConnectionModal = () => {
        if (!showConnectionModal) return null;
        return (
            <div className="dbModalOverlay">
                <div className="dbModal">
                    <div className="dbModalHeader">
                        <span className="dbModalTitle">New Database Connection</span>
                        <button className="dbModalClose" onClick={closeConnectionModal}>×</button>
                    </div>
                    <div className="dbModalContent">
                        <div className="dbFormGroup">
                            <label>Connection Name</label>
                            <input type="text" value={newConnection.name} onChange={(e) => setNewConnection({ ...newConnection, name: e.target.value })} placeholder="My Database" className="dbInput" />
                        </div>
                        <div className="dbConnectionModeToggle">
                            <button className={`dbModeButton ${connectionMode === "params" ? "active" : ""}`} onClick={() => setConnectionMode("params")}>Parameters</button>
                            <button className={`dbModeButton ${connectionMode === "url" ? "active" : ""}`} onClick={() => setConnectionMode("url")}>Connection URL</button>
                        </div>
                        {connectionMode === "url" ? (
                            <div className="dbFormGroup">
                                <label>Connection URL</label>
                                <input type="text" value={newConnection.url} onChange={(e) => setNewConnection({ ...newConnection, url: e.target.value })} placeholder="postgresql://user:password@host:5432/database" className="dbInput" />
                            </div>
                        ) : (
                            <>
                                <div className="dbFormRow">
                                    <div className="dbFormGroup">
                                        <label>Host</label>
                                        <input type="text" value={newConnection.host} onChange={(e) => setNewConnection({ ...newConnection, host: e.target.value })} placeholder="localhost" className="dbInput" />
                                    </div>
                                    <div className="dbFormGroup dbFormGroupSmall">
                                        <label>Port</label>
                                        <input type="text" value={newConnection.port} onChange={(e) => setNewConnection({ ...newConnection, port: e.target.value })} placeholder="5432" className="dbInput" />
                                    </div>
                                </div>
                                <div className="dbFormGroup">
                                    <label>Database</label>
                                    <input type="text" value={newConnection.database} onChange={(e) => setNewConnection({ ...newConnection, database: e.target.value })} placeholder="postgres" className="dbInput" />
                                </div>
                                <div className="dbFormRow">
                                    <div className="dbFormGroup">
                                        <label>Username</label>
                                        <input type="text" value={newConnection.user} onChange={(e) => setNewConnection({ ...newConnection, user: e.target.value })} placeholder="postgres" className="dbInput" />
                                    </div>
                                    <div className="dbFormGroup">
                                        <label>Password</label>
                                        <input type="password" value={newConnection.password} onChange={(e) => setNewConnection({ ...newConnection, password: e.target.value })} placeholder="••••••••" className="dbInput" />
                                    </div>
                                </div>
                                <div className="dbFormGroup">
                                    <label>SSL Mode</label>
                                    <Dropdown
                                        className="dbSslDropdown"
                                        value={(sslModes.find(mode => mode.value === newConnection.sslMode) || {}).label || ""}
                                        onChange={(label) => {
                                            const selectedMode = sslModes.find(mode => mode.label === label);
                                            if (selectedMode) {
                                                setNewConnection({ ...newConnection, sslMode: selectedMode.value });
                                            }
                                        }}
                                        options={sslModes.map(mode => mode.label)}
                                        placeholder="SSL Mode"
                                    />
                                </div>
                            </>
                        )}
                    </div>
                    <div className="dbModalActions">
                        <button className="dbButton secondary" onClick={testConnection} disabled={isConnecting}>Test</button>
                        <button className="dbButton secondary" onClick={closeConnectionModal}>Cancel</button>
                        <button className="dbButton primary" onClick={connectWithParams} disabled={isConnecting}>Connect</button>
                        <button className="dbButton primary" onClick={saveConnection} disabled={isConnecting}>Save</button>
                    </div>
                </div>
            </div>
        );
    };

    const renderSidebar = () => (
        <div className="dbSidebar">
            <div className="dbSidebarHeader">
                <span className="dbSidebarTitle">Database Explorer</span>
            </div>
            <div className="dbSidebarContent">
                <button className="dbNewConnectionButton" onClick={openConnectionModal}>
                    <FontAwesomeIcon icon={faPlus} /> New Connection
                </button>

                {activeConnection ? (
                    <>
                        <div className="dbActiveConnection">
                            <div className="dbConnectionStatus">
                                <span className="dbStatusDot active" />
                                <span className="dbStatusText">Connected</span>
                            </div>
                            <div className="dbConnectionName">{activeConnection.connection_name}</div>
                            <div className="dbConnectionDetails">{activeConnection.host}:{activeConnection.port}/{activeConnection.database_name}</div>
                            <button className="dbDisconnectButton" onClick={disconnectDatabase}>Disconnect</button>
                        </div>

                        <div className="dbTablesSection">
                            <div className="dbTablesSectionHeader">
                                <span>Tables</span>
                                <button className="dbRefreshButton" onClick={refreshTables} disabled={isLoadingTables}>
                                    <FontAwesomeIcon icon={faRefresh} spin={isLoadingTables} />
                                </button>
                            </div>
                            <div className="dbSearchWrapper">
                                <FontAwesomeIcon icon={faSearch} className="dbSearchIcon" />
                                <input
                                    type="text"
                                    className="dbSearchInput"
                                    placeholder="Search Tables"
                                    value={tableSearch}
                                    onChange={(e) => setTableSearch(e.target.value)}
                                />
                            </div>
                            <div className="dbTableList">
                                {Object.entries(groupedTables).map(([schema, schemaTables]) => (
                                    <div key={schema} className="dbSchemaGroup">
                                        <div className="dbSchemaHeader" onClick={() => toggleSchema(schema)}>
                                            <FontAwesomeIcon icon={expandedSchemas[schema] ? faAngleDown : faAngleRight} />
                                            <span>{schema}</span>
                                            <span className="dbSchemaCount">{schemaTables.length}</span>
                                        </div>
                                        {expandedSchemas[schema] && (
                                            <div className="dbSchemaTables">
                                                {schemaTables.map(table => (
                                                    <div key={table.fullName} className={`dbTableItem ${selectedTable?.fullName === table.fullName ? "selected" : ""}`} onClick={() => selectTable(table)}>
                                                        <span>{table.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {Object.keys(groupedTables).length === 0 && !isLoadingTables && (
                                    <div className="dbNoTables">{tableSearch ? "No matching tables were found." : "No tables were found."}</div>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="dbSavedConnectionsList">
                        <div className="dbSavedConnectionsHeader">Saved Connections</div>
                        <div className="dbSearchWrapper">
                            <FontAwesomeIcon icon={faSearch} className="dbSearchIcon" />
                            <input
                                type="text"
                                className="dbSearchInput"
                                placeholder="Search Connections"
                                value={connectionSearch}
                                onChange={(e) => setConnectionSearch(e.target.value)}
                            />
                        </div>
                        {filteredConnections.map(conn => (
                            <div key={conn.id} className="dbSavedConnection">
                                <div className="dbSavedConnectionInfo" onClick={() => connectToDatabase(conn)}>
                                    <div className="dbSavedConnectionName">{conn.connection_name}</div>
                                    <div className="dbSavedConnectionHost" title={`${conn.host}:${conn.port}`}>{conn.host}:{conn.port}</div>
                                </div>
                                <button className="dbDeleteButton" onClick={(e) => { e.stopPropagation(); deleteConnection(conn.id); }}>
                                    <FontAwesomeIcon icon={faTrash} />
                                </button>
                            </div>
                        ))}
                        {filteredConnections.length === 0 && (
                            <div className="dbNoConnections">{connectionSearch ? "No matching connections were found." : "There are no saved connections."}</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    const renderEditor = () => (
        <div className={`dbEditorPanel ${editorFullscreen ? "fullscreen" : ""}`}>
            <div className="dbEditorTabs">
                <button className={`dbEditorTab ${activeTab === "editor" ? "active" : ""}`} onClick={() => setActiveTab("editor")}>SQL Editor</button>
                {selectedTable && (
                    <>
                        <button className={`dbEditorTab ${activeTab === "data" ? "active" : ""}`} onClick={() => setActiveTab("data")}>Data</button>
                        <button className={`dbEditorTab ${activeTab === "schema" ? "active" : ""}`} onClick={() => setActiveTab("schema")}>Schema</button>
                    </>
                )}
                <button className={`dbEditorTab ${activeTab === "history" ? "active" : ""}`} onClick={() => setActiveTab("history")}>History</button>
            </div>

            <div className="dbEditorContent">
                {activeTab === "editor" && (
                    <div className="dbSqlEditorWrapper">
                        <div className="dbSqlEditor">
                            <SqlEditor
                                value={sqlQuery}
                                onChange={(e) => setSqlQuery(e.target.value)}
                                onExecute={executeQuery}
                            />
                        </div>
                        <div className="dbEditorToolbar">
                            <button className="dbRunButton" onClick={executeQuery} disabled={isExecuting || (!activeConnectionID && !connectionConfig)}>
                                <FontAwesomeIcon icon={faPlay} /> {isExecuting ? "Executing" : "Run Query"}
                            </button>
                            <div className="dbToolbarGroup">
                                <button className="dbOperationsButton" onClick={() => copyToClipboard(sqlQuery)} disabled={!sqlQuery.trim()}>
                                    <FontAwesomeIcon icon={faCopy} /> Copy
                                </button>
                                <button className="dbOperationsButton" onClick={clearEditor} disabled={!sqlQuery.trim()}>
                                    <FontAwesomeIcon icon={faBroom} /> Clear
                                </button>
                            </div>
                            <div className="dbPaginationSize">
                                <span className="dbPaginationLabel">Default Limit</span>
                                {ROW_LIMIT_OPTIONS.map((limit) => (
                                    <button
                                        key={limit}
                                        className={`dbOperationsButton${rowLimit === limit ? " isActive" : ""}`}
                                        onClick={() => setRowLimit(limit)}
                                        title={limit ? `Add LIMIT ${limit} to SELECT queries that do not set their own limit.` : "Run SELECT queries without adding a limit."}
                                    >
                                        {limit || "None"}
                                    </button>
                                ))}
                            </div>
                            <span className="dbShortcutHint">Ctrl/Cmd + Enter To Execute</span>
                            <span className="dbToolbarSpacer" />
                            <div className="dbStatusGroup">
                                <span className="dbStatusItem">
                                    <FontAwesomeIcon icon={faDatabase} />
                                    <span>{activeConnection?.database_name || "No Database"}</span>
                                </span>
                            </div>
                        </div>
                        {queryResult && (
                            <div className="dbQueryResults">
                                <div className={`dbResultHeader ${queryResult.success ? "success" : "error"}`}>
                                    <div className="dbResultSummary">
                                        <span className="dbResultStatus">
                                            {queryResult.success ? `${queryResult.command || "Query"} Completed` : "Query Failed"}
                                        </span>
                                        <div className="dbStatusGroup">
                                            {queryResult.success && (
                                                <span className="dbStatusItem">
                                                    <span>{queryResult.rowCount ?? 0} Rows</span>
                                                </span>
                                            )}
                                            {queryResult.success && queryResult.limitApplied && (
                                                <span className="dbStatusItem" title="Add your own LIMIT or choose None to see more rows.">
                                                    <span>{(queryResult.rowCount ?? 0) >= queryResult.limitApplied ? `Capped At ${queryResult.limitApplied}` : `Limit ${queryResult.limitApplied}`}</span>
                                                </span>
                                            )}
                                            <span className="dbStatusItem">
                                                <span>{queryResult.executionTime} ms</span>
                                            </span>
                                        </div>
                                    </div>
                                    <div className="dbResultActions">
                                        {queryResult.success && queryResult.rows?.length > 0 && (
                                            <button className="dbOperationsButton" onClick={() => copyToClipboard(JSON.stringify(queryResult.rows, null, 2))}>
                                                <FontAwesomeIcon icon={faCopy} /> Copy JSON
                                            </button>
                                        )}
                                        <button className="dbOperationsButton" onClick={() => setQueryResult(null)}>
                                            <FontAwesomeIcon icon={faTimes} /> Dismiss
                                        </button>
                                    </div>
                                </div>
                                {queryResult.success && queryResult.rows?.length > 0 ? (
                                    <DataGrid
                                        columns={resultColumns}
                                        rows={queryResult.rows}
                                        emptyMessage="This query returned no rows."
                                        onCellClick={inspectCell}
                                        onRowClick={inspectRow}
                                        clientSort
                                        searchable
                                        actions={(
                                            <button className="dbOperationsButton dbGridIconButton" onClick={exportResults} title="Export These Rows As CSV">
                                                <FontAwesomeIcon icon={faDownload} />
                                            </button>
                                        )}
                                    />
                                ) : !queryResult.success ? (
                                    <div className="dbErrorMessage">
                                        <div className="dbErrorText">{queryResult.error}</div>
                                        {queryResult.detail && <div className="dbErrorDetail">{queryResult.detail}</div>}
                                        {queryResult.hint && <div className="dbErrorHint">Hint: {queryResult.hint}</div>}
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "data" && selectedTable && (
                    <div className="dbDataViewer">
                        <div className="dbTableStats">
                            <div className="dbStatusGroup">
                                <span className="dbStatusItem">
                                    <FontAwesomeIcon icon={faTable} />
                                    <span>{selectedTable.schema}.{selectedTable.name}</span>
                                </span>
                                {tableStats && (
                                    <>
                                        <span className="dbStatusItem"><span>{tableStats.row_count} Rows</span></span>
                                        <span className="dbStatusItem"><span>Table {tableStats.table_size}</span></span>
                                        <span className="dbStatusItem"><span>Indexes {tableStats.indexes_size}</span></span>
                                        <span className="dbStatusItem"><span>Total {tableStats.total_size}</span></span>
                                    </>
                                )}
                            </div>
                            <span className="dbToolbarSpacer" />
                            <button className="dbOperationsButton" onClick={() => fetchTableData(selectedTable.name, selectedTable.schema, tablePage, tableSortColumn, tableSortDirection)} disabled={isLoadingData}>
                                <FontAwesomeIcon icon={faRefresh} spin={isLoadingData} /> Reload
                            </button>
                        </div>
                        {isLoadingData ? (
                            <div className="dbLoadingData">
                                <div className="loading-circle" />
                            </div>
                        ) : tableData?.rows?.length > 0 ? (
                            <>
                                <DataGrid
                                    columns={tableDataColumns}
                                    rows={tableData.rows}
                                    emptyMessage="This table has no data."
                                    onCellClick={inspectCell}
                                    onRowClick={inspectRow}
                                    sortColumn={tableSortColumn}
                                    sortDirection={tableSortDirection}
                                    onSort={handleSort}
                                    searchable
                                />
                                <div className="dbPagination">
                                    <div className="dbPaginationSize">
                                        <span className="dbPaginationLabel">Rows Per Page</span>
                                        {[25, 50, 100, 250].map((size) => (
                                            <button
                                                key={size}
                                                className={`dbOperationsButton${tablePageSize === size ? " isActive" : ""}`}
                                                onClick={() => changePageSize(size)}
                                                disabled={isLoadingData}
                                            >
                                                {size}
                                            </button>
                                        ))}
                                    </div>
                                    <span className="dbToolbarSpacer" />
                                    <div className="dbPaginationControls">
                                        <button className="dbOperationsButton" onClick={() => fetchTableData(selectedTable.name, selectedTable.schema, 1, tableSortColumn, tableSortDirection)} disabled={tablePage <= 1}>
                                            First
                                        </button>
                                        <button className="dbOperationsButton" onClick={() => fetchTableData(selectedTable.name, selectedTable.schema, tablePage - 1, tableSortColumn, tableSortDirection)} disabled={tablePage <= 1}>
                                            <FontAwesomeIcon icon={faChevronLeft} />
                                        </button>
                                        <div className="dbStatusGroup">
                                            <span className="dbStatusItem"><span>Page {tablePage} Of {tableData.totalPages}</span></span>
                                            <span className="dbStatusItem"><span>{tableData.totalCount} Rows</span></span>
                                        </div>
                                        <button className="dbOperationsButton" onClick={() => fetchTableData(selectedTable.name, selectedTable.schema, tablePage + 1, tableSortColumn, tableSortDirection)} disabled={tablePage >= tableData.totalPages}>
                                            <FontAwesomeIcon icon={faChevronRight} />
                                        </button>
                                        <button className="dbOperationsButton" onClick={() => fetchTableData(selectedTable.name, selectedTable.schema, tableData.totalPages, tableSortColumn, tableSortDirection)} disabled={tablePage >= tableData.totalPages}>
                                            Last
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="dbNoData">This table has no data.</div>
                        )}
                    </div>
                )}

                {activeTab === "schema" && selectedTable && tableSchema && (
                    <div className="dbSchemaViewer">
                        <div className="dbSchemaSection">
                            <div className="dbSchemaSectionHeader">
                                <span className="dbSchemaSectionTitle">Columns</span>
                                <span className="dbSchemaSectionCount">{schemaColumnRows.length}</span>
                            </div>
                            <DataGrid
                                columns={SCHEMA_COLUMN_FIELDS}
                                rows={schemaColumnRows}
                                emptyMessage="No columns were found."
                                visibleRows={12}
                            />
                        </div>
                        {tableSchema.constraints?.length > 0 && (
                            <div className="dbSchemaSection">
                                <div className="dbSchemaSectionHeader">
                                    <span className="dbSchemaSectionTitle">Constraints</span>
                                    <span className="dbSchemaSectionCount">{schemaConstraintRows.length}</span>
                                </div>
                                <DataGrid
                                    columns={SCHEMA_CONSTRAINT_FIELDS}
                                    rows={schemaConstraintRows}
                                    emptyMessage="No constraints were found."
                                    visibleRows={10}
                                />
                            </div>
                        )}
                        {tableSchema.indexes?.length > 0 && (
                            <div className="dbSchemaSection">
                                <div className="dbSchemaSectionHeader">
                                    <span className="dbSchemaSectionTitle">Indexes</span>
                                    <span className="dbSchemaSectionCount">{schemaIndexRows.length}</span>
                                </div>
                                <DataGrid
                                    columns={SCHEMA_INDEX_FIELDS}
                                    rows={schemaIndexRows}
                                    emptyMessage="No indexes were found."
                                    visibleRows={10}
                                />
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "history" && (
                    <div className="dbHistoryViewer">
                        {queryHistory.length > 0 ? (
                            <div className="dbHistoryList">
                                {queryHistory.map((item, i) => (
                                    <div key={i} className={`dbHistoryItem ${item.success ? "success" : "error"}`} onClick={() => { setSqlQuery(item.query); setActiveTab("editor"); }}>
                                        <div className="dbHistoryQuery">{item.query}</div>
                                        <div className="dbHistoryMeta">
                                            <span className={`dbHistoryStatus ${item.success ? "success" : "error"}`}>{item.success ? "Success" : "Failed"}</span>
                                            <span>{item.success ? `${item.rowCount} Rows` : ""}</span>
                                            <span>{item.timestamp.toLocaleTimeString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="dbNoHistory">There is no query history yet.</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    const renderWelcome = () => (
        <div className="dbWelcome">
            <div className="dbWelcomeContent">
                <div className="dbWelcomeTitle">Database Explorer</div>
                <p className="dbWelcomeText">Connect to a PostgreSQL database to browse tables, run queries, and manage your data.</p>
                <button className="dbWelcomeButton" onClick={openConnectionModal}>
                    <FontAwesomeIcon icon={faPlus} /> New Connection
                </button>
            </div>
        </div>
    );

    return (
        <div className="dbPageWrapper">
            <Nav activePage="database" />
            {isLoaded ? (
                backendError ? (
                    <div className="dbErrorState">
                        <div className="dbErrorStateContent">
                            <div className="dbErrorStateTitle">Unable To Connect</div>
                            <p className="dbErrorStateText">Please check your internet connection and try again.</p>
                            <button className="dbErrorStateButton" onClick={retryFetch}>Retry</button>
                        </div>
                    </div>
                ) : (
                    <div className="dbContainer">
                        {renderSidebar()}
                        <div className="dbMainContent">
                            {activeConnection ? renderEditor() : renderWelcome()}
                        </div>
                    </div>
                )
            ) : (
                <div className="dbCellHeaderContainer" style={{ justifyContent: "center" }}>
                    <div className="loading-wrapper">
                        <div className="loading-circle" />
                        <label className="loading-title">
                            Loading
                        </label>
                    </div>
                </div>
            )}
            {renderConnectionModal()}

            {openRow && (
                <div
                    className="dbCellScrim"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setOpenRow(null);
                        }
                    }}
                >
                    <div className="dbCellModal isRow">
                        <div className="dbCellHead">
                            <span className="dbCellColumn">Row Detail</span>
                            <span className="dbCellType">{openRow.columns.length} Columns</span>
                            <button
                                className="dbCellAction"
                                onClick={() => copyToClipboard(JSON.stringify(openRow.row, null, 2))}
                            >
                                <FontAwesomeIcon icon={faCopy} /> Copy
                            </button>
                            <button className="dbCellAction" onClick={() => setOpenRow(null)}>
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        </div>
                        <div className="dbRowBody">
                            {openRow.columns.map((column) => (
                                <div key={column.key} className="dbRowField">
                                    <span className="dbRowFieldName">{column.label}</span>
                                    <span className="dbRowFieldValue">{renderCellValue(openRow.row[column.key])}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {openCell && (
                <div
                    className="dbCellScrim"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setOpenCell(null);
                        }
                    }}
                >
                    <div className="dbCellModal">
                        <div className="dbCellHead">
                            <span className="dbCellColumn">{openCell.column}</span>
                            <span className="dbCellType">
                                {openCell.value === null ? "null" : typeof openCell.value}
                            </span>
                            <button
                                className="dbCellAction"
                                onClick={() => copyToClipboard(
                                    typeof openCell.value === "object" && openCell.value !== null
                                        ? JSON.stringify(openCell.value, null, 2)
                                        : String(openCell.value ?? "")
                                )}
                            >
                                <FontAwesomeIcon icon={faCopy} /> Copy
                            </button>
                            <button className="dbCellAction" onClick={() => setOpenCell(null)}>
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        </div>
                        <pre className="dbCellBody">
                            {openCell.value === null
                                ? "null"
                                : typeof openCell.value === "object"
                                ? JSON.stringify(openCell.value, null, 2)
                                : String(openCell.value)}
                        </pre>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Database;