class Lexer {
    constructor() {
        this.tokenTypes = [
            { type: 'RG_KEYWORD', pattern: /^RG\b/ },
            { type: 'INT_KEYWORD', pattern: /^int\b/ },
            { type: 'IDENTIFIER', pattern: /^[a-zA-Z_][a-zA-Z0-9_]*/ },
            { type: 'NUMBER', pattern: /^-?\d+(\.\d+)?/ },
            { type: 'STRING', pattern: /^"[^"]*"/ },
            { type: 'ASSIGN', pattern: /^=/ },
            { type: 'PLUS', pattern: /^\+/ },
            { type: 'MINUS', pattern: /^\-/ },
            { type: 'MULTIPLY', pattern: /^\*/ },
            { type: 'DIVIDE', pattern: /^\// },
            { type: 'MODULO', pattern: /^%/ },
            { type: 'SEMICOLON', pattern: /^;/ },
            { type: 'LPAREN', pattern: /^\(/ },
            { type: 'RPAREN', pattern: /^\)/ },
            { type: 'COLON', pattern: /^:/ },
            { type: 'COMMA', pattern: /^,/ },
            { type: 'PRINT', pattern: /^RG_Print\b/ },
            { type: 'WHITESPACE', pattern: /^\s+/ },
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