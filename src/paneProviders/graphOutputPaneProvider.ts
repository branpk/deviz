import * as vscode from "vscode";
import { OutputPaneProvider } from "../paneManager";
import * as api from "../api";
import { WebviewProvider, wrapHtml } from "../webviewProvider";

export class GraphOutputPaneProvider implements OutputPaneProvider<api.Graph> {
  _webviewProvider: WebviewProvider = new WebviewProvider();

  register(): vscode.Disposable {
    return vscode.Disposable.from();
  }

  setPaneContent(name: string, content: api.Graph): void {
    const html = this._render(name, content);
    this._webviewProvider.setHtml(name, html);
  }

  openPane(name: string): void {
    this._webviewProvider.openWebview(name);
  }

  _render(name: string, content: api.Graph): string {
    return wrapHtml("", "not implemented");
  }
}
