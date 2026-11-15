import { tokenizeSource, checkBalance, checkIndentation, sortErrors } from "../LintCore.jsx";

const LENGTH_UNITS = new Set([
    "px", "em", "rem", "vh", "vw", "vmin", "vmax", "%", "pt", "pc", "in", "cm",
    "mm", "ex", "ch", "fr", "deg", "rad", "turn", "s", "ms", "dpi", "dppx"
]);

const KNOWN_AT_RULES = new Set([
    "media", "supports", "keyframes", "font-face", "import", "charset", "namespace",
    "page", "layer", "container", "property", "counter-style", "scope", "starting-style"
]);

const UNITLESS_PROPERTIES = /^(?:z-index|opacity|flex|flex-grow|flex-shrink|order|line-height|font-weight|columns|column-count|zoom|scale|aspect-ratio|grid-row|grid-column|counter-increment|counter-reset|tab-size|orphans|widows|animation-iteration-count|stroke-width|stroke-dashoffset|flood-opacity|fill-opacity|stop-opacity)$/;

function isUnitlessProperty(property) {
    return UNITLESS_PROPERTIES.test(String(property).replace(/^-(?:moz|webkit|ms|o)-/, ""));
}

function lintCSS(code) {
    const errors = [];

    const scan = tokenizeSource(code, {
        lineComment: null,
        blockComment: ["/*", "*/"],
        stringDelimiters: ["\"", "'"],
        templateDelimiter: null,
        allowRegex: false
    });

    errors.push(...scan.errors);
    errors.push(...checkBalance(scan.tokens));
    errors.push(...checkIndentation(code));

    const codeLines = code.split(/\r?\n/);
    const seenSelectors = new Map();

    let depth = 0;
    let inComment = false;
    let pendingValue = false;
    let pendingValueLine = 0;
    let pendingValueCol = 0;
    let currentSelector = null;
    let declarations = null;

    for (let i = 0; i < codeLines.length; i++) {
        const raw = codeLines[i];
        const lineNumber = i + 1;
        let trimmed = raw.trim();

        if (inComment) {
            if (trimmed.includes("*/")) {
                inComment = false;
                trimmed = trimmed.slice(trimmed.indexOf("*/") + 2).trim();
            } else {
                continue;
            }
        }

        if (trimmed.includes("/*") && !trimmed.includes("*/")) {
            inComment = true;
            trimmed = trimmed.slice(0, trimmed.indexOf("/*")).trim();
        }

        trimmed = trimmed.replace(/\/\*.*?\*\//g, "").trim();

        if (trimmed === "") {
            continue;
        }

        if (pendingValue) {
            if (trimmed.includes("}")) {
                errors.push({
                    line: pendingValueLine,
                    col: pendingValueCol,
                    message: "This declaration is missing its semicolon."
                });

                pendingValue = false;
            } else {
                if (trimmed.endsWith(";")) pendingValue = false;

                continue;
            }
        }

        if (trimmed.startsWith("}") && trimmed.length > 1) {
            errors.push({
                line: lineNumber,
                col: 1,
                message: "The closing brace must be on its own line."
            });

            depth = Math.max(0, depth - 1);
            currentSelector = null;
            declarations = null;
            trimmed = trimmed.slice(1).trim();

            if (trimmed === "") {
                continue;
            }
        }

        if (trimmed.startsWith("@")) {
            const atRule = trimmed.match(/^@([\w-]+)/);

            if (atRule && !KNOWN_AT_RULES.has(atRule[1])) {
                errors.push({
                    line: lineNumber,
                    col: raw.indexOf("@") + 1,
                    message: `'@${atRule[1]}' is not a known at-rule.`
                });
            }
        }

        const inlineRule = trimmed.match(/^([^{}]+)\{([^{}]*)\}$/);

        if (inlineRule) {
            const inlineProps = new Map();

            for (const part of inlineRule[2].split(";")) {
                const piece = part.trim();

                if (piece === "") {
                    continue;
                }

                const pair = piece.match(/^([-\w]+)\s*:\s*(.+)$/);

                if (!pair) {
                    errors.push({
                        line: lineNumber,
                        col: 1,
                        message: "This declaration is not in 'property: value' form."
                    });
                    continue;
                }

                if (inlineProps.has(pair[1])) {
                    errors.push({
                        line: lineNumber,
                        col: raw.indexOf(pair[1]) + 1,
                        message: `'${pair[1]}' is already set on this line.`
                    });
                } else {
                    inlineProps.set(pair[1], lineNumber);
                }

                const stripped = pair[2].replace(/[\w-]*\([^()]*\)/g, "");
                const bare = stripped.match(/(?:^|[\s,])(-?\d*\.?\d+)(?![\w%.)])/);

                if (bare && bare[1] !== "0" && !unitless.test(pair[1])) {
                    errors.push({
                        line: lineNumber,
                        col: raw.indexOf(bare[1]) + 1,
                        message: `The value of '${pair[1]}' is missing a unit.`
                    });
                }
            }

            continue;
        }

        if (trimmed.endsWith("{")) {
            const selector = trimmed.slice(0, -1).trim();

            if (depth === 0 && selector && !selector.startsWith("@")) {
                currentSelector = selector.replace(/\s+/g, " ");
                declarations = new Map();
            }

            depth++;
            continue;
        }

        if (/^\}+$/.test(trimmed)) {
            depth -= trimmed.length;

            if (depth < 0) {
                errors.push({
                    line: lineNumber,
                    col: 1,
                    message: "This closing brace has no matching opening brace."
                });
                depth = 0;
            }

            if (depth === 0) {
                currentSelector = null;
                declarations = null;
            }

            continue;
        }

        if (trimmed.endsWith("}") && trimmed.includes("{") === false) {
            depth--;

            if (depth <= 0) {
                depth = Math.max(0, depth);
                currentSelector = null;
                declarations = null;
            }
        }

        if (depth === 0) {
            continue;
        }

        const declaration = trimmed.match(/^([-\w]+)\s*:\s*(.*?)\s*;?$/);

        if (!declaration) {
            if (!trimmed.endsWith(",") && !trimmed.endsWith("{") && !trimmed.startsWith("@")) {
                errors.push({
                    line: lineNumber,
                    col: 1,
                    message: "This declaration is not in 'property: value' form."
                });
            }
            continue;
        }

        const property = declaration[1];
        const value = declaration[2];

        if (value === "") {
            pendingValue = true;
            pendingValueLine = lineNumber;
            pendingValueCol = raw.length;

            if (declarations && declarations.has(property)) {
                errors.push({
                    line: lineNumber,
                    col: 1,
                    message: `'${property}' is already set at line ${declarations.get(property)}.`
                });
            } else if (declarations) {
                declarations.set(property, lineNumber);
            }

            continue;
        }

        const openParens = (trimmed.match(/\(/g) || []).length;
        const closeParens = (trimmed.match(/\)/g) || []).length;

        const valueContinues = openParens > closeParens
            || (!trimmed.endsWith(";") && !trimmed.endsWith("}") && !trimmed.endsWith("{"));

        if (valueContinues) {
            pendingValue = true;
            pendingValueLine = lineNumber;
            pendingValueCol = raw.length;
        }

        if (declarations) {
            if (declarations.has(property)) {
                errors.push({
                    line: lineNumber,
                    col: raw.indexOf(property) + 1,
                    message: `'${property}' is already set at line ${declarations.get(property)}.`
                });
            } else {
                declarations.set(property, lineNumber);
            }
        }

        if (value === "") {
            errors.push({
                line: lineNumber,
                col: raw.indexOf(":") + 1,
                message: `'${property}' has no value.`
            });
        }

        const withoutFunctions = value.replace(/[\w-]*\([^()]*(?:\([^()]*\)[^()]*)*\)/g, "");
        const bareNumber = withoutFunctions.match(/(?:^|[\s,])(-?\d*\.?\d+)(?![\w%.)])/);

        if (bareNumber && !isUnitlessProperty(property)) {
            if (bareNumber[1] !== "0") {
                errors.push({
                    line: lineNumber,
                    col: raw.indexOf(bareNumber[1]) + 1,
                    message: `The value of '${property}' is missing a unit.`
                });
            }
        }

        const hex = value.match(/#([0-9a-fA-F]+)\b/);

        if (hex && ![3, 4, 6, 8].includes(hex[1].length)) {
            errors.push({
                line: lineNumber,
                col: raw.indexOf(hex[0]) + 1,
                message: `'${hex[0]}' is not a valid hex colour.`
            });
        }

        if (/\bcolor\s*:\s*#[0-9a-fA-F]{3,8}\s*;?\s*$/.test(trimmed) === false && /url\(\s*\)/.test(value)) {
            errors.push({
                line: lineNumber,
                col: raw.indexOf("url(") + 1,
                message: "This url() is empty."
            });
        }
    }

    if (depth > 0) {
        errors.push({
            line: codeLines.length,
            col: 1,
            message: "This rule block is never closed."
        });
    }

    return sortErrors(errors);
}

export { lintCSS };