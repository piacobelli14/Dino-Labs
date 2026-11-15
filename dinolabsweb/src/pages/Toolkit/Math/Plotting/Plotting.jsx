import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEye, faEyeSlash, faKeyboard, faLineChart, faMinus,
  faPlus, faRotate, faXmark, faPaintBrush, faCircle,
  faDrawPolygon, faSquare, faCaretDown, faShapes
} from "@fortawesome/free-solid-svg-icons";
import Tippy from "@tippyjs/react";
import Nav from "../../../../helpers/Nav.jsx";
import ColorPicker from "../../../../helpers/ColorPicker.jsx";
import useAuth from "../../../../UseAuth.jsx";
import "../../../../styles/mainStyles/Toolkit/Math/Plotting/Plotting.css";
import "../../../../styles/helperStyles/Slider.css";
import "../../../../styles/helperStyles/LoadingSpinner.css";
import "tippy.js/dist/tippy.css";

const SUPERSCRIPT_MAP = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '-': '⁻', '+': '⁺', '.': '·',
  '(': '⁽', ')': '⁾', '/': 'ᐟ',
  'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ',
  'f': 'ᶠ', 'g': 'ᵍ', 'h': 'ʰ', 'i': 'ⁱ', 'j': 'ʲ',
  'k': 'ᵏ', 'l': 'ˡ', 'm': 'ᵐ', 'n': 'ⁿ', 'o': 'ᵒ',
  'p': 'ᵖ', 'r': 'ʳ', 's': 'ˢ', 't': 'ᵗ', 'u': 'ᵘ',
  'v': 'ᵛ', 'w': 'ʷ', 'x': 'ˣ', 'y': 'ʸ', 'z': 'ᶻ',
  'A': 'ᴬ', 'B': 'ᴮ', 'D': 'ᴰ', 'E': 'ᴱ', 'G': 'ᴳ',
  'H': 'ᴴ', 'I': 'ᴵ', 'J': 'ᴶ', 'K': 'ᴷ', 'L': 'ᴸ',
  'M': 'ᴹ', 'N': 'ᴺ', 'O': 'ᴼ', 'P': 'ᴾ', 'R': 'ᴿ',
  'T': 'ᵀ', 'U': 'ᵁ', 'V': 'ⱽ', 'W': 'ᵂ'
};

const SUBSCRIPT_MAP = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉'
};

const REVERSE_SUPERSCRIPT_DIGIT = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  '⁻': '-', '⁺': '+', '·': '.',
  '⁽': '(', '⁾': ')', 'ᐟ': '/',
  'ᵃ': 'a', 'ᵇ': 'b', 'ᶜ': 'c', 'ᵈ': 'd', 'ᵉ': 'e',
  'ᶠ': 'f', 'ᵍ': 'g', 'ʰ': 'h', 'ⁱ': 'i', 'ʲ': 'j',
  'ᵏ': 'k', 'ˡ': 'l', 'ᵐ': 'm', 'ⁿ': 'n', 'ᵒ': 'o',
  'ᵖ': 'p', 'ʳ': 'r', 'ˢ': 's', 'ᵗ': 't', 'ᵘ': 'u',
  'ᵛ': 'v', 'ʷ': 'w', 'ˣ': 'x', 'ʸ': 'y', 'ᶻ': 'z',
  'ᴬ': 'A', 'ᴮ': 'B', 'ᴰ': 'D', 'ᴱ': 'E', 'ᴳ': 'G',
  'ᴴ': 'H', 'ᴵ': 'I', 'ᴶ': 'J', 'ᴷ': 'K', 'ᴸ': 'L',
  'ᴹ': 'M', 'ᴺ': 'N', 'ᴼ': 'O', 'ᴾ': 'P', 'ᴿ': 'R',
  'ᵀ': 'T', 'ᵁ': 'U', 'ⱽ': 'V', 'ᵂ': 'W'
};

const REVERSE_SUBSCRIPT_DIGIT = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
  '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9'
};

