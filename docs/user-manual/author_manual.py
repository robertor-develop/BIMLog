from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.style import WD_STYLE_TYPE

ROOT = Path(r"F:\BIMLog\Worktrees\bimlog-user-manual-20261105")
SHOTS = Path(r"C:\Users\soporte\Documents\Codex\2026-10-27\bimlog-main-04-06\outputs")
OUT = ROOT / "docs" / "user-manual" / "BIMLog-Manual-de-Usuario-ES.docx"

NAVY = "12304A"
BLUE = "146C94"
TEAL = "14866D"
PALE = "EAF4F7"
GRAY = "5D6B78"

def shade(cell, fill):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd'); shd.set(qn('w:fill'), fill); tcPr.append(shd)

def cell_text(cell, text, bold=False, color="1F2933", size=9):
    cell.text = ""
    p = cell.paragraphs[0]
    r = p.add_run(text); r.bold = bold; r.font.name = "Aptos"; r.font.size = Pt(size); r.font.color.rgb = RGBColor.from_string(color)
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER

def add_header(section):
    p = section.header.paragraphs[0]
    p.text = "BIMLog  |  Manual de Usuario"
    p.style = doc.styles["Caption"]
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT

def add_footer(section):
    p = section.footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("BIMLog · Guía operativa · v1.05.N18-P37")
    r.font.name = "Aptos"; r.font.size = Pt(8); r.font.color.rgb = RGBColor.from_string(GRAY)

def heading(text, level=1):
    p = doc.add_heading(text, level=level)
    p.paragraph_format.space_before = Pt(14 if level == 1 else 9)
    p.paragraph_format.space_after = Pt(5)
    return p

def body(text, bold_lead=None):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(5); p.paragraph_format.line_spacing = 1.08
    if bold_lead and text.startswith(bold_lead):
        p.add_run(bold_lead).bold = True
        p.add_run(text[len(bold_lead):])
    else: p.add_run(text)
    return p

def bullets(items):
    for item in items:
        p = doc.add_paragraph(style="List Bullet")
        p.paragraph_format.space_after = Pt(2)
        p.add_run(item)

def steps(items):
    for item in items:
        p = doc.add_paragraph(style="List Number")
        p.paragraph_format.space_after = Pt(3)
        p.add_run(item)

def tip(title, text):
    t = doc.add_table(rows=1, cols=2); t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.columns[0].width = Inches(.25); t.columns[1].width = Inches(6.55)
    shade(t.cell(0,0), TEAL); shade(t.cell(0,1), PALE)
    cell_text(t.cell(0,0), "", color="FFFFFF")
    cell_text(t.cell(0,1), f"{title}\n{text}", bold=False, size=9)
    doc.add_paragraph().paragraph_format.space_after = Pt(0)

def screenshot(rel, caption, width=6.75):
    path = SHOTS / rel
    if not path.exists():
        body(f"[Captura no disponible: {caption}]")
        return
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    shape = p.add_run().add_picture(str(path), width=Inches(width))
    shape._inline.docPr.set("descr", caption)
    shape._inline.docPr.set("title", caption)
    c = doc.add_paragraph(caption, style="Caption"); c.alignment = WD_ALIGN_PARAGRAPH.CENTER

def page(): doc.add_page_break()

doc = Document()
sec = doc.sections[0]
sec.page_width = Inches(8.5); sec.page_height = Inches(11)
sec.top_margin = Inches(.7); sec.bottom_margin = Inches(.65); sec.left_margin = Inches(.72); sec.right_margin = Inches(.72)
add_header(sec); add_footer(sec)

styles = doc.styles
styles["Normal"].font.name = "Aptos"; styles["Normal"].font.size = Pt(9.5); styles["Normal"].font.color.rgb = RGBColor.from_string("25313C")
for name, size in [("Title", 31), ("Subtitle", 15), ("Heading 1", 21), ("Heading 2", 14), ("Heading 3", 11)]:
    s = styles[name]; s.font.name = "Aptos Display" if "Heading" in name or name == "Title" else "Aptos"; s.font.size = Pt(size); s.font.color.rgb = RGBColor.from_string("111111"); s.font.bold = name != "Subtitle"
