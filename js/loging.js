// ============================
// Configuración Supabase
// ============================
const supabaseUrl = "https://ldgrlfnmuvvaqsezjsvj.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZ3JsZm5tdXZ2YXFzZXpqc3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MzEwNDMsImV4cCI6MjA3NDUwNzA0M30.NrUTqCLkzMWUGqn2XIAsCY8H90vgHpuxhMT2zIVt3Zo";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// ============================
// Estado global
// ============================
let currentUser = null;
let referenceDescriptor = null;
let verifyInterval = null;
let verifyTimeout = null;

// ============================
// Elementos del DOM
// ============================
const manualLoginButton = document.getElementById("manual-login-button");
const manualOpCodeInput = document.getElementById("manual-op-code");
const manualDniInput = document.getElementById("manual-dni");

const videoVerify = document.getElementById("video-verify");
const verifyStatus = document.getElementById("verify-status");
const messageBox = document.getElementById("message-box");

// ============================
// Utilidades UI
// ============================
function showMessage(text, type = "info", duration = 3000) {
  messageBox.textContent = text;
  messageBox.className = "message-box show " + type; // estilos: .info/.error/.success
  messageBox.style.display = "block";
  if (duration > 0) {
    setTimeout(() => {
      messageBox.classList.remove("show");
      messageBox.style.display = "none";
    }, duration);
  }
}

function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const target = document.getElementById(screenId);
  if (target) target.classList.add("active");
}

// detiene la cámara y limpia stream
function stopCamera(videoEl) {
  if (videoEl && videoEl.srcObject) {
    try {
      videoEl.srcObject.getTracks().forEach(track => track.stop());
    } catch (e) { /* ignore */ }
    videoEl.srcObject = null;
  }
}

// ============================
// Carga modelos face-api
// ============================
async function loadModels() {
  try {
    await faceapi.nets.tinyFaceDetector.loadFromUri("models/");
    await faceapi.nets.faceLandmark68Net.loadFromUri("models/");
    await faceapi.nets.faceRecognitionNet.loadFromUri("models/");
  } catch (err) {
    console.error("Error al cargar modelos face-api:", err);
    showMessage("Error cargando modelos de IA", "error", 5000);
  }
}

// ============================
// Verificación facial en vivo
// ============================
async function startFaceVerification() {
  showScreen("verify-screen");
  verifyStatus.textContent = "Iniciando cámara...";

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoVerify.srcObject = stream;
  } catch (err) {
    console.error("No se pudo acceder a la cámara:", err);
    showMessage("No se pudo acceder a la cámara", "error", 3000);
    showScreen("manual-login-screen");
    return;
  }

  verifyStatus.textContent = "Buscando rostro...";

  // timeout: si en 5s no encuentra un rostro válido -> vuelve al inicio con error
  verifyTimeout = setTimeout(() => {
    clearInterval(verifyInterval);
    stopCamera(videoVerify);
    showMessage("❌ No se detectó rostro. Intente nuevamente.", "error", 3000);
    showScreen("manual-login-screen");
  }, 5000);

  // intervalo de detección cada 1s
  verifyInterval = setInterval(async () => {
    if (!referenceDescriptor) return;

    try {
      const detection = await faceapi
        .detectSingleFace(videoVerify, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        verifyStatus.textContent = "Buscando rostro...";
        return;
      }

      // distancia euclidiana entre descriptors
      const distance = faceapi.euclideanDistance(referenceDescriptor, detection.descriptor);

      // umbral: 0.5 (ajustable)
      if (distance < 0.5) {
    // éxito
    clearTimeout(verifyTimeout);
    clearInterval(verifyInterval);
    stopCamera(videoVerify);

    const displayName = currentUser.name || currentUser.nombre || "Operario";
    showMessage(`✅ Bienvenido ${displayName}`, "success", 2000);

     // redirigir según área
    setTimeout(() => {
        localStorage.setItem('currentUserName', displayName);

        switch (currentUser.area) {
            case "Ventas":
                window.location.href = "ventas.html";
                break;
            case "Recursos Humanos":
                window.location.href = "rrhh.html";
                break;
            case "TI":
                window.location.href = "ti.html";
                break;
            case "Operario":
                window.location.href = "operario.html";
                break;
            case "Supervisor":
                window.location.href = "supervisor.html";
                break;
            case "Gerente General":
                window.location.href = "gerente.html";
                break;
            default:
                // Si no hay área asignada, ir a un HTML genérico
                window.location.href = "dashboard.html";
        }
    }, 1500); // pequeño delay para que vea el mensaje


      } else {
        // rostro detectado pero no coincide -> mostrar error y volver
        clearTimeout(verifyTimeout);
        clearInterval(verifyInterval);
        stopCamera(videoVerify);

        verifyStatus.textContent = "⚠️ Rostro no coincide";
        showMessage("❌ Rostro no coincide. Volviendo al inicio...", "error", 3000);
        // dar tiempo para que vea el mensaje y volver
        setTimeout(() => {
          showScreen("manual-login-screen");
        }, 1500);
      }
    } catch (err) {
      console.error("Error en detección:", err);
      // en caso de error inesperado, limpiar y volver
      clearTimeout(verifyTimeout);
      clearInterval(verifyInterval);
      stopCamera(videoVerify);
      showMessage("Error en la verificación facial", "error", 3000);
      showScreen("manual-login-screen");
    }
  }, 1000);
}

// ============================
// Evento: validar usuario manual
// ============================
manualLoginButton.addEventListener("click", async () => {
  const opCode = manualOpCodeInput.value.trim();
  const dni = manualDniInput.value.trim();

  if (!opCode || !dni) {
    showMessage("Complete todos los campos", "error", 2500);
    return;
  }

  try {
    const { data: users, error } = await supabaseClient
      .from("usuarios")
      .select("*")
      .eq("opCode", opCode)
      .eq("dni", dni);

    if (error) {
      console.error("Error consultando usuarios:", error);
      showMessage("Error al consultar la base de datos", "error", 3000);
      return;
    }

    if (!users || users.length === 0) {
      showMessage("❌ Usuario no encontrado", "error", 2500);
      showScreen("manual-login-screen");
      return;
    }

    // usuario encontrado
    currentUser = users[0];

    if (!currentUser.descriptor) {
      showMessage("El usuario no tiene descriptor facial guardado", "error", 3000);
      showScreen("manual-login-screen");
      return;
    }

    // parsear descriptor (se espera JSON string "[...]")
    try {
      referenceDescriptor = new Float32Array(JSON.parse(currentUser.descriptor));
    } catch (err) {
      console.error("Error al parsear descriptor:", err);
      showMessage("Descriptor inválido en la base de datos", "error", 3000);
      showScreen("manual-login-screen");
      return;
    }

    // cargar modelos (si no están) y comenzar verificación
    await loadModels();
    startFaceVerification();
  } catch (err) {
    console.error("Error inesperado:", err);
    showMessage("Error inesperado. Intente nuevamente.", "error", 3000);
    showScreen("manual-login-screen");
  }
});

// ============================
// Botón Volver
// ============================
function volverIndex() {
  // Detener cámara y limpiar timers si estuvieran activos
  stopCamera(videoVerify);
  clearInterval(verifyInterval);
  clearTimeout(verifyTimeout);

  // Redirigir al index
  window.location.href = "index.html";
}

// ============================
// Limpieza al cambiar pantalla manualmente (si es necesario)
// ============================
window.addEventListener("beforeunload", () => {
  stopCamera(videoVerify);
  clearInterval(verifyInterval);
  clearTimeout(verifyTimeout);
});
