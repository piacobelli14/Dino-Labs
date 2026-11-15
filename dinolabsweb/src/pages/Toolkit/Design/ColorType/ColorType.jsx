import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPalette, faEye, faGlasses, faSliders, faCircleHalfStroke,
  faWandMagicSparkles, faDroplet, faDownload, faCopy, faShuffle,
  faChevronRight, faFireFlameCurved, faFont, faWaveSquare, faSwatchbook,
  faArrowsRotate, faImage, faUpload
} from "@fortawesome/free-solid-svg-icons";
import Tippy from "@tippyjs/react";
import Nav from "../../../../helpers/Nav.jsx";
import Dropdown from "../../../../helpers/Dropdown.jsx";
import ColorPicker from "../../../../helpers/ColorPicker.jsx";
import useAuth from "../../../../UseAuth.jsx";
import "../../../../styles/mainStyles/Toolkit/Design/ColorType/ColorType.css";
import "../../../../styles/helperStyles/Slider.css";
import "../../../../styles/helperStyles/LoadingSpinner.css";

const RATIO_MAP = { 
  minorThird: 1.2, 
  majorThird: 1.25, 
  perfectFourth: 1.333, 
  perfectFifth: 1.5, 
  golden: 1.618 
};

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

const toHex = (n) => n.toString(16).padStart(2, "0");

const isHex = (s) => /^#?[0-9A-Fa-f]{6}$/.test(s);

const hexNorm = (hex) => {
  if (!hex) return "#000000";
  let h = hex.trim();
  if (h[0] !== "#") h = "#" + h;
  if (!isHex(h)) return "#000000";
  return h.slice(0, 7);
};

const hexToRgb = (hex) => {
  const h = hexNorm(hex).replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return { r, g, b };
};

const rgbToHex = ({ r, g, b }) =>
  `#${toHex(clamp(Math.round(r), 0, 255))}${toHex(clamp(Math.round(g), 0, 255))}${toHex(clamp(Math.round(b), 0, 255))}`;

const rgbToHsl = ({ r, g, b }) => {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h;
  let s;
  const l = (max + min) / 2;
  if (max === min) {
    h = 0;
    s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }
  return { h, s, l };
};

const hslToRgb = ({ h, s, l }) => {
  h = ((h % 360) + 360) % 360;
  const C = (1 - Math.abs(2 * l - 1)) * s;
  const X = C * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - C / 2;
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (h < 60) {
    r1 = C;
    g1 = X;
    b1 = 0;
  } else if (h < 120) {
    r1 = X;
    g1 = C;
    b1 = 0;
  } else if (h < 180) {
    r1 = 0;
    g1 = C;
    b1 = X;
  } else if (h < 240) {
    r1 = 0;
    g1 = X;
    b1 = C;
  } else if (h < 300) {
    r1 = X;
    g1 = 0;
    b1 = C;
  } else {
    r1 = C;
    g1 = 0;
    b1 = X;
  }
  return {
    r: (r1 + m) * 255,
    g: (g1 + m) * 255,
    b: (b1 + m) * 255
  };
};

const hslToHex = (hsl) => rgbToHex(hslToRgb(hsl));

const mix = (hex1, hex2, t) => {
  const a = hexToRgb(hex1);
  const b = hexToRgb(hex2);
  return rgbToHex({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t
  });
};

const lighten = (hex, amt) => {
  const hsl = rgbToHsl(hexToRgb(hex));
  hsl.l = clamp(hsl.l + amt, 0, 1);
  return hslToHex(hsl);
};

const shiftHue = (hex, deg) => {
  const hsl = rgbToHsl(hexToRgb(hex));
  hsl.h += deg;
  return hslToHex(hsl);
};

const srgb2lin = (c) => {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

const luminance = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  const R = srgb2lin(r);
  const G = srgb2lin(g);
  const B = srgb2lin(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
};

const contrastRatio = (c1, c2) => {
  const L1 = luminance(c1);
  const L2 = luminance(c2);
  const [a, b] = L1 >= L2 ? [L1, L2] : [L2, L1];
  return (a + 0.05) / (b + 0.05);
};

const wcagRating = (ratio) => ({
  aaNormal: ratio >= 4.5,
  aaaNormal: ratio >= 7,
  aaLarge: ratio >= 3,
  aaaLarge: ratio >= 4.5
});

const harmonyFromBase = (hex, rule) => {
  switch (rule) {
    case "complementary":
      return [hex, shiftHue(hex, 180)];
    case "analogous":
      return [shiftHue(hex, -30), hex, shiftHue(hex, 30)];
    case "triadic":
      return [hex, shiftHue(hex, 120), shiftHue(hex, 240)];
    case "tetradic":
      return [hex, shiftHue(hex, 90), shiftHue(hex, 180), shiftHue(hex, 270)];
    case "monochromatic":
      return [lighten(hex, -0.2), hex, lighten(hex, 0.2)];
    default:
      return [hex];
  }
};

const genSequential = (start, end, n) => {
  const out = [];
  for (let i = 0; i < n; i++) out.push(mix(start, end, n === 1 ? 0 : i / (n - 1)));
  return out;
};

const genDiverging = (left, right, n) => {
  const mid = "#ffffff";
  if (n % 2 === 1) {
    const half = (n - 1) / 2;
    return [
      ...genSequential(left, mid, half + 1).slice(0, half),
      mid,
      ...genSequential(mid, right, half + 1).slice(1)
    ];
  } else {
    const half = n / 2;
    return [
      ...genSequential(left, mid, half).slice(0, half),
      ...genSequential(mid, right, half + 1).slice(1)
    ];
  }
};

const genQualitative = (n, s = 0.65, l = 0.55, startHue = 0) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    const h = (startHue + i * (360 / n)) % 360;
    out.push(hslToHex({ h, s, l }));
  }
  return out;
};

