export interface Command {
  tabs: Tab[];
}

export interface Tab {
  name: string;
  content: TabContent;
}

export type TabContent =
  | {
      type: "Text";
      data: Text;
    }
  | {
      type: "Tree";
      data: Tree;
    };

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
