import * as vscode from "vscode";

export class VirtualTextContentProvider
  implements vscode.TextDocumentContentProvider {
  _onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  onDidChange = this._onDidChangeEmitter.event;

  _files: Map<string, string> = new Map();

  setFileContent(uri: vscode.Uri, content: string) {
    this._files.set(uri.path, content);
    this._onDidChangeEmitter.fire(uri);
  }

  provideTextDocumentContent(
    uri: vscode.Uri,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<string> {
    return this._files.get(uri.path) || "";
  }
}
