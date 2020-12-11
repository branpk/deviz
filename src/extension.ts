import * as vscode from "vscode";
import { runServerCommand } from "./communication";
import { DevizConfig } from "./config";
import { PaneManager } from "./paneManager";
import { SCHEME as TEXT_INPUT_SCHEME } from "./paneProviders/textInputPaneProvider";

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

  const paneManager = new PaneManager();
  context.subscriptions.push(paneManager.register());

  const refresh = async () => {
    if (!vscode.workspace.workspaceFolders) {
      vscode.window.showErrorMessage("Deviz: Must have folder open");
      return;
    }
    const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;

    const stdin = paneManager.stdinText();

    const { stdout, stderr, panes: userPanes } = await runServerCommand(
      workspacePath,
      config.mode.runCommand,
      stdin
    );

    paneManager.updateOutputPanes([
      { name: "stdout", content: stdout },
      { name: "stderr", content: stderr },
      ...userPanes,
    ]);
  };

  vscode.workspace.onDidChangeTextDocument(async (event) => {
    if (event.document.uri.scheme === TEXT_INPUT_SCHEME) {
      if (event.contentChanges.length > 0) {
        await refresh();
      }
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
    }),
    vscode.commands.registerCommand("deviz.openPane", async (name: string) => {
      await paneManager.openPane(name);
    })
  );
}
