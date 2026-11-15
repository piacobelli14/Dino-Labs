import { analyseShell } from "./LintBash.jsx";

function lintShell(code) {
    return analyseShell(code);
}

export { lintShell };