styles["Caption"].font.name = "Aptos"; styles["Caption"].font.size = Pt(8); styles["Caption"].font.color.rgb = RGBColor.from_string(GRAY)

# Cover
doc.add_paragraph().paragraph_format.space_after = Pt(65)
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("BIMLog"); r.font.name="Aptos Display"; r.font.size=Pt(42); r.bold=True; r.font.color.rgb=RGBColor.from_string(NAVY)
p = doc.add_paragraph(); p.alignment=WD_ALIGN_PARAGRAPH.CENTER
r=p.add_run("MANUAL DE USUARIO"); r.font.name="Aptos Display"; r.font.size=Pt(24); r.bold=True; r.font.color.rgb=RGBColor.from_string("111111")
p = doc.add_paragraph(); p.alignment=WD_ALIGN_PARAGRAPH.CENTER
r=p.add_run("Guía completa de operación de la plataforma"); r.font.size=Pt(15); r.font.color.rgb=RGBColor.from_string(BLUE)
doc.add_paragraph().paragraph_format.space_after = Pt(28)
screenshot("bimlog-live-round3.png", "BIMLog: plataforma de coordinación, registro verificado y entrega del proyecto", 6.25)
doc.add_paragraph().paragraph_format.space_after = Pt(18)
p=doc.add_paragraph(); p.alignment=WD_ALIGN_PARAGRAPH.CENTER
p.add_run("Versión de referencia: v1.05.N18-P37\nNoviembre de 2026").font.size=Pt(10)

page(); heading("Cómo usar este manual")
body("Este manual acompaña a usuarios de proyecto, coordinadores, administradores y responsables financieros en los recorridos cotidianos de BIMLog. Las pantallas disponibles dependen del rol, la empresa y el proyecto activo.")
tip("Principio de operación", "BIMLog mantiene un registro trazable. Antes de guardar o emitir, confirme el proyecto, el responsable, el estado y la evidencia adjunta.")
heading("Contenido",2)
toc = ["1. Acceso, navegación y roles","2. Sede, proyectos e ingreso de trabajo","3. Centro de mando y coordinación","4. Archivos y documentos","5. RFIs, entregables y transmisiones","6. Reuniones, cambios y programa","7. Reportes y exportaciones","8. BIMLog Lens y Navisworks","9. Integraciones, incluido Procore","10. Costos y control financiero","11. Configuración empresarial","12. Ayuda, soporte y solución de problemas"]
bullets(toc)
heading("Convenciones",2)
bullets(["Las capturas son ejemplos reales; los datos visibles pueden variar por proyecto.","Los botones de crear, aprobar, emitir, sincronizar o exportar requieren permisos aplicables.","Una acción queda completa cuando el registro persiste después de guardar, actualizar y volver a abrir.","La IA ayuda a preparar y clasificar; la autoridad y aprobación permanecen en el usuario autorizado."])

page(); heading("1. Acceso, navegación y roles")
body("Al ingresar, BIMLog presenta la Sede y las herramientas correspondientes al usuario. La navegación principal favorece el trabajo diario; Todas las herramientas conserva acceso visible al catálogo completo autorizado.")
screenshot("BIMCORP_ALL_21_PROJECTS_LIVE.png", "Sede de BIMLog con selector de proyecto y acceso al trabajo diario")
heading("Recorrido inicial",2)
steps(["Inicie sesión con su cuenta autorizada.","Confirme la empresa y el proyecto activo antes de trabajar.","Use la navegación principal para tareas diarias.","Abra Todas las herramientas para localizar cualquier módulo disponible.","Abra Ayuda desde la pantalla donde trabaja; BIMLog conserva el contexto de regreso."])
heading("Roles habituales",2)
t=doc.add_table(rows=1,cols=3); t.alignment=WD_TABLE_ALIGNMENT.CENTER
for i,v in enumerate(["Rol","Uso principal","Alcance"]): shade(t.cell(0,i),NAVY); cell_text(t.cell(0,i),v,True,"FFFFFF")
for row in [("Usuario de proyecto","Crear, revisar y consultar registros","Proyectos y acciones autorizadas"),("Coordinador","Coordinar incidencias, reuniones y entregables","Módulos de coordinación y reportes"),("Administrador de proyecto","Configurar equipo, flujos y catálogos","Proyecto asignado"),("Administrador de empresa","Gobierno, catálogos y usuarios","Empresa autorizada"),("Finanzas","Presupuesto, contratos, APU y evidencia","Controles financieros autorizados")]:
    cells=t.add_row().cells
    for i,v in enumerate(row): cell_text(cells[i],v,bold=i==0)

