/* Laboratorios TIC · prototipo conceptual
   Módulo de Evaluación y Monitoreo (lámina 7 de la propuesta):
   captura automática → evaluación → consolidación nocturna → tableros por nivel → acción.
   Cada rol ve su nivel: estudiante (propio), facilitador (aula), director (sede),
   soporte (disponibilidad y SLA) y MITIC/MEC (nacional, anonimizado). */

UI.ev ||= { periodo: 12, comparar: "anterior", proyecto: null, alertas: "activas", tipoAlerta: "" };

const PERIODOS = { 4: "Últimas 4 semanas", 12: "Últimas 12 semanas", 26: "Último semestre" };
const INDICADORES = [
  { id: "horas", nombre: "Horas de uso por semana", suf: " h" },
  { id: "activos", nombre: "Estudiantes activos", suf: "%" },
  { id: "avance", nombre: "Avance promedio en rutas", suf: "%" },
  { id: "proyectos", nombre: "Proyectos completados", suf: "" },
  { id: "disp", nombre: "Disponibilidad de equipos", suf: "%" },
  { id: "sla", nombre: "Resolución de tickets", suf: " h", menorEsMejor: true },
];
const NIVEL_COMPETENCIA = ["Sin evidencia", "Emergente", "En desarrollo", "Consolidada"];
const COLORES = ["var(--serie1)", "var(--serie2)", "var(--serie3)"];

const fmtNum = (v, d = 0) => (v == null || isNaN(v) ? "—" : Number(v).toLocaleString("es-PY", { maximumFractionDigits: d, minimumFractionDigits: d }));

/* ---------- series semanales (simuladas a partir de los indicadores actuales) ---------- */
const EV_CACHE = new Map();
const memo = (k, fn) => (EV_CACHE.has(k) ? EV_CACHE.get(k) : (EV_CACHE.set(k, fn()), EV_CACHE.get(k)));
const baseLab = (l) => memo("base|" + l.id, () => indicadoresLab(l));

function inicioSemana(k) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 7 * k);
  return d;
}
const etiquetaSemana = (k) => { const d = inicioSemana(k); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };
const labEnSemana = (l, k) => l.estado === "operativo" && l.alta && new Date(l.alta + "T00:00") <= addDays(inicioSemana(k), 7);

function semanaLab(l, k) {
  return memo(`s|${l.id}|${k}`, () => {
    const b = baseLab(l);
    const ruido = (s) => 0.85 + hashNum(`${l.id}|${k}|${s}`) * 0.3;
    const madurez = Math.max(0.4, 1 - k * 0.018);
    return {
      horas: k === 0 ? b.horasSemana : b.horasSemana * madurez * ruido("h"),
      activos: Math.min(100, k === 0 ? b.activosPct : b.activosPct * madurez * ruido("a")),
      avance: Math.max(0, b.avanceRutas * (1 - k / 32)),
      disp: k === 0 ? b.disponibilidad : Math.min(100, 86 + hashNum(`${l.id}|${k}|d`) * 14),
      proyectos: (b.proyectos / 10) * madurez * ruido("p"),
      sla: b.slaHoras != null ? b.slaHoras * ruido("s") : 30 + hashNum(`${l.id}|${k}|t`) * 30,
    };
  });
}

function agregado(labs, desde, hasta) {
  const filas = [];
  for (let k = desde; k < hasta; k++) for (const l of labs) if (labEnSemana(l, k)) filas.push(semanaLab(l, k));
  if (!filas.length) return null;
  const recientes = labs.filter((l) => labEnSemana(l, desde)).map((l) => semanaLab(l, desde));
  return {
    horas: avg(filas.map((f) => f.horas)), activos: avg(filas.map((f) => f.activos)), avance: avg(recientes.map((f) => f.avance)),
    disp: avg(filas.map((f) => f.disp)), proyectos: sum(filas.map((f) => f.proyectos)), sla: avg(filas.map((f) => f.sla)),
    nLabs: new Set(labs.filter((l) => [...Array(hasta - desde).keys()].some((i) => labEnSemana(l, desde + i))).map((l) => l.id)).size,
  };
}

function serie(labs, semanas, campo, offset = 0) {
  return Array.from({ length: semanas }, (_, i) => {
    const k = semanas - 1 - i + offset;
    const v = labs.filter((l) => labEnSemana(l, k)).map((l) => semanaLab(l, k)[campo]);
    return v.length ? avg(v) : null;
  });
}
const etiquetas = (semanas) => Array.from({ length: semanas }, (_, i) => etiquetaSemana(semanas - 1 - i));

/* actividad real registrada en la plataforma (captura automática) */
function eventosDe(userIds) {
  const ps = S.proyectos.filter((p) => p.equipo.some((id) => userIds.includes(id)));
  return [
    ...ps.flatMap((p) => p.bitacora.map((b) => ({ tipo: "Bitácora", fecha: b.fecha }))),
    ...ps.flatMap((p) => p.entregas.map((e) => ({ tipo: "Entrega", fecha: e.fecha }))),
    ...ps.flatMap((p) => p.autoevaluaciones.filter((a) => userIds.includes(a.userId)).map((a) => ({ tipo: "Autoevaluación", fecha: a.fecha }))),
    ...S.reservas.filter((r) => userIds.includes(r.userId) && r.estado !== "cancelada").map((r) => ({ tipo: "Reserva", fecha: r.fecha + "T" + pad(r.hora) + ":00" })),
  ];
}
function serieEventos(eventos, semanas) {
  return Array.from({ length: semanas }, (_, i) => {
    const k = semanas - 1 - i;
    const desde = inicioSemana(k), hasta = addDays(desde, 7);
    return eventos.filter((e) => new Date(e.fecha) >= desde && new Date(e.fecha) < hasta).length;
  });
}

