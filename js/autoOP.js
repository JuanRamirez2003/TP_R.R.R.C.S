/*VERRR Ejecución automática (una vez al día)

En tu servidor o entorno local se puede programar con setInterval() o (mejor aún) con un cron job (por ejemplo, desde Supabase Edge Functions o Node con node-cron):

import cron from 'node-cron';

cron.schedule('0 2 * * *', async () => { // todos los días a las 2 AM
  await generarOPAutomatizadas();
}); */

// ============================
// Configuración Supabase
// ============================
const supabaseUrl = "https://ldgrlfnmuvvaqsezjsvj.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZ3JsZm5tdXZ2YXFzZXpqc3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MzEwNDMsImV4cCI6MjA3NDUwNzA0M30.NrUTqCLkzMWUGqn2XIAsCY8H90vgHpuxhMT2zIVt3Zo";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let ovPendientes = [];
let ovPorProducto = new Map();
const cantCajasLote = 10; //Podira cambiar por producto 
const minLotesProduccion = 5; // mínimo y máximo lotes por OP
const tolerancia = 0.1;    // 10% de tolerancia
let detallesExcedidosPorProducto = new Map();
let cantTotalCajasOP = 0;
let materialesFaltantesPorProducto = new Map();

async function generarOrdenesProduccionAutomatica() {
    try {
        console.log("🔄 Iniciando automatización de OP...");

        ovPendientes = [];

        //Obtener OV pendientes y sus detalles
        ovPendientes = await obtenerOVsDisponibles();
        if (ovPendientes.len = 0) {
            alert("No hay órdenes de venta pendientes para procesar.");
            return;
        }

        console.log("📦 OV disponibles:", ovPendientes);

        //Agrupar por producto
        const agrupadas = agruparOVsPorProducto(ovPendientes);
        console.log("🗂️ Agrupadas por producto:", ovPorProducto);

        await crearOrdenesProduccion();


    } catch (error) {
        console.error("❌ Error en la automatización:", error);
    }
}

async function obtenerOVsDisponibles() {
    try {
        const { data: ordenes, error: errorOrdenes } = await supabaseClient
            .from('orden_ventas')
            .select('id_orden, estado, id_cliente')
            .eq('estado', 'pendiente');

        if (errorOrdenes) throw errorOrdenes;
        if (!ordenes?.length) return [];

        const { data: detalles, error: errorDetalles } = await supabaseClient
            .from('detalle_ordenes')
            .select('id_detalle, id_orden, id_producto, cantidad, estado_detalle_ov')
            .eq('estado_detalle_ov', 'pendiente');

        if (errorDetalles) throw errorDetalles;
        if (!detalles?.length) return [];

        const idsOV = ordenes.map(o => o.id_orden);
        const coincidencias = detalles.filter(d => idsOV.includes(d.id_orden));

        const resultados = await Promise.all(
            coincidencias.map(async (d) => {
                const orden = ordenes.find(o => o.id_orden === d.id_orden);

                const { data: productoData, error: errorProd } = await supabaseClient
                    .from('productos')
                    .select('nombre')
                    .eq('id_producto', d.id_producto)
                    .single();

                if (errorProd) console.warn("⚠️ Error trayendo producto:", errorProd);

                return {
                    id_detalle: d.id_detalle,
                    id_orden: d.id_orden,
                    id_producto: d.id_producto,
                    cantidad: d.cantidad,
                    producto: productoData?.nombre || "Producto desconocido",
                    id_cliente: orden?.id_cliente || null
                };
            })
        );

        console.log("✅ OV y detalles disponibles:", resultados);
        return resultados;

    } catch (error) {
        console.error("❌ Error al obtener OV disponibles:", error);
        return [];
    }
}

