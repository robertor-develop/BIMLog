from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT=Path(r"F:\BIMLog\Worktrees\bimlog-user-manual-20261105")
SHOTS=Path(r"C:\Users\soporte\Documents\Codex\2026-10-27\bimlog-main-04-06\outputs")
OUT=ROOT/"docs"/"user-manual"
NAVY="12304A"; BLUE="146C94"; TEAL="14866D"; PALE="EAF4F7"; GRAY="5D6B78"

def shade(cell,fill):
    shd=OxmlElement('w:shd'); shd.set(qn('w:fill'),fill); cell._tc.get_or_add_tcPr().append(shd)
def cell(cell,text,bold=False,color="1F2933",size=9):
    cell.text=""; r=cell.paragraphs[0].add_run(text); r.bold=bold; r.font.name="Aptos"; r.font.size=Pt(size); r.font.color.rgb=RGBColor.from_string(color); cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
def hyperlink(p,text,url):
    rid=p.part.relate_to(url,"http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink",is_external=True)
    h=OxmlElement('w:hyperlink'); h.set(qn('r:id'),rid); r=OxmlElement('w:r'); pr=OxmlElement('w:rPr'); c=OxmlElement('w:color'); c.set(qn('w:val'),BLUE); u=OxmlElement('w:u'); u.set(qn('w:val'),'single'); pr.extend([c,u]); r.append(pr); t=OxmlElement('w:t'); t.text=text; r.append(t); h.append(r); p._p.append(h)
def setup(title,subtitle):
    d=Document(); s=d.sections[0]; s.page_width=Inches(8.5); s.page_height=Inches(11); s.top_margin=Inches(.68); s.bottom_margin=Inches(.65); s.left_margin=Inches(.72); s.right_margin=Inches(.72)
    d.styles['Normal'].font.name='Aptos'; d.styles['Normal'].font.size=Pt(9.5); d.styles['Normal'].font.color.rgb=RGBColor.from_string('25313C')
    for n,z in [('Title',30),('Subtitle',15),('Heading 1',21),('Heading 2',14)]: d.styles[n].font.name='Aptos Display'; d.styles[n].font.size=Pt(z); d.styles[n].font.color.rgb=RGBColor(0,0,0); d.styles[n].font.bold=n!='Subtitle'
    hp=s.header.paragraphs[0]; hp.text='BIMLog  |  User Documentation'; hp.alignment=WD_ALIGN_PARAGRAPH.RIGHT; hp.style=d.styles['Caption']
    fp=s.footer.paragraphs[0]; fp.text='BIMLog · v1.05.N18-P37 · November 2026'; fp.alignment=WD_ALIGN_PARAGRAPH.CENTER; fp.style=d.styles['Caption']
    d.add_paragraph().paragraph_format.space_after=Pt(70); p=d.add_paragraph(); p.alignment=WD_ALIGN_PARAGRAPH.CENTER; r=p.add_run('BIMLog'); r.font.size=Pt(42); r.bold=True; r.font.color.rgb=RGBColor.from_string(NAVY)
    p=d.add_paragraph(style='Title'); p.alignment=WD_ALIGN_PARAGRAPH.CENTER; p.add_run(title)
    p=d.add_paragraph(style='Subtitle'); p.alignment=WD_ALIGN_PARAGRAPH.CENTER; p.add_run(subtitle)
    return d
def head(d,text,level=1): return d.add_heading(text,level=level)
def para(d,text):
    p=d.add_paragraph(text); p.paragraph_format.space_after=Pt(5); p.paragraph_format.line_spacing=1.08; return p
def bullets(d,items):
    for x in items: d.add_paragraph(x,style='List Bullet')
def steps(d,items):
    for x in items: d.add_paragraph(x,style='List Number')
def image(d,rel,caption,width=6.5):
    path=SHOTS/rel
    if not path.exists(): return
    p=d.add_paragraph(); p.alignment=WD_ALIGN_PARAGRAPH.CENTER; sh=p.add_run().add_picture(str(path),width=Inches(width)); sh._inline.docPr.set('descr',caption); sh._inline.docPr.set('title',caption)
    c=d.add_paragraph(caption,style='Caption'); c.alignment=WD_ALIGN_PARAGRAPH.CENTER
def page(d): d.add_page_break()
def link(d,label,path): p=d.add_paragraph(); hyperlink(p,label,f"https://bimlog.app{path}")
def finish(d,path):
    for table in d.tables:
        if table.rows:
            tr=table.rows[0]._tr.get_or_add_trPr(); h=OxmlElement('w:tblHeader'); h.set(qn('w:val'),'true'); tr.append(h)
    d.save(path)

