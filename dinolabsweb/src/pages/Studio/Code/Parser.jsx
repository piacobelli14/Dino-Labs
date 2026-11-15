export const getTokenPatterns = (language) => {
    switch (language.toLowerCase()) {
        case "python":
            return [
                `\\b(${[
                    "False", "class", "finally", "is", "return",
                    "None", "continue", "for", "lambda", "try",
                    "True", "def", "from", "nonlocal", "while",
                    "and", "del", "global", "not", "with",
                    "as", "elif", "if", "or", "yield",
                    "assert", "else", "import", "pass",
                    "break", "except", "in", "raise",
                    "async", "await", "match", "case"
                ].join("|")})\\b`,
                `(@[a-zA-Z_][a-zA-Z0-9_]*)`,
                `("""[^\\n]*?"""|'''[^\\n]*?'''|"""[^\\n]*$|'''[^\\n]*$|"""|''')`,
                `("(?:(?:[^"\\\\]|\\\\.)*)"|'(?:(?:[^'\\\\]|\\\\.)*)')`,
                `\\b([a-zA-Z_][a-zA-Z0-9_]*)\\b(?=\\()`,
                `(\\b\\d+(?:\\.\\d+)?\\b)`,
                `([+\\-*/%=&|<>!^~()\\[\\]{}]+)`,
                `(#.*)`,
                `\\b([a-zA-Z_][a-zA-Z0-9_]*)\\b`,
                `\\b(${[
                    "print", "len", "range", "open", "str", "int", "float", "list", "dict", "set", "tuple", "super", "self"
                ].join("|")})\\b`,
                `\\b(${["self", "cls"].join("|")})\\b`,
                `\\b(${["async", "await"].join("|")})\\b`,
                `\\b(${[
                    "List", "Dict", "Tuple", "Optional", "Union", "Any", "Callable", "Iterable", "Iterator", "Generator", "TypeVar", "Generic", "Protocol"
                ].join("|")})\\b`,
                `__([a-zA-Z_]+)__`
            ];
        case "typescript":
            return [
                `\\b(${[
                    "break", "case", "catch", "class", "const",
                    "continue", "debugger", "default", "delete", "do",
                    "else", "export", "extends", "finally", "for",
                    "function", "if", "import", "in", "instanceof",
                    "let", "new", "return", "super", "switch",
                    "this", "throw", "try", "typeof", "var",
                    "void", "while", "with", "yield", "await",
                    "implements", "interface", "package",
                    "private", "protected", "public", "static", "enum",
                    "null", "true", "false", "as", "async", "await",
                    "declare", "from", "get", "module", "of", "set", "type"
                ].join("|")})\\b`,
                `(@[a-zA-Z_][a-zA-Z0-9_]*)`,
                `((?:"(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'))`,
                `((?:\\/\\/.*)|(?:\\/\\*[^*]*\\*+(?:[^/*][^*]*\\*+)\\/))`,
                `(\\b\\d+(?:\\.\\d+)?\\b)`,
                `([==!=<>]=|[-+*/%&|^~<>()\\[\\]{}]=?)`,
                `\\b([a-zA-Z_][a-zA-Z0-9_]*)\\b(?=\\()`,
                `\\b([a-zA-Z_][a-zA-Z0-9_]*)\\b`,
                `\\b(${[
                    "console", "window", "document", "require", "module", "exports", "React", "useState", "useEffect", "props", "state"
                ].join("|")})\\b`,
                `\\b(${[
                    "Array", "String", "Number", "Boolean", "Object", "Function", "Date", "RegExp", "Map", "Set", "WeakMap", "WeakSet", "Promise", "ReadonlyArray", "Symbol", "BigInt"
                ].join("|")})\\b`,
                `\\b(${[
                    "Array", "String", "Number", "Boolean", "Object", "Function", "Date", "RegExp", "Map", "Set", "WeakMap", "WeakSet", "Promise", "ReadonlyArray", "Symbol", "BigInt"
                ].join("|")})\\b`,
                `</?[A-Z][A-Za-z0-9]+\\b`,
                `\\$\{[^}]+\}`
            ];
        case "javascript":
            return [
                `\\b(${[
                    "break", "case", "catch", "class", "const",
                    "continue", "debugger", "default", "delete", "do",
                    "else", "export", "extends", "finally", "for",
                    "function", "if", "import", "in", "instanceof",
                    "let", "new", "return", "super", "switch",
                    "this", "throw", "try", "typeof", "var",
                    "void", "while", "with", "yield", "await",
                    "implements", "interface", "package",
                    "private", "protected", "public", "static", "enum",
                    "null", "true", "false"
                ].join("|")})\\b`,
                `(@[a-zA-Z_][a-zA-Z0-9_]*)`,
                `((?:"(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'|\\\`(?:[^\\\`\\\\]|\\\\.)*\\\`))`,
                `((?:\\/\\/.*)|(?:\\/\\*[^*]*\\*+(?:[^/*][^*]*\\*+)\\/))`,
                `(\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b)`,
                `(\/(?:\\\/|[^\/\n])+\/[gimsuy]*)`,
                `([==!=<>]=|[-+*/%&|^~<>()\\[\\]{}]=?|===|!==|>>>=|<<=|>>=)`,
                `\\b([a-zA-Z_][a-zA-Z0-9_]*)\\b(?=\\()`,
                `\\b([a-zA-Z_][a-zA-Z0-9_]*)\\b`,
                `\\b(${[
                    "console", "window", "document", "require", "module", "exports", "React", "useState", "useEffect", "props", "state"
                ].join("|")})\\b`,
                `\\b(${[
                    "Array", "String", "Number", "Boolean", "Object", "Function", "Date", "RegExp", "Map", "Set", "WeakMap", "WeakSet", "Promise", "ReadonlyArray", "Symbol", "BigInt"
                ].join("|")})\\b`,
                `</?[A-Z][A-Za-z0-9]+\\b`,
                `\\$\{[^}]+\}`
            ];
        case "bash":
        case "shell":
            return [
                `\\b(${[
                    "if", "then", "else", "fi", "for", "while", "do", "done",
                    "case", "esac", "function", "in", "select", "until", "declare",
                    "readonly", "return", "continue", "break", "export",
                    "local", "shift", "getopts", "echo", "printf", "source",
                    "alias", "unalias", "true", "false", "cd", "pwd", "ls", "grep", "awk", "sed",
                    "mkdir", "rmdir", "touch", "rm", "cp", "mv", "chmod", "chown",
                    "declare", "typeset", "readonly", "let"
                ].join("|")})\\b`,
                `\\b(${[
                    "echo", "printf", "cd", "pwd", "ls", "grep", "awk", "sed",
                    "mkdir", "rmdir", "touch", "rm", "cp", "mv", "chmod", "chown",
                    "declare", "typeset", "readonly", "let"
                ].join("|")})\\b`,
                `\\b([a-zA-Z_][a-zA-Z0-9_]*)`,
                `(\\$\\[a-zA-Z_][a-zA-Z0-9_]*\\|\\$[a-zA-Z_][a-zA-Z0-9_]*)`,
                `(@[a-zA-Z_][a-zA-Z0-9_]*)`,
                `("(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*')`,
                `(#.*)`,
                `\\b(\\d+(?:\\.\\d+)?)\\b`,
                `([;&|<>!+\\-*/%=()\\[\\]{}]+)`,
                `(/(?:[a-zA-Z0-9_.-]+/)*[a-zA-Z0-9_.-]+)`
            ];
        case "c":
            return [
                `(#\\s*(?:include|define|ifndef|ifdef|endif|else|elif|if|pragma|undef|line|error|warning)\\b[^\\n]*)`,
                `\\b(${[
                    "auto", "break", "case", "char", "const", "continue", "default",
                    "do", "double", "else", "enum", "extern", "float", "for",
                    "goto", "if", "inline", "int", "long", "register", "restrict",
                    "return", "short", "signed", "sizeof", "static", "struct",
                    "switch", "typedef", "union", "unsigned", "void", "volatile",
                    "while"
                ].join("|")})\\b`,
                `(@[a-zA-Z_][a-zA-Z0-9_]*)`,
                `((?:"(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'))`,
                `((?:\\/\\/.*)|(?:\\/\\*[^*]*\\*+(?:[^/*][^*]*\\*+)\\/))`,
                `(\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b)`,
                `([==!=<>]=|[-+*/%&|^~<>()\\[\\]{}]=?|->|\\.|,)`,
                `\\b([a-zA-Z_][a-zA-Z0-9_]*)\\b(?=\\()`,
                `\\b([a-zA-Z_][a-zA-Z0-9_]*)\\b`,
                `#include\\s*<[^>]+>`,
                `#ifndef\\s+\\w+`,
                `#define\\s+\\w+`,
                `#endif`,
                `\\b(${[
                    "printf", "scanf", "cout", "cin", "std", "this", "super", "self", "new", "delete", "nullptr",
                    "std", "vector", "map", "unordered_map", "string", "iostream", "cin", "cout"
                ].join("|")})\\b`,
                `\\b(${[
                    "std", "vector", "map", "unordered_map", "string", "iostream", "cin", "cout"
                ].join("|")})\\b`,
                `\\b(${["nullptr", "NULL"].join("|")})\\b`,
                `<\\s*typename\\s+[a-zA-Z_][a-zA-Z0-9]*\\s*>`,
                `:\\s*(public|protected|private)\\s+[a-zA-Z_][a-zA-Z0-9_]*`
            ];
        case "c++":
            return [
                `(#\\s*(?:include|define|ifndef|ifdef|endif|else|elif|if|pragma|undef|line|error|warning)\\b[^\\n]*)`,
                `\\b(${[
                    "auto", "break", "case", "char", "const", "continue", "default",
                    "do", "double", "else", "enum", "extern", "float", "for",
                    "goto", "if", "inline", "int", "long", "register", "restrict",
                    "return", "short", "signed", "sizeof", "static", "struct",
                    "switch", "typedef", "union", "unsigned", "void", "volatile",
                    "while", "class", "public", "private", "protected", "namespace",
                    "using", "template", "typename", "virtual", "override"
                ].join("|")})\\b`,
                `(@[a-zA-Z_][a-zA-Z0-9_]*)`,
                `((?:"(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'))`,
                `((?:\\/\\/.*)|(?:\\/\\*[^*]*\\*+(?:[^/*][^*]*\\*+)\\/))`,
                `(\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b)`,
                `([==!=<>]=|[-+*/%&|^~<>]=?|::|->|\\.\\.{2,})`,
                `\\b([a-zA-Z_][a-zA-Z0-9_]*)\\b(?=\\()`,
                `\\b([a-zA-Z_][a-zA-Z0-9_]*)\\b`,
                `#include\\s*<[^>]+>`,
                `#ifndef\\s+\\w+`,
                `#define\\s+\\w+`,
                `#endif`,
                `\\b(${[
                    "printf", "scanf", "cout", "cin", "std", "this", "super", "self", "new", "delete", "nullptr",
                    "std", "vector", "map", "unordered_map", "string", "iostream", "cin", "cout"
                ].join("|")})\\b`,
                `\\b(${[
                    "std", "vector", "map", "unordered_map", "string", "iostream", "cin", "cout"
                ].join("|")})\\b`,
                `\\b(${["nullptr", "NULL"].join("|")})\\b`,
                `<\\s*typename\\s+[a-zA-Z_][a-zA-Z0-9]*\\s*>`,
                `:\\s*(public|protected|private)\\s+[a-zA-Z_][a-zA-Z0-9_]*`
            ];
        case "c#":
            return [
                `(#\\s*(?:include|define|ifndef|ifdef|endif|else|elif|if|pragma|undef|line|error|warning)\\b[^\\n]*)`,
                `\\b(${[
                    "abstract", "and", "as", "base", "bool", "break", "byte", "case",
                    "catch", "char", "checked", "class", "const", "continue", "decimal",
                    "default", "delegate", "do", "double", "else", "enum", "event",
                    "explicit", "extern", "false", "finally", "fixed", "float", "for",
                    "foreach", "goto", "if", "implicit", "in", "int", "interface",
                    "internal", "is", "lock", "long", "namespace", "new", "null",
                    "object", "operator", "out", "override", "params", "private",
                    "protected", "public", "readonly", "ref", "return", "sbyte",
                    "sealed", "short", "sizeof", "stackalloc", "static", "string",
                    "struct", "switch", "this", "throw", "true", "try", "typeof",
                    "uint", "ulong", "unchecked", "unsafe", "ushort", "using",
                    "virtual", "void", "volatile", "while"
                ].join("|")})\\b`,
                `(@[a-zA-Z_][a-zA-Z0-9_]*)`,
                `((?:"(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'))`,
                `((?:\\/\\/.*)|(?:\\/\\*[^*]*\\*+(?:[^/*][^*]*\\*+)\\/))`,
                `(\\b\\d+(?:\\.\\d+)?\\b)`,
                `([==!=<>]=|[-+*/%&|^~<>]=?)`,
                `\\b([a-zA-Z_][a-zA-Z0-9_]*)\\b(?=\\()`,
                `\\b([a-zA-Z_][a-zA-Z0-9_]*)\\b`,
                `#define\\s+[a-zA-Z_][a-zA-Z0-9_]*`,
                `#using\\s+["<][^">]+[">]`,
                `#namespace\\s+[a-zA-Z_][a-zA-Z0-9_.]*`,
                `\\b(${[
                    "Console", "Math", "String", "List", "Dictionary", "Array", "Task", "Exception", "Convert", "Environment", "Guid", "DateTime", "TimeSpan", "Nullable", "IEnumerable", "IList", "ICollection", "Stream", "File", "Directory"
                ].join("|")})\\b`,
                `\\b(${[
                    "Int32", "Int64", "String", "Boolean", "Double", "Decimal", "Object", "Void", "Char", "Byte", "Float", "UInt32", "UInt64", "Short", "UShort", "Long", "ULong", "SByte"
                ].join("|")})\\b`,
                `<[a-zA-Z_][a-zA-Z0-9_, ]*>`,
                `\\b(${[
                    "System", "Microsoft", "Collections", "Generic", "Linq", "Text", "Tasks"
                ].join("|")})\\b`,
                `\\b([A-Z][a-zA-Z0-9_]*)\\b`
            ];
        case "swift":
            return [
                `\\b(${[
                    "import", "class", "deinit", "enum", "extension", "func",
                    "init", "let", "protocol", "struct", "subscript",
                    "typealias", "var", "break", "case", "continue", "default",
                    "defer", "do", "else", "fallthrough", "for", "guard", "if",
                    "in", "repeat", "return", "switch", "where", "while", "as",
                    "Any", "catch", "false", "is", "nil", "rethrows", "super",
                    "self", "Self", "throw", "throws", "true", "try", "associatedtype",
                    "dynamic", "fileprivate", "final", "inout", "lazy", "open",
                    "nonmutating", "optional", "override", "private", "public",
                    "required", "static", "unowned", "weak", "willSet", "didSet",
                    "throws", "async", "await", "actor", "convenience", "dynamicType"
                ].join("|")})\\b`,
                `(@[a-zA-Z_][a-zA-Z0-9_]*)`,
                `((?:"(?:[^"\\\\]|\\\\.)*")|(?:'(?:[^'\\\\]|\\\\.)*'))`,
                `((?:\\/\\/.*)|(?:\\/\\*[^*]*\\*+(?:[^/*][^*]*\\*+)\\/))`,
                `(\\b\\d+(?:\\.\\d+)?\\b)`,
                `([==!=<>]=|[-+*/%&|^~<>()\\[\\]{}]=?|\\.|\\?|:)`,
                `\\b([a-zA-Z_][a-zA-Z0-9_]*)\\b(?=\\()`,
                `\\b([a-zA-Z_][a-zA-Z0-9_]*)\\b`,
                `\\b(${[
                    "print", "map", "filter", "reduce", "guard", "guard let", "guard var", "let", "var"
                ].join("|")})\\b`,
                `\\b(${[
                    "Int", "String", "Bool", "Double", "Float", "Array", "Dictionary", "Set", "Optional", "Any", "AnyObject", "Void", "Never"
                ].join("|")})\\b`,
                `\\b(${["self", "super"].join("|")})\\b`,
                `:\\s*([A-Z][a-zA-Z0-9_]*|[a-z]+)`
            ];
        case "sql":
            return [
                `\\b(${[
                    "SELECT", "FROM", "WHERE", "INSERT", "UPDATE", "DELETE", "CREATE",
                    "DROP", "ALTER", "JOIN", "INNER", "LEFT", "RIGHT", "FULL",
                    "ON", "AS", "INTO", "VALUES", "SET", "AND", "OR", "NOT", "NULL",
                    "LIKE", "BETWEEN", "EXISTS", "PRIMARY", "KEY", "FOREIGN",
                    "GROUP", "BY", "ORDER", "HAVING", "LIMIT", "OFFSET", "DISTINCT",
                    "UNION", "ALL", "ANY", "IN", "EXCEPT", "INTERSECT", "CASE",
                    "WHEN", "THEN", "ELSE", "END", "CAST", "CONVERT", "ISNULL",
                    "COALESCE", "TOP", "IDENTITY", "ROW_NUMBER", "OVER", "PARTITION",
                    "RANK", "DENSE_RANK", "CURRENT_DATE", "CURRENT_TIME", "CURRENT_TIMESTAMP"
                ].join("|")})\\b`,
                `((?:'(?:''|[^'])*')|(?:"(?:\\"|[^"])*"))`,
                `(--[^\\n\\r]*)`,
                `(\\b\\d+(?:\\.\\d+)?\\b)`,
                `(=|<>|!=|<|>|<=|>=|\\+|\\-|\\*|\\/|%|\\(|\\)|\\[|\\]|\\{|\\})`,
                `\\b([a-zA-Z_][a-zA-Z0-9_]*)\\b(?=\\()`,
                `\\b([a-zA-Z_][a-zA-Z0-9_]*)\\b`,
                `(\\bDATE\\b|\\bINT\\b|\\bVARCHAR\\b|\\bTEXT\\b|\\bBOOLEAN\\b|\\bDECIMAL\\b|\\bFLOAT\\b|\\bNUMERIC\\b|\\bCHAR\\b|\\bDATETIME\\b|\\bTIMESTAMP\\b)`,
                `\\b(${[
                    "COUNT", "SUM", "AVG", "MIN", "MAX", "NOW", "COALESCE", "NULLIF", "DATEADD", "DATEDIFF", "GROUP_CONCAT", "STDEV", "VAR"
                ].join("|")})\\b`,
                `\\b(${[
                    "CURRENT_DATE", "CURRENT_TIME", "CURRENT_TIMESTAMP", "GETDATE", "GETUTCDATE", "DATEPART", "DATEADD", "DATEDIFF", "FORMAT"
                ].join("|")})\\b`,
                `\\b(${[
                    "INNER JOIN", "LEFT JOIN", "RIGHT JOIN", "FULL OUTER JOIN", "CROSS JOIN", "NATURAL JOIN"
                ].join("|")})\\b`
            ];
        case "rust":
            return [
                `\\b(${[
                    "as", "async", "await", "break", "const", "continue", "crate",
                    "dyn", "else", "enum", "extern", "false", "fn", "for", "if",
                    "impl", "in", "let", "loop", "match", "mod", "move", "mut",
                    "pub", "ref", "return", "self", "static", "struct", "super",
                    "trait", "true", "type", "unsafe", "use", "where", "while",
                    "yield", "implements", "type", "as", "from", "of", "async",
                    "await", "dyn", "extern", "crate", "macro", "const",
                    "unsafe", "trait", "where", "type", "impl", "for", "fn"
                ].join("|")})\\b`,
                `(@[a-zA-Z_][a-zA-Z0-9_]*)`,
                `((?:"(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'))`,
                `((?:\\/\\/.*)|(?:\\/\\*[^*]*\\*+(?:[^/*][^*]*\\*+)\\/))`,
                `(\\b\\d+(?:\\.\\d+)?\\b)`,
                `([==!=<>]=|[-+*/%&|^~<>]=?|<<=|>>=|&&|\\|\\||\\(|\\)|\\[\\]|\\{|\\})`,
                `\\b([a-zA-Z_][a-zA-Z0-9_]*)\\b(?=\\()`,
                `\\b([a-zA-Z_][a-zA-Z0-9_]*)\\b`,
                `\\b(${[
                    "println", "vec", "String", "Option", "Result", "Some", "None", "println!", "format!", "print!", "dbg!"
                ].join("|")})\\b`,
                `\\b(${[
                    "Vec", "HashMap", "HashSet", "Box", "Rc", "Arc", "RefCell", "Mutex", "Option", "Result"
                ].join("|")})\\b`,
                `\\b(${["Option", "Result"].join("|")})\\b`,
                `'[a-zA-Z_][a-zA-Z0-9_]*`
            ];
        case "json":
            return [
                `("(?:(?:\\\\.|[^"\\\\])*)"(?=\\s*:))`,
                `("(?:(?:\\\\.|[^"\\\\])*)")`,
                `(\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b)`,
                `(\\b(?:true|false)\\b)`,
                `(\\bnull\\b)`,
                `([{}\\[\\]:,])`
            ];
        case "html":
            return [
                `(<!--[\\s\\S]*?-->)`,
                `(<!DOCTYPE[^>]*>)`,
                `(<\/?[A-Za-z][A-Za-z0-9]*\\b|<\/?|>|\\/>)`,
                `\\s+([A-Za-z][A-Za-z0-9-]*)`,
                `(=)`,
                `("[^"]*"|'[^']*')`,
                `(&(?:[a-zA-Z0-9]+;|#[0-9]+;|#x[a-fA-F0-9]+;))`,
                `([^<>&]+)`,
                `([\\(\\)\\[\\]\\{\\}])`
            ];
        case "xml":
            return [
                `(<!--[\\s\\S]*?-->)`,
                `(<\\?xml[^>]*\\?>)`,
                `(<!DOCTYPE[^>]*>)`,
                `(<!\\[CDATA\\[[\\s\\S]*?\\]\\]>)`,
                `(<\\/?[A-Za-z_][\\w.-]*(?::[\\w.-]+)?\\b|<\\/?|>|\\/>)`,
                `\\s+([A-Za-z_][\\w.-]*(?::[\\w.-]+)?)`,
                `(=)`,
                `("[^"]*"|'[^']*')`,
                `(&(?:[a-zA-Z0-9]+;|#[0-9]+;|#x[a-fA-F0-9]+;))`,
                `([^<>&]+)`,
                `([\\(\\)\\[\\]\\{\\}])`
            ];
        case "dockerfile":
            return [
                `(#[^\\n]*)`,
                `\\b(FROM|RUN|CMD|LABEL|MAINTAINER|EXPOSE|ENV|ADD|COPY|ENTRYPOINT|VOLUME|USER|WORKDIR|ARG|ONBUILD|STOPSIGNAL|HEALTHCHECK|SHELL|AS)\\b`,
                `("(?:(?:\\\\.|[^"\\\\])*)"|'(?:(?:\\\\.|[^'\\\\])*)')`,
                `(\\$\\{?[A-Za-z_][A-Za-z0-9_]*\\}?)`,
                `(\\b\\d+(?:\\.\\d+)*\\b)`,
                `([\\(\\)\\[\\]\\{\\}])`,
                `([=:,;|&<>]+)`
            ];
        case "makefile":
            return [
                `(#[^\\n]*)`,
                `\\b(ifeq|ifneq|ifdef|ifndef|else|endif|include|export|unexport|define|endef|override|vpath)\\b`,
                `(^\\.[A-Z][A-Z_]*\\b)`,
                `(^[A-Za-z_][\\w.-]*(?=\\s*:(?!=)))`,
                `(\\$[@<^?*+%]|\\$\\([A-Za-z_][A-Za-z0-9_]*\\)|\\$\\{[A-Za-z_][A-Za-z0-9_]*\\})`,
                `("(?:(?:\\\\.|[^"\\\\])*)"|'(?:(?:\\\\.|[^'\\\\])*)')`,
                `(\\b\\d+(?:\\.\\d+)*\\b)`,
                `([:+?!]?=)`,
                `([\\(\\)\\[\\]\\{\\}])`
            ];
        case "css":
            return [
                `(\\/\\*[\\s\\S]*?\\*\\/)`,
                `(@[a-zA-Z-]+)`,
                `("(?:(?:\\\\.|[^"\\\\])*)"|'(?:(?:\\\\.|[^'\\\\])*)')`,
                `(#[0-9a-fA-F]{3,8}\\b)`,
                `(\\b\\d+(?:\\.\\d+)?(?:px|em|rem|vh|vw|%|s|ms|deg|fr|ch)?\\b)`,
                `([.#][A-Za-z_-][A-Za-z0-9_-]*)`,
                `(:{1,2}[a-zA-Z-]+)`,
                `\\b([a-zA-Z-]+)(?=\\s*:)`,
                `([{}();:,])`
            ];
        case "monkey c":
            return [
                `(\\/\\/[^\\n]*)`,
                `(\\/\\*[\\s\\S]*?\\*\\/)`,
                `("(?:(?:\\\\.|[^"\\\\])*)")`,
                `(\\b(?:class|function|var|const|enum|module|using|import|extends|return|if|else|while|for|do|switch|case|break|continue|new|self|me|null|true|false|static|hidden|public|private|protected|instanceof|has|throw|try|catch|finally)\\b)`,
                `(\\b(?:Toybox|System|Lang|WatchUi|Graphics|Application|Position|Sensor|Activity|Timer|Math)\\b)`,
                `(\\b\\d+(?:\\.\\d+)?[lLdDfF]?\\b)`,
                `(\\b[A-Z][A-Za-z0-9_]*\\b)`,
                `([{}()\\[\\];,.])`
            ];
        case "markdown":
            return [
                `(^#{1,6}\\s[^\\n]*)`,
                `(\\*\\*[^*\\n]+\\*\\*|__[^_\\n]+__)`,
                `(\\*[^*\\n]+\\*|_[^_\\n]+_)`,
                "(\u0060\u0060\u0060[\\s\\S]*?\u0060\u0060\u0060|\u0060[^\u0060\n]+\u0060)",
                `(\\[[^\\]\\n]*\\]\\([^)\\n]*\\))`,
                `(^\\s*[-*+]\\s|^\\s*\\d+\\.\\s)`,
                `(^\\s*>[^\\n]*)`,
                `(^\\s*(?:---|\\*\\*\\*|___)\\s*$)`
            ];
        default:
            return null;
    }
};

