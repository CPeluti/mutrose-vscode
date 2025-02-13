import matplotlib.pyplot as plt
from matplotlib.patches import Ellipse, Rectangle
import matplotlib.patches as mpatches

import json
import sys

# -------------------------------------------------------------------
# 1) Basic definitions (NodeType, Node, TreeNode)
#    If you already have these in your own module, import them instead.
# -------------------------------------------------------------------
from enum import Enum

class NodeType(Enum):
    TASK = 1
    METHOD = 2
    ACTION = 3

class Node:
    def __init__(self, id, name, type, agents, parent, children):
        self.id = id
        self.name = name
        self.type = type
        self.agents = agents
        self.parent = parent
        self.children = children

    @staticmethod
    def safe_read(
        id: int, data: dict[str, str | list[str]], key: str
    ) -> str | list[str]:
        if not key in data:
            raise ValueError(
                f"Error while trying to load node {id}. Node does not have key {key}."
            )

        return data[key]

    @staticmethod
    def load(id: int, data: dict[str, str | list[str]]):
        type_map = {
            "task": NodeType.TASK,
            "method": NodeType.METHOD,
            "action": NodeType.ACTION,
        }
        type_name = Node.safe_read(id, data, "type")
        if not type_name in type_map:
            raise ValueError(
                f"Error while trying to load node {id}. Type {type_name} does not exist."
            )

        return Node(
            id,
            Node.safe_read(id, data, "name"),
            type_map[type_name],
            Node.safe_read(id, data, "agents"),
            int(Node.safe_read(id, data, "parent")),
            [int(i) for i in Node.safe_read(id, data, "children")],
        )

class TreeNode:
    def __init__(self, value: Node):
        self.value = value
        self.parent: "TreeNode" = None
        self.children: list["TreeNode"] = []

    def add_child(self, child_node: "TreeNode"):
        """Adds a child node to the current node."""
        child_node.parent = self
        self.children.append(child_node)

    def remove_child(self, child_node: "TreeNode"):
        """Removes a child node from the current node."""
        child_node.parent = None
        self.children = [child for child in self.children if child != child_node]

    def traverse(self):
        """Traverses the tree and prints the values."""
        print(self.value)
        for child in self.children:
            child.traverse()

    @staticmethod
    def add_child_recursive(child: Node, nodes: dict[int, Node]) -> "TreeNode":
        tree = TreeNode(child) 
        for sub_child in child.children:
            tree.add_child(TreeNode.add_child_recursive(nodes[sub_child], nodes))

        return tree

    @staticmethod
    def load(data: dict[str, dict[str, str | list[str]]]) -> "TreeNode":
        # Step 1: Load all nodes
        nodes: dict[int, Node] = {}
        root_node: Node = None
        for id, node_data in data.items():
            node = Node.load(int(id), node_data)
            nodes[node.id] = node

            if node.parent == -1:
                root_node = node

        if root_node is None:
            raise ValueError(
                "Error while trying to load tree {id}. Root node does not exist."
            )
        
        return TreeNode.add_child_recursive(root_node, nodes)

# -------------------------------------------------------------------
# 2) Full Reingold–Tilford Implementation
# -------------------------------------------------------------------

def compute_text_dimensions(ax, text, fontsize=8):
    """
    Measure text width and height in data coordinates using a temporary text object.
    """
    txt = ax.text(0, 0, text, fontsize=fontsize, ha='center', va='center')
    ax.figure.canvas.draw()
    bbox = txt.get_window_extent(renderer=ax.figure.canvas.get_renderer())
    txt.remove()
    inv = ax.transData.inverted()
    bbox_data = inv.transform(bbox)
    w = abs(bbox_data[1, 0] - bbox_data[0, 0])
    h = abs(bbox_data[1, 1] - bbox_data[0, 1])
    return w, h

class RTNode:
    """
    'RTNode' is a parallel structure to your TreeNode for the Reingold–Tilford layout.
    
    Fields used by the algorithm:
      - x, y: final coordinates
      - mod: "shift" to apply to this node's subtree
      - children: list of RTNode
      - parent: reference to parent RTNode (optional)
      - thread: used when subtrees don't line up
      - ancestor: used for apportioning
      - change, shift: internal variables
      - left_sibling: pointer to the immediately preceding sibling in the parent's children
      - width: measured width of the node's label (for spacing)
    """
    def __init__(self, tree_node: TreeNode):
        self.tree_node = tree_node
        self.children: list[RTNode] = []
        self.parent: RTNode | None = None

        # Reingold–Tilford variables
        self.x: float = 0.0
        self.y: float = 0.0
        self.mod: float = 0.0
        self.thread: RTNode | None = None
        self.ancestor: RTNode = self
        self.change: float = 0.0
        self.shift: float = 0.0
        self.left_sibling: RTNode | None = None

        # Measured text width (for spacing). Height is less critical for x overlap.
        self.width: float = 1.0

    def left_brother(self) -> "RTNode | None":
        """Return the node's immediate left sibling, if any."""
        return self.left_sibling

