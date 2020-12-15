import * as vscode from "vscode";
import { runCompileCommand, runServerCommand } from "./communication";
import { PaneManager } from "./paneManager";
import { SCHEME as TEXT_INPUT_SCHEME } from "./paneProviders/textInputPaneProvider";

// TODO: Improve ViewColumn behavior and extract shared open options
// TODO: Save layout across workspace reopen?

let extensionPath: string;

export function getExtensionPath(): string {
  return extensionPath;
}

export function activate(context: vscode.ExtensionContext) {
  extensionPath = context.extensionPath;
  const config = vscode.workspace.getConfiguration("deviz");

  const paneManager = new PaneManager(
    context.workspaceState.get("stdin") || ""
  );
  context.subscriptions.push(paneManager.register());

  const getWorkingDir = () => {
    if (!vscode.workspace.workspaceFolders) {
      vscode.window.showErrorMessage("deviz: Must have folder open");
      return null;
    }
    const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    return workspacePath;
  };

  const run = async () => {
    if (config.runCommand === "") {
      // TODO: Link to config
      vscode.window.showErrorMessage(
        "deviz: Must specify command to run in workspace settings"
      );
      return;
    }

    const workingDir = getWorkingDir();
    if (workingDir === null) {
      return;
    }

    const stdin = paneManager.stdinText();

    // TODO: Do something with exitCode
    const { stdout, stderr, panes: userPanes } = await runServerCommand(
      workingDir,
      { command: config.runCommand, env: {} },
      stdin
    );

    paneManager.updateOutputPanes([
      { name: "stdout", content: stdout },
      { name: "stderr", content: stderr },
      ...userPanes,
    ]);
  };

  const compileAndRun = async () => {
    if (config.compileCommand !== "") {
      const workingDir = getWorkingDir();
      if (workingDir === null) {
        return;
      }

      const { exitCode, stdout, stderr } = await runCompileCommand(workingDir, {
        command: config.compileCommand,
        env: {},
      });

      if (exitCode !== 0) {
        paneManager.setOutputPaneContent(
          "stderr",
          `${config.compileCommand} exited with status ${exitCode}
          stderr:
          ${stderr}
          stdout:
          ${stdout}`
        );
        return;
      }
    }
    await run();
  };

  vscode.workspace.onDidChangeTextDocument(async (event) => {
    if (event.document.uri.scheme === TEXT_INPUT_SCHEME) {
      if (event.contentChanges.length > 0) {
        await run();
      }
    }
  });
  vscode.workspace.onDidSaveTextDocument(async (document) => {
    if (document.uri.scheme === TEXT_INPUT_SCHEME) {
      await context.workspaceState.update("stdin", paneManager.stdinText());
    }
    if (!document.uri.scheme.startsWith("deviz-")) {
      await compileAndRun();
    }
  });

  context.subscriptions.push(
    vscode.commands.registerCommand("deviz.startSession", async () => {
      await compileAndRun();
    }),
    vscode.commands.registerCommand("deviz.openPane", async (name: string) => {
      await paneManager.openPane(name);
    })
  );
}
