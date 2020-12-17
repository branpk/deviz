//! # deviz
//!
//! deviz is a VS Code extension that displays structured program output such as
//! trees and graphs.
//! This crate allows Rust code to produce output that can be read by the deviz
//! VS Code extension.
//!
//! # Examples
//!
//! ```
//! let mut tree = deviz::tree("ast");
//! tree.begin_node();
//! tree.label("+");
//! {
//!     tree.begin_node();
//!     tree.label("1");
//!     tree.end_node();
//! }
//! {
//!     tree.begin_node();
//!     tree.label("2");
//!     tree.end_node();
//! }
//! tree.end_node();
//!
//! let mut text = deviz::text("types", "x + y");
//! text.hover_text(0..1, "Int");
//! text.hover_text(4..5, "Bool");
//! text.hover_text(0..5, "Error");
//! ```

#![warn(missing_debug_implementations, missing_docs)]

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

fn send_command(command: api::Command) {
    if let Ok(value) = env::var("DEVIZ_SERVER") {
        if value.trim() == "1" {
            let json_text = serde_json::to_string(&vec![command]).unwrap();
            eprint!("|DEVIZ:BEGIN|{}|DEVIZ:END|", json_text);
        }
    }
}

pub fn text(pane_name: impl Into<String>, text: impl Into<String>) -> Text {
    Text::new(next_command_index(), pane_name.into(), text.into())
}

#[derive(Debug)]
pub struct Text {
    command_index: usize,
    pane_name: String,
    text: String,
    hovers: Vec<api::Hover>,
}

impl Text {
    fn new(command_index: usize, pane_name: String, text: String) -> Self {
        Self {
            command_index,
            pane_name,
            text,
            hovers: Vec::new(),
        }
    }

    fn json(&self) -> api::Command {
        api::Command {
            index: self.command_index,
            pane: api::Pane {
                name: self.pane_name.clone(),
                content: api::PaneContent::Text(api::Text {
                    text: self.text.clone(),
                    hovers: self.hovers.clone(),
                }),
            },
        }
    }

    pub fn hover_text(&mut self, range: Range<usize>, text: impl Into<String>) {
        self.hovers.push(api::Hover {
            start: range.start,
            end: range.end,
            text: text.into(),
        });
    }
}

impl Drop for Text {
    fn drop(&mut self) {
        send_command(self.json());
    }
}

pub fn tree(pane_name: impl Into<String>) -> Tree {
    Tree::new(next_command_index(), pane_name.into(), TreeKind::Tree)
}

pub fn text_tree(pane_name: impl Into<String>) -> Tree {
    Tree::new(next_command_index(), pane_name.into(), TreeKind::TextTree)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
enum TreeKind {
    Tree,
    TextTree,
}

#[derive(Debug)]
pub struct Tree {
    command_index: usize,
    pane_name: String,
    kind: TreeKind,
    roots: Vec<api::Tree>,
    stack: Vec<api::Tree>,
}

impl Tree {
    fn new(command_index: usize, pane_name: String, kind: TreeKind) -> Self {
        Self {
            command_index,
            pane_name,
            kind,
            roots: Vec::new(),
            stack: Vec::new(),
        }
    }

    fn json(&mut self) -> api::Command {
        // Implicitly close tree
        while !self.stack.is_empty() {
            self.end_node();
        }
        api::Command {
            index: self.command_index,
            pane: api::Pane {
                name: self.pane_name.clone(),
                content: match self.kind {
                    TreeKind::Tree => api::PaneContent::Tree(self.roots.clone()),
                    TreeKind::TextTree => api::PaneContent::TextTree(self.roots.clone()),
                },
            },
        }
    }

    pub fn begin_node(&mut self) {
        self.stack.push(api::Tree {
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

impl Drop for Tree {
    fn drop(&mut self) {
        send_command(self.json());
    }
}

pub fn graph(pane_name: impl Into<String>) -> Graph {
    Graph::new(next_command_index(), pane_name.into())
}

#[derive(Debug)]
pub struct Graph {
    command_index: usize,
    pane_name: String,
    nodes: Vec<api::GraphNode>,
    edges: Vec<api::GraphEdge>,
}

impl Graph {
    fn new(command_index: usize, pane_name: String) -> Self {
        Self {
            command_index,
            pane_name,
            nodes: Vec::new(),
            edges: Vec::new(),
        }
    }

    fn json(&self) -> api::Command {
        api::Command {
            index: self.command_index,
            pane: api::Pane {
                name: self.pane_name.clone(),
                content: api::PaneContent::Graph(vec![api::Graph {
                    nodes: self.nodes.clone(),
                    edges: self.edges.clone(),
                }]),
            },
        }
    }

    pub fn node(&mut self, id: impl Into<String>) {
        self.nodes.push(api::GraphNode {
            id: id.into(),
            label: None,
        });
    }

    pub fn node_labeled(&mut self, id: impl Into<String>, label: impl Into<String>) {
        self.nodes.push(api::GraphNode {
            id: id.into(),
            label: Some(label.into()),
        });
    }

    pub fn edge(&mut self, from_id: impl Into<String>, to_id: impl Into<String>) {
        self.edges.push(api::GraphEdge {
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
        self.edges.push(api::GraphEdge {
            from_id: from_id.into(),
            to_id: to_id.into(),
            label: Some(label.into()),
        });
    }
}

impl Drop for Graph {
    fn drop(&mut self) {
        send_command(self.json());
    }
}
