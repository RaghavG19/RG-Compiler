class Parser {
    constructor(tokens) {
        this.tokens = tokens;
        this.current = 0;
    }

    parse() {
        try {
            const result = this.program();

            // Check if we've consumed all tokens
            if (!this.isAtEnd() && this.peek().type !== 'EOF') {
                throw this.error(this.peek(), "Unexpected token at end of input");
            }

            return result;
        } catch (error) {
            console.error("Parser error:", error);
            throw error; // Re-throw to let the compiler handle it
        }
    }

    program() {
        const statements = [];

        while (!this.isAtEnd()) {
            const stmt = this.declaration();
            if (stmt) statements.push(stmt);
        }

        return {
            type: 'Program',
            body: statements
        };
    }

    declaration() {
        try {
            // Variable declaration
            if (this.check('RG_KEYWORD')) {
                this.advance(); // Consume RG

                let dataType;
                if (this.match('INT_KEYWORD')) {
                    dataType = 'int';
                } else if (this.match('FLOAT_KEYWORD')) {
                    dataType = 'float';
                } else if (this.match('BOOL_KEYWORD')) {
                    dataType = 'bool';
                } else {
                    // More helpful error message
                    const token = this.peek();
                    throw this.error(token, `Expected type keyword (int, float, bool) but got '${token.value}' of type '${token.type}'`);
                }

                const name = this.consume('IDENTIFIER', 'Expect variable name');

                // Check if it's an array declaration
                let isArray = false;
                let size = null;
                if (this.match('LBRACKET')) {
                    isArray = true;
                    const sizeExpr = this.expression();
                    this.consume('RBRACKET', 'Expect ] after array size');
                    size = sizeExpr;
                }

                this.consume('ASSIGN', 'Expect = after variable name');
                const initializer = this.expression();

                try {
                    this.consume('SEMICOLON', 'Expect ; after variable declaration');
                } catch (error) {
                    // If we're at the end of a line or file, we can recover
                    console.warn("Missing semicolon after variable declaration, attempting to recover");
                }

                if (isArray) {
                    return {
                        type: 'ArrayDeclaration',
                        name: name.value,
                        dataType: dataType,
                        size: size,
                        initializer
                    };
                } else {
                    return {
                        type: 'VariableDeclaration',
                        name: name.value,
                        dataType: dataType,
                        initializer
                    };
                }
            }

            // If not a variable declaration, try other statement types
            return this.statement();
        } catch (error) {
            console.error(error.message);
            this.synchronize();
            return null;
        }
    }

    statement() {
        // Control flow statements
        if (this.match('IF')) {
            return this.ifStatement();
        }

        if (this.match('FOR')) {
            return this.forStatement();
        }

        if (this.match('WHILE')) {
            return this.whileStatement();
        }

        if (this.match('BREAK')) {
            this.consume('SEMICOLON', 'Expect ; after break statement');
            return {
                type: 'BreakStatement'
            };
        }

        // Print statement
        if (this.match('PRINT')) {
            return this.printStatement();
        }

        // Array operations
        if (this.match('INSERT')) {
            return this.arrayOperation('InsertOperation');
        }

        if (this.match('DELETE')) {
            return this.arrayOperation('DeleteOperation');
        }

        // Expression statement (assignment, etc.)
        return this.expressionStatement();
    }

    printStatement() {
        // PRINT token already consumed by match() in statement()
        this.consume('LPAREN', 'Expect ( after RG_Print');

        const args = [];
        if (!this.check('RPAREN')) {
            do {
                args.push(this.expression());
            } while (this.match('COMMA'));
        }

        this.consume('RPAREN', 'Expect ) after arguments');

        try {
            this.consume('SEMICOLON', 'Expect ; after print statement');
        } catch (error) {
            // If we're at the end of a line or file, we can recover
            console.warn("Missing semicolon after print statement, attempting to recover");
        }

        return {
            type: 'PrintStatement',
            args
        };
    }

    arrayOperation(operationType) {
        this.consume('LPAREN', `Expect ( after ${operationType === 'InsertOperation' ? 'insert' : 'delete'}`);
        const array = this.consume('IDENTIFIER', 'Expect array name').value;
        this.consume('COMMA', 'Expect , between array name and value');
        const value = this.expression();
        this.consume('RPAREN', `Expect ) after ${operationType === 'InsertOperation' ? 'insert' : 'delete'} arguments`);
        this.consume('SEMICOLON', `Expect ; after ${operationType === 'InsertOperation' ? 'insert' : 'delete'} statement`);

        return {
            type: operationType,
            array,
            value
        };
    }

    ifStatement() {
        this.consume('LPAREN', 'Expect ( after if');
        const condition = this.expression();
        this.consume('RPAREN', 'Expect ) after if condition');

        this.consume('LBRACE', 'Expect { before if body');
        const thenBranch = this.block();
        this.consume('RBRACE', 'Expect } after if body');

        let elseBranch = null;
        if (this.match('ELSE')) {
            if (this.match('IF')) {
                // This is an else-if
                elseBranch = [this.ifStatement()];
            } else {
                this.consume('LBRACE', 'Expect { before else body');
                elseBranch = this.block();
                this.consume('RBRACE', 'Expect } after else body');
            }
        }

        return {
            type: 'IfStatement',
            condition,
            thenBranch,
            elseBranch
        };
    }

    forStatement() {
        this.consume('LPAREN', 'Expect ( after for');

        // Initializer
        let initializer;
        if (this.check('RG_KEYWORD')) {
            initializer = this.declaration();
        } else if (!this.check('SEMICOLON')) {
            initializer = this.expressionStatement();
        } else {
            this.consume('SEMICOLON', 'Expect ; after for initializer');
            initializer = null;
        }

        // Condition
        let condition = null;
        if (!this.check('SEMICOLON')) {
            condition = this.expression();
        }
        this.consume('SEMICOLON', 'Expect ; after for condition');

        // Increment
        let increment = null;
        if (!this.check('RPAREN')) {
            increment = this.expression();
        }
        this.consume('RPAREN', 'Expect ) after for clauses');

        // Body
        this.consume('LBRACE', 'Expect { before for body');
        const body = this.block();
        this.consume('RBRACE', 'Expect } after for body');

        return {
            type: 'ForStatement',
            initializer,
            condition,
            increment,
            body
        };
    }

    whileStatement() {
        this.consume('LPAREN', 'Expect ( after while');
        const condition = this.expression();
        this.consume('RPAREN', 'Expect ) after while condition');

        this.consume('LBRACE', 'Expect { before while body');
        const body = this.block();
        this.consume('RBRACE', 'Expect } after while body');

        return {
            type: 'WhileStatement',
            condition,
            body
        };
    }

    block() {
        const statements = [];

        while (!this.check('RBRACE') && !this.isAtEnd()) {
            const stmt = this.declaration();
            if (stmt) statements.push(stmt);
        }

        return statements;
    }

    expressionStatement() {
        const expr = this.expression();

        // Special case for RG_Print - it should be a print statement
        if (expr.type === 'Identifier' && expr.name === 'RG_Print' && this.check('LPAREN')) {
            // This is a print statement
            this.consume('LPAREN', 'Expect ( after RG_Print');

            const args = [];
            if (!this.check('RPAREN')) {
                do {
                    args.push(this.expression());
                } while (this.match('COMMA'));
            }

            this.consume('RPAREN', 'Expect ) after arguments');

            try {
                this.consume('SEMICOLON', 'Expect ; after print statement');
            } catch (error) {
                // If we're at the end of a line or file, we can recover
                console.warn("Missing semicolon after print statement, attempting to recover");
            }

            return {
                type: 'PrintStatement',
                args
            };
        }

        // Regular expression statement
        try {
            this.consume('SEMICOLON', 'Expect ; after expression');
        } catch (error) {
            // If we're at the end of a line or file, we can recover
            console.warn("Missing semicolon, attempting to recover");
        }

        return {
            type: 'ExpressionStatement',
            expression: expr
        };
    }

    expression() {
        return this.assignment();
    }

    assignment() {
        const expr = this.logicalOr();

        if (this.match('ASSIGN')) {
            const value = this.assignment();

            if (expr.type === 'Identifier') {
                return {
                    type: 'AssignmentExpression',
                    name: expr.name,
                    value
                };
            } else if (expr.type === 'ArrayAccess') {
                return {
                    type: 'ArrayAssignmentExpression',
                    array: expr.array,
                    index: expr.index,
                    value
                };
            }

            this.error(this.previous(), 'Invalid assignment target');
        }

        return expr;
    }

    logicalOr() {
        let expr = this.logicalAnd();

        while (this.match('OR')) {
            const operator = this.previous();
            const right = this.logicalAnd();
            expr = {
                type: 'LogicalExpression',
                operator: operator.value,
                left: expr,
                right
            };
        }

        return expr;
    }

    logicalAnd() {
        let expr = this.equality();

        while (this.match('AND')) {
            const operator = this.previous();
            const right = this.equality();
            expr = {
                type: 'LogicalExpression',
                operator: operator.value,
                left: expr,
                right
            };
        }

        return expr;
    }

    equality() {
        let expr = this.comparison();

        while (this.match('EQUAL_EQUAL', 'NOT_EQUAL')) {
            const operator = this.previous();
            const right = this.comparison();
            expr = {
                type: 'BinaryExpression',
                operator: operator.value,
                left: expr,
                right
            };
        }

        return expr;
    }

    comparison() {
        let expr = this.term();

        while (this.match('LESS_THAN', 'GREATER_THAN', 'LESS_EQUAL', 'GREATER_EQUAL')) {
            const operator = this.previous();
            const right = this.term();
            expr = {
                type: 'BinaryExpression',
                operator: operator.value,
                left: expr,
                right
            };
        }

        return expr;
    }

    term() {
        let expr = this.factor();

        while (this.match('PLUS', 'MINUS')) {
            const operator = this.previous();
            const right = this.factor();
            expr = {
                type: 'BinaryExpression',
                operator: operator.value,
                left: expr,
                right
            };
        }

        return expr;
    }

    factor() {
        let expr = this.unary();

        while (this.match('MULTIPLY', 'DIVIDE', 'MODULO')) {
            const operator = this.previous();
            const right = this.unary();
            expr = {
                type: 'BinaryExpression',
                operator: operator.value,
                left: expr,
                right
            };
        }

        return expr;
    }

    unary() {
        if (this.match('MINUS', 'NOT')) {
            const operator = this.previous();
            const right = this.unary();
            return {
                type: 'UnaryExpression',
                operator: operator.value,
                right
            };
        }

        return this.mathFunctions();
    }

    mathFunctions() {
        if (this.match('SQRT', 'SIN', 'COS', 'TAN', 'LOG', 'FACTORIAL')) {
            const func = this.previous();
            this.consume('LPAREN', `Expect ( after ${func.value}`);
            const arg = this.expression();
            this.consume('RPAREN', `Expect ) after ${func.value} argument`);

            return {
                type: 'MathFunction',
                function: func.value,
                argument: arg
            };
        } else if (this.match('POW')) {
            this.consume('LPAREN', 'Expect ( after pow');
            const base = this.expression();
            this.consume('COMMA', 'Expect , between pow arguments');
            const exponent = this.expression();
            this.consume('RPAREN', 'Expect ) after pow arguments');

            return {
                type: 'MathFunction',
                function: 'pow',
                base: base,
                exponent: exponent
            };
        }

        return this.primary();
    }

    finishFunctionCall(name) {
        // Parse function call arguments
        this.consume('LPAREN', `Expect ( after ${name}`);

        const args = [];
        if (!this.check('RPAREN')) {
            do {
                args.push(this.expression());
            } while (this.match('COMMA'));
        }

        this.consume('RPAREN', `Expect ) after ${name} arguments`);

        // Create function call node
        return {
            type: 'FunctionCall',
            name: name,
            args: args
        };
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

        if (this.match('TRUE')) {
            return {
                type: 'Literal',
                value: true
            };
        }

        if (this.match('FALSE')) {
            return {
                type: 'Literal',
                value: false
            };
        }

        if (this.match('IDENTIFIER')) {
            const name = this.previous().value;

            // Prevent control flow keywords from being treated as function calls
            if (this.check('LPAREN') && name !== 'if' && name !== 'for' && name !== 'while') {
                return this.finishFunctionCall(name);
            }

            // Check if it's an array access
            if (this.match('LBRACKET')) {
                const index = this.expression();
                this.consume('RBRACKET', 'Expect ] after array index');

                return {
                    type: 'ArrayAccess',
                    array: name,
                    index: index
                };
            }

            return {
                type: 'Identifier',
                name: name
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

        // Get more context for the error
        const token = this.peek();
        const errorMsg = `${message} at position ${token.position}`;

        // If we're at the end of the file, provide a clearer message
        if (token.type === 'EOF') {
            throw this.error(token, `${message} (unexpected end of file)`);
        }

        throw this.error(token, errorMsg);
    }

    error(token, message) {
        const error = new Error(`Error at position ${token.position}: ${message}`);
        error.token = token;
        return error;
    }

    synchronize() {
        this.advance();

        // Try to recover at a statement boundary
        while (!this.isAtEnd()) {
            // If we just saw a semicolon, we're at a statement boundary
            if (this.previous().type === 'SEMICOLON') return;

            // If we're at the end of a block, we're at a statement boundary
            if (this.previous().type === 'RBRACE') return;

            // If we're at the start of a new statement, we're at a statement boundary
            switch (this.peek().type) {
                case 'RG_KEYWORD':
                case 'IF':
                case 'ELSE':
                case 'FOR':
                case 'WHILE':
                case 'BREAK':
                case 'PRINT':
                case 'RETURN':
                case 'LBRACE':
                    return;
            }

            this.advance();
        }
    }
}