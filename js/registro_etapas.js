// Cargar únicamente las órdenes de producción con estado "Aprobada"
async function cargarOPAprobadas() {
  const { data, error } = await supabaseClient
    .from("orden_produccion")
    .select("numero_op, estado")
    .eq("estado", "Aprobado")  // <- filtro agregado
    .order("numero_op", { ascending: true });

  const opSelect = document.getElementById("opSelect");
  opSelect.innerHTML = ""; // limpiar opciones previas

  if (error) {
    console.error("Error al cargar las OP:", error.message);
    opSelect.innerHTML = "<option>Error al cargar datos</option>";
    return;
  }

  if (!data || data.length === 0) {
    opSelect.innerHTML = "<option>No hay órdenes aprobadas</option>";
    return;
  }

  // Opción inicial
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Seleccionar...";
  opSelect.appendChild(defaultOption);

  // Agregar cada OP aprobada al selector
  data.forEach(op => {
    const option = document.createElement("option");
    option.value = op.numero_op;
    option.textContent = `${op.numero_op} (${op.estado})`;
    opSelect.appendChild(option);
  });
}

// Llamar la función al cargar la página
document.addEventListener("DOMContentLoaded", cargarOPAprobadas);
///////////////////////////////////////////
// Orden de etapas definida
const ordenEtapas = ['Preparación', 'Cocción', 'Envasado'];

///////////////////////////////////////////
// Iniciar etapa con validación de orden
async function iniciarEtapa(id_registro, nombre_etapa, numero_op) {
  // Obtener todas las etapas de la OP
  const { data: etapasOP, error } = await supabaseClient
    .from('registro_etapas')
    .select('nombre_etapa, estado_etapa')
    .eq('numero_op', numero_op);

  if (error) {
    console.error("Error al obtener etapas:", error.message);
    return;
  }

  // Verificar que todas las etapas anteriores estén terminadas
  const indiceEtapaActual = ordenEtapas.indexOf(nombre_etapa);
  for (let i = 0; i < indiceEtapaActual; i++) {
    const etapaAnterior = ordenEtapas[i];
    const etapaData = etapasOP.find(e => e.nombre_etapa === etapaAnterior);
    if (!etapaData || etapaData.estado_etapa !== 'Terminado') {
      alert(`No se puede iniciar "${nombre_etapa}" antes de completar "${etapaAnterior}"`);
      return; // cancelar inicio
    }
  }

  // Actualizar estado de la etapa
  await supabaseClient
    .from('registro_etapas')
    .update({
      estado_etapa: 'En proceso',
      fecha_inicio: new Date().toISOString()
    })
    .eq('id_registro', id_registro);

  // Recargar tabla
  cargarEtapasDeOP(numero_op);
}

///////////////////////////////////////////
// Terminar etapa (sin cambios)
async function terminarEtapa(id_registro, numero_op) {
  await supabaseClient
    .from('registro_etapas')
    .update({
      estado_etapa: 'Terminado',
      fecha_fin: new Date().toISOString()
    })
    .eq('id_registro', id_registro);

  cargarEtapasDeOP(numero_op);
}

///////////////////////////////////////////
// Función para mostrar las etapas de una OP seleccionada
async function cargarEtapasDeOP(numero_op) {
  if (!numero_op) return;

  let { data, error } = await supabaseClient
    .from("registro_etapas")
    .select("*")
    .eq("numero_op", numero_op)
    .order("id_registro", { ascending: true });

  const tbody = document.querySelector("#registroTable tbody");
  tbody.innerHTML = "";

  if (error) {
    console.error("Error al cargar las etapas:", error.message);
    tbody.insertAdjacentHTML("beforeend", `<tr><td colspan="9">Error al cargar datos</td></tr>`);
    return;
  }

  // Insertar etapas estándar si no existen
  if (!data || data.length === 0) {
    const etapas = ['Preparación', 'Cocción', 'Envasado'];
    for (const nombre_etapa of etapas) {
      await supabaseClient.from('registro_etapas').insert({
        numero_op,
        nombre_etapa,
        estado_etapa: 'Por iniciar',
        fecha_inicio: null,
        fecha_fin: null,
        observaciones: null
      });
    }
    return cargarEtapasDeOP(numero_op);
  }

  // Llenar la tabla con botones que pasan nombre_etapa y numero_op
  data.forEach((etapa, index) => {
    let acciones = '';
    if (etapa.estado_etapa === 'Por iniciar') {
      acciones = `<button onclick="iniciarEtapa(${etapa.id_registro}, '${etapa.nombre_etapa}', '${etapa.numero_op}')">Iniciar</button>`;
    } else if (etapa.estado_etapa === 'En proceso') {
      acciones = `<button onclick="terminarEtapa(${etapa.id_registro}, '${etapa.numero_op}')">Terminar</button>`;
    }

    const row = `
      <tr>
        <td>${index + 1}</td>
        <td>${etapa.numero_op}</td>
        <td>${etapa.nombre_etapa}</td>
        <td>${etapa.estado_etapa || '-'}</td>
        <td>-</td>
        <td>${etapa.fecha_inicio || '-'}</td>
        <td>${etapa.fecha_fin || '-'}</td>
        <td>${etapa.observaciones || '-'}</td>
        <td>${acciones}</td>
      </tr>`;
    tbody.insertAdjacentHTML("beforeend", row);
  });
}

// Detectar cambio de OP seleccionada
document.getElementById('opSelect').addEventListener('change', (e) => {
  const selectedOP = e.target.value;
  cargarEtapasDeOP(selectedOP);
});
