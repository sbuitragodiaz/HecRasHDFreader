import { OrbitControls } from '@react-three/drei';
import { Canvas, ThreeEvent } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { FeatureType, MeshBundle, Selection } from '../lib/types';

type Props = {
  mesh: MeshBundle | null;
  values: number[];
  valueRange: { min: number | null; max: number | null };
  variableLocation: FeatureType | null;
  activeInteractionMode: FeatureType;
  showCells: boolean;
  showFaces: boolean;
  showCenters: boolean;
  selection: Selection | null;
  onPick: (payload: Selection) => void;
};

const COLOR_FALLBACK = new THREE.Color('#5f6b8a');

function scalarToColor(v: number | undefined, min: number, max: number) {
  if (v === undefined || Number.isNaN(v)) return COLOR_FALLBACK;
  const t = max > min ? (v - min) / (max - min) : 0.5;
  const clamped = Math.max(0, Math.min(1, t));
  const color = new THREE.Color();
  color.setHSL(0.72 - clamped * 0.72, 0.8, 0.52);
  return color;
}

function getRange(range: { min: number | null; max: number | null }, values: number[]) {
  const min = range.min ?? (values.length ? Math.min(...values) : 0);
  const max = range.max ?? (values.length ? Math.max(...values) : 1);
  return { min, max: max > min ? max : min + 1e-9 };
}

