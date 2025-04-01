class Lexer {
    constructor() {
        this.tokenTypes = [
            // Basic keywords
            { type: 'RG_KEYWORD', pattern: /^RG\b/ },
            { type: 'INT_KEYWORD', pattern: /^int\b/ },
            { type: 'FLOAT_KEYWORD', pattern: /^float\b/ },
            { type: 'BOOL_KEYWORD', pattern: /^bool\b/ },

            // Control flow keywords (must come before IDENTIFIER)
            { type: 'IF', pattern: /^if\b/ },
            { type: 'ELSE', pattern: /^else\b/ },
            { type: 'WHILE', pattern: /^while\b/ },
            { type: 'FOR', pattern: /^for\b/ },
            { type: 'BREAK', pattern: /^break\b/ },
            { type: 'CONTINUE', pattern: /^continue\b/ },

            // Built-in functions (must come before IDENTIFIER)
            { type: 'PRINT', pattern: /^RG_Print\b/ },

            // Boolean literals (must come before IDENTIFIER)
            { type: 'TRUE', pattern: /^true\b/ },
            { type: 'FALSE', pattern: /^false\b/ },

            // Other literals
            { type: 'NUMBER', pattern: /^-?\d+(\.\d+)?/ },
            { type: 'STRING', pattern: /^"[^"]*"/ },

            // Identifier (must come after keywords, functions, and boolean literals)
            { type: 'IDENTIFIER', pattern: /^[a-zA-Z_][a-zA-Z0-9_]*/ },

            // Assignment and basic operators
            { type: 'ASSIGN', pattern: /^=/ },
            { type: 'PLUS', pattern: /^\+/ },
            { type: 'MINUS', pattern: /^\-/ },
            { type: 'MULTIPLY', pattern: /^\*/ },
            { type: 'DIVIDE', pattern: /^\// },
            { type: 'MODULO', pattern: /^%/ },

            // Advanced math functions
            { type: 'SQRT', pattern: /^sqrt\b/ },
            { type: 'POW', pattern: /^pow\b/ },
            { type: 'SIN', pattern: /^sin\b/ },
            { type: 'COS', pattern: /^cos\b/ },
            { type: 'TAN', pattern: /^tan\b/ },
            { type: 'LOG', pattern: /^log\b/ },
            { type: 'FACTORIAL', pattern: /^factorial\b/ },

            // Comparison operators (order matters for <= and >=)
            { type: 'LESS_EQUAL', pattern: /^<=/ },
            { type: 'GREATER_EQUAL', pattern: /^>=/ },
            { type: 'EQUAL_EQUAL', pattern: /^==/ },
            { type: 'NOT_EQUAL', pattern: /^!=/ },
            { type: 'LESS_THAN', pattern: /^</ },
            { type: 'GREATER_THAN', pattern: /^>/ },

            // Logical operators (order matters for ! vs !=)
            { type: 'AND', pattern: /^&&/ },
            { type: 'OR', pattern: /^\|\|/ },
            { type: 'NOT', pattern: /^!(?!=)/ },  // Match ! but not !=

            // Control flow
            { type: 'IF', pattern: /^if\b/ },
            { type: 'ELSE', pattern: /^else\b/ },
            { type: 'FOR', pattern: /^for\b/ },
            { type: 'WHILE', pattern: /^while\b/ },
            { type: 'BREAK', pattern: /^break\b/ },

            // Array operations
            { type: 'LBRACKET', pattern: /^\[/ },
            { type: 'RBRACKET', pattern: /^\]/ },
            { type: 'INSERT', pattern: /^insert\b/ },
            { type: 'DELETE', pattern: /^delete\b/ },

            // Punctuation
            { type: 'SEMICOLON', pattern: /^;/ },
            { type: 'LPAREN', pattern: /^\(/ },
            { type: 'RPAREN', pattern: /^\)/ },
            { type: 'LBRACE', pattern: /^\{/ },
            { type: 'RBRACE', pattern: /^\}/ },
            { type: 'COLON', pattern: /^:/ },
            { type: 'COMMA', pattern: /^,/ },

            // Whitespace (ignored)
            { type: 'WHITESPACE', pattern: /^\s+/ },

            // Comments
            { type: 'COMMENT', pattern: /^\/\/.*/ },
        ];
    }

    tokenize(source) {
        let tokens = [];
        let pos = 0;
        
        while (pos < source.length) {
            let matched = false;
            
            for (const tokenType of this.tokenTypes) {
                const match = source.slice(pos).match(tokenType.pattern);
                
                if (match && match.index === 0) {
                    if (tokenType.type !== 'WHITESPACE') {
                        tokens.push({
                            type: tokenType.type,
                            value: match[0],
                            position: pos
                        });
                    }
                    pos += match[0].length;
                    matched = true;
                    break;
                }
            }
            
            if (!matched) {
                throw new Error(`Unexpected character at position ${pos}: '${source[pos]}'`);
            }
        }
        
        tokens.push({ type: 'EOF', value: '', position: pos });
        return tokens;
    }
}