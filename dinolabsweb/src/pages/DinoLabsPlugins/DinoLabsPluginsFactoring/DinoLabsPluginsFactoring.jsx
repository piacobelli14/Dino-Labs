import React, { useState, useRef, useEffect } from "react";
import DinoLabsNav from "../../../helpers/Nav";
import "../../../styles/mainStyles/DinoLabsPlugins/DinoLabsPluginsFactoring/DinoLabsPluginsFactoring.css";

export default function DinoLabsPluginsFactoring() {

  const SUPERSCRIPT_MAP = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '-': '⁻', '+': '⁺', '.': '·',
    '(': '⁽', ')': '⁾',
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
    '⁽': '(', '⁾': ')',
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
    { pattern: /\*\*/g, replacement: "^", description: "Exponentiation" },
    { pattern: /\-/g, replacement: "−", description: "Minus (display)" },
  ];

  const SYMBOL_TO_FUNCTION = {
    "²": "^2",
    "³": "^3",
    "⁴": "^4",
    "⁵": "^5",
    "⁶": "^6",
    "⁷": "^7",
    "⁸": "^8",
    "⁹": "^9",
    "−": "-",
    "×": "*",
  };

  const [expression, setExpression] = useState("");
  const [history, setHistory] = useState([]);
  const [mode, setMode] = useState("integer");

  const inputRef = useRef(null);
  const cursorPositionRef = useRef(null);

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
      
      if (!isSuperscript(charBeforeCursor) && SUPERSCRIPT_MAP[charBeforeCursor] !== undefined) {
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
            const cursorInside = cursorPos > expStart && cursorPos < j;
            const cursorAtEnd = cursorPos === j;
            
            if (!cursorInside && !cursorAtEnd) {
              const uni = parseParenFraction(insideWithParens);
              if (uni) {
                const originalLen = j - i;
                const replacementLen = uni.length;

                if (cursorPos > j) {
                  newCursorPos -= originalLen - replacementLen;
                }

                result += uni;
                i = j;
                continue;
              }

              const innerContent = insideWithParens.slice(1, -1);
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
          const nextChar = expEnd < text.length ? text[expEnd] : '';
          const cursorAtEnd = cursorPos === expEnd;
          const shouldConvert = !cursorAtEnd || (nextChar !== '' && !/[0-9.]/.test(nextChar));

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

    const beforeCursor0 = formattedText.substring(0, newCursorPos);
    const afterCursor0 = formattedText.substring(newCursorPos);

    const afterChar = afterCursor0.length > 0 ? afterCursor0[0] : '';
    const hasNonDigitAfter = afterChar !== '' && !/[0-9]/.test(afterChar);

    let fracMatch = beforeCursor0.match(/(^|[^A-Za-z0-9_⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉])(\d+)\s*([\/÷])\s*(\d+)(?=[^0-9])/);
    
    if (!fracMatch && hasNonDigitAfter) {
      fracMatch = beforeCursor0.match(/(^|[^A-Za-z0-9_⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉])(\d+)\s*([\/÷])\s*(\d+)$/);
    }

    if (fracMatch) {
      const full = fracMatch[0];
      const lead = fracMatch[1] || "";
      const numStr = fracMatch[2];
      const denStr = fracMatch[4];
      const uni = makeUnicodeFraction(numStr, denStr);
      if (uni) {
        const matchStart = fracMatch.index;
        const matchEnd = matchStart + full.length;
        const prefix = beforeCursor0.slice(0, matchStart);
        const suffix = beforeCursor0.slice(matchEnd);
        const newBefore = prefix + lead + uni + suffix;
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

    const superscriptPattern = /[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺·⁽⁾ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖʳˢᵗᵘᵛʷˣʸᶻᴬᴮᴰᴱᴳᴴᴵᴶᴷᴸᴹᴺᴼᴾᴿᵀᵁⱽᵂ]+/g;
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
      if (!/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺·⁽⁾ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖʳˢᵗᵘᵛʷˣʸᶻᴬᴮᴰᴱᴳᴴᴵᴶᴷᴸᴹᴺᴼᴾᴿᵀᵁⱽᵂ]/.test(symbol)) {
        evalExpression = evalExpression.replace(new RegExp(escapeRegExp(symbol), "g"), func);
      }
    }

    evalExpression = evalExpression.replace(/×/g, "*");
    evalExpression = evalExpression.replace(/−/g, "-");

    return evalExpression;
  };

  const isErrorMessage = (result) => {
    return result.includes("Enter a valid integer.") || 
           result.includes("Enter two integers separated by comma.") ||
           result.includes("Error processing expression.") ||
           result.includes("This is a constant, not a polynomial.") ||
           result.includes("No real factors.") ||
           result.includes("Cannot be factored further.");
  }

  const formatStep = (step) => {
    let formatted = step;
    
    formatted = formatted.replace(/\^(\d+)/g, (_, exp) => {
        const supers = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
        return exp.split('').map(d => supers[d] || d).join('');
    });
    
    formatted = formatted.replace(/\*/g, '×');
    formatted = formatted.replace(/(?<![a-zA-Z])-(?![a-zA-Z])/g, '−');
    
    formatted = formatted.replace(/\s+/g, ' ').trim();

    return formatted;
  };

  const formatQuadraticOutput = (output) => {
    let formatted = output.replace(/x\^2/g, 'x²');
    formatted = formatted.replace(/x\^3/g, 'x³');
    formatted = formatted.replace(/\*/g, '×');
    formatted = formatted.replace(/-/g, '−');
    
    formatted = formatted.replace(/([+−×])/g, ' $1 ');
    formatted = formatted.replace(/\s+/g, ' ').trim();

    formatted = formatted.replace(/− −/g, ' + ');

    return formatted;
  };

  const primeFactorize = (n) => {
    const steps = [];
    const factors = [];
    let num = Math.abs(Math.floor(n));
    const original = num;

    if (num < 2) {
      return { result: `${num}`, steps: [`${num} cannot be factored further.`] };
    }

    steps.push(`Starting with ${original}.`);
    let divisor = 2;

    while (num > 1) {
      while (num % divisor === 0) {
        factors.push(divisor);
        steps.push(`${num} ÷ ${divisor} = ${num / divisor}.`);
        num = num / divisor;
      }
      divisor++;
      if (divisor * divisor > num && num > 1) {
        factors.push(num);
        steps.push(`${num} is prime.`);
        break;
      }
    }

    const factorCounts = {};
    factors.forEach(f => { factorCounts[f] = (factorCounts[f] || 0) + 1; });

    const resultParts = Object.entries(factorCounts).map(([base, exp]) => 
      exp > 1 ? `${base}^${exp}` : base
    );

    const result = (n < 0 ? "−1 × " : "") + resultParts.join(" × ");
    steps.push(`Result: ${original} = ${result}.`);

    return { result, steps };
  };

  const gcd = (a, b) => {
    a = Math.abs(Math.floor(a));
    b = Math.abs(Math.floor(b));
    const steps = [];
    const origA = a, origB = b;

    steps.push(`Finding GCD of ${origA} and ${origB}.`);
    steps.push(`Using Euclidean algorithm:`);

    while (b !== 0) {
      const remainder = a % b;
      steps.push(`${a} = ${b} × ${Math.floor(a / b)} + ${remainder}.`);
      a = b;
      b = remainder;
    }

    steps.push(`GCD(${origA}, ${origB}) = ${a}.`);
    return { result: `${a}`, steps };
  };

  const lcm = (a, b) => {
    const origA = Math.abs(Math.floor(a));
    const origB = Math.abs(Math.floor(b));
    const steps = [];

    steps.push(`Finding LCM of ${origA} and ${origB}.`);
    
    const gcdResult = gcd(origA, origB);
    const gcdValue = parseInt(gcdResult.result);
    
    steps.push(`First, find GCD(${origA}, ${origB}) = ${gcdValue}.`);
    steps.push(`LCM = (${origA} × ${origB}) ÷ GCD.`);
    steps.push(`LCM = ${origA * origB} ÷ ${gcdValue}.`);
    
    const lcmValue = (origA * origB) / gcdValue;
    steps.push(`LCM(${origA}, ${origB}) = ${lcmValue}.`);

    return { result: `${lcmValue}`, steps };
  };

  const divisors = (n) => {
    n = Math.abs(Math.floor(n));
    const steps = [];
    const divs = [];

    steps.push(`Finding all divisors of ${n}.`);

    for (let i = 1; i <= Math.sqrt(n); i++) {
      if (n % i === 0) {
        divs.push(i);
        if (i !== n / i) {
          divs.push(n / i);
        }
        steps.push(`${n} ÷ ${i} = ${n / i} ✓.`);
      }
    }

    divs.sort((a, b) => a - b);
    steps.push(`Divisors: {${divs.join(", ")}}.`);
    steps.push(`Count: ${divs.length} divisors.`);

    return { result: `{${divs.join(", ")}}`, steps };
  };

  const stripOuterParentheses = (expr) => {
    let result = expr.trim();
    while (result.startsWith("(") && result.endsWith(")")) {
      let depth = 0;
      let isOuter = true;
      for (let i = 0; i < result.length - 1; i++) {
        if (result[i] === "(") depth++;
        else if (result[i] === ")") depth--;
        if (depth === 0 && i < result.length - 1) {
          isOuter = false;
          break;
        }
      }
      if (isOuter) {
        result = result.slice(1, -1).trim();
      } else {
        break;
      }
    }
    return result;
  };

  const parseBinomial = (expr) => {
    const cleaned = expr.replace(/\s+/g, "");
    let coeff = 0;
    let constant = 0;
    
    let processExpr = cleaned.replace(/^(?=[^+-])/, "+");
    const terms = processExpr.match(/[+-][^+-]+/g) || [];
    
    terms.forEach(term => {
      term = term.trim();
      if (term.includes("x")) {
        let c = term.replace(/x/g, "").replace(/\s/g, "");
        if (c === "+" || c === "") c = "1";
        if (c === "-") c = "-1";
        coeff = parseInt(c);
      } else {
        const num = parseInt(term);
        if (!isNaN(num)) constant = num;
      }
    });
    
    return { coeff, constant };
  };

  const expandBinomialProduct = (expr) => {
    const cleaned = expr.replace(/\s+/g, "").replace(/\]\[/g, ")(").replace(/\[/g, "(").replace(/\]/g, ")");
    
    const match = cleaned.match(/^\(([^)]+)\)\(([^)]+)\)$/);
    if (!match) return null;
    
    const first = parseBinomial(match[1]);
    const second = parseBinomial(match[2]);
    
    const a = first.coeff * second.coeff;
    const b = first.coeff * second.constant + first.constant * second.coeff;
    const c = first.constant * second.constant;
    
    let result = "";
    if (a !== 0) {
      result += a === 1 ? "x^2" : a === -1 ? "-x^2" : `${a}x^2`;
    }
    if (b !== 0) {
      if (result && b > 0) result += "+";
      result += b === 1 ? "x" : b === -1 ? "-x" : `${b}x`;
    }
    if (c !== 0) {
      if (result && c > 0) result += "+";
      result += `${c}`;
    }
    
    return result || "0";
  };

  const expandCoefficientProduct = (expr) => {
    const cleaned = expr.replace(/\s+/g, "").replace(/\[/g, "(").replace(/\]/g, ")");
    
    const match = cleaned.match(/^(-?\d+)\(([^)]+)\)$/);
    if (!match) return null;
    
    const coeff = parseInt(match[1]);
    const inner = match[2];
    
    const coeffs = { 2: 0, 1: 0, 0: 0 };
    let processExpr = inner.replace(/^(?=[^+-])/, "+");
    const terms = processExpr.match(/[+-][^+-]+/g) || [];
    
    terms.forEach(term => {
      term = term.trim();
      if (term.includes("x^2") || term.includes("x²")) {
        let c = term.replace(/x\^?2?|x²/g, "").replace(/\s/g, "");
        if (c === "+" || c === "") c = "1";
        if (c === "-") c = "-1";
        coeffs[2] = parseInt(c);
      } else if (term.includes("x") && !term.includes("^")) {
        let c = term.replace(/x/g, "").replace(/\s/g, "");
        if (c === "+" || c === "") c = "1";
        if (c === "-") c = "-1";
        coeffs[1] = parseInt(c);
      } else {
        const num = parseInt(term);
        if (!isNaN(num)) coeffs[0] = num;
      }
    });
    
    const a = coeffs[2] * coeff;
    const b = coeffs[1] * coeff;
    const c = coeffs[0] * coeff;
    
    let result = "";
    if (a !== 0) {
      result += a === 1 ? "x^2" : a === -1 ? "-x^2" : `${a}x^2`;
    }
    if (b !== 0) {
      if (result && b > 0) result += "+";
      result += b === 1 ? "x" : b === -1 ? "-x" : `${b}x`;
    }
    if (c !== 0) {
      if (result && c > 0) result += "+";
      result += `${c}`;
    }
    
    return result || "0";
  };

  const preprocessExpression = (expr) => {
    let processed = convertSymbolsForEvaluation(expr);
    processed = processed.replace(/\s+/g, "").replace(/\[/g, "(").replace(/\]/g, ")");
    
    processed = stripOuterParentheses(processed);
    
    const binomialExpanded = expandBinomialProduct(processed);
    if (binomialExpanded) {
      return binomialExpanded;
    }
    
    const coeffExpanded = expandCoefficientProduct(processed);
    if (coeffExpanded) {
      return coeffExpanded;
    }
    
    processed = processed.replace(/[()[\]]/g, "");
    
    return processed;
  };

  const parsePolynomial = (expr) => {
    const processed = preprocessExpression(expr);
    const cleaned = processed.replace(/\s+/g, "").replace(/−/g, "-");
    const coeffs = { 2: 0, 1: 0, 0: 0 };

    let processExpr = cleaned.replace(/^(?=[^+-])/, "+");
    const termMatches = processExpr.match(/[+-][^+-]+/g) || [];

    termMatches.forEach(term => {
      term = term.trim();
      if (term.includes("x^2") || term.includes("x²")) {
        let coeff = term.replace(/x\^?2?|x²/g, "").replace(/\s/g, "");
        if (coeff === "+" || coeff === "") coeff = "1";
        if (coeff === "-") coeff = "-1";
        coeffs[2] = parseInt(coeff);
      } else if (term.includes("x") && !term.includes("^")) {
        let coeff = term.replace(/x/g, "").replace(/\s/g, "");
        if (coeff === "+" || coeff === "") coeff = "1";
        if (coeff === "-") coeff = "-1";
        coeffs[1] = parseInt(coeff);
      } else {
        const num = parseInt(term);
        if (!isNaN(num)) coeffs[0] = num;
      }
    });

    return coeffs;
  };

  const factorQuadratic = (expr) => {
    const steps = [];
    const preprocessed = preprocessExpression(expr);
    const coeffs = parsePolynomial(expr);
    const a = coeffs[2], b = coeffs[1], c = coeffs[0];

    if (preprocessed !== convertSymbolsForEvaluation(expr).replace(/\s+/g, "").replace(/[()[\]]/g, "")) {
      steps.push(`Expanded: ${preprocessed}.`);
    }
    steps.push(`Parsing: ${a}x^2 + ${b}x + ${c}.`);

    if (a === 0) {
      if (b === 0) {
        return { result: `${c}`, steps: ["This is a constant, not a polynomial."] };
      }
      steps.push(`This is linear: ${b}x + ${c}.`);
      if (c === 0) {
        return { result: `${b}x`, steps };
      }
      const gcdVal = Math.abs(parseInt(gcd(b, c).result));
      if (gcdVal > 1) {
        steps.push(`Factor out ${gcdVal}: ${gcdVal}(${b/gcdVal}x + ${c/gcdVal}).`);
        return { result: formatQuadraticOutput(`${gcdVal}(${b/gcdVal}x + ${c/gcdVal})`), steps };
      }
      return { result: formatQuadraticOutput(`${b}x + ${c}`), steps: ["Cannot be factored further."] };
    }

    const discriminant = b * b - 4 * a * c;
    steps.push(`Discriminant: b^2 − 4ac = ${b}^2 − 4(${a})(${c}) = ${discriminant}.`);

    if (discriminant < 0) {
      steps.push("Discriminant < 0: No real factors.");
      return { result: "No real factors.", steps };
    }

    const sqrtDisc = Math.sqrt(discriminant);
    
    if (!Number.isInteger(sqrtDisc)) {
      const r1 = (-b + sqrtDisc) / (2 * a);
      const r2 = (-b - sqrtDisc) / (2 * a);
      steps.push(`Roots: x = ${r1.toFixed(4)}, x = ${r2.toFixed(4)}.`);
      steps.push("Roots are irrational — no integer factorization.");
      return { result: `Roots: ${r1.toFixed(4)}, ${r2.toFixed(4)}`, steps };
    }

    const r1 = (-b + sqrtDisc) / (2 * a);
    const r2 = (-b - sqrtDisc) / (2 * a);
    steps.push(`Roots: x = ${r1}, x = ${r2}.`);

    const formatFactor = (root) => {
      if (root === 0) return "x";
      if (root > 0) return `(x − ${root})`;
      return `(x + ${Math.abs(root)})`;
    };

    let result = "";
    if (a !== 1) {
      result = `${a}${formatFactor(r1)}${formatFactor(r2)}`;
    } else {
      result = `${formatFactor(r1)}${formatFactor(r2)}`;
    }

    steps.push(`Factored form: ${result}.`);
    return { result: formatQuadraticOutput(result), steps };
  };

  const factorCommon = (expr) => {
    const steps = [];
    const preprocessed = preprocessExpression(expr);
    
    if (preprocessed !== convertSymbolsForEvaluation(expr).replace(/\s+/g, "").replace(/[()[\]]/g, "")) {
      steps.push(`Expanded: ${preprocessed}.`);
    }
    steps.push(`Analyzing: ${preprocessed}.`);

    const coeffs = parsePolynomial(expr);
    const a = coeffs[2], b = coeffs[1], c = coeffs[0];
    const terms = [a, b, c].filter(x => x !== 0);

    if (terms.length === 0) {
      return { result: "0", steps: ["Expression equals zero."] };
    }

    let commonFactor = Math.abs(terms[0]);
    for (let i = 1; i < terms.length; i++) {
      commonFactor = parseInt(gcd(commonFactor, Math.abs(terms[i])).result);
    }

    if (commonFactor <= 1) {
      steps.push("No common factor greater than 1.");
      return { result: preprocessed, steps };
    }

    steps.push(`GCF of coefficients: ${commonFactor}.`);

    const newA = a / commonFactor;
    const newB = b / commonFactor;
    const newC = c / commonFactor;

    let inner = "";
    if (newA !== 0) inner += `${newA === 1 ? "" : newA === -1 ? "-" : newA}x^2`;
    if (newB !== 0) inner += `${newB > 0 && inner ? " + " : newB < 0 ? " - " : ""}${Math.abs(newB) === 1 ? "" : Math.abs(newB)}x`;
    if (newC !== 0) inner += `${newC > 0 && inner ? " + " : newC < 0 ? " - " : ""}${Math.abs(newC)}`;

    const result = `${commonFactor}(${inner.trim()})`;
    steps.push(`Result: ${result}.`);

    return { result: formatQuadraticOutput(result), steps };
  };

  const handleEnter = () => {
    if (!expression.trim()) return;

    const originalExpression = expression.trim();
    let result = "";
    let steps = [];

    try {
      if (mode === "integer") {
        const num = parseInt(originalExpression.replace(/,/g, "").trim());
        if (!isNaN(num)) {
          const factorResult = primeFactorize(num);
          result = factorResult.result;
          steps = factorResult.steps;
        } else {
          result = "Enter a valid integer.";
        }
      } else if (mode === "gcd") {
        const evalExpr = convertSymbolsForEvaluation(originalExpression);
        const nums = evalExpr.split(",").map(s => parseInt(s.trim()));
        if (nums.length === 2 && nums.every(n => !isNaN(n))) {
          const gcdResult = gcd(nums[0], nums[1]);
          result = gcdResult.result;
          steps = gcdResult.steps;
        } else {
          result = "Enter two integers separated by comma.";
        }
      } else if (mode === "lcm") {
        const evalExpr = convertSymbolsForEvaluation(originalExpression);
        const nums = evalExpr.split(",").map(s => parseInt(s.trim()));
        if (nums.length === 2 && nums.every(n => !isNaN(n))) {
          const lcmResult = lcm(nums[0], nums[1]);
          result = lcmResult.result;
          steps = lcmResult.steps;
        } else {
          result = "Enter two integers separated by comma.";
        }
      } else if (mode === "divisors") {
        const num = parseInt(originalExpression.replace(/,/g, "").trim());
        if (!isNaN(num)) {
          const divResult = divisors(num);
          result = divResult.result;
          steps = divResult.steps;
        } else {
          result = "Enter a valid integer.";
        }
      } else if (mode === "polynomial") {
        const factorResult = factorQuadratic(originalExpression);
        result = factorResult.result;
        steps = factorResult.steps;
      } else if (mode === "gcf") {
        const factorResult = factorCommon(originalExpression);
        result = factorResult.result;
        steps = factorResult.steps;
      }
    } catch (error) {
      result = "Error processing expression.";
      steps = [error.message];
    }

    setHistory((prev) => [...prev, { expression: originalExpression, result, steps, mode }]);
    setExpression("");
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
    if (e.key === "Enter") {
      e.preventDefault();
      handleEnter();
    } else if (e.key === "Escape") {
      e.preventDefault();
      clearExpression();
    }
  };

  const getPlaceholder = () => {
    switch (mode) {
      case "integer": return "Enter integer (e.g., 120)";
      case "gcd": return "Enter two integers (e.g., 48, 36)";
      case "lcm": return "Enter two integers (e.g., 12, 18)";
      case "divisors": return "Enter an integer (e.g., 36)";
      case "polynomial": return "Enter quadratic (e.g., x^2+5x+6)";
      case "gcf": return "Enter polynomial (e.g., 6x^2+12x+18)";
      default: return "Enter expression";
    }
  };

  const CalcButton = ({ onClick, children, className = "" }) => (
    <button className={"dinolabsPluginsFactoringButton " + className} onClick={onClick}>{children}</button>
  );

  return (
    <div className="dinolabsPluginsFactoringApp" onKeyDown={handleKeyPress} tabIndex={0}>
      <DinoLabsNav activePage="plugins" />

      <div className="dinolabsPluginsFactoringContainer">
        <div className="dinolabsPluginsFactoringHistory">
          {history.slice().reverse().map((item, index) => (
            <div key={index} className="dinolabsPluginsFactoringHistoryItem">
              <div className="dinolabsPluginsFactoringHistoryExpression">
                <span className="dinolabsPluginsFactoringHistoryMode">[{item.mode.toUpperCase()}]</span>
                {formatStep(item.expression)} → 
                {isErrorMessage(item.result) ? item.result : formatStep(item.result)}
              </div>
              {item.steps && item.steps.length > 0 && (
                <div className="dinolabsPluginsFactoringHistorySteps">
                  {item.steps.map((step, stepIndex) => (
                    <div key={stepIndex} className="dinolabsPluginsFactoringHistoryStep">
                      {formatStep(step)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="dinolabsPluginsFactoringInputContainer">
          <input
            ref={inputRef}
            type="text"
            className="dinolabsPluginsFactoringInput"
            value={expression}
            onChange={handleInputChange}
            placeholder={getPlaceholder()}
            autoFocus
          />
        </div>

        <div className="dinolabsPluginsFactoringTabs">
          <button
            className={"dinolabsPluginsFactoringTabButton " + (mode === "integer" ? "dinolabsPluginsFactoringTabActive" : "")}
            onClick={() => setMode("integer")}
          >
            Prime Factors
          </button>
          <button
            className={"dinolabsPluginsFactoringTabButton " + (mode === "gcd" ? "dinolabsPluginsFactoringTabActive" : "")}
            onClick={() => setMode("gcd")}
          >
            GCD
          </button>
          <button
            className={"dinolabsPluginsFactoringTabButton " + (mode === "lcm" ? "dinolabsPluginsFactoringTabActive" : "")}
            onClick={() => setMode("lcm")}
          >
            LCM
          </button>
          <button
            className={"dinolabsPluginsFactoringTabButton " + (mode === "divisors" ? "dinolabsPluginsFactoringTabActive" : "")}
            onClick={() => setMode("divisors")}
          >
            Divisors
          </button>
          <button
            className={"dinolabsPluginsFactoringTabButton " + (mode === "polynomial" ? "dinolabsPluginsFactoringTabActive" : "")}
            onClick={() => setMode("polynomial")}
          >
            Quadratic
          </button>
          <button
            className={"dinolabsPluginsFactoringTabButton " + (mode === "gcf" ? "dinolabsPluginsFactoringTabActive" : "")}
            onClick={() => setMode("gcf")}
          >
            Factor GCF
          </button>
        </div>

        <div className="dinolabsPluginsFactoringKeyboard">
          <div className="dinolabsPluginsFactoringKeyboardMain">
            <div className="dinolabsPluginsFactoringKeyboardRow">
              <CalcButton onClick={() => appendToExpression("1")} className="dinolabsPluginsFactoringNumber">1</CalcButton>
              <CalcButton onClick={() => appendToExpression("2")} className="dinolabsPluginsFactoringNumber">2</CalcButton>
              <CalcButton onClick={() => appendToExpression("3")} className="dinolabsPluginsFactoringNumber">3</CalcButton>
              <CalcButton onClick={() => appendToExpression("4")} className="dinolabsPluginsFactoringNumber">4</CalcButton>
              <CalcButton onClick={() => appendToExpression("5")} className="dinolabsPluginsFactoringNumber">5</CalcButton>
              <CalcButton onClick={() => appendToExpression("6")} className="dinolabsPluginsFactoringNumber">6</CalcButton>
              <CalcButton onClick={() => appendToExpression("7")} className="dinolabsPluginsFactoringNumber">7</CalcButton>
              <CalcButton onClick={() => appendToExpression("8")} className="dinolabsPluginsFactoringNumber">8</CalcButton>
              <CalcButton onClick={() => appendToExpression("9")} className="dinolabsPluginsFactoringNumber">9</CalcButton>
              <CalcButton onClick={() => appendToExpression("0")} className="dinolabsPluginsFactoringNumber">0</CalcButton>
            </div>
            <div className="dinolabsPluginsFactoringKeyboardRow">
              <CalcButton onClick={() => appendToExpression("(")} className="dinolabsPluginsFactoringOperator">(</CalcButton>
              <CalcButton onClick={() => appendToExpression(")")} className="dinolabsPluginsFactoringOperator">)</CalcButton>
              <CalcButton onClick={() => appendToExpression("+")} className="dinolabsPluginsFactoringOperator">+</CalcButton>
              <CalcButton onClick={() => appendToExpression("-")} className="dinolabsPluginsFactoringOperator">−</CalcButton>
              <CalcButton onClick={() => appendToExpression("x")} className="dinolabsPluginsFactoringVariable">x</CalcButton>
              <CalcButton onClick={() => appendToExpression("^")} className="dinolabsPluginsFactoringOperator">^</CalcButton>
              <CalcButton onClick={() => appendToExpression(",")} className="dinolabsPluginsFactoringOperator">,</CalcButton>
              <CalcButton onClick={() => appendToExpression(" ")} className="dinolabsPluginsFactoringOperator">␣</CalcButton>
            </div>
          </div>

          <div className="dinolabsPluginsFactoringKeyboardFunctions">
            <div className="dinolabsPluginsFactoringKeyboardRow">
              <CalcButton onClick={() => setMode("gcd")} className="dinolabsPluginsFactoringFunction">gcd</CalcButton>
              <CalcButton onClick={() => setMode("lcm")} className="dinolabsPluginsFactoringFunction">lcm</CalcButton>
              <CalcButton onClick={() => setMode("divisors")} className="dinolabsPluginsFactoringFunction">div</CalcButton>
            </div>
          </div>

          <div className="dinolabsPluginsFactoringKeyboardVariables">
            <div className="dinolabsPluginsFactoringKeyboardRow">
              <CalcButton onClick={() => appendToExpression("x")} className="dinolabsPluginsFactoringVariable">x</CalcButton>
              <CalcButton onClick={() => appendToExpression("x^2")} className="dinolabsPluginsFactoringVariable">x²</CalcButton>
            </div>
            <div className="dinolabsPluginsFactoringKeyboardRow">
              <CalcButton onClick={() => appendToExpression("y")} className="dinolabsPluginsFactoringVariable">y</CalcButton>
              <CalcButton onClick={() => appendToExpression("x^3")} className="dinolabsPluginsFactoringVariable">x³</CalcButton>
            </div>
            <div className="dinolabsPluginsFactoringKeyboardRow">
              <CalcButton onClick={() => appendToExpression("z")} className="dinolabsPluginsFactoringVariable">z</CalcButton>
              <CalcButton onClick={() => appendToExpression("x^")} className="dinolabsPluginsFactoringVariable">xⁿ</CalcButton>
            </div>
          </div>

          <div className="dinolabsPluginsFactoringKeyboardControls">
            <div className="dinolabsPluginsFactoringKeyboardRow">
              <CalcButton onClick={deleteLast} className="dinolabsPluginsFactoringControl">⌫</CalcButton>
            </div>
            <div className="dinolabsPluginsFactoringKeyboardRow">
              <CalcButton onClick={clearExpression} className="dinolabsPluginsFactoringControl">Clear</CalcButton>
            </div>
            <div className="dinolabsPluginsFactoringKeyboardRow">
              <CalcButton onClick={handleEnter} className="dinolabsPluginsFactoringControl dinolabsPluginsFactoringEnter">Factor</CalcButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}