function agruparOVsPorProducto(listaOVs) {
    ovPorProducto.clear();
    listaOVs.forEach(ov => {
        const producto = ov.producto;
        if (!ovPorProducto.has(producto)) {
            ovPorProducto.set(producto, []);
        }
        ovPorProducto.get(producto).push(ov);
    });
}

async function crearOrdenesProduccion() {
    console.log("⚙️ Creando OP por producto...");

    const opCreadas = []; // inicializar al inicio de la función


    detallesExcedidosPorProducto = new Map();
    materialesFaltantesPorProducto = new Map();

    for (const [producto, detalles] of ovPorProducto.entries()) {

        detalles.forEach(det => {
            const maxCajasOP = minLotesProduccion * cantCajasLote;
            if (det.cantidad > maxCajasOP) {
                if (!detallesExcedidosPorProducto.has(det.producto)) {
                    detallesExcedidosPorProducto.set(det.producto, []);
                }
                const listaExcedidos = detallesExcedidosPorProducto.get(det.producto);
                if (!listaExcedidos.some(d => d.id_detalle === det.id_detalle)) {
                    listaExcedidos.push(det);
                }
            }
        });


        let detallesPendientes = detalles.filter(d => d.cantidad <= (minLotesProduccion * cantCajasLote));

        while (detallesPendientes.length > 0) {
            let cajasOP = 0;
            const detallesOP = [];

            for (let i = 0; i < detallesPendientes.length; i++) {
                const det = detallesPendientes[i];
                const maxCajasOP = minLotesProduccion * cantCajasLote;
                const nuevasCajas = cajasOP + det.cantidad;

                if (nuevasCajas <= maxCajasOP) {
                    detallesOP.push(det);
                    cajasOP += det.cantidad;
                }
            }

            const minCajasOP = minLotesProduccion * cantCajasLote;
            if (cajasOP < minCajasOP * (1 - tolerancia)) {
                console.warn(
                    `⚠️ No se crea OP para "${producto}" — sólo ${cajasOP} cajas, mínimo con tolerancia ${minCajasOP * (1 - tolerancia)}.`
                );
                break;
            }
            const cantidadLotesOP = Math.ceil(cajasOP / cantCajasLote);
            const materialesNecesarios = await detalleMateriales(detallesOP[0].id_producto, cantidadLotesOP);
            console.log(`Materiales necesarios para OP de "${producto}" (${cantidadLotesOP} lotes):`, materialesNecesarios);

            const { ok, detalle, faltantes } = await verificarStockSuficiente(materialesNecesarios);

            if (!ok) {
                console.warn(`🚫 No hay suficiente stock para crear OP de "${producto}". Faltan materiales:`, faltantes);

                if (!materialesFaltantesPorProducto.has(producto)) {
                    materialesFaltantesPorProducto.set(producto, []);
                }
                const lista = materialesFaltantesPorProducto.get(producto);

                faltantes.forEach(mat => {
                    if (!lista.some(m => m.id_mp === mat.id_mp)) {
                        lista.push(mat);
                    }
                });

                console.log(`⚠️ No hay suficiente stock para crear la OP de "${producto}". Revisa los materiales.`);
                break;
            }

            const numeroOP = await generarNumeroOP();
            const fecha = new Date().toISOString();
            const idReceta = materialesNecesarios[0].id_receta;

            // Generar objeto para guardar en ver_orden
            const verOrdenOP = [{
                nombre: detallesOP[0].producto,
                cantidad: minLotesProduccion
            }];
            const { data: opData, error: opError } = await supabaseClient
                .from('orden_produccion')
                .insert([{
                    numero_op: numeroOP,
                    ver_orden: verOrdenOP,
                    id_producto: detallesOP[0].id_producto,
                    cant_lote: cantidadLotesOP,
                    id_receta: idReceta,
                    detalle_materiales: materialesNecesarios,
                    fecha_emision: fecha,
                    estado: 'Pendiente'
                }])
                .select();

            if (opError || !opData || opData.length === 0) {
                console.error("Error al crear la OP:", opError);
                break;
            }

            const idOrden = opData?.[0]?.id_orden_produccion;
            if (!idOrden) {
                console.error("No se pudo crear la OP en la base de datos");
                break;
            }



            // Guardar relación OV OP
            const okOV = await guardarOVsEnOPAutomatica(idOrden, detallesOP);
            if (!okOV) {
                console.warn(`⚠️ No se pudo guardar la relación OV ↔ OP para "${producto}".`);
            }

            // Reservar lotes por FEFO
            for (const mat of materialesNecesarios) {
                const reservado = await reservarLotes(idOrden, mat.id_mp, mat.cantidad_total);
                if (!reservado) {
                    console.warn(`🚫 No se pudo reservar el material ${mat.nombre_material} para OP de "${producto}".`);
                    break;
                }
            }
            opCreadas.push({
                numero_op: numeroOP,
                producto: detallesOP[0].producto,
                cant_lote: cantidadLotesOP
            });


            console.log(`✅ Creando OP para "${producto}" con ${cajasOP} cajas:`, detallesOP.map(d => d.id_detalle));

            //Remover los detalles que ya se asignaron a esta OP
            detallesOP.forEach(d => {
                const index = detallesPendientes.indexOf(d);
                if (index > -1) detallesPendientes.splice(index, 1);
            });


        }
    }

    console.log("🎯 Todas las OP creadas correctamente.");
    console.log("📌 Detalles que necesitan OP especial/manual:", detallesExcedidosPorProducto);
    console.log("📦 Materiales faltantes para OP (para generar OC):", materialesFaltantesPorProducto);

    mostrarOPenPantalla(opCreadas, detallesExcedidosPorProducto);

}

