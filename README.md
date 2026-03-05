# S Lua Compiler

S Lua (Systems Lua) — a compiled, low-level systems programming language with Lua-inspired syntax.

## Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| CMake | 3.20+ | https://cmake.org/download/ |
| Ninja | latest | https://ninja-build.org/ |
| LLVM + Clang | 17+ | https://github.com/llvm/llvm-project/releases |
| VS Code | latest | https://code.visualstudio.com |

## Quick Start

```powershell
# Run the bootstrap (already done if you're reading this)
# .\bootstrap_slua.ps1

# Install prerequisites (LLVM installer sets LLVM_DIR automatically)

# Configure and build
cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Debug
cmake --build build --parallel

# Test the lexer
.\build\compiler\sluac.exe examples\hello_strict.slua --emit-tokens
.\build\compiler\sluac.exe examples\hello_nonstrict.slua --emit-tokens

# 5. Open in VS Code
code .
```

## Project Layout

```
slua-compiler/
+-- compiler/
¦   +-- include/slua/     # All compiler headers
¦   ¦   +-- Lexer.h
¦   ¦   +-- AST.h
¦   ¦   +-- Parser.h
¦   ¦   +-- Diagnostics.h
¦   ¦   +-- SemanticConfig.h
¦   +-- src/
¦       +-- lexer/        Lexer.cpp
¦       +-- parser/       Parser.cpp (recursive descent)
¦       +-- ast/          (AST printing, visitors)
¦       +-- sema/         (Type checker, scope resolver)
¦       +-- codegen/      (LLVM IR emitter)
¦       +-- driver/       main.cpp (sluac entry point)
+-- runtime/
¦   +-- include/          slua_runtime.h
¦   +-- src/              slua_runtime.c, slua_table.c
+-- examples/             .slua example programs
+-- tests/                CTest-integrated .slua tests
+-- .vscode/              Settings, tasks, launch config
+-- CMakeLists.txt
```

## Implementation Roadmap

| Phase | Status |
|-------|--------|
| Directive scanner + mode detection | DONE |
| Lexer | DONE |
| AST node definitions | DONE |
| Parser (recursive descent) | STUB — expand Parser.cpp |
| Name resolution + scope | TODO |
| Type checker | TODO |
| LLVM IR emitter | TODO |
| Optimization passes | TODO |
| Code generation | TODO |
| Interface file (.slua.sig) emitter | TODO |
| libslua runtime | DONE (core) |
| Table operations | DONE |
| Standard library | TODO |

## Building on Windows (LLVM note)

After installing LLVM, set the cmake variable:
```
cmake -DLLVM_DIR="C:/Program Files/LLVM/lib/cmake/llvm" -S . -B build -G Ninja
```

## Language Quick Reference

```lua
--!!strict              -- strict mode: all type violations are errors
--!!nonstrict           -- nonstrict mode: most issues are warnings

local x: int = 10      -- static zone
local y = 10           -- dynamic zone (any)
const MAX: int = 256   -- immutable

function add(a: int, b: int): int
    return a + b
end

local buf: ptr<uint8> = alloc_typed(uint8, 1024)
if buf == null then panic("OOM") end
defer free(buf)
```
