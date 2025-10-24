// ---------------------- Configuración ----------------------
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
const etapas = ["Preparación", "Cocción", "Empaquetado"];
const opEnEjecucion = new Set();

// ---------------- Modal moderno global ----------------
const modal = document.createElement('div');
modal.id = 'modalDetalleOP';
modal.style.cssText = `
    position: fixed; top: 0; left: 0; right:0; bottom:0;
    background: rgba(0,0,0,0.5);
    display: none; justify-content: center; align-items: center;
    z-index: 1000; transition: opacity 0.3s ease;
`;
const modalContent = document.createElement('div');
modalContent.style.cssText = `
    background: #fff; padding: 20px; border-radius: 10px;
    max-width: 400px; width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    position: relative; text-align: left;
`;
const modalClose = document.createElement('span');
modalClose.textContent = '✖';
modalClose.style.cssText = `
    position: absolute; top: 8px; right: 12px;
    cursor: pointer; font-size: 1.2em; color: #333;
`;
modalClose.addEventListener('click', ()=>{ modal.style.display='none'; });
const modalBody = document.createElement('div');
modalContent.appendChild(modalClose);
modalContent.appendChild(modalBody);
modal.appendChild(modalContent);
document.body.appendChild(modal);

// ---------------- Persistencia ----------------
function guardarEstadoLinea(n, opId, tiempoRestante, etapaIndex) {
    localStorage.setItem(`linea_${n}`, JSON.stringify({ opId, tiempoRestante, etapaIndex, timestamp: Date.now() }));
}

function eliminarEstadoLinea(n) {
    const saved = localStorage.getItem(`linea_${n}`);
    if(saved){
        const data = JSON.parse(saved);
        opEnEjecucion.delete(data.opId);
    }
    localStorage.removeItem(`linea_${n}`);
    actualizarSelectsOP();
}

// ---------------- Mostrar OP finalizadas ----------------
function mostrarOPFinalizada(id, texto, linea) {
    const tbody = document.querySelector("#registroTable tbody");
    if(!tbody) return;
    const fila = document.createElement('tr');
    fila.innerHTML = `<td>${id}</td><td>${texto}</td><td>${linea}</td><td>Finalizada</td><td>Operario ${linea}</td><td>${new Date().toLocaleTimeString()}</td><td>-</td><td>-</td><td>-</td>`;
    tbody.appendChild(fila);
    opEnEjecucion.delete(id);
    actualizarSelectsOP();
}

// ---------------- Bloquear OP en ejecución ----------------
function actualizarSelectsOP(){
    document.querySelectorAll('select[id^="opSelectLinea"]').forEach(sel=>{
        [...sel.options].forEach(opt=>{
            if(opt.value && opEnEjecucion.has(opt.value)) opt.disabled=true;
            else opt.disabled=false;
        });
    });
}

// ---------------- Iniciar / Toggle Línea ----------------
async function toggleLinea(n){
    const cinta = document.getElementById(`cinta${n}`);
    const btn = document.getElementById(`btn-linea-${n}`);
    const estadoCont = document.getElementById(`estadoCont-${n}`);
    const estadoText = document.getElementById(`estado-linea-${n}`);
    const opSelect = document.getElementById(`opSelectLinea-${n}`);
    const opInfo = document.getElementById(`opInfo-${n}`);
    const registroTable = document.querySelector("#registroTable tbody");

    if(estados[n]) return alert("Esta línea ya está en funcionamiento.");
    const opId = opSelect.value;
    if(!opId) return alert("Seleccione una OP.");
    if(opEnEjecucion.has(opId)) return alert("Esta OP ya está en ejecución.");
    opEnEjecucion.add(opId);
    actualizarSelectsOP();

    const opTexto = opSelect.selectedOptions[0].textContent;
    const cant = Number(opSelect.selectedOptions[0].dataset.cantidad);

    // Obtener duración y velocidad desde Supabase según línea y producto
    let duracionLinea = 60; // default minutos
    let velocidad = 4;       // default px/frame
    try {
        const { data: opData } = await supabaseClient
            .from('orden_produccion')
            .select('id_producto')
            .eq('id_orden_produccion', opId)
            .single();
        if(opData?.id_producto){
            const { data: lineaData } = await supabaseClient
                .from('linea_produccion')
                .select('duracion, velocidad')
                .eq('id_linea', n)
                .eq('id_producto', opData.id_producto)
                .single();
            if(lineaData){
                if(lineaData.duracion) duracionLinea = Number(lineaData.duracion);
                if(lineaData.velocidad) velocidad = Number(lineaData.velocidad);
            }
        }
    } catch(err){ console.error(err); }

    const tiempoTotal = duracionLinea * cant * 60; // convertir a segundos

    // Actualizar estado en Supabase
    try {
        await supabaseClient.from('orden_produccion').update({ estado: 'en elaboracion' }).eq('id_orden_produccion', opId);
    } catch(err){ console.error(err); }

    iniciarLinea(n, opId, opTexto, tiempoTotal, cinta, btn, estadoCont, estadoText, opInfo, registroTable, velocidad);
}

