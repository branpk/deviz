//! # deviz
//!
//! deviz is a VS Code extension that displays structured program output such as trees and graphs.
//! This crate allows Rust code to produce output that can be read by this extension.
//!
//! To use this crate, call one of the [top level output functions](#functions).
//!
//! These functions take a `pane_name` argument, which specifies the name of the tab where the
//! output will be displayed.
//! The same output function can be called multiple times with the same pane name, but combining
//! different types of output into the same pane won't work.
//!
//! The functions each return a builder object that is used for constructing the output.
//! The output data is automatically sent to the VS Code extension when this builder object is
//! dropped.
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

use json::JsonValue;

static COMMAND_INDEX: AtomicUsize = AtomicUsize::new(0);

fn next_command_index() -> usize {
    COMMAND_INDEX.fetch_add(1, Ordering::SeqCst)
}

fn send_command(command: JsonValue) {
    if let Ok(value) = env::var("DEVIZ_SERVER") {
        if value.trim() == "1" {
            let json_text = JsonValue::from(vec![command]).to_string();
            eprint!("|DEVIZ:BEGIN|{}|DEVIZ:END|", json_text);
        }
    }
}

/// Text, with the option of adding hover text. Returns [`Text`](Text).
///
/// See [crate level documentation](crate) for an explanation of `pane_name`.
pub fn text(pane_name: impl Into<String>, text: impl Into<String>) -> Text {
    Text::new(next_command_index(), pane_name.into(), text.into())
}

/// A builder for text output. Construct using [`deviz::text`](text).
///
/// # Examples
///
/// ```
/// let mut text = deviz::text("3 * 4");
/// text.hover_text(0..1, "3");
/// text.hover_text(4..5, "4");
/// text.hover_text(0..5, "12");
/// ```
#[derive(Debug)]
pub struct Text {
    command_index: usize,
    pane_name: String,
    text: String,
    hovers: Vec<Hover>,
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

    fn json(&self) -> JsonValue {
        json::object! {
            index: self.command_index,
            pane: {
                name: self.pane_name.clone(),
                content: {
                    type: "text",
                    data: {
                        text: self.text.clone(),
                        hovers: self.hovers.clone(),
                    },
                },
            },
        }
    }

