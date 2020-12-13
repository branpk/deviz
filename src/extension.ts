import { AssertionError } from "assert";
import * as vscode from "vscode";
import { runCompileCommand, runServerCommand } from "./communication";
import { CommandInfo, DevizConfig } from "./config";
import { PaneManager } from "./paneManager";
import { SCHEME as TEXT_INPUT_SCHEME } from "./paneProviders/textInputPaneProvider";

// TODO: Improve ViewColumn behavior and extract shared open options
// TODO: Save stdin across workspace reopen
// TODO: Save layout across workspace reopen?

let extensionPath: string | null = null;

export function getExtensionPath(): string {
  if (extensionPath === null) {
    throw new AssertionError();
  } else {
    return extensionPath;
  }
}

export function activate(context: vscode.ExtensionContext) {
  extensionPath = context.extensionPath;

  const config: DevizConfig = {
    mode: {
      type: "compileOnSourceEdit",
      compileCommand: {
        command: "cargo build",
        env: {},
      },
      runCommand: {
        command: "target\\debug\\test-rs.exe",
        env: {},
      },
    },
  };

  const paneManager = new PaneManager();
  context.subscriptions.push(paneManager.register());

  const getWorkingDir = () => {
    if (!vscode.workspace.workspaceFolders) {
      vscode.window.showErrorMessage("Deviz: Must have folder open");
      return null;
    }
    const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    return workspacePath;
  };

  const run = async (runCommand: CommandInfo) => {
    const workingDir = getWorkingDir();
    if (workingDir === null) {
      return;
    }

    const stdin = paneManager.stdinText();

    // TODO: Do something with exitCode
    const { stdout, stderr, panes: userPanes } = await runServerCommand(
      workingDir,
      runCommand,
      stdin
    );

    paneManager.updateOutputPanes([
      { name: "stdout", content: stdout },
      { name: "stderr", content: stderr },
      ...userPanes,
    ]);
  };

  const compile = async (compileCommand: CommandInfo) => {
    const workingDir = getWorkingDir();
    if (workingDir === null) {
      return;
    }

    const { exitCode, stdout, stderr } = await runCompileCommand(
      workingDir,
      compileCommand
    );

    if (exitCode !== 0) {
      paneManager.setOutputPaneContent(
        "stderr",
        `${compileCommand.command} exited with status ${exitCode}
        stderr:
        ${stderr}
        stdout:
        ${stdout}`
      );
    }
  };

  const compileAndRun = async () => {
    switch (config.mode.type) {
      case "runOnSourceEdit":
        await run(config.mode.runCommand);
        break;
      case "compileOnSourceEdit":
        await compile(config.mode.compileCommand);
        await run(config.mode.runCommand);
        break;
      case "runOnFileChange":
        throw Error("not implemented");
      default:
        const _checkExhaustive: never = config.mode;
        break;
    }
  };

  vscode.workspace.onDidChangeTextDocument(async (event) => {
    if (event.document.uri.scheme === TEXT_INPUT_SCHEME) {
      if (event.contentChanges.length > 0) {
        switch (config.mode.type) {
          case "runOnSourceEdit":
            await run(config.mode.runCommand);
            break;
          case "compileOnSourceEdit":
            await run(config.mode.runCommand);
            break;
          case "runOnFileChange":
            throw Error("not implemented");
          default:
            const _checkExhaustive: never = config.mode;
            break;
        }
      }
    }
  });
  vscode.workspace.onDidSaveTextDocument(async (event) => {
    if (!event.uri.scheme.startsWith("deviz-")) {
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
