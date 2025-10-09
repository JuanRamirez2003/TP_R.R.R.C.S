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
  const estadoLinea = {
    opId,
    tiempoRestante,
    etapaIndex,
    timestamp: Date.now()
  };
  localStorage.setItem(`linea_${n}`, JSON.stringify(estadoLinea));
}

function eliminarEstadoLinea(n) {
  localStorage.removeItem(`linea_${n}`);
}

// ---------------- Toggle Línea ----------------
function toggleLinea(n) {
  const cinta = document.getElementById(`cinta${n}`);
  const btn = document.getElementById(`btn-linea-${n}`);
  const estadoCont = document.getElementById(`estadoCont-${n}`);
  const estadoText = document.getElementById(`estado-linea-${n}`);
  const opSelect = document.getElementById(`opSelectLinea-${n}`);
  const opInfo = document.getElementById(`opInfo-${n}`);
  const registroTable = document.querySelector("#registroTable tbody");
  if(!cinta || !btn || !estadoCont || !estadoText || !opSelect || !opInfo) return;

  // Si está en marcha, detener
  if(estados[n]) {
    clearTimeout(timers[n]);
    cancelAnimationFrame(animaciones[n]);
    estados[n] = false;
    cinta.classList.add('stop');
    btn.textContent = 'Iniciar';
    estadoText.textContent = 'Detenida';
    estadoCont.classList.remove('estado-en-marcha');
    estadoCont.classList.add('estado-detenida');
    opInfo.textContent = '';
    opSelect.disabled = false;
    eliminarEstadoLinea(n);
    return;
  }

  const opId = opSelect.value;
  if(!opId) return alert(`Seleccione una OP para la línea ${n}`);
  const opTexto = opSelect.selectedOptions[0].textContent;
  const cant = Number(opSelect.selectedOptions[0].dataset.cantidad);
  if(!cant || isNaN(cant)) return alert("Cantidad de productos inválida.");

  estados[n] = true;
  cinta.classList.remove('stop');
  btn.textContent='Detener';
  estadoText.textContent='En marcha';
  estadoCont.classList.remove('estado-detenida');
  estadoCont.classList.add('estado-en-marcha');
  opSelect.disabled = true;

  const tiempoTotal = cant * 2 * 60; // cada caja 2 minutos
  let tiempoRestante = tiempoTotal;

  // Animación cinta
  let x = 0;
  function moverCinta(){
    x -= 2;
    cinta.querySelector('.cinta-items').style.transform = `translateX(${x}px)`;
    animaciones[n] = requestAnimationFrame(moverCinta);
  }
  moverCinta();

  // Crear fila en la tabla de registro
  const fila = document.createElement('tr');
  fila.innerHTML = `
    <td></td>
    <td>${opTexto}</td>
    <td>${etapas[0]}</td>
    <td style="background-color:lightyellow">En progreso</td>
    <td>Operario ${n}</td>
    <td>${new Date().toLocaleTimeString()}</td>
    <td></td>
    <td></td>
    <td></td>
  `;
  registroTable.appendChild(fila);
  const tdEtapa = fila.children[2];
  const tdEstado = fila.children[3];
  const tdFin = fila.children[6];

  // Manejo de etapas
  let etapaIndex = 0;
  let etapaTiempo = tiempoTotal / etapas.length;

  function actualizarContador(){
    tiempoRestante -= 1;
    let etapaTranscurrida = Math.floor((tiempoTotal - tiempoRestante) / etapaTiempo);
    if(etapaTranscurrida !== etapaIndex && etapaTranscurrida < etapas.length){
      etapaIndex = etapaTranscurrida;
      tdEtapa.textContent = etapas[etapaIndex];
      tdEstado.style.backgroundColor = "lightblue";
    }

    opInfo.textContent = `Procesando ${opTexto}. Etapa: ${etapas[etapaIndex]}. Tiempo restante: ${(tiempoRestante/60).toFixed(1)} min`;

    // Guardar estado persistente
    guardarEstadoLinea(n, opId, tiempoRestante, etapaIndex);

    if(tiempoRestante > 0){
      timers[n] = setTimeout(actualizarContador, 1000);
    } else {
      cancelAnimationFrame(animaciones[n]);
      estados[n] = false;
      cinta.classList.add('stop');
      btn.textContent='Iniciar';
      estadoText.textContent='Finalizada';
      opInfo.textContent = `OP ${opTexto} finalizada!`;
      tdEstado.textContent = "Finalizada";
      tdEstado.style.backgroundColor = "lightgreen";
      tdFin.textContent = new Date().toLocaleTimeString();
      opSelect.disabled = false;
      eliminarEstadoLinea(n);
    }
  }
  actualizarContador();
}

