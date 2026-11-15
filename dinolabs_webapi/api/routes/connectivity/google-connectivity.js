const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const { pool } = require("../../config/db");

const router = express.Router();

const SOURCES = {
  google: {
    name: "Google Drive",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    revokeUrl: "https://oauth2.googleapis.com/revoke",
    userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
    filesUrl: "https://www.googleapis.com/drive/v3/files",
    uploadUrl: "https://www.googleapis.com/upload/drive/v3/files",
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackPath: "/google-drive/callback",
    scope: "https://www.googleapis.com/auth/drive openid email",
    requiredScope: "https://www.googleapis.com/auth/drive",
    folderMimeType: "application/vnd.google-apps.folder"
  },
  exports: {
    "application/vnd.google-apps.document": { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", extension: "docx" },
    "application/vnd.google-apps.spreadsheet": { mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extension: "xlsx" },
    "application/vnd.google-apps.presentation": { mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", extension: "pptx" }
  },
  limits: {
    queryTimeoutMs: 15000,
    requestTimeoutMs: 60000,
    transferTimeoutMs: 300000,
    maxUploadBytes: 100 * 1024 * 1024,
    maxListResults: 200,
    stateTtlMs: 10 * 60000,
    refreshMarginMs: 2 * 60000
  }
};

const HTTP_EXPLANATIONS = {
  400: "Google rejected the request as malformed (HTTP 400).",
  401: "Google rejected the credentials (HTTP 401).",
  403: "Google refused access to this file (HTTP 403).",
  404: "Google did not recognize the requested file (HTTP 404).",
  429: "Google is rate limiting this server (HTTP 429).",
  500: "Google had an internal error (HTTP 500).",
  502: "Google's gateway failed (HTTP 502).",
  503: "Google is temporarily unavailable (HTTP 503).",
  504: "Google's gateway timed out (HTTP 504)."
};

const generateId = (prefix) => `${prefix}_${crypto.randomBytes(12).toString("hex")}`;

const withTimeout = (promise, ms, label) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms} milliseconds.`));
    }, ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); }
    );
  });
};

const queryWithTimeout = async (sql, params, ms) => withTimeout(pool.query(sql, params), ms || SOURCES.limits.queryTimeoutMs, "Database query");

const requireUser = (source, res) => {
  const orgid = source && typeof source.orgid === "string" ? source.orgid : "";
  const username = source && typeof source.username === "string" ? source.username : "";
  if (!orgid || !username) {
    res.status(400).json({ success: false, message: "Orgid and username are required." });
    return null;
  }
  return { orgid, username };
};

const googleErrorMessage = (error) => {
  const status = error && error.response ? error.response.status : null;
  const detail = error && error.response && error.response.data && error.response.data.error ? error.response.data.error : null;
  if (detail && typeof detail === "object" && detail.message) return `${HTTP_EXPLANATIONS[status] || ""} ${String(detail.message).replace(/\s*See https?:\/\/\S+/i, "").replace(/([^.!?])$/, "$1.")}`.trim();
  if (detail && typeof detail === "string") return `${HTTP_EXPLANATIONS[status] || ""} ${detail.replace(/([^.!?])$/, "$1.")}`.trim();
  if (status) return HTTP_EXPLANATIONS[status] || `Google answered with HTTP ${status}.`;
  const message = String(error && error.message ? error.message : error);
  return `The request failed because ${message.replace(/\.$/, "").replace(/^\w/, (c) => c.toLowerCase())}.`;
};

const callbackUrl = (req) => `${req.protocol}://${req.get("host")}${SOURCES.google.callbackPath}`;

const formEncode = (values) => Object.entries(values).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&");

const exchangeCode = async (code, redirectUri) => {
  const response = await axios.post(SOURCES.google.tokenUrl, formEncode({
    code,
    client_id: SOURCES.google.clientId,
    client_secret: SOURCES.google.clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code"
  }), { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: SOURCES.limits.requestTimeoutMs });
  return response.data;
};

const refreshAccessToken = async (refreshToken) => {
  const response = await axios.post(SOURCES.google.tokenUrl, formEncode({
    refresh_token: refreshToken,
    client_id: SOURCES.google.clientId,
    client_secret: SOURCES.google.clientSecret,
    grant_type: "refresh_token"
  }), { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: SOURCES.limits.requestTimeoutMs });
  return response.data;
};

const accessTokenFor = async (user, force) => {
  const result = await queryWithTimeout("SELECT refresh_token, access_token, access_token_expires FROM google_accounts WHERE orgid = $1 AND username = $2", [user.orgid, user.username]);
  if (!result.rows.length) {
    const error = new Error("Google Drive is not connected for this account.");
    error.statusCode = 403;
    error.reconnect = true;
    throw error;
  }
  const row = result.rows[0];
  const expires = row.access_token_expires ? new Date(row.access_token_expires).getTime() : 0;
  if (!force && row.access_token && expires - Date.now() > SOURCES.limits.refreshMarginMs) return row.access_token;
  try {
    const data = await refreshAccessToken(row.refresh_token);
    const expiresAt = new Date(Date.now() + Number(data.expires_in || 3600) * 1000);
    await queryWithTimeout("UPDATE google_accounts SET access_token = $1, access_token_expires = $2, updated_at = NOW() WHERE orgid = $3 AND username = $4", [data.access_token, expiresAt, user.orgid, user.username]);
    return data.access_token;
  } catch (error) {
    const detail = error && error.response && error.response.data ? error.response.data : null;
    if (detail && detail.error === "invalid_grant") {
      await queryWithTimeout("DELETE FROM google_accounts WHERE orgid = $1 AND username = $2", [user.orgid, user.username]);
      const expired = new Error("The Google Drive connection has expired. Connect it again.");
      expired.statusCode = 403;
      expired.reconnect = true;
      throw expired;
    }
    throw error;
  }
};

const withAccess = async (user, action) => {
  try {
    return await action(await accessTokenFor(user, false));
  } catch (error) {
    if (error && error.response && error.response.status === 401) return action(await accessTokenFor(user, true));
    throw error;
  }
};

const connectionFailure = async (user, error) => {
  if (error && (error.reconnect || insufficientScope(error))) {
    await dropConnection(user);
    return { success: false, reconnect: true, message: error.reconnect && !insufficientScope(error) ? error.message : "The Google Drive connection is no longer valid. Connect it again and leave the Google Drive permission ticked." };
  }
  return null;
};

const insufficientScope = (error) => {
  const data = error && error.response ? error.response.data : null;
  const detail = data && data.error ? data.error : null;
  const reasons = detail && Array.isArray(detail.errors) ? detail.errors.map((entry) => entry.reason) : [];
  return (error && error.response && error.response.status === 403 && (reasons.includes("insufficientPermissions") || /insufficient authentication scopes/i.test(String(detail && detail.message ? detail.message : "")))) || (error && error.response && error.response.status === 401);
};

const dropConnection = async (user) => {
  try {
    await queryWithTimeout("DELETE FROM google_accounts WHERE orgid = $1 AND username = $2", [user.orgid, user.username]);
  } catch (error) { }
};

const escapeDriveQuery = (value) => String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");

router.get("/google-drive/auth-url", async (req, res) => {
  const user = requireUser(req.query, res);
  if (!user) return;
  if (!SOURCES.google.clientId || !SOURCES.google.clientSecret) {
    return res.status(500).json({ success: false, message: "Google Drive is not configured on this server." });
  }
  try {
    const state = generateId("state");
    const expiration = new Date(Date.now() + SOURCES.limits.stateTtlMs);
    await queryWithTimeout("DELETE FROM google_oauth_states WHERE expiration < NOW()", []);
    await queryWithTimeout("INSERT INTO google_oauth_states (state, orgid, username, expiration) VALUES ($1, $2, $3, $4)", [state, user.orgid, user.username, expiration]);
    const url = `${SOURCES.google.authUrl}?${formEncode({
      client_id: SOURCES.google.clientId,
      redirect_uri: callbackUrl(req),
      response_type: "code",
      scope: SOURCES.google.scope,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state
    })}`;
    return res.status(200).json({ success: true, url });
  } catch (error) {
    return res.status(500).json({ success: false, message: googleErrorMessage(error) });
  }
});

router.get("/google-drive/callback", async (req, res) => {
  const failPage = (message) => res.status(200).send(`<!doctype html><html><head><title>Google Drive</title><style>body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#12151b;color:#ebf0f8;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:14px;font-weight:700}</style></head><body><p>${message}</p></body></html>`);
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const code = typeof req.query.code === "string" ? req.query.code : "";
  if (req.query.error || !state || !code) return failPage("Google Drive access was not granted. You can close this window.");
  try {
    const stateResult = await queryWithTimeout("DELETE FROM google_oauth_states WHERE state = $1 AND expiration > NOW() RETURNING orgid, username", [state]);
    if (!stateResult.rows.length) return failPage("This sign in link has expired. Try connecting again.");
    const user = stateResult.rows[0];
    const tokens = await exchangeCode(code, callbackUrl(req));
    if (!tokens.refresh_token) return failPage("Google did not return a long lived credential. Remove the app's access in your Google Account and try connecting again.");
    if (!String(tokens.scope || "").split(/\s+/).includes(SOURCES.google.requiredScope)) return failPage("Google Drive access was not granted. Connect again and leave the Google Drive permission ticked on the consent screen.");
    let email = "";
    try {
      const info = await axios.get(SOURCES.google.userInfoUrl, { headers: { Authorization: `Bearer ${tokens.access_token}` }, timeout: SOURCES.limits.requestTimeoutMs });
      email = String(info.data && info.data.email ? info.data.email : "");
    } catch { }
    const expiresAt = new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000);
    await queryWithTimeout(
      `INSERT INTO google_accounts (orgid, username, google_email, refresh_token, access_token, access_token_expires, scope, connected_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      ON CONFLICT (orgid, username) DO UPDATE SET google_email = EXCLUDED.google_email, refresh_token = EXCLUDED.refresh_token, access_token = EXCLUDED.access_token, access_token_expires = EXCLUDED.access_token_expires, scope = EXCLUDED.scope, updated_at = NOW()`,
      [user.orgid, user.username, email, tokens.refresh_token, tokens.access_token, expiresAt, String(tokens.scope || SOURCES.google.scope)]
    );
    return res.redirect("/google.html");
  } catch (error) {
    return failPage(googleErrorMessage(error));
  }
});