export const tokenTypes = {
    python: [
        "keyword", "decorator", "string", "string", "function", "number", "operator", "comment", "variable", "builtin",
        "variable", "keyword", "type-hint", "magic-method"
    ],
    typescript: [
        "keyword", "decorator", "string", "comment", "number", "operator", "function", "variable", "builtin", "type",
        "type", "jsx-tag", "template-placeholder"
    ],
    javascript: [
        "keyword", "decorator", "string", "comment", "number", "regex", "operator", "function", "variable", "builtin",
        "type", "jsx-tag", "template-placeholder"
    ],
    bash: [
        "keyword", "command", "variable", "variable-interpolation", "decorator", "string", "comment", "number", "operator",
        "filepath"
    ],
    shell: [
        "keyword", "command", "variable", "variable-interpolation", "decorator", "string", "comment", "number", "operator",
        "filepath"
    ],
    c: [
        "preprocessor", "keyword", "decorator", "string", "comment", "number", "operator", "function", "variable",
        "preprocessor", "preprocessor", "preprocessor", "preprocessor", "builtin", "builtin", "builtin", "type", "class-name"
    ],
    "c++": [
        "preprocessor", "keyword", "decorator", "string", "comment", "number", "operator", "function", "variable",
        "preprocessor", "preprocessor", "preprocessor", "preprocessor", "builtin", "builtin", "builtin", "type", "class-name"
    ],
    "c#": [
        "preprocessor", "keyword", "decorator", "string", "comment", "number", "operator", "function", "variable",
        "preprocessor", "preprocessor", "preprocessor", "builtin", "type", "type", "namespace", "class-name"
    ],
    swift: [
        "keyword", "decorator", "string", "comment", "number", "operator", "function", "variable", "builtin", "type",
        "boolean", "type-annotation"
    ],
    sql: [
        "keyword", "string", "comment", "number", "operator", "function", "variable", "datatype", "aggregate-function",
        "date-function", "join-type"
    ],
    "monkey c": [
        "comment",
        "comment",
        "string",
        "keyword",
        "builtin",
        "number",
        "class-name",
        "operator"
    ],
    rust: [
        "keyword", "decorator", "string", "comment", "number", "operator", "function", "variable", "builtin", "type",
        "standard-library", "lifetime"
    ],
    json: [
        "key", "string", "number", "boolean", "null", "punctuation"
    ],
    css: [
        "comment",
        "at-rule",
        "string",
        "hex-color",
        "number",
        "selector",
        "pseudo",
        "property",
        "operator"
    ],
    markdown: [
        "heading",
        "bold",
        "italic",
        "code",
        "link",
        "list",
        "quote",
        "rule"
    ],
    html: [
        "comment",
        "doctype",
        "tag",
        "attribute",
        "operator",
        "string",
        "entity",
        "text",
        "operator"
    ],
};