/* ---------- aprendizaje: rúbricas, competencias, autoevaluación ---------- */
const ultimo = (arr) => arr.slice().sort((a, b) => a.fecha.localeCompare(b.fecha)).at(-1);
function nivelesLab(l) {
  return memo("niv|" + l.id, () => {
    const reales = S.proyectos.filter((p) => p.sedeId === l.sedeId).flatMap((p) => p.feedback);
    return Object.fromEntries(RUBRICA.map((r) => [r.id, reales.length ? avg(reales.map((f) => f.rubrica[r.id])) : 1.9 + hashNum(l.id + r.id) * 1.7]));
  });
}
const competenciasLab = (l) => memo("comp|" + l.id, () => Object.fromEntries(COMPETENCIAS.map((c) => [c, 15 + hashNum(l.id + c) * 60])));
function brechaLab(l) {
  return memo("bre|" + l.id, () => {
    const difs = S.proyectos.filter((p) => p.sedeId === l.sedeId && p.feedback.length && p.autoevaluaciones.length).map((p) => {
      const a = ultimo(p.autoevaluaciones).rubrica, f = ultimo(p.feedback).rubrica;
      return avg(RUBRICA.map((r) => a[r.id] - f[r.id]));
    });
    return difs.length ? avg(difs) : 0.1 + hashNum(l.id + "brecha") * 0.6;
  });
}
function evidenciasCompetencia(userId) {
  const fbs = S.proyectos.filter((p) => p.equipo.includes(userId)).flatMap((p) => p.feedback);
  return Object.fromEntries(COMPETENCIAS.map((c) => [c, fbs.filter((f) => f.competencias?.includes(c)).length]));
}
function nivelEstudiante(userId) {
  const fbs = S.proyectos.filter((p) => p.equipo.includes(userId)).flatMap((p) => p.feedback);
  if (!fbs.length) return null;
  const f = ultimo(fbs);
  return f.rubrica;
}
function autoEstudiante(userId) {
  const a = S.proyectos.flatMap((p) => p.autoevaluaciones).filter((x) => x.userId === userId);
  return a.length ? ultimo(a).rubrica : null;
}

/* ---------- gráficos (SVG accesible + tabla de datos) ---------- */
function graficoLineas({ titulo, series, etiquetas: et, suf = "", alto = 190, max: maxFijo }) {
  const W = 640, H = alto, m = { l: 42, r: 14, t: 12, b: 28 };
  const vals = series.flatMap((s) => s.valores).filter((v) => v != null);
  const max = maxFijo || Math.max(1, ...vals) * 1.12;
  const n = et.length;
  const x = (i) => m.l + (n === 1 ? (W - m.l - m.r) / 2 : (i * (W - m.l - m.r)) / (n - 1));
  const y = (v) => H - m.b - (v / max) * (H - m.t - m.b);
  const ejes = [0, max / 2, max].map((v) => `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" class="eje"/><text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end">${fmtNum(v)}</text>`).join("");
  const paso = Math.ceil(n / 9);
  const xs = et.map((e, i) => (i % paso === 0 || i === n - 1 ? `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(e)}</text>` : "")).join("");
  const lineas = series.map((s, j) => {
    const color = s.color || COLORES[j];
    const pts = s.valores.map((v, i) => (v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean).join(" ");
    return `<polyline points="${pts}" style="stroke:${color}" class="linea ${s.punteada ? "punteada" : ""}"/>` +
      s.valores.map((v, i) => (v == null ? "" : `<circle cx="${x(i)}" cy="${y(v)}" r="${s.punteada ? 2 : 3.2}" style="fill:${color}"><title>${esc(s.nombre)} · semana del ${esc(et[i])}: ${fmtNum(v, 1)}${suf}</title></circle>`)).join("");
  }).join("");
  const resumen = series.map((s) => { const v = s.valores.filter((x) => x != null); return v.length ? `${s.nombre}: de ${fmtNum(v[0])} a ${fmtNum(v.at(-1))}${suf}` : ""; }).join("; ");
  return `<figure class="grafico"><figcaption><strong>${esc(titulo)}</strong></figcaption>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(titulo + ". " + resumen)}">${ejes}${xs}${lineas}</svg>
    <div class="leyenda-graf">${series.map((s, j) => `<span><i class="${s.punteada ? "punteada" : ""}" style="background:${s.color || COLORES[j]}"></i>${esc(s.nombre)}</span>`).join("")}</div>
    <details><summary>Ver datos</summary><div class="tabla-wrap"><table class="tabla"><thead><tr><th>Semana</th>${series.map((s) => `<th>${esc(s.nombre)}</th>`).join("")}</tr></thead>
    <tbody>${et.map((e, i) => `<tr><td>${esc(e)}</td>${series.map((s) => `<td>${s.valores[i] == null ? "—" : fmtNum(s.valores[i], 1) + suf}</td>`).join("")}</tr>`).join("")}</tbody></table></div></details></figure>`;
}

function radar(ejes, series, max = 4) {
  const C = 130, R = 92, n = ejes.length;
  const pt = (i, v) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [C + Math.cos(a) * R * (v / max), C + Math.sin(a) * R * (v / max)]; };
  const anillos = [1, 2, 3, 4].map((v) => `<polygon class="anillo" points="${ejes.map((_, i) => pt(i, v).join(",")).join(" ")}"/>`).join("");
  const rayos = ejes.map((e, i) => {
    const [x, y] = pt(i, max), [lx, ly] = pt(i, max * 1.2);
    return `<line class="eje" x1="${C}" y1="${C}" x2="${x}" y2="${y}"/><text x="${lx}" y="${ly + 4}" text-anchor="${Math.abs(lx - C) < 8 ? "middle" : lx > C ? "start" : "end"}">${esc(e)}</text>`;
  }).join("");
  const polis = series.map((s, j) => `<polygon class="area" style="stroke:${COLORES[j]};fill:${COLORES[j]}" points="${s.valores.map((v, i) => pt(i, v || 0).join(",")).join(" ")}"><title>${esc(s.nombre)}</title></polygon>`).join("");
  const resumen = series.map((s) => `${s.nombre}: ${ejes.map((e, i) => `${e} ${s.valores[i] ?? "—"}`).join(", ")}`).join(". ");
  return `<figure class="grafico radar"><svg viewBox="-60 -6 380 272" role="img" aria-label="${esc("Comparación por criterio. " + resumen)}">${anillos}${rayos}${polis}</svg>
    <div class="leyenda-graf">${series.map((s, j) => `<span><i style="background:${COLORES[j]}"></i>${esc(s.nombre)}</span>`).join("")}</div></figure>`;
}

