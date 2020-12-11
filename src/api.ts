export interface Pane {
  name: string;
  content: PaneContent;
}

export type PaneContent =
  | { type: "text"; data: Text }
  | { type: "tree"; data: Tree };

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
