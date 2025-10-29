import os
import os.path as path


# Environment configuration
BASE_DIR = path.abspath(path.dirname(__file__))
DEFAULT_DB_PATH = path.abspath(path.join(BASE_DIR, "news.db"))
DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH}")
API_KEY = os.environ.get("API_KEY", "devkey")


# Paths
FLUTTER_WEB_DIR = path.abspath(path.join(BASE_DIR, "..", "app", "build", "web"))
TEMPLATES_DIR = path.join(BASE_DIR, "templates")


