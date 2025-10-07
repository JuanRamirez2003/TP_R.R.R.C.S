
    src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js"

const supabaseUrl = "https://ldgrlfnmuvvaqsezjsvj.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZ3JsZm5tdXZ2YXFzZXpqc3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MzEwNDMsImV4cCI6MjA3NDUwNzA0M30.NrUTqCLkzMWUGqn2XIAsCY8H90vgHpuxhMT2zIVt3Zo";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

function mostrarSeccion(id){
  document.querySelectorAll('.seccion').forEach(s=>s.style.display='none'); 
  document.getElementById(id).style.display='block'; 
  if(id==="ordenProduccion") prepararNuevaOP();
  if(id==="seguimientoOP") cargarOP();
}

// Inicializamos el array vacío
let productosDisponibles = [];

async function cargarProductosDisponibles() {
  const { data, error } = await supabaseClient.from('productos').select('nombre');

  if (error) {
    console.error("Error al cargar productos:", error);
    return;
  }

  productosDisponibles = data.map(p => p.nombre);
 // console.log("Productos disponibles:", productosDisponibles);
}

// Llamada de ejemplo:
(async () => {
  await cargarProductosDisponibles();
  agregarProducto(); // Ahora tendrá los productos cargados
})();

let ordenesProduccion = JSON.parse(localStorage.getItem("ordenesProduccion")) || [];
function guardarOPs() { localStorage.setItem("ordenesProduccion", JSON.stringify(ordenesProduccion)); }

async function generarNumeroOP() {
  const año = 2025;

  // Traemos todos los numero_op existentes de este año
  const { data, error } = await supabaseClient
      .from('orden_produccion')
      .select('numero_op');

  if(error){
      console.error("Error al obtener OP existentes:", error);
      return `OP-${año}-000`;
  }

  // Extraemos los números y obtenemos el mayor
  let maxNum = 0;
  data.forEach(op => {
      const partes = op.numero_op.split('-');
      if(partes[1] == año.toString()){
          const num = parseInt(partes[2], 10);
          if(num > maxNum) maxNum = num;
      }
  });

  const siguiente = maxNum + 1;
  return `OP-${año}-${String(siguiente).padStart(3,'0')}`;
}

prepararNuevaOP();

function prepararNuevaOP() {
  document.getElementById('productosContainer').innerHTML = '';
  agregarProducto();

  generarNumeroOP().then(numeroOP => {
    document.getElementById('opNumero').value = numeroOP;
  });
}

function agregarProducto(){
  const container = document.getElementById('productosContainer');
  const div = document.createElement('div'); 
  div.className='producto-item';
  let opciones = productosDisponibles.map(p => `<option value="${p}">${p}</option>`).join('');
  div.innerHTML=`
    <select name="productoNombre[]" required>
      <option value="" disabled selected>Seleccione un producto</option>
      ${opciones}
    </select>
    <lebel>Cant. Lote:</label>
    <input type="number" name="productoCantidad[]" min="1" value="1" required>
    
  `;

   div.querySelector('select').addEventListener('change', actualizarDetalleMateriales);
  div.querySelector('input').addEventListener('input', actualizarDetalleMateriales);
  container.appendChild(div);
}
//<button type="button" onclick="eliminarProducto(this)" class="btn-eliminar">❌</button>
function eliminarProducto(btn){ 
  btn.parentElement.remove(); 
  if(document.querySelectorAll('.producto-item').length===0) agregarProducto(); 
}

function cancelarOP(){ 
  document.getElementById('opForm').reset(); 
  document.getElementById('productosContainer').innerHTML=''; 
  agregarProducto(); 
  document.getElementById('ordenProduccion').style.display='none'; 
}

// Crear OP y guardar en Supabase
document.getElementById('opForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const productos = Array.from(document.querySelectorAll('.producto-item')).map(p=>({
    nombre: p.querySelector('select').value,
    cantidad: parseInt(p.querySelector('input').value,10)
  }));
  if(productos.some(p=>!p.nombre || p.cantidad<=0)){
    alert("Complete todos los productos con cantidad válida");
    return;
  }
    console.log(productos[0].nombre);
  const numeroOP = document.getElementById('opNumero').value;
  const fecha = new Date().toISOString();

    const idProducto = await obtnerIdProducto(productos[0].nombre);
  if(!idProducto){
    alert("No se pudo obtener el ID del producto");
    return;
  }
const idReceta = await obtenerRecetaPorProducto(idProducto);
if(!idReceta){
  alert("No se encontró receta para este producto");
  return;
}

 const detalleReceta = await detalleMateriales(idProducto, productos[0].cantidad);

  const { data, error } = await supabaseClient.from('orden_produccion').insert([{
    numero_op: numeroOP,
    ver_orden: productos,
    id_producto: idProducto, 
    cant_lote: productos[0].cantidad, 
    id_receta: idReceta,
    detalle_materiales: detalleReceta,
    fecha_emision: fecha,
    estado: 'Pendiente'
  }]);

  if(error) return console.error("Error al guardar OP:", error);

  cancelarOP();
  mostrarSeccion('seguimientoOP');
  cargarOP();
});


async function obtnerIdProducto(nombreProducto) {
  const { data, error } = await supabaseClient
      .from('productos')
      .select('id_producto')  
      .eq('nombre', nombreProducto)
      .single();

  if(error){
    console.error("Error al obtener id del producto:", error);
    return null;
  }
  console.log("ID del producto obtenido:", data.id_producto);
  return data.id_producto;
}

