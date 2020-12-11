import * as vscode from "vscode";

type PaneId = {
  uri: vscode.Uri;
  index: number;
};

export class PaneTreeProvider implements vscode.TreeDataProvider<PaneId> {
  _onDidChangeTreeDataEmitter = new vscode.EventEmitter<PaneId | null>();
  onDidChangeTreeData = this._onDidChangeTreeDataEmitter.event;

  _panes: PaneId[] = [];

  setPanes(uris: vscode.Uri[]) {
    this._panes = uris.map((uri, index) => ({ uri, index }));
    this._onDidChangeTreeDataEmitter.fire(null);
  }

  getTreeItem({ uri, index }: PaneId): vscode.TreeItem {
    const name = uri.path.slice(1);
    return {
      label: name,
      id: `${index}-${uri}`,
      command: {
        title: "Open pane",
        command: "deviz.openPane",
        arguments: [uri],
      },
    };
  }

  getChildren(element?: PaneId): vscode.ProviderResult<PaneId[]> {
    if (element) {
      return [];
    } else {
      return this._panes;
    }
  }
}
