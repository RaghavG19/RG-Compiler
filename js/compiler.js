document.addEventListener('DOMContentLoaded', () => {
    // Setup editor line and column tracking
    const sourceCodeEl = document.getElementById('sourceCode');
    const compileBtn = document.getElementById('compileBtn');
    const clearBtn = document.getElementById('clearBtn');
    const manualBtn = document.getElementById('manualBtn');
    const closeManualBtn = document.getElementById('closeManualBtn');
    const manualPanel = document.getElementById('manualPanel');

    sourceCodeEl.addEventListener('input', updateEditorStats);
    sourceCodeEl.addEventListener('click', updateEditorStats);
    sourceCodeEl.addEventListener('keyup', updateEditorStats);

    function updateEditorStats() {
        const text = sourceCodeEl.value;

        // Update line numbers
        updateLineNumbers();
    }

    function updateLineNumbers() {
        const lineNumbers = document.querySelector('.line-numbers');
        const lines = sourceCodeEl.value.split('\n').length;

        let html = '';
        for (let i = 1; i <= lines; i++) {
            html += i + '<br>';
        }

        lineNumbers.innerHTML = html;
    }

    // Initial update
    updateEditorStats();

    // Output panels
    const tokensEl = document.querySelector('#tokens .panel-content');
    const assemblyEl = document.querySelector('#assembly .panel-content');
    const symbolsEl = document.querySelector('#symbols .panel-content');
    const outputEl = document.getElementById('output');
    const errorsEl = document.getElementById('errors');
    const warningsEl = document.getElementById('warnings');
    const compileStatusEl = document.getElementById('compileStatus') || document.createElement('div');

    // Tab buttons
    const tabButtons = document.querySelectorAll('.tab-btn');
    const outputContents = document.querySelectorAll('.output-content');

    // Initialize components
    const lexer = new Lexer();
    let parser, semanticAnalyzer, codeGenerator;

    // Tab switching functionality
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');

            // Update active tab button
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // Update active content
            outputContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === tabName) {
                    content.classList.add('active');
                }
            });

            // Update status bar based on tab content
            if (tabName === 'errors' && errorsEl.textContent) {
                compileStatusEl.textContent = 'Error';
            } else if (tabName === 'warnings' && warningsEl.textContent) {
                compileStatusEl.textContent = 'Warning';
            } else if (tabName === 'output' && outputEl.textContent) {
                compileStatusEl.textContent = 'Success';
            }
        });
    });

    // Manual panel toggle
    manualBtn.addEventListener('click', () => {
        manualPanel.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent scrolling behind the manual
    });

    closeManualBtn.addEventListener('click', () => {
        manualPanel.classList.remove('active');
        document.body.style.overflow = ''; // Restore scrolling
    });

    // Handle manual section navigation
    document.querySelectorAll('.manual-toc a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            const targetSection = document.getElementById(targetId);

            if (targetSection) {
                targetSection.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    compileBtn.addEventListener('click', () => {
        try {
            // Show loading overlay
            document.getElementById('loadingOverlay').style.display = 'flex';

            // Clear previous outputs
            outputEl.textContent = '';
            errorsEl.textContent = '';
            warningsEl.textContent = '';
            tokensEl.textContent = '';
            assemblyEl.textContent = '';
            symbolsEl.textContent = '';

            const source = sourceCodeEl.value.trim();

            if (!source) {
                errorsEl.textContent = 'Error: Empty input';
                // Switch to errors tab
                document.querySelector('[data-tab="errors"]').click();
                document.getElementById('loadingOverlay').style.display = 'none';
                return;
            }

            // Check if the input looks like documentation text rather than code
            if (source.includes('Introduction to RG Language') ||
                source.includes('Basic Syntax') ||
                source.includes('Variables & Data Types')) {
                errorsEl.textContent = 'Error: It appears you are trying to compile the manual content. Please enter valid RG code instead.';
                document.querySelector('[data-tab="errors"]').click();
                document.getElementById('loadingOverlay').style.display = 'none';
                return;
            }

            // 1. Lexical Analysis
            const tokens = lexer.tokenize(source);

            // Debug output
            console.log("Tokens:", tokens);

            // Format tokens for display in the token panel
            let tokenHtml = '';
            tokens.forEach(token => {
                tokenHtml += `<div class="token-line">
                    <span class="token-type">${token.type}</span>
                    <span class="token-value">${token.value}</span>
                    <span class="token-position">Position: ${token.position}</span>
                </div>`;
            });
            tokensEl.innerHTML = tokenHtml || '<div class="empty-state">No tokens generated</div>';

            // 2. Syntax Analysis
            parser = new Parser(tokens);
            const ast = parser.parse();

            if (!ast) {
                throw new Error("Parser failed to generate a valid AST. Check your syntax.");
            }

            // Debug output
            console.log("AST:", JSON.stringify(ast, null, 2));

            // 3. Semantic Analysis
            semanticAnalyzer = new SemanticAnalyzer();
            const { symbolTable, assemblyCode } = semanticAnalyzer.analyze(ast);

            // 4. Code Generation
            codeGenerator = new CodeGenerator(symbolTable);
            const generatedCode = codeGenerator.generate(ast);

            // Display assembly code in the assembly panel
            let assemblyHtml = '';
            if (assemblyCode && assemblyCode.length > 0) {
                assemblyCode.forEach((line, index) => {
                    // Parse the assembly line
                    let address = `0x${index.toString(16).padStart(4, '0')}`;
                    let opcode = '';
                    let operands = '';
                    let comment = '';

                    if (line.startsWith(';')) {
                        // This is a comment line
                        comment = line;
                    } else if (line.includes(':')) {
                        // This is a label
                        opcode = line;
                    } else {
                        // This is an instruction
                        const parts = line.trim().split(/\s+/);
                        opcode = parts[0] || '';
                        operands = parts.slice(1).join(' ');

                        // Check for inline comment
                        if (operands.includes(';')) {
                            const commentParts = operands.split(';');
                            operands = commentParts[0].trim();
                            comment = '; ' + commentParts[1].trim();
                        }
                    }

                    assemblyHtml += `<div class="assembly-line">
                        <span class="assembly-address">${address}</span>
                        <span class="assembly-opcode">${opcode}</span>
                        <span class="assembly-operands">${operands}</span>
                        ${comment ? `<span class="assembly-comment">${comment}</span>` : ''}
                    </div>`;
                });
            } else {
                assemblyHtml = '<div class="empty-state">No assembly code generated</div>';
            }
            assemblyEl.innerHTML = assemblyHtml;

            // Display symbol table
            let symbolTableHtml = `<table class="data-table">
                <thead>
                    <tr>
                        <th class="col-type">Type</th>
                        <th class="col-name">Name</th>
                        <th class="col-value">Value</th>
                        <th class="col-address">Address</th>
                    </tr>
                </thead>
                <tbody>`;

            let hasSymbols = false;
            for (const [name, info] of Object.entries(symbolTable)) {
                if (name !== '__output__' && name !== '__assembly__') {
                    hasSymbols = true;
                    let value = '';
                    if (info.elements) {
                        // Format array values
                        value = `[${info.elements.join(', ')}]`;
                    } else {
                        value = info.value;
                    }

                    symbolTableHtml += `<tr>
                        <td class="col-type">${info.type}</td>
                        <td class="col-name">${name}</td>
                        <td class="col-value">${value}</td>
                        <td class="col-address">0x${Math.floor(Math.random() * 0xFFFFFFFF).toString(16).padStart(8, '0')}</td>
                    </tr>`;
                }
            }

            symbolTableHtml += '</tbody></table>';

            if (!hasSymbols) {
                symbolTableHtml = '<div class="empty-state">No symbols defined</div>';
            }

            symbolsEl.innerHTML = symbolTableHtml;

            // Generate runtime output
            let output = '';
            if (symbolTable.__output__ && symbolTable.__output__.length > 0) {
                output = symbolTable.__output__.join('\n');
            }

            // Only show the program output, not the variable values
            outputEl.textContent = output || 'Program executed (no output generated)';

            // Switch to output tab
            document.querySelector('[data-tab="output"]').click();

        } catch (error) {
            console.error(error);

            // Format the error message for better readability
            let errorMessage = `Compilation Error:\n${error.message}`;

            // Add token position information if available
            if (error.token) {
                errorMessage += `\nAt position: ${error.token.position}`;
                if (error.token.value) {
                    errorMessage += ` (token: "${error.token.value}")`;
                }
            }

            // Add helpful suggestions based on error type
            if (error.message.includes('Undefined variable')) {
                const varName = error.message.split("'")[1];
                errorMessage += `\n\nSuggestion: Make sure to declare the variable '${varName}' before using it. Example:\nRG int ${varName} = 0;`;
            } else if (error.message.includes('Variable') && error.message.includes('already declared')) {
                const varName = error.message.split("'")[1];
                errorMessage += `\n\nSuggestion: The variable '${varName}' is already declared. Use a different variable name or remove the duplicate declaration.`;
            } else if (error.message.includes('Expected type keyword')) {
                errorMessage += `\n\nSuggestion: All variable declarations must start with 'RG' followed by a type (int, float, bool). Example:\nRG int x = 10;`;
            } else if (error.message.includes('Expect expression')) {
                errorMessage += `\n\nSuggestion: Check your syntax. Make sure all statements end with semicolons and expressions are properly formed.`;
            } else if (error.message.includes('Missing semicolon')) {
                errorMessage += `\n\nSuggestion: Add a semicolon at the end of the statement.`;
            }
            // Add a code example for reference
            errorMessage += `\n\nExample of valid RG code:\nRG int x = 5;\nRG float y = 3.14;\nRG_Print("The value of x is:", x);`;

            errorsEl.textContent = errorMessage;

            // Switch to errors tab
            document.querySelector('[data-tab="errors"]').click();

            // Display empty panels for tokens, assembly, and symbols
            tokensEl.innerHTML = '<div class="empty-state">Compilation failed - no tokens available</div>';
            assemblyEl.innerHTML = '<div class="empty-state">Compilation failed - no assembly code generated</div>';
            symbolsEl.innerHTML = '<div class="empty-state">Compilation failed - no symbols defined</div>';
        } finally {
            // Hide loading overlay
            document.getElementById('loadingOverlay').style.display = 'none';
        }
    });

    clearBtn.addEventListener('click', () => {
        sourceCodeEl.value = '';
        outputEl.textContent = '';
        errorsEl.textContent = '';
        warningsEl.textContent = '';
        // Clear panels with empty state messages
        tokensEl.innerHTML = '<div class="empty-state">No tokens - enter code and run the compiler</div>';
        assemblyEl.innerHTML = '<div class="empty-state">No assembly code - enter code and run the compiler</div>';
        symbolsEl.innerHTML = '<div class="empty-state">No symbols - enter code and run the compiler</div>';
        updateEditorStats();
        // Switch to editor tab
        document.querySelector('[data-tab="output"]').click();
    });

    // Helper functions for formatting output
    function formatJSON(obj) {
        const json = JSON.stringify(obj, null, 2);
        return json.replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/(".*?")/g, '<span class="json-string">$1</span>')
                  .replace(/(\d+)/g, '<span class="json-number">$1</span>')
                  .replace(/(true|false|null)/g, '<span class="json-keyword">$1</span>')
                  .replace(/(\{|\}|\[|\])/g, '<span class="json-bracket">$1</span>');
    }

    function formatAssembly(assembly) {
        return assembly.map(line => {
            if (line.startsWith(';')) {
                return `<span class="asm-comment">${line}</span>`;
            } else if (line.includes(':')) {
                return `<span class="asm-label">${line}</span>`;
            } else {
                return line.replace(/^(\s*[A-Z]+)/, '<span class="asm-instruction">$1</span>');
            }
        }).join('<br>');
    }

    function formatSymbolTable(symbolTable) {
        const filtered = {};
        for (const [key, value] of Object.entries(symbolTable)) {
            if (key !== '__output__' && key !== '__assembly__') {
                filtered[key] = value;
            }
        }
        return formatJSON(filtered);
    }

    // Add copy buttons for output panels
    const addCopyButton = (container, contentId) => {
        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn copy-output-btn';
        copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
        copyBtn.title = 'Copy to clipboard';

        copyBtn.addEventListener('click', () => {
            const content = document.getElementById(contentId).textContent;

            navigator.clipboard.writeText(content).then(() => {
                copyBtn.innerHTML = '<i class="fas fa-check"></i>';
                copyBtn.title = 'Copied!';

                setTimeout(() => {
                    copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
                    copyBtn.title = 'Copy to clipboard';
                }, 1500);
            });
        });

        container.appendChild(copyBtn);
    };

    // Add copy buttons to output tabs
    const outputHeader = document.querySelector('.output-tabs');
    addCopyButton(outputHeader, 'output');
    addCopyButton(outputHeader, 'errors');
    addCopyButton(outputHeader, 'warnings');

    // Initialize with an advanced example
    sourceCodeEl.value = `// RG Advanced Calculator Example

// ===== Basic Variable Declarations =====
RG int x = 10;
RG int y = 5;
RG float pi = 3.14159;
RG bool isTrue = true;
RG bool isFalse = false;

// ===== Basic Arithmetic Operations =====
RG int sum = x + y;
RG int diff = x - y;
RG int product = x * y;
RG int quotient = x / y;
RG int remainder = x % y;

// Print basic results
RG_Print("===== Basic Arithmetic =====");
RG_Print("x =", x, ", y =", y);
RG_Print("Sum (x + y):", sum);
RG_Print("Difference (x - y):", diff);
RG_Print("Product (x * y):", product);
RG_Print("Quotient (x / y):", quotient);
RG_Print("Remainder (x % y):", remainder);

// ===== Advanced Mathematical Functions =====
RG float sqrtValue = sqrt(x);
RG float powerValue = pow(x, 2);
RG float sinValue = sin(pi / 6);  // sin(30 degrees)
RG float cosValue = cos(pi / 3);  // cos(60 degrees)
RG float tanValue = tan(pi / 4);  // tan(45 degrees)
RG float logValue = log(10);

// Print advanced math results
RG_Print("\\n===== Advanced Math Functions =====");
RG_Print("Square root of", x, "is", sqrtValue);
RG_Print("Power of", x, "^2 is", powerValue);
RG_Print("Sin(π/6) =", sinValue);
RG_Print("Cos(π/3) =", cosValue);
RG_Print("Tan(π/4) =", tanValue);
RG_Print("Log(10) =", logValue);

// ===== Comparison Operators =====
RG_Print("\\n===== Comparison Operators =====");
RG_Print("x > y:", x > y);
RG_Print("x < y:", x < y);
RG_Print("x >= y:", x >= y);
RG_Print("x <= y:", x <= y);
RG_Print("x == y:", x == y);
RG_Print("x != y:", x != y);

// ===== Logical Operators =====
RG_Print("\\n===== Logical Operators =====");
RG_Print("isTrue =", isTrue, ", isFalse =", isFalse);
RG_Print("isTrue && isFalse:", isTrue && isFalse);
RG_Print("isTrue || isFalse:", isTrue || isFalse);
RG_Print("!isTrue:", !isTrue);
RG_Print("!isFalse:", !isFalse);

// ===== Conditional Logic =====
RG_Print("\\n===== Conditional Logic =====");
if (x > y) {
    RG_Print("x is greater than y");
} else if (x < y) {
    RG_Print("x is less than y");
} else {
    RG_Print("x is equal to y");
}

// Nested if statements
if (isTrue) {
    RG_Print("isTrue is true");
    if (!isFalse) {
        RG_Print("isFalse is false");
    }
}

// ===== Array Operations =====
RG_Print("\\n===== Array Operations =====");
RG int numbers[5] = 0;  // Initialize array of size 5 with all zeros

// Fill array with values
for (RG int i = 0; i < 5; i = i + 1) {
    numbers[i] = i * 10;
}

// Print array elements
for (RG int i = 0; i < 5; i = i + 1) {
    RG_Print("numbers[", i, "] =", numbers[i]);
}

// ===== Factorial Calculation =====
RG_Print("\\n===== Factorial Calculation =====");
RG int n = 5;
RG int fact = factorial(n);
RG_Print("Factorial of", n, "is", fact);

// ===== Summation Series =====
RG_Print("\\n===== Summation Series =====");
RG int sum_n = 0;
for (RG int i = 1; i <= 10; i = i + 1) {
    sum_n = sum_n + i;
}
RG_Print("Sum of numbers from 1 to 10 is", sum_n);

// ===== While Loop Example =====
RG_Print("\\n===== While Loop Example =====");
RG int counter = 5;
while (counter > 0) {
    RG_Print("Counter:", counter);
    counter = counter - 1;
}

// ===== Break Statement Example =====
RG_Print("\\n===== Break Statement Example =====");
for (RG int i = 0; i < 10; i = i + 1) {
    if (i == 5) {
        RG_Print("Breaking at i =", i);
        break;
    }
    RG_Print("Loop iteration:", i);
}

RG_Print("\\nProgram completed successfully!");`;
});
