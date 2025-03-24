document.addEventListener('DOMContentLoaded', () => {
    const sourceCodeEl = document.getElementById('sourceCode');
    const compileBtn = document.getElementById('compileBtn');
    const clearBtn = document.getElementById('clearBtn');
    
    // Change these lines in compiler.js
    const tokensEl = document.querySelector('#tokens .panel-content');
    const assemblyEl = document.querySelector('#assembly .panel-content');
    const symbolsEl = document.querySelector('#symbols .panel-content');
    const outputEl = document.getElementById('output');
    

    const lexer = new Lexer();
    let parser, semanticAnalyzer;

    compileBtn.addEventListener('click', () => {
        try {
            // Clear previous outputs
            outputEl.textContent = '';
            tokensEl.textContent = '';
            assemblyEl.textContent = '';
            symbolsEl.textContent = '';
            
            const source = sourceCodeEl.value.trim();
            
            if (!source) {
                outputEl.textContent = 'Error: Empty input';
                return;
            }
            
            // 1. Lexical Analysis
            const tokens = lexer.tokenize(source);
            tokensEl.textContent = JSON.stringify(tokens, null, 2);
            
            // 2. Syntax Analysis
            parser = new Parser(tokens);
            const ast = parser.parse();
            
            // 3. Semantic Analysis (executes the program)
            semanticAnalyzer = new SemanticAnalyzer();
            const { symbolTable, assemblyCode } = semanticAnalyzer.analyze(ast);
            
            // Display outputs
            assemblyEl.textContent = assemblyCode.join('\n');
            symbolsEl.textContent = JSON.stringify(symbolTable, null, 2);
            
            // 4. Generate runtime output
            let output = '';
            if (symbolTable.__output__ && symbolTable.__output__.length > 0) {
                output = symbolTable.__output__.join('\n') + '\n\n';
            }
            output += 'Variable Values:\n';
            for (const [name, info] of Object.entries(symbolTable)) {
                if (name !== '__output__') {
                    output += `${name} = ${info.value}\n`;
                }
            }
            outputEl.textContent = output || 'Program executed (no variables declared)';
            
        } catch (error) {
            outputEl.textContent = `Compilation Error:\n${error.message}`;
            console.error(error);
        }
    });

    clearBtn.addEventListener('click', () => {
        sourceCodeEl.value = '';
        outputEl.textContent = '';
        tokensEl.textContent = '';
        assemblyEl.textContent = '';
        symbolsEl.textContent = '';
    });

    // Initialize with a working example
    sourceCodeEl.value = `RG int x = 10;
RG int y = 20;
RG int sum = x + y;
RG_Print("The sum is:", sum);`;
});