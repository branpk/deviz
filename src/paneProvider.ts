import * as vscode from "vscode";

export interface OutputPaneProvider<T> {
  register(): vscode.Disposable;
  openPane(name: string): void | Thenable<void>;
  setPaneContent(name: string, content: T): void;
}