export function Viewer3D({
  mesh,
  values,
  valueRange,
  variableLocation,
  activeInteractionMode,
  showCells,
  showFaces,
  showCenters,
  selection,
  onPick,
}: Props) {
  const cellData = useMemo(() => {
    if (!mesh) return null;
    const geometry = new THREE.BufferGeometry();
    const verts: number[] = [];
    const cols: number[] = [];
    const triangleToCell: number[] = [];
    const { min, max } = getRange(valueRange, values);

    const canUsePointAsCell = variableLocation === 'point' && mesh.geometry.cell_centers.length === mesh.geometry.cells.length;

    mesh.geometry.cells.forEach((cell) => {
      const poly = cell.point_indices;
      if (poly.length < 3) return;

      const rawValue = canUsePointAsCell ? values[cell.id] : values[cell.id];
      const color = activeInteractionMode === 'cell'
        ? scalarToColor(rawValue, min, max)
        : new THREE.Color('#3a4664');

      for (let i = 1; i < poly.length - 1; i += 1) {
        const tri = [poly[0], poly[i], poly[i + 1]];
        let valid = true;
        tri.forEach((pi) => {
          const p = mesh.geometry.points[pi];
          if (!p) {
            valid = false;
            return;
          }
          verts.push(p[0], p[1], 0);
          cols.push(color.r, color.g, color.b);
        });
        if (valid) triangleToCell.push(cell.id);
      }
    });

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geometry.computeVertexNormals();
    return { geometry, triangleToCell };
  }, [mesh, values, valueRange, variableLocation, activeInteractionMode]);

  const faceData = useMemo(() => {
    if (!mesh) return null;
    const geometry = new THREE.BufferGeometry();
    const verts: number[] = [];
    const cols: number[] = [];
    const triangleToFace: number[] = [];
    const { min, max } = getRange(valueRange, values);
    const halfWidth = 0.35;

    mesh.geometry.faces.forEach((face) => {
      const a = mesh.geometry.points[face.point_a];
      const b = mesh.geometry.points[face.point_b];
      if (!a || !b) return;
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy);
      if (len === 0) return;
      const nx = -dy / len;
      const ny = dx / len;

      const a1: [number, number] = [a[0] + nx * halfWidth, a[1] + ny * halfWidth];
      const a2: [number, number] = [a[0] - nx * halfWidth, a[1] - ny * halfWidth];
      const b1: [number, number] = [b[0] + nx * halfWidth, b[1] + ny * halfWidth];
      const b2: [number, number] = [b[0] - nx * halfWidth, b[1] - ny * halfWidth];

      const color = activeInteractionMode === 'face' ? scalarToColor(values[face.id], min, max) : new THREE.Color('#d6e5ff');
      [[a1, b1, b2], [a1, b2, a2]].forEach((tri) => {
        tri.forEach((p) => {
          verts.push(p[0], p[1], 0.18);
          cols.push(color.r, color.g, color.b);
        });
        triangleToFace.push(face.id);
      });
    });

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geometry.computeVertexNormals();
    return { geometry, triangleToFace };
  }, [mesh, values, valueRange, activeInteractionMode]);

  const pointData = useMemo(() => {
    if (!mesh) return null;
    const points = mesh.geometry.cell_centers.length > 0 ? mesh.geometry.cell_centers : mesh.geometry.points;
    const { min, max } = getRange(valueRange, values);
    const positions = new Float32Array(points.flatMap((p) => [p[0], p[1], 0.35]));
    const colors = new Float32Array(
      points.flatMap((_, idx) => {
        const color = activeInteractionMode === 'point' ? scalarToColor(values[idx], min, max) : new THREE.Color('#f5e6a9');
        return [color.r, color.g, color.b];
      }),
    );
    return { points, positions, colors };
  }, [mesh, valueRange, values, activeInteractionMode]);

  const selectedCell = selection?.type === 'cell' && mesh ? mesh.geometry.cells[selection.id] : null;
  const selectedFace = selection?.type === 'face' && mesh ? mesh.geometry.faces[selection.id] : null;
  const selectedPoint = selection?.type === 'point' && pointData ? pointData.points[selection.id] : null;

  const isCellPickMode = activeInteractionMode === 'cell';
  const isFacePickMode = activeInteractionMode === 'face';
  const isPointPickMode = activeInteractionMode === 'point';

  return (
    <Canvas camera={{ position: [0, 0, 120], fov: 45 }}>
      <color attach="background" args={['#080b12']} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[0, 0, 100]} intensity={0.4} />
      <gridHelper args={[200, 20, '#1f2840', '#111725']} rotation={[Math.PI / 2, 0, 0]} />

      {showCells && cellData && (
        <mesh
          geometry={cellData.geometry}
          // Only active layer is raycastable. This prevents support layers from blocking clicks.
          raycast={isCellPickMode ? undefined : () => null}
          onPointerDown={(e: ThreeEvent<PointerEvent>) => {
            if (!isCellPickMode) return;
            e.stopPropagation();
            // Triangles are produced per polygon; this lookup maps clicked triangle -> original cell id.
            const triIndex = e.faceIndex ?? -1;
            const cellId = triIndex >= 0 ? cellData.triangleToCell[triIndex] : undefined;
            if (cellId !== undefined) onPick({ type: 'cell', id: cellId });
          }}
        >
          <meshStandardMaterial vertexColors transparent opacity={0.95} side={THREE.DoubleSide} />
        </mesh>
      )}

      {showFaces && faceData && (
        <mesh
          geometry={faceData.geometry}
          raycast={isFacePickMode ? undefined : () => null}
          onPointerDown={(e: ThreeEvent<PointerEvent>) => {
            if (!isFacePickMode) return;
            e.stopPropagation();
            // Faces are expanded into quads (two triangles each); map clicked triangle -> source face id.
            const triIndex = e.faceIndex ?? -1;
            const faceId = triIndex >= 0 ? faceData.triangleToFace[triIndex] : undefined;
            if (faceId !== undefined) onPick({ type: 'face', id: faceId });
          }}
        >
          <meshStandardMaterial vertexColors transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
      )}

      {showCenters && pointData && (
        <points
          raycast={isPointPickMode ? undefined : () => null}
          onPointerDown={(e: ThreeEvent<PointerEvent>) => {
            if (!isPointPickMode) return;
            e.stopPropagation();
            if (e.index !== undefined) onPick({ type: 'point', id: e.index });
          }}
        >
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[pointData.positions, 3]} count={pointData.points.length} itemSize={3} />
            <bufferAttribute attach="attributes-color" args={[pointData.colors, 3]} count={pointData.points.length} itemSize={3} />
          </bufferGeometry>
          <pointsMaterial size={1.3} vertexColors />
        </points>
      )}

      {selectedCell && mesh && (
        <lineLoop>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[
                new Float32Array(
                  selectedCell.point_indices.flatMap((pi) => {
                    const p = mesh.geometry.points[pi];
                    return p ? [p[0], p[1], 0.45] : [0, 0, 0.45];
                  }),
                ),
                3,
              ]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#ffffff" />
        </lineLoop>
      )}

      {selectedFace && mesh && (
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[
                new Float32Array([
                  ...(mesh.geometry.points[selectedFace.point_a] ?? [0, 0]),
                  0.5,
                  ...(mesh.geometry.points[selectedFace.point_b] ?? [0, 0]),
                  0.5,
                ]),
                3,
              ]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#ffffff" />
        </line>
      )}

      {selectedPoint && (
        <mesh position={[selectedPoint[0], selectedPoint[1], 0.7]}>
          <sphereGeometry args={[1.2, 16, 16]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      )}

      <OrbitControls enableDamping />
    </Canvas>
  );
}
