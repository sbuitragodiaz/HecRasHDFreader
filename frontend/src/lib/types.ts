export type TreeNode = {
  name: string;
  path: string;
  type: 'group' | 'dataset';
  children?: TreeNode[];
  shape?: number[];
  dtype?: string;
};

export type FeatureType = 'cell' | 'face' | 'point';

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
  location: FeatureType;
  kind: 'static' | 'dynamic';
  units?: string | null;
};

export type Selection = {
  type: FeatureType;
  id: number;
};
