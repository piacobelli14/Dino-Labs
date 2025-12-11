import React, { useState, useRef, useEffect, useCallback } from "react";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import DinoLabsNav from "../../../helpers/Nav";
import DinoLabsColorPicker from "../../../helpers/ColorPicker.jsx";
import "../../../styles/mainStyles/DinoLabsPlugins/DinoLabsPluginsPlot/DinoLabsPluginsPlot.css";
import "../../../styles/helperStyles/Slider.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash, faHouse, faKeyboard, faLineChart, faMinus, faPlus, faRotate, faXmark, faPaintBrush } from "@fortawesome/free-solid-svg-icons";

export default function DinoLabsPluginsPlot() {
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
    { pattern: /\^-(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/g, replacement: "^⁻$1", description: "Negative Exponent" },
    { pattern: /(?<![a-zA-Z])\*(?![a-zA-Z])/g, replacement: "×", description: "Multiplication" },
    { pattern: /(?<![a-zA-Z])\/(?![a-zA-Z])/g, replacement: "÷", description: "Division" },
    { pattern: /\binfinity\b/g, replacement: "∞", description: "Infinity" },
    { pattern: /\binf\b/g, replacement: "∞", description: "Infinity" },
    { pattern: /\b1\/2\b/g, replacement: "½", description: "One Half" },
    { pattern: /\b1\/3\b/g, replacement: "⅓", description: "One Third" },
    { pattern: /\b2\/3\b/g, replacement: "⅔", description: "Two Thirds" },
    { pattern: /\b1\/4\b/g, replacement: "¼", description: "One Quarter" },
    { pattern: /\b3\/4\b/g, replacement: "¾", description: "Three Quarters" },
    { pattern: /\b1\/5\b/g, replacement: "⅕", description: "One Fifth" },
    { pattern: /\b1\/6\b/g, replacement: "⅙", description: "One Sixth" },
    { pattern: /\b1\/8\b/g, replacement: "⅛", description: "One Eighth" },
    { pattern: /\^2(?!\d)/g, replacement: "²", description: "Squared" },
    { pattern: /\^3(?!\d)/g, replacement: "³", description: "Cubed" },
    { pattern: /\bsum\(/g, replacement: "∑(", description: "Summation" },
    { pattern: /\bprod\(/g, replacement: "∏(", description: "Product" },
    { pattern: /\bintegral\(/g, replacement: "∫(", description: "Integral" }
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
    "½": "0.5",
    "⅓": "(1/3)",
    "⅔": "(2/3)", 
    "¼": "0.25",
    "¾": "0.75",
    "⅕": "0.2",
    "⅙": "(1/6)",
    "⅛": "0.125",
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

  const KNOWN_FUNCTIONS = [
    "sin", "cos", "tan", "sec", "csc", "cot",
    "asin", "acos", "atan", "asec", "acsc", "acot",
    "sinh", "cosh", "tanh", "asinh", "acosh", "atanh",
    "sech", "csch", "coth", "asech", "acsch", "acoth",
    "exp", "ln", "log", "logn", "sqrt", "cbrt", "pow", "root",
    "abs", "floor", "ceil", "round", "sign",
    "hypot", "clamp", "fact", "perm", "comb",
    "toRad", "toDeg", "sum", "prod", "integral"
  ];

  const KNOWN_CONSTANTS = [
    "pi", "e", "tau", "phi", "gamma",
    "c", "G", "h", "hbar", "k", "R", "NA", "qe", "eps0", "mu0",
    "me", "mp", "mn", "g0", "sigmaSB", "Ry", "alpha", "ke"
  ];

  const canvasRef = useRef(null);
  const suppressFormattingRef = useRef(false);
  const inputRefs = useRef({});
  const cursorPositionRef = useRef(0);

  const [formulas, setFormulas] = useState([]);
  const [variables, setVariables] = useState([]);
  const [intercepts, setIntercepts] = useState([]);
  const [isKeyboardView, setIsKeyboardView] = useState(false);
  const [functionMode, setFunctionMode] = useState("fx");
  const [colorPickerOpen, setColorPickerOpen] = useState({});
  const [shadingMenuOpen, setShadingMenuOpen] = useState({});
  const [mathMinX, setMathMinX] = useState(-10);
  const [mathMaxX, setMathMaxX] = useState(10);
  const [mathMinY, setMathMinY] = useState(-10);
  const [mathMaxY, setMathMaxY] = useState(10);

  const randomColor = () => {
    const colors = ["#ff6b6b", "#4ecdc4", "#45b7d1", "#96ceb4", "#feca57", "#ff9ff3", "#54a0ff", "#5f27cd", "#00d2d3", "#ff9f43", "#10ac84", "#ee5253"];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const getPrefixForMode = (mode) => {
    switch (mode) {
      case "derv": return "y' = ";
      case "integ": return "∫y = ";
      default: return "y = ";
    }
  };

  const applySymbolFormatting = (text, cursorPos) => {
    let formattedText = text;
    let newCursorPos = cursorPos;
    
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
    
    return { text: formattedText, cursorPos: newCursorPos };
  };

  const convertSymbolsForEvaluation = (displayExpression) => {
    let evalExpression = displayExpression;
    
    for (const [symbol, func] of Object.entries(SYMBOL_TO_FUNCTION)) {
      evalExpression = evalExpression.replace(new RegExp(escapeRegExp(symbol), "g"), func);
    }
    
    return evalExpression;
  };

  const escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  };

  const formatResult = (value, decimalPlaces = 6) => {
    if (!isFinite(value)) return "NaN";
    if (Math.abs(value) < 1e-100) return "0";
    if (Math.abs(value) < 1e-6 || Math.abs(value) > 1e12) {
      return value.toExponential(decimalPlaces);
    }
    return value.toFixed(decimalPlaces).replace(/\.?0+$/, "");
  };

  const createMathFunctions = () => {
    const SAFE_MATH = {
      sin: (v) => Math.sin(v),
      cos: (v) => Math.cos(v),
      tan: (v) => Math.tan(v),
      sec: (v) => {
        const cos_val = Math.cos(v);
        return Math.abs(cos_val) < 1e-15 ? NaN : 1 / cos_val;
      },
      csc: (v) => {
        const sin_val = Math.sin(v);
        return Math.abs(sin_val) < 1e-15 ? NaN : 1 / sin_val;
      },
      cot: (v) => {
        const tan_val = Math.tan(v);
        return Math.abs(tan_val) < 1e-15 ? NaN : 1 / tan_val;
      },
      asin: (v) => (v < -1 || v > 1) ? NaN : Math.asin(v),
      acos: (v) => (v < -1 || v > 1) ? NaN : Math.acos(v),
      atan: (v) => Math.atan(v),
      asec: (v) => {
        if (Math.abs(v) < 1) return NaN;
        const inv_v = 1 / v;
        return Math.acos(inv_v);
      },
      acsc: (v) => {
        if (Math.abs(v) < 1) return NaN;
        const inv_v = 1 / v;
        return Math.asin(inv_v);
      },
      acot: (v) => (v === 0) ? Math.PI / 2 : Math.atan(1 / v),

      sinh: (v) => {
        if (Math.abs(v) > 700) return v > 0 ? Infinity : -Infinity;
        return Math.sinh ? Math.sinh(v) : (Math.exp(v) - Math.exp(-v)) / 2;
      },
      cosh: (v) => {
        if (Math.abs(v) > 700) return Infinity;
        return Math.cosh ? Math.cosh(v) : (Math.exp(v) + Math.exp(-v)) / 2;
      },
      tanh: (v) => {
        if (Math.abs(v) > 20) return v > 0 ? 1 : -1;
        return Math.tanh ? Math.tanh(v) : (Math.exp(v) - Math.exp(-v)) / (Math.exp(v) + Math.exp(-v));
      },
      asinh: (v) => Math.asinh ? Math.asinh(v) : Math.log(v + Math.sqrt(v * v + 1)),
      acosh: (v) => {
        if (v < 1) return NaN;
        return Math.acosh ? Math.acosh(v) : Math.log(v + Math.sqrt(v * v - 1));
      },
      atanh: (v) => {
        if (Math.abs(v) >= 1) return NaN;
        return Math.atanh ? Math.atanh(v) : 0.5 * Math.log((1 + v) / (1 - v));
      },
      sech: (v) => {
        const cosh_val = SAFE_MATH.cosh(v);
        return isFinite(cosh_val) ? 1 / cosh_val : 0;
      },
      csch: (v) => {
        const sinh_val = SAFE_MATH.sinh(v);
        return Math.abs(sinh_val) < 1e-15 ? NaN : 1 / sinh_val;
      },
      coth: (v) => {
        const tanh_val = SAFE_MATH.tanh(v);
        return Math.abs(tanh_val) < 1e-15 ? NaN : 1 / tanh_val;
      },
      asech: (v) => {
        if (v <= 0 || v > 1) return NaN;
        return SAFE_MATH.acosh(1 / v);
      },
      acsch: (v) => {
        if (v === 0) return NaN;
        return SAFE_MATH.asinh(1 / v);
      },
      acoth: (v) => {
        if (Math.abs(v) <= 1) return NaN;
        return SAFE_MATH.atanh(1 / v);
      },

      exp: (v) => {
        if (v > 700) return Infinity;
        if (v < -700) return 0;
        return Math.exp(v);
      },
      ln: (v) => (v <= 0) ? NaN : Math.log(v),
      log: (v) => (v <= 0) ? NaN : Math.log10(v),
      logn: (v, b) => {
        if (v <= 0 || b <= 0 || b === 1) return NaN;
        return Math.log(v) / Math.log(b);
      },
      sqrt: (v) => (v < 0) ? NaN : Math.sqrt(v),
      cbrt: (v) => {
        if (v === 0) return 0;
        if (v < 0) return -Math.pow(-v, 1/3);
        return Math.cbrt ? Math.cbrt(v) : Math.pow(v, 1/3);
      },
      pow: (...args) => {
        if (args.length === 1) return Math.pow(args[0], 2);
        if (args.length === 2) {
          const [base, exp] = args;
          if (base === 0 && exp < 0) return Infinity;
          if (base < 0 && !Number.isInteger(exp)) return NaN;
          const result = Math.pow(base, exp);
          return isFinite(result) ? result : (result > 0 ? Infinity : -Infinity);
        }
        return NaN;
      },
      root: (v, n) => {
        if (n === 0 || !isFinite(n)) return NaN;
        if (v === 0) return 0;
        if (v < 0) {
          if (Number.isInteger(n) && Math.abs(n % 2) === 1) {
            return -Math.pow(-v, 1 / n);
          }
          return NaN;
        }
        return Math.pow(v, 1 / n);
      },

      abs: (v) => Math.abs(v),
      floor: (v) => Math.floor(v),
      ceil: (v) => Math.ceil(v),
      round: (v) => Math.round(v),
      sign: (v) => Math.sign(v),
      hypot: (...args) => {
        if (args.length < 2) return NaN;
        return Math.hypot(...args);
      },
      clamp: (v, min, max) => {
        if (min > max) return NaN;
        return Math.max(min, Math.min(max, v));
      },
      fact: (n) => {
        if (!Number.isInteger(n) || n < 0 || n > 170) return NaN;
        let result = 1;
        for (let i = 2; i <= n; i++) result *= i;
        return result;
      },
      perm: (n, k) => {
        if (![n, k].every(Number.isInteger) || n < 0 || k < 0 || k > n) return NaN;
        let result = 1;
        for (let i = n - k + 1; i <= n; i++) result *= i;
        return result;
      },
      comb: (n, k) => {
        if (![n, k].every(Number.isInteger) || n < 0 || k < 0 || k > n) return NaN;
        k = Math.min(k, n - k);
        let num = 1, den = 1;
        for (let i = 1; i <= k; i++) {
          num *= n - k + i;
          den *= i;
        }
        return num / den;
      },
      toRad: (deg) => deg * (Math.PI / 180),
      toDeg: (rad) => rad * (180 / Math.PI),
      sum: (v) => v,
      prod: (v) => v,
      integral: (v) => v
    };

    const CONSTANTS = {
      pi: Math.PI,
      e: Math.E,
      tau: 2 * Math.PI,
      phi: (1 + Math.sqrt(5)) / 2,
      gamma: 0.5772156649015329,
      c: 299792458,
      G: 6.67430e-11,
      h: 6.62607015e-34,
      hbar: 1.054571817e-34,
      k: 1.380649e-23,
      R: 8.314462618,
      NA: 6.02214076e23,
      qe: 1.602176634e-19,
      eps0: 8.8541878128e-12,
      mu0: 1.25663706212e-6,
      me: 9.1093837015e-31,
      mp: 1.67262192369e-27,
      mn: 1.67492749804e-27,
      g0: 9.80665,
      sigmaSB: 5.670374419e-8,
      Ry: 10973731.568160,
      alpha: 7.2973525693e-3,
      ke: 8.9875517923e9
    };

    return { SAFE_MATH, CONSTANTS };
  };

  const parseExpression = (expression, variables) => {
    const { SAFE_MATH, CONSTANTS } = createMathFunctions();
    
    window.SAFE_MATH = SAFE_MATH;
    window.CONSTANTS = CONSTANTS;
    
    let cleanExpr = expression.trim();
    
    const prefixPatterns = [
      /^y\s*'\s*=\s*/i,
      /^∫\s*y\s*=\s*/i,
      /^y\s*=\s*/i,
      /^f\s*\([^)]*\)\s*=\s*/i
    ];
    
    for (const pattern of prefixPatterns) {
      const match = cleanExpr.match(pattern);
      if (match) {
        cleanExpr = cleanExpr.substring(match[0].length);
        break;
      }
    }

    if (!cleanExpr.trim()) return null;

    cleanExpr = convertSymbolsForEvaluation(cleanExpr);

    const allVars = { ...variables };

    const substituteVariables = (expr) => {
      let result = expr;
      
      const sortedVars = Object.keys(allVars).sort((a, b) => b.length - a.length);
      for (const varName of sortedVars) {
        const escapedVarName = escapeRegExp(varName);
        const regex = new RegExp(`\\b${escapedVarName}\\b`, "g");
        result = result.replace(regex, `(${allVars[varName]})`);
      }
      
      result = result.replace(/\bx\b/g, "X_VAR");
      
      return result;
    };

    const substituteConstants = (expr) => {
      let result = expr;
      const sortedConstants = Object.keys(CONSTANTS).sort((a, b) => b.length - a.length);
      for (const constName of sortedConstants) {
        const escapedConstName = escapeRegExp(constName);
        const regex = new RegExp(`\\b${escapedConstName}\\b`, "g");
        result = result.replace(regex, `window.CONSTANTS.${constName}`);
      }
      return result;
    };

    const substituteFunctions = (expr) => {
      let result = expr;
      const sortedFunctions = Object.keys(SAFE_MATH).sort((a, b) => b.length - a.length);
      for (const funcName of sortedFunctions) {
        const escapedFuncName = escapeRegExp(funcName);
        const regex = new RegExp(`\\b${escapedFuncName}\\s*\\(`, "g");
        result = result.replace(regex, `window.SAFE_MATH.${funcName}(`);
      }
      return result;
    };

    const addImplicitMultiplication = (expr) => {
      let result = expr;
      result = result.replace(/(\d)([a-zA-Z_])/g, "$1*$2");
      result = result.replace(/(\d)(\()/g, "$1*$2");
      result = result.replace(/(\))(\d)/g, "$1*$2");
      result = result.replace(/(\))(\()/g, "$1*$2");
      result = result.replace(/([a-zA-Z_])(\d)/g, "$1*$2");
      result = result.replace(/([a-zA-Z_][a-zA-Z0-9_]*)(\()/g, (match, ident, paren) => {
        if (KNOWN_FUNCTIONS.includes(ident)) {
          return match;
        }
        return ident + "*" + paren;
      });
      return result;
    };

    try {
      let processedExpr = substituteVariables(cleanExpr);
      processedExpr = substituteConstants(processedExpr);
      processedExpr = addImplicitMultiplication(processedExpr);
      processedExpr = substituteFunctions(processedExpr);
      processedExpr = processedExpr.replace(/\^/g, "**");

      return (x) => {
        try {
          const finalExpr = processedExpr.replace(/X_VAR/g, `(${x})`);
          const result = eval(finalExpr);
          return isFinite(result) ? result : NaN;
        } catch (error) {
          return NaN;
        }
      };
    } catch (error) {
      return null;
    }
  };

  const evaluateFunction = (formula, x, vars = {}) => {
    const func = parseExpression(formula.text, vars);
    return func ? func(x) : NaN;
  };

  const addFormula = () => {
    const newFormula = {
      id: Date.now(),
      text: getPrefixForMode(functionMode),
      color: randomColor(),
      isHidden: false,
      mode: functionMode,
      shading: {
        toXAxis: false,
        toYAxis: false
      }
    };
    setFormulas([...formulas, newFormula]);
  };

  const updateFormula = (id, newText, cursorPos) => {
    suppressFormattingRef.current = true;
    const newCursorPos = cursorPos || newText.length;
    
    cursorPositionRef.current = newCursorPos;
    setFormulas(formulas.map(f => f.id === id ? { ...f, text: newText } : f));
    setIntercepts([]);
    
    requestAnimationFrame(() => {
      const formatted = applySymbolFormatting(newText, newCursorPos);
      suppressFormattingRef.current = false;
      cursorPositionRef.current = formatted.cursorPos;
      setFormulas(formulas.map(f => f.id === id ? { ...f, text: formatted.text } : f));
      
      if (inputRefs.current[id] && typeof formatted.cursorPos === "number") {
        inputRefs.current[id].setSelectionRange(formatted.cursorPos, formatted.cursorPos);
      }
    });
  };

  const updateFormulaColor = (id, newColor) => {
    setFormulas(formulas.map(f => f.id === id ? { ...f, color: newColor } : f));
    setIntercepts([]);
  };

  const removeFormula = (id) => {
    setFormulas(formulas.filter(f => f.id !== id));
    setIntercepts([]);
    const newColorPickerOpen = { ...colorPickerOpen };
    delete newColorPickerOpen[id];
    setColorPickerOpen(newColorPickerOpen);
    const newShadingMenuOpen = { ...shadingMenuOpen };
    delete newShadingMenuOpen[id];
    setShadingMenuOpen(newShadingMenuOpen);
    delete inputRefs.current[id];
  };

  const toggleFormulaVisibility = (id) => {
    setFormulas(formulas.map(f => f.id === id ? { ...f, isHidden: !f.isHidden } : f));
  };

  const toggleColorPicker = (id) => {
    setColorPickerOpen(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const closeColorPicker = (id) => {
    setColorPickerOpen(prev => ({
      ...prev,
      [id]: false
    }));
  };

  const toggleShadingMenu = (id) => {
    setShadingMenuOpen(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const closeShadingMenu = (id) => {
    setShadingMenuOpen(prev => ({
      ...prev,
      [id]: false
    }));
  };

  const updateFormulaShading = (id, shadingType, value) => {
    setFormulas(formulas.map(f => 
      f.id === id 
        ? { 
            ...f, 
            shading: {
              ...f.shading,
              [shadingType]: value
            }
          } 
        : f
    ));
    setIntercepts([]);
  };

  const addVariable = (name) => {
    if (!variables.find(v => v.name === name)) {
      setVariables([...variables, { id: Date.now(), name, value: 0 }]);
    }
  };

  const updateVariableValue = (id, value) => {
    setVariables(variables.map(v => v.id === id ? { ...v, value } : v));
    setIntercepts([]);
  };

  const removeVariable = (id) => {
    setVariables(variables.filter(v => v.id !== id));
    setIntercepts([]);
  };

  const insertText = (text) => {
    if (formulas.length > 0) {
      const lastFormula = formulas[formulas.length - 1];
      const input = inputRefs.current[lastFormula.id];
      const currentPos = input ? input.selectionStart : lastFormula.text.length;
      const newText = lastFormula.text.slice(0, currentPos) + text + lastFormula.text.slice(currentPos);
      
      updateFormula(lastFormula.id, newText, currentPos + text.length);
    }
  };

  const zoomGraph = (isZoomIn) => {
    const centerX = (mathMinX + mathMaxX) / 2;
    const centerY = (mathMinY + mathMaxY) / 2;
    const rangeX = mathMaxX - mathMinX;
    const rangeY = mathMaxY - mathMinY;
    const zoomFactor = isZoomIn ? 0.9 : 1.1;
    
    const newRangeX = rangeX * zoomFactor;
    const newRangeY = rangeY * zoomFactor;
    
    setMathMinX(centerX - newRangeX / 2);
    setMathMaxX(centerX + newRangeX / 2);
    setMathMinY(centerY - newRangeY / 2);
    setMathMaxY(centerY + newRangeY / 2);
  };

  const resetZoom = () => {
    setMathMinX(-10);
    setMathMaxX(10);
    setMathMinY(-10);
    setMathMaxY(10);
  };

  const findIntercepts = () => {
    const foundIntercepts = [];
    const sampleCount = 4000;
    const dx = (mathMaxX - mathMinX) / sampleCount;
    const vars = Object.fromEntries(variables.map(v => [v.name, v.value]));
    
    for (let i = 0; i < formulas.length; i++) {
      const formula = formulas[i];
      if (formula.isHidden) continue;
      
      const func = parseExpression(formula.text, vars);
      if (!func) continue;
      
      let prevY = func(mathMinX);
      let prevX = mathMinX;
      
      for (let j = 1; j <= sampleCount; j++) {
        const x = mathMinX + j * dx;
        const y = func(x);
        
        if (Math.abs(y) < 1e-6) {
          foundIntercepts.push({
            x: parseFloat(x.toFixed(6)),
            y: 0,
            formulaColor: formula.color
          });
        }
        
        if (isFinite(prevY) && isFinite(y) && prevY * y < 0) {
          let a = prevX, b = x;
          let fa = prevY, fb = y;
          
          for (let k = 0; k < 50; k++) {
            const c = (a + b) / 2;
            const fc = func(c);
            if (Math.abs(fc) < 1e-12 || Math.abs(b - a) < 1e-12) {
              foundIntercepts.push({
                x: parseFloat(c.toFixed(6)),
                y: 0,
                formulaColor: formula.color
              });
              break;
            }
            if (fa * fc < 0) {
              b = c;
              fb = fc;
            } else {
              a = c;
              fa = fc;
            }
          }
        }
        
        prevY = y;
        prevX = x;
      }
      
      if (mathMinX <= 0 && mathMaxX >= 0) {
        const yInt = func(0);
        if (isFinite(yInt) && yInt >= mathMinY && yInt <= mathMaxY) {
          foundIntercepts.push({
            x: 0,
            y: parseFloat(yInt.toFixed(6)),
            formulaColor: formula.color
          });
        }
      }
    }
    
    const uniqueIntercepts = foundIntercepts.filter((intercept, index, arr) => {
      return !arr.slice(0, index).some(prev => 
        Math.abs(prev.x - intercept.x) < 1e-4 && Math.abs(prev.y - intercept.y) < 1e-4
      );
    });
    
    setIntercepts(uniqueIntercepts);
  };

  const drawGraph = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    const width = rect.width;
    const height = rect.height;
    
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    
    const transform = (xv, yv) => ({
      x: ((xv - mathMinX) / (mathMaxX - mathMinX)) * width,
      y: height - ((yv - mathMinY) / (mathMaxY - mathMinY)) * height
    });
    
    const niceTickStep = (range) => {
      const roughStep = range / 10;
      const exponent = Math.floor(Math.log10(roughStep));
      const fraction = roughStep / Math.pow(10, exponent);
      const niceFraction = fraction < 1.5 ? 1 : fraction < 3 ? 2 : fraction < 7 ? 5 : 10;
      return niceFraction * Math.pow(10, exponent);
    };
    
    const tickStepX = niceTickStep(mathMaxX - mathMinX);
    const tickStepY = niceTickStep(mathMaxY - mathMinY);
    
    ctx.strokeStyle = "rgba(200, 200, 200, 0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    let xTick = Math.ceil(mathMinX / tickStepX) * tickStepX;
    while (xTick <= mathMaxX) {
      const start = transform(xTick, mathMinY);
      const end = transform(xTick, mathMaxY);
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      xTick += tickStepX;
    }
    
    let yTick = Math.ceil(mathMinY / tickStepY) * tickStepY;
    while (yTick <= mathMaxY) {
      const start = transform(mathMinX, yTick);
      const end = transform(mathMaxX, yTick);
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      yTick += tickStepY;
    }
    ctx.stroke();
    
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const xAxisY = transform(0, 0).y;
    const yAxisX = transform(0, 0).x;
    
    if (mathMinY <= 0 && mathMaxY >= 0) {
      const start = transform(mathMinX, 0);
      const end = transform(mathMaxX, 0);
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
    }
    
    if (mathMinX <= 0 && mathMaxX >= 0) {
      const start = transform(0, mathMinY);
      const end = transform(0, mathMaxY);
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
    }
    ctx.stroke();
    
    ctx.fillStyle = "#000";
    ctx.font = "10px Arial";
    
    xTick = Math.ceil(mathMinX / tickStepX) * tickStepX;
    while (xTick <= mathMaxX) {
      if (Math.abs(xTick) > 1e-10) {
        const pos = transform(xTick, 0);
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(xTick.toFixed(tickStepX < 1 ? 1 : 0), pos.x, xAxisY + 5);
      }
      xTick += tickStepX;
    }
    
    yTick = Math.ceil(mathMinY / tickStepY) * tickStepY;
    while (yTick <= mathMaxY) {
      if (Math.abs(yTick) > 1e-10) {
        const pos = transform(0, yTick);
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(yTick.toFixed(tickStepY < 1 ? 1 : 0), yAxisX - 5, pos.y);
      }
      yTick += tickStepY;
    }
    
    const vars = Object.fromEntries(variables.map(v => [v.name, v.value]));
    
    formulas.forEach(formula => {
      if (formula.isHidden) return;
      
      const func = parseExpression(formula.text, vars);
      if (!func) return;
      
      const samples = Math.max(2000, Math.abs(mathMaxX - mathMinX) * 100);
      const dx = (mathMaxX - mathMinX) / samples;
      
      if (formula.shading && (formula.shading.toXAxis || formula.shading.toYAxis)) {
        ctx.fillStyle = formula.color.replace(/rgb\(([^)]+)\)/, 'rgba($1, 0.15)') + '26';
        
        if (formula.shading.toXAxis) {
          ctx.beginPath();
          let firstPoint = true;
          
          for (let i = 0; i <= samples; i++) {
            const xv = mathMinX + i * dx;
            const y = func(xv);
            
            if (isFinite(y)) {
              const point = transform(xv, y);
              const basePoint = transform(xv, 0);
              
              if (point.y >= -height * 0.1 && point.y <= height * 1.1) {
                if (firstPoint) {
                  ctx.moveTo(point.x, basePoint.y);
                  ctx.lineTo(point.x, point.y);
                  firstPoint = false;
                } else {
                  ctx.lineTo(point.x, point.y);
                }
              } else {
                if (!firstPoint) {
                  const prevXv = mathMinX + (i - 1) * dx;
                  const prevBasePoint = transform(prevXv, 0);
                  ctx.lineTo(prevBasePoint.x, prevBasePoint.y);
                  ctx.fill();
                  ctx.beginPath();
                }
                firstPoint = true;
              }
            } else {
              if (!firstPoint) {
                const prevXv = mathMinX + (i - 1) * dx;
                const prevBasePoint = transform(prevXv, 0);
                ctx.lineTo(prevBasePoint.x, prevBasePoint.y);
                ctx.fill();
                ctx.beginPath();
              }
              firstPoint = true;
            }
          }
          
          if (!firstPoint) {
            const lastXv = mathMaxX;
            const lastBasePoint = transform(lastXv, 0);
            ctx.lineTo(lastBasePoint.x, lastBasePoint.y);
            ctx.fill();
          }
        }
        
        if (formula.shading.toYAxis) {
          ctx.beginPath();
          let firstPoint = true;
          
          for (let i = 0; i <= samples; i++) {
            const xv = mathMinX + i * dx;
            const y = func(xv);
            
            if (isFinite(y)) {
              const point = transform(xv, y);
              const basePoint = transform(0, y);
              
              if (point.y >= -height * 0.1 && point.y <= height * 1.1 && 
                  basePoint.x >= -width * 0.1 && basePoint.x <= width * 1.1) {
                if (firstPoint) {
                  ctx.moveTo(basePoint.x, point.y);
                  ctx.lineTo(point.x, point.y);
                  firstPoint = false;
                } else {
                  ctx.lineTo(point.x, point.y);
                }
              } else {
                if (!firstPoint) {
                  const prevY = func(mathMinX + (i - 1) * dx);
                  const prevBasePoint = transform(0, prevY);
                  ctx.lineTo(prevBasePoint.x, point.y);
                  ctx.fill();
                  ctx.beginPath();
                }
                firstPoint = true;
              }
            } else {
              if (!firstPoint) {
                const prevY = func(mathMinX + (i - 1) * dx);
                const prevBasePoint = transform(0, prevY);
                ctx.lineTo(prevBasePoint.x, point.y);
                ctx.fill();
                ctx.beginPath();
              }
              firstPoint = true;
            }
          }
          
          if (!firstPoint) {
            const lastY = func(mathMaxX);
            const lastBasePoint = transform(0, lastY);
            ctx.lineTo(lastBasePoint.x, lastBasePoint.y);
            ctx.fill();
          }
        }
      }
      
      ctx.strokeStyle = formula.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      
      let isFirstPoint = true;
      let lastValidPoint = null;
      
      for (let i = 0; i <= samples; i++) {
        const xv = mathMinX + i * dx;
        const y = func(xv);
        
        if (isFinite(y)) {
          const point = transform(xv, y);
          
          if (point.y >= -height * 0.1 && point.y <= height * 1.1) {
            if (lastValidPoint) {
              const distanceFromLast = Math.abs(point.y - lastValidPoint.y);
              if (distanceFromLast > height * 0.5) {
                isFirstPoint = true;
              }
            }
            
            if (isFirstPoint) {
              ctx.moveTo(point.x, point.y);
              isFirstPoint = false;
            } else {
              ctx.lineTo(point.x, point.y);
            }
            lastValidPoint = point;
          } else {
            isFirstPoint = true;
            lastValidPoint = null;
          }
        } else {
          isFirstPoint = true;
          lastValidPoint = null;
        }
      }
      ctx.stroke();
    });
    
    intercepts.forEach(intercept => {
      const point = transform(intercept.x, intercept.y);
      
      if (point.x >= -20 && point.x <= width + 20 && point.y >= -20 && point.y <= height + 20) {
        ctx.fillStyle = intercept.formulaColor;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
        
        const text = `(${intercept.x.toFixed(3)}, ${intercept.y.toFixed(3)})`;
        ctx.font = "bold 11px monospace";
        const textMetrics = ctx.measureText(text);
        const padding = 6;
        
        ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
        ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
        ctx.lineWidth = 1;
        const rectX = point.x - textMetrics.width / 2 - padding;
        const rectY = point.y - 28 - padding;
        const rectW = textMetrics.width + 2 * padding;
        const rectH = 14 + 2 * padding;
        
        ctx.fillRect(rectX, rectY, rectW, rectH);
        ctx.strokeRect(rectX, rectY, rectW, rectH);
        
        ctx.fillStyle = "#000000";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, point.x, point.y - 22);
      }
    });
  }, [formulas, variables, intercepts, mathMinX, mathMaxX, mathMinY, mathMaxY]);

  const extractMissingVariables = (text) => {
    if (!text) return [];
    
    let expression = text.trim();
    
    const prefixPatterns = [
      /^y\s*'\s*=\s*/i,
      /^∫\s*y\s*=\s*/i,
      /^y\s*=\s*/i,
      /^f\s*\([^)]*\)\s*=\s*/i
    ];
    
    for (const pattern of prefixPatterns) {
      const match = expression.match(pattern);
      if (match) {
        expression = expression.substring(match[0].length);
        break;
      }
    }
    
    if (!expression.trim()) return [];
    
    expression = convertSymbolsForEvaluation(expression);
    
    const matches = expression.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
    const variableNames = matches.filter(match => 
      !KNOWN_FUNCTIONS.includes(match) &&
      !KNOWN_CONSTANTS.includes(match) &&
      match !== "Math" &&
      !match.startsWith("y") &&
      match !== "x"  
    );
    const existingVars = variables.map(v => v.name);
    return [...new Set(variableNames)].filter(name => !existingVars.includes(name));
  };

  useEffect(() => {
    drawGraph();
  }, [drawGraph]);

  useEffect(() => {
    const handleResize = () => drawGraph();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [drawGraph]);

  return (
    <div className="dinolabsPluginsPlotApp" tabIndex={0}>
      <DinoLabsNav activePage="plugins" />

      <div className="dinolabsPluginsPlotContainer">
        <div className="dinolabsPluginsPlotLeftPanel">
          <div className="dinolabsPluginsPlotHeader">
            <button 
              className="dinolabsPluginsPlotAddButton" 
              onClick={addFormula}
              title="Add New Formula"
            >
              <FontAwesomeIcon icon={faPlus}/>
            </button>

            <div className="dinolabsPluginsPlotModeSelector">
              <button 
                className={`dinolabsPluginsPlotModeButton ${functionMode === "fx" ? "active" : ""}`}
                onClick={() => setFunctionMode("fx")}
                title="Function Mode"
              >
                f(x)
              </button>

              <button 
                className={`dinolabsPluginsPlotModeButton ${functionMode === "derv" ? "active" : ""}`}
                onClick={() => setFunctionMode("derv")}
                title="Derivative Mode"
              >
                d/dx
              </button>

              <button 
                className={`dinolabsPluginsPlotModeButton ${functionMode === "integ" ? "active" : ""}`}
                onClick={() => setFunctionMode("integ")}
                title="Integral Mode"
              >
                ∫f
              </button>
            </div>
          </div>

          <div className="dinolabsPluginsPlotFormulasList">
            {formulas.map(formula => {
              const missingVars = extractMissingVariables(formula.text);
              return (
                <div key={formula.id} className="dinolabsPluginsPlotFormulaItem">
                  <div className="dinolabsPluginsPlotFormulaRow">
                    <div className="dinolabsPluginsPlotColorControls">
                      <Tippy 
                        content={
                          <DinoLabsColorPicker 
                            color={formula.color} 
                            onChange={(newColor) => updateFormulaColor(formula.id, newColor)} 
                          />
                        } 
                        visible={colorPickerOpen[formula.id]} 
                        onClickOutside={() => closeColorPicker(formula.id)} 
                        interactive={true} 
                        placement="left-start"
                        offset={[0, 10]}
                        appendTo={document.body}
                        className="color-picker-tippy"
                      >
                        <button
                          className="dinolabsPluginsPlotColorIndicator"
                          style={{ backgroundColor: formula.color }}
                          onClick={() => toggleColorPicker(formula.id)}
                          title="Change Color"
                        />
                      </Tippy>

                      <Tippy 
                        content={
                          <div className="dinolabsPluginsPlotShadingMenu">
                            <div className="dinolabsPluginsPlotShadingOption">
                              <label>
                                <input
                                  type="checkbox"
                                  checked={formula.shading?.toXAxis || false}
                                  onChange={(e) => updateFormulaShading(formula.id, 'toXAxis', e.target.checked)}
                                />
                                Shade to X-axis
                              </label>
                            </div>
                            <div className="dinolabsPluginsPlotShadingOption">
                              <label>
                                <input
                                  type="checkbox"
                                  checked={formula.shading?.toYAxis || false}
                                  onChange={(e) => updateFormulaShading(formula.id, 'toYAxis', e.target.checked)}
                                />
                                Shade to Y-axis
                              </label>
                            </div>
                          </div>
                        } 
                        visible={shadingMenuOpen[formula.id]} 
                        onClickOutside={() => closeShadingMenu(formula.id)} 
                        interactive={true} 
                        placement="left-start"
                        offset={[0, 10]}
                        appendTo={document.body}
                        className="shading-menu-tippy"
                      >
                        <button
                          className={`dinolabsPluginsPlotShadingButton ${(formula.shading?.toXAxis || formula.shading?.toYAxis) ? 'active' : ''}`}
                          onClick={() => toggleShadingMenu(formula.id)}
                          title="Shading Options"
                        >
                          <FontAwesomeIcon icon={faPaintBrush}/>
                        </button>
                      </Tippy>

                      <button
                        className={`dinolabsPluginsPlotVisibilityToggle ${formula.isHidden ? "hidden" : "visible"}`}
                        onClick={() => toggleFormulaVisibility(formula.id)}
                        title={formula.isHidden ? "Show Formula" : "Hide Formula"}
                      >
                        <FontAwesomeIcon icon={formula.isHidden ? faEye : faEyeSlash}/>
                      </button>
                    </div>

                    <input
                      ref={el => inputRefs.current[formula.id] = el}
                      type="text"
                      className="dinolabsPluginsPlotFormulaInput"
                      value={formula.text}
                      onChange={(e) => {
                        suppressFormattingRef.current = true;
                        const newValue = e.target.value;
                        const cursorPos = e.target.selectionStart;
                        
                        cursorPositionRef.current = cursorPos;
                        setFormulas(formulas.map(f => f.id === formula.id ? { ...f, text: newValue } : f));
                        
                        requestAnimationFrame(() => {
                          const formatted = applySymbolFormatting(newValue, cursorPos);
                          if (formatted.text !== newValue) {
                            suppressFormattingRef.current = false;
                            cursorPositionRef.current = formatted.cursorPos;
                            setFormulas(formulas.map(f => f.id === formula.id ? { ...f, text: formatted.text } : f));
                            if (inputRefs.current[formula.id]) {
                              inputRefs.current[formula.id].setSelectionRange(formatted.cursorPos, formatted.cursorPos);
                            }
                          } else {
                            suppressFormattingRef.current = false;
                          }
                        });
                      }}
                      onSelect={(e) => cursorPositionRef.current = e.target.selectionStart}
                      placeholder="Enter formula... Try: sin(x), x^2, sqrt(x)"
                    />

                    <button 
                      className="dinolabsPluginsPlotRemoveButton"
                      onClick={() => removeFormula(formula.id)}
                      title="Remove Formula"
                    >
                      <FontAwesomeIcon icon={faXmark}/>
                    </button>
                  </div>

                  {missingVars.length > 0 && (
                    <div className="dinolabsPluginsPlotMissingVars">
                      <span>Add variables: </span>
                      {missingVars.map(varName => (
                        <button 
                          key={varName}
                          className="dinolabsPluginsPlotVarButton"
                          onClick={() => addVariable(varName)}
                          title={`Add variable ${varName}`}
                        >
                          {varName}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="dinolabsPluginsPlotVariablesList">
            {variables.map(variable => (
              <div key={variable.id} className="dinolabsPluginsPlotVariableItem">
                <div className="dinolabsPluginsPlotVariableHeader">
                  <small>
                  <span className="dinolabsPluginsPlotVariableName">{variable.name}: </span>
                  <span className="dinolabsPluginsPlotVariableValue">{variable.value.toFixed(1)}</span>
                  </small>

                  <button 
                    className="dinolabsPluginsPlotRemoveButton"
                    onClick={() => removeVariable(variable.id)}
                    title="Remove Variable"
                  >
                    ×
                  </button>
                </div>

                <input
                  type="range"
                  min="-10"
                  max="10"
                  step="0.1"
                  value={variable.value}
                  onChange={(e) => updateVariableValue(variable.id, parseFloat(e.target.value))}
                  className="dinolabsSettingsSlider"
                />
              </div>
            ))}
          </div>

          <button 
            className="dinolabsPluginsPlotKeyboardToggle"
            onClick={() => setIsKeyboardView(!isKeyboardView)}
            title="Toggle Virtual Keyboard"
          >
            <FontAwesomeIcon icon={faKeyboard}/>
            <span>{isKeyboardView ? "Hide Keyboard" : "Show Keyboard"}</span>
          </button>
        </div>

        <div className="dinolabsPluginsPlotGraphArea">
          <canvas 
            ref={canvasRef}
            className="dinolabsPluginsPlotCanvas"
          />
          
          <div className="dinolabsPluginsPlotControls">
            <button 
              className="dinolabsPluginsPlotControlButton zoom-in" 
              onClick={() => zoomGraph(true)}
              title="Zoom In"
            >
              <FontAwesomeIcon icon={faPlus}/>
            </button>

            <button 
              className="dinolabsPluginsPlotControlButton zoom-out" 
              onClick={() => zoomGraph(false)}
              title="Zoom Out" 
            >
              <FontAwesomeIcon icon={faMinus}/>
            </button>

            <button 
              className="dinolabsPluginsPlotControlButton reset-zoom" 
              onClick={resetZoom}
              title="Reset Zoom"
            >
              <FontAwesomeIcon icon={faRotate}/>
            </button>
          </div>

          <button 
            className="dinolabsPluginsPlotInterceptButton" 
            onClick={findIntercepts}
            title="Find Function Intercepts"
          >
            <FontAwesomeIcon icon={faLineChart}/>
            <span>Find Intercepts</span>
          </button>
        </div>
      </div>

      {isKeyboardView && (
        <div className="dinolabsPluginsPlotKeyboard">
          <div className="dinolabsPluginsPlotKeyboardSection">
            <h4>Numbers & Operators</h4>

            <div className="dinolabsPluginsPlotKeyboardGrid">
              <button className="dinolabsPluginsPlotKey" onClick={() => insertText("1")}>1</button>
              <button className="dinolabsPluginsPlotKey" onClick={() => insertText("2")}>2</button>
              <button className="dinolabsPluginsPlotKey" onClick={() => insertText("3")}>3</button>
              <button className="dinolabsPluginsPlotKey" onClick={() => insertText("4")}>4</button>
              <button className="dinolabsPluginsPlotKey" onClick={() => insertText("5")}>5</button>
              <button className="dinolabsPluginsPlotKey" onClick={() => insertText("6")}>6</button>
              <button className="dinolabsPluginsPlotKey" onClick={() => insertText("7")}>7</button>
              <button className="dinolabsPluginsPlotKey" onClick={() => insertText("8")}>8</button>
              <button className="dinolabsPluginsPlotKey" onClick={() => insertText("9")}>9</button>
              <button className="dinolabsPluginsPlotKey" onClick={() => insertText("0")}>0</button>
              <button className="dinolabsPluginsPlotKey" onClick={() => insertText(".")}>.</button>
              <button className="dinolabsPluginsPlotKey" onClick={() => insertText("(")}>(</button>
              <button className="dinolabsPluginsPlotKey" onClick={() => insertText(")")}>)</button>
              <button className="dinolabsPluginsPlotKey" onClick={() => insertText("[")}>[</button>
              <button className="dinolabsPluginsPlotKey" onClick={() => insertText("]")}>]</button>
              <button className="dinolabsPluginsPlotKey" onClick={() => insertText("+")}>+</button>
              <button className="dinolabsPluginsPlotKey" onClick={() => insertText("-")}>-</button>
              <button className="dinolabsPluginsPlotKey" onClick={() => insertText("*")}>×</button>
              <button className="dinolabsPluginsPlotKey" onClick={() => insertText("/")}>÷</button>
              <button className="dinolabsPluginsPlotKey" onClick={() => insertText("^")}>^</button>
              <button className="dinolabsPluginsPlotKey" onClick={() => insertText("+-")}>±</button>
              <button className="dinolabsPluginsPlotKey" onClick={() => insertText("=")}>=</button>
              <button className="dinolabsPluginsPlotKey" onClick={() => insertText("|")}>|</button>
            </div>
          </div>

          <div className="dinolabsPluginsPlotKeyboardSection">
            <h4>Functions & Constants</h4>

            <div className="dinolabsPluginsPlotKeyboardGrid">
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("sqrt(")} title="Square root">√</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("cbrt(")} title="Cube root">∛</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("pi")} title="Mathematical constant Pi">π</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("tau")} title="Mathematical constant Tau">τ</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("infinity")} title="Infinity">∞</button>
              
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("sin(")} title="Sine function">sin</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("cos(")} title="Cosine function">cos</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("tan(")} title="Tangent function">tan</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("sec(")} title="Secant function">sec</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("csc(")} title="Cosecant function">csc</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("cot(")} title="Cotangent function">cot</button>
              
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("asin(")} title="Arcsine function">asin</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("acos(")} title="Arccosine function">acos</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("atan(")} title="Arctangent function">atan</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("asec(")} title="Arcsecant function">asec</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("acsc(")} title="Arccosecant function">acsc</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("acot(")} title="Arccotangent function">acot</button>
              
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("sinh(")} title="Hyperbolic sine">sinh</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("cosh(")} title="Hyperbolic cosine">cosh</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("tanh(")} title="Hyperbolic tangent">tanh</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("asinh(")} title="Inverse hyperbolic sine">asinh</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("acosh(")} title="Inverse hyperbolic cosine">acosh</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("atanh(")} title="Inverse hyperbolic tangent">atanh</button>
              
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("exp(")} title="Exponential function">exp</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("ln(")} title="Natural logarithm">ln</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("log(")} title="Base-10 logarithm">log</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("logn(")} title="Logarithm with custom base">logn</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("pow(")} title="Power function">pow</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("root(")} title="N-th root">root</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("abs(")} title="Absolute value">abs</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("floor(")} title="Floor function">floor</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("ceil(")} title="Ceiling function">ceil</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("round(")} title="Round function">round</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("sign(")} title="Sign function">sign</button>
              
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("alpha")} title="Greek letter alpha">α</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("beta")} title="Greek letter beta">β</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("gamma")} title="Greek letter gamma">γ</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("delta")} title="Greek letter delta">δ</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("epsilon")} title="Greek letter epsilon">ε</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("theta")} title="Greek letter theta">θ</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("lambda")} title="Greek letter lambda">λ</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("mu")} title="Greek letter mu">μ</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("sigma")} title="Greek letter sigma">σ</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("phi")} title="Greek letter phi">φ</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("omega")} title="Greek letter omega">ω</button>
              
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("1/2")} title="One half">½</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("1/3")} title="One third">⅓</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("1/4")} title="One quarter">¼</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("2/3")} title="Two thirds">⅔</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("3/4")} title="Three quarters">¾</button>
              
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("^2")} title="Squared">x²</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("^3")} title="Cubed">x³</button>
              
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("<=")} title="Less than or equal">≤</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText(">=")} title="Greater than or equal">≥</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("!=")} title="Not equal">≠</button>
              
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("x")} title="Variable x">x</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("y")} title="Variable y">y</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("a")} title="Variable a">a</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("b")} title="Variable b">b</button>
              <button className="dinolabsPluginsPlotKey function" onClick={() => insertText("c")} title="Variable c">c</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}