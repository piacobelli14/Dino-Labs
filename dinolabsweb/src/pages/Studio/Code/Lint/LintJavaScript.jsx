import { tokenizeSource, checkBalance, checkIndentation, sortErrors } from "../LintCore.jsx";

const RESERVED = new Set([
    "break", "case", "catch", "class", "const", "continue", "debugger", "default",
    "delete", "do", "else", "export", "extends", "finally", "for", "function", "if",
    "import", "in", "instanceof", "new", "return", "super", "switch", "this", "throw",
    "try", "typeof", "var", "void", "while", "with", "yield", "let", "static", "async",
    "await", "of", "from", "as"
]);

const GLOBALS = new Set([
    "console", "window", "document", "globalThis", "process", "module", "exports",
    "require", "Math", "JSON", "Object", "Array", "String", "Number", "Boolean",
    "Date", "RegExp", "Error", "TypeError", "RangeError", "Promise", "Symbol", "Map",
    "Set", "WeakMap", "WeakSet", "Proxy", "Reflect", "BigInt", "Infinity", "NaN",
    "undefined", "null", "true", "false", "setTimeout", "clearTimeout", "setInterval",
    "clearInterval", "requestAnimationFrame", "cancelAnimationFrame", "fetch", "URL",
    "URLSearchParams", "Intl", "localStorage", "sessionStorage", "navigator", "location",
    "history", "alert", "confirm", "prompt", "atob", "btoa", "structuredClone",
    "AbortController", "Blob", "File", "FileReader", "FormData", "Headers", "Request",
    "Response", "TextDecoder", "TextEncoder", "Worker", "arguments", "isNaN",
    "parseInt", "parseFloat", "encodeURIComponent", "decodeURIComponent", "queueMicrotask",
    "isFinite", "getComputedStyle", "matchMedia", "ResizeObserver", "IntersectionObserver",
    "MutationObserver", "performance", "crypto", "screen", "Element", "HTMLElement",
    "Node", "NodeList", "Event", "CustomEvent", "KeyboardEvent", "MouseEvent",
    "DataTransfer", "Image", "Audio", "Video", "Canvas", "CanvasRenderingContext2D",
    "WebSocket", "EventSource", "Notification", "indexedDB", "caches", "escape",
    "unescape", "Function", "Int8Array", "Uint8Array", "Uint8ClampedArray",
    "Int16Array", "Uint16Array", "Int32Array", "Uint32Array", "Float32Array",
    "Float64Array", "ArrayBuffer", "DataView", "Atomics", "SharedArrayBuffer",
    "EvalError", "ReferenceError", "SyntaxError", "URIError", "AggregateError",
    "FinalizationRegistry", "WeakRef", "Buffer", "__dirname", "__filename",
    "global", "self", "top", "parent", "frames", "opener", "closed", "scrollTo",
    "scrollBy", "getSelection", "DOMParser", "XMLSerializer", "XMLHttpRequest",
    "AbortSignal", "ReadableStream", "WritableStream", "TransformStream"
]);

const CONTROL_KEYWORDS = new Set(["if", "for", "while", "switch", "catch"]);

function lintJavaScript(code, options) {
    const settings = options || {};
    const extraGlobals = settings.extraGlobals || new Set();
    const extraReserved = settings.extraReserved || new Set();
    const known = new Set([...GLOBALS, ...extraGlobals]);
    const reserved = new Set([...RESERVED, ...extraReserved]);
    const errors = [];

    const scan = tokenizeSource(code, {
        lineComment: "//",
        blockComment: ["/*", "*/"],
        stringDelimiters: ["\"", "'"],
        templateDelimiter: "`",
        allowRegex: true
    });

    errors.push(...scan.errors);
    errors.push(...checkBalance(scan.tokens));
    errors.push(...checkIndentation(code));

    const meaningful = scan.tokens.filter((token) => token.type !== "comment");

    for (let i = 0; i < meaningful.length; i++) {
        const token = meaningful[i];
        const prev = meaningful[i - 1];
        const next = meaningful[i + 1];

        if (token.type === "punctuation" && token.value === "=" && next && next.type === "punctuation" && next.value === "=") {
            const third = meaningful[i + 2];
            const chained = prev && (prev.value === "=" || prev.value === "!" || prev.value === "<" || prev.value === ">");

            const comparand = meaningful[i + 2];
            const nullCheck = comparand && (comparand.value === "null" || comparand.value === "undefined");

            if (!chained && !nullCheck && (!third || third.value !== "=")) {
                errors.push({
                    line: token.line,
                    col: token.col,
                    message: "Use '===' here so the comparison does not coerce types."
                });
            }
        }

        if (token.type === "punctuation" && token.value === "!" && next && next.type === "punctuation" && next.value === "=") {
            const third = meaningful[i + 2];
            const nullCheck = third && (third.value === "null" || third.value === "undefined");

            if (!nullCheck && (!third || third.value !== "=")) {
                errors.push({
                    line: token.line,
                    col: token.col,
                    message: "Use '!==' here so the comparison does not coerce types."
                });
            }
        }

        if (token.type === "identifier" && token.value === "debugger") {
            errors.push({
                line: token.line,
                col: token.col,
                message: "This 'debugger' statement was left in the code."
            });
        }

        if (token.type === "identifier" && CONTROL_KEYWORDS.has(token.value)) {
            const isMember = prev && (prev.value === "." || prev.value === "?");
            const forAwait = token.value === "for" && next && next.value === "await";
            const bareCatch = token.value === "catch" && next && next.value === "{";

            if (!isMember && !forAwait && !bareCatch && (!next || next.value !== "(")) {
                errors.push({
                    line: token.line,
                    col: token.col,
                    message: `'${token.value}' must be followed by a condition in parentheses.`
                });
            }
        }
    }

    const codeLines = code.split(/\r?\n/);

    for (let i = 0; i < codeLines.length; i++) {
        const ln = codeLines[i];
        const trimmed = ln.trim();

        if (trimmed.startsWith("//")) {
            continue;
        }

        const head = trimmed.match(/^(?:if|for|while)\s*\(/);

        if (head) {
            let cursor = trimmed.indexOf("(");
            let depth = 0;

            while (cursor < trimmed.length) {
                if (trimmed[cursor] === "(") depth++;
                if (trimmed[cursor] === ")") {
                    depth--;
                    if (depth === 0) break;
                }
                cursor++;
            }

            const tail = trimmed.slice(cursor + 1).trim();

            if (tail === ";") {
                errors.push({
                    line: i + 1,
                    col: ln.lastIndexOf(";") + 1,
                    message: "This statement has an empty body, so it does nothing."
                });
            }
        }

        if (/\bwith\s*\(/.test(trimmed)) {
            errors.push({
                line: i + 1,
                col: ln.indexOf("with") + 1,
                message: "'with' is not allowed in strict mode."
            });
        }
    }

    return sortErrors(errors);
}

export { lintJavaScript };