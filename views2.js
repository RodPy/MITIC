/* Laboratorios TIC · prototipo conceptual — vistas de gestión */

/* ---------- aula (facilitador) ---------- */
function vistaAula() {
  const sede = sedeActiva();
  const est = S.usuarios.filter((u) => u.rol === "estudiante" && u.sedes.includes(sede));
  const porRevisar = proyectosPorRevisar(sede);
  return `<h1 tabindex="-1">Mi aula</h1><p class="sub">${esc(sedeNombre(sede))}</p>
    <section class="card"><h2>Bitácoras para leer (${porRevisar.length})</h2>${porRevisar.length ? `<ul class="lista">${porRevisar.map((p) => `<li>${link("proyecto/" + p.id, esc(p.titulo))}<span>${esc(nombresEquipo(p))} · «${esc(p.bitacora.at(-1).texto.slice(0, 90))}…»</span></li>`).join("")}</ul>` : vacio(est.length ? "Estás al día." : "Esta sede todavía no tiene estudiantes cargados en la demo.")}</section>
    <section class="card"><h2>Estudiantes y habilitaciones de seguridad</h2>
      <p class="nota">Un estudiante solo puede reservar un equipo si completó la capacitación previa. Marcá la habilitación cuando la apruebe.</p>
      ${est.length ? `<div class="tabla-wrap"><table class="tabla"><thead><tr><th>Estudiante</th><th>Proyectos</th><th>Avance</th>${CATEGORIAS_RESERVABLES.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>
      ${est.map((e) => {
        const pr = S.proyectos.filter((p) => p.equipo.includes(e.id));
        const av = pr.length ? avg(pr.map((p) => pasoFlujo(p).filter(Boolean).length / 8 * 100)) : 0;
        return `<tr><th scope="row">${esc(e.nombre)}<br><small>${esc(e.curso)}</small></th><td>${pr.map((p) => link("proyecto/" + p.id, esc(p.titulo))).join("<br>") || "—"}</td><td>${barra(av)}</td>
        ${CATEGORIAS_RESERVABLES.map((c) => `<td class="centro"><input type="checkbox" aria-label="${esc(e.nombre)} habilitado para ${c}" data-change="habilitar" data-u="${e.id}" data-c="${esc(c)}" ${(S.habilitaciones[e.id] || []).includes(c) ? "checked" : ""}></td>`).join("")}</tr>`;
      }).join("")}</tbody></table></div>` : vacio("Sin estudiantes.")}
    </section>
    <div class="grid2">
      <section class="card"><h2>Reporte pedagógico cualitativo</h2>${est.length ? `<ul class="lista">${est.map((e) => reporteCualitativo(e)).join("")}</ul>` : vacio("—")}</section>
      <section class="card"><h2>Formación continua para facilitadores</h2><p><strong>Mentoría con enfoque construccionista</strong></p>${barra(40)}<p class="meta">Módulo 2 de 5: «Preguntar en lugar de responder»</p>
        <div class="acciones">${link("reservas", "Gestor de reservas", "btn sec")}${link("soporte", "Tickets de soporte", "btn sec")}</div></section>
    </div>`;
}

function reporteCualitativo(e) {
  const pr = S.proyectos.filter((p) => p.equipo.includes(e.id));
  const b = pr.flatMap((p) => p.bitacora);
  const n = (t) => b.filter((x) => x.tipo === t).length;
  const vers = Math.max(0, ...pr.flatMap((p) => p.entregas.map((x) => x.version)));
  const frases = [];
  if (n("prueba") >= 1) frases.push(`documenta sus pruebas y errores (${n("prueba")})`);
  if (n("aprendizaje") >= 1) frases.push("reflexiona sobre lo aprendido");
  else frases.push("todavía no registra reflexiones: conviene preguntarle qué aprendió");
  if (vers >= 2) frases.push(`itera (llegó a la versión ${vers})`);
  return `<li><strong>${esc(e.nombre)}</strong><span>${frases.join("; ")}.</span></li>`;
}

/* ---------- portfolio y consentimientos (tutor) ---------- */
function vistaPortfolio() {
  const u = yo();
  return u.pupilos.map(usuario).map((e) => {
    const pr = S.proyectos.filter((p) => p.equipo.includes(e.id));
    const hist = S.consentimientos.filter((k) => k.estudianteId === e.id).slice().reverse();
    const toggle = (tipo, titulo, desc) => {
      const on = consentimientoVigente(e.id, tipo);
      return `<div class="consent"><div><strong>${titulo}</strong><p class="meta">${desc}</p></div>
        <button class="switch ${on ? "on" : ""}" role="switch" aria-checked="${on}" data-act="consentir" data-e="${e.id}" data-t="${tipo}" aria-label="${titulo}"><span></span></button></div>`;
    };
    return `<h1 tabindex="-1">Portfolio de ${esc(e.nombre)}</h1><p class="sub">${esc(sedeNombre(e.sedes[0]))} · ${esc(e.curso)} · vista de solo lectura</p>
      <div class="grid2 ancho"><section class="card"><h2>Proyectos</h2><ul class="lista">${pr.map((p) => `<li>${link("proyecto/" + p.id, esc(p.titulo))}<span>${p.entregas.length} entregas · ${p.feedback.length} devoluciones ${p.publicado ? badge("Publicado", "ok") : p.solicitaPublicar ? badge("Pide publicar", "warn") : badge("Privado", "muted")}</span></li>`).join("")}</ul>
        <p>${insignias(e.id).map(([i, t]) => `<span class="insignia"><span aria-hidden="true">${i}</span> ${t}</span>`).join(" ")}</p></section>
      <section class="card"><h2>Consentimientos</h2>
        ${toggle("publicar_proyectos", "Publicar proyectos fuera de la sede", "Permite que sus proyectos aparezcan en el Banco de Proyectos con su nombre de pila e inicial.")}
        ${toggle("imagenes", "Publicar imágenes", "Fotos y videos donde aparezca, fuera de la sede.")}
        <h3>Historial (versionado y revocable)</h3><ul class="lista chica">${hist.map((k) => `<li><strong>${k.tipo === "imagenes" ? "Imágenes" : "Publicar proyectos"}: ${k.otorgado ? "otorgado" : "revocado"}</strong><span>v${k.version} · ${fmtFechaHora(k.fecha)}</span></li>`).join("") || vacio("Sin registros.")}</ul>
      </section></div>`;
  }).join("");
}

/* ---------- reservas ---------- */
function labsGestionables() {
  const u = yo();
  if (["admin", "soporte"].includes(u.rol)) return S.labs.filter((l) => l.estado === "operativo");
  return (u.sedes || []).map(labDeSede).filter(Boolean);
}
function labTrabajo() {
  const u = yo();
  if (["admin", "soporte"].includes(u.rol)) return lab(UI.labSel) || labDeSede(SEDE_A);
  return labActivo();
}
const selectorLab = () => {
  const u = yo();
  if (!["admin", "soporte"].includes(u.rol)) return "";
  const l = labTrabajo();
  return `<label class="sel-lab">Laboratorio <select data-change="lab-sel">${labsGestionables().map((x) => `<option value="${x.id}" ${x.id === l.id ? "selected" : ""}>${esc(SEDE_POR_ID[x.sedeId].nombre)} (${esc(SEDE_POR_ID[x.sedeId].depto)})</option>`).join("")}</select></label>`;
};

function vistaReservas() {
  const u = yo();
  const l = labTrabajo();
  if (!l || l.estado !== "operativo") return `<h1 tabindex="-1">Reservas</h1>${vacio("El laboratorio de esta sede todavía no está operativo.")}`;
  const dia = UI.dia || primerDiaReservable();
  const dias = Array.from({ length: 7 }, (_, i) => isoDate(addDays(new Date(primerDiaReservable() + "T12:00"), i)));
  const acts = S.activos.filter((a) => a.labId === l.id && a.reservable);
  const gestor = u.rol !== "estudiante";
  const resDia = S.reservas.filter((r) => r.fecha === dia && reservaVigente(r));
  const sel = UI.sel;
  let panel = "";
  if (sel?.activoId) {
    const a = activo(sel.activoId);
    panel = `<form class="card panel-sel" data-form="reservar"><h2>Reservar ${esc(a.modelo)}</h2><p>${fmtFecha(dia + "T12:00")} · ${sel.hora}:00 a ${sel.hora + 1}:00 h</p>
      <label>¿Para qué lo vas a usar? <input name="motivo" required placeholder="Ej.: imprimir la versión 2 del soporte" autofocus></label>
      <div class="acciones"><button type="button" class="sec" data-act="sel-cerrar">Cancelar</button><button>Confirmar reserva</button></div></form>`;
  } else if (sel?.reservaId) {
    const r = S.reservas.find((x) => x.id === sel.reservaId);
    const propia = r.userId === u.id;
    panel = `<div class="card panel-sel"><h2>${esc(activo(r.activoId).modelo)} · ${r.hora}:00 h</h2><p>${esc(propia ? "Tu reserva" : usuario(r.userId).nombre)} ${estadoBadge(r.estado)}<br>${esc(r.motivo || "")}</p>
      <div class="acciones"><button type="button" class="sec" data-act="sel-cerrar">Cerrar</button>
      ${r.estado === "confirmada" && propia && r.fecha === hoy() ? `<button data-act="checkin" data-r="${r.id}">Hacer check-in (QR de la máquina)</button>` : ""}
      ${r.estado === "confirmada" && (propia || gestor) ? `<button class="peligro" data-act="cancelar-reserva" data-r="${r.id}">Cancelar reserva</button>` : ""}</div></div>`;
  }
  const mis = S.reservas.filter((r) => r.userId === u.id && r.fecha >= hoy() && reservaVigente(r));
  return `<h1 tabindex="-1">Reservas de equipos</h1><p class="sub">${esc(l.nombre)}</p>${selectorLab()}
    <div class="dias" role="group" aria-label="Día">${dias.map((d) => `<button class="${d === dia ? "on" : ""}" aria-pressed="${d === dia}" data-act="dia" data-d="${d}">${new Date(d + "T12:00").toLocaleDateString("es-PY", { weekday: "short", day: "numeric" })}</button>`).join("")}</div>
    ${panel}
    <div class="tabla-wrap"><table class="grilla"><caption class="sr">Turnos por equipo</caption><thead><tr><th>Equipo</th>${HORAS.map((h) => `<th>${h}h</th>`).join("")}</tr></thead><tbody>
    ${acts.map((a) => `<tr class="${a.estado !== "operativo" ? "fuera" : ""}"><th scope="row">${esc(a.modelo)}<br><small>${esc(a.categoria)}${u.rol === "estudiante" && !(S.habilitaciones[u.id] || []).includes(a.categoria) ? " · 🔒 requiere habilitación" : ""}</small></th>
      ${a.estado !== "operativo" ? `<td colspan="${HORAS.length}" class="fuera-txt">Fuera de servicio · ver ticket de soporte</td>` : HORAS.map((h) => {
        const r = resDia.find((x) => x.activoId === a.id && x.hora === h);
        const pasado = dia === hoy() && h < new Date().getHours();
        if (r) {
          const propia = r.userId === u.id;
          const txt = propia ? "Tuya" : gestor ? nombrePublico(usuario(r.userId)) : "Ocupado";
          return `<td><button class="celda ${propia ? "mia" : "ocupada"} ${r.estado}" data-act="sel-reserva" data-r="${r.id}" ${!propia && !gestor ? "disabled" : ""} aria-label="${h} h ${txt}">${esc(txt)}</button></td>`;
        }
        return `<td><button class="celda libre" data-act="sel-turno" data-a="${a.id}" data-h="${h}" ${pasado ? "disabled" : ""} aria-label="Reservar ${esc(a.modelo)} a las ${h} h">${pasado ? "" : "Libre"}</button></td>`;
      }).join("")}</tr>`).join("")}
    </tbody></table></div>
    <div class="grid2">
      <section class="card"><h2>Mis reservas</h2>${mis.length ? `<ul class="lista">${mis.map((r) => `<li><strong>${esc(activo(r.activoId).modelo)}</strong><span>${fmtFecha(r.fecha + "T12:00")} · ${r.hora}:00 h ${estadoBadge(r.estado)}</span></li>`).join("")}</ul>` : vacio("No tenés reservas próximas.")}</section>
      <section class="card"><h2>Reglas de uso</h2><ul class="reglas">
        <li>Turnos de 1 hora, de 8 a 17 h, sin superposiciones.</li>
        <li>Estudiantes: hasta ${MAX_RESERVAS_ESTUDIANTE} reservas activas y solo en equipos para los que están habilitados.</li>
        <li>Check-in escaneando el QR de la máquina; sin check-in a los 15 min el turno se libera.</li>
        <li>Facilitador y director pueden reorganizar o cancelar turnos.</li></ul></section>
    </div>`;
}

/* ---------- inventario ---------- */
function vistaInventario() {
  const u = yo();
  const l = labTrabajo();
  if (!l) return vacio("Sin laboratorio.");
  const nivel = puede("Gestionar inventario de la sede");
  const acts = S.activos.filter((a) => a.labId === l.id);
  const cons = S.consumibles.filter((c) => c.labId === l.id);
  const tab = tabActiva("inv", "activos");
  const gar = acts.map((a) => a.garantiaHasta).sort()[0];
  return `<h1 tabindex="-1">Inventario</h1><p class="sub">${esc(l.nombre)} ${estadoBadge(l.estado)} · ${esc(l.plantilla || "sin plantilla")}${gar ? ` · garantía hasta ${fmtFecha(gar + "T12:00")}` : ""}</p>${selectorLab()}
    <div class="kpis">${kpi("Activos (Lote 1 y 2)", sum(acts.map((a) => a.cantidad)))}${kpi("Fuera de servicio", acts.filter((a) => a.estado === "fuera de servicio").length, "", acts.some((a) => a.estado === "fuera de servicio") ? "alerta" : "")}${kpi("Consumibles bajo mínimo", stockBajo(l.id).length, "", stockBajo(l.id).length ? "alerta" : "")}</div>
    ${tabs("inv", [["activos", "Activos"], ["consumibles", "Consumibles"]])}
    ${tab === "activos" ? `<div class="tabla-wrap"><table class="tabla"><thead><tr><th>Categoría</th><th>Modelo</th><th>Lote</th><th>Cant.</th><th>N.º de serie</th><th>Estado</th><th>Acción</th></tr></thead><tbody>
      ${acts.map((a) => `<tr><td>${esc(a.categoria)}</td><td>${esc(a.modelo)}</td><td>${a.lote}</td><td>${a.cantidad}</td><td><code>${esc(a.serie || "—")}</code></td><td>${estadoBadge(a.estado)}</td>
        <td>${a.estado === "operativo" ? `<button class="mini sec" data-act="reportar-falla" data-a="${a.id}">Reportar falla</button>` : a.estado === "fuera de servicio" && nivel === PF ? `<button class="mini sec" data-act="activo-ok" data-a="${a.id}">Marcar operativo</button>` : ""}</td></tr>`).join("")}
      </tbody></table></div>` : `<div class="tabla-wrap"><table class="tabla"><thead><tr><th>Consumible</th><th>Stock</th><th>Nivel</th><th>Mínimo</th><th>Acciones</th></tr></thead><tbody>
      ${cons.map((c) => `<tr class="${c.stock < c.minimo ? "fila-alerta" : ""}"><td>${esc(c.nombre)} ${c.stock < c.minimo ? badge("Bajo mínimo", "bad") : ""}</td><td>${c.stock} ${esc(c.unidad)}</td><td>${barra(c.stock / (c.minimo * 3) * 100, c.stock < c.minimo ? "mal" : "")}</td><td>${c.minimo}</td>
        <td><button class="mini sec" data-act="consumir" data-c="${c.id}">− Registrar consumo</button>${nivel === PF ? ` <button class="mini" data-act="reponer" data-c="${c.id}">＋ Reponer</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="5">${vacio("Sin consumibles: se cargan al activar el laboratorio.")}</td></tr>`}
      </tbody></table></div><p class="nota">Al registrar un consumo se revisa el stock; si baja del mínimo se avisa al director y al facilitador.</p>`}`;
}

/* ---------- laboratorios (admin) ---------- */
function vistaLaboratorios() {
  const tab = tabActiva("labs", "mapa");
  const cuenta = (e) => S.labs.filter((l) => l.estado === e).length;
  let cont = "";
  if (tab === "mapa") cont = `<div id="mapa" class="mapa" role="region" aria-label="Mapa de laboratorios"></div><p class="leyenda"><span class="dot op"></span> operativo <span class="dot inst"></span> en instalación <span class="dot plan"></span> planificado · Ubicación aproximada por departamento (la planilla no trae coordenadas).</p>`;
  if (tab === "lista") {
    const f = UI.filtros;
    const deptos = [...new Set(S.labs.map((l) => SEDE_POR_ID[l.sedeId].depto))].sort();
    const lista = S.labs.filter((l) => {
      const s = SEDE_POR_ID[l.sedeId];
      return (!f.depto || s.depto === f.depto) && (!f.estado || l.estado === f.estado) && (!f.q || (s.nombre + s.distrito).toLowerCase().includes(f.q.toLowerCase()));
    });
    cont = `<div class="filtros"><label>Buscar <input data-change="filtro" data-f="q" value="${esc(f.q || "")}" placeholder="Nombre o distrito"></label>
      <label>Departamento <select data-change="filtro" data-f="depto"><option value="">Todos</option>${deptos.map((d) => `<option ${f.depto === d ? "selected" : ""}>${esc(d)}</option>`).join("")}</select></label>
      <label>Estado <select data-change="filtro" data-f="estado"><option value="">Todos</option>${["operativo", "en instalación", "planificado"].map((e) => `<option ${f.estado === e ? "selected" : ""}>${e}</option>`).join("")}</select></label></div>
      <p class="meta">Mostrando ${Math.min(60, lista.length)} de ${lista.length}</p>
      <div class="tabla-wrap"><table class="tabla"><thead><tr><th>Sede</th><th>Departamento</th><th>Zona</th><th>Tipología STEAM</th><th>Matrícula media</th><th>Fase</th><th>Estado</th></tr></thead><tbody>
      ${lista.slice(0, 60).map((l) => { const s = SEDE_POR_ID[l.sedeId]; return `<tr><td>${esc(s.nombre)}<br><small>${esc(s.distrito)}</small></td><td>${esc(s.depto)}</td><td>${esc(s.zona)}</td><td>${esc(s.tipNombre)} · ${esc(s.perfil)}</td><td>${s.media}</td><td>${l.fase}</td><td>${estadoBadge(l.estado)}</td></tr>`; }).join("")}
      </tbody></table></div>`;
  }
  if (tab === "nuevo") cont = vistaAsistente();
  if (tab === "masiva") {
    const plan = S.labs.filter((l) => l.estado === "planificado");
    cont = `<section class="card"><h2>Carga masiva</h2><p>Los laboratorios idénticos se importan desde una planilla (Excel/CSV) y reciben la misma plantilla en un solo paso. Ya están cargadas las <strong>${SEDES_CON_LAB.length} escuelas seleccionadas</strong> de la planilla de tipologías STEAM.</p>
      <p><strong>${plan.length}</strong> laboratorios planificados recibirán la plantilla <strong>${PLANTILLA_ESTANDAR.nombre} v${PLANTILLA_ESTANDAR.version}</strong> (${PLANTILLA_ESTANDAR.items.length} ítems, ${sum(PLANTILLA_ESTANDAR.items.map((i) => i.cantidad))} unidades). Se generan los activos pendientes de recepción.</p>
      <div class="acciones"><button data-act="carga-masiva" ${plan.length ? "" : "disabled"}>Aplicar plantilla a ${plan.length} laboratorios</button></div></section>
      <section class="card"><h2>Plantilla vigente: ${PLANTILLA_ESTANDAR.nombre}</h2><table class="tabla"><thead><tr><th>Categoría</th><th>Modelo</th><th>Cantidad</th><th>Lote</th></tr></thead><tbody>${PLANTILLA_ESTANDAR.items.map((i) => `<tr><td>${esc(i.categoria)}</td><td>${esc(i.modelo)}</td><td>${i.cantidad}</td><td>${i.lote}</td></tr>`).join("")}</tbody></table></section>`;
  }
  return `<h1 tabindex="-1">Laboratorios</h1>
    <div class="kpis">${kpi("Total", S.labs.length)}${kpi("Operativos", cuenta("operativo"), "fase inicial")}${kpi("En instalación", cuenta("en instalación"))}${kpi("Planificados", cuenta("planificado"), "expansión")}</div>
    ${tabs("labs", [["mapa", "Mapa"], ["lista", "Lista"], ["nuevo", "＋ Nuevo laboratorio"], ["masiva", "Carga masiva"]])}${cont}`;
}

function vistaAsistente() {
  const w = UI.wiz || (UI.wiz = { paso: 1, q: "" });
  const pasos = ["Crear el laboratorio", "Elegir plantilla", "Ajustar equipamiento", "Recibir los equipos", "Activar"];
  const cab = `<ol class="pasos">${pasos.map((p, i) => `<li class="${i + 1 === w.paso ? "on" : i + 1 < w.paso ? "hecho" : ""}" ${i + 1 === w.paso ? 'aria-current="step"' : ""}><span>${i + 1}</span>${p}</li>`).join("")}</ol>`;
  let c = "";
  if (w.paso === 1) {
    const conLab = new Set(S.labs.map((l) => l.sedeId));
    const res = w.q.length >= 2 ? window.SEDES.filter((s) => !conLab.has(s.id) && (s.nombre + " " + s.distrito + " " + s.id).toLowerCase().includes(w.q.toLowerCase())).slice(0, 8) : [];
    const s = SEDE_POR_ID[w.sedeId];
    c = `<div class="form"><label>Institución MEC (nombre, distrito o código) <input data-change="wiz-q" value="${esc(w.q)}" placeholder="Escribí al menos 2 letras"></label>
      ${res.length ? `<ul class="resultados">${res.map((x) => `<li><button class="link" data-act="wiz-sede" data-s="${x.id}">${esc(x.nombre)} <small>${esc(x.distrito)}, ${esc(x.depto)} · ${esc(x.tipNombre)}</small></button></li>`).join("")}</ul>` : w.q.length >= 2 ? vacio("Sin resultados entre las escuelas sin laboratorio.") : ""}</div>
      ${s ? `<div class="card sel-sede"><h3>${esc(s.nombre)}</h3><p>${esc(s.distrito)}, ${esc(s.depto)} · zona ${esc(s.zona).toLowerCase()} · código ${esc(s.id)}</p>
        <p>Tipología STEAM: <strong>${esc(s.tipNombre)} · ${esc(s.perfil)}</strong> (matrícula de media: ${s.media}). Sugerido: <strong>${PUESTOS_POR_TIPOLOGIA[s.tip]} puestos</strong>.</p>
        <form class="form" data-form="wiz-1"><label>Nombre del laboratorio <input name="nombre" value="Laboratorio TIC ${esc(s.nombre)}" required></label>
        <div class="fila2"><label>Latitud <input name="lat" value="${w.lat ?? s.lat}" inputmode="decimal"></label><label>Longitud <input name="lon" value="${w.lon ?? s.lon}" inputmode="decimal"></label>
        <button type="button" class="sec" data-act="wiz-gps">📍 Usar GPS</button></div>
        <div class="acciones"><button>Siguiente</button></div></form></div>` : ""}`;
  }
  if (w.paso === 2) {
    c = `<form class="form" data-form="wiz-2"><fieldset><legend>Plantilla de equipamiento</legend>
      <label class="opcion"><input type="radio" name="modo" value="estandar" checked> <span><strong>${PLANTILLA_ESTANDAR.nombre}</strong> · idéntico para los ${SEDES_CON_LAB.length} laboratorios del programa</span></label>
      <label class="opcion"><input type="radio" name="modo" value="propia"> <span><strong>Configuración propia</strong> · parte de la plantilla y se ajusta según la tipología de la sede (${PUESTOS_POR_TIPOLOGIA[SEDE_POR_ID[w.sedeId].tip]} puestos)</span></label></fieldset>
      <div class="acciones"><button type="button" class="sec" data-act="wiz-atras">Atrás</button><button>Siguiente</button></div></form>`;
  }
  if (w.paso === 3) {
    c = `<form class="form" data-form="wiz-3"><table class="tabla"><thead><tr><th>Categoría</th><th>Modelo</th><th>Cantidad</th></tr></thead><tbody>
      ${w.items.map((it, i) => `<tr><td>${esc(it.categoria)}</td><td>${esc(it.modelo)}</td><td><input type="number" min="0" max="200" name="q${i}" value="${it.cantidad}" aria-label="Cantidad de ${esc(it.modelo)}" class="num"></td></tr>`).join("")}
      <tr><td><input name="nueva_cat" placeholder="Otra categoría" aria-label="Nueva categoría"></td><td><input name="nuevo_mod" placeholder="Modelo" aria-label="Nuevo modelo"></td><td><input type="number" min="0" name="nueva_q" placeholder="0" class="num" aria-label="Cantidad nueva"></td></tr>
      </tbody></table>
      <div class="acciones"><button type="button" class="sec" data-act="wiz-atras">Atrás</button><button>Crear laboratorio y generar activos pendientes</button></div></form>`;
  }
  if (w.paso === 4) {
    const acts = S.activos.filter((a) => a.labId === w.labId);
    const pend = acts.filter((a) => a.estado === "pendiente").length;
    c = `<p>Al llegar cada equipo se escanea su número de serie y el código QR. Pendientes: <strong>${pend}</strong> de ${acts.length}.</p>
      <div class="tabla-wrap"><table class="tabla"><thead><tr><th>Equipo</th><th>Cant.</th><th>Serie</th><th>Estado</th><th></th></tr></thead><tbody>
      ${acts.map((a) => `<tr><td>${esc(a.modelo)}</td><td>${a.cantidad}</td><td><code>${esc(a.serie || "—")}</code></td><td>${estadoBadge(a.estado)}</td><td>${a.estado === "pendiente" ? `<button class="mini" data-act="wiz-escanear" data-a="${a.id}">Escanear QR</button>` : ""}</td></tr>`).join("")}
      </tbody></table></div>
      <div class="acciones"><button class="sec" data-act="wiz-recibir-todo" ${pend ? "" : "disabled"}>Recibir todo</button><button data-act="wiz-siguiente" ${pend ? "disabled" : ""}>Siguiente</button></div>`;
  }
  if (w.paso === 5) {
    const l = lab(w.labId);
    c = l.estado === "operativo" ? `<div class="aviso ok" role="status">✅ <strong>${esc(l.nombre)}</strong> está operativo: reservas habilitadas, consumibles con stock mínimo, garantía de 12 meses y plan de mantenimiento preventivo.</div>
      <div class="acciones"><button data-act="wiz-nuevo">Registrar otro laboratorio</button></div>` :
      `<p>Al activar se habilitan las reservas, se cargan los consumibles con su stock mínimo, se inicia la garantía de 12 meses y el plan de mantenimiento preventivo.</p>
      <div class="acciones"><button data-act="wiz-activar">Activar laboratorio</button></div>`;
  }
  return `<section class="card">${cab}${c}</section>`;
}

/* ---------- desafíos (gobernanza) ---------- */
const DATO_PERSONAL = /(\b0?9\d{2}[\s-]?\d{3}[\s-]?\d{3}\b|\b\d{4}[\s-]?\d{3}[\s-]?\d{3}\b|[\w.]+@[\w.]+\.\w+)/g;
const esModerador = () => ["facilitador", "director", "admin"].includes(yo().rol);

function vistaDesafios() {
  const u = yo();
  const tab = tabActiva("des", "muro");
  const pend = S.desafios.filter((d) => d.estado === "pendiente");
  const visibles = S.desafios.filter((d) => d.estado !== "pendiente" && d.estado !== "rechazado" && (u.rol !== "comunidad" || u.circulo <= 3 || d.estado === "resultados publicados" || d.autorId === u.id));
  const circ = u.rol === "estudiante" ? 1 : u.rol === "comunidad" ? u.circulo : u.rol === "tutor" ? 4 : null;
  let cont = "";
  if (tab === "muro") {
    cont = `${circ || esModerador() ? `<details class="card"><summary><strong>＋ Proponer un desafío</strong></summary><form class="form" data-form="nuevo-desafio">
      <label>Título <input name="titulo" required maxlength="90"></label>
      <label>¿Qué problema local hay que resolver? <textarea name="descripcion" rows="3" required></textarea></label>
      <label>Plazo <input type="date" name="plazo" required min="${hoy()}" value="${isoDate(addDays(new Date(), 30))}"></label>
      <p class="nota">${esModerador() ? "Como moderador, tu desafío se publica directamente." : `Se publica como Círculo ${circ} (${CIRCULOS[circ].nombre}) después de la moderación del facilitador o director.`} No incluyas datos personales.</p>
      <div class="acciones"><button>Enviar</button></div></form></details>` : ""}
      <div class="grid2">${visibles.map((d) => `<article class="card desafio c${d.circulo}"><div class="circulo-tag">Círculo ${d.circulo} · ${CIRCULOS[d.circulo].nombre}</div>
        <h3>${link("desafio/" + d.id, esc(d.titulo))}</h3><p>${esc(d.descripcion)}</p>
        <p class="meta">${esc(d.autor)} · hasta ${fmtFecha(d.plazo + "T12:00")} · ${S.propuestas.filter((p) => p.desafioId === d.id).length} propuestas ${estadoBadge(d.estado)}</p></article>`).join("") || vacio("No hay desafíos visibles.")}</div>
      ${u.rol === "comunidad" ? `<section class="card"><h2>Mis propuestas en moderación</h2>${S.desafios.filter((d) => d.autorId === u.id && d.estado !== "publicado").map((d) => `<p>${esc(d.titulo)} ${estadoBadge(d.estado)}${d.motivo ? " · " + esc(d.motivo) : ""}</p>`).join("") || vacio("Ninguna.")}</section>` : ""}`;
  }
  if (tab === "moderacion") {
    cont = pend.map((d) => {
      const datos = d.descripcion.match(DATO_PERSONAL) || [];
      return `<form class="card" data-form="moderar" data-d="${d.id}"><div class="circulo-tag">Círculo ${d.circulo} · ${esc(d.autor)}</div><h3>${esc(d.titulo)}</h3><p>${esc(d.descripcion)}</p>
        ${datos.length ? `<div class="aviso bad" role="alert">Se detectaron posibles datos personales: <strong>${datos.map(esc).join(", ")}</strong>. <button type="button" class="link" data-act="ocultar-datos" data-d="${d.id}">Quitarlos del texto</button></div>` : ""}
        <fieldset><legend>Checklist de moderación</legend><div class="checks">
          <label><input type="checkbox" name="c1" required> Lenguaje adecuado para estudiantes</label>
          <label><input type="checkbox" name="c2" required ${datos.length ? "disabled" : ""}> Sin datos personales${datos.length ? " (quitarlos primero)" : ""}</label>
          <label><input type="checkbox" name="c3" required> Viable con el equipamiento del laboratorio</label></div></fieldset>
        <label>Motivo (si se rechaza) <input name="motivo"></label>
        <div class="acciones"><button type="submit" name="accion" value="rechazar" class="peligro" formnovalidate>Rechazar</button><button type="submit" name="accion" value="publicar">Publicar</button></div></form>`;
    }).join("") || vacio("No hay desafíos pendientes de moderación.");
  }
  return `<h1 tabindex="-1">Desafíos</h1><p class="sub">El ecosistema propone problemas reales; los estudiantes forman equipo, proponen soluciones y votan.</p>
    <div class="aviso info"><strong>Regla de protección:</strong> los estudiantes no tienen contacto directo con adultos externos. Toda interacción pasa por el facilitador.</div>
    ${esModerador() ? tabs("des", [["muro", "Muro de desafíos"], ["moderacion", `Moderación (${pend.length})`]]) : ""}${cont}`;
}

function vistaDesafio(id) {
  const d = S.desafios.find((x) => x.id === id);
  if (!d) return `<h1 tabindex="-1">Desafío no encontrado</h1>`;
  const u = yo();
  const props = S.propuestas.filter((p) => p.desafioId === id).sort((a, b) => b.votos.length - a.votos.length);
  const ocultar = ["comunidad", "tutor"].includes(u.rol);
  const yaVote = props.find((p) => p.votos.includes(u.id));
  const jurado = u.rol === "admin" || (u.rol === "comunidad" && u.circulo <= 3);
  const abierto = d.estado === "publicado";
  const compas = u.rol === "estudiante" ? S.usuarios.filter((x) => x.rol === "estudiante" && x.id !== u.id && x.sedes.includes(sedeActiva())) : [];
  return `<p class="miga">${link("desafios", "← Desafíos")}</p>
    <div class="circulo-tag">Círculo ${d.circulo} · ${CIRCULOS[d.circulo].nombre}</div><h1 tabindex="-1">${esc(d.titulo)}</h1>
    <p class="sub">${esc(d.autor)} · hasta ${fmtFecha(d.plazo + "T12:00")} ${estadoBadge(d.estado)}</p><p class="lead">${esc(d.descripcion)}</p>
    ${d.resultado ? `<div class="aviso ok"><strong>Resultado publicado:</strong> ${esc(d.resultado)}</div>` : ""}
    <ol class="flujo gob">${["Propone", "Modera", "Equipos proponen", "Votan", "Director selecciona", "Publica resultados"].map((t, i) => {
      const hecho = [true, d.estado !== "pendiente", props.length > 0, props.some((p) => p.votos.length), ["en ejecución", "resultados publicados"].includes(d.estado), d.estado === "resultados publicados"][i];
      return `<li class="${hecho ? "hecho" : ""}"><span class="num">${i + 1}</span><span>${t}</span></li>`;
    }).join("")}</ol>
    <h2>Propuestas (${props.length})</h2>
    <div class="grid2">${props.map((p) => {
      const pj = p.jurado.length ? avg(p.jurado.map((j) => j.puntaje)).toFixed(1) : null;
      const pr = p.proyectoId && S.proyectos.find((x) => x.id === p.proyectoId);
      return `<article class="card propuesta ${p.ganadora ? "ganadora" : ""}">${p.ganadora ? badge("🏆 Seleccionada", "ok") : ""}<h3>${esc(p.titulo)}</h3><p>${esc(p.descripcion)}</p>
        <p class="meta">${ocultar ? "Equipo de " + esc(sedeNombre(usuario(p.equipo[0])?.sedes[0])) : "Equipo: " + p.equipo.map((x) => esc(nombrePublico(usuario(x)))).join(", ")}${pr && (accesoProyecto(pr)) ? " · Proyecto: " + link("proyecto/" + pr.id, esc(pr.titulo)) : ""}</p>
        <p><strong>${p.votos.length}</strong> votos${pj ? ` · jurado técnico ${pj}/5 (${p.jurado.length})` : ""}</p>
        <div class="acciones">
          ${u.rol === "estudiante" && abierto ? (p.votos.includes(u.id) ? `<button class="sec" data-act="votar" data-p="${p.id}">Quitar mi voto</button>` : `<button data-act="votar" data-p="${p.id}" ${yaVote ? "disabled title='Ya votaste otra propuesta'" : ""}>Votar</button>`) : ""}
          ${jurado && abierto ? `<form class="inline" data-form="jurado" data-p="${p.id}"><label class="sr" for="j-${p.id}">Puntaje técnico</label><select id="j-${p.id}" name="puntaje">${[1, 2, 3, 4, 5].map((n) => `<option>${n}</option>`).join("")}</select><button class="sec">Puntuar como jurado</button></form>` : ""}
          ${["director", "admin"].includes(u.rol) && abierto ? `<button data-act="seleccionar" data-p="${p.id}">Seleccionar</button>` : ""}
        </div></article>`;
    }).join("") || vacio("Todavía no hay propuestas.")}</div>
    ${["director", "admin"].includes(u.rol) && d.estado === "en ejecución" ? `<form class="card form" data-form="publicar-resultado" data-d="${d.id}"><h2>Publicar resultados</h2><label>Resumen para el Observatorio comunitario <textarea name="resultado" rows="2" required></textarea></label><div class="acciones"><button>Publicar</button></div></form>` : ""}
    ${u.rol === "estudiante" && abierto ? `<details class="card"><summary><strong>＋ Presentar una propuesta con tu equipo</strong></summary><form class="form" data-form="propuesta" data-d="${d.id}">
      <label>Título <input name="titulo" required></label><label>¿Cómo lo resolverían? <textarea name="descripcion" rows="3" required></textarea></label>
      <fieldset><legend>Equipo</legend><div class="checks">${compas.map((c) => `<label><input type="checkbox" name="equipo" value="${c.id}"> ${esc(c.nombre)}</label>`).join("") || "—"}</div></fieldset>
      <label>Proyecto del laboratorio vinculado <select name="proyectoId"><option value="">Ninguno</option>${S.proyectos.filter((p) => p.equipo.includes(u.id)).map((p) => `<option value="${p.id}">${esc(p.titulo)}</option>`).join("")}</select></label>
      <p class="nota">Si un aliado ofrece mentoría, la coordina tu facilitador.</p><div class="acciones"><button>Presentar</button></div></form></details>` : ""}`;
}

/* ---------- banco de proyectos / observatorio ---------- */
function vistaBanco() {
  const u = yo();
  const tab = tabActiva("banco", "proyectos");
  const q = (UI.filtros.banco || "").toLowerCase();
  const pub = S.proyectos.filter((p) => p.publicado && (!q || (p.titulo + sedeNombre(p.sedeId)).toLowerCase().includes(q)));
  const ocultar = ["comunidad", "tutor"].includes(u.rol);
  const cont = tab === "proyectos" ? `<label class="buscar">Buscar <input data-change="filtro" data-f="banco" value="${esc(UI.filtros.banco || "")}" placeholder="Título o sede"></label>
    <div class="grid3">${pub.map((p) => `<article class="card proyecto"><h3>${link("proyecto/" + p.id, esc(p.titulo))}</h3>
      <p class="meta">${esc(nombresEquipo(p, ocultar && !p.autorPublico))} · ${esc(sedeNombre(p.sedeId))} (${esc(SEDE_POR_ID[p.sedeId]?.depto)})</p>
      <p>${p.entregas.map((e) => `<span class="ext ext-${e.tipo.toLowerCase()}">${e.tipo}</span> ${esc(e.nombre)}`).join("<br>")}</p>
      ${u.rol === "estudiante" ? `<div class="acciones"><button class="sec" data-act="fork" data-p="${p.id}">Construir encima</button></div>` : ""}</article>`).join("") || vacio("Sin resultados.")}</div>`
    : `<div class="grid2">${S.desafios.filter((d) => ["en ejecución", "resultados publicados"].includes(d.estado)).map((d) => {
      const g = S.propuestas.find((p) => p.desafioId === d.id && p.ganadora);
      return `<article class="card"><div class="circulo-tag">Círculo ${d.circulo}</div><h3>${link("desafio/" + d.id, esc(d.titulo))}</h3>${estadoBadge(d.estado)}<p>${g ? "Propuesta seleccionada: <strong>" + esc(g.titulo) + "</strong>" : ""}</p>${d.resultado ? `<p>${esc(d.resultado)}</p>` : ""}</article>`;
    }).join("") || vacio("Todavía no hay desafíos con propuesta seleccionada.")}</div>`;
  return `<h1 tabindex="-1">Banco de proyectos</h1><p class="sub">Proyectos publicados con consentimiento del tutor, para que otros construyan encima.</p>
    ${tabs("banco", [["proyectos", "Proyectos"], ["observatorio", "Observatorio comunitario"]])}${cont}`;
}

/* ---------- soporte ---------- */
function ticketsVisibles() {
  const u = yo();
  if (["soporte", "admin"].includes(u.rol)) return S.tickets;
  const labs = (u.sedes || []).map(labIdDeSede);
  return S.tickets.filter((t) => labs.includes(t.labId));
}
function slaBadge(t) {
  const r = slaRestante(t);
  if (r === null) return badge("—", "muted");
  if (r < 0) return badge(`Vencido hace ${Math.round(-r)} h`, "bad");
  return badge(`${Math.round(r)} h restantes`, r < 12 ? "warn" : "ok");
}
function tablaTickets(lista) {
  if (!lista.length) return vacio("Sin tickets.");
  return `<div class="tabla-wrap"><table class="tabla"><thead><tr><th>Ticket</th><th>Laboratorio</th><th>Equipo</th><th>Tipo</th><th>Estado</th><th>SLA</th></tr></thead><tbody>
    ${lista.map((t) => `<tr class="${UI.ticket === t.id ? "sel" : ""}"><td><button class="link" data-act="ver-ticket" data-t="${t.id}" aria-expanded="${UI.ticket === t.id}">${t.id}</button><br><small>${esc(t.titulo)}</small></td>
      <td>${esc(SEDE_POR_ID[lab(t.labId).sedeId].nombre)}</td><td>${esc(activo(t.activoId)?.modelo || "—")}</td><td>${t.tipo} · ${t.prioridad}</td><td>${estadoBadge(t.estado)}${t.escalado ? " " + badge("Escalado", "bad") : ""}</td><td>${slaBadge(t)}</td></tr>
      ${UI.ticket === t.id ? `<tr class="detalle"><td colspan="6">${detalleTicket(t)}</td></tr>` : ""}`).join("")}</tbody></table></div>`;
}
function detalleTicket(t) {
  const u = yo();
  const tec = ["soporte", "admin"].includes(u.rol);
  return `<div class="ticket-det"><p>Abierto ${fmtFechaHora(t.creado)} por ${esc(usuario(t.autorId)?.nombre || "el sistema")} · asignado a ${esc(usuario(t.asignado)?.nombre || "nadie")}${t.visita ? ` · visita ${fmtFecha(t.visita + "T12:00")}` : ""}</p>
    <ul class="comentarios">${t.comentarios.map((c) => `<li><strong>${esc(c.autor)}</strong> <time>${fmtFechaHora(c.fecha)}</time><p>${esc(c.texto)}</p></li>`).join("")}</ul>
    <form class="inline" data-form="comentar" data-t="${t.id}"><label class="sr" for="c-${t.id}">Comentario</label><input id="c-${t.id}" name="texto" placeholder="Agregar comentario" required><button class="sec">Comentar</button></form>
    <div class="acciones">
      ${tec && t.estado === "abierto" ? `<button data-act="ticket-tomar" data-t="${t.id}">Tomar ticket</button>` : ""}
      ${tec && !["resuelto", "cerrado"].includes(t.estado) ? `<form class="inline" data-form="visita" data-t="${t.id}"><label>Visita <input type="date" name="fecha" min="${hoy()}" required></label><button class="sec">Programar</button></form><button data-act="ticket-resolver" data-t="${t.id}">Marcar resuelto</button>` : ""}
      ${!tec && t.estado === "resuelto" ? `<button data-act="ticket-cerrar" data-t="${t.id}">Confirmar solución y cerrar</button>` : ""}
      ${!tec && slaRestante(t) < 0 && !t.escalado ? `<button class="peligro" data-act="ticket-escalar" data-t="${t.id}">Escalar al proveedor</button>` : ""}
    </div></div>`;
}
function vistaSoporte() {
  const u = yo();
  const todos = ticketsVisibles();
  const f = tabActiva("tk", "abiertos");
  const lista = todos.filter((t) => f === "todos" || (f === "abiertos" ? !["resuelto", "cerrado"].includes(t.estado) : ["resuelto", "cerrado"].includes(t.estado)))
    .sort((a, b) => (slaRestante(a) ?? 1e9) - (slaRestante(b) ?? 1e9) || b.creado.localeCompare(a.creado));
  const labs = labsGestionables();
  const l = labTrabajo();
  const abiertos = todos.filter((t) => !["resuelto", "cerrado"].includes(t.estado));
  const lim = isoDate(addDays(new Date(), 30));
  const garLabs = new Set(S.activos.filter((a) => labs.some((x) => x.id === a.labId) && a.estado !== "pendiente" && a.garantiaHasta <= lim && a.garantiaHasta >= hoy()).map((a) => a.labId));
  return `<h1 tabindex="-1">Soporte técnico</h1><p class="sub">Garantía y mantenimiento preventivo/correctivo durante 12 meses.</p>
    <div class="kpis">${kpi("Abiertos", abiertos.length)}${kpi("SLA vencido", abiertos.filter((t) => slaRestante(t) < 0).length, "", abiertos.some((t) => slaRestante(t) < 0) ? "alerta" : "")}${kpi("Visitas programadas", abiertos.filter((t) => t.visita).length)}${kpi("Garantías que vencen en 30 días", garLabs.size, "laboratorios")}</div>
    <details class="card"><summary><strong>＋ Abrir ticket</strong></summary><form class="form" data-form="nuevo-ticket">
      ${["admin", "soporte"].includes(u.rol) ? selectorLab() : `<p>Laboratorio: <strong>${esc(l.nombre)}</strong></p>`}
      <label>Equipo <select name="activoId">${S.activos.filter((a) => a.labId === l.id).map((a) => `<option value="${a.id}">${esc(a.modelo)}${a.estado !== "operativo" ? " (" + a.estado + ")" : ""}</option>`).join("")}</select></label>
      <div class="fila2"><label>Tipo <select name="tipo"><option>Correctivo</option><option>Garantía</option><option>Preventivo</option></select></label>
      <label>Prioridad <select name="prioridad"><option>Media</option><option>Alta</option><option>Baja</option></select></label></div>
      <label>Descripción del problema <input name="titulo" required></label>
      <label><input type="checkbox" name="fuera"> El equipo queda fuera de servicio (se bloquean sus reservas)</label>
      <div class="acciones"><button>Abrir ticket</button></div></form></details>
    ${tabs("tk", [["abiertos", "Abiertos"], ["resueltos", "Resueltos y cerrados"], ["todos", "Todos"]])}
    ${tablaTickets(lista.slice(0, 40))}${lista.length > 40 ? `<p class="meta">Mostrando 40 de ${lista.length}.</p>` : ""}`;
}

/* ---------- sistema y privacidad (admin) ---------- */
function vistaSistema() {
  const tab = tabActiva("sis", "tareas");
  let c = "";
  if (tab === "tareas") c = `<table class="tabla"><thead><tr><th>Tarea</th><th>Disparador</th><th></th></tr></thead><tbody>${TAREAS.map((t) => `<tr><td>${t.nombre}</td><td>${t.disparador}</td><td><button class="mini" data-act="tarea" data-t="${t.id}">Ejecutar ahora</button></td></tr>`).join("")}</tbody></table>
    ${UI.tareasLog.length ? `<h3>Resultados</h3><ul class="lista chica">${UI.tareasLog.map((x) => `<li><strong>${esc(x.nombre)}</strong><span>${esc(x.res)} · ${fmtFechaHora(x.fecha)}</span></li>`).join("")}</ul>` : ""}`;
  if (tab === "rbac") c = `<div class="tabla-wrap"><table class="tabla rbac"><thead><tr><th>Capacidad</th>${Object.values(ROLES).map((r) => `<th>${r}</th>`).join("")}</tr></thead><tbody>
    ${Object.entries(PERMISOS).map(([cap, p]) => `<tr><th scope="row">${cap}</th>${Object.keys(ROLES).map((r) => `<td class="centro" aria-label="${p[r] === PF ? "permitido" : p[r] === PL ? "limitado" : "sin acceso"}">${p[r] === PF ? "●" : p[r] === PL ? "◐" : "—"}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
    <p class="nota">● permitido · ◐ limitado (solo propios, solo su sede o requiere habilitación) · — sin acceso. El menú y las acciones de este prototipo se habilitan según esta matriz.</p>`;
  if (tab === "auditoria") c = `<p class="nota">Registro de ingresos y de accesos a datos de menores (en producción, inmutable).</p><div class="tabla-wrap"><table class="tabla"><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Detalle</th></tr></thead><tbody>${S.auditoria.slice(0, 100).map((a) => `<tr><td>${fmtFechaHora(a.fecha)}</td><td>${esc(a.usuario)}<br><small>${esc(a.rol)}</small></td><td>${esc(a.accion)}</td><td>${esc(a.detalle)}</td></tr>`).join("") || `<tr><td colspan="4">${vacio("Sin registros.")}</td></tr>`}</tbody></table></div>`;
  if (tab === "privacidad") {
    const e = usuario("u1");
    c = `<div class="grid2"><section class="card"><h2>Qué se guarda de un estudiante</h2><pre class="registro">{
  "id_mec": "MEC-•••• (seudónimo)",
  "nombre": "${esc(e.nombre)}",
  "sede": "${esc(e.sedes[0])}",
  "curso": "${esc(e.curso)}",
  "es_menor": true
}</pre><p class="nota">Sin documento, domicilio ni teléfono. La fecha de nacimiento solo se usa para calcular «es_menor».</p></section>
      <section class="card"><h2>Reglas aplicadas en el prototipo</h2><ul class="reglas"><li>Portfolio privado por defecto; se publica solo con consentimiento versionado y revocable del tutor.</li><li>Sin mensajería privada adulto–menor: la comunidad no ve nombres de estudiantes y la mentoría pasa por el facilitador.</li><li>La moderación detecta teléfonos y correos en los desafíos.</li><li>Los accesos de adultos a proyectos de menores quedan en auditoría.</li><li>Los tableros usan datos agregados por aula, sede y departamento.</li></ul></section></div>
      <section class="card"><h2>Consentimientos registrados</h2><table class="tabla"><thead><tr><th>Estudiante</th><th>Tipo</th><th>Estado</th><th>Versión</th><th>Fecha</th></tr></thead><tbody>${S.consentimientos.slice().reverse().map((k) => `<tr><td>${esc(usuario(k.estudianteId).nombre)}</td><td>${k.tipo === "imagenes" ? "Imágenes" : "Publicar proyectos"}</td><td>${k.otorgado ? badge("Otorgado", "ok") : badge("Revocado", "muted")}</td><td>v${k.version}</td><td>${fmtFechaHora(k.fecha)}</td></tr>`).join("")}</tbody></table></section>`;
  }
  return `<h1 tabindex="-1">Sistema y privacidad</h1>${tabs("sis", [["tareas", "Tareas automáticas"], ["rbac", "Roles y permisos"], ["auditoria", "Auditoría"], ["privacidad", "Privacidad"]])}${c}`;
}
