import pathlib, re

data = pathlib.Path("tmp_trends.html").read_bytes()
pattern = b"AF_initDataCallback"
for m in re.finditer(pattern, data):
    start = m.start()
    snippet = data[start:start+800]
    print(snippet.decode('utf-8', errors='ignore'))
    print('\n---\n')