page(); heading("2. Sede, proyectos e ingreso de trabajo")
body("La Sede resume el contexto de la organización. Ingreso permite preparar un trabajo nuevo de forma controlada; Operaciones mantiene los trabajos activos y sus entregas.")
screenshot("BLOCK34_BROWSER_intake-source-review/intake-source-mobile.png", "Ingreso: selección de fuente y preparación del trabajo", 3.1)
heading("Crear o preparar un trabajo",2)
steps(["Abra Ingreso y seleccione la fuente del trabajo.","Identifique empresa, proyecto, disciplina y archivos de entrada.","Revise la vista previa preparada antes de crear registros.","Confirme los campos obligatorios y el destino.","Abra Operaciones para seguir el progreso, errores y resultados."])
tip("No duplique proyectos", "Busque primero por nombre, código y empresa. Si existe un proyecto, ábralo en lugar de crear otro registro con un nombre parecido.")
screenshot("BLOCK35_FINAL_BROWSER/P171/intake-agent-preview-mobile.png", "Vista previa del agente de ingreso antes de ejecutar", 3.1)

page(); heading("3. Centro de mando y coordinación")
body("El Centro de mando reúne el estado operativo del proyecto y conduce a los registros que requieren acción. Coordinación organiza incidencias, responsables, prioridades y evidencia.")
screenshot("P143_LOCAL_BROWSER/coordination-operations-mobile.png", "Operaciones de coordinación en formato móvil", 3.1)
heading("Gestionar una incidencia",2)
steps(["Confirme el proyecto y abra Coordinación.","Cree o seleccione la incidencia.","Defina especialidad, piso, empresa responsable, prioridad y estado.","Adjunte la evidencia o el punto de vista correspondiente.","Guarde y vuelva a abrir el registro para confirmar persistencia.","Use el historial para revisar responsables, cambios y siguiente acción."])
heading("Estados visibles",2)
bullets(["Abierto: requiere análisis o acción.","En progreso: existe un responsable y trabajo activo.","En revisión: la solución espera verificación.","Cerrado: la resolución y evidencia han sido aceptadas por la autoridad aplicable."])

page(); heading("4. Archivos y documentos")
body("Archivos conserva documentos del proyecto con contexto, custodia y búsqueda. El generador de carpetas y el constructor de convención ayudan a mantener una estructura coherente sin reemplazar el documento original.")
screenshot("P156_LOCAL_BROWSER/file-custody-review-mobile.png", "Custodia de archivos y evidencia", 3.1)
heading("Operación recomendada",2)
steps(["Abra Archivos desde el proyecto.","Seleccione la carpeta o use el asistente de estructura.","Cargue el archivo y complete clasificación, descripción y relación con el proyecto.","Revise nombre, versión, estado y responsable.","Busque el documento por nombre, módulo o contexto.","Descargue o exporte únicamente la versión autorizada."])
screenshot("P172_BROWSER/folder-wizard-mobile.png", "Asistente para una estructura de carpetas consistente", 3.1)
tip("Fidelidad documental", "BIMLog no debe recortar, deformar ni degradar dibujos o documentos incluidos en una entrega formal. Revise siempre el archivo final exportado.")

