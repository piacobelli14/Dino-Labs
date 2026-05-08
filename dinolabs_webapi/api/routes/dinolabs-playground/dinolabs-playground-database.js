const express = require("express");
const { Pool } = require("pg");
const crypto = require("crypto");
const dns = require("dns").promises;
const { pool } = require("../../config/db");
const { authenticateToken } = require("../../middleware/auth");

require("dotenv").config();

const router = express.Router();

const ENCRYPTION_KEY = process.env.DATABASE_ENCRYPTION_KEY || "default-32-char-key-for-encrypt";
const IV_LENGTH = 16;

function encrypt(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decrypt(text) {
    const textParts = text.split(":");
    const iv = Buffer.from(textParts.shift(), "hex");
    const encryptedText = Buffer.from(textParts.join(":"), "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

function normalizeOrgId(val) {
    if (val === undefined || val === null) return null;
    const s = String(val).trim().toLowerCase();
    if (s === "" || s === "null" || s === "undefined") return null;
    return /^\d+$/.test(s) ? Number(s) : val;
}

function parseConnectionUrl(url) {
    try {
        const regex = /^postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:\/]+):?(\d+)?\/(.+)$/;
        const match = url.match(regex);
        if (!match) return null;
        return {
            user: decodeURIComponent(match[1]),
            password: decodeURIComponent(match[2]),
            host: match[3],
            port: parseInt(match[4]) || 5432,
            database: match[5].split("?")[0]
        };
    } catch (error) {
        return null;
    }
}

async function checkDnsResolution(hostname) {
    try {
        await dns.lookup(hostname);
        return { success: true };
    } catch (error) {
        return { 
            success: false, 
            error: `Cannot resolve hostname "${hostname}". Please verify the host address is correct. For Supabase, use the Connection Pooler URL from your dashboard.`
        };
    }
}

function getSslConfig(sslMode) {
    switch (sslMode) {
        case "disable":
            return false;
        case "allow":
        case "prefer":
            return { rejectUnauthorized: false };
        case "require":
            return { rejectUnauthorized: false };
        case "verify-ca":
            return { rejectUnauthorized: true };
        case "verify-full":
            return { rejectUnauthorized: true, checkServerIdentity: () => undefined };
        default:
            return { rejectUnauthorized: false };
    }
}

async function createExternalPool(config) {
    const sslConfig = getSslConfig(config.sslMode);
    
    const poolConfig = {
        host: config.host,
        port: config.port || 5432,
        database: config.database,
        user: config.user,
        password: String(config.password),
        connectionTimeoutMillis: 15000,
        idleTimeoutMillis: 30000,
        max: 5
    };

    if (sslConfig !== false) {
        poolConfig.ssl = sslConfig;
    }

    return new Pool(poolConfig);
}

async function createExternalPoolWithFallback(config) {
    const dnsCheck = await checkDnsResolution(config.host);
    if (!dnsCheck.success) {
        throw new Error(dnsCheck.error);
    }

    const sslModes = [config.sslMode, "require", "prefer", "disable"];
    const uniqueModes = [...new Set(sslModes)];
    
    let lastError = null;
    
    for (const mode of uniqueModes) {
        try {
            const testConfig = { ...config, sslMode: mode };
            const testPool = await createExternalPool(testConfig);
            const client = await testPool.connect();
            await client.query("SELECT 1");
            client.release();
            
            return { pool: testPool, actualSslMode: mode };
        } catch (error) {
            lastError = error;
        }
    }
    
    throw lastError;
}

async function getConnectionConfig(userID, organizationID, connectionID) {
    const query = `
        SELECT host, port, database_name, db_username, db_password_encrypted, ssl_mode
        FROM database_connections
        WHERE id = $1 AND username = $2 AND (orgid = $3 OR ($3 IS NULL AND orgid IS NULL))
    `;
    const result = await pool.query(query, [connectionID, userID, organizationID]);
    if (result.rowCount === 0) {
        return null;
    }
    const conn = result.rows[0];
    return {
        host: conn.host,
        port: conn.port,
        database: conn.database_name,
        user: conn.db_username,
        password: decrypt(conn.db_password_encrypted),
        sslMode: conn.ssl_mode
    };
}

async function resolveConnectionConfig(req) {
    const { userID, connectionID, connectionConfig } = req.body;
    let { organizationID } = req.body;
    organizationID = normalizeOrgId(organizationID);

    if (connectionID) {
        const config = await getConnectionConfig(userID, organizationID, connectionID);
        if (!config) {
            throw new Error("Connection Not Found Or Access Denied.");
        }
        return config;
    } else if (connectionConfig) {
        if (!connectionConfig.password) {
            throw new Error("Password Is Required For Direct Connections.");
        }
        return {
            host: connectionConfig.host,
            port: connectionConfig.port || 5432,
            database: connectionConfig.database,
            user: connectionConfig.user,
            password: String(connectionConfig.password),
            sslMode: connectionConfig.sslMode || "require"
        };
    } else {
        throw new Error("Connection ID Or Config Required.");
    }
}

router.post("/database/test-connection", authenticateToken, async (req, res) => {
    const { connectionUrl, host, port, database, user, password, sslMode } = req.body;
    let config;

    try {
        if (connectionUrl) {
            config = parseConnectionUrl(connectionUrl);
            if (!config) {
                return res.status(400).json({ message: "Invalid Connection URL Format." });
            }
            config.sslMode = sslMode || "require";
        } else {
            if (!host || !database || !user || !password) {
                return res.status(400).json({ message: "Missing Required Connection Parameters." });
            }
            config = { host, port: port || 5432, database, user, password: String(password), sslMode: sslMode || "require" };
        }

        const { pool: testPool, actualSslMode } = await createExternalPoolWithFallback(config);
        await testPool.end();

        return res.status(200).json({ 
            message: "Connection Successful.", 
            success: true,
            sslMode: actualSslMode
        });
    } catch (error) {
        let errorMessage = error.message;
        
        if (error.message.includes("ENOTFOUND") || error.message.includes("Cannot resolve hostname")) {
            errorMessage = `Cannot resolve hostname "${config?.host}". For Supabase, use the Connection Pooler URL (Settings → Database → Connection Pooling).`;
        } else if (error.message.includes("ECONNREFUSED")) {
            errorMessage = `Connection refused by "${config?.host}:${config?.port}". Check if the database is running and accessible.`;
        } else if (error.message.includes("timeout")) {
            errorMessage = `Connection timed out. The database may be behind a firewall or the host is incorrect.`;
        }
        
        return res.status(400).json({ message: `Connection Failed: ${errorMessage}`, success: false });
    }
});

router.post("/database/connections", authenticateToken, async (req, res) => {
    const { userID } = req.body;
    let { organizationID } = req.body;
    organizationID = normalizeOrgId(organizationID);

    try {
        const query = `
            SELECT id, connection_name, host, port, database_name, db_username, ssl_mode, created_at, last_connected_at
            FROM database_connections
            WHERE username = $1 AND (orgid = $2 OR ($2 IS NULL AND orgid IS NULL))
            ORDER BY last_connected_at DESC NULLS LAST, created_at DESC
        `;
        const result = await pool.query(query, [userID, organizationID]);
        return res.status(200).json({ connections: result.rows });
    } catch (error) {
        return res.status(500).json({ message: "Failed To Fetch Connections." });
    }
});

router.post("/database/connections/save", authenticateToken, async (req, res) => {
    const { userID, connectionName, connectionUrl, host, port, database, user, password, sslMode } = req.body;
    let { organizationID } = req.body;
    organizationID = normalizeOrgId(organizationID);
    let config;

    try {
        if (!connectionName || !connectionName.trim()) {
            return res.status(400).json({ message: "Connection Name Is Required." });
        }

        if (connectionUrl) {
            config = parseConnectionUrl(connectionUrl);
            if (!config) {
                return res.status(400).json({ message: "Invalid Connection URL Format." });
            }
            config.sslMode = sslMode || "require";
        } else {
            if (!host || !database || !user || !password) {
                return res.status(400).json({ message: "Missing Required Connection Parameters." });
            }
            config = { host, port: port || 5432, database, user, password: String(password), sslMode: sslMode || "require" };
        }

        const { pool: testPool, actualSslMode } = await createExternalPoolWithFallback(config);
        await testPool.end();

        const encryptedPassword = encrypt(config.password);

        const insertQuery = `
            INSERT INTO database_connections (orgid, username, connection_name, host, port, database_name, db_username, db_password_encrypted, ssl_mode, last_connected_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
            RETURNING id, connection_name, host, port, database_name, db_username, ssl_mode, created_at, last_connected_at
        `;
        const result = await pool.query(insertQuery, [
            organizationID,
            userID,
            connectionName.trim(),
            config.host,
            config.port,
            config.database,
            config.user,
            encryptedPassword,
            actualSslMode
        ]);

        return res.status(200).json({ message: "Connection Saved Successfully.", connection: result.rows[0] });
    } catch (error) {
        if (error.code === "23505") {
            return res.status(400).json({ message: "A Connection With This Name Already Exists." });
        }
        
        let errorMessage = error.message;
        if (error.message.includes("ENOTFOUND") || error.message.includes("Cannot resolve hostname")) {
            errorMessage = `Cannot resolve hostname. For Supabase, use the Connection Pooler URL.`;
        }
        
        return res.status(400).json({ message: `Failed To Save Connection: ${errorMessage}` });
    }
});

router.post("/database/connections/delete", authenticateToken, async (req, res) => {
    const { userID, connectionID } = req.body;
    let { organizationID } = req.body;
    organizationID = normalizeOrgId(organizationID);

    try {
        const query = `
            DELETE FROM database_connections
            WHERE id = $1 AND username = $2 AND (orgid = $3 OR ($3 IS NULL AND orgid IS NULL))
        `;
        const result = await pool.query(query, [connectionID, userID, organizationID]);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Connection Not Found." });
        }

        return res.status(200).json({ message: "Connection Deleted Successfully." });
    } catch (error) {
        return res.status(500).json({ message: "Failed To Delete Connection." });
    }
});

