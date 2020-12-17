use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct CommandJson {
    pub index: usize,
    pub pane: PaneJson,
}

#[derive(Debug, Clone, Serialize)]
pub struct PaneJson {
    pub name: String,
    pub content: PaneContentJson,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", content = "data")]
pub enum PaneContentJson {
    #[serde(rename = "text")]
    Text(TextJson),
    #[serde(rename = "tree")]
    Tree(Vec<TreeJson>),
    #[serde(rename = "textTree")]
    TextTree(Vec<TreeJson>),
    #[serde(rename = "graph")]
    Graph(Vec<GraphJson>),
}

#[derive(Debug, Clone, Serialize)]
pub struct TextJson {
    pub text: String,
    pub hovers: Vec<HoverJson>,
}

#[derive(Debug, Clone, Serialize)]
pub struct HoverJson {
    pub start: usize,
    pub end: usize,
    pub text: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TreeJson {
    pub label: Option<String>,
    pub children: Vec<TreeJson>,
}

#[derive(Debug, Clone, Serialize)]
pub struct GraphJson {
    pub nodes: Vec<GraphNodeJson>,
    pub edges: Vec<GraphEdgeJson>,
}

#[derive(Debug, Clone, Serialize)]
pub struct GraphNodeJson {
    pub id: String,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct GraphEdgeJson {
    #[serde(rename = "fromId")]
    pub from_id: String,
    #[serde(rename = "toId")]
    pub to_id: String,
    pub label: Option<String>,
}