page(); heading("5. RFIs, entregables y transmisiones")
body("Estos módulos conservan preguntas, respuestas, revisiones, emisiones y relaciones entre registros. Cada flujo muestra qué falta, quién puede actuar y cuál es el siguiente paso.")
heading("RFI",2)
steps(["Abra RFIs y seleccione Crear RFI.","Redacte una pregunta específica y vincule planos, archivos o incidencias.","Asigne responsable y fecha requerida.","Guarde el borrador; emita únicamente cuando el contenido esté completo.","Registre la respuesta y cierre con evidencia aceptada."])
heading("Entregables",2)
steps(["Registre el entregable y su especificación.","Asigne responsables y fechas.","Adjunte la revisión correspondiente.","Registre comentarios y decisión.","Mantenga el historial de revisiones y exporte el registro cuando sea necesario."])
heading("Transmisiones",2)
body("Use transmisiones para documentar una entrega formal de archivos o registros. Confirme destinatarios, contenido exacto, propósito y comprobante antes de emitir.")
tip("Emisión controlada", "Guardar un borrador no equivale a emitir. Revise destinatarios y anexos antes de cualquier entrega externa.")

page(); heading("6. Reuniones, cambios y programa")
screenshot("P175_BROWSER/meeting-detail-mobile.png", "Reuniones: agenda, participantes y acciones", 3.1)
heading("Reuniones",2)
steps(["Cree la reunión con proyecto, fecha y participantes.","Prepare agenda y vincule registros relevantes.","Durante la reunión, documente decisiones y acciones.","Asigne cada acción a una persona con fecha requerida.","Publique o exporte el acta autorizada y verifique sus vínculos."])
screenshot("P116_LOCAL_BROWSER/change-order-mobile.png", "Órdenes de cambio: registro y trazabilidad", 3.1)
heading("Órdenes de cambio y programa",2)
body("Una orden de cambio debe conservar causa, alcance, impacto, responsables, evidencia y decisión. El programa vincula fechas y actividades sin convertir una sugerencia automática en aprobación contractual.")
bullets(["Nunca trate una estimación como monto aprobado.","Vincule las decisiones de reunión con la orden o actividad correspondiente.","Revise fechas, dependencias y responsables después de cualquier ajuste."])

page(); heading("7. Reportes y exportaciones")
body("Los reportes resumen registros verificables y conducen al detalle. Una tarjeta o indicador nunca sustituye el módulo operativo donde se realiza el trabajo.")
screenshot("P176_BROWSER/meeting-exports-es-mobile.png", "Centro de exportaciones y resultados disponibles", 3.1)
steps(["Abra Reportes y elija el informe.","Confirme proyecto, filtros, período e idioma.","Revise los registros incluidos.","Genere el archivo.","Abra el resultado y compruebe legibilidad, conteos, fechas y anexos.","Conserve el comprobante de generación cuando el informe sea formal."])
tip("Comprobación mínima", "Compare el total mostrado en pantalla con el total exportado. Confirme también filtros, zona horaria y versión del registro.")

page(); heading("8. BIMLog Lens y Navisworks")
body("BIMLog Lens conecta el contexto del modelo Navisworks con incidencias y evidencia de BIMLog. El vínculo correcto depende del proyecto, modelo y punto de vista exactos.")
screenshot("P125_LOCAL_BROWSER/lens-sync-mobile-es.png", "Sincronización de BIMLog Lens", 3.1)
heading("Flujo de Lens",2)
steps(["Abra BIMLog Lens y confirme la conexión.","Seleccione el proyecto BIMLog que corresponde al modelo activo.","Revise especialidad, piso, empresa responsable, prioridad y tipo de reporte.","Capture o seleccione el punto de vista.","Revise la creación antes de enviar.","Si existe un resultado pendiente, inspeccione ese proyecto y reintente el mismo borrador antes de iniciar otro.","Abra el registro en BIMLog y confirme evidencia, persistencia e historial."])
screenshot("P129_LOCAL_BROWSER/lens-export-mobile.png", "Exportación controlada desde Lens", 3.1)
heading("Cuando una creación queda detenida",2)
bullets(["No cambie el proyecto ni el contenido del borrador hasta resolver el resultado pendiente.","Use la acción de reintento para evitar duplicados.","Si el registro ya existe, vincúlelo en lugar de volver a crearlo.","Documente el mensaje, proyecto, hora y modelo si requiere soporte."])