const genModularScale = (basePx, ratio, minStep = -2, maxStep = 8) => {
  const steps = [];
  for (let i = minStep; i <= maxStep; i++) {
    steps.push({ step: i, px: +(basePx * Math.pow(ratio, i)).toFixed(3) });
  }
  return steps;
};

const extractColorsFromImage = (imageData) => {
  const data = imageData.data;
  const colorMap = new Map();
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    
    if (a < 128) continue;
    
    const rBucket = Math.floor(r / 5) * 5;
    const gBucket = Math.floor(g / 5) * 5;
    const bBucket = Math.floor(b / 5) * 5;
    const key = `${rBucket},${gBucket},${bBucket}`;
    
    if (!colorMap.has(key)) {
      colorMap.set(key, { r: rBucket, g: gBucket, b: bBucket, count: 0 });
    }
    colorMap.get(key).count++;
  }

  const colors = Array.from(colorMap.values());
  
  colors.forEach(c => {
    const max = Math.max(c.r, c.g, c.b);
    const min = Math.min(c.r, c.g, c.b);
    c.saturation = max === 0 ? 0 : (max - min) / max;
  });

  const colorDistance = (c1, c2) => {
    return Math.sqrt(
      Math.pow(c1.r - c2.r, 2) +
      Math.pow(c1.g - c2.g, 2) +
      Math.pow(c1.b - c2.b, 2)
    );
  };

  colors.sort((a, b) => b.count - a.count);

  const selectedColors = [];
  const minDistance = 15;

  for (let color of colors) {
    const isTooSimilar = selectedColors.some(selected => 
      colorDistance(color, selected) < minDistance
    );
    
    if (!isTooSimilar) {
      selectedColors.push(color);
    }
  }

  selectedColors.sort((a, b) => {
    if (a.saturation > 0.15 && b.saturation <= 0.15) return -1;
    if (a.saturation <= 0.15 && b.saturation > 0.15) return 1;
    return b.count - a.count;
  });

  return selectedColors.map(c => rgbToHex({ r: c.r, g: c.g, b: c.b }));
};

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch {}
};

const downloadTextFile = (filename, text) => {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const SIM_TYPE_LABEL = "None";

const DV_TYPE_OPTIONS = [
  { value: "sequential", label: "Sequential" },
  { value: "diverging", label: "Diverging" },
  { value: "qualitative", label: "Qualitative" }
];

const HARMONY_OPTIONS = [
  { value: "analogous", label: "Analogous" },
  { value: "complementary", label: "Complementary" },
  { value: "triadic", label: "Triadic" },
  { value: "tetradic", label: "Tetradic" },
  { value: "monochromatic", label: "Monochromatic" }
];

const DinoColorField = ({ label, value, onChange, ariaLabel }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="tookitColorTypeLabRow">
      <label className="tookitColorTypeLabLabel">{label}</label>
      <div className="tookitColorTypeLabColorRow">
        <Tippy
          content={<ColorPicker color={value} onChange={(c) => onChange(hexNorm(c))} />}
          visible={open}
          onClickOutside={() => setOpen(false)}
          interactive={true}
          placement="right"
          className="color-picker-tippy"
        >
          <label
            aria-label={ariaLabel || label}
            className="tookitColorTypeLabColorChip"
            style={{ backgroundColor: value }}
            onClick={() => setOpen((p) => !p)}
          />
        </Tippy>
        <input
          className="tookitColorTypeLabInput"
          value={value}
          onChange={(e) => onChange(hexNorm(e.target.value))}
          spellCheck={false}
        />
      </div>
    </div>
  );
};