router.get("/google-drive/status", async (req, res) => {
  const user = requireUser(req.query, res);
  if (!user) return;
  try {
    const result = await queryWithTimeout("SELECT google_email, connected_at FROM google_accounts WHERE orgid = $1 AND username = $2", [user.orgid, user.username]);
    if (!result.rows.length) return res.status(200).json({ success: true, connected: false, email: "" });
    return res.status(200).json({ success: true, connected: true, email: result.rows[0].google_email || "" });
  } catch (error) {
    return res.status(500).json({ success: false, message: googleErrorMessage(error) });
  }
});

router.delete("/google-drive/disconnect", async (req, res) => {
  const user = requireUser(req.query, res);
  if (!user) return;
  try {
    const result = await queryWithTimeout("DELETE FROM google_accounts WHERE orgid = $1 AND username = $2 RETURNING refresh_token", [user.orgid, user.username]);
    if (result.rows.length && result.rows[0].refresh_token) {
      try {
        await axios.post(`${SOURCES.google.revokeUrl}?token=${encodeURIComponent(result.rows[0].refresh_token)}`, null, { timeout: SOURCES.limits.requestTimeoutMs });
      } catch { }
    }
    return res.status(200).json({ success: true, message: "Google Drive has been disconnected." });
  } catch (error) {
    return res.status(500).json({ success: false, message: googleErrorMessage(error) });
  }
});

