import * as t from "io-ts";
import { either } from "fp-ts";

// TODO: Allow undefined for nullable fields?

const tHover = t.type({
  start: t.number,
  end: t.number,
  text: t.string,
});
export type Hover = t.TypeOf<typeof tHover>;

const tText = t.type({
  text: t.string,
  hovers: t.array(tHover),
});
export type Text = t.TypeOf<typeof tText>;

export interface Tree {
  label: string | null;
  children: Tree[];
}
const tTree: t.Type<Tree> = t.recursion("Tree", () =>
  t.type({
    label: t.union([t.string, t.null]),
    children: t.array(tTree),
  })
);

const tGraphNode = t.type({
  id: t.string,
  label: t.union([t.string, t.null]),
});
export type GraphNode = t.TypeOf<typeof tGraphNode>;

const tGraphEdge = t.type({
  fromId: t.string,
  toId: t.string,
  label: t.union([t.string, t.null]),
});
export type GraphEdge = t.TypeOf<typeof tGraphEdge>;

const tGraph = t.type({
  nodes: t.array(tGraphNode),
  edges: t.array(tGraphEdge),
});
export type Graph = t.TypeOf<typeof tGraph>;

// TODO: Text should be an array, shown with 1-2 blank lines in between
// TODO: Item titles
const tPaneContent = t.union([
  t.type({ type: t.literal("text"), data: tText }),
  t.type({ type: t.literal("tree"), data: t.array(tTree) }),
  t.type({ type: t.literal("textTree"), data: t.array(tTree) }),
  t.type({ type: t.literal("graph"), data: t.array(tGraph) }),
]);
export type PaneContent = t.TypeOf<typeof tPaneContent>;

const tPane = t.type({
  name: t.string,
  content: tPaneContent,
});
export type Pane = t.TypeOf<typeof tPane>;

const tCommand = t.type({
  index: t.number,
  pane: tPane,
});
export type Command = t.TypeOf<typeof tCommand>;

export function parseCommands(source: string): Command[] | string {
  let object;
  try {
    object = JSON.parse(source);
  } catch (e) {
    return "input was not valid JSON";
  }
  const result = t.array(tCommand).decode(object);
  if (either.isLeft(result)) {
    // TODO: Better error message
    return "command JSON did not match expected format";
  }
  return result.right;
}
