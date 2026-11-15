import { sortErrors } from "../LintCore.jsx";

const VOID_ELEMENTS = new Set([
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr"
]);

function lintXML(code) {
    const errors = [];
    const stack = [];
    let line = 1;
    let col = 0;
    let i = 0;

    while (i < code.length) {
        const char = code[i];

        if (char === "\n") {
            line++;
            col = 0;
            i++;
            continue;
        }
        col++;

        if (char === "<" && code.startsWith("<!--", i)) {
            const end = code.indexOf("-->", i + 4);
            if (end === -1) {
                errors.push({ line, col, message: "This comment is never closed." });
                break;
            }
            for (let j = i; j < end + 3; j++) {
                if (code[j] === "\n") {
                    line++;
                    col = 0;
                } else {
                    col++;
                }
            }
            i = end + 3;
            continue;
        }

        if (char === "<" && code.startsWith("<![CDATA[", i)) {
            const end = code.indexOf("]]>", i + 9);
            if (end === -1) {
                errors.push({ line, col, message: "This CDATA section is never closed." });
                break;
            }
            for (let j = i; j < end + 3; j++) {
                if (code[j] === "\n") {
                    line++;
                    col = 0;
                } else {
                    col++;
                }
            }
            i = end + 3;
            continue;
        }

        if (char === "<" && (code[i + 1] === "?" || code.startsWith("<!DOCTYPE", i))) {
            const end = code.indexOf(">", i);
            if (end === -1) {
                errors.push({ line, col, message: "This declaration is never closed." });
                break;
            }
            i = end + 1;
            continue;
        }

        if (char === "<") {
            const end = code.indexOf(">", i);
            if (end === -1) {
                errors.push({ line, col, message: "This tag is never closed." });
                break;
            }

            const raw = code.slice(i + 1, end);
            const tagLine = line;
            const tagCol = col;

            const quotes = raw.match(/"/g);
            if (quotes && quotes.length % 2 !== 0) {
                errors.push({ line: tagLine, col: tagCol, message: "This attribute value is never closed." });
            }

            const isClosing = raw.startsWith("/");
            const isSelfClosing = raw.endsWith("/");
            const nameMatch = raw.replace(/^\//, "").match(/^[A-Za-z_][\w.-]*(?::[\w.-]+)?/);
            const name = nameMatch ? nameMatch[0] : "";

            if (!name) {
                errors.push({ line: tagLine, col: tagCol, message: "This tag name is malformed." });
            } else if (isClosing) {
                if (stack.length === 0) {
                    errors.push({
                        line: tagLine,
                        col: tagCol,
                        message: `The closing tag '</${name}>' has no matching opening tag.`
                    });
                } else {
                    const last = stack.pop();
                    if (last.name !== name) {
                        errors.push({
                            line: tagLine,
                            col: tagCol,
                            message: `'</${name}>' does not close the '<${last.name}>' opened at line ${last.line}, column ${last.col}.`
                        });
                    }
                }
            } else if (!isSelfClosing && !VOID_ELEMENTS.has(name.toLowerCase())) {
                stack.push({ name, line: tagLine, col: tagCol });
            }

            for (let j = i; j < end + 1; j++) {
                if (code[j] === "\n") {
                    line++;
                    col = 0;
                } else {
                    col++;
                }
            }
            i = end + 1;
            continue;
        }

        if (char === "&") {
            const end = code.indexOf(";", i);
            const entity = end === -1 ? "" : code.slice(i, end + 1);
            if (!entity || end - i > 12 || !/^&(?:[A-Za-z][A-Za-z0-9]*|#\d+|#[xX][0-9A-Fa-f]+);$/.test(entity)) {
                errors.push({ line, col, message: "This entity reference is malformed." });
            }
        }

        i++;
    }

    while (stack.length > 0) {
        const unclosed = stack.pop();
        errors.push({
            line: unclosed.line,
            col: unclosed.col,
            message: `The tag '<${unclosed.name}>' is never closed.`
        });
    }

    const codeLines = code.split(/\r?\n/);

    for (let n = 0; n < codeLines.length; n++) {
        const ln = codeLines[n];
        const lineNumber = n + 1;
        if (/^\s*$/.test(ln)) continue;

        const leadingWhitespaceMatch = ln.match(/^[ \t]*/);
        const leadingWhitespace = leadingWhitespaceMatch ? leadingWhitespaceMatch[0] : "";
        if (leadingWhitespace.includes(" ") && leadingWhitespace.includes("\t")) {
            errors.push({
                line: lineNumber,
                col: 1,
                message: "This line mixes tabs and spaces in its indentation."
            });
        }
    }

    return sortErrors(errors);
}

export { lintXML };