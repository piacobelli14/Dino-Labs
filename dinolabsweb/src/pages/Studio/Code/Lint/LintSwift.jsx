import { lintBraceLanguage, sortErrors } from "../LintCore.jsx";

const KEYWORDS = new Set([
    "associatedtype", "class", "deinit", "enum", "extension", "fileprivate", "func", "import",
    "init", "inout", "internal", "let", "open", "operator", "private", "protocol",
    "public", "rethrows", "static", "struct", "subscript", "typealias", "var", "break",
    "case", "continue", "default", "defer", "do", "else", "fallthrough", "for",
    "guard", "if", "in", "repeat", "return", "switch", "where", "while",
    "as", "Any", "catch", "false", "is", "nil", "super", "self",
    "Self", "throw", "throws", "true", "try"
]);

function lintSwift(code) {
    const errors = lintBraceLanguage(code, {
        lineComment: "//",
        blockComment: ["/*", "*/"],
        stringDelimiters: ["\"", "'"],
        keywords: KEYWORDS,
        controlKeywords: new Set()
    });

    const codeLines = code.split(/\r?\n/);

    for (let i = 0; i < codeLines.length; i++) {
        const ln = codeLines[i];
        const trimmed = ln.trim();

        if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
            continue;
        }

        if (/\btry!\s/.test(trimmed)) {
            errors.push({
                line: i + 1,
                col: ln.indexOf("try!") + 1,
                message: "'try!' crashes when the call throws, so use 'try?' or a do/catch block."
            });
        }

    }

    return sortErrors(errors);
}

export { lintSwift };