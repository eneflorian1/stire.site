import pathlib, re
data = pathlib.Path("tmp_trends.html").read_bytes()
pattern = b"AF_initDataCallback"
for m in re.finditer(pattern, data):
    print(m.start())
