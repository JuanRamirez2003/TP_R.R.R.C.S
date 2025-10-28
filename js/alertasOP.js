// ================== Supabase ==================
// Si ya existe supabaseClient en otro script, no volver a declararlo
if (typeof supabaseClient === "undefined") {
  const supabaseUrl = "https://ldgrlfnmuvvaqsezjsvj.supabase.co";
  const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZ3JsZm5tdXZ2YXFzZXpqc3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MzEwNDMsImV4cCI6MjA3NDUwNzA0M30.NrUTqCLkzMWUGqn2XIAsCY8H90vgHpuxhMT2zIVt3Zo";
  window.supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
}

async function cargarOrdenesVencidas() {
  try {
    const hoy = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Consultamos OP cuya fecha_estimada_entrega sea hoy o pasada
    const { data, error } = await supabaseClient
      .from('orden_produccion')
      .select('numero_op, fecha_estimada_entrega')
      .lte('fecha_estimada_entrega', hoy);

    if (error) throw error;

    const lista = document.getElementById('listaVencidas');
    lista.innerHTML = '';

    if (!data || data.length === 0) {
      lista.innerHTML = '<li>No hay órdenes vencidas o con entrega hoy</li>';
      document.getElementById('notificacionVencidas').style.display = 'none';
      return;
    }

    data.forEach(op => {
      const li = document.createElement('li');
      li.textContent = `${op.numero_op} - Fecha entrega: ${op.fecha_estimada_entrega}`;
      lista.appendChild(li);
    });

    // Mostrar notificación
    const noti = document.getElementById('notificacionVencidas');
    noti.style.display = 'flex';
    noti.onclick = () => {
      const tooltip = document.getElementById('tooltipVencidas');
      tooltip.style.display = tooltip.style.display === 'none' ? 'block' : 'none';
    };

  } catch (err) {
    console.error('Error al cargar OP vencidas:', err);
  }
}

// Ejecutar al cargar la página
cargarOrdenesVencidas();