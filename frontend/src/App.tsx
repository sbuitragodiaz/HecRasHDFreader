import { useEffect, useMemo, useState } from 'react';
import { api } from './lib/api';
import type { MeshBundle, TreeNode, VariableInfo } from './lib/types';
import { TreeView } from './components/TreeView';
import { Viewer3D } from './components/Viewer3D';

export function App() {
  const [files, setFiles] = useState<string[]>([]);
  const [filePath, setFilePath] = useState('');
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [mesh, setMesh] = useState<MeshBundle | null>(null);
  const [variables, setVariables] = useState<VariableInfo[]>([]);
  const [selectedVar, setSelectedVar] = useState<string>('');
  const [timestep, setTimestep] = useState(0);
  const [values, setValues] = useState<number[]>([]);
  const [showCells, setShowCells] = useState(true);
  const [showFaces, setShowFaces] = useState(true);
  const [showCenters, setShowCenters] = useState(false);
  const [selection, setSelection] = useState<{ type: string; id: number } | null>(null);

  useEffect(() => {
    api.files().then((d) => {
      setFiles(d.files);
      if (d.files[0]) setFilePath(d.files[0]);
    });
  }, []);

  useEffect(() => {
    if (!filePath) return;
    Promise.all([api.open(filePath), api.tree(filePath), api.mesh(filePath), api.variables(filePath)])
      .then(([, t, m, v]) => {
        setTree(t.tree);
        setMesh(m);
        setVariables(v.variables);
        const firstCellVar = v.variables.find((x) => x.location === 'cell') ?? v.variables[0];
        if (firstCellVar) {
          setSelectedVar(firstCellVar.dataset_path);
          setTimestep(0);
        }
      })
      .catch((e) => alert(String(e)));
  }, [filePath]);

  const selectedMeta = useMemo(() => variables.find((v) => v.dataset_path === selectedVar), [variables, selectedVar]);

  useEffect(() => {
    if (!filePath || !selectedVar) return;
    api.values(filePath, selectedVar, timestep)
      .then((d) => setValues(d.values))
      .catch(() => setValues([]));
  }, [filePath, selectedVar, timestep]);

  const selectionInfo = useMemo(() => {
    if (!selection || !mesh) return null;
    if (selection.type === 'cell') {
      const c = mesh.geometry.cells[selection.id];
      if (!c) return null;
      return {
        type: 'cell',
        id: c.id,
        center: c.center,
        value: values[c.id],
        min_elevation: c.min_elevation,
        manning_n: c.manning_n,
      };
    }
    return selection;
  }, [selection, mesh, values]);

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>HEC-RAS HDF Viewer</h1>
        <label>File</label>
        <select value={filePath} onChange={(e) => setFilePath(e.target.value)}>
          {files.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>

        <label>Or path</label>
        <input value={filePath} onChange={(e) => setFilePath(e.target.value)} />

        <section>
          <h2>Layers</h2>
          <label><input type="checkbox" checked={showCells} onChange={(e) => setShowCells(e.target.checked)} /> Cells</label>
          <label><input type="checkbox" checked={showFaces} onChange={(e) => setShowFaces(e.target.checked)} /> Faces</label>
          <label><input type="checkbox" checked={showCenters} onChange={(e) => setShowCenters(e.target.checked)} /> Cell centers</label>
        </section>

        <section>
          <h2>Variable</h2>
          <select value={selectedVar} onChange={(e) => setSelectedVar(e.target.value)}>
            {variables.map((v) => (
              <option key={v.dataset_path} value={v.dataset_path}>
                [{v.location}] {v.name}
              </option>
            ))}
          </select>
          {selectedMeta?.dynamic && (
            <>
              <label>Timestep: {timestep}</label>
              <input
                type="range"
                min={0}
                max={Math.max(0, (selectedMeta?.timesteps ?? 1) - 1)}
                value={timestep}
                onChange={(e) => setTimestep(Number(e.target.value))}
              />
            </>
          )}
        </section>

        <section>
          <h2>HDF5 Browser</h2>
          {tree ? <TreeView node={tree} /> : <p>Loading tree...</p>}
        </section>
      </aside>

      <main className="viewer"><Viewer3D mesh={mesh} values={values} showCells={showCells} showFaces={showFaces} showCenters={showCenters} onPick={setSelection} /></main>

      <aside className="inspector">
        <h2>Selection</h2>
        <pre>{selectionInfo ? JSON.stringify(selectionInfo, null, 2) : 'Click a feature to inspect values.'}</pre>
        <h2>Color legend</h2>
        <div className="legend" />
        <p>{selectedMeta?.name ?? 'No variable selected'}</p>
        <p>{selectedMeta ? `${selectedMeta.location} · ${selectedMeta.kind}` : ''}</p>
        <p>{mesh ? `Cells: ${mesh.counts.cells} · Faces: ${mesh.counts.faces}` : ''}</p>
      </aside>
    </div>
  );
}