# Complete English edition
d=setup('USER MANUAL','Complete illustrated operational guide')
image(d,'bimlog-live-round3.png','BIMLog company administration and capability navigation',6.25)
para(d,'Reference release v1.05.N18-P37. This guide supports project users, coordinators, project administrators, company administrators and finance users.')
page(d); head(d,'Start here')
para(d,'BIMLog connects project coordination, verified records, documents, accountability, reporting and handover. Always confirm the company, project, responsible party, status and evidence before saving or issuing a record.')
head(d,'Interactive access',2); link(d,'Open the interactive Help Center','/help'); link(d,'Open All Tools','/all-tools'); link(d,'Report a problem or suggestion','/feedback')
head(d,'Role journeys',2)
roles=[('Project user','Projects, files, RFIs, submittals and meetings'),('Coordinator','Command center, coordination, Lens and reports'),('Project administrator','Team, permissions, workflows and project setup'),('Company administrator','Catalogs, governance and integrations'),('Finance user','Budgets, contracts, APU and evidence')]
t=d.add_table(rows=1,cols=2); t.alignment=WD_TABLE_ALIGNMENT.CENTER
for i,v in enumerate(['Role','Recommended journey']): shade(t.cell(0,i),NAVY); cell(t.cell(0,i),v,True,'FFFFFF')
for a,b in roles: c=t.add_row().cells; cell(c[0],a,True); cell(c[1],b)

sections=[
('Access navigation and roles','Use Headquarters for daily work and All Tools for the complete authorized capability directory. Help returns to the page where it was opened.',['Sign in with your authorized account.','Confirm company and project.','Choose daily navigation or All Tools.','Open Help for a guided task.'],'BIMCORP_ALL_21_PROJECTS_LIVE.png'),
('Intake and operations','Intake prepares new work from controlled sources; Operations tracks active jobs, errors and deliverables.',['Choose the source and authorized destination.','Review the preview.','Confirm required fields.','Open Operations to monitor the result.'],'BLOCK34_BROWSER_intake-source-review/intake-source-mobile.png'),
('Coordination command center','Coordination records issues, responsibilities, priorities, status and evidence.',['Open the project and Coordination.','Create or open the issue.','Set trade, floor, responsible company, priority and status.','Attach evidence and save.','Refresh and reopen to confirm persistence.'],'P143_LOCAL_BROWSER/coordination-operations-mobile.png'),
('Files and document control','Files preserves documents with custody, version and project context.',['Choose the project folder.','Upload and classify the file.','Confirm version, status and responsible party.','Search and reopen the saved record.'],'P156_LOCAL_BROWSER/file-custody-review-mobile.png'),
('RFIs submittals and transmittals','These workflows preserve questions, reviews, formal deliveries and linked evidence.',['Create a complete draft.','Assign the responsible party and due date.','Attach supporting records.','Issue only after final review.','Preserve the response and decision history.'],None),
('Meetings changes and schedule','Meetings connect agenda, decisions and action items. Change orders preserve cause, impact, evidence and authorization.',['Prepare participants and agenda.','Record decisions and assign actions.','Link related RFIs, issues or change records.','Export the authorized minutes.'],'P175_BROWSER/meeting-detail-mobile.png'),
('Reports and exports','Reports summarize working records and link back to the operational module.',['Choose report, project, filters and period.','Review included records.','Generate and open the file.','Compare totals, dates and attachments.'],'P176_BROWSER/meeting-exports-es-mobile.png'),
('Lens and Navisworks','Lens binds the Navisworks model context to BIMLog issues and evidence.',['Confirm connection, BIMLog project and active model.','Review issue fields and viewpoint.','Review before creation.','If an outcome is pending, inspect and retry the unchanged draft.','Open the BIMLog record and verify persistence.'],'P125_LOCAL_BROWSER/lens-sync-mobile-es.png'),
('Procore and personal connections','Each user authorizes their own Procore account. BIMLog only exposes companies, projects and documents allowed by Procore.',['Open My Connections and choose Procore.','Sign in directly to Procore and authorize BIMLog.','Return to Integrations and choose company and project.','Tell the guided assistant what outcome or documents are needed.','Review the preview and confirm the governed import.'],'PROCORE_ACCOUNT_FLOW_FINAL_ACCEPTANCE/procore-confirmed-import-desktop.png'),
('Cost and financial control','Financial work connects cost structure, budgets, baselines, contracts, APU, payments and evidence.',['Confirm project and financial permission.','Prepare the cost structure and budget.','Preserve an approved baseline when authorized.','Record contracts, items, amendments and payments.','Export and compare with the approved record.'],'BLOCK18_LOCAL_BROWSER/financial-controls-desktop-en.png'),
('Company administration','Company administrators maintain catalogs, workflows, governance, pricing and directory data without removing legitimate capability.',['Choose the company configuration surface.','Edit the correct catalog or workflow.','Save with stable names and identifiers.','Verify the value in the operational form.','Deactivate rather than deleting historical values when supported.'],'bimlog-live-round3.png'),
('Help support and acceptance','Use Help for guided workflows, troubleshooting, downloads and release information.',['Save, refresh and reopen critical records.','Confirm permissions and project isolation.','Capture the full screen for any defect.','Report module, role, steps, expected and actual result, time and impact.'],None),
]
for title,desc,flow,pic in sections:
    page(d); head(d,title); para(d,desc); image(d,pic,title,3.1 if pic and 'desktop' not in pic and pic not in ['bimlog-live-round3.png','BIMCORP_ALL_21_PROJECTS_LIVE.png'] else 6.5) if pic else None; head(d,'Workflow',2); steps(d,flow)
