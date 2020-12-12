import * as vscode from "vscode";
import * as api from "../api";
import { WebviewProvider, wrapHtml } from "../webviewProvider";
import { OutputPaneProvider } from "../paneManager";

// TODO: Tree view:
// - Collapsing nodes
// - Only draw lines that are on screen
// - (If needed) Only redraw lines that may have been affected by sticky positioning

export class TreeOutputPaneProvider implements OutputPaneProvider<api.Tree> {
  _webviewProvider: WebviewProvider = new WebviewProvider();

  register(): vscode.Disposable {
    return vscode.Disposable.from();
  }

  setPaneContent(name: string, content: api.Tree): void {
    const html = this._render(name, content);
    this._webviewProvider.setHtml(name, html);
  }

  openPane(name: string): void {
    this._webviewProvider.openWebview(name);
  }

  _render(name: string, content: api.Tree): string {
    const head = `
      <style>
        .lines-container {
          position: absolute;
          top: 0;
          left: 0;
        }
        .root {
          position: absolute;
          top: 0;
          left: 0;
          padding-left: 20px;
        }
        .tree {
          display: flex;
        }
        .node {
          margin-right: 50px;
          position: sticky;
          top: 20px;
        }
        .children {
          align-self: flex-start;
        }
      </style>
    `;
    const script = `
      <script>
        function drawTreeLines() {
          const linesContainer = document.body.getElementsByClassName("lines-container")[0];
          linesContainer.innerHTML = "";

          const tree = document.body.getElementsByClassName("root")[0];
          const treeRect = tree.getBoundingClientRect();
          const scrollX = -treeRect.left;
          const scrollY = -treeRect.top;
          linesContainer.style.width = treeRect.width;
          linesContainer.style.height = treeRect.height;

          const lineColor = getComputedStyle(document.body).getPropertyValue(
            "--vscode-editor-foreground"
          );

          function drawLine(x1, y1, x2, y2) {
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("stroke-width", "1px");
            line.setAttribute("stroke", lineColor);
            line.setAttribute("x1", x1 + scrollX);
            line.setAttribute("y1", y1 + scrollY);
            line.setAttribute("x2", x2 + scrollX);
            line.setAttribute("y2", y2 + scrollY);
            linesContainer.appendChild(line);
          }

          for (const tree of document.body.getElementsByClassName("tree")) {
            const node = tree.getElementsByClassName("node")[0];
            const nodeRect = node.getBoundingClientRect();
            const nodeX = nodeRect.right;
            const nodeY = (nodeRect.top + nodeRect.bottom) / 2;

            const childrenDiv = tree.getElementsByClassName("children")[0];
            for (const childTree of childrenDiv.children) {
              const child = childTree.getElementsByClassName("node")[0];
              const childRect = child.getBoundingClientRect();
              const childX = childRect.left;
              const childY = (childRect.top + childRect.bottom) / 2;

              drawLine(nodeX, nodeY, childX, childY);
            }
          }
        }

        window.addEventListener("load", drawTreeLines);
        window.addEventListener("resize", drawTreeLines);
        window.addEventListener("scroll", drawTreeLines);
      </script>
    `;
    const body = `
      <svg class="lines-container"></svg>
      <div class="root">${this._renderTree(content)}</div>
      ${script}
    `;
    return wrapHtml(head, body);
  }

  _renderTree(tree: api.Tree): string {
    const node = `<div class="node-container"><div class="node">${tree.label}</div></div>`;

    const childrenInner = tree.children
      .map((child) => this._renderTree(child))
      .join("");
    const children = `<div class="children">${childrenInner}</div>`;

    return `<div class="tree">${node}${children}</div>`;
  }
}
