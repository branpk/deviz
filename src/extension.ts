import { spawn } from "child_process";
import * as vscode from "vscode";
import { runServerCommand } from "./communication";
import { DevizConfig } from "./config";
import { ViewTreeProvider } from "./viewTree";
import { VirtualFileSystemProvider } from "./virtualFileSystem";
import { VirtualTextContentProvider } from "./virtualTextContentProvider";

export function activate(context: vscode.ExtensionContext) {
  const config: DevizConfig = {
    mode: {
      type: "runOnSourceEdit",
      runCommand: {
        command: "cargo run",
        env: {},
      },
    },
  };

  const stdinUri = vscode.Uri.parse("deviz-input-text:/stdin");
  const stdoutUri = vscode.Uri.parse("deviz-output-text:/stdout");
  const stderrUri = vscode.Uri.parse("deviz-output-text:/stderr");

  const viewTreeProvider = new ViewTreeProvider();
  viewTreeProvider.setViews([stdinUri, stdoutUri, stderrUri]);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("devizViews", viewTreeProvider)
  );

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

  // TODO: Should be async
  const refresh = () => {
    const inputDocument = vscode.workspace.textDocuments.find(
      (document) => document.uri.scheme === "deviz-input-text"
    );
    if (!inputDocument) {
      // TODO: Fetch from virtual file system
      return;
    }
    const inputText = inputDocument.getText();

    if (!vscode.workspace.workspaceFolders) {
      vscode.window.showErrorMessage("Deviz: Must have folder open");
      return;
    }
    const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;

    runServerCommand(workspacePath, config.mode.runCommand, inputText).then(
      ({ stdout, stderr, commands }) => {
        virtualTextContentProvider.setFileContent(stdoutUri, stdout);
        virtualTextContentProvider.setFileContent(stderrUri, stderr);
      }
    );
  };

  vscode.workspace.onDidChangeTextDocument((event) => {
    switch (event.document.uri.scheme) {
      case "deviz-input-text":
        refresh();
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
  vscode.workspace.onDidSaveTextDocument((event) => {
    if (!event.uri.scheme.startsWith("deviz-")) {
      refresh();
    }
  });

  context.subscriptions.push(
    vscode.commands.registerCommand("deviz.startSession", async () => {
      refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "deviz.openView",
      async (uri: vscode.Uri) => {
        await vscode.window.showTextDocument(uri, {
          viewColumn: vscode.ViewColumn.Two,
          preserveFocus: true,
          preview: false,
        });
        refresh();
      }
    )
  );
}
