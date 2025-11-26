// ---------------------- Configuración Supabase ----------------------
const SUPABASE_URL = "https://ldgrlfnmuvvaqsezjsvj.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZ3JsZm5tdXZ2YXFzZXpqc3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MzEwNDMsImV4cCI6MjA3NDUwNzA0M30.NrUTqCLkzMWUGqn2XIAsCY8H90vgHpuxhMT2zIVt3Zo";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// -------------------------------------------------------------------

let productos = [];
let filaEditando = null;

/*document.addEventListener("DOMContentLoaded", async () => {
  await cargarProductos();
  await cargarLineasProduccion();
});*/

// Cargar lista de productos
async function cargarProductos() {
  const { data, error } = await supabase.from("productos").select("id_producto, nombre");
  if (error) console.error("Error cargando productos:", error);
  productos = data ?? [];
}

// Cargar líneas de producción
async function cargarLineasProduccion() {
  filtrarTabla();
  const { data, error } = await supabase.from("linea_produccion").select("*");
  if (error) {
    console.error("Error cargando líneas de producción:", error);
    return;
  }

  const tbody = document.querySelector("#tabla-parametros tbody");
  tbody.innerHTML = "";

  data.forEach((l) => {
    const prod = productos.find((p) => Number(p.id_producto) === Number(l.id_producto));
    const nombreProd = prod ? prod.nombre : "—";

    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td>${l.id_linea ?? ""}</td>
      <td>${nombreProd}</td>
      <td>${l.duracion ?? ""}</td>
      <td>${l.horas_jornada ?? ""}</td>
      <td>${l.eficiencia ?? 0}%</td>
      <td>${l.capacidad_diaria ?? 0}</td>
      <td>${l.estado ?? ""}</td>
      <td><button class="btn-editar"><i class="fas fa-edit"></i>Editar</button></td>
    `;

    fila.querySelector(".btn-editar").addEventListener("click", () => editarFila(l));
    tbody.appendChild(fila);
  });
}

// Editar una fila
function editarFila(datos) {
  console.log("Editando fila:", datos);
  
  const form = document.getElementById("form-parametros");

  form.id_linea.value = datos.id_linea ?? "";
    // Buscar el nombre del producto
  const prod = productos.find(p => Number(p.id_producto) === Number(datos.id_producto));
  form.producto_nombre.value = prod ? prod.nombre : "—";
  form.id_producto.value = datos.id_producto;

  form.duracion.value = datos.duracion ?? "";
  form.horas_jornada.value = datos.horas_jornada ?? "";
  form.eficiencia.value = datos.eficiencia ?? "";
  form.capacidad_diaria.value = datos.capacidad_diaria ?? "";
  form.estado.value = datos.estado ?? "Activa";

  filaEditando = datos.id;
  form.querySelector(".btn-guardar").innerHTML = `<i class="fas fa-check"></i> Guardar cambios`;

    //formWrapper.style.display = "block";

  // Mostrar solo el formulario
  document.getElementById("form-wrapper").style.display = "block";

  // desplazarte hacia el formulario
  form.scrollIntoView({ behavior: "smooth" });

  document.getElementById("btn-cancelar").style.display = "block";

   //filtrarTabla();
}

// Recalcular capacidad diaria automáticamente
["duracion", "horas_jornada", "eficiencia"].forEach((id) => {
  document.getElementById(id).addEventListener("input", calcularCapacidad);
});

function calcularCapacidad() {
  const duracion = parseFloat(document.getElementById("duracion").value) || 0;
  const horas = parseFloat(document.getElementById("horas_jornada").value) || 0;
  const eficiencia = parseFloat(document.getElementById("eficiencia").value) || 0;

  // Fórmula: (horas * 60 / duración) * eficiencia%
  const capacidad = ((horas * 60) / (duracion || 1)) * (eficiencia / 100);
  document.getElementById("capacidad_diaria").value = capacidad.toFixed(2);
}

/*
// Guardar cambios
document.getElementById("form-parametros").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const datos = Object.fromEntries(new FormData(form));

  const payload = {
    id_linea: Number(datos.id_linea),
    id_producto: Number(datos.id_producto),
    duracion: Number(datos.duracion),
    horas_jornada: Number(datos.horas_jornada),
    eficiencia: Number(datos.eficiencia),
    capacidad_diaria: Number(datos.capacidad_diaria),
    estado: datos.estado,
  };

  let error;
  if (filaEditando) {
    ({ error } = await supabase.from("linea_produccion").update(payload).eq("id", filaEditando));
  } else {
    ({ error } = await supabase.from("linea_produccion").insert([payload]));
  }

  if (error) {
    console.error("Error al guardar:", error);
    alert("Error al guardar los datos.");
    return;
  }

  alert(filaEditando ? "Datos actualizados correctamente" : "Línea agregada correctamente");
  form.reset();
  filaEditando = null;
  form.querySelector(".btn-guardar").innerHTML = `<i class="fas fa-save"></i> Guardar parámetros`;
  await cargarLineasProduccion();
});
*/

// Guardar cambios
document.getElementById("form-parametros").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const datos = Object.fromEntries(new FormData(form));
  const currentUserId = localStorage.getItem("currentUserId");
  if (!currentUserId) {
    mostrarAviso("No se pudo identificar al usuario para auditoría.");
    return;
  }


  try {
    const idLinea = Number(datos.id_linea);
    const idProducto = Number(datos.id_producto);
    const duracion = Number(datos.duracion);
    const horas = Number(datos.horas_jornada);
    const eficiencia = Number(datos.eficiencia);

    if (idLinea <= 0 || idProducto <= 0)
      throw new Error("Los IDs de línea y producto deben ser números positivos.");

    if (duracion <= 0 || horas <= 0 || eficiencia <= 0)
      throw new Error("Duración, horas y eficiencia deben ser mayores a 0.");

    if (eficiencia > 100)
      throw new Error("La eficiencia no puede superar el 100%.");

    //Validar que línea y producto existan
    const [{ data: lineasValidas }, { data: productosValidos }] = await Promise.all([
      supabase.from("linea_productos").select("id_linea"),
      supabase.from("productos").select("id_producto")
    ]);

    const idsLineas = lineasValidas?.map(l => Number(l.id_linea)) ?? [];
    const idsProductos = productosValidos?.map(p => Number(p.id_producto)) ?? [];

    if (!idsLineas.includes(idLinea))
      throw new Error(`La línea ${idLinea} no existe en la base de datos.`);

    if (!idsProductos.includes(idProducto))
      throw new Error(`El producto ${idProducto} no existe en la base de datos.`);

    //Construir payload si todo está bien
    const payload = {
      id_linea: idLinea,
      id_producto: idProducto,
      duracion,
      horas_jornada: horas,
      eficiencia,
      capacidad_diaria: Number(datos.capacidad_diaria),
      estado: datos.estado,
      audit_user_id: currentUserId
    };

    let error;
    if (filaEditando) {
      ({ error } = await supabase.from("linea_produccion").update(payload).eq("id", filaEditando));
    } else {
      ({ error } = await supabase.from("linea_produccion").insert([payload]));
    }

    if (error) throw error;
    const { error: errorLinea } = await supabase
    .from("linea_productos")
    .update({ horas_jornada: horas })
    .eq("id_linea", idLinea);


    //alert(filaEditando ? "Datos actualizados correctamente" : "Línea agregada correctamente");

    mostrarAviso("Datos actualizados correctamente");
    form.reset();
    filaEditando = null;
    form.querySelector(".btn-guardar").innerHTML = `<i class="fas fa-save"></i> Guardar parámetros`;
    document.getElementById("form-wrapper").style.display = "none";
    await cargarLineasProduccion();
    filtrarTabla();

  } catch (error) {
    console.error("❌ Error en validación o guardado:", error);
    //alert(error.message || "Ocurrió un error al guardar los datos.");
    mostrarAviso("Ocurrió un error al guardar los datos.");
  }
});


//[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]
 /*document.addEventListener('DOMContentLoaded', () => {
  try {
    //const btnToggle = document.getElementById('btn-toggle-parametros');
    const panel = document.querySelector('.parametros-actuales');

   if (!btnToggle || !panel) {
      console.warn("⚠️ No se encontró el botón o el panel de parámetros actuales en el DOM.");
      return;
    }

    let visible = false;*/

   /* btnToggle.addEventListener('click', () => {
      try {
        visible = !visible;
        panel.classList.toggle('visible', visible);
        btnToggle.innerHTML = visible
          ? '<i class="fas fa-eye-slash"></i> Ocultar parámetros actuales'
          : '<i class="fas fa-table"></i> Ver parámetros actuales';
      } catch (error) {
        console.error("⚠️ Error al alternar la visibilidad del panel:", error);
      }
    });
  } catch (error) {
    console.error("❌ Error al inicializar el botón de alternar parámetros:", error);
  }
});
*/



document.addEventListener("DOMContentLoaded", async () => {
  try {
    await cargarProductos();
    await cargarLineasProduccion();
   
    await llenarFiltros();
    document.getElementById("filtro-linea").addEventListener("change", filtrarTabla);
    document.getElementById("filtro-producto").addEventListener("change", filtrarTabla);

    // Botón toggle
    const btnToggle = document.getElementById('btn-toggle-parametros');
    const panel = document.getElementById('panelParametros');
    let visible = false;
    /*btnToggle.addEventListener('click', () => {
      visible = !visible;
      panel.classList.toggle('visible', visible);
      btnToggle.innerHTML = visible
        ? '<i class="fas fa-eye-slash"></i> Ocultar parámetros actuales'
        : '<i class="fas fa-table"></i> Ver parámetros actuales';
    });*/

    // Botón volver
    document.getElementById("btn-volver").addEventListener("click", () => {
      window.location.href = "supervisor.html";
    });

    // Inputs capacidad diaria
    ["duracion", "horas_jornada", "eficiencia"].forEach((id) => {
      document.getElementById(id).addEventListener("input", calcularCapacidad);
    });
  } catch (error) {
    console.error("❌ Error al inicializar la página:", error);
  }
});

async function llenarFiltros() {
  const selectLinea = document.getElementById("filtro-linea");
  const selectProducto = document.getElementById("filtro-producto");

  // Limpiar opciones
  selectLinea.innerHTML = '<option value="">Todas</option>';
  selectProducto.innerHTML = '<option value="">Todos</option>';

  try {
    // Lineas
    const { data: lineas, error: errorLineas } = await supabase
      .from("linea_productos")
      .select("id_linea");

    if (errorLineas) throw errorLineas;
    lineas.sort((a, b) => a.id_linea - b.id_linea)

    lineas?.forEach(l => {
      const opt = document.createElement("option");
      opt.value = l.id_linea;
      opt.textContent = l.id_linea;
      selectLinea.appendChild(opt);
    });
  } catch (error) {
    console.error("⚠️ Error al cargar líneas de producción:", error);
  }

  try {
    const { data: productos, error: errorProductos } = await supabase
      .from("productos")
      .select("id_producto, nombre");

    if (errorProductos) throw errorProductos;

    productos?.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id_producto;
      opt.textContent = p.nombre;
      selectProducto.appendChild(opt);
    });
  } catch (error) {
    console.error("⚠️ Error al cargar productos:", error);
  }
}

function filtrarTabla() {
  try {
    const linea = document.getElementById("filtro-linea").value;
    const selectProducto = document.getElementById("filtro-producto");
    const producto = selectProducto.options[selectProducto.selectedIndex].text;

    const filas = document.querySelectorAll("#tabla-parametros tbody tr");

    filas.forEach(fila => {
      const lineaFila = fila.cells[0].textContent.trim();
      const productoFila = fila.cells[1].textContent.trim();

      const mostrar =
        (!linea || linea === lineaFila) &&
        (!producto || producto === "Todos" || producto === productoFila);

      fila.style.display = mostrar ? "" : "none";
      ordenarPorEficiencia();
    });
  } catch (error) {
    console.error("⚠️ Error al filtrar la tabla:", error);
  }
}

document.getElementById("filtro-eficiencia").addEventListener("change", ordenarPorEficiencia);

function ordenarPorEficiencia() {
  const orden = document.getElementById("filtro-eficiencia").value;
  const tbody = document.querySelector("#tabla-parametros tbody");
  const filas = Array.from(tbody.querySelectorAll("tr"));

  if (!orden) return; // si es "ninguno", no hacemos nada

  filas.sort((a, b) => {
    const valA = parseFloat(a.cells[4].textContent) || 0; // columna Eficiencia
    const valB = parseFloat(b.cells[4].textContent) || 0;

    return orden === "asc" ? valA - valB : valB - valA;
  });

  // Reordenar la tabla
  filas.forEach(fila => tbody.appendChild(fila));
}

//Botón "Cancelar" para ocultar el formulario sin guardar
document.getElementById("btn-cancelar").addEventListener("click", () => {
  const form = document.getElementById("form-parametros");
  form.reset(); // Limpia los campos
  filaEditando = null;
  form.querySelector(".btn-guardar").innerHTML = `<i class="fas fa-save"></i> Guardar parámetros`;
  document.getElementById("form-wrapper").style.display = "none"; // Oculta el cuadro
});



/*async function cargarProductos() {
  const { data, error } = await supabase.from("productos").select("id_producto, nombre");
  if (error) return console.error("Error cargando productos:", error);

  productos = data ?? [];

  const select = document.getElementById("id_producto");
  select.innerHTML = ""; // Limpiar antes
  productos.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id_producto; // El ID que se guardará
    opt.textContent = p.nombre; // Nombre que ve el usuario
    select.appendChild(opt);
  });
}*/


function mostrarAviso(mensaje) {
  const modal = document.getElementById('modalAviso');
  const mensajeP = document.getElementById('mensajeAvisoTexto');
  const btnCerrar = document.getElementById('btnCerrarAviso');

  if (!modal || !mensajeP || !btnCerrar) {
    console.error("⚠️ No se encontró el modal de aviso");
    return alert(mensaje);
  }

  mensajeP.textContent = mensaje;
  modal.classList.add('mostrar');

  btnCerrar.onclick = () => modal.classList.remove('mostrar');
  modal.onclick = (e) => {
    if (e.target === modal) modal.classList.remove('mostrar');
  };
}