const regexCache = new Map();
const tokenCacheSize = 200;

const compiledRegexMap = new Map();

const getCompiledRegex = (language) => {
    const lowerLang = language.toLowerCase();

    if (compiledRegexMap.has(lowerLang)) {
        return compiledRegexMap.get(lowerLang);
    }

    const patterns = getTokenPatterns(lowerLang);
    if (!patterns) return null;

    const regex = new RegExp(patterns.join("|"), "gi");

    if (compiledRegexMap.size >= tokenCacheSize) {
        const firstKey = compiledRegexMap.keys().next().value;
        compiledRegexMap.delete(firstKey);
    }

    compiledRegexMap.set(lowerLang, regex);
    return regex;
};

const tokenCache = new Map();
const tokenCacheMaxSize = 1000;
const lineTokenCache = new Map();
const lineCacheMaxSize = 2000;

const fastHash = (str) => {
    let hash = 0;
    const len = str.length;
    for (let i = 0; i < len; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash;
};

const getCachedLineTokens = (lineContent, language, lineNumber) => {
    const contentHash = fastHash(lineContent);
    const cacheKey = `${language}-${lineNumber}-${contentHash}`;

    if (lineTokenCache.has(cacheKey)) {
        return lineTokenCache.get(cacheKey);
    }

    const tokens = tokenizeLineOptimized(lineContent, language, lineNumber);

    if (lineTokenCache.size >= lineCacheMaxSize) {
        const firstKey = lineTokenCache.keys().next().value;
        lineTokenCache.delete(firstKey);
    }

    lineTokenCache.set(cacheKey, tokens);
    return tokens;
};

const tokenizeLineOptimized = (lineContent, language, lineNumber) => {
    if (!lineContent) {
        return [{ value: "", lineNumber }];
    }

    const regex = getCompiledRegex(language);
    if (!regex) {
        return [{ value: lineContent, lineNumber }];
    }

    const tokens = [];
    const lowerLang = language?.toLowerCase();
    const typeMap = tokenTypes[lowerLang] || [];

    let match;
    let lastIndex = 0;
    regex.lastIndex = 0;

    const lineLength = lineContent.length;

    while ((match = regex.exec(lineContent)) !== null && match.index < lineLength) {
        if (match.index > lastIndex) {
            const precedingText = lineContent.slice(lastIndex, match.index);
            if (precedingText) {
                tokens.push({ value: precedingText, lineNumber });
            }
        }

        let tokenType = null;
        for (let i = 1; i < match.length; i++) {
            if (match[i] !== undefined) {
                tokenType = typeMap[i - 1] || null;
                break;
            }
        }

        if (match[0]) {
            tokens.push({
                value: match[0],
                type: tokenType,
                lineNumber
            });
        }

        lastIndex = regex.lastIndex;

        if (lastIndex === match.index) {
            lastIndex++;
            regex.lastIndex = lastIndex;
        }
    }

    if (lastIndex < lineLength) {
        const remainingText = lineContent.slice(lastIndex);
        if (remainingText) {
            tokens.push({ value: remainingText, lineNumber });
        }
    }

    return tokens;
};

export const tokenize = (codeStr, language) => {
    if (!codeStr || codeStr.length < 3) {
        return [{ value: codeStr || "", lineNumber: 1 }];
    }

    const contentHash = fastHash(codeStr);
    const cacheKey = `${language}-${contentHash}`;

    if (tokenCache.has(cacheKey)) {
        return tokenCache.get(cacheKey);
    }

    const lines = codeStr.split(/\r?\n/);
    const allTokens = [];

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const lineNumber = lineIndex + 1;
        const lineContent = lines[lineIndex];
        const lineTokens = getCachedLineTokens(lineContent, language, lineNumber);
        allTokens.push(...lineTokens);
    }

    if (tokenCache.size >= tokenCacheMaxSize) {
        const firstKey = tokenCache.keys().next().value;
        tokenCache.delete(firstKey);
    }

    tokenCache.set(cacheKey, allTokens);
    return allTokens;
};

