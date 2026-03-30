import { OrbitControls } from '@react-three/drei';
import { Canvas, ThreeEvent } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { MeshBundle } from '../lib/types';

type Props = {
  mesh: MeshBundle | null;
  values: number[];
  showCells: boolean;
  showFaces: boolean;
  showCenters: boolean;
  onPick: (payload: { type: 'cell' | 'face' | 'point'; id: number }) => void;
};

function scalarToColor(v: number, min: number, max: number) {
  const t = max > min ? (v - min) / (max - min) : 0.5;
  const clamped = Math.max(0, Math.min(1, t));
  const color = new THREE.Color();
  color.setHSL(0.72 - clamped * 0.72, 0.8, 0.52);
  return color;
}

export function Viewer3D({ mesh, values, showCells, showFaces, showCenters, onPick }: Props) {
  const cellGeometry = useMemo(() => {
    if (!mesh) return null;
    const geom = new THREE.BufferGeometry();
    const verts: number[] = [];
    const cols: number[] = [];

    const vmin = values.length ? Math.min(...values) : 0;
    const vmax = values.length ? Math.max(...values) : 1;

    mesh.geometry.cells.forEach((cell, idx) => {
      const poly = cell.point_indices;
      if (poly.length < 3) return;
      const color = scalarToColor(values[idx] ?? 0, vmin, vmax);
      for (let i = 1; i < poly.length - 1; i += 1) {
        const tri = [poly[0], poly[i], poly[i + 1]];
        tri.forEach((pi) => {
          const p = mesh.geometry.points[pi];
          if (!p) return;
          verts.push(p[0], p[1], 0);
          cols.push(color.r, color.g, color.b);
        });
      }
    });

    geom.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geom.computeVertexNormals();
    return geom;
  }, [mesh, values]);

  const faceGeometry = useMemo(() => {
    if (!mesh) return null;
    const g = new THREE.BufferGeometry();
    const verts: number[] = [];
    mesh.geometry.faces.forEach((f) => {
      const a = mesh.geometry.points[f.point_a];
      const b = mesh.geometry.points[f.point_b];
      if (!a || !b) return;
      verts.push(a[0], a[1], 0.1, b[0], b[1], 0.1);
    });
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    return g;
  }, [mesh]);

  const centers = mesh?.geometry.cell_centers ?? [];

  return (
    <Canvas camera={{ position: [0, 0, 120], fov: 45 }}>
      <color attach="background" args={['#080b12']} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[0, 0, 100]} intensity={0.4} />
      <gridHelper args={[200, 20, '#1f2840', '#111725']} rotation={[Math.PI / 2, 0, 0]} />
      {showCells && cellGeometry && (
        <mesh
          geometry={cellGeometry}
          onPointerDown={(e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            const id = Math.floor((e.faceIndex ?? 0) / 2);
            onPick({ type: 'cell', id });
          }}
        >
          <meshStandardMaterial vertexColors transparent opacity={0.95} side={THREE.DoubleSide} />
        </mesh>
      )}
      {showFaces && faceGeometry && (
        <lineSegments geometry={faceGeometry}>
          <lineBasicMaterial color="#e4eefb" opacity={0.65} transparent />
        </lineSegments>
      )}
      {showCenters && centers.length > 0 && (
        <points>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[new Float32Array(centers.flatMap((p) => [p[0], p[1], 0.25])), 3]}
              count={centers.length}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial size={0.8} color="#fef08a" />
        </points>
      )}
      <OrbitControls enableDamping />
    </Canvas>
  );
}
