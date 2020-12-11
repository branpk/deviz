import * as vscode from "vscode";
import { TextOutputPaneProvider } from "./textOutputPaneProvider";
import { TreeOutputPaneProvider } from "./treeOutputPaneProvider";
import * as api from "./api";
import { TextInputPaneProvider } from "./textInputPaneProvider";

export class PaneManager {
  _textInput = new TextInputPaneProvider();
  _textOutput = new TextOutputPaneProvider();
  _treeOutput = new TreeOutputPaneProvider();

  _nameToType: Map<string, "input" | "text" | "tree"> = new Map();

  constructor() {
    this._nameToType.set("stdin", "input");
  }

  register(): vscode.Disposable {
    return vscode.Disposable.from(
      this._textInput.register(),
      this._textOutput.register(),
      this._treeOutput.register()
    );
  }

  stdinText(): string {
    return this._textInput.getText("stdin");
  }

  openPane(name: string): Thenable<void> {
    const type = this._nameToType.get(name);
    switch (type) {
      case "input":
        return this._textInput.openPane(name);
      case "text":
        return this._textOutput.openPane(name);
      case "tree":
        return this._treeOutput.openPane(name);
      case undefined:
        throw new Error(`pane name not defined: ${name}`);
    }
  }

  setOutputPaneContent(name: string, content: api.PaneContent): void {
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
