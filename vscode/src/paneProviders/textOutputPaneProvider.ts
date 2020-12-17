import * as vscode from "vscode";
import * as api from "../api";
import { OutputPaneProvider } from "../paneManager";
import { fixTextHighlight, TextContentProvider } from "../textContentProvider";

const SCHEME = "deviz-output-text";

export class TextOutputPaneProvider
  implements OutputPaneProvider<api.Text>, vscode.HoverProvider {
  _contentProvider = new TextContentProvider();
  _hovers: Map<string, api.Hover[]> = new Map();

  _nameToUri(name: string): vscode.Uri {
    return vscode.Uri.parse(`${SCHEME}:/${name}`);
  }

  register(): vscode.Disposable {
    return vscode.Disposable.from(
      vscode.workspace.registerTextDocumentContentProvider(
        SCHEME,
        this._contentProvider
      ),
      fixTextHighlight(SCHEME),
      vscode.languages.registerHoverProvider({ scheme: SCHEME }, this)
    );
  }

  setPaneContent(name: string, content: api.Text): void {
    this._contentProvider.setFileContent(this._nameToUri(name), content.text);
    this._hovers.set(name, content.hovers);
  }

  async openPane(name: string): Promise<void> {
    await vscode.window.showTextDocument(this._nameToUri(name), {
      viewColumn: vscode.ViewColumn.Two,
      preserveFocus: true,
      preview: false,
    });
  }

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    const paneName = document.uri.path.slice(1);
    const allHovers = this._hovers.get(paneName) || [];
    const hovers = allHovers
      .filter((hover) => this.hoverContains(document, hover, position))
      .sort(
        (hover1, hover2) =>
          hover1.end - hover1.start - (hover2.end - hover2.start)
      );

    if (hovers.length > 0) {
      return this.createHover(document, hovers[0]);
    } else {
      return null;
    }
  }

  hoverContains(
    document: vscode.TextDocument,
    hover: api.Hover,
    position: vscode.Position
  ): boolean {
    const start = offsetToPosition(document.getText(), hover.start);
    const end = offsetToPosition(document.getText(), hover.end);
    return start.isBeforeOrEqual(position) && position.isBefore(end);
  }

  createHover(document: vscode.TextDocument, hover: api.Hover): vscode.Hover {
    const start = offsetToPosition(document.getText(), hover.start);
    const end = offsetToPosition(document.getText(), hover.end);
    return new vscode.Hover(
      { language: "plaintext", value: hover.text },
      new vscode.Range(start, end)
    );
  }
}

// TODO: Proper unicode handling (and specify in api)
// TODO: Maybe instead, api should produce string with hovers inlined
function offsetToPosition(source: string, offset: number): vscode.Position {
  let line = 0;
  let column = 0;
  for (const c of source.slice(0, offset)) {
    if (c === "\n") {
      line += 1;
      column = 0;
    } else if (c !== "\r") {
      column += 1;
    }
  }
  return new vscode.Position(line, column);
}