const ColorType = () => {
  const navigate = useNavigate();
  const { token, loading } = useAuth();

  const [brandPrimary, setBrandPrimary] = useState("#3B82F6");
  const [brandSecondary, setBrandSecondary] = useState("#14B8A6");
  const [brandAccent, setBrandAccent] = useState("#F59E0B");
  const [tintShadeSteps, setTintShadeSteps] = useState(5);
  const [dvType, setDvType] = useState("sequential");
  const [dvCount, setDvCount] = useState(7);
  const [dvLeft, setDvLeft] = useState("#0EA5E9");
  const [dvRight, setDvRight] = useState("#9333EA");
  const [dvStartHue, setDvStartHue] = useState(10);
  const [dvSat, setDvSat] = useState(70);
  const [dvLight, setDvLight] = useState(52);
  const [cA, setCA] = useState("#111827");
  const [cB, setCB] = useState("#F9FAFB");
  const [gradFrom, setGradFrom] = useState("#3B82F6");
  const [gradTo, setGradTo] = useState("#14B8A6");
  const [gradAngle, setGradAngle] = useState(45);
  const [harmonyBase, setHarmonyBase] = useState("#3B82F6");
  const [harmonyRule, setHarmonyRule] = useState("analogous");
  const [fontFamily, setFontFamily] = useState("InterVariable, Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif");
  const [sampleText, setSampleText] = useState("Quick brown fox jumps over the lazy dog — 0123456789");
  const [wght, setWght] = useState(600);
  const [wdth, setWdth] = useState(100);
  const [slnt, setSlnt] = useState(0);
  const [opsz, setOpsz] = useState(14);
  const [basePx, setBasePx] = useState(16);
  const [ratioName, setRatioName] = useState("golden");
  const [minStep, setMinStep] = useState(-2);
  const [maxStep, setMaxStep] = useState(8);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [extractedColors, setExtractedColors] = useState([]);
  const [extractionStatus, setExtractionStatus] = useState("");

  const priRef = useRef(null);
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);

  const processUploadedImage = (file) => {
    if (!file || !file.type.startsWith("image/")) {
      setExtractionStatus("Please upload a valid image file.");
      return;
    }

    setExtractionStatus("Processing Image");
    const img = new Image();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    img.onload = () => {
      const maxSize = 400;
      let { width, height } = img;
      
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width *= ratio;
        height *= ratio;
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      try {
        const imageData = ctx.getImageData(0, 0, width, height);
        const colors = extractColorsFromImage(imageData);
        
        if (colors.length > 0) {
          setExtractedColors(colors);
          setExtractionStatus(`${colors.length} colors were extracted successfully.`);
        } else {
          setExtractionStatus("No colors could be extracted from this image.");
        }
      } catch (error) {
        setExtractionStatus("The image could not be processed. Please try another file.");
      }
    };

    img.onerror = () => {
      setExtractionStatus("The image could not be loaded. Please try another file.");
    };

    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target.result;
      setUploadedImage(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const applyExtractedColors = () => {
    if (extractedColors.length < 3) {
      setExtractionStatus("Extract at least 3 colors before applying them.");
      return;
    }

    setBrandPrimary(extractedColors[0]);
    setBrandSecondary(extractedColors[1]);
    setBrandAccent(extractedColors[2]);
    
    if (extractedColors.length >= 5) {
      setDvLeft(extractedColors[3]);
      setDvRight(extractedColors[4]);
    }
    
    if (extractedColors.length >= 6) {
      setGradFrom(extractedColors[0]);
      setGradTo(extractedColors[5]);
    }

    setExtractionStatus("The colors were applied successfully.");
  };

  const randomizeBrand = () => {
    const rnd = () =>
      hslToHex({ h: Math.random() * 360, s: 0.6 + Math.random() * 0.3, l: 0.45 + Math.random() * 0.1 });
    setBrandPrimary(rnd());
    setBrandSecondary(rnd());
    setBrandAccent(rnd());
  };

  const resetAll = () => {
    setBrandPrimary("#3B82F6");
    setBrandSecondary("#14B8A6");
    setBrandAccent("#F59E0B");
    setTintShadeSteps(5);
    setDvType("sequential");
    setDvCount(7);
    setDvLeft("#0EA5E9");
    setDvRight("#9333EA");
    setDvStartHue(10);
    setDvSat(70);
    setDvLight(52);
    setCA("#111827");
    setCB("#F9FAFB");
    setGradFrom("#3B82F6");
    setGradTo("#14B8A6");
    setGradAngle(45);
    setHarmonyBase("#3B82F6");
    setHarmonyRule("analogous");
    setFontFamily("InterVariable, Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif");
    setSampleText("Quick brown fox jumps over the lazy dog — 0123456789");
    setWght(600);
    setWdth(100);
    setSlnt(0);
    setOpsz(14);
    setBasePx(16);
    setRatioName("golden");
    setMinStep(-2);
    setMaxStep(8);
    setUploadedImage(null);
    setExtractedColors([]);
    setExtractionStatus("");
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      processUploadedImage(file);
    }
  };

  const brandPalette = useMemo(() => {
    const make = (hex) => {
      const tints = Array.from({ length: tintShadeSteps }, (_, i) => lighten(hex, (i + 1) * 0.06));
      const shades = Array.from({ length: tintShadeSteps }, (_, i) => lighten(hex, -(i + 1) * 0.06));
      return { base: hexNorm(hex), tints, shades };
    };
    return {
      primary: make(brandPrimary),
      secondary: make(brandSecondary),
      accent: make(brandAccent)
    };
  }, [brandPrimary, brandSecondary, brandAccent, tintShadeSteps]);

  const dataVizPalette = useMemo(() => {
    let arr = [];
    if (dvType === "sequential") arr = genSequential(hexNorm(dvLeft), hexNorm(dvRight), dvCount);
    if (dvType === "diverging") arr = genDiverging(hexNorm(dvLeft), hexNorm(dvRight), dvCount);
    if (dvType === "qualitative") arr = genQualitative(dvCount, dvSat / 100, dvLight / 100, dvStartHue);
    return arr;
  }, [dvType, dvCount, dvLeft, dvRight, dvStartHue, dvSat, dvLight]);

  const ratio = useMemo(() => +contrastRatio(cA, cB).toFixed(2), [cA, cB]);

  const ratings = useMemo(() => wcagRating(ratio), [ratio]);

  const gradientCss = useMemo(
    () => `linear-gradient(${gradAngle}deg, ${hexNorm(gradFrom)}, ${hexNorm(gradTo)})`,
    [gradFrom, gradTo, gradAngle]
  );

  const harmonyColors = useMemo(
    () => harmonyFromBase(hexNorm(harmonyBase), harmonyRule),
    [harmonyBase, harmonyRule]
  );

  const varSettings = useMemo(() => {
    const parts = [];
    if (wght != null) parts.push(`"wght" ${wght}`);
    if (wdth != null) parts.push(`"wdth" ${wdth}`);
    if (slnt != null) parts.push(`"slnt" ${slnt}`);
    if (opsz != null) parts.push(`"opsz" ${opsz}`);
    return parts.join(", ");
  }, [wght, wdth, slnt, opsz]);

  const msSteps = useMemo(
    () => genModularScale(basePx, RATIO_MAP[ratioName], minStep, maxStep),
    [basePx, ratioName, minStep, maxStep]
  );

  const tokens = useMemo(() => {
    const brand = {
      primary: {
        base: brandPalette.primary.base,
        tints: brandPalette.primary.tints,
        shades: brandPalette.primary.shades
      },
      secondary: {
        base: brandPalette.secondary.base,
        tints: brandPalette.secondary.tints,
        shades: brandPalette.secondary.shades
      },
      accent: {
        base: brandPalette.accent.base,
        tints: brandPalette.accent.tints,
        shades: brandPalette.accent.shades
      }
    };
    const typography = {
      fontFamily,
      axes: { wght, wdth, slnt, opsz },
      modularScale: { basePx, ratio: RATIO_MAP[ratioName], steps: msSteps }
    };
    const gradient = {
      from: hexNorm(gradFrom),
      to: hexNorm(gradTo),
      angle: gradAngle,
      css: gradientCss
    };
    const dataViz = { type: dvType, count: dvCount, colors: dataVizPalette };
    return { colors: { brand, dataViz }, gradient, typography };
  }, [
    brandPalette,
    fontFamily,
    wght,
    wdth,
    slnt,
    opsz,
    basePx,
    ratioName,
    msSteps,
    gradFrom,
    gradTo,
    gradAngle,
    gradientCss,
    dvType,
    dvCount,
    dataVizPalette
  ]);

  const cssVariables = useMemo(() => {
    const lines = [];
    const pushSeries = (prefix, series) => {
      lines.push(`  --color-${prefix}: ${series.base};`);
      series.tints.forEach((c, i) => lines.push(`  --color-${prefix}-t${i + 1}: ${c};`));
      series.shades.forEach((c, i) => lines.push(`  --color-${prefix}-s${i + 1}: ${c};`));
    };
    lines.push(":root {");
    pushSeries("brand-primary", brandPalette.primary);
    pushSeries("brand-secondary", brandPalette.secondary);
    pushSeries("brand-accent", brandPalette.accent);
    dataVizPalette.forEach((c, i) => lines.push(`  --color-dv-${i + 1}: ${c};`));
    lines.push(`  --gradient-brand: ${gradientCss};`);
    lines.push(`  --font-family-base: ${fontFamily};`);
    lines.push(`  --font-variation: ${varSettings};`);
    msSteps.forEach(({ step, px }) =>
      lines.push(`  --font-size-${step >= 0 ? step : `n${Math.abs(step)}`}: ${px}px;`)
    );
    lines.push("}");
    return lines.join("\n");
  }, [brandPalette, dataVizPalette, gradientCss, fontFamily, varSettings, msSteps]);

  const tailwindConfig = useMemo(() => {
    const twColors = {
      brand: {
        primary: brandPalette.primary.base,
        secondary: brandPalette.secondary.base,
        accent: brandPalette.accent.base
      }
    };
    const dv = {};
    dataVizPalette.forEach((c, i) => {
      dv[i + 1] = c;
    });
    const names = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl"];
    const sizeMap = {};
    const anchorIndex = 2;
    for (let i = 0; i < names.length; i++) {
      const step = i - anchorIndex;
      const found = msSteps.find((s) => s.step === step);
      sizeMap[names[i]] = found ? `${found.px / 16}rem` : `${(basePx * Math.pow(RATIO_MAP[ratioName], step)) / 16}rem`;
    }
    return `export default {
  theme: {
    extend: {
      colors: ${JSON.stringify({ ...twColors, dataviz: dv }, null, 2)},
      fontFamily: { sans: [${fontFamily.split(",").map((s) => s.trim()).join(", ")}] },
      fontSize: ${JSON.stringify(sizeMap, null, 2)}
    }
  }
};`;
  }, [brandPalette, dataVizPalette, msSteps, fontFamily, basePx, ratioName]);

  const tokensJson = useMemo(() => JSON.stringify(tokens, null, 2), [tokens]);

  useEffect(() => {
    if (!loading && !token) navigate("/login");
  }, [token, loading, navigate]);

  useEffect(() => {
    priRef.current?.focus();
  }, []);

  return (
    <div className="tookitColorTypeLabApp" tabIndex={0}>
      <Nav activePage="colortype" />

      {loading ? (
        <div className="tookitColorTypeLabCellHeaderContainer" style={{ justifyContent: "center" }}>
          <div className="loading-wrapper">
            <div className="loading-circle" />
            <label className="loading-title">
              Loading
            </label>
          </div>
        </div>
      ) : (
        <>
          <canvas ref={canvasRef} style={{ display: "none" }} />

          <div className="tookitColorTypeLabToolBar">
            <div className="tookitColorTypeLabTitle">
              <FontAwesomeIcon icon={faPalette} />
              <span>Color & Type</span>
            </div>

            <div className="tookitColorTypeLabStatusGroup">
              <span className="tookitColorTypeLabStatusItem">
                <span className="tookitColorTypeLabStatusDot" style={{ background: brandPrimary }} />
                <span className="tookitColorTypeLabStatusDot" style={{ background: brandSecondary }} />
                <span className="tookitColorTypeLabStatusDot" style={{ background: brandAccent }} />
                <span>Brand</span>
              </span>
              <span className="tookitColorTypeLabStatusItem">
                <span>{harmonyRule.charAt(0).toUpperCase() + harmonyRule.slice(1)}</span>
              </span>
              <span className="tookitColorTypeLabStatusItem">
                <span>{dvType.charAt(0).toUpperCase() + dvType.slice(1)} {dvCount}</span>
              </span>
              <span className={`tookitColorTypeLabStatusItem${ratings.aaNormal ? " tookitColorTypeLabStatusAccent" : ""}`}>
                <span>Contrast {ratio}:1</span>
              </span>
            </div>
          </div>

          <div className="tookitColorTypeLabShell">

            <aside className="tookitColorTypeLabSidebar">

              <div className="tookitColorTypeLabSection">
                <div className="tookitColorTypeLabSectionTitle">
                  <FontAwesomeIcon icon={faImage} />
                  <span>Image Color Extraction</span>
                </div>

                <div className="tookitColorTypeLabRow">
                  <label className="tookitColorTypeLabLabel">Upload Image</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="tookitColorTypeLabInput tookitColorTypeLabFileField"
                  />
                </div>

                {uploadedImage && (
                  <div className="tookitColorTypeLabRow">
                    <img
                      src={uploadedImage}
                      alt="Uploaded Preview"
                      className="tookitColorTypeLabPreviewImage"
                    />
                  </div>
                )}

                {extractionStatus && (
                  <div className="tookitColorTypeLabRow">
                    <div className="tookitColorTypeLabSmall">
                      {extractionStatus}
                    </div>
                  </div>
                )}

                {extractedColors.length > 0 && (
                  <>
                    <div className="tookitColorTypeLabSwatchRow">
                      {extractedColors.map((color, index) => (
                        <button
                          key={index}
                          className="tookitColorTypeLabSwatch"
                          style={{ 
                            background: color, 
                            color: luminance(color) > 0.45 ? "#12151b" : "#ebf0f8"
                          }}
                          title={`Click to copy ${color}.`}
                          onClick={() => copyText(color)}
                        >
                          {color}
                        </button>
                      ))}
                    </div>
                    <div className="tookitColorTypeLabRow tookitColorTypeLabActions">
                      <button className="tookitColorTypeLabBtn" onClick={applyExtractedColors}>
                        <FontAwesomeIcon icon={faPalette} /> Apply Colors
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className="tookitColorTypeLabSection">
                <div className="tookitColorTypeLabSectionTitle">
                  <FontAwesomeIcon icon={faPalette} />
                  <span>Brand Palette</span>
                </div>

                <DinoColorField 
                  label="Primary" 
                  value={brandPrimary} 
                  onChange={setBrandPrimary} 
                  ariaLabel="Primary Color" 
                />

                <DinoColorField
                  label="Secondary"
                  value={brandSecondary}
                  onChange={setBrandSecondary}
                  ariaLabel="Secondary Color"
                />

                <DinoColorField 
                  label="Accent" 
                  value={brandAccent} 
                  onChange={setBrandAccent} 
                  ariaLabel="Accent Color" 
                />

                <div className="tookitColorTypeLabRow">
                  <div className="tookitColorTypeLabRowHeader">
                    <label className="tookitColorTypeLabLabel">Tints And Shades</label>
                    <span className="tookitColorTypeLabValue">{tintShadeSteps} Steps Each</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="8"
                    value={tintShadeSteps}
                    onChange={(e) => setTintShadeSteps(+e.target.value)}
                    className="tookitSettingsSlider"
                  />
                </div>

                <div className="tookitColorTypeLabRow tookitColorTypeLabActions">
                  <button className="tookitColorTypeLabBtn" onClick={randomizeBrand}>
                    <FontAwesomeIcon icon={faShuffle} /> Randomize
                  </button>
                  <button className="tookitColorTypeLabBtn tookitColorTypeLabSubtle" onClick={resetAll}>
                    <FontAwesomeIcon icon={faArrowsRotate} /> Reset
                  </button>
                </div>
              </div>

              <div className="tookitColorTypeLabSection">
                <div className="tookitColorTypeLabSectionTitle">
                  <FontAwesomeIcon icon={faSwatchbook} />
                  <span>Data Visualization Palette</span>
                </div>

                <div className="tookitColorTypeLabRow">
                  <label className="tookitColorTypeLabLabel">Type</label>
                  <Dropdown
                    value={DV_TYPE_OPTIONS.find((option) => option.value === dvType)?.label}
                    onChange={(label) => setDvType((DV_TYPE_OPTIONS.find((option) => option.label === label) || DV_TYPE_OPTIONS[0]).value)}
                    options={DV_TYPE_OPTIONS.map((option) => option.label)}
                    placeholder="Type"
                  />
                </div>

                <div className="tookitColorTypeLabRow">
                  <div className="tookitColorTypeLabRowHeader">
                    <label className="tookitColorTypeLabLabel">Colors</label>
                    <span className="tookitColorTypeLabValue">{dvCount} Colors</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="12"
                    value={dvCount}
                    onChange={(e) => setDvCount(+e.target.value)}
                    className="tookitSettingsSlider"
                  />
                </div>

                {dvType !== "qualitative" ? (
                  <>
                    <DinoColorField 
                      label="Left" 
                      value={dvLeft} 
                      onChange={setDvLeft} 
                      ariaLabel="Left Color" 
                    />

                    <DinoColorField 
                      label="Right" 
                      value={dvRight} 
                      onChange={setDvRight} 
                      ariaLabel="Right Color" 
                    />
                  </>
                ) : (
                  <>
                    <div className="tookitColorTypeLabRow">
                      <div className="tookitColorTypeLabRowHeader">
                        <label className="tookitColorTypeLabLabel">Start Hue</label>
                        <span className="tookitColorTypeLabValue">{dvStartHue}°</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="359"
                        value={dvStartHue}
                        onChange={(e) => setDvStartHue(+e.target.value)}
                        className="tookitSettingsSlider"
                      />
                    </div>

                    <div className="tookitColorTypeLabRow">
                      <div className="tookitColorTypeLabRowHeader">
                        <label className="tookitColorTypeLabLabel">Saturation</label>
                        <span className="tookitColorTypeLabValue">{dvSat}%</span>
                      </div>
                      <input
                        type="range"
                        min="30"
                        max="95"
                        value={dvSat}
                        onChange={(e) => setDvSat(+e.target.value)}
                        className="tookitSettingsSlider"
                      />
                    </div>

                    <div className="tookitColorTypeLabRow">
                      <div className="tookitColorTypeLabRowHeader">
                        <label className="tookitColorTypeLabLabel">Lightness</label>
                        <span className="tookitColorTypeLabValue">{dvLight}%</span>
                      </div>
                      <input
                        type="range"
                        min="30"
                        max="70"
                        value={dvLight}
                        onChange={(e) => setDvLight(+e.target.value)}
                        className="tookitSettingsSlider"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="tookitColorTypeLabSection">
                <div className="tookitColorTypeLabSectionTitle">
                  <FontAwesomeIcon icon={faEye} />
                  <span>WCAG Contrast</span>
                </div>

                <DinoColorField 
                  label="Color A" 
                  value={cA} 
                  onChange={setCA} 
                  ariaLabel="Color A" 
                />

                <DinoColorField 
                  label="Color B" 
                  value={cB} 
                  onChange={setCB} 
                  ariaLabel="Color B" 
                />

                <div className="tookitColorTypeLabContrastStack">
                  <div className="tookitColorTypeLabContrastTop">
                    <div className="tookitColorTypeLabContrastValue">{ratio}:1</div>
                    <div className="tookitColorTypeLabContrastBadges">
                      <span className={`tookitColorTypeLabBadge ${ratings.aaNormal ? "good" : "bad"}`}>AA</span>
                      <span className={`tookitColorTypeLabBadge ${ratings.aaaNormal ? "good" : "bad"}`}>AAA</span>
                      <span className={`tookitColorTypeLabBadge ${ratings.aaLarge ? "good" : "bad"}`}>AA Large</span>
                      <span className={`tookitColorTypeLabBadge ${ratings.aaaLarge ? "good" : "bad"}`}>AAA Large</span>
                    </div>
                  </div>

                  <div
                    className="tookitColorTypeLabContrastPreview"
                    aria-label="Contrast Preview"
                    style={{ background: `linear-gradient(90deg, ${cA} 0%, ${cA} 50%, ${cB} 50%, ${cB} 100%)` }}
                  />

                  <div className="tookitColorTypeLabContrastPairs">
                    <div className="tookitColorTypeLabContrastChip" style={{ background: cA, color: cB }}>
                      <div>A On B</div>
                      <div className="tookitColorTypeLabMini">{ratio}:1</div>
                    </div>
                    <div className="tookitColorTypeLabContrastChip" style={{ background: cB, color: cA }}>
                      <div>B On A</div>
                      <div className="tookitColorTypeLabMini">{ratio}:1</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="tookitColorTypeLabSection">
                <div className="tookitColorTypeLabSectionTitle">
                  <FontAwesomeIcon icon={faCircleHalfStroke} />
                  <span>Gradient Editor</span>
                </div>

                <DinoColorField 
                  label="From" 
                  value={gradFrom} 
                  onChange={setGradFrom} 
                  ariaLabel="Gradient Start Color" 
                />

                <DinoColorField 
                  label="To" 
                  value={gradTo} 
                  onChange={setGradTo} 
                  ariaLabel="Gradient End Color" 
                />

                <div className="tookitColorTypeLabRow">
                  <div className="tookitColorTypeLabRowHeader">
                    <label className="tookitColorTypeLabLabel">Angle</label>
                    <span className="tookitColorTypeLabValue">{gradAngle}°</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={gradAngle}
                    onChange={(e) => setGradAngle(+e.target.value)}
                    className="tookitSettingsSlider"
                  />
                </div>

                <div className="tookitColorTypeLabGradientBlock" style={{ background: gradientCss }}>
                  <div className="tookitColorTypeLabGradientText">Gradient Preview</div>
                </div>
              </div>

              <div className="tookitColorTypeLabSection">
                <div className="tookitColorTypeLabSectionTitle">
                  <FontAwesomeIcon icon={faWandMagicSparkles} />
                  <span>Harmony</span>
                </div>

                <DinoColorField 
                  label="Base" 
                  value={harmonyBase} 
                  onChange={setHarmonyBase} 
                  ariaLabel="Harmony Base Color" 
                />

                <div className="tookitColorTypeLabRow">
                  <label className="tookitColorTypeLabLabel">Rule</label>
                  <Dropdown
                    value={HARMONY_OPTIONS.find((option) => option.value === harmonyRule)?.label}
                    onChange={(label) => setHarmonyRule((HARMONY_OPTIONS.find((option) => option.label === label) || HARMONY_OPTIONS[0]).value)}
                    options={HARMONY_OPTIONS.map((option) => option.label)}
                    placeholder="Rule"
                  />
                </div>

                <div className="tookitColorTypeLabSwatchRow">
                  {harmonyColors.map((c, i) => (
                    <button
                      key={i}
                      className="tookitColorTypeLabSwatch"
                      style={{ background: c, color: luminance(c) > 0.45 ? "#12151b" : "#ebf0f8" }}
                      title={`Click to copy ${c}.`}
                      onClick={() => copyText(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            <main className="tookitColorTypeLabMain">
              <div className="tookitColorTypeLabMainGrid">

                <section className="tookitColorTypeLabCard tookitColorTypeLabCardWide">
                  <div className="tookitColorTypeLabCardTitle">
                    Brand Palette (Simulation: {SIM_TYPE_LABEL})
                  </div>

                  <div className="tookitColorTypeLabBrandGrid">
                    {["primary", "secondary", "accent"].map((k) => (
                      <div className="tookitColorTypeLabBrandColumn" key={k}>
                        <div className="tookitColorTypeLabBrandLabel">
                          {k.charAt(0).toUpperCase() + k.slice(1)}
                        </div>
                        <div className="tookitColorTypeLabSwatchGrid">
                          {[brandPalette[k].base, ...brandPalette[k].tints, ...brandPalette[k].shades].map((c, i) => (
                            <button
                              key={i}
                              className="tookitColorTypeLabSwatch"
                              style={{ background: c, color: luminance(c) > 0.45 ? "#12151b" : "#ebf0f8" }}
                              title={`Click to copy ${c}.`}
                              onClick={() => copyText(c)}
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="tookitColorTypeLabCard">
                  <div className="tookitColorTypeLabCardTitle">
                    Data Visualization Palette
                  </div>

                  <div className="tookitColorTypeLabSwatchGrid">
                    {dataVizPalette.map((c, i) => (
                      <button
                        key={i}
                        className="tookitColorTypeLabSwatch"
                        style={{ background: c, color: luminance(c) > 0.45 ? "#12151b" : "#ebf0f8" }}
                        title={`Click to copy ${c}.`}
                        onClick={() => copyText(c)}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="tookitColorTypeLabCard">
                  <div className="tookitColorTypeLabCardTitle">
                    Gradient And Contrast
                  </div>

                  <div className="tookitColorTypeLabGradientBlock" style={{ background: gradientCss }}>
                    <div className="tookitColorTypeLabGradientText">Gradient Preview</div>
                  </div>

                  <div className="tookitColorTypeLabContrastRow">
                    <div className="tookitColorTypeLabContrastChip" style={{ background: cA, color: cB }}>
                      <div>A On B</div>
                      <div className="tookitColorTypeLabMini">{ratio}:1</div>
                    </div>
                    <div className="tookitColorTypeLabContrastChip" style={{ background: cB, color: cA }}>
                      <div>B On A</div>
                      <div className="tookitColorTypeLabMini">{ratio}:1</div>
                    </div>
                  </div>
                </section>

                <section className="tookitColorTypeLabCard tookitColorTypeLabCardWide">
                  <div className="tookitColorTypeLabCardTitle">
                    Typography
                  </div>

                  <div
                    className="tookitColorTypeLabTypeBox"
                    style={{ fontFamily, fontVariationSettings: varSettings }}
                  >
                    <div className="tookitColorTypeLabTypeSample">{sampleText}</div>

                    <div className="tookitColorTypeLabScaleList">
                      {msSteps.map(({ step, px }) => (
                        <div key={step} className="tookitColorTypeLabScaleItem">
                          <div className="tookitColorTypeLabScaleMeta">
                            <div className="tookitColorTypeLabScaleName">Step {step >= 0 ? step : `-${Math.abs(step)}`}</div>
                            <div className="tookitColorTypeLabScaleVal">
                              {px}px ({(px / 16).toFixed(3)}rem)
                            </div>
                          </div>
                          <div className="tookitColorTypeLabScaleText" style={{ fontSize: `${px}px` }}>
                            The Quick Brown Fox {step >= 0 ? `(+${step})` : `(${step})`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="tookitColorTypeLabCard tookitColorTypeLabCardWide">
                  <div className="tookitColorTypeLabCardTitle">
                    Exports
                  </div>

                  <div className="tookitColorTypeLabExportBlock">
                    <div className="tookitColorTypeLabExportHeader">
                      <div className="tookitColorTypeLabExportTitle">Design Tokens (JSON)</div>
                      <div className="tookitColorTypeLabExportActions">
                        <button className="tookitColorTypeLabBtn" onClick={() => copyText(tokensJson)}>
                          <FontAwesomeIcon icon={faCopy} /> Copy
                        </button>
                        <button
                          className="tookitColorTypeLabBtn"
                          onClick={() => downloadTextFile("design-tokens.json", tokensJson)}
                        >
                          <FontAwesomeIcon icon={faDownload} /> Download
                        </button>
                      </div>
                    </div>
                    <pre className="tookitColorTypeLabCode">{tokensJson}</pre>
                  </div>

                  <div className="tookitColorTypeLabExportBlock">
                    <div className="tookitColorTypeLabExportHeader">
                      <div className="tookitColorTypeLabExportTitle">CSS Variables</div>
                      <div className="tookitColorTypeLabExportActions">
                        <button className="tookitColorTypeLabBtn" onClick={() => copyText(cssVariables)}>
                          <FontAwesomeIcon icon={faCopy} /> Copy
                        </button>
                        <button
                          className="tookitColorTypeLabBtn"
                          onClick={() => downloadTextFile("design-variables.css", cssVariables)}
                        >
                          <FontAwesomeIcon icon={faDownload} /> Download
                        </button>
                      </div>
                    </div>
                    <pre className="tookitColorTypeLabCode">{cssVariables}</pre>
                  </div>

                  <div className="tookitColorTypeLabExportBlock">
                    <div className="tookitColorTypeLabExportHeader">
                      <div className="tookitColorTypeLabExportTitle">Tailwind Config (Snippet)</div>
                      <div className="tookitColorTypeLabExportActions">
                        <button className="tookitColorTypeLabBtn" onClick={() => copyText(tailwindConfig)}>
                          <FontAwesomeIcon icon={faCopy} /> Copy
                        </button>
                        <button
                          className="tookitColorTypeLabBtn"
                          onClick={() => downloadTextFile("tailwind.extend.config.js", tailwindConfig)}
                        >
                          <FontAwesomeIcon icon={faDownload} /> Download
                        </button>
                      </div>
                    </div>
                    <pre className="tookitColorTypeLabCode">{tailwindConfig}</pre>
                  </div>
                </section>
              </div>
            </main>
          </div>
        </>
      )}
    </div>
  );
};

export default ColorType;