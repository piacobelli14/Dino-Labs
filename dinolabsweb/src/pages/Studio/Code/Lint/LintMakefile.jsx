import { sortErrors } from "../LintCore.jsx";

const CONDITIONAL_OPENERS = new Set(["ifeq", "ifneq", "ifdef", "ifndef"]);

const DIRECTIVES = new Set([
    "include", "sinclude", "export", "unexport", "override", "vpath",
    "undefine", "load", "private"
]);

function lintMakefile(code) {
    const errors = [];
    const codeLines = code.split(/\r?\n/);

    const conditionals = [];
    let inDefine = false;
    let defineLine = 0;
    let sawTarget = false;
    let continued = false;

    for (let i = 0; i < codeLines.length; i++) {
        const ln = codeLines[i];
        const lineNumber = i + 1;

        if (continued) {
            continued = /\\\s*$/.test(ln);
            continue;
        }

        if (/^\s*$/.test(ln)) {
            continue;
        }

        const trimmed = ln.trim();

        if (trimmed.startsWith("#")) {
            continue;
        }

        const firstWord = (trimmed.match(/^[A-Za-z_][\w-]*/) || [""])[0];

        if (inDefine) {
            if (firstWord === "endef") {
                inDefine = false;
            }
            continued = /\\\s*$/.test(ln);
            continue;
        }

        if (firstWord === "define") {
            inDefine = true;
            defineLine = lineNumber;
            continued = /\\\s*$/.test(ln);
            continue;
        }

        if (CONDITIONAL_OPENERS.has(firstWord)) {
            conditionals.push({ word: firstWord, line: lineNumber, col: ln.indexOf(firstWord) + 1 });
            continued = /\\\s*$/.test(ln);
            continue;
        }

        if (DIRECTIVES.has(firstWord)) {
            continued = /\\\s*$/.test(ln);
            continue;
        }

        if (firstWord === "endif") {
            if (conditionals.length === 0) {
                errors.push({
                    line: lineNumber,
                    col: ln.indexOf("endif") + 1,
                    message: "This 'endif' has no matching conditional."
                });
            } else {
                conditionals.pop();
            }
            continued = /\\\s*$/.test(ln);
            continue;
        }

        if (firstWord === "else") {
            if (conditionals.length === 0) {
                errors.push({
                    line: lineNumber,
                    col: ln.indexOf("else") + 1,
                    message: "This 'else' has no matching conditional."
                });
            }
            continued = /\\\s*$/.test(ln);
            continue;
        }

        const isRecipe = ln.startsWith("\t");
        const startsWithSpaces = /^ +/.test(ln);

        if (isRecipe) {
            if (!sawTarget) {
                errors.push({
                    line: lineNumber,
                    col: 1,
                    message: "This recipe line has no preceding target."
                });
            }
            continued = /\\\s*$/.test(ln);
            continue;
        }

        const targetMatch = ln.match(/^([^\s:=][^:=]*):(?!=)/);
        const assignmentMatch = ln.match(/^\s*[A-Za-z_][\w.-]*\s*[:+?!]?=/);

        if (startsWithSpaces && !assignmentMatch && targetMatch === null) {
            errors.push({
                line: lineNumber,
                col: 1,
                message: "Recipe lines must begin with a tab, not spaces."
            });
            continued = /\\\s*$/.test(ln);
            continue;
        }

        if (targetMatch) {
            sawTarget = true;

            if (targetMatch[1].trim() === "") {
                errors.push({
                    line: lineNumber,
                    col: 1,
                    message: "This rule is missing its target name."
                });
            }
        } else if (!assignmentMatch) {
            errors.push({
                line: lineNumber,
                col: (ln.match(/^[ \t]*/) || [""])[0].length + 1,
                message: "Expected a target, assignment or directive on this line."
            });
        }

        const openParens = (ln.match(/\$\(/g) || []).length;
        const closeParens = (ln.match(/\)/g) || []).length;
        if (openParens > closeParens) {
            errors.push({
                line: lineNumber,
                col: ln.length,
                message: "This variable reference is never closed."
            });
        }

        const openBraces = (ln.match(/\$\{/g) || []).length;
        const closeBraces = (ln.match(/\}/g) || []).length;
        if (openBraces > closeBraces) {
            errors.push({
                line: lineNumber,
                col: ln.length,
                message: "This variable reference is never closed."
            });
        }

        continued = /\\\s*$/.test(ln);
    }

    if (inDefine) {
        errors.push({
            line: defineLine,
            col: 1,
            message: "This 'define' block is never closed."
        });
    }

    while (conditionals.length > 0) {
        const unclosed = conditionals.pop();
        errors.push({
            line: unclosed.line,
            col: unclosed.col,
            message: `The '${unclosed.word}' opened here is never closed.`
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

export { lintMakefile };