// ---------------- Función iniciar línea ----------------
function iniciarLinea(n, opId, opTexto, tiempoTotal, cinta, btn, estadoCont, estadoText, opInfo, registroTable, velocidad, tiempoRestante=null, etapaIndex=0){
    estados[n]=true;
    cinta.classList.remove('stop');
    btn.textContent='En marcha...'; btn.disabled=true;
    estadoText.textContent='En marcha';
    estadoCont.classList.remove('estado-detenida'); estadoCont.classList.add('estado-en-marcha');
    if(tiempoRestante===null) tiempoRestante=tiempoTotal;

    let x=0;
    function moverCinta(){ 
        x -= velocidad; 
        cinta.querySelector('.cinta-items').style.transform=`translateX(${x}px)`; 
        animaciones[n]=requestAnimationFrame(moverCinta);
    }
    moverCinta();

    const fila = document.createElement('tr');
    fila.innerHTML = `<td></td><td>${opTexto}</td><td>${etapas[etapaIndex]}</td><td style="background-color:lightyellow">En progreso</td><td>Operario ${n}</td><td>${new Date().toLocaleTimeString()}</td><td></td><td></td><td></td>`;
    registroTable.appendChild(fila);
    const tdEtapa=fila.children[2], tdEstado=fila.children[3], tdFin=fila.children[6];
    const etapaTiempo = tiempoTotal / etapas.length;

    function actualizarContador(){
        tiempoRestante-=1;
        const etapaActual = Math.min(Math.floor((tiempoTotal-tiempoRestante)/etapaTiempo), etapas.length-1);
        if(etapaActual!==etapaIndex){ 
            etapaIndex=etapaActual; 
            tdEtapa.textContent=etapas[etapaIndex]; 
            tdEstado.style.backgroundColor="lightblue"; 
        }
        opInfo.textContent=`Procesando ${opTexto}. Etapa: ${etapas[etapaIndex]}. Tiempo restante: ${Math.ceil(tiempoRestante/60)} min`;
        guardarEstadoLinea(n, opId, tiempoRestante, etapaIndex);

        if(tiempoRestante>0) timers[n]=setTimeout(actualizarContador,1000);
        else finalizarLinea();
    }

    async function finalizarLinea(){
        cancelAnimationFrame(animaciones[n]);
        estados[n]=false;
        cinta.classList.add('stop');
        estadoText.textContent='Finalizada';
        estadoCont.classList.remove('estado-en-marcha'); estadoCont.classList.add('estado-finalizada');
        tdEstado.textContent="Finalizada"; tdEstado.style.backgroundColor="lightgreen";
        tdFin.textContent=new Date().toLocaleTimeString();
        opInfo.textContent=`✅ OP ${opTexto} completada.`;
        eliminarEstadoLinea(n);

        try { await supabaseClient.from('orden_produccion').update({ estado:'finalizada' }).eq('id_orden_produccion',opId); } 
        catch(err){ console.error(err); }

        // Quitar OP completada del select
        const opSelect=document.getElementById(`opSelectLinea-${n}`);
        const optionToRemove=opSelect.querySelector(`option[value="${opId}"]`);
        if(optionToRemove) optionToRemove.remove();

        // Habilitar select para elegir otra OP si queda alguna
        if(opSelect.options.length<=1){ 
            opSelect.innerHTML='<option disabled>No hay OP disponibles</option>'; 
            opSelect.disabled=true;
        } else opSelect.disabled=false;

        mostrarOPFinalizada(opId, opTexto, n);
    }

    actualizarContador();
}

// ---------------- Recuperar estado al recargar ----------------
function recuperarEstadoLinea(n, opSelect, cinta, btn, estadoCont, estadoText, opInfo){
    const saved=localStorage.getItem(`linea_${n}`);
    if(!saved) return;
    const data=JSON.parse(saved);
    const tiempoTranscurrido=Math.floor((Date.now()-data.timestamp)/1000);
    const tiempoRestante=data.tiempoRestante-tiempoTranscurrido;
    if(tiempoRestante<=0){ eliminarEstadoLinea(n); return; }
    const opId=data.opId;
    const option=opSelect.querySelector(`option[value="${opId}"]`);
    if(option) option.selected=true;
    opEnEjecucion.add(opId);
    actualizarSelectsOP();
    iniciarLinea(n, opId, option?option.textContent:'OP', tiempoRestante, document.getElementById(`cinta${n}`), document.getElementById(`btn-linea-${n}`), document.getElementById(`estadoCont-${n}`), document.getElementById(`estado-linea-${n}`), document.getElementById(`opInfo-${n}`), document.querySelector("#registroTable tbody"), 4, tiempoRestante, data.etapaIndex);
}