// ---------------- Recuperar estado de líneas ----------------
function recuperarEstadoLinea(n, opSelect, cinta, btn, estadoCont, estadoText, opInfo){
  const saved = localStorage.getItem(`linea_${n}`);
  if(!saved) return;
  const data = JSON.parse(saved);
  const tiempoTranscurrido = Math.floor((Date.now() - data.timestamp) / 1000);
  let tiempoRestante = data.tiempoRestante - tiempoTranscurrido;
  if(tiempoRestante <= 0){
    eliminarEstadoLinea(n);
    return;
  }

  estados[n] = true;
  cinta.classList.remove('stop');
  btn.textContent='Detener';
  estadoText.textContent='En marcha';
  estadoCont.classList.remove('estado-detenida');
  estadoCont.classList.add('estado-en-marcha');
  opSelect.disabled = true;
  opSelect.value = data.opId;

  let etapaIndex = data.etapaIndex;
  const registroTable = document.querySelector("#registroTable tbody");

  // Crear fila si no existe
  const fila = document.createElement('tr');
  fila.innerHTML = `
    <td></td>
    <td>${opSelect.selectedOptions[0].textContent}</td>
    <td>${etapas[etapaIndex]}</td>
    <td style="background-color:lightyellow">En progreso</td>
    <td>Operario ${n}</td>
    <td>${new Date().toLocaleTimeString()}</td>
    <td></td>
    <td></td>
    <td></td>
  `;
  registroTable.appendChild(fila);
  const tdEtapa = fila.children[2];
  const tdEstado = fila.children[3];
  const tdFin = fila.children[6];

  // Animación cinta
  let x = 0;
  function moverCinta(){
    x -= 2;
    cinta.querySelector('.cinta-items').style.transform = `translateX(${x}px)`;
    animaciones[n] = requestAnimationFrame(moverCinta);
  }
  moverCinta();

  let etapaTiempo = tiempoRestante / etapas.length;

  function actualizarContadorPersistente(){
    tiempoRestante -= 1;
    let etapaTranscurrida = Math.floor((data.tiempoRestante - tiempoRestante) / (data.tiempoRestante / etapas.length));
    if(etapaTranscurrida !== etapaIndex && etapaTranscurrida < etapas.length){
      etapaIndex = etapaTranscurrida;
      tdEtapa.textContent = etapas[etapaIndex];
      tdEstado.style.backgroundColor = "lightblue";
    }

    opInfo.textContent = `Procesando ${opSelect.selectedOptions[0].textContent}. Etapa: ${etapas[etapaIndex]}. Tiempo restante: ${(tiempoRestante/60).toFixed(1)} min`;

    guardarEstadoLinea(n, data.opId, tiempoRestante, etapaIndex);

    if(tiempoRestante > 0){
      timers[n] = setTimeout(actualizarContadorPersistente, 1000);
    } else {
      cancelAnimationFrame(animaciones[n]);
      estados[n] = false;
      cinta.classList.add('stop');
      btn.textContent='Iniciar';
      estadoText.textContent='Finalizada';
      opInfo.textContent = `OP ${opSelect.selectedOptions[0].textContent} finalizada!`;
      tdEstado.textContent = "Finalizada";
      tdEstado.style.backgroundColor = "lightgreen";
      tdFin.textContent = new Date().toLocaleTimeString();
      opSelect.disabled = false;
      eliminarEstadoLinea(n);
    }
  }
  actualizarContadorPersistente();
}

// ---------------- Carga de líneas ----------------
document.addEventListener('DOMContentLoaded', async () => {
  const contenedor = document.getElementById('lineasContainer');
  if(!contenedor) return;

  const { data: ordenes, error } = await supabaseClient
    .from('orden_produccion')
    .select('id_orden_produccion, numero_op, id_producto, estado, cant_lote')
    .in('estado',['aprobada','pendiente']);

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

    const header = document.createElement('div'); header.className='linea-header';
    const titulo = document.createElement('h4'); titulo.textContent = nombres[i];
    const estadoCont = document.createElement('div'); estadoCont.className='estado-linea estado-detenida'; estadoCont.id=`estadoCont-${i}`;
    const led = document.createElement('span'); led.className='estado-led';
    const estadoText = document.createElement('span'); estadoText.id=`estado-linea-${i}`; estadoText.textContent='Detenida';
    estadoCont.appendChild(led); estadoCont.appendChild(estadoText);
    header.appendChild(titulo); header.appendChild(estadoCont);

    const opSelect = document.createElement('select'); opSelect.id=`opSelectLinea-${i}`;
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

    const opInfo = document.createElement('div'); opInfo.id=`opInfo-${i}`; opInfo.style.margin='5px 0';
    const cinta = document.createElement('div'); cinta.className='cinta-wrapper stop'; cinta.id=`cinta${i}`;
    const items = document.createElement('div'); items.className='cinta-items'; items.textContent=productos[i]+" "+productos[i];
    cinta.appendChild(items);

    const actions = document.createElement('div'); actions.className='linea-actions';
    const btn = document.createElement('button'); btn.type='button'; btn.id=`btn-linea-${i}`; btn.textContent='Iniciar';
    if(opsLinea.length===0) btn.disabled = true;
    btn.addEventListener('click',()=>toggleLinea(i));
    actions.appendChild(btn);

    linea.appendChild(header);
    linea.appendChild(opSelect);
    linea.appendChild(opInfo);
    linea.appendChild(cinta);
    linea.appendChild(actions);
    wrapper.appendChild(linea);

    // ---------------- Recuperar estado si había OP en curso ----------------
    recuperarEstadoLinea(i, opSelect, cinta, btn, estadoCont, estadoText, opInfo);
  }

  contenedor.appendChild(wrapper);
});

window.toggleLinea = toggleLinea;
window.__estadosLineas = estados;
