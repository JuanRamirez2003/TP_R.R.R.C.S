// ---------------------- Configuración ----------------------
const productos = {
    1: "▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣",
    2: "▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢",
    3: "■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■",
    4: "□ □ □ □ □ □ □ □ □ □ □ □ □ □",
    5: "▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪"
};

const estados = { 1: false, 2: false, 3: false, 4: false, 5: false };
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
modalClose.addEventListener('click', () => { modal.style.display = 'none'; });
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
    if (saved) {
        const data = JSON.parse(saved);
        opEnEjecucion.delete(data.opId);
    }
    localStorage.removeItem(`linea_${n}`);
    actualizarSelectsOP();
}

// ---------------- Mostrar OP finalizadas ----------------
function mostrarOPFinalizada(id, texto, linea) {
    const tbody = document.querySelector("#registroTable tbody");
    if (!tbody) return;
    const fila = document.createElement('tr');
    fila.innerHTML = `<td>${id}</td><td>${texto}</td><td>${linea}</td><td>Finalizada</td><td>Operario ${linea}</td><td>${new Date().toLocaleTimeString()}</td><td>-</td><td>-</td><td>-</td>`;
    tbody.appendChild(fila);
    opEnEjecucion.delete(id);
    actualizarSelectsOP();
}

// ---------------- Bloquear OP en ejecución ----------------
function actualizarSelectsOP() {
    document.querySelectorAll('select[id^="opSelectLinea"]').forEach(sel => {
        [...sel.options].forEach(opt => {
            if (opt.value && opEnEjecucion.has(opt.value)) opt.disabled = true;
            else opt.disabled = false;
        });
    });
}

// --------------------- Toggle línea ---------------------
async function toggleLinea(n) {
    const opSelect = document.getElementById(`opSelectLinea-${n}`);
    const opId = opSelect.value;
    if (!opId) return mostrarError("Seleccione una OP para iniciar la linea.");
    if (opEnEjecucion.has(opId)) return mostrarError("Esta OP ya está en ejecución, seleccione uan diferente.");

    opEnEjecucion.add(opId);
    actualizarSelectsOP();

    const opTexto = opSelect.selectedOptions[0].textContent;
    let cant = Number(opSelect.selectedOptions[0].dataset.cantidad || 1);
    if (isNaN(cant) || cant <= 0) cant = 1;

    let duracionLinea = 60; // default

    try {
        // Obtener id_producto de la OP
        const { data: opData, error: opError } = await supabaseClient
            .from('orden_produccion')
            .select('id_producto')
            .eq('id_orden_produccion', opId)
            .single();
        if (opError) throw opError;

        // Obtener duración real de la línea
        const idLineaReal = Number(document.querySelector(`.linea-produccion[data-linea="${n}"]`).dataset.idLinea);
        const { data: lineaProd } = await supabaseClient
            .from('linea_produccion')
            .select('duracion')
            .eq('id_producto', opData.id_producto)
            .eq('id_linea', idLineaReal)
            .single();
        if (lineaProd?.duracion) duracionLinea = Number(lineaProd.duracion);

        console.log("Duración encontrada:", duracionLinea, "minutos");

    } catch (err) { console.error("Error obteniendo duración:", err); }

    const tiempoTotal = duracionLinea * cant * 60; // segundos según cantidad de lotes

    // Marcar OP como en elaboración
    try {
        await supabaseClient
            .from('orden_produccion')
            .update({ estado: 'en elaboracion' })
            .eq('id_orden_produccion', opId);
    } catch (err) { console.error("Error actualizando estado:", err); }

    const cinta = document.getElementById(`cinta${n}`);
    const btn = document.getElementById(`btn-linea-${n}`);
    const estadoCont = document.getElementById(`estadoCont-${n}`);
    const estadoText = document.getElementById(`estado-linea-${n}`);
    const opInfo = document.getElementById(`opInfo-${n}`);
    const registroTable = document.querySelector("#registroTable tbody");

    iniciarLinea(n, opId, opTexto, tiempoTotal, cinta, btn, estadoCont, estadoText, opInfo, registroTable, 4, null, 0, cant);
}

