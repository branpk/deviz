import * as vscode from "vscode";
import { runCompileCommand, runServerCommand } from "./communication";
import { PaneManager } from "./paneManager";
import { SCHEME as TEXT_INPUT_SCHEME } from "./paneProviders/textInputPaneProvider";
import { Mutex } from "async-mutex";

// TODO: Improve ViewColumn behavior and extract shared open options
// TODO: Save layout across workspace reopen?

class ProcessLock {
  mutex = new Mutex();
  cancelRunningProcess: null | (() => Promise<void>) = null;

  async killExistingAndRun<T>(
    spawnProcess: () => { promise: Promise<T>; cancel: () => Promise<void> }
  ): Promise<T> {
    const release = await this.mutex.acquire();
    try {
      if (this.cancelRunningProcess !== null) {
        await this.cancelRunningProcess();
        this.cancelRunningProcess = null;
      }

      const { promise, cancel } = spawnProcess();

      let finished = false;
      this.cancelRunningProcess = async () => {
        if (!finished) {
          await cancel();
        }
      };
      return promise.finally(() => (finished = true));
    } finally {
      release();
    }
  }

  async killRemaining() {
    if (this.cancelRunningProcess !== null) {
      await this.cancelRunningProcess();
      this.cancelRunningProcess = null;
    }
  }
}

let extensionPath: string;

export function getExtensionPath(): string {
  return extensionPath;
}

export function activate(context: vscode.ExtensionContext) {
  extensionPath = context.extensionPath;

  const paneManager = new PaneManager(
    context.workspaceState.get("stdin") || ""
  );
  context.subscriptions.push(paneManager.register());

  const getConfig = () => vscode.workspace.getConfiguration("deviz");

  const getWorkingDir = () => {
    if (!vscode.workspace.workspaceFolders) {
      vscode.window.showErrorMessage("deviz: Must have folder open");
      return null;
    }
    const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    return workspacePath;
  };

  const lock = new ProcessLock();
  context.subscriptions.push(
    new vscode.Disposable(() => {
      lock.killRemaining();
    })
  );

  const run = async () => {
    const runCommand: string = getConfig().runCommand.trim();
    if (runCommand === "") {
      // TODO: Link to setting
      paneManager.setInfoText(
        "To get started, edit the deviz: Run Command workspace setting."
      );
      return;
    }

    const workingDir = getWorkingDir();
    if (workingDir === null) {
      return;
    }

    const stdin = paneManager.stdinText();

    paneManager.setInfoText(`Running ${runCommand}...`);
    const {
      exitCode,
      stdout,
      stderr,
      validationErrors,
      panes: userPanes,
    } = await lock.killExistingAndRun(() =>
      runServerCommand(workingDir, { command: runCommand, env: {} }, stdin)
    );

    if (exitCode !== 0) {
      paneManager.setInfoText(
        `${runCommand} exited with status ${exitCode}:\n${stderr}\nstdout:\n${stdout}`
      );
    } else if (validationErrors.length > 0) {
      paneManager.setInfoText(validationErrors.join("\n"));
    } else {
      paneManager.setInfoText(`${runCommand} exited with status ${exitCode}`);
    }

    paneManager.updateOutputPanes([
      { name: "stdout", content: stdout },
      { name: "stderr", content: stderr },
      ...userPanes,
    ]);
  };

  const compileAndRun = async () => {
    const compileCommand: string = getConfig().compileCommand.trim();
    if (compileCommand !== "") {
      const workingDir = getWorkingDir();
      if (workingDir === null) {
        return;
      }

      paneManager.setInfoText(`Compiling with ${compileCommand}...`);
      const { exitCode, stdout, stderr } = await lock.killExistingAndRun(() =>
        runCompileCommand(workingDir, {
          command: compileCommand,
          env: {},
        })
      );

      if (exitCode === 0) {
        paneManager.setInfoText(
          `${compileCommand} exited with status ${exitCode}`
        );
      } else {
        paneManager.setInfoText(
          `${compileCommand} exited with status ${exitCode}:\n${stderr}\nstdout:\n${stdout}`
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
