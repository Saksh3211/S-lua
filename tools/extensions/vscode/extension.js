const vscode = require('vscode')
const cp = require('child_process')
const path = require('path')

function activate(context) {

    const compileCommand = vscode.commands.registerCommand('slua.compile', function () {

        const editor = vscode.window.activeTextEditor

        if (!editor) {
            vscode.window.showErrorMessage("No file open")
            return
        }

        const file = editor.document.fileName

        const workspace = vscode.workspace.workspaceFolders[0].uri.fsPath

        const compiler = path.join(workspace, "build", "compiler", "sluac.exe")

        const output = cp.spawn(compiler, [file])

        output.stdout.on('data', (data) => {
            vscode.window.showInformationMessage(data.toString())
        })

        output.stderr.on('data', (data) => {
            vscode.window.showErrorMessage(data.toString())
        })

    })

    context.subscriptions.push(compileCommand)

}

function deactivate(){}

module.exports = {
    activate,
    deactivate
}