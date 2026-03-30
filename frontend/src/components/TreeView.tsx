import type { TreeNode } from '../lib/types';

export function TreeView({ node }: { node: TreeNode }) {
  return (
    <ul className="tree-list">
      <li>
        <span className={`tree-${node.type}`}>{node.name}</span>
        {node.type === 'dataset' && (
          <span className="tree-meta"> {JSON.stringify(node.shape)} · {node.dtype}</span>
        )}
        {node.children && node.children.length > 0 && (
          <div className="tree-children">
            {node.children.map((child) => (
              <TreeView key={child.path} node={child} />
            ))}
          </div>
        )}
      </li>
    </ul>
  );
}
