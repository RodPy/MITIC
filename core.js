/* Laboratorios TIC · prototipo conceptual
   Núcleo: utilidades, estado persistido en localStorage, datos de demo,
   roles y permisos (RBAC), reglas de negocio y tareas automáticas. */

const STORE_KEY = "labtic-prototipo-v1";

/* ---------- utilidades ---------- */
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hoy = () => isoDate(new Date());
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const addHours = (d, n) => new Date(new Date(d).getTime() + n * 3600e3);
const fmtFecha = (s) => new Date(s).toLocaleDateString("es-PY", { day: "2-digit", month: "short", year: "numeric" });
const fmtFechaHora = (s) =>
  new Date(s).toLocaleString("es-PY", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const uid = (p) => p + Math.random().toString(36).slice(2, 8);
const hashNum = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967295; };
const sum = (a) => a.reduce((x, y) => x + y, 0);
const avg = (a) => (a.length ? sum(a) / a.length : 0);

const SEDE_POR_ID = Object.fromEntries(window.SEDES.map((s) => [s.id, s]));

/* ---------- catálogo ---------- */
const CATEGORIAS_RESERVABLES = ["Impresora 3D FDM", "Impresora 3D de resina", "Cortadora láser", "Escáner 3D"];

const PLANTILLA_ESTANDAR = {
  nombre: "Kit estándar 2027",
  version: 1,
  items: [
    { categoria: "Notebook", modelo: "Notebook educativa 14\"", cantidad: 24, lote: 1 },
    { categoria: "Impresora 3D FDM", modelo: "FDM 25×21×21 cm", cantidad: 2, lote: 1 },
    { categoria: "Impresora 3D de resina", modelo: "Resina MSLA 8K", cantidad: 1, lote: 1 },
    { categoria: "Cortadora láser", modelo: "Láser CO₂ 60 W 60×40", cantidad: 1, lote: 1 },
    { categoria: "Escáner 3D", modelo: "Escáner de luz estructurada", cantidad: 1, lote: 2 },
    { categoria: "Kit de robótica", modelo: "Kit robótica educativa", cantidad: 6, lote: 2 },
    { categoria: "Placa de programación", modelo: "Placa microcontrolador", cantidad: 12, lote: 2 },
    { categoria: "Kit IA", modelo: "Raspberry Pi 5", cantidad: 4, lote: 2 },
    { categoria: "Kit IA", modelo: "Jetson Orin Nano Super", cantidad: 2, lote: 2 },
  ],
  consumibles: [
    { nombre: "Filamento PLA", unidad: "kg", stock: 12, minimo: 5 },
    { nombre: "Resina fotocurable", unidad: "L", stock: 4, minimo: 2 },
    { nombre: "MDF 3 mm", unidad: "planchas", stock: 40, minimo: 15 },
    { nombre: "Acrílico 3 mm", unidad: "planchas", stock: 15, minimo: 6 },
  ],
};

/* Puestos sugeridos según la tipología STEAM calculada por matrícula de media */
const PUESTOS_POR_TIPOLOGIA = { T0: 16, T1: 18, T2: 24, T3: 36, T4: 48 };

const CIRCULOS = {
  1: { nombre: "Núcleo estudiantil", detalle: "ACEs, Centro de Estudiantes, EGIE" },
  2: { nombre: "Aliados con convenio", detalle: "Organizaciones con convenio vigente con MITIC" },
  3: { nombre: "Academia y comunidad estudiantil", detalle: "Universidades y organizaciones afines" },
  4: { nombre: "Entorno ampliado", detalle: "Sociedad civil y empresas" },
};

const FLUJO_APRENDIZAJE = [
  "Parte de un desafío", "Explora y planifica", "Reserva el equipo", "Prototipa y prueba",
  "Reflexiona", "Recibe preguntas", "Itera y entrega", "Comparte",
];

const TIPOS_BITACORA = {
  objetivo: "Qué quiero lograr y por qué",
  prueba: "Qué probé, qué falló y qué cambié",
  aprendizaje: "Qué aprendí y qué haría distinto",
  boceto: "Boceto, foto o versión",
};

const RUBRICA = [
  { id: "exploracion", nombre: "Exploración y planificación", tipo: "Proceso" },
  { id: "iteracion", nombre: "Iteración a partir del error", tipo: "Proceso" },
  { id: "reflexion", nombre: "Reflexión metacognitiva", tipo: "Proceso" },
  { id: "funcionalidad", nombre: "Funcionalidad del prototipo", tipo: "Producto" },
  { id: "fabricacion", nombre: "Calidad de fabricación", tipo: "Producto" },
];
const NIVELES = ["", "Inicial", "En desarrollo", "Logrado", "Destacado"];
const COMPETENCIAS = ["Diseñador innovador", "Pensador computacional", "Constructor de conocimiento", "Colaborador global", "Comunicador creativo"];

