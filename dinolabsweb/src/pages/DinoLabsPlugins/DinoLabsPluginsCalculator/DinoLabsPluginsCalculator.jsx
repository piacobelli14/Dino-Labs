import React, { useState, useRef, useEffect } from "react";
import DinoLabsNav from "../../../helpers/Nav";
import "../../../styles/mainStyles/DinoLabsPlugins/DinoLabsPluginsCalculator/DinoLabsPluginsCalculator.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGear, faXmarkSquare } from "@fortawesome/free-solid-svg-icons";

export default function DinoLabsPluginsCalculator() {

  const SUPERSCRIPT_MAP = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '-': '⁻', '+': '⁺', '.': '·'
  };

  const SUBSCRIPT_MAP = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉'
  };

  const REVERSE_SUPERSCRIPT_DIGIT = {
    '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
    '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
    '⁻': '-', '⁺': '+', '·': '.'
  };

  const REVERSE_SUBSCRIPT_DIGIT = {
    '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
    '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9'
  };

  const SYMBOL_REPLACEMENTS = [
    { pattern: /sqrt\(/g, replacement: "√(", description: "Square Root" },
    { pattern: /cbrt\(/g, replacement: "∛(", description: "Cube Root" },
    { pattern: /\bpi\b/g, replacement: "π", description: "Pi" },
    { pattern: /\btau\b/g, replacement: "τ", description: "Tau" },
    { pattern: /\balpha\b/g, replacement: "α", description: "Alpha" },
    { pattern: /\bbeta\b/g, replacement: "β", description: "Beta" },
    { pattern: /\bgamma\b/g, replacement: "γ", description: "Gamma" },
    { pattern: /\bdelta\b/g, replacement: "δ", description: "Delta" },
    { pattern: /\bepsilon\b/g, replacement: "ε", description: "Epsilon" },
    { pattern: /\btheta\b/g, replacement: "θ", description: "Theta" },
    { pattern: /\blambda\b/g, replacement: "λ", description: "Lambda" },
    { pattern: /\bmu\b/g, replacement: "μ", description: "Mu" },
    { pattern: /\bsigma\b/g, replacement: "σ", description: "Sigma" },
    { pattern: /\bphi\b/g, replacement: "φ", description: "Phi" },
    { pattern: /\bomega\b/g, replacement: "ω", description: "Omega" },
    { pattern: /<=/g, replacement: "≤", description: "Less Than or Equal" },
    { pattern: />=/g, replacement: "≥", description: "Greater Than or Equal" },
    { pattern: /!=/g, replacement: "≠", description: "Not Equal" },
    { pattern: /\+\-/g, replacement: "±", description: "Plus-Minus" },
    { pattern: /-\+/g, replacement: "∓", description: "Minus-Plus" },
    { pattern: /\*\*/g, replacement: "^", description: "Exponentiation" },
    { pattern: /(?<![a-zA-Z])\*(?![a-zA-Z])/g, replacement: "×", description: "Multiplication" },
    { pattern: /\binfinity\b/g, replacement: "∞", description: "Infinity" },
    { pattern: /\binf\b/g, replacement: "∞", description: "Infinity" },
    { pattern: /\bsum\(/g, replacement: "∑(", description: "Summation" },
    { pattern: /\bprod\(/g, replacement: "∏(", description: "Product" },
    { pattern: /\bintegral\(/g, replacement: "∫(", description: "Integral" },
  ];

  const SYMBOL_TO_FUNCTION = {
    "√": "sqrt",
    "∛": "cbrt",
    "π": "pi",
    "τ": "tau",
    "∞": "Infinity",
    "α": "alpha",
    "β": "beta",
    "γ": "gamma",
    "δ": "delta",
    "ε": "epsilon",
    "θ": "theta",
    "λ": "lambda",
    "μ": "mu",
    "σ": "sigma",
    "φ": "phi",
    "ω": "omega",
    "≤": "<=",
    "≥": ">=",
    "≠": "!=",
    "±": "+-",
    "∓": "-+",
    "×": "*",
    "÷": "/",
    "⁻": "-",
    "⁺": "+",
    "·": ".",
    "½": "(1/2)",
    "⅓": "(1/3)",
    "⅔": "(2/3)",
    "¼": "(1/4)",
    "¾": "(3/4)",
    "⅕": "(1/5)",
    "⅙": "(1/6)",
    "⅛": "(1/8)",
    "⁰": "^0",
    "¹": "^1",
    "²": "^2",
    "³": "^3",
    "⁴": "^4",
    "⁵": "^5",
    "⁶": "^6",
    "⁷": "^7",
    "⁸": "^8",
    "⁹": "^9",
    "∑": "sum",
    "∏": "prod",
    "∫": "integral"
  };

  const OPERATORS = {
    "+": { prec: 1, assoc: "L", arity: 2, fn: (a, b) => a + b },
    "-": { prec: 1, assoc: "L", arity: 2, fn: (a, b) => a - b },
    "*": { prec: 2, assoc: "L", arity: 2, fn: (a, b) => a * b },
    "/": { prec: 2, assoc: "L", arity: 2, fn: (a, b) => a / b },
    "^": { prec: 4, assoc: "R", arity: 2, fn: (a, b) => Math.pow(a, b) },
    neg: { prec: 4, assoc: "R", arity: 1, fn: (a) => -a },
  };

  const FUNCTIONS = {
    sin: { arity: 1, fn: (x) => Math.sin(x) },
    cos: { arity: 1, fn: (x) => Math.cos(x) },
    tan: { arity: 1, fn: (x) => Math.tan(x) },
    sec: { arity: 1, fn: (x) => 1 / Math.cos(x) },
    csc: { arity: 1, fn: (x) => 1 / Math.sin(x) },
    cot: { arity: 1, fn: (x) => 1 / Math.tan(x) },
    asin: { arity: 1, fn: (x) => { if (x < -1 || x > 1) throw new Error("DOMAIN asin"); return Math.asin(x); } },
    acos: { arity: 1, fn: (x) => { if (x < -1 || x > 1) throw new Error("DOMAIN acos"); return Math.acos(x); } },
    atan: { arity: 1, fn: (x) => Math.atan(x) },
    asec: { arity: 1, fn: (x) => { if (x === 0) throw new Error("DOMAIN asec"); const v = 1 / x; if (v < -1 || v > 1) throw new Error("DOMAIN asec"); return Math.acos(v); } },
    acsc: { arity: 1, fn: (x) => { if (x === 0) throw new Error("DOMAIN acsc"); const v = 1 / x; if (v < -1 || v > 1) throw new Error("DOMAIN acsc"); return Math.asin(v); } },
    acot: { arity: 1, fn: (x) => { if (x === 0) return Math.PI / 2; return Math.atan(1 / x); } },
    sinh: { arity: 1, fn: (x) => (Math.sinh ? Math.sinh(x) : (Math.exp(x) - Math.exp(-x)) / 2) },
    cosh: { arity: 1, fn: (x) => (Math.cosh ? Math.cosh(x) : (Math.exp(x) + Math.exp(-x)) / 2) },
    tanh: { arity: 1, fn: (x) => (Math.tanh ? Math.tanh(x) : (Math.exp(x) - Math.exp(-x)) / (Math.exp(x) + Math.exp(-x))) },
    asinh: { arity: 1, fn: (x) => (Math.asinh ? Math.asinh(x) : Math.log(x + Math.sqrt(x * x + 1))) },
    acosh: { arity: 1, fn: (x) => { if (x < 1) throw new Error("DOMAIN acosh"); return Math.acosh ? Math.acosh(x) : Math.log(x + Math.sqrt(x - 1) * Math.sqrt(x + 1)); } },
    atanh: { arity: 1, fn: (x) => { if (x <= -1 || x >= 1) throw new Error("DOMAIN atanh"); return Math.atanh ? Math.atanh(x) : 0.5 * Math.log((1 + x) / (1 - x)); } },
    sech: { arity: 1, fn: (x) => 1 / (Math.cosh ? Math.cosh(x) : (Math.exp(x) + Math.exp(-x)) / 2) },
    csch: { arity: 1, fn: (x) => { const s = Math.sinh ? Math.sinh(x) : (Math.exp(x) - Math.exp(-x)) / 2; if (s === 0) throw new Error("DOMAIN csch"); return 1 / s; } },
    coth: { arity: 1, fn: (x) => { const t = Math.tanh ? Math.tanh(x) : (Math.exp(x) - Math.exp(-x)) / (Math.exp(x) + Math.exp(-x)); if (t === 0) throw new Error("DOMAIN coth"); return 1 / t; } },
    asech: { arity: 1, fn: (x) => { if (x <= 0 || x > 1) throw new Error("DOMAIN asech"); return FUNCTIONS.acosh.fn(1 / x); } },
    acsch: { arity: 1, fn: (x) => { if (x === 0) throw new Error("DOMAIN acsch"); return FUNCTIONS.asinh.fn(1 / x); } },
    acoth: { arity: 1, fn: (x) => { if (Math.abs(x) <= 1) throw new Error("DOMAIN acoth"); return FUNCTIONS.atanh.fn(1 / x); } },
    exp: { arity: 1, fn: (x) => Math.exp(x) },
    ln: { arity: 1, fn: (x) => { if (x <= 0) throw new Error("DOMAIN ln"); return Math.log(x); } },
    log: { arity: 1, fn: (x) => { if (x <= 0) throw new Error("DOMAIN log"); return Math.log10 ? Math.log10(x) : Math.log(x) / Math.LN10; } },
    logn: { arity: 2, fn: (x, b) => { if (x <= 0 || b <= 0 || b === 1) throw new Error("DOMAIN logn"); return Math.log(x) / Math.log(b); } },
    sqrt: { arity: 1, fn: (x) => { if (x < 0) throw new Error("DOMAIN sqrt"); return Math.sqrt(x); } },
    cbrt: { arity: 1, fn: (x) => Math.cbrt ? Math.cbrt(x) : (x < 0 ? -Math.pow(-x, 1 / 3) : Math.pow(x, 1 / 3)) },
    pow: { arity: "var", fn: (...xs) => { if (xs.length === 1) return Math.pow(xs[0], 2); if (xs.length === 2) return Math.pow(xs[0], xs[1]); throw new Error("ARITY pow"); } },
    root: { arity: 2, fn: (x, n) => { if (n === 0) throw new Error("DOMAIN root"); if (x < 0 && Math.abs(n % 2) !== 1) throw new Error("DOMAIN root"); const sign = x < 0 ? -1 : 1; return sign * Math.pow(Math.abs(x), 1 / n); } },
    abs: { arity: 1, fn: (x) => Math.abs(x) },
    floor: { arity: 1, fn: (x) => Math.floor(x) },
    ceil: { arity: 1, fn: (x) => Math.ceil(x) },
    round: { arity: 1, fn: (x) => Math.round(x) },
    sign: { arity: 1, fn: (x) => Math.sign(x) },
    hypot: { arity: "var", fn: (...xs) => { if (xs.length < 2) throw new Error("ARITY hypot"); return Math.hypot(...xs); } },
    clamp: { arity: 3, fn: (x, min, max) => { if (min > max) throw new Error("DOMAIN clamp"); return Math.max(min, Math.min(max, x)); } },
    fact: { arity: 1, fn: (n) => { if (!Number.isInteger(n) || n < 0) throw new Error("DOMAIN fact"); if (n > 170) throw new Error("DOMAIN fact"); let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; } },
    perm: { arity: 2, fn: (n, k) => { if (![n, k].every(Number.isInteger) || n < 0 || k < 0 || k > n) throw new Error("DOMAIN perm"); let r = 1; for (let i = n - k + 1; i <= n; i++) r *= i; return r; } },
    comb: { arity: 2, fn: (n, k) => { if (![n, k].every(Number.isInteger) || n < 0 || k < 0 || k > n) throw new Error("DOMAIN comb"); k = Math.min(k, n - k); let num = 1; let den = 1; for (let i = 1; i <= k; i++) { num *= n - k + i; den *= i; } return num / den; } },
    toRad: { arity: 1, fn: (deg) => deg * (Math.PI / 180) },
    toDeg: { arity: 1, fn: (rad) => rad * (180 / Math.PI) },
    pi: { arity: 0, fn: () => Math.PI },
    tau: { arity: 0, fn: () => 2 * Math.PI },
  };

  const FUNCTION_NAMES = new Set(Object.keys(FUNCTIONS).map((s) => s.toLowerCase()));
  const RESERVED = new Set([...Object.keys(FUNCTIONS)].map((s) => s.toLowerCase()));

  const [expression, setExpression] = useState("");
  const [history, setHistory] = useState([]);
  const [terminalState, setTerminalState] = useState("funcs");
  const [variables, setVariables] = useState({});
  const [decimalPlaces, setDecimalPlaces] = useState(10);
  const [useSignificantFigures, setUseSignificantFigures] = useState(false);
  const [significantFigures, setSignificantFigures] = useState(6);
  const [useScientificNotation, setUseScientificNotation] = useState(false);
  const [scientificNotationThreshold, setScientificNotationThreshold] = useState(6);
  const [useFractionMode, setUseFractionMode] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const inputRef = useRef(null);
  const cursorPositionRef = useRef(null);

  const gcd = (a, b) => {
    a = Math.abs(Math.round(a));
    b = Math.abs(Math.round(b));
    while (b !== 0) {
      const t = b;
      b = a % b;
      a = t;
    }
    return a;
  };

  const createFraction = (num, den = 1) => {
    if (den === 0) throw new Error("Division by zero");
    if (den < 0) {
      num = -num;
      den = -den;
    }
    const g = gcd(Math.abs(num), Math.abs(den));
    return { num: num / g, den: den / g, isFraction: true };
  };

  const fractionToNumber = (f) => {
    if (f && f.isFraction) return f.num / f.den;
    return f;
  };

  const numberToFraction = (n) => {
    if (n && n.isFraction) return n;
    if (!Number.isFinite(n)) return { num: n, den: 1, isFraction: true };
    if (Number.isInteger(n)) return createFraction(n, 1);
    const precision = 1e10;
    const wholePart = Math.floor(n);
    const decimalPart = n - wholePart;
    let num = Math.round(decimalPart * precision);
    let den = precision;
    const g = gcd(num, den);
    num = num / g;
    den = den / g;
    return createFraction(wholePart * den + num, den);
  };

  const addFractions = (a, b) => {
    const fa = a.isFraction ? a : numberToFraction(a);
    const fb = b.isFraction ? b : numberToFraction(b);
    return createFraction(fa.num * fb.den + fb.num * fa.den, fa.den * fb.den);
  };

  const subtractFractions = (a, b) => {
    const fa = a.isFraction ? a : numberToFraction(a);
    const fb = b.isFraction ? b : numberToFraction(b);
    return createFraction(fa.num * fb.den - fb.num * fa.den, fa.den * fb.den);
  };

  const multiplyFractions = (a, b) => {
    const fa = a.isFraction ? a : numberToFraction(a);
    const fb = b.isFraction ? b : numberToFraction(b);
    return createFraction(fa.num * fb.num, fa.den * fb.den);
  };

  const divideFractions = (a, b) => {
    const fa = a.isFraction ? a : numberToFraction(a);
    const fb = b.isFraction ? b : numberToFraction(b);
    if (fb.num === 0) throw new Error("Division by zero");
    return createFraction(fa.num * fb.den, fa.den * fb.num);
  };

  const negateFraction = (a) => {
    const fa = a.isFraction ? a : numberToFraction(a);
    return createFraction(-fa.num, fa.den);
  };

  const intPow = (base, exp) => {
    if (!Number.isInteger(exp)) throw new Error("Invalid exponent");
    if (exp < 0) return 1 / intPow(base, -exp);
    let r = 1;
    let b = base;
    let e = exp;
    while (e > 0) {
      if (e & 1) r *= b;
      b *= b;
      e >>= 1;
    }
    return r;
  };

  const integerNthRootIfPerfect = (n, k) => {
    if (!Number.isInteger(n) || !Number.isInteger(k) || k <= 0) return null;
    if (n < 0) return null;
    if (n === 0) return 0;
    if (k === 1) return n;
    const approx = Math.round(Math.pow(n, 1 / k));
    const candidates = [approx - 2, approx - 1, approx, approx + 1, approx + 2];
    for (const c of candidates) {
      if (c >= 0 && Number.isSafeInteger(c)) {
        const p = Math.pow(c, k);
        if (p === n) return c;
      }
    }
    return null;
  };

  const powerFraction = (a, b) => {
    const fa = a.isFraction ? a : numberToFraction(a);
    const fb0 = b.isFraction ? b : numberToFraction(b);
    const fb = createFraction(fb0.num, fb0.den);

    if (fb.den === 1 && Number.isInteger(fb.num) && fb.num >= 0 && fb.num <= 100) {
      let numPow = Math.pow(fa.num, fb.num);
      let denPow = Math.pow(fa.den, fb.num);
      if (Number.isInteger(numPow) && Number.isInteger(denPow)) {
        return createFraction(numPow, denPow);
      }
    }

    if (fb.den === 1 && Number.isInteger(fb.num) && fb.num < 0 && fb.num >= -100) {
      const posExp = Math.abs(fb.num);
      let numPow = Math.pow(fa.den, posExp);
      let denPow = Math.pow(fa.num, posExp);
      if (Number.isInteger(numPow) && Number.isInteger(denPow)) {
        return createFraction(numPow, denPow);
      }
    }

    if (fb.den !== 1 && Number.isInteger(fb.num) && Number.isInteger(fb.den) && Math.abs(fb.num) <= 100 && fb.den <= 100) {
      const p = fb.num;
      const q = fb.den;

      if (fa.num === 0) {
        if (p === 0) return createFraction(1, 1);
        if (p < 0) throw new Error("Division by zero");
        return createFraction(0, 1);
      }

      const negBase = fa.num < 0;
      if (negBase && (q % 2 === 0)) throw new Error("DOMAIN root");

      const absNum = Math.abs(fa.num);
      const absDen = Math.abs(fa.den);

      const rNum = integerNthRootIfPerfect(absNum, q);
      const rDen = integerNthRootIfPerfect(absDen, q);

      if (rNum !== null && rDen !== null) {
        const signedRootNum = negBase ? -rNum : rNum;
        const rootFrac = createFraction(signedRootNum, rDen);

        const pp = Math.abs(p);
        const numPow = intPow(rootFrac.num, pp);
        const denPow = intPow(rootFrac.den, pp);
        const powered = createFraction(numPow, denPow);

        if (p < 0) {
          if (powered.num === 0) throw new Error("Division by zero");
          return createFraction(powered.den, powered.num);
        }
        return powered;
      }
    }

    const expVal = fractionToNumber(fb);
    const result = Math.pow(fractionToNumber(fa), expVal);
    return numberToFraction(result);
  };

  const formatResult = (value) => {
    if (!isFinite(value)) return value.toString();

    if (useScientificNotation) {
      const absVal = Math.abs(value);
      if (absVal === 0) return "0";
      const exp = Math.floor(Math.log10(absVal));
      if (Math.abs(exp) >= scientificNotationThreshold || (absVal !== 0 && absVal < 1e-6)) {
        return formatScientificNotation(value);
      }
    }

    if (useSignificantFigures) {
      return parseFloat(value.toPrecision(significantFigures)).toString();
    } else {
      if (Number.isInteger(value)) return value.toString();
      if (Math.abs(value) < 1e-100) return "0";
      if (Math.abs(value) > 1e12 || Math.abs(value) < 1e-6) {
        if (useScientificNotation) {
          return formatScientificNotation(value);
        }
        return value.toExponential(decimalPlaces);
      }
      return parseFloat(value.toFixed(decimalPlaces)).toString();
    }
  };

  const formatFraction = (f) => {
    if (!f || !f.isFraction) return formatResult(f);
    if (!Number.isFinite(f.num) || !Number.isFinite(f.den)) return fractionToNumber(f).toString();
    if (f.den === 1) return f.num.toString();
    if (Math.abs(f.den) > 1e10 || Math.abs(f.num) > 1e10) {
      return formatResult(fractionToNumber(f));
    }
    return f.num + "/" + f.den;
  };

  const FRACTION_OPERATORS = {
    "+": { prec: 1, assoc: "L", arity: 2, fn: addFractions },
    "-": { prec: 1, assoc: "L", arity: 2, fn: subtractFractions },
    "*": { prec: 2, assoc: "L", arity: 2, fn: multiplyFractions },
    "/": { prec: 2, assoc: "L", arity: 2, fn: divideFractions },
    "^": { prec: 4, assoc: "R", arity: 2, fn: powerFraction },
    neg: { prec: 4, assoc: "R", arity: 1, fn: negateFraction },
  };

  const escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  };

  const toSuperscript = (str) => {
    return str.split('').map(c => SUPERSCRIPT_MAP[c] || c).join('');
  };

  const toSubscript = (str) => {
    return str.split('').map(c => SUBSCRIPT_MAP[c] || c).join('');
  };

  const decodeSuperscriptNumber = (s) => {
    let out = "";
    for (const ch of s) {
      const v = REVERSE_SUPERSCRIPT_DIGIT[ch];
      if (v == null) return null;
      out += v;
    }
    return out;
  };

  const decodeSubscriptNumber = (s) => {
    let out = "";
    for (const ch of s) {
      const v = REVERSE_SUBSCRIPT_DIGIT[ch];
      if (v == null) return null;
      out += v;
    }
    return out;
  };

  const makeUnicodeFraction = (numStr, denStr) => {
    const n = String(numStr).replace(/\s+/g, "");
    const d = String(denStr).replace(/\s+/g, "");
    if (!/^[0-9]+$/.test(n) || !/^[0-9]+$/.test(d)) return null;
    if (d === "0") return null;
    const num = toSuperscript(n);
    const den = toSubscript(d);
    return num + "⁄" + den;
  };

  const parseParenFraction = (s) => {
    const m = s.match(/^\(\s*([0-9]+)\s*([\/÷])\s*([0-9]+)\s*\)$/);
    if (!m) return null;
    const uni = makeUnicodeFraction(m[1], m[3]);
    if (!uni) return null;
    return uni;
  };

  const formatExponentsInText = (text, cursorPos) => {
    let result = '';
    let newCursorPos = cursorPos;
    let i = 0;

    while (i < text.length) {
      if (text[i] === '^') {
        const expStart = i + 1;

        if (expStart < text.length && text[expStart] === '(') {
          let j = expStart;
          let depth = 0;
          while (j < text.length) {
            if (text[j] === '(') depth++;
            else if (text[j] === ')') {
              depth--;
              if (depth === 0) { j++; break; }
            }
            j++;
          }

          if (depth === 0) {
            const insideWithParens = text.substring(expStart, j);
            const uni = parseParenFraction(insideWithParens);
            if (uni) {
              const originalLen = j - i;
              const replacementLen = uni.length;

              if (cursorPos > i && cursorPos <= j) {
                newCursorPos = result.length + Math.min(replacementLen, Math.max(0, cursorPos - i - 1));
              } else if (cursorPos > j) {
                newCursorPos -= originalLen - replacementLen;
              }

              result += uni;
              i = j;
              continue;
            }
          }
        }

        let expEnd = expStart;

        if (expEnd < text.length && (text[expEnd] === '-' || text[expEnd] === '+')) {
          expEnd++;
        }

        while (expEnd < text.length && /[0-9.]/.test(text[expEnd])) {
          expEnd++;
        }

        if (expEnd > expStart && ((text[expStart] !== '-' && text[expStart] !== '+') || expEnd > expStart + 1)) {
          const exponent = text.substring(expStart, expEnd);
          const superscripted = toSuperscript(exponent);

          if (cursorPos > i && cursorPos <= expEnd) {
            const offsetInExp = cursorPos - expStart;
            newCursorPos = result.length + Math.min(offsetInExp, superscripted.length);
          } else if (cursorPos > expEnd) {
            newCursorPos -= (expEnd - i) - superscripted.length;
          }

          result += superscripted;
          i = expEnd;
          continue;
        }
      }
      result += text[i];
      i++;
    }

    return { text: result, cursorPos: Math.max(0, Math.min(newCursorPos, result.length)) };
  };

  const applyDivisionSymbolForNonFractions = (text, cursorPos) => {
    if (cursorPos <= 0) return { text, cursorPos };
    const idx = cursorPos - 1;
    if (text[idx] !== '/') return { text, cursorPos };
    const prev = idx - 1 >= 0 ? text[idx - 1] : "";
    if (/[0-9]/.test(prev)) return { text, cursorPos };
    const newText = text.slice(0, idx) + "÷" + text.slice(idx + 1);
    return { text: newText, cursorPos };
  };

  const applySymbolFormatting = (text, cursorPos) => {
    let formattedText = text;
    let newCursorPos = cursorPos;

    const beforeCursor0 = formattedText.substring(0, newCursorPos);
    const afterCursor0 = formattedText.substring(newCursorPos);

    const fracMatch = beforeCursor0.match(/(^|[^A-Za-z0-9_⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉])(\d+)\s*([\/÷])\s*(\d+)$/);
    if (fracMatch) {
      const full = fracMatch[0];
      const lead = fracMatch[1] || "";
      const numStr = fracMatch[2];
      const denStr = fracMatch[4];
      const uni = makeUnicodeFraction(numStr, denStr);
      if (uni) {
        const prefixLen = beforeCursor0.length - full.length;
        const newBefore = beforeCursor0.slice(0, prefixLen) + lead + uni;
        formattedText = newBefore + afterCursor0;
        newCursorPos = newBefore.length;
      }
    }

    const divFixed = applyDivisionSymbolForNonFractions(formattedText, newCursorPos);
    formattedText = divFixed.text;
    newCursorPos = divFixed.cursorPos;

    for (const { pattern, replacement } of SYMBOL_REPLACEMENTS) {
      const beforeCursor = formattedText.substring(0, newCursorPos);
      const afterCursor = formattedText.substring(newCursorPos);

      const match = beforeCursor.match(new RegExp(pattern.source + "$"));
      if (match) {
        const matchStart = beforeCursor.length - match[0].length;
        let newReplacement = replacement;

        if (replacement.includes("$1") && match[1]) {
          newReplacement = replacement.replace("$1", match[1]);
        }

        const newBeforeCursor = beforeCursor.substring(0, matchStart) + newReplacement;
        formattedText = newBeforeCursor + afterCursor;
        newCursorPos = newBeforeCursor.length;
        break;
      }
    }

    const expFormatted = formatExponentsInText(formattedText, newCursorPos);

    return { text: expFormatted.text, cursorPos: expFormatted.cursorPos };
  };

  const convertSymbolsForEvaluation = (displayExpression) => {
    let evalExpression = displayExpression;

    evalExpression = evalExpression.replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹]+)⁄([₀₁₂₃₄₅₆₇₈₉]+)/g, (m, a, b) => {
      const na = decodeSuperscriptNumber(a);
      const nb = decodeSubscriptNumber(b);
      if (na == null || nb == null) return m;
      if (!/^[0-9]+$/.test(na) || !/^[0-9]+$/.test(nb)) return m;
      if (nb === "0") return m;
      return "(" + na + "/" + nb + ")";
    });

    const superscriptPattern = /[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺·]+/g;
    evalExpression = evalExpression.replace(superscriptPattern, (match, offset, whole) => {
      const nextChar = whole && offset + match.length < whole.length ? whole[offset + match.length] : "";
      if (nextChar === "⁄") return match;
      let converted = '';
      for (const char of match) {
        converted += SYMBOL_TO_FUNCTION[char] || char;
      }
      return converted;
    });

    for (const [symbol, func] of Object.entries(SYMBOL_TO_FUNCTION)) {
      if (!/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺·]/.test(symbol)) {
        evalExpression = evalExpression.replace(new RegExp(escapeRegExp(symbol), "g"), func);
      }
    }

    return evalExpression;
  };

  const formatScientificNotation = (value) => {
    if (value === 0) return "0";

    const exp = Math.floor(Math.log10(Math.abs(value)));
    const mantissa = value / Math.pow(10, exp);

    let mantissaStr;
    if (useSignificantFigures) {
      mantissaStr = parseFloat(mantissa.toPrecision(significantFigures)).toString();
    } else {
      mantissaStr = parseFloat(mantissa.toFixed(decimalPlaces)).toString();
    }

    const expStr = exp.toString().split('').map(c => {
      if (c === '-') return '⁻';
      return SUPERSCRIPT_MAP[c] || c;
    }).join('');

    return mantissaStr + "×10" + expStr;
  };

  const isDigit = (c) => c >= "0" && c <= "9";
  const isAlpha = (c) => /[A-Za-z_]/.test(c);
  const isAlnum = (c) => /[A-Za-z0-9_]/.test(c);

  const tokenize = (src) => {
    const tokens = [];
    const s = src.trim();
    let i = 0;
    let absOpen = 0;

    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }

      if (isDigit(c) || (c === "." && i + 1 < s.length && isDigit(s[i + 1]))) {
        let num = "";

        if (c === ".") {
          num += "0.";
          i++;
          while (i < s.length && isDigit(s[i])) num += s[i++];
        } else {
          while (i < s.length && (isDigit(s[i]) || s[i] === ".")) num += s[i++];
        }

        if (i < s.length && (s[i] === "e" || s[i] === "E")) {
          let j = i + 1;
          let hasSign = false;
          if (j < s.length && (s[j] === "+" || s[j] === "-")) {
            hasSign = true;
            j++;
          }
          if (j < s.length && isDigit(s[j])) {
            num += s[i++];
            if (hasSign) num += s[i++];
            while (i < s.length && isDigit(s[i])) num += s[i++];
          }
        }

        const parsed = parseFloat(num);
        if (isNaN(parsed)) throw new Error("Invalid number: " + num);
        tokens.push({ type: "number", value: parsed });
        continue;
      }

      if (c === ".") {
        i++;
        continue;
      }

      if (isAlpha(c)) {
        let id = "";
        while (i < s.length && isAlnum(s[i])) id += s[i++];
        tokens.push({ type: "ident", value: id });
        continue;
      }

      if (c === "τ") { tokens.push({ type: "ident", value: "τ" }); i++; continue; }
      if (c === "⁻") { tokens.push({ type: "op", value: "-" }); i++; continue; }
      if ("([{".includes(c)) { tokens.push({ type: "lparen" }); i++; continue; }
      if (")]}".includes(c)) { tokens.push({ type: "rparen" }); i++; continue; }
      if (c === ",") { tokens.push({ type: "comma" }); i++; continue; }

      if (c === "|") {
        if (absOpen % 2 === 0) {
          tokens.push({ type: "function", value: "abs" });
          tokens.push({ type: "lparen" });
        } else {
          tokens.push({ type: "rparen" });
        }
        absOpen++;
        i++;
        continue;
      }

      if ("+-*/^".includes(c)) { tokens.push({ type: "op", value: c }); i++; continue; }
      if (c === "=") { tokens.push({ type: "equals" }); i++; continue; }

      throw new Error("Unexpected character \"" + c + "\"");
    }
    return tokens;
  };

  const splitMultiLetterVariables = (tokens) => {
    const result = [];
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.type === "ident" && token.value.length > 1) {
        const lower = token.value.toLowerCase();
        if (!RESERVED.has(lower)) {
          const splitResult = splitVariableString(token.value);
          if (splitResult.length > 1) {
            for (let j = 0; j < splitResult.length; j++) {
              if (j > 0) {
                result.push({ type: "op", value: "*" });
              }
              result.push({ type: "ident", value: splitResult[j] });
            }
            continue;
          }
        }
      }
      result.push(token);
    }
    return result;
  };

  const splitVariableString = (str) => {
    const allVarNames = Object.keys(variables).sort((a, b) => b.length - a.length);
    const result = [];
    let remaining = str.toLowerCase();

    while (remaining.length > 0) {
      let foundMatch = false;

      for (const varName of allVarNames) {
        if (remaining.startsWith(varName)) {
          result.push(varName);
          remaining = remaining.slice(varName.length);
          foundMatch = true;
          break;
        }
      }

      if (!foundMatch) {
        if (/^[a-zA-Z]$/.test(remaining[0])) {
          result.push(remaining[0]);
          remaining = remaining.slice(1);
        } else {
          return [str];
        }
      }
    }

    return result.length > 1 ? result : [str];
  };

  const annotateIdentifiers = (tokens) => {
    const out = [];
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.type === "ident") {
        const lower = String(t.value).toLowerCase();
        if (FUNCTION_NAMES.has(lower)) out.push({ type: "function", value: lower });
        else out.push({ type: "ident", value: lower });
      } else out.push(t);
    }
    return out;
  };

  const insertImplicitMultiplication = (tokens) => {
    const out = [];
    const isValueEnd = (t) => t.type === "number" || t.type === "rparen" || t.type === "ident";
    const isValueStart = (t) => t.type === "number" || t.type === "lparen" || t.type === "ident" || t.type === "function";

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      out.push(t);
      const n = tokens[i + 1];
      if (!n) continue;
      if (t.type === "function" && n.type === "lparen") continue;
      if (isValueEnd(t) && isValueStart(n)) {
        if (!(t.type === "ident" && n.type === "lparen" && FUNCTION_NAMES.has(t.value))) {
          out.push({ type: "op", value: "*" });
        }
      }
    }
    return out;
  };

  const toRPN = (tokens) => {
    const output = [];
    const stack = [];
    const frames = [];
    const peek = (arr) => arr[arr.length - 1];
    const isUnaryPosition = (prev) => {
      if (!prev) return true;
      return prev.type === "op" || prev.type === "lparen" || prev.type === "comma" || prev.type === "equals";
    };

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      const prev = tokens[i - 1];

      if (t.type === "number" || t.type === "ident") {
        output.push(t);
        continue;
      }

      if (t.type === "function") {
        stack.push(t);
        continue;
      }

      if (t.type === "comma") {
        while (stack.length && peek(stack).type !== "lparen") output.push(stack.pop());
        if (!stack.length) throw new Error("Misplaced comma or mismatched parentheses");
        if (frames.length) frames[frames.length - 1].argCount++;
        continue;
      }

      if (t.type === "lparen") {
        stack.push(t);
        frames.push({ argCount: 1 });
        continue;
      }

      if (t.type === "rparen") {
        while (stack.length && peek(stack).type !== "lparen") output.push(stack.pop());
        if (!stack.length) throw new Error("Mismatched parentheses");
        stack.pop();
        const f = stack[stack.length - 1];
        const frame = frames.pop();
        if (f && f.type === "function") {
          const func = stack.pop();
          const def = FUNCTIONS[func.value];
          const argc = def.arity === "var" ? frame.argCount : def.arity;
          if (def.arity !== "var" && frame.argCount !== def.arity) throw new Error(func.value + " expects " + def.arity + " argument(s)");
          output.push({ type: "function", value: func.value, argc });
        }
        continue;
      }

      if (t.type === "op") {
        let op = t.value;
        if (op === "-" && isUnaryPosition(prev)) op = "neg";
        const o1 = op;
        if (!OPERATORS[o1]) throw new Error("Unknown operator \"" + op + "\"");
        while (stack.length) {
          const top = peek(stack);
          if (top.type !== "op") break;
          const o2 = top.value;
          const p1 = OPERATORS[o1].prec;
          const p2 = OPERATORS[o2].prec;
          if ((OPERATORS[o1].assoc === "L" && p1 <= p2) || (OPERATORS[o1].assoc === "R" && p1 < p2)) {
            output.push(stack.pop());
          } else break;
        }
        stack.push({ type: "op", value: o1 });
        continue;
      }

      if (t.type === "equals") {
        output.push(t);
        continue;
      }

      throw new Error("Invalid token");
    }

    while (stack.length) {
      const top = stack.pop();
      if (top.type === "lparen" || top.type === "rparen") throw new Error("Mismatched parentheses");
      if (top.type === "function") {
        const def = FUNCTIONS[top.value];
        const argc = def.arity === "var" ? 1 : def.arity;
        output.push({ type: "function", value: top.value, argc });
      } else output.push(top);
    }
    return output;
  };

  const evalRPN = (rpn, variables = {}, fractionMode = false) => {
    const st = [];
    for (let i = 0; i < rpn.length; i++) {
      const t = rpn[i];

      if (t.type === "number") {
        if (fractionMode) {
          st.push(numberToFraction(t.value));
        } else {
          st.push(t.value);
        }
        continue;
      }

      if (t.type === "ident") {
        if (Object.prototype.hasOwnProperty.call(variables, t.value)) {
          const val = Number(variables[t.value]);
          if (fractionMode) {
            st.push(numberToFraction(val));
          } else {
            st.push(val);
          }
        } else {
          throw new Error("Unknown variable \"" + t.value + "\"");
        }
        continue;
      }

      if (t.type === "op") {
        if (fractionMode) {
          const def = FRACTION_OPERATORS[t.value];
          if (def.arity === 1) {
            if (st.length < 1) throw new Error("Stack Underflow.");
            const a = st.pop();
            const v = def.fn(a);
            st.push(v);
          } else {
            if (st.length < 2) throw new Error("Stack Underflow.");
            const b = st.pop();
            const a = st.pop();
            const v = def.fn(a, b);
            st.push(v);
          }
        } else {
          const def = OPERATORS[t.value];
          if (def.arity === 1) {
            if (st.length < 1) throw new Error("Stack Underflow.");
            const a = st.pop();
            const v = def.fn(a);
            if (!isFinite(v)) throw new Error("Invalid result");
            st.push(v);
          } else {
            if (st.length < 2) throw new Error("Stack Underflow.");
            const b = st.pop();
            const a = st.pop();
            const v = def.fn(a, b);
            if (!isFinite(v)) throw new Error("Invalid result");
            st.push(v);
          }
        }
        continue;
      }

      if (t.type === "function") {
        const def = FUNCTIONS[t.value];
        const argc = def.arity === "var" ? t.argc ?? 1 : def.arity;
        if (st.length < argc) throw new Error("Stack Underflow.");
        const args = [];
        for (let k = 0; k < argc; k++) {
          const arg = st.pop();
          if (fractionMode && arg && arg.isFraction) {
            args.unshift(fractionToNumber(arg));
          } else {
            args.unshift(arg);
          }
        }
        const v = def.fn(...args);
        if (!isFinite(v)) throw new Error("Invalid result");
        if (fractionMode) {
          st.push(numberToFraction(v));
        } else {
          st.push(v);
        }
        continue;
      }

      if (t.type === "equals") throw new Error("Unexpected \"=\" In Expression.");

      throw new Error("Invalid RPN Token.");
    }

    if (st.length !== 1) throw new Error("Invalid Expression.");
    const val = st[0];
    if (fractionMode) {
      if (val && val.isFraction) {
        if (!isFinite(val.num) || !isFinite(val.den)) throw new Error("Invalid result");
        return val;
      }
      return numberToFraction(val);
    }
    if (typeof val !== "number" || !isFinite(val)) throw new Error("Invalid result");
    return val;
  };

  const parseAndEvaluate = (expr, allVariables = {}, fractionMode = false) => {
    try {
      const evalExpr = convertSymbolsForEvaluation(expr);

      const tokens = tokenize(evalExpr);
      const splitTokens = splitMultiLetterVariables(tokens);
      const annotatedTokens = annotateIdentifiers(splitTokens);
      const withImplicitMult = insertImplicitMultiplication(annotatedTokens);
      const rpn = toRPN(withImplicitMult);
      const val = evalRPN(rpn, allVariables, fractionMode);
      return { value: val, error: null };
    } catch (error) {
      const raw = String(error && error.message ? error.message : "Error");
      if (raw.startsWith("DOMAIN")) return { value: null, error: "Domain Error." };
      if (raw.startsWith("ARITY pow")) return { value: null, error: "Pow Expects One Or Two Arguments." };
      if (raw.startsWith("ARITY hypot")) return { value: null, error: "Hypot Expects At Least Two Arguments." };
      if (raw.includes("Mismatched parentheses")) return { value: null, error: "Mismatched Parentheses." };
      if (raw.includes("Stack Underflow")) return { value: null, error: "Malformed Expression." };
      if (raw.startsWith("Unknown variable")) return { value: null, error: "Unknown Variable." };
      if (raw.includes("Invalid Expression")) return { value: null, error: "Malformed Expression." };
      if (raw.includes("Invalid number")) return { value: null, error: "Invalid Number Format." };
      return { value: null, error: "Error." };
    }
  };

  const detectVariables = (equation) => {
    const ids = [];
    const evalExpr = convertSymbolsForEvaluation(equation);
    const tokens = tokenize(evalExpr);
    const splitTokens = splitMultiLetterVariables(tokens);
    const annotatedTokens = annotateIdentifiers(splitTokens);
    for (const t of annotatedTokens) {
      if (t.type === "ident" && !RESERVED.has(t.value)) ids.push(t.value);
    }
    return [...new Set(ids)];
  };

  const detectVariablesInExpression = (expr) => {
    try {
      const foundVariables = [];
      const evalExpr = convertSymbolsForEvaluation(expr);
      const tokens = tokenize(evalExpr);
      const splitTokens = splitMultiLetterVariables(tokens);
      for (const token of splitTokens) {
        if (token.type === "ident" && variables[token.value.toLowerCase()]) {
          foundVariables.push(token.value.toLowerCase());
        }
      }
      return [...new Set(foundVariables)];
    } catch (error) {
      return [];
    }
  };

  const solveEquation = (equation) => {
    const parts = equation.split("=");
    if (parts.length !== 2) return equation;

    const leftStr = parts[0].trim();
    const rightStr = parts[1].trim();
    const vars = detectVariables(equation);
    let variable = null;

    if (vars.includes("x")) variable = "x";
    else if (vars.length === 1) variable = vars[0];
    else return "Cannot Determine A Single Variable To Solve For.";

    const f = (x) => {
      const allVars = { ...variables, [variable]: x };
      const l = parseAndEvaluate(leftStr, allVars, false);
      const r = parseAndEvaluate(rightStr, allVars, false);
      if (l.error || r.error) return NaN;
      const lVal = l.value && l.value.isFraction ? fractionToNumber(l.value) : l.value;
      const rVal = r.value && r.value.isFraction ? fractionToNumber(r.value) : r.value;
      return lVal - rVal;
    };

    const ranges = [[-1e6, 1e6], [-1e3, 1e3], [-100, 100], [-10, 10], [0, 100], [0, 10], [-5, 5]];

    const tryBisection = (a, b, maxIter = 160) => {
      let fa = f(a), fb = f(b);
      if (!isFinite(fa) || !isFinite(fb)) return null;
      if (fa === 0) return a;
      if (fb === 0) return b;
      if (fa * fb > 0) return null;

      for (let i = 0; i < maxIter; i++) {
        const m = (a + b) / 2;
        const fm = f(m);
        if (!isFinite(fm)) return null;
        if (Math.abs(fm) < 1e-12) return m;
        if (fa * fm < 0) { b = m; fb = fm; } else { a = m; fa = fm; }
        if (Math.abs(b - a) < 1e-10) return (a + b) / 2;
      }
      return (a + b) / 2;
    };

    const tryNewton = (x0, maxIter = 100) => {
      let x = x0;
      for (let i = 0; i < maxIter; i++) {
        const fx = f(x);
        if (!isFinite(fx)) return null;
        if (Math.abs(fx) < 1e-12) return x;
        const h = 1e-6;
        const fpx = (f(x + h) - f(x - h)) / (2 * h);
        if (!isFinite(fpx) || Math.abs(fpx) < 1e-14) return null;
        const nx = x - fx / fpx;
        if (!isFinite(nx)) return null;
        if (Math.abs(nx - x) < 1e-10) return nx;
        x = nx;
      }
      return null;
    };

    for (const [a, b] of ranges) {
      const m = tryBisection(a, b);
      if (m !== null && isFinite(m)) return variable + " = " + formatResult(m);
    }

    const seeds = [0, 1, -1, 2, -2, 5, -5, 10, -10, 100, -100];
    for (const s of seeds) {
      const r = tryNewton(s);
      if (r !== null && isFinite(r)) return variable + " = " + formatResult(r);
    }

    return "No Real Solution Found.";
  };

  const handleVariableAssignment = (expr) => {
    const parts = expr.split("=");
    if (parts.length !== 2) return false;

    const varName = parts[0].trim().toLowerCase();
    const valueExpr = parts[1].trim();

    if (!varName.match(/^[a-z_][a-z0-9_]*$/)) return false;

    if (RESERVED.has(varName)) {
      setHistory((prev) => [...prev, { expression: expr, result: "Cannot Override Function \"" + varName + "\"." }]);
      return true;
    }

    const result = parseAndEvaluate(valueExpr, variables, false);
    if (result.error) return false;

    const numVal = result.value && result.value.isFraction ? fractionToNumber(result.value) : result.value;
    setVariables(prev => ({ ...prev, [varName]: numVal }));
    return true;
  };

  const handleEnter = () => {
    if (!expression.trim()) return;

    const originalExpression = expression.trim();
    let result = "";

    if (originalExpression.includes("=")) {
      if (handleVariableAssignment(originalExpression)) {
        const parts = originalExpression.split("=");
        const varName = parts[0].trim().toLowerCase();
        const value = variables[varName] || parseAndEvaluate(parts[1].trim(), variables, false).value;
        const numVal = value && value.isFraction ? fractionToNumber(value) : value;
        result = varName + " = " + formatResult(numVal);
      } else {
        result = solveEquation(originalExpression);
      }
    } else {
      const { value, error } = parseAndEvaluate(originalExpression, variables, useFractionMode);
      if (!error) {
        if (useFractionMode && value && value.isFraction) {
          result = formatFraction(value);
        } else {
          result = formatResult(value);
        }
      } else {
        result = error;
      }
    }

    setHistory((prev) => [...prev, { expression: originalExpression, result }]);
    setExpression("");
    cursorPositionRef.current = 0;
  };

  const setCursorPosition = (pos) => {
    if (inputRef.current) {
      requestAnimationFrame(() => {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(pos, pos);
      });
    }
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;

    cursorPositionRef.current = cursorPos;

    const formatted = applySymbolFormatting(newValue, cursorPos);
    setExpression(formatted.text);

    if (formatted.text !== newValue || formatted.cursorPos !== cursorPos) {
      setTimeout(() => {
        setCursorPosition(formatted.cursorPos);
      }, 0);
    }
  };

  const appendToExpression = (value) => {
    const currentPos = inputRef.current?.selectionStart || expression.length;
    const newExpression = expression.slice(0, currentPos) + value + expression.slice(currentPos);
    const newCursorPos = currentPos + value.length;

    const formatted = applySymbolFormatting(newExpression, newCursorPos);
    setExpression(formatted.text);

    setTimeout(() => {
      setCursorPosition(formatted.cursorPos);
    }, 10);
  };

  const deleteLast = () => {
    const currentPos = inputRef.current?.selectionStart || expression.length;
    if (currentPos > 0) {
      const newExpression = expression.slice(0, currentPos - 1) + expression.slice(currentPos);
      const newCursorPos = currentPos - 1;
      setExpression(newExpression);
      setCursorPosition(newCursorPos);
    }
  };

  const clearExpression = () => {
    setExpression("");
    setCursorPosition(0);
  };

  const handleKeyPress = (e) => {
    if (e.target.tagName === "INPUT") {
      if (e.key === "Enter") {
        e.preventDefault();
        handleEnter();
      } else if (e.key === "Escape") {
        e.preventDefault();
        clearExpression();
      }
      return;
    }

    if (e.metaKey || e.ctrlKey || e.altKey) {
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      handleEnter();
    } else if (e.key === "Escape") {
      e.preventDefault();
      clearExpression();
    } else if (e.key.length === 1) {
      e.preventDefault();
      appendToExpression(e.key);
      inputRef.current?.focus();
    }
  };

  const CalcButton = ({ onClick, children, className = "" }) => (
    <button className={"dinolabsPluginsCalculatorButton " + className} onClick={onClick}>{children}</button>
  );

  const TTButton = ({ title, children, onClick, className = "" }) => (
    <button
      className={"dinolabsPluginsCalculatorButton " + className}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );

  return (
    <div className="dinolabsPluginsCalculatorApp" onKeyDown={handleKeyPress} tabIndex={0}>
      <DinoLabsNav activePage="plugins" />

      <div className="dinolabsPluginsCalculatorContainer">
        <div className="dinolabsPluginsCalculatorTopBar">
          <button
            className="dinolabsPluginsCalculatorSettingsGear"
            onClick={() => setShowSettingsModal(true)}
            title="Settings"
          >
            <FontAwesomeIcon icon={faGear} />
          </button>
        </div>

        <div className="dinolabsPluginsCalculatorHistory">
          {history.slice().reverse().map((item, index) => (
            <div key={index} className="dinolabsPluginsCalculatorHistoryItem">
              {item.expression} → {item.result}
            </div>
          ))}
        </div>

        <div className="dinolabsPluginsCalculatorInputContainer">
          <input
            ref={inputRef}
            type="text"
            className="dinolabsPluginsCalculatorInput"
            value={expression}
            onChange={handleInputChange}
            placeholder="Enter expression. Try: 1e5, 2.5E-3, x^10, sin(x²)"
            autoFocus
          />
          {expression && detectVariablesInExpression(expression).length > 0 && (
            <div className="dinolabsPluginsCalculatorVariableIndicator">
              <span className="dinolabsPluginsCalculatorVariableIndicatorLabel">Variables:</span>
              {detectVariablesInExpression(expression).map((varName) => (
                <span key={varName} className="dinolabsPluginsCalculatorVariableIndicatorItem">
                  {varName} = {formatResult(variables[varName])}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="dinolabsPluginsCalculatorTabs">
          <button
            className={"dinolabsPluginsCalculatorTabButton " + (terminalState === "funcs" ? "dinolabsPluginsCalculatorTabActive" : "")}
            onClick={() => setTerminalState("funcs")}
          >
            Functions
          </button>
        </div>

        <div className="dinolabsPluginsCalculatorKeyboard">
          <div className="dinolabsPluginsCalculatorFunctionsPanel">
            <div className="dinolabsPluginsCalculatorKeyboardRow">
              <CalcButton onClick={() => appendToExpression("1")} className="dinolabsPluginsCalculatorNumber">1</CalcButton>
              <CalcButton onClick={() => appendToExpression("2")} className="dinolabsPluginsCalculatorNumber">2</CalcButton>
              <CalcButton onClick={() => appendToExpression("3")} className="dinolabsPluginsCalculatorNumber">3</CalcButton>
              <CalcButton onClick={() => appendToExpression("4")} className="dinolabsPluginsCalculatorNumber">4</CalcButton>
              <CalcButton onClick={() => appendToExpression("5")} className="dinolabsPluginsCalculatorNumber">5</CalcButton>
              <CalcButton onClick={() => appendToExpression("6")} className="dinolabsPluginsCalculatorNumber">6</CalcButton>
              <CalcButton onClick={() => appendToExpression("7")} className="dinolabsPluginsCalculatorNumber">7</CalcButton>
              <CalcButton onClick={() => appendToExpression("8")} className="dinolabsPluginsCalculatorNumber">8</CalcButton>
              <CalcButton onClick={() => appendToExpression("9")} className="dinolabsPluginsCalculatorNumber">9</CalcButton>
              <CalcButton onClick={() => appendToExpression("(")} className="dinolabsPluginsCalculatorOperator">(</CalcButton>
              <CalcButton onClick={() => appendToExpression(")")} className="dinolabsPluginsCalculatorOperator">)</CalcButton>
              <CalcButton onClick={() => appendToExpression("{")} className="dinolabsPluginsCalculatorOperator">{"{"}</CalcButton>
              <CalcButton onClick={() => appendToExpression("}")} className="dinolabsPluginsCalculatorOperator">{"}"}</CalcButton>
              <CalcButton onClick={() => appendToExpression("[")} className="dinolabsPluginsCalculatorOperator">[</CalcButton>
              <CalcButton onClick={() => appendToExpression("]")} className="dinolabsPluginsCalculatorOperator">]</CalcButton>
              <CalcButton onClick={() => appendToExpression("+")} className="dinolabsPluginsCalculatorOperator">+</CalcButton>
              <CalcButton onClick={() => appendToExpression("-")} className="dinolabsPluginsCalculatorOperator">-</CalcButton>
              <CalcButton onClick={() => appendToExpression("/")} className="dinolabsPluginsCalculatorOperator">÷</CalcButton>
              <CalcButton onClick={() => appendToExpression(".")} className="dinolabsPluginsCalculatorOperator">.</CalcButton>
              <CalcButton onClick={() => appendToExpression("=")} className="dinolabsPluginsCalculatorOperator">=</CalcButton>
              <CalcButton onClick={() => appendToExpression("*")} className="dinolabsPluginsCalculatorOperator">×</CalcButton>
              <CalcButton onClick={() => appendToExpression("|")} className="dinolabsPluginsCalculatorOperator">|</CalcButton>
              <CalcButton onClick={() => appendToExpression("^")} className="dinolabsPluginsCalculatorOperator">^</CalcButton>
              <CalcButton onClick={() => appendToExpression("+-")} className="dinolabsPluginsCalculatorOperator">±</CalcButton>
              <CalcButton onClick={() => appendToExpression("e")} className="dinolabsPluginsCalculatorOperator">E</CalcButton>
            </div>
          </div>

          <div className="dinolabsPluginsCalculatorKeyboardSide">
            {terminalState === "funcs" && (
              <div className="dinolabsPluginsCalculatorFunctionsPanel">
                <div className="dinolabsPluginsCalculatorFunctionRow">
                  <TTButton title="Compute The Principal Square Root Of A Number." onClick={() => appendToExpression("sqrt(")} className="dinolabsPluginsCalculatorFunction">√</TTButton>
                  <TTButton title="Cube Root Function." onClick={() => appendToExpression("cbrt(")} className="dinolabsPluginsCalculatorFunction">∛</TTButton>
                  <TTButton title="Mathematical Constant Pi (≈3.14159)." onClick={() => appendToExpression("pi")} className="dinolabsPluginsCalculatorFunction">π</TTButton>
                  <TTButton title="Mathematical Constant Tau (2π)." onClick={() => appendToExpression("tau")} className="dinolabsPluginsCalculatorFunction">τ</TTButton>
                  <TTButton title="Raise A Number To A Power; With One Argument, It Squares The Input." onClick={() => appendToExpression("pow(")} className="dinolabsPluginsCalculatorFunction">pow</TTButton>
                  <TTButton title="Compute The Natural Logarithm Of A Positive Number." onClick={() => appendToExpression("ln(")} className="dinolabsPluginsCalculatorFunction">ln</TTButton>
                  <TTButton title="Compute The Base-10 Logarithm Of A Positive Number." onClick={() => appendToExpression("log(")} className="dinolabsPluginsCalculatorFunction">log</TTButton>
                  <TTButton title="Return The Sine Of An Angle In Radians." onClick={() => appendToExpression("sin(")} className="dinolabsPluginsCalculatorFunction">sin</TTButton>
                  <TTButton title="Return The Cosine Of An Angle In Radians." onClick={() => appendToExpression("cos(")} className="dinolabsPluginsCalculatorFunction">cos</TTButton>
                  <TTButton title="Return The Tangent Of An Angle In Radians." onClick={() => appendToExpression("tan(")} className="dinolabsPluginsCalculatorFunction">tan</TTButton>
                  <TTButton title="Return The Secant Of An Angle In Radians." onClick={() => appendToExpression("sec(")} className="dinolabsPluginsCalculatorFunction">sec</TTButton>
                  <TTButton title="Return The Cosecant Of An Angle In Radians." onClick={() => appendToExpression("csc(")} className="dinolabsPluginsCalculatorFunction">csc</TTButton>
                  <TTButton title="Return The Cotangent Of An Angle In Radians." onClick={() => appendToExpression("cot(")} className="dinolabsPluginsCalculatorFunction">cot</TTButton>
                  <TTButton title="Return The Arcsine In Radians; Domain Is −1 To 1." onClick={() => appendToExpression("asin(")} className="dinolabsPluginsCalculatorFunction">asin</TTButton>
                  <TTButton title="Return The Arccosine In Radians; Domain Is −1 To 1." onClick={() => appendToExpression("acos(")} className="dinolabsPluginsCalculatorFunction">acos</TTButton>
                  <TTButton title="Return The Arctangent In Radians." onClick={() => appendToExpression("atan(")} className="dinolabsPluginsCalculatorFunction">atan</TTButton>
                  <TTButton title="Return The Arcsecant In Radians; Domain Excludes 0." onClick={() => appendToExpression("asec(")} className="dinolabsPluginsCalculatorFunction">asec</TTButton>
                  <TTButton title="Return The Arccosecant In Radians; Domain Excludes 0." onClick={() => appendToExpression("acsc(")} className="dinolabsPluginsCalculatorFunction">acsc</TTButton>
                  <TTButton title="Return The Arccotangent In Radians; Acot(0) = π⁄2." onClick={() => appendToExpression("acot(")} className="dinolabsPluginsCalculatorFunction">acot</TTButton>
                  <TTButton title="Return The Hyperbolic Sine." onClick={() => appendToExpression("sinh(")} className="dinolabsPluginsCalculatorFunction">sinh</TTButton>
                  <TTButton title="Return The Hyperbolic Cosine." onClick={() => appendToExpression("cosh(")} className="dinolabsPluginsCalculatorFunction">cosh</TTButton>
                  <TTButton title="Return The Hyperbolic Tangent." onClick={() => appendToExpression("tanh(")} className="dinolabsPluginsCalculatorFunction">tanh</TTButton>
                  <TTButton title="Return E Raised To The Given Power." onClick={() => appendToExpression("exp(")} className="dinolabsPluginsCalculatorFunction">exp</TTButton>
                  <TTButton title="Return The Logarithm Of X With Base B." onClick={() => appendToExpression("logn(")} className="dinolabsPluginsCalculatorFunction">logn</TTButton>
                  <TTButton title="Return The N-th Root Of X (x^(1/n))." onClick={() => appendToExpression("root(")} className="dinolabsPluginsCalculatorFunction">root</TTButton>
                  <TTButton title="Return The Sign Of A Number (−1, 0, Or 1)." onClick={() => appendToExpression("sign(")} className="dinolabsPluginsCalculatorFunction">sign</TTButton>
                  <TTButton title="Return The Euclidean Norm √(x₁² + … + xₙ²)." onClick={() => appendToExpression("hypot(")} className="dinolabsPluginsCalculatorFunction">hypot</TTButton>
                  <TTButton title="Clamp X To The Closed Interval [min, max]." onClick={() => appendToExpression("clamp(")} className="dinolabsPluginsCalculatorFunction">clamp</TTButton>
                  <TTButton title="Return N Factorial (n!)." onClick={() => appendToExpression("fact(")} className="dinolabsPluginsCalculatorFunction">fact</TTButton>
                  <TTButton title="Return Permutations: P(n, k)." onClick={() => appendToExpression("perm(")} className="dinolabsPluginsCalculatorFunction">perm</TTButton>
                  <TTButton title="Return Combinations: C(n, k)." onClick={() => appendToExpression("comb(")} className="dinolabsPluginsCalculatorFunction">comb</TTButton>
                  <TTButton title="Convert Degrees To Radians." onClick={() => appendToExpression("toRad(")} className="dinolabsPluginsCalculatorFunction">toRad</TTButton>
                  <TTButton title="Convert Radians To Degrees." onClick={() => appendToExpression("toDeg(")} className="dinolabsPluginsCalculatorFunction">toDeg</TTButton>
                  <TTButton title="Return The Absolute Value." onClick={() => appendToExpression("abs(")} className="dinolabsPluginsCalculatorFunction">abs</TTButton>
                </div>
              </div>
            )}
          </div>

          <div className="dinolabsPluginsCalculatorKeyboardControls">
            <div className="dinolabsPluginsCalculatorKeyboardRow">
              <CalcButton onClick={() => appendToExpression("x")} className="dinolabsPluginsCalculatorVariable">x</CalcButton>
              <CalcButton onClick={() => appendToExpression("a")} className="dinolabsPluginsCalculatorVariable">a</CalcButton>
              <CalcButton onClick={deleteLast} className="dinolabsPluginsCalculatorControl dinolabsPluginsCalculatorWide">⌫</CalcButton>
            </div>

            <div className="dinolabsPluginsCalculatorKeyboardRow">
              <CalcButton onClick={() => appendToExpression("y")} className="dinolabsPluginsCalculatorVariable">y</CalcButton>
              <CalcButton onClick={() => appendToExpression("b")} className="dinolabsPluginsCalculatorVariable">b</CalcButton>
              <CalcButton onClick={clearExpression} className="dinolabsPluginsCalculatorControl dinolabsPluginsCalculatorWide">Clear</CalcButton>
            </div>

            <div className="dinolabsPluginsCalculatorKeyboardRow">
              <CalcButton onClick={() => appendToExpression("z")} className="dinolabsPluginsCalculatorVariable">z</CalcButton>
              <CalcButton onClick={() => appendToExpression("c")} className="dinolabsPluginsCalculatorVariable">c</CalcButton>
              <CalcButton onClick={handleEnter} className="dinolabsPluginsCalculatorControl dinolabsPluginsCalculatorWide dinolabsPluginsCalculatorEnter">Enter</CalcButton>
            </div>
          </div>
        </div>
      </div>

      {showSettingsModal && (
        <div className="dinolabsPluginsCalculatorModalOverlay" onClick={() => setShowSettingsModal(false)}>
          <div className="dinolabsPluginsCalculatorModal" onClick={(e) => e.stopPropagation()}>
            <div className="dinolabsPluginsCalculatorModalHeader">
              <h3>Calculator Settings</h3>
              <button
                className="dinolabsPluginsCalculatorModalCloseButton"
                onClick={() => setShowSettingsModal(false)}
              >
                <FontAwesomeIcon icon={faXmarkSquare} />
              </button>
            </div>

            <div className="dinolabsPluginsCalculatorModalContent">
              <div className="dinolabsPluginsCalculatorSettingsSection">
                <div className="dinolabsPluginsCalculatorSettingsLabel">Fraction Mode:</div>
                <div className="dinolabsPluginsCalculatorSettingsButtonGroup">
                  <button
                    className={`dinolabsPluginsCalculatorSettingsButton ${!useFractionMode ? "dinolabsPluginsCalculatorSettingsButtonActive" : ""}`}
                    onClick={() => setUseFractionMode(false)}
                  >
                    Decimal
                  </button>
                  <button
                    className={`dinolabsPluginsCalculatorSettingsButton ${useFractionMode ? "dinolabsPluginsCalculatorSettingsButtonActive" : ""}`}
                    onClick={() => setUseFractionMode(true)}
                  >
                    Fraction
                  </button>
                </div>
              </div>

              <div className="dinolabsPluginsCalculatorSettingsSection">
                <div className="dinolabsPluginsCalculatorSettingsLabel">Rounding Mode:</div>
                <div className="dinolabsPluginsCalculatorSettingsButtonGroup">
                  <button
                    className={`dinolabsPluginsCalculatorSettingsButton ${!useSignificantFigures ? "dinolabsPluginsCalculatorSettingsButtonActive" : ""}`}
                    onClick={() => setUseSignificantFigures(false)}
                  >
                    Decimal Places
                  </button>
                  <button
                    className={`dinolabsPluginsCalculatorSettingsButton ${useSignificantFigures ? "dinolabsPluginsCalculatorSettingsButtonActive" : ""}`}
                    onClick={() => setUseSignificantFigures(true)}
                  >
                    Significant Figures
                  </button>
                </div>
              </div>

              <div className="dinolabsPluginsCalculatorSettingsSection">
                <div className="dinolabsPluginsCalculatorSettingsLabel">
                  {useSignificantFigures ? `Significant Figures: ${significantFigures}` : `Decimal Places: ${decimalPlaces}`}
                </div>
                <div className="dinolabsPluginsCalculatorSliderContainer">
                  <input
                    type="range"
                    min={useSignificantFigures ? "1" : "0"}
                    max="15"
                    value={useSignificantFigures ? significantFigures : decimalPlaces}
                    onChange={(e) => useSignificantFigures ? setSignificantFigures(parseInt(e.target.value)) : setDecimalPlaces(parseInt(e.target.value))}
                    className="dinolabsPluginsCalculatorSlider"
                  />
                </div>
              </div>

              <div className="dinolabsPluginsCalculatorSettingsSection">
                <div className="dinolabsPluginsCalculatorSettingsLabel">Scientific Notation:</div>
                <div className="dinolabsPluginsCalculatorSettingsButtonGroup">
                  <button
                    className={`dinolabsPluginsCalculatorSettingsButton ${!useScientificNotation ? "dinolabsPluginsCalculatorSettingsButtonActive" : ""}`}
                    onClick={() => setUseScientificNotation(false)}
                  >
                    Off
                  </button>
                  <button
                    className={`dinolabsPluginsCalculatorSettingsButton ${useScientificNotation ? "dinolabsPluginsCalculatorSettingsButtonActive" : ""}`}
                    onClick={() => setUseScientificNotation(true)}
                  >
                    On
                  </button>
                </div>
              </div>

              {useScientificNotation && (
                <div className="dinolabsPluginsCalculatorSettingsSection">
                  <div className="dinolabsPluginsCalculatorSettingsLabel">
                    Use Scientific Notation When Exponent ≥ {scientificNotationThreshold}
                  </div>
                  <div className="dinolabsPluginsCalculatorSliderContainer">
                    <input
                      type="range"
                      min="1"
                      max="12"
                      value={scientificNotationThreshold}
                      onChange={(e) => setScientificNotationThreshold(parseInt(e.target.value))}
                      className="dinolabsPluginsCalculatorSlider"
                    />
                  </div>
                </div>
              )}

              <div className="dinolabsPluginsCalculatorSettingsSection">
                <div className="dinolabsPluginsCalculatorSettingsLabel">Variables:</div>
                <div className="dinolabsPluginsCalculatorVariablesList">
                  {Object.keys(variables).length === 0 ? (
                    <div className="dinolabsPluginsCalculatorVariablesEmpty">No Variables Set. Use x = 5 To Set Variables.</div>
                  ) : (
                    Object.entries(variables).map(([name, value]) => (
                      <div key={name} className="dinolabsPluginsCalculatorVariableItem">
                        <span className="dinolabsPluginsCalculatorVariableName">{name}</span>
                        <span className="dinolabsPluginsCalculatorVariableValue">{formatResult(value)}</span>
                        <button
                          onClick={() => setVariables(prev => { const newVars = { ...prev }; delete newVars[name]; return newVars; })}
                          className="dinolabsPluginsCalculatorVariableDeleteButton"
                        >
                          Delete
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
