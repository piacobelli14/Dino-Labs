import { lintBraceLanguage, sortErrors } from "../LintCore.jsx";

const KEYWORDS = new Set([
    "abstract", "as", "base", "bool", "break", "byte", "case", "catch",
    "char", "checked", "class", "const", "continue", "decimal", "default", "delegate",
    "do", "double", "else", "enum", "event", "explicit", "extern", "false",
    "finally", "fixed", "float", "for", "foreach", "goto", "if", "implicit",
    "in", "int", "interface", "internal", "is", "lock", "long", "namespace",
    "new", "null", "object", "operator", "out", "override", "params", "private",
    "protected", "public", "readonly", "ref", "return", "sbyte", "sealed", "short",
    "sizeof", "stackalloc", "static", "string", "struct", "switch", "this", "throw",
    "true", "try", "typeof", "uint", "ulong", "unchecked", "unsafe", "ushort",
    "using", "var", "virtual", "void", "volatile", "while"
]);

function lintCSharp(code) {
    const errors = lintBraceLanguage(code, {
        lineComment: "//",
        blockComment: ["/*", "*/"],
        stringDelimiters: ["\"", "'"],
        keywords: KEYWORDS
    });

    const codeLines = code.split(/\r?\n/);

    for (let i = 0; i < codeLines.length; i++) {
        const ln = codeLines[i];
        const trimmed = ln.trim();

        if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
            continue;
        }

        if (/\bcatch\s*\(\s*\)/.test(trimmed) || /\bcatch\s*\{/.test(trimmed)) {
            errors.push({
                line: i + 1,
                col: ln.indexOf("catch") + 1,
                message: "This catch clause swallows every exception."
            });
        }

        if (/\bpublic\s+(?:static\s+)?[A-Za-z_][\w<>\[\]]*\s+[a-z]/.test(trimmed)) {
            const nameMatch = trimmed.match(/\bpublic\s+(?:static\s+)?[A-Za-z_][\w<>\[\]]*\s+([a-z]\w*)/);

        }
    }

    return sortErrors(errors);
}

export { lintCSharp };