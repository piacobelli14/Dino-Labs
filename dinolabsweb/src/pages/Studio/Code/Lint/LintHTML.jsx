import { sortErrors } from "../LintCore.jsx";

const VOID_ELEMENTS = new Set([
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
    "meta", "param", "source", "track", "wbr"
]);

const RAW_TEXT = new Set(["script", "style", "textarea", "title"]);

const OPTIONAL_CLOSE = new Set([
    "li", "dt", "dd", "p", "option", "thead", "tbody", "tfoot",
    "tr", "td", "th", "head", "body", "html", "colgroup", "optgroup"
]);

function lintHTML(code) {
    const errors = [];
    const stack = [];
    const ids = new Map();

    let i = 0;
    let line = 1;
    let col = 1;

    const advance = (count) => {
        for (let n = 0; n < count; n++) {
            if (code[i] === "\n") {
                line++;
                col = 1;
            } else {
                col++;
            }
            i++;
        }
    };

    while (i < code.length) {
        if (code[i] !== "<") {
            advance(1);
            continue;
        }

        if (code.startsWith("<!--", i)) {
            const end = code.indexOf("-->", i + 4);

            if (end === -1) {
                errors.push({ line, col, message: "This comment is never closed." });
                break;
            }

            advance(end + 3 - i);
            continue;
        }

        if (code.startsWith("<!", i)) {
            const end = code.indexOf(">", i);

            if (end === -1) {
                errors.push({ line, col, message: "This doctype declaration is never closed." });
                break;
            }

            advance(end + 1 - i);
            continue;
        }

        const end = code.indexOf(">", i);

        if (end === -1) {
            errors.push({ line, col, message: "This tag is never closed." });
            break;
        }

        const raw = code.slice(i + 1, end);
        const tagLine = line;
        const tagCol = col;
        const isClosing = raw.startsWith("/");
        const selfClosing = raw.endsWith("/");
        const nameMatch = raw.replace(/^\//, "").match(/^[A-Za-z][\w-]*/);
        const name = nameMatch ? nameMatch[0].toLowerCase() : "";

        if (!name) {
            errors.push({ line: tagLine, col: tagCol, message: "This tag name is malformed." });
            advance(end + 1 - i);
            continue;
        }

        const quotes = (raw.match(/"/g) || []).length;

        if (quotes % 2 !== 0) {
            errors.push({ line: tagLine, col: tagCol, message: `An attribute value in '<${name}>' is never closed.` });
        }

        if (isClosing) {
            while (stack.length > 0
                && stack[stack.length - 1].name !== name
                && OPTIONAL_CLOSE.has(stack[stack.length - 1].name)) {
                stack.pop();
            }

            if (stack.length === 0) {
                errors.push({
                    line: tagLine,
                    col: tagCol,
                    message: `The closing tag '</${name}>' has no matching opening tag.`
                });
            } else {
                const open = stack.pop();

                if (open.name !== name) {
                    errors.push({
                        line: tagLine,
                        col: tagCol,
                        message: `'</${name}>' does not close the '<${open.name}>' opened at line ${open.line}.`
                    });
                }
            }

            advance(end + 1 - i);
            continue;
        }

        const attributes = raw.replace(/^[A-Za-z][\w-]*/, "");
        const seen = new Map();
        let attribute;
        const attributePattern = /([A-Za-z_:@][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

        while ((attribute = attributePattern.exec(attributes)) !== null) {
            const key = attribute[1].toLowerCase();

            if (seen.has(key)) {
                errors.push({
                    line: tagLine,
                    col: tagCol,
                    message: `The attribute '${key}' is repeated on '<${name}>'.`
                });
            } else {
                seen.set(key, true);
            }

            const value = attribute[2] !== undefined ? attribute[2] : attribute[3];

            if (key === "id" && value) {
                if (ids.has(value)) {
                    errors.push({
                        line: tagLine,
                        col: tagCol,
                        message: `The id '${value}' is already used at line ${ids.get(value)}.`
                    });
                } else {
                    ids.set(value, tagLine);
                }
            }

            if (attribute[4] !== undefined && /[^\w.#/:-]/.test(attribute[4])) {
                errors.push({
                    line: tagLine,
                    col: tagCol,
                    message: `The value of '${key}' must be quoted.`
                });
            }
        }

        if (VOID_ELEMENTS.has(name)) {
            advance(end + 1 - i);
            continue;
        }

        if (selfClosing) {
            advance(end + 1 - i);
            continue;
        }

        if (OPTIONAL_CLOSE.has(name)) {
            while (stack.length > 0 && stack[stack.length - 1].name === name) {
                stack.pop();
            }
        }

        stack.push({ name, line: tagLine, col: tagCol });
        advance(end + 1 - i);

        if (RAW_TEXT.has(name)) {
            const closeTag = `</${name}`;
            const closeAt = code.toLowerCase().indexOf(closeTag, i);

            if (closeAt === -1) {
                errors.push({
                    line: tagLine,
                    col: tagCol,
                    message: `The tag '<${name}>' is never closed.`
                });
                break;
            }

            advance(closeAt - i);
        }
    }

    for (const open of stack.reverse()) {
        if (OPTIONAL_CLOSE.has(open.name)) {
            continue;
        }

        errors.push({
            line: open.line,
            col: open.col,
            message: `The tag '<${open.name}>' is never closed.`
        });
    }

    return sortErrors(errors);
}

export { lintHTML };