import * as vscode from "vscode";
import { OutputPaneProvider } from "../paneManager";
import * as api from "../api";
import { WebviewProvider, wrapHtml } from "../webviewProvider";
import * as path from "path";
import { getExtensionPath } from "../extension";
import escape from "escape-html";

export class GraphOutputPaneProvider implements OutputPaneProvider<api.Graph> {
  _webviewProvider: WebviewProvider = new WebviewProvider();

  register(): vscode.Disposable {
    return vscode.Disposable.from();
  }

  setPaneContent(name: string, content: api.Graph): void {
    const html = (webview: vscode.Webview) =>
      this._render(name, content, webview);
    this._webviewProvider.setHtml(name, html);
  }

  openPane(name: string): void {
    this._webviewProvider.openWebview(name);
  }

  _render(name: string, content: api.Graph, webview: vscode.Webview): string {
    const dagreD3Path = vscode.Uri.file(
      path.join(
        getExtensionPath(),
        "node_modules",
        "dagre-d3",
        "dist",
        "dagre-d3.min.js"
      )
    );
    const dagreD3Src = webview.asWebviewUri(dagreD3Path);

    const d3Path = vscode.Uri.file(
      path.join(getExtensionPath(), "node_modules", "d3", "dist", "d3.min.js")
    );
    const d3Src = webview.asWebviewUri(d3Path);

    const head = `
    <style>
      svg {
        margin-top: 20px;
      }
      .node rect {
        fill: var(--vscode-editor-background);
        stroke: var(--vscode-editor-foreground);
      }
      .node pre, .edgeLabel pre {
        margin: 3px;
        font-family: var(--vscode-editor-font-family);
        font-size: var(--vscode-editor-font-size);
        font-weight: var(--vscode-editor-font-weight);
        color: var(--vscode-editor-foreground);
      }
      .edgePath path {
        stroke: var(--vscode-editor-foreground);
      }
      .edgePath marker {
        fill: var(--vscode-editor-foreground);
      }
    </style>
    <script src=${dagreD3Src}></script>
    <script src=${d3Src}></script>
    <script>
      function renderGraph() {
        const g = new dagreD3.graphlib.Graph({ multigraph: true }).setGraph({});

        const { nodes, edges } = ${JSON.stringify(this._createGraph(content))};
        for (const { id, labelHtml } of nodes) {
          g.setNode(id, {
            labelType: "html",
            label: labelHtml,
            padding: 0,
          });
        }
        for (const { name, fromId, toId, labelHtml } of edges) {
          const label = {
            labelType: "html",
            label: labelHtml,
          };
          g.setEdge(fromId, toId, label, name);
        }

        const render = new dagreD3.render();
        const svg = d3.select("svg");
        svg.append("g");
        render(d3.select("svg g"), g);

        svg.attr("width", g.graph().width + 50);
        svg.attr("height", g.graph().height + 50);
      }

      window.addEventListener("load", renderGraph);
    </script>
    `;

    return wrapHtml(head, `<svg></svg>`);
  }

  _createGraph(
    content: api.Graph
  ): {
    nodes: { id: string; labelHtml: string }[];
    edges: { name: string; fromId: string; toId: string; labelHtml: string }[];
  } {
    // Create missing nodes required by edges
    const nodesById: { [key: string]: api.GraphNode } = {};
    for (const edge of content.edges) {
      for (const id of [edge.fromId, edge.toId]) {
        nodesById[id] = { id, label: null };
      }
    }
    for (const node of content.nodes) {
      nodesById[node.id] = node;
    }

    // Create nodes
    const nodes = Object.values(nodesById).map(({ id, label }) => {
      const labelText = label === null ? id : label;
      const labelHtml = `<pre>${escape(labelText)}</pre>`;
      return {
        id,
        labelHtml,
      };
    });

    // Create edges
    const edges = content.edges.map(({ fromId, toId, label }, i) => {
      const name = `E${i}`;
      const labelHtml = label === null ? "" : `<pre>${escape(label)}</pre>`;
      return { name, fromId, toId, labelHtml };
    });

    return { nodes, edges };
  }
}
