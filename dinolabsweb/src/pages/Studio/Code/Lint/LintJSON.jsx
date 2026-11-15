import { sortErrors } from "../LintCore.jsx";

function lintJSON(code) {
    const errors = [];
    const stack = [];
    const keyStack = [];

    let i = 0;
    let line = 1;
    let col = 1;
    let expecting = "value";

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
        const char = code[i];

        if (char === " " || char === "\t" || char === "\n" || char === "\r") {
            advance(1);
            continue;
        }

        if (char === "/" && (code[i + 1] === "/" || code[i + 1] === "*")) {
            errors.push({ line, col, message: "Comments are not valid in JSON." });
            if (code[i + 1] === "/") {
                while (i < code.length && code[i] !== "\n") advance(1);
            } else {
                const end = code.indexOf("*/", i);
                advance(end === -1 ? code.length - i : end + 2 - i);
            }
            continue;
        }

        if (char === "{" || char === "[") {
            stack.push({ char, line, col });
            if (char === "{") keyStack.push(new Map());
            expecting = char === "{" ? "key" : "value";
            advance(1);
            continue;
        }

        if (char === "}" || char === "]") {
            const open = stack.pop();
            const want = char === "}" ? "{" : "[";

            if (!open) {
                errors.push({ line, col, message: `This closing '${char}' has no matching opening bracket.` });
            } else if (open.char !== want) {
                errors.push({
                    line,
                    col,
                    message: `The closing '${char}' does not match the '${open.char}' opened at line ${open.line}.`
                });
            }

            if (char === "}") keyStack.pop();
            expecting = "comma";
            advance(1);
            continue;
        }

        if (char === "\"") {
            const start = { line, col };
            let value = "";
            advance(1);
            let closed = false;

            while (i < code.length) {
                if (code[i] === "\\") {
                    const escape = code[i + 1];

                    if (!"\"\\/bfnrtu".includes(escape)) {
                        errors.push({
                            line,
                            col,
                            message: `'\\${escape}' is not a valid escape sequence.`
                        });
                    }

                    value += code[i] + escape;
                    advance(2);
                    continue;
                }

                if (code[i] === "\"") {
                    advance(1);
                    closed = true;
                    break;
                }

                if (code[i] === "\n") {
                    break;
                }

                value += code[i];
                advance(1);
            }

            if (!closed) {
                errors.push({ line: start.line, col: start.col, message: "This string is never terminated." });
            }

            if (expecting === "key") {
                const current = keyStack[keyStack.length - 1];

                if (current) {
                    if (current.has(value)) {
                        errors.push({
                            line: start.line,
                            col: start.col,
                            message: `The key '${value}' is already defined at line ${current.get(value)}.`
                        });
                    } else {
                        current.set(value, start.line);
                    }
                }

                expecting = "colon";
            } else {
                expecting = "comma";
            }

            continue;
        }

        if (char === ":") {
            expecting = "value";
            advance(1);
            continue;
        }

        if (char === ",") {
            let ahead = i + 1;

            while (ahead < code.length && /\s/.test(code[ahead])) {
                ahead++;
            }

            if (code[ahead] === "}" || code[ahead] === "]") {
                errors.push({ line, col, message: "A trailing comma is not valid in JSON." });
            }

            const inObject = stack.length > 0 && stack[stack.length - 1].char === "{";
            expecting = inObject ? "key" : "value";
            advance(1);
            continue;
        }

        if (char === "'") {
            errors.push({ line, col, message: "JSON strings must use double quotes." });
            advance(1);
            while (i < code.length && code[i] !== "'") advance(1);
            advance(1);
            expecting = "comma";
            continue;
        }

        const literal = code.slice(i).match(/^(?:true|false|null)/);

        if (literal) {
            advance(literal[0].length);
            expecting = "comma";
            continue;
        }

        const number = code.slice(i).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);

        if (number) {
            const raw = code.slice(i).match(/^[-+0-9a-zA-Z._]+/)[0];

            if (raw !== number[0]) {
                errors.push({ line, col, message: `'${raw}' is not a valid number.` });
                advance(raw.length);
            } else {
                advance(number[0].length);
            }

            expecting = "comma";
            continue;
        }

        const word = code.slice(i).match(/^[A-Za-z_$][\w$]*/);

        if (word) {
            errors.push({
                line,
                col,
                message: expecting === "key"
                    ? `Object keys must be quoted, but '${word[0]}' is not.`
                    : `Unexpected token '${word[0]}'`
            });
            advance(word[0].length);
            expecting = "comma";
            continue;
        }

        errors.push({ line, col, message: `'${char}' is not valid here.` });
        advance(1);
    }

    for (const open of stack) {
        errors.push({
            line: open.line,
            col: open.col,
            message: `The '${open.char}' opened here is never closed.`
        });
    }

    return sortErrors(errors);
}

export { lintJSON };