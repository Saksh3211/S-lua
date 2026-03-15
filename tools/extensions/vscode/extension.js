'use strict';

const vscode = require('vscode');
const cp     = require('child_process');
const path   = require('path');
const os     = require('os');
const fs     = require('fs');

// ─── Constants ────────────────────────────────────────────────────────────────

const KEYWORDS_CONTROL = [
    'if','then','else','elseif','end','for','while','do',
    'repeat','until','return','break','continue','and','or','not'
];
const KEYWORDS_DECL = [
    'local','const','global','function','type','extern',
    'export','import','enum','defer','in','comptime','module'
];
const KEYWORDS_MEM = [
    'alloc','free','alloc_typed','stack_alloc','deref',
    'store','addr','cast','ptr_cast','panic','typeof','sizeof'
];
const CONSTANTS  = ['null','true','false'];
const TYPES      = [
    'int','int8','int16','int32','int64',
    'uint8','uint16','uint32','uint64',
    'number','float','double','string','bool',
    'void','any','ptr','char','byte','table'
];

/** @type {Record<string, {sig:string, doc:string}[]>} */
const MODULE_METHODS = {
    math: [
        { name:'sqrt',    sig:'sqrt(x: number): number',           doc:'Square root of x.' },
        { name:'sin',     sig:'sin(x: number): number',            doc:'Sine of x (radians).' },
        { name:'cos',     sig:'cos(x: number): number',            doc:'Cosine of x (radians).' },
        { name:'tan',     sig:'tan(x: number): number',            doc:'Tangent of x (radians).' },
        { name:'log',     sig:'log(x: number): number',            doc:'Natural log of x.' },
        { name:'log2',    sig:'log2(x: number): number',           doc:'Base-2 log of x.' },
        { name:'exp',     sig:'exp(x: number): number',            doc:'e raised to x.' },
        { name:'pow',     sig:'pow(base: number, exp: number): number', doc:'base raised to exp.' },
        { name:'inf',     sig:'inf(): number',                     doc:'Positive infinity.' },
        { name:'nan',     sig:'nan(): number',                     doc:'Not-a-Number.' },
    ],
    io: [
        { name:'read_line',   sig:'read_line(): string',           doc:'Read a line from stdin.' },
        { name:'read_char',   sig:'read_char(): int',              doc:'Read one character code.' },
        { name:'clear',       sig:'clear(): void',                 doc:'Clear the terminal.' },
        { name:'set_color',   sig:'set_color(color: string): void',doc:'Set terminal color (red/green/yellow/blue/magenta/cyan/white).' },
        { name:'reset_color', sig:'reset_color(): void',           doc:'Reset terminal color.' },
        { name:'print_color', sig:'print_color(msg: string, color: string): void', doc:'Print message in color.' },
        { name:'flush',       sig:'flush(): void',                 doc:'Flush stdout.' },
        { name:'print',       sig:'print(s: string): void',        doc:'Print string.' },
    ],
    os: [
        { name:'time',    sig:'time(): int',                       doc:'Unix timestamp (seconds).' },
        { name:'sleep',   sig:'sleep(ms: int): void',              doc:'Sleep for ms milliseconds.' },
        { name:'sleepS',  sig:'sleepS(s: int): void',              doc:'Sleep for s seconds.' },
        { name:'getenv',  sig:'getenv(key: string): string',       doc:'Get environment variable.' },
        { name:'system',  sig:'system(cmd: string): void',         doc:'Run shell command.' },
        { name:'cwd',     sig:'cwd(): string',                     doc:'Current working directory.' },
    ],
    string: [
        { name:'len',      sig:'len(s: string): int',              doc:'Byte length of string.' },
        { name:'byte',     sig:'byte(s: string, i: int): int',     doc:'Byte value at index i (0-based).' },
        { name:'char',     sig:'char(b: int): string',             doc:'Single-char string from byte.' },
        { name:'sub',      sig:'sub(s: string, from: int, to: int): string', doc:'Substring (0-based, inclusive).' },
        { name:'upper',    sig:'upper(s: string): string',         doc:'Uppercase.' },
        { name:'lower',    sig:'lower(s: string): string',         doc:'Lowercase.' },
        { name:'find',     sig:'find(s: string, needle: string, from: int): int', doc:'Find first occurrence. Returns -1 if not found.' },
        { name:'trim',     sig:'trim(s: string): string',          doc:'Trim leading/trailing whitespace.' },
        { name:'to_int',   sig:'to_int(s: string): int',           doc:'Parse int from string.' },
        { name:'to_float', sig:'to_float(s: string): number',      doc:'Parse number from string.' },
        { name:'concat',   sig:'concat(a: string, b: string): string', doc:'Concatenate two strings.' },
    ],
    stdata: [
        { name:'typeof',    sig:'typeof(v: any): string',          doc:'Type name of value: "int", "number", "bool", "string", "null".' },
        { name:'tostring',  sig:'tostring(v: any): string',        doc:'Convert value to string.' },
        { name:'tointeger', sig:'tointeger(v: any): int',          doc:'Convert value to int.' },
        { name:'tofloat',   sig:'tofloat(v: any): number',         doc:'Convert value to number.' },
        { name:'tobool',    sig:'tobool(v: any): bool',            doc:'Truthy check.' },
        { name:'isnull',    sig:'isnull(v: any): bool',            doc:'True if value is null.' },
        { name:'assert',    sig:'assert(cond: bool, msg: string): void', doc:'Panic if cond is false.' },
    ],
    window: [
        { name:'init',          sig:'init(w: int, h: int, title: string): void', doc:'Open window. Requires: import stdgui' },
        { name:'close',         sig:'close(): void',               doc:'Close window.' },
        { name:'should_close',  sig:'should_close(): int',         doc:'Returns 1 if window should close.' },
        { name:'begin_drawing', sig:'begin_drawing(): void',       doc:'Begin render frame.' },
        { name:'end_drawing',   sig:'end_drawing(): void',         doc:'End render frame and swap buffers.' },
        { name:'clear',         sig:'clear(r: int, g: int, b: int, a: int): void', doc:'Clear background to RGBA color.' },
        { name:'set_fps',       sig:'set_fps(fps: int): void',     doc:'Set target FPS.' },
        { name:'get_fps',       sig:'get_fps(): int',              doc:'Current FPS.' },
        { name:'frame_time',    sig:'frame_time(): number',        doc:'Time of last frame in seconds.' },
        { name:'width',         sig:'width(): int',                doc:'Screen width.' },
        { name:'height',        sig:'height(): int',               doc:'Screen height.' },
    ],
    draw: [
        { name:'rect',          sig:'rect(x,y,w,h, r,g,b,a: int): void',       doc:'Filled rectangle.' },
        { name:'rect_outline',  sig:'rect_outline(x,y,w,h,thick, r,g,b,a: int): void', doc:'Rectangle outline.' },
        { name:'circle',        sig:'circle(cx,cy: int, radius: number, r,g,b,a: int): void', doc:'Filled circle.' },
        { name:'circle_outline',sig:'circle_outline(cx,cy: int, radius: number, r,g,b,a: int): void', doc:'Circle outline.' },
        { name:'line',          sig:'line(x1,y1,x2,y2,thick, r,g,b,a: int): void', doc:'Line.' },
        { name:'triangle',      sig:'triangle(x1,y1,x2,y2,x3,y3, r,g,b,a: int): void', doc:'Filled triangle.' },
        { name:'text',          sig:'text(txt: string, x,y,size, r,g,b,a: int): void', doc:'Draw text (default font).' },
        { name:'measure_text',  sig:'measure_text(txt: string, size: int): int', doc:'Pixel width of text.' },
        { name:'text_font',     sig:'text_font(fid, txt, x,y,size, spacing, r,g,b,a): void', doc:'Draw text with custom font.' },
    ],
    input: [
        { name:'key_down',      sig:'key_down(key: int): int',     doc:'1 if key is held.' },
        { name:'key_pressed',   sig:'key_pressed(key: int): int',  doc:'1 if key was just pressed.' },
        { name:'key_released',  sig:'key_released(key: int): int', doc:'1 if key was just released.' },
        { name:'mouse_x',       sig:'mouse_x(): int',              doc:'Mouse X position.' },
        { name:'mouse_y',       sig:'mouse_y(): int',              doc:'Mouse Y position.' },
        { name:'mouse_pressed', sig:'mouse_pressed(btn: int): int',doc:'1 if mouse button just pressed.' },
        { name:'mouse_down',    sig:'mouse_down(btn: int): int',   doc:'1 if mouse button held.' },
        { name:'mouse_wheel',   sig:'mouse_wheel(): number',       doc:'Mouse wheel delta.' },
    ],
    ui: [
        { name:'button',       sig:'button(x,y,w,h: int, label: string): int',       doc:'Clickable button. Returns 1 when clicked.' },
        { name:'label',        sig:'label(x,y,w,h: int, text: string): void',        doc:'Static text label.' },
        { name:'checkbox',     sig:'checkbox(x,y,size: int, text: string, checked: int): int', doc:'Checkbox. Returns new state.' },
        { name:'slider',       sig:'slider(x,y,w,h: int, min,max,val: number): number', doc:'Slider. Returns new value.' },
        { name:'progress_bar', sig:'progress_bar(x,y,w,h: int, val,max: number): void', doc:'Progress bar.' },
        { name:'panel',        sig:'panel(x,y,w,h: int, title: string): void',       doc:'Panel background with title.' },
        { name:'text_input',   sig:'text_input(x,y,w,h: int, buf, bufSize, active: int): int', doc:'Text input field.' },
        { name:'set_font_size',sig:'set_font_size(size: int): void',                 doc:'Set UI font size.' },
        { name:'set_accent',   sig:'set_accent(r,g,b: int): void',                  doc:'Set UI accent color.' },
    ],
    font: [
        { name:'load',   sig:'load(path: string, size: int): int', doc:'Load font. Returns font ID (or -1 on failure).' },
        { name:'unload', sig:'unload(id: int): void',              doc:'Unload font by ID.' },
    ],
};