/* ---------- roles y permisos (matriz de la propuesta, lámina 18) ---------- */
const ROLES = {
  estudiante: "Estudiante", facilitador: "Facilitador", director: "Director/a", tutor: "Tutor/a",
  comunidad: "Comunidad", soporte: "Soporte", admin: "Admin MITIC",
};
const PF = "full", PL = "lim";
const PERMISOS = {
  "Seguir rutas y entregar proyectos": { estudiante: PF },
  "Reservar equipos": { estudiante: PL, facilitador: PF, director: PF, admin: PF },
  "Dar retroalimentación": { facilitador: PF },
  "Ver portfolio del estudiante": { estudiante: PF, facilitador: PF, director: PF, tutor: PL, admin: PF },
  "Gestionar inventario de la sede": { facilitador: PL, director: PF, soporte: PL, admin: PF },
  "Crear desafíos / votar": { estudiante: PF, facilitador: PF, director: PF, tutor: PL, comunidad: PL, admin: PF },
  "Abrir tickets de soporte": { facilitador: PF, director: PF, soporte: PF, admin: PF },
  "Gestionar tickets y visitas": { soporte: PF, admin: PF },
  "Configuración global y reportes": { director: PL, admin: PF },
  "Ver tableros de monitoreo": { facilitador: PL, director: PL, soporte: PL, admin: PF },
};
const puede = (cap, rol = S.session?.rol) => PERMISOS[cap]?.[rol] || null;

const METODOS_LOGIN = {
  mec: { nombre: "SSO del MEC", roles: ["estudiante", "facilitador", "director"] },
  identidad: { nombre: "Identidad Electrónica", roles: ["facilitador", "director", "tutor", "comunidad"] },
  local: { nombre: "Login convencional", roles: ["soporte", "admin", "comunidad"] },
};

/* ---------- semilla ---------- */
const SEDES_CON_LAB = window.SEDES.filter((s) => s.sel);
const SEDE_A = SEDE_POR_ID["1106003"] ? "1106003" : SEDES_CON_LAB.find((s) => s.ini).id;
const SEDE_B = SEDE_POR_ID["1102033"] ? "1102033" : SEDES_CON_LAB.filter((s) => s.ini)[1].id;
const labIdDeSede = (sedeId) => "L" + sedeId;

function crearActivos(st, lab, items, estado, fechaAlta) {
  let n = st.activos.filter((a) => a.labId === lab.id).length;
  const garantia = isoDate(addDays(new Date(fechaAlta), 365));
  for (const it of items) {
    const unitario = CATEGORIAS_RESERVABLES.includes(it.categoria);
    const filas = unitario ? it.cantidad : 1;
    for (let i = 0; i < filas; i++) {
      n++;
      st.activos.push({
        id: `${lab.id}-A${n}`, labId: lab.id, categoria: it.categoria,
        modelo: it.modelo + (unitario && it.cantidad > 1 ? ` #${i + 1}` : ""),
        cantidad: unitario ? 1 : it.cantidad, lote: it.lote || 2, reservable: unitario,
        serie: estado === "pendiente" ? null : "SN-" + Math.random().toString(36).slice(2, 9).toUpperCase(),
        estado, garantiaHasta: garantia,
      });
    }
  }
}

function crearConsumibles(st, lab, lista) {
  for (const c of lista) st.consumibles.push({ id: uid("C"), labId: lab.id, ...c });
}

