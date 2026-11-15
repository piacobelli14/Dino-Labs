const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const { pool } = require("../../config/db");

const router = express.Router();

const SOURCES = {
  github: {
    name: "GitHub",
    authUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    apiUrl: "https://api.github.com",
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackPath: "/github/callback",
    scope: "repo read:user",
    apiVersion: "2022-11-28",
    userAgent: "DinoLabsStudio"
  },
  limits: {
    queryTimeoutMs: 15000,
    requestTimeoutMs: 60000,
    transferTimeoutMs: 300000,
    maxFileBytes: 100 * 1024 * 1024,
    maxListResults: 100,
    stateTtlMs: 10 * 60000
  }
};

const HTTP_EXPLANATIONS = {
  400: "GitHub rejected the request as malformed (HTTP 400).",
  401: "GitHub rejected the credentials (HTTP 401).",
  403: "GitHub refused access to this resource (HTTP 403).",
  404: "GitHub did not recognize the requested resource (HTTP 404).",
  409: "GitHub reported a conflict with the current file version (HTTP 409).",
  422: "GitHub could not process the request (HTTP 422).",
  429: "GitHub is rate limiting this server (HTTP 429).",
  500: "GitHub had an internal error (HTTP 500).",
  502: "GitHub's gateway failed (HTTP 502).",
  503: "GitHub is temporarily unavailable (HTTP 503)."
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

const githubErrorMessage = (error) => {
  const status = error && error.response ? error.response.status : null;
  let data = error && error.response ? error.response.data : null;
  if (data && Buffer.isBuffer(data)) {
    try { data = JSON.parse(data.toString("utf8")); } catch { data = null; }
  }
  if (data && typeof data === "object" && data.message) return `${HTTP_EXPLANATIONS[status] || ""} ${String(data.message).replace(/([^.!?])$/, "$1.")}`.trim();
  if (status) return HTTP_EXPLANATIONS[status] || `GitHub answered with HTTP ${status}.`;
  const message = String(error && error.message ? error.message : error);
  return `The request failed because ${message.replace(/\.$/, "").replace(/^\w/, (c) => c.toLowerCase())}.`;
};

const callbackUrl = (req) => `${req.protocol}://${req.get("host")}${SOURCES.github.callbackPath}`;

const formEncode = (values) => Object.entries(values).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&");

const githubHeaders = (accessToken, extra = {}) => ({
  Authorization: `Bearer ${accessToken}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": SOURCES.github.apiVersion,
  "User-Agent": SOURCES.github.userAgent,
  ...extra
});

const accessTokenFor = async (user) => {
  const result = await queryWithTimeout("SELECT access_token FROM github_accounts WHERE orgid = $1 AND username = $2", [user.orgid, user.username]);
  if (!result.rows.length) {
    const error = new Error("GitHub is not connected for this account.");
    error.statusCode = 403;
    throw error;
  }
  return result.rows[0].access_token;
};

const encodeContentPath = (value) => String(value).split("/").filter(Boolean).map((part) => encodeURIComponent(part)).join("/");

router.get("/github/auth-url", async (req, res) => {
  const user = requireUser(req.query, res);
  if (!user) return;
  if (!SOURCES.github.clientId || !SOURCES.github.clientSecret) {
    return res.status(500).json({ success: false, message: "GitHub is not configured on this server." });
  }
  try {
    const state = generateId("state");
    const expiration = new Date(Date.now() + SOURCES.limits.stateTtlMs);
    await queryWithTimeout("DELETE FROM github_oauth_states WHERE expiration < NOW()", []);
    await queryWithTimeout("INSERT INTO github_oauth_states (state, orgid, username, expiration) VALUES ($1, $2, $3, $4)", [state, user.orgid, user.username, expiration]);
    const url = `${SOURCES.github.authUrl}?${formEncode({
      client_id: SOURCES.github.clientId,
      redirect_uri: callbackUrl(req),
      scope: SOURCES.github.scope,
      state
    })}`;
    return res.status(200).json({ success: true, url });
  } catch (error) {
    return res.status(500).json({ success: false, message: githubErrorMessage(error) });
  }
});

router.get("/github/callback", async (req, res) => {
  const failPage = (message) => res.status(200).send(`<!doctype html><html><head><title>GitHub</title><style>body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#12151b;color:#ebf0f8;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:14px;font-weight:700}</style></head><body><p>${message}</p></body></html>`);
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const code = typeof req.query.code === "string" ? req.query.code : "";
  if (req.query.error || !state || !code) return failPage("GitHub access was not granted. You can close this window.");
  try {
    const stateResult = await queryWithTimeout("DELETE FROM github_oauth_states WHERE state = $1 AND expiration > NOW() RETURNING orgid, username", [state]);
    if (!stateResult.rows.length) return failPage("This sign in link has expired. Try connecting again.");
    const user = stateResult.rows[0];
    const tokenResponse = await axios.post(SOURCES.github.tokenUrl, formEncode({
      client_id: SOURCES.github.clientId,
      client_secret: SOURCES.github.clientSecret,
      code,
      redirect_uri: callbackUrl(req)
    }), { headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, timeout: SOURCES.limits.requestTimeoutMs });
    const accessToken = tokenResponse.data && tokenResponse.data.access_token ? tokenResponse.data.access_token : "";
    if (!accessToken) return failPage("GitHub did not return a credential. Try connecting again.");
    let login = "";
    try {
      const info = await axios.get(`${SOURCES.github.apiUrl}/user`, { headers: githubHeaders(accessToken), timeout: SOURCES.limits.requestTimeoutMs });
      login = String(info.data && info.data.login ? info.data.login : "");
    } catch { }
    await queryWithTimeout(
      `INSERT INTO github_accounts (orgid, username, github_login, access_token, scope, connected_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (orgid, username) DO UPDATE SET github_login = EXCLUDED.github_login, access_token = EXCLUDED.access_token, scope = EXCLUDED.scope, updated_at = NOW()`,
      [user.orgid, user.username, login, accessToken, String(tokenResponse.data.scope || SOURCES.github.scope)]
    );
    return res.redirect("/github.html");
  } catch (error) {
    return failPage(githubErrorMessage(error));
  }
});

router.get("/github/status", async (req, res) => {
  const user = requireUser(req.query, res);
  if (!user) return;
  try {
    const result = await queryWithTimeout("SELECT github_login FROM github_accounts WHERE orgid = $1 AND username = $2", [user.orgid, user.username]);
    if (!result.rows.length) return res.status(200).json({ success: true, connected: false, login: "" });
    return res.status(200).json({ success: true, connected: true, login: result.rows[0].github_login || "" });
  } catch (error) {
    return res.status(500).json({ success: false, message: githubErrorMessage(error) });
  }
});

router.delete("/github/disconnect", async (req, res) => {
  const user = requireUser(req.query, res);
  if (!user) return;
  try {
    const result = await queryWithTimeout("DELETE FROM github_accounts WHERE orgid = $1 AND username = $2 RETURNING access_token", [user.orgid, user.username]);
    if (result.rows.length && result.rows[0].access_token) {
      try {
        await axios.delete(`${SOURCES.github.apiUrl}/applications/${SOURCES.github.clientId}/token`, {
          auth: { username: SOURCES.github.clientId, password: SOURCES.github.clientSecret },
          headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": SOURCES.github.apiVersion, "User-Agent": SOURCES.github.userAgent },
          data: { access_token: result.rows[0].access_token },
          timeout: SOURCES.limits.requestTimeoutMs
        });
      } catch { }
    }
    return res.status(200).json({ success: true, message: "GitHub has been disconnected." });
  } catch (error) {
    return res.status(500).json({ success: false, message: githubErrorMessage(error) });
  }
});

router.get("/github/repos", async (req, res) => {
  const user = requireUser(req.query, res);
  if (!user) return;
  try {
    const accessToken = await accessTokenFor(user);
    const search = typeof req.query.query === "string" ? req.query.query.trim().toLowerCase() : "";
    const response = await axios.get(`${SOURCES.github.apiUrl}/user/repos`, {
      headers: githubHeaders(accessToken),
      params: { sort: "updated", per_page: SOURCES.limits.maxListResults, affiliation: "owner,collaborator,organization_member" },
      timeout: SOURCES.limits.requestTimeoutMs
    });
    const repos = (Array.isArray(response.data) ? response.data : [])
      .filter((repo) => !search || String(repo.full_name || "").toLowerCase().includes(search))
      .map((repo) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        owner: repo.owner ? repo.owner.login : "",
        defaultBranch: repo.default_branch,
        private: Boolean(repo.private),
        updatedAt: repo.updated_at
      }));
    return res.status(200).json({ success: true, repos });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: githubErrorMessage(error) });
  }
});

