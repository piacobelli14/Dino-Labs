import { tokenizeSource, checkBalance, sortErrors } from "../LintCore.jsx";

const BUILTINS = new Set([
    "abs", "all", "any", "ascii", "bin", "bool", "bytearray", "bytes", "callable",
    "chr", "classmethod", "compile", "complex", "delattr", "dict", "dir", "divmod",
    "enumerate", "eval", "exec", "filter", "float", "format", "frozenset", "getattr",
    "globals", "hasattr", "hash", "help", "hex", "id", "input", "int", "isinstance",
    "issubclass", "iter", "len", "list", "locals", "map", "max", "memoryview", "min",
    "next", "object", "oct", "open", "ord", "pow", "print", "property", "range",
    "repr", "reversed", "round", "set", "setattr", "slice", "sorted", "staticmethod",
    "str", "sum", "super", "tuple", "type", "vars", "zip", "__name__", "__file__",
    "__doc__", "self", "cls", "True", "False", "None", "Exception", "ValueError",
    "TypeError", "KeyError", "IndexError", "AttributeError", "RuntimeError", "OSError",
    "StopIteration", "NotImplementedError", "ZeroDivisionError", "FileNotFoundError"
]);

const KEYWORDS = new Set([
    "and", "as", "assert", "async", "await", "break", "class", "continue", "def",
    "del", "elif", "else", "except", "finally", "for", "from", "global", "if",
    "import", "in", "is", "lambda", "nonlocal", "not", "or", "pass", "raise",
    "return", "try", "while", "with", "yield", "match", "case"
]);

function countUnclosedBrackets(text) {
    let depth = 0;
    let quote = null;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (quote) {
            if (char === "\\") { i++; continue; }
            if (char === quote) quote = null;
            continue;
        }

        if (char === "\"" || char === "'") { quote = char; continue; }
        if (char === "#") break;
        if (char === "(" || char === "[" || char === "{") depth++;
        if (char === ")" || char === "]" || char === "}") depth--;
    }

    return depth;
}

