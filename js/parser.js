class Parser {
    constructor(tokens) {
        this.tokens = tokens;
        this.current = 0;
    }

    parse() {
        const statements = [];
        
        while (!this.isAtEnd()) {
            try {
                const stmt = this.declaration();
                if (stmt) {
                    statements.push(stmt);
                }
            } catch (error) {
                console.error(error.message);
                this.synchronize();
            }
        }
        
        return {
            type: 'Program',
            body: statements
        };
    }

    declaration() {
        try {
            if (this.check('RG_KEYWORD')) {
                this.advance(); // Consume RG
                this.consume('INT_KEYWORD', 'Expect int keyword');
                const name = this.consume('IDENTIFIER', 'Expect variable name');
                
                this.consume('ASSIGN', 'Expect = after variable name');
                const initializer = this.expression();
                
                this.consume('SEMICOLON', 'Expect ; after variable declaration');
                
                return {
                    type: 'VariableDeclaration',
                    name: name.value,
                    initializer
                };
            }
            
            if (this.check('PRINT')) {
                return this.printStatement();
            }
            
            throw this.error(this.peek(), 'Expect declaration or statement');
        } catch (error) {
            console.error(error.message);
            this.synchronize();
            return null;
        }
    }

    printStatement() {
        this.advance(); // Consume PRINT
        this.consume('LPAREN', 'Expect ( after RG_Print');
        
        const args = [];
        if (!this.check('RPAREN')) {
            do {
                args.push(this.expression());
            } while (this.match('COMMA'));
        }
        
        this.consume('RPAREN', 'Expect ) after arguments');
        this.consume('SEMICOLON', 'Expect ; after RG_Print');
        
        return {
            type: 'PrintStatement',
            args
        };
    }

    expression() {
        return this.assignment();
    }

    assignment() {
        const expr = this.addition();
        
        if (this.match('ASSIGN')) {
            const equals = this.previous();
            const value = this.assignment();
            
            if (expr.type === 'Identifier') {
                return {
                    type: 'AssignmentExpression',
                    name: expr.name,
                    value
                };
            }
            
            throw this.error(equals, 'Invalid assignment target');
        }
        
        return expr;
    }

    addition() {
        let expr = this.multiplication();
        
        while (this.match('PLUS', 'MINUS')) {
            const operator = this.previous();
            const right = this.multiplication();
            expr = {
                type: 'BinaryExpression',
                left: expr,
                operator: operator.value,
                right
            };
        }
        
        return expr;
    }

    multiplication() {
        let expr = this.unary();
        
        while (this.match('MULTIPLY', 'DIVIDE', 'MODULO')) {
            const operator = this.previous();
            const right = this.unary();
            expr = {
                type: 'BinaryExpression',
                left: expr,
                operator: operator.value,
                right
            };
        }
        
        return expr;
    }

    unary() {
        if (this.match('MINUS')) {
            const operator = this.previous();
            const right = this.unary();
            return {
                type: 'UnaryExpression',
                operator: operator.value,
                right
            };
        }
        
        return this.primary();
    }

    primary() {
        if (this.match('NUMBER')) {
            return {
                type: 'Literal',
                value: parseFloat(this.previous().value)
            };
        }
        
        if (this.match('STRING')) {
            return {
                type: 'Literal',
                value: this.previous().value.slice(1, -1)
            };
        }
        
        if (this.match('IDENTIFIER')) {
            return {
                type: 'Identifier',
                name: this.previous().value
            };
        }
        
        if (this.match('LPAREN')) {
            const expr = this.expression();
            this.consume('RPAREN', 'Expect ) after expression');
            return expr;
        }
        
        throw this.error(this.peek(), 'Expect expression');
    }

    // Helper methods
    match(...types) {
        for (const type of types) {
            if (this.check(type)) {
                this.advance();
                return true;
            }
        }
        return false;
    }

    check(type) {
        if (this.isAtEnd()) return false;
        return this.peek().type === type;
    }

    advance() {
        if (!this.isAtEnd()) this.current++;
        return this.previous();
    }

    isAtEnd() {
        return this.peek().type === 'EOF';
    }

    peek() {
        return this.tokens[this.current];
    }

    previous() {
        return this.tokens[this.current - 1];
    }

    consume(type, message) {
        if (this.check(type)) return this.advance();
        throw this.error(this.peek(), message);
    }

    error(token, message) {
        return new Error(`Error at position ${token.position}: ${message}`);
    }

    synchronize() {
        this.advance();
        
        while (!this.isAtEnd()) {
            if (this.previous().type === 'SEMICOLON') return;
            
            switch (this.peek().type) {
                case 'RG_KEYWORD':
                case 'PRINT':
                case 'INT_KEYWORD':
                    return;
            }
            
            this.advance();
        }
    }
}