async function detalleMateriales(idProducto, cantLote) {

    const { data, error } = await supabaseClient
        .from('producto_materia')
        .select('*')
        .eq('id_producto', idProducto);

    if (error) {
        console.error("Error al obtener detalle de materia:", error);
        return [];
    }

    if (!data || data.length === 0) return [];

    const idsMP = data.map(item => item.id_mp);
    const { data: materiales, error: errorMat } = await supabaseClient
        .from('materiales')
        .select('id_mp, nombre')
        .in('id_mp', idsMP);

    if (errorMat) {
        console.error("Error al obtener nombres de materiales:", errorMat);
        return [];
    }
    cantTotalCajasOP = cantCajasLote * minLotesProduccion;
    console.log("cantidad total de cajas por LOTE:", cantTotalCajasOP);
    const detalleMultiplicado = data.map(item => {
        const mat = materiales.find(m => m.id_mp === item.id_mp);
        return {
            id_mp: item.id_mp,
            nombre_material: mat ? mat.nombre : 'Desconocido',
            id_producto: item.id_producto,
            cantidad_base: item.cantidad,
            unidad: item.unidad,
            cantidad_total: item.cantidad * cantLote
        };
    });
    return detalleMultiplicado;
}

async function verificarStockSuficiente(detalleReceta) {
    const materialesInsuficientes = [];

    for (const item of detalleReceta) {
        const { data, error } = await supabaseClient
            .from('materiales')
            .select('stock_disponible')
            .eq('id_mp', item.id_mp)
            .single();

        if (error || !data) {
            console.error("Error consultando material:", error);
            item.condicion = "❌ Error o material no encontrado";
            materialesInsuficientes.push(item);
            continue;
        }

        if (data.stock_disponible < item.cantidad_total) {
            item.condicion = `⚠️ Insuficiente (${data.stock_disponible} disp. / necesita ${item.cantidad_total})`;
            materialesInsuficientes.push(item);
        } else {
            item.condicion = "✅ Disponible";
        }
    }

    const todoOk = materialesInsuficientes.length === 0;
    return { ok: todoOk, detalle: detalleReceta, faltantes: materialesInsuficientes };
}


