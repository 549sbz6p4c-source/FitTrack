#!/usr/bin/env python3
"""À lancer avant chaque publication : recalcule la VERSION de sw.js à partir du contenu des fichiers de l'appli.
Dès que sw.js change, les iPhone détectent la mise à jour et proposent « Mettre à jour » (les données ne sont pas touchées)."""
import hashlib, re, pathlib, datetime
root = pathlib.Path(__file__).resolve().parent.parent
sw = (root / 'sw.js').read_text(encoding='utf-8')
files = re.findall(r"'([^']+)'", re.search(r"const FILES = \[(.*?)\];", sw, re.S).group(1))
h = hashlib.sha1()
for f in sorted(files):
    p = root / ('index.html' if f == './' else f)
    h.update(f.encode()); h.update(p.read_bytes())
v = datetime.date.today().strftime('%Y.%m.%d') + '-' + h.hexdigest()[:8]
(root / 'sw.js').write_text(re.sub(r"const VERSION = '[^']*';", "const VERSION = '%s';" % v, sw), encoding='utf-8')
print('sw.js -> version', v)
