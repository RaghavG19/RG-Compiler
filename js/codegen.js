class CodeGenerator {
    constructor(symbolTable) {
        this.symbolTable = symbolTable;
        this.output = [];
    }

    generate(ast) {
        this.visitProgram(ast);
        return this.output.join('\n');
    }

    visitProgram(node) {
        for (const statement of node.body) {
            this.visitStatement(statement);
        }
    }

    visitStatement(node) {
        switch (node.type) {
            case 'VariableDeclaration':
                break; // Variable declaration is handled in semantic analysis, no need to handle here
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

    visitPrintStatement(node) {
        const args = node.args.map(arg => {
            const evaluatedArg = this.visitExpression(arg);
            return evaluatedArg;
        });
        this.output.push(args.join(' '));
    }

    visitAssignmentExpression(node) {
        const value = this.visitExpression(node.value);
        this.symbolTable[node.name].value = value; // Update the symbol table with the new value
    }

    visitExpression(node) {
        switch (node.type) {
            case 'Literal':
                return node.value;
            case 'Identifier':
                return this.symbolTable[node.name].value; // Retrieve the value of the variable from the symbol table
            case 'BinaryExpression':
                return this.visitBinaryExpression(node);
            case 'UnaryExpression':
                return this.visitUnaryExpression(node);
            case 'AssignmentExpression':
                return this.visitAssignmentExpression(node); // Handle assignment expression within an expression
            default:
                throw new Error(`Unknown expression type: ${node.type}`);
        }
    }

    visitBinaryExpression(node) {
        const left = this.visitExpression(node.left);
        const right = this.visitExpression(node.right);
        
        switch (node.operator) {
            case '+': return left + right;
            case '-': return left - right;
            case '*': return left * right;
            case '/': 
                if (right === 0) throw new Error('Division by zero');
                return left / right;
            case '%': return left % right;
            default:
                throw new Error(`Unknown operator: ${node.operator}`);
        }
    }

    visitUnaryExpression(node) {
        const right = this.visitExpression(node.right);
        return -right; // Unary negation
    }
}
