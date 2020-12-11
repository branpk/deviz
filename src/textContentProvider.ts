import * as vscode from "vscode";

export class TextContentProvider implements vscode.TextDocumentContentProvider {
  _onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  onDidChange = this._onDidChangeEmitter.event;

  _files: Map<string, string> = new Map();

  setFileContent(uri: vscode.Uri, content: string) {
    this._files.set(uri.path, content);
    this._onDidChangeEmitter.fire(uri);
  }

  provideTextDocumentContent(
    uri: vscode.Uri,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<string> {
    return this._files.get(uri.path) || "";
  }
}

export function fixTextHighlight(scheme: string): vscode.Disposable {
  return vscode.workspace.onDidChangeTextDocument(async (event) => {
    if (event.document.uri.scheme === scheme) {
      for (const editor of vscode.window.visibleTextEditors) {
        if (editor.document === event.document) {
          editor.selection = new vscode.Selection(0, 0, 0, 0);
        }
      }
    }
  });
}
