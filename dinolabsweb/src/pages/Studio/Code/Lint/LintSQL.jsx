import { tokenizeSource, checkBalance, checkIndentation, sortErrors } from "../LintCore.jsx";

const KEYWORDS = new Set([
    "SELECT", "FROM", "WHERE", "INSERT", "INTO", "VALUES", "UPDATE", "SET",
    "DELETE", "CREATE", "TABLE", "ALTER", "DROP", "INDEX", "VIEW", "JOIN",
    "INNER", "LEFT", "RIGHT", "FULL", "OUTER", "CROSS", "ON", "GROUP", "BY",
    "ORDER", "HAVING", "LIMIT", "OFFSET", "UNION", "ALL", "DISTINCT", "AS",
    "AND", "OR", "NOT", "NULL", "IS", "IN", "EXISTS", "BETWEEN", "LIKE",
    "CASE", "WHEN", "THEN", "ELSE", "END", "WITH", "RETURNING", "CONFLICT",
    "CONSTRAINT", "PRIMARY", "FOREIGN", "KEY", "REFERENCES", "UNIQUE", "CHECK",
    "DEFAULT", "CASCADE", "BEGIN", "COMMIT", "ROLLBACK", "GRANT", "REVOKE"
]);

const DANGEROUS = new Set(["DELETE", "UPDATE", "DROP", "TRUNCATE"]);

function lintSQL(code) {
    const errors = [];

    const scan = tokenizeSource(code, {
        lineComment: "--",
        blockComment: ["/*", "*/"],
        stringDelimiters: ["'", "\""],
        templateDelimiter: null,
        allowRegex: false
    });

    errors.push(...scan.errors);
    errors.push(...checkBalance(scan.tokens));
    errors.push(...checkIndentation(code));

    const statements = [];
    let current = { tokens: [], line: 1 };

    for (const token of scan.tokens) {
        if (token.type === "comment") {
            continue;
        }

        if (token.type === "punctuation" && token.value === ";") {
            if (current.tokens.length > 0) {
                statements.push(current);
            }
            current = { tokens: [], line: token.line };
            continue;
        }

        if (current.tokens.length === 0) {
            current.line = token.line;
        }

        current.tokens.push(token);
    }

    if (current.tokens.length > 0) {
        statements.push(current);
        errors.push({
            line: current.tokens[current.tokens.length - 1].line,
            col: current.tokens[current.tokens.length - 1].col,
            message: "This statement is missing its terminating semicolon."
        });
    }

    for (const statement of statements) {
        const words = statement.tokens
            .filter((token) => token.type === "identifier")
            .map((token) => ({ value: token.value.toUpperCase(), token }));

        if (words.length === 0) {
            continue;
        }

        const verb = words[0].value;
        const names = words.map((word) => word.value);

        if (DANGEROUS.has(verb) && verb !== "DROP" && verb !== "TRUNCATE" && !names.includes("WHERE")) {
            errors.push({
                line: words[0].token.line,
                col: words[0].token.col,
                message: `'${verb}' without a WHERE clause affects every row.`
            });
        }

        if (verb === "SELECT") {
            const star = statement.tokens.find((token) => token.value === "*");

            if (!names.includes("FROM") && !names.includes("DUAL")) {
                const hasFunction = statement.tokens.some((token) => token.value === "(");

                if (!hasFunction) {
                    errors.push({
                        line: words[0].token.line,
                        col: words[0].token.col,
                        message: "This SELECT statement is missing its FROM clause."
                    });
                }
            }

            const joinIndex = names.indexOf("JOIN");

            if (joinIndex >= 0 && !names.includes("ON") && !names.includes("USING") && names[joinIndex - 1] !== "CROSS") {
                errors.push({
                    line: words[joinIndex].token.line,
                    col: words[joinIndex].token.col,
                    message: "This JOIN is missing its ON or USING clause."
                });
            }
        }

        if (verb === "INSERT" && !names.includes("VALUES") && !names.includes("SELECT")) {
            errors.push({
                line: words[0].token.line,
                col: words[0].token.col,
                message: "This INSERT statement is missing VALUES or a SELECT source."
            });
        }

        for (const word of words) {
        }
    }

    const codeLines = code.split(/\r?\n/);

    for (let i = 0; i < codeLines.length; i++) {
        const trimmed = codeLines[i].trim();

        if (/=\s*NULL\b/i.test(trimmed) || /!=\s*NULL\b/i.test(trimmed) || /<>\s*NULL\b/i.test(trimmed)) {
            errors.push({
                line: i + 1,
                col: codeLines[i].search(/[=!<>]/) + 1,
                message: "Use IS NULL or IS NOT NULL, because equality never matches NULL."
            });
        }
    }

    return sortErrors(errors);
}

export { lintSQL };