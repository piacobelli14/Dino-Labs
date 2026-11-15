import { sortErrors } from "../LintCore.jsx";

const DOCKER_INSTRUCTIONS = new Set([
    "FROM", "RUN", "CMD", "LABEL", "MAINTAINER", "EXPOSE", "ENV", "ADD",
    "COPY", "ENTRYPOINT", "VOLUME", "USER", "WORKDIR", "ARG", "ONBUILD",
    "STOPSIGNAL", "HEALTHCHECK", "SHELL"
]);

const REQUIRE_ARGUMENTS = new Set([
    "FROM", "RUN", "CMD", "LABEL", "EXPOSE", "ENV", "ADD", "COPY",
    "ENTRYPOINT", "VOLUME", "USER", "WORKDIR", "ARG", "STOPSIGNAL", "SHELL"
]);

function lintDockerfile(code) {
    const errors = [];
    const codeLines = code.split(/\r?\n/);

    let sawFrom = false;
    let continued = false;

    for (let i = 0; i < codeLines.length; i++) {
        const ln = codeLines[i];
        const lineNumber = i + 1;

        if (continued) {
            continued = /\\\s*$/.test(ln);
            continue;
        }

        if (/^\s*$/.test(ln) || /^\s*#/.test(ln)) {
            continue;
        }

        const leadingWhitespaceMatch = ln.match(/^[ \t]*/);
        const leadingWhitespace = leadingWhitespaceMatch ? leadingWhitespaceMatch[0] : "";
        if (leadingWhitespace.includes(" ") && leadingWhitespace.includes("\t")) {
            errors.push({
                line: lineNumber,
                col: 1,
                message: "This line mixes tabs and spaces in its indentation."
            });
        }

        const trimmed = ln.trim();
        const wordMatch = trimmed.match(/^[A-Za-z][A-Za-z0-9_]*/);
        const word = wordMatch ? wordMatch[0] : "";
        const instruction = word.toUpperCase();

        if (!word) {
            errors.push({
                line: lineNumber,
                col: leadingWhitespace.length + 1,
                message: "Expected an instruction at the start of this line."
            });
            continued = /\\\s*$/.test(ln);
            continue;
        }

        if (!DOCKER_INSTRUCTIONS.has(instruction)) {
            errors.push({
                line: lineNumber,
                col: leadingWhitespace.length + 1,
                message: `'${word}' is not a known instruction.`
            });
            continued = /\\\s*$/.test(ln);
            continue;
        }

        if (word !== instruction) {
            errors.push({
                line: lineNumber,
                col: leadingWhitespace.length + 1,
                message: `The instruction '${word}' must be uppercase.`
            });
        }

        const rest = trimmed.slice(word.length).trim();

        if (REQUIRE_ARGUMENTS.has(instruction) && rest === "") {
            errors.push({
                line: lineNumber,
                col: ln.length,
                message: `'${instruction}' requires at least one argument.`
            });
        }

        if (!sawFrom && instruction !== "FROM" && instruction !== "ARG") {
            errors.push({
                line: lineNumber,
                col: leadingWhitespace.length + 1,
                message: "Instructions must follow a 'FROM' declaration."
            });
        }

        if (instruction === "FROM") {
            sawFrom = true;
        }

        if (instruction === "EXPOSE") {
            const ports = rest.split(/\s+/).filter(Boolean);
            for (const port of ports) {
                if (!/^\d+(?:\/(?:tcp|udp))?$/i.test(port) && !/^\$/.test(port)) {
                    errors.push({
                        line: lineNumber,
                        col: ln.indexOf(port) + 1,
                        message: `'${port}' is not a valid port.`
                    });
                }
            }
        }

        const quotes = rest.match(/"/g);
        if (quotes && quotes.length % 2 !== 0) {
            errors.push({
                line: lineNumber,
                col: ln.length,
                message: "This string literal is never closed."
            });
        }

        continued = /\\\s*$/.test(ln);
    }

    if (!sawFrom && codeLines.some((ln) => !/^\s*$/.test(ln) && !/^\s*#/.test(ln))) {
        errors.push({
            line: 1,
            col: 1,
            message: "This Dockerfile is missing a 'FROM' instruction."
        });
    }

    if (continued) {
        errors.push({
            line: codeLines.length,
            col: 1,
            message: "The file ends with a line continuation."
        });
    }

    return sortErrors(errors);
}

export { lintDockerfile };