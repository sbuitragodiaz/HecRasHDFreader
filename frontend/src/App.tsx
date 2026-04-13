import { useEffect, useMemo, useState } from 'react';
import { Viewer3D } from './components/Viewer3D';
import { TreeView } from './components/TreeView';
import { api } from './lib/api';
import type { FeatureType, MeshBundle, Selection, TreeNode, VariableInfo } from './lib/types';

function formatCoord(coord: [number, number] | null | undefined): string {
  if (!coord) return '—';
  return `(${coord[0].toFixed(3)}, ${coord[1].toFixed(3)})`;
}

function formatNumber(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) return '—';
  return value.toFixed(4);
}

function inferDisplayMode(variable: VariableInfo | null, mesh: MeshBundle | null, values: number[]): FeatureType {
  if (!variable) return 'cell';
  const isHydro = /(water|depth|velocity|wsel)/i.test(variable.name);

  // Product rule: hydrodynamic scalar fields should generally be inspected on cells.
  if (isHydro) {
    if (variable.location === 'face') return 'face';
    if (variable.location === 'point' && mesh && mesh.geometry.cell_centers.length === mesh.counts.cells) return 'cell';
    return 'cell';
  }

  if (variable.location === 'face') return 'face';
  if (variable.location === 'point') return 'point';

  // Fallback by array length when metadata is ambiguous.
  if (mesh) {
    if (values.length === mesh.counts.faces) return 'face';
    if (values.length === mesh.geometry.cell_centers.length || values.length === mesh.counts.points) return 'point';
  }
  return 'cell';
}

