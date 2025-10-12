const productos = {
  1: "▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣",
  2: "▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢",
  3: "■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■",
  4: "□ □ □ □ □ □ □ □ □ □ □ □ □ □",
  5: "▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪"
};

const estados = {1:false,2:false,3:false,4:false,5:false};
const timers = {};
const animaciones = {};
const lineaProductoMap = {1:1,2:2,3:3,4:4,5:5};
const etapas = ["Preparación", "Cocción", "Empaquetado"];

// ---------------- Persistencia ----------------
function guardarEstadoLinea(n, opId, tiempoRestante, etapaIndex) {
  const estadoLinea = { opId, tiempoRestante, etapaIndex, timestamp: Date.now() };
  localStorage.setItem(`linea_${n}`, JSON.stringify(estadoLinea));
}

function eliminarEstadoLinea(n) {
  localStorage.removeItem(`linea_${n}`);
}

// ---------------- Tabla OP finalizadas ----------------
function mostrarOPFinalizada(id, texto, linea) {
  const contenedor = document.getElementById('opFinalizadas');
  if (!contenedor) return;
  const tbody = contenedor.querySelector('tbody');
  const fila = document.createElement('tr');
  fila.innerHTML = `
    <td>${id}</td>
    <td>${texto}</td>
    <td>${linea}</td>
    <td>${new Date().toLocaleTimeString()}</td>
  `;
  tbody.appendChild(fila);
}

// ---------------- Toggle Línea ----------------
async function toggleLinea(n) {
  const cinta = document.getElementById(`cinta${n}`);
  const btn = document.getElementById(`btn-linea-${n}`);
  const estadoCont = document.getElementById(`estadoCont-${n}`);
  const estadoText = document.getElementById(`estado-linea-${n}`);
  const opSelect = document.getElementById(`opSelectLinea-${n}`);
  const opInfo = document.getElementById(`opInfo-${n}`);
  const registroTable = document.querySelector("#registroTable tbody");
  if (!cinta || !btn || !estadoCont || !estadoText || !opSelect || !opInfo) return;

  if (estados[n]) return alert("Esta línea ya está en funcionamiento.");

  const opId = opSelect.value;
  if (!opId) return alert(`Seleccione una OP para la línea ${n}`);
  const opTexto = opSelect.selectedOptions[0].textContent;
  const cant = Number(opSelect.selectedOptions[0].dataset.cantidad);
  if (!cant || isNaN(cant)) return alert("Cantidad de productos inválida.");

  // Cambiar estado en Supabase a "en elaboracion"
  try {
    await supabaseClient
      .from('orden_produccion')
      .update({ estado: 'en elaboracion' })
      .eq('id_orden_produccion', opId);
    console.log(`🟡 OP ${opId} marcada como en elaboración.`);
  } catch (err) {
    console.error("Error al cambiar estado de OP:", err);
  }

  iniciarLinea(n, opId, opTexto, cant, cinta, btn, estadoCont, estadoText, opInfo, registroTable);
}

