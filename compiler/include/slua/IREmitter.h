#pragma once

#ifdef SLUA_HAS_LLVM

#include "AST.h"
#include "Diagnostics.h"
#include "SemanticConfig.h"
#include "TypeChecker.h"

#include <llvm/IR/IRBuilder.h>
#include <llvm/IR/LLVMContext.h>
#include <llvm/IR/Module.h>
#include <llvm/IR/Value.h>
#include <llvm/IR/Type.h>
#include <llvm/IR/Function.h>
#include <llvm/IR/BasicBlock.h>
#include <llvm/IR/Verifier.h>
#include <llvm/Support/raw_ostream.h>
#include <llvm/Support/FileSystem.h>

#include <string>
#include <unordered_map>
#include <vector>
#include <memory>
#include <functional>

namespace slua {

// â”€â”€ Defer stack entry â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
struct DeferEntry {
    std::function<void()> emit_fn;
};

// â”€â”€ Code generator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
class IREmitter {
public:
    IREmitter(DiagEngine& diag, SemanticConfig cfg,
              const std::string& module_name);

    // Emit IR for a full module. Returns false on error.
    bool emit(slua::Module& mod);

    // Write .ll text to file
    bool write_ll(const std::string& path);

    // Write .bc bitcode to file
    bool write_bc(const std::string& path);

    // Print IR to stderr (debug)
    void dump();

private:
    DiagEngine&    diag_;
    SemanticConfig cfg_;

    llvm::LLVMContext              ctx_;
    std::unique_ptr<llvm::Module>  mod_;
    llvm::IRBuilder<>              builder_;

    // â”€â”€ Type environment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // name â†’ llvm::AllocaInst* (stack variable)
    struct VarEnv {
        std::unordered_map<std::string, llvm::Value*> vars;
        VarEnv* parent = nullptr;
        llvm::Value* lookup(const std::string& n) const {
            auto it = vars.find(n);
            if (it != vars.end()) return it->second;
            return parent ? parent->lookup(n) : nullptr;
        }
        void define(const std::string& n, llvm::Value* v) { vars[n] = v; }
    };
    VarEnv* env_ = nullptr;

    void push_env();
    void pop_env();

    // â”€â”€ Type registry: slua type name â†’ llvm::Type* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    std::unordered_map<std::string, llvm::StructType*> struct_types_;

    // â”€â”€ Function registry: name â†’ llvm::Function* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    std::unordered_map<std::string, llvm::Function*> functions_;
    std::unordered_set<std::string>                   known_imports_;

    // â”€â”€ Defer stack (per-function, LIFO) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    std::vector<std::vector<DeferEntry>> defer_stack_;
    void push_defer_scope();
    void pop_defer_scope();  // emits deferred code
    void add_defer(std::function<void()> fn);

    // â”€â”€ Current function context â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    llvm::Function*   cur_func_     = nullptr;
    llvm::BasicBlock* cur_ret_bb_   = nullptr;  // function exit block
    llvm::AllocaInst* cur_ret_slot_ = nullptr;  // alloca for return value
    CompileMode       cur_mode_     = CompileMode::NONSTRICT;

    // â”€â”€ LLVM type helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    llvm::Type* llvm_type(const TypeNode* t);
    llvm::Type* llvm_type_named(const std::string& name);
    llvm::Type* tagvalue_type();   // 16-byte {i8, [7 x i8], i64} for dynamic

    // â”€â”€ Runtime function declarations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    void declare_runtime();
    llvm::Function* get_runtime_fn(const std::string& name);

    // â”€â”€ Statement emitters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    void emit_stmt       (Stmt& s);
    void emit_local_decl (LocalDecl&  s, SourceLoc loc);
    void emit_global_decl(GlobalDecl& s, SourceLoc loc);
    void emit_func_decl  (FuncDecl&   s, SourceLoc loc);
    void emit_if_stmt    (IfStmt&     s);
    void emit_while_stmt (WhileStmt&  s);
    void emit_repeat_stmt(RepeatStmt& s);
    void emit_numeric_for(NumericFor& s);
    void emit_return_stmt(ReturnStmt& s, SourceLoc loc);
    void emit_assign     (Assign&     s, SourceLoc loc);
    void emit_call_stmt  (CallStmt&   s);
    void emit_defer_stmt (DeferStmt&  s);
    void emit_do_block   (DoBlock&    s);
    void emit_store_stmt (StoreStmt&  s);
    void emit_free_stmt  (FreeStmt&   s);
    void emit_panic_stmt (PanicStmt&  s);
    void emit_type_decl  (TypeDecl&   s, SourceLoc loc);
    void emit_extern_decl(ExternDecl& s, SourceLoc loc);

    // â”€â”€ Expression emitters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Returns the LLVM Value* for the expression result
    llvm::Value* emit_expr        (Expr& e);
    llvm::Value* emit_binop       (Binop&      e, SourceLoc loc);
    llvm::Value* emit_unop        (Unop&       e, SourceLoc loc);
    llvm::Value* emit_call_expr   (Call&       e, SourceLoc loc);
    llvm::Value* emit_method_call (MethodCall& e, SourceLoc loc);
    llvm::Value* emit_field       (Field&      e, SourceLoc loc);
    llvm::Value* emit_index       (Index&      e, SourceLoc loc);
    llvm::Value* emit_table_ctor  (TableCtor&  e, SourceLoc loc);
    llvm::Value* emit_alloc_expr  (AllocExpr&  e, SourceLoc loc);
    llvm::Value* emit_deref_expr  (DerefExpr&  e, SourceLoc loc);
    llvm::Value* emit_addr_expr   (AddrExpr&   e, SourceLoc loc);
    llvm::Value* emit_cast_expr   (CastExpr&   e, SourceLoc loc);

    // â”€â”€ Pointer to an lvalue (for assignment targets) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    llvm::Value* emit_lvalue(Expr& e);

    // â”€â”€ Helper: alloca in function entry block â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    llvm::AllocaInst* create_alloca(llvm::Type* ty, const std::string& name);

    // â”€â”€ Helper: emit slua_panic call â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    void emit_panic(const std::string& msg, SourceLoc loc);

    // â”€â”€ Helper: coerce value between numeric types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    llvm::Value* coerce(llvm::Value* v, llvm::Type* to, SourceLoc loc);
};

} // namespace slua

#endif // SLUA_HAS_LLVM