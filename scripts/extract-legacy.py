"""Read source export without modifying it. Private outputs never enter deployment."""
import json,collections,datetime,pathlib,openpyxl
base=pathlib.Path(__file__).resolve().parent.parent
book=openpyxl.load_workbook(base/'private/source-20261019.xlsx',read_only=True,data_only=True)
result={}
for name in ['CRM_STAFF','CRM_ALLOCATIONS','CRM_INTAKE','CRM_ACTIVITIES','raw_final001','CRM_AUDIT','CRM_NOTIFICATIONS','CRM_BULK_JOBS']:
    rows=book[name].iter_rows(values_only=True)
    headers=[str(x or '') for x in next(rows)]
    records=[{k:v for k,v in zip(headers,row) if k} for row in rows if any(v is not None for v in row)]
    # Preserve credential hashes only in the original private workbook, not migration outputs.
    if name=='CRM_STAFF':
        records=[{k:v for k,v in r.items() if k not in ('Salt','Password_Hash')} for r in records]
    (base/'private'/f'{name}.json').write_text(json.dumps(records,ensure_ascii=False,default=str),encoding='utf-8')
    result[name]={'count':len(records)}
    if name=='CRM_STAFF': result[name]['accounts']=records
    if name=='CRM_ALLOCATIONS':
        result[name]['owners']=dict(collections.Counter(str(r.get('Assigned_To')) for r in records))
        result[name]['statuses']=dict(collections.Counter(str(r.get('Status')) for r in records))
        result[name]['unique_ids']=len({r['Assignment_ID'] for r in records})
    if name=='raw_final001':
        result[name]['unique_ids']=len({r['Customer_ID'] for r in records})
print(json.dumps(result,ensure_ascii=True,default=str))
(base/'private/extraction-summary.json').write_text(json.dumps(result,ensure_ascii=False,default=str),encoding='utf-8')