// ---------------- Función común para iniciar línea ----------------
function iniciarLinea(n, opId, opTexto, cant, cinta, btn, estadoCont, estadoText, opInfo, registroTable, tiempoRestante=null, etapaIndex=0){
  estados[n] = true;
  cinta.classList.remove('stop');
  btn.textContent = 'En marcha...';
  btn.disabled = true;
  estadoText.textContent = 'En marcha';
  estadoCont.classList.remove('estado-detenida');
  estadoCont.classList.add('estado-en-marcha');

  const tiempoTotal = cant * 60;
  if(tiempoRestante===null) tiempoRestante = tiempoTotal;

  // Animación cinta
  let x = 0;
  function moverCinta() {
    x -= 4;
    cinta.querySelector('.cinta-items').style.transform = `translateX(${x}px)`;
    animaciones[n] = requestAnimationFrame(moverCinta);
  }
  moverCinta();

  // Registro visual
  const fila = document.createElement('tr');
  fila.innerHTML = `
    <td></td>
    <td>${opTexto}</td>
    <td>${etapas[etapaIndex]}</td>
    <td style="background-color:lightyellow">En progreso</td>
    <td>Operario ${n}</td>
    <td>${new Date().toLocaleTimeString()}</td>
    <td></td>
  `;
  registroTable.appendChild(fila);
  const tdEtapa = fila.children[2];
  const tdEstado = fila.children[3];
  const tdFin = fila.children[6];

  let etapaTiempo = tiempoTotal / etapas.length;

  function actualizarContador() {
    tiempoRestante -= 1;
    const etapaTranscurrida = Math.floor((tiempoTotal - tiempoRestante) / etapaTiempo);
    if (etapaTranscurrida !== etapaIndex && etapaTranscurrida < etapas.length) {
      etapaIndex = etapaTranscurrida;
      tdEtapa.textContent = etapas[etapaIndex];
      tdEstado.style.backgroundColor = "lightblue";
    }

    opInfo.textContent = `Procesando ${opTexto}. Etapa: ${etapas[etapaIndex]}. Tiempo restante: ${tiempoRestante}s`;
    guardarEstadoLinea(n, opId, tiempoRestante, etapaIndex);

    if (tiempoRestante > 0) {
      timers[n] = setTimeout(actualizarContador, 1000);
    } else {
      finalizarLinea();
    }
  }

  async function finalizarLinea() {
    cancelAnimationFrame(animaciones[n]);
    estados[n] = false;
    cinta.classList.add('stop');

    estadoText.textContent = 'Finalizada';
    estadoCont.classList.remove('estado-en-marcha');
    estadoCont.classList.add('estado-finalizada');
    tdEstado.textContent = "Finalizada";
    tdEstado.style.backgroundColor = "lightgreen";
    tdFin.textContent = new Date().toLocaleTimeString();
    opInfo.textContent = `✅ OP ${opTexto} completada.`;
    eliminarEstadoLinea(n);

    try {
      await supabaseClient
        .from('orden_produccion')
        .update({ estado: 'finalizada' })
        .eq('id_orden_produccion', opId);
    } catch (err) {
      console.error("Error al actualizar OP:", err);
    }

    const opSelect = document.getElementById(`opSelectLinea-${n}`);
    const optionToRemove = opSelect.querySelector(`option[value="${opId}"]`);
    if (optionToRemove) optionToRemove.remove();

    if (opSelect.options.length <= 1) {
      opSelect.innerHTML = '<option disabled>No hay OP disponibles</option>';
      opSelect.disabled = true;
    } else {
      opSelect.disabled = false;
      opSelect.value = '';
    }

    const btn = document.getElementById(`btn-linea-${n}`);
    btn.textContent = 'Iniciar';
    btn.disabled = false;

    mostrarOPFinalizada(opId, opTexto, n);
  }

  actualizarContador();
}

// ---------------- Recuperar estado ----------------
function recuperarEstadoLinea(n, opSelect, cinta, btn, estadoCont, estadoText, opInfo){
  const saved = localStorage.getItem(`linea_${n}`);
  if(!saved) return;

  const data = JSON.parse(saved);
  const tiempoTranscurrido = Math.floor((Date.now() - data.timestamp) / 1000);
  const tiempoRestante = data.tiempoRestante - tiempoTranscurrido;

  if(tiempoRestante <= 0){
    eliminarEstadoLinea(n);
    return;
  }

  const opId = data.opId;
  const option = opSelect.querySelector(`option[value="${opId}"]`);
  if(option) option.selected = true;

  iniciarLinea(n, opId, option ? option.textContent : 'OP', Number(option.dataset.cantidad || 1), cinta, btn, estadoCont, estadoText, opInfo, document.querySelector("#registroTable tbody"), tiempoRestante, data.etapaIndex);
}

