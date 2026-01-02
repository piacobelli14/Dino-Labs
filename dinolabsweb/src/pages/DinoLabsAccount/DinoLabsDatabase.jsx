import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faDatabase,
    faPlus,
    faTrash,
    faPlay,
    faTable,
    faCode,
    faColumns,
    faKey,
    faLink,
    faUnlink,
    faSave,
    faTimes,
    faChevronLeft,
    faChevronRight,
    faChevronDown,
    faChevronUp,
    faRefresh,
    faDownload,
    faCopy,
    faGlobe,
    faAngleDown,
    faAngleRight,
    faEye,
    faHistory,
    faSearch
} from "@fortawesome/free-solid-svg-icons";
import DinoLabsNav from "../../helpers/Nav";
import useAuth from "../../UseAuth";
import { showDialog } from "../../helpers/Alert.jsx";
import "../../styles/mainStyles/DinoLabsAccount/DinoLabsDatabase.css";
import "../../styles/helperStyles/LoadingSpinner.css";
import "../../styles/helperStyles/Disconnected.css";

const DinoLabsDatabase = () => {
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
    const [queryResult, setQueryResult] = useState(null);
    const [isExecuting, setIsExecuting] = useState(false);
    const [queryHistory, setQueryHistory] = useState([]);
    const [expandedSchemas, setExpandedSchemas] = useState({ public: true });
    const [tablePage, setTablePage] = useState(1);
    const [tablePageSize] = useState(50);
    const [tableSortColumn, setTableSortColumn] = useState(null);
    const [tableSortDirection, setTableSortDirection] = useState("asc");
    const [isLoadingTables, setIsLoadingTables] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [editorFullscreen, setEditorFullscreen] = useState(false);
    const [connectionSearch, setConnectionSearch] = useState("");
    const [tableSearch, setTableSearch] = useState("");

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

    const connectionModalRef = useRef(null);
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

    useEffect(() => {
        const handleClickOutside = (event) => {
            const alertOverlay = document.querySelector(".dinolabsAlertOverlay");
            if (alertOverlay) return;
            if (connectionModalRef.current && !connectionModalRef.current.contains(event.target)) {
                closeConnectionModal();
            }
        };
        if (showConnectionModal) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showConnectionModal]);

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
            if (!response.ok) throw new Error("Failed to fetch connections");
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
                await showDialog({ title: "Success", message: "Connection Test Successful!" });
            } else {
                await showDialog({ title: "Error", message: data.message || "Connection Test Failed." });
            }
        } catch (error) {
            await showDialog({ title: "Error", message: "Connection Test Failed. Please Check Your Parameters." });
        }
        setIsConnecting(false);
    };

    const saveConnection = async () => {
        if (!newConnection.name.trim()) {
            await showDialog({ title: "Error", message: "Connection Name Is Required." });
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
                await showDialog({ title: "Success", message: "Connection Saved Successfully!" });
            } else {
                await showDialog({ title: "Error", message: data.message || "Failed To Save Connection." });
            }
        } catch (error) {
            await showDialog({ title: "Error", message: "Failed To Save Connection." });
        }
        setIsConnecting(false);
    };

    const deleteConnection = async (connectionID) => {
        const confirm = await showDialog({ title: "Confirm Delete", message: "Are You Sure You Want To Delete This Connection?", showCancel: true });
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
            await showDialog({ title: "Error", message: "Failed To Delete Connection." });
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
                await showDialog({ title: "Error", message: data.message || "Connection Failed." });
            }
        } catch (error) {
            await showDialog({ title: "Error", message: "Connection Failed." });
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
                    await showDialog({ title: "Error", message: "Invalid Connection URL Format." });
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
                setActiveConnection({ connection_name: "Direct Connection", host: config.host, port: config.port, database_name: config.database });
                setActiveConnectionID(null);
                setConnectionConfig(config);
                await fetchTablesWithConfig(config);
                closeConnectionModal();
                setActiveTab("editor");
            } else {
                await showDialog({ title: "Error", message: data.message || "Connection Failed." });
            }
        } catch (error) {
            await showDialog({ title: "Error", message: "Connection Failed." });
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
            console.error("Failed to fetch tables:", error);
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
            console.error("Failed to fetch tables:", error);
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
            console.error("Failed to fetch schema:", error);
        }
    };

    const fetchTableData = async (tableName, schemaName, page = 1, sortCol = null, sortDir = "asc") => {
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
                    pageSize: tablePageSize,
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
            console.error("Failed to fetch data:", error);
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
            console.error("Failed to fetch stats:", error);
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

    const executeQuery = async () => {
        if (!sqlQuery.trim()) return;
        setIsExecuting(true);
        setQueryResult(null);
        const startTime = Date.now();
        try {
            const token = localStorage.getItem("token");
            const payload = getConnectionPayload();
            if (!payload) {
                setQueryResult({ success: false, error: "No active connection.", executionTime: 0 });
                setIsExecuting(false);
                return;
            }
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/database/query`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ ...payload, query: sqlQuery })
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
                    executionTime: execTime
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

    const formatValue = (value) => {
        if (value === null) return <span className="dbNullValue">NULL</span>;
        if (value === undefined) return "";
        if (typeof value === "object") return JSON.stringify(value);
        if (typeof value === "boolean") return value ? "true" : "false";
        return String(value);
    };

    const renderConnectionModal = () => {
        if (!showConnectionModal) return null;
        return (
            <div className="dbModalOverlay">
                <div className="dbModal" ref={connectionModalRef}>
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
                                    <select value={newConnection.sslMode} onChange={(e) => setNewConnection({ ...newConnection, sslMode: e.target.value })} className="dbSelect">
                                        {sslModes.map(mode => (
                                            <option key={mode.value} value={mode.value}>{mode.label}</option>
                                        ))}
                                    </select>
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
                                    placeholder="Search tables..."
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
                                    <div className="dbNoTables">{tableSearch ? "No matching tables found." : "No tables found."}</div>
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
                                placeholder="Search connections..."
                                value={connectionSearch}
                                onChange={(e) => setConnectionSearch(e.target.value)}
                            />
                        </div>
                        {filteredConnections.map(conn => (
                            <div key={conn.id} className="dbSavedConnection">
                                <div className="dbSavedConnectionInfo" onClick={() => connectToDatabase(conn)}>
                                    <div className="dbSavedConnectionName">{conn.connection_name}</div>
                                    <div className="dbSavedConnectionHost">{conn.host}:{conn.port}</div>
                                </div>
                                <button className="dbDeleteButton" onClick={(e) => { e.stopPropagation(); deleteConnection(conn.id); }}>
                                    <FontAwesomeIcon icon={faTrash} />
                                </button>
                            </div>
                        ))}
                        {filteredConnections.length === 0 && (
                            <div className="dbNoConnections">{connectionSearch ? "No matching connections found." : "No saved connections."}</div>
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
                            <textarea ref={editorRef} className="dbSqlTextarea" value={sqlQuery} onChange={(e) => setSqlQuery(e.target.value)} placeholder="Enter your SQL query here..." spellCheck={false} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { executeQuery(); } }} />
                        </div>
                        <div className="dbEditorToolbar">
                            <button className="dbRunButton" onClick={executeQuery} disabled={isExecuting || (!activeConnectionID && !connectionConfig)}>
                                <FontAwesomeIcon icon={faPlay} /> {isExecuting ? "Executing..." : "Run Query"}
                            </button>
                            <span className="dbShortcutHint">Ctrl/Cmd + Enter to execute</span>
                        </div>
                        {queryResult && (
                            <div className="dbQueryResults">
                                <div className={`dbResultHeader ${queryResult.success ? "success" : "error"}`}>
                                    <span className="dbResultStatus">
                                        {queryResult.success ? `${queryResult.command || "Query"} completed • ${queryResult.rowCount ?? 0} rows` : "Query Failed"}
                                    </span>
                                    <div className="dbResultActions">
                                        <span className="dbResultTime">{queryResult.executionTime}ms</span>
                                        {queryResult.success && queryResult.rows?.length > 0 && (
                                            <>
                                                <button className="dbResultAction" onClick={exportResults} title="Export CSV">
                                                    <FontAwesomeIcon icon={faDownload} />
                                                </button>
                                                <button className="dbResultAction" onClick={() => copyToClipboard(JSON.stringify(queryResult.rows, null, 2))} title="Copy JSON">
                                                    <FontAwesomeIcon icon={faCopy} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                {queryResult.success && queryResult.rows?.length > 0 ? (
                                    <div className="dbResultTable">
                                        <table>
                                            <thead>
                                                <tr>
                                                    {queryResult.fields.map(field => (
                                                        <th key={field.name}>{field.name}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {queryResult.rows.map((row, i) => (
                                                    <tr key={i}>
                                                        {queryResult.fields.map(field => (
                                                            <td key={field.name}>{formatValue(row[field.name])}</td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
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
                        {tableStats && (
                            <div className="dbTableStats">
                                <span><strong>Rows:</strong> {tableStats.row_count}</span>
                                <span><strong>Table Size:</strong> {tableStats.table_size}</span>
                                <span><strong>Index Size:</strong> {tableStats.indexes_size}</span>
                                <span><strong>Total:</strong> {tableStats.total_size}</span>
                            </div>
                        )}
                        {isLoadingData ? (
                            <div className="dbLoadingData">
                                <div className="loading-circle" />
                            </div>
                        ) : tableData?.rows?.length > 0 ? (
                            <>
                                <div className="dbDataTable">
                                    <table>
                                        <thead>
                                            <tr>
                                                {tableData.fields.map(field => (
                                                    <th key={field.name} onClick={() => handleSort(field.name)} className="dbSortableHeader">
                                                        {field.name}
                                                        {tableSortColumn === field.name && (
                                                            <span className="dbSortIndicator">{tableSortDirection === "asc" ? "↑" : "↓"}</span>
                                                        )}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tableData.rows.map((row, i) => (
                                                <tr key={i}>
                                                    {tableData.fields.map(field => (
                                                        <td key={field.name}>{formatValue(row[field.name])}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="dbPagination">
                                    <button className="dbPaginationButton" onClick={() => fetchTableData(selectedTable.name, selectedTable.schema, tablePage - 1, tableSortColumn, tableSortDirection)} disabled={tablePage <= 1}>
                                        <FontAwesomeIcon icon={faChevronLeft} />
                                    </button>
                                    <span className="dbPaginationInfo">Page {tablePage} of {tableData.totalPages} ({tableData.totalCount} rows)</span>
                                    <button className="dbPaginationButton" onClick={() => fetchTableData(selectedTable.name, selectedTable.schema, tablePage + 1, tableSortColumn, tableSortDirection)} disabled={tablePage >= tableData.totalPages}>
                                        <FontAwesomeIcon icon={faChevronRight} />
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="dbNoData">No data in table.</div>
                        )}
                    </div>
                )}

                {activeTab === "schema" && selectedTable && tableSchema && (
                    <div className="dbSchemaViewer">
                        <div className="dbSchemaSection">
                            <h4>Columns</h4>
                            <div className="dbSchemaTable">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Type</th>
                                            <th>Nullable</th>
                                            <th>Default</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tableSchema.columns.map(col => (
                                            <tr key={col.column_name}>
                                                <td>{col.column_name}</td>
                                                <td>{col.data_type}{col.character_maximum_length ? `(${col.character_maximum_length})` : ""}</td>
                                                <td>{col.is_nullable}</td>
                                                <td>{col.column_default || "-"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        {tableSchema.constraints?.length > 0 && (
                            <div className="dbSchemaSection">
                                <h4>Constraints</h4>
                                <div className="dbSchemaTable">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Name</th>
                                                <th>Type</th>
                                                <th>Column</th>
                                                <th>References</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tableSchema.constraints.map((con, i) => (
                                                <tr key={i}>
                                                    <td>{con.constraint_name}</td>
                                                    <td>{con.constraint_type}</td>
                                                    <td>{con.column_name}</td>
                                                    <td>{con.foreign_table_name ? `${con.foreign_table_name}.${con.foreign_column_name}` : "-"}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        {tableSchema.indexes?.length > 0 && (
                            <div className="dbSchemaSection">
                                <h4>Indexes</h4>
                                <div className="dbSchemaTable">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Name</th>
                                                <th>Definition</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tableSchema.indexes.map((idx, i) => (
                                                <tr key={i}>
                                                    <td>{idx.indexname}</td>
                                                    <td className="dbIndexDef">{idx.indexdef}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
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
                                            <span>{item.success ? `${item.rowCount} rows` : ""}</span>
                                            <span>{item.timestamp.toLocaleTimeString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="dbNoHistory">No query history.</div>
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
            <DinoLabsNav activePage="database" />
            {isLoaded ? (
                backendError ? (
                    <div className="dbErrorState">
                        <div className="dbErrorStateContent">
                            <div className="dbErrorStateTitle">Unable to Connect</div>
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
                <div className="dbLoadingState">
                    <div className="loading-circle" />
                </div>
            )}
            {renderConnectionModal()}
        </div>
    );
};

export default DinoLabsDatabase;