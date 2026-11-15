const PAIRS = { "(": ")", "[": "]", "{": "}" };
const CLOSERS = { ")": "(", "]": "[", "}": "{" };

const TRIPLE_DOUBLE = '"""';
const TRIPLE_SINGLE = "'''";

function tokenizeSource(code, options) {
    const settings = options || {};
    const lineComment = settings.lineComment === undefined ? "//" : settings.lineComment;
    const blockComment = settings.blockComment === undefined ? ["/*", "*/"] : settings.blockComment;
    const stringDelimiters = settings.stringDelimiters || ["\"", "'"];
    const templateDelimiter = settings.templateDelimiter || null;
    const tripleQuotes = settings.tripleQuotes === true;
    const allowRegex = settings.allowRegex === true;

    const tokens = [];
    const errors = [];

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

    const previousMeaningful = () => {
        for (let n = tokens.length - 1; n >= 0; n--) {
            if (tokens[n].type !== "comment") {
                return tokens[n];
            }
        }
        return null;
    };

    while (i < code.length) {
        const char = code[i];

        if (char === "\n" || char === " " || char === "\t" || char === "\r") {
            advance(1);
            continue;
        }

        if (lineComment && code.startsWith(lineComment, i)) {
            const start = { line, col };
            let text = "";
            while (i < code.length && code[i] !== "\n") {
                text += code[i];
                advance(1);
            }
            tokens.push({ type: "comment", value: text, line: start.line, col: start.col });
            continue;
        }

        if (blockComment && code.startsWith(blockComment[0], i)) {
            const start = { line, col };
            const end = code.indexOf(blockComment[1], i + blockComment[0].length);
            if (end === -1) {
                errors.push({ line: start.line, col: start.col, message: "This block comment is never closed." });
                break;
            }
            const text = code.slice(i, end + blockComment[1].length);
            advance(text.length);
            tokens.push({ type: "comment", value: text, line: start.line, col: start.col });
            continue;
        }

        if (tripleQuotes && (code.startsWith(TRIPLE_DOUBLE, i) || code.startsWith(TRIPLE_SINGLE, i))) {
            const start = { line, col };
            const fence = code.slice(i, i + 3);

            advance(3);

            let value = "";
            let closed = false;

            while (i < code.length) {
                if (code.startsWith(fence, i)) {
                    advance(3);
                    closed = true;
                    break;
                }

                value += code[i];
                advance(1);
            }

            if (!closed) {
                errors.push({ line: start.line, col: start.col, message: "This triple quoted string is never closed." });
            }

            tokens.push({ type: "string", value, line: start.line, col: start.col });
            continue;
        }

        if (stringDelimiters.includes(char)) {
            const start = { line, col };
            const quote = char;
            let value = "";
            advance(1);
            let closed = false;

            while (i < code.length) {
                if (code[i] === "\\") {
                    value += code[i] + (code[i + 1] || "");
                    advance(2);
                    continue;
                }
                if (code[i] === quote) {
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
                errors.push({ line: start.line, col: start.col, message: "This string literal is never closed." });
            }

            tokens.push({ type: "string", value, line: start.line, col: start.col });
            continue;
        }

        if (templateDelimiter && char === templateDelimiter) {
            const start = { line, col };
            let closed = false;
            advance(1);

            let interpolation = 0;

            while (i < code.length) {
                if (code[i] === "\\") {
                    advance(2);
                    continue;
                }

                if (code[i] === "$" && code[i + 1] === "{") {
                    interpolation++;
                    advance(2);
                    continue;
                }

                if (interpolation > 0 && code[i] === "{") {
                    interpolation++;
                    advance(1);
                    continue;
                }

                if (interpolation > 0 && code[i] === "}") {
                    interpolation--;
                    advance(1);
                    continue;
                }

                if (code[i] === templateDelimiter && interpolation === 0) {
                    advance(1);
                    closed = true;
                    break;
                }

                advance(1);
            }

            if (!closed) {
                errors.push({ line: start.line, col: start.col, message: "This template literal is never closed." });
            }

            tokens.push({ type: "template", value: "", line: start.line, col: start.col });
            continue;
        }

        if (allowRegex && char === "/") {
            const prev = previousMeaningful();
            const closers = [")", "]", "}", "++", "--", "<"];
            const regexAllowed = !prev
                || (prev.type === "punctuation" && !closers.includes(prev.value))
                || (prev.type === "identifier" && ["return", "typeof", "case", "in", "of", "delete", "void", "instanceof", "new", "do", "else", "yield", "await"].includes(prev.value));

            if (regexAllowed && code[i + 1] !== "/" && code[i + 1] !== "*") {
                const start = { line, col };
                let closed = false;
                let inClass = false;
                advance(1);

                while (i < code.length) {
                    if (code[i] === "\\") {
                        advance(2);
                        continue;
                    }
                    if (code[i] === "[") inClass = true;
                    if (code[i] === "]") inClass = false;
                    if (code[i] === "\n") break;
                    if (code[i] === "/" && !inClass) {
                        advance(1);
                        closed = true;
                        break;
                    }
                    advance(1);
                }

                while (i < code.length && /[a-z]/.test(code[i])) {
                    advance(1);
                }

                if (!closed) {
                    errors.push({ line: start.line, col: start.col, message: "This regular expression is never closed." });
                }

                tokens.push({ type: "regex", value: "", line: start.line, col: start.col });
                continue;
            }
        }

        if (/[0-9]/.test(char)) {
            const start = { line, col };
            let value = "";
            while (i < code.length && /[0-9a-fA-FxXbBoO._]/.test(code[i])) {
                value += code[i];
                advance(1);
            }
            tokens.push({ type: "number", value, line: start.line, col: start.col });
            continue;
        }

        if (/[A-Za-z_$@#]/.test(char)) {
            const start = { line, col };
            let value = "";
            while (i < code.length && /[A-Za-z0-9_$@#]/.test(code[i])) {
                value += code[i];
                advance(1);
            }
            tokens.push({ type: "identifier", value, line: start.line, col: start.col });
            continue;
        }

        const start = { line, col };
        advance(1);
        tokens.push({ type: "punctuation", value: char, line: start.line, col: start.col });
    }

    return { tokens, errors };
}

function checkBalance(tokens) {
    const errors = [];
    const stack = [];

    for (const token of tokens) {
        if (token.type !== "punctuation") {
            continue;
        }

        if (PAIRS[token.value]) {
            stack.push(token);
            continue;
        }

        if (CLOSERS[token.value]) {
            if (stack.length === 0) {
                errors.push({
                    line: token.line,
                    col: token.col,
                    message: `This closing '${token.value}' has no matching opening bracket.`
                });
                continue;
            }

            const open = stack.pop();

            if (PAIRS[open.value] !== token.value) {
                errors.push({
                    line: token.line,
                    col: token.col,
                    message: `The closing '${token.value}' does not match the '${open.value}' opened at line ${open.line}, column ${open.col}.`
                });
            }
        }
    }

    for (const open of stack) {
        errors.push({
            line: open.line,
            col: open.col,
            message: `The '${open.value}' opened here is never closed.`
        });
    }

    return errors;
}

function checkIndentation(code) {
    const errors = [];
    const codeLines = code.split(/\r?\n/);

    for (let i = 0; i < codeLines.length; i++) {
        const ln = codeLines[i];

        if (/^\s*$/.test(ln)) {
            continue;
        }

        const lead = (ln.match(/^[ \t]*/) || [""])[0];

        if (lead.includes(" ") && lead.includes("\t")) {
            errors.push({
                line: i + 1,
                col: 1,
                message: "This line mixes tabs and spaces in its indentation."
            });
        }

    }

    return errors;
}

function sortErrors(errors) {
    const seen = new Set();

    return errors
        .filter((error) => {
            const key = `${error.line}:${error.col}:${error.message}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        })
        .sort((a, b) => a.line - b.line || a.col - b.col);
}

export { tokenizeSource, checkBalance, checkIndentation, sortErrors, PAIRS, CLOSERS };

function buildScopes(tokens, config) {
    const settings = config || {};
    const reserved = settings.reserved || new Set();
    const declarators = settings.declarators || new Set(["var", "let", "const"]);
    const functionKeywords = settings.functionKeywords || new Set(["function"]);
    const blockScoped = settings.blockScoped || new Set(["let", "const", "class"]);

    const root = { parent: null, children: [], declared: new Map(), kind: "module", isFunction: true };
    let current = root;

    const errors = [];
    const references = [];

    const openScope = (kind, isFunction) => {
        const scope = { parent: current, children: [], declared: new Map(), kind, isFunction };
        current.children.push(scope);
        current = scope;
        return scope;
    };

    const closeScope = () => {
        if (current.parent) {
            current = current.parent;
        }
    };

    const functionScope = (scope) => {
        let node = scope;
        while (node && !node.isFunction) {
            node = node.parent;
        }
        return node || root;
    };

    const declare = (name, token, kind) => {
        const target = blockScoped.has(kind) || kind === "param" || kind === "catch"
            ? current
            : functionScope(current);

        const existing = target.declared.get(name);

        if (existing && blockScoped.has(kind) && existing.kind !== "hoist") {
            errors.push({
                line: token.line,
                col: token.col,
                message: `'${name}' is already declared at line ${existing.line}.`
            });
            return;
        }

        target.declared.set(name, {
            line: token.line,
            col: token.col,
            kind,
            used: existing ? existing.used : false
        });
    };

    const pendingScopes = [];

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const next = tokens[i + 1];
        const prev = tokens[i - 1];

        if (token.type === "punctuation" && token.value === "(") {
            let cursor = i;
            let depth = 0;

            while (cursor < tokens.length) {
                if (tokens[cursor].value === "(") depth++;
                if (tokens[cursor].value === ")") {
                    depth--;
                    if (depth === 0) break;
                }
                cursor++;
            }

            const after = tokens[cursor + 1];
            const arrowBody = tokens[cursor + 2];

            if (after && after.value === "=" && arrowBody && arrowBody.value === ">") {
                const collected = collectParams(tokens, i, reserved);
                const body = tokens[cursor + 3];

                if (body && body.value === "{") {
                    pendingScopes.push({ kind: "arrow", isFunction: true, params: collected.params });
                } else {
                    for (const param of collected.params) {
                        current.declared.set(param.value, {
                            line: param.line,
                            col: param.col,
                            kind: "param",
                            used: false
                        });
                    }
                }

                i = cursor + 2;
            }

            continue;
        }

        if (token.type === "punctuation" && token.value === "{") {
            const queued = pendingScopes.length > 0 ? pendingScopes.pop() : null;
            openScope(queued ? queued.kind : "block", queued ? queued.isFunction : false);

            if (queued && queued.params) {
                for (const param of queued.params) {
                    current.declared.set(param.value, {
                        line: param.line,
                        col: param.col,
                        kind: "param",
                        used: false
                    });
                }
            }
            continue;
        }

        if (token.type === "punctuation" && token.value === "}") {
            closeScope();
            continue;
        }

        if (token.type !== "identifier") {
            continue;
        }

        if (declarators.has(token.value)) {
            let cursor = i + 1;
            let depth = 0;
            let guard = 0;

            while (cursor < tokens.length && guard < 600) {
                const candidate = tokens[cursor];

                if (candidate.value === "(" || candidate.value === "[" || candidate.value === "{") depth++;
                if (candidate.value === ")" || candidate.value === "]" || candidate.value === "}") depth--;
                if (depth < 0) break;
                if (depth === 0 && candidate.value === ";") break;

                if (candidate.value === "=" && depth === 0) {
                    let skip = cursor + 1;
                    let inner = 0;

                    while (skip < tokens.length) {
                        const step = tokens[skip];
                        if (step.value === "(" || step.value === "[" || step.value === "{") inner++;
                        if (step.value === ")" || step.value === "]" || step.value === "}") inner--;
                        if (inner < 0) break;
                        if (inner === 0 && (step.value === "," || step.value === ";")) break;
                        skip++;
                    }

                    cursor = skip;
                    guard++;
                    continue;
                }

                if (candidate.type === "identifier" && !reserved.has(candidate.value)) {
                    const before = tokens[cursor - 1];
                    const after = tokens[cursor + 1];
                    const isTypeName = before && [":", "<", "|", "&"].includes(before.value);
                    const isObjectKey = after && after.value === ":" && before && before.value === "{";

                    if ((!before || before.value !== ".") && !isTypeName && !isObjectKey) {
                        declare(candidate.value, candidate, token.value);
                    }
                }

                cursor++;
                guard++;
            }

            continue;
        }

        if (functionKeywords.has(token.value)) {
            if (next && next.type === "identifier" && !reserved.has(next.value)) {
                declare(next.value, next, "function");
            }

            let open = i + 1;
            while (open < tokens.length && tokens[open].value !== "(" && tokens[open].value !== "{") {
                open++;
            }

            if (tokens[open] && tokens[open].value === "(") {
                const collected = collectParams(tokens, open, reserved);
                pendingScopes.push({ kind: "function", isFunction: true, params: collected.params });
                i = collected.endIndex;
            }

            continue;
        }

        if (token.value === "class" && next && next.type === "identifier") {
            declare(next.value, next, "class");
        }

        if (token.value === "import") {
            let cursor = i + 1;
            let guard = 0;

            while (cursor < tokens.length && guard < 200) {
                const candidate = tokens[cursor];

                if (candidate.type === "string" || candidate.value === ";") {
                    break;
                }

                if (candidate.type === "identifier" && !reserved.has(candidate.value)) {
                    const after = tokens[cursor + 1];

                    if (!after || after.value !== "as") {
                        declare(candidate.value, candidate, "import");
                    }
                }

                cursor++;
                guard++;
            }

            i = cursor;
            continue;
        }

        if (token.value === "catch" && next && next.value === "(") {
            const param = tokens[i + 2];
            if (param && param.type === "identifier") {
                pendingScopes.push({ kind: "catch", isFunction: false, params: [param] });
                i = i + 3;
            }
            continue;
        }

        if (reserved.has(token.value)) {
            continue;
        }

        if (next && next.value === "=" && tokens[i + 2] && tokens[i + 2].value === ">") {
            const body = tokens[i + 3];

            if (body && body.value === "{") {
                pendingScopes.push({ kind: "arrow", isFunction: true, params: [token] });
            } else {
                current.declared.set(token.value, {
                    line: token.line,
                    col: token.col,
                    kind: "param",
                    used: false
                });
            }

            i = i + 2;
            continue;
        }

        if (prev && (prev.value === "." || prev.value === "?")) {
            continue;
        }

        if (next && next.value === ":") {
            continue;
        }

        const twoBack = tokens[i - 2];

        if (prev && (prev.value === "<" || (prev.value === "/" && twoBack && twoBack.value === "<"))) {
            if (/^[A-Z]/.test(token.value)) {
                let scope = current;

                while (scope) {
                    if (scope.declared.has(token.value)) {
                        scope.declared.get(token.value).used = true;
                        break;
                    }
                    scope = scope.parent;
                }
            }

            continue;
        }

        if (next && next.value === "=" && tokens[i + 2] && (tokens[i + 2].type === "string" || tokens[i + 2].value === "{")) {
            let back = i - 1;
            let guard = 0;
            let insideTag = false;

            while (back >= 0 && guard < 400) {
                if (tokens[back].value === ";") break;
                if (tokens[back].value === ">" && tokens[back - 1] && tokens[back - 1].value !== "=") break;
                if (tokens[back].value === "<") {
                    insideTag = true;
                    break;
                }
                back--;
                guard++;
            }

            if (insideTag) {
                continue;
            }
        }

        references.push({ token, scope: current });
    }

    return { root, errors, references };
}

function collectParams(tokens, openIndex, reserved) {
    const params = [];
    let cursor = openIndex + 1;
    let depth = 1;

    while (cursor < tokens.length && depth > 0) {
        const token = tokens[cursor];

        if (token.value === "(") depth++;
        if (token.value === ")") depth--;

        if (depth > 0 && token.type === "identifier" && !reserved.has(token.value)) {
            const prev = tokens[cursor - 1];
            const next = tokens[cursor + 1];

            if ((!prev || prev.value !== ".") && (!next || [",", ")", "=", "}", "]", ":", "?"].includes(next.value))) {
                const isTypeName = prev && (prev.value === ":" || prev.value === "<" || prev.value === "|" || prev.value === "&");

                if (!isTypeName) {
                    params.push(token);
                }
            }
        }

        cursor++;
    }

    return { params, endIndex: cursor - 1 };
}

export { buildScopes, collectParams };

function lintBraceLanguage(code, config) {
    const settings = config || {};
    const errors = [];

    const scan = tokenizeSource(code, {
        lineComment: settings.lineComment || "//",
        blockComment: settings.blockComment || ["/*", "*/"],
        stringDelimiters: settings.stringDelimiters || ["\"", "'"],
        templateDelimiter: settings.templateDelimiter || null,
        allowRegex: settings.allowRegex === true
    });

    errors.push(...scan.errors);
    errors.push(...checkBalance(scan.tokens));
    errors.push(...checkIndentation(code));

    const meaningful = scan.tokens.filter((token) => token.type !== "comment");
    const keywords = settings.keywords || new Set();
    const controlKeywords = settings.controlKeywords || new Set(["if", "while", "switch", "for"]);
    const statementEnd = settings.statementEnd !== false;

    for (let i = 0; i < meaningful.length; i++) {
        const token = meaningful[i];
        const prev = meaningful[i - 1];
        const next = meaningful[i + 1];

        if (token.type === "identifier" && controlKeywords.has(token.value)) {
            const isMember = prev && (prev.value === "." || prev.value === "?" || prev.value === "#");

            if (!isMember && (!next || next.value !== "(")) {
                errors.push({
                    line: token.line,
                    col: token.col,
                    message: `'${token.value}' must be followed by a condition in parentheses.`
                });
            }
        }

        if (token.type === "punctuation" && token.value === "=" && next && next.type === "punctuation" && next.value === "=") {
            const third = meaningful[i + 2];
            const chained = prev && ["=", "!", "<", ">", "+", "-", "*", "/", "%", "&", "|", "^"].includes(prev.value);

            if (!chained && third && third.value === "=" && settings.strictEquality) {
                continue;
            }
        }
    }

    if (statementEnd) {
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

            if (trimmed === "" || trimmed.startsWith("//") || trimmed.startsWith("#")) {
                continue;
            }

            const head = trimmed.match(/^(?:if|for|while)\s*\(/);

            if (head) {
                let cursor = trimmed.indexOf("(");
                let depth = 0;

                while (cursor < trimmed.length) {
                    if (trimmed[cursor] === "(") depth++;
                    if (trimmed[cursor] === ")") {
                        depth--;
                        if (depth === 0) break;
                    }
                    cursor++;
                }

                if (trimmed.slice(cursor + 1).trim() === ";") {
                    errors.push({
                        line: i + 1,
                        col: raw.lastIndexOf(";") + 1,
                        message: "This statement has an empty body, so it does nothing."
                    });
                }
            }
        }
    }

    return sortErrors(errors);
}

export { lintBraceLanguage };