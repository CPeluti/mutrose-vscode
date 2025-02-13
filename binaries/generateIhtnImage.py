from ete4 import Tree
from ete4.treeview import TreeStyle, faces, AttrFace, NodeStyle, TextFace
import json
import sys

agents = {}

class TreePlotter:
    def __init__(self, file):
        self.task_sequence = []
        with open(file) as f:
            self.ihtn = json.load(f)
        self.tree = Tree({"name": self.ihtn["0"]["name"]})

    def task_sequencing(self, node: str = "0", parent=None):
        children = self.ihtn[node]["children"]
        name = self.ihtn[node]["name"]
        list_of_agents = self.ihtn[node]["agents"]

        my_node = Tree({"name": name})
        agents[name] = list_of_agents
        if(parent is not None):
            parent.add_child(my_node)
        else:
            self.tree.add_child(my_node)
        for child in children:
            self.task_sequencing(child, my_node)

def my_layout(node):
    agent_face = TextFace(agents[node.name], fsize=5)
    agent_face.rotation = -90
    if(node.is_leaf):
        name_face = AttrFace("name", fsize=8)
    else:
        name_face = AttrFace("name", fsize=10)
        name_face.rotation = -90
    faces.add_face_to_node(name_face, node, column=0, position="branch-right")
    faces.add_face_to_node(agent_face, node, column=0, position="aligned")


if __name__ == "__main__":
    json_file = sys.argv[1]
    plotter = TreePlotter(json_file)
    plotter.task_sequencing()

    ts = TreeStyle()
    ts.show_leaf_name = False
    ts.rotation = 90
    ts.min_leaf_separation=100
    ts.layout_fn = my_layout
    #print(plotter.tree)
    plotter.tree.render(f"{sys.argv[1].replace('.json', '')}.png", tree_style=ts)