router.get("/github/contents", async (req, res) => {
  const user = requireUser(req.query, res);
  if (!user) return;
  const owner = typeof req.query.owner === "string" ? req.query.owner : "";
  const repo = typeof req.query.repo === "string" ? req.query.repo : "";
  const dirPath = typeof req.query.path === "string" ? req.query.path : "";
  const ref = typeof req.query.ref === "string" ? req.query.ref : "";
  if (!owner || !repo) {
    return res.status(400).json({ success: false, message: "Owner and repo are required." });
  }
  try {
    const accessToken = await accessTokenFor(user);
    const response = await axios.get(`${SOURCES.github.apiUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeContentPath(dirPath)}`, {
      headers: githubHeaders(accessToken),
      params: ref ? { ref } : {},
      timeout: SOURCES.limits.requestTimeoutMs
    });
    const rows = Array.isArray(response.data) ? response.data : [response.data];
    const entries = rows
      .map((entry) => ({ name: entry.name, path: entry.path, type: entry.type, size: entry.size || 0 }))
      .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1));
    return res.status(200).json({ success: true, entries });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: githubErrorMessage(error) });
  }
});

router.get("/github/file", async (req, res) => {
  const user = requireUser(req.query, res);
  if (!user) return;
  const owner = typeof req.query.owner === "string" ? req.query.owner : "";
  const repo = typeof req.query.repo === "string" ? req.query.repo : "";
  const filePath = typeof req.query.path === "string" ? req.query.path : "";
  const ref = typeof req.query.ref === "string" ? req.query.ref : "";
  if (!owner || !repo || !filePath) {
    return res.status(400).json({ success: false, message: "Owner, repo, and path are required." });
  }
  try {
    const accessToken = await accessTokenFor(user);
    const response = await axios.get(`${SOURCES.github.apiUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeContentPath(filePath)}`, {
      headers: githubHeaders(accessToken, { Accept: "application/vnd.github.raw+json" }),
      params: ref ? { ref } : {},
      responseType: "arraybuffer",
      timeout: SOURCES.limits.transferTimeoutMs,
      maxContentLength: SOURCES.limits.maxFileBytes
    });
    res.setHeader("Content-Type", "application/octet-stream");
    return res.status(200).send(Buffer.from(response.data));
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: githubErrorMessage(error) });
  }
});