const SYMBOL_REPLACEMENTS = [
  { pattern: /sqrt\(/g, replacement: "√(", description: "Square Root" },
  { pattern: /cbrt\(/g, replacement: "∛(", description: "Cube Root" },
  { pattern: /(?<![A-Za-z])pi\b/g, replacement: "π", description: "Pi" },
  { pattern: /(?<![A-Za-z])tau\b/g, replacement: "τ", description: "Tau" },
  { pattern: /(?<![A-Za-z])alpha\b/g, replacement: "α", description: "Alpha" },
  { pattern: /(?<![A-Za-z])beta\b/g, replacement: "β", description: "Beta" },
  { pattern: /(?<![A-Za-z])gamma\b/g, replacement: "γ", description: "Gamma" },
  { pattern: /(?<![A-Za-z])delta\b/g, replacement: "δ", description: "Delta" },
  { pattern: /(?<![A-Za-z])epsilon\b/g, replacement: "ε", description: "Epsilon" },
  { pattern: /(?<![A-Za-z])theta\b/g, replacement: "θ", description: "Theta" },
  { pattern: /(?<![A-Za-z])lambda\b/g, replacement: "λ", description: "Lambda" },
  { pattern: /(?<![A-Za-z])mu\b/g, replacement: "μ", description: "Mu" },
  { pattern: /(?<![A-Za-z])sigma\b/g, replacement: "σ", description: "Sigma" },
  { pattern: /(?<![A-Za-z])phi\b/g, replacement: "φ", description: "Phi" },
  { pattern: /(?<![A-Za-z])omega\b/g, replacement: "ω", description: "Omega" },
  { pattern: /<=/g, replacement: "≤", description: "Less Than or Equal" },
  { pattern: />=/g, replacement: "≥", description: "Greater Than or Equal" },
  { pattern: /!=/g, replacement: "≠", description: "Not Equal" },
  { pattern: /\+\-/g, replacement: "±", description: "Plus-Minus" },
  { pattern: /-\+/g, replacement: "∓", description: "Minus-Plus" },
  { pattern: /\*\*/g, replacement: "^", description: "Exponentiation" },
  { pattern: /×\*/g, replacement: "^", description: "Exponentiation" },
  { pattern: /\*/g, replacement: "×", description: "Multiplication" },
  { pattern: /∞inity/g, replacement: "∞", description: "Infinity" },
  { pattern: /(?<![A-Za-z])infinity\b/g, replacement: "∞", description: "Infinity" },
  { pattern: /(?<![A-Za-z])inf\b/g, replacement: "∞", description: "Infinity" },
  { pattern: /(?<![A-Za-z])sum\(/g, replacement: "∑(", description: "Summation" },
  { pattern: /(?<![A-Za-z])prod\(/g, replacement: "∏(", description: "Product" },
  { pattern: /(?<![A-Za-z])integral\(/g, replacement: "∫(", description: "Integral" }
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

const degToRad = (deg) => deg * (Math.PI / 180);

const radToDeg = (rad) => rad * (180 / Math.PI);

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

const expandUnicodeFractions = (s) => {
  return s.replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹]+)⁄([₀₁₂₃₄₅₆₇₈₉]+)/g, (m, a, b) => {
    const na = decodeSuperscriptNumber(a);
    const nb = decodeSubscriptNumber(b);
    if (na == null || nb == null) return m;
    return na + "/" + nb;
  }).replace(/÷/g, "/");
};

const formatLogBases = (text, cursorPos) => {
  let result = text;
  let newCursorPos = cursorPos;

  const subscriptChars = new Set(Object.values(SUBSCRIPT_MAP));
  const isSubscript = (ch) => subscriptChars.has(ch);

  const logBasePattern = /log_(\d+)\s*\(/g;
  let match;
  let offset = 0;

  const tempResult = result;
  while ((match = logBasePattern.exec(tempResult)) !== null) {
    const fullMatch = match[0];
    const baseDigits = match[1];
    const matchStart = match.index + offset;
    const matchEnd = matchStart + fullMatch.length;

    if (cursorPos > matchStart + 4 && cursorPos < matchEnd - 1) {
      continue;
    }

    const subscriptBase = baseDigits.split('').map(d => SUBSCRIPT_MAP[d] || d).join('');
    const replacement = 'log' + subscriptBase + '(';
    const lenDiff = replacement.length - fullMatch.length;

    result = result.slice(0, matchStart) + replacement + result.slice(matchEnd);

    if (cursorPos > matchEnd) {
      newCursorPos += lenDiff;
    } else if (cursorPos > matchStart) {
      newCursorPos = matchStart + replacement.length;
    }

    offset += lenDiff;
  }

  const logNumPattern = /log(\d+)\s*\(/g;
  offset = 0;
  const tempResult2 = result;
  logNumPattern.lastIndex = 0;

  while ((match = logNumPattern.exec(tempResult2)) !== null) {
    const fullMatch = match[0];
    const baseDigits = match[1];
    const matchStart = match.index + offset;
    const matchEnd = matchStart + fullMatch.length;

    const cursorAtEnd = newCursorPos === matchStart + 3 + baseDigits.length;
    if (cursorAtEnd) {
      continue;
    }

    const subscriptBase = baseDigits.split('').map(d => SUBSCRIPT_MAP[d] || d).join('');
    const replacement = 'log' + subscriptBase + '(';
    const lenDiff = replacement.length - fullMatch.length;

    result = result.slice(0, matchStart) + replacement + result.slice(matchEnd);

    if (newCursorPos > matchEnd) {
      newCursorPos += lenDiff;
    } else if (newCursorPos > matchStart + 3) {
      newCursorPos = matchStart + 3 + subscriptBase.length;
    }

    offset += lenDiff;
  }

  if (newCursorPos > 0 && newCursorPos <= result.length) {
    const charBefore = result[newCursorPos - 1];
    if (!isSubscript(charBefore) && SUBSCRIPT_MAP[charBefore] !== undefined) {
      const charTwoBefore = newCursorPos >= 2 ? result[newCursorPos - 2] : '';
      const charAfter = newCursorPos < result.length ? result[newCursorPos] : '';

      let shouldConvert = false;

      if (isSubscript(charAfter)) {
        shouldConvert = true;
      }

      if (isSubscript(charTwoBefore)) {
        shouldConvert = true;
      }

      let checkPos = newCursorPos - 2;
      while (checkPos >= 0 && isSubscript(result[checkPos])) {
        checkPos--;
      }
      if (checkPos >= 2 && result.slice(checkPos - 2, checkPos + 1) === 'log') {
        shouldConvert = true;
      }

      if (shouldConvert) {
        const converted = SUBSCRIPT_MAP[charBefore];
        result = result.slice(0, newCursorPos - 1) + converted + result.slice(newCursorPos);
      }
    }
  }

  return { text: result, cursorPos: newCursorPos };
};

const formatExponentsInText = (text, cursorPos) => {
  let result = '';
  let newCursorPos = cursorPos;
  let i = 0;

  const superscriptChars = new Set(Object.values(SUPERSCRIPT_MAP));
  const allSuperscriptChars = new Set([...superscriptChars, ...Object.keys(REVERSE_SUPERSCRIPT_DIGIT)]);

  const isSuperscript = (ch) => allSuperscriptChars.has(ch);

  const canSuperscript = (str) => {
    for (const ch of str) {
      if (SUPERSCRIPT_MAP[ch] === undefined && ch !== ' ') return false;
    }
    return true;
  };

  const toSuperscriptFull = (str) => {
    return str.split('').map(c => SUPERSCRIPT_MAP[c] || c).join('');
  };

  let workingText = text;
  let workingCursor = cursorPos;

  if (workingCursor > 0 && workingCursor <= workingText.length) {
    const charBeforeCursor = workingText[workingCursor - 1];
    
    const charAfterInsert = workingCursor < workingText.length ? workingText[workingCursor] : '';
    const insertingInside = isSuperscript(charAfterInsert) && charAfterInsert !== '⁽';
    if (!isSuperscript(charBeforeCursor) && SUPERSCRIPT_MAP[charBeforeCursor] !== undefined && (insertingInside || /[0-9.]/.test(charBeforeCursor))) {
      const charTwoBeforeCursor = workingCursor >= 2 ? workingText[workingCursor - 2] : '';
      const charAfterCursor = workingCursor < workingText.length ? workingText[workingCursor] : '';
      
      let shouldConvert = false;
      
      if (isSuperscript(charAfterCursor) && charAfterCursor !== '⁽') {
        shouldConvert = true;
      }
      
      if (isSuperscript(charTwoBeforeCursor) && charTwoBeforeCursor !== '⁾') {
        shouldConvert = true;
      }
      
      if (charTwoBeforeCursor === '⁾') {
        shouldConvert = false;
      }
      
      if (shouldConvert) {
        const converted = SUPERSCRIPT_MAP[charBeforeCursor];
        workingText = workingText.slice(0, workingCursor - 1) + converted + workingText.slice(workingCursor);
      }
    }
  }

  text = workingText;
  cursorPos = workingCursor;

  while (i < text.length) {
    if (text[i] === '^' && !(i > 0 && isSuperscript(text[i - 1]))) {
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
          const cursorInside = cursorPos > expStart && cursorPos < j;
          
          if (!cursorInside) {
            const innerContent = expandUnicodeFractions(insideWithParens.slice(1, -1));
            if (canSuperscript(innerContent)) {
              const superscripted = '⁽' + toSuperscriptFull(innerContent) + '⁾';
              const originalLen = j - i;
              const replacementLen = superscripted.length;

              if (cursorPos > j) {
                newCursorPos -= originalLen - replacementLen;
              }

              result += superscripted;
              i = j;
              continue;
            }
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
        const exponentText = text.substring(expStart, expEnd);
        const shouldConvert = /[0-9]/.test(exponentText) && !/\.$/.test(exponentText.replace(/^[-+]/, "")) || cursorPos !== expEnd;

        if (shouldConvert) {
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

  const decimalAfterFraction = formattedText.substring(0, newCursorPos).match(/([⁰¹²³⁴⁵⁶⁷⁸⁹]+)⁄([₀₁₂₃₄₅₆₇₈₉]+)\.$/);
  const orphanedFraction = formattedText.substring(0, newCursorPos).match(/([⁰¹²³⁴⁵⁶⁷⁸⁹]+)⁄$/);
  if (orphanedFraction && !/^[₀₁₂₃₄₅₆₇₈₉]/.test(formattedText.substring(newCursorPos))) {
    const plain = decodeSuperscriptNumber(orphanedFraction[1]) + "/";
    const fractionStart = newCursorPos - orphanedFraction[0].length;
    formattedText = formattedText.slice(0, fractionStart) + plain + formattedText.slice(newCursorPos);
    newCursorPos = fractionStart + plain.length;
  }

  if (decimalAfterFraction) {
    const plain = decodeSuperscriptNumber(decimalAfterFraction[1]) + "÷" + decodeSubscriptNumber(decimalAfterFraction[2]) + ".";
    const fractionStart = newCursorPos - decimalAfterFraction[0].length;
    formattedText = formattedText.slice(0, fractionStart) + plain + formattedText.slice(newCursorPos);
    newCursorPos = fractionStart + plain.length;
  }

  const beforeCursor0 = formattedText.substring(0, newCursorPos);
  const afterCursor0 = formattedText.substring(newCursorPos);

  const afterChar = afterCursor0.length > 0 ? afterCursor0[0] : '';

  const fractionLead = "(^|[^A-Za-z0-9_.·⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉])";
  const fractionBody = "(\\d*\\.\\d+|\\d+(?:\\.\\d+)?)\\s*([\\/÷])\\s*(\\d*\\.\\d+|\\d+(?:\\.\\d+)?)";
  const hasNumberAfter = afterChar !== '' && /[0-9.]/.test(afterChar);
  const needsFormatting = (match) => /^[0-9]+$/.test(match[2]) && /^[0-9]+$/.test(match[4]) || match[3] !== "÷" || /\s/.test(match[0]);
  let fracMatch = Array.from(beforeCursor0.matchAll(new RegExp(fractionLead + fractionBody + "(?=[^0-9.])", "g"))).find(needsFormatting) || null;

  if (!fracMatch && !hasNumberAfter) {
    const endMatch = beforeCursor0.match(new RegExp(fractionLead + fractionBody + "$"));
    if (endMatch && needsFormatting(endMatch)) fracMatch = endMatch;
  }

  if (fracMatch) {
    const full = fracMatch[0];
    const lead = fracMatch[1] || "";
    const numStr = fracMatch[2];
    const denStr = fracMatch[4];
    const isWhole = /^[0-9]+$/.test(numStr) && /^[0-9]+$/.test(denStr);
    const replacement = isWhole ? makeUnicodeFraction(numStr, denStr) : `${numStr}÷${denStr}`;
    if (replacement) {
      const matchStart = fracMatch.index;
      const matchEnd = matchStart + full.length;
      const prefix = beforeCursor0.slice(0, matchStart);
      const suffix = beforeCursor0.slice(matchEnd);
      const newBefore = prefix + lead + replacement + suffix;
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
  const logFormatted = formatLogBases(expFormatted.text, expFormatted.cursorPos);

  return { text: logFormatted.text, cursorPos: logFormatted.cursorPos };
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

  evalExpression = evalExpression.replace(/log([₀₁₂₃₄₅₆₇₈₉]+)\s*\(([^)]+)\)/g, (m, subscriptBase, arg) => {
    const base = decodeSubscriptNumber(subscriptBase);
    if (base == null) return m;
    return "logn(" + arg + ", " + base + ")";
  });

  const superscriptPattern = /[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺·⁽⁾ᐟᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖʳˢᵗᵘᵛʷˣʸᶻᴬᴮᴰᴱᴳᴴᴵᴶᴷᴸᴹᴺᴼᴾᴿᵀᵁⱽᵂ]+/g;
  evalExpression = evalExpression.replace(superscriptPattern, (match, offset, whole) => {
    const nextChar = whole && offset + match.length < whole.length ? whole[offset + match.length] : "";
    if (nextChar === "⁄") return match;
    let converted = '^(';
    for (const char of match) {
      converted += REVERSE_SUPERSCRIPT_DIGIT[char] || char;
    }
    converted += ')';
    return converted;
  });

  for (const [symbol, func] of Object.entries(SYMBOL_TO_FUNCTION)) {
    if (!/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺·⁽⁾ᐟᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖʳˢᵗᵘᵛʷˣʸᶻᴬᴮᴰᴱᴳᴴᴵᴶᴷᴸᴹᴺᴼᴾᴿᵀᵁⱽᵂ]/.test(symbol)) {
      evalExpression = evalExpression.replace(new RegExp(escapeRegExp(symbol), "g"), func);
    }
  }

  return evalExpression;
};

const formatResult = (value, decimalPlaces = 6) => {
  if (!isFinite(value)) return "NaN";
  if (Math.abs(value) < 1e-100) return "0";
  if (Math.abs(value) < 1e-6 || Math.abs(value) > 1e12) {
    return value.toExponential(decimalPlaces);
  }
  return value.toFixed(decimalPlaces).replace(/\.?0+$/, "");
};

const createMathFunctions = (currentAngleMode = 'rad') => {
  const toRadians = (v) => currentAngleMode === 'deg' ? degToRad(v) : v;
  const fromRadians = (v) => currentAngleMode === 'deg' ? radToDeg(v) : v;

  const SAFE_MATH = {
    sin: (v) => {
      const input = toRadians(v);
      return Math.sin(input);
    },
    cos: (v) => {
      const input = toRadians(v);
      return Math.cos(input);
    },
    tan: (v) => {
      const input = toRadians(v);
      return Math.tan(input);
    },
    sec: (v) => {
      const input = toRadians(v);
      const cos_val = Math.cos(input);
      return Math.abs(cos_val) < 1e-15 ? NaN : 1 / cos_val;
    },
    csc: (v) => {
      const input = toRadians(v);
      const sin_val = Math.sin(input);
      return Math.abs(sin_val) < 1e-15 ? NaN : 1 / sin_val;
    },
    cot: (v) => {
      const input = toRadians(v);
      const tan_val = Math.tan(input);
      return Math.abs(tan_val) < 1e-15 ? NaN : 1 / tan_val;
    },
    asin: (v) => {
      if (v < -1 || v > 1) return NaN;
      const result = Math.asin(v);
      return fromRadians(result);
    },
    acos: (v) => {
      if (v < -1 || v > 1) return NaN;
      const result = Math.acos(v);
      return fromRadians(result);
    },
    atan: (v) => {
      const result = Math.atan(v);
      return fromRadians(result);
    },
    asec: (v) => {
      if (Math.abs(v) < 1) return NaN;
      const inv_v = 1 / v;
      const result = Math.acos(inv_v);
      return fromRadians(result);
    },
    acsc: (v) => {
      if (Math.abs(v) < 1) return NaN;
      const inv_v = 1 / v;
      const result = Math.asin(inv_v);
      return fromRadians(result);
    },
    acot: (v) => {
      const result = (v === 0) ? Math.PI / 2 : Math.atan(1 / v);
      return fromRadians(result);
    },

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

const parseExpression = (expression, variables, currentAngleMode = 'rad') => {
  const { SAFE_MATH, CONSTANTS } = createMathFunctions(currentAngleMode);
  
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
    result = result.replace(/(\d)(?![eE][-+]?\d)([a-zA-Z_])/g, "$1*$2");
    result = result.replace(/(\d)(\()/g, "$1*$2");
    result = result.replace(/(\))(\d)/g, "$1*$2");
    result = result.replace(/(\))(\()/g, "$1*$2");
    result = result.replace(/(\))([a-zA-Z_])/g, "$1*$2");
    result = result.replace(/(?<![\d.])([a-zA-Z_])(\d)/g, "$1*$2");
    result = result.replace(/([a-zA-Z_][a-zA-Z0-9_]*)(\()/g, (match, ident, paren) => {
      if (KNOWN_FUNCTIONS.includes(ident)) {
        return match;
      }
      return ident + "*" + paren;
    });
    return result;
  };

  try {
    let processedExpr = addImplicitMultiplication(cleanExpr);
    processedExpr = substituteVariables(processedExpr);
    processedExpr = substituteConstants(processedExpr);
    processedExpr = substituteFunctions(processedExpr);
    processedExpr = processedExpr.replace(/(^|[(,+\-*/])\s*-/g, "$1(-1)*");
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

const evaluateFunction = (formula, x, vars = {}, currentAngleMode = 'rad') => {
  const func = parseExpression(formula.text, vars, currentAngleMode);
  return func ? func(x) : NaN;
};

const Plotting = () => {
  const navigate = useNavigate();
  const { token, loading } = useAuth();

  const canvasRef = useRef(null);
  const suppressFormattingRef = useRef(false);
  const inputRefs = useRef({});
  const cursorPositionRef = useRef(0);

  const [formulas, setFormulas] = useState([]);
  const [circles, setCircles] = useState([]);
  const [triangles, setTriangles] = useState([]);
  const [rectangles, setRectangles] = useState([]);
  const [polygons, setPolygons] = useState([]);
  const [variables, setVariables] = useState([]);
  const [intercepts, setIntercepts] = useState([]);
  const [isKeyboardView, setIsKeyboardView] = useState(false);
  const [functionMode, setFunctionMode] = useState("fx");
  const [angleMode, setAngleMode] = useState('rad');
  const [colorPickerOpen, setColorPickerOpen] = useState({});
  const [circleColorPickerOpen, setCircleColorPickerOpen] = useState({});
  const [triangleColorPickerOpen, setTriangleColorPickerOpen] = useState({});
  const [rectangleColorPickerOpen, setRectangleColorPickerOpen] = useState({});
  const [polygonColorPickerOpen, setPolygonColorPickerOpen] = useState({});
  const [circleShadingMenuOpen, setCircleShadingMenuOpen] = useState({});
  const [triangleShadingMenuOpen, setTriangleShadingMenuOpen] = useState({});
  const [rectangleShadingMenuOpen, setRectangleShadingMenuOpen] = useState({});
  const [polygonShadingMenuOpen, setPolygonShadingMenuOpen] = useState({});
  const [shadingMenuOpen, setShadingMenuOpen] = useState({});
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);
  const [mathMinX, setMathMinX] = useState(-10);
  const [mathMaxX, setMathMaxX] = useState(10);
  const [mathMinY, setMathMinY] = useState(-10);
  const [mathMaxY, setMathMaxY] = useState(10);

  const [draggingCircle, setDraggingCircle] = useState(null);
  const [draggingRadiusHandle, setDraggingRadiusHandle] = useState(null);
  const [draggingTriangle, setDraggingTriangle] = useState(null);
  const [draggingTriangleVertex, setDraggingTriangleVertex] = useState(null);
  const [draggingRectangle, setDraggingRectangle] = useState(null);
  const [draggingRectangleHandle, setDraggingRectangleHandle] = useState(null);
  const [draggingPolygon, setDraggingPolygon] = useState(null);
  const [draggingPolygonVertex, setDraggingPolygonVertex] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

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
    const newCursorPos = cursorPos !== undefined ? cursorPos : newText.length;
    
    const formatted = applySymbolFormatting(newText, newCursorPos);
    
    setFormulas(prev => prev.map(f => f.id === id ? { ...f, text: formatted.text } : f));
    setIntercepts([]);
    
    setTimeout(() => {
      if (inputRefs.current[id]) {
        inputRefs.current[id].setSelectionRange(formatted.cursorPos, formatted.cursorPos);
      }
    }, 0);
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

  const addCircle = () => {
    const newCircle = {
      id: Date.now(),
      centerX: 0,
      centerY: 0,
      radius: 2,
      color: randomColor(),
      isHidden: false,
      shading: {
        filled: false
      }
    };
    setCircles([...circles, newCircle]);
    setShapeMenuOpen(false);
  };

  const updateCircle = (id, updates) => {
    setCircles(circles.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const updateCircleColor = (id, newColor) => {
    setCircles(circles.map(c => c.id === id ? { ...c, color: newColor } : c));
  };

  const removeCircle = (id) => {
    setCircles(circles.filter(c => c.id !== id));
    const newColorPickerOpen = { ...circleColorPickerOpen };
    delete newColorPickerOpen[id];
    setCircleColorPickerOpen(newColorPickerOpen);
    const newShadingMenuOpen = { ...circleShadingMenuOpen };
    delete newShadingMenuOpen[id];
    setCircleShadingMenuOpen(newShadingMenuOpen);
  };

  const toggleCircleVisibility = (id) => {
    setCircles(circles.map(c => c.id === id ? { ...c, isHidden: !c.isHidden } : c));
  };

  const toggleCircleColorPicker = (id) => {
    setCircleColorPickerOpen(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const closeCircleColorPicker = (id) => {
    setCircleColorPickerOpen(prev => ({
      ...prev,
      [id]: false
    }));
  };

  const toggleCircleShadingMenu = (id) => {
    setCircleShadingMenuOpen(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const closeCircleShadingMenu = (id) => {
    setCircleShadingMenuOpen(prev => ({
      ...prev,
      [id]: false
    }));
  };

  const updateCircleShading = (id, shadingType, value) => {
    setCircles(circles.map(c => 
      c.id === id 
        ? { 
            ...c, 
            shading: {
              ...c.shading,
              [shadingType]: value
            }
          } 
        : c
    ));
  };

  const addTriangle = () => {
    const newTriangle = {
      id: Date.now(),
      x1: -2, y1: -2,
      x2: 2, y2: -2,
      x3: 0, y3: 2,
      color: randomColor(),
      isHidden: false,
      shading: {
        filled: false
      }
    };
    setTriangles([...triangles, newTriangle]);
    setShapeMenuOpen(false);
  };

  const updateTriangle = (id, updates) => {
    setTriangles(triangles.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const updateTriangleColor = (id, newColor) => {
    setTriangles(triangles.map(t => t.id === id ? { ...t, color: newColor } : t));
  };

  const removeTriangle = (id) => {
    setTriangles(triangles.filter(t => t.id !== id));
    const newColorPickerOpen = { ...triangleColorPickerOpen };
    delete newColorPickerOpen[id];
    setTriangleColorPickerOpen(newColorPickerOpen);
    const newShadingMenuOpen = { ...triangleShadingMenuOpen };
    delete newShadingMenuOpen[id];
    setTriangleShadingMenuOpen(newShadingMenuOpen);
  };

  const toggleTriangleVisibility = (id) => {
    setTriangles(triangles.map(t => t.id === id ? { ...t, isHidden: !t.isHidden } : t));
  };

  const toggleTriangleColorPicker = (id) => {
    setTriangleColorPickerOpen(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const closeTriangleColorPicker = (id) => {
    setTriangleColorPickerOpen(prev => ({ ...prev, [id]: false }));
  };

  const toggleTriangleShadingMenu = (id) => {
    setTriangleShadingMenuOpen(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const closeTriangleShadingMenu = (id) => {
    setTriangleShadingMenuOpen(prev => ({ ...prev, [id]: false }));
  };

  const updateTriangleShading = (id, shadingType, value) => {
    setTriangles(triangles.map(t => 
      t.id === id ? { ...t, shading: { ...t.shading, [shadingType]: value } } : t
    ));
  };

  const addRectangle = () => {
    const newRectangle = {
      id: Date.now(),
      x: -2,
      y: -1,
      width: 4,
      height: 2,
      color: randomColor(),
      isHidden: false,
      shading: {
        filled: false
      }
    };
    setRectangles([...rectangles, newRectangle]);
    setShapeMenuOpen(false);
  };

  const updateRectangle = (id, updates) => {
    setRectangles(rectangles.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const updateRectangleColor = (id, newColor) => {
    setRectangles(rectangles.map(r => r.id === id ? { ...r, color: newColor } : r));
  };

  const removeRectangle = (id) => {
    setRectangles(rectangles.filter(r => r.id !== id));
    const newColorPickerOpen = { ...rectangleColorPickerOpen };
    delete newColorPickerOpen[id];
    setRectangleColorPickerOpen(newColorPickerOpen);
    const newShadingMenuOpen = { ...rectangleShadingMenuOpen };
    delete newShadingMenuOpen[id];
    setRectangleShadingMenuOpen(newShadingMenuOpen);
  };

  const toggleRectangleVisibility = (id) => {
    setRectangles(rectangles.map(r => r.id === id ? { ...r, isHidden: !r.isHidden } : r));
  };

  const toggleRectangleColorPicker = (id) => {
    setRectangleColorPickerOpen(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const closeRectangleColorPicker = (id) => {
    setRectangleColorPickerOpen(prev => ({ ...prev, [id]: false }));
  };

  const toggleRectangleShadingMenu = (id) => {
    setRectangleShadingMenuOpen(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const closeRectangleShadingMenu = (id) => {
    setRectangleShadingMenuOpen(prev => ({ ...prev, [id]: false }));
  };

  const updateRectangleShading = (id, shadingType, value) => {
    setRectangles(rectangles.map(r => 
      r.id === id ? { ...r, shading: { ...r.shading, [shadingType]: value } } : r
    ));
  };

  const addPolygon = () => {
    const newPolygon = {
      id: Date.now(),
      vertices: [
        { x: 0, y: 3 },
        { x: 2.5, y: 1 },
        { x: 1.5, y: -2 },
        { x: -1.5, y: -2 },
        { x: -2.5, y: 1 }
      ],
      color: randomColor(),
      isHidden: false,
      shading: {
        filled: false
      }
    };
    setPolygons([...polygons, newPolygon]);
    setShapeMenuOpen(false);
  };

  const updatePolygon = (id, updates) => {
    setPolygons(polygons.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const updatePolygonVertex = (id, vertexIndex, x, y) => {
    setPolygons(polygons.map(p => {
      if (p.id === id) {
        const newVertices = [...p.vertices];
        newVertices[vertexIndex] = { x, y };
        return { ...p, vertices: newVertices };
      }
      return p;
    }));
  };

  const addPolygonVertex = (id) => {
    setPolygons(polygons.map(p => {
      if (p.id === id) {
        const lastVertex = p.vertices[p.vertices.length - 1];
        const newVertex = { x: lastVertex.x + 1, y: lastVertex.y };
        return { ...p, vertices: [...p.vertices, newVertex] };
      }
      return p;
    }));
  };

  const removePolygonVertex = (id, vertexIndex) => {
    setPolygons(polygons.map(p => {
      if (p.id === id && p.vertices.length > 3) {
        const newVertices = p.vertices.filter((_, i) => i !== vertexIndex);
        return { ...p, vertices: newVertices };
      }
      return p;
    }));
  };

  const updatePolygonColor = (id, newColor) => {
    setPolygons(polygons.map(p => p.id === id ? { ...p, color: newColor } : p));
  };

  const removePolygon = (id) => {
    setPolygons(polygons.filter(p => p.id !== id));
    const newColorPickerOpen = { ...polygonColorPickerOpen };
    delete newColorPickerOpen[id];
    setPolygonColorPickerOpen(newColorPickerOpen);
    const newShadingMenuOpen = { ...polygonShadingMenuOpen };
    delete newShadingMenuOpen[id];
    setPolygonShadingMenuOpen(newShadingMenuOpen);
  };

  const togglePolygonVisibility = (id) => {
    setPolygons(polygons.map(p => p.id === id ? { ...p, isHidden: !p.isHidden } : p));
  };

  const togglePolygonColorPicker = (id) => {
    setPolygonColorPickerOpen(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const closePolygonColorPicker = (id) => {
    setPolygonColorPickerOpen(prev => ({ ...prev, [id]: false }));
  };

  const togglePolygonShadingMenu = (id) => {
    setPolygonShadingMenuOpen(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const closePolygonShadingMenu = (id) => {
    setPolygonShadingMenuOpen(prev => ({ ...prev, [id]: false }));
  };

  const updatePolygonShading = (id, shadingType, value) => {
    setPolygons(polygons.map(p => 
      p.id === id ? { ...p, shading: { ...p.shading, [shadingType]: value } } : p
    ));
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
      
      const func = parseExpression(formula.text, vars, angleMode);
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

  const screenToMath = useCallback((screenX, screenY) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    const mathX = mathMinX + (screenX / width) * (mathMaxX - mathMinX);
    const mathY = mathMaxY - (screenY / height) * (mathMaxY - mathMinY);
    
    return { x: mathX, y: mathY };
  }, [mathMinX, mathMaxX, mathMinY, mathMaxY]);

  const mathToScreen = useCallback((mathX, mathY) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    const screenX = ((mathX - mathMinX) / (mathMaxX - mathMinX)) * width;
    const screenY = height - ((mathY - mathMinY) / (mathMaxY - mathMinY)) * height;
    
    return { x: screenX, y: screenY };
  }, [mathMinX, mathMaxX, mathMinY, mathMaxY]);

  const getShapeAtPoint = useCallback((screenX, screenY) => {
    for (let i = polygons.length - 1; i >= 0; i--) {
      const polygon = polygons[i];
      if (polygon.isHidden) continue;
      
      for (let vi = 0; vi < polygon.vertices.length; vi++) {
        const v = polygon.vertices[vi];
        const vScreen = mathToScreen(v.x, v.y);
        const dist = Math.sqrt(Math.pow(screenX - vScreen.x, 2) + Math.pow(screenY - vScreen.y, 2));
        if (dist <= 10) {
          return { type: 'polygon', shape: polygon, subType: 'vertex', vertexIndex: vi };
        }
      }
      
      let centroidX = 0, centroidY = 0;
      for (const v of polygon.vertices) {
        centroidX += v.x;
        centroidY += v.y;
      }
      centroidX /= polygon.vertices.length;
      centroidY /= polygon.vertices.length;
      const centroidScreen = mathToScreen(centroidX, centroidY);
      const centroidDist = Math.sqrt(Math.pow(screenX - centroidScreen.x, 2) + Math.pow(screenY - centroidScreen.y, 2));
      if (centroidDist <= 10) {
        return { type: 'polygon', shape: polygon, subType: 'center' };
      }
    }

    for (let i = rectangles.length - 1; i >= 0; i--) {
      const rect = rectangles[i];
      if (rect.isHidden) continue;
      
      const handleScreen = mathToScreen(rect.x + rect.width, rect.y + rect.height);
      const handleDist = Math.sqrt(Math.pow(screenX - handleScreen.x, 2) + Math.pow(screenY - handleScreen.y, 2));
      if (handleDist <= 10) {
        return { type: 'rectangle', shape: rect, subType: 'handle' };
      }
      
      const centerScreen = mathToScreen(rect.x + rect.width / 2, rect.y + rect.height / 2);
      const centerDist = Math.sqrt(Math.pow(screenX - centerScreen.x, 2) + Math.pow(screenY - centerScreen.y, 2));
      if (centerDist <= 10) {
        return { type: 'rectangle', shape: rect, subType: 'center' };
      }
    }

    for (let i = triangles.length - 1; i >= 0; i--) {
      const triangle = triangles[i];
      if (triangle.isHidden) continue;
      
      const vertices = [
        { x: triangle.x1, y: triangle.y1 },
        { x: triangle.x2, y: triangle.y2 },
        { x: triangle.x3, y: triangle.y3 }
      ];
      
      for (let vi = 0; vi < 3; vi++) {
        const vScreen = mathToScreen(vertices[vi].x, vertices[vi].y);
        const dist = Math.sqrt(Math.pow(screenX - vScreen.x, 2) + Math.pow(screenY - vScreen.y, 2));
        if (dist <= 10) {
          return { type: 'triangle', shape: triangle, subType: 'vertex', vertexIndex: vi };
        }
      }
      
      const centroidX = (triangle.x1 + triangle.x2 + triangle.x3) / 3;
      const centroidY = (triangle.y1 + triangle.y2 + triangle.y3) / 3;
      const centroidScreen = mathToScreen(centroidX, centroidY);
      const centroidDist = Math.sqrt(Math.pow(screenX - centroidScreen.x, 2) + Math.pow(screenY - centroidScreen.y, 2));
      if (centroidDist <= 10) {
        return { type: 'triangle', shape: triangle, subType: 'center' };
      }
    }

    for (let i = circles.length - 1; i >= 0; i--) {
      const circle = circles[i];
      if (circle.isHidden) continue;
      
      const centerScreen = mathToScreen(circle.centerX, circle.centerY);
      const radiusHandleScreen = mathToScreen(circle.centerX + circle.radius, circle.centerY);
      const radiusPixels = radiusHandleScreen.x - centerScreen.x;
      
      const handleX = centerScreen.x + radiusPixels;
      const handleY = centerScreen.y;
      const handleDist = Math.sqrt(Math.pow(screenX - handleX, 2) + Math.pow(screenY - handleY, 2));
      
      if (handleDist <= 10) {
        return { type: 'circle', shape: circle, subType: 'radius' };
      }
      
      const centerDist = Math.sqrt(Math.pow(screenX - centerScreen.x, 2) + Math.pow(screenY - centerScreen.y, 2));
      
      if (centerDist <= 10) {
        return { type: 'circle', shape: circle, subType: 'center' };
      }
      
      if (Math.abs(centerDist - radiusPixels) <= 5) {
        return { type: 'circle', shape: circle, subType: 'center' };
      }
    }

    return null;
  }, [circles, triangles, rectangles, polygons, mathToScreen]);

  const handleCanvasMouseDown = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    const hit = getShapeAtPoint(screenX, screenY);
    
    if (hit) {
      setIsDragging(true);
      if (hit.type === 'circle') {
        if (hit.subType === 'center') {
          setDraggingCircle(hit.shape.id);
        } else if (hit.subType === 'radius') {
          setDraggingRadiusHandle(hit.shape.id);
        }
      } else if (hit.type === 'triangle') {
        if (hit.subType === 'center') {
          setDraggingTriangle(hit.shape.id);
        } else if (hit.subType === 'vertex') {
          setDraggingTriangleVertex({ id: hit.shape.id, vertexIndex: hit.vertexIndex });
        }
      } else if (hit.type === 'rectangle') {
        if (hit.subType === 'center') {
          setDraggingRectangle(hit.shape.id);
        } else if (hit.subType === 'handle') {
          setDraggingRectangleHandle(hit.shape.id);
        }
      } else if (hit.type === 'polygon') {
        if (hit.subType === 'center') {
          setDraggingPolygon(hit.shape.id);
        } else if (hit.subType === 'vertex') {
          setDraggingPolygonVertex({ id: hit.shape.id, vertexIndex: hit.vertexIndex });
        }
      }
      e.preventDefault();
    }
  }, [getShapeAtPoint]);

  const handleCanvasMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const mathPos = screenToMath(screenX, screenY);

    if (draggingCircle) {
      updateCircle(draggingCircle, { centerX: mathPos.x, centerY: mathPos.y });
    } else if (draggingRadiusHandle) {
      const circle = circles.find(c => c.id === draggingRadiusHandle);
      if (circle) {
        const newRadius = Math.sqrt(
          Math.pow(mathPos.x - circle.centerX, 2) + 
          Math.pow(mathPos.y - circle.centerY, 2)
        );
        updateCircle(draggingRadiusHandle, { radius: Math.max(0.1, newRadius) });
      }
    } else if (draggingTriangle) {
      const triangle = triangles.find(t => t.id === draggingTriangle);
      if (triangle) {
        const centroidX = (triangle.x1 + triangle.x2 + triangle.x3) / 3;
        const centroidY = (triangle.y1 + triangle.y2 + triangle.y3) / 3;
        const dx = mathPos.x - centroidX;
        const dy = mathPos.y - centroidY;
        updateTriangle(draggingTriangle, {
          x1: triangle.x1 + dx, y1: triangle.y1 + dy,
          x2: triangle.x2 + dx, y2: triangle.y2 + dy,
          x3: triangle.x3 + dx, y3: triangle.y3 + dy
        });
      }
    } else if (draggingTriangleVertex) {
      const keys = ['x1', 'y1', 'x2', 'y2', 'x3', 'y3'];
      const xKey = keys[draggingTriangleVertex.vertexIndex * 2];
      const yKey = keys[draggingTriangleVertex.vertexIndex * 2 + 1];
      updateTriangle(draggingTriangleVertex.id, { [xKey]: mathPos.x, [yKey]: mathPos.y });
    } else if (draggingRectangle) {
      const rectangle = rectangles.find(r => r.id === draggingRectangle);
      if (rectangle) {
        const centerX = rectangle.x + rectangle.width / 2;
        const centerY = rectangle.y + rectangle.height / 2;
        const dx = mathPos.x - centerX;
        const dy = mathPos.y - centerY;
        updateRectangle(draggingRectangle, { x: rectangle.x + dx, y: rectangle.y + dy });
      }
    } else if (draggingRectangleHandle) {
      const rectangle = rectangles.find(r => r.id === draggingRectangleHandle);
      if (rectangle) {
        const newWidth = Math.max(0.1, mathPos.x - rectangle.x);
        const newHeight = Math.max(0.1, mathPos.y - rectangle.y);
        updateRectangle(draggingRectangleHandle, { width: newWidth, height: newHeight });
      }
    } else if (draggingPolygon) {
      const polygon = polygons.find(p => p.id === draggingPolygon);
      if (polygon) {
        let centroidX = 0, centroidY = 0;
        for (const v of polygon.vertices) {
          centroidX += v.x;
          centroidY += v.y;
        }
        centroidX /= polygon.vertices.length;
        centroidY /= polygon.vertices.length;
        const dx = mathPos.x - centroidX;
        const dy = mathPos.y - centroidY;
        const newVertices = polygon.vertices.map(v => ({ x: v.x + dx, y: v.y + dy }));
        updatePolygon(draggingPolygon, { vertices: newVertices });
      }
    } else if (draggingPolygonVertex) {
      updatePolygonVertex(draggingPolygonVertex.id, draggingPolygonVertex.vertexIndex, mathPos.x, mathPos.y);
    } else {
      const hit = getShapeAtPoint(screenX, screenY);
      if (hit) {
        if (hit.subType === 'radius' || hit.subType === 'handle') {
          canvas.style.cursor = 'ew-resize';
        } else if (hit.subType === 'vertex') {
          canvas.style.cursor = 'move';
        } else {
          canvas.style.cursor = 'move';
        }
      } else {
        canvas.style.cursor = 'crosshair';
      }
    }
  }, [draggingCircle, draggingRadiusHandle, draggingTriangle, draggingTriangleVertex, 
      draggingRectangle, draggingRectangleHandle, draggingPolygon, draggingPolygonVertex,
      circles, triangles, rectangles, polygons, screenToMath, getShapeAtPoint, 
      updateCircle, updateTriangle, updateRectangle, updatePolygon, updatePolygonVertex]);

  const handleCanvasMouseUp = useCallback(() => {
    setDraggingCircle(null);
    setDraggingRadiusHandle(null);
    setDraggingTriangle(null);
    setDraggingTriangleVertex(null);
    setDraggingRectangle(null);
    setDraggingRectangleHandle(null);
    setDraggingPolygon(null);
    setDraggingPolygonVertex(null);
    setIsDragging(false);
  }, []);

  const handleCanvasMouseLeave = useCallback(() => {
    if (isDragging) {
      setDraggingCircle(null);
      setDraggingRadiusHandle(null);
      setDraggingTriangle(null);
      setDraggingTriangleVertex(null);
      setDraggingRectangle(null);
      setDraggingRectangleHandle(null);
      setDraggingPolygon(null);
      setDraggingPolygonVertex(null);
      setIsDragging(false);
    }
  }, [isDragging]);

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
      
      const func = parseExpression(formula.text, vars, angleMode);
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

    circles.forEach(circle => {
      if (circle.isHidden) return;
      
      const centerScreen = transform(circle.centerX, circle.centerY);
      const edgePoint = transform(circle.centerX + circle.radius, circle.centerY);
      const radiusPixels = edgePoint.x - centerScreen.x;
      
      if (circle.shading?.filled) {
        ctx.fillStyle = circle.color + '26';
        ctx.beginPath();
        ctx.arc(centerScreen.x, centerScreen.y, Math.abs(radiusPixels), 0, 2 * Math.PI);
        ctx.fill();
      }
      
      ctx.strokeStyle = circle.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(centerScreen.x, centerScreen.y, Math.abs(radiusPixels), 0, 2 * Math.PI);
      ctx.stroke();
      
      ctx.fillStyle = circle.color;
      ctx.beginPath();
      ctx.arc(centerScreen.x, centerScreen.y, 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
      
      const handleX = centerScreen.x + radiusPixels;
      const handleY = centerScreen.y;
      
      ctx.fillStyle = circle.color;
      ctx.beginPath();
      ctx.arc(handleX, handleY, 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
      
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = circle.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(centerScreen.x, centerScreen.y);
      ctx.lineTo(handleX, handleY);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    triangles.forEach(triangle => {
      if (triangle.isHidden) return;
      
      const p1 = transform(triangle.x1, triangle.y1);
      const p2 = transform(triangle.x2, triangle.y2);
      const p3 = transform(triangle.x3, triangle.y3);
      
      if (triangle.shading?.filled) {
        ctx.fillStyle = triangle.color + '26';
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.closePath();
        ctx.fill();
      }
      
      ctx.strokeStyle = triangle.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.closePath();
      ctx.stroke();
      
      [p1, p2, p3].forEach(p => {
        ctx.fillStyle = triangle.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
      });
      
      const centroidX = (triangle.x1 + triangle.x2 + triangle.x3) / 3;
      const centroidY = (triangle.y1 + triangle.y2 + triangle.y3) / 3;
      const centroid = transform(centroidX, centroidY);
      ctx.fillStyle = triangle.color;
      ctx.beginPath();
      ctx.arc(centroid.x, centroid.y, 4, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    rectangles.forEach(rectangle => {
      if (rectangle.isHidden) return;
      
      const topLeft = transform(rectangle.x, rectangle.y + rectangle.height);
      const bottomRight = transform(rectangle.x + rectangle.width, rectangle.y);
      const rectWidth = bottomRight.x - topLeft.x;
      const rectHeight = bottomRight.y - topLeft.y;
      
      if (rectangle.shading?.filled) {
        ctx.fillStyle = rectangle.color + '26';
        ctx.fillRect(topLeft.x, topLeft.y, rectWidth, rectHeight);
      }
      
      ctx.strokeStyle = rectangle.color;
      ctx.lineWidth = 3;
      ctx.strokeRect(topLeft.x, topLeft.y, rectWidth, rectHeight);
      
      const centerScreen = transform(rectangle.x + rectangle.width / 2, rectangle.y + rectangle.height / 2);
      ctx.fillStyle = rectangle.color;
      ctx.beginPath();
      ctx.arc(centerScreen.x, centerScreen.y, 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
      
      const handleScreen = transform(rectangle.x + rectangle.width, rectangle.y + rectangle.height);
      ctx.fillStyle = rectangle.color;
      ctx.beginPath();
      ctx.arc(handleScreen.x, handleScreen.y, 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    polygons.forEach(polygon => {
      if (polygon.isHidden) return;
      
      const screenVertices = polygon.vertices.map(v => transform(v.x, v.y));
      
      if (polygon.shading?.filled) {
        ctx.fillStyle = polygon.color + '26';
        ctx.beginPath();
        ctx.moveTo(screenVertices[0].x, screenVertices[0].y);
        for (let i = 1; i < screenVertices.length; i++) {
          ctx.lineTo(screenVertices[i].x, screenVertices[i].y);
        }
        ctx.closePath();
        ctx.fill();
      }
      
      ctx.strokeStyle = polygon.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(screenVertices[0].x, screenVertices[0].y);
      for (let i = 1; i < screenVertices.length; i++) {
        ctx.lineTo(screenVertices[i].x, screenVertices[i].y);
      }
      ctx.closePath();
      ctx.stroke();
      
      screenVertices.forEach(p => {
        ctx.fillStyle = polygon.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
      });
      
      let centroidX = 0, centroidY = 0;
      for (const v of polygon.vertices) {
        centroidX += v.x;
        centroidY += v.y;
      }
      centroidX /= polygon.vertices.length;
      centroidY /= polygon.vertices.length;
      const centroid = transform(centroidX, centroidY);
      ctx.fillStyle = polygon.color;
      ctx.beginPath();
      ctx.arc(centroid.x, centroid.y, 4, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
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
  }, [formulas, circles, triangles, rectangles, polygons, variables, intercepts, mathMinX, mathMaxX, mathMinY, mathMaxY, angleMode]);

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
    if (!loading && !token) navigate("/login");
  }, [token, loading, navigate]);

  useEffect(() => {
    drawGraph();
  }, [drawGraph]);

  useEffect(() => {
    const handleResize = () => drawGraph();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [drawGraph]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.addEventListener('mousedown', handleCanvasMouseDown);
    canvas.addEventListener('mousemove', handleCanvasMouseMove);
    canvas.addEventListener('mouseup', handleCanvasMouseUp);
    canvas.addEventListener('mouseleave', handleCanvasMouseLeave);
    
    return () => {
      canvas.removeEventListener('mousedown', handleCanvasMouseDown);
      canvas.removeEventListener('mousemove', handleCanvasMouseMove);
      canvas.removeEventListener('mouseup', handleCanvasMouseUp);
      canvas.removeEventListener('mouseleave', handleCanvasMouseLeave);
    };
  }, [handleCanvasMouseDown, handleCanvasMouseMove, handleCanvasMouseUp, handleCanvasMouseLeave]);

  return (
    <div className="toolkitPlotApp" tabIndex={0}>
      <Nav activePage="plotting" />

      {loading ? (
        <div className="toolkitPlotCellHeaderContainer" style={{ justifyContent: "center" }}>
          <div className="loading-wrapper">
            <div className="loading-circle" />
            <label className="loading-title">
              Loading
            </label>
          </div>
        </div>
      ) : (
        <>
          <div className="toolkitPlotToolBar">
            <div className="toolkitPlotTitle">
              <FontAwesomeIcon icon={faLineChart}/>
              <span>Plotting</span>
            </div>

            <div className="toolkitPlotStatusGroup">
              <span className="toolkitPlotStatusItem">
                <span>{functionMode === "derv" ? "Derivative" : functionMode === "integ" ? "Integral" : "Function"}</span>
              </span>
              <span className="toolkitPlotStatusItem">
                <span>{angleMode === "deg" ? "Degrees" : "Radians"}</span>
              </span>
              <span className="toolkitPlotStatusItem">
                <span>{formulas.length} {formulas.length === 1 ? "Formula" : "Formulas"}</span>
              </span>
              <span className="toolkitPlotStatusItem">
                <span>{circles.length + triangles.length + rectangles.length + polygons.length} {circles.length + triangles.length + rectangles.length + polygons.length === 1 ? "Shape" : "Shapes"}</span>
              </span>
              <span className="toolkitPlotStatusItem">
                <span>{variables.length} {variables.length === 1 ? "Variable" : "Variables"}</span>
              </span>
            </div>
          </div>

          <div className="toolkitPlotContainer">
            <div className="toolkitPlotLeftPanel">
              <div className="toolkitPlotHeader">
                <div className="toolkitPlotHeaderRow">
                  <button 
                    className="toolkitPlotAddButton" 
                    onClick={addFormula}
                    title="Add New Formula"
                  >
                    <FontAwesomeIcon icon={faPlus}/>
                    <span>Add Formula</span>
                  </button>

                  <div className="toolkitPlotModeSelector">
                    <button 
                      className={`toolkitPlotModeButton ${functionMode === "fx" ? "active" : ""}`}
                      onClick={() => setFunctionMode("fx")}
                      title="Function Mode"
                    >
                      f(x)
                    </button>

                    <button 
                      className={`toolkitPlotModeButton ${functionMode === "derv" ? "active" : ""}`}
                      onClick={() => setFunctionMode("derv")}
                      title="Derivative Mode"
                    >
                      d/dx
                    </button>

                    <button 
                      className={`toolkitPlotModeButton ${functionMode === "integ" ? "active" : ""}`}
                      onClick={() => setFunctionMode("integ")}
                      title="Integral Mode"
                    >
                      ∫f
                    </button>
                  </div>
                </div>

                <Tippy
                  content={
                    <div className="toolkitPlotShapeMenu">
                      <button className="toolkitPlotShapeMenuItem" onClick={addCircle}>
                        <FontAwesomeIcon icon={faCircle}/>
                        <span>Circle</span>
                      </button>
                      <button className="toolkitPlotShapeMenuItem" onClick={addTriangle}>
                        <span className="triangleIcon">△</span>
                        <span>Triangle</span>
                      </button>
                      <button className="toolkitPlotShapeMenuItem" onClick={addRectangle}>
                        <FontAwesomeIcon icon={faSquare}/>
                        <span>Rectangle</span>
                      </button>
                      <button className="toolkitPlotShapeMenuItem" onClick={addPolygon}>
                        <FontAwesomeIcon icon={faDrawPolygon}/>
                        <span>Polygon</span>
                      </button>
                    </div>
                  }
                  visible={shapeMenuOpen}
                  onClickOutside={() => setShapeMenuOpen(false)}
                  interactive={true}
                  placement="bottom"
                  offset={[0, 5]}
                  appendTo={document.body}
                  className="shape-menu-tippy"
                >
                  <button 
                    className="toolkitPlotAddShapeButton" 
                    onClick={() => setShapeMenuOpen(!shapeMenuOpen)}
                    title="Add Shape"
                  >
                    <FontAwesomeIcon icon={faShapes}/>
                    <span>Add Shape</span>
                    <FontAwesomeIcon icon={faCaretDown} className="caretIcon"/>
                  </button>
                </Tippy>
              </div>

              <div className="toolkitPlotFormulasList">
                {formulas.map(formula => {
                  const missingVars = extractMissingVariables(formula.text);
                  return (
                    <div key={formula.id} className="toolkitPlotFormulaItem">
                      <div className="toolkitPlotFormulaRow">
                        <div className="toolkitPlotColorControls">
                          <Tippy 
                            content={
                              <ColorPicker 
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
                              className="toolkitPlotColorIndicator"
                              style={{ backgroundColor: formula.color }}
                              onClick={() => toggleColorPicker(formula.id)}
                              title="Change Color"
                            />
                          </Tippy>

                          <Tippy 
                            content={
                              <div className="toolkitPlotShadingMenu">
                                <div className="toolkitPlotShadingOption">
                                  <label>
                                    <input
                                      type="checkbox"
                                      className="dinolabsSettingsCheckbox"
                                      checked={formula.shading?.toXAxis || false}
                                      onChange={(e) => updateFormulaShading(formula.id, 'toXAxis', e.target.checked)}
                                    />
                                    Shade To X-Axis
                                  </label>
                                </div>
                                <div className="toolkitPlotShadingOption">
                                  <label>
                                    <input
                                      type="checkbox"
                                      className="dinolabsSettingsCheckbox"
                                      checked={formula.shading?.toYAxis || false}
                                      onChange={(e) => updateFormulaShading(formula.id, 'toYAxis', e.target.checked)}
                                    />
                                    Shade To Y-Axis
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
                              className={`toolkitPlotShadingButton ${(formula.shading?.toXAxis || formula.shading?.toYAxis) ? 'active' : ''}`}
                              onClick={() => toggleShadingMenu(formula.id)}
                              title="Shading Options"
                            >
                              <FontAwesomeIcon icon={faPaintBrush}/>
                            </button>
                          </Tippy>

                          <button
                            className={`toolkitPlotVisibilityToggle ${formula.isHidden ? "hidden" : "visible"}`}
                            onClick={() => toggleFormulaVisibility(formula.id)}
                            title={formula.isHidden ? "Show Formula" : "Hide Formula"}
                          >
                            <FontAwesomeIcon icon={formula.isHidden ? faEye : faEyeSlash}/>
                          </button>
                        </div>

                        <input
                          ref={el => inputRefs.current[formula.id] = el}
                          type="text"
                          className="toolkitPlotFormulaInput"
                          value={formula.text}
                          onChange={(e) => {
                            const newValue = e.target.value;
                            const cursorPos = e.target.selectionStart;
                            updateFormula(formula.id, newValue, cursorPos);
                          }}
                          onSelect={(e) => cursorPositionRef.current = e.target.selectionStart}
                          placeholder={angleMode === "deg" ? "Enter a formula in degrees." : "Enter a formula in radians."}
                        />

                        <button 
                          className="toolkitPlotRemoveButton"
                          onClick={() => removeFormula(formula.id)}
                          title="Remove Formula"
                        >
                          <FontAwesomeIcon icon={faXmark}/>
                        </button>
                      </div>

                      {missingVars.length > 0 && (
                        <div className="toolkitPlotMissingVars">
                          <span>Add Variables</span>
                          {missingVars.map(varName => (
                            <button 
                              key={varName}
                              className="toolkitPlotVarButton"
                              onClick={() => addVariable(varName)}
                              title={`Add the variable ${varName}.`}
                            >
                              {varName}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {circles.map(circle => (
                  <div key={circle.id} className="toolkitPlotShapeItem toolkitPlotCircleItem">
                    <div className="toolkitPlotShapeHeader">
                      <Tippy 
                        content={
                          <ColorPicker 
                            color={circle.color} 
                            onChange={(newColor) => updateCircleColor(circle.id, newColor)} 
                          />
                        } 
                        visible={circleColorPickerOpen[circle.id]} 
                        onClickOutside={() => closeCircleColorPicker(circle.id)} 
                        interactive={true} 
                        placement="left-start"
                        offset={[0, 10]}
                        appendTo={document.body}
                        className="color-picker-tippy"
                      >
                        <button
                          className="toolkitPlotColorIndicator"
                          style={{ backgroundColor: circle.color }}
                          onClick={() => toggleCircleColorPicker(circle.id)}
                          title="Change Color"
                        />
                      </Tippy>

                      <Tippy 
                        content={
                          <div className="toolkitPlotShadingMenu">
                            <div className="toolkitPlotShadingOption">
                              <label>
                                <input
                                  type="checkbox"
                                  className="dinolabsSettingsCheckbox"
                                  checked={circle.shading?.filled || false}
                                  onChange={(e) => updateCircleShading(circle.id, 'filled', e.target.checked)}
                                />
                                Fill Circle
                              </label>
                            </div>
                          </div>
                        } 
                        visible={circleShadingMenuOpen[circle.id]} 
                        onClickOutside={() => closeCircleShadingMenu(circle.id)} 
                        interactive={true} 
                        placement="left-start"
                        offset={[0, 10]}
                        appendTo={document.body}
                        className="shading-menu-tippy"
                      >
                        <button
                          className={`toolkitPlotShadingButton ${circle.shading?.filled ? 'active' : ''}`}
                          onClick={() => toggleCircleShadingMenu(circle.id)}
                          title="Shading Options"
                        >
                          <FontAwesomeIcon icon={faPaintBrush}/>
                        </button>
                      </Tippy>

                      <button
                        className={`toolkitPlotVisibilityToggle ${circle.isHidden ? "hidden" : "visible"}`}
                        onClick={() => toggleCircleVisibility(circle.id)}
                        title={circle.isHidden ? "Show Circle" : "Hide Circle"}
                      >
                        <FontAwesomeIcon icon={circle.isHidden ? faEye : faEyeSlash}/>
                      </button>

                      <div className="toolkitPlotShapeLabel">
                        <FontAwesomeIcon icon={faCircle} className="toolkitPlotShapeIcon"/>
                        <span>Circle</span>
                      </div>

                      <button 
                        className="toolkitPlotRemoveButton"
                        onClick={() => removeCircle(circle.id)}
                        title="Remove Circle"
                      >
                        <FontAwesomeIcon icon={faXmark}/>
                      </button>
                    </div>

                    <div className="toolkitPlotShapeControls">
                      <div className="toolkitPlotShapeInputRow">
                        <div className="toolkitPlotShapeInputGroup">
                          <label>X</label>
                          <input
                            type="number"
                            step="0.1"
                            value={parseFloat(circle.centerX.toFixed(2))}
                            onChange={(e) => updateCircle(circle.id, { centerX: parseFloat(e.target.value) || 0 })}
                            className="toolkitPlotShapeInput"
                          />
                        </div>
                        <div className="toolkitPlotShapeInputGroup">
                          <label>Y</label>
                          <input
                            type="number"
                            step="0.1"
                            value={parseFloat(circle.centerY.toFixed(2))}
                            onChange={(e) => updateCircle(circle.id, { centerY: parseFloat(e.target.value) || 0 })}
                            className="toolkitPlotShapeInput"
                          />
                        </div>
                        <div className="toolkitPlotShapeInputGroup">
                          <label>R</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={parseFloat(circle.radius.toFixed(2))}
                            onChange={(e) => updateCircle(circle.id, { radius: Math.max(0.1, parseFloat(e.target.value) || 0.1) })}
                            className="toolkitPlotShapeInput"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {triangles.map(triangle => (
                  <div key={triangle.id} className="toolkitPlotShapeItem toolkitPlotTriangleItem">
                    <div className="toolkitPlotShapeHeader">
                      <Tippy 
                        content={
                          <ColorPicker 
                            color={triangle.color} 
                            onChange={(newColor) => updateTriangleColor(triangle.id, newColor)} 
                          />
                        } 
                        visible={triangleColorPickerOpen[triangle.id]} 
                        onClickOutside={() => closeTriangleColorPicker(triangle.id)} 
                        interactive={true} 
                        placement="left-start"
                        offset={[0, 10]}
                        appendTo={document.body}
                        className="color-picker-tippy"
                      >
                        <button
                          className="toolkitPlotColorIndicator"
                          style={{ backgroundColor: triangle.color }}
                          onClick={() => toggleTriangleColorPicker(triangle.id)}
                          title="Change Color"
                        />
                      </Tippy>

                      <Tippy 
                        content={
                          <div className="toolkitPlotShadingMenu">
                            <div className="toolkitPlotShadingOption">
                              <label>
                                <input
                                  type="checkbox"
                                  className="dinolabsSettingsCheckbox"
                                  checked={triangle.shading?.filled || false}
                                  onChange={(e) => updateTriangleShading(triangle.id, 'filled', e.target.checked)}
                                />
                                Fill Triangle
                              </label>
                            </div>
                          </div>
                        } 
                        visible={triangleShadingMenuOpen[triangle.id]} 
                        onClickOutside={() => closeTriangleShadingMenu(triangle.id)} 
                        interactive={true} 
                        placement="left-start"
                        offset={[0, 10]}
                        appendTo={document.body}
                        className="shading-menu-tippy"
                      >
                        <button
                          className={`toolkitPlotShadingButton ${triangle.shading?.filled ? 'active' : ''}`}
                          onClick={() => toggleTriangleShadingMenu(triangle.id)}
                          title="Shading Options"
                        >
                          <FontAwesomeIcon icon={faPaintBrush}/>
                        </button>
                      </Tippy>

                      <button
                        className={`toolkitPlotVisibilityToggle ${triangle.isHidden ? "hidden" : "visible"}`}
                        onClick={() => toggleTriangleVisibility(triangle.id)}
                        title={triangle.isHidden ? "Show Triangle" : "Hide Triangle"}
                      >
                        <FontAwesomeIcon icon={triangle.isHidden ? faEye : faEyeSlash}/>
                      </button>

                      <div className="toolkitPlotShapeLabel">
                        <span className="toolkitPlotShapeIcon triangleIcon">△</span>
                        <span>Triangle</span>
                      </div>

                      <button 
                        className="toolkitPlotRemoveButton"
                        onClick={() => removeTriangle(triangle.id)}
                        title="Remove Triangle"
                      >
                        <FontAwesomeIcon icon={faXmark}/>
                      </button>
                    </div>

                    <div className="toolkitPlotShapeControls">
                      <div className="toolkitPlotShapeInputRow">
                        <div className="toolkitPlotShapeInputGroup">
                          <label>X₁</label>
                          <input
                            type="number"
                            step="0.1"
                            value={parseFloat(triangle.x1.toFixed(2))}
                            onChange={(e) => updateTriangle(triangle.id, { x1: parseFloat(e.target.value) || 0 })}
                            className="toolkitPlotShapeInput"
                          />
                        </div>
                        <div className="toolkitPlotShapeInputGroup">
                          <label>Y₁</label>
                          <input
                            type="number"
                            step="0.1"
                            value={parseFloat(triangle.y1.toFixed(2))}
                            onChange={(e) => updateTriangle(triangle.id, { y1: parseFloat(e.target.value) || 0 })}
                            className="toolkitPlotShapeInput"
                          />
                        </div>
                      </div>
                      <div className="toolkitPlotShapeInputRow">
                        <div className="toolkitPlotShapeInputGroup">
                          <label>X₂</label>
                          <input
                            type="number"
                            step="0.1"
                            value={parseFloat(triangle.x2.toFixed(2))}
                            onChange={(e) => updateTriangle(triangle.id, { x2: parseFloat(e.target.value) || 0 })}
                            className="toolkitPlotShapeInput"
                          />
                        </div>
                        <div className="toolkitPlotShapeInputGroup">
                          <label>Y₂</label>
                          <input
                            type="number"
                            step="0.1"
                            value={parseFloat(triangle.y2.toFixed(2))}
                            onChange={(e) => updateTriangle(triangle.id, { y2: parseFloat(e.target.value) || 0 })}
                            className="toolkitPlotShapeInput"
                          />
                        </div>
                      </div>
                      <div className="toolkitPlotShapeInputRow">
                        <div className="toolkitPlotShapeInputGroup">
                          <label>X₃</label>
                          <input
                            type="number"
                            step="0.1"
                            value={parseFloat(triangle.x3.toFixed(2))}
                            onChange={(e) => updateTriangle(triangle.id, { x3: parseFloat(e.target.value) || 0 })}
                            className="toolkitPlotShapeInput"
                          />
                        </div>
                        <div className="toolkitPlotShapeInputGroup">
                          <label>Y₃</label>
                          <input
                            type="number"
                            step="0.1"
                            value={parseFloat(triangle.y3.toFixed(2))}
                            onChange={(e) => updateTriangle(triangle.id, { y3: parseFloat(e.target.value) || 0 })}
                            className="toolkitPlotShapeInput"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {rectangles.map(rectangle => (
                  <div key={rectangle.id} className="toolkitPlotShapeItem toolkitPlotRectangleItem">
                    <div className="toolkitPlotShapeHeader">
                      <Tippy 
                        content={
                          <ColorPicker 
                            color={rectangle.color} 
                            onChange={(newColor) => updateRectangleColor(rectangle.id, newColor)} 
                          />
                        } 
                        visible={rectangleColorPickerOpen[rectangle.id]} 
                        onClickOutside={() => closeRectangleColorPicker(rectangle.id)} 
                        interactive={true} 
                        placement="left-start"
                        offset={[0, 10]}
                        appendTo={document.body}
                        className="color-picker-tippy"
                      >
                        <button
                          className="toolkitPlotColorIndicator"
                          style={{ backgroundColor: rectangle.color }}
                          onClick={() => toggleRectangleColorPicker(rectangle.id)}
                          title="Change Color"
                        />
                      </Tippy>

                      <Tippy 
                        content={
                          <div className="toolkitPlotShadingMenu">
                            <div className="toolkitPlotShadingOption">
                              <label>
                                <input
                                  type="checkbox"
                                  className="dinolabsSettingsCheckbox"
                                  checked={rectangle.shading?.filled || false}
                                  onChange={(e) => updateRectangleShading(rectangle.id, 'filled', e.target.checked)}
                                />
                                Fill Rectangle
                              </label>
                            </div>
                          </div>
                        } 
                        visible={rectangleShadingMenuOpen[rectangle.id]} 
                        onClickOutside={() => closeRectangleShadingMenu(rectangle.id)} 
                        interactive={true} 
                        placement="left-start"
                        offset={[0, 10]}
                        appendTo={document.body}
                        className="shading-menu-tippy"
                      >
                        <button
                          className={`toolkitPlotShadingButton ${rectangle.shading?.filled ? 'active' : ''}`}
                          onClick={() => toggleRectangleShadingMenu(rectangle.id)}
                          title="Shading Options"
                        >
                          <FontAwesomeIcon icon={faPaintBrush}/>
                        </button>
                      </Tippy>

                      <button
                        className={`toolkitPlotVisibilityToggle ${rectangle.isHidden ? "hidden" : "visible"}`}
                        onClick={() => toggleRectangleVisibility(rectangle.id)}
                        title={rectangle.isHidden ? "Show Rectangle" : "Hide Rectangle"}
                      >
                        <FontAwesomeIcon icon={rectangle.isHidden ? faEye : faEyeSlash}/>
                      </button>

                      <div className="toolkitPlotShapeLabel">
                        <FontAwesomeIcon icon={faSquare} className="toolkitPlotShapeIcon"/>
                        <span>Rectangle</span>
                      </div>

                      <button 
                        className="toolkitPlotRemoveButton"
                        onClick={() => removeRectangle(rectangle.id)}
                        title="Remove Rectangle"
                      >
                        <FontAwesomeIcon icon={faXmark}/>
                      </button>
                    </div>

                    <div className="toolkitPlotShapeControls">
                      <div className="toolkitPlotShapeInputRow">
                        <div className="toolkitPlotShapeInputGroup">
                          <label>X</label>
                          <input
                            type="number"
                            step="0.1"
                            value={parseFloat(rectangle.x.toFixed(2))}
                            onChange={(e) => updateRectangle(rectangle.id, { x: parseFloat(e.target.value) || 0 })}
                            className="toolkitPlotShapeInput"
                          />
                        </div>
                        <div className="toolkitPlotShapeInputGroup">
                          <label>Y</label>
                          <input
                            type="number"
                            step="0.1"
                            value={parseFloat(rectangle.y.toFixed(2))}
                            onChange={(e) => updateRectangle(rectangle.id, { y: parseFloat(e.target.value) || 0 })}
                            className="toolkitPlotShapeInput"
                          />
                        </div>
                      </div>
                      <div className="toolkitPlotShapeInputRow">
                        <div className="toolkitPlotShapeInputGroup">
                          <label>W</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={parseFloat(rectangle.width.toFixed(2))}
                            onChange={(e) => updateRectangle(rectangle.id, { width: Math.max(0.1, parseFloat(e.target.value) || 0.1) })}
                            className="toolkitPlotShapeInput"
                          />
                        </div>
                        <div className="toolkitPlotShapeInputGroup">
                          <label>H</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={parseFloat(rectangle.height.toFixed(2))}
                            onChange={(e) => updateRectangle(rectangle.id, { height: Math.max(0.1, parseFloat(e.target.value) || 0.1) })}
                            className="toolkitPlotShapeInput"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {polygons.map(polygon => (
                  <div key={polygon.id} className="toolkitPlotShapeItem toolkitPlotPolygonItem">
                    <div className="toolkitPlotShapeHeader">
                      <Tippy 
                        content={
                          <ColorPicker 
                            color={polygon.color} 
                            onChange={(newColor) => updatePolygonColor(polygon.id, newColor)} 
                          />
                        } 
                        visible={polygonColorPickerOpen[polygon.id]} 
                        onClickOutside={() => closePolygonColorPicker(polygon.id)} 
                        interactive={true} 
                        placement="left-start"
                        offset={[0, 10]}
                        appendTo={document.body}
                        className="color-picker-tippy"
                      >
                        <button
                          className="toolkitPlotColorIndicator"
                          style={{ backgroundColor: polygon.color }}
                          onClick={() => togglePolygonColorPicker(polygon.id)}
                          title="Change Color"
                        />
                      </Tippy>

                      <Tippy 
                        content={
                          <div className="toolkitPlotShadingMenu">
                            <div className="toolkitPlotShadingOption">
                              <label>
                                <input
                                  type="checkbox"
                                  className="dinolabsSettingsCheckbox"
                                  checked={polygon.shading?.filled || false}
                                  onChange={(e) => updatePolygonShading(polygon.id, 'filled', e.target.checked)}
                                />
                                Fill Polygon
                              </label>
                            </div>
                          </div>
                        } 
                        visible={polygonShadingMenuOpen[polygon.id]} 
                        onClickOutside={() => closePolygonShadingMenu(polygon.id)} 
                        interactive={true} 
                        placement="left-start"
                        offset={[0, 10]}
                        appendTo={document.body}
                        className="shading-menu-tippy"
                      >
                        <button
                          className={`toolkitPlotShadingButton ${polygon.shading?.filled ? 'active' : ''}`}
                          onClick={() => togglePolygonShadingMenu(polygon.id)}
                          title="Shading Options"
                        >
                          <FontAwesomeIcon icon={faPaintBrush}/>
                        </button>
                      </Tippy>

                      <button
                        className={`toolkitPlotVisibilityToggle ${polygon.isHidden ? "hidden" : "visible"}`}
                        onClick={() => togglePolygonVisibility(polygon.id)}
                        title={polygon.isHidden ? "Show Polygon" : "Hide Polygon"}
                      >
                        <FontAwesomeIcon icon={polygon.isHidden ? faEye : faEyeSlash}/>
                      </button>

                      <div className="toolkitPlotShapeLabel">
                        <FontAwesomeIcon icon={faDrawPolygon} className="toolkitPlotShapeIcon"/>
                        <span>Polygon ({polygon.vertices.length})</span>
                      </div>

                      <button 
                        className="toolkitPlotRemoveButton"
                        onClick={() => removePolygon(polygon.id)}
                        title="Remove Polygon"
                      >
                        <FontAwesomeIcon icon={faXmark}/>
                      </button>
                    </div>

                    <div className="toolkitPlotShapeControls">
                      <div className="toolkitPlotPolygonVertices">
                        {polygon.vertices.map((vertex, idx) => (
                          <div key={idx} className="toolkitPlotShapeInputRow toolkitPlotVertexRow">
                            <div className="toolkitPlotShapeInputGroup">
                              <label>X{idx + 1}</label>
                              <input
                                type="number"
                                step="0.1"
                                value={parseFloat(vertex.x.toFixed(2))}
                                onChange={(e) => updatePolygonVertex(polygon.id, idx, parseFloat(e.target.value) || 0, vertex.y)}
                                className="toolkitPlotShapeInput"
                              />
                            </div>
                            <div className="toolkitPlotShapeInputGroup">
                              <label>Y{idx + 1}</label>
                              <input
                                type="number"
                                step="0.1"
                                value={parseFloat(vertex.y.toFixed(2))}
                                onChange={(e) => updatePolygonVertex(polygon.id, idx, vertex.x, parseFloat(e.target.value) || 0)}
                                className="toolkitPlotShapeInput"
                              />
                            </div>
                            {polygon.vertices.length > 3 && (
                              <button
                                className="toolkitPlotVertexRemoveButton"
                                onClick={() => removePolygonVertex(polygon.id, idx)}
                                title="Remove Vertex"
                              >
                                <FontAwesomeIcon icon={faMinus}/>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <button
                        className="toolkitPlotAddVertexButton"
                        onClick={() => addPolygonVertex(polygon.id)}
                        title="Add Vertex"
                      >
                        <FontAwesomeIcon icon={faPlus}/>
                        <span>Add Vertex</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="toolkitPlotVariablesList">
                {variables.map(variable => (
                  <div key={variable.id} className="toolkitPlotVariableItem">
                    <div className="toolkitPlotVariableHeader">
                      <small>
                      <span className="toolkitPlotVariableName">{variable.name}: </span>
                      <span className="toolkitPlotVariableValue">{variable.value.toFixed(1)}</span>
                      </small>

                      <button 
                        className="toolkitPlotRemoveButton"
                        onClick={() => removeVariable(variable.id)}
                        title="Remove Variable"
                      >
                        <FontAwesomeIcon icon={faXmark}/>
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
                className="toolkitPlotKeyboardToggle"
                onClick={() => setIsKeyboardView(!isKeyboardView)}
                title="Toggle Virtual Keyboard"
              >
                <FontAwesomeIcon icon={faKeyboard}/>
                <span>{isKeyboardView ? "Hide Keyboard" : "Show Keyboard"}</span>
              </button>
            </div>

            <div className="toolkitPlotGraphArea">
              <canvas 
                ref={canvasRef}
                className="toolkitPlotCanvas"
              />
              
              <div className="toolkitPlotControls">
                <button 
                  className="toolkitPlotControlButton zoom-in" 
                  onClick={() => zoomGraph(true)}
                  title="Zoom In"
                >
                  <FontAwesomeIcon icon={faPlus}/>
                </button>

                <button 
                  className="toolkitPlotControlButton zoom-out" 
                  onClick={() => zoomGraph(false)}
                  title="Zoom Out" 
                >
                  <FontAwesomeIcon icon={faMinus}/>
                </button>

                <button 
                  className="toolkitPlotControlButton reset-zoom" 
                  onClick={resetZoom}
                  title="Reset Zoom"
                >
                  <FontAwesomeIcon icon={faRotate}/>
                </button>

                <button 
                  className={`toolkitPlotControlButton ${angleMode === "rad" ? "active" : ""}`}
                  style={{}}
                  onClick={() => setAngleMode("rad")}
                  title="Radians Mode"
                >
                  Rad
                </button>

                <button 
                  className={`toolkitPlotControlButton ${angleMode === "deg" ? "active" : ""}`}
                  onClick={() => setAngleMode("deg")}
                  title="Degrees Mode"
                >
                  Deg
                </button>
              </div>

              <button 
                className="toolkitPlotInterceptButton" 
                onClick={findIntercepts}
                title="Find Function Intercepts"
              >
                <FontAwesomeIcon icon={faLineChart}/>
                <span>Find Intercepts</span>
              </button>
            </div>
          </div>

          {isKeyboardView && (
            <div className="toolkitPlotKeyboard">
              <div className="toolkitPlotKeyboardSection">
                <h4>Numbers & Operators</h4>

                <div className="toolkitPlotKeyboardGrid">
                  <button className="toolkitPlotKey" onClick={() => insertText("1")}>1</button>
                  <button className="toolkitPlotKey" onClick={() => insertText("2")}>2</button>
                  <button className="toolkitPlotKey" onClick={() => insertText("3")}>3</button>
                  <button className="toolkitPlotKey" onClick={() => insertText("4")}>4</button>
                  <button className="toolkitPlotKey" onClick={() => insertText("5")}>5</button>
                  <button className="toolkitPlotKey" onClick={() => insertText("6")}>6</button>
                  <button className="toolkitPlotKey" onClick={() => insertText("7")}>7</button>
                  <button className="toolkitPlotKey" onClick={() => insertText("8")}>8</button>
                  <button className="toolkitPlotKey" onClick={() => insertText("9")}>9</button>
                  <button className="toolkitPlotKey" onClick={() => insertText("0")}>0</button>
                  <button className="toolkitPlotKey" onClick={() => insertText(".")}>.</button>
                  <button className="toolkitPlotKey" onClick={() => insertText("(")}>(</button>
                  <button className="toolkitPlotKey" onClick={() => insertText(")")}>)</button>
                  <button className="toolkitPlotKey" onClick={() => insertText("[")}>[</button>
                  <button className="toolkitPlotKey" onClick={() => insertText("]")}>]</button>
                  <button className="toolkitPlotKey" onClick={() => insertText("+")}>+</button>
                  <button className="toolkitPlotKey" onClick={() => insertText("-")}>-</button>
                  <button className="toolkitPlotKey" onClick={() => insertText("*")}>×</button>
                  <button className="toolkitPlotKey" onClick={() => insertText("/")}>÷</button>
                  <button className="toolkitPlotKey" onClick={() => insertText("^")}>^</button>
                  <button className="toolkitPlotKey" onClick={() => insertText("+-")}>±</button>
                  <button className="toolkitPlotKey" onClick={() => insertText("=")}>=</button>
                  <button className="toolkitPlotKey" onClick={() => insertText("|")}>|</button>
                </div>
              </div>

              <div className="toolkitPlotKeyboardSection">
                <h4>Functions & Constants</h4>

                <div className="toolkitPlotKeyboardGrid">
                  <button className="toolkitPlotKey function" onClick={() => insertText("sqrt(")} title="Square Root">√</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("cbrt(")} title="Cube Root">∛</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("pi")} title="Mathematical Constant Pi">π</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("tau")} title="Mathematical Constant Tau">τ</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("infinity")} title="Infinity">∞</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("sin(")} title="Sine Function">sin</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("cos(")} title="Cosine Function">cos</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("tan(")} title="Tangent Function">tan</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("sec(")} title="Secant Function">sec</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("csc(")} title="Cosecant Function">csc</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("cot(")} title="Cotangent Function">cot</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("asin(")} title="Arcsine Function">asin</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("acos(")} title="Arccosine Function">acos</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("atan(")} title="Arctangent Function">atan</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("asec(")} title="Arcsecant Function">asec</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("acsc(")} title="Arccosecant Function">acsc</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("acot(")} title="Arccotangent Function">acot</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("sinh(")} title="Hyperbolic Sine">sinh</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("cosh(")} title="Hyperbolic Cosine">cosh</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("tanh(")} title="Hyperbolic Tangent">tanh</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("asinh(")} title="Inverse Hyperbolic Sine">asinh</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("acosh(")} title="Inverse Hyperbolic Cosine">acosh</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("atanh(")} title="Inverse Hyperbolic Tangent">atanh</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("exp(")} title="Exponential Function">exp</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("ln(")} title="Natural Logarithm">ln</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("log(")} title="Base-10 Logarithm">log</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("logn(")} title="Logarithm With Custom Base">logn</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("pow(")} title="Power Function">pow</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("root(")} title="N-th Root">root</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("abs(")} title="Absolute Value">abs</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("floor(")} title="Floor Function">floor</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("ceil(")} title="Ceiling Function">ceil</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("round(")} title="Round Function">round</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("sign(")} title="Sign Function">sign</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("alpha")} title="Greek Letter Alpha">α</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("beta")} title="Greek Letter Beta">β</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("gamma")} title="Greek Letter Gamma">γ</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("delta")} title="Greek Letter Delta">δ</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("epsilon")} title="Greek Letter Epsilon">ε</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("theta")} title="Greek Letter Theta">θ</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("lambda")} title="Greek Letter Lambda">λ</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("mu")} title="Greek Letter Mu">μ</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("sigma")} title="Greek Letter Sigma">σ</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("phi")} title="Greek Letter Phi">φ</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("omega")} title="Greek Letter Omega">ω</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("1/2")} title="One Half">½</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("1/3")} title="One Third">⅓</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("1/4")} title="One Quarter">¼</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("2/3")} title="Two Thirds">⅔</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("3/4")} title="Three Quarters">¾</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("^2")} title="Squared">x²</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("^3")} title="Cubed">x³</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("<=")} title="Less Than Or Equal">≤</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText(">=")} title="Greater Than Or Equal">≥</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("!=")} title="Not Equal">≠</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("x")} title="Insert the variable x.">x</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("y")} title="Insert the variable y.">y</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("a")} title="Insert the variable a.">a</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("b")} title="Insert the variable b.">b</button>
                  <button className="toolkitPlotKey function" onClick={() => insertText("c")} title="Insert the variable c.">c</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Plotting;