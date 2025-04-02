class SemanticAnalyzer {
    constructor() {
        // Initialize symbol table with built-in math functions
        this.symbolTable = {
            __output__: [],
            __assembly__: [],
            // Built-in math functions
            sqrt: { type: 'function', value: Math.sqrt },
            pow: { type: 'function', value: Math.pow },
            sin: { type: 'function', value: Math.sin },
            cos: { type: 'function', value: Math.cos },
            tan: { type: 'function', value: Math.tan },
            log: { type: 'function', value: Math.log },
            factorial: {
                type: 'function',
                value: (n) => {
                    if (!Number.isInteger(n) || n < 0) {
                        throw new Error(`Factorial requires a non-negative integer, got ${n}`);
                    }
                    let result = 1;
                    for (let i = 2; i <= n; i++) {
                        result *= i;
                    }
                    return result;
                }
            }
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

            // Format the value for assembly and output
            let formattedValue;
            if (typeof value === 'boolean') {
                formattedValue = value ? 'true' : 'false';
            } else if (typeof value === 'string') {
                // Remove quotes for display in output
                formattedValue = value.replace(/^"|"$/g, '');
            } else {
                formattedValue = value;
            }

            this.symbolTable.__assembly__.push(`PUSH ${value}`);
            return formattedValue;
        });

        this.symbolTable.__assembly__.push(`CALL PRINT`);

        // Add to output with proper formatting
        const outputLine = args.join(' ');
        this.symbolTable.__output__.push(outputLine);
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

        // Then branch - only execute if condition is true
        this.symbolTable.__assembly__.push(`; Then branch`);
        if (boolCondition) {
            for (const stmt of node.thenBranch) {
                this.visitStatement(stmt);
            }
        }
        this.symbolTable.__assembly__.push(`JMP ${endLabel}`);

        // Else branch - only execute if condition is false
        this.symbolTable.__assembly__.push(`${elseLabel}:`);
        if (node.elseBranch && !boolCondition) {
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
            case 'ArrayAssignmentExpression':
                return this.visitArrayAssignmentExpression(node);
            case 'MathFunction':
                return this.visitMathFunction(node);
            default:
                throw new Error(`Unknown expression type: ${node.type}`);
        }
    }
    
    visitLiteral(node) {
        // Generate assembly for literal value
        const value = node.value;

        // Format the value for assembly
        let assemblyValue;
        if (typeof value === 'boolean') {
            assemblyValue = value ? '1' : '0';
        } else if (typeof value === 'string') {
            assemblyValue = `"${value}"`;
        } else {
            assemblyValue = value;
        }

        this.symbolTable.__assembly__.push(`; Literal value: ${assemblyValue}`);
        this.symbolTable.__assembly__.push(`MOV R${this.varCount}, ${assemblyValue}`);
        this.varCount++;

        return value;
    }

    visitIdentifier(node) {
        const name = node.name;
        if (!this.symbolTable[name]) {
            throw new Error(`Undefined variable '${name}'`);
        }

        // Generate assembly for variable access
        this.symbolTable.__assembly__.push(`; Access variable ${name}`);

        // Handle different types of identifiers
        if (this.symbolTable[name].type === 'function') {
            // For function identifiers, we don't generate assembly code here
            // It will be handled in the function call
            return this.symbolTable[name].value;
        } else if (this.symbolTable[name].elements) {
            // For arrays, we return the array object
            return this.symbolTable[name];
        } else {
            // For regular variables, we load the value
            this.symbolTable.__assembly__.push(`LOAD R${this.varCount}, [${name}]`);
            this.varCount++;
            return this.symbolTable[name].value;
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

    visitMathFunction(node) {
        this.symbolTable.__assembly__.push(`; Math function: ${node.function}`);

        let result;

        switch (node.function) {
            case 'sqrt':
                const sqrtArg = this.visitExpression(node.argument);
                this.symbolTable.__assembly__.push(`; Calculate square root of ${sqrtArg}`);
                this.symbolTable.__assembly__.push(`SQRT R${this.varCount}, R${this.varCount-1}`);
                result = Math.sqrt(sqrtArg);
                break;

            case 'pow':
                const base = this.visitExpression(node.base);
                const exponent = this.visitExpression(node.exponent);
                this.symbolTable.__assembly__.push(`; Calculate ${base} raised to power ${exponent}`);
                this.symbolTable.__assembly__.push(`POW R${this.varCount}, R${this.varCount-2}, R${this.varCount-1}`);
                result = Math.pow(base, exponent);
                break;

            case 'sin':
                const sinArg = this.visitExpression(node.argument);
                this.symbolTable.__assembly__.push(`; Calculate sine of ${sinArg}`);
                this.symbolTable.__assembly__.push(`SIN R${this.varCount}, R${this.varCount-1}`);
                result = Math.sin(sinArg);
                break;

            case 'cos':
                const cosArg = this.visitExpression(node.argument);
                this.symbolTable.__assembly__.push(`; Calculate cosine of ${cosArg}`);
                this.symbolTable.__assembly__.push(`COS R${this.varCount}, R${this.varCount-1}`);
                result = Math.cos(cosArg);
                break;

            case 'tan':
                const tanArg = this.visitExpression(node.argument);
                this.symbolTable.__assembly__.push(`; Calculate tangent of ${tanArg}`);
                this.symbolTable.__assembly__.push(`TAN R${this.varCount}, R${this.varCount-1}`);
                result = Math.tan(tanArg);
                break;

            case 'log':
                const logArg = this.visitExpression(node.argument);
                this.symbolTable.__assembly__.push(`; Calculate natural logarithm of ${logArg}`);
                this.symbolTable.__assembly__.push(`LOG R${this.varCount}, R${this.varCount-1}`);
                result = Math.log(logArg);
                break;

            case 'factorial':
                const factArg = this.visitExpression(node.argument);
                this.symbolTable.__assembly__.push(`; Calculate factorial of ${factArg}`);
                this.symbolTable.__assembly__.push(`FACT R${this.varCount}, R${this.varCount-1}`);

                // Calculate factorial
                if (!Number.isInteger(factArg) || factArg < 0) {
                    throw new Error(`Factorial requires a non-negative integer, got ${factArg}`);
                }

                let factorial = 1;
                for (let i = 2; i <= factArg; i++) {
                    factorial *= i;
                }
                result = factorial;
                break;

            default:
                throw new Error(`Unknown math function: ${node.function}`);
        }

        this.varCount++;
        return result;
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
        console.log(`Executing math function: ${node.function}`);
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
                const result = Math.sqrt(arg);
                console.log(`sqrt(${arg}) = ${result}`);
                return result;
            }

            case 'pow': {
                const base = this.visitExpression(node.base);
                const exponent = this.visitExpression(node.exponent);
                if (typeof base !== 'number' || typeof exponent !== 'number') {
                    throw new Error(`Cannot apply pow to non-numeric values: base=${base}, exponent=${exponent}`);
                }
                this.symbolTable.__assembly__.push(`POW R${this.varCount}, R${this.varCount-2}, R${this.varCount-1}`);
                this.varCount++;
                const result = Math.pow(base, exponent);
                console.log(`pow(${base}, ${exponent}) = ${result}`);
                return result;
            }

            case 'sin': {
                const arg = this.visitExpression(node.argument);
                if (typeof arg !== 'number') {
                    throw new Error(`Cannot apply sin to non-numeric value: ${arg}`);
                }
                this.symbolTable.__assembly__.push(`SIN R${this.varCount}, R${this.varCount-1}`);
                this.varCount++;
                const result = Math.sin(arg);
                console.log(`sin(${arg}) = ${result}`);
                return result;
            }

            case 'cos': {
                const arg = this.visitExpression(node.argument);
                if (typeof arg !== 'number') {
                    throw new Error(`Cannot apply cos to non-numeric value: ${arg}`);
                }
                this.symbolTable.__assembly__.push(`COS R${this.varCount}, R${this.varCount-1}`);
                this.varCount++;
                const result = Math.cos(arg);
                console.log(`cos(${arg}) = ${result}`);
                return result;
            }

            case 'tan': {
                const arg = this.visitExpression(node.argument);
                if (typeof arg !== 'number') {
                    throw new Error(`Cannot apply tan to non-numeric value: ${arg}`);
                }
                this.symbolTable.__assembly__.push(`TAN R${this.varCount}, R${this.varCount-1}`);
                this.varCount++;
                const result = Math.tan(arg);
                console.log(`tan(${arg}) = ${result}`);
                return result;
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
                const result = Math.log(arg);
                console.log(`log(${arg}) = ${result}`);
                return result;
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
                console.log(`factorial(${arg}) = ${result}`);
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
            case 'ArrayAssignmentExpression':
                return this.visitArrayAssignmentExpression(node);
            case 'MathFunction':
                return this.visitMathFunction(node);
            default:
                throw new Error(`Unknown expression type: ${node.type}`);
        }
    }

    visitIdentifier(node) {
        // Handle built-in functions
        if (node.name === 'RG_Print') {
            // RG_Print is a built-in function, not a variable
            return 'RG_Print';
        }

        // Handle control flow keywords - these should never be treated as variables
        const controlFlowKeywords = ['if', 'else', 'while', 'for', 'break', 'continue'];
        if (controlFlowKeywords.includes(node.name)) {
            throw new Error(`'${node.name}' is a control flow keyword and cannot be used as a variable`);
        }

        // Handle math functions directly
        const mathFunctions = ['sqrt', 'pow', 'sin', 'cos', 'tan', 'log', 'factorial'];
        if (mathFunctions.includes(node.name.toLowerCase())) {
            // This is a math function reference, not a variable
            console.log(`Math function reference: ${node.name}`);
            return node.name.toLowerCase();
        }

        if (!this.symbolTable[node.name]) {
            throw new Error(`Undefined variable '${node.name}'`);
        }

        // Handle function identifiers
        if (this.symbolTable[node.name].type === 'function') {
            // Return the function name for later use
            console.log(`Function identifier: ${node.name}`);
            return node.name;
        }

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

        let result;

        // Generate assembly for the operation
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
                this.symbolTable.__assembly__.push(`DIV R${this.varCount}, R${this.varCount-2}, R${this.varCount-1}`);
                result = left / right;
                break;

            case '%':
                this.symbolTable.__assembly__.push(`MOD R${this.varCount}, R${this.varCount-2}, R${this.varCount-1}`);
                result = left % right;
                break;

            // Comparison operators
            case '<':
                this.symbolTable.__assembly__.push(`LT R${this.varCount}, R${this.varCount-2}, R${this.varCount-1}`);
                result = left < right;
                break;

            case '>':
                this.symbolTable.__assembly__.push(`GT R${this.varCount}, R${this.varCount-2}, R${this.varCount-1}`);
                result = left > right;
                break;

            case '<=':
                this.symbolTable.__assembly__.push(`LE R${this.varCount}, R${this.varCount-2}, R${this.varCount-1}`);
                result = left <= right;
                break;

            case '>=':
                this.symbolTable.__assembly__.push(`GE R${this.varCount}, R${this.varCount-2}, R${this.varCount-1}`);
                result = left >= right;
                break;

            case '==':
                this.symbolTable.__assembly__.push(`EQ R${this.varCount}, R${this.varCount-2}, R${this.varCount-1}`);
                result = left === right;
                break;

            case '!=':
                this.symbolTable.__assembly__.push(`NE R${this.varCount}, R${this.varCount-2}, R${this.varCount-1}`);
                result = left !== right;
                break;

            default:
                throw new Error(`Unknown binary operator: ${node.operator}`);
        }

        this.varCount++;
        return result;
    }

    visitLogicalExpression(node) {
        this.symbolTable.__assembly__.push(`; Logical operation ${node.operator}`);

        // First evaluate the left operand
        const left = this.visitExpression(node.left);

        // Short-circuit evaluation
        if (node.operator === '&&') {
            // If left is false, don't evaluate right
            if (!left) {
                this.symbolTable.__assembly__.push(`; Short-circuit: left is false, result is false`);
                this.symbolTable.__assembly__.push(`MOV R${this.varCount}, 0`);
                this.varCount++;
                return false;
            }
        } else if (node.operator === '||') {
            // If left is true, don't evaluate right
            if (left) {
                this.symbolTable.__assembly__.push(`; Short-circuit: left is true, result is true`);
                this.symbolTable.__assembly__.push(`MOV R${this.varCount}, 1`);
                this.varCount++;
                return true;
            }
        }

        // Evaluate right operand
        const right = this.visitExpression(node.right);

        // Generate assembly for the operation
        switch (node.operator) {
            case '&&':
                this.symbolTable.__assembly__.push(`AND R${this.varCount}, R${this.varCount-2}, R${this.varCount-1}`);
                this.varCount++;
                return Boolean(left) && Boolean(right);

            case '||':
                this.symbolTable.__assembly__.push(`OR R${this.varCount}, R${this.varCount-2}, R${this.varCount-1}`);
                this.varCount++;
                return Boolean(left) || Boolean(right);

            default:
                throw new Error(`Unknown logical operator: ${node.operator}`);
        }
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