function seed() {
  const ahora = new Date();
  const st = {
    v: 1, session: null, labs: [], activos: [], consumibles: [], reservas: [], tickets: [],
    proyectos: [], desafios: [], propuestas: [], consentimientos: [], auditoria: [], mentor: {},
    seguimientos: {}, reportes: {}, consolidacion: null,
    plantillas: [JSON.parse(JSON.stringify(PLANTILLA_ESTANDAR))],
    habilitaciones: {
      u1: ["Impresora 3D FDM", "Escáner 3D"],
      u8: ["Impresora 3D FDM", "Cortadora láser", "Impresora 3D de resina", "Escáner 3D"],
      u9: [],
    },
    usuarios: [
      { id: "u1", nombre: "Ana Benítez", corto: "Ana", rol: "estudiante", sedes: [SEDE_A], curso: "2.º CC", menor: true, tutorId: "u4" },
      { id: "u8", nombre: "Luis Giménez", corto: "Luis", rol: "estudiante", sedes: [SEDE_A], curso: "3.º CT", menor: true },
      { id: "u9", nombre: "Sofía Ramírez", corto: "Sofía", rol: "estudiante", sedes: [SEDE_A], curso: "1.º CC", menor: true },
      { id: "u2", nombre: "Prof. Carlos Ortiz", corto: "Carlos", rol: "facilitador", sedes: [SEDE_A, SEDE_B] },
      { id: "u3", nombre: "Lic. María Duarte", corto: "María", rol: "director", sedes: [SEDE_A] },
      { id: "u4", nombre: "Rosa Benítez", corto: "Rosa", rol: "tutor", sedes: [SEDE_A], pupilos: ["u1"] },
      { id: "u5", nombre: "Fundación Paraguay Innova", corto: "Fundación Paraguay Innova", rol: "comunidad", circulo: 2 },
      { id: "u10", nombre: "Facultad Politécnica (UNA)", corto: "Facultad Politécnica", rol: "comunidad", circulo: 3 },
      { id: "u6", nombre: "Téc. Diego Acosta (proveedor)", corto: "Diego", rol: "soporte", dosFactores: true },
      { id: "u7", nombre: "Coordinación MITIC", corto: "equipo MITIC", rol: "admin", dosFactores: true },
    ],
  };

  for (const s of SEDES_CON_LAB) {
    const alta = isoDate(addDays(ahora, -Math.round(30 + hashNum(s.id) * 310)));
    const lab = {
      id: labIdDeSede(s.id), sedeId: s.id, codigo: "LAB-" + s.id,
      nombre: "Laboratorio TIC " + s.nombre, estado: s.ini ? "operativo" : "planificado",
      fase: s.ini ? "inicial" : "expansión", plantilla: s.ini ? "Kit estándar 2027 v1" : null,
      lat: s.lat, lon: s.lon, alta: s.ini ? alta : null,
    };
    st.labs.push(lab);
    if (s.ini) {
      crearActivos(st, lab, PLANTILLA_ESTANDAR.items, "operativo", alta);
      crearConsumibles(st, lab, PLANTILLA_ESTANDAR.consumibles.map((c) => ({
        ...c, stock: Math.max(1, Math.round(c.stock * (0.3 + hashNum(s.id + c.nombre) * 0.9))),
      })));
    }
  }

  const labA = labIdDeSede(SEDE_A), labB = labIdDeSede(SEDE_B);
  st.labs.find((l) => l.id === labA).alta = isoDate(addDays(ahora, -340));
  st.activos.filter((a) => a.labId === labA).forEach((a) => (a.garantiaHasta = isoDate(addDays(ahora, 25))));
  const actA = st.activos.filter((a) => a.labId === labA);
  const resinaA = actA.find((a) => a.categoria === "Impresora 3D de resina");
  resinaA.estado = "fuera de servicio";
  st.consumibles.filter((c) => c.labId === labA).forEach((c) => {
    c.stock = c.nombre === "Filamento PLA" ? 3 : c.minimo + 4;
  });
  // algunos labs con equipos fuera de servicio para el tablero nacional
  st.labs.filter((l) => l.estado === "operativo" && l.id !== labA).forEach((l, i) => {
    if (i % 9 === 4) st.activos.find((a) => a.labId === l.id && a.categoria === "Cortadora láser").estado = "fuera de servicio";
  });

  const laser = actA.find((a) => a.categoria === "Cortadora láser");
  const fdm1 = actA.find((a) => a.categoria === "Impresora 3D FDM");
  const escaner = actA.find((a) => a.categoria === "Escáner 3D");
  const h = ahora.getHours();
  const hora = (x) => Math.min(16, Math.max(8, x));
  st.reservas.push(
    { id: uid("R"), activoId: laser.id, userId: "u2", fecha: hoy(), hora: hora(h + 1), estado: "confirmada", motivo: "Demostración de corte" },
    { id: uid("R"), activoId: fdm1.id, userId: "u8", fecha: hoy(), hora: hora(h + 2), estado: "confirmada", motivo: "Caja de sensores v3" },
    { id: uid("R"), activoId: fdm1.id, userId: "u1", fecha: isoDate(addDays(ahora, 1)), hora: 10, estado: "confirmada", motivo: "Soporte de sensor v2" },
    { id: uid("R"), activoId: escaner.id, userId: "u9", fecha: isoDate(addDays(ahora, 2)), hora: 14, estado: "confirmada", motivo: "Escaneo de pieza" },
  );

  st.desafios.push(
    { id: "d1", titulo: "Huerta escolar con riego inteligente", descripcion: "La huerta del colegio se seca en verano y el agua de la ESSAP es cara. ¿Cómo regar solo cuando hace falta?", autor: "Centro de Estudiantes", autorId: "u8", circulo: 1, estado: "publicado", plazo: isoDate(addDays(ahora, 30)), sedeId: SEDE_A, creado: isoDate(addDays(ahora, -20)) },
    { id: "d2", titulo: "Sensores de calidad de aire en la escuela", descripcion: "Medir polvo y CO₂ en las aulas para decidir cuándo ventilar. Ofrecemos placas y mentoría técnica vía facilitador.", autor: "Fundación Paraguay Innova", autorId: "u5", circulo: 2, estado: "publicado", plazo: isoDate(addDays(ahora, 45)), sedeId: null, creado: isoDate(addDays(ahora, -12)) },
    { id: "d3", titulo: "Señalética accesible para el barrio", descripcion: "Diseñar carteles táctiles y en braille para la parada de colectivos frente al colegio.", autor: "Facultad Politécnica (UNA)", autorId: "u10", circulo: 3, estado: "publicado", plazo: isoDate(addDays(ahora, 60)), sedeId: null, creado: isoDate(addDays(ahora, -5)) },
    { id: "d4", titulo: "Reutilizar los plásticos del colegio", descripcion: "Juntamos tapitas y botellas. ¿Se pueden convertir en filamento o piezas útiles? Contacto: 0981 123 456", autor: "Recicla Py S.A.", autorId: null, circulo: 4, estado: "pendiente", plazo: isoDate(addDays(ahora, 40)), sedeId: null, creado: hoy() },
  );

  st.proyectos.push(
    {
      id: "p1", userId: "u1", equipo: ["u1"], sedeId: SEDE_A, titulo: "Riego por goteo con sensor de humedad", desafioId: "d1", basadoEn: null,
      creado: isoDate(addDays(ahora, -15)), publicado: false, solicitaPublicar: false,
      bitacora: [
        { id: uid("B"), tipo: "objetivo", texto: "Quiero que la huerta se riegue sola cuando la tierra está seca, para no desperdiciar agua.", fecha: addDays(ahora, -15).toISOString() },
        { id: uid("B"), tipo: "prueba", texto: "El primer soporte del sensor se quebró al clavarlo en la tierra. Cambié el relleno de 15% a 40% y le agregué una punta.", fecha: addDays(ahora, -8).toISOString() },
        { id: uid("B"), tipo: "aprendizaje", texto: "Aprendí que la orientación de impresión cambia la resistencia. La próxima vez pruebo con una pieza chica antes.", fecha: addDays(ahora, -3).toISOString() },
      ],
      entregas: [
        { id: uid("E"), nombre: "soporte_sensor.stl", tipo: "STL", version: 1, tam: 182334, fecha: addDays(ahora, -9).toISOString() },
        { id: uid("E"), nombre: "soporte_sensor.stl", tipo: "STL", version: 2, tam: 201118, fecha: addDays(ahora, -4).toISOString() },
        { id: uid("E"), nombre: "riego.py", tipo: "Python", version: 1, tam: 2210, fecha: addDays(ahora, -2).toISOString() },
      ],
      feedback: [
        { id: uid("F"), autorId: "u2", fecha: addDays(ahora, -6).toISOString(), rubrica: { exploracion: 3, iteracion: 3, reflexion: 2, funcionalidad: 2, fabricacion: 3 }, competencias: ["Diseñador innovador"], pregunta: "¿Cómo vas a saber si el sensor mide bien sin esperar a que llueva?", comentario: "Muy buena decisión de cambiar el relleno. Registrá también qué valores lee el sensor." },
      ],
    },
    {
      id: "p2", userId: "u8", equipo: ["u8", "u1"], sedeId: SEDE_A, titulo: "Caja estanca para sensores cortada en láser", desafioId: "d1", basadoEn: null,
      creado: isoDate(addDays(ahora, -25)), publicado: true, solicitaPublicar: true,
      bitacora: [
        { id: uid("B"), tipo: "objetivo", texto: "Proteger la electrónica del riego y la lluvia.", fecha: addDays(ahora, -25).toISOString() },
        { id: uid("B"), tipo: "prueba", texto: "El encastre quedó flojo: no medí el ancho del corte. Ajusté 0,15 mm.", fecha: addDays(ahora, -18).toISOString() },
        { id: uid("B"), tipo: "aprendizaje", texto: "Medir antes de cortar ahorra material.", fecha: addDays(ahora, -10).toISOString() },
      ],
      entregas: [
        { id: uid("E"), nombre: "caja_sensores.dxf", tipo: "DXF", version: 3, tam: 48120, fecha: addDays(ahora, -11).toISOString() },
      ],
      feedback: [],
    },
    {
      id: "p3", userId: "u9", equipo: ["u9"], sedeId: SEDE_A, titulo: "Medidor de CO₂ para el aula", desafioId: "d2", basadoEn: null,
      creado: isoDate(addDays(ahora, -4)), publicado: false, solicitaPublicar: false,
      bitacora: [
        { id: uid("B"), tipo: "objetivo", texto: "Saber cuándo abrir las ventanas del aula.", fecha: addDays(ahora, -4).toISOString() },
        { id: uid("B"), tipo: "prueba", texto: "Conecté el sensor a la Raspberry pero da siempre 400 ppm.", fecha: addDays(ahora, -1).toISOString() },
      ],
      entregas: [], feedback: [],
    },
  );
  // proyectos publicados de otras sedes para el Banco de Proyectos
  const otras = SEDES_CON_LAB.filter((s) => s.ini && s.id !== SEDE_A);
  [
    ["Brazo robótico con material reciclado", "Joaquín", ["brazo_base.stl", "STL"]],
    ["Clasificador de residuos con visión artificial", "Belén", ["clasificador.py", "Python"]],
    ["Mapa táctil del colegio", "Tomás", ["mapa_tactil.dxf", "DXF"]],
    ["Estación meteorológica escolar", "Camila", ["estacion.py", "Python"]],
  ].forEach(([titulo, nombre, [arch, tipo]], i) => {
    st.proyectos.push({
      id: "px" + i, userId: null, autorPublico: nombre, equipo: [], sedeId: otras[i * 7].id, titulo, desafioId: i === 3 ? "d2" : null,
      creado: isoDate(addDays(ahora, -60 + i * 9)), publicado: true, solicitaPublicar: true, bitacora: [], feedback: [],
      entregas: [{ id: uid("E"), nombre: arch, tipo, version: 2, tam: 50000, fecha: addDays(ahora, -40 + i * 7).toISOString() }],
    });
  });

  st.propuestas.push(
    { id: "pp1", desafioId: "d1", equipo: ["u1", "u8"], titulo: "Riego automático con sensor y caja estanca", descripcion: "Unimos el sensor de humedad con la caja cortada en láser y una válvula.", proyectoId: "p1", votos: ["u8", "u9", "x1", "x2", "x3"], jurado: [{ autor: "Facultad Politécnica (UNA)", puntaje: 4 }], ganadora: false, creado: isoDate(addDays(ahora, -6)) },
    { id: "pp2", desafioId: "d2", equipo: ["u9"], titulo: "Semáforo de ventilación", descripcion: "Un LED verde/amarillo/rojo según el CO₂ medido.", proyectoId: "p3", votos: ["u1", "x4"], jurado: [], ganadora: false, creado: isoDate(addDays(ahora, -2)) },
  );

  st.consentimientos.push(
    { id: uid("K"), estudianteId: "u8", tutorId: null, tipo: "publicar_proyectos", otorgado: true, version: 1, fecha: addDays(ahora, -30).toISOString() },
    { id: uid("K"), estudianteId: "u1", tutorId: "u4", tipo: "imagenes", otorgado: false, version: 1, fecha: addDays(ahora, -40).toISOString() },
  );

  st.tickets.push(
    { id: "T-1042", labId: labA, activoId: resinaA.id, titulo: "La impresora de resina no adhiere la primera capa", tipo: "Correctivo", prioridad: "Alta", estado: "abierto", creado: addHours(ahora, -40).toISOString(), slaHoras: 48, autorId: "u3", asignado: null, visita: null, escalado: false, comentarios: [] },
    { id: "T-1038", labId: labB, activoId: st.activos.find((a) => a.labId === labB && a.categoria === "Cortadora láser").id, titulo: "Mantenimiento preventivo trimestral", tipo: "Preventivo", prioridad: "Media", estado: "en curso", creado: addHours(ahora, -30).toISOString(), slaHoras: 72, autorId: "u6", asignado: "u6", visita: isoDate(addDays(ahora, 2)), escalado: false, comentarios: [{ autor: "Téc. Diego Acosta (proveedor)", texto: "Visita coordinada con el facilitador.", fecha: addHours(ahora, -20).toISOString() }] },
    { id: "T-1021", labId: labA, activoId: fdm1.id, titulo: "Boquilla obstruida", tipo: "Garantía", prioridad: "Media", estado: "cerrado", creado: addDays(ahora, -20).toISOString(), slaHoras: 48, autorId: "u2", asignado: "u6", visita: null, escalado: false, resuelto: addDays(ahora, -19).toISOString(), comentarios: [] },
  );
  // tickets históricos del resto de los laboratorios, para el indicador de SLA
  st.labs.filter((l) => l.estado === "operativo" && l.id !== labA).forEach((l, i) => {
    if (i % 4) return;
    const creado = addDays(ahora, -10 - i);
    st.tickets.push({ id: "T-" + (900 + i), labId: l.id, activoId: st.activos.find((a) => a.labId === l.id).id, titulo: "Notebook no enciende", tipo: "Garantía", prioridad: "Media", estado: "cerrado", creado: creado.toISOString(), slaHoras: 48, autorId: null, asignado: "u6", visita: null, escalado: false, resuelto: addHours(creado, 12 + hashNum(l.id) * 60).toISOString(), comentarios: [] });
  });

  return st;
}

