/* Laboratorios TIC · prototipo conceptual
   Vistas (render a HTML). El estado de interfaz no persistido vive en UI. */

const UI = {
  login: {}, wiz: null, sel: null, ticket: null, dia: null, tabs: {}, filtros: {}, labSel: null, deptoSel: null, tareasLog: [],
};

/* ---------- componentes ---------- */
const badge = (t, cls = "") => `<span class="badge ${cls}">${esc(t)}</span>`;
const kpi = (label, valor, hint = "", cls = "") =>
  `<div class="kpi ${cls}"><div class="kpi-valor">${valor}</div><div class="kpi-label">${esc(label)}</div>${hint ? `<div class="kpi-hint">${esc(hint)}</div>` : ""}</div>`;
const barra = (pct, cls = "") =>
  `<div class="barra ${cls}" role="img" aria-label="${Math.round(pct)}%"><span style="width:${Math.max(0, Math.min(100, pct))}%"></span></div>`;
const vacio = (t) => `<p class="vacio">${esc(t)}</p>`;
const tabs = (id, items) => {
  const act = UI.tabs[id] || items[0][0];
  return `<div class="tabs" role="tablist">${items.map(([k, t]) =>
    `<button role="tab" aria-selected="${k === act}" class="tab ${k === act ? "on" : ""}" data-act="tab" data-id="${id}" data-tab="${k}">${t}</button>`).join("")}</div>`;
};
const tabActiva = (id, def) => UI.tabs[id] || def;
const link = (href, t, cls = "") => `<a class="${cls}" href="#/${href}">${t}</a>`;
const sedeNombre = (id) => SEDE_POR_ID[id]?.nombre || "—";
const estadoBadge = (e) => badge(e, { operativo: "ok", "en instalación": "warn", planificado: "muted", "fuera de servicio": "bad", pendiente: "muted", recibido: "info", abierto: "warn", "en curso": "info", resuelto: "ok", cerrado: "muted", publicado: "ok", rechazado: "bad", "en ejecución": "info", "resultados publicados": "ok", confirmada: "info", "check-in": "ok", cancelada: "muted", liberada: "muted" }[e] || "");
const nivelAlerta = (n) => badge(n === "alta" ? "Alta" : "Media", n === "alta" ? "bad" : "warn");

function flujoStrip(p) {
  const pasos = pasoFlujo(p);
  return `<ol class="flujo" aria-label="Avance en el ciclo Aprender Haciendo">${FLUJO_APRENDIZAJE.map((t, i) =>
    `<li class="${pasos[i] ? "hecho" : ""}"><span class="num">${i + 1}</span><span>${t}</span></li>`).join("")}</ol>`;
}

function nombresEquipo(p, ocultar) {
  if (p.autorPublico) return p.autorPublico;
  if (ocultar) return "Equipo de " + sedeNombre(p.sedeId);
  return p.equipo.map((id) => nombrePublico(usuario(id))).join(", ");
}

/* ---------- menú por rol ---------- */
function menu() {
  const u = yo();
  const r = u.rol;
  return [
    ["inicio", "Inicio", "🏠", true],
    ["taller", "Mi taller", "🧪", r === "estudiante"],
    ["aula", "Mi aula", "👩‍🏫", r === "facilitador"],
    ["portfolio", "Portfolio y consentimientos", "👪", r === "tutor"],
    ["reservas", "Reservas", "📅", !!puede("Reservar equipos")],
    ["inventario", "Inventario", "📦", !!puede("Gestionar inventario de la sede")],
    ["laboratorios", "Laboratorios", "🗺️", r === "admin"],
    ["desafios", "Desafíos", "💡", !!puede("Crear desafíos / votar")],
    ["banco", "Banco de proyectos", "📚", true],
    ["soporte", "Soporte técnico", "🛠️", !!(puede("Abrir tickets de soporte") || puede("Gestionar tickets y visitas"))],
    ["evaluacion", r === "estudiante" ? "Mi evaluación" : "Evaluación y monitoreo", "📊", r === "estudiante" || !!puede("Ver tableros de monitoreo")],
    ["sistema", "Sistema y privacidad", "🔐", r === "admin"],
  ].filter((x) => x[3]);
}

