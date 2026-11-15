import { tokenizeSource, sortErrors } from "../LintCore.jsx";

const BLOCK_OPENERS = new Set(["if", "for", "while", "until", "case", "select"]);
const BLOCK_CLOSERS = { fi: "if", done: "for", esac: "case" };

function analyseShell(code) {
    const errors = [];

    const scan = tokenizeSource(code, {
        lineComment: "#",
        blockComment: null,
        stringDelimiters: ["\"", "'"],
        templateDelimiter: null,
        allowRegex: false
    });

    errors.push(...scan.errors);

    const codeLines = code.split(/\r?\n/);
    const stack = [];
    let inHeredoc = null;

    for (let i = 0; i < codeLines.length; i++) {
        const raw = codeLines[i];
        const lineNumber = i + 1;
        const trimmed = raw.trim();

        if (inHeredoc) {
            if (trimmed === inHeredoc) inHeredoc = null;
            continue;
        }

        const heredoc = trimmed.match(/<<-?\s*["']?([A-Za-z_]\w*)["']?/);

        if (heredoc) {
            inHeredoc = heredoc[1];
            continue;
        }

        if (trimmed === "" || trimmed.startsWith("#")) {
            continue;
        }

        const words = trimmed.split(/\s+/).map((word) => word.replace(/[;&|]+$/, ""));
        const first = words[0];

        if (BLOCK_OPENERS.has(first)) {
            stack.push({ word: first, line: lineNumber });
        }

        for (const word of words.slice(1)) {
            if (BLOCK_CLOSERS[word]) {
                const open = stack.pop();

                if (!open) {
                    errors.push({
                        line: lineNumber,
                        col: raw.indexOf(word) + 1,
                        message: `'${word}' has no matching opening keyword.`
                    });
                }
            }
        }

        if (BLOCK_CLOSERS[first]) {
            const expected = BLOCK_CLOSERS[first];
            const open = stack.pop();

            if (!open) {
                errors.push({
                    line: lineNumber,
                    col: raw.indexOf(first) + 1,
                    message: `'${first}' has no matching opening keyword.`
                });
            } else if (open.word !== expected
                && !(expected === "for" && ["while", "until", "select"].includes(open.word))) {
                errors.push({
                    line: lineNumber,
                    col: raw.indexOf(first) + 1,
                    message: `'${first}' does not close the '${open.word}' block opened at line ${open.line}.`
                });
            }
        }

        if (/^if\b/.test(trimmed) && !/\bthen\b/.test(trimmed)) {
            const nextLine = (codeLines[i + 1] || "").trim();

            if (!/^then\b/.test(nextLine)) {
                errors.push({
                    line: lineNumber,
                    col: 1,
                    message: "This 'if' statement is missing its 'then' keyword."
                });
            }
        }

        if (/^(?:for|while|until)\b/.test(trimmed) && !/\bdo\b/.test(trimmed)) {
            const nextLine = (codeLines[i + 1] || "").trim();

            if (!/^do\b/.test(nextLine)) {
                errors.push({
                    line: lineNumber,
                    col: 1,
                    message: `This '${first}' loop is missing its 'do' keyword.`
                });
            }
        }

        if (/^[A-Za-z_]\w*\s+=|^[A-Za-z_]\w*=\s/.test(trimmed)) {
            errors.push({
                line: lineNumber,
                col: raw.indexOf("=") + 1,
                message: "A shell assignment cannot have spaces around '='."
            });
        }

        const risky = trimmed.match(/\b(?:rm|mv|cp)\b[^\n]*/);

        if (risky && /(?:^|[\s=])\$[A-Za-z_]\w*/.test(risky[0])) {
            errors.push({
                line: lineNumber,
                col: raw.indexOf("$") + 1,
                message: "Quote this variable so filenames containing spaces still work."
            });
        }

        if (/^\s*(?:if|while|until)\s+\[(?!\[)[^\s]/.test(raw)) {
            errors.push({
                line: lineNumber,
                col: raw.indexOf("[") + 1,
                message: "Test brackets need spaces inside them."
            });
        }

    }

    for (const open of stack) {
        errors.push({
            line: open.line,
            col: 1,
            message: `The '${open.word}' block opened here is never closed.`
        });
    }

    if (inHeredoc) {
        errors.push({
            line: codeLines.length,
            col: 1,
            message: `This heredoc is never closed; it expects '${inHeredoc}'.`
        });
    }

    return sortErrors(errors);
}

function lintBash(code) {
    return analyseShell(code);
}

export { lintBash, analyseShell };