import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChartBar, faTable, faFlask, faRightLeft, faEraser,
  faWandMagicSparkles, faCopy, faDownload, faTriangleExclamation, faSliders
} from "@fortawesome/free-solid-svg-icons";
import ReactEcharts from "echarts-for-react";
import Nav from "../../../../helpers/Nav.jsx";
import Dropdown from "../../../../helpers/Dropdown.jsx";
import useAuth from "../../../../UseAuth.jsx";
import "../../../../styles/mainStyles/Toolkit/Math/Statistics/Statistics.css";
import "../../../../styles/helperStyles/LoadingSpinner.css";

const LANCZOS_COEFFICIENTS = [
  676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
];

const TEST_OPTIONS = [
  { value: "descriptive", label: "Descriptive Only", needsB: false },
  { value: "oneSample", label: "One-Sample t-Test", needsB: false },
  { value: "welch", label: "Welch Two-Sample t-Test", needsB: true },
  { value: "student", label: "Student Two-Sample t-Test", needsB: true },
  { value: "paired", label: "Paired t-Test", needsB: true },
  { value: "pearson", label: "Pearson Correlation", needsB: true },
  { value: "spearman", label: "Spearman Correlation", needsB: true },
  { value: "chiSquare", label: "Chi-Square Goodness Of Fit", needsB: false }
];

const TAIL_OPTIONS = [
  { value: "two", label: "Two-Sided" },
  { value: "less", label: "Less" },
  { value: "greater", label: "Greater" }
];

const SAMPLE_DATA = {
  a: "12.1, 14.3, 13.8, 15.2, 11.9, 13.4, 14.8, 12.7, 13.9, 14.1, 15.6, 12.4",
  b: "11.2, 12.8, 12.1, 13.5, 10.9, 12.2, 13.1, 11.8, 12.6, 12.9, 13.8, 11.4"
};

const logGamma = (z) => {
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  }
  const x = z - 1;
  let sum = 0.99999999999980993;
  for (let i = 0; i < LANCZOS_COEFFICIENTS.length; i += 1) {
    sum += LANCZOS_COEFFICIENTS[i] / (x + i + 1);
  }
  const t = x + LANCZOS_COEFFICIENTS.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(sum);
};

const betaContinuedFraction = (a, b, x) => {
  const tiny = 1e-300;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let result = d;
  for (let m = 1; m <= 300; m += 1) {
    const m2 = 2 * m;
    let numerator = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + numerator * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + numerator / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    result *= d * c;
    numerator = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + numerator * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + numerator / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    result *= delta;
    if (Math.abs(delta - 1) < 1e-14) break;
  }
  return result;
};

const regularizedBeta = (x, a, b) => {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) {
    return (front * betaContinuedFraction(a, b, x)) / a;
  }
  return 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
};

const regularizedGammaLower = (a, x) => {
  if (x <= 0) return 0;
  if (x < a + 1) {
    let term = 1 / a;
    let sum = term;
    for (let n = 1; n < 500; n += 1) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-15) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
  }
  const tiny = 1e-300;
  let b = x + 1 - a;
  let c = 1 / tiny;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 500; i += 1) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < tiny) d = tiny;
    c = b + an / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-15) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
};

const studentTCdf = (t, df) => {
  if (!Number.isFinite(t)) return t > 0 ? 1 : 0;
  const tail = 0.5 * regularizedBeta(df / (df + t * t), df / 2, 0.5);
  return t >= 0 ? 1 - tail : tail;
};

const normalCdf = (z) => {
  if (!Number.isFinite(z)) return z > 0 ? 1 : 0;
  const half = 0.5 * regularizedGammaLower(0.5, (z * z) / 2);
  return z >= 0 ? 0.5 + half : 0.5 - half;
};

const chiSquareCdf = (x, k) => regularizedGammaLower(k / 2, x / 2);

const invertCdf = (cdf, p, low, high) => {
  let lo = low;
  let hi = high;
  for (let i = 0; i < 200; i += 1) {
    const mid = (lo + hi) / 2;
    if (cdf(mid) < p) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-12) break;
  }
  return (lo + hi) / 2;
};

const studentTInv = (p, df) => invertCdf((t) => studentTCdf(t, df), p, -1e4, 1e4);

const normalInv = (p) => invertCdf(normalCdf, p, -40, 40);

const pValueFromT = (t, df, tails) => {
  if (tails === "less") return studentTCdf(t, df);
  if (tails === "greater") return 1 - studentTCdf(t, df);
  return Math.min(1, 2 * (1 - studentTCdf(Math.abs(t), df)));
};

