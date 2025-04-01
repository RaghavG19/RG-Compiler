class SemanticAnalyzer {
    constructor() {
        // Initialize symbol table with built-in functions
        this.symbolTable = {
            __output__: [],
            __assembly__: [],

            // Math functions
            sqrt: { type: 'function', returnType: 'float' },
            pow: { type: 'function', returnType: 'float' },
            sin: { type: 'function', returnType: 'float' },
            cos: { type: 'function', returnType: 'float' },
            tan: { type: 'function', returnType: 'float' },
            log: { type: 'function', returnType: 'float' },
            factorial: { type: 'function', returnType: 'int' }
        };

        this.varCount = 0;   // Keeps track of available registers
        this.labelCount = 0; // Keeps track of labels for branching
        this.loopStack = []; // Stack to keep track of current loop for break statements
    }

    analyze(ast) {
        this.visitProgram(ast);
        return {
            symbolTable: this.symbolTable,
            assemblyCode: this.symbolTable.__assembly__
        };
    }

    visitProgram(node) {
        for (const statement of node.body) {
            this.visitStatement(statement);
        }
    }

    visitStatement(node) {
        switch (node.type) {
            case 'VariableDeclaration':
                this.visitVariableDeclaration(node);
                break;
            case 'ArrayDeclaration':
                this.visitArrayDeclaration(node);
                break;
            case 'PrintStatement':
                this.visitPrintStatement(node);
                break;
            case 'ExpressionStatement':
                this.visitExpressionStatement(node);
                break;
            case 'AssignmentExpression':
                this.visitAssignmentExpression(node);
                break;
            case 'ArrayAssignmentExpression':
                this.visitArrayAssignmentExpression(node);
                break;
            case 'IfStatement':
                this.visitIfStatement(node);
                break;
            case 'ForStatement':
                this.visitForStatement(node);
                break;
            case 'WhileStatement':
                this.visitWhileStatement(node);
                break;
            case 'BreakStatement':
                this.visitBreakStatement(node);
                break;
            case 'InsertOperation':
                this.visitInsertOperation(node);
                break;
            case 'DeleteOperation':
                this.visitDeleteOperation(node);
                break;
            default:
                throw new Error(`Unknown statement type: ${node.type}`);
        }
    }
    
    visitExpressionStatement(node) {
        // Special case for RG_Print when it's not properly parsed as a PrintStatement
        if (node.expression.type === 'Identifier' && node.expression.name === 'RG_Print') {
            // This is a print statement without arguments
            this.symbolTable.__assembly__.push(`; Print statement (empty)`);
            this.symbolTable.__assembly__.push(`CALL PRINT`);
            return;
        }

        this.visitExpression(node.expression);
    }

    visitVariableDeclaration(node) {
        const varName = node.name;
        if (this.symbolTable[varName]) {
            throw new Error(`Variable '${varName}' already declared`);
        }

        // Generate assembly for variable declaration
        this.symbolTable.__assembly__.push(`; Declare variable ${varName}`);

        // First add the variable to the symbol table with a default value
        // This allows for self-references and forward references
        this.symbolTable[varName] = {
            type: node.dataType || 'int',
            value: null
        };

        // Now evaluate the initializer
        const value = this.visitExpression(node.initializer);

        // Format the value for assembly code
        let assemblyValue;
        if (typeof value === 'boolean') {
            assemblyValue = value ? '1' : '0';
        } else if (typeof value === 'string') {
            assemblyValue = `"${value}"`;
        } else {
            assemblyValue = value;
        }

        this.symbolTable.__assembly__.push(`MOV R${this.varCount}, ${assemblyValue}`);
        this.symbolTable.__assembly__.push(`STORE [${varName}], R${this.varCount}`);

        // Update the value in the symbol table
        this.symbolTable[varName].value = value;
        this.varCount++;
    }
    
    visitArrayDeclaration(node) {
        const arrayName = node.name;
        if (this.symbolTable[arrayName]) {
            throw new Error(`Variable '${arrayName}' already declared`);
        }
        
        // Evaluate the size expression
        const size = this.visitExpression(node.size);
        if (!Number.isInteger(size) || size <= 0) {
            throw new Error(`Array size must be a positive integer, got ${size}`);
        }
        
        // Generate assembly for array declaration
        this.symbolTable.__assembly__.push(`; Declare array ${arrayName} of size ${size}`);
        this.symbolTable.__assembly__.push(`ALLOC [${arrayName}], ${size}`);
        
        // Initialize array elements if initializer is provided
        let initialValue;
        if (node.initializer.type === 'Literal') {
            // Single value initializer - use for all elements
            initialValue = this.visitExpression(node.initializer);
            this.symbolTable.__assembly__.push(`; Initialize all elements to ${initialValue}`);
            
            for (let i = 0; i < size; i++) {
                this.symbolTable.__assembly__.push(`MOV R${this.varCount}, ${initialValue}`);
                this.symbolTable.__assembly__.push(`STORE [${arrayName}+${i}], R${this.varCount}`);
            }
        } else {
            // Default initialize to 0
            initialValue = 0;
            this.symbolTable.__assembly__.push(`; Initialize all elements to 0`);
            
            for (let i = 0; i < size; i++) {
                this.symbolTable.__assembly__.push(`MOV R${this.varCount}, 0`);
                this.symbolTable.__assembly__.push(`STORE [${arrayName}+${i}], R${this.varCount}`);
            }
        }
        
        // Update symbol table
        this.symbolTable[arrayName] = {
            type: `${node.dataType || 'int'}[]`,
            size: size,
            elements: Array(size).fill(initialValue)
        };
        this.varCount++;
    }
    
    visitArrayAssignmentExpression(node) {
        const arrayName = node.array;
        if (!this.symbolTable[arrayName]) {
            throw new Error(`Undefined array '${arrayName}'`);
        }
        
        if (!this.symbolTable[arrayName].elements) {
            throw new Error(`'${arrayName}' is not an array`);
        }
        
        // Evaluate the index expression
        const index = this.visitExpression(node.index);
        if (!Number.isInteger(index) || index < 0 || index >= this.symbolTable[arrayName].size) {
            throw new Error(`Array index out of bounds: ${index} (size: ${this.symbolTable[arrayName].size})`);
        }
        
        // Generate assembly for array assignment
        this.symbolTable.__assembly__.push(`; Assignment to ${arrayName}[${index}]`);
        const value = this.visitExpression(node.value);
        this.symbolTable.__assembly__.push(`MOV R${this.varCount}, ${value}`);
        this.symbolTable.__assembly__.push(`STORE [${arrayName}+${index}], R${this.varCount}`);
        
        // Update the array in the symbol table
        this.symbolTable[arrayName].elements[index] = value;
        this.varCount++;
        
        return value;
    }

    visitPrintStatement(node) {
        this.symbolTable.__assembly__.push(`; Print statement`);
        const args = node.args.map(arg => {
            const value = this.visitExpression(arg);
            this.symbolTable.__assembly__.push(`PUSH ${value}`);
            return typeof value === 'number' ? value.toString() : value;
        });
        this.symbolTable.__assembly__.push(`CALL PRINT`);
        this.symbolTable.__output__.push(args.join(' '));
    }
    
    visitIfStatement(node) {
        const endLabel = `L_END_IF_${this.labelCount++}`;
        const elseLabel = `L_ELSE_${this.labelCount++}`;

        // Generate assembly for condition evaluation
        this.symbolTable.__assembly__.push(`; If statement condition`);
        const condition = this.visitExpression(node.condition);

        // Convert to boolean and format for assembly
        const boolCondition = Boolean(condition);
        this.symbolTable.__assembly__.push(`; Condition evaluates to ${boolCondition}`);

        // Jump to else branch if condition is false
        this.symbolTable.__assembly__.push(`CMP R${this.varCount-1}, 0`);
        this.symbolTable.__assembly__.push(`JE ${elseLabel}`);

        // Then branch
        this.symbolTable.__assembly__.push(`; Then branch`);
        for (const stmt of node.thenBranch) {
            this.visitStatement(stmt);
        }
        this.symbolTable.__assembly__.push(`JMP ${endLabel}`);

        // Else branch
        this.symbolTable.__assembly__.push(`${elseLabel}:`);
        if (node.elseBranch) {
            this.symbolTable.__assembly__.push(`; Else branch`);
            if (Array.isArray(node.elseBranch)) {
                for (const stmt of node.elseBranch) {
                    this.visitStatement(stmt);
                }
            } else {
                this.visitStatement(node.elseBranch);
            }
        }

        // End of if statement
        this.symbolTable.__assembly__.push(`${endLabel}:`);
    }
    
    visitForStatement(node) {
        const startLabel = `L_FOR_START_${this.labelCount++}`;
        const endLabel = `L_FOR_END_${this.labelCount++}`;
        const incrementLabel = `L_FOR_INC_${this.labelCount++}`;
        
        // Push this loop onto the stack for break statements
        this.loopStack.push(endLabel);
        
        // Initializer
        if (node.initializer) {
            this.symbolTable.__assembly__.push(`; For loop initializer`);
            this.visitStatement(node.initializer);
        }
        
        // Loop start
        this.symbolTable.__assembly__.push(`${startLabel}:`);
        
        // Condition
        if (node.condition) {
            this.symbolTable.__assembly__.push(`; For loop condition`);
            const condition = this.visitExpression(node.condition);

            // Convert to boolean and format for assembly
            const boolCondition = Boolean(condition);
            this.symbolTable.__assembly__.push(`; Condition evaluates to ${boolCondition}`);

            this.symbolTable.__assembly__.push(`CMP R${this.varCount-1}, 0`);
            this.symbolTable.__assembly__.push(`JE ${endLabel}`);
        }
        
        // Body
        this.symbolTable.__assembly__.push(`; For loop body`);
        for (const stmt of node.body) {
            this.visitStatement(stmt);
        }
        
        // Increment
        this.symbolTable.__assembly__.push(`${incrementLabel}:`);
        if (node.increment) {
            this.symbolTable.__assembly__.push(`; For loop increment`);
            this.visitExpression(node.increment);
        }
        
        // Jump back to start
        this.symbolTable.__assembly__.push(`JMP ${startLabel}`);
        
        // End of loop
        this.symbolTable.__assembly__.push(`${endLabel}:`);
        
        // Pop this loop from the stack
        this.loopStack.pop();
    }
    
    visitWhileStatement(node) {
        const startLabel = `L_WHILE_START_${this.labelCount++}`;
        const endLabel = `L_WHILE_END_${this.labelCount++}`;

        // Push this loop onto the stack for break statements
        this.loopStack.push(endLabel);

        // Loop start
        this.symbolTable.__assembly__.push(`${startLabel}:`);

        // Condition
        this.symbolTable.__assembly__.push(`; While loop condition`);
        const condition = this.visitExpression(node.condition);

        // Convert to boolean and format for assembly
        const boolCondition = Boolean(condition);
        this.symbolTable.__assembly__.push(`; Condition evaluates to ${boolCondition}`);

        this.symbolTable.__assembly__.push(`CMP R${this.varCount-1}, 0`);
        this.symbolTable.__assembly__.push(`JE ${endLabel}`);

        // Body
        this.symbolTable.__assembly__.push(`; While loop body`);
        for (const stmt of node.body) {
            this.visitStatement(stmt);
        }

        // Jump back to start
        this.symbolTable.__assembly__.push(`JMP ${startLabel}`);

        // End of loop
        this.symbolTable.__assembly__.push(`${endLabel}:`);

        // Pop this loop from the stack
        this.loopStack.pop();
    }
    
    visitBreakStatement(node) {
        if (this.loopStack.length === 0) {
            throw new Error('Break statement outside of loop');
        }
        
        // Jump to the end of the current loop
        const endLabel = this.loopStack[this.loopStack.length - 1];
        this.symbolTable.__assembly__.push(`; Break statement`);
        this.symbolTable.__assembly__.push(`JMP ${endLabel}`);
    }
    
    visitInsertOperation(node) {
        const arrayName = node.array;
        if (!this.symbolTable[arrayName]) {
            throw new Error(`Undefined array '${arrayName}'`);
        }
        
        if (!this.symbolTable[arrayName].elements) {
            throw new Error(`'${arrayName}' is not an array`);
        }
        
        // Evaluate the value to insert
        const value = this.visitExpression(node.value);
        
        // Generate assembly for insert operation
        this.symbolTable.__assembly__.push(`; Insert operation for ${arrayName}`);
        this.symbolTable.__assembly__.push(`MOV R${this.varCount}, ${value}`);
        this.symbolTable.__assembly__.push(`CALL INSERT, [${arrayName}], R${this.varCount}`);
        
        // Update the array in the symbol table (append to the end)
        this.symbolTable[arrayName].elements.push(value);
        this.symbolTable[arrayName].size++;
        this.varCount++;
    }
    
    visitDeleteOperation(node) {
        const arrayName = node.array;
        if (!this.symbolTable[arrayName]) {
            throw new Error(`Undefined array '${arrayName}'`);
        }
        
        if (!this.symbolTable[arrayName].elements) {
            throw new Error(`'${arrayName}' is not an array`);
        }
        
        // Evaluate the index to delete
        const index = this.visitExpression(node.value);
        if (!Number.isInteger(index) || index < 0 || index >= this.symbolTable[arrayName].size) {
            throw new Error(`Array index out of bounds: ${index} (size: ${this.symbolTable[arrayName].size})`);
        }
        
        // Generate assembly for delete operation
        this.symbolTable.__assembly__.push(`; Delete operation for ${arrayName}[${index}]`);
        this.symbolTable.__assembly__.push(`CALL DELETE, [${arrayName}], ${index}`);
        
        // Update the array in the symbol table
        this.symbolTable[arrayName].elements.splice(index, 1);
        this.symbolTable[arrayName].size--;
    }

    visitExpression(node) {
        switch (node.type) {
            case 'Literal':
                return this.visitLiteral(node);
            case 'Identifier':
                return this.visitIdentifier(node);
            case 'ArrayAccess':
                return this.visitArrayAccess(node);
            case 'BinaryExpression':
                return this.visitBinaryExpression(node);
            case 'LogicalExpression':
                return this.visitLogicalExpression(node);
            case 'UnaryExpression':
                return this.visitUnaryExpression(node);
            case 'AssignmentExpression':
                return this.visitAssignmentExpression(node);
            case 'MathFunction':
                return this.visitMathFunction(node);
            case 'FunctionCall':
                return this.visitFunctionCall(node);
            default:
                throw new Error(`Unknown expression type: ${node.type}`);
        }
    }
    
    visitArrayAccess(node) {
        const arrayName = node.array;
        if (!this.symbolTable[arrayName]) {
            throw new Error(`Undefined array '${arrayName}'`);
        }
        
        if (!this.symbolTable[arrayName].elements) {
            throw new Error(`'${arrayName}' is not an array`);
        }
        
        // Evaluate the index expression
        const index = this.visitExpression(node.index);
        if (!Number.isInteger(index) || index < 0 || index >= this.symbolTable[arrayName].size) {
            throw new Error(`Array index out of bounds: ${index} (size: ${this.symbolTable[arrayName].size})`);
        }
        
        // Generate assembly for array access
        this.symbolTable.__assembly__.push(`; Access ${arrayName}[${index}]`);
        this.symbolTable.__assembly__.push(`LOAD R${this.varCount}, [${arrayName}+${index}]`);
        
        const value = this.symbolTable[arrayName].elements[index];
        this.varCount++;
        return value;
    }
    
    visitLogicalExpression(node) {
        this.symbolTable.__assembly__.push(`; Logical operation ${node.operator}`);

        // Short-circuit evaluation
        if (node.operator === '&&') {
            const leftValue = this.visitExpression(node.left);

            // Format for assembly
            const leftBool = Boolean(leftValue);
            this.symbolTable.__assembly__.push(`MOV R${this.varCount}, ${leftBool ? '1' : '0'}`);
            this.varCount++;

            // If left is false, don't evaluate right
            if (!leftBool) {
                return false;
            }

            // Otherwise, return right value
            const rightValue = this.visitExpression(node.right);
            const rightBool = Boolean(rightValue);
            this.symbolTable.__assembly__.push(`MOV R${this.varCount}, ${rightBool ? '1' : '0'}`);
            this.varCount++;

            return rightBool;
        } else if (node.operator === '||') {
            const leftValue = this.visitExpression(node.left);

            // Format for assembly
            const leftBool = Boolean(leftValue);
            this.symbolTable.__assembly__.push(`MOV R${this.varCount}, ${leftBool ? '1' : '0'}`);
            this.varCount++;

            // If left is true, don't evaluate right
            if (leftBool) {
                return true;
            }

            // Otherwise, return right value
            const rightValue = this.visitExpression(node.right);
            const rightBool = Boolean(rightValue);
            this.symbolTable.__assembly__.push(`MOV R${this.varCount}, ${rightBool ? '1' : '0'}`);
            this.varCount++;

            return rightBool;
        }

        throw new Error(`Unknown logical operator: ${node.operator}`);
    }
    
    visitMathFunction(node) {
        this.symbolTable.__assembly__.push(`; Math function ${node.function}`);

        switch (node.function) {
            case 'sqrt': {
                const arg = this.visitExpression(node.argument);
                if (typeof arg !== 'number') {
                    throw new Error(`Cannot apply sqrt to non-numeric value: ${arg}`);
                }
                if (arg < 0) {
                    throw new Error(`Cannot calculate square root of negative number: ${arg}`);
                }
                this.symbolTable.__assembly__.push(`SQRT R${this.varCount}, R${this.varCount-1}`);
                this.varCount++;
                return Math.sqrt(arg);
            }

            case 'pow': {
                const base = this.visitExpression(node.base);
                const exponent = this.visitExpression(node.exponent);
                if (typeof base !== 'number' || typeof exponent !== 'number') {
                    throw new Error(`Cannot apply pow to non-numeric values: base=${base}, exponent=${exponent}`);
                }
                this.symbolTable.__assembly__.push(`POW R${this.varCount}, R${this.varCount-2}, R${this.varCount-1}`);
                this.varCount++;
                return Math.pow(base, exponent);
            }

            case 'sin': {
                const arg = this.visitExpression(node.argument);
                if (typeof arg !== 'number') {
                    throw new Error(`Cannot apply sin to non-numeric value: ${arg}`);
                }
                this.symbolTable.__assembly__.push(`SIN R${this.varCount}, R${this.varCount-1}`);
                this.varCount++;
                return Math.sin(arg);
            }

            case 'cos': {
                const arg = this.visitExpression(node.argument);
                if (typeof arg !== 'number') {
                    throw new Error(`Cannot apply cos to non-numeric value: ${arg}`);
                }
                this.symbolTable.__assembly__.push(`COS R${this.varCount}, R${this.varCount-1}`);
                this.varCount++;
                return Math.cos(arg);
            }

            case 'tan': {
                const arg = this.visitExpression(node.argument);
                if (typeof arg !== 'number') {
                    throw new Error(`Cannot apply tan to non-numeric value: ${arg}`);
                }
                this.symbolTable.__assembly__.push(`TAN R${this.varCount}, R${this.varCount-1}`);
                this.varCount++;
                return Math.tan(arg);
            }

            case 'log': {
                const arg = this.visitExpression(node.argument);
                if (typeof arg !== 'number') {
                    throw new Error(`Cannot apply log to non-numeric value: ${arg}`);
                }
                if (arg <= 0) {
                    throw new Error(`Cannot calculate logarithm of non-positive number: ${arg}`);
                }
                this.symbolTable.__assembly__.push(`LOG R${this.varCount}, R${this.varCount-1}`);
                this.varCount++;
                return Math.log(arg);
            }

            case 'factorial': {
                const arg = this.visitExpression(node.argument);
                if (typeof arg !== 'number') {
                    throw new Error(`Cannot apply factorial to non-numeric value: ${arg}`);
                }
                if (!Number.isInteger(arg) || arg < 0) {
                    throw new Error(`Factorial requires a non-negative integer: ${arg}`);
                }

                this.symbolTable.__assembly__.push(`; Calculate factorial`);
                this.symbolTable.__assembly__.push(`MOV R${this.varCount}, 1`);

                if (arg === 0 || arg === 1) {
                    this.varCount++;
                    return 1;
                }

                let result = 1;
                for (let i = 2; i <= arg; i++) {
                    result *= i;
                    this.symbolTable.__assembly__.push(`MUL R${this.varCount}, R${this.varCount}, ${i}`);
                }

                this.varCount++;
                return result;
            }

            default:
                throw new Error(`Unknown math function: ${node.function}`);
        }
    }

    visitLiteral(node) {
        // Add assembly instruction for all literal types
        if (typeof node.value === 'boolean') {
            this.symbolTable.__assembly__.push(`MOV R${this.varCount}, ${node.value ? '1' : '0'}`);
            this.varCount++;
        } else if (typeof node.value === 'number') {
            this.symbolTable.__assembly__.push(`MOV R${this.varCount}, ${node.value}`);
            this.varCount++;
        } else if (typeof node.value === 'string') {
            this.symbolTable.__assembly__.push(`MOV R${this.varCount}, "${node.value}"`);
            this.varCount++;
        }

        return node.value;
    }

    visitFunctionCall(node) {
        const funcName = node.name;

        // Check if the function exists
        if (!this.symbolTable[funcName]) {
            throw new Error(`Undefined function '${funcName}'`);
        }

        if (this.symbolTable[funcName].type !== 'function') {
            throw new Error(`'${funcName}' is not a function`);
        }

        // Evaluate arguments
        const args = node.args.map(arg => this.visitExpression(arg));

        // Handle built-in math functions
        switch (funcName) {
            case 'sqrt': {
                if (args.length !== 1) {
                    throw new Error(`sqrt() requires exactly 1 argument, got ${args.length}`);
                }
                if (args[0] < 0) {
                    throw new Error(`Cannot take square root of negative number: ${args[0]}`);
                }

                this.symbolTable.__assembly__.push(`; Calculate square root`);
                this.symbolTable.__assembly__.push(`SQRT R${this.varCount}, ${args[0]}`);
                this.varCount++;

                return Math.sqrt(args[0]);
            }

            case 'pow': {
                if (args.length !== 2) {
                    throw new Error(`pow() requires exactly 2 arguments, got ${args.length}`);
                }

                this.symbolTable.__assembly__.push(`; Calculate power`);
                this.symbolTable.__assembly__.push(`POW R${this.varCount}, ${args[0]}, ${args[1]}`);
                this.varCount++;

                return Math.pow(args[0], args[1]);
            }

            case 'sin': {
                if (args.length !== 1) {
                    throw new Error(`sin() requires exactly 1 argument, got ${args.length}`);
                }

                this.symbolTable.__assembly__.push(`; Calculate sine`);
                this.symbolTable.__assembly__.push(`SIN R${this.varCount}, ${args[0]}`);
                this.varCount++;

                return Math.sin(args[0]);
            }

            case 'cos': {
                if (args.length !== 1) {
                    throw new Error(`cos() requires exactly 1 argument, got ${args.length}`);
                }

                this.symbolTable.__assembly__.push(`; Calculate cosine`);
                this.symbolTable.__assembly__.push(`COS R${this.varCount}, ${args[0]}`);
                this.varCount++;

                return Math.cos(args[0]);
            }

            case 'tan': {
                if (args.length !== 1) {
                    throw new Error(`tan() requires exactly 1 argument, got ${args.length}`);
                }

                this.symbolTable.__assembly__.push(`; Calculate tangent`);
                this.symbolTable.__assembly__.push(`TAN R${this.varCount}, ${args[0]}`);
                this.varCount++;

                return Math.tan(args[0]);
            }

            case 'log': {
                if (args.length !== 1) {
                    throw new Error(`log() requires exactly 1 argument, got ${args.length}`);
                }
                if (args[0] <= 0) {
                    throw new Error(`Cannot take logarithm of non-positive number: ${args[0]}`);
                }

                this.symbolTable.__assembly__.push(`; Calculate logarithm`);
                this.symbolTable.__assembly__.push(`LOG R${this.varCount}, ${args[0]}`);
                this.varCount++;

                return Math.log(args[0]);
            }

            case 'factorial': {
                if (args.length !== 1) {
                    throw new Error(`factorial() requires exactly 1 argument, got ${args.length}`);
                }
                if (!Number.isInteger(args[0]) || args[0] < 0) {
                    throw new Error(`Factorial requires a non-negative integer: ${args[0]}`);
                }

                this.symbolTable.__assembly__.push(`; Calculate factorial`);
                this.symbolTable.__assembly__.push(`MOV R${this.varCount}, 1`);

                if (args[0] === 0 || args[0] === 1) {
                    this.varCount++;
                    return 1;
                }

                let result = 1;
                for (let i = 2; i <= args[0]; i++) {
                    result *= i;
                    this.symbolTable.__assembly__.push(`MUL R${this.varCount}, R${this.varCount}, ${i}`);
                }

                this.varCount++;
                return result;
            }

            default:
                throw new Error(`Unknown function: ${funcName}`);
        }
    }

    visitIdentifier(node) {
        // Handle built-in functions
        if (node.name === 'RG_Print') {
            // RG_Print is a built-in function, not a variable
            return 'RG_Print';
        }

        // Check if the identifier exists in the symbol table
        if (!this.symbolTable[node.name]) {
            throw new Error(`Undefined variable '${node.name}'`);
        }

        // Handle function identifiers
        if (this.symbolTable[node.name].type === 'function') {
            // Return the function name for later use
            return node.name;
        }

        // Handle regular variables
        // Debug output
        this.symbolTable.__assembly__.push(`; Loading variable ${node.name} with value ${this.symbolTable[node.name].value}`);
        this.symbolTable.__assembly__.push(`LOAD R${this.varCount}, [${node.name}]`);

        const value = this.symbolTable[node.name].value;
        this.varCount++;

        return value;
    }

    visitArrayAccess(node) {
        const arrayName = node.array;
        if (!this.symbolTable[arrayName]) {
            throw new Error(`Undefined array '${arrayName}'`);
        }

        if (!this.symbolTable[arrayName].elements) {
            throw new Error(`'${arrayName}' is not an array`);
        }

        // Evaluate the index expression
        const index = this.visitExpression(node.index);
        if (!Number.isInteger(index)) {
            throw new Error(`Array index must be an integer, got ${index} (${typeof index})`);
        }

        if (index < 0 || index >= this.symbolTable[arrayName].size) {
            throw new Error(`Array index out of bounds: ${index} (size: ${this.symbolTable[arrayName].size})`);
        }

        // Generate assembly for array access
        this.symbolTable.__assembly__.push(`; Access ${arrayName}[${index}]`);
        this.symbolTable.__assembly__.push(`LOAD R${this.varCount}, [${arrayName}+${index}]`);

        const value = this.symbolTable[arrayName].elements[index];
        this.varCount++;

        return value;
    }

    visitBinaryExpression(node) {
        this.symbolTable.__assembly__.push(`; Binary operation ${node.operator}`);

        // First evaluate the left operand
        const left = this.visitExpression(node.left);

        // Handle string concatenation for + operator
        if (node.operator === '+' && (typeof left === 'string' ||
            (node.right.type === 'Literal' && typeof node.right.value === 'string'))) {
            const right = this.visitExpression(node.right);
            this.symbolTable.__assembly__.push(`CONCAT R${this.varCount}, R${this.varCount-2}, R${this.varCount-1}`);
            this.varCount++;
            return String(left) + String(right);
        }

        // For other operators, proceed with normal evaluation
        const right = this.visitExpression(node.right);

        // Debug output
        this.symbolTable.__assembly__.push(`; Left operand: ${left}, Right operand: ${right}`);

        // Arithmetic operators require numeric operands
        if ((node.operator === '+' || node.operator === '-' ||
             node.operator === '*' || node.operator === '/' ||
             node.operator === '%') &&
            (typeof left !== 'number' || typeof right !== 'number')) {
            throw new Error(`Cannot perform arithmetic operation '${node.operator}' on non-numeric values: ${left} (${typeof left}) ${node.operator} ${right} (${typeof right})`);
        }

        // Division by zero check
        if (node.operator === '/' && right === 0) {
            throw new Error('Division by zero');
        }

        // Modulo by zero check
        if (node.operator === '%' && right === 0) {
            throw new Error('Modulo by zero');
        }

        // Generate assembly for the operation
        switch (node.operator) {
            case '+':
                this.symbolTable.__assembly__.push(`ADD R${this.varCount}, R${this.varCount-2}, R${this.varCount-1}`);
                this.varCount++;
                return left + right;

            case '-':
                this.symbolTable.__assembly__.push(`SUB R${this.varCount}, R${this.varCount-2}, R${this.varCount-1}`);
                this.varCount++;
                return left - right;

            case '*':
                this.symbolTable.__assembly__.push(`MUL R${this.varCount}, R${this.varCount-2}, R${this.varCount-1}`);
                this.varCount++;
                return left * right;

            case '/':
                this.symbolTable.__assembly__.push(`DIV R${this.varCount}, R${this.varCount-2}, R${this.varCount-1}`);
                this.varCount++;
                return left / right;

            case '%':
                this.symbolTable.__assembly__.push(`MOD R${this.varCount}, R${this.varCount-2}, R${this.varCount-1}`);
                this.varCount++;
                return left % right;

            case '<':
                this.symbolTable.__assembly__.push(`LT R${this.varCount}, R${this.varCount-2}, R${this.varCount-1}`);
                this.varCount++;
                return left < right;

            case '>':
                this.symbolTable.__assembly__.push(`GT R${this.varCount}, R${this.varCount-2}, R${this.varCount-1}`);
                this.varCount++;
                return left > right;

            case '<=':
                this.symbolTable.__assembly__.push(`LE R${this.varCount}, R${this.varCount-2}, R${this.varCount-1}`);
                this.varCount++;
                return left <= right;

            case '>=':
                this.symbolTable.__assembly__.push(`GE R${this.varCount}, R${this.varCount-2}, R${this.varCount-1}`);
                this.varCount++;
                return left >= right;

            case '==':
                this.symbolTable.__assembly__.push(`EQ R${this.varCount}, R${this.varCount-2}, R${this.varCount-1}`);
                this.varCount++;
                return left === right;

            case '!=':
                this.symbolTable.__assembly__.push(`NE R${this.varCount}, R${this.varCount-2}, R${this.varCount-1}`);
                this.varCount++;
                return left !== right;

            default:
                throw new Error(`Unknown binary operator: ${node.operator}`);
        }

        let result;
        switch (node.operator) {
            // Arithmetic operators
            case '+':
                this.symbolTable.__assembly__.push(`ADD R${this.varCount}, R${this.varCount-2}, R${this.varCount-1}`);
                result = left + right;
                break;
            case '-':
                this.symbolTable.__assembly__.push(`SUB R${this.varCount}, R${this.varCount-2}, R${this.varCount-1}`);
                result = left - right;
                break;
            case '*':
                this.symbolTable.__assembly__.push(`MUL R${this.varCount}, R${this.varCount-2}, R${this.varCount-1}`);
                result = left * right;
                break;
            case '/':
                if (right === 0) throw new Error('Division by zero');
                this.symbolTable.__assembly__.push(`DIV R${this.varCount}, R${this.varCount-2}, R${this.varCount-1}`);
                result = left / right;
                break;
            case '%':
                this.symbolTable.__assembly__.push(`MOD R${this.varCount}, R${this.varCount-2}, R${this.varCount-1}`);
                result = left % right;
                break;
                
            // Comparison operators
            case '<':
                this.symbolTable.__assembly__.push(`CMP R${this.varCount-2}, R${this.varCount-1}`);
                this.symbolTable.__assembly__.push(`SETL R${this.varCount}`);
                result = left < right;
                break;
            case '>':
                this.symbolTable.__assembly__.push(`CMP R${this.varCount-2}, R${this.varCount-1}`);
                this.symbolTable.__assembly__.push(`SETG R${this.varCount}`);
                result = left > right;
                break;
            case '<=':
                this.symbolTable.__assembly__.push(`CMP R${this.varCount-2}, R${this.varCount-1}`);
                this.symbolTable.__assembly__.push(`SETLE R${this.varCount}`);
                result = left <= right;
                break;
            case '>=':
                this.symbolTable.__assembly__.push(`CMP R${this.varCount-2}, R${this.varCount-1}`);
                this.symbolTable.__assembly__.push(`SETGE R${this.varCount}`);
                result = left >= right;
                break;
            case '==':
                this.symbolTable.__assembly__.push(`CMP R${this.varCount-2}, R${this.varCount-1}`);
                this.symbolTable.__assembly__.push(`SETE R${this.varCount}`);
                result = left === right;
                break;
            case '!=':
                this.symbolTable.__assembly__.push(`CMP R${this.varCount-2}, R${this.varCount-1}`);
                this.symbolTable.__assembly__.push(`SETNE R${this.varCount}`);
                result = left !== right;
                break;
                
            default:
                throw new Error(`Unknown operator: ${node.operator}`);
        }
        
        this.varCount++;
        return result;
    }

    visitUnaryExpression(node) {
        this.symbolTable.__assembly__.push(`; Unary operation ${node.operator}`);
        const right = this.visitExpression(node.right);

        switch (node.operator) {
            case '-':
                if (typeof right !== 'number') {
                    throw new Error(`Cannot apply unary minus to non-numeric value`);
                }
                this.symbolTable.__assembly__.push(`NEG R${this.varCount}, R${this.varCount-1}`);
                this.varCount++;
                return -right;

            case '!':
                // Convert to boolean first
                const boolValue = Boolean(right);
                this.symbolTable.__assembly__.push(`NOT R${this.varCount}, R${this.varCount-1}`);
                this.varCount++;
                return !boolValue;

            default:
                throw new Error(`Unknown unary operator: ${node.operator}`);
        }
    }

    visitAssignmentExpression(node) {
        if (!this.symbolTable[node.name]) {
            throw new Error(`Undefined variable '${node.name}'`);
        }
        
        this.symbolTable.__assembly__.push(`; Assignment to ${node.name}`);
        const value = this.visitExpression(node.value);
        this.symbolTable.__assembly__.push(`STORE [${node.name}], R${this.varCount-1}`);
        
        this.symbolTable[node.name].value = value;
        return value;
    }
}