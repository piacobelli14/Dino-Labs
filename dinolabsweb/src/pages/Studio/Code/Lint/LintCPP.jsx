import { lintBraceLanguage, sortErrors } from "../LintCore.jsx";

const KEYWORDS = new Set([
    "alignas", "alignof", "auto", "bool", "break", "case", "catch", "char",
    "class", "const", "constexpr", "continue", "decltype", "default", "delete", "do",
    "double", "else", "enum", "explicit", "export", "extern", "false", "float",
    "for", "friend", "goto", "if", "inline", "int", "long", "mutable",
    "namespace", "new", "noexcept", "nullptr", "operator", "private", "protected", "public",
    "return", "short", "signed", "sizeof", "static", "struct", "switch", "template",
    "this", "throw", "true", "try", "typedef", "typename", "union", "unsigned",
    "using", "virtual", "void", "volatile", "while"
]);

function lintCPP(code) {
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

        if (/\b(?:if|while)\s*\([A-Za-z_][\w.]*\s*=\s*[^=]/.test(trimmed)) {
            errors.push({
                line: i + 1,
                col: ln.indexOf("=") + 1,
                message: "This condition contains an assignment; did you mean '=='?"
            });
        }
    }

    return sortErrors(errors);
}

export { lintCPP };