import { spawn } from "child_process";
import * as vscode from "vscode";
import { VirtualFileSystemProvider } from "./virtualFileSystem";
import { VirtualTextContentProvider } from "./virtualTextContentProvider";

export function activate(context: vscode.ExtensionContext) {
  const virtualFileSystem = new VirtualFileSystemProvider();
  const virtualTextContentProvider = new VirtualTextContentProvider();

  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider(
      "deviz-input-text",
      virtualFileSystem
    ),
    vscode.workspace.registerTextDocumentContentProvider(
      "deviz-output-text",
      virtualTextContentProvider
    )
  );

  const stdinUri = vscode.Uri.parse("deviz-input-text:/stdin");
  const stdoutUri = vscode.Uri.parse("deviz-output-text:/stdout");
  const stderrUri = vscode.Uri.parse("deviz-output-text:/stderr");

  const refreshOutput = () => {
    const inputDocument = vscode.workspace.textDocuments.find(
      (document) => document.uri.scheme === "deviz-input-text"
    );
    if (!inputDocument) {
      vscode.window.showErrorMessage("Deviz: Must open input pane");
      return;
    }
    const inputText = inputDocument.getText();

    if (!vscode.workspace.workspaceFolders) {
      vscode.window.showErrorMessage("Deviz: Must have folder open");
      return;
    }
    const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const command = "cargo run";

    const process = spawn(command, {
      cwd: workspacePath,
      shell: true,
      env: { ["DEVIZ_SERVER"]: "1" },
    });

    process.stdin.write(inputText);
    process.stdin.end();

    let stdout = "";
    let numChunks = 0;
    process.stdout.on("data", (chunk) => {
      numChunks += 1;
      stdout += chunk;
    });

    let stderr = "";
    process.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    process.on("close", () => {
      virtualTextContentProvider.setFileContent(stdoutUri, stdout);
      virtualTextContentProvider.setFileContent(stderrUri, stderr);
    });

    // TODO: Kill process if still running
    // TODO: Should be async
  };

  vscode.workspace.onDidChangeTextDocument((event) => {
    switch (event.document.uri.scheme) {
      case "deviz-input-text":
        refreshOutput();
        break;

      case "deviz-output-text":
        for (const editor of vscode.window.visibleTextEditors) {
          if (editor.document === event.document) {
            editor.selection = new vscode.Selection(0, 0, 0, 0);
          }
        }
        break;
    }
  });
  vscode.workspace.onDidSaveTextDocument(refreshOutput);

  context.subscriptions.push(
    vscode.commands.registerCommand("deviz.startSession", async () => {
      await vscode.window.showTextDocument(stdinUri, {
        viewColumn: vscode.ViewColumn.Two,
        preserveFocus: true,
        preview: false,
      });
      await vscode.window.showTextDocument(stdoutUri, {
        viewColumn: vscode.ViewColumn.Two,
        preserveFocus: true,
        preview: false,
      });
      await vscode.window.showTextDocument(stderrUri, {
        viewColumn: vscode.ViewColumn.Two,
        preserveFocus: true,
        preview: false,
      });
      refreshOutput();
    })
  );
}
