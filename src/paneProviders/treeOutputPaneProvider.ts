import * as vscode from "vscode";
import * as api from "../api";
import { WebviewProvider, wrapHtml } from "../webviewProvider";
import { OutputPaneProvider } from "../paneManager";
import escape from "escape-html";

// TODO: Collapsing nodes
// TODO: Try to maintain horizontal scroll position when content changes
// TODO: (If needed) Only redraw lines that may have been affected by sticky positioning
// TODO: Try curves instead of straight lines

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
          padding-top: 20px;
        }
        .tree {
          display: flex;
        }
        .node-container {
          min-width: 100px;
        }
        .node {
          margin-right: 30px;
          position: sticky;
          top: 20px;
          display: inline-block;
          white-space: nowrap;
          padding: 5px;
        }
        .label {
          margin: 0;
          font-family: var(--vscode-editor-font-family);
          font-size: var(--vscode-editor-font-size);
          font-weight: var(--vscode-editor-font-weight);
          color: var(--vscode-editor-foreground);
        }
        .children {
          align-self: flex-start;
        }
      </style>
    `;
    const script = `
      <script>
        function drawTreeLines() {
          const linesContainer = document.getElementsByClassName("lines-container")[0];
          linesContainer.innerHTML = "";

          const tree = document.getElementsByClassName("root")[0];
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

          function drawSubtreeLines(tree) {
            const treeRect = tree.getBoundingClientRect();
            if (
              treeRect.right < 0 ||
              treeRect.left > window.innerWidth ||
              treeRect.bottom < 0 ||
              treeRect.top > window.innerHeight
            ) {
              return;
            }

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
              drawSubtreeLines(childTree);
            }
          }

          const root = document.getElementsByClassName("tree")[0];
          drawSubtreeLines(root);
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
    const labelText = tree.label === null ? "&middot;" : escape(tree.label);
    const label = `<pre class="label">${labelText}</pre>`;

    const node = `<div class="node-container"><div class="node">${label}</div></div>`;

    const childrenInner = tree.children
      .map((child) => this._renderTree(child))
      .join("");
    const children = `<div class="children">${childrenInner}</div>`;

    return `<div class="tree">${node}${children}</div>`;
  }
}