/* ---------- estado ---------- */
function load() {
  try { const s = JSON.parse(localStorage.getItem(STORE_KEY)); return s && s.v === 1 ? s : null; } catch { return null; }
}
/* Datos del módulo de evaluación; también completa estados guardados por versiones anteriores */
function completarEvaluacion(st) {
  st.seguimientos ||= {};
  st.reportes ||= {};
  st.proyectos.forEach((p) => (p.autoevaluaciones ||= []));
  if (!st.autoevalSembrada) {
    st.autoevalSembrada = true;
    const p1 = st.proyectos.find((p) => p.id === "p1");
    const p2 = st.proyectos.find((p) => p.id === "p2");
    p1?.autoevaluaciones.push({ id: uid("A"), userId: "u1", fecha: addDays(new Date(), -5).toISOString(), rubrica: { exploracion: 3, iteracion: 4, reflexion: 3, funcionalidad: 3, fabricacion: 3 }, evidencia: "Hice dos versiones del soporte y anoté por qué falló la primera." });
    p2?.autoevaluaciones.push({ id: uid("A"), userId: "u8", fecha: addDays(new Date(), -9).toISOString(), rubrica: { exploracion: 3, iteracion: 3, reflexion: 2, funcionalidad: 4, fabricacion: 4 }, evidencia: "La caja quedó estanca en la prueba con agua." });
  }
  if (!st.consolidacion) {
    const d = new Date(); d.setHours(2, 0, 0, 0);
    const ops = st.labs.filter((l) => l.estado === "operativo");
    st.consolidacion = { fecha: d.toISOString(), labs: ops.length, deptos: new Set(ops.map((l) => SEDE_POR_ID[l.sedeId].depto)).size, eventos: 37 };
  }
  return st;
}