export const tokenizeViewport = (codeStr, language, startLine, endLine) => {
    if (!codeStr) {
        return [];
    }

    const lines = codeStr.split(/\r?\n/);
    const allTokens = [];

    const actualStart = Math.max(0, startLine - 1);
    const actualEnd = Math.min(lines.length - 1, endLine - 1);

    for (let lineIndex = actualStart; lineIndex <= actualEnd; lineIndex++) {
        const lineNumber = lineIndex + 1;
        const lineContent = lines[lineIndex];
        const lineTokens = getCachedLineTokens(lineContent, language, lineNumber);
        allTokens.push(...lineTokens);
    }

    return allTokens;
};

export const escapeHtml = (str) => {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

export const escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const lineHighlightCache = new Map();
const highlightCacheMaxSize = 1500;

const MULTILINE_REGIONS = {
    python: [['"""', '"""', "string"], ["'''", "'''", "string"]],
    javascript: [["/*", "*/", "comment"], ["`", "`", "string"]],
    typescript: [["/*", "*/", "comment"], ["`", "`", "string"]],
    react: [["/*", "*/", "comment"], ["`", "`", "string"]],
    node: [["/*", "*/", "comment"], ["`", "`", "string"]],
    css: [["/*", "*/", "comment"]],
    scss: [["/*", "*/", "comment"]],
    less: [["/*", "*/", "comment"]],
    c: [["/*", "*/", "comment"]],
    "c++": [["/*", "*/", "comment"]],
    "c#": [["/*", "*/", "comment"]],
    java: [["/*", "*/", "comment"]],
    swift: [["/*", "*/", "comment"]],
    rust: [["/*", "*/", "comment"]],
    go: [["/*", "*/", "comment"], ["`", "`", "string"]],
    kotlin: [["/*", "*/", "comment"]],
    "monkey c": [["/*", "*/", "comment"]],
    sql: [["/*", "*/", "comment"]],
    html: [["<!--", "-->", "comment"]],
    xml: [["<!--", "-->", "comment"], ["<![CDATA[", "]]>", "string"]],
    markdown: [["<!--", "-->", "comment"]]
};

const computeLineStates = (lines, language) => {
    const regions = MULTILINE_REGIONS[(language || "").toLowerCase()];
    const states = new Array(lines.length).fill(null);

    if (!regions) return states;

    let open = null;

    for (let i = 0; i < lines.length; i++) {
        states[i] = open;

        const line = lines[i];

        let cursor = 0;

        while (cursor < line.length) {
            if (open) {
                const close = line.indexOf(open[1], cursor);

                if (close === -1) break;

                cursor = close + open[1].length;
                open = null;
                continue;
            }

            let nextAt = -1;
            let nextRegion = null;

            for (const region of regions) {
                const at = line.indexOf(region[0], cursor);

                if (at !== -1 && (nextAt === -1 || at < nextAt)) {
                    nextAt = at;
                    nextRegion = region;
                }
            }

            if (nextAt === -1) break;

            const afterOpen = nextAt + nextRegion[0].length;
            const closeOnLine = line.indexOf(nextRegion[1], afterOpen);

            if (closeOnLine === -1) {
                open = nextRegion;
                break;
            }

            cursor = closeOnLine + nextRegion[1].length;
        }
    }

    return states;
};

const highlightInsideFence = (lineContent, region, themeName) => {
    const prefix = themeName === "default" ? "default-token" : `${themeName}-token`;
    const tokenClass = region[2];
    const close = lineContent.indexOf(region[1]);

    if (close === -1) {
        return `<span class=\"${prefix} ${tokenClass}\">${escapeHtml(lineContent)}</span>`;
    }

    const inside = lineContent.slice(0, close + region[1].length);
    const after = lineContent.slice(close + region[1].length);

    return `<span class=\"${prefix} ${tokenClass}\">${escapeHtml(inside)}</span>${escapeHtml(after)}`;
};

const getCachedLineHighlight = (lineContent, language, lineNumber, searchTerm, isCaseSensitive, themeName, openFence) => {
    const contentHash = fastHash(lineContent + searchTerm + isCaseSensitive + themeName + (openFence ? openFence[0] : ""));
    const cacheKey = `${language}-${lineNumber}-${contentHash}`;

    if (lineHighlightCache.has(cacheKey)) {
        return lineHighlightCache.get(cacheKey);
    }

    const highlighted = openFence
        ? highlightInsideFence(lineContent, openFence, themeName)
        : highlightSingleLineOptimized(lineContent, language, lineNumber, searchTerm, isCaseSensitive, themeName);

    if (lineHighlightCache.size >= highlightCacheMaxSize) {
        const firstKey = lineHighlightCache.keys().next().value;
        lineHighlightCache.delete(firstKey);
    }

    lineHighlightCache.set(cacheKey, highlighted);
    return highlighted;
};

const highlightSingleLineOptimized = (lineContent, language, lineNumber, searchTerm, isCaseSensitive, themeName) => {
    if ((language || "").toLowerCase() === "unknown") {
        return escapeHtml(lineContent);
    }

    const tokens = getCachedLineTokens(lineContent, language, lineNumber);

    let themeClass = "default-token";
    switch ((themeName || "").toLowerCase()) {
        case "dark":
            themeClass = "dark-token";
            break;
        case "light":
            themeClass = "light-token";
            break;
        default:
            themeClass = "default-token";
    }

    let searchRegex = null;
    if (searchTerm) {
        try {
            const escapedSearchTerm = escapeRegExp(searchTerm);
            const flags = isCaseSensitive ? "g" : "gi";
            searchRegex = new RegExp(escapedSearchTerm, flags);
        } catch (error) {
            searchRegex = null;
        }
    }

    const lineTokens = tokens.filter((token) => token.lineNumber === lineNumber);

    if (!searchRegex) {
        let lineHTML = "";
        for (const token of lineTokens) {
            const tokenText = token.value;
            if (token.type && token.type !== "space") {
                lineHTML += `<span class="${themeClass} ${token.type}">${escapeHtml(tokenText)}</span>`;
            } else {
                lineHTML += escapeHtml(tokenText);
            }
        }
        return lineHTML;
    }

    const plainText = lineTokens.map((t) => t.value).join("");

    let matches = [];
    let matchRanges = [];

    try {
        matches = Array.from(plainText.matchAll(searchRegex));
        matchRanges = matches.map((m) => ({
            start: m.index,
            end: m.index + m[0].length
        }));
    } catch (e) {
        matchRanges = [];
    }

    const isTokenInMatch = (start, end) => {
        return matchRanges.some((range) => start < range.end && end > range.start);
    };

    const isTokenFullyInMatch = (start, end) => {
        return matchRanges.some(
            (range) => start >= range.start && end <= range.end
        );
    };

    let lineHTML = "";
    let currentChar = 0;

    for (const token of lineTokens) {
        const tokenText = token.value;
        const tokenLength = tokenText.length;
        const tokenStart = currentChar;
        const tokenEnd = currentChar + tokenLength;
        currentChar += tokenLength;

        let tokenHtml = token.type && token.type !== "space"
            ? `<span class="${themeClass} ${token.type}">${escapeHtml(tokenText)}</span>`
            : escapeHtml(tokenText);

        if (isTokenFullyInMatch(tokenStart, tokenEnd)) {
            tokenHtml = `<span class="searchHighlight">${tokenHtml}</span>`;
        } else if (isTokenInMatch(tokenStart, tokenEnd)) {
            const overlappingRanges = matchRanges.filter(
                (range) => tokenStart < range.end && tokenEnd > range.start
            );
            let newTokenHtml = "";
            let localIndex = 0;

            for (const range of overlappingRanges) {
                if (range.start > tokenStart + localIndex) {
                    const beforeCount = range.start - (tokenStart + localIndex);
                    const beforeText = tokenText.substr(localIndex, beforeCount);
                    if (token.type && token.type !== "space") {
                        newTokenHtml += `<span class="${themeClass} ${token.type}">${escapeHtml(
                            beforeText
                        )}</span>`;
                    } else {
                        newTokenHtml += escapeHtml(beforeText);
                    }
                    localIndex += beforeCount;
                }

                const highlightCount =
                    Math.min(range.end, tokenEnd) - Math.max(range.start, tokenStart);
                const matchedText = tokenText.substr(localIndex, highlightCount);
                newTokenHtml += `<span class="searchHighlight">`;
                if (token.type && token.type !== "space") {
                    newTokenHtml += `<span class="${themeClass} ${token.type}">${escapeHtml(
                        matchedText
                    )}</span>`;
                } else {
                    newTokenHtml += escapeHtml(matchedText);
                }
                newTokenHtml += `</span>`;
                localIndex += highlightCount;
            }

            if (localIndex < tokenText.length) {
                const remainder = tokenText.substr(localIndex);
                if (token.type && token.type !== "space") {
                    newTokenHtml += `<span class="${themeClass} ${token.type}">${escapeHtml(
                        remainder
                    )}</span>`;
                } else {
                    newTokenHtml += escapeHtml(remainder);
                }
            }
            tokenHtml = newTokenHtml;
        }

        lineHTML += tokenHtml;
    }

    return lineHTML;
};

export const LANGUAGE_SYNTAX = {
    javascript: { line: "//", block: ["/*", "*/"] },
    typescript: { line: "//", block: ["/*", "*/"] },
    c: { line: "//", block: ["/*", "*/"] },
    "c++": { line: "//", block: ["/*", "*/"] },
    "c#": { line: "//", block: ["/*", "*/"] },
    rust: { line: "//", block: ["/*", "*/"] },
    swift: { line: "//", block: ["/*", "*/"] },
    "monkey c": { line: "//", block: ["/*", "*/"] },
    css: { line: null, block: ["/*", "*/"] },
    json: { line: null, block: null },
    python: { line: "#", block: null },
    bash: { line: "#", block: null },
    shell: { line: "#", block: null },
    sql: { line: "--", block: ["/*", "*/"] },
    html: { line: null, block: ["<!--", "-->"] },
    xml: { line: null, block: ["<!--", "-->"] },
    dockerfile: { line: "#", block: null },
    makefile: { line: "#", block: null },
    markdown: { line: null, block: ["<!--", "-->"] }
};

export const getCommentSyntax = (language) => {
    return LANGUAGE_SYNTAX[(language || "").toLowerCase()] || { line: "//", block: ["/*", "*/"] };
};

const INDENT_OPENERS = /[{([]\s*$/;
const INDENT_CLOSERS = /^\s*[})\]]/;
const BLOCK_STARTERS = /:\s*$/;

export const shouldIndentAfter = (lineText, language) => {
    const lang = (language || "").toLowerCase();

    if (INDENT_OPENERS.test(lineText)) {
        return true;
    }

    if (lang === "python" && BLOCK_STARTERS.test(lineText)) {
        return true;
    }

    return false;
};

export const shouldDedentLine = (lineText) => INDENT_CLOSERS.test(lineText);

export const AUTO_CLOSE_PAIRS = {
    "(": ")",
    "[": "]",
    "{": "}",
    "\"": "\"",
    "'": "'",
    "`": "`"
};

export const CLOSING_CHARS = new Set([")", "]", "}", "\"", "'", "`"]);

export const getVisibleLineRange = (containerElement, lineHeight) => {
    if (!containerElement || !lineHeight) {
        return { startLine: 1, endLine: 100 };
    }

    const containerRect = containerElement.getBoundingClientRect();
    const scrollTop = containerElement.scrollTop;
    const containerHeight = containerRect.height;

    const buffer = 25;
    const startLine = Math.max(1, Math.floor(scrollTop / lineHeight) - buffer);
    const endLine = Math.ceil((scrollTop + containerHeight) / lineHeight) + buffer;

    return { startLine, endLine };
};

export const syntaxHighlightViewportOptimized = (
    codeStr,
    language,
    searchTerm,
    isCaseSensitive,
    startLine,
    endLine,
    themeName = "default"
) => {
    if ((language || "").toLowerCase() === "unknown") {
        return escapeHtml(codeStr).replace(/\n/g, "<br/>");
    }

    const lines = codeStr.split(/\r?\n/);
    const lineStates = computeLineStates(lines, language);
    const highlightedLines = [];

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const lineNumber = lineIndex + 1;
        const lineContent = lines[lineIndex];

        if (lineNumber >= startLine && lineNumber <= endLine) {
            const lineHTML = getCachedLineHighlight(
                lineContent,
                language,
                lineNumber,
                searchTerm,
                isCaseSensitive,
                themeName,
                lineStates[lineIndex]
            );
            highlightedLines.push(lineHTML);
        } else {
            highlightedLines.push(escapeHtml(lineContent));
        }
    }

    return highlightedLines.join("<br/>");
};