router.post("/database/connect", authenticateToken, async (req, res) => {
    const { userID, connectionID, connectionUrl, host, port, database, user, password, sslMode } = req.body;
    let { organizationID } = req.body;
    organizationID = normalizeOrgId(organizationID);
    let config;

    try {
        if (connectionID) {
            config = await getConnectionConfig(userID, organizationID, connectionID);
            if (!config) {
                return res.status(404).json({ message: "Connection Not Found." });
            }
            await pool.query(
                `UPDATE database_connections SET last_connected_at = CURRENT_TIMESTAMP WHERE id = $1`,
                [connectionID]
            );
        } else if (connectionUrl) {
            config = parseConnectionUrl(connectionUrl);
            if (!config) {
                return res.status(400).json({ message: "Invalid Connection URL Format." });
            }
            config.sslMode = sslMode || "require";
        } else {
            if (!host || !database || !user || !password) {
                return res.status(400).json({ message: "Missing Required Connection Parameters." });
            }
            config = { host, port: port || 5432, database, user, password: String(password), sslMode: sslMode || "require" };
        }

        const { pool: testPool, actualSslMode } = await createExternalPoolWithFallback(config);
        const client = await testPool.connect();
        const versionResult = await client.query("SELECT version()");
        client.release();
        await testPool.end();

        return res.status(200).json({
            message: "Connected Successfully.",
            success: true,
            version: versionResult.rows[0].version,
            connectionID: connectionID || null,
            config: { 
                host: config.host, 
                port: config.port, 
                database: config.database, 
                user: config.user, 
                sslMode: actualSslMode,
                password: connectionID ? undefined : config.password
            }
        });
    } catch (error) {
        let errorMessage = error.message;
        
        if (error.message.includes("ENOTFOUND") || error.message.includes("Cannot resolve hostname")) {
            errorMessage = `Cannot resolve hostname "${config?.host}". For Supabase, use the Connection Pooler URL.`;
        }
        
        return res.status(400).json({ message: `Connection Failed: ${errorMessage}`, success: false });
    }
});