// Función para reservar lotes de un material según FEFO
async function reservarLotes(idOrden, idMP, cantidadTotal) {
    try {
        let cantidadRestante = cantidadTotal;

        // Buscar lotes disponibles ordenados por fecha de vencimiento (FEFO)
        const { data: lotes, error } = await supabaseClient
            .from('lote_mp')
            .select('*')
            .eq('id_mp', idMP)
            .gt('cantidad_disponible', 0)
            .order('fecha_caducidad', { ascending: true });

        if (error) {
            console.error("Error al obtener lotes:", error);
            throw new Error(`No se pudieron obtener los lotes del material ${idMP}`);
        }

        if (!lotes || lotes.length === 0) {
            throw new Error(`No hay lotes disponibles para el material ${idMP}`);
        }

        for (const lote of lotes) {
            if (cantidadRestante <= 0) break;

            const cantidadDisponibleActual = Number(lote.cantidad_disponible) || 0;
            const cantidadReservadaActual = Number(lote.cantidad_reservada) || 0;
            const cantidadAR = Math.min(cantidadDisponibleActual, cantidadRestante);

            if (cantidadAR <= 0) continue;

            console.log("Reservando lote:", {
                id_lote: lote.id_lote,
                cantidadDisponibleActual,
                cantidadReservadaActual,
                cantidadAR
            });

            // Actualizar lote_mp (reservar cantidad)
            const { error: errorUpdate } = await supabaseClient
                .from('lote_mp')
                .update({
                    cantidad_disponible: cantidadDisponibleActual - cantidadAR,
                    cantidad_reservada: cantidadReservadaActual + cantidadAR
                })
                .eq('id_lote', lote.id_lote);

            if (errorUpdate) {
                console.error("Error al actualizar lote:", errorUpdate);
                throw new Error(`No se pudo actualizar el lote ${lote.id_lote}`);
            }

            // Registrar en detalle_lote_op
            const { error: errorInsert } = await supabaseClient
                .from('detalle_lote_op')
                .insert({
                    id_orden_produccion: idOrden,
                    id_lote: lote.id_lote,
                    cantidad_lote: cantidadAR
                });

            if (errorInsert) {
                console.error("Error al insertar detalle_lote_op:", errorInsert);
                throw new Error(`No se pudo insertar detalle_lote_op para lote ${lote.id_lote}`);
            }

            cantidadRestante -= cantidadAR;
        }

        //Verificar si se logró cubrir toda la cantidad
        if (cantidadRestante > 0) {
            throw new Error(`No hay suficiente stock para el material ${idMP}`);
        }

        return true;

    } catch (err) {
        console.error("Error en reservarLotes:", err.message);
        return false;
    }
}



async function guardarOVsEnOPAutomatica(idOP, detallesOV) {
    try {
        if (!detallesOV || detallesOV.length === 0) return true;

        for (const det of detallesOV) {
            const { id_detalle, cantidad } = det;

            if (!id_detalle) continue;

            console.log("Insertando relación OP-OV con:", { idOP, id_detalle, cantidad });

            const { data, error } = await supabaseClient
                .from('op_ov')
                .insert([{ id_op: idOP, id_detalle_ov: id_detalle }]);

            if (error) {
                console.error("Error guardando relación OP-OV:", error);
                return false;
            }

            console.log("Guardado relación OP-OV:", data);

            await actualizarEstadoDetalleOV(id_detalle, 'reserva en produccion');
        }

        return true;
    } catch (err) {
        console.error("Error general en guardarOVsEnOPAutomatica:", err);
        return false;
    }
}


