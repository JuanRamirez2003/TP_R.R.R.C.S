// js/registro_etapas.js
(function insertarEstilos() {
  const css = `
/* 🎯 Estilos para líneas de producción */
#lineasProduccion {
  display: flex;
  flex-direction: column;
  gap: 22px;
  margin-top: 18px;
  font-family: "Segoe UI", Roboto, sans-serif;
}

.linea-produccion {
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  padding: 16px 18px;
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  box-shadow: 0 2px 6px rgba(0,0,0,0.05);
  display: flex;
  flex-direction: column;
  transition: box-shadow 0.25s ease, transform 0.25s ease;
}
.linea-produccion:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.12);
  transform: translateY(-2px);
}

/* ===== Encabezado ===== */
.linea-header {
  display:flex;
  align-items:center;
  justify-content:space-between;
  margin-bottom:12px;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 6px;
}
.linea-header h4 { 
  margin:0; 
  font-size:16px; 
  font-weight:700; 
  color:#1e293b;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ===== Estado (con LED) ===== */
.estado-linea {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight:600;
  font-size:13px;
  text-transform: uppercase;
  color:#1e293b;
}

.estado-led {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: #b91c1c;
  box-shadow: 0 0 6px rgba(185, 28, 28, 0.6);
  transition: background 0.3s, box-shadow 0.3s;
}

.estado-en-marcha .estado-led {
  background-color: #16a34a;
  box-shadow: 0 0 8px rgba(22, 163, 74, 0.7);
}
.estado-detenida .estado-led {
  background-color: #b91c1c;
  box-shadow: 0 0 8px rgba(185, 28, 28, 0.6);
}

/* ===== Cinta transportadora ===== */
.cinta-wrapper {
  position: relative;
  height: 44px;
  background: linear-gradient(180deg, #475569, #334155);
  border-radius: 6px;
  overflow: hidden;
  box-shadow: inset 0 2px 6px rgba(0,0,0,0.3);
  margin-top: 6px;
}

.cinta-wrapper::before,
.cinta-wrapper::after {
  content: "";
  position: absolute;
  top: 4px;
  width: 12px;
  height: 36px;
  background: #1e293b;
  border-radius: 50px;
  box-shadow: inset 0 1px 3px rgba(255,255,255,0.1);
}
.cinta-wrapper::before { left: -6px; }
.cinta-wrapper::after { right: -6px; }

/* 🔁 Movimiento continuo de izquierda a derecha */
@keyframes moverCinta {
  0% { transform: translateX(-100%) translateY(-50%); }
  100% { transform: translateX(100%) translateY(-50%); }
}

.cinta-items {
  position: absolute;
  top: 50%;
  left: 0;
  transform: translateY(-50%);
  white-space: nowrap;
  font-size: 18px;
  color: #f8fafc;
  letter-spacing: 1px;
  animation: moverCinta 10s linear infinite; /* infinite para repetición continua */
}

/* Detener la cinta cuando se pausa */
.cinta-wrapper.stop .cinta-items {
  animation-play-state: paused;
  opacity: 0.4;
}




/* ===== Botones ===== */
.linea-actions { 
  display:flex; 
  justify-content: flex-end;
  gap:12px; 
  align-items:center; 
  margin-top:10px;
}
.linea-actions button {
  padding: 8px 16px;
  border: none;
  background:#2563eb;
  color:#fff;
  border-radius:6px;
  cursor:pointer;
  font-weight:600;
  font-size:14px;
  transition: background 0.2s ease, transform 0.1s ease;
}
.linea-actions button:hover { background:#1e40af; transform: scale(1.03); }
.linea-actions button:active { transform: scale(0.98); }

@media (max-width:700px) {
  .cinta-items { font-size: 14px; }
}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();

/* 🧩 Productos más profesionales */
const productos = {
  1: "▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣",
  2: "▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢",
  3: "■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■",
  4: "□ □ □ □ □ □ □ □ □ □ □ □ □ □",
  5: "▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪"
};

/* ⚙️ Estado de cada línea */
const estados = {1:false,2:false,3:false,4:false,5:false};

/* 🏭 Crear UI */
document.addEventListener('DOMContentLoaded', () => {
  const contenedor = document.getElementById('registroEtapas');
  if (!contenedor) return;

  const wrapper = document.createElement('div');
  wrapper.id = 'lineasProduccion';

  const nombres = {
    1: 'Línea 1 – Choclo',
    2: 'Línea 2 – Arvejas',
    3: 'Línea 3 – Pechugas',
    4: 'Línea 4 – Empaque',
    5: 'Línea 5 – Control de Calidad'
  };

  for (let i = 1; i <= 5; i++) {
    const linea = document.createElement('div');
    linea.className = 'linea-produccion';
    linea.dataset.linea = i;

    /* Encabezado */
    const header = document.createElement('div');
    header.className = 'linea-header';
    const titulo = document.createElement('h4');
    titulo.textContent = nombres[i];

    const estadoCont = document.createElement('div');
    estadoCont.className = 'estado-linea estado-detenida';
    const led = document.createElement('span');
    led.className = 'estado-led';
    const estadoText = document.createElement('span');
    estadoText.id = `estado-linea-${i}`;
    estadoText.textContent = 'Detenida';
    estadoCont.appendChild(led);
    estadoCont.appendChild(estadoText);

    header.appendChild(titulo);
    header.appendChild(estadoCont);

    /* Cinta */
    const cinta = document.createElement('div');
    cinta.className = 'cinta-wrapper stop';
    cinta.id = `cinta${i}`;
    const items = document.createElement('div');
    items.className = 'cinta-items';
    // duplicamos el contenido para recorrido completo
    items.textContent = productos[i] + " " + productos[i];
    cinta.appendChild(items);

    /* Botones */
    const actions = document.createElement('div');
    actions.className = 'linea-actions';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = `btn-linea-${i}`;
    btn.textContent = 'Iniciar';
    btn.addEventListener('click', () => toggleLinea(i));
    actions.appendChild(btn);

    /* Ensamblar */
    linea.appendChild(header);
    linea.appendChild(cinta);
    linea.appendChild(actions);
    wrapper.appendChild(linea);
  }

  contenedor.appendChild(wrapper);
});

/* 🔄 Alternar línea */
function toggleLinea(n) {
  const cinta = document.getElementById(`cinta${n}`);
  const btn = document.getElementById(`btn-linea-${n}`);
  const estadoCont = cinta.closest('.linea-produccion').querySelector('.estado-linea');
  const estadoText = document.getElementById(`estado-linea-${n}`);
  if (!cinta || !btn || !estadoCont || !estadoText) return;

  estados[n] = !estados[n];
  const items = cinta.querySelector('.cinta-items');

  if (estados[n]) {
    cinta.classList.remove('stop');
    btn.textContent = 'Detener';
    estadoText.textContent = 'En marcha';
    estadoCont.classList.remove('estado-detenida');
    estadoCont.classList.add('estado-en-marcha');
    items.style.opacity = '1';
  } else {
    cinta.classList.add('stop');
    btn.textContent = 'Iniciar';
    estadoText.textContent = 'Detenida';
    estadoCont.classList.remove('estado-en-marcha');
    estadoCont.classList.add('estado-detenida');
    items.style.opacity = '0.5';
  }
}

window.toggleLinea = toggleLinea;
window.__estadosLineas = estados;