router.post("/database/tables", authenticateToken, async (req, res) => {
    try {
        const config = await resolveConnectionConfig(req);
        const { pool: externalPool } = await createExternalPoolWithFallback(config);
        const client = await externalPool.connect();

        const query = `
            SELECT table_schema, table_name, table_type
            FROM information_schema.tables
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY table_schema, table_name
        `;
        const result = await client.query(query);
        client.release();
        await externalPool.end();

        const tables = result.rows.map(row => ({
            schema: row.table_schema,
            name: row.table_name,
            type: row.table_type,
            fullName: `${row.table_schema}.${row.table_name}`
        }));

        return res.status(200).json({ tables });
    } catch (error) {
        return res.status(400).json({ message: `Failed To Fetch Tables: ${error.message}` });
    }
});

router.post("/database/schema", authenticateToken, async (req, res) => {
    const { tableName, schemaName } = req.body;

    try {
        const config = await resolveConnectionConfig(req);
        const { pool: externalPool } = await createExternalPoolWithFallback(config);
        const client = await externalPool.connect();

        const columnsQuery = `
            SELECT 
                column_name,
                data_type,
                character_maximum_length,
                is_nullable,
                column_default,
                ordinal_position
            FROM information_schema.columns
            WHERE table_schema = $1 AND table_name = $2
            ORDER BY ordinal_position
        `;
        const columnsResult = await client.query(columnsQuery, [schemaName || "public", tableName]);

        const constraintsQuery = `
            SELECT 
                tc.constraint_name,
                tc.constraint_type,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
            LEFT JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name AND tc.constraint_type = 'FOREIGN KEY'
            WHERE tc.table_schema = $1 AND tc.table_name = $2
        `;
        const constraintsResult = await client.query(constraintsQuery, [schemaName || "public", tableName]);

        const indexesQuery = `
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE schemaname = $1 AND tablename = $2
        `;
        const indexesResult = await client.query(indexesQuery, [schemaName || "public", tableName]);

        client.release();
        await externalPool.end();

        return res.status(200).json({
            columns: columnsResult.rows,
            constraints: constraintsResult.rows,
            indexes: indexesResult.rows
        });
    } catch (error) {
        return res.status(400).json({ message: `Failed To Fetch Schema: ${error.message}` });
    }
});