# Building a parallel RTNode tree from your existing TreeNode
def build_rt_tree(root: TreeNode, ax, fontsize=8, padding=0.2) -> RTNode:
    """
    Recursively build an RTNode tree from a TreeNode root. Also measure label width
    for each node so wide labels can get more space in the final layout.
    """
    # We'll do a DFS to create RTNodes
    tn_to_rtn: dict[int, RTNode] = {}

    def measure_label_width(tn: TreeNode) -> float:
        label = f"{tn.value.name}\n{', '.join(tn.value.agents)}"
        w, _ = compute_text_dimensions(ax, label, fontsize=fontsize)
        return w + padding  # a bit of padding

    def create_rtnode(tn: TreeNode) -> RTNode:
        rtn = RTNode(tn)
        tn_to_rtn[tn.value.id] = rtn
        rtn.width = measure_label_width(tn)
        for child_tn in tn.children:
            child_rtn = create_rtnode(child_tn)
            child_rtn.parent = rtn
            rtn.children.append(child_rtn)
        return rtn

    rt_root = create_rtnode(root)

    # Set the .left_sibling field for each child
    def set_left_sibling(rtn: RTNode):
        for i, c in enumerate(rtn.children):
            if i > 0:
                c.left_sibling = rtn.children[i - 1]
            set_left_sibling(c)

    set_left_sibling(rt_root)
    return rt_root

# ------------------- Reingold–Tilford "first walk" and "second walk" -------------------

def first_walk(v: RTNode) -> None:
    """
    The 'first walk' of Reingold–Tilford, in post-order.
    Sets v.x in a preliminary way, and calls 'apportion' to shift subtrees when needed.
    """
    if not v.children:
        # If leaf, set x = 0 (will be adjusted by siblings or by the apportion step).
        _set_x_position_if_left_sibling(v)
    else:
        # 1) Recursively position each child
        left_most_child = v.children[0]
        right_most_child = v.children[-1]
        default_ancestor = left_most_child
        for w in v.children:
            first_walk(w)
            default_ancestor = apportion(w, default_ancestor)
        _execute_shifts(v)
        # 2) Set v.x to midpoint of children
        midpoint = (left_most_child.x + right_most_child.x) / 2
        _set_x_position_if_left_sibling(v, midpoint)
    return

def _set_x_position_if_left_sibling(v: RTNode, default_x=0.0):
    """
    If v has a left sibling, put v.x = left_sibling.x + spacing.
    Otherwise, use default_x.
    """
    w = v.left_brother()
    if w is not None:
        # The minimum spacing could factor in v.width and w.width
        spacing = (w.width + v.width) * 0.5
        v.x = w.x + spacing
    else:
        v.x = default_x

def apportion(v: RTNode, default_ancestor: RTNode) -> RTNode:
    """
    The Reingold–Tilford 'apportion' step, which resolves conflicts between
    a node's left and right subtrees by shifting them.
    """
    w = v.left_brother()
    if w is None:
        return default_ancestor

    # 'inner' and 'outer' describe the right and left contours of the subtrees
    # We move 'inner' until it no longer overlaps 'outer'.
    vir = v
    vol = v
    wir = w
    wol = _leftmost_sibling(w)
    sir = vir.mod
    sol = vol.mod
    sirw = wir.mod
    solw = wol.mod

    while _next_right(wir) and _next_left(vir):
        wir = _next_right(wir)
        vir = _next_left(vir)
        wol = _next_left(wol)
        vol = _next_right(vol)
        vol_shift = (wir.x + sirw) - (vir.x + sir) + _minimum_spacing(wir, vir)
        if vol_shift > 0:
            # We need to move subtree of vol and its siblings
            move_subtree(_next_left(vol), vol, vol_shift)
            sir += vol_shift
            sol += vol_shift
        sirw += wir.mod
        sir += vir.mod
        solw += wol.mod
        sol += vol.mod

    # If we have a leftover node on the right side
    if _next_right(wir) and not _next_right(vol):
        vol.thread = _next_right(wir)
        vol.mod += sirw - sol
    # If we have a leftover node on the left side
    elif _next_left(vir) and not _next_left(wol):
        wol.thread = _next_left(vir)
        wol.mod += sir - solw
        default_ancestor = v

    return default_ancestor

