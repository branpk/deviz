fn main() {
    let mut graph = deviz::graph("g");
    graph.node_labeled("root", "ROOT");
    graph.node("A");
    graph.node("B");
    graph.edge("root", "A");
    graph.edge_labeled("root", "B", "edge label");
}