// --------------------- Iniciar línea ---------------------
function iniciarLinea(n, opId, opTexto, tiempoTotal, cinta, btn, estadoCont, estadoText, opInfo, registroTable, velocidad = 4, tiempoRestante = null, etapaIndex = 0, cant = 1) {
    estados[n] = true;
    cinta.classList.remove('stop');
    btn.textContent = 'En marcha...';
    btn.disabled = true;
    estadoText.textContent = 'En marcha';
    estadoCont.classList.remove('estado-detenida');
    estadoCont.classList.add('estado-en-marcha');

    if (tiempoRestante === null) tiempoRestante = tiempoTotal;

    // Animación de cinta
    let x = 0;
    function moverCinta() {
        x -= velocidad;
        cinta.querySelector('.cinta-items').style.transform = `translateX(${x}px)`;
        animaciones[n] = requestAnimationFrame(moverCinta);
    }
    moverCinta();

    // Botón Finalizar dinámico
    let stopBtn = document.getElementById(`stop-linea-${n}`);
    if (!stopBtn) {
        stopBtn = document.createElement('button');
        stopBtn.id = `stop-linea-${n}`;
        stopBtn.textContent = 'Finalizar';
        stopBtn.style.marginLeft = '5px';
        stopBtn.addEventListener('click', () => finalizarLinea(n, opId, opTexto, cant));
        btn.parentNode.appendChild(stopBtn);
    }

    // Registro en tabla
    const fila = document.createElement('tr');
    fila.innerHTML = `<td></td><td>${opTexto}</td><td>${etapas[etapaIndex]}</td>
                      <td style="background-color:lightyellow">En progreso</td>
                      <td>Operario ${n}</td><td>${new Date().toLocaleTimeString()}</td>
                      <td></td><td></td><td></td>`;
    registroTable.appendChild(fila);
    const tdEtapa = fila.children[2], tdEstado = fila.children[3];
    const etapaTiempo = tiempoTotal / etapas.length;

    // Contador
    function actualizarContador() {
        tiempoRestante -= 1;
        const etapaActual = Math.min(Math.floor((tiempoTotal - tiempoRestante) / etapaTiempo), etapas.length - 1);
        if (etapaActual !== etapaIndex) {
            etapaIndex = etapaActual;
            tdEtapa.textContent = etapas[etapaIndex];
            tdEstado.style.backgroundColor = "lightblue";
        }
        opInfo.textContent = `Procesando ${opTexto}. Etapa: ${etapas[etapaIndex]}. Tiempo restante: ${Math.ceil(tiempoRestante / 60)} min`;
        guardarEstadoLinea(n, opId, tiempoRestante, etapaIndex);

        if (tiempoRestante > 0) timers[n] = setTimeout(actualizarContador, 1000);
        else finalizarLinea(n, opId, opTexto, cant); // Finaliza según cantidad de lotes
    }
    actualizarContador();
}