const parseNumbers = (text) => {
  const tokens = String(text || "").split(/[\s,;\t]+/).filter(Boolean);
  const values = [];
  let invalid = 0;
  tokens.forEach((token) => {
    const value = Number(token);
    if (Number.isFinite(value)) values.push(value);
    else invalid += 1;
  });
  return { values, invalid };
};

const quantile = (sorted, q) => {
  if (!sorted.length) return NaN;
  const position = (sorted.length - 1) * q;
  const base = Math.floor(position);
  const rest = position - base;
  if (sorted[base + 1] === undefined) return sorted[base];
  return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
};

const describe = (values, confidence) => {
  const n = values.length;
  if (!n) return null;
  const sorted = [...values].sort((x, y) => x - y);
  const sum = values.reduce((total, value) => total + value, 0);
  const mean = sum / n;
  const squared = values.reduce((total, value) => total + (value - mean) ** 2, 0);
  const variance = n > 1 ? squared / (n - 1) : NaN;
  const sd = Math.sqrt(variance);
  const se = sd / Math.sqrt(n);
  const counts = new Map();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  const topCount = Math.max(...counts.values());
  const modes = topCount > 1 ? [...counts.entries()].filter(([, count]) => count === topCount).map(([value]) => value).sort((x, y) => x - y) : [];
  let skewness = NaN;
  let kurtosis = NaN;
  if (n > 2 && sd > 0) {
    const m3 = values.reduce((total, value) => total + ((value - mean) / sd) ** 3, 0);
    skewness = (n / ((n - 1) * (n - 2))) * m3;
  }
  if (n > 3 && sd > 0) {
    const m4 = values.reduce((total, value) => total + ((value - mean) / sd) ** 4, 0);
    kurtosis = ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * m4 - (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
  }
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  let ciLow = NaN;
  let ciHigh = NaN;
  if (n > 1) {
    const critical = studentTInv(1 - (1 - confidence) / 2, n - 1);
    ciLow = mean - critical * se;
    ciHigh = mean + critical * se;
  }
  return {
    n, sum, mean, median: quantile(sorted, 0.5), modes, variance, sd, se,
    min: sorted[0], max: sorted[n - 1], range: sorted[n - 1] - sorted[0],
    q1, q3, iqr: q3 - q1, skewness, kurtosis, ciLow, ciHigh, sorted
  };
};

const rank = (values) => {
  const indexed = values.map((value, index) => ({ value, index })).sort((x, y) => x.value - y.value);
  const ranks = new Array(values.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j + 1 < indexed.length && indexed[j + 1].value === indexed[i].value) j += 1;
    const averageRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k += 1) ranks[indexed[k].index] = averageRank;
    i = j + 1;
  }
  return ranks;
};

const correlation = (x, y) => {
  const n = x.length;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i += 1) {
    sxy += (x[i] - meanX) * (y[i] - meanY);
    sxx += (x[i] - meanX) ** 2;
    syy += (y[i] - meanY) ** 2;
  }
  const r = sxy / Math.sqrt(sxx * syy);
  const slope = sxy / sxx;
  return { r, slope, intercept: meanY - slope * meanX };
};

