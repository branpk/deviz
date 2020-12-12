import * as vscode from "vscode";
import * as api from "../api";
import { OutputPaneProvider } from "../paneManager";
import { fixTextHighlight, TextContentProvider } from "../textContentProvider";

const SCHEME = "deviz-output-text";

export class TextOutputPaneProvider implements OutputPaneProvider<api.Text> {
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

  setPaneContent(name: string, content: api.Text): void {
    this._contentProvider.setFileContent(this._nameToUri(name), content.text);
  }

  async openPane(name: string): Promise<void> {
    await vscode.window.showTextDocument(this._nameToUri(name), {
      viewColumn: vscode.ViewColumn.Two,
      preserveFocus: true,
      preview: false,
    });
  }
}