// ─── State ────────────────────────────────────────────────────────────────────

/** @type {vscode.DiagnosticCollection} */
let diagnostics;
/** @type {NodeJS.Timeout|null} */
let changeTimer = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Find sluac.exe: config > workspace/build > PATH.
 */
function getCompilerPath() {
    const cfg = vscode.workspace.getConfiguration('slua');
    const cfgPath = cfg.get('compilerPath', '').trim();
    if (cfgPath) return cfgPath;

    const folders = vscode.workspace.workspaceFolders;
    if (folders) {
        for (const folder of folders) {
            const candidate = path.join(folder.uri.fsPath, 'build', 'compiler', 'sluac.exe');
            try { fs.accessSync(candidate); return candidate; } catch {}
        }
    }
    return 'sluac';
}

function getWorkspaceRoot() {
    const folders = vscode.workspace.workspaceFolders;
    return folders ? folders[0].uri.fsPath : null;
}

/**
 * Parse sluac stderr into VS Code Diagnostics.
 * Format: [EE0012] filepath:line:col  message
 *         [WW0010] filepath:line:col  message
 *         [W0001] filepath:  message without line:col
 */
function parseStderr(stderr, document) {
    const result = [];
    for (const raw of stderr.split('\n')) {
        const line = raw.trim();
        if (!line.startsWith('[')) continue;

        // Pattern A – has line:col
        let m = line.match(/^\[([EWN])[\w]+\]\s+.+?:(\d+):(\d+)\s+(.+)$/);
        if (m) {
            const sev = m[1] === 'E' ? vscode.DiagnosticSeverity.Error: m[1] === 'W' ? vscode.DiagnosticSeverity.Warning
                :vscode.DiagnosticSeverity.Information;
            const ln  = Math.max(0, parseInt(m[2]) - 1);
            const col = Math.max(0, parseInt(m[3]) - 1);
            const msg = m[4].trim();

            const endCol = ln < document.lineCount
                ? document.lineAt(ln).text.length
                : col + 1;
            result.push(
                new vscode.Diagnostic(
                    new vscode.Range(ln, col, ln, Math.max(col + 1, endCol)),
                    msg, sev
                )
            );
            continue;
        }

        // Pattern B – no line:col (file-level warning)
        m = line.match(/^\[([EWN])[\w]+\]\s+.+?:\s+(.+)$/);
        if (m) {
            const sev = m[1] === 'E' ? vscode.DiagnosticSeverity.Error: m[1] === 'W' ? vscode.DiagnosticSeverity.Warning
                    :vscode.DiagnosticSeverity.Information;
            const endCol = document.lineAt(0).text.length || 1;
            result.push(
                new vscode.Diagnostic(
                    new vscode.Range(0, 0, 0, endCol),
                    m[2].trim(), sev
                )
            );
        }
    }
    return result;
}

