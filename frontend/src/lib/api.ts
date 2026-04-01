import type { MeshBundle, TreeNode, VariableInfo } from './types';

const API = 'http://127.0.0.1:8000/api';

async function json<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as T;
}

export const api = {
  files: () => json<{ files: string[] }>(`${API}/files`),
  open: (path: string) =>
    fetch(`${API}/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    }).then((r) => r.json()),
  tree: (path: string) => json<{ tree: TreeNode }>(`${API}/tree?path=${encodeURIComponent(path)}`),
  mesh: (path: string) => json<MeshBundle>(`${API}/mesh?path=${encodeURIComponent(path)}`),
  variables: (path: string) => json<{ variables: VariableInfo[] }>(`${API}/variables?path=${encodeURIComponent(path)}`),
  values: (path: string, datasetPath: string, timestep: number) =>
    json<{ values: number[]; min: number; max: number; timestep: number }>(
      `${API}/variable-values?path=${encodeURIComponent(path)}&dataset_path=${encodeURIComponent(datasetPath)}&timestep=${timestep}`,
    ),
  metadata: (path: string) => json(`${API}/metadata?path=${encodeURIComponent(path)}`),
};
