import * as vscode from "vscode";

export class PaneTreeProvider implements vscode.TreeDataProvider<string> {
  _onDidChangeTreeDataEmitter = new vscode.EventEmitter<string | null>();
  onDidChangeTreeData = this._onDidChangeTreeDataEmitter.event;

  _panes: string[] = [];

  register(): vscode.Disposable {
    return vscode.window.registerTreeDataProvider("devizPanes", this);
  }

  setPanes(panes: string[]) {
    this._panes = panes;
    this._onDidChangeTreeDataEmitter.fire(null);
  }

  getTreeItem(name: string): vscode.TreeItem {
    return {
      label: name,
      id: name,
      command: {
        title: "Open pane",
        command: "deviz.openPane",
        arguments: [name],
      },
    };
  }

  getChildren(element?: string): vscode.ProviderResult<string[]> {
    if (element) {
      return [];
    } else {
      return this._panes;
    }
  }
}