def _leftmost_sibling(v: RTNode) -> RTNode:
    """Find the leftmost sibling among v's siblings (including v)."""
    # Actually, we just want the first sibling in the parent's children, but let's do a loop:
    if v.parent is None:
        return v
    siblings = v.parent.children
    return siblings[0]

def move_subtree(wl: RTNode, wr: RTNode, shift: float) -> None:
    """
    Move subtree rooted at wl to the right by 'shift', and record the shift
    so we can apply it to the entire left subtree.
    """
    # The function from the original paper:
    # "moveSubtree" moves one subtree over to avoid overlap
    sub = wr.ancestor
    common_ancestor = _get_ancestor(wl, sub)
    if common_ancestor:
        delta = shift / (wr.x - wl.x)
    else:
        delta = 0  # fallback
    wr.change -= shift
    wr.shift += shift
    wr.x += shift
    wr.mod += shift
    # We apply shift to wr and all its descendants
    # The original algorithm also updates 'change' and 'shift' so subsequent steps see it.

def _get_ancestor(v: RTNode, w: RTNode) -> RTNode | None:
    """
    Return a node that is an ancestor of both v and w (if any).
    For simplicity, we can just check parents up from v and see if they match w's ancestors.
    """
    ancestors = set()
    cur = v
    while cur is not None:
        ancestors.add(cur)
        if cur.parent is None:
            break
        cur = cur.parent
    cur = w
    while cur is not None:
        if cur in ancestors:
            return cur
        cur = cur.parent
    return None

def _next_left(v: RTNode | None) -> RTNode | None:
    """
    In the Reingold–Tilford logic, 'nextLeft' is either the left child or the thread.
    """
    if v is None:
        return None
    return v.thread if v.children == [] else v.children[0]

def _next_right(v: RTNode | None) -> RTNode | None:
    """
    'nextRight' is either the right child or the thread.
    """
    if v is None:
        return None
    return v.thread if v.children == [] else v.children[-1]

def _minimum_spacing(wl: RTNode, vr: RTNode) -> float:
    """
    Determine the horizontal spacing needed between two nodes to avoid overlap.
    We can base it on half of each node's width.
    """
    return (wl.width + vr.width) * 0.5

def _execute_shifts(v: RTNode):
    """
    After having positioned v's children, we apply the stored shifts (change/shift) to finalize.
    """
    shift = 0.0
    change = 0.0
    # Iterate children in reverse order
    for w in reversed(v.children):
        w.x += shift
        w.mod += shift
        change += w.change
        shift += w.shift + change

def second_walk(v: RTNode, m: float = 0.0, depth: int = 0, layer_height=1.0):
    """
    The 'second walk' sets final x and y coordinates by summing up 'mod' along the path.
    """
    v.x += m
    v.y = depth
    for w in v.children:
        second_walk(w, m + v.mod, depth + 1, layer_height)

# -------------------------------------------------------------------
# 3) Drawing Functions
# -------------------------------------------------------------------

def draw_reingold_tilford_tree(root_tn: TreeNode, output_filename="tree.png", fontsize=8):
    """
    Build the RTNode structure, run the full Reingold–Tilford, and draw the result.
    """
    fig, ax = plt.subplots(figsize=(10, 6))

    # 1) Build RTNode structure from your TreeNode root
    rt_root = build_rt_tree(root_tn, ax, fontsize=fontsize, padding=2.0)

    # 2) 'First walk' (post-order) to compute preliminary x
    first_walk(rt_root)

    # 3) 'Second walk' (pre-order) to finalize global positions
    second_walk(rt_root, 0.0, 0)

    # 4) Collect positions in a dict: node.id -> (x, y)
    positions = {}
    def collect_positions(r: RTNode):
        # We'll invert y so root is at top
        positions[r.tree_node.value.id] = (r.x, -r.y)
        for c in r.children:
            collect_positions(c)
    collect_positions(rt_root)

    # 5) Draw edges and nodes
    _draw_edges(ax, root_tn, positions)
    _draw_nodes(ax, root_tn, positions, fontsize=fontsize, padding=0.5)

    # Adjust plot
    xs = [p[0] for p in positions.values()]
    ys = [p[1] for p in positions.values()]
    margin = 1
    ax.set_xlim(min(xs) - margin, max(xs) + margin)
    ax.set_ylim(min(ys) - margin, max(ys) + margin)
    ax.set_aspect('equal')
    ax.axis('off')

    plt.savefig(output_filename)
    # plt.show()