/**
 * Run sluac on a saved file (fast path).
 */
function lintSavedDocument(document) {
    if (document.languageId !== 'slua') return;
    const compiler   = getCompilerPath();
    const cwd        = getWorkspaceRoot() || path.dirname(document.uri.fsPath);
    const tmpOut     = path.join(os.tmpdir(), `slua_lint_out_${Date.now()}.ll`);
    const filePath   = document.uri.fsPath;

    const proc = cp.spawn(compiler, [filePath, '-o', tmpOut], { cwd });
    let stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('close', () => {
        try { fs.unlinkSync(tmpOut); } catch {}
        diagnostics.set(document.uri, parseStderr(stderr, document));
    });
    proc.on('error', () => { /* compiler not found */ });
}

/**
 * Run sluac on the current in-memory content (debounced path).
 * Writes to a temp .slua file, runs sluac, maps errors back.
 */
function lintDocumentContent(document) {
    if (document.languageId !== 'slua') return;
    const compiler = getCompilerPath();
    const cwd      = getWorkspaceRoot() || path.dirname(document.uri.fsPath);
    const tmpIn    = path.join(os.tmpdir(), `slua_lint_in_${Date.now()}.slua`);
    const tmpOut   = path.join(os.tmpdir(), `slua_lint_out_${Date.now()}.ll`);

    try {
        fs.writeFileSync(tmpIn, document.getText(), 'utf8');
    } catch { return; }

    const proc = cp.spawn(compiler, [tmpIn, '-o', tmpOut], { cwd });
    let stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('close', () => {
        try { fs.unlinkSync(tmpIn);  } catch {}
        try { fs.unlinkSync(tmpOut); } catch {}
        diagnostics.set(document.uri, parseStderr(stderr, document));
    });
    proc.on('error', () => {
        try { fs.unlinkSync(tmpIn);  } catch {}
        try { fs.unlinkSync(tmpOut); } catch {}
    });
}

