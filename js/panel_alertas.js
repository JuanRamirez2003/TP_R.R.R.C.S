
const alertas = [
  { fecha: "2025-10-23", producto: "Empanadas", motivo: "Falta materia prima", urgencia: "alta" },
  { fecha: "2025-10-24", producto: "Milanesas", motivo: "Sobrecarga de línea", urgencia: "media" },
  { fecha: "2025-10-25", producto: "Pizzas", motivo: "Línea suspendida", urgencia: "alta" }
];

function renderAlertas() {
  const contenedor = document.getElementById("contenedor-alertas");
  contenedor.innerHTML = "";
  alertas.forEach(alerta => {
    const tarjeta = document.createElement("div");
    tarjeta.className = `alerta ${alerta.urgencia}`;
    tarjeta.innerHTML = `
      <strong>${alerta.producto}</strong> - ${alerta.fecha}<br>
      Motivo: ${alerta.motivo}<br>
      <button>Replanificar</button>
    `;
    contenedor.appendChild(tarjeta);
  });
}

function filtrarAlertas() {
  alert("Función de filtrado pendiente.");
}

renderAlertas();