router.post("/database/query", authenticateToken, async (req, res) => {
    const { query, params } = req.body;

    try {
        if (!query || !query.trim()) {
            return res.status(400).json({ message: "Query Is Required." });
        }

        const config = await resolveConnectionConfig(req);
        const { pool: externalPool } = await createExternalPoolWithFallback(config);
        const client = await externalPool.connect();

        const startTime = Date.now();
        const result = await client.query(query, params || []);
        const executionTime = Date.now() - startTime;

        client.release();
        await externalPool.end();

        const response = {
            success: true,
            executionTime,
            command: result.command,
            rowCount: result.rowCount
        };

        if (result.rows) {
            response.rows = result.rows;
            response.fields = result.fields ? result.fields.map(f => ({ name: f.name, dataType: f.dataTypeID })) : [];
        }

        return res.status(200).json(response);
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message,
            position: error.position,
            detail: error.detail,
            hint: error.hint
        });
    }
});

router.post("/database/table-data", authenticateToken, async (req, res) => {
    const { tableName, schemaName, page, pageSize, sortColumn, sortDirection, filters } = req.body;

    try {
        const config = await resolveConnectionConfig(req);
        const { pool: externalPool } = await createExternalPoolWithFallback(config);
        const client = await externalPool.connect();

        const schema = schemaName || "public";
        const limit = pageSize || 50;
        const offset = ((page || 1) - 1) * limit;

        let whereClause = "";
        const queryParams = [];
        let paramIndex = 1;

        if (filters && filters.length > 0) {
            const filterConditions = filters.map(f => {
                queryParams.push(f.value);
                return `"${f.column}" ${f.operator} $${paramIndex++}`;
            });
            whereClause = `WHERE ${filterConditions.join(" AND ")}`;
        }

        const orderClause = sortColumn ? `ORDER BY "${sortColumn}" ${sortDirection === "desc" ? "DESC" : "ASC"}` : "";

        const countQuery = `SELECT COUNT(*) FROM "${schema}"."${tableName}" ${whereClause}`;
        const countResult = await client.query(countQuery, queryParams);
        const totalCount = parseInt(countResult.rows[0].count);

        const dataQuery = `SELECT * FROM "${schema}"."${tableName}" ${whereClause} ${orderClause} LIMIT ${limit} OFFSET ${offset}`;
        const dataResult = await client.query(dataQuery, queryParams);

        client.release();
        await externalPool.end();

        return res.status(200).json({
            rows: dataResult.rows,
            fields: dataResult.fields ? dataResult.fields.map(f => ({ name: f.name, dataType: f.dataTypeID })) : [],
            totalCount,
            page: page || 1,
            pageSize: limit,
            totalPages: Math.ceil(totalCount / limit)
        });
    } catch (error) {
        return res.status(400).json({ message: `Failed To Fetch Data: ${error.message}` });
    }
});

router.post("/database/table-stats", authenticateToken, async (req, res) => {
    const { tableName, schemaName } = req.body;

    try {
        const config = await resolveConnectionConfig(req);
        const { pool: externalPool } = await createExternalPoolWithFallback(config);
        const client = await externalPool.connect();

        const schema = schemaName || "public";

        const statsQuery = `
            SELECT 
                pg_size_pretty(pg_total_relation_size('"${schema}"."${tableName}"')) as total_size,
                pg_size_pretty(pg_table_size('"${schema}"."${tableName}"')) as table_size,
                pg_size_pretty(pg_indexes_size('"${schema}"."${tableName}"')) as indexes_size,
                (SELECT COUNT(*) FROM "${schema}"."${tableName}") as row_count
        `;
        const statsResult = await client.query(statsQuery);

        client.release();
        await externalPool.end();

        return res.status(200).json({ stats: statsResult.rows[0] });
    } catch (error) {
        return res.status(400).json({ message: `Failed To Fetch Stats: ${error.message}` });
    }
});

module.exports = router;