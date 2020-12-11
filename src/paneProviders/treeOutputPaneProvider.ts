import * as vscode from "vscode";
import * as api from "../api";
import { fixTextHighlight, TextContentProvider } from "../textContentProvider";

const SCHEME = "deviz-output-tree";

export class TreeOutputPaneProvider {
  _contentProvider = new TextContentProvider();

  _nameToUri(name: string): vscode.Uri {
    return vscode.Uri.parse(`${SCHEME}:/${name}`);
  }

  register(): vscode.Disposable {
    return vscode.Disposable.from(
      vscode.workspace.registerTextDocumentContentProvider(
        SCHEME,
        this._contentProvider
      ),
      fixTextHighlight(SCHEME)
    );
  }

  setPaneContent(name: string, content: api.Tree): void {
    this._contentProvider.setFileContent(
      this._nameToUri(name),
      formatTree(content)
    );
  }

  async openPane(name: string): Promise<void> {
    await vscode.window.showTextDocument(this._nameToUri(name), {
      viewColumn: vscode.ViewColumn.Two,
      preserveFocus: true,
      preview: false,
    });
  }
}

const formatTree = (tree: api.Tree, indent: number = 0): string => {
  const indentStr = " ".repeat(2 * indent);
  const label = tree.label === null ? "." : tree.label;
  const labelStr = JSON.stringify(label).slice(1, -1);
  const children = tree.children.map((child) => formatTree(child, indent + 1));
  return `${indentStr}${labelStr}\n${children.join("")}`;
};
