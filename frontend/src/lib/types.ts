export type TreeNode = {
  name: string;
  path: string;
  type: 'group' | 'dataset';
  children?: TreeNode[];
  shape?: number[];
  dtype?: string;
};

<<<<<<< codex/create-local-hdf5-viewer-app
export type FeatureType = 'cell' | 'face' | 'point';

=======
>>>>>>> main
export type MeshCell = {
  id: number;
  point_indices: number[];
  center: [number, number] | null;
  min_elevation: number | null;
  manning_n: number | null;
};

export type MeshFace = {
  id: number;
  point_a: number;
  point_b: number;
};

export type MeshBundle = {
  geometry: {
    points: [number, number][];
    cells: MeshCell[];
    faces: MeshFace[];
    cell_centers: [number, number][];
  };
  counts: { points: number; cells: number; faces: number };
};

export type VariableInfo = {
  name: string;
  dataset_path: string;
  shape: number[];
  dtype: string;
  dynamic: boolean;
  timesteps: number;
<<<<<<< codex/create-local-hdf5-viewer-app
  location: FeatureType;
  kind: 'static' | 'dynamic';
  units?: string | null;
};

export type Selection = {
  type: FeatureType;
  id: number;
=======
  location: 'cell' | 'face' | 'point';
  kind: 'static' | 'dynamic';
>>>>>>> main
};