let S = completarEvaluacion(load() || seed());
const save = () => localStorage.setItem(STORE_KEY, JSON.stringify(S));
function resetDemo() { localStorage.removeItem(STORE_KEY); S = completarEvaluacion(seed()); save(); }

const usuario = (id) => S.usuarios.find((u) => u.id === id);
const yo = () => (S.session ? usuario(S.session.userId) : null);
const lab = (id) => S.labs.find((l) => l.id === id);
const labDeSede = (sedeId) => S.labs.find((l) => l.sedeId === sedeId);
const activo = (id) => S.activos.find((a) => a.id === id);
const sedeActiva = () => S.session?.sedeId || null;
const labActivo = () => (sedeActiva() ? labDeSede(sedeActiva()) : null);
const nombrePublico = (u) => (u ? u.nombre.split(" ")[0] + " " + (u.nombre.split(" ")[1] || "").charAt(0) + "." : "");

function auditar(accion, detalle = "") {
  const u = yo();
  S.auditoria.unshift({ fecha: new Date().toISOString(), usuario: u ? u.nombre : "sistema", rol: u ? ROLES[u.rol] : "", accion, detalle });
  S.auditoria = S.auditoria.slice(0, 400);
}

/* ---------- reglas de negocio ---------- */
const MAX_RESERVAS_ESTUDIANTE = 2;
const HORAS = [8, 9, 10, 11, 12, 13, 14, 15, 16];
const reservaVigente = (r) => !["cancelada", "liberada"].includes(r.estado);
const primerDiaReservable = () => (new Date().getHours() > HORAS.at(-1) ? isoDate(addDays(new Date(), 1)) : hoy());

