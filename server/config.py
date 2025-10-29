import os
import os.path as path


# Environment configuration
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./news.db")
API_KEY = os.environ.get("API_KEY", "devkey")


# Paths
BASE_DIR = path.abspath(path.dirname(__file__))
FLUTTER_WEB_DIR = path.abspath(path.join(BASE_DIR, "..", "app", "build", "web"))
TEMPLATES_DIR = path.join(BASE_DIR, "templates")


