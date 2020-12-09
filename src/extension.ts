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
    if (event.document.uri.scheme === "deviz-input-text") {
      const inputText = event.document.getText();

      const outputText = inputText + inputText;

      virtualTextContentProvider.setFileContent(
        vscode.Uri.parse("deviz-output-text:/output"),
        outputText
      );
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
          preview: false,
        }
      );
    })
  );
}