function layout(ruta, contenido) {
  const u = yo();
  const sedes = u.sedes || [];
  return `
  <a class="skip" href="#main">Saltar al contenido</a>
  <header class="topbar">
    <div class="brand"><span class="logo" aria-hidden="true">◆</span> Laboratorios TIC <small>prototipo</small></div>
    ${sedes.length > 1 ? `<label class="sede-sel">Sede activa
      <select data-change="sede">${sedes.map((s) => `<option value="${s}" ${s === sedeActiva() ? "selected" : ""}>${esc(sedeNombre(s))}</option>`).join("")}</select></label>`
      : sedes.length ? `<div class="sede-sel"><span>Sede</span> <strong>${esc(sedeNombre(sedes[0]))}</strong></div>` : `<div class="sede-sel"><strong>${u.rol === "comunidad" ? "Círculo " + u.circulo + " · " + CIRCULOS[u.circulo].nombre : "Alcance nacional"}</strong></div>`}
    <div class="user"><strong>${esc(u.nombre)}</strong> ${badge(ROLES[u.rol], "rol")}<small>vía ${esc(METODOS_LOGIN[S.session.metodo].nombre)}</small></div>
    <div class="a11y" role="group" aria-label="Accesibilidad">
      <button data-act="texto" title="Agrandar texto" aria-label="Agrandar texto">A+</button>
      <button data-act="contraste" aria-pressed="${document.documentElement.classList.contains("alto-contraste")}" title="Alto contraste" aria-label="Alto contraste">◐</button>
      <button data-act="salir">Salir</button>
    </div>
  </header>
  <div class="cuerpo">
    <nav class="menu" aria-label="Principal"><ul>${menu().map(([id, t, ic]) =>
      `<li><a href="#/${id}" ${ruta === id ? 'aria-current="page"' : ""}><span aria-hidden="true">${ic}</span> ${t}</a></li>`).join("")}</ul>
      <div class="menu-pie"><button class="link" data-act="reset">Reiniciar datos de la demo</button></div>
    </nav>
    <main id="main" tabindex="-1">${contenido}</main>
  </div>
  <footer class="pie">Prototipo conceptual · Las escuelas son reales (listado de 200 seleccionadas); personas, proyectos, tickets e indicadores son simulados. Los datos quedan solo en este navegador.</footer>`;
}

/* ---------- ingreso ---------- */
function vistaLogin() {
  const l = UI.login;
  let panel = "";
  if (!l.metodo) {
    panel = `<div class="metodos">${Object.entries(METODOS_LOGIN).map(([k, m]) => `
      <button class="metodo" data-act="login-metodo" data-m="${k}">
        <strong>${m.nombre}</strong>
        <span>${k === "mec" ? "Estudiantes, docentes y directores" : k === "identidad" ? "Docentes, directores, tutores y comunidad" : "Soporte, administradores y quien no tenga las anteriores (doble factor para soporte/admin)"}</span>
      </button>`).join("")}</div>`;
  } else if (l.paso === "2fa") {
    const u = usuario(l.userId);
    panel = `<form class="card" data-form="login-2fa">
      <h2>Doble factor</h2><p>${esc(u.nombre)}: ingresá el código de 6 dígitos de tu app autenticadora (en la demo, cualquier número de 6 dígitos).</p>
      <label>Código <input name="codigo" inputmode="numeric" pattern="[0-9]{6}" required autofocus autocomplete="one-time-code"></label>
      <div class="acciones"><button type="button" class="sec" data-act="login-volver">Volver</button><button>Verificar</button></div></form>`;
  } else if (l.paso === "sede") {
    const u = usuario(l.userId);
    panel = `<div class="card"><h2>Elegí la sede activa</h2><p>Tenés membresía en ${u.sedes.length} sedes. Podés cambiarla después desde la barra superior; el historial de cada sede se conserva.</p>
      <div class="lista-botones">${u.sedes.map((s) => `<button data-act="login-sede" data-sede="${s}">${esc(sedeNombre(s))}<small>${esc(SEDE_POR_ID[s].distrito)}, ${esc(SEDE_POR_ID[s].depto)}</small></button>`).join("")}</div></div>`;
  } else {
    const m = METODOS_LOGIN[l.metodo];
    const personas = S.usuarios.filter((u) => m.roles.includes(u.rol));
    panel = `<div class="card"><h2>${m.nombre}</h2>
      <p class="nota">${l.metodo === "mec" ? "El servicio de login del MEC devuelve un token con tipo de usuario e identificador." : l.metodo === "identidad" ? "Redirección al servicio de Identidad Electrónica del Estado; vuelve la identidad verificada." : "Usuario y contraseña cifrada, verificación por correo y bloqueo por intentos fallidos."} En la demo, elegí una persona:</p>
      <div class="lista-botones">${personas.map((u) => `<button data-act="login-persona" data-u="${u.id}">${esc(u.nombre)}<small>${ROLES[u.rol]}${u.sedes ? " · " + esc(sedeNombre(u.sedes[0])) : u.circulo ? " · Círculo " + u.circulo : ""}</small></button>`).join("")}</div>
      <button class="link" data-act="login-volver">← Otro método de ingreso</button></div>`;
  }
  return `<a class="skip" href="#main">Saltar al contenido</a>
  <main id="main" class="login" tabindex="-1">
    <div class="login-hero">
      <div class="brand grande"><span class="logo" aria-hidden="true">◆</span> Laboratorios TIC</div>
      <h1>Aprender haciendo, en ${SEDES_CON_LAB.length} laboratorios del país</h1>
      <p>Plataforma para estudiantes de 15 a 18 años, facilitadores, directores, familias y el ecosistema de actores: desafíos reales, reservas de equipos, bitácora de aprendizaje, soporte técnico y monitoreo.</p>
      <ul class="hero-datos"><li><strong>${S.labs.filter((x) => x.estado === "operativo").length}</strong> laboratorios operativos</li><li><strong>${S.labs.filter((x) => x.estado !== "operativo").length}</strong> en expansión</li><li><strong>${new Set(SEDES_CON_LAB.map((s) => s.depto)).size}</strong> departamentos</li></ul>
    </div>
    <div class="login-panel"><h2 class="sr">Ingresar</h2>${panel}</div>
  </main>`;
}

