// TODO: Allow undefined for nullable fields?

export interface Pane {
  name: string;
  content: string | PaneContent;
}

// TODO: Allow list of Trees in tree/textTree
export type PaneContent =
  | { type: "text"; data: Text }
  | { type: "tree"; data: Tree }
  | { type: "textTree"; data: Tree }
  | { type: "graph"; data: Graph };

export interface Text {
  text: string;
  hovers: Hover[];
}

export interface Hover {
  start: number;
  end: number;
  text: string;
}

export interface Tree {
  label: string | null;
  children: Tree[];
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNode {
  id: string;
  label: string | null;
}

export interface GraphEdge {
  fromId: string;
  toId: string;
  label: string | null;
}
