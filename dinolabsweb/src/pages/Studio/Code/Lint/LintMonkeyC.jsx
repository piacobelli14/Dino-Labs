import { lintBraceLanguage, sortErrors } from "../LintCore.jsx";

const KEYWORDS = new Set([
    "and", "as", "break", "case", "catch", "class", "const", "continue",
    "default", "do", "else", "enum", "extends", "finally", "for", "function",
    "has", "hidden", "if", "import", "instanceof", "module", "native", "new",
    "null", "or", "private", "protected", "public", "return", "self", "static",
    "switch", "throw", "try", "using", "var", "while"
]);

function lintMonkeyC(code) {
    const errors = lintBraceLanguage(code, {
        lineComment: "//",
        blockComment: ["/*", "*/"],
        stringDelimiters: ["\"", "'"],
        keywords: KEYWORDS,
        controlKeywords: new Set(["if", "while", "switch"])
    });

    const codeLines = code.split(/\r?\n/);

    for (let i = 0; i < codeLines.length; i++) {
        const ln = codeLines[i];
        const trimmed = ln.trim();

        if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
            continue;
        }

        if (/\bvar\s+[A-Za-z_]\w*\s*;/.test(trimmed)) {
            errors.push({
                line: i + 1,
                col: ln.indexOf("var") + 1,
                message: "This declaration has no initial value."
            });
        }
    }

    return sortErrors(errors);
}

export { lintMonkeyC };