import * as vscode from "vscode";

export type Html = string | ((webview: vscode.Webview) => string);

export class WebviewProvider {
  _nameToHtml: Map<string, Html> = new Map();
  _htmlChangeEmitters: Map<string, vscode.EventEmitter<Html>> = new Map();

  _getHtmlChangeEmitter(name: string): vscode.EventEmitter<Html> {
    let emitter = this._htmlChangeEmitters.get(name);
    if (!emitter) {
      emitter = new vscode.EventEmitter();
      this._htmlChangeEmitters.set(name, emitter);
    }
    return emitter;
  }

  setHtml(name: string, html: Html): void {
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
      this._render(panel.webview, html);
    }

    const disposable = this._getHtmlChangeEmitter(name).event((html) => {
      this._render(panel.webview, html);
    });
    panel.onDidDispose(disposable.dispose);
  }

  _render(webview: vscode.Webview, html: Html) {
    if (typeof html === "string") {
      webview.html = html;
    } else {
      webview.html = html(webview);
    }
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
