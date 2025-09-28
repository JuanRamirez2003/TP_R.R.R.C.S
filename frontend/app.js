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
// ORDEN DE PRODUCCIÓN (orden.html)
// ======================

// Elementos principales del DOM
const formCrearOrden = document.getElementById("formCrearOrden");
const ordenBody = document.getElementById("ordenBody");
const materiasLista = document.getElementById("materiasLista");

if (formCrearOrden) {
    // ======================
    // Datos almacenados
    // ======================
    let ordenes = JSON.parse(localStorage.getItem("ordenes")) || {}; // objeto donde la clave es el lote
    let materias = {}; // materias primas temporales antes de crear la orden

    // Guardar en localStorage
    function guardarOrdenes() {
        localStorage.setItem("ordenes", JSON.stringify(ordenes));
    }

    // ======================
    // Panel: ÓRDENES DE PRODUCCIÓN (tabla)
    // ======================
    function renderOrdenes() {
        ordenBody.innerHTML = "";
        Object.entries(ordenes).forEach(([lote, data]) => {
            ordenBody.innerHTML += `
                <tr>
                    <td>${lote}</td>
                    <td>${Object.entries(data.requerimientos)
                        .map(([n, c]) => `${n}: ${c}`).join(", ")}</td>
                    <td>${data.etapa}</td>
                    <td>${data.estado}</td>
                    <td>${data.movimientos.join(" → ")}</td>
                </tr>`;
        });
        guardarOrdenes();
    }

    // Inicializar tabla al cargar
    renderOrdenes();

    // ======================
    // Panel: AGREGAR MATERIAS PRIMAS
    // ======================
    document.querySelector(".btnAgregarMateria").addEventListener("click", () => {
        const nombre = document.querySelector(".materiaNombre").value.trim();
        const cantidad = parseFloat(document.querySelector(".materiaCantidad").value);

        if (!nombre || isNaN(cantidad)) {
            alert("Complete ambos campos correctamente.");
            return;
        }

        // Guardar en lista temporal
        materias[nombre] = cantidad;

        // Mostrar lista visual en el panel
        materiasLista.innerHTML = Object.entries(materias)
            .map(([n, c]) => `<li>${n}: ${c}</li>`)
            .join("");

        // Limpiar inputs
        document.querySelector(".materiaNombre").value = "";
        document.querySelector(".materiaCantidad").value = "";
    });

    // ======================
    // Panel: CREAR NUEVA ORDEN
    // ======================
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

        // Guardar la orden usando el lote como clave
        ordenes[lote] = {
            requerimientos: { ...materias },
            etapa: "Preparación",
            estado: "Creada",
            movimientos: ["Orden creada"]
        };

        // Actualizar tabla
        renderOrdenes();

        // Limpiar inputs y lista temporal
        document.getElementById("ordenLote").value = "";
        materiasLista.innerHTML = "";
        materias = {};
    });
}