// ─── Completion ───────────────────────────────────────────────────────────────

/** Extract symbols defined in the current document for completion. */
function getLocalSymbols(document) {
    const text    = document.getText();
    const symbols = [];

    const addAll = (re, kind) => {
        let m;
        while ((m = re.exec(text)) !== null)
            symbols.push({ name: m[1], kind });
    };

    addAll(/\blocal\s+([a-zA-Z_]\w*)/g,    vscode.CompletionItemKind.Variable);
    addAll(/\bconst\s+([a-zA-Z_]\w*)/g,    vscode.CompletionItemKind.Constant);
    addAll(/\bglobal\s+([a-zA-Z_]\w*)/g,   vscode.CompletionItemKind.Variable);
    addAll(/\bfunction\s+([a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)?)/g, vscode.CompletionItemKind.Function);
    addAll(/\btype\s+([a-zA-Z_]\w*)/g,     vscode.CompletionItemKind.Class);
    addAll(/\benum\s+([a-zA-Z_]\w*)/g,     vscode.CompletionItemKind.Enum);

    return symbols;
}

class SluaCompletionProvider {
    provideCompletionItems(document, position) {
        const lineText   = document.lineAt(position).text;
        const textBefore = lineText.substring(0, position.character);

        // Module method completion:  math.<cursor>
        const moduleMatch = textBefore.match(/\b(\w+)\.(\w*)$/);
        if (moduleMatch) {
            const modName = moduleMatch[1];
            const methods = MODULE_METHODS[modName];
            if (methods) {
                return methods.map(m => {
                    const item = new vscode.CompletionItem(m.name, vscode.CompletionItemKind.Method);
                    item.detail        = `${modName}.${m.sig}`;
                    item.documentation = new vscode.MarkdownString(m.doc);
                    return item;
                });
            }
        }

        const items = [];

        // Keywords
        for (const kw of [...KEYWORDS_CONTROL, ...KEYWORDS_DECL, ...KEYWORDS_MEM]) {
            items.push(new vscode.CompletionItem(kw, vscode.CompletionItemKind.Keyword));
        }
        for (const c of CONSTANTS) {
            const item = new vscode.CompletionItem(c, vscode.CompletionItemKind.Constant);
            items.push(item);
        }

        // Types
        for (const t of TYPES) {
            const item = new vscode.CompletionItem(t, vscode.CompletionItemKind.TypeParameter);
            item.detail = 'S Lua type';
            items.push(item);
        }

        // Module names
        for (const mod of Object.keys(MODULE_METHODS)) {
            const item = new vscode.CompletionItem(mod, vscode.CompletionItemKind.Module);
            item.detail        = 'built-in module';
            item.documentation = new vscode.MarkdownString(
                `Requires \`import ${mod === 'window' || mod === 'draw' || mod === 'input' || mod === 'ui' || mod === 'font' ? 'stdgui' : mod}\``
            );
            items.push(item);
        }

        // print() built-in
        {
            const item = new vscode.CompletionItem('print', vscode.CompletionItemKind.Function);
            item.insertText    = new vscode.SnippetString('print(${1:value})');
            item.detail        = 'print(value: any): void';
            item.documentation = new vscode.MarkdownString('Print a value followed by a newline.');
            items.push(item);
        }

        // Local document symbols
        const seen = new Set(items.map(i => i.label));
        for (const sym of getLocalSymbols(document)) {
            if (!seen.has(sym.name)) {
                items.push(new vscode.CompletionItem(sym.name, sym.kind));
                seen.add(sym.name);
            }
        }

        return items;
    }
}

