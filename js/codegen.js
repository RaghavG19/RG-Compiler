class CodeGenerator {
    constructor(symbolTable) {
        this.symbolTable = symbolTable;
        this.output = [];
        this.indentLevel = 0;
        this.loopLabels = [];
    }

    generate(ast) {
        this.visitProgram(ast);
        return this.output.join('\n');
    }

    indent() {
        return '  '.repeat(this.indentLevel);
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

    visitVariableDeclaration(node) {
        const value = this.visitExpression(node.initializer);
        this.output.push(`${this.indent()}${node.dataType || 'int'} ${node.name} = ${this.formatValue(value)};`);
    }

    visitArrayDeclaration(node) {
        const size = this.visitExpression(node.size);
        const initialValue = node.initializer ? this.visitExpression(node.initializer) : 0;

        this.output.push(`${this.indent()}${node.dataType || 'int'} ${node.name}[${size}] = ${this.formatValue(initialValue)};`);
    }

    visitPrintStatement(node) {
        const args = node.args.map(arg => {
            const evaluatedArg = this.visitExpression(arg);
            return this.formatValue(evaluatedArg);
        });
        this.output.push(`${this.indent()}print(${args.join(', ')});`);
    }

    visitExpressionStatement(node) {
        const expr = this.visitExpression(node.expression);
        this.output.push(`${this.indent()}${expr};`);
    }

    visitAssignmentExpression(node) {
        const value = this.visitExpression(node.value);
        this.output.push(`${this.indent()}${node.name} = ${this.formatValue(value)};`);
        return value;
    }

    visitArrayAssignmentExpression(node) {
        const index = this.visitExpression(node.index);
        const value = this.visitExpression(node.value);
        this.output.push(`${this.indent()}${node.array}[${index}] = ${this.formatValue(value)};`);
        return value;
    }

    visitIfStatement(node) {
        const condition = this.visitExpression(node.condition);
        this.output.push(`${this.indent()}if (${condition}) {`);

        this.indentLevel++;
        for (const stmt of node.thenBranch) {
            this.visitStatement(stmt);
        }
        this.indentLevel--;

        if (node.elseBranch) {
            this.output.push(`${this.indent()}} else {`);
            this.indentLevel++;

            if (Array.isArray(node.elseBranch)) {
                for (const stmt of node.elseBranch) {
                    this.visitStatement(stmt);
                }
            } else {
                this.visitStatement(node.elseBranch);
            }

            this.indentLevel--;
        }

        this.output.push(`${this.indent()}}`);
    }

    visitForStatement(node) {
        const loopLabel = `loop_${this.loopLabels.length}`;
        this.loopLabels.push(loopLabel);

        this.output.push(`${this.indent()}for (`);

        // Initializer
        if (node.initializer) {
            if (node.initializer.type === 'VariableDeclaration') {
                const value = this.visitExpression(node.initializer.initializer);
                this.output[this.output.length - 1] += `${node.initializer.dataType || 'int'} ${node.initializer.name} = ${this.formatValue(value)}; `;
            } else {
                const expr = this.visitExpression(node.initializer.expression);
                this.output[this.output.length - 1] += `${expr}; `;
            }
        } else {
            this.output[this.output.length - 1] += `; `;
        }

        // Condition
        if (node.condition) {
            const condition = this.visitExpression(node.condition);
            this.output[this.output.length - 1] += `${condition}; `;
        } else {
            this.output[this.output.length - 1] += `; `;
        }

        // Increment
        if (node.increment) {
            const increment = this.visitExpression(node.increment);
            this.output[this.output.length - 1] += `${increment}) {`;
        } else {
            this.output[this.output.length - 1] += `) {`;
        }

        // Body
        this.indentLevel++;
        for (const stmt of node.body) {
            this.visitStatement(stmt);
        }
        this.indentLevel--;

        this.output.push(`${this.indent()}}`);
        this.loopLabels.pop();
    }

    visitWhileStatement(node) {
        const loopLabel = `loop_${this.loopLabels.length}`;
        this.loopLabels.push(loopLabel);

        const condition = this.visitExpression(node.condition);
        this.output.push(`${this.indent()}while (${condition}) {`);

        this.indentLevel++;
        for (const stmt of node.body) {
            this.visitStatement(stmt);
        }
        this.indentLevel--;

        this.output.push(`${this.indent()}}`);
        this.loopLabels.pop();
    }

    visitBreakStatement(node) {
        if (this.loopLabels.length === 0) {
            throw new Error('Break statement outside of loop');
        }

        this.output.push(`${this.indent()}break;`);
    }

    visitInsertOperation(node) {
        const value = this.visitExpression(node.value);
        this.output.push(`${this.indent()}insert(${node.array}, ${this.formatValue(value)});`);
    }

    visitDeleteOperation(node) {
        const index = this.visitExpression(node.value);
        this.output.push(`${this.indent()}delete(${node.array}, ${index});`);
    }

    visitExpression(node) {
        switch (node.type) {
            case 'Literal':
                return node.value;
            case 'Identifier':
                return node.name;
            case 'ArrayAccess':
                return `${node.array}[${this.visitExpression(node.index)}]`;
            case 'BinaryExpression':
                return this.visitBinaryExpression(node);
            case 'LogicalExpression':
                return this.visitLogicalExpression(node);
            case 'UnaryExpression':
                return this.visitUnaryExpression(node);
            case 'AssignmentExpression':
                return `${node.name} = ${this.visitExpression(node.value)}`;
            case 'MathFunction':
                return this.visitMathFunction(node);
            case 'FunctionCall':
                return this.visitFunctionCall(node);
            default:
                throw new Error(`Unknown expression type: ${node.type}`);
        }
    }

    visitBinaryExpression(node) {
        const left = this.visitExpression(node.left);
        const right = this.visitExpression(node.right);

        // Handle string concatenation for + operator
        if (node.operator === '+' && (typeof left === 'string' || typeof right === 'string')) {
            return `concat(${this.formatValue(left)}, ${this.formatValue(right)})`;
        }

        return `(${this.formatValue(left)} ${node.operator} ${this.formatValue(right)})`;
    }

    visitLogicalExpression(node) {
        const left = this.visitExpression(node.left);
        const right = this.visitExpression(node.right);

        const operator = node.operator === '&&' ? '&&' :
                         node.operator === '||' ? '||' :
                         node.operator;

        return `(${this.formatValue(left)} ${operator} ${this.formatValue(right)})`;
    }

    visitUnaryExpression(node) {
        const right = this.visitExpression(node.right);

        if (node.operator === '-') {
            return `(-${this.formatValue(right)})`;
        } else if (node.operator === '!') {
            return `(!${this.formatValue(right)})`;
        }

        return `(${node.operator}${this.formatValue(right)})`;
    }

    visitMathFunction(node) {
        switch (node.function) {
            case 'sqrt':
                return `sqrt(${this.visitExpression(node.argument)})`;
            case 'pow':
                return `pow(${this.visitExpression(node.base)}, ${this.visitExpression(node.exponent)})`;
            case 'sin':
                return `sin(${this.visitExpression(node.argument)})`;
            case 'cos':
                return `cos(${this.visitExpression(node.argument)})`;
            case 'tan':
                return `tan(${this.visitExpression(node.argument)})`;
            case 'log':
                return `log(${this.visitExpression(node.argument)})`;
            case 'factorial':
                return `factorial(${this.visitExpression(node.argument)})`;
            default:
                throw new Error(`Unknown math function: ${node.function}`);
        }
    }

    visitFunctionCall(node) {
        // Get the function name
        const funcName = node.name;

        // Process all arguments
        const args = node.args.map(arg => this.formatValue(this.visitExpression(arg)));

        // Return the function call as a string
        return `${funcName}(${args.join(', ')})`;
    }

    formatValue(value) {
        if (typeof value === 'string') {
            // Escape quotes in strings
            return `"${value.replace(/"/g, '\\"')}"`;
        } else if (value === null || value === undefined) {
            return 'null';
        } else if (typeof value === 'boolean') {
            return value ? 'true' : 'false';
        } else {
            return value.toString();
        }
    }
}