// --------------------- Finalizar línea ---------------------
async function finalizarLinea(n, opId, opTexto, cant = 1) {
    const cinta = document.getElementById(`cinta${n}`);
    const btn = document.getElementById(`btn-linea-${n}`);
    const estadoCont = document.getElementById(`estadoCont-${n}`);
    const estadoText = document.getElementById(`estado-linea-${n}`);
    const opInfo = document.getElementById(`opInfo-${n}`);
    const registroTable = document.querySelector("#registroTable tbody");

    try {
        cancelAnimationFrame(animaciones[n]);
        clearTimeout(timers[n]);
        estados[n] = false;

        cinta.classList.add('stop');
        estadoText.textContent = 'Finalizada';
        estadoCont.classList.remove('estado-en-marcha');
        estadoCont.classList.add('estado-finalizada');
        opInfo.textContent = `✅ OP ${opTexto} completada.`;

        eliminarEstadoLinea(n);

        // Actualizar OP como finalizada y obtener id_producto
        const { data: opData, error: opError } = await supabaseClient
            .from('orden_produccion')
            .update({ estado: 'finalizada' })
            .select('id_producto')
            .eq('id_orden_produccion', opId)
            .single();
        if (opError) throw opError;

        // Revisar OV asociadas
        const { data: opsOV } = await supabaseClient
            .from('op_ov')
            .select('id_op, id_detalle_ov')
            .eq('id_op', opId);

        if (!opsOV || opsOV.length === 0) {
            // No tiene OV: actualizar stock según cant
            if (opData?.id_producto) {
                const { data: producto } = await supabaseClient
                    .from('productos')
                    .select('stock')
                    .eq('id_producto', opData.id_producto)
                    .single();
                if (producto) {
                    const cantidadASumar = cant * 10; // Multiplicar la cantidad de lotes por 10
                    await supabaseClient
                        .from('productos')
                        .update({ stock: producto.stock + cantidadASumar })
                        .eq('id_producto', opData.id_producto);
                    console.log(`Stock actualizado para producto ${opData.id_producto} +${cant}`);
                }
            }
        } else {
            // Manejo de OV y facturación
            for (const op of opsOV) {
                if (!op.id_detalle_ov) continue;
                const { data: detalle } = await supabaseClient
                    .from('detalle_ordenes')
                    .select('id_orden')
                    .eq('id_detalle', op.id_detalle_ov)
                    .single();
                if (!detalle) continue;

                const idOrden = detalle.id_orden;

                const { data: detalles } = await supabaseClient
                    .from('detalle_ordenes')
                    .select('id_detalle')
                    .eq('id_orden', idOrden);

                const { data: otrasOP } = await supabaseClient
                    .from('op_ov')
                    .select('id_op')
                    .in('id_detalle_ov', detalles.map(d => d.id_detalle));

                let pendientes = 0;
                for (const o of otrasOP) {
                    const { data: opCheck } = await supabaseClient
                        .from('orden_produccion')
                        .select('estado')
                        .eq('id_orden_produccion', o.id_op)
                        .single();
                    if (opCheck.estado !== 'finalizada') pendientes++;
                }

                if (pendientes === 0) {
                    await supabaseClient
                        .from('orden_ventas')
                        .update({ estado: 'completada' })
                        .eq('id_orden', idOrden);

                    const { data: ovData } = await supabaseClient
                        .from('orden_ventas')
                        .select('id_cliente')
                        .eq('id_orden', idOrden)
                        .single();

                    await supabaseClient
                        .from('factura')
                        .insert([{ id_orden: idOrden, id_cliente: ovData.id_cliente, fecha: new Date() }]);
                }
            }
        }

        // Actualizar interfaz y select
        mostrarOPFinalizada(opId, opTexto, n);

        const opSelect = document.getElementById(`opSelectLinea-${n}`);
        const optionToRemove = opSelect.querySelector(`option[value="${opId}"]`);
        if (optionToRemove) optionToRemove.remove();
        if (opSelect.options.length <= 1) {
            opSelect.innerHTML = '<option disabled>No hay OP disponibles</option>';
            opSelect.disabled = true;
        } else opSelect.disabled = false;

        btn.disabled = false;
        btn.textContent = 'Iniciar';
        const stopBtn = document.getElementById(`stop-linea-${n}`);
        if (stopBtn) stopBtn.remove();
        opEnEjecucion.delete(opId);
        actualizarSelectsOP();

    } catch (err) {
        console.error("Error finalizando OP:", err);
    }
}