export const syntaxHighlight = (
    codeStr,
    language,
    searchTerm,
    isCaseSensitive,
    activeLineNumber = null,
    themeName = "default"
) => {
    if ((language || "").toLowerCase() === "unknown") {
        return escapeHtml(codeStr).replace(/\n/g, "<br/>");
    }

    const contentHash = fastHash(codeStr + language + searchTerm + isCaseSensitive + themeName);
    const cacheKey = `full-${contentHash}`;

    if (lineHighlightCache.has(cacheKey)) {
        return lineHighlightCache.get(cacheKey);
    }

    const lines = codeStr.split(/\r?\n/);
    const lineStates = computeLineStates(lines, language);
    const highlightedLines = [];

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const lineNumber = lineIndex + 1;
        const lineContent = lines[lineIndex];

        const lineHTML = getCachedLineHighlight(
            lineContent,
            language,
            lineNumber,
            searchTerm,
            isCaseSensitive,
            themeName,
            lineStates[lineIndex]
        );

        highlightedLines.push(lineHTML);
    }

    const result = highlightedLines.join("<br/>");

    if (lineHighlightCache.size >= highlightCacheMaxSize) {
        const firstKey = lineHighlightCache.keys().next().value;
        lineHighlightCache.delete(firstKey);
    }

    lineHighlightCache.set(cacheKey, result);
    return result;
};