import * as vscode from "vscode";

export class VirtualFileSystem implements vscode.FileSystemProvider {
  _onDidChangeFileEmitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  onDidChangeFile = this._onDidChangeFileEmitter.event;

  _files: Map<string, VirtualFile> = new Map();

  _getFile(uri: vscode.Uri): VirtualFile {
    let file = this._files.get(uri.path);
    if (!file) {
      file = new VirtualFile();
      this._files.set(uri.path, file);
    }
    return file;
  }

  watch(
    uri: vscode.Uri,
    options: { recursive: boolean; excludes: string[] }
  ): vscode.Disposable {
    return vscode.Disposable.from();
  }

  stat(uri: vscode.Uri): vscode.FileStat {
    return this._getFile(uri).stat();
  }

  readDirectory(
    uri: vscode.Uri
  ): [string, vscode.FileType][] | Thenable<[string, vscode.FileType][]> {
    return [];
  }

  createDirectory(uri: vscode.Uri): void | Thenable<void> {}

  readFile(uri: vscode.Uri): Uint8Array {
    return this._getFile(uri).read();
  }

  writeFile(
    uri: vscode.Uri,
    content: Uint8Array,
    options: { create: boolean; overwrite: boolean }
  ): void {
    this._getFile(uri).write(content);
  }

  delete(
    uri: vscode.Uri,
    options: { recursive: boolean }
  ): void | Thenable<void> {}

  rename(
    oldUri: vscode.Uri,
    newUri: vscode.Uri,
    options: { overwrite: boolean }
  ): void | Thenable<void> {}
}

class VirtualFile {
  _ctime: number;
  _mtime: number;
  _content: Uint8Array;

  constructor(content: Uint8Array = new Uint8Array()) {
    this._ctime = Date.now();
    this._mtime = Date.now();
    this._content = content;
  }

  stat(): vscode.FileStat {
    return {
      type: vscode.FileType.File,
      ctime: this._ctime,
      mtime: this._mtime,
      size: this._content.length,
    };
  }

  read(): Uint8Array {
    return this._content;
  }

  write(content: Uint8Array) {
    this._content = content;
    this._mtime = Date.now();
  }
}