/* ---------- inicio ---------- */
function vistaInicio() {
  const u = yo();
  const saludo = `<h1 tabindex="-1">Hola, ${esc(u.corto || u.nombre)}</h1>`;
  const lb = labActivo();
  if (u.rol === "estudiante") {
    const mis = S.proyectos.filter((p) => p.equipo.includes(u.id));
    const actual = mis.find((p) => !p.publicado) || mis[0];
    const res = S.reservas.filter((r) => r.userId === u.id && r.estado === "confirmada" && r.fecha >= hoy()).sort((a, b) => (a.fecha + pad(a.hora)).localeCompare(b.fecha + pad(b.hora)));
    const ins = insignias(u.id);
    return `${saludo}<p class="sub">${esc(sedeNombre(sedeActiva()))} · ${esc(u.curso)}</p>
      ${ins.length ? `<div class="insignias" aria-label="Tus insignias">${ins.map(([i, t]) => `<span class="insignia"><span aria-hidden="true">${i}</span> ${t}</span>`).join("")}</div>` : ""}
      <div class="grid2">
        <section class="card"><h2>Tu proyecto en curso</h2>${actual ? `<h3>${link("proyecto/" + actual.id, esc(actual.titulo))}</h3>${flujoStrip(actual)}` : vacio("Todavía no empezaste un proyecto.")}
          <div class="acciones">${link("taller", "Ir a mi taller", "btn")}</div></section>
        <section class="card"><h2>Próximas reservas</h2>${res.length ? `<ul class="lista">${res.map((r) => `<li><strong>${esc(activo(r.activoId).modelo)}</strong><span>${fmtFecha(r.fecha + "T12:00")} · ${r.hora}:00 h</span></li>`).join("")}</ul>` : vacio("No tenés reservas.")}
          <div class="acciones">${link("reservas", "Reservar un equipo", "btn sec")}</div></section>
        <section class="card"><h2>Desafíos abiertos</h2><ul class="lista">${S.desafios.filter((d) => d.estado === "publicado").slice(0, 3).map((d) => `<li>${link("desafio/" + d.id, esc(d.titulo))}<span>${badge("Círculo " + d.circulo)} hasta ${fmtFecha(d.plazo + "T12:00")}</span></li>`).join("")}</ul></section>
        <section class="card nota-priv"><h2>Tu privacidad</h2><p>Tu portfolio es <strong>privado por defecto</strong>. Solo se publica en el Banco de Proyectos si lo pedís y tu tutor da su consentimiento. Ningún adulto externo puede escribirte directamente: todo pasa por tu facilitador.</p></section>
      </div>`;
  }
  if (u.rol === "facilitador") {
    const porRevisar = proyectosPorRevisar(sedeActiva());
    const resHoy = S.reservas.filter((r) => r.fecha === hoy() && r.estado !== "cancelada" && activo(r.activoId).labId === lb.id);
    const tk = S.tickets.filter((t) => t.labId === lb.id && !["cerrado", "resuelto"].includes(t.estado));
    const mod = S.desafios.filter((d) => d.estado === "pendiente");
    return `${saludo}<p class="sub">${esc(sedeNombre(sedeActiva()))}</p>
      <div class="kpis">${kpi("Bitácoras para leer", porRevisar.length)}${kpi("Reservas hoy", resHoy.length)}${kpi("Tickets abiertos", tk.length)}${kpi("Desafíos por moderar", mod.length)}</div>
      <div class="grid2">
        <section class="card"><h2>Para leer y acompañar</h2>${porRevisar.length ? `<ul class="lista">${porRevisar.map((p) => `<li>${link("proyecto/" + p.id, esc(p.titulo))}<span>${esc(nombresEquipo(p))} · última entrada ${fmtFecha(p.bitacora.at(-1).fecha)}</span></li>`).join("")}</ul>` : vacio("Estás al día.")}</section>
        <section class="card"><h2>Reservas de hoy</h2>${resHoy.length ? `<ul class="lista">${resHoy.map((r) => `<li><strong>${r.hora}:00 h · ${esc(activo(r.activoId).modelo)}</strong><span>${esc(usuario(r.userId).nombre)} ${estadoBadge(r.estado)}</span></li>`).join("")}</ul>` : vacio("Sin reservas hoy.")}</section>
        <section class="card"><h2>Recordá</h2><p>Acompañá con <strong>preguntas, no con respuestas</strong>. La rúbrica evalúa el proceso (exploración, iteración, reflexión) además del producto.</p>${mod.length ? `<p>${link("desafios", `Hay ${mod.length} desafío(s) del ecosistema esperando moderación →`)}</p>` : ""}</section>
      </div>`;
  }
  if (u.rol === "director") {
    const ind = indicadoresLab(lb);
    const acts = S.activos.filter((a) => a.labId === lb.id);
    const al = alertasLabs([lb]);
    const gar = acts.map((a) => a.garantiaHasta).sort()[0];
    const dias = Math.round((new Date(gar) - new Date()) / 864e5);
    return `${saludo}<p class="sub">${esc(lb.nombre)} ${estadoBadge(lb.estado)}</p>
      <div class="kpis">${kpi("Horas de uso esta semana", ind.horasSemana)}${kpi("Disponibilidad de equipos", ind.disponibilidad + "%")}${kpi("Consumibles bajo mínimo", stockBajo(lb.id).length, "", stockBajo(lb.id).length ? "alerta" : "")}${kpi("Tickets abiertos", S.tickets.filter((t) => t.labId === lb.id && !["cerrado", "resuelto"].includes(t.estado)).length)}</div>
      ${dias <= 30 ? `<div class="aviso warn" role="alert">La garantía y el mantenimiento del proveedor vencen en <strong>${dias} días</strong> (${fmtFecha(gar + "T12:00")}). Revisá los equipos y abrí los tickets pendientes antes de esa fecha.</div>` : ""}
      <div class="grid2">
        <section class="card"><h2>Alertas de la sede</h2>${al.length ? `<ul class="lista">${al.map((a) => `<li><strong>${nivelAlerta(a.nivel)} ${esc(a.tipo)}</strong><span>${esc(a.texto)}</span></li>`).join("")}</ul>` : vacio("Sin alertas.")}
        <div class="acciones">${link("inventario", "Ver inventario", "btn sec")}${link("soporte", "Ver tickets", "btn sec")}</div></section>
        <section class="card"><h2>Desafíos de la comunidad</h2><ul class="lista">${S.desafios.filter((d) => d.estado !== "rechazado").map((d) => `<li>${link("desafio/" + d.id, esc(d.titulo))}<span>${estadoBadge(d.estado)} ${S.propuestas.filter((p) => p.desafioId === d.id).length} propuestas</span></li>`).join("")}</ul></section>
      </div>`;
  }
  if (u.rol === "tutor") {
    const pupilos = u.pupilos.map(usuario);
    return `${saludo}<div class="grid2">${pupilos.map((e) => {
      const pend = S.proyectos.filter((p) => p.userId === e.id && p.solicitaPublicar && !p.publicado);
      return `<section class="card"><h2>${esc(e.nombre)}</h2><p>${esc(sedeNombre(e.sedes[0]))} · ${esc(e.curso)}</p>
        ${pend.length ? `<div class="aviso warn" role="alert">${esc(e.nombre.split(" ")[0])} pidió publicar «${esc(pend[0].titulo)}» en el Banco de Proyectos. Necesita tu consentimiento.</div>` : ""}
        <p>${S.proyectos.filter((p) => p.equipo.includes(e.id)).length} proyectos · ${insignias(e.id).length} insignias</p>
        <div class="acciones">${link("portfolio", "Ver portfolio y consentimientos", "btn")}</div></section>`;
    }).join("")}
      <section class="card nota-priv"><h2>Cómo cuidamos los datos</h2><p>Solo guardamos ID MEC, nombre, sede y curso. Nada se publica fuera de la sede sin tu consentimiento, que podés revocar cuando quieras. No hay mensajería privada entre adultos externos y estudiantes.</p></section></div>`;
  }
  if (u.rol === "comunidad") {
    const mios = S.desafios.filter((d) => d.autorId === u.id);
    return `${saludo}<p class="sub">Círculo ${u.circulo}: ${CIRCULOS[u.circulo].nombre} (${CIRCULOS[u.circulo].detalle})</p>
      <div class="aviso info">Toda interacción con estudiantes pasa por el facilitador. Podés proponer desafíos (con moderación)${u.circulo <= 3 ? ", ofrecer mentoría vía facilitador y actuar como jurado técnico" : ""} y ver los resultados publicados.</div>
      <div class="grid2"><section class="card"><h2>Tus desafíos</h2>${mios.length ? `<ul class="lista">${mios.map((d) => `<li>${link("desafio/" + d.id, esc(d.titulo))}<span>${estadoBadge(d.estado)} ${S.propuestas.filter((p) => p.desafioId === d.id).length} propuestas</span></li>`).join("")}</ul>` : vacio("Aún no propusiste desafíos.")}
        <div class="acciones">${link("desafios", "Proponer un desafío", "btn")}</div></section>
        <section class="card"><h2>Proyectos publicados</h2><p>${S.proyectos.filter((p) => p.publicado).length} proyectos con consentimiento en el Banco.</p><div class="acciones">${link("banco", "Explorar el Banco", "btn sec")}</div></section></div>`;
  }
  if (u.rol === "soporte") {
    const abiertos = S.tickets.filter((t) => !["cerrado", "resuelto"].includes(t.estado));
    const vencidos = abiertos.filter((t) => slaRestante(t) < 0);
    return `${saludo}<div class="kpis">${kpi("Tickets abiertos", abiertos.length)}${kpi("SLA vencido", vencidos.length, "", vencidos.length ? "alerta" : "")}${kpi("Visitas programadas", abiertos.filter((t) => t.visita).length)}${kpi("Equipos fuera de servicio", S.activos.filter((a) => a.estado === "fuera de servicio").length)}</div>
      <section class="card"><h2>Próximos a vencer</h2>${tablaTickets(abiertos.sort((a, b) => slaRestante(a) - slaRestante(b)).slice(0, 6))}<div class="acciones">${link("soporte", "Ir a la mesa de ayuda", "btn")}</div></section>`;
  }
  // admin
  const ops = S.labs.filter((l) => l.estado === "operativo");
  const inds = ops.map(indicadoresLab);
  const al = alertasLabs(ops);
  return `${saludo}<p class="sub">Coordinación nacional · MITIC / MEC</p>
    <div class="kpis">${kpi("Laboratorios operativos", `${ops.length}<small>/${S.labs.length}</small>`)}${kpi("Horas de uso promedio", Math.round(avg(inds.map((i) => i.horasSemana))), "por laboratorio y semana")}${kpi("Estudiantes activos", Math.round(avg(inds.map((i) => i.activosPct))) + "%")}${kpi("Disponibilidad de equipos", Math.round(avg(inds.map((i) => i.disponibilidad))) + "%")}${kpi("Alertas", al.length, "", "alerta")}</div>
    <div class="grid2"><section class="card"><h2>Alertas recientes</h2><ul class="lista">${al.slice(0, 6).map((a) => `<li><strong>${nivelAlerta(a.nivel)} ${esc(a.tipo)}</strong><span>${esc(SEDE_POR_ID[a.lab.sedeId].nombre)} · ${esc(a.texto)}</span></li>`).join("")}</ul><div class="acciones">${link("evaluacion", "Tablero nacional", "btn")}</div></section>
    <section class="card"><h2>Expansión</h2><p>${S.labs.filter((l) => l.estado === "planificado").length} laboratorios planificados y ${S.labs.filter((l) => l.estado === "en instalación").length} en instalación.</p><div class="acciones">${link("laboratorios", "Gestionar laboratorios", "btn sec")}</div></section></div>`;
}

