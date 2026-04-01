# HEC-RAS 2D HDF5 Local Viewer (v1)

Local-first web app for inspecting and visualizing raw HEC-RAS 2D HDF5 output.

## What this v1 does

- FastAPI backend reads local HDF5 files (`h5py`) and exposes JSON endpoints.
- React + TypeScript + Vite frontend provides:
  - HDF5 group/dataset browser
  - 2D/3D viewer (Three.js)
  - Layer toggles (cells, faces, cell centers)
  - Scalar coloring by one selected variable
  - Timestep slider for time-dependent variables
  - Click inspection panel for selected mesh items
- Works primarily against included examples in `HDF_Examples/`.

## Project structure

```txt
backend/
  app/
    api/routes.py                  # FastAPI routes
    parsers/hec_ras.py             # centralized HEC-RAS HDF parsing assumptions
  requirements.txt
frontend/
  src/
    App.tsx                        # main layout + app state
    components/TreeView.tsx        # HDF5 browser UI
    components/Viewer3D.tsx        # Three.js rendering + picking
    lib/api.ts                     # backend API client
    lib/types.ts                   # shared frontend types
    styles.css                     # dark, minimal UI styles
```

## Setup

### 1) Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## HDF5 assumptions used in v1

The parser centralizes assumptions in `backend/app/parsers/hec_ras.py`.

### Geometry/topology assumptions

v1 currently looks for datasets with names containing these tokens:

- `FacePoints Coordinate`
- `Polygon Info`
- `Polygon Points`
- `Cells Center Coordinate`
- `Faces FacePoint Indexes`
- optional static attributes:
  - `Cells Minimum Elevation`
  - `Cells Center Manning's n`

### Variable assumptions

- Variables are discovered under paths containing `Results`.
- Candidate variable names include tokens like:
  - `Water Surface`
  - `Depth`
  - `Velocity`
  - `WSEL`
- Variable location is inferred from dataset path terms:
  - contains `face` => face-based
  - contains `point` or `node` => point-based
  - otherwise cell-based

## API endpoints

- `GET /health`
- `GET /api/files`
- `POST /api/open` with `{ "path": "..." }`
- `GET /api/tree?path=...`
- `GET /api/mesh?path=...`
- `GET /api/variables?path=...`
- `GET /api/variable-values?path=...&dataset_path=...&timestep=...`
- `GET /api/metadata?path=...`

## UX / style notes

- Dark by default
- Clean sidebars + central viewer + right inspector
- Technical but minimal visual language (subtle panel transparency, compact spacing, readable contrast)

## Known limitations (v1)

- Built specifically for the included examples first, not all HEC-RAS variants.
- Polygon parsing assumes `Polygon Info` + `Polygon Points` semantics.
- Picking is currently cell-focused and index-based (basic triangulation mapping).
- No full vector glyph visualization yet (data model keeps room for future vector layers).
- No uploaded-file persistence layer yet; use local path or example list.

## Extension notes

Good next additions:

1. Improve robust path matching using exact known HEC-RAS branch patterns.
2. Add backend endpoint for vector components (`vx`, `vy`) and optional arrow glyph rendering.
3. Improve pick mapping for triangulated cells and add face/point picking details.
4. Add unit metadata extraction and formatted legends.
5. Add caching for large result arrays and out-of-core pagination.
