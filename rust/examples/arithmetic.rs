fn main() {
    let mut tree = deviz::tree("ast");
    tree.begin_node();
    tree.label("+");
    {
        tree.begin_node();
        tree.label("1");
        tree.end_node();
    }
    {
        tree.begin_node();
        tree.label("2");
        tree.end_node();
    }
    tree.end_node();

    let mut text = deviz::text("types", "x + y");
    text.hover_text(0..1, "Int");
    text.hover_text(4..5, "Bool");
    text.hover_text(0..5, "Error");
}
