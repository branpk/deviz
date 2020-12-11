import * as vscode from "vscode";
import { runServerCommand } from "./communication";
import { DevizConfig } from "./config";
import { ViewTreeProvider } from "./viewTree";
import { InputTextProvider } from "./inputTextProvider";
import { OutputTextProvider } from "./outputTextProvider";
import * as api from "./api";

const STDIN_URI = vscode.Uri.parse("deviz-input-text:/stdin");
const STDOUT_URI = vscode.Uri.parse("deviz-output-text:/stdout");
const STDERR_URI = vscode.Uri.parse("deviz-output-text:/stderr");

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

  const viewTreeProvider = new ViewTreeProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("devizViews", viewTreeProvider)
  );

  const inputTextProvider = new InputTextProvider();
  const outputTextProvider = new OutputTextProvider();
  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider(
      "deviz-input-text",
      inputTextProvider
    ),
    vscode.workspace.registerTextDocumentContentProvider(
      "deviz-output-text",
      outputTextProvider
    )
  );

  const refresh = async () => {
    if (!vscode.workspace.workspaceFolders) {
      vscode.window.showErrorMessage("Deviz: Must have folder open");
      return;
    }
    const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;

    const inputText = inputTextProvider.getFileContent(STDIN_URI);

    const { stdout, stderr, commands } = await runServerCommand(
      workspacePath,
      config.mode.runCommand,
      inputText
    );

    const views = [STDIN_URI, STDOUT_URI, STDERR_URI];
    outputTextProvider.setFileContent(STDOUT_URI, stdout);
    outputTextProvider.setFileContent(STDERR_URI, stderr);

    for (const command of commands) {
      for (const view of command.views) {
        // TODO: View name should be escaped for uri, but used as is for label
        const uri = setViewContent(`/${view.name}`, view.content);
        views.push(uri);
      }
    }

    viewTreeProvider.setViews(views);
  };

  const setViewContent = (
    path: string,
    content: api.ViewContent
  ): vscode.Uri => {
    switch (content.type) {
      case "Text": {
        const uri = vscode.Uri.parse(`deviz-output-text:${path}`);
        const text = content.data.text;
        outputTextProvider.setFileContent(uri, text);
        return uri;
      }
      case "Tree": {
        const uri = vscode.Uri.parse(`deviz-output-text:${path}`);
        const text = renderTextTree(content.data);
        outputTextProvider.setFileContent(uri, text);
        return uri;
      }
    }
  };

  const renderTextTree = (tree: api.Tree, indent: number = 0): string => {
    const indentStr = " ".repeat(2 * indent);
    const label = tree.label === null ? "." : tree.label;
    const children = tree.children.map((child) =>
      renderTextTree(child, indent + 1)
    );
    return `${indentStr}${label}\n${children.join("")}`;
  };

  vscode.workspace.onDidChangeTextDocument(async (event) => {
    switch (event.document.uri.scheme) {
      case "deviz-input-text":
        if (event.contentChanges.length > 0) {
          inputTextProvider.setFileContentAfterEdit(
            event.document.uri,
            event.document.getText()
          );
          await refresh();
        }
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