const runTest = (test, a, b, options) => {
  const { mu0, tails, confidence } = options;
  const alpha = 1 - confidence;
  const criticalFor = (df) => (tails === "two" ? studentTInv(1 - alpha / 2, df) : studentTInv(1 - alpha, df));
  const intervalFor = (estimate, se, df) => {
    const critical = criticalFor(df);
    if (tails === "less") return [-Infinity, estimate + critical * se];
    if (tails === "greater") return [estimate - critical * se, Infinity];
    return [estimate - critical * se, estimate + critical * se];
  };

  if (test === "descriptive") return null;

  if (test === "oneSample") {
    if (a.length < 2) return { error: "Sample A needs at least 2 values for a one-sample t-test." };
    const d = describe(a, confidence);
    if (!(d.sd > 0)) return { error: "Sample A has no variation, so the t statistic is undefined." };
    const t = (d.mean - mu0) / d.se;
    const df = a.length - 1;
    return {
      rows: [
        ["t Statistic", t], ["Degrees Of Freedom", df], ["p-Value", pValueFromT(t, df, tails)],
        ["Mean Difference", d.mean - mu0], ["Confidence Interval", intervalFor(d.mean - mu0, d.se, df)],
        ["Cohen's d", (d.mean - mu0) / d.sd]
      ],
      p: pValueFromT(t, df, tails),
      subject: `the mean of Sample A differs from ${mu0}`
    };
  }

  if (test === "welch" || test === "student") {
    if (a.length < 2 || b.length < 2) return { error: "Both samples need at least 2 values for a two-sample t-test." };
    const da = describe(a, confidence);
    const db = describe(b, confidence);
    const diff = da.mean - db.mean;
    const pooledVariance = ((a.length - 1) * da.variance + (b.length - 1) * db.variance) / (a.length + b.length - 2);
    let se;
    let df;
    if (test === "welch") {
      const va = da.variance / a.length;
      const vb = db.variance / b.length;
      se = Math.sqrt(va + vb);
      df = (va + vb) ** 2 / (va ** 2 / (a.length - 1) + vb ** 2 / (b.length - 1));
    } else {
      se = Math.sqrt(pooledVariance * (1 / a.length + 1 / b.length));
      df = a.length + b.length - 2;
    }
    if (!(se > 0)) return { error: "Neither sample has any variation, so the t statistic is undefined." };
    const t = diff / se;
    const cohen = diff / Math.sqrt(pooledVariance);
    const hedges = cohen * (1 - 3 / (4 * (a.length + b.length) - 9));
    const p = pValueFromT(t, df, tails);
    return {
      rows: [
        ["t Statistic", t], ["Degrees Of Freedom", df], ["p-Value", p],
        ["Mean Difference", diff], ["Confidence Interval", intervalFor(diff, se, df)],
        ["Cohen's d", cohen], ["Hedges' g", hedges]
      ],
      p,
      subject: "the means of Sample A and Sample B differ"
    };
  }

  if (test === "paired") {
    if (a.length !== b.length) return { error: "A paired t-test needs Sample A and Sample B to have the same number of values." };
    if (a.length < 2) return { error: "A paired t-test needs at least 2 pairs." };
    const differences = a.map((value, index) => value - b[index]);
    const d = describe(differences, confidence);
    if (!(d.sd > 0)) return { error: "The paired differences have no variation, so the t statistic is undefined." };
    const t = d.mean / d.se;
    const df = differences.length - 1;
    const p = pValueFromT(t, df, tails);
    return {
      rows: [
        ["t Statistic", t], ["Degrees Of Freedom", df], ["p-Value", p],
        ["Mean Difference", d.mean], ["Confidence Interval", intervalFor(d.mean, d.se, df)],
        ["Cohen's dz", d.mean / d.sd]
      ],
      p,
      subject: "the paired values differ"
    };
  }

  if (test === "pearson" || test === "spearman") {
    if (a.length !== b.length) return { error: "Correlation needs Sample A and Sample B to have the same number of values." };
    if (a.length < 3) return { error: "Correlation needs at least 3 pairs." };
    const x = test === "spearman" ? rank(a) : a;
    const y = test === "spearman" ? rank(b) : b;
    const { r, slope, intercept } = correlation(x, y);
    if (!Number.isFinite(r)) return { error: "One of the samples has no variation, so the correlation is undefined." };
    const n = a.length;
    const df = n - 2;
    const t = Math.abs(r) >= 1 ? (r > 0 ? Infinity : -Infinity) : (r * Math.sqrt(df)) / Math.sqrt(1 - r * r);
    const p = pValueFromT(t, df, tails);
    const rows = [["Coefficient", r], ["r Squared", r * r], ["t Statistic", t], ["Degrees Of Freedom", df], ["p-Value", p]];
    if (n > 3 && Math.abs(r) < 1) {
      const z = Math.atanh(r);
      const critical = normalInv(1 - alpha / 2);
      const spread = critical / Math.sqrt(n - 3);
      rows.push(["Confidence Interval", [Math.tanh(z - spread), Math.tanh(z + spread)]]);
    }
    if (test === "pearson") {
      rows.push(["Slope", slope], ["Intercept", intercept]);
    }
    return { rows, p, subject: "Sample A and Sample B are correlated" };
  }

  if (test === "chiSquare") {
    if (a.length < 2) return { error: "Chi-square needs at least 2 observed categories in Sample A." };
    if (a.some((value) => value < 0)) return { error: "Observed counts cannot be negative." };
    if (b.length && b.length !== a.length) return { error: "Expected values in Sample B must match the number of observed categories." };
    if (b.some((value) => value <= 0)) return { error: "Expected values must all be greater than zero." };
    const total = a.reduce((sum, value) => sum + value, 0);
    if (!(total > 0)) return { error: "Observed counts must add up to more than zero." };
    const weights = b.length ? b : a.map(() => 1);
    const weightTotal = weights.reduce((sum, value) => sum + value, 0);
    const expected = weights.map((value) => (value / weightTotal) * total);
    const statistic = a.reduce((sum, value, index) => sum + (value - expected[index]) ** 2 / expected[index], 0);
    const df = a.length - 1;
    const p = 1 - chiSquareCdf(statistic, df);
    const lowExpected = expected.filter((value) => value < 5).length;
    const rows = [["Chi-Square", statistic], ["Degrees Of Freedom", df], ["p-Value", p], ["Total Observed", total], ["Cohen's w", Math.sqrt(statistic / total)]];
    return {
      rows,
      p,
      subject: "the observed counts differ from the expected distribution",
      warning: lowExpected ? `${lowExpected} ${lowExpected === 1 ? "category has" : "categories have"} an expected count below 5, so the result may be unreliable.` : ""
    };
  }

  return null;
};