def _draw_edges(ax, root: TreeNode, positions: dict[int, tuple[float, float]]):
    def recurse(tn: TreeNode):
        x, y = positions[tn.value.id]
        for child in tn.children:
            cx, cy = positions[child.value.id]
            ax.plot([x, cx], [y, cy], color='black')
            recurse(child)
    recurse(root)

def _draw_nodes(ax, root: TreeNode, positions: dict[int, tuple[float, float]], fontsize=8, padding=0.2):
    def recurse(tn: TreeNode):
        x, y = positions[tn.value.id]
        label = f"{tn.value.name}\n{', '.join(tn.value.agents)}"
        text_w, text_h = compute_text_dimensions(ax, label, fontsize=fontsize)
        text_w += padding
        text_h += padding

        if tn.value.type == NodeType.TASK:
            patch = Ellipse((x, y), width=text_w, height=text_h,
                            edgecolor='black', facecolor='white', zorder=2)
        elif tn.value.type == NodeType.METHOD:
            verts = [
                (x, y + text_h/2),
                (x + text_w/2, y),
                (x, y - text_h/2),
                (x - text_w/2, y)
            ]
            patch = mpatches.Polygon(verts, closed=True, edgecolor='black',
                                     facecolor='white', zorder=2)
        elif tn.value.type == NodeType.ACTION:
            patch = Rectangle((x - text_w/2, y - text_h/2),
                              text_w, text_h, edgecolor='black',
                              facecolor='white', zorder=2)
        else:
            patch = Ellipse((x, y), width=text_w, height=text_h,
                            edgecolor='black', facecolor='white', zorder=2)

        ax.add_patch(patch)
        ax.text(x, y, label, ha='center', va='center', fontsize=fontsize, zorder=3)

        for c in tn.children:
            recurse(c)
    recurse(root)

# -------------------------------------------------------------------
# 3) Build a small sample tree and run the algorithm.
# -------------------------------------------------------------------

def build_sample_tree():
    """
    Build a small, hard-coded tree for demonstration/testing.
    
    Structure:
          (ROOT) [TASK]
           /      \
          /        \
    (Child 1)      (Child 2)
     [METHOD]       [ACTION]
       /  \
      /    \
 (Child 1.1) (Child 1.2)
    [TASK]     [ACTION]
    """
    # Create Node objects
    root_node = Node(
        id=1,
        name="ROOT",
        type=NodeType.TASK,
        agents=["Agent A", "SomeAgent"],
        parent=-1,
        children=[2, 3],
    )
    child1_node = Node(
        id=2,
        name="Child 1",
        type=NodeType.METHOD,
        agents=["Agent X"],
        parent=1,
        children=[4, 5],
    )
    child2_node = Node(
        id=3,
        name="Child 2",
        type=NodeType.ACTION,
        agents=["Agent Y"],
        parent=1,
        children=[],
    )
    child11_node = Node(
        id=4,
        name="Child 1.1",
        type=NodeType.TASK,
        agents=["Agent Z"],
        parent=2,
        children=[],
    )
    child12_node = Node(
        id=5,
        name="Child 1.2",
        type=NodeType.ACTION,
        agents=["Agent W"],
        parent=2,
        children=[],
    )

    # Wrap them in TreeNodes
    root_tn = TreeNode(root_node)
    child1_tn = TreeNode(child1_node)
    child2_tn = TreeNode(child2_node)
    child11_tn = TreeNode(child11_node)
    child12_tn = TreeNode(child12_node)

    # Connect them
    root_tn.add_child(child1_tn)
    root_tn.add_child(child2_tn)
    child1_tn.add_child(child11_tn)
    child1_tn.add_child(child12_tn)

    return root_tn

def main():
    # 1) Build a small tree
    # root_tree_node = build_sample_tree()
    if len(sys.argv) != 2:
        print("Usage: python tree_drawer.py <input_json>")
        sys.exit(1)

    json_file = sys.argv[1]

    # Load JSON data
    with open(json_file, "r") as f:
        data: dict = json.load(f)

    root_tree_node = TreeNode.load(data)

    # 2) Generate the tree image using the Reingold–Tilford layout
    draw_reingold_tilford_tree(root_tree_node, output_filename=f"{sys.argv[1].replace('.json', '')}.png")

if __name__ == "__main__":
    main()
