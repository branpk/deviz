use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct Command {
    pub index: usize,
    pub pane: Pane,
}

#[derive(Debug, Clone, Serialize)]
pub struct Pane {
    pub name: String,
    pub content: PaneContent,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", content = "data")]
pub enum PaneContent {
    #[serde(rename = "text")]
    Text(Text),
    #[serde(rename = "tree")]
    Tree(Vec<Tree>),
    #[serde(rename = "textTree")]
    TextTree(Vec<Tree>),
    #[serde(rename = "graph")]
    Graph(Vec<Graph>),
}

#[derive(Debug, Clone, Serialize)]
pub struct Text {
    pub text: String,
    pub hovers: Vec<Hover>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Hover {
    pub start: usize,
    pub end: usize,
    pub text: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct Tree {
    pub label: Option<String>,
    pub children: Vec<Tree>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Graph {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

#[derive(Debug, Clone, Serialize)]
pub struct GraphNode {
    pub id: String,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct GraphEdge {
    #[serde(rename = "fromId")]
    pub from_id: String,
    #[serde(rename = "toId")]
    pub to_id: String,
    pub label: Option<String>,
}