router.get("/google-drive/files", async (req, res) => {
  const user = requireUser(req.query, res);
  if (!user) return;
  try {
    const search = typeof req.query.query === "string" ? req.query.query.trim() : "";
    const parent = typeof req.query.parent === "string" && req.query.parent.trim() ? req.query.parent.trim() : "root";
    const clauses = ["trashed = false"];
    if (search) clauses.push(`name contains '${escapeDriveQuery(search)}'`);
    else if (parent === "shared") clauses.push("sharedWithMe = true");
    else clauses.push(`'${escapeDriveQuery(parent)}' in parents`);
    const response = await withAccess(user, (accessToken) => axios.get(SOURCES.google.filesUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: {
        q: clauses.join(" and "),
        orderBy: search ? undefined : "folder,name_natural",
        pageSize: SOURCES.limits.maxListResults,
        fields: "files(id, name, mimeType, modifiedTime, size)",
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
      },
      timeout: SOURCES.limits.requestTimeoutMs
    }));
    const files = (Array.isArray(response.data.files) ? response.data.files : []).map((file) => ({ ...file, folder: file.mimeType === SOURCES.google.folderMimeType }));
    return res.status(200).json({ success: true, files });
  } catch (error) {
    const failure = await connectionFailure(user, error);
    if (failure) return res.status(403).json(failure);
    return res.status(error.statusCode || 500).json({ success: false, message: googleErrorMessage(error) });
  }
});