export function App() {
  const [files, setFiles] = useState<string[]>([]);
  const [filePath, setFilePath] = useState('');
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [mesh, setMesh] = useState<MeshBundle | null>(null);
  const [variables, setVariables] = useState<VariableInfo[]>([]);
  const [selectedVarPath, setSelectedVarPath] = useState<string>('');
  const [timestep, setTimestep] = useState(0);
  const [values, setValues] = useState<number[]>([]);
  const [valueRange, setValueRange] = useState<{ min: number | null; max: number | null }>({ min: null, max: null });
  const [activeTimestep, setActiveTimestep] = useState(0);
  const [showCells, setShowCells] = useState(true);
  const [showFaces, setShowFaces] = useState(true);
  const [showCenters, setShowCenters] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);

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
        const firstVar = v.variables.find((item) => item.location === 'cell') ?? v.variables[0];
        if (firstVar) {
          setSelectedVarPath(firstVar.dataset_path);
          setTimestep(0);
        }
        setSelection(null);
      })
      .catch((e) => alert(String(e)));
  }, [filePath]);

  const selectedVariable = useMemo(
    () => variables.find((v) => v.dataset_path === selectedVarPath) ?? null,
    [variables, selectedVarPath],
  );

  useEffect(() => {
    if (!filePath || !selectedVarPath) return;
    api.values(filePath, selectedVarPath, timestep)
      .then((d) => {
        setValues(d.values);
        setValueRange({ min: d.min, max: d.max });
        setActiveTimestep(d.timestep ?? 0);
      })
      .catch(() => {
        setValues([]);
        setValueRange({ min: null, max: null });
      });
  }, [filePath, selectedVarPath, timestep]);

  const activeInteractionMode = useMemo(
    () => inferDisplayMode(selectedVariable, mesh, values),
    [selectedVariable, mesh, values],
  );

  useEffect(() => {
    // Keep support layers available, but ensure the primary visualization layer is visible.
    if (activeInteractionMode === 'cell') setShowCells(true);
    if (activeInteractionMode === 'face') setShowFaces(true);
    if (activeInteractionMode === 'point') setShowCenters(true);
  }, [activeInteractionMode]);

  useEffect(() => {
    // Clear stale selection when switching interaction mode.
    setSelection((prev) => (prev && prev.type !== activeInteractionMode ? null : prev));
  }, [activeInteractionMode]);

  const selectionDetails = useMemo(() => {
    if (!selection || !mesh) return null;
    const variableName = selectedVariable?.name ?? '—';
    const units = selectedVariable?.units ? ` ${selectedVariable.units}` : '';

    if (selection.type === 'cell') {
      const cell = mesh.geometry.cells[selection.id];
      if (!cell) return null;
      return {
        type: 'Cell',
        id: cell.id,
        coordinates: cell.center,
        variableName,
        valueWithUnits: `${formatNumber(values[cell.id])}${units}`,
      };
    }

    if (selection.type === 'face') {
      const face = mesh.geometry.faces[selection.id];
      if (!face) return null;
      const a = mesh.geometry.points[face.point_a];
      const b = mesh.geometry.points[face.point_b];
      const mid: [number, number] | null = a && b ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] : null;
      return {
        type: 'Face',
        id: face.id,
        coordinates: mid,
        variableName,
        valueWithUnits: `${formatNumber(values[face.id])}${units}`,
      };
    }

    const points = mesh.geometry.cell_centers.length > 0 ? mesh.geometry.cell_centers : mesh.geometry.points;
    const p = points[selection.id] ?? null;
    return {
      type: 'Point',
      id: selection.id,
      coordinates: p,
      variableName,
      valueWithUnits: `${formatNumber(values[selection.id])}${units}`,
    };
  }, [selection, mesh, selectedVariable, values]);

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
          <label><input type="checkbox" checked={showCenters} onChange={(e) => setShowCenters(e.target.checked)} /> Points</label>
          <p style={{ color: '#9ba9c7', margin: '6px 0 0', fontSize: '0.78rem' }}>
            Active inspect mode: <strong style={{ color: '#e6ebf7' }}>{activeInteractionMode}</strong>
          </p>
        </section>

        <section>
          <h2>Variable</h2>
          <select value={selectedVarPath} onChange={(e) => setSelectedVarPath(e.target.value)}>
            {variables.map((v) => (
              <option key={v.dataset_path} value={v.dataset_path}>
                [{v.location}] {v.name}
              </option>
            ))}
          </select>
          {selectedVariable?.dynamic && (
            <>
              <label>Timestep: {timestep}</label>
              <input
                type="range"
                min={0}
                max={Math.max(0, selectedVariable.timesteps - 1)}
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

      <main className="viewer">
        <Viewer3D
          mesh={mesh}
          values={values}
          valueRange={valueRange}
          variableLocation={selectedVariable?.location ?? null}
          activeInteractionMode={activeInteractionMode}
          showCells={showCells}
          showFaces={showFaces}
          showCenters={showCenters}
          selection={selection}
          onPick={setSelection}
        />
      </main>

      <aside className="inspector">
        <h2>Inspector</h2>
        <div className="inspect-card">
          <div className="inspect-row"><span>Type</span><strong>{selectionDetails?.type ?? '—'}</strong></div>
          <div className="inspect-row"><span>ID</span><strong>{selectionDetails ? selectionDetails.id : '—'}</strong></div>
          <div className="inspect-row"><span>Coordinates</span><strong>{formatCoord(selectionDetails?.coordinates as [number, number] | null | undefined)}</strong></div>
          <div className="inspect-row"><span>Variable</span><strong>{selectionDetails?.variableName ?? (selectedVariable?.name ?? '—')}</strong></div>
          <div className="inspect-row"><span>Value</span><strong>{selectionDetails?.valueWithUnits ?? '—'}</strong></div>
          <div className="inspect-row"><span>Timestep</span><strong>{selectedVariable?.dynamic ? activeTimestep : 'static'}</strong></div>
        </div>

        <h2>Legend</h2>
        <div className="legend" />
        <div className="inspect-card compact">
          <div className="inspect-row"><span>Variable</span><strong>{selectedVariable?.name ?? '—'}</strong></div>
          <div className="inspect-row"><span>Location</span><strong>{selectedVariable?.location ?? '—'}</strong></div>
          <div className="inspect-row"><span>Display</span><strong>{activeInteractionMode}</strong></div>
          <div className="inspect-row"><span>Min</span><strong>{formatNumber(valueRange.min ?? undefined)}</strong></div>
          <div className="inspect-row"><span>Max</span><strong>{formatNumber(valueRange.max ?? undefined)}</strong></div>
          <div className="inspect-row"><span>Units</span><strong>{selectedVariable?.units ?? '—'}</strong></div>
          <div className="inspect-row"><span>Timestep</span><strong>{selectedVariable?.dynamic ? activeTimestep : 'static'}</strong></div>
        </div>
      </aside>
    </div>
  );
}
