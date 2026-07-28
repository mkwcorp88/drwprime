import zipfile
import xml.etree.ElementTree as ET
import json
import sys

XLSX_PATH = sys.argv[1] if len(sys.argv) > 1 else '/home/drw/spending 1 jan-31 mar.xlsx'

zf = zipfile.ZipFile(XLSX_PATH)
shared_strings = []
if 'xl/sharedStrings.xml' in zf.namelist():
    tree = ET.parse(zf.open('xl/sharedStrings.xml'))
    ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    for si in tree.findall('.//s:si', ns):
        text = ''.join(t.text or '' for t in si.findall('.//s:t', ns))
        shared_strings.append(text)

tree = ET.parse(zf.open('xl/worksheets/sheet1.xml'))
ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
rows = tree.findall('.//s:row', ns)

# Build header map from row 10 (0-indexed: 9)
header = {}
for c in rows[9].findall('s:c', ns):
    ref = c.get('r', '')
    col_letter = ''.join(ch for ch in ref if ch.isalpha())
    val = c.find('s:v', ns)
    t = c.get('t', '')
    if val is not None and val.text:
        if t == 's':
            header[col_letter] = shared_strings[int(val.text)]
        else:
            header[col_letter] = val.text

rm_col = 'I'
price_col = 'W'  # TOTAL TAGIHAN

# Aggregate spending by RM
spending = {}
total_rows = 0
for row in rows[10:]:  # data starts at row 11 (0-indexed 10)
    cells = {}
    for c in row.findall('s:c', ns):
        ref = c.get('r', '')
        col_letter = ''.join(ch for ch in ref if ch.isalpha())
        val = c.find('s:v', ns)
        t = c.get('t', '')
        if val is not None and val.text:
            if t == 's':
                cells[col_letter] = shared_strings[int(val.text)]
            else:
                cells[col_letter] = val.text

    rm = cells.get(rm_col, '').strip()
    price_str = cells.get(price_col, '0').strip()
    
    if not rm or not rm.startswith('MR'):
        continue
    
    try:
        price = float(price_str) if price_str else 0
    except ValueError:
        price = 0
    
    spending[rm] = spending.get(rm, 0) + price
    total_rows += 1

print(f'Processed {total_rows} transactions')
print(f'Unique RM: {len(spending)}')
print(f'Total spending: Rp {sum(spending.values()):,.0f}')

# Output JSON for database update
output = {rm: round(amt, 2) for rm, amt in spending.items()}
print('\n--- JSON OUTPUT ---')
print(json.dumps(output, indent=2))