// ---------------- Recuperar estado al recargar ----------------
function recuperarEstadoLinea(n, opSelect, cinta, btn, estadoCont, estadoText, opInfo) {
    const saved = localStorage.getItem(`linea_${n}`);
    if (!saved) return;
    const data = JSON.parse(saved);
    const tiempoTranscurrido = Math.floor((Date.now() - data.timestamp) / 1000);
    const tiempoRestante = data.tiempoRestante - tiempoTranscurrido;
    if (tiempoRestante <= 0) { eliminarEstadoLinea(n); return; }
    const opId = data.opId;
    const option = opSelect.querySelector(`option[value="${opId}"]`);
    if (option) option.selected = true;
    opEnEjecucion.add(opId);
    actualizarSelectsOP();
    iniciarLinea(n, opId, option ? option.textContent : 'OP', tiempoRestante, document.getElementById(`cinta${n}`), document.getElementById(`btn-linea-${n}`), document.getElementById(`estadoCont-${n}`), document.getElementById(`estado-linea-${n}`), document.getElementById(`opInfo-${n}`), document.querySelector("#registroTable tbody"), 4, tiempoRestante, data.etapaIndex);
}

// ---------------- Cargar líneas y planificación ----------------
document.addEventListener('DOMContentLoaded', async () => {
    const contenedor = document.getElementById('lineasContainer');
    if (!contenedor) return;

    const nombres = { 1: 'Línea 1', 2: 'Línea 2', 3: 'Línea 3', 4: 'Línea 4', 5: 'Línea 5' };
    const hoy = new Date().toISOString().split('T')[0];

    // Traer planificación y OPs pendientes
    const [{ data: planificacion }, { data: ordenes }] = await Promise.all([
        supabaseClient.from('planificacion_semanal')
            .select(`
                id,
                id_op,
                id_linea,
                dia,
                hora_inicio,
                hora_fin,
                cantidad_lotes,
                orden:orden_produccion(
                    id_orden_produccion,
                    numero_op,
                    cant_lote,
                    id_producto,
                    estado,
                    prioridad,
                    ver_orden
                )
            `)
            .eq('dia', hoy)
            .order('hora_inicio', { ascending: true }),
            supabaseClient.from('orden_produccion')
                .select('id_orden_produccion, numero_op, id_producto, cant_lote, estado')
                .eq('estado', 'Pendiente')
    ]);
    console.log("📅 Planificación del día:", planificacion);

    // Traer todas las líneas de producción ordenadas por ID
    const { data: lineasDB } = await supabaseClient
        .from('linea_productos')
        .select('*')
        .order('id_linea', { ascending: true });

    // Verificar que existan líneas
    if (!lineasDB || lineasDB.length === 0) {
        console.error("❌ No se encontraron líneas de producción en la base de datos.");
        return;
    }

    // Crear visualmente cada línea
    for (let i = 1; i <= 5; i++) {
        const linea = document.createElement('div');
        linea.className = 'linea-produccion';
        linea.dataset.linea = i;

        // Buscar la línea real en la DB por nombre (más robusto)
        const nombreLinea = nombres[i];
        const lineaDB = lineasDB.find(l => l.nombre_linea === nombreLinea);
        const idLineaReal = lineaDB?.id_linea || i; // fallback si no se encuentra

        linea.dataset.idLinea = idLineaReal;

        // Header
        const header = document.createElement('div');
        header.className = 'linea-header';

        const titulo = document.createElement('h4');
        titulo.textContent = nombreLinea;

        const estadoCont = document.createElement('div');
        estadoCont.className = 'estado-linea estado-detenida';
        estadoCont.id = `estadoCont-${i}`;

        const led = document.createElement('span');
        led.className = 'estado-led';

        const estadoText = document.createElement('span');
        estadoText.id = `estado-linea-${i}`;
        estadoText.textContent = 'Detenida';

        estadoCont.append(led, estadoText);
        header.append(titulo, estadoCont);

        // Planificación del día
        const planDiv = document.createElement('div');
        planDiv.className = 'planificacion-diaria';
        planDiv.innerHTML = '<b style="color:black;">Planificación del día:</b>';

        const planHoyLinea = planificacion.filter(p => p.id_linea === idLineaReal && p.orden);
        console.log(`📋 Planificación ${nombreLinea} (id_linea=${idLineaReal}):`, planHoyLinea);

    planHoyLinea.forEach(p => {
    const op = p.orden;
    const card = document.createElement('span');

    // 🎨 Asignar color según prioridad
    let bgColor = '#2a2a2a';
    switch (op.prioridad) {
        case 'urgente': bgColor = '#ff0000'; break;
        case 'alta': bgColor = '#ff8000'; break;
        case 'normal': bgColor = '#ebeb08'; break;
        case 'baja': bgColor = '#00cc66'; break;
    }

    card.style.cssText = `
        display:inline-block;
        margin:2px;
        padding:4px 8px;
        border-radius:4px;
        background:${bgColor};
        font-size:0.9em;
        font-weight:bold;
        color:white;
        cursor:pointer;
        transition: background 0.2s;
    `;

    // 🧠 Texto del card según segmentación
    let textoCard = ` ${op.numero_op}`;

    if (p.cantidad_lotes) {
        try {
            const lotesInfo = JSON.parse(p.cantidad_lotes);
            if (lotesInfo?.lotes_incluidos && lotesInfo?.lotes_total) {
                const incluidos = lotesInfo.lotes_incluidos;

                if (incluidos.length === 1) {
                    // Ejemplo: {"lotes_incluidos":[3],"lotes_total":5}
                    textoCard += ` (lote ${incluidos[0]} de ${lotesInfo.lotes_total})`;
                } else {
                    // Ejemplo: {"lotes_incluidos":[2,3,4],"lotes_total":10}
                    const rango = `${Math.min(...incluidos)}-${Math.max(...incluidos)}`;
                    textoCard += ` (lotes ${rango} de ${lotesInfo.lotes_total})`;
                }
            } else {
                textoCard += ` (${op.cant_lote} lotes)`; // fallback
            }
        } catch (e) {
            console.warn("⚠️ Error al interpretar cantidad_lotes:", p.cantidad_lotes);
            textoCard += ` (${op.cant_lote} lotes)`;
        }
    } else {
        textoCard += ` (${op.cant_lote} lotes)`; // sin segmentación
    }

    card.textContent = textoCard;

    // 📋 Clic para ver detalle
    card.addEventListener('click', () => verDetalleOP(op, idLineaReal, i));

    planDiv.appendChild(card);
});

       // 🔹 Select de OPs (mostrar todas las planificaciones desde hoy en adelante)
const opSelect = document.createElement('select');
opSelect.id = `opSelectLinea-${i}`;

const optVacio = document.createElement('option');
optVacio.value = '';
optVacio.textContent = 'Seleccione una OP';
opSelect.appendChild(optVacio);

// 🔹 Buscar todas las planificaciones desde hoy para esta línea
const planificacionesLinea = planificacion.filter(
    p => p.id_linea === idLineaReal && new Date(p.dia) >= new Date(hoy)
);

// 🔹 Generar opciones a partir de las planificaciones
planificacionesLinea.forEach(p => {
    const op = p.orden;
    if (!op) return;

    let texto = `OP ${op.numero_op}`;

    // 🧠 Mostrar detalle de lotes segmentados
    if (p.cantidad_lotes) {
        try {
            const lotesInfo = JSON.parse(p.cantidad_lotes);
            if (lotesInfo?.lotes_incluidos && lotesInfo?.lotes_total) {
                const incluidos = lotesInfo.lotes_incluidos;
                if (incluidos.length === 1) {
                    texto += ` (lote ${incluidos[0]} de ${lotesInfo.lotes_total})`;
                } else {
                    const rango = `${Math.min(...incluidos)}-${Math.max(...incluidos)}`;
                    texto += ` (lotes ${rango} de ${lotesInfo.lotes_total})`;
                }
            } else {
                texto += ` (${op.cant_lote} lotes)`;
            }
        } catch {
            texto += ` (${op.cant_lote} lotes)`;
        }
    } else {
        texto += ` (${op.cant_lote} lotes)`;
    }

    const option = document.createElement('option');
    option.value = op.id_orden_produccion;
    option.textContent = texto;
    option.dataset.cantidad = op.cant_lote;

    if (opEnEjecucion.has(op.id_orden_produccion)) option.disabled = true;
    opSelect.appendChild(option);
});

// 🔹 Si no hay planificaciones futuras, mostrar OPs pendientes genéricas
if (planificacionesLinea.length === 0) {
    ordenes.forEach(op => {
        const option = document.createElement('option');
        option.value = op.id_orden_produccion;
        option.textContent = `OP ${op.numero_op} (Cant: ${op.cant_lote})`;
        option.dataset.cantidad = op.cant_lote;
        if (opEnEjecucion.has(op.id_orden_produccion)) option.disabled = true;
        opSelect.appendChild(option);
    });
}

        // Info OP, cinta y botón
        const opInfo = document.createElement('div');
        opInfo.id = `opInfo-${i}`;
        opInfo.style.margin = '5px 0';

        const cinta = document.createElement('div');
        cinta.className = 'cinta-wrapper stop';
        cinta.id = `cinta${i}`;

        const items = document.createElement('div');
        items.className = 'cinta-items';
        items.textContent = `${productos[i]} ${productos[i]}`;
        cinta.appendChild(items);

        const actions = document.createElement('div');
        actions.className = 'linea-actions';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = `btn-linea-${i}`;
        btn.textContent = 'Iniciar';
        btn.addEventListener('click', () => toggleLinea(i));

        actions.appendChild(btn);

        // Estructura final
        linea.append(header, planDiv, opSelect, opInfo, cinta, actions);
        contenedor.appendChild(linea);

        // Recuperar estado previo
        recuperarEstadoLinea(i, opSelect, cinta, btn, estadoCont, estadoText, opInfo);
    }
});


