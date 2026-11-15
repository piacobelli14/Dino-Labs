import { sortErrors } from "../LintCore.jsx";
import { lintJavaScript } from "./LintJavaScript.jsx";

const TS_KEYWORDS = new Set([
    "interface", "type", "enum", "namespace", "declare", "abstract", "implements",
    "public", "private", "protected", "readonly", "override", "satisfies", "asserts",
    "infer", "keyof", "is", "out", "unique", "module", "global"
]);

const TS_TYPES = new Set([
    "any", "unknown", "never", "void", "number", "string", "boolean", "object",
    "symbol", "bigint", "Array", "Record", "Partial", "Required", "Readonly",
    "Pick", "Omit", "Exclude", "Extract", "NonNullable", "ReturnType", "Parameters",
    "InstanceType", "Awaited", "ThisType", "Uppercase", "Lowercase", "Capitalize"
]);

function lintTypeScript(code) {
    const errors = lintJavaScript(code, {
        extraReserved: TS_KEYWORDS,
        extraGlobals: TS_TYPES
    });
    const codeLines = code.split(/\r?\n/);

    let inBlockComment = false;

    for (let i = 0; i < codeLines.length; i++) {
        const raw = codeLines[i];
        const trimmed = raw.trim();

        if (inBlockComment) {
            if (trimmed.includes("*/")) inBlockComment = false;
            continue;
        }

        if (trimmed.startsWith("/*")) {
            if (!trimmed.includes("*/")) inBlockComment = true;
            continue;
        }

        if (trimmed === "" || trimmed.startsWith("//")) {
            continue;
        }

    }

    return sortErrors(errors);
}

export { lintTypeScript };