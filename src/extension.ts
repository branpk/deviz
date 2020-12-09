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

  vscode.workspace.onDidChangeTextDocument((event) => {
    switch (event.document.uri.scheme) {
      case "deviz-input-text":
        const inputText = event.document.getText();

        const outputText = inputText + inputText;

        virtualTextContentProvider.setFileContent(
          vscode.Uri.parse("deviz-output-text:/output"),
          outputText
        );
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

  context.subscriptions.push(
    vscode.commands.registerCommand("deviz.show", async () => {
      await vscode.window.showTextDocument(
        vscode.Uri.parse("deviz-input-text:/input"),
        {
          viewColumn: vscode.ViewColumn.Two,
          preview: false,
        }
      );
      await vscode.window.showTextDocument(
        vscode.Uri.parse("deviz-output-text:/output"),
        {
          viewColumn: vscode.ViewColumn.Two,
          preserveFocus: true,
          preview: false,
        }
      );
    })
  );
}
