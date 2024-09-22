import sys
import psycopg2
import networkx as nx
import matplotlib.pyplot as plt
from pgmpy.models import BayesianNetwork
from pgmpy.factors.discrete import TabularCPD
from pgmpy.inference import VariableElimination

# Check if arguments are provided
if len(sys.argv) != 3:
    print("Usage: python update_pgm.py <file_path> <version>")
    sys.exit()

# Fetch file and version from command-line arguments
file_path = sys.argv[1]
new_version = int(sys.argv[2])

def connect_db():
    try:
        return psycopg2.connect("dbname=file_tracking user=postgres password=yourpassword")
    except Exception as e:
        print(f"Error connecting to database: {e}")
        sys.exit()

def fetch_file_structure(cur, file_path):
    try:
        cur.execute("""
            WITH RECURSIVE folder_structure AS (
                SELECT file_path, version, parent_folder
                FROM file_versions
                WHERE file_path = %s
                UNION ALL
                SELECT fv.file_path, fv.version, fv.parent_folder
                FROM file_versions fv
                INNER JOIN folder_structure fs ON fv.parent_folder = fs.file_path
            )
            SELECT file_path, version, parent_folder FROM folder_structure;
        """, (file_path,))
        return cur.fetchall()
    except Exception as e:
        print(f"Error fetching file structure: {e}")
        sys.exit()

def create_dynamic_pgm(file_structure):
    model = BayesianNetwork()
    nodes = set()
    edges = set()
    for file_path, version, parent_folder in file_structure:
        if file_path not in nodes:
            model.add_node(file_path)
            nodes.add(file_path)
        if parent_folder and parent_folder not in nodes:
            model.add_node(parent_folder)
            nodes.add(parent_folder)
        if parent_folder:
            edges.add((parent_folder, file_path))
    
    model.add_edges_from(edges)
    return model

def generate_cpds(file_structure):
    cpds = []
    for file_path, version, parent_folder in file_structure:
        prob_file = 0.5 + 0.1 * (version % 5)  # Example dynamic probability
        if parent_folder:
            cpd = TabularCPD(variable=file_path, variable_card=2,
                             values=[[prob_file, 1 - prob_file], [1 - prob_file, prob_file]],
                             evidence=[parent_folder], evidence_card=[2])
        else:
            cpd = TabularCPD(variable=file_path, variable_card=2,
                             values=[[prob_file], [1 - prob_file]])
        cpds.append(cpd)
    return cpds

def visualize_structure(file_structure):
    G = nx.DiGraph()
    for file_path, version, parent_folder in file_structure:
        G.add_node(file_path)
        if parent_folder:
            G.add_edge(parent_folder, file_path)
    
    pos = nx.spring_layout(G)  # For better layout visualization
    plt.figure(figsize=(12, 8))
    nx.draw(G, pos, with_labels=True, node_color='lightblue', node_size=3000, edge_color='gray', font_size=10, font_weight='bold')
    plt.title('Folder and File Structure Visualization')
    plt.show()

def main():
    conn = connect_db()
    cur = conn.cursor()
    file_structure = fetch_file_structure(cur, file_path)
    if not file_structure:
        print(f"No metadata found for file: {file_path}")
        cur.close()
        conn.close()
        sys.exit()
    
    model = create_dynamic_pgm(file_structure)
    cpds = generate_cpds(file_structure)
    model.add_cpds(*cpds)
    
    try:
        model.check_model()
        print("Model is valid!")
    except ValueError as e:
        print(f"Error in model: {e}")
        cur.close()
        conn.close()
        sys.exit()
    
    inference = VariableElimination(model)
    result = inference.map_query(variables=[file_path], evidence={})
    print(f"PGM inference result for {file_path}: {result}")
    
    visualize_structure(file_structure)
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