function validarReserva(activoId, fecha, hora, user) {
  const a = activo(activoId);
  if (!a || a.estado !== "operativo") return "El equipo no está disponible.";
  if (S.reservas.some((r) => r.activoId === activoId && r.fecha === fecha && r.hora === hora && reservaVigente(r)))
    return "Ese turno ya está ocupado.";
  const ahora = new Date();
  if (fecha === hoy() && hora < ahora.getHours()) return "Ese turno ya pasó.";
  if (user.rol === "estudiante") {
    if (!(S.habilitaciones[user.id] || []).includes(a.categoria))
      return `Necesitás la habilitación de seguridad para «${a.categoria}». Pedila a tu facilitador.`;
    const activas = S.reservas.filter((r) => r.userId === user.id && r.estado === "confirmada" && r.fecha >= hoy());
    if (activas.length >= MAX_RESERVAS_ESTUDIANTE) return `Podés tener hasta ${MAX_RESERVAS_ESTUDIANTE} reservas activas.`;
    if (S.reservas.some((r) => r.userId === user.id && r.fecha === fecha && r.hora === hora && r.estado === "confirmada"))
      return "Ya tenés otra reserva en ese horario.";
  }
  return null;
}

function stockBajo(labId) {
  return S.consumibles.filter((c) => (!labId || c.labId === labId) && c.stock < c.minimo);
}

function slaRestante(t) {
  if (["resuelto", "cerrado"].includes(t.estado)) return null;
  return (new Date(t.creado).getTime() + t.slaHoras * 3600e3 - Date.now()) / 3600e3;
}

function pasoFlujo(p) {
  const tiene = (tipo) => p.bitacora.some((b) => b.tipo === tipo);
  const reservo = S.reservas.some((r) => p.equipo.includes(r.userId) && r.estado !== "cancelada");
  const pasos = [
    !!p.desafioId || !!p.titulo, tiene("objetivo"), reservo, tiene("prueba"),
    tiene("aprendizaje"), p.feedback.length > 0, p.entregas.length > 0, p.publicado,
  ];
  return pasos;
}

function consentimientoVigente(estudianteId, tipo) {
  const c = S.consentimientos.filter((k) => k.estudianteId === estudianteId && k.tipo === tipo);
  return c.length ? c[c.length - 1].otorgado : false;
}

