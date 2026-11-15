import { sortErrors } from "../LintCore.jsx";

function lintMarkdown(code) {
    const errors = [];
    const codeLines = code.split(/\r?\n/);

    let fence = null;
    const references = new Set();
    const usedReferences = [];

    for (let i = 0; i < codeLines.length; i++) {
        const ln = codeLines[i];
        const lineNumber = i + 1;

        const fenceMatch = ln.match(/^\s*(`{3,}|~{3,})/);

        if (fenceMatch) {
            const marker = fenceMatch[1][0];
            const length = fenceMatch[1].length;

            if (!fence) {
                fence = { marker, length, line: lineNumber, col: ln.indexOf(fenceMatch[1]) + 1 };
            } else if (fence.marker === marker && length >= fence.length) {
                fence = null;
            }
            continue;
        }

        if (fence) {
            continue;
        }

        if (/^\s*$/.test(ln)) {
            continue;
        }

        const referenceMatch = ln.match(/^\s*\[([^\]]+)\]:\s*\S+/);
        if (referenceMatch) {
            references.add(referenceMatch[1].toLowerCase());
            continue;
        }

        const headingMatch = ln.match(/^(#{1,6})(\S)/);
        if (headingMatch) {
            errors.push({
                line: lineNumber,
                col: headingMatch[1].length + 1,
                message: "A heading marker needs a space after it."
            });
        }

        const deepHeading = ln.match(/^(#{7,})\s/);
        if (deepHeading) {
            errors.push({
                line: lineNumber,
                col: 1,
                message: "Headings only go to six levels."
            });
        }

        const inlineTicks = (ln.match(/`/g) || []).length;
        if (inlineTicks % 2 !== 0) {
            errors.push({
                line: lineNumber,
                col: ln.lastIndexOf("`") + 1,
                message: "This inline code span is never closed."
            });
        }

        const stripped = ln.replace(/`[^`]*`/g, "");

        let depth = 0;
        for (let c = 0; c < stripped.length; c++) {
            if (stripped[c] === "\\") {
                c++;
                continue;
            }
            if (stripped[c] === "[") depth++;
            if (stripped[c] === "]") {
                depth--;
                if (depth < 0) {
                    errors.push({
                        line: lineNumber,
                        col: c + 1,
                        message: "This ']' has no matching '['."
                    });
                    depth = 0;
                }
            }
        }

        if (depth > 0) {
            errors.push({
                line: lineNumber,
                col: stripped.lastIndexOf("[") + 1,
                message: "This '[' is never closed."
            });
        }

        const linkPattern = /!?\[[^\]]*\]\(([^)]*)$/;
        if (linkPattern.test(stripped)) {
            errors.push({
                line: lineNumber,
                col: stripped.lastIndexOf("(") + 1,
                message: "This link target is never closed."
            });
        }

        const emptyLink = stripped.match(/!?\[[^\]]*\]\(\s*\)/);
        if (emptyLink) {
            errors.push({
                line: lineNumber,
                col: stripped.indexOf(emptyLink[0]) + 1,
                message: "This link has an empty target."
            });
        }

        let reference;
        const referencePattern = /!?\[[^\]]*\]\[([^\]]+)\]/g;
        while ((reference = referencePattern.exec(stripped)) !== null) {
            usedReferences.push({
                label: reference[1].toLowerCase(),
                line: lineNumber,
                col: reference.index + 1
            });
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
    }

    if (fence) {
        errors.push({
            line: fence.line,
            col: fence.col,
            message: "This code fence is never closed."
        });
    }

    for (const used of usedReferences) {
        if (!references.has(used.label)) {
            errors.push({
                line: used.line,
                col: used.col,
                message: `The link reference '${used.label}' is never defined.`
            });
        }
    }

    return sortErrors(errors);
}

export { lintMarkdown };