// ─── Hover ────────────────────────────────────────────────────────────────────

class SluaHoverProvider {
    provideHover(document, position) {
        const wordRange = document.getWordRangeAtPosition(position, /[a-zA-Z_]\w*/);
        if (!wordRange) return null;
        const word = document.getText(wordRange);

        // Check if preceded by "moduleName."
        const lineText  = document.lineAt(position).text;
        const charBefore = wordRange.start.character > 0 ? lineText[wordRange.start.character - 1] : '';
        if (charBefore === '.') {
            // Find module name before the dot
            const prefix = lineText.substring(0, wordRange.start.character - 1);
            const modMatch = prefix.match(/\b(\w+)$/);
            if (modMatch) {
                const methods = MODULE_METHODS[modMatch[1]];
                if (methods) {
                    const method = methods.find(m => m.name === word);
                    if (method) {
                        const md = new vscode.MarkdownString();
                        md.appendCodeblock(`${modMatch[1]}.${method.sig}`, 'slua');
                        md.appendMarkdown('\n\n' + method.doc);
                        return new vscode.Hover(md, wordRange);
                    }
                }
            }
        }

        // Type descriptions
        const typeInfo = {
            int: 'Integer (64-bit signed). Aliases: int8, int16, int32, int64.',
            number: 'Floating-point (64-bit double). Aliases: float, double.',
            string: 'Immutable string (char*)',
            bool: 'Boolean: true / false',
            void: 'No value (function return only)',
            any: 'Dynamic untyped value',
            ptr: 'Pointer type: `ptr<T>`',
            table: 'Dynamic hash table',
            uint8: '8-bit unsigned integer', uint16: '16-bit unsigned integer',
            uint32: '32-bit unsigned integer', uint64: '64-bit unsigned integer',
            int8: '8-bit signed integer', int16: '16-bit signed integer',
            int32: '32-bit signed integer', int64: '64-bit signed integer (same as int)',
            char: '8-bit character (alias for int8)', byte: '8-bit byte (alias for uint8)',
        };
        if (typeInfo[word]) {
            return new vscode.Hover(
                new vscode.MarkdownString(`**type** \`${word}\` — ${typeInfo[word]}`),
                wordRange
            );
        }

        // Keyword descriptions
        const kwInfo = {
            local: 'Declare a mutable local variable: `local name: Type = value`',
            const: 'Declare an immutable local constant: `const NAME: Type = value`',
            global: 'Declare a module-level global variable',
            function: 'Declare a function: `function name(params): ReturnType ... end`',
            import: 'Import a built-in module: `import math` / `import stdgui`\n\nAvailable: math, os, io, string, stdata, stdgui',
            type: 'Declare a record type: `type Name = { field: Type, ... }`',
            enum: 'Declare an enumeration: `enum Name = { A = 0, B, C }`',
            defer: 'Run statement when current scope exits: `defer free(ptr)`',
            alloc_typed: 'Heap allocate: `alloc_typed(Type, count): ptr<Type>`',
            deref: 'Dereference pointer: `deref(ptr): T`',
            store: 'Write through pointer: `store(ptr, value)`',
            cast: 'Type cast: `cast(TargetType, expr)`',
            panic: 'Abort with message: `panic("message")`',
            null: 'Null pointer literal',
            true: 'Boolean true', false: 'Boolean false',
        };
        if (kwInfo[word]) {
            return new vscode.Hover(
                new vscode.MarkdownString(`**S Lua** — ${kwInfo[word]}`),
                wordRange
            );
        }

        // Module top-level
        if (MODULE_METHODS[word]) {
            const methods = MODULE_METHODS[word].map(m => `- \`${m.name}\` — ${m.doc}`).join('\n');
            const md = new vscode.MarkdownString(`**module \`${word}\`**\n\n${methods}`);
            return new vscode.Hover(md, wordRange);
        }

        return null;
    }
}

