import { spawn } from "child_process";
import { TextDecoder } from "util";
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
  const defaultViews = [stdinUri, stdoutUri, stderrUri];

  const viewTreeProvider = new ViewTreeProvider();
  viewTreeProvider.setViews(defaultViews);
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

  const refresh = async () => {
    // TODO: Probably show this on startSession and don't show default views in tree
    if (!vscode.workspace.workspaceFolders) {
      vscode.window.showErrorMessage("Deviz: Must have folder open");
      return;
    }
    const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;

    const inputDocument = vscode.workspace.textDocuments.find(
      (document) => document.uri.scheme === "deviz-input-text"
    );
    // TODO: Save to virtualFileSystem when stdin is edited so that ternery isn't necessary
    const inputText = inputDocument
      ? inputDocument.getText()
      : virtualFileSystem.getFileContent(stdinUri);

    const { stdout, stderr, commands } = await runServerCommand(
      workspacePath,
      config.mode.runCommand,
      inputText
    );

    const views = [stdinUri, stdoutUri, stderrUri];
    virtualTextContentProvider.setFileContent(stdoutUri, stdout);
    virtualTextContentProvider.setFileContent(stderrUri, stderr);

    for (const command of commands) {
      for (const tab of command.tabs) {
        // TODO: Tab name should be escaped for uri, but used as is for label
        const uri = vscode.Uri.parse(`deviz-output-text:/${tab.name}`);
        const content = JSON.stringify(tab.content);
        virtualTextContentProvider.setFileContent(uri, content);
        views.push(uri);
      }
    }

    viewTreeProvider.setViews(views);
  };

  vscode.workspace.onDidChangeTextDocument(async (event) => {
    switch (event.document.uri.scheme) {
      case "deviz-input-text":
        await refresh();
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
  vscode.workspace.onDidSaveTextDocument(async (event) => {
    if (!event.uri.scheme.startsWith("deviz-")) {
      await refresh();
    }
  });

  context.subscriptions.push(
    vscode.commands.registerCommand("deviz.startSession", async () => {
      await refresh();
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
        await refresh();
      }
    )
  );
}