const formatNumber = (value, digits = 4) => {
  if (value === Infinity) return "∞";
  if (value === -Infinity) return "−∞";
  if (!Number.isFinite(value)) return "—";
  if (Number.isInteger(value) && Math.abs(value) < 1e12) return String(value);
  const abs = Math.abs(value);
  if (abs !== 0 && (abs < 1e-4 || abs >= 1e9)) return value.toExponential(3);
  return Number(value.toFixed(digits)).toString();
};

const formatPValue = (p) => {
  if (!Number.isFinite(p)) return "—";
  if (p < 0.0001) return "< 0.0001";
  return p.toFixed(4);
};

const formatCell = (label, value) => {
  if (label === "p-Value") return formatPValue(value);
  if (Array.isArray(value)) return `[${formatNumber(value[0])}, ${formatNumber(value[1])}]`;
  return formatNumber(value);
};

const buildHistogram = (seriesList, bins) => {
  const all = seriesList.flat();
  if (!all.length) return null;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const width = span / bins;
  const counts = seriesList.map((series) => {
    const bucket = new Array(bins).fill(0);
    series.forEach((value) => {
      const index = Math.min(bins - 1, Math.floor((value - min) / width));
      bucket[index] += 1;
    });
    return bucket;
  });
  return { min, max, width, counts, peak: Math.max(1, ...counts.flat()) };
};

const DESCRIPTIVE_FIELDS = [
  ["N", "n"], ["Mean", "mean"], ["Median", "median"], ["Mode", "modes"], ["Std Deviation", "sd"],
  ["Variance", "variance"], ["Std Error", "se"], ["Minimum", "min"], ["Maximum", "max"], ["Range", "range"],
  ["Q1", "q1"], ["Q3", "q3"], ["IQR", "iqr"], ["Skewness", "skewness"], ["Excess Kurtosis", "kurtosis"], ["Sum", "sum"]
];

const sturgesBins = (count) => Math.min(40, Math.max(3, Math.ceil(Math.log2(Math.max(1, count)) + 1)));

const formatDescriptive = (stats, key) => {
  if (key === "modes") return stats.modes.length ? stats.modes.slice(0, 3).map((value) => formatNumber(value)).join(", ") : "None";
  return formatNumber(stats[key]);
};

const copyText = (text) => navigator.clipboard.writeText(text);