async function obtenerRecetaPorProducto(idProducto) {
  const { data, error } = await supabaseClient
      .from('receta')
      .select('*')
      .eq('id_producto', idProducto)
      .single();

  if(error){
    console.error("Error al obtener receta:", error);
    return null;
  }

  return data.id_receta;
}


async function detalleMateriales(idProducto, cantLote) {
  // Traemos las materias primas del producto
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

  // Mapeamos cada item agregando su nombre y multiplicando por el lote
  const detalleMultiplicado = data.map(item => {
    const mat = materiales.find(m => m.id_mp === item.id_mp);
    return {
      //id_mp: item.id_mp,
      nombre_material: mat ? mat.nombre : 'Desconocido',
      id_producto: item.id_producto,
      cantidad_base: item.cantidad,
      unidad: item.unidad,
      cantidad_total: item.cantidad * cantLote
    };
  });

  return detalleMultiplicado;
}

async function actualizarDetalleMateriales() {
  const productos = Array.from(document.querySelectorAll('.producto-item'));
  let detalleTotal = [];

  for (const p of productos) {
    const nombreProd = p.querySelector('select').value;
    const cantLote = parseInt(p.querySelector('input').value, 10);
    if (!nombreProd || cantLote <= 0) continue;

    const idProducto = await obtnerIdProducto(nombreProd); // await aquí está bien
    if (!idProducto) continue;

    const detalle = await detalleMateriales(idProducto, cantLote);
    detalleTotal = detalleTotal.concat(detalle);
  }

  mostrarDetalleMateriales(detalleTotal);
}
function mostrarDetalleMateriales(detalle) {
  const tabla = document.getElementById('tablaMateriales').querySelector('tbody');
  tabla.innerHTML = ''; // limpiar la tabla antes de agregar

  if (!detalle || detalle.length === 0) {
    tabla.innerHTML = `<tr><td colspan="3" style="text-align:center;">Sin datos aún</td></tr>`;
    return;
  }

  detalle.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.nombre_material || item.id_mp}</td>
      <td>${item.cantidad_total}</td>
      <td>${item.unidad}</td>
    `;
    tabla.appendChild(tr);
  });
}



// Cargar/Ver OP desde Supabase
async function cargarOP(){
  const { data, error } = await supabaseClient.from('orden_produccion').select('*').order('id_orden_produccion', {ascending:true});
  if(error) return console.error("Error al cargar OP:", error);

  const tabla = document.getElementById('tablaOP');
  tabla.innerHTML='';
  data.forEach(op=>{
    const tr = document.createElement('tr');
    tr.innerHTML=`
      <td>${op.numero_op}</td>
      <td><button onclick="verOrden(${op.id_orden_produccion})" class="btn-editar">📄 Ver Orden</button></td>
      <td>${op.estado}</td>
      <td>${new Date(op.fecha_emision).toLocaleString()}</td>
      <td>
        ${op.estado==='Pendiente'
          ? `<button onclick="editarOP(${op.id_orden_produccion})" class="btn-editar">✏️ Editar</button>
             <button onclick="eliminarOP(${op.id_orden_produccion})" class="btn-eliminar">❌ Eliminar</button>`
          : 'No disponible'}
      </td>
    `;
    tabla.appendChild(tr);
  });
}

// Ver detalle de OP
async function verOrden(id_orden_produccion){
  const { data, error } = await supabaseClient.from('orden_produccion')
      .select('*').eq('id_orden_produccion', id_orden_produccion).single();
  if(error) return console.error("Error al ver OP:", error);

  const productosHtml = data.ver_orden.map(p=>`<p>${p.nombre} - Cantidad: ${p.cantidad}</p>`).join('');
  document.getElementById('detalleOrden').innerHTML=`
    <p><strong>Número OP:</strong> ${data.numero_op}</p>
    <p><strong>Fecha Emisión:</strong> ${new Date(data.fecha_emision).toLocaleString()}</p>
    <p><strong>Estado:</strong> ${data.estado}</p>
    <h4>Productos:</h4>
    ${productosHtml}
  `;
  document.getElementById('modalOrden').style.display='flex';
}

function cerrarModal(){ document.getElementById('modalOrden').style.display='none'; }

// Editar OP
async function editarOP(id_orden_produccion){
  const { data, error } = await supabaseClient.from('orden_produccion')
      .select('*').eq('id_orden_produccion', id_orden_produccion).single();
  if(error) return console.error("Error al cargar OP para editar:", error);

  const productos = data.ver_orden.map(p=>{
    const cant = prompt(`Editar cantidad de ${p.nombre}:`, p.cantidad);
    if(cant && !isNaN(cant) && cant>0) return { nombre: p.nombre, cantidad: parseInt(cant,10) };
    return p;
  });

  const { error: updateError } = await supabaseClient.from('orden_produccion')
      .update({ ver_orden: productos }).eq('id_orden_produccion', id_orden_produccion);
  if(updateError) return console.error("Error al actualizar OP:", updateError);

  cargarOP();
}

// Eliminar OP
async function eliminarOP(id_orden_produccion){
  if(!confirm("¿Eliminar esta OP?")) return;
  const { error } = await supabaseClient.from('orden_produccion')
      .delete().eq('id_orden_produccion', id_orden_produccion);
  if(error) return console.error("Error al eliminar OP:", error);
  cargarOP();
}

// Inicialización
(async () => {
  await cargarProductosDisponibles();
  prepararNuevaOP();
})();
