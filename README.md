creare env
pip install -r server/requirements.txt

cd frontend
npm run dev

cd server
cd .venv/Scripts/
activate
cd ../..
uvicorn app:app --reload --port 8000



chmod +x setup.sh
./setup.sh