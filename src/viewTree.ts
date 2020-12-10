import * as vscode from "vscode";

type ViewElement = {
  uri: vscode.Uri;
  index: number;
};

export class ViewTreeProvider implements vscode.TreeDataProvider<ViewElement> {
  _onDidChangeTreeDataEmitter = new vscode.EventEmitter<ViewElement | null>();
  onDidChangeTreeData = this._onDidChangeTreeDataEmitter.event;

  _views: ViewElement[] = [];

  setViews(viewUris: vscode.Uri[]) {
    this._views = viewUris.map((uri, index) => ({
      uri,
      index,
    }));
    this._onDidChangeTreeDataEmitter.fire(null);
  }

  getTreeItem({ uri, index }: ViewElement): vscode.TreeItem {
    const name = uri.path.slice(1);
    return {
      label: name,
      id: `${index}-${uri}`,
      command: {
        title: "Open view",
        command: "deviz.openView",
        arguments: [uri],
      },
    };
  }

  getChildren(element?: ViewElement): vscode.ProviderResult<ViewElement[]> {
    if (element) {
      return [];
    } else {
      return this._views;
    }
  }
}