async function actualizarEstadoDetalleOV(idDetalleOV, nuevoEstado) {
    try {
        const { data, error } = await supabaseClient
            .from('detalle_ordenes')
            .update({ estado_detalle_ov: nuevoEstado })
            .eq('id_detalle', idDetalleOV);

        if (error) {
            console.error(`Error actualizando estado del detalle OV ${idDetalleOV}:`, error);
            return false;
        }

        console.log(`Estado del detalle OV ${idDetalleOV} actualizado a '${nuevoEstado}'`);
        return true;

    } catch (err) {
        console.error("Error general al actualizar estado de detalle OV:", err);
        return false;
    }
}

//Generar numero de orden automatico
async function generarNumeroOP() {
    // usar id_orden_produccion para asegurar que traes la última fila creada
    const { data, error } = await supabaseClient
        .from('orden_produccion')
        .select('id_orden_produccion, numero_op')
        .order('id_orden_produccion', { ascending: false })
        .limit(1);

    if (error) {
        console.error("Error al generar número de OP:", error);
        return "OP-2025-000"; // defecto: empieza en 000
    }

    if (!data || data.length === 0) {
        return "OP-2025-000"; // si no hay OP -> primera será 000
    }

    const ultimo = data[0].numero_op || "";
    // extraer el número final con regex (más seguro que split)
    const m = ultimo.match(/-(\d+)$/);
    const lastNum = m ? parseInt(m[1], 10) : 0;
    const nuevoNum = lastNum + 1;
    const nuevo = `OP-2025-${String(nuevoNum).padStart(3, '0')}`;
    return nuevo;
}


function mostrarOPenPantalla(opCreadas, opExcedidas) {
    // Obtener elementos del modal
    const modal = document.getElementById('modalOP');
    const listCreadas = document.getElementById('op-creadas-list');
    const listExcedidas = document.getElementById('op-excedidas-list');

    if (!modal || !listCreadas || !listExcedidas) {
        console.error("No se encontró el modal o las listas en el DOM");
        return;
    }

    // Limpiar listas
    listCreadas.innerHTML = '';
    listExcedidas.innerHTML = '';
    //let hayOP = false
    // -----------------------------
    // OP Creadas
    // -----------------------------
    opCreadas.forEach(op => {
        const li = document.createElement('li');
        li.textContent = `${op.numero_op} - Producto: ${op.producto} - Cantidad: ${op.cant_lote * 10} cajas`;
        li.style.color = 'green';
        listCreadas.appendChild(li);
        
    });
    //hayOP = true; 
    // -----------------------------
    // OP Excedidas
    // -----------------------------
    if (opExcedidas instanceof Map) {
        // Si es Map
        opExcedidas.forEach((detalles, producto) => {
            detalles.forEach(d => {
                const li = document.createElement('li');
                li.textContent = `Producto: ${producto} - OV: ${d.id_orden} - Cantidad: ${d.cantidad} (excedido)`;
                li.style.color = 'red';
                listExcedidas.appendChild(li);
                //hayOP = true;
            });
        });
    } else if (Array.isArray(opExcedidas)) {
        // Si es Array de pares [producto, detalles]
        opExcedidas.forEach(([producto, detalles]) => {
            detalles.forEach(d => {
                const li = document.createElement('li');
                li.textContent = `Producto: ${producto} - OV: ${d.id_orden} - Cantidad: ${d.cantidad} (excedido)`;
                li.style.color = 'red';
                listExcedidas.appendChild(li);
               // hayOP = true;   
            });
        });
    } else {
        console.warn("opExcedidas tiene un formato inesperado", opExcedidas);
    }

    // -----------------------------
    // Mostrar modal
    // -----------------------------
    modal.style.display = 'flex';

    // Cerrar modal al hacer click en la X
    const span = modal.querySelector('.close');
    if (span) span.onclick = () => modal.style.display = 'none';

    // Cerrar modal al hacer click fuera del contenido
    window.onclick = (event) => {
        if (event.target === modal) modal.style.display = 'none';
    };



}

document.addEventListener("DOMContentLoaded", () => {
  window.generarOrdenesProduccionAutomatica = generarOrdenesProduccionAutomatica;
});