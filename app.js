/* Laboratorios TIC · prototipo conceptual — navegación, acciones y arranque */

const RUTAS = {
  inicio: vistaInicio, taller: vistaTaller, aula: vistaAula, portfolio: vistaPortfolio, reservas: vistaReservas,
  inventario: vistaInventario, laboratorios: vistaLaboratorios, desafios: vistaDesafios, banco: vistaBanco,
  soporte: vistaSoporte, evaluacion: vistaEvaluacion, sistema: vistaSistema, proyecto: vistaProyecto, desafio: vistaDesafio,
};

const parseHash = () => {
  const [ruta = "inicio", param] = location.hash.replace(/^#\/?/, "").split("/");
  return [ruta === "monitoreo" ? "evaluacion" : ruta || "inicio", param];
};

let mapa = null;

/* ---------- render ---------- */
function claveFoco(el) {
  if (!el || el === document.body) return null;
  if (el.id) return "#" + CSS.escape(el.id);
  const attrs = ["data-act", "data-change", "data-f", "data-tab", "data-p", "data-a", "data-r", "data-t", "data-h", "data-d", "data-c", "data-u", "data-e", "data-m", "data-s", "data-sede"]
    .filter((a) => el.hasAttribute(a)).map((a) => `[${a}="${CSS.escape(el.getAttribute(a))}"]`).join("");
  if (attrs) return el.tagName.toLowerCase() + attrs;
  const form = el.form?.dataset.form;
  if (form && el.name) return `form[data-form="${form}"] [name="${el.name}"]`;
  return null;
}

function render(enfocarTitulo = false) {
  const app = document.getElementById("app");
  const foco = enfocarTitulo ? null : claveFoco(document.activeElement);
  const cursor = document.activeElement?.selectionStart;
  if (mapa) { try { mapa.remove(); } catch { /* contenedor ya reemplazado */ } mapa = null; }

  if (!S.session) {
    app.innerHTML = vistaLogin();
  } else {
    let [ruta, param] = parseHash();
    const permitidas = new Set(menu().map((m) => m[0]).concat(["proyecto", "desafio"]));
    if (!RUTAS[ruta] || !permitidas.has(ruta)) { ruta = "inicio"; history.replaceState(null, "", "#/inicio"); }
    app.innerHTML = layout(ruta === "proyecto" ? (yo().rol === "estudiante" ? "taller" : "banco") : ruta === "desafio" ? "desafios" : ruta, RUTAS[ruta](param));
    if (ruta === "laboratorios" && tabActiva("labs", "mapa") === "mapa") initMapa();
  }
  if (enfocarTitulo) {
    (document.querySelector("main h1") || document.getElementById("main"))?.focus();
  } else if (foco) {
    const el = document.querySelector(foco);
    if (el) { el.focus(); if (cursor != null && el.setSelectionRange && el.type !== "number") try { el.setSelectionRange(cursor, cursor); } catch { /* inputs sin selección */ } }
  }
}

function commit(msg, tipo) { save(); render(); if (msg) toast(msg, tipo); }

function toast(msg, tipo = "ok") {
  const t = document.getElementById("toast");
  const el = document.createElement("div");
  el.className = "toast " + tipo;
  el.textContent = msg;
  t.appendChild(el);
  while (t.children.length > 3) t.firstChild.remove();
  setTimeout(() => el.remove(), tipo === "error" ? 6000 : 4000);
}

function ir(ruta) { location.hash = "#/" + ruta; }

/* ---------- mapa ---------- */
function initMapa() {
  const div = document.getElementById("mapa");
  if (!div) return;
  if (!window.L) { div.innerHTML = `<p class="vacio">El mapa necesita conexión a internet (Leaflet + OpenStreetMap). Usá la pestaña «Lista».</p>`; return; }
  mapa = window.L.map(div, { scrollWheelZoom: false });
  mapa.fitBounds(S.labs.map((l) => [l.lat, l.lon]), { padding: [20, 20] });
  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(mapa);
  const color = { operativo: "#0f8a5f", "en instalación": "#d98b00", planificado: "#8a94a6" };
  S.labs.forEach((l) => {
    const s = SEDE_POR_ID[l.sedeId];
    window.L.circleMarker([l.lat, l.lon], { radius: l.estado === "operativo" ? 7 : 5, color: "#fff", weight: 1, fillColor: color[l.estado], fillOpacity: 0.9 })
      .bindPopup(`<strong>${esc(s.nombre)}</strong><br>${esc(s.distrito)}, ${esc(s.depto)}<br>${esc(s.tipNombre)} · ${esc(s.perfil)}<br>Estado: ${esc(l.estado)}`)
      .addTo(mapa);
  });
}

/* ---------- ingreso ---------- */
function completarLogin(u, sedeId) {
  if (u.sedes?.length > 1 && !sedeId) { UI.login = { ...UI.login, userId: u.id, paso: "sede" }; render(); return; }
  S.session = { userId: u.id, rol: u.rol, metodo: UI.login.metodo, sedeId: sedeId || u.sedes?.[0] || null };
  auditar("Ingreso", METODOS_LOGIN[UI.login.metodo].nombre);
  UI.login = {}; UI.sel = null; UI.labSel = null;
  save();
  if (location.hash === "#/inicio") render(true); else ir("inicio");
}

/* ---------- validación de entregas ---------- */
function validarArchivo(file) {
  return new Promise((resolve) => {
    const ext = file.name.split(".").pop().toLowerCase();
    const tipo = { stl: "STL", dxf: "DXF", py: "Python" }[ext];
    if (!tipo) return resolve({ ok: false, error: "Formato no admitido. Subí un archivo .STL, .DXF o .py." });
    if (file.size > 50 * 1024 * 1024) return resolve({ ok: false, error: "El archivo supera los 50 MB." });
    const r = new FileReader();
    r.onerror = () => resolve({ ok: false, error: "No se pudo leer el archivo." });
    if (tipo === "STL") {
      r.onload = () => {
        const buf = r.result;
        const head = new TextDecoder().decode(buf.slice(0, 256)).trimStart();
        const texto = head.startsWith("solid") && new TextDecoder().decode(buf).includes("facet");
        if (texto) {
          const n = (new TextDecoder().decode(buf).match(/facet normal/g) || []).length;
          return resolve(n ? { ok: true, tipo, detalle: `STL ASCII válido · ${n.toLocaleString("es-PY")} triángulos` } : { ok: false, error: "El STL no tiene triángulos." });
        }
        if (buf.byteLength < 84) return resolve({ ok: false, error: "El STL está incompleto." });
        const n = new DataView(buf).getUint32(80, true);
        resolve(84 + n * 50 === buf.byteLength ? { ok: true, tipo, detalle: `STL binario válido · ${n.toLocaleString("es-PY")} triángulos` } : { ok: false, error: "El STL binario está dañado (el tamaño no coincide con la cantidad de triángulos)." });
      };
      r.readAsArrayBuffer(file);
    } else {
      r.onload = () => {
        const t = r.result;
        if (tipo === "DXF") {
          if (!/SECTION/.test(t) || !/EOF/.test(t)) return resolve({ ok: false, error: "No parece un DXF válido (faltan SECTION/EOF)." });
          const ent = (t.match(/\n\s*(LINE|LWPOLYLINE|CIRCLE|ARC|SPLINE|POLYLINE)\s*\r?\n/g) || []).length;
          return resolve({ ok: true, tipo, detalle: `DXF válido · ${ent} entidades de corte` });
        }
        const lineas = t.split(/\r?\n/).filter((l) => l.trim()).length;
        resolve(lineas ? { ok: true, tipo, detalle: `Python · ${lineas} líneas de código` } : { ok: false, error: "El archivo está vacío." });
      };
      r.readAsText(file);
    }
  });
}

/* ---------- acciones (clic) ---------- */
const ACCIONES = {
  ...EV_ACCIONES,
  tab: (d) => { UI.tabs[d.id] = d.tab; UI.ticket = null; render(); },
  texto: () => {
    const h = document.documentElement;
    const n = ((+h.dataset.texto || 0) + 1) % 3;
    h.dataset.texto = n; localStorage.setItem("labtic-texto", n);
  },
  contraste: () => {
    const on = document.documentElement.classList.toggle("alto-contraste");
    localStorage.setItem("labtic-contraste", on ? "1" : ""); render();
  },
  salir: () => { auditar("Cierre de sesión"); S.session = null; UI.login = {}; UI.wiz = null; UI.tabs = {}; save(); history.replaceState(null, "", "#/"); render(true); },
  reset: () => { if (confirm("¿Volver a los datos iniciales de la demo? Se pierden los cambios.")) { resetDemo(); UI.login = {}; UI.wiz = null; history.replaceState(null, "", "#/"); render(true); toast("Datos de la demo reiniciados."); } },

  "login-metodo": (d) => { UI.login = { metodo: d.m }; render(); },
  "login-volver": () => { UI.login = UI.login.paso ? { metodo: UI.login.metodo } : {}; render(); },
  "login-persona": (d) => {
    const u = usuario(d.u);
    if (u.dosFactores) { UI.login = { ...UI.login, userId: u.id, paso: "2fa" }; render(); } else completarLogin(u);
  },
  "login-sede": (d) => completarLogin(usuario(UI.login.userId), d.sede),

  dia: (d) => { UI.dia = d.d; UI.sel = null; render(); },
  "sel-turno": (d) => {
    const err = validarReserva(d.a, UI.dia || primerDiaReservable(), +d.h, yo());
    if (err) return toast(err, "error");
    UI.sel = { activoId: d.a, hora: +d.h }; render();
  },
  "sel-reserva": (d) => { UI.sel = { reservaId: d.r }; render(); },
  "sel-cerrar": () => { UI.sel = null; render(); },
  checkin: (d) => { S.reservas.find((r) => r.id === d.r).estado = "check-in"; UI.sel = null; commit("Check-in registrado. ¡Buen trabajo!"); },
  "cancelar-reserva": (d) => { S.reservas.find((r) => r.id === d.r).estado = "cancelada"; UI.sel = null; commit("Reserva cancelada; el turno quedó libre."); },

  "reportar-falla": (d) => {
    const a = activo(d.a);
    a.estado = "fuera de servicio";
    const t = nuevoTicket(a.labId, a.id, "Correctivo", "Alta", `Falla reportada: ${a.modelo}`);
    const futuras = S.reservas.filter((r) => r.activoId === a.id && r.fecha >= hoy() && r.estado === "confirmada");
    futuras.forEach((r) => (r.estado = "cancelada"));
    commit(`Se abrió el ticket ${t.id}. ${futuras.length ? futuras.length + " reservas canceladas y avisadas." : ""}`, "warn");
  },
  "activo-ok": (d) => { activo(d.a).estado = "operativo"; commit("Equipo marcado como operativo."); },
  consumir: (d) => {
    const c = S.consumibles.find((x) => x.id === d.c);
    const antes = c.stock >= c.minimo;
    c.stock = Math.max(0, c.stock - 1);
    commit(antes && c.stock < c.minimo ? `⚠ ${c.nombre} bajó del mínimo: se avisó al director y al facilitador.` : `Consumo registrado: ${c.nombre} −1 ${c.unidad}.`, antes && c.stock < c.minimo ? "warn" : "ok");
  },
  reponer: (d) => { const c = S.consumibles.find((x) => x.id === d.c); c.stock += c.minimo * 2; commit(`${c.nombre}: +${c.minimo * 2} ${c.unidad}.`); },

  consentir: (d) => {
    const prev = S.consentimientos.filter((k) => k.estudianteId === d.e && k.tipo === d.t);
    const otorgado = !consentimientoVigente(d.e, d.t);
    S.consentimientos.push({ id: uid("K"), estudianteId: d.e, tutorId: yo().id, tipo: d.t, otorgado, version: prev.length + 1, fecha: new Date().toISOString() });
    auditar(otorgado ? "Consentimiento otorgado" : "Consentimiento revocado", `${usuario(d.e).nombre} · ${d.t}`);
    let extra = "";
    if (d.t === "publicar_proyectos") {
      S.proyectos.filter((p) => p.userId === d.e && p.solicitaPublicar).forEach((p) => { p.publicado = otorgado; extra = otorgado ? ` «${p.titulo}» ya está en el Banco de Proyectos.` : " Los proyectos dejaron de estar publicados."; });
    }
    commit((otorgado ? "Consentimiento otorgado." : "Consentimiento revocado.") + extra);
  },
  "solicitar-publicar": (d) => {
    const p = S.proyectos.find((x) => x.id === d.p);
    p.solicitaPublicar = true;
    if (consentimientoVigente(p.userId, "publicar_proyectos")) { p.publicado = true; commit("¡Publicado en el Banco de Proyectos!"); }
    else commit("Listo. Le avisamos a tu tutor para que dé su consentimiento.", "warn");
  },
  fork: (d) => {
    const base = S.proyectos.find((x) => x.id === d.p);
    const u = yo();
    const p = { id: uid("p"), userId: u.id, equipo: [u.id], sedeId: sedeActiva(), titulo: "Mi versión de: " + base.titulo, desafioId: base.desafioId, basadoEn: base.id, creado: hoy(), publicado: false, solicitaPublicar: false, bitacora: [], entregas: [], feedback: [] };
    S.proyectos.push(p); save(); ir("proyecto/" + p.id); toast("Proyecto creado. Empezá anotando qué querés mejorar del original.");
  },

  "ocultar-datos": (d) => { const x = S.desafios.find((y) => y.id === d.d); x.descripcion = x.descripcion.replace(DATO_PERSONAL, "[dato removido]"); commit("Datos personales removidos del texto."); },
  votar: (d) => {
    const p = S.propuestas.find((x) => x.id === d.p);
    const u = yo().id;
    if (p.votos.includes(u)) { p.votos = p.votos.filter((v) => v !== u); commit("Voto retirado."); }
    else { p.votos.push(u); commit("¡Voto registrado!"); }
  },
  seleccionar: (d) => {
    const p = S.propuestas.find((x) => x.id === d.p);
    S.propuestas.filter((x) => x.desafioId === p.desafioId).forEach((x) => (x.ganadora = x.id === p.id));
    S.desafios.find((x) => x.id === p.desafioId).estado = "en ejecución";
    commit("Propuesta seleccionada: pasa a ejecución. Aliados y empresas pueden aportar recursos vía facilitador.");
  },

  "ver-ticket": (d) => { UI.ticket = UI.ticket === d.t ? null : d.t; render(); },
  "ticket-tomar": (d) => { const t = tk(d.t); t.asignado = yo().id; t.estado = "en curso"; t.comentarios.push(com("Ticket tomado.")); commit("Ticket asignado a vos."); },
  "ticket-resolver": (d) => {
    const t = tk(d.t); t.estado = "resuelto"; t.resuelto = new Date().toISOString(); t.comentarios.push(com("Marcado como resuelto. Falta la confirmación de la sede."));
    const a = activo(t.activoId); if (a && a.estado === "fuera de servicio") a.estado = "operativo";
    commit("Ticket resuelto; el equipo vuelve a estar disponible para reservas.");
  },
  "ticket-cerrar": (d) => { const t = tk(d.t); t.estado = "cerrado"; t.comentarios.push(com("Solución confirmada por la sede.")); commit("Ticket cerrado."); },
  "ticket-escalar": (d) => { const t = tk(d.t); t.escalado = true; t.comentarios.push(com("Escalado al proveedor por SLA vencido.")); commit("Ticket escalado al proveedor.", "warn"); },

  depto: (d) => { UI.deptoSel = UI.deptoSel === d.d ? null : d.d; render(); },
  csv: () => { descargarCSV(); toast("Reporte descargado."); },
  tarea: (d) => { const t = TAREAS.find((x) => x.id === d.t); const res = t.run(); UI.tareasLog.unshift({ nombre: t.nombre, res, fecha: new Date().toISOString() }); auditar("Tarea ejecutada", t.nombre); commit(res); },

  "carga-masiva": () => {
    const plan = S.labs.filter((l) => l.estado === "planificado");
    if (!confirm(`¿Aplicar la plantilla a ${plan.length} laboratorios?`)) return;
    const fecha = hoy();
    plan.forEach((l) => { l.estado = "en instalación"; l.plantilla = `${PLANTILLA_ESTANDAR.nombre} v${PLANTILLA_ESTANDAR.version}`; crearActivos(S, l, PLANTILLA_ESTANDAR.items, "pendiente", fecha); });
    auditar("Carga masiva", `${plan.length} laboratorios`);
    commit(`${plan.length} laboratorios pasaron a «en instalación» con sus activos pendientes de recepción.`);
  },
  "wiz-sede": (d) => { UI.wiz.sedeId = d.s; UI.wiz.lat = UI.wiz.lon = undefined; render(); },
  "wiz-gps": () => {
    if (!navigator.geolocation) return toast("Este navegador no tiene GPS.", "error");
    navigator.geolocation.getCurrentPosition(
      (p) => { UI.wiz.lat = p.coords.latitude.toFixed(5); UI.wiz.lon = p.coords.longitude.toFixed(5); render(); toast("Ubicación tomada del GPS."); },
      () => toast("No se pudo obtener la ubicación.", "error"));
  },
  "wiz-atras": () => { UI.wiz.paso--; render(); },
  "wiz-escanear": (d) => { const a = activo(d.a); a.estado = "recibido"; a.serie = "SN-" + Math.random().toString(36).slice(2, 9).toUpperCase(); commit(`QR escaneado: ${a.modelo}.`); },
  "wiz-recibir-todo": () => { S.activos.filter((a) => a.labId === UI.wiz.labId && a.estado === "pendiente").forEach((a) => { a.estado = "recibido"; a.serie = "SN-" + Math.random().toString(36).slice(2, 9).toUpperCase(); }); commit("Todos los equipos recibidos."); },
  "wiz-siguiente": () => { UI.wiz.paso++; render(); },
  "wiz-activar": () => {
    const l = lab(UI.wiz.labId);
    l.estado = "operativo"; l.alta = hoy();
    S.activos.filter((a) => a.labId === l.id).forEach((a) => { a.estado = "operativo"; a.garantiaHasta = isoDate(addDays(new Date(), 365)); });
    crearConsumibles(S, l, PLANTILLA_ESTANDAR.consumibles);
    auditar("Laboratorio activado", l.nombre);
    commit("Laboratorio activado.");
  },
  "wiz-nuevo": () => { UI.wiz = null; render(); },
};

const tk = (id) => S.tickets.find((t) => t.id === id);
const com = (texto) => ({ autor: yo().nombre, texto, fecha: new Date().toISOString() });
function nuevoTicket(labId, activoId, tipo, prioridad, titulo) {
  const n = Math.max(1000, ...S.tickets.map((t) => +t.id.replace(/\D/g, "") || 0)) + 1;
  const t = { id: "T-" + n, labId, activoId, titulo, tipo, prioridad, estado: "abierto", creado: new Date().toISOString(), slaHoras: prioridad === "Alta" ? 24 : prioridad === "Media" ? 48 : 120, autorId: yo().id, asignado: null, visita: null, escalado: false, comentarios: [] };
  S.tickets.push(t);
  return t;
}

/* ---------- formularios ---------- */
const FORMULARIOS = {
  ...EV_FORMULARIOS,
  "login-2fa": () => completarLogin(usuario(UI.login.userId)),
  "nuevo-proyecto": (fd) => {
    const u = yo();
    const p = { id: uid("p"), userId: u.id, equipo: [u.id], sedeId: sedeActiva(), titulo: fd.get("titulo"), desafioId: fd.get("desafioId") || null, basadoEn: null, creado: hoy(), publicado: false, solicitaPublicar: false,
      bitacora: [{ id: uid("B"), tipo: "objetivo", texto: fd.get("objetivo"), fecha: new Date().toISOString() }], entregas: [], feedback: [] };
    S.proyectos.push(p); save(); ir("proyecto/" + p.id); toast("Proyecto creado. Ahora explorá y planificá.");
  },
  bitacora: (fd, f) => {
    const p = S.proyectos.find((x) => x.id === f.dataset.p);
    p.bitacora.push({ id: uid("B"), tipo: fd.get("tipo"), texto: fd.get("texto"), fecha: new Date().toISOString() });
    commit("Entrada agregada a tu bitácora.");
  },
  entrega: async (fd, f) => {
    const file = fd.get("archivo");
    const v = await validarArchivo(file);
    if (!v.ok) return toast(v.error, "error");
    const p = S.proyectos.find((x) => x.id === f.dataset.p);
    const version = Math.max(0, ...p.entregas.filter((e) => e.nombre === file.name).map((e) => e.version)) + 1;
    p.entregas.push({ id: uid("E"), nombre: file.name, tipo: v.tipo, version, tam: file.size, detalle: v.detalle, fecha: new Date().toISOString() });
    commit(`Entrega v${version} subida · ${v.detalle}`);
  },
  mentor: (fd, f) => {
    const id = f.dataset.p;
    const chat = (S.mentor[id] ||= []);
    const texto = fd.get("texto");
    chat.push({ de: "yo", texto });
    commit();
    setTimeout(() => { chat.push({ de: "ia", texto: mentorResponde(texto, chat.length) }); save(); render(); document.querySelector("#m-in")?.focus(); }, 600);
  },
  feedback: (fd, f) => {
    const p = S.proyectos.find((x) => x.id === f.dataset.p);
    p.feedback.push({ id: uid("F"), autorId: yo().id, fecha: new Date().toISOString(), pregunta: fd.get("pregunta"), comentario: fd.get("comentario"),
      rubrica: Object.fromEntries(RUBRICA.map((r) => [r.id, +fd.get("r_" + r.id)])), competencias: fd.getAll("comp") });
    commit("Devolución enviada al estudiante.");
  },
  reservar: (fd) => {
    const { activoId, hora } = UI.sel;
    const fecha = UI.dia || primerDiaReservable();
    const err = validarReserva(activoId, fecha, hora, yo());
    if (err) return toast(err, "error");
    S.reservas.push({ id: uid("R"), activoId, userId: yo().id, fecha, hora, estado: "confirmada", motivo: fd.get("motivo") });
    UI.sel = null;
    commit(`Reserva confirmada: ${activo(activoId).modelo}, ${hora}:00 h. Te recordaremos 30 min antes.`);
  },
  "nuevo-desafio": (fd) => {
    const u = yo();
    const mod = esModerador();
    const circ = u.rol === "estudiante" ? 1 : u.rol === "comunidad" ? u.circulo : u.rol === "tutor" ? 4 : 1;
    S.desafios.push({ id: uid("d"), titulo: fd.get("titulo"), descripcion: fd.get("descripcion"), autor: u.nombre, autorId: u.id, circulo: circ, estado: mod ? "publicado" : "pendiente", plazo: fd.get("plazo"), sedeId: sedeActiva(), creado: hoy() });
    commit(mod ? "Desafío publicado." : "Desafío enviado a moderación.");
  },
  moderar: (fd, f, sub) => {
    const d = S.desafios.find((x) => x.id === f.dataset.d);
    if (sub?.value === "rechazar") { d.estado = "rechazado"; d.motivo = fd.get("motivo") || "No cumple los criterios"; commit("Desafío rechazado; se avisó al autor.", "warn"); }
    else {
      if (d.descripcion.match(DATO_PERSONAL)) return toast("Quitá los datos personales antes de publicar.", "error");
      d.estado = "publicado"; commit("Desafío publicado en el muro.");
    }
    auditar("Moderación", `${d.titulo}: ${d.estado}`);
  },
  jurado: (fd, f) => { const p = S.propuestas.find((x) => x.id === f.dataset.p); p.jurado.push({ autor: yo().nombre, puntaje: +fd.get("puntaje") }); commit("Puntaje técnico registrado."); },
  "publicar-resultado": (fd, f) => { const d = S.desafios.find((x) => x.id === f.dataset.d); d.estado = "resultados publicados"; d.resultado = fd.get("resultado"); commit("Resultados publicados en el Observatorio comunitario."); },
  propuesta: (fd, f) => {
    S.propuestas.push({ id: uid("pp"), desafioId: f.dataset.d, equipo: [yo().id, ...fd.getAll("equipo")], titulo: fd.get("titulo"), descripcion: fd.get("descripcion"), proyectoId: fd.get("proyectoId") || null, votos: [], jurado: [], ganadora: false, creado: hoy() });
    commit("Propuesta presentada.");
  },
  "nuevo-ticket": (fd) => {
    const a = activo(fd.get("activoId"));
    if (fd.get("fuera")) a.estado = "fuera de servicio";
    const t = nuevoTicket(a.labId, a.id, fd.get("tipo"), fd.get("prioridad"), fd.get("titulo"));
    UI.ticket = t.id; UI.tabs.tk = "abiertos";
    commit(`Ticket ${t.id} abierto · SLA ${t.slaHoras} h.`);
  },
  comentar: (fd, f) => { tk(f.dataset.t).comentarios.push(com(fd.get("texto"))); commit(); },
  visita: (fd, f) => { const t = tk(f.dataset.t); t.visita = fd.get("fecha"); if (t.estado === "abierto") t.estado = "en curso"; t.comentarios.push(com("Visita programada para el " + fmtFecha(t.visita + "T12:00") + ".")); commit("Visita programada."); },

  "wiz-1": (fd) => { Object.assign(UI.wiz, { nombre: fd.get("nombre"), lat: fd.get("lat"), lon: fd.get("lon"), paso: 2 }); render(); },
  "wiz-2": (fd) => {
    const s = SEDE_POR_ID[UI.wiz.sedeId];
    UI.wiz.modo = fd.get("modo");
    UI.wiz.items = PLANTILLA_ESTANDAR.items.map((i) => ({ ...i, cantidad: UI.wiz.modo === "propia" && i.categoria === "Notebook" ? PUESTOS_POR_TIPOLOGIA[s.tip] : i.cantidad }));
    UI.wiz.paso = 3; render();
  },
  "wiz-3": (fd) => {
    const w = UI.wiz;
    const items = w.items.map((it, i) => ({ ...it, cantidad: +fd.get("q" + i) })).filter((i) => i.cantidad > 0);
    if (fd.get("nueva_cat") && +fd.get("nueva_q") > 0) items.push({ categoria: fd.get("nueva_cat"), modelo: fd.get("nuevo_mod") || fd.get("nueva_cat"), cantidad: +fd.get("nueva_q"), lote: 2 });
    const s = SEDE_POR_ID[w.sedeId];
    const l = { id: labIdDeSede(s.id), sedeId: s.id, codigo: "LAB-" + s.id, nombre: w.nombre, estado: "en instalación", fase: "expansión",
      plantilla: w.modo === "propia" ? "Configuración propia" : `${PLANTILLA_ESTANDAR.nombre} v${PLANTILLA_ESTANDAR.version}`, lat: +w.lat, lon: +w.lon, alta: null };
    S.labs.push(l);
    crearActivos(S, l, items, "pendiente", hoy());
    auditar("Alta de laboratorio", l.nombre);
    w.labId = l.id; w.paso = 4;
    commit(`Laboratorio creado con ${S.activos.filter((a) => a.labId === l.id).length} activos pendientes de recepción.`);
  },
};

/* ---------- cambios en controles ---------- */
const CAMBIOS = {
  ...EV_CAMBIOS,
  sede: (el) => { S.session.sedeId = el.value; auditar("Cambio de sede activa", sedeNombre(el.value)); UI.sel = null; commit("Sede activa: " + sedeNombre(el.value)); },
  "lab-sel": (el) => { UI.labSel = el.value; UI.sel = null; render(); },
  habilitar: (el) => {
    const lista = (S.habilitaciones[el.dataset.u] ||= []);
    const c = el.dataset.c;
    S.habilitaciones[el.dataset.u] = el.checked ? [...new Set([...lista, c])] : lista.filter((x) => x !== c);
    auditar(el.checked ? "Habilitación otorgada" : "Habilitación retirada", `${usuario(el.dataset.u).nombre} · ${c}`);
    commit(`${usuario(el.dataset.u).nombre.split(" ")[0]}: ${el.checked ? "habilitada/o" : "sin habilitación"} para ${c}.`);
  },
  filtro: (el) => { UI.filtros[el.dataset.f] = el.value; render(); },
  "wiz-q": (el) => { UI.wiz.q = el.value; render(); },
};

/* ---------- eventos ---------- */
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  if (!el || el.disabled) return;
  const fn = ACCIONES[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el.dataset, el); }
});
document.addEventListener("submit", (e) => {
  const f = e.target.closest("form[data-form]");
  if (!f) return;
  e.preventDefault();
  const fn = FORMULARIOS[f.dataset.form];
  if (fn) fn(new FormData(f), f, e.submitter);
});
const onCambio = (e) => {
  const el = e.target.closest("[data-change]");
  if (!el) return;
  const esTexto = el.tagName === "INPUT" && el.type !== "checkbox";
  if ((e.type === "input") !== esTexto) return;
  CAMBIOS[el.dataset.change]?.(el);
};
document.addEventListener("change", onCambio);
document.addEventListener("input", onCambio);

window.addEventListener("hashchange", () => {
  UI.sel = null; UI.ticket = null;
  const [ruta, param] = parseHash();
  if (S.session && ruta === "proyecto") {
    const p = S.proyectos.find((x) => x.id === param);
    const u = yo();
    if (p && !p.publicado && !p.equipo.includes(u.id) && accesoProyecto(p)) { auditar("Acceso a datos de menor", `Proyecto «${p.titulo}»`); save(); }
  }
  render(true);
});

/* ---------- arranque ---------- */
(function init() {
  const h = document.documentElement;
  h.dataset.texto = localStorage.getItem("labtic-texto") || 0;
  if (localStorage.getItem("labtic-contraste")) h.classList.add("alto-contraste");
  TAREAS.find((t) => t.id === "checkin").run();
  save();
  render(true);
})();