// ---------------- Cargar líneas y planificación ----------------
document.addEventListener('DOMContentLoaded', async ()=>{
    const contenedor=document.getElementById('lineasContainer');
    if(!contenedor) return;
    const nombres={1:'Línea 1',2:'Línea 2',3:'Línea 3',4:'Línea 4',5:'Línea 5'};
    const hoy = new Date().toISOString().split('T')[0];

    const { data: planificacion, error: planError } = await supabaseClient
        .from('planificacion_semanal')
        .select(`id,id_op,id_linea,dia,orden:orden_produccion(id_orden_produccion, numero_op, cant_lote, id_producto, estado)`)
        .eq('dia', hoy);
    if(planError){ console.error("Error planificacion:", planError); return; }

    const { data: ordenes, error: ordenError } = await supabaseClient
        .from('orden_produccion')
        .select('id_orden_produccion, numero_op, id_producto, cant_lote, estado')
        .eq('estado','Pendiente');
    if(ordenError){ console.error("Error al traer OP pendientes:", ordenError); return; }

    for(let i=1;i<=5;i++){
        const linea=document.createElement('div'); linea.className='linea-produccion'; linea.dataset.linea=i;

        const header=document.createElement('div'); header.className='linea-header';
        const titulo=document.createElement('h4'); titulo.textContent=nombres[i];
        const estadoCont=document.createElement('div'); estadoCont.className='estado-linea estado-detenida'; estadoCont.id=`estadoCont-${i}`;
        const led=document.createElement('span'); led.className='estado-led';
        const estadoText=document.createElement('span'); estadoText.id=`estado-linea-${i}`; estadoText.textContent='Detenida';
        estadoCont.appendChild(led); estadoCont.appendChild(estadoText);
        header.appendChild(titulo); header.appendChild(estadoCont);

        // Planificación del día clickeable
        const planDiv=document.createElement('div'); planDiv.className='planificacion-diaria';
        planDiv.innerHTML='<b>Planificación del día:</b> ';
        const planHoyLinea = planificacion.filter(p => p.id_linea === i && p.orden);
        planHoyLinea.forEach(p=>{
            const op = p.orden;
            const card = document.createElement('span');
            card.style.cssText = `
                display:inline-block;margin:2px;padding:4px 8px;border-radius:4px;
                background:#fffa8b;font-size:0.9em;font-weight:bold;cursor:pointer;transition: background 0.2s;
            `;
            card.textContent=`OP ${op.numero_op} (${op.cant_lote} lotes)`;
            card.addEventListener('mouseover', ()=> card.style.background='#ffe66d');
            card.addEventListener('mouseout', ()=> card.style.background='#fffa8b');
            card.addEventListener('click', async ()=>{
                let duracion = 0;
                try{
                    const { data: lineaData } = await supabaseClient
                        .from('linea_produccion')
                        .select('duracion')
                        .eq('id_linea', i)
                        .eq('id_producto', op.id_producto)
                        .single();
                    if(lineaData?.duracion) duracion = lineaData.duracion;
                } catch(err){ console.error(err); }

                modalBody.innerHTML = `
                    <h3>Detalle de OP ${op.numero_op}</h3>
                    <p><b>Línea:</b> ${i}</p>
                    <p><b>Producto:</b> ${op.id_producto}</p>
                    <p><b>Cantidad de lotes:</b> ${op.cant_lote}</p>
                    <p><b>Duración estimada por lote:</b> ${duracion} minutos</p>
                    <p><b>Tiempo total estimado:</b> ${duracion * op.cant_lote} minutos</p>
                    <p><b>Estado:</b> ${op.estado || 'Pendiente'}</p>
                    <p><b>ID OP:</b> ${op.id_orden_produccion}</p>
                `;
                modal.style.display='flex';
            });
            planDiv.appendChild(card);
        });

        const opSelect=document.createElement('select'); opSelect.id=`opSelectLinea-${i}`;
        const optVacio=document.createElement('option'); optVacio.value=''; optVacio.textContent='Seleccione una OP';
        opSelect.appendChild(optVacio);
        ordenes.forEach(op=>{
            const option=document.createElement('option');
            option.value=op.id_orden_produccion;
            option.textContent=`OP ${op.numero_op} (Cant: ${op.cant_lote})`;
            option.dataset.cantidad=op.cant_lote;
            if(opEnEjecucion.has(op.id_orden_produccion)) option.disabled=true;
            opSelect.appendChild(option);
        });

        const opInfo=document.createElement('div'); opInfo.id=`opInfo-${i}`; opInfo.style.margin='5px 0';
        const cinta=document.createElement('div'); cinta.className='cinta-wrapper stop'; cinta.id=`cinta${i}`;
        const items=document.createElement('div'); items.className='cinta-items'; 
        items.textContent=productos[i]+" "+productos[i];
        cinta.appendChild(items);

        const actions=document.createElement('div'); actions.className='linea-actions';
        const btn=document.createElement('button'); btn.type='button'; btn.id=`btn-linea-${i}`; btn.textContent='Iniciar';
        btn.addEventListener('click',()=>toggleLinea(i));
        actions.appendChild(btn);

        linea.appendChild(header); 
        linea.appendChild(planDiv); 
        linea.appendChild(opSelect); 
        linea.appendChild(opInfo); 
        linea.appendChild(cinta); 
        linea.appendChild(actions);
        contenedor.appendChild(linea);

        recuperarEstadoLinea(i, opSelect, cinta, btn, estadoCont, estadoText, opInfo);
    }
});

window.toggleLinea = toggleLinea;
