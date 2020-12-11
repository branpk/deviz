import * as vscode from "vscode";
import { runServerCommand } from "./communication";
import { DevizConfig } from "./config";
import { PaneTreeProvider } from "./paneTree";
import * as api from "./api";
import { PaneManager } from "./paneManager";
import { SCHEME as TEXT_INPUT_SCHEME } from "./textInputPaneProvider";

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

  const paneTreeProvider = new PaneTreeProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("devizPanes", paneTreeProvider)
  );

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

    const allPanes = ["stdin", "stdout", "stderr"];
    paneManager.setOutputPaneContent("stdout", textPaneContent(stdout));
    paneManager.setOutputPaneContent("stderr", textPaneContent(stderr));

    for (const pane of userPanes) {
      // TODO: Validate pane name (no "/" etc) and ensure unique
      paneManager.setOutputPaneContent(pane.name, pane.content);
      allPanes.push(pane.name);
    }

    paneTreeProvider.setPanes(allPanes);
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
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("deviz.openPane", async (name: string) => {
      await paneManager.openPane(name);
      await refresh(); // TODO: Is this necessary?
    })
  );
}

function textPaneContent(text: string): api.PaneContent {
  return {
    type: "text",
    data: { text, hovers: [] },
  };
}