const downloadTextFile = (content, filename, type) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const buildSummaryCsv = (describedA, describedB, testLabel, testResult, confidence) => {
  const rows = [["Statistic", "Sample A", "Sample B"]];
  DESCRIPTIVE_FIELDS.forEach(([label, key]) => {
    rows.push([label, describedA ? formatDescriptive(describedA, key) : "", describedB ? formatDescriptive(describedB, key) : ""]);
  });
  const ciLabel = `${Math.round(confidence * 1000) / 10}% CI Of Mean`;
  rows.push([ciLabel, describedA ? `${formatNumber(describedA.ciLow)} to ${formatNumber(describedA.ciHigh)}` : "", describedB ? `${formatNumber(describedB.ciLow)} to ${formatNumber(describedB.ciHigh)}` : ""]);
  if (testResult && testResult.rows) {
    rows.push([], [testLabel, "Value"]);
    testResult.rows.forEach(([label, value]) => rows.push([label, formatCell(label, value)]));
  }
  return rows.map((row) => row.map((cell) => (/[",\n]/.test(String(cell)) ? `"${String(cell).replace(/"/g, "\"\"")}"` : cell)).join(",")).join("\n");
};

const TOOLTIP_BASE = { backgroundColor: "rgba(13,17,23,0.95)", borderColor: "#3d4354", borderWidth: 1 };
const AXIS_LINE = { lineStyle: { color: "rgba(255,255,255,0.2)" } };
const SPLIT_LINE = { lineStyle: { color: "rgba(255,255,255,0.06)", type: "dashed" } };
const CHART_STYLE = { width: "100%", height: "100%" };
const CHART_FONT = 11;

const axisLabel = { color: "#6f7789", fontSize: CHART_FONT - 1, fontWeight: 700 };

const SERIES_STYLES = [
  { name: "Sample A", fill: "rgba(78,205,196,0.6)", stroke: "#4ecdc4" },
  { name: "Sample B", fill: "rgba(251,191,36,0.5)", stroke: "#fbbf24" }
];

const histogramOption = (histogram, showB) => {
  const bins = histogram.counts[0].length;
  const labels = Array.from({ length: bins }, (_, index) => {
    const start = histogram.min + index * histogram.width;
    return `${formatNumber(start, 3)} to ${formatNumber(start + histogram.width, 3)}`;
  });
  const series = (showB ? histogram.counts : [histogram.counts[0]]).map((counts, index) => ({
    name: SERIES_STYLES[index].name,
    type: "bar",
    data: counts,
    barGap: "8%",
    barCategoryGap: "18%",
    itemStyle: {
      color: SERIES_STYLES[index].fill,
      borderColor: SERIES_STYLES[index].stroke,
      borderWidth: 1,
      borderRadius: [2, 2, 0, 0]
    },
    emphasis: { itemStyle: { color: SERIES_STYLES[index].stroke } }
  }));
  return {
    animation: false,
    title: { show: false },
    legend: { show: false },
    grid: { left: 46, right: 16, top: 16, bottom: 44 },
    tooltip: {
      trigger: "axis",
      ...TOOLTIP_BASE,
      appendToBody: true,
      textStyle: { color: "#cdd4e4", fontSize: CHART_FONT, fontWeight: 600 },
      axisPointer: { type: "shadow", shadowStyle: { color: "rgba(78,205,196,0.06)" } },
      formatter: (params) => {
        const rows = (params || []).map((point) => (
          `<div style="font-weight:700;"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:6px;background:${SERIES_STYLES[point.seriesIndex].stroke};"></span>${point.seriesName}: <b style="color:#ebf0f8;">${point.value}</b></div>`
        ));
        return `<div style="font-weight:800;margin-bottom:4px;">${params?.[0]?.name || ""}</div>${rows.join("")}`;
      }
    },
    xAxis: {
      type: "category",
      data: labels,
      axisLine: AXIS_LINE,
      axisTick: { show: false },
      axisLabel: { ...axisLabel, hideOverlap: true, formatter: (value) => value.split(" to ")[0] }
    },
    yAxis: {
      type: "value",
      minInterval: 1,
      axisLine: AXIS_LINE,
      axisLabel: axisLabel,
      splitLine: SPLIT_LINE
    },
    series
  };
};

const Statistics = () => {
  const navigate = useNavigate();
  const { token, loading } = useAuth();

  const [textA, setTextA] = useState(SAMPLE_DATA.a);
  const [textB, setTextB] = useState(SAMPLE_DATA.b);
  const [test, setTest] = useState("welch");
  const [tails, setTails] = useState("two");
  const [confidencePercent, setConfidencePercent] = useState(95);
  const [mu0, setMu0] = useState(0);
  const [bins, setBins] = useState(null);

  useEffect(() => {
    if (!loading && !token) navigate("/login");
  }, [token, loading, navigate]);

  const parsedA = useMemo(() => parseNumbers(textA), [textA]);
  const parsedB = useMemo(() => parseNumbers(textB), [textB]);
  const confidence = confidencePercent / 100;
  const describedA = useMemo(() => describe(parsedA.values, confidence), [parsedA, confidence]);
  const describedB = useMemo(() => describe(parsedB.values, confidence), [parsedB, confidence]);
  const testOption = TEST_OPTIONS.find((option) => option.value === test);
  const testResult = useMemo(
    () => runTest(test, parsedA.values, parsedB.values, { mu0: Number(mu0) || 0, tails, confidence }),
    [test, parsedA, parsedB, mu0, tails, confidence]
  );
  const binCount = bins || sturgesBins(Math.max(parsedA.values.length, parsedB.values.length));
  const showB = parsedB.values.length > 0 && test !== "oneSample" && test !== "chiSquare";
  const histogram = useMemo(
    () => buildHistogram(showB ? [parsedA.values, parsedB.values] : [parsedA.values], binCount),
    [parsedA, parsedB, binCount, showB]
  );
  const alpha = 1 - confidence;
  const significant = testResult && testResult.rows ? testResult.p < alpha : null;
  const tailsApply = !["descriptive", "chiSquare"].includes(test);

  const swapSamples = () => {
    setTextA(textB);
    setTextB(textA);
  };

  const loadSample = () => {
    setTextA(SAMPLE_DATA.a);
    setTextB(SAMPLE_DATA.b);
  };

  const clearSamples = () => {
    setTextA("");
    setTextB("");
  };

  const renderDescriptiveCard = (title, described, parsed) => (
    <section className="toolkitStatisticsLabCard">
      <div className="toolkitStatisticsLabCardTitle">
        <span>{title}</span>
        {parsed.invalid > 0 && (
          <span className="toolkitStatisticsLabCardMeta toolkitStatisticsLabWarningInline">
            {parsed.invalid} Ignored {parsed.invalid === 1 ? "Value" : "Values"}
          </span>
        )}
      </div>
      {!described ? (
        <div className="toolkitStatisticsLabEmpty">
          <FontAwesomeIcon icon={faTable} />
          <p>Enter numbers to see descriptive statistics.</p>
        </div>
      ) : (
        <>
          <div className="toolkitStatisticsLabStatGrid">
            {DESCRIPTIVE_FIELDS.map(([label, key]) => (
              <div key={key} className="toolkitStatisticsLabStat">
                <span className="toolkitStatisticsLabStatLabel">{label}</span>
                <span className="toolkitStatisticsLabStatValue">{formatDescriptive(described, key)}</span>
              </div>
            ))}
          </div>
          <div className="toolkitStatisticsLabInterval">
            <span className="toolkitStatisticsLabIntervalLabel">{confidencePercent}% Confidence Interval Of The Mean</span>
            <span className="toolkitStatisticsLabIntervalValue">
              {described.n > 1 ? `${formatNumber(described.ciLow)} to ${formatNumber(described.ciHigh)}` : "Needs At Least 2 Values"}
            </span>
          </div>
        </>
      )}
    </section>
  );

  return (
    <div className="toolkitStatisticsLabApp">
      <Nav activePage="statistics" />

      {loading ? (
        <div className="toolkitStatisticsLabCellHeaderContainer" style={{ justifyContent: "center" }}>
          <div className="loading-wrapper">
            <div className="loading-circle" />
            <label className="loading-title">
              Loading
            </label>
          </div>
        </div>
      ) : (
        <>
          <div className="toolkitStatisticsLabToolBar">
            <div className="toolkitStatisticsLabTitle">
              <FontAwesomeIcon icon={faChartBar} />
              <span>Statistics</span>
            </div>

            <div className="toolkitStatisticsLabStatusGroup">
              <span className="toolkitStatisticsLabStatusItem">
                <span>{testOption.label}</span>
              </span>
              <span className="toolkitStatisticsLabStatusItem">
                <span>A: {parsedA.values.length}</span>
              </span>
              <span className="toolkitStatisticsLabStatusItem">
                <span>B: {parsedB.values.length}</span>
              </span>
              <span className="toolkitStatisticsLabStatusItem">
                <span>α = {formatNumber(alpha, 3)}</span>
              </span>
              {significant !== null && (
                <span className={`toolkitStatisticsLabStatusItem ${significant ? "toolkitStatisticsLabStatusAccent" : ""}`}>
                  <span>{significant ? "Significant" : "Not Significant"}</span>
                </span>
              )}
            </div>
          </div>

          <div className="toolkitStatisticsLabShell">
            <aside className="toolkitStatisticsLabSidebar">
              <section className="toolkitStatisticsLabSection">
                <div className="toolkitStatisticsLabSectionTitle">
                  <FontAwesomeIcon icon={faTable} />
                  Data
                </div>

                <div className="toolkitStatisticsLabRow">
                  <div className="toolkitStatisticsLabRowHeader">
                    <label className="toolkitStatisticsLabLabel">{test === "chiSquare" ? "Sample A (Observed Counts)" : "Sample A"}</label>
                    <span className="toolkitStatisticsLabValue">{parsedA.values.length}</span>
                  </div>
                  <textarea
                    className="toolkitStatisticsLabTextArea toolkitStatisticsLabTextAreaSmall toolkitStatisticsLabMono"
                    value={textA}
                    onChange={(e) => setTextA(e.target.value)}
                    placeholder="Separate values with commas, spaces, or new lines."
                    spellCheck={false}
                  />
                </div>

                <div className="toolkitStatisticsLabRow">
                  <div className="toolkitStatisticsLabRowHeader">
                    <label className="toolkitStatisticsLabLabel">{test === "chiSquare" ? "Sample B (Expected, Optional)" : "Sample B"}</label>
                    <span className="toolkitStatisticsLabValue">{parsedB.values.length}</span>
                  </div>
                  <textarea
                    className="toolkitStatisticsLabTextArea toolkitStatisticsLabTextAreaSmall toolkitStatisticsLabMono"
                    value={textB}
                    onChange={(e) => setTextB(e.target.value)}
                    placeholder={test === "chiSquare" ? "Leave empty for a uniform expected distribution." : "Separate values with commas, spaces, or new lines."}
                    spellCheck={false}
                  />
                </div>

                <div className="toolkitStatisticsLabActions">
                  <button type="button" className="toolkitStatisticsLabBtn toolkitStatisticsLabSubtle" onClick={swapSamples}>
                    <FontAwesomeIcon icon={faRightLeft} /> Swap
                  </button>
                  <button type="button" className="toolkitStatisticsLabBtn toolkitStatisticsLabSubtle" onClick={loadSample}>
                    <FontAwesomeIcon icon={faWandMagicSparkles} /> Sample
                  </button>
                  <button type="button" className="toolkitStatisticsLabBtn toolkitStatisticsLabSubtle" onClick={clearSamples}>
                    <FontAwesomeIcon icon={faEraser} /> Clear
                  </button>
                </div>
              </section>

              <section className="toolkitStatisticsLabSection">
                <div className="toolkitStatisticsLabSectionTitle">
                  <FontAwesomeIcon icon={faFlask} />
                  Test
                </div>

                <div className="toolkitStatisticsLabRow">
                  <label className="toolkitStatisticsLabLabel">Method</label>
                  <Dropdown
                    value={testOption.label}
                    onChange={(option) => setTest((TEST_OPTIONS.find((entry) => entry.label === option) || TEST_OPTIONS[0]).value)}
                    options={TEST_OPTIONS.map((option) => option.label)}
                    placeholder="Method"
                  />
                </div>

                {test === "oneSample" && (
                  <div className="toolkitStatisticsLabRow">
                    <label className="toolkitStatisticsLabLabel">Hypothesized Mean</label>
                    <input className="toolkitStatisticsLabNumber" type="number" value={mu0} onChange={(e) => setMu0(e.target.value)} step="any" />
                  </div>
                )}

                <div className="toolkitStatisticsLabRow">
                  <label className="toolkitStatisticsLabLabel">Alternative Hypothesis</label>
                  <div className="toolkitStatisticsLabPresets toolkitStatisticsLabPresetsThirds">
                    {TAIL_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`toolkitStatisticsLabPresetBtn${tails === option.value ? " active" : ""}`}
                        onClick={() => setTails(option.value)}
                        disabled={!tailsApply}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="toolkitStatisticsLabRow">
                  <div className="toolkitStatisticsLabRowHeader">
                    <label className="toolkitStatisticsLabLabel">Confidence Level</label>
                    <span className="toolkitStatisticsLabValue">{confidencePercent}%</span>
                  </div>
                  <input type="range" min="80" max="99.9" step="0.1" value={confidencePercent} onChange={(e) => setConfidencePercent(Number(e.target.value))} />
                </div>

                <div className="toolkitStatisticsLabPresets toolkitStatisticsLabPresetsThirds">
                  {[90, 95, 99].map((level) => (
                    <button
                      key={level}
                      type="button"
                      className={`toolkitStatisticsLabPresetBtn${confidencePercent === level ? " active" : ""}`}
                      onClick={() => setConfidencePercent(level)}
                    >
                      {level}%
                    </button>
                  ))}
                </div>
              </section>

              <section className="toolkitStatisticsLabSection">
                <div className="toolkitStatisticsLabSectionTitle">
                  <FontAwesomeIcon icon={faSliders} />
                  Histogram
                </div>

                <div className="toolkitStatisticsLabRow">
                  <div className="toolkitStatisticsLabRowHeader">
                    <label className="toolkitStatisticsLabLabel">Bins</label>
                    <span className="toolkitStatisticsLabValue">{binCount}{bins ? "" : " Auto"}</span>
                  </div>
                  <input type="range" min="3" max="40" step="1" value={binCount} onChange={(e) => setBins(Number(e.target.value))} />
                </div>

                <div className="toolkitStatisticsLabActions">
                  <button type="button" className="toolkitStatisticsLabBtn toolkitStatisticsLabSubtle" onClick={() => setBins(null)} disabled={!bins}>
                    Use Sturges Rule
                  </button>
                </div>
              </section>
            </aside>

            <main className="toolkitStatisticsLabMain">
              <div className="toolkitStatisticsLabMainGrid">
                <section className="toolkitStatisticsLabCard toolkitStatisticsLabCardWide">
                  <div className="toolkitStatisticsLabCardTitle">
                    <span>{testOption.label}</span>
                    {tailsApply && (
                      <span className="toolkitStatisticsLabCardMeta">
                        {TAIL_OPTIONS.find((option) => option.value === tails).label}, {confidencePercent}% Confidence
                      </span>
                    )}
                  </div>
                  {test === "descriptive" ? (
                    <div className="toolkitStatisticsLabEmpty">
                      <FontAwesomeIcon icon={faFlask} />
                      <p>Choose a test method to compare or evaluate the samples.</p>
                    </div>
                  ) : testResult && testResult.error ? (
                    <div className="toolkitStatisticsLabEmpty toolkitStatisticsLabError">
                      <FontAwesomeIcon icon={faTriangleExclamation} />
                      <p>{testResult.error}</p>
                    </div>
                  ) : testResult ? (
                    <>
                      <div className="toolkitStatisticsLabStatGrid">
                        {testResult.rows.map(([label, value]) => (
                          <div key={label} className={`toolkitStatisticsLabStat${label === "p-Value" ? " toolkitStatisticsLabStatHighlight" : ""}`}>
                            <span className="toolkitStatisticsLabStatLabel">{label}</span>
                            <span className="toolkitStatisticsLabStatValue">{formatCell(label, value)}</span>
                          </div>
                        ))}
                      </div>
                      <div className={`toolkitStatisticsLabVerdict ${significant ? "toolkitStatisticsLabVerdictPositive" : ""}`}>
                        {significant
                          ? `The evidence suggests ${testResult.subject} at α = ${formatNumber(alpha, 3)} (p = ${formatPValue(testResult.p)}).`
                          : `There is not enough evidence that ${testResult.subject} at α = ${formatNumber(alpha, 3)} (p = ${formatPValue(testResult.p)}).`}
                      </div>
                      {testResult.warning && (
                        <div className="toolkitStatisticsLabWarningText">
                          <FontAwesomeIcon icon={faTriangleExclamation} />
                          <span>{testResult.warning}</span>
                        </div>
                      )}
                    </>
                  ) : null}
                </section>

                {renderDescriptiveCard("Sample A", describedA, parsedA)}
                {renderDescriptiveCard("Sample B", describedB, parsedB)}

                <section className="toolkitStatisticsLabCard toolkitStatisticsLabCardWide">
                  <div className="toolkitStatisticsLabCardTitle">
                    <span>Distribution</span>
                    <div className="toolkitStatisticsLabLegend">
                      <span className="toolkitStatisticsLabLegendItem"><span className="toolkitStatisticsLabSwatchA" /> Sample A</span>
                      {showB && <span className="toolkitStatisticsLabLegendItem"><span className="toolkitStatisticsLabSwatchB" /> Sample B</span>}
                    </div>
                  </div>
                  {histogram ? (
                    <div className="toolkitStatisticsLabChart">
                      <ReactEcharts option={histogramOption(histogram, showB)} style={CHART_STYLE} notMerge />
                    </div>
                  ) : (
                    <div className="toolkitStatisticsLabEmpty">
                      <FontAwesomeIcon icon={faChartBar} />
                      <p>Enter numbers to see the distribution.</p>
                    </div>
                  )}
                </section>

                <section className="toolkitStatisticsLabCard toolkitStatisticsLabCardWide">
                  <div className="toolkitStatisticsLabCardTitle">
                    <span>Export</span>
                    <div className="toolkitStatisticsLabCardActions">
                      <button
                        type="button"
                        className="toolkitStatisticsLabBtn toolkitStatisticsLabSubtle toolkitStatisticsLabCardAction"
                        onClick={() => copyText(buildSummaryCsv(describedA, describedB, testOption.label, testResult, confidence))}
                        disabled={!describedA && !describedB}
                      >
                        <FontAwesomeIcon icon={faCopy} /> Copy CSV
                      </button>
                      <button
                        type="button"
                        className="toolkitStatisticsLabBtn toolkitStatisticsLabCardAction"
                        onClick={() => downloadTextFile(buildSummaryCsv(describedA, describedB, testOption.label, testResult, confidence), "statistics_summary.csv", "text/csv")}
                        disabled={!describedA && !describedB}
                      >
                        <FontAwesomeIcon icon={faDownload} /> Download CSV
                      </button>
                    </div>
                  </div>
                  <pre className="toolkitStatisticsLabCode">{buildSummaryCsv(describedA, describedB, testOption.label, testResult, confidence)}</pre>
                </section>
              </div>
            </main>
          </div>
        </>
      )}
    </div>
  );
};

export default Statistics;