// ---------------- Cargar líneas ----------------
document.addEventListener('DOMContentLoaded', async () => {
  const contenedor = document.getElementById('lineasContainer');
  if(!contenedor) return;

  const { data: ordenes, error } = await supabaseClient
    .from('orden_produccion')
    .select('id_orden_produccion, numero_op, id_producto, estado, cant_lote')
    .in('estado',['Pendiente','en elaboracion']); // Pendiente o en elaboración

  if(error){
    console.error("Error al cargar OP:", error);
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.id = 'lineasProduccion';

  const nombres = {
    1: 'Línea 1 – Choclo',
    2: 'Línea 2 – Arvejas',
    3: 'Línea 3 – Milanesa de carne',
    4: 'Línea 4 – Medallón de pollo',
    5: 'Línea 5 – Patita de pollo'
  };

  for(let i=1;i<=5;i++){
    const linea = document.createElement('div');
    linea.className='linea-produccion';
    linea.dataset.linea = i;

    const header = document.createElement('div'); 
    header.className='linea-header';
    const titulo = document.createElement('h4'); 
    titulo.textContent = nombres[i];
    const estadoCont = document.createElement('div'); 
    estadoCont.className='estado-linea estado-detenida'; 
    estadoCont.id=`estadoCont-${i}`;
    const led = document.createElement('span'); 
    led.className='estado-led';
    const estadoText = document.createElement('span'); 
    estadoText.id=`estado-linea-${i}`; 
    estadoText.textContent='Detenida';
    estadoCont.appendChild(led); 
    estadoCont.appendChild(estadoText);
    header.appendChild(titulo); 
    header.appendChild(estadoCont);

    const opSelect = document.createElement('select'); 
    opSelect.id=`opSelectLinea-${i}`;
    const opsLinea = ordenes.filter(op=>Number(op.id_producto)===lineaProductoMap[i]);
    if(opsLinea.length===0){
      const opt = document.createElement('option'); opt.textContent='No hay OP disponibles'; opt.disabled=true;
      opSelect.appendChild(opt);
    } else {
      const opt = document.createElement('option'); opt.value=''; opt.textContent='Seleccione una OP';
      opSelect.appendChild(opt);
      opsLinea.forEach(op=>{
        const option = document.createElement('option');
        option.value = op.id_orden_produccion;
        option.textContent = `OP ${op.numero_op} (ID: ${op.id_orden_produccion}, Cant: ${op.cant_lote}, Estado: ${op.estado})`;
        option.dataset.cantidad = op.cant_lote;
        opSelect.appendChild(option);
      });
    }

    const opInfo = document.createElement('div'); 
    opInfo.id=`opInfo-${i}`; 
    opInfo.style.margin='5px 0';
    const cinta = document.createElement('div'); 
    cinta.className='cinta-wrapper stop'; 
    cinta.id=`cinta${i}`;
    const items = document.createElement('div'); 
    items.className='cinta-items'; 
    items.textContent=productos[i]+" "+productos[i];
    cinta.appendChild(items);

    const actions = document.createElement('div'); 
    actions.className='linea-actions';
    const btn = document.createElement('button'); 
    btn.type='button'; 
    btn.id=`btn-linea-${i}`; 
    btn.textContent='Iniciar';
    if(opsLinea.length===0) btn.disabled = true;
    btn.addEventListener('click',()=>toggleLinea(i));
    actions.appendChild(btn);

    linea.appendChild(header);
    linea.appendChild(opSelect);
    linea.appendChild(opInfo);
    linea.appendChild(cinta);
    linea.appendChild(actions);
    wrapper.appendChild(linea);

    recuperarEstadoLinea(i, opSelect, cinta, btn, estadoCont, estadoText, opInfo);
  }

  contenedor.appendChild(wrapper);
});

window.toggleLinea = toggleLinea;
