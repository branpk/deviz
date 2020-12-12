import * as vscode from "vscode";

export class WebviewProvider {
  _nameToHtml: Map<string, string> = new Map();
  _htmlChangeEmitters: Map<string, vscode.EventEmitter<string>> = new Map();

  _getHtmlChangeEmitter(name: string): vscode.EventEmitter<string> {
    let emitter = this._htmlChangeEmitters.get(name);
    if (!emitter) {
      emitter = new vscode.EventEmitter();
      this._htmlChangeEmitters.set(name, emitter);
    }
    return emitter;
  }

  setHtml(name: string, html: string): void {
    this._nameToHtml.set(name, html);
    this._getHtmlChangeEmitter(name).fire(html);
  }

  openWebview(name: string): void {
    const panel = vscode.window.createWebviewPanel(
      "devizWebview",
      name,
      {
        viewColumn: vscode.ViewColumn.Two,
        preserveFocus: true,
      },
      { enableScripts: true }
    );
    const html = this._nameToHtml.get(name);
    if (html !== undefined) {
      panel.webview.html = html;
    }

    const disposable = this._getHtmlChangeEmitter(name).event((html) => {
      panel.webview.html = html;
    });
    panel.onDidDispose(disposable.dispose);
  }
}

export function wrapHtml(head: string, body: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
${head}
</head>
<body>
${body}
</body>
</html>
`;
}