// ─── Run File ─────────────────────────────────────────────────────────────────

function runFileInTerminal(document) {
    if (!document || document.languageId !== 'slua') {
        vscode.window.showErrorMessage('No S Lua file is active.');
        return;
    }

    const cfg  = vscode.workspace.getConfiguration('slua');
    const root = cfg.get('sluaRoot', '').trim() || getWorkspaceRoot() || '';
    const rel  = vscode.workspace.asRelativePath(document.uri, false);

    let terminal = vscode.window.terminals.find(t => t.name === 'S Lua');
    if (!terminal) terminal = vscode.window.createTerminal('S Lua');
    terminal.show(true);

    if (root) {
        terminal.sendText(`& "${path.join(root, 'slua.ps1')}" Slua-Run "${rel}"`, true);
    } else {
        terminal.sendText(`echo "Set slua.sluaRoot in settings to enable Slua-Run"`, true);
    }
}

// ─── Activation ───────────────────────────────────────────────────────────────

function activate(context) {
    diagnostics = vscode.languages.createDiagnosticCollection('slua');
    context.subscriptions.push(diagnostics);

    // ── Diagnostics on open ──────────────────────────────────────────────────
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(doc => {
            if (doc.languageId === 'slua') lintSavedDocument(doc);
        })
    );

    // ── Diagnostics on save ──────────────────────────────────────────────────
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(doc => {
            const cfg = vscode.workspace.getConfiguration('slua');
            if (doc.languageId === 'slua' && cfg.get('lintOnSave', true))
                lintSavedDocument(doc);
        })
    );

    // ── Diagnostics on change (debounced) ────────────────────────────────────
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            const doc = event.document;
            if (doc.languageId !== 'slua') return;
            const cfg = vscode.workspace.getConfiguration('slua');
            if (!cfg.get('lintOnChange', true)) return;
            const delay = cfg.get('lintDelay', 600);
            if (changeTimer) clearTimeout(changeTimer);
            changeTimer = setTimeout(() => lintDocumentContent(doc), delay);
        })
    );

    // ── Clear on close ───────────────────────────────────────────────────────
    context.subscriptions.push(
        vscode.workspace.onDidCloseTextDocument(doc =>
            diagnostics.delete(doc.uri)
        )
    );

    // ── Completion ───────────────────────────────────────────────────────────
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            { language: 'slua', scheme: 'file' },
            new SluaCompletionProvider(),
            '.', ' ', ':'
        )
    );

    // ── Hover ────────────────────────────────────────────────────────────────
    context.subscriptions.push(
        vscode.languages.registerHoverProvider(
            { language: 'slua', scheme: 'file' },
            new SluaHoverProvider()
        )
    );

    // ── Commands ─────────────────────────────────────────────────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand('slua.compile', () => {
            const doc = vscode.window.activeTextEditor?.document;
            if (!doc || doc.languageId !== 'slua') {
                vscode.window.showErrorMessage('No S Lua file is active.');
                return;
            }
            lintSavedDocument(doc);
            vscode.window.showInformationMessage('S Lua: diagnostics running…');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('slua.runFile', () => {
            const doc = vscode.window.activeTextEditor?.document;
            runFileInTerminal(doc);
        })
    );

    // ── Lint all open slua documents on startup ───────────────────────────────
    vscode.workspace.textDocuments.forEach(doc => {
        if (doc.languageId === 'slua') lintSavedDocument(doc);
    });
}

function deactivate() {
    if (changeTimer) clearTimeout(changeTimer);
    if (diagnostics) diagnostics.dispose();
}

module.exports = { activate, deactivate };