router.put("/github/file", express.raw({ type: "*/*", limit: SOURCES.limits.maxFileBytes }), async (req, res) => {
  const user = requireUser(req.query, res);
  if (!user) return;
  const owner = typeof req.query.owner === "string" ? req.query.owner : "";
  const repo = typeof req.query.repo === "string" ? req.query.repo : "";
  const filePath = typeof req.query.path === "string" ? req.query.path : "";
  const branch = typeof req.query.branch === "string" ? req.query.branch : "";
  if (!owner || !repo || !filePath) {
    return res.status(400).json({ success: false, message: "Owner, repo, and path are required." });
  }
  if (!req.body || !req.body.length) {
    return res.status(400).json({ success: false, message: "The request did not contain any file content." });
  }
  try {
    const accessToken = await accessTokenFor(user);
    const contentUrl = `${SOURCES.github.apiUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeContentPath(filePath)}`;
    let sha = "";
    try {
      const metadata = await axios.get(contentUrl, {
        headers: githubHeaders(accessToken),
        params: branch ? { ref: branch } : {},
        timeout: SOURCES.limits.requestTimeoutMs
      });
      sha = metadata.data && metadata.data.sha ? metadata.data.sha : "";
    } catch { }
    const fileName = filePath.split("/").pop();
    const payload = {
      message: `Update ${fileName} from Dino Labs Studio.`,
      content: Buffer.from(req.body).toString("base64")
    };
    if (sha) payload.sha = sha;
    if (branch) payload.branch = branch;
    await axios.put(contentUrl, payload, {
      headers: githubHeaders(accessToken),
      timeout: SOURCES.limits.transferTimeoutMs,
      maxBodyLength: SOURCES.limits.maxFileBytes * 2
    });
    return res.status(200).json({ success: true, message: "The file has been committed to GitHub." });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: githubErrorMessage(error) });
  }
});

router.get("/github/health", (req, res) => {
  return res.status(200).json({ success: true, configured: Boolean(SOURCES.github.clientId && SOURCES.github.clientSecret) });
});

module.exports = router;