head(d,'Acceptance checklist',2); bullets(d,['Correct role and project','Save refresh and reopen','Permissions and isolation','Expected success and error states','Exports match the displayed records','No unexplained console or network failure'])
finish(d,OUT/'BIMLog-User-Manual-EN.docx')

# Bilingual quick start
q=setup('QUICK START','Inicio rápido bilingüe · Bilingual quick start')
image(q,'BIMCORP_ALL_21_PROJECTS_LIVE.png','BIMLog Headquarters · Sede BIMLog',6.25)
page(q); head(q,'Primeros 10 minutos · First 10 minutes')
t=q.add_table(rows=1,cols=3); t.alignment=WD_TABLE_ALIGNMENT.CENTER
for i,v in enumerate(['Paso · Step','Español','English']): shade(t.cell(0,i),NAVY); cell(t.cell(0,i),v,True,'FFFFFF')
rows=[('1','Inicie sesión y confirme empresa y proyecto.','Sign in and confirm company and project.'),('2','Abra la Sede para ver el trabajo diario.','Open Headquarters for daily work.'),('3','Use Todas las herramientas para el catálogo completo.','Use All Tools for the complete directory.'),('4','Abra Ayuda desde la pantalla donde trabaja.','Open Help from the screen where you are working.'),('5','Guarde, actualice y vuelva a abrir.','Save, refresh and reopen.')]
for a,b,c0 in rows: cs=t.add_row().cells; cell(cs[0],a,True); cell(cs[1],b); cell(cs[2],c0)
page(q); head(q,'Recorridos · Journeys'); bullets(q,['Usuario de proyecto · Project user: archivos, RFIs, entregables y reuniones.','Coordinador · Coordinator: centro de mando, coordinación, Lens e informes.','Administrador · Administrator: equipo, permisos, catálogos, flujos e integraciones.','Finanzas · Finance: presupuesto, contratos, APU y evidencia.'])
link(q,'Centro de ayuda · Help Center','/help'); link(q,'Todas las herramientas · All Tools','/all-tools'); link(q,'Reportar un problema · Report a problem','/feedback')
page(q); head(q,'Procore · conexión personal'); steps(q,['Abra Mis conexiones · Open My Connections.','Seleccione Procore y conecte su propia cuenta · Choose Procore and connect your own account.','Seleccione compañía y proyecto autorizados · Choose an authorized company and project.','Explique al asistente qué necesita · Tell the assistant what you need.','Revise y confirme la importación · Review and confirm the import.']); image(q,'PROCORE_ACCOUNT_FLOW_FINAL_ACCEPTANCE/procore-confirmed-import-desktop.png','Procore governed import · Importación gobernada',6.4)
page(q); head(q,'Lens · creación segura'); steps(q,['Confirme proyecto y modelo · Confirm project and model.','Revise campos y punto de vista · Review fields and viewpoint.','Si existe un resultado pendiente, reintente el mismo borrador · If an outcome is pending, retry the unchanged draft.','Abra BIMLog y confirme persistencia · Open BIMLog and verify persistence.']); image(q,'P125_LOCAL_BROWSER/lens-sync-mobile-es.png','BIMLog Lens',3.0)
page(q); head(q,'Reporte de problemas · Issue report'); bullets(q,['Captura o video · Screenshot or video','Módulo y pantalla · Module and screen','Usuario o rol · User or role','Pasos exactos · Exact steps','Resultado esperado y obtenido · Expected and actual result','Fecha y hora · Date and time','Impacto · Impact']); para(q,'Nunca incluya contraseñas, secretos OAuth o tokens. · Never include passwords, OAuth secrets or tokens.')
finish(q,OUT/'BIMLog-Quick-Start-ES-EN.docx')
print(OUT/'BIMLog-User-Manual-EN.docx')
print(OUT/'BIMLog-Quick-Start-ES-EN.docx')
