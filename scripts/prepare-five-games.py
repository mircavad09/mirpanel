"""Read the supplied research workbook; preserve all original inputs."""
import hashlib
import json
import sys
from pathlib import Path

import openpyxl
from PIL import Image

workbook_path, banner_path, repository_path = map(Path, sys.argv[1:4])
workbook = openpyxl.load_workbook(workbook_path, data_only=True)
targets = {}
for row in workbook['Qiymət təklifi'].iter_rows(min_row=6, max_row=22):
    product, label, supplier_id = (row[i].value for i in range(3))
    targets[int(supplier_id)] = {'price': str(row[7].value), 'cell': row[7].coordinate,
                                 'label': label, 'product': product}
definitions = [
    ('mobile_legends', 'Mobile Legends', 'mobile-legends', 6, 11),
    ('honor_of_kings', 'Honor of Kings', 'honor-of-kings', 48, 229),
    ('arena_breakout', 'Arena Breakout — mobil', 'arena-breakout', 14, 33),
    ('arena_breakout_infinite', 'Arena Breakout Infinite — PC', 'arena-breakout-infinite', 13, 34),
    ('stumble_guys', 'Stumble Guys', 'stumble-guys', 143, 342),
]
packages = []
for row in workbook['Paketlər'].iter_rows(min_row=6, values_only=True):
    if not row[7]:
        continue
    package_id, category_id, game_id = int(row[7]), int(row[8]), int(row[9])
    definition = next((d for d in definitions if d[3:5] == (game_id, category_id)), None)
    if not definition:
        continue
    fields = []
    for field in str(row[11] or '').splitlines():
        if not field:
            continue
        label, spec = field.rsplit(' (', 1)
        fields.append({'key': spec.split(',')[0].rstrip(')'), 'label': label,
                       'required': 'məcburi' in spec})
    target = targets.get(package_id)
    packages.append({'productId': definition[0], 'supplierProductId': package_id,
                     'name': row[3], 'gameId': game_id, 'categoryId': category_id,
                     'type': 'TOPUP', 'fields': fields,
                     'researchCheckedAt': str(row[31]),
                     'regionDecision': row[23], 'restriction': row[26],
                     'supplierSource': row[29], 'competitorSource': row[30],
                     'targetPrice': target['price'] if target else None,
                     'targetCell': target['cell'] if target else None})
if {p['supplierProductId'] for p in packages if p['targetPrice'] is not None} != set(targets):
    raise ValueError('All 17 workbook targets must match their exact package IDs')
assets = []
destination = repository_path / 'uploads/products'
destination.mkdir(parents=True, exist_ok=True)
for product_id, title, slug, game_id, category_id in definitions:
    original = banner_path / (slug + '.png')
    output = destination / (slug + '-cover.webp')
    with Image.open(original) as image:
        source_size = image.size
        image.thumbnail((1200, 1200), Image.Resampling.LANCZOS)
        image.convert('RGB').save(output, 'WEBP', quality=88, method=6)
        size = image.size
    assets.append({'id': product_id, 'title': title, 'slug': slug, 'gameId': game_id,
                   'categoryId': category_id, 'image': '/uploads/products/' + output.name,
                   'originalSha256': hashlib.sha256(original.read_bytes()).hexdigest(),
                   'originalSize': source_size, 'optimizedSize': size,
                   'optimizedBytes': output.stat().st_size})
manifest = {'source': workbook_path.name, 'sourceSha256': hashlib.sha256(workbook_path.read_bytes()).hexdigest(),
            'sheet': 'Qiymət təklifi', 'range': 'H6:H22', 'researchDate': '2026-11-22',
            'exchangeRate': '1.73', 'separateCommission': '0',
            'currentAccountCatalogVerified': False, 'products': assets, 'packages': packages}
output = repository_path / 'catalog/five-games-20261122.json'
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'products': len(assets), 'candidatePackages': len(packages),
                  'approvedTargets': len(targets), 'assets': assets}, ensure_ascii=False))