function proyectosPorRevisar(sedeId) {
  return S.proyectos.filter((p) => p.sedeId === sedeId && p.userId && p.bitacora.length && (!p.feedback.length || p.bitacora.at(-1).fecha > p.feedback.at(-1).fecha));
}

/* ---------- taller (estudiante) ---------- */
function vistaTaller() {
  const u = yo();
  const mis = S.proyectos.filter((p) => p.equipo.includes(u.id));
  const des = S.desafios.filter((d) => d.estado === "publicado");
  return `<h1 tabindex="-1">Mi taller</h1><p class="sub">Construí, probá y reflexioná. Sin recetas: vos elegís el camino.</p>
    <details class="card" ${mis.length ? "" : "open"}><summary><strong>＋ Empezar un proyecto</strong></summary>
      <form data-form="nuevo-proyecto" class="form">
        <label>¿Cómo se llama tu proyecto? <input name="titulo" required maxlength="80"></label>
        <label>Parte de un desafío <select name="desafioId"><option value="">Proyecto propio</option>${des.map((d) => `<option value="${d.id}">${esc(d.titulo)}</option>`).join("")}</select></label>
        <label>Qué quiero lograr y por qué <textarea name="objetivo" rows="3" required placeholder="Primera entrada de tu bitácora"></textarea></label>
        <div class="acciones"><button>Crear proyecto</button></div></form></details>
    <h2>Mis proyectos</h2>
    <div class="grid2">${mis.map((p) => `<article class="card proyecto">
      <h3>${link("proyecto/" + p.id, esc(p.titulo))}</h3>
      <p class="meta">${p.desafioId ? "Desafío: " + esc(S.desafios.find((d) => d.id === p.desafioId)?.titulo) : "Proyecto propio"}${p.basadoEn ? " · basado en otro proyecto del Banco" : ""}</p>
      ${flujoStrip(p)}
      <p class="meta">${p.bitacora.length} entradas de bitácora · ${p.entregas.length} entregas · ${p.feedback.length} devoluciones ${p.publicado ? badge("Publicado", "ok") : badge("Privado", "muted")}</p>
    </article>`).join("") || vacio("Todavía no tenés proyectos.")}</div>
    <div class="grid2">
      <section class="card"><h2>Formación continua</h2><ul class="lista">
        <li><strong>Seguridad en la cortadora láser</strong><span>Obligatorio para habilitarte · video 6 min + checklist ${(S.habilitaciones[u.id] || []).includes("Cortadora láser") ? badge("Habilitado", "ok") : badge("Pendiente", "warn")}</span></li>
        <li><strong>Impresión 3D: de la idea al STL</strong><span>Curso por módulos con certificado ${badge("3 de 5", "info")}</span></li>
        <li><strong>Programación por bloques (Blockly)</strong><span>Lecciones y simulaciones</span></li>
        <li><strong>Python con sensores</strong><span>Simulador de circuitos + Raspberry Pi 5</span></li></ul></section>
      <section class="card"><h2>Guías autogestionadas</h2><p>Cada máquina del laboratorio tiene un código QR pegado: escanealo para ver el video corto de uso y el checklist de seguridad.</p>
        <p>Tus habilitaciones: ${(S.habilitaciones[u.id] || []).map((c) => badge(c, "ok")).join(" ") || "ninguna todavía"}</p></section>
    </div>`;
}

