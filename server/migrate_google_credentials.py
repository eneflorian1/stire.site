"""
Script pentru a migra credențialele Google din fișierul JSON în baza de date.

Rulează acest script o singură dată pentru a muta credențialele din
google_service_account.json în tabela Setting din baza de date.
"""

import json
import os
import sys
from pathlib import Path

# Adaugă directorul server în path pentru importuri
server_dir = Path(__file__).parent
sys.path.insert(0, str(server_dir))

from db import engine
from models import Setting
from sqlmodel import Session


def migrate_credentials():
    """Migrează credențialele Google din fișier JSON în baza de date."""
    json_file = server_dir / "google_service_account.json"
    
    if not json_file.exists():
        print(f"❌ Fișierul {json_file} nu există!")
        return False
    
    try:
        # Citește fișierul JSON
        with open(json_file, 'r') as f:
            data = json.load(f)
        
        # Extrage credențialele (formatul poate varia)
        if "installed" in data:
            # Format OAuth client (installed app)
            credentials = data["installed"]
            client_id = credentials.get("client_id")
            client_secret = credentials.get("client_secret")
            project_id = credentials.get("project_id")
            auth_uri = credentials.get("auth_uri")
            token_uri = credentials.get("token_uri")
        elif "type" in data and data.get("type") == "service_account":
            # Format service account
            credentials = data
            client_id = credentials.get("client_id")
            client_secret = credentials.get("private_key")
            project_id = credentials.get("project_id")
            auth_uri = credentials.get("auth_uri", "https://accounts.google.com/o/oauth2/auth")
            token_uri = credentials.get("token_uri", "https://oauth2.googleapis.com/token")
        else:
            # Încearcă să extragă direct
            credentials = data
            client_id = credentials.get("client_id")
            client_secret = credentials.get("client_secret") or credentials.get("private_key")
            project_id = credentials.get("project_id")
            auth_uri = credentials.get("auth_uri", "https://accounts.google.com/o/oauth2/auth")
            token_uri = credentials.get("token_uri", "https://oauth2.googleapis.com/token")
        
        if not client_id or not client_secret:
            print("❌ Nu s-au putut extrage client_id sau client_secret din fișier!")
            return False
        
        # Salvează în baza de date ca JSON string
        credentials_json = json.dumps(data)
        
        with Session(engine) as session:
            # Salvează întregul JSON în baza de date
            setting = session.get(Setting, "google_service_account_json")
            if setting:
                setting.value = credentials_json
                print("✅ Credențialele Google au fost actualizate în baza de date")
            else:
                setting = Setting(key="google_service_account_json", value=credentials_json)
                session.add(setting)
                print("✅ Credențialele Google au fost salvate în baza de date")
            
            session.commit()
        
        print(f"✅ Migrare completă! Credențialele sunt acum în baza de date.")
        print(f"   Poți șterge fișierul {json_file} dacă dorești (sau va fi ignorat de git).")
        return True
        
    except json.JSONDecodeError as e:
        print(f"❌ Eroare la parsarea JSON: {e}")
        return False
    except Exception as e:
        print(f"❌ Eroare la migrare: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    print("🔄 Migrare credențiale Google în baza de date...")
    success = migrate_credentials()
    sys.exit(0 if success else 1)

