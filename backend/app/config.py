from pathlib import Path

# Backend app directory: .../backend/app
APP_DIR = Path(__file__).resolve().parent
# Backend project directory: .../backend
BACKEND_DIR = APP_DIR.parent
# Default local example HDF directory (one level above backend)
DEFAULT_HDF_DIR = BACKEND_DIR.parent / "HDF_Examples"
