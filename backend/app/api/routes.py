from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..parsers.hec_ras import HecRasHdfParser

router = APIRouter()
ROOT = Path(__file__).resolve().parents[3]
EXAMPLES_DIR = ROOT / "HDF_Examples"


class OpenFileRequest(BaseModel):
    path: str


@router.get("/files")
def list_files() -> dict[str, Any]:
    files = sorted(str(p.relative_to(ROOT)) for p in EXAMPLES_DIR.glob("*.hdf"))
    return {"files": files}


@router.post("/open")
def open_file(payload: OpenFileRequest) -> dict[str, Any]:
    path = Path(payload.path)
    if not path.is_absolute():
        path = (ROOT / path).resolve()
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail=f"File not found: {path}")
    parser = HecRasHdfParser(path)
    return parser.file_summary()


@router.get("/tree")
def get_tree(path: str) -> dict[str, Any]:
    parser = HecRasHdfParser(Path(path))
    return {"tree": parser.build_tree()}


@router.get("/mesh")
def get_mesh(path: str) -> dict[str, Any]:
    parser = HecRasHdfParser(Path(path))
    return parser.extract_mesh_bundle()


@router.get("/variables")
def list_variables(path: str) -> dict[str, Any]:
    parser = HecRasHdfParser(Path(path))
    return {"variables": parser.list_variables()}


@router.get("/variable-values")
def get_variable_values(path: str, dataset_path: str, timestep: int = 0) -> dict[str, Any]:
    parser = HecRasHdfParser(Path(path))
    return parser.get_variable_values(dataset_path, timestep)


@router.get("/metadata")
def get_metadata(path: str) -> dict[str, Any]:
    parser = HecRasHdfParser(Path(path))
    return parser.extract_metadata()