function insignias(userId) {
  const mis = S.proyectos.filter((p) => p.equipo.includes(userId));
  const out = [];
  if (mis.some((p) => p.entregas.length)) out.push(["🛠️", "Primera entrega"]);
  if (mis.some((p) => Math.max(0, ...p.entregas.map((e) => e.version)) >= 2)) out.push(["🔁", "Iterador: 2 o más versiones"]);
  if (sum(mis.map((p) => p.bitacora.filter((b) => b.tipo === "aprendizaje").length)) >= 1) out.push(["🧠", "Reflexivo"]);
  if (mis.some((p) => p.publicado)) out.push(["🌐", "Compartió en el Banco"]);
  if (S.propuestas.some((pp) => pp.equipo.includes(userId))) out.push(["🗳️", "Propuso una solución"]);
  return out;
}

/* ---------- indicadores (monitoreo) ---------- */
function indicadoresLab(l) {
  const r = hashNum(l.id);
  const acts = S.activos.filter((a) => a.labId === l.id && a.reservable);
  const disp = acts.length ? acts.filter((a) => a.estado === "operativo").length / acts.length : 0;
  const tks = S.tickets.filter((t) => t.labId === l.id && t.resuelto);
  const slaHoras = tks.length ? avg(tks.map((t) => (new Date(t.resuelto) - new Date(t.creado)) / 3600e3)) : null;
  const reservasSemana = S.reservas.filter((x) => acts.some((a) => a.id === x.activoId) && x.estado !== "cancelada").length;
  return {
    horasSemana: Math.round(3 + r * 24 + reservasSemana),
    activosPct: Math.round(30 + hashNum(l.id + "a") * 60),
    avanceRutas: Math.round(20 + hashNum(l.id + "b") * 65),
    proyectos: Math.round(hashNum(l.id + "c") * 14) + S.proyectos.filter((p) => p.sedeId === l.sedeId && p.publicado).length,
    disponibilidad: Math.round(disp * 100),
    slaHoras,
  };
}

function alertasLabs(labs) {
  const out = [];
  for (const l of labs) {
    const s = SEDE_POR_ID[l.sedeId];
    const ind = indicadoresLab(l);
    if (ind.horasSemana < 8) out.push({ nivel: "media", tipo: "Bajo uso", lab: l, ref: l.id, texto: `${ind.horasSemana} h de uso esta semana (${s.depto})` });
    S.activos.filter((a) => a.labId === l.id && a.estado === "fuera de servicio")
      .forEach((a) => out.push({ nivel: "alta", tipo: "Equipo fuera de servicio", lab: l, ref: a.id, texto: a.modelo }));
    stockBajo(l.id).forEach((c) => out.push({ nivel: "media", tipo: "Stock bajo", lab: l, ref: c.id, texto: `${c.nombre}: ${c.stock} ${c.unidad} (mínimo ${c.minimo})` }));
  }
  out.forEach((a) => (a.clave = a.tipo + "|" + a.ref));
  return out;
}

/* Consolidación nocturna: deja constancia de cuándo se recalcularon los tableros */
function consolidar() {
  const ops = S.labs.filter((l) => l.estado === "operativo");
  const desde = addDays(new Date(), -1).toISOString();
  const eventos = S.proyectos.flatMap((p) => [...p.bitacora, ...p.entregas, ...p.feedback, ...(p.autoevaluaciones || [])]).filter((e) => e.fecha >= desde).length
    + S.tickets.filter((t) => t.creado >= desde).length;
  S.consolidacion = { fecha: new Date().toISOString(), labs: ops.length, deptos: new Set(ops.map((l) => SEDE_POR_ID[l.sedeId].depto)).size, eventos };
  return S.consolidacion;
}

