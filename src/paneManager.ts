import * as vscode from "vscode";
import { TextOutputPaneProvider } from "./paneProviders/textOutputPaneProvider";
import { TextTreeOutputPaneProvider } from "./paneProviders/textTreeOutputPaneProvider";
import * as api from "./api";
import { TextInputPaneProvider } from "./paneProviders/textInputPaneProvider";
import { PaneTreeProvider } from "./paneTree";

export class PaneManager {
  _paneTree = new PaneTreeProvider();

  _textInput = new TextInputPaneProvider();
  _textOutput = new TextOutputPaneProvider();
  _textTreeOutput = new TextTreeOutputPaneProvider();

  _nameToType: Map<string, "input" | "text" | "textTree"> = new Map();

  constructor() {
    this._nameToType.set("stdin", "input");
  }

  register(): vscode.Disposable {
    return vscode.Disposable.from(
      this._paneTree.register(),
      this._textInput.register(),
      this._textOutput.register(),
      this._textTreeOutput.register()
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
      case "textTree":
        return this._textTreeOutput.openPane(name);
      case undefined:
        throw new Error(`pane name not defined: ${name}`);
    }
  }

  updateOutputPanes(
    panes: { name: string; content: string | api.PaneContent }[]
  ) {
    // TODO: Validate pane name (no "/" etc) and ensure unique
    for (const { name, content: contentOrStr } of panes) {
      const content = toPaneContent(contentOrStr);

      this._nameToType.set(name, content.type);
      switch (content.type) {
        case "text":
          this._textOutput.setPaneContent(name, content.data);
          break;
        case "textTree":
          this._textTreeOutput.setPaneContent(name, content.data);
          break;
      }
    }

    this._paneTree.setPanes(["stdin", ...panes.map(({ name }) => name)]);
  }
}

function toPaneContent(content: string | api.PaneContent): api.PaneContent {
  if (typeof content === "string") {
    return {
      type: "text",
      data: { text: content, hovers: [] },
    };
  } else {
    return content;
  }
}
