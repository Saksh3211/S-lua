const vscode = require("vscode");
const lc = require("vscode-languageclient/node");

function activate(context)
{
    const serverOptions = {
        command: "slua-lsp"
    };

    const clientOptions = {
        documentSelector: [{ scheme: "file", language: "slua" }]
    };

    const client = new lc.LanguageClient(
        "slua",
        "S Lua Language Server",
        serverOptions,
        clientOptions
    );

    client.start();
}

exports.activate = activate;
