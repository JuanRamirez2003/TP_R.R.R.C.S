
const dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const lineas = ["Línea 1", "Línea 2"];
const producciones = [
  { dia: "Lunes", linea: "Línea 1", producto: "Empanadas", hora: "08:00 - 12:00", estado: "activa" },
  { dia: "Lunes", linea: "Línea 1", producto: "Milanesas", hora: "12:00 - 14:00", estado: "suspendida" },
  { dia: "Lunes", linea: "Línea 1", producto: "Pizzas", hora: "14:00 - 18:00", estado: "activa" },
  { dia: "Martes", linea: "Línea 2", producto: "Empanadas", hora: "08:00 - 12:00", estado: "activa" },
  { dia: "Miercoles", linea: "Línea 1", producto: "Empanadas", hora: "08:00 - 12:00", estado: "activa" },
  { dia: "Jueves", linea: "Línea 4", producto: "Empanadas", hora: "08:00 - 12:00", estado: "activa" },
  { dia: "Jueves", linea: "Línea 1", producto: "Empanadas", hora: "12:00 - 15:00", estado: "activa" }
];

function renderAgenda() {
  const agenda = document.getElementById("agenda-semanal");
  agenda.innerHTML = "";
  dias.forEach(dia => {
    const columna = document.createElement("div");
    columna.className = "agenda-dia";
    columna.innerHTML = `<strong>${dia}</strong><br>`;
    producciones.filter(p => p.dia === dia).forEach(p => {
      const bloque = document.createElement("div");
      bloque.className = `bloque-produccion ${p.estado}`;
      bloque.innerHTML = `<strong>${p.linea}</strong><br>${p.producto}<br>${p.hora}`;
      columna.appendChild(bloque);
    });
    agenda.appendChild(columna);
  });
}

function semanaAnterior() {
  alert("Función de navegación pendiente.");
}
function semanaSiguiente() {
  alert("Función de navegación pendiente.");
}

renderAgenda();
