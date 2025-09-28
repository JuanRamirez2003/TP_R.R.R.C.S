// ======================
// Inventario (inventario.html)
// ======================
const inventarioBody = document.getElementById("inventarioBody");
if (inventarioBody) {
    // Cargar inventario desde localStorage o crear vacío
    let inventario = JSON.parse(localStorage.getItem("inventario")) || [];

    // Guardar inventario en localStorage
    function guardarInventario() {
        localStorage.setItem("inventario", JSON.stringify(inventario));
    }

    // Renderizar tabla de inventario
    function renderInventario() {
        inventarioBody.innerHTML = "";
        inventario.forEach(item => {
            inventarioBody.innerHTML += `
                <tr>
                    <td>${item.nombre}</td>
                    <td>${item.unidad}</td>
                    <td>${item.stock}</td>
                </tr>`;
        });
        guardarInventario();
    }

    // Inicializar tabla
    renderInventario();

    // Formulario: Agregar item
    document.getElementById("formAgregarItem").addEventListener("submit", (e) => {
        e.preventDefault();
        const nombre = document.getElementById("itemNombre").value.trim();
        const unidad = document.getElementById("itemUnidad").value.trim();
        const stock = parseFloat(document.getElementById("itemStock").value);

        if (!nombre || !unidad || isNaN(stock)) {
            alert("Complete todos los campos correctamente.");
            return;
        }

        inventario.push({ nombre, unidad, stock });
        renderInventario();
        e.target.reset();
    });

    // Formulario: Agregar stock
    document.getElementById("formAgregarStock").addEventListener("submit", (e) => {
        e.preventDefault();
        const nombre = document.getElementById("stockNombre").value.trim();
        const cantidad = parseFloat(document.getElementById("stockCantidad").value);

        const item = inventario.find(i => i.nombre === nombre);
        if (item) {
            if (!isNaN(cantidad)) {
                item.stock += cantidad;
                renderInventario();
            } else {
                alert("Cantidad inválida");
            }
        } else {
            alert("Item no encontrado");
        }
        e.target.reset();
    });
}

// ======================
// Orden de Producción (orden.html)
// ======================
const formCrearOrden = document.getElementById("formCrearOrden");
const ordenBody = document.getElementById("ordenBody");
const materiasLista = document.getElementById("materiasLista");

if (formCrearOrden) {
    let ordenes = JSON.parse(localStorage.getItem("ordenes")) || [];
    let materias = {}; // objeto temporal para almacenar insumos antes de crear la orden

    // Guardar órdenes en localStorage
    function guardarOrdenes() {
        localStorage.setItem("ordenes", JSON.stringify(ordenes));
    }

    // Renderizar tabla de órdenes
    function renderOrdenes() {
        ordenBody.innerHTML = "";
        ordenes.forEach(o => {
            ordenBody.innerHTML += `
                <tr>
                    <td>${o.lote}</td>
                    <td>${JSON.stringify(o.requerimientos)}</td>
                    <td>${o.etapa}</td>
                    <td>${o.estado}</td>
                    <td>${o.movimientos.join(" → ")}</td>
                </tr>`;
        });
        guardarOrdenes();
    }

    // Inicializar tabla
    renderOrdenes();

    // Botón: Agregar materia prima a la lista temporal
    document.querySelector(".btnAgregarMateria").addEventListener("click", () => {
        const nombre = document.querySelector(".materiaNombre").value.trim();
        const cantidad = parseFloat(document.querySelector(".materiaCantidad").value);

        if (!nombre || isNaN(cantidad)) {
            alert("Complete ambos campos correctamente.");
            return;
        }

        materias[nombre] = cantidad;

        // Mostrar lista visual de insumos agregados
        materiasLista.innerHTML = Object.entries(materias)
            .map(([n, c]) => `<li>${n}: ${c}</li>`).join("");

        // Limpiar inputs
        document.querySelector(".materiaNombre").value = "";
        document.querySelector(".materiaCantidad").value = "";
    });

    // Formulario: Crear nueva orden
    formCrearOrden.addEventListener("submit", (e) => {
        e.preventDefault();
        const lote = document.getElementById("ordenLote").value.trim();

        if (!lote) {
            alert("Ingrese un nombre para el lote.");
            return;
        }
        if (Object.keys(materias).length === 0) {
            alert("Agregue al menos un insumo antes de crear la orden.");
            return;
        }

        // Crear nueva orden
        const nuevaOrden = {
            lote,
            requerimientos: { ...materias },
            etapa: "Preparación",
            estado: "Creada",
            movimientos: ["Orden creada"]
        };

        ordenes.push(nuevaOrden);
        renderOrdenes();

        // Limpiar formulario y lista de insumos temporales
        formCrearOrden.reset();
        materiasLista.innerHTML = "";
        materias = {};
    });
}
