import * as vscode from "vscode";
import { TextOutputPaneProvider } from "./paneProviders/textOutputPaneProvider";
import { TextTreeOutputPaneProvider } from "./paneProviders/textTreeOutputPaneProvider";
import * as api from "./api";
import { TextInputPaneProvider } from "./paneProviders/textInputPaneProvider";
import { PaneTreeProvider } from "./paneTree";
import { TreeOutputPaneProvider } from "./paneProviders/treeOutputPaneProvider";
import { GraphOutputPaneProvider } from "./paneProviders/graphOutputPaneProvider";

export interface OutputPaneProvider<T> {
  register(): vscode.Disposable;
  setPaneContent(name: string, content: T): void;
  openPane(name: string): void | Thenable<void>;
}

export class PaneManager {
  _paneTree = new PaneTreeProvider();

  _textInput = new TextInputPaneProvider();
  _textOutput = new TextOutputPaneProvider();
  _treeOutput = new TreeOutputPaneProvider();
  _textTreeOutput = new TextTreeOutputPaneProvider();
  _graphOutput = new GraphOutputPaneProvider();

  _nameToType: Map<
    string,
    "input" | "text" | "tree" | "textTree" | "graph"
  > = new Map();

  constructor(stdin: string) {
    this._nameToType.set("info", "text");

    this._nameToType.set("stdin", "input");
    this._textInput.overwriteText("stdin", stdin);

    this._paneTree.setPanes(["info", "stdin"]);
  }

  register(): vscode.Disposable {
    return vscode.Disposable.from(
      this._paneTree.register(),
      this._textInput.register(),
      this._textOutput.register(),
      this._treeOutput.register(),
      this._textTreeOutput.register(),
      this._graphOutput.register()
    );
  }

  setInfoText(text: string) {
    this._textOutput.setPaneContent("info", { text, hovers: [] });
  }

  stdinText(): string {
    return this._textInput.getText("stdin");
  }

  openPane(name: string): void | Thenable<void> {
    const type = this._nameToType.get(name);
    switch (type) {
      case "input":
        return this._textInput.openPane(name);
      case "text":
        return this._textOutput.openPane(name);
      case "tree":
        return this._treeOutput.openPane(name);
      case "textTree":
        return this._textTreeOutput.openPane(name);
      case "graph":
        return this._graphOutput.openPane(name);
      case undefined:
        throw new Error(`pane name not defined: ${name}`);
      default:
        const _checkExhaustive: never = type;
        break;
    }
  }

  setOutputPaneContent(name: string, contentOrStr: string | api.PaneContent) {
    const content = toPaneContent(contentOrStr);

    this._nameToType.set(name, content.type);
    switch (content.type) {
      case "text":
        this._textOutput.setPaneContent(name, content.data);
        break;
      case "tree":
        this._treeOutput.setPaneContent(name, content.data);
        break;
      case "textTree":
        this._textTreeOutput.setPaneContent(name, content.data);
        break;
      case "graph":
        this._graphOutput.setPaneContent(name, content.data);
        break;
      default:
        const _checkExhaustive: never = content;
        break;
    }
  }

  updateOutputPanes(
    panes: { name: string; content: string | api.PaneContent }[]
  ) {
    // TODO: Show message if pane changes type but is still open
    for (const { name, content } of panes) {
      this.setOutputPaneContent(name, content);
    }
    this._paneTree.setPanes([
      "info",
      "stdin",
      ...panes.map(({ name }) => name),
    ]);
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
