#![warn(rust_2018_idioms)]
#![warn(missing_debug_implementations)]
#![warn(missing_docs)]

use std::{
    env,
    ops::Range,
    sync::atomic::{AtomicUsize, Ordering},
};

mod api;

static COMMAND_INDEX: AtomicUsize = AtomicUsize::new(0);

fn next_command_index() -> usize {
    COMMAND_INDEX.fetch_add(1, Ordering::SeqCst)
}

fn send_command(command: api::CommandJson) {
    if let Ok(value) = env::var("DEVIZ_SERVER") {
        if value.trim() == "1" {
            let json_text = serde_json::to_string(&vec![command]).unwrap();
            eprint!("|DEVIZ:BEGIN|{}|DEVIZ:END|", json_text);
        }
    }
}

pub fn text(pane_name: impl Into<String>, text: impl Into<String>) -> TextBuilder {
    TextBuilder::new(next_command_index(), pane_name.into(), text.into())
}

#[derive(Debug)]
pub struct TextBuilder {
    command_index: usize,
    pane_name: String,
    text: String,
    hovers: Vec<api::HoverJson>,
}

impl TextBuilder {
    fn new(command_index: usize, pane_name: String, text: String) -> Self {
        Self {
            command_index,
            pane_name,
            text,
            hovers: Vec::new(),
        }
    }

    fn json(&self) -> api::CommandJson {
        api::CommandJson {
            index: self.command_index,
            pane: api::PaneJson {
                name: self.pane_name.clone(),
                content: api::PaneContentJson::Text(api::TextJson {
                    text: self.text.clone(),
                    hovers: self.hovers.clone(),
                }),
            },
        }
    }

    pub fn hover_text(&mut self, range: Range<usize>, text: impl Into<String>) {
        self.hovers.push(api::HoverJson {
            start: range.start,
            end: range.end,
            text: text.into(),
        });
    }
}

impl Drop for TextBuilder {
    fn drop(&mut self) {
        send_command(self.json());
    }
}

pub fn tree(pane_name: impl Into<String>) -> TreeBuilder {
    TreeBuilder::new(next_command_index(), pane_name.into(), TreeKind::Tree)
}

pub fn text_tree(pane_name: impl Into<String>) -> TreeBuilder {
    TreeBuilder::new(next_command_index(), pane_name.into(), TreeKind::TextTree)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
enum TreeKind {
    Tree,
    TextTree,
}

#[derive(Debug)]
pub struct TreeBuilder {
    command_index: usize,
    pane_name: String,
    kind: TreeKind,
    roots: Vec<api::TreeJson>,
    stack: Vec<api::TreeJson>,
}

impl TreeBuilder {
    fn new(command_index: usize, pane_name: String, kind: TreeKind) -> Self {
        Self {
            command_index,
            pane_name,
            kind,
            roots: Vec::new(),
            stack: Vec::new(),
        }
    }

    fn json(&mut self) -> api::CommandJson {
        // Implicitly close tree
        while !self.stack.is_empty() {
            self.end_node();
        }
        api::CommandJson {
            index: self.command_index,
            pane: api::PaneJson {
                name: self.pane_name.clone(),
                content: match self.kind {
                    TreeKind::Tree => api::PaneContentJson::Tree(self.roots.clone()),
                    TreeKind::TextTree => api::PaneContentJson::TextTree(self.roots.clone()),
                },
            },
        }
    }

    pub fn begin_node(&mut self) {
        self.stack.push(api::TreeJson {
            label: None,
            children: Vec::new(),
        });
    }

    pub fn end_node(&mut self) {
        let node = self
            .stack
            .pop()
            .expect("mismatched begin_node/end_node calls");
        match self.stack.last_mut() {
            Some(parent) => parent.children.push(node),
            None => self.roots.push(node),
        }
    }

    pub fn label(&mut self, label: impl Into<String>) {
        let node = self
            .stack
            .last_mut()
            .expect("label must be called between begin_node and end_node");
        node.label = Some(label.into());
    }
}

impl Drop for TreeBuilder {
    fn drop(&mut self) {
        send_command(self.json());
    }
}

pub fn graph(pane_name: impl Into<String>) -> GraphBuilder {
    GraphBuilder::new(next_command_index(), pane_name.into())
}

#[derive(Debug)]
pub struct GraphBuilder {
    command_index: usize,
    pane_name: String,
    nodes: Vec<api::GraphNodeJson>,
    edges: Vec<api::GraphEdgeJson>,
}

impl GraphBuilder {
    fn new(command_index: usize, pane_name: String) -> Self {
        Self {
            command_index,
            pane_name,
            nodes: Vec::new(),
            edges: Vec::new(),
        }
    }

    fn json(&self) -> api::CommandJson {
        api::CommandJson {
            index: self.command_index,
            pane: api::PaneJson {
                name: self.pane_name.clone(),
                content: api::PaneContentJson::Graph(vec![api::GraphJson {
                    nodes: self.nodes.clone(),
                    edges: self.edges.clone(),
                }]),
            },
        }
    }

    pub fn node(&mut self, id: impl Into<String>) {
        self.nodes.push(api::GraphNodeJson {
            id: id.into(),
            label: None,
        });
    }

    pub fn node_labeled(&mut self, id: impl Into<String>, label: impl Into<String>) {
        self.nodes.push(api::GraphNodeJson {
            id: id.into(),
            label: Some(label.into()),
        });
    }

    pub fn edge(&mut self, from_id: impl Into<String>, to_id: impl Into<String>) {
        self.edges.push(api::GraphEdgeJson {
            from_id: from_id.into(),
            to_id: to_id.into(),
            label: None,
        });
    }

    pub fn edge_labeled(
        &mut self,
        from_id: impl Into<String>,
        to_id: impl Into<String>,
        label: impl Into<String>,
    ) {
        self.edges.push(api::GraphEdgeJson {
            from_id: from_id.into(),
            to_id: to_id.into(),
            label: Some(label.into()),
        });
    }
}

impl Drop for GraphBuilder {
    fn drop(&mut self) {
        send_command(self.json());
    }
}