async function verDetalleOP(op, idLineaReal, i) {
    let duracion = 0;
    try {
        const { data: lineaData } = await supabaseClient
            .from('linea_produccion')
            .select('duracion')
            .eq('id_linea', idLineaReal)
            .eq('id_producto', op.id_producto)
            .single();
        if (lineaData?.duracion) duracion = lineaData.duracion;
    } catch (err) { console.error(err); }
    modalBody.innerHTML = `
                    <h3>Detalle de ${op.numero_op}</h3>
                    <p><b>Línea:</b> ${i}</p>
                    <p><b>Producto:</b> ${op.ver_orden.map(item => `
                                            ${item.nombre}
                                            `).join('')}
                    <p><b>Cantidad de lotes:</b> ${op.cant_lote}</p>
                    <p><b>Duración estimada por lote:</b> ${duracion} minutos</p>
                    <p><b>Tiempo total estimado:</b> ${duracion * op.cant_lote} minutos</p>
                    <p><b>Estado:</b> ${op.estado || 'Pendiente'}</p>
                    <!--<p><b>ID OP:</b> ${op.id_orden_produccion}</p>-->

                    
                    <h3 style="text-align:center;">Lotes / Materiales reservados:</h3>
                    <h4 style="text-align:center; font-weight: normal;">Ver detalle de Lote (clic en una fila para más info)</h4>


                    
                   <div id="detalleMateriales" style="margin-top:10px;">Cargando...</div>
                `;
    modal.style.display = 'flex';
    const contMateriales = document.getElementById("detalleMateriales");

    const { data: detalleLotes, error: errorLotes } = await supabaseClient
        .from('detalle_lote_op')
        .select('*')
        .eq('id_orden_produccion', op.id_orden_produccion);

    if (errorLotes) {
        contMateriales.innerHTML = `<p>Error al cargar materiales: ${errorLotes.message}</p>`;
    } else if (detalleLotes.length > 0) {
        let lotesHtml = '';
        for (const d of detalleLotes) {
            const { data: lote } = await supabaseClient
                .from('lote_mp')
                .select('id_lote, id_mp, fecha_caducidad')
                .eq('id_lote', d.id_lote)
                .single();

            const { data: mat } = await supabaseClient
                .from('materiales')
                .select('nombre')
                .eq('id_mp', lote.id_mp)
                .single();

            lotesHtml += `
        <tr onclick="verDetalleLote('${lote.id_lote}')" style="cursor:pointer;">
          <td>${mat ? mat.nombre : 'Desconocido'}</td>
          <td>${lote.id_lote}</td>
          <td>${d.cantidad_lote}</td>
          <td>${lote.fecha_caducidad ? new Date(lote.fecha_caducidad).toLocaleDateString() : '-'}</td>
        </tr>`;
        }

        contMateriales.innerHTML = `
      <table border="1" style="width:100%; margin-top:10px;">
        <thead><tr><th>Material</th><th>Lote</th><th>Cant. reservada</th><th>Fecha caducidad</th></tr></thead>
        <tbody>${lotesHtml}</tbody>
      </table>`;
    } else {
        contMateriales.innerHTML = '<p>No hay lotes reservados para esta OP.</p>';
    }
    document.addEventListener("click", (e) => {
        const fila = e.target.closest("tr[data-id-lote]");
        if (fila) {
            const idLote = fila.getAttribute("data-id-lote");
            verDetalleLote(idLote);
        }
    });

}
//==============VER DETALLE DE LOTE RESERVADOS ==================
async function verDetalleLote(idLote) {
    //console.log("🧩 Ver detalle del lote:", idLote);
    try {
        // Traemos el  específico
        const { data: lote, error: errorLote } = await supabaseClient
            .from('lote_mp')
            .select('*')
            .eq('id_lote', idLote)
            .single();
        //console.log("📦 Lote obtenido:", lote, "❌ Error:", errorLote);
        if (errorLote || !lote) throw errorLote || 'Lote no encontrado';

        const { data: proveedor, error: errorProv } = await supabaseClient
            .from('proveedor')
            .select('nombre')
            .eq('id_proveedor', lote.id_proveedor)
            .single();
        if (errorProv) throw errorProv;

        const { data: material, error: errorMat } = await supabaseClient
            .from('materiales')
            .select('nombre')
            .eq('id_mp', lote.id_mp)
            .single();
        if (errorMat) throw errorMat;

        const modal = document.getElementById('modalDetalleLote');
        const contenido = document.getElementById('contenidoModalDetalleLote');

        contenido.innerHTML = `
      <p><strong>ID Lote:</strong> ${lote.id_lote}</p>
      <p><strong>Material:</strong> ${material?.nombre.toUpperCase() || lote.id_mp}</p>
      <p><strong>Nombre Proveedor:</strong> ${proveedor?.nombre || '-'}</p>
      
      <p><strong>Cantidad Disponible:</strong> ${lote.cantidad_disponible}</p>
      
      <p><strong>Fecha Ingreso:</strong> ${lote.fecha_ingreso ? new Date(lote.fecha_ingreso).toLocaleDateString() : '-'}</p>
      <p><strong>Fecha Caducidad:</strong> ${lote.fecha_caducidad ? new Date(lote.fecha_caducidad).toLocaleDateString() : '-'}</p>
      <p><strong>Estado:</strong> ${lote.estado}</p>
    `;
        //<p><strong>Lote:</strong> ${lote.lote}</p>
        //<p><strong>Cantidad Consumida:</strong> ${lote.cantidad_consumida}</p>
        modal.style.display = 'flex';

    } catch (err) {
        console.error("Error mostrando detalle del lote:", err);
        mostrarError("No se pudo mostrar el detalle del lote.");
    }
}



function mostrarError(mensaje) {
    const modal = document.getElementById('modalError');
    const mensajeP = document.getElementById('mensajeErrorTexto');
    const btnCerrar = document.getElementById('btnCerrarError');

    if (!modal || !mensajeP || !btnCerrar) {
        console.error("⚠️ No se encontró el modal de error, usando alert()");
        return alert(mensaje);
    }

    mensajeP.textContent = mensaje;
    modal.classList.add('mostrar');

    btnCerrar.onclick = () => modal.classList.remove('mostrar');
    modal.onclick = (e) => {
        if (e.target === modal) modal.classList.remove('mostrar');
    };
}

window.toggleLinea = toggleLinea;