/* ---------- proyecto ---------- */
function accesoProyecto(p) {
  const u = yo();
  if (p.equipo.includes(u.id)) return "editar";
  if (u.rol === "facilitador" && u.sedes.includes(p.sedeId)) return "facilitar";
  if ((u.rol === "director" && u.sedes.includes(p.sedeId)) || u.rol === "admin") return "ver";
  if (u.rol === "tutor" && p.equipo.some((id) => u.pupilos.includes(id))) return "ver";
  if (p.publicado) return "publico";
  return null;
}

function vistaProyecto(id) {
  const p = S.proyectos.find((x) => x.id === id);
  if (!p) return `<h1 tabindex="-1">Proyecto no encontrado</h1>`;
  const acc = accesoProyecto(p);
  if (!acc) return `<h1 tabindex="-1">Sin acceso</h1><p>Este proyecto es privado.</p>`;
  const ocultar = ["comunidad", "tutor"].includes(yo().rol) && acc === "publico";
  const des = S.desafios.find((d) => d.id === p.desafioId);
  const base = p.basadoEn ? S.proyectos.find((x) => x.id === p.basadoEn) : null;
  const editar = acc === "editar";
  const chat = S.mentor[p.id] || [];
  return `<p class="miga">${link(yo().rol === "estudiante" ? "taller" : yo().rol === "facilitador" ? "aula" : "banco", "← Volver")}</p>
    <h1 tabindex="-1">${esc(p.titulo)}</h1>
    <p class="sub">${esc(nombresEquipo(p, ocultar))} · ${esc(sedeNombre(p.sedeId))} · ${des ? "Desafío: " + link("desafio/" + des.id, esc(des.titulo)) : "Proyecto propio"} ${p.publicado ? badge("Publicado en el Banco", "ok") : badge("Privado", "muted")}
      ${base ? `<br>Construido sobre ${link("proyecto/" + base.id, esc(base.titulo))}` : ""}</p>
    ${flujoStrip(p)}
    <div class="grid2 ancho">
      <div>
        <section class="card"><h2>Bitácora de metacognición</h2>
          ${editar ? `<form class="form" data-form="bitacora" data-p="${p.id}">
            <label>Tipo de entrada <select name="tipo">${Object.entries(TIPOS_BITACORA).map(([k, t]) => `<option value="${k}">${t}</option>`).join("")}</select></label>
            <label>Tu reflexión <textarea name="texto" rows="3" required></textarea></label>
            <div class="acciones"><button>Agregar a la bitácora</button></div></form>` : ""}
          <ol class="bitacora">${[...p.bitacora].reverse().map((b) => `<li class="b-${b.tipo}"><div class="b-tipo">${TIPOS_BITACORA[b.tipo]}</div><p>${esc(b.texto)}</p><time>${fmtFechaHora(b.fecha)}</time></li>`).join("") || vacio("Sin entradas todavía.")}</ol>
        </section>
        <section class="card"><h2>Entregas</h2>
          ${editar ? `<form class="form" data-form="entrega" data-p="${p.id}">
            <label>Archivo (.STL, .DXF o Python) <input type="file" name="archivo" accept=".stl,.dxf,.py" required></label>
            <div class="acciones"><button>Subir versión</button></div><p class="nota">Se valida el formato y se guarda como nueva versión. En la demo solo se guarda el nombre y el resultado de la validación.</p></form>` : ""}
          <table class="tabla"><thead><tr><th>Archivo</th><th>Versión</th><th>Validación</th><th>Fecha</th></tr></thead><tbody>
          ${[...p.entregas].reverse().map((e) => `<tr><td><span class="ext ext-${e.tipo.toLowerCase()}">${e.tipo}</span> ${esc(e.nombre)}</td><td>v${e.version}</td><td>${esc(e.detalle || "Formato válido")}</td><td>${fmtFecha(e.fecha)}</td></tr>`).join("") || `<tr><td colspan="4">${vacio("Sin entregas.")}</td></tr>`}
          </tbody></table></section>
      </div>
      <div>
        ${acc === "editar" || acc === "facilitar" ? `<section class="card mentor"><h2>Mentor IA <small>pregunta antes de responder</small></h2>
          <div class="chat" aria-live="polite">${chat.length ? chat.map((m) => `<div class="msg ${m.de}"><span class="sr">${m.de === "ia" ? "Mentor" : "Vos"}:</span>${esc(m.texto)}</div>`).join("") : `<div class="msg ia">Hola. No te voy a dar la solución, pero sí buenas preguntas. ¿En qué estás trabado?</div>`}</div>
          ${editar ? `<form class="chat-form" data-form="mentor" data-p="${p.id}"><label class="sr" for="m-in">Mensaje al mentor</label><input id="m-in" name="texto" required placeholder="Ej.: la pieza se quiebra, ¿cómo lo hago?" autocomplete="off"><button>Enviar</button></form>` : `<p class="nota">Vista del facilitador: podés leer la conversación del equipo con el mentor.</p>`}
        </section>` : ""}
        <section class="card"><h2>Retroalimentación</h2>
          ${p.feedback.map((f) => `<div class="feedback"><p class="meta">${esc(usuario(f.autorId)?.nombre)} · ${fmtFecha(f.fecha)}</p>
            ${f.pregunta ? `<p class="pregunta">❓ ${esc(f.pregunta)}</p>` : ""}${f.comentario ? `<p>${esc(f.comentario)}</p>` : ""}
            <table class="rubrica"><tbody>${RUBRICA.map((r) => `<tr><th>${r.tipo}: ${r.nombre}</th><td>${barra(f.rubrica[r.id] * 25)}</td><td>${NIVELES[f.rubrica[r.id]] || "—"}</td></tr>`).join("")}</tbody></table>
            ${f.competencias?.length ? `<p>${f.competencias.map((c) => badge(c, "info")).join(" ")}</p>` : ""}</div>`).join("") || vacio("Aún sin devoluciones.")}
          ${(p.autoevaluaciones || []).length && acc !== "publico" ? `<details class="autoeval"><summary>Autoevaluaciones del estudiante (${p.autoevaluaciones.length})</summary>${p.autoevaluaciones.slice().reverse().map((a) => `<div class="feedback"><p class="meta">${esc(usuario(a.userId)?.nombre)} · ${fmtFecha(a.fecha)}</p><p>«${esc(a.evidencia)}»</p>
            <table class="rubrica"><tbody>${RUBRICA.map((r) => `<tr><th>${r.tipo}: ${r.nombre}</th><td>${barra(a.rubrica[r.id] * 25)}</td><td>${NIVELES[a.rubrica[r.id]]}</td></tr>`).join("")}</tbody></table></div>`).join("")}</details>` : ""}
          ${editar ? `<p class="nota">${link("evaluacion", "Autoevaluarme y comparar con mi facilitador →")}</p>` : ""}
          ${acc === "facilitar" ? formFeedback(p) : ""}
        </section>
        ${editar ? `<section class="card"><h2>Compartir</h2>${p.publicado ? `<p>Está en el Banco de Proyectos para que otros construyan encima.</p>` :
          p.solicitaPublicar ? `<div class="aviso warn">Esperando el consentimiento de tu tutor para publicarlo fuera de la sede.</div>` :
          `<p>Cuando lo creas listo, pedí publicarlo en el Banco de Proyectos. Como sos menor de edad, tu tutor tiene que dar su consentimiento.</p><div class="acciones"><button data-act="solicitar-publicar" data-p="${p.id}">Pedir publicación</button></div>`}</section>` : ""}
      </div>
    </div>`;
}

function formFeedback(p) {
  return `<form class="form fb" data-form="feedback" data-p="${p.id}"><h3>Nueva devolución</h3>
    <label>Pregunta para seguir pensando <input name="pregunta" placeholder="¿Qué pasaría si…?"></label>
    <label>Comentario sobre el proceso <textarea name="comentario" rows="2"></textarea></label>
    <fieldset><legend>Rúbrica</legend>${RUBRICA.map((r) => `<label class="fila">${r.tipo}: ${r.nombre}
      <select name="r_${r.id}">${[1, 2, 3, 4].map((n) => `<option value="${n}" ${n === 3 ? "selected" : ""}>${n} · ${NIVELES[n]}</option>`).join("")}</select></label>`).join("")}</fieldset>
    <fieldset><legend>Competencias evidenciadas (ISTE / siglo XXI)</legend><div class="checks">${COMPETENCIAS.map((c) => `<label><input type="checkbox" name="comp" value="${esc(c)}"> ${c}</label>`).join("")}</div></fieldset>
    <div class="acciones"><button>Enviar devolución</button></div></form>`;
}