    /// Add hover text to the given byte range.
    pub fn hover_text(&mut self, range: Range<usize>, text: impl Into<String>) {
        self.hovers.push(Hover {
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

#[derive(Debug, Clone)]
struct Hover {
    start: usize,
    end: usize,
    text: String,
}

impl From<Hover> for JsonValue {
    fn from(hover: Hover) -> Self {
        json::object! {
            start: hover.start,
            end: hover.end,
            text: hover.text,
        }
    }
}

/// A tree, rendered graphically. Returns [`Tree`](Tree).
///
/// See [crate level documentation](crate) for an explanation of `pane_name`.
pub fn tree(pane_name: impl Into<String>) -> Tree {
    Tree::new(next_command_index(), pane_name.into(), TreeKind::Tree)
}

/// A tree, printed as indented text. Returns [`Tree`](Tree).
///
/// See [crate level documentation](crate) for an explanation of `pane_name`.
pub fn text_tree(pane_name: impl Into<String>) -> Tree {
    Tree::new(next_command_index(), pane_name.into(), TreeKind::TextTree)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
enum TreeKind {
    Tree,
    TextTree,
}

/// A builder for tree output. Construct using [`deviz::tree`](tree) or
/// [`deviz::text_tree`](text_tree).
///
/// # Examples
///
/// ```
/// let mut tree = deviz::tree("ast");
/// tree.begin_node();
/// tree.label("+");
/// {
///     tree.begin_node();
///     tree.label("1");
///     tree.end_node();
/// }
/// {
///     tree.begin_node();
///     tree.label("2");
///     tree.end_node();
/// }
/// tree.end_node();
/// ```
#[derive(Debug)]
pub struct Tree {
    command_index: usize,
    pane_name: String,
    kind: TreeKind,
    roots: Vec<TreeNode>,
    stack: Vec<TreeNode>,
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

    fn json(&mut self) -> JsonValue {
        // Implicitly close tree
        while !self.stack.is_empty() {
            self.end_node();
        }
        let pane_type = match self.kind {
            TreeKind::Tree => "tree",
            TreeKind::TextTree => "text_tree",
        };
        json::object! {
            index: self.command_index,
            pane: {
                name: self.pane_name.clone(),
                content: {
                    type: pane_type,
                    data: self.roots.clone(),
                },
            },
        }
    }

    /// Begin a new subtree, i.e. a node and all its children.
    ///
    /// A call to this function should be paired with a call to [`end_node`](Self::end_node).
    /// Between these two calls, the node and its children should be built.
    pub fn begin_node(&mut self) {
        self.stack.push(TreeNode {
            label: None,
            children: Vec::new(),
        });
    }

    /// End a subtree. See [`begin_node`](Self::begin_node).
    ///
    /// # Panics
    ///
    /// Panics if there is no matching [`begin_node`](Self::begin_node) call.
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

    /// Add a label for the current node. By default, a node has no label.
    ///
    /// # Panics
    ///
    /// This method should be called between a call to [`begin_node`](Self::begin_node) and a call
    /// to [`end_node`](Self::end_node). Panics otherwise.
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

#[derive(Debug, Clone)]
struct TreeNode {
    label: Option<String>,
    children: Vec<TreeNode>,
}

impl From<TreeNode> for JsonValue {
    fn from(node: TreeNode) -> Self {
        json::object! {
            label: node.label,
            children: node.children,
        }
    }
}

/// A directed graph. Returns [`Graph`](Graph).
///
/// See [crate level documentation](crate) for an explanation of `pane_name`.
pub fn graph(pane_name: impl Into<String>) -> Graph {
    Graph::new(next_command_index(), pane_name.into())
}

/// A builder for directed graph output. Construct using [`deviz::graph`](graph).
///
/// # Examples
///
/// ```
/// let mut graph = deviz::graph("g");
/// graph.node_labeled("root", "ROOT");
/// graph.node("A");
/// graph.node("B");
/// graph.edge("root", "A");
/// graph.edge_labeled("root", "B", "edge label");
/// ```
#[derive(Debug)]
pub struct Graph {
    command_index: usize,
    pane_name: String,
    nodes: Vec<GraphNode>,
    edges: Vec<GraphEdge>,
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

    fn json(&self) -> JsonValue {
        json::object! {
            index: self.command_index,
            pane: {
                name: self.pane_name.clone(),
                content: {
                    type: "graph",
                    data: [{
                        nodes: self.nodes.clone(),
                        edges: self.edges.clone(),
                    }],
                }
            },
        }
    }

    /// Add a node with the given id. The node's label equals its id.
    pub fn node(&mut self, id: impl Into<String>) {
        self.nodes.push(GraphNode {
            id: id.into(),
            label: None,
        });
    }

    /// Add a node with the given id and label.
    pub fn node_labeled(&mut self, id: impl Into<String>, label: impl Into<String>) {
        self.nodes.push(GraphNode {
            id: id.into(),
            label: Some(label.into()),
        });
    }

    /// Define an unlabeled edge from the node with id `from_id` to the node with id `to_id`.
    ///
    /// If a node id is used in an edge but there is no corresponding call to [node](Self::node) or
    /// [node_labeled](Self::node_labeled), then the node will be added automatically.
    ///
    /// **Warning:** The order that edges are displayed in the graph is not guaranteed to correspond
    /// to the order that they were defined.
    /// This will hopefully change in the future, but for now you should label all edges if their
    /// order matters.
    pub fn edge(&mut self, from_id: impl Into<String>, to_id: impl Into<String>) {
        self.edges.push(GraphEdge {
            from_id: from_id.into(),
            to_id: to_id.into(),
            label: None,
        });
    }

    /// Define an edge from the node with id `from_id` to the node with id `to_id` with the given
    /// label.
    pub fn edge_labeled(
        &mut self,
        from_id: impl Into<String>,
        to_id: impl Into<String>,
        label: impl Into<String>,
    ) {
        self.edges.push(GraphEdge {
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

#[derive(Debug, Clone)]
struct GraphNode {
    id: String,
    label: Option<String>,
}

impl From<GraphNode> for JsonValue {
    fn from(node: GraphNode) -> Self {
        json::object! {
            id: node.id,
            label: node.label,
        }
    }
}

#[derive(Debug, Clone)]
struct GraphEdge {
    from_id: String,
    to_id: String,
    label: Option<String>,
}

impl From<GraphEdge> for JsonValue {
    fn from(edge: GraphEdge) -> Self {
        json::object! {
            fromId: edge.from_id,
            toId: edge.to_id,
            label: edge.label,
        }
    }
}
