import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faWifi, faBatteryHalf, faPlugCircleBolt, faDesktop, faGlobe,
  faLock, faHeadphones, faCubes, faEarthAmericas, faCloud,
  faClipboard, faBolt, faHardDrive, faDownload, faRefresh,
  faFilm, faGaugeHigh, faKeyboard, faLocationDot, faMicrochip,
  faPlug, faChevronRight, faMagnifyingGlass, faXmark, faLanguage,
  faUniversalAccess, faFont, faShieldHalved, faListCheck, faTriangleExclamation,
  faUsers
} from "@fortawesome/free-solid-svg-icons";
import Nav from "../../helpers/Nav.jsx";
import useAuth from "../../UseAuth.jsx";
import { showDialog } from "../../helpers/Alert.jsx";
import "../../styles/mainStyles/Account/System.css";
import "../../styles/helperStyles/LoadingSpinner.css";
import "../../styles/helperStyles/Disconnected.css";

export default function Monitor() {
  const navigate = useNavigate();
  const { token, organizationID, loading } = useAuth();
  const isPageLoaded = !loading;

  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const pct = (x) => `${Math.round(clamp01(x) * 100)}%`;
  const B = (v) => (v ? "Yes" : "No");
  const fmt = (n, d = 2) =>
    n == null || !isFinite(n) ? "—" : Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(d);
  const fmtBytes = (bytes) => {
    if (bytes == null || !isFinite(bytes)) return "—";
    const u = ["B", "KB", "MB", "GB", "TB", "PB"];
    let i = 0;
    let v = bytes;
    while (v >= 1024 && i < u.length - 1) {
      v /= 1024;
      i++;
    }
    return `${fmt(v, v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${u[i]}`;
  };
  const fmtMs = (ms) => (ms == null || !isFinite(ms)) ? "—" : `${Math.round(ms)} ms`;

  const UsageBar = ({ usage = 0 }) => {
    const pct = clamp01(usage) * 100;

    return (
      <div className="systemSystemUsageWrapper">
        <div className="systemSystemUsageBar">
          <div
            className="systemSystemUsageFill"
            style={{ width: pct > 0 && pct < 0.6 ? "0.6%" : `${pct}%` }}
          />
        </div>
      </div>
    );
  };

  const pctLabel = (ratio) => {
    if (ratio == null || !isFinite(ratio)) {
      return "\u2014";
    }
    const pct = ratio * 100;
    if (pct === 0) {
      return "0%";
    }
    if (pct < 0.01) {
      return "Under 0.01%";
    }
    if (pct < 1) {
      return `${pct.toFixed(2)}%`;
    }
    return `${Math.round(pct)}%`;
  };

  const useUiLoadIndex = () => {
    const [load, setLoad] = useState(0);

    useEffect(() => {
      let alive = true;
      let last = performance.now();
      let acc = 0;
      let n = 0;
      let ideal = null;

      const tick = (t) => {
        const dt = t - last;
        last = t;

        if (dt > 0 && dt < 100) {
          ideal = ideal == null ? dt : Math.min(ideal, dt);
        }

        const baseline = ideal || 1000 / 60;
        const r = clamp01((dt - baseline) / baseline);

        acc += r;
        n++;

        if (n >= 30) {
          setLoad(clamp01(acc / n));
          acc = 0;
          n = 0;
        }

        if (alive) requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
      return () => {
        alive = false;
      };
    }, []);

    return load;
  };

  const usePerf = () => {
    const [nav, setNav] = useState(null);
    const [paint, setPaint] = useState({ fp: null, fcp: null });
    const [lcp, setLcp] = useState(null);
    const [cls, setCls] = useState(0);
    const [fid, setFid] = useState(null);
    useEffect(() => {
      const navEntry = performance.getEntriesByType("navigation")[0];
      if (navEntry) setNav(navEntry);
      const paints = performance.getEntriesByType("paint");
      for (const p of paints) {
        if (p.name === "first-paint") setPaint((s) => ({ ...s, fp: p.startTime }));
        if (p.name === "first-contentful-paint") setPaint((s) => ({ ...s, fcp: p.startTime }));
      }
      const poLcp = new PerformanceObserver((list) => {
        const last = list.getEntries().at(-1);
        if (last) setLcp(last.renderTime || last.loadTime || last.startTime);
      });
      try {
        poLcp.observe({ type: "largest-contentful-paint", buffered: true });
      } catch {}
      let clsSum = 0;
      const poCls = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) if (!e.hadRecentInput) clsSum += e.value;
        setCls(clsSum);
      });
      try {
        poCls.observe({ type: "layout-shift", buffered: true });
      } catch {}
      const poFid = new PerformanceObserver((list) => {
        const first = list.getEntries()[0];
        if (first) setFid(first.processingStart - first.startTime);
      });
      try {
        poFid.observe({ type: "first-input", buffered: true });
      } catch {}
      return () => {
        try {
          poLcp.disconnect();
        } catch {}
        try {
          poCls.disconnect();
        } catch {}
        try {
          poFid.disconnect();
        } catch {}
      };
    }, []);
    const ttfb = useMemo(() => (nav ? nav.responseStart - nav.startTime : null), [nav]);
    const dcl = useMemo(() => (nav ? nav.domContentLoadedEventEnd - nav.startTime : null), [nav]);
    const load = useMemo(() => (nav ? nav.loadEventEnd - nav.startTime : null), [nav]);
    return { ttfb, dcl, load, fp: paint.fp, fcp: paint.fcp, lcp, cls, fid };
  };

  const useNetwork = () => {
    const [online, setOnline] = useState(navigator.onLine);
    const [conn, setConn] = useState(() => {
      const c = navigator.connection || navigator.webkitConnection || navigator.mozConnection;
      return c
        ? { effectiveType: c.effectiveType, downlink: c.downlink, rtt: c.rtt, saveData: !!c.saveData }
        : null;
    });
    const [ping, setPing] = useState(null);
    useEffect(() => {
      const up = () => setOnline(true);
      const down = () => setOnline(false);
      window.addEventListener("online", up);
      window.addEventListener("offline", down);
      const c = navigator.connection || navigator.webkitConnection || navigator.mozConnection;
      const onChange = () =>
        c && setConn({ effectiveType: c.effectiveType, downlink: c.downlink, rtt: c.rtt, saveData: !!c.saveData });
      c?.addEventListener?.("change", onChange);
      return () => {
        window.removeEventListener("online", up);
        window.removeEventListener("offline", down);
        c?.removeEventListener?.("change", onChange);
      };
    }, []);
    const runPing = async () => {
      try {
        const t0 = performance.now();
        await fetch(`${window.location.origin}/favicon.ico?probe=${Date.now()}`, { cache: "no-store" });
        setPing(Math.round(performance.now() - t0));
      } catch {
        setPing(null);
      }
    };

    useEffect(() => {
      runPing();
      const id = setInterval(runPing, 15000);
      return () => clearInterval(id);
    }, []);
    return { online, conn, ping, runPing };
  };

  const useBattery = () => {
    const [bat, setBat] = useState({ level: null, charging: null, chargingTime: null, dischargingTime: null });
    useEffect(() => {
      (async () => {
        if (!navigator.getBattery) return;
        try {
          const b = await navigator.getBattery();
          const push = () =>
            setBat({
              level: b.level,
              charging: b.charging,
              chargingTime: b.chargingTime,
              dischargingTime: b.dischargingTime
            });
          push();
          b.addEventListener("levelchange", push);
          b.addEventListener("chargingchange", push);
          b.addEventListener("chargingtimechange", push);
          b.addEventListener("dischargingtimechange", push);
        } catch {}
      })();
    }, []);
    return bat;
  };

  const useDisplay = () => {
    const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1 });
    const [scr] = useState({
      w: screen.width,
      h: screen.height,
      aw: screen.availWidth,
      ah: screen.availHeight,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth
    });
    const [orientation, setOrientation] = useState(() =>
      screen.orientation ? `${screen.orientation.type} (${screen.orientation.angle}°)` : "—"
    );
    useEffect(() => {
      const onR = () => setVp({ w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1 });
      const onO = () =>
        setOrientation(screen.orientation ? `${screen.orientation.type} (${screen.orientation.angle}°)` : "—");
      window.addEventListener("resize", onR);
      screen.orientation?.addEventListener?.("change", onO);
      return () => {
        window.removeEventListener("resize", onR);
        screen.orientation?.removeEventListener?.("change", onO);
      };
    }, []);
    const mq = (q) => (window.matchMedia ? window.matchMedia(q).matches : null);
    const gamut = mq("(color-gamut: rec2020)") ? "rec2020" : mq("(color-gamut: p3)") ? "p3" : mq("(color-gamut: srgb)") ? "srgb" : "—";
    const hdr = mq("(dynamic-range: high)") ? "High" : mq("(dynamic-range: standard)") ? "Standard" : "—";
    const reducedMotion = mq("(prefers-reduced-motion: reduce)");
    const highContrast = mq("(prefers-contrast: more)");
    const darkMode = mq("(prefers-color-scheme: dark)");
    const pointer = mq("(pointer: coarse)") ? "coarse" : mq("(pointer: fine)") ? "fine" : "—";
    return { vp, scr, orientation, gamut, hdr, reducedMotion, highContrast, darkMode, pointer };
  };

  const useGraphics = () => {
    const [gl, setGl] = useState({ gl2: false, renderer: "—", vendor: "—", shading: "—", antialias: null });
    const [gpu, setGpu] = useState({ features: [], limits: {} });
    useEffect(() => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("webgl2") || canvas.getContext("webgl");
        if (ctx) {
          const gl2 = !!canvas.getContext("webgl2");
          const ext = ctx.getExtension("WEBGL_debug_renderer_info");
          const renderer = ext ? ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "Hidden";
          const vendor = ext ? ctx.getParameter(ext.UNMASKED_VENDOR_WEBGL) : "Hidden";
          const shading = ctx.getParameter(ctx.SHADING_LANGUAGE_VERSION);
          const antialias = ctx.getContextAttributes().antialias;
          setGl({ gl2, renderer, vendor, shading, antialias });
        }
      } catch {}
      (async () => {
        try {
          if (!navigator.gpu) return;
          const adapter = await navigator.gpu.requestAdapter();
          if (!adapter) return;
          const features = Array.from(adapter.features ?? []);
          const limits = adapter.limits ? Object.fromEntries(Object.entries(adapter.limits)) : {};
          setGpu({ features, limits });
        } catch {}
      })();
    }, []);
    return { gl, gpu };
  };

  const useMedia = () => {
    const [devices, setDevices] = useState([]);
    const [ac, setAc] = useState({ rate: null, state: "—", latency: "—" });
    useEffect(() => {
      const md = navigator.mediaDevices;
      md?.enumerateDevices?.().then((d) => setDevices(d)).catch(() => {});
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          setAc({
            rate: ctx.sampleRate || null,
            state: ctx.state || "—",
            latency: ctx.baseLatency ? `${fmtMs(ctx.baseLatency * 1000)}` : "—"
          });
          ctx.close?.();
        }
      } catch {}
    }, []);
    return { devices, ac };
  };

  const useStorage = () => {
    const [estimate, setEstimate] = useState({ usage: null, quota: null });
    useEffect(() => {
      (async () => {
        try {
          if (navigator.storage?.estimate) {
            const { usage, quota } = await navigator.storage.estimate();
            setEstimate({ usage: usage ?? null, quota: quota ?? null });
          }
        } catch {}
      })();
    }, []);
    return estimate;
  };

  const usePerms = () => {
    const [perms, setPerms] = useState({});
    useEffect(() => {
      const names = [
        "geolocation",
        "notifications",
        "camera",
        "microphone",
        "clipboard-read",
        "clipboard-write"
      ];
      (async () => {
        if (!navigator.permissions?.query) return;
        const out = {};
        for (const n of names) {
          try {
            const st = await navigator.permissions.query({ name: n });
            out[n] = st.state;
            st.onchange = () => setPerms((prev) => ({ ...prev, [n]: st.state }));
          } catch {
            out[n] = "—";
          }
        }
        setPerms(out);
      })();
    }, []);
    return perms;
  };

  const useEnv = () => {
    const ua = navigator.userAgent;
    const lang = navigator.language;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const cores = navigator.hardwareConcurrency || null;
    const devMem = navigator.deviceMemory || null;
    const secure = window.isSecureContext;
    const uaCH = navigator.userAgentData || null;
    return { ua, uaCH, lang, tz, cores, devMem, secure };
  };

  const useSensors = () => {
    const [geo, setGeo] = useState({ granted: null, coords: null, err: null });
    const askGeo = async () => {
      try {
        if (!navigator.geolocation) {
          setGeo({ granted: false, coords: null, err: "No API." });
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => setGeo({ granted: true, coords: pos.coords, err: null }),
          (e) => setGeo({ granted: false, coords: null, err: e.message }),
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
      } catch (error) {
        setGeo({ granted: false, coords: null, err: String(error) });
      }
    };
    return { geo, askGeo };
  };

  const useFeatures = () => {
    const has = (v) => (v ? "Supported" : "Unavailable");
    return {
      serviceWorker: has("serviceWorker" in navigator),
      webAssembly: has(typeof WebAssembly === "object"),
      webRtc: has(typeof window.RTCPeerConnection === "function"),
      webSocket: has(typeof window.WebSocket === "function"),
      webWorker: has(typeof window.Worker === "function"),
      sharedWorker: has(typeof window.SharedWorker === "function"),
      webBluetooth: has("bluetooth" in navigator),
      webUsb: has("usb" in navigator),
      webSerial: has("serial" in navigator),
      webHid: has("hid" in navigator),
      webMidi: has("requestMIDIAccess" in navigator),
      webXr: has("xr" in navigator),
      webGpu: has("gpu" in navigator),
      webCodecs: has(typeof window.VideoEncoder === "function"),
      webTransport: has(typeof window.WebTransport === "function"),
      offscreenCanvas: has(typeof window.OffscreenCanvas === "function"),
      compression: has(typeof window.CompressionStream === "function"),
      fileSystem: has("showOpenFilePicker" in window),
      wakeLock: has("wakeLock" in navigator),
      share: has("share" in navigator),
      vibrate: has("vibrate" in navigator),
      speech: has("speechSynthesis" in window),
      credentials: has("credentials" in navigator),
      subtleCrypto: has(!!window.crypto?.subtle),
      indexedDb: has("indexedDB" in window),
      broadcast: has(typeof window.BroadcastChannel === "function"),
      paymentRequest: has(typeof window.PaymentRequest === "function"),
      idleDetector: has("IdleDetector" in window)
    };
  };

  const useInput = () => {
    const [pointer, setPointer] = useState({ type: "—", hover: "—", touch: 0 });
    const [keyboard, setKeyboard] = useState("—");

    useEffect(() => {
      const fine = window.matchMedia("(pointer: fine)").matches;
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      const hover = window.matchMedia("(hover: hover)").matches;

      setPointer({
        type: fine ? "Fine" : coarse ? "Coarse" : "None",
        hover: hover ? "Supported" : "Unavailable",
        touch: navigator.maxTouchPoints || 0
      });

      (async () => {
        try {
          const layout = await navigator.keyboard?.getLayoutMap?.();
          if (layout) {
            setKeyboard(layout.get("KeyQ") ? layout.get("KeyQ").toUpperCase() : "—");
          }
        } catch {}
      })();
    }, []);

    return { pointer, keyboard };
  };

  const useCodecs = () => {
    const [codecs, setCodecs] = useState({});

    useEffect(() => {
      const video = document.createElement("video");
      const audio = document.createElement("audio");
      const probe = (el, type) => {
        const r = el.canPlayType(type);
        return r === "probably" ? "Full" : r === "maybe" ? "Partial" : "None";
      };

      setCodecs({
        h264: probe(video, 'video/mp4; codecs="avc1.42E01E"'),
        hevc: probe(video, 'video/mp4; codecs="hvc1.1.6.L93.B0"'),
        vp9: probe(video, 'video/webm; codecs="vp9"'),
        av1: probe(video, 'video/mp4; codecs="av01.0.05M.08"'),
        aac: probe(audio, 'audio/mp4; codecs="mp4a.40.2"'),
        opus: probe(audio, 'audio/webm; codecs="opus"'),
        flac: probe(audio, "audio/flac"),
        wav: probe(audio, "audio/wav")
      });
    }, []);

    return codecs;
  };

  const useTiming = () => {
    const [timing, setTiming] = useState({ skew: null, resolution: null, uptime: 0 });

    useEffect(() => {
      const t0 = performance.now();
      let smallest = Infinity;
      for (let i = 0; i < 5000; i++) {
        const a = performance.now();
        const b = performance.now();
        const d = b - a;
        if (d > 0 && d < smallest) {
          smallest = d;
        }
      }

      setTiming((prev) => ({
        ...prev,
        resolution: isFinite(smallest) ? smallest : null,
        skew: performance.timeOrigin ? Date.now() - (performance.timeOrigin + performance.now()) : null
      }));

      const id = setInterval(() => {
        setTiming((prev) => ({ ...prev, uptime: performance.now() }));
      }, 1000);

      return () => clearInterval(id);
    }, []);

    return timing;
  };

  const useFrameRate = () => {
    const [fps, setFps] = useState({ current: 0, min: 0, max: 0, jank: 0 });

    useEffect(() => {
      let frames = 0;
      let last = performance.now();
      let raf = 0;
      let lo = Infinity;
      let hi = 0;
      let jank = 0;
      let prevFrame = performance.now();

      const tick = (now) => {
        frames++;
        if (now - prevFrame > 50) {
          jank++;
        }
        prevFrame = now;

        if (now - last >= 1000) {
          const value = Math.round((frames * 1000) / (now - last));
          lo = Math.min(lo, value);
          hi = Math.max(hi, value);
          setFps({ current: value, min: isFinite(lo) ? lo : 0, max: hi, jank: jank });
          frames = 0;
          last = now;
        }
        raf = requestAnimationFrame(tick);
      };

      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, []);

    return fps;
  };

  const useFonts = () => {
    const [fonts, setFonts] = useState({ available: [], count: 0 });

    useEffect(() => {
      const candidates = [
        "Arial", "Helvetica", "Helvetica Neue", "Times New Roman", "Georgia", "Garamond",
        "Courier New", "Verdana", "Tahoma", "Trebuchet MS", "Impact", "Comic Sans MS",
        "Palatino", "Bookman", "Avant Garde", "Optima", "Futura", "Baskerville",
        "Menlo", "Monaco", "Consolas", "SF Pro Text", "Segoe UI", "Roboto",
        "Ubuntu", "Cantarell", "Noto Sans", "Fira Code", "Inter", "Lato"
      ];

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const baseline = ["monospace", "sans-serif", "serif"];
      const text = "mmmmmmmmmmlli";
      const widths = {};

      baseline.forEach((b) => {
        ctx.font = `72px ${b}`;
        widths[b] = ctx.measureText(text).width;
      });

      const found = candidates.filter((font) =>
        baseline.some((b) => {
          ctx.font = `72px "${font}", ${b}`;
          return ctx.measureText(text).width !== widths[b];
        })
      );

      setFonts({ available: found, count: found.length });
    }, []);

    return fonts;
  };

  const useSecurity = () => {
    const [state, setState] = useState({
      workers: 0,
      cookieEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack || "Not Set",
      pdfViewer: navigator.pdfViewerEnabled,
      plugins: navigator.plugins ? navigator.plugins.length : 0,
      mimeTypes: navigator.mimeTypes ? navigator.mimeTypes.length : 0,
      crossOriginIsolated: window.crossOriginIsolated,
      protocol: window.location.protocol.replace(":", "").toUpperCase()
    });

    useEffect(() => {
      navigator.serviceWorker?.getRegistrations?.()
        .then((regs) => setState((prev) => ({ ...prev, workers: regs.length })))
        .catch(() => {});
    }, []);

    return state;
  };

  const useAccessibility = () => {
    const [prefs, setPrefs] = useState({});

    useEffect(() => {
      const queries = {
        reducedMotion: "(prefers-reduced-motion: reduce)",
        reducedData: "(prefers-reduced-data: reduce)",
        reducedTransparency: "(prefers-reduced-transparency: reduce)",
        highContrast: "(prefers-contrast: more)",
        forcedColors: "(forced-colors: active)",
        darkMode: "(prefers-color-scheme: dark)",
        invertedColors: "(inverted-colors: inverted)"
      };

      const read = () => {
        const out = {};
        Object.entries(queries).forEach(([key, q]) => {
          try {
            out[key] = window.matchMedia(q).matches;
          } catch {
            out[key] = null;
          }
        });
        setPrefs(out);
      };

      read();

      const lists = Object.values(queries).map((q) => window.matchMedia(q));
      lists.forEach((l) => l.addEventListener?.("change", read));
      return () => lists.forEach((l) => l.removeEventListener?.("change", read));
    }, []);

    return prefs;
  };

  const useGpuLimits = () => {
    const [limits, setLimits] = useState({});

    useEffect(() => {
      try {
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
        if (!gl) {
          return;
        }

        setLimits({
          maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE),
          maxCubeMap: gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE),
          maxRenderBuffer: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
          maxViewport: (gl.getParameter(gl.MAX_VIEWPORT_DIMS) || []).join(" by "),
          maxVertexAttribs: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
          maxTextureUnits: gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS),
          maxVaryings: gl.getParameter(gl.MAX_VARYING_VECTORS ?? gl.MAX_VARYING_COMPONENTS),
          extensions: (gl.getSupportedExtensions() || []).length
        });
      } catch {}
    }, []);

    return limits;
  };

  const useLocale = () => {
    const opts = Intl.DateTimeFormat().resolvedOptions();
    const nf = new Intl.NumberFormat();
    const nfOpts = nf.resolvedOptions();

    return {
      locale: opts.locale,
      calendar: opts.calendar,
      numbering: opts.numberingSystem,
      currency: nfOpts.currency || "Not Set",
      languages: (navigator.languages || []).length,
      firstLanguage: (navigator.languages || [])[0] || "\u2014",
      hourCycle: opts.hourCycle || "\u2014",
      utcOffset: `${-new Date().getTimezoneOffset() / 60} hours`
    };
  };

  const useResourceLog = () => {
    const [rows, setRows] = useState([]);

    useEffect(() => {
      const shape = (e) => ({
        id: `${e.name}-${e.startTime}`,
        name: (e.name || "").split("/").pop().split("?")[0] || e.name,
        kind: e.initiatorType || "other",
        duration: e.duration,
        size: e.transferSize || 0,
        encoded: e.encodedBodySize || 0,
        protocol: e.nextHopProtocol || "\u2014",
        cached: e.transferSize === 0 && e.decodedBodySize > 0,
        startTime: e.startTime
      });

      try {
        setRows(performance.getEntriesByType("resource").map(shape).slice(-300));
      } catch {}

      let observer = null;
      try {
        observer = new PerformanceObserver((list) => {
          const next = list.getEntries().map(shape);
          setRows((prev) => [...prev, ...next].slice(-300));
        });
        observer.observe({ type: "resource", buffered: false });
      } catch {}

      return () => {
        try {
          observer?.disconnect();
        } catch {}
      };
    }, []);

    return rows;
  };

  const useLongTasks = () => {
    const [rows, setRows] = useState([]);

    useEffect(() => {
      let observer = null;
      try {
        observer = new PerformanceObserver((list) => {
          const next = list.getEntries().map((e) => ({
            id: `${e.startTime}-${e.duration}`,
            startTime: e.startTime,
            duration: e.duration,
            source: e.attribution?.[0]?.name || e.name || "unknown",
            container: e.attribution?.[0]?.containerType || "window"
          }));
          setRows((prev) => [...prev, ...next].slice(-200));
        });
        observer.observe({ type: "longtask", buffered: true });
      } catch {}

      return () => {
        try {
          observer?.disconnect();
        } catch {}
      };
    }, []);

    return rows;
  };

  const useEventLog = () => {
    const [rows, setRows] = useState([]);

    useEffect(() => {
      let counter = 0;
      const push = (kind, detail) => {
        counter += 1;
        setRows((prev) => [
          ...prev,
          { id: `${Date.now()}-${counter}`, at: Date.now(), kind: kind, detail: detail }
        ].slice(-200));
      };

      const handlers = [
        ["online", () => push("Network", "Connection restored.")],
        ["offline", () => push("Network", "Connection lost.")],
        ["resize", () => push("Viewport", `${window.innerWidth} by ${window.innerHeight}`)],
        ["focus", () => push("Window", "Gained focus.")],
        ["blur", () => push("Window", "Lost focus.")]
      ];

      handlers.forEach(([name, fn]) => window.addEventListener(name, fn));

      const onVisibility = () => push("Visibility", document.hidden ? "Hidden." : "Visible.");
      document.addEventListener("visibilitychange", onVisibility);

      push("Session", "Monitoring started.");

      return () => {
        handlers.forEach(([name, fn]) => window.removeEventListener(name, fn));
        document.removeEventListener("visibilitychange", onVisibility);
      };
    }, []);

    return rows;
  };

  const useErrorLog = () => {
    const [rows, setRows] = useState([]);

    useEffect(() => {
      let counter = 0;
      const push = (kind, message, origin) => {
        counter += 1;
        setRows((prev) => [
          ...prev,
          { id: `${Date.now()}-${counter}`, at: Date.now(), kind: kind, message: message, origin: origin }
        ].slice(-100));
      };

      const onError = (e) => push("Error", e.message || "Unknown error.", `${(e.filename || "").split("/").pop()}:${e.lineno || 0}`);
      const onRejection = (e) => push("Rejection", String(e.reason?.message || e.reason || "Unhandled rejection."), "promise");

      window.addEventListener("error", onError);
      window.addEventListener("unhandledrejection", onRejection);

      return () => {
        window.removeEventListener("error", onError);
        window.removeEventListener("unhandledrejection", onRejection);
      };
    }, []);

    return rows;
  };

  const useHighEntropy = () => {
    const [ua, setUa] = useState({});

    useEffect(() => {
      navigator.userAgentData?.getHighEntropyValues?.([
        "architecture",
        "bitness",
        "model",
        "platformVersion",
        "uaFullVersion",
        "fullVersionList",
        "wow64"
      ])
        .then((v) => setUa(v || {}))
        .catch(() => {});
    }, []);

    return ua;
  };

  const useStorageDetail = () => {
    const [detail, setDetail] = useState({ persisted: null, details: {}, buckets: null });

    useEffect(() => {
      (async () => {
        try {
          const persisted = await navigator.storage?.persisted?.();
          const est = await navigator.storage?.estimate?.();
          let buckets = null;
          try {
            const keys = await navigator.storageBuckets?.keys?.();
            buckets = keys ? keys.length : null;
          } catch {}
          setDetail({
            persisted: persisted ?? null,
            details: est?.usageDetails || {},
            buckets: buckets
          });
        } catch {}
      })();
    }, []);

    return detail;
  };

  const useDecodeSupport = () => {
    const [support, setSupport] = useState({});

    useEffect(() => {
      const targets = [
        ["h264", 'video/mp4; codecs="avc1.42E01E"'],
        ["vp9", 'video/webm; codecs="vp09.00.10.08"'],
        ["av1", 'video/mp4; codecs="av01.0.05M.08"'],
        ["hevc", 'video/mp4; codecs="hvc1.1.6.L93.B0"']
      ];

      (async () => {
        if (!navigator.mediaCapabilities?.decodingInfo) {
          return;
        }
        const out = {};
        for (const [key, contentType] of targets) {
          try {
            const info = await navigator.mediaCapabilities.decodingInfo({
              type: "file",
              video: { contentType: contentType, width: 1920, height: 1080, bitrate: 4000000, framerate: 30 }
            });
            out[key] = !info.supported
              ? "Unsupported"
              : info.smooth && info.powerEfficient
              ? "Smooth And Efficient"
              : info.smooth
              ? "Smooth"
              : info.powerEfficient
              ? "Efficient"
              : "Supported";
          } catch {
            out[key] = "\u2014";
          }
        }
        setSupport(out);
      })();
    }, []);

    return support;
  };

  const useShiftLog = () => {
    const [rows, setRows] = useState([]);

    useEffect(() => {
      let observer = null;
      let counter = 0;
      try {
        observer = new PerformanceObserver((list) => {
          const next = list.getEntries()
            .filter((e) => !e.hadRecentInput)
            .map((e) => {
              counter += 1;
              const source = e.sources?.[0]?.node;
              return {
                id: `${e.startTime}-${counter}`,
                at: e.startTime,
                value: e.value,
                element: source ? `${source.nodeName.toLowerCase()}${source.className ? "." + String(source.className).split(" ")[0] : ""}` : "unknown"
              };
            });
          if (next.length) {
            setRows((prev) => [...prev, ...next].slice(-100));
          }
        });
        observer.observe({ type: "layout-shift", buffered: true });
      } catch {}

      return () => {
        try {
          observer?.disconnect();
        } catch {}
      };
    }, []);

    return rows;
  };

  const useInteractionLog = () => {
    const [rows, setRows] = useState([]);

    useEffect(() => {
      let observer = null;
      let counter = 0;
      try {
        observer = new PerformanceObserver((list) => {
          const next = list.getEntries()
            .filter((e) => e.duration >= 16)
            .map((e) => {
              counter += 1;
              return {
                id: `${e.startTime}-${counter}`,
                name: e.name,
                duration: e.duration,
                delay: e.processingStart - e.startTime,
                target: e.target ? e.target.nodeName.toLowerCase() : "\u2014"
              };
            });
          if (next.length) {
            setRows((prev) => [...prev, ...next].slice(-100));
          }
        });
        observer.observe({ type: "event", buffered: true, durationThreshold: 16 });
      } catch {}

      return () => {
        try {
          observer?.disconnect();
        } catch {}
      };
    }, []);

    return rows;
  };

  const copyText = async (txt) => {
    try {
      await navigator.clipboard?.writeText(txt);
    } catch {}
  };

  const env = useEnv();
  const disp = useDisplay();
  const net = useNetwork();
  const bat = useBattery();
  const perf = usePerf();
  const gfx = useGraphics();
  const med = useMedia();
  const store = useStorage();
  const perms = usePerms();
  const sensors = useSensors();
  const uiLoad = useUiLoadIndex();


  const features = useFeatures();
  const input = useInput();
  const codecs = useCodecs();
  const timing = useTiming();
  const frameRate = useFrameRate();
  const fonts = useFonts();
  const security = useSecurity();
  const a11y = useAccessibility();
  const gpuLimits = useGpuLimits();
  const locale = useLocale();
  const resourceLog = useResourceLog();
  const longTasks = useLongTasks();
  const eventLog = useEventLog();
  const errorLog = useErrorLog();
  const highEntropy = useHighEntropy();
  const storageDetail = useStorageDetail();
  const decodeSupport = useDecodeSupport();
  const shiftLog = useShiftLog();
  const interactionLog = useInteractionLog();


  const storageUsage = useMemo(
    () => (store.quota ? clamp01((store.usage || 0) / store.quota) : null),
    [store]
  );
  const heap = performance?.memory
    ? { used: performance.memory.usedJSHeapSize, total: performance.memory.totalJSHeapSize }
    : null;

  const snapshot = () =>
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        env,
        display: disp,
        network: net,
        battery: bat,
        perf,
        graphics: gfx,
        media: { devices: med.devices, audio: med.ac },
        storage: store,
        permissions: perms,
        features,
        input,
        codecs,
        timing,
        frameRate,
        fonts,
        security,
        accessibility: a11y,
        gpuLimits,
        locale,
        highEntropy,
        storageDetail,
        decodeSupport,
        heap
      },
      null,
      2
    );
  const exportReport = async () => {
    const text = snapshot();
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: `system-monitor-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
    });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    await copyText(text);
  };

  const [query, setQuery] = useState("");

  const strips = [
    {
      title: "Environment",
      icon: faGlobe,
      items: [
        ["Platform", env.uaCH?.platform || navigator.platform || "\u2014"],
        ["Language", env.lang],
        ["Time Zone", env.tz || "\u2014"],
        ["Secure Context", B(env.secure)],
        ["CPU Cores", env.cores || "\u2014"],
        ["Device Memory", env.devMem ? `${env.devMem} GB` : "\u2014"],
        ["Mobile", env.uaCH ? B(env.uaCH.mobile) : "\u2014"]
      ]
    },
    {
      title: "Display",
      icon: faDesktop,
      items: [
        ["Viewport", `${disp.vp.w} by ${disp.vp.h}`],
        ["Pixel Ratio", `${disp.vp.dpr}x`],
        ["Screen", `${disp.scr.w} by ${disp.scr.h}`],
        ["Available", `${disp.scr.aw} by ${disp.scr.ah}`],
        ["Colour Depth", `${disp.scr.colorDepth} bit`],
        ["Orientation", disp.orientation || "\u2014"],
        ["Colour Gamut", disp.gamut || "\u2014"]
      ]
    },
    {
      title: "Rendering",
      icon: faBolt,
      items: [
        ["Frame Rate", `${frameRate.current} FPS`],
        ["Lowest", `${frameRate.min} FPS`],
        ["Highest", `${frameRate.max} FPS`],
        ["Dropped Frames", `${frameRate.jank}`],
        ["Clock Resolution", timing.resolution != null ? `${timing.resolution.toFixed(3)} ms` : "\u2014"],
        ["Clock Skew", timing.skew != null ? `${Math.round(timing.skew)} ms` : "\u2014"],
        ["Page Uptime", `${Math.round(timing.uptime / 1000)} s`]
      ]
    },
    {
      title: "Network",
      icon: faWifi,
      items: [
        ["Status", net.online ? "Online" : "Offline"],
        ["Type", net.conn?.effectiveType || "\u2014"],
        ["Downlink", net.conn?.downlink ? `${net.conn.downlink} Mbps` : "\u2014"],
        ["Round Trip", net.conn?.rtt != null ? `${net.conn.rtt} ms` : "\u2014"],
        ["Save Data", net.conn ? B(net.conn.saveData) : "\u2014"],
        ["Ping", fmtMs(net.ping)],
        ["Web Transport", features.webTransport]
      ]
    },
    {
      title: "Battery",
      icon: faBatteryHalf,
      items: [
        ["Level", bat.level != null ? `${Math.round(bat.level * 100)}%` : "\u2014"],
        ["Charging", bat.charging == null ? "\u2014" : B(bat.charging)],
        ["Time To Full", bat.chargingTime && isFinite(bat.chargingTime) ? `${Math.round(bat.chargingTime / 60)} min` : "\u2014"],
        ["Time To Empty", bat.dischargingTime && isFinite(bat.dischargingTime) ? `${Math.round(bat.dischargingTime / 60)} min` : "\u2014"],
        ["Wake Lock", features.wakeLock],
        ["Idle Detector", features.idleDetector],
        ["Vibration", features.vibrate]
      ]
    },
    {
      title: "Performance",
      icon: faGaugeHigh,
      items: [
        ["First Byte", fmtMs(perf.ttfb)],
        ["DOM Ready", fmtMs(perf.dcl)],
        ["Load Complete", fmtMs(perf.load)],
        ["First Paint", fmtMs(perf.fcp)],
        ["Largest Paint", fmtMs(perf.lcp)],
        ["Layout Shift", perf.cls != null ? perf.cls.toFixed(3) : "\u2014"],
        ["Heap Used", heap ? fmtBytes(heap.used) : "\u2014"]
      ]
    },
    {
      title: "Graphics",
      icon: faCubes,
      items: [
        ["WebGL 2", B(gfx.gl.gl2)],
        ["Renderer", gfx.gl.renderer],
        ["Vendor", gfx.gl.vendor],
        ["Shading Language", gfx.gl.shading],
        ["Antialiasing", gfx.gl.antialias == null ? "\u2014" : B(gfx.gl.antialias)],
        ["WebGPU", features.webGpu],
        ["Offscreen Canvas", features.offscreenCanvas]
      ]
    },
    {
      title: "Media",
      icon: faHeadphones,
      items: [
        ["Audio Inputs", `${med.devices.filter((d) => d.kind === "audioinput").length}`],
        ["Audio Outputs", `${med.devices.filter((d) => d.kind === "audiooutput").length}`],
        ["Video Inputs", `${med.devices.filter((d) => d.kind === "videoinput").length}`],
        ["Sample Rate", med.ac.rate ? `${med.ac.rate} Hz` : "\u2014"],
        ["Audio State", med.ac.state],
        ["Base Latency", med.ac.latency],
        ["Web Codecs", features.webCodecs]
      ]
    },
    {
      title: "Codecs",
      icon: faFilm,
      items: [
        ["H.264", codecs.h264 || "\u2014"],
        ["HEVC", codecs.hevc || "\u2014"],
        ["VP9", codecs.vp9 || "\u2014"],
        ["AV1", codecs.av1 || "\u2014"],
        ["AAC", codecs.aac || "\u2014"],
        ["Opus", codecs.opus || "\u2014"],
        ["FLAC", codecs.flac || "\u2014"]
      ]
    },
    {
      title: "Storage",
      icon: faHardDrive,
      items: [
        ["Used", store.usage != null ? fmtBytes(store.usage) : "\u2014"],
        ["Quota", store.quota != null ? fmtBytes(store.quota) : "\u2014"],
        ["Utilisation", pctLabel(storageUsage)],
        ["Indexed Database", features.indexedDb],
        ["File System", features.fileSystem],
        ["Cache Storage", "caches" in window ? "Supported" : "Unavailable"],
        ["Compression", features.compression]
      ]
    },
    {
      title: "Input",
      icon: faKeyboard,
      items: [
        ["Pointer", input.pointer.type],
        ["Hover", input.pointer.hover],
        ["Touch Points", `${input.pointer.touch}`],
        ["Keyboard Layout", input.keyboard],
        ["Web MIDI", features.webMidi],
        ["Gamepad", "getGamepads" in navigator ? "Supported" : "Unavailable"],
        ["Speech Synthesis", features.speech]
      ]
    },
    {
      title: "Platform APIs",
      icon: faMicrochip,
      items: [
        ["Service Worker", features.serviceWorker],
        ["WebAssembly", features.webAssembly],
        ["Web Workers", features.webWorker],
        ["Shared Workers", features.sharedWorker],
        ["Broadcast Channel", features.broadcast],
        ["Subtle Crypto", features.subtleCrypto],
        ["Credentials", features.credentials]
      ]
    },
    {
      title: "Hardware APIs",
      icon: faPlug,
      items: [
        ["Bluetooth", features.webBluetooth],
        ["USB", features.webUsb],
        ["Serial", features.webSerial],
        ["Human Interface", features.webHid],
        ["Extended Reality", features.webXr],
        ["Real Time", features.webRtc],
        ["Payment Request", features.paymentRequest]
      ]
    },
    {
      title: "Permissions",
      icon: faLock,
      items: [
        ["Geolocation", perms.geolocation || "\u2014"],
        ["Notifications", perms.notifications || "\u2014"],
        ["Camera", perms.camera || "\u2014"],
        ["Microphone", perms.microphone || "\u2014"],
        ["Clipboard Read", perms["clipboard-read"] || "\u2014"],
        ["Clipboard Write", perms["clipboard-write"] || "\u2014"],
        ["Web Share", features.share]
      ]
    },
    {
      title: "Locale",
      icon: faLanguage,
      items: [
        ["Locale", locale.locale],
        ["Calendar", locale.calendar],
        ["Numbering", locale.numbering],
        ["Currency", locale.currency],
        ["Hour Cycle", locale.hourCycle],
        ["UTC Offset", locale.utcOffset],
        ["Languages", `${locale.languages}`]
      ]
    },
    {
      title: "Accessibility",
      icon: faUniversalAccess,
      items: [
        ["Reduced Motion", a11y.reducedMotion == null ? "\u2014" : B(a11y.reducedMotion)],
        ["Reduced Data", a11y.reducedData == null ? "\u2014" : B(a11y.reducedData)],
        ["Reduced Transparency", a11y.reducedTransparency == null ? "\u2014" : B(a11y.reducedTransparency)],
        ["High Contrast", a11y.highContrast == null ? "\u2014" : B(a11y.highContrast)],
        ["Forced Colours", a11y.forcedColors == null ? "\u2014" : B(a11y.forcedColors)],
        ["Dark Mode", a11y.darkMode == null ? "\u2014" : B(a11y.darkMode)],
        ["Inverted Colours", a11y.invertedColors == null ? "\u2014" : B(a11y.invertedColors)]
      ]
    },
    {
      title: "GPU Limits",
      icon: faCubes,
      items: [
        ["Max Texture", gpuLimits.maxTexture ? `${gpuLimits.maxTexture} px` : "\u2014"],
        ["Max Cube Map", gpuLimits.maxCubeMap ? `${gpuLimits.maxCubeMap} px` : "\u2014"],
        ["Max Render Buffer", gpuLimits.maxRenderBuffer ? `${gpuLimits.maxRenderBuffer} px` : "\u2014"],
        ["Max Viewport", gpuLimits.maxViewport || "\u2014"],
        ["Vertex Attributes", gpuLimits.maxVertexAttribs || "\u2014"],
        ["Texture Units", gpuLimits.maxTextureUnits || "\u2014"],
        ["Extensions", gpuLimits.extensions || "\u2014"]
      ]
    },
    {
      title: "Security",
      icon: faShieldHalved,
      items: [
        ["Protocol", security.protocol],
        ["Cross Origin Isolated", B(security.crossOriginIsolated)],
        ["Cookies", B(security.cookieEnabled)],
        ["Do Not Track", security.doNotTrack === "1" ? "Enabled" : security.doNotTrack === "0" ? "Disabled" : "Not Set"],
        ["Service Workers", `${security.workers}`],
        ["Plugins", `${security.plugins}`],
        ["MIME Types", `${security.mimeTypes}`]
      ]
    },
    {
      title: "Typography",
      icon: faFont,
      items: [
        ["Detected Fonts", `${fonts.count}`],
        ["Monospace", fonts.available.includes("Menlo") || fonts.available.includes("Consolas") ? "Present" : "Default"],
        ["Helvetica", fonts.available.includes("Helvetica") ? "Present" : "Absent"],
        ["Georgia", fonts.available.includes("Georgia") ? "Present" : "Absent"],
        ["Verdana", fonts.available.includes("Verdana") ? "Present" : "Absent"],
        ["Roboto", fonts.available.includes("Roboto") ? "Present" : "Absent"],
        ["PDF Viewer", security.pdfViewer == null ? "\u2014" : B(security.pdfViewer)]
      ]
    },
    {
      title: "Client Hints",
      icon: faMicrochip,
      items: [
        ["Architecture", highEntropy.architecture || "\u2014"],
        ["Bitness", highEntropy.bitness ? `${highEntropy.bitness} bit` : "\u2014"],
        ["Model", highEntropy.model || "Not Reported"],
        ["Platform Version", highEntropy.platformVersion || "\u2014"],
        ["Browser Version", highEntropy.uaFullVersion || "\u2014"],
        ["Brands", highEntropy.fullVersionList ? `${highEntropy.fullVersionList.length}` : "\u2014"],
        ["WOW64", highEntropy.wow64 == null ? "\u2014" : B(highEntropy.wow64)]
      ]
    },
    {
      title: "Storage Detail",
      icon: faHardDrive,
      items: [
        ["Persisted", storageDetail.persisted == null ? "\u2014" : B(storageDetail.persisted)],
        ["Storage Buckets", storageDetail.buckets == null ? "Unavailable" : `${storageDetail.buckets}`],
        ["Indexed Database", storageDetail.details.indexedDB != null ? fmtBytes(storageDetail.details.indexedDB) : "\u2014"],
        ["Cache Storage", storageDetail.details.caches != null ? fmtBytes(storageDetail.details.caches) : "\u2014"],
        ["Service Workers", storageDetail.details.serviceWorkerRegistrations != null ? fmtBytes(storageDetail.details.serviceWorkerRegistrations) : "\u2014"],
        ["File System", storageDetail.details.fileSystem != null ? fmtBytes(storageDetail.details.fileSystem) : "\u2014"],
        ["Detail Reported", Object.keys(storageDetail.details).length ? "Yes" : "No"]
      ]
    },
    {
      title: "Decode Capability",
      icon: faFilm,
      items: [
        ["H.264 At 1080p", decodeSupport.h264 || "\u2014"],
        ["VP9 At 1080p", decodeSupport.vp9 || "\u2014"],
        ["AV1 At 1080p", decodeSupport.av1 || "\u2014"],
        ["HEVC At 1080p", decodeSupport.hevc || "\u2014"],
        ["Media Capabilities", "mediaCapabilities" in navigator ? "Supported" : "Unavailable"],
        ["Media Session", "mediaSession" in navigator ? "Supported" : "Unavailable"],
        ["Picture In Picture", "pictureInPictureEnabled" in document ? B(document.pictureInPictureEnabled) : "\u2014"]
      ]
    },
    {
      title: "Location",
      icon: faLocationDot,
      items: [
        ["Latitude", sensors.geo.coords ? sensors.geo.coords.latitude.toFixed(5) : "\u2014"],
        ["Longitude", sensors.geo.coords ? sensors.geo.coords.longitude.toFixed(5) : "\u2014"],
        ["Accuracy", sensors.geo.coords ? `${Math.round(sensors.geo.coords.accuracy)} m` : "\u2014"],
        ["Altitude", sensors.geo.coords && sensors.geo.coords.altitude != null ? `${Math.round(sensors.geo.coords.altitude)} m` : "\u2014"],
        ["Heading", sensors.geo.coords && sensors.geo.coords.heading != null ? `${Math.round(sensors.geo.coords.heading)} deg` : "\u2014"],
        ["Speed", sensors.geo.coords && sensors.geo.coords.speed != null ? `${sensors.geo.coords.speed.toFixed(1)} m/s` : "\u2014"],
        ["Status", sensors.geo.err ? "Denied" : sensors.geo.granted ? "Granted" : "Not Requested"]
      ]
    }
  ]
  const term = query.trim().toLowerCase();

  const activeStrips = term
    ? strips
        .map((strip) => ({
          ...strip,
          items: strip.items.filter(
            ([label, value]) =>
              label.toLowerCase().includes(term) ||
              String(value).toLowerCase().includes(term) ||
              strip.title.toLowerCase().includes(term)
          )
        }))
        .filter((strip) => strip.items.length > 0)
    : strips;

  const matchCount = activeStrips.reduce((sum, strip) => sum + strip.items.length, 0);

  return (
    <div className="systemPageWrapper">
      <Nav activePage="monitor" />

      {!isPageLoaded ? (
        <div className="systemHeaderContainer" style={{ justifyContent: "center" }}>
          <div className="loading-wrapper">
            <div className="loading-circle" />
            <label className="loading-title">
              Loading
            </label>
          </div>
        </div>
      ) : !organizationID ? (
        <div className="systemHeaderContainer">
          <div className="disconnectedNoResults">
            <div className="disconnectedNoResultCell">
              <FontAwesomeIcon icon={faUsers} size="5x" className="disconnectedNoResultsIcon" />
              <div className="disconnectedNoResultsText">Join a team to access this feature.</div>
              <div className="disconnectedNoResultsButtons">
                <button className="disconnectedNoResultsRefresh" onClick={() => navigate("/account")}>
                  Join Team
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
      <div className="systemHeaderContainer">
        <div className="systemControlFlex">
          <div className="systemContentMainFlex">
            <div className="systemContentMainScroll">
              <div className="systemSearchWrap">
                <FontAwesomeIcon icon={faMagnifyingGlass} className="systemSearchIcon" />
                <input
                  type="text"
                  className="systemSearchInput"
                  placeholder="Search every datapoint."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {term ? (
                  <button className="systemSearchClear" onClick={() => setQuery("")}>
                    <span>{matchCount} Matches</span>
                    <FontAwesomeIcon icon={faXmark} />
                  </button>
                ) : null}

                <button className="systemSearchAction" onClick={sensors.askGeo}>
                  <FontAwesomeIcon icon={faLocationDot} />
                  <span>Request Location</span>
                </button>

                <button className="systemSearchAction" onClick={exportReport}>
                  <FontAwesomeIcon icon={faDownload} />
                  <span>Export Report</span>
                </button>
              </div>

              <div className="systemGaugeRow">
                <div className="systemGauge">
                  <div className="systemGaugeHead">
                    <FontAwesomeIcon icon={faHardDrive} />
                    <span>Storage Used</span>
                    <span className="systemGaugeValue">
                      {store.usage != null ? `${fmtBytes(store.usage)} of ${fmtBytes(store.quota)}` : "Unavailable"}
                    </span>
                  </div>
                  <UsageBar usage={storageUsage || 0} />
                </div>

                <div className="systemGauge">
                  <div className="systemGaugeHead">
                    <FontAwesomeIcon icon={faBatteryHalf} />
                    <span>Battery Level</span>
                    <span className="systemGaugeValue">
                      {bat.level != null ? `${Math.round(bat.level * 100)}%` : "0%"}
                    </span>
                  </div>
                  <UsageBar usage={bat.level || 0} />
                </div>

                <div className="systemGauge">
                  <div className="systemGaugeHead">
                    <FontAwesomeIcon icon={faBolt} />
                    <span>Interface Load</span>
                    <span className="systemGaugeValue">{pctLabel(uiLoad)}</span>
                  </div>
                  <UsageBar usage={uiLoad} />
                </div>

                <div className="systemGauge">
                  <div className="systemGaugeHead">
                    <FontAwesomeIcon icon={faMicrochip} />
                    <span>Heap Used</span>
                    <span className="systemGaugeValue">
                      {heap ? `${fmtBytes(heap.used)} of ${fmtBytes(heap.total)}` : "Unavailable"}
                    </span>
                  </div>
                  <UsageBar usage={heap && heap.total ? heap.used / heap.total : 0} />
                </div>
              </div>

              {activeStrips.length === 0 ? (
                <div className="systemNoMatch">
                  <FontAwesomeIcon icon={faMagnifyingGlass} />
                  <span>No datapoint matches that search.</span>
                </div>
              ) : null}

              {term ? null : (
                <div className="systemLogGrid">
                  <div className="systemSection systemLogWide">
                    <div className="systemSectionTitle">
                      <FontAwesomeIcon icon={faWifi} />
                      <span>Network Requests</span>
                      <span className="systemSectionCount">{resourceLog.length}</span>
                    </div>

                    <div className="systemLogScroll">
                      <table className="systemLogTable">
                        <thead>
                          <tr>
                            <th>Resource</th>
                            <th>Type</th>
                            <th>Protocol</th>
                            <th>Transfer</th>
                            <th>Duration</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resourceLog.slice().reverse().map((row) => (
                            <tr key={row.id}>
                              <td className="systemLogName">{row.name}</td>
                              <td>{row.kind}</td>
                              <td>{row.protocol}</td>
                              <td>{row.cached ? "Cached" : fmtBytes(row.size)}</td>
                              <td>{fmtMs(row.duration)}</td>
                            </tr>
                          ))}
                          {resourceLog.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="systemLogEmpty">No requests have been recorded yet.</td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="systemSection">
                    <div className="systemSectionTitle">
                      <FontAwesomeIcon icon={faBolt} />
                      <span>Long Tasks</span>
                      <span className="systemSectionCount">{longTasks.length}</span>
                    </div>

                    <div className="systemLogScroll">
                      <table className="systemLogTable">
                        <thead>
                          <tr>
                            <th>Source</th>
                            <th>Container</th>
                            <th>Duration</th>
                          </tr>
                        </thead>
                        <tbody>
                          {longTasks.slice().reverse().map((row) => (
                            <tr key={row.id}>
                              <td className="systemLogName">{row.source}</td>
                              <td>{row.container}</td>
                              <td>{fmtMs(row.duration)}</td>
                            </tr>
                          ))}
                          {longTasks.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="systemLogEmpty">No long tasks have blocked the main thread.</td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="systemSection">
                    <div className="systemSectionTitle">
                      <FontAwesomeIcon icon={faListCheck} />
                      <span>Event Log</span>
                      <span className="systemSectionCount">{eventLog.length}</span>
                    </div>

                    <div className="systemLogScroll">
                      <table className="systemLogTable">
                        <thead>
                          <tr>
                            <th>Time</th>
                            <th>Source</th>
                            <th>Detail</th>
                          </tr>
                        </thead>
                        <tbody>
                          {eventLog.slice().reverse().map((row) => (
                            <tr key={row.id}>
                              <td>{new Date(row.at).toLocaleTimeString()}</td>
                              <td className="systemLogName">{row.kind}</td>
                              <td>{row.detail}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="systemSection">
                    <div className="systemSectionTitle">
                      <FontAwesomeIcon icon={faDesktop} />
                      <span>Layout Shifts</span>
                      <span className="systemSectionCount">{shiftLog.length}</span>
                    </div>

                    <div className="systemLogScroll">
                      <table className="systemLogTable">
                        <thead>
                          <tr>
                            <th>Element</th>
                            <th>At</th>
                            <th>Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {shiftLog.slice().reverse().map((row) => (
                            <tr key={row.id}>
                              <td className="systemLogName">{row.element}</td>
                              <td>{fmtMs(row.at)}</td>
                              <td>{row.value.toFixed(4)}</td>
                            </tr>
                          ))}
                          {shiftLog.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="systemLogEmpty">No layout shifts have occurred.</td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="systemSection">
                    <div className="systemSectionTitle">
                      <FontAwesomeIcon icon={faKeyboard} />
                      <span>Interaction Latency</span>
                      <span className="systemSectionCount">{interactionLog.length}</span>
                    </div>

                    <div className="systemLogScroll">
                      <table className="systemLogTable">
                        <thead>
                          <tr>
                            <th>Event</th>
                            <th>Target</th>
                            <th>Delay</th>
                            <th>Duration</th>
                          </tr>
                        </thead>
                        <tbody>
                          {interactionLog.slice().reverse().map((row) => (
                            <tr key={row.id}>
                              <td className="systemLogName">{row.name}</td>
                              <td>{row.target}</td>
                              <td>{fmtMs(row.delay)}</td>
                              <td>{fmtMs(row.duration)}</td>
                            </tr>
                          ))}
                          {interactionLog.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="systemLogEmpty">No slow interactions have been recorded.</td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="systemSection">
                    <div className="systemSectionTitle">
                      <FontAwesomeIcon icon={faTriangleExclamation} />
                      <span>Errors</span>
                      <span className="systemSectionCount">{errorLog.length}</span>
                    </div>

                    <div className="systemLogScroll">
                      <table className="systemLogTable">
                        <thead>
                          <tr>
                            <th>Time</th>
                            <th>Kind</th>
                            <th>Message</th>
                          </tr>
                        </thead>
                        <tbody>
                          {errorLog.slice().reverse().map((row) => (
                            <tr key={row.id}>
                              <td>{new Date(row.at).toLocaleTimeString()}</td>
                              <td className="systemLogName">{row.kind}</td>
                              <td>{row.message}</td>
                            </tr>
                          ))}
                          {errorLog.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="systemLogEmpty">No errors have been raised.</td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              <div className="systemTableGrid">
                {activeStrips.map((strip) => (
                  <div key={strip.title} className="systemSection">
                    <div className="systemSectionTitle">
                      <FontAwesomeIcon icon={strip.icon} />
                      <span>{strip.title}</span>
                      <span className="systemSectionCount">{strip.items.length}</span>
                    </div>

                    <table className="systemTable">
                      <tbody>
                        {strip.items.map(([label, value]) => (
                          <tr key={label}>
                            <th>{label}</th>
                            <td>{value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>

              <div className="systemTailSpacer" />
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}