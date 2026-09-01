import openpyxl
import json
import re

def clean_val(val):
    if val is None:
        return None
    val_str = str(val).strip()
    if val_str == "" or val_str.lower() == "none" or val_str.lower() == "nan":
        return None
    return val_str

def parse_mfds():
    wb = openpyxl.load_workbook('MFDS 1일 섭취허용량.xlsx')
    sheet = wb.active
    records = []
    
    # Row 1 is header
    # Headers: ['연번', '불순물 명칭', 'IUPAC 명', 'CAS No.', '발생 성분', 'CPCA 분류', '섭취허용량(ng/일)', '비고', '공개일자']
    for r in range(2, sheet.max_row + 1):
        no_val = sheet.cell(r, 1).value
        name_val = sheet.cell(r, 2).value
        if not no_val and not name_val:
            continue
            
        try:
            no_int = int(no_val)
        except:
            no_int = sheet.max_row - r + 1

        cat_val = sheet.cell(r, 6).value
        try:
            cat_num = float(cat_val) if cat_val is not None else None
        except:
            cat_num = None

        ai_val = clean_val(sheet.cell(r, 7).value)
        if ai_val:
            ai_val = re.sub(r'[^\d.]', '', ai_val)

        rec = {
            "no": no_int,
            "name": clean_val(sheet.cell(r, 2).value),
            "iupac": clean_val(sheet.cell(r, 3).value),
            "cas": clean_val(sheet.cell(r, 4).value),
            "active": clean_val(sheet.cell(r, 5).value),
            "category": cat_num,
            "ai": ai_val,
            "remark": clean_val(sheet.cell(r, 8).value),
            "date": clean_val(sheet.cell(r, 9).value) or "2026-08",
            "publishDate": "2026년 8월 공고"
        }
        records.append(rec)

    # Sort descending by no
    records.sort(key=lambda x: x["no"], reverse=True)
    return records

def parse_fda():
    records = []
    current_id = 1

    # 1. CPCA
    wb_cpca = openpyxl.load_workbook('CDER Nitrosamine Impurity Acceptable Intake Limits  FDA CPCA.xlsx')
    sheet_cpca = wb_cpca.active
    for r in range(2, sheet_cpca.max_row + 1):
        name_val = clean_val(sheet_cpca.cell(r, 2).value)
        if not name_val:
            continue
        cat_val = sheet_cpca.cell(r, 4).value
        try:
            cat_num = int(cat_val) if cat_val is not None else None
        except:
            cat_num = None
        
        ai_raw = clean_val(sheet_cpca.cell(r, 5).value)
        ai_clean = re.sub(r'[^\d.]', '', ai_raw) if ai_raw else ""

        records.append({
            "id": current_id,
            "name": name_val,
            "api": clean_val(sheet_cpca.cell(r, 3).value),
            "category": cat_num,
            "ai": ai_clean,
            "sourceType": "CPCA",
            "publishDate": "2026년 8월 공고"
        })
        current_id += 1

    # 2. SAR
    wb_sar = openpyxl.load_workbook('CDER Nitrosamine Impurity Acceptable Intake Limits  FDA SAR.xlsx')
    sheet_sar = wb_sar.active
    # Row 1 is Title, Row 2 is Header
    for r in range(3, sheet_sar.max_row + 1):
        name_val = clean_val(sheet_sar.cell(r, 1).value)
        if not name_val:
            continue
        ai_raw = clean_val(sheet_sar.cell(r, 3).value)
        ai_clean = re.sub(r'[^\d.]', '', ai_raw) if ai_raw else ""

        records.append({
            "id": current_id,
            "name": name_val,
            "api": clean_val(sheet_sar.cell(r, 2).value),
            "category": None,
            "ai": ai_clean,
            "surrogate": clean_val(sheet_sar.cell(r, 4).value),
            "dateAdded": clean_val(sheet_sar.cell(r, 5).value),
            "sourceType": "SAR",
            "publishDate": "2026년 8월 공고"
        })
        current_id += 1

    # 3. Interim
    wb_interim = openpyxl.load_workbook('CDER Nitrosamine Impurity Acceptable Intake Limits  FDA interim.xlsx')
    sheet_interim = wb_interim.active
    # Row 1 is Title, Row 2 is Header
    for r in range(3, sheet_interim.max_row + 1):
        name_val = clean_val(sheet_interim.cell(r, 1).value)
        if not name_val:
            continue
        ai_raw = clean_val(sheet_interim.cell(r, 3).value)
        ai_clean = re.sub(r'[^\d.]', '', ai_raw) if ai_raw else ""

        records.append({
            "id": current_id,
            "name": name_val,
            "api": clean_val(sheet_interim.cell(r, 2).value),
            "category": None,
            "ai": ai_clean,
            "interimLimitPpm": clean_val(sheet_interim.cell(r, 4).value),
            "estimatedDuration": clean_val(sheet_interim.cell(r, 5).value),
            "sourceType": "Interim",
            "publishDate": "2026년 8월 공고"
        })
        current_id += 1

    return records

mfds_data = parse_mfds()
fda_data = parse_fda()

print(f"Parsed MFDS: {len(mfds_data)} entries")
print(f"Parsed FDA: {len(fda_data)} entries")

# Export to adi_db.js
adi_js_content = f"""/**
 * MFDS Official Nitrosamine ADI Database ({len(mfds_data)} entries)
 * Updated: 2026-08 (공고 월: 2026년 8월)
 */
window.MFDS_ADI_DATABASE = {json.dumps(mfds_data, indent=2, ensure_ascii=False)};
"""

with open('adi_db.js', 'w', encoding='utf-8') as f:
    f.write(adi_js_content)

# Export to fda_db.js
fda_js_content = f"""/**
 * FDA Official Nitrosamine ADI Database ({len(fda_data)} entries: CPCA, SAR, Interim)
 * Updated: 2026-08 (공고 월: 2026년 8월)
 */
window.FDA_ADI_DATABASE = {json.dumps(fda_data, indent=2, ensure_ascii=False)};
"""

with open('fda_db.js', 'w', encoding='utf-8') as f:
    f.write(fda_js_content)

print("Exported adi_db.js and fda_db.js successfully!")
