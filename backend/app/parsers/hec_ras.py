from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import h5py
import numpy as np


@dataclass
class DatasetRef:
    path: str
    shape: list[int]
    dtype: str


class HecRasHdfParser:
    """Centralized parser for HEC-RAS HDF assumptions used by the v1 viewer."""

    def __init__(self, file_path: Path):
        self.file_path = file_path.resolve()
        if not self.file_path.exists():
            raise FileNotFoundError(f"Missing file: {self.file_path}")

    def _with_file(self):
        return h5py.File(self.file_path, "r")

    def file_summary(self) -> dict[str, Any]:
        with self._with_file() as hdf:
            return {
                "path": str(self.file_path),
                "filename": self.file_path.name,
                "root_keys": sorted(list(hdf.keys())),
            }

    def build_tree(self) -> dict[str, Any]:
        with self._with_file() as hdf:
            return self._node_from_group("/", hdf)

    def _node_from_group(self, name: str, group: h5py.Group) -> dict[str, Any]:
        children = []
        for key in sorted(group.keys()):
            obj = group[key]
            if isinstance(obj, h5py.Group):
                children.append(self._node_from_group(f"{name.rstrip('/')}/{key}", obj))
            else:
                children.append(
                    {
                        "name": key,
                        "path": f"{name.rstrip('/')}/{key}",
                        "type": "dataset",
                        "shape": list(obj.shape),
                        "dtype": str(obj.dtype),
                    }
                )
        return {"name": name if name != "/" else "root", "path": name, "type": "group", "children": children}

    def _index_datasets(self, hdf: h5py.File) -> list[DatasetRef]:
        refs: list[DatasetRef] = []

        def visit(name: str, obj: Any):
            if isinstance(obj, h5py.Dataset):
                refs.append(DatasetRef(path=f"/{name}", shape=list(obj.shape), dtype=str(obj.dtype)))

        hdf.visititems(visit)
        return refs

    @staticmethod
    def _norm(name: str) -> str:
        return name.lower().replace("_", " ")

    def _find_dataset(self, refs: list[DatasetRef], *keywords: str) -> DatasetRef | None:
        keys = [self._norm(k) for k in keywords]
        for ref in refs:
            norm = self._norm(ref.path)
            if all(k in norm for k in keys):
                return ref
        return None

    @staticmethod
    def _extract_units(attrs: Any) -> str | None:
        for key in ("Units", "units", "Unit", "unit"):
            if key in attrs:
                raw = attrs[key]
                if isinstance(raw, bytes):
                    return raw.decode(errors="ignore")
                if isinstance(raw, np.ndarray) and raw.size == 1:
                    v = raw[0]
                    if isinstance(v, bytes):
                        return v.decode(errors="ignore")
                    return str(v)
                return str(raw)
        return None


    def _read_dataset(self, hdf: h5py.File, ref: DatasetRef | None) -> np.ndarray | None:
        if ref is None:
            return None
        return np.array(hdf[ref.path])

    def extract_mesh_bundle(self) -> dict[str, Any]:
        with self._with_file() as hdf:
            refs = self._index_datasets(hdf)

            fp_coord = self._find_dataset(refs, "facepoints", "coordinate")
            polygon_info = self._find_dataset(refs, "polygon info")
            polygon_points = self._find_dataset(refs, "polygon points")
            centers = self._find_dataset(refs, "cells center coordinate")
            faces = self._find_dataset(refs, "faces", "facepoint indexes")
            min_elev = self._find_dataset(refs, "cells minimum elevation")
            mann = self._find_dataset(refs, "cells center manning")

            points_arr = self._read_dataset(hdf, fp_coord)
            poly_info_arr = self._read_dataset(hdf, polygon_info)
            poly_points_arr = self._read_dataset(hdf, polygon_points)
            centers_arr = self._read_dataset(hdf, centers)
            faces_arr = self._read_dataset(hdf, faces)
            min_elev_arr = self._read_dataset(hdf, min_elev)
            mann_arr = self._read_dataset(hdf, mann)

            points = points_arr[:, :2].tolist() if points_arr is not None and points_arr.ndim >= 2 else []
            cells = []
            if poly_info_arr is not None and poly_points_arr is not None and poly_info_arr.ndim >= 2:
                for i, row in enumerate(poly_info_arr):
                    start = int(row[0])
                    count = int(row[1])
                    poly = poly_points_arr[start : start + count].astype(int).tolist()
                    cell = {
                        "id": i,
                        "point_indices": poly,
                        "center": centers_arr[i, :2].tolist() if centers_arr is not None and i < len(centers_arr) else None,
                        "min_elevation": float(min_elev_arr[i]) if min_elev_arr is not None and i < len(min_elev_arr) else None,
                        "manning_n": float(mann_arr[i]) if mann_arr is not None and i < len(mann_arr) else None,
                    }
                    cells.append(cell)

            face_lines = []
            if faces_arr is not None and faces_arr.ndim >= 2:
                for i, row in enumerate(faces_arr):
                    face_lines.append({"id": i, "point_a": int(row[0]), "point_b": int(row[1])})

            return {
                "geometry": {
                    "points": points,
                    "cells": cells,
                    "faces": face_lines,
                    "cell_centers": centers_arr[:, :2].tolist() if centers_arr is not None and centers_arr.ndim >= 2 else [],
                },
                "dataset_map": {
                    "facepoints_coordinate": fp_coord.path if fp_coord else None,
                    "polygon_info": polygon_info.path if polygon_info else None,
                    "polygon_points": polygon_points.path if polygon_points else None,
                    "cells_center_coordinate": centers.path if centers else None,
                    "faces_facepoint_indexes": faces.path if faces else None,
                },
                "counts": {
                    "points": len(points),
                    "cells": len(cells),
                    "faces": len(face_lines),
                },
            }

    def list_variables(self) -> list[dict[str, Any]]:
        with self._with_file() as hdf:
            refs = self._index_datasets(hdf)

            candidates = []
            terms = ["water surface", "depth", "velocity", "wsel"]
            for ref in refs:
                low = self._norm(ref.path)
                if "results" not in low:
                    continue
                if not any(t in low for t in terms):
                    continue
                if ref.shape == []:
                    continue

                dynamic = len(ref.shape) >= 2
                timesteps = int(ref.shape[0]) if dynamic else 1

                location = "cell"
                if "face" in low:
                    location = "face"
                elif "point" in low or "node" in low:
                    location = "point"

                dataset = hdf[ref.path]

                candidates.append(
                    {
                        "name": ref.path.split("/")[-1],
                        "dataset_path": ref.path,
                        "shape": ref.shape,
                        "dtype": ref.dtype,
                        "dynamic": dynamic,
                        "timesteps": timesteps,
                        "location": location,
                        "kind": "dynamic" if dynamic else "static",
                        "units": self._extract_units(dataset.attrs),
                    }
                )

            unique = {item["dataset_path"]: item for item in candidates}
            return sorted(unique.values(), key=lambda v: v["dataset_path"])

    def get_variable_values(self, dataset_path: str, timestep: int = 0) -> dict[str, Any]:
        with self._with_file() as hdf:
            if dataset_path not in hdf:
                raise KeyError(f"Dataset not found: {dataset_path}")
            arr = np.array(hdf[dataset_path])
            if arr.ndim >= 2:
                idx = int(np.clip(timestep, 0, arr.shape[0] - 1))
                values = arr[idx]
                active_timestep = idx
            else:
                values = arr
                active_timestep = 0

            values = np.nan_to_num(values, nan=np.nan)
            flat = values.astype(float).reshape(-1)
            return {
                "dataset_path": dataset_path,
                "timestep": active_timestep,
                "value_count": int(flat.shape[0]),
                "min": float(np.nanmin(flat)) if flat.shape[0] else None,
                "max": float(np.nanmax(flat)) if flat.shape[0] else None,
                "values": flat.tolist(),
            }

    def extract_metadata(self) -> dict[str, Any]:
        with self._with_file() as hdf:
            refs = self._index_datasets(hdf)
            attrs_ref = self._find_dataset(refs, "attributes")
            info_ref = self._find_dataset(refs, "cell info")
            return {
                "file": str(self.file_path),
                "dataset_count": len(refs),
                "has_attributes_dataset": attrs_ref.path if attrs_ref else None,
                "has_cell_info_dataset": info_ref.path if info_ref else None,
            }
