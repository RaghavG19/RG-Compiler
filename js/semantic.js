class SemanticAnalyzer {
    constructor() {
        this.symbolTable = {
            __output__: [],
            __assembly__: []
        };
        this.varCount = 0;   // Keeps track of available registers
        this.labelCount = 0; // Keeps track of labels for branching
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
            case 'PrintStatement':
                this.visitPrintStatement(node);
                break;
            case 'AssignmentExpression':
                this.visitAssignmentExpression(node);
                break;
            default:
                throw new Error(`Unknown statement type: ${node.type}`);
        }
    }

    visitVariableDeclaration(node) {
        const varName = node.name;
        if (this.symbolTable[varName]) {
            throw new Error(`Variable '${varName}' already declared`);
        }
        
        // Generate assembly for variable declaration
        this.symbolTable.__assembly__.push(`; Declare variable ${varName}`);
        const value = this.visitExpression(node.initializer);
        this.symbolTable.__assembly__.push(`MOV R${this.varCount}, ${value}`);
        this.symbolTable.__assembly__.push(`STORE [${varName}], R${this.varCount}`);
        
        // Update symbol table and register count
        this.symbolTable[varName] = {
            type: 'int',
            value: value
        };
        this.varCount++;
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

    visitExpression(node) {
        switch (node.type) {
            case 'Literal':
                return this.visitLiteral(node);
            case 'Identifier':
                return this.visitIdentifier(node);
            case 'BinaryExpression':
                return this.visitBinaryExpression(node);
            case 'UnaryExpression':
                return this.visitUnaryExpression(node);
            case 'AssignmentExpression':
                return this.visitAssignmentExpression(node);
            default:
                throw new Error(`Unknown expression type: ${node.type}`);
        }
    }

    visitLiteral(node) {
        return node.value;
    }

    visitIdentifier(node) {
        if (!this.symbolTable[node.name]) {
            throw new Error(`Undefined variable '${node.name}'`);
        }
        this.symbolTable.__assembly__.push(`LOAD R${this.varCount}, [${node.name}]`);
        const reg = this.varCount;
        this.varCount++;
        return this.symbolTable[node.name].value;
    }

    visitBinaryExpression(node) {
        this.symbolTable.__assembly__.push(`; Binary operation ${node.operator}`);
        const left = this.visitExpression(node.left);
        const right = this.visitExpression(node.right);
        
        if (typeof left !== 'number' || typeof right !== 'number') {
            throw new Error(`Cannot perform arithmetic on non-numeric values`);
        }

        let result;
        switch (node.operator) {
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
            default:
                throw new Error(`Unknown operator: ${node.operator}`);
        }
        
        this.varCount++;
        return result;
    }

    visitUnaryExpression(node) {
        this.symbolTable.__assembly__.push(`; Unary operation ${node.operator}`);
        const right = this.visitExpression(node.right);
        if (typeof right !== 'number') {
            throw new Error(`Cannot apply unary operator to non-numeric value`);
        }
        this.symbolTable.__assembly__.push(`NEG R${this.varCount}, R${this.varCount-1}`);
        this.varCount++;
        return -right;
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
