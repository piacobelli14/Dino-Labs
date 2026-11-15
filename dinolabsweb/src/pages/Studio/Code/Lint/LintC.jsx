import { lintBraceLanguage, sortErrors } from "../LintCore.jsx";

const KEYWORDS = new Set([
    "auto", "break", "case", "char", "const", "continue", "default", "do",
    "double", "else", "enum", "extern", "float", "for", "goto", "if",
    "inline", "int", "long", "register", "restrict", "return", "short", "signed",
    "sizeof", "static", "struct", "switch", "typedef", "union", "unsigned", "void",
    "volatile", "while"
]);

function lintC(code) {
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

        if (/^#\s*include\b/.test(trimmed) && !/^#\s*include\s*(?:<[^>]+>|"[^"]+")/.test(trimmed)) {
            errors.push({
                line: i + 1,
                col: 1,
                message: "An include directive needs angle brackets or quotes."
            });
        }

        if (/\b(?:if|while)\s*\([^=!<>]*[^=!<>]=[^=]/.test(trimmed) && !/==/.test(trimmed)) {
            errors.push({
                line: i + 1,
                col: ln.indexOf("=") + 1,
                message: "This condition contains an assignment; did you mean '=='?"
            });
        }

        if (/\bgets\s*\(/.test(trimmed)) {
            errors.push({
                line: i + 1,
                col: ln.indexOf("gets") + 1,
                message: "'gets' cannot bound its input, so use 'fgets' instead."
            });
        }
    }

    return sortErrors(errors);
}

export { lintC };