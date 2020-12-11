import * as vscode from "vscode";
import { VirtualFileSystem } from "../virtualFileSystem";

export const SCHEME = "deviz-input-text";

export class TextInputPaneProvider {
  _nameToText: Map<string, string> = new Map();

  _nameToUri(name: string): vscode.Uri {
    return vscode.Uri.parse(`${SCHEME}:/${name}`);
  }

  register(): vscode.Disposable {
    return vscode.Disposable.from(
      vscode.workspace.registerFileSystemProvider(
        SCHEME,
        new VirtualFileSystem()
      ),
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document.uri.scheme === SCHEME) {
          this._nameToText.set(
            event.document.uri.path.slice(1),
            event.document.getText()
          );
        }
      })
    );
  }

  getText(name: string): string {
    return this._nameToText.get(name) || "";
  }

  async openPane(name: string): Promise<void> {
    await vscode.window.showTextDocument(this._nameToUri(name), {
      viewColumn: vscode.ViewColumn.Two,
      preserveFocus: true,
      preview: false,
    });
  }
}