function sparkline(valores) {
  const v = valores.map((x) => x ?? 0);
  const max = Math.max(1, ...v), W = 90, H = 24;
  const pts = v.map((x, i) => `${((i * W) / Math.max(1, v.length - 1)).toFixed(1)},${(H - 2 - (x / max) * (H - 4)).toFixed(1)}`).join(" ");
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><polyline points="${pts}"/></svg>`;
}

function barraComparada(label, v, ref, max, suf = "", dec = 1) {
  return `<div class="bc"><span class="bc-label">${esc(label)}</span>
    <div class="bc-barra" role="img" aria-label="${esc(label)}: ${fmtNum(v, dec)}${suf}${ref != null ? `, referencia ${fmtNum(ref, dec)}${suf}` : ""}"><span style="width:${Math.min(100, (v / max) * 100)}%"></span>${ref != null ? `<i style="left:${Math.min(100, (ref / max) * 100)}%"></i>` : ""}</div>
    <span class="bc-valor">${fmtNum(v, dec)}${suf}${ref != null ? ` <small>ref. ${fmtNum(ref, dec)}</small>` : ""}</span></div>`;
}

function kpiComparado(ind, v, ref, refNombre) {
  let delta = "";
  if (v != null && ref != null && ref !== 0) {
    const d = ((v - ref) / Math.abs(ref)) * 100;
    const bueno = ind.menorEsMejor ? d <= 0 : d >= 0;
    delta = `<small class="${bueno ? "sube" : "baja"}">${d >= 0 ? "▲" : "▼"} ${fmtNum(Math.abs(d))}% vs ${esc(refNombre)}</small>`;
  }
  return kpi(ind.nombre, (v == null ? "—" : fmtNum(v) + ind.suf) + delta);
}

const celdaNivel = (v, extra = "") => (v == null ? `<td class="centro">—</td>` : `<td class="nivel n${Math.max(1, Math.min(4, Math.round(v)))}" title="${NIVELES[Math.round(v)] || ""}">${fmtNum(v, Number.isInteger(v) ? 0 : 1)}${extra}</td>`);

function filtrosPeriodo(conNacional) {
  return `<div class="filtros ev-filtros"><label>Período <select data-change="ev-periodo">${Object.entries(PERIODOS).map(([k, t]) => `<option value="${k}" ${+k === UI.ev.periodo ? "selected" : ""}>${t}</option>`).join("")}</select></label>
    <label>Comparar con <select data-change="ev-comparar"><option value="anterior">Período anterior</option>${conNacional ? `<option value="nacional" ${UI.ev.comparar === "nacional" ? "selected" : ""}>Promedio nacional</option>` : ""}</select></label>
    <p class="nota consolidado">Datos consolidados el ${fmtFechaHora(S.consolidacion.fecha)}</p></div>`;
}

/* ---------- alertas accionables ---------- */
const ACCION_ALERTA = {
  "Equipo fuera de servicio": ["ticket", "Abrir ticket al proveedor"],
  "Stock bajo": ["reposicion", "Solicitar reposición"],
  "Bajo uso": ["acompanamiento", "Agendar acompañamiento pedagógico"],
};
function bloqueAlertas(alertas, conSede = true) {
  const f = UI.ev.alertas, t = UI.ev.tipoAlerta;
  const estado = (a) => S.seguimientos[a.clave]?.estado || "nueva";
  const lista = alertas.filter((a) => (!t || a.tipo === t) && (f === "todas" || (f === "activas" ? estado(a) !== "resuelta" : estado(a) === "resuelta")));
  const n = (e) => alertas.filter((a) => estado(a) === e).length;
  return `<div class="filtros"><label>Estado <select data-change="ev-alertas">${[["activas", "Activas"], ["resueltas", "Resueltas"], ["todas", "Todas"]].map(([k, x]) => `<option value="${k}" ${f === k ? "selected" : ""}>${x}</option>`).join("")}</select></label>
    <label>Tipo <select data-change="ev-tipo-alerta"><option value="">Todos</option>${Object.keys(ACCION_ALERTA).map((k) => `<option ${t === k ? "selected" : ""}>${k}</option>`).join("")}</select></label>
    <p class="nota">${n("nueva")} nuevas · ${n("seguimiento")} en seguimiento · ${n("resuelta")} resueltas</p></div>
    <div class="tabla-wrap"><table class="tabla"><thead><tr><th>Nivel</th><th>Tipo</th>${conSede ? "<th>Sede</th>" : ""}<th>Detalle</th><th>Estado</th><th>Acción</th></tr></thead><tbody>
    ${lista.slice(0, 40).map((a) => {
      const sg = S.seguimientos[a.clave];
      const [acc, txt] = ACCION_ALERTA[a.tipo];
      const s = SEDE_POR_ID[a.lab.sedeId];
      return `<tr><td>${nivelAlerta(a.nivel)}</td><td>${esc(a.tipo)}</td>${conSede ? `<td>${esc(s.nombre)}<br><small>${esc(s.depto)}</small></td>` : ""}<td>${esc(a.texto)}</td>
        <td>${!sg ? badge("Nueva", "warn") : sg.estado === "resuelta" ? badge("Resuelta", "ok") : badge("En seguimiento", "info")}${sg ? `<br><small>${esc(sg.accion)} · ${esc(sg.autor)} · ${fmtFecha(sg.fecha)}</small>` : ""}</td>
        <td>${!sg ? `<button class="mini" data-act="alerta-accion" data-k="${esc(a.clave)}" data-a="${acc}">${txt}</button>` : sg.estado !== "resuelta" ? `<button class="mini sec" data-act="alerta-resolver" data-k="${esc(a.clave)}">Marcar resuelta</button>` : ""}</td></tr>`;
    }).join("") || `<tr><td colspan="6">${vacio("No hay alertas con este filtro.")}</td></tr>`}</tbody></table></div>`;
}

/* ---------- reportes periódicos ---------- */
const REPORTES = [
  { id: "semanal", nombre: "Uso y disponibilidad por laboratorio", destino: "MITIC / MEC", frecuencia: "Semanal · lunes 07:00", roles: ["admin"], generar: () => descargarCSV() },
  { id: "aprendizaje", nombre: "Aprendizaje y competencias por departamento", destino: "MEC · Dirección de Currículum", frecuencia: "Mensual · día 1", roles: ["admin"], generar: csvAprendizaje },
  { id: "alertas", nombre: "Alertas y acciones de seguimiento", destino: "MITIC", frecuencia: "Semanal · lunes 07:00", roles: ["admin", "director"], generar: csvAlertas },
  { id: "sede", nombre: "Informe de la sede", destino: "Dirección de la institución y supervisión", frecuencia: "Mensual · día 1", roles: ["director", "admin"], generar: csvSede },
];
function bloqueReportes() {
  const r = yo().rol;
  return `<div class="grid2">${REPORTES.filter((x) => x.roles.includes(r)).map((x) => {
    const st = S.reportes[x.id] || {};
    return `<article class="card reporte"><h3>${esc(x.nombre)}</h3><p class="meta">Destino: ${esc(x.destino)}<br>Frecuencia: ${esc(x.frecuencia)}<br>Último generado: ${st.ultimo ? fmtFechaHora(st.ultimo) : "nunca"}</p>
      <div class="consent"><span>Envío automático programado</span><button class="switch ${st.programado ? "on" : ""}" role="switch" aria-checked="${!!st.programado}" aria-label="Programar ${esc(x.nombre)}" data-act="reporte-programar" data-r="${x.id}"><span></span></button></div>
      <div class="acciones"><button class="sec" data-act="reporte-generar" data-r="${x.id}">⬇ Generar ahora (CSV)</button></div></article>`;
  }).join("")}</div>`;
}
function labsOperativos() { return S.labs.filter((l) => l.estado === "operativo"); }
function porDepto(labs) {
  const d = {};
  labs.forEach((l) => (d[SEDE_POR_ID[l.sedeId].depto] ||= []).push(l));
  return d;
}
function csvAprendizaje() {
  const filas = [["Departamento", "Laboratorios", ...RUBRICA.map((r) => r.nombre + " (1-4)"), "Brecha autoevaluación", ...COMPETENCIAS.map((c) => c + " (% estudiantes)")]];
  Object.entries(porDepto(labsOperativos())).forEach(([d, ls]) => filas.push([d, ls.length,
    ...RUBRICA.map((r) => fmtNum(avg(ls.map((l) => nivelesLab(l)[r.id])), 2)), fmtNum(avg(ls.map(brechaLab)), 2),
    ...COMPETENCIAS.map((c) => fmtNum(avg(ls.map((l) => competenciasLab(l)[c])))) ]));
  bajarCSV(filas, `aprendizaje_competencias_${hoy()}.csv`);
}
function csvAlertas() {
  const labs = yo().rol === "director" ? [labActivo()] : labsOperativos();
  const filas = [["Nivel", "Tipo", "Sede", "Departamento", "Detalle", "Estado", "Acción", "Responsable", "Fecha"]];
  alertasLabs(labs).forEach((a) => { const s = SEDE_POR_ID[a.lab.sedeId], g = S.seguimientos[a.clave]; filas.push([a.nivel, a.tipo, s.nombre, s.depto, a.texto, g?.estado || "nueva", g?.accion, g?.autor, g ? fmtFecha(g.fecha) : ""]); });
  bajarCSV(filas, `alertas_${hoy()}.csv`);
}
function csvSede() {
  const l = labEval();
  const filas = [["Semana", ...INDICADORES.map((i) => i.nombre)]];
  for (let k = 25; k >= 0; k--) if (labEnSemana(l, k)) { const s = semanaLab(l, k); filas.push([etiquetaSemana(k), ...INDICADORES.map((i) => fmtNum(s[i.id], 1))]); }
  bajarCSV(filas, `informe_sede_${l.sedeId}_${hoy()}.csv`);
}
const labEval = () => (yo().rol === "director" ? labActivo() : labTrabajo());

/* ================= vistas ================= */
function vistaEvaluacion() {
  EV_CACHE.clear();
  const r = yo().rol;
  if (r === "estudiante") return evalEstudiante();
  if (r === "facilitador") return evalFacilitador();
  if (r === "director") return evalSede();
  if (r === "soporte") return evalSoporte();
  return evalNacional();
}

/* ---------- estudiante ---------- */
function evalEstudiante() {
  const u = yo();
  const mis = S.proyectos.filter((p) => p.equipo.includes(u.id));
  const fbs = mis.flatMap((p) => p.feedback);
  const autos = mis.flatMap((p) => p.autoevaluaciones.filter((a) => a.userId === u.id));
  const ev = evidenciasCompetencia(u.id);
  const pSel = mis.find((p) => p.id === UI.ev.proyecto) || mis.find((p) => p.feedback.length) || mis[0];
  const auto = pSel ? ultimo(pSel.autoevaluaciones.filter((a) => a.userId === u.id)) : null;
  const hetero = pSel?.feedback.length ? ultimo(pSel.feedback) : null;
  const brechas = auto && hetero ? RUBRICA.filter((r) => Math.abs(auto.rubrica[r.id] - hetero.rubrica[r.id]) >= 1) : [];
  const nivelProm = fbs.length ? avg(fbs.flatMap((f) => Object.values(f.rubrica))) : null;
  return `<h1 tabindex="-1">Mi evaluación</h1><p class="sub">Evaluamos el proceso, no solo el resultado. Nadie más que vos, tu facilitador y tu tutor ve esta página; no hay ranking entre estudiantes.</p>
    <div class="kpis">${kpi("Devoluciones recibidas", fbs.length)}${kpi("Autoevaluaciones", autos.length)}${kpi("Nivel promedio", nivelProm ? fmtNum(nivelProm, 1) : "—", nivelProm ? NIVELES[Math.round(nivelProm)] : "")}${kpi("Competencias con evidencia", Object.values(ev).filter((x) => x > 0).length + `<small>/${COMPETENCIAS.length}</small>`)}</div>
    <div class="grid2 ancho">
      <section class="card"><h2>Cómo me veo y cómo me ve mi facilitador</h2>
        ${mis.length ? `<label>Proyecto <select data-change="ev-proyecto">${mis.map((p) => `<option value="${p.id}" ${p.id === pSel.id ? "selected" : ""}>${esc(p.titulo)}</option>`).join("")}</select></label>` : ""}
        ${auto || hetero ? radar(RUBRICA.map((r) => r.nombre.split(" ")[0]), [
          ...(auto ? [{ nombre: "Mi autoevaluación", valores: RUBRICA.map((r) => auto.rubrica[r.id]) }] : []),
          ...(hetero ? [{ nombre: "Facilitador", valores: RUBRICA.map((r) => hetero.rubrica[r.id]) }] : []),
        ]) : vacio("Todavía no hay evaluaciones para este proyecto.")}
        ${brechas.length ? `<div class="aviso info"><strong>Para conversar con tu facilitador:</strong> ${brechas.map((r) => `en «${r.nombre}» vos te ves en ${NIVELES[auto.rubrica[r.id]]} y tu facilitador te ve en ${NIVELES[hetero.rubrica[r.id]]}`).join("; ")}. ¿Qué evidencia podrías mostrar?</div>` : ""}
        ${hetero?.pregunta ? `<p class="pregunta">❓ ${esc(hetero.pregunta)}</p>` : ""}
      </section>
      <section class="card"><h2>Autoevaluarme</h2>
        ${mis.length ? `<form class="form" data-form="autoevaluacion"><label>Proyecto <select name="proyecto">${mis.map((p) => `<option value="${p.id}" ${p.id === pSel.id ? "selected" : ""}>${esc(p.titulo)}</option>`).join("")}</select></label>
          <fieldset><legend>¿En qué nivel estoy?</legend>${RUBRICA.map((r) => `<label class="fila">${r.tipo}: ${r.nombre}<select name="r_${r.id}">${[1, 2, 3, 4].map((n) => `<option value="${n}" ${n === (auto?.rubrica[r.id] || 2) ? "selected" : ""}>${n} · ${NIVELES[n]}</option>`).join("")}</select></label>`).join("")}</fieldset>
          <label>¿Qué evidencia tengo? <textarea name="evidencia" rows="2" required placeholder="Ej.: hice 3 versiones y registré qué cambié en cada una"></textarea></label>
          <div class="acciones"><button>Guardar autoevaluación</button></div></form>` : vacio("Creá un proyecto para autoevaluarte.")}
      </section>
    </div>
    <div class="grid2">
      <section class="card"><h2>Mis competencias (ISTE / siglo XXI)</h2>${COMPETENCIAS.map((c) => { const n = Math.min(3, ev[c]); return `<div class="bc"><span class="bc-label">${c}</span><div class="bc-barra"><span style="width:${(n / 3) * 100}%"></span></div><span class="bc-valor">${NIVEL_COMPETENCIA[n]}</span></div>`; }).join("")}
        <p class="nota">Cada devolución de tu facilitador puede registrar evidencia de una competencia. Con 3 evidencias se considera consolidada.</p></section>
      <section class="card">${graficoLineas({ titulo: "Mi actividad en las últimas 8 semanas", series: [{ nombre: "Registros (bitácora, entregas, reservas, autoevaluaciones)", valores: serieEventos(eventosDe([u.id]), 8) }], etiquetas: etiquetas(8), alto: 170 })}</section>
    </div>`;
}

/* ---------- facilitador: aula ---------- */
function evalFacilitador() {
  const sede = sedeActiva();
  const est = S.usuarios.filter((x) => x.rol === "estudiante" && x.sedes.includes(sede));
  const tab = tabActiva("evf", "pendientes");
  let c = "";
  if (tab === "pendientes") {
    const porRevisar = proyectosPorRevisar(sede);
    const autos = S.proyectos.filter((p) => p.sedeId === sede).flatMap((p) => p.autoevaluaciones.map((a) => ({ a, p })))
      .filter(({ a, p }) => !p.feedback.length || a.fecha > ultimo(p.feedback).fecha);
    c = `<div class="grid2"><section class="card"><h2>Bitácoras con avances sin devolución (${porRevisar.length})</h2>${porRevisar.length ? `<ul class="lista">${porRevisar.map((p) => `<li>${link("proyecto/" + p.id, esc(p.titulo))}<span>${esc(nombresEquipo(p))} · última entrada ${fmtFecha(p.bitacora.at(-1).fecha)}</span></li>`).join("")}</ul>` : vacio("Al día.")}</section>
      <section class="card"><h2>Autoevaluaciones para contrastar (${autos.length})</h2>${autos.length ? `<ul class="lista">${autos.map(({ a, p }) => `<li>${link("proyecto/" + p.id, esc(p.titulo))}<span>${esc(usuario(a.userId).nombre)} · ${fmtFecha(a.fecha)} · «${esc(a.evidencia)}»</span></li>`).join("")}</ul>` : vacio("No hay autoevaluaciones nuevas.")}</section></div>`;
  }
  if (tab === "rubricas") {
    c = `<section class="card"><h2>Rúbricas del aula</h2><p class="nota">Última devolución por estudiante (1 Inicial · 2 En desarrollo · 3 Logrado · 4 Destacado). ▲/▼ indica que la autoevaluación del estudiante está al menos un nivel por encima o por debajo.</p>
      <div class="tabla-wrap"><table class="tabla"><thead><tr><th>Estudiante</th>${RUBRICA.map((r) => `<th>${r.tipo}<br>${r.nombre}</th>`).join("")}<th>Promedio</th></tr></thead><tbody>
      ${est.map((e) => {
        const h = nivelEstudiante(e.id), a = autoEstudiante(e.id);
        return `<tr><th scope="row">${esc(e.nombre)}</th>${RUBRICA.map((r) => {
          if (!h) return `<td class="centro">—</td>`;
          const d = a ? a[r.id] - h[r.id] : 0;
          return celdaNivel(h[r.id], d >= 1 ? ` <span title="Autoevaluación ${a[r.id]}">▲</span>` : d <= -1 ? ` <span title="Autoevaluación ${a[r.id]}">▼</span>` : "");
        }).join("")}${h ? celdaNivel(avg(Object.values(h))) : `<td class="centro">${link("aula", "Sin evaluar")}</td>`}</tr>`;
      }).join("") || `<tr><td colspan="7">${vacio("Sin estudiantes.")}</td></tr>`}</tbody></table></div></section>`;
  }
  if (tab === "competencias") {
    c = `<section class="card"><h2>Evidencias de competencias</h2><p class="nota">Cantidad de devoluciones en las que se registró cada competencia.</p>
      <div class="tabla-wrap"><table class="tabla"><thead><tr><th>Estudiante</th>${COMPETENCIAS.map((x) => `<th>${x}</th>`).join("")}</tr></thead><tbody>
      ${est.map((e) => { const ev = evidenciasCompetencia(e.id); return `<tr><th scope="row">${esc(e.nombre)}</th>${COMPETENCIAS.map((x) => `<td class="nivel n${Math.min(4, ev[x] + 1)} centro" title="${NIVEL_COMPETENCIA[Math.min(3, ev[x])]}">${ev[x]}</td>`).join("")}</tr>`; }).join("")}
      </tbody></table></div>
      <p class="nota">Sugerencia: las competencias en 0 para todo el grupo son una buena pista para el próximo desafío.</p></section>`;
  }
  if (tab === "aula") {
    c = `<div class="tabla-wrap"><table class="tabla"><thead><tr><th>Estudiante</th><th>Proyectos</th><th>Bitácora</th><th>Entregas</th><th>Devoluciones</th><th>Avance en el ciclo</th><th>Actividad (8 sem.)</th></tr></thead><tbody>
      ${est.map((e) => {
        const pr = S.proyectos.filter((p) => p.equipo.includes(e.id));
        return `<tr><th scope="row">${esc(e.nombre)}</th><td>${pr.length}</td><td>${sum(pr.map((p) => p.bitacora.length))}</td><td>${sum(pr.map((p) => p.entregas.length))}</td><td>${sum(pr.map((p) => p.feedback.length))}</td>
        <td>${barra(pr.length ? avg(pr.map((p) => (pasoFlujo(p).filter(Boolean).length / 8) * 100)) : 0)}</td><td>${sparkline(serieEventos(eventosDe([e.id]), 8))}</td></tr>`;
      }).join("")}</tbody></table></div>
      <section class="card">${graficoLineas({ titulo: "Actividad del aula por semana", series: [{ nombre: "Registros del grupo", valores: serieEventos(eventosDe(est.map((e) => e.id)), 8) }], etiquetas: etiquetas(8), alto: 170 })}</section>
      <section class="card"><h2>Reporte pedagógico cualitativo</h2><ul class="lista">${est.map(reporteCualitativo).join("")}</ul></section>`;
  }
  return `<h1 tabindex="-1">Evaluación y monitoreo · Aula</h1><p class="sub">${esc(sedeNombre(sede))} · rúbricas del proceso y del producto, autoevaluación y competencias</p>
    ${tabs("evf", [["pendientes", "Para evaluar"], ["rubricas", "Rúbricas"], ["competencias", "Competencias"], ["aula", "Tablero del aula"]])}${c}`;
}

/* ---------- director: sede ---------- */
function evalSede() {
  const l = labActivo();
  const P = UI.ev.periodo;
  const ops = labsOperativos();
  const actual = agregado([l], 0, P);
  const nac = UI.ev.comparar === "nacional";
  const ref = nac ? agregado(ops, 0, P) : agregado([l], P, 2 * P);
  if (ref && nac) ref.proyectos = ref.proyectos / Math.max(1, ref.nLabs);
  const refNombre = nac ? "nacional" : "período anterior";
  const niv = nivelesLab(l);
  const nivNac = Object.fromEntries(RUBRICA.map((r) => [r.id, avg(ops.map((x) => nivelesLab(x)[r.id]))]));
  const acts = S.activos.filter((a) => a.labId === l.id && a.reservable);
  return `<h1 tabindex="-1">Evaluación y monitoreo · Sede</h1><p class="sub">${esc(l.nombre)}</p>
    ${filtrosPeriodo(true)}
    <div class="kpis">${INDICADORES.map((i) => kpiComparado(i, actual?.[i.id], ref?.[i.id], refNombre)).join("")}</div>
    ${tabs("evd", [["uso", "Uso del laboratorio"], ["aprendizaje", "Aprendizaje"], ["alertas", `Alertas (${alertasLabs([l]).filter((a) => S.seguimientos[a.clave]?.estado !== "resuelta").length})`], ["reportes", "Reportes"]])}
    ${{
      uso: () => `<div class="grid2"><section class="card">${graficoLineas({ titulo: "Horas de uso por semana", suf: " h", series: [{ nombre: "Esta sede", valores: serie([l], P, "horas") }, { nombre: "Promedio nacional", valores: serie(ops, P, "horas"), punteada: true }], etiquetas: etiquetas(P) })}</section>
        <section class="card">${graficoLineas({ titulo: "Estudiantes activos (%)", suf: "%", max: 100, series: [{ nombre: "Esta sede", valores: serie([l], P, "activos") }, { nombre: "Promedio nacional", valores: serie(ops, P, "activos"), punteada: true }], etiquetas: etiquetas(P) })}</section></div>
        <section class="card"><h2>Uso por equipo</h2>${acts.map((a) => { const n = S.reservas.filter((r) => r.activoId === a.id && r.estado !== "cancelada").length; const h = Math.round(hashNum(a.id) * 12) + n; return barraComparada(a.modelo + (a.estado !== "operativo" ? " (fuera de servicio)" : ""), h, null, 20, " h", 0); }).join("")}</section>`,
      aprendizaje: () => `<div class="grid2"><section class="card"><h2>Rúbricas: nivel promedio por criterio</h2>${RUBRICA.map((r) => barraComparada(`${r.tipo}: ${r.nombre}`, niv[r.id], nivNac[r.id], 4)).join("")}<p class="nota">La marca vertical es el promedio nacional. Escala 1 (Inicial) a 4 (Destacado).</p></section>
        <section class="card"><h2>Estudiantes con evidencia de cada competencia</h2>${COMPETENCIAS.map((c) => barraComparada(c, competenciasLab(l)[c], avg(ops.map((x) => competenciasLab(x)[c])), 100, "%", 0)).join("")}</section></div>
        <section class="card"><h2>Autoevaluación vs. evaluación del facilitador</h2><p>Brecha promedio en la sede: <strong>${brechaLab(l) >= 0 ? "+" : ""}${fmtNum(brechaLab(l), 2)}</strong> niveles (nacional ${fmtNum(avg(ops.map(brechaLab)), 2)}). Un valor positivo indica que los estudiantes se ven mejor de lo que los ve su facilitador: conviene trabajar la evidencia en la bitácora.</p></section>`,
      alertas: () => `<section class="card">${bloqueAlertas(alertasLabs([l]), false)}</section>`,
      reportes: () => bloqueReportes(),
    }[tabActiva("evd", "uso")]()}`;
}

/* ---------- soporte: disponibilidad y SLA ---------- */
function evalSoporte() {
  const P = UI.ev.periodo;
  const ops = labsOperativos();
  const a = agregado(ops, 0, P), ref = agregado(ops, P, 2 * P);
  const deptos = porDepto(ops);
  return `<h1 tabindex="-1">Monitoreo · Disponibilidad y SLA</h1><p class="sub">Vista técnica del proveedor de soporte</p>${filtrosPeriodo(false)}
    <div class="kpis">${kpiComparado(INDICADORES[4], a?.disp, ref?.disp, "período anterior")}${kpiComparado(INDICADORES[5], a?.sla, ref?.sla, "período anterior")}${kpi("Equipos fuera de servicio", S.activos.filter((x) => x.estado === "fuera de servicio").length)}${kpi("Tickets abiertos", S.tickets.filter((t) => !["resuelto", "cerrado"].includes(t.estado)).length)}</div>
    <div class="grid2"><section class="card">${graficoLineas({ titulo: "Tiempo de resolución de tickets (h)", suf: " h", series: [{ nombre: "Promedio nacional", valores: serie(ops, P, "sla") }, { nombre: "Objetivo (48 h)", valores: Array(P).fill(48), punteada: true, color: "var(--serie2)" }], etiquetas: etiquetas(P) })}</section>
      <section class="card">${graficoLineas({ titulo: "Disponibilidad de equipos (%)", suf: "%", max: 100, series: [{ nombre: "Promedio nacional", valores: serie(ops, P, "disp") }], etiquetas: etiquetas(P) })}</section></div>
    <section class="card"><h2>Por departamento</h2>${Object.entries(deptos).sort().map(([d, ls]) => barraComparada(`${d} (${ls.length})`, avg(ls.map((l) => semanaLab(l, 0).disp)), null, 100, "%", 0)).join("")}</section>
    <section class="card"><h2>Alertas de equipos</h2>${bloqueAlertas(alertasLabs(ops).filter((x) => x.tipo === "Equipo fuera de servicio"))}</section>`;
}

/* ---------- MITIC / MEC: nacional ---------- */
function evalNacional() {
  const P = UI.ev.periodo;
  const ops = labsOperativos();
  const tab = tabActiva("evn", "tablero");
  let c = "";
  if (tab === "tablero") {
    const a = agregado(ops, 0, P), ref = agregado(ops, P, 2 * P);
    const filas = Object.entries(porDepto(ops)).map(([d, ls]) => ({ d, ls, a: agregado(ls, 0, P), r: agregado(ls, P, 2 * P), total: S.labs.filter((l) => SEDE_POR_ID[l.sedeId].depto === d).length })).sort((x, y) => y.total - x.total);
    const sel = filas.find((f) => f.d === UI.deptoSel);
    c = `${filtrosPeriodo(false)}
      <div class="kpis">${INDICADORES.map((i) => kpiComparado(i, a?.[i.id], ref?.[i.id], "período anterior")).join("")}</div>
      <div class="grid2"><section class="card">${graficoLineas({ titulo: "Horas de uso por laboratorio y semana", suf: " h", series: [{ nombre: PERIODOS[P], valores: serie(ops, P, "horas") }, { nombre: "Período anterior", valores: serie(ops, P, "horas", P), punteada: true }], etiquetas: etiquetas(P) })}</section>
        <section class="card">${graficoLineas({ titulo: "Estudiantes activos (%)", suf: "%", max: 100, series: [{ nombre: PERIODOS[P], valores: serie(ops, P, "activos") }, { nombre: "Período anterior", valores: serie(ops, P, "activos", P), punteada: true }], etiquetas: etiquetas(P) })}</section></div>
      <section class="card"><h2>Por departamento</h2><p class="nota">Elegí un departamento para ver sus laboratorios.</p><div class="tabla-wrap"><table class="tabla"><thead><tr><th>Departamento</th><th>Operativos / total</th><th>Horas/semana</th><th>Tendencia</th><th>Estudiantes activos</th><th>Avance en rutas</th><th>Disponibilidad</th><th>SLA</th></tr></thead><tbody>
      ${filas.map((f) => `<tr class="${UI.deptoSel === f.d ? "sel" : ""}"><th scope="row"><button class="link" data-act="depto" data-d="${esc(f.d)}">${esc(f.d)}</button></th><td>${f.ls.length} / ${f.total}</td>
        <td>${fmtNum(f.a?.horas)} ${f.r && f.a ? (f.a.horas >= f.r.horas ? '<span class="sube">▲</span>' : '<span class="baja">▼</span>') : ""}</td><td>${sparkline(serie(f.ls, P, "horas"))}</td><td>${fmtNum(f.a?.activos)}%</td><td>${fmtNum(f.a?.avance)}%</td><td>${fmtNum(f.a?.disp)}%</td><td>${fmtNum(f.a?.sla)} h</td></tr>`).join("")}
      </tbody></table></div></section>
      ${sel ? `<section class="card"><h2>${esc(sel.d)}: laboratorios</h2><div class="tabla-wrap"><table class="tabla"><thead><tr><th>Sede</th><th>Tipología</th>${INDICADORES.map((i) => `<th>${i.nombre}</th>`).join("")}</tr></thead><tbody>
        ${sel.ls.map((l) => { const x = agregado([l], 0, P); const s = SEDE_POR_ID[l.sedeId]; return `<tr><td>${esc(s.nombre)}<br><small>${esc(s.distrito)}</small></td><td>${esc(s.tipNombre)}</td>${INDICADORES.map((i) => `<td>${x ? fmtNum(x[i.id]) + i.suf : "—"}</td>`).join("")}</tr>`; }).join("")}</tbody></table></div></section>` : ""}`;
  }
  if (tab === "aprendizaje") {
    const deptos = Object.entries(porDepto(ops)).sort((a, b) => b[1].length - a[1].length);
    const proc = RUBRICA.filter((r) => r.tipo === "Proceso"), prod = RUBRICA.filter((r) => r.tipo === "Producto");
    c = `<div class="aviso info">Datos agregados y anonimizados: a nivel nacional no se muestran estudiantes individuales.</div>
      <div class="grid2"><section class="card"><h2>Rúbricas: nivel promedio nacional</h2>${RUBRICA.map((r) => barraComparada(`${r.tipo}: ${r.nombre}`, avg(ops.map((l) => nivelesLab(l)[r.id])), 3, 4)).join("")}<p class="nota">Marca vertical: nivel esperado (3 · Logrado).</p></section>
      <section class="card"><h2>Estudiantes con evidencia por competencia</h2>${COMPETENCIAS.map((x) => barraComparada(x, avg(ops.map((l) => competenciasLab(l)[x])), null, 100, "%", 0)).join("")}</section></div>
      <section class="card"><h2>Por departamento</h2><div class="tabla-wrap"><table class="tabla"><thead><tr><th>Departamento</th><th>Laboratorios</th><th>Nivel en proceso</th><th>Nivel en producto</th><th>Brecha autoevaluación</th><th>Competencia más débil</th></tr></thead><tbody>
      ${deptos.map(([d, ls]) => {
        const comp = COMPETENCIAS.map((x) => [x, avg(ls.map((l) => competenciasLab(l)[x]))]).sort((a, b) => a[1] - b[1])[0];
        return `<tr><th scope="row">${esc(d)}</th><td>${ls.length}</td>${celdaNivel(avg(ls.flatMap((l) => proc.map((r) => nivelesLab(l)[r.id]))))}${celdaNivel(avg(ls.flatMap((l) => prod.map((r) => nivelesLab(l)[r.id]))))}<td>+${fmtNum(avg(ls.map(brechaLab)), 2)}</td><td>${esc(comp[0])} (${fmtNum(comp[1])}%)</td></tr>`;
      }).join("")}</tbody></table></div></section>`;
  }
  if (tab === "alertas") c = `<section class="card">${bloqueAlertas(alertasLabs(ops))}</section>`;
  if (tab === "reportes") c = bloqueReportes();
  if (tab === "proceso") {
    const hace7 = addDays(new Date(), -7).toISOString();
    const todos = S.usuarios.filter((u) => u.rol === "estudiante").map((u) => u.id);
    const evs = eventosDe(todos).filter((e) => e.fecha >= hace7);
    const contar = (t) => evs.filter((e) => e.tipo === t).length;
    const al = alertasLabs(ops);
    const pasos = [
      ["Captura automática", "Plataforma", `Últimos 7 días: ${contar("Reserva")} reservas, ${contar("Entrega")} entregas, ${contar("Bitácora")} entradas de bitácora, ${S.tickets.filter((t) => t.creado >= hace7).length} tickets, ${S.auditoria.filter((a) => a.accion === "Ingreso" && a.fecha >= hace7).length} ingresos.`],
      ["Evaluación", "Facilitador y estudiante", `Rúbricas de facilitadores: ${sum(S.proyectos.map((p) => p.feedback.length))}. Autoevaluaciones: ${sum(S.proyectos.map((p) => p.autoevaluaciones.length))}. Con competencias ISTE / siglo XXI.`],
      ["Consolidación nocturna", "Plataforma", `Última ejecución: ${fmtFechaHora(S.consolidacion.fecha)} · ${S.consolidacion.labs} laboratorios en ${S.consolidacion.deptos} departamentos · datos anonimizados.`, `<button class="mini" data-act="consolidar">Ejecutar ahora</button>`],
      ["Tableros", "Cada rol", "Aula (facilitador), sede (director), nacional (MITIC / MEC), con filtros por período y comparación."],
      ["Acción", "Director / MITIC", `Alertas nuevas: ${al.filter((a) => !S.seguimientos[a.clave]).length}. En seguimiento: ${al.filter((a) => S.seguimientos[a.clave]?.estado === "seguimiento").length}. Reportes con envío programado: ${Object.values(S.reportes).filter((r) => r.programado).length}.`],
    ];
    c = `<ol class="proceso">${pasos.map(([t, q, d, b], i) => `<li class="card"><span class="num">${i + 1}</span><h3>${t}</h3><p class="meta">${q}</p><p>${d}</p>${b || ""}</li>`).join("")}</ol>
      <section class="card"><h2>Indicadores clave definidos</h2><ul class="reglas">${INDICADORES.map((i) => `<li><strong>${i.nombre}</strong></li>`).join("")}</ul></section>`;
  }
  return `<h1 tabindex="-1">Evaluación y monitoreo · Nacional</h1><p class="sub">MITIC / MEC · ${ops.length} laboratorios operativos</p>
    ${tabs("evn", [["tablero", "Tablero"], ["aprendizaje", "Aprendizaje"], ["alertas", "Alertas"], ["reportes", "Reportes"], ["proceso", "Proceso de datos"]])}${c}`;
}

/* ---------- acciones del módulo (se registran en app.js) ---------- */
const EV_ACCIONES = {
  "alerta-accion": (d) => {
    const al = alertasLabs(labsOperativos()).find((a) => a.clave === d.k);
    if (!al) return;
    let accion = { ticket: "Ticket al proveedor", reposicion: "Reposición solicitada", acompanamiento: "Acompañamiento agendado" }[d.a];
    if (d.a === "ticket") {
      const existente = S.tickets.find((t) => t.activoId === al.ref && !["resuelto", "cerrado"].includes(t.estado));
      const t = existente || nuevoTicket(al.lab.id, al.ref, "Correctivo", "Alta", `Equipo fuera de servicio: ${al.texto}`);
      accion += " " + t.id;
    }
    S.seguimientos[d.k] = { estado: "seguimiento", accion, fecha: new Date().toISOString(), autor: yo().nombre };
    auditar("Seguimiento de alerta", `${al.tipo} · ${al.texto}`);
    commit(accion + ". La alerta quedó en seguimiento.");
  },
  "alerta-resolver": (d) => { S.seguimientos[d.k].estado = "resuelta"; S.seguimientos[d.k].fecha = new Date().toISOString(); commit("Alerta marcada como resuelta."); },
  consolidar: () => { const c = consolidar(); commit(`Consolidación ejecutada: ${c.labs} laboratorios, ${c.eventos} eventos del último día.`); },
  "reporte-generar": (d) => {
    REPORTES.find((r) => r.id === d.r).generar();
    S.reportes[d.r] = { ...(S.reportes[d.r] || {}), ultimo: new Date().toISOString() };
    auditar("Reporte generado", d.r);
    commit("Reporte generado.");
  },
  "reporte-programar": (d) => {
    const st = (S.reportes[d.r] ||= {});
    st.programado = !st.programado;
    commit(st.programado ? "Envío automático programado." : "Envío automático desactivado.");
  },
};
const EV_FORMULARIOS = {
  autoevaluacion: (fd) => {
    const p = S.proyectos.find((x) => x.id === fd.get("proyecto"));
    p.autoevaluaciones.push({ id: uid("A"), userId: yo().id, fecha: new Date().toISOString(), rubrica: Object.fromEntries(RUBRICA.map((r) => [r.id, +fd.get("r_" + r.id)])), evidencia: fd.get("evidencia") });
    UI.ev.proyecto = p.id;
    commit("Autoevaluación guardada. Tu facilitador la verá junto a tu bitácora.");
  },
};
const EV_CAMBIOS = {
  "ev-periodo": (el) => { UI.ev.periodo = +el.value; render(); },
  "ev-comparar": (el) => { UI.ev.comparar = el.value; render(); },
  "ev-proyecto": (el) => { UI.ev.proyecto = el.value; render(); },
  "ev-alertas": (el) => { UI.ev.alertas = el.value; render(); },
  "ev-tipo-alerta": (el) => { UI.ev.tipoAlerta = el.value; render(); },
};
