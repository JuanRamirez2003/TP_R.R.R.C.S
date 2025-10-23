document.getElementById("form-parametros").addEventListener("submit", function(e) {
  e.preventDefault();
  const datos = Object.fromEntries(new FormData(e.target));
  if (!datos.linea || !datos.producto || !datos.velocidad || !datos.jornada || !datos.estado) {
    alert("Todos los campos son obligatorios.");
    return;
  }
  agregarFila(datos);
  e.target.reset();
});

function agregarFila(datos) {
  const tbody = document.querySelector("#tabla-parametros tbody");
  const fila = document.createElement("tr");
  fila.innerHTML = `
    <td>${datos.linea}</td>
    <td>${datos.producto}</td>
    <td>${datos.velocidad}</td>
    <td>${datos.jornada}</td>
    <td>${datos.estado}</td>
  `;
  tbody.appendChild(fila);
}