const BLOCK_STARTERS = /^(?:if|elif|else|for|while|def|class|try|except|finally|with|async\s+def|async\s+with|async\s+for|match|case)\b/;
const SOFT_KEYWORD_EXPRESSION = /^(?:match|case)\b\s*(?:[=.([]|$)/;

function hasTopLevelColon(text) {
    let depth = 0;
    let quote = null;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (quote) {
            if (char === "\\") { i++; continue; }
            if (char === quote) quote = null;
            continue;
        }

        if (char === "\"" || char === "'") { quote = char; continue; }
        if (char === "#") break;
        if (char === "(" || char === "[" || char === "{") depth++;
        if (char === ")" || char === "]" || char === "}") depth--;
        if (char === ":" && depth === 0) return true;
    }

    return false;
}

function lintPython(code) {
    const errors = [];

    const scan = tokenizeSource(code, {
        lineComment: "#",
        blockComment: null,
        stringDelimiters: ["\"", "'"],
        templateDelimiter: null,
        tripleQuotes: true,
        allowRegex: false
    });

    errors.push(...scan.errors);
    errors.push(...checkBalance(scan.tokens));

    const codeLines = code.split(/\r?\n/);
    const indents = [];

    let bracketCarry = 0;
    const imported = new Set();
    const defined = new Set();
    const usedNames = new Map();

    let inTripleQuote = null;
    let continuation = false;

    for (let i = 0; i < codeLines.length; i++) {
        const raw = codeLines[i];
        const lineNumber = i + 1;
        const trimmed = raw.trim();

        if (inTripleQuote) {
            if (trimmed.includes(inTripleQuote)) {
                inTripleQuote = null;
            }
            continue;
        }

        const tripleMatch = trimmed.match(/("""|''')/);

        if (tripleMatch) {
            const marker = tripleMatch[1];
            const occurrences = (trimmed.match(new RegExp(marker, "g")) || []).length;

            if (occurrences % 2 !== 0) {
                inTripleQuote = marker;
                continue;
            }
        }

        if (continuation) {
            continuation = trimmed.endsWith("\\");
            continue;
        }

        if (trimmed === "" || trimmed.startsWith("#")) {
            continue;
        }

        const lead = (raw.match(/^[ \t]*/) || [""])[0];

        if (lead.includes(" ") && lead.includes("\t")) {
            errors.push({
                line: lineNumber,
                col: 1,
                message: "This line mixes tabs and spaces in its indentation."
            });
        }

        const width = lead.replace(/\t/g, "    ").length;

        while (indents.length > 0 && width < indents[indents.length - 1]) {
            indents.pop();
        }

        if (indents.length === 0 || width > indents[indents.length - 1]) {
            indents.push(width);
        }

        const openDepth = countUnclosedBrackets(trimmed);

        if (bracketCarry > 0) {
            bracketCarry += openDepth;

            if (bracketCarry < 0) bracketCarry = 0;

            continue;
        }

        if (BLOCK_STARTERS.test(trimmed) && !SOFT_KEYWORD_EXPRESSION.test(trimmed) && !trimmed.endsWith("\\") && openDepth <= 0 && !hasTopLevelColon(trimmed)) {
            errors.push({
                line: lineNumber,
                col: raw.length,
                message: "This block header is missing its colon."
            });
        }

        if (openDepth > 0) {
            bracketCarry = openDepth;
        }

        if (/^(?:def|class)\s/.test(trimmed)) {
            const nameMatch = trimmed.match(/^(?:def|class)\s+([A-Za-z_]\w*)/);

            const params = trimmed.match(/\(([^)]*)\)/);

            if (params) {
                params[1].split(",").forEach((part) => {
                    const clean = part.trim().split(/[:=]/)[0].trim().replace(/^\*+/, "");
                    if (clean) defined.add(clean);
                });
            }
        }

        const importMatch = trimmed.match(/^(?:from\s+[\w.]+\s+)?import\s+(.+)$/);

        if (importMatch) {
            importMatch[1].split(",").forEach((part) => {
                const clean = part.trim().split(/\s+as\s+/).pop().trim().split(".")[0];
                if (clean && clean !== "*") imported.add(clean);
            });
        }

        const assignMatch = trimmed.match(/^([A-Za-z_]\w*)\s*(?::[^=]+)?=(?!=)/);

        if (assignMatch) {
            defined.add(assignMatch[1]);
        }

        const forMatch = trimmed.match(/^for\s+([A-Za-z_][\w,\s]*)\s+in\s/);

        if (forMatch) {
            forMatch[1].split(",").forEach((part) => {
                const clean = part.trim();
                if (clean) defined.add(clean);
            });
        }

        const withMatch = trimmed.match(/\bas\s+([A-Za-z_]\w*)/);

        if (withMatch) {
            defined.add(withMatch[1]);
        }

        if (/^except\s*:/.test(trimmed)) {
            errors.push({
                line: lineNumber,
                col: raw.indexOf("except") + 1,
                message: "A bare 'except' catches every error, including keyboard interrupts."
            });
        }

        if (/==\s*(?:None|True|False)\b/.test(trimmed)) {
            errors.push({
                line: lineNumber,
                col: raw.indexOf("==") + 1,
                message: "Use 'is' when comparing to None, True or False."
            });
        }

        if (/(?:def|lambda)[^:]*=\s*(?:\[\]|\{\})/.test(trimmed)) {
            errors.push({
                line: lineNumber,
                col: 1,
                message: "A mutable default argument is shared between every call."
            });
        }

        const words = trimmed.match(/[A-Za-z_]\w*/g) || [];

        for (const word of words) {
            if (!KEYWORDS.has(word)) {
                usedNames.set(word, (usedNames.get(word) || 0) + 1);
            }
        }

        continuation = trimmed.endsWith("\\");
    }

    if (inTripleQuote) {
        errors.push({
            line: codeLines.length,
            col: 1,
            message: "This triple quoted string is never closed."
        });
    }

    return sortErrors(errors);
}

export { lintPython };