/* ---------- tareas automáticas (lámina 20) ---------- */
const TAREAS = [
  {
    id: "stock", nombre: "Revisión de stock de consumibles", disparador: "Cada hora y tras cada consumo",
    run() { const b = stockBajo(); return `${b.length} consumibles bajo el mínimo en ${new Set(b.map((c) => c.labId)).size} laboratorios. Alerta enviada a directores y facilitadores.`; },
  },
  {
    id: "checkin", nombre: "Liberar turnos sin check-in", disparador: "15 min después del inicio del turno",
    run() {
      const ahora = new Date(); let n = 0;
      S.reservas.forEach((r) => {
        const inicio = new Date(r.fecha + "T" + pad(r.hora) + ":00");
        if (r.estado === "confirmada" && ahora - inicio > 15 * 60e3) { r.estado = "liberada"; n++; }
      });
      return `${n} turnos liberados por falta de check-in.`;
    },
  },
  {
    id: "sla", nombre: "Control de SLA de tickets", disparador: "Cada 30 min",
    run() {
      let n = 0;
      S.tickets.forEach((t) => { const r = slaRestante(t); if (r !== null && r < 0 && !t.escalado) { t.escalado = true; n++; t.comentarios.push({ autor: "Sistema", texto: "SLA vencido: escalado automáticamente al proveedor.", fecha: new Date().toISOString() }); } });
      return `${n} tickets escalados al proveedor por SLA vencido.`;
    },
  },
  {
    id: "preventivo", nombre: "Mantenimiento preventivo", disparador: "Según plan trimestral",
    run() {
      let n = 0; const limite = addDays(new Date(), -90);
      S.labs.filter((l) => l.estado === "operativo").forEach((l) => {
        const ult = S.tickets.filter((t) => t.labId === l.id && t.tipo === "Preventivo").map((t) => new Date(t.creado)).sort((a, b) => b - a)[0];
        if (!ult || ult < limite) {
          n++;
          S.tickets.push({ id: "T-" + (1100 + S.tickets.length), labId: l.id, activoId: S.activos.find((a) => a.labId === l.id && a.categoria === "Cortadora láser")?.id, titulo: "Mantenimiento preventivo trimestral", tipo: "Preventivo", prioridad: "Baja", estado: "abierto", creado: new Date().toISOString(), slaHoras: 240, autorId: null, asignado: null, visita: null, escalado: false, comentarios: [] });
        }
      });
      return `${n} tickets preventivos creados.`;
    },
  },
  {
    id: "garantias", nombre: "Vencimiento de garantías", disparador: "Diario",
    run() {
      const lim = isoDate(addDays(new Date(), 30));
      const labs = new Set(S.activos.filter((a) => a.estado !== "pendiente" && a.garantiaHasta <= lim && a.garantiaHasta >= hoy()).map((a) => a.labId));
      return `Laboratorios con garantía que vence en los próximos 30 días: ${labs.size}. Aviso enviado.`;
    },
  },
  {
    id: "indicadores", nombre: "Cálculo de indicadores", disparador: "Cada noche",
    run() { const c = consolidar(); return `Indicadores recalculados para ${c.labs} laboratorios en ${c.deptos} departamentos (datos anonimizados).`; },
  },
  {
    id: "reporte", nombre: "Reporte semanal para el MITIC", disparador: "Semanal",
    run() { descargarCSV(); return "Reporte generado y descargado (CSV)."; },
  },
];

function descargarCSV() {
  const filas = [["Laboratorio", "Departamento", "Distrito", "Tipología", "Estado", "Horas/semana", "% estudiantes activos", "Avance rutas %", "Proyectos", "Disponibilidad equipos %", "SLA promedio (h)"]];
  S.labs.forEach((l) => {
    const s = SEDE_POR_ID[l.sedeId];
    const i = l.estado === "operativo" ? indicadoresLab(l) : {};
    filas.push([l.nombre, s.depto, s.distrito, s.tipNombre, l.estado, i.horasSemana ?? "", i.activosPct ?? "", i.avanceRutas ?? "", i.proyectos ?? "", i.disponibilidad ?? "", i.slaHoras != null ? i.slaHoras.toFixed(1) : ""]);
  });
  bajarCSV(filas, `reporte_laboratorios_${hoy()}.csv`);
}

function bajarCSV(filas, nombre) {
  const csv = "\ufeff" + filas.map((f) => f.map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- Mentor IA (simulado: pregunta antes de responder) ---------- */
const PREGUNTAS_GENERICAS = [
  "¿Qué querés que haga tu prototipo que hoy todavía no hace?",
  "Si tuvieras que explicárselo a un compañero de 1.º, ¿cómo lo dirías en una frase?",
  "¿Qué es lo más pequeño que podrías probar hoy para aprender algo nuevo?",
  "¿Qué evidencia tenés de que funciona? ¿Cómo la registrarías en tu bitácora?",
];
function mentorResponde(texto, n) {
  const t = texto.toLowerCase();
  if (/(c[oó]mo (lo )?hago|dame|decime|pasame|la respuesta|resolv|hac[eé]melo|el c[oó]digo)/.test(t))
    return "Antes de darte una respuesta: ¿qué intentaste hasta ahora y qué pasó? Contame el último resultado que obtuviste y qué esperabas.";
  if (/(fall|error|no funciona|no anda|se rompi|se quebr|se despeg|siempre da)/.test(t))
    return "Los errores son datos. ¿Qué cambió entre la última versión que funcionaba y esta? ¿Podés cambiar una sola variable y volver a probar?";
  if (/(imprim|stl|3d|filamento|relleno|resina)/.test(t))
    return "¿Qué parte de la pieza es la crítica? ¿Probaste imprimir solo esa sección, más chica, para ahorrar material y tiempo?";
  if (/(l[aá]ser|dxf|cort|encastre|mdf|acr[ií]lico)/.test(t))
    return "¿Qué tolerancia necesitan tus encastres? ¿Cómo podrías medir cuánto material quema el láser antes del corte final?";
  if (/(python|sensor|raspberry|jetson|placa|c[oó]digo|programa)/.test(t))
    return "¿Cómo sabés si el sensor está leyendo bien? ¿Qué valor esperás en una situación conocida y cuál obtenés?";
  return PREGUNTAS_GENERICAS[n % PREGUNTAS_GENERICAS.length];
}