page(); heading("9. Integraciones: Procore y conexiones personales")
body("Cada usuario conecta su propia cuenta externa desde Mis conexiones. BIMLog usa la autorización del usuario y solo presenta las compañías, proyectos y documentos que ese usuario puede consultar en el proveedor.")
screenshot("P106_LOCAL_BROWSER/my-connections-mobile.png", "Mis conexiones: integraciones personales", 3.1)
heading("Conectar Procore",2)
steps(["Abra Perfil o Configuración y seleccione Mis conexiones.","Elija Procore y pulse Conectar.","Inicie sesión directamente en Procore con sus propias credenciales.","Autorice la aplicación BIMLog.","Regrese a BIMLog y confirme el estado Conectado.","Abra Integraciones dentro del proyecto y seleccione el origen Procore.","Elija la compañía y el proyecto disponibles para su cuenta.","Indique al asistente qué desea lograr o qué documentos necesita importar.","Revise la vista previa y confirme antes de crear o importar registros."])
screenshot("PROCORE_ACCOUNT_FLOW_FINAL_ACCEPTANCE/procore-confirmed-import-desktop.png", "Flujo confirmado de selección e importación desde Procore", 6.5)
tip("Credenciales personales", "BIMLog no requiere reprogramación por usuario. Cada persona autoriza su propia cuenta; los permisos efectivos siguen siendo los concedidos por Procore.")
heading("Si no aparecen compañías o proyectos",2)
bullets(["Confirme que ingresó con la cuenta Procore correcta.","Verifique en Procore que esa cuenta tenga acceso a la compañía y al proyecto.","Desconecte y vuelva a conectar únicamente si la autorización expiró o cambió.","No comparta contraseñas; reporte el estado y el nombre de la compañía al administrador."])

page(); heading("10. Costos y control financiero")
screenshot("BLOCK18_LOCAL_BROWSER/financial-controls-desktop-en.png", "Controles financieros: presupuesto, contratos y evidencia")
body("La dimensión financiera conecta estructura de costos, presupuesto, contratos, partidas, APU, pagos y evidencia. Los permisos financieros son independientes de la visibilidad general del proyecto.")
steps(["Abra Control financiero y confirme el proyecto.","Revise o prepare la estructura de costos.","Cargue o edite presupuesto con identificadores estables.","Guarde una instantánea aprobada cuando corresponda.","Registre contratos, partidas, enmiendas y pagos con evidencia.","Use APU para documentar composición de costos.","Compare registros contra la instantánea aprobada y exporte el resultado."])
screenshot("P168_BROWSER/approved-snapshot-mobile.png", "Instantánea aprobada del presupuesto", 3.1)
tip("Autoridad financiera", "Un cálculo o importación no constituye aprobación. BIMLog conserva el dato, la fuente y la decisión del usuario autorizado.")

page(); heading("11. Configuración empresarial")
body("Los administradores organizan catálogos maestros, flujos de trabajo, gobierno, precios y directorio. Esta configuración controla opciones disponibles sin ocultar capacidades legítimas.")
screenshot("bimlog-live-round3.png", "Catálogos maestros de empresa y navegación administrativa")
heading("Catálogos y responsables",2)
steps(["Abra Configuración de empresa o Catálogos maestros.","Seleccione el catálogo: especialidades, pisos, empresas responsables, tipos u otros.","Agregue o edite valores con nombres claros y estables.","Guarde y confirme que el valor aparezca en el formulario operativo.","No elimine valores utilizados por registros históricos; desactívelos cuando la función lo permita."])
heading("Flujos y gobierno",2)
body("Gobierno de flujos controla qué procesos de la empresa están aprobados y disponibles para los proyectos. La configuración debe explicar propósito, estados, participantes y autoridad.")
tip("Valores desaparecidos", "Si un catálogo aparece vacío, revise primero empresa, proyecto y permisos. Un valor reconstruido manualmente debe conservar su identidad y no duplicar un registro existente.")