router.get("/google-drive/files/:fileId/content", async (req, res) => {
  const user = requireUser(req.query, res);
  if (!user) return;
  try {
    const fileId = encodeURIComponent(req.params.fileId);
    const metadata = await withAccess(user, (accessToken) => axios.get(`${SOURCES.google.filesUrl}/${fileId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { fields: "id, name, mimeType, size", supportsAllDrives: true },
      timeout: SOURCES.limits.requestTimeoutMs
    }));
    const exportTarget = SOURCES.exports[metadata.data.mimeType];
    const url = exportTarget
      ? `${SOURCES.google.filesUrl}/${fileId}/export?mimeType=${encodeURIComponent(exportTarget.mimeType)}`
      : `${SOURCES.google.filesUrl}/${fileId}?alt=media&supportsAllDrives=true`;
    const response = await withAccess(user, (accessToken) => axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: "arraybuffer",
      timeout: SOURCES.limits.transferTimeoutMs,
      maxContentLength: SOURCES.limits.maxUploadBytes
    }));
    res.setHeader("Content-Type", exportTarget ? exportTarget.mimeType : (metadata.data.mimeType || "application/octet-stream"));
    return res.status(200).send(Buffer.from(response.data));
  } catch (error) {
    if (error && error.response && Buffer.isBuffer(error.response.data)) {
      try { error.response.data = JSON.parse(error.response.data.toString("utf8")); } catch { }
    }
    const detail = error && error.response && error.response.data && error.response.data.error ? error.response.data.error : null;
    const reasons = detail && Array.isArray(detail.errors) ? detail.errors.map((entry) => entry.reason) : [];
    if (reasons.includes("exportSizeLimitExceeded")) {
      return res.status(403).json({ success: false, message: "This document is too large to export. Google caps exports of Google documents at 10 MB." });
    }
    const failure = await connectionFailure(user, error);
    if (failure) return res.status(403).json(failure);
    return res.status(error.statusCode || 500).json({ success: false, message: googleErrorMessage(error) });
  }
});

router.put("/google-drive/files/:fileId/content", express.raw({ type: "*/*", limit: SOURCES.limits.maxUploadBytes }), async (req, res) => {
  const user = requireUser(req.query, res);
  if (!user) return;
  if (!req.body || !req.body.length) {
    return res.status(400).json({ success: false, message: "The request did not contain any file content." });
  }
  try {
    const fileId = encodeURIComponent(req.params.fileId);
    const metadata = await withAccess(user, (accessToken) => axios.get(`${SOURCES.google.filesUrl}/${fileId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { fields: "id, name, mimeType", supportsAllDrives: true },
      timeout: SOURCES.limits.requestTimeoutMs
    }));
    const exportTarget = SOURCES.exports[metadata.data.mimeType];
    const contentType = exportTarget ? exportTarget.mimeType : (metadata.data.mimeType || "application/octet-stream");
    await withAccess(user, (accessToken) => axios.patch(`${SOURCES.google.uploadUrl}/${fileId}?uploadType=media&supportsAllDrives=true`, req.body, {
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": contentType },
      timeout: SOURCES.limits.transferTimeoutMs,
      maxBodyLength: SOURCES.limits.maxUploadBytes
    }));
    return res.status(200).json({ success: true, message: "The file has been saved to Google Drive." });
  } catch (error) {
    const failure = await connectionFailure(user, error);
    if (failure) return res.status(403).json(failure);
    return res.status(error.statusCode || 500).json({ success: false, message: googleErrorMessage(error) });
  }
});

router.get("/google-drive/health", (req, res) => {
  return res.status(200).json({ success: true, configured: Boolean(SOURCES.google.clientId && SOURCES.google.clientSecret) });
});

module.exports = router;