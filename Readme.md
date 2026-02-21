
# 🧠 RG Compiler

RG Compiler is a complete educational compiler implementation for the **RG programming language**.
It transforms high-level RG source code into assembly-like intermediate code using classical compiler phases including lexical analysis, syntax analysis, semantic analysis, and code generation.

The compiler provides an integrated development environment (IDE) where users can write code, analyze tokens, inspect symbol tables, and view generated assembly.

---

## 🚀 Project Overview

RG Compiler demonstrates the full workflow of program compilation:

* Tokenization of source code
* Grammar-based parsing
* Abstract Syntax Tree (AST) construction
* Semantic validation
* Intermediate code generation
* Execution in a simulated environment

This project is designed to help students understand **compiler design principles and programming language implementation**.

---

## ✨ Key Features

✅ Integrated compiler interface
✅ Syntax highlighting editor
✅ Token visualization panel
✅ Symbol table tracking
✅ Assembly-like intermediate code generation
✅ Strong type system
✅ Control flow support
✅ Error detection and reporting
✅ Basic code optimization

---

# 📘 RG Language Documentation

## 🧩 Introduction

RG is a simple C-style programming language designed for educational purposes.
It combines clean syntax with powerful mathematical and logical operations.

### Key Language Features

* Simple syntax inspired by C
* Strong typing system
* Built-in mathematical functions
* Array support
* Control flow statements

---

## ✍ Basic Syntax

RG programs consist of statements ending with semicolons.

### Comments

```c
// This is a single-line comment
```

### Statements

```c
RG int x = 5;
RG_Print("Hello, world!");
```

### Code Blocks

```c
if (condition) {
    statement1;
    statement2;
}
```

---

## 🧮 Variables & Data Types

All variables begin with the `RG` keyword.

### Basic Data Types

| Type  | Description    | Example |
| ----- | -------------- | ------- |
| int   | Integer values | 10      |
| float | Decimal values | 3.14    |
| bool  | Boolean values | true    |

---

### Declaration Examples

```c
RG int age = 25;
RG float pi = 3.14159;
RG bool isActive = true;
```

### Multiple Variables

```c
RG int x = 10, y = 20, z = 30;
```

---

### Naming Rules

* Must start with letter or underscore
* May contain numbers
* Case sensitive
* Cannot use reserved keywords

---

## ⚙ Operators

### Arithmetic

```
+   Addition
-   Subtraction
*   Multiplication
/   Division
%   Modulus
^   Power
```

### Relational

```
<   Less than
>   Greater than
<=  Less or equal
>=  Greater or equal
==  Equal
!=  Not equal
```

### Logical

```
AND
OR
NOT
```

---

## 🔁 Control Flow

### If Statement

```c
if (x > 10) {
    RG_Print("Greater");
}
```

### If–Else

```c
if (x > 10) {
    RG_Print("Greater");
} else {
    RG_Print("Smaller");
}
```

### While Loop

```c
while (x < 10) {
    x = x + 1;
}
```

### For Loop

```c
for (i = 0; i < 5; i = i + 1) {
    RG_Print(i);
}
```

---

## 🧮 Built-in Functions

| Function      | Description |
| ------------- | ----------- |
| sqrt(x)       | Square root |
| pow(a,b)      | Power       |
| sin(x)        | Sine        |
| cos(x)        | Cosine      |
| tan(x)        | Tangent     |
| log(x)        | Logarithm   |
| factorial(n)  | Factorial   |
| sum_series(n) | Summation   |

---

## 📦 Arrays

### Declaration

```c
RG int arr[5];
```

### Access

```c
arr[0] = 10;
RG_Print(arr[0]);
```

---

## 💡 Example Program

```c
RG int x = 10;
RG int y = 20;
RG int sum = x + y;

RG_Print(sum);
```

---

# 🖥 Using the RG Compiler

## Compiler Interface

The IDE includes:

* Code Editor
* Output Panel
* Token Panel
* Assembly Panel
* Symbol Table

---

## Compilation Process

1. Write RG code
2. Click Run
3. View output
4. Fix errors if needed

---

## Compiler Features

* Syntax highlighting
* Detailed error reporting
* Line numbers
* Token analysis
* Assembly generation

---

# 🏗 Compiler Architecture

The compiler follows the classical pipeline.

```
Source Code
   ↓
Lexical Analysis
   ↓
Syntax Analysis
   ↓
Semantic Analysis
   ↓
Code Generation
   ↓
Execution
```

---

## 🔍 Compilation Phases

### 1️⃣ Lexical Analysis

Breaks code into tokens.

Example:

```
RG int x = 5;
→ [RG, int, x, =, 5, ;]
```

---

### 2️⃣ Syntax Analysis

Builds Abstract Syntax Tree (AST).

---

### 3️⃣ Semantic Analysis

Checks:

* Variable declarations
* Type compatibility
* Valid operations

---

### 4️⃣ Code Generation

Produces assembly-like intermediate code.

Example:

```
MOV R0, 5
STORE [x], R0
```

---

## 📊 Symbol Table

Tracks variables and types.

Example:

```
{
  "x": { type: "int", value: 5 },
  "y": { type: "float", value: 3.14 }
}
```

---

## ⚠ Error Handling

Detects:

* Syntax errors
* Semantic errors
* Type mismatch
* Undefined variables
* Division by zero

---

## ⚡ Optimization

* Constant folding
* Dead code elimination
* Efficient register usage

---

## 📁 Project Structure

```
RG-Compiler/
│
├── index.html
├── css/
├── js/
│   ├── lexer.js
│   ├── parser.js
│   ├── semantic.js
│   ├── codegen.js
│   └── compiler.js
└── README.md
```

---

## 🧪 Execution Model

1. Source code analyzed
2. AST generated
3. Intermediate code created
4. Executed in simulator
5. Output displayed

---

## 🎯 Learning Outcomes

This project demonstrates:

* Compiler architecture
* Tokenization
* Parsing
* Semantic analysis
* Code generation
* Symbol table management

---

## 👨‍💻 Author

Raghav Gandhi
B.Tech Data Science