page(); heading("12. Ayuda, soporte y solución de problemas")
body("El Centro de ayuda incluye manual interactivo, guías rápidas, solución de problemas, información de versiones y este manual descargable. Al abrir Ayuda desde un módulo, el enlace de regreso conserva la pantalla de origen.")
heading("Antes de reportar",2)
steps(["Actualice la pantalla una vez y vuelva a abrir el registro.","Confirme empresa, proyecto, usuario y rol.","Repita el último paso sin crear duplicados.","Revise el mensaje visible y el estado de red si está disponible.","Capture toda la pantalla, incluida fecha aproximada y contexto."])
heading("Información para soporte",2)
bullets(["Captura o video.","Módulo y pantalla.","Usuario o rol utilizado.","Pasos exactos para reproducir.","Resultado esperado y resultado obtenido.","Fecha y hora aproximadas.","Impacto: bloqueante, importante o menor.","Proyecto, registro y versión cuando sean visibles."])
heading("Comprobación de persistencia",2)
steps(["Guarde el registro.","Actualice la página.","Vuelva a abrir el registro.","Confirme datos, anexos, responsables, estado e historial.","Realice una entrada limpia en otra pestaña autorizada para los recorridos críticos."])
tip("Privacidad", "Nunca incluya contraseñas, secretos OAuth, tokens o información confidencial innecesaria en una captura o solicitud de soporte.")

page(); heading("Lista de aceptación del usuario")
body("Use esta lista al terminar una prueba piloto, una capacitación o una validación de versión.")
checks = ["Acceso e inicio de sesión","Navegación principal y Todas las herramientas","Selección de empresa y proyecto","Ingreso y Operaciones","Coordinación e incidencias","Archivos y búsqueda","RFIs y entregables","Transmisiones","Reuniones y acciones","Órdenes de cambio y programa","Reportes y exportaciones","Lens y Navisworks, si aplica","Procore y otras integraciones, si aplican","Costos y control financiero, si aplica","Catálogos y configuración, si aplica","Guardar, actualizar y volver a abrir","Permisos por rol y aislamiento del proyecto","Ayuda, soporte y regreso al contexto"]
t=doc.add_table(rows=1, cols=3); t.alignment=WD_TABLE_ALIGNMENT.CENTER
for i,v in enumerate(["Recorrido","Resultado","Observaciones"]): shade(t.cell(0,i),NAVY); cell_text(t.cell(0,i),v,True,"FFFFFF")
for item in checks:
    c=t.add_row().cells; cell_text(c[0],item); cell_text(c[1],"Pendiente / Aprobado"); cell_text(c[2],"")
page(); heading("Glosario breve")
terms=[("RFI","Solicitud formal de información."),("Entregable / Submittal","Documento o elemento sometido a revisión y decisión."),("Transmisión","Entrega controlada de documentos o registros."),("Incidencia","Asunto de coordinación que requiere responsable, estado y evidencia."),("Punto de vista","Contexto visual guardado desde el modelo."),("APU","Análisis de precio unitario."),("Instantánea aprobada","Versión preservada del presupuesto utilizada como referencia."),("Custodia","Registro de origen, versión, responsable y trazabilidad de un archivo."),("Resultado pendiente","Creación cuyo desenlace debe comprobarse antes de repetirla."),("Todas las herramientas","Directorio visible de todas las capacidades autorizadas.")]
t=doc.add_table(rows=0,cols=2); t.alignment=WD_TABLE_ALIGNMENT.CENTER
for a,b in terms:
    c=t.add_row().cells; shade(c[0],PALE); cell_text(c[0],a,True,NAVY); cell_text(c[1],b)
heading("Cierre",2)
body("BIMLog está diseñado para que el trabajo sea completo, descubrible, comprensible y trazable. El usuario puede seguir un recorrido guiado o acceder directamente al módulo autorizado, sin perder la relación entre acción, evidencia y resultado.")

for table in doc.tables:
    if table.rows:
        tr_pr = table.rows[0]._tr.get_or_add_trPr()
        header = OxmlElement("w:tblHeader")
        header.set(qn("w:val"), "true")
        tr_pr.append(header)

OUT.parent.mkdir(parents=True, exist_ok=True)
doc.save(OUT)
print(OUT)
