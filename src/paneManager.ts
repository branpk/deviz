import * as vscode from "vscode";
import { InputTextProvider } from "./inputTextProvider";
import { TextOutputPaneProvider } from "./textOutputPaneProvider";
import { TreeOutputPaneProvider } from "./treeOutputPaneProvider";
import * as api from "./api";

const STDIN_URI = vscode.Uri.parse("deviz-input-text:/stdin");

export class PaneManager {
  _input = new InputTextProvider();
  _textOutput = new TextOutputPaneProvider();
  _treeOutput = new TreeOutputPaneProvider();

  _nameToType: Map<string, "input" | "text" | "tree"> = new Map();

  constructor() {
    this._nameToType.set("stdin", "input");
  }

  register(): vscode.Disposable {
    return vscode.Disposable.from(
      vscode.workspace.registerFileSystemProvider(
        "deviz-input-text",
        this._input
      ),
      this._textOutput.register(),
      this._treeOutput.register()
    );
  }

  getInputText(): string {
    return this._input.getFileContent(STDIN_URI);
  }

  async openPane(name: string): Promise<void> {
    const type = this._nameToType.get(name);
    switch (type) {
      case "input":
        await vscode.window.showTextDocument(STDIN_URI, {
          viewColumn: vscode.ViewColumn.Two,
          preserveFocus: true,
          preview: false,
        });
        break;
      case "text":
        await this._textOutput.openPane(name);
        break;
      case "tree":
        await this._treeOutput.openPane(name);
        break;
      case undefined:
        throw new Error(`pane name not defined: ${name}`);
      default:
        const _checkExhaustive: never = type;
        break;
    }
  }

  setPaneContent(name: string, content: api.PaneContent): void {
    this._nameToType.set(name, content.type);
    switch (content.type) {
      case "text":
        this._textOutput.setPaneContent(name, content.data);
        break;
      case "tree":
        this._treeOutput.setPaneContent(name, content.data);
        break;
    }
  }
}
