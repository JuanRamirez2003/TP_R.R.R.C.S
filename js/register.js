// ================== Supabase ==================
const supabaseUrl = "https://ldgrlfnmuvvaqsezjsvj.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZ3JsZm5tdXZ2YXFzZXpqc3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MzEwNDMsImV4cCI6MjA3NDUwNzA0M30.NrUTqCLkzMWUGqn2XIAsCY8H90vgHpuxhMT2zIVt3Zo";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// ====== DOM Elements ======
const opCodeInput = document.getElementById("op-code");
const nameInput = document.getElementById("name");
const dniInput = document.getElementById("dni");
const areaInput = document.getElementById("area");
const verifyButton = document.getElementById("verify-button");
const video = document.getElementById("video-register");
const captureButton = document.getElementById("capture-button");
const registerButton = document.getElementById("register-user-button");
const messageBox = document.getElementById("message-box");

let capturedDescriptor = null;
let modelsLoaded = false;
let dniAvailable = false;

// ====== Mostrar mensajes ======
function showMessage(text, type = "info") {
    messageBox.textContent = text;
    messageBox.className = `message-box ${type} show`;
    setTimeout(() => {
        messageBox.classList.remove("show");
    }, 3000);
}

// ====== Cargar modelos ======
async function loadModels() {
    try {
        await faceapi.nets.tinyFaceDetector.loadFromUri("models/");
        await faceapi.nets.faceLandmark68Net.loadFromUri("models/");
        await faceapi.nets.faceRecognitionNet.loadFromUri("models/");
        modelsLoaded = true;
    } catch (err) {
        console.error("Error cargando modelos:", err);
        showMessage("Error cargando modelos de reconocimiento facial", "error");
    }
}

// ====== Cámara ======
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        video.srcObject = stream;
    } catch (err) {
        console.error("Error al acceder a la cámara:", err);
        showMessage("No se pudo acceder a la cámara", "error");
    }
}

// ====== Obtener próximo código de operario ======
async function getNextOpCode() {
    try {
        const { data: users, error } = await supabaseClient
            .from("usuarios")
            .select("opCode")
            .order("opCode", { ascending: false })
            .limit(1);
        if (error) throw error;

        let lastCode = users && users.length > 0 ? parseInt(users[0].opCode) || 0 : 0;
        return (lastCode + 1).toString().padStart(3, "0");
    } catch (err) {
        console.error("Error obteniendo próximo código:", err);
        showMessage("No se pudo generar código de operario", "error");
        return "000";
    }
}

// ====== Verificar DNI ======
async function checkDni() {
    try {
        const dni = dniInput.value.trim();
        if (!dni) return false;

        const { data: existing, error } = await supabaseClient
            .from("usuarios")
            .select("dni")
            .eq("dni", dni);

        if (error) throw error;

        if (existing && existing.length > 0) {
            showMessage("⚠️ Este DNI ya está registrado", "error");
            return false;
        }
        return true;
    } catch (err) {
        console.error("Error verificando DNI:", err);
        showMessage("Error verificando DNI", "error");
        return false;
    }
}

// ====== Verificar datos antes de tomar foto ======
verifyButton.addEventListener("click", async () => {
    try {
        const name = nameInput.value.trim();
        const area = areaInput.value;
        if (!name) { showMessage("Ingrese el nombre completo", "error"); return; }
        if (!area) { showMessage("Seleccione un área de trabajo", "error"); return; }

        dniAvailable = await checkDni();

        if (dniAvailable) {
            showMessage("✅ Datos correctos. Ahora puede tomar la foto", "success");
            captureButton.disabled = false;
        } else {
            showMessage("Corrija los datos antes de continuar", "error");
            captureButton.disabled = true;
        }
    } catch (err) {
        console.error("Error en verificación de datos:", err);
        showMessage("Error al verificar los datos", "error");
    }
});

// ====== Captura de foto ======
captureButton.addEventListener("click", async () => {
    try {
        if (!modelsLoaded) { showMessage("Modelos no cargados", "error"); return; }

        const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (detection) {
            capturedDescriptor = detection.descriptor;
            showMessage("📸 Foto capturada correctamente", "success");
        } else {
            showMessage("No se detectó rostro, intente de nuevo", "error");
        }
    } catch (err) {
        console.error("Error capturando rostro:", err);
        showMessage("Error al capturar la foto", "error");
    }
});

// ====== Registro de usuario ======
registerButton.addEventListener("click", async () => {
    const originalText = registerButton.textContent;
    registerButton.textContent = "Cargando...";
    registerButton.disabled = true;
    try {
        const name = nameInput.value.trim();
        const dni = dniInput.value.trim();
        const area = areaInput.value;
        const opCode = opCodeInput.value;

        if (!name || !dni || !area || !capturedDescriptor) {
            showMessage("Complete todos los campos y capture la foto", "error");
            if (registerButton) {
            registerButton.disabled = false;
            registerButton.textContent = originalText;
            }
            return;
        }

        const { data: existing, error } = await supabaseClient
            .from("usuarios")
            .select("*")
            .eq("dni", dni);

        if (error) throw error;

        if (existing && existing.length > 0) { 
            showMessage("El DNI ya está registrado", "error"); 
            if (registerButton) {
            registerButton.disabled = false;
            registerButton.textContent = originalText;
            }
            return; 
        }
        const currentUserId = localStorage.getItem("currentUserId");
        if (!currentUserId) {
        console.warn("⚠️ No hay usuario logueado en localStorage");
        //mostrarAviso("No se pudo identificar al usuario para auditoría");
        if (registerButton) {
            registerButton.disabled = false;
            registerButton.textContent = originalText;
            }
        return;
        }

        //console.log("################ ", currentUserId);
        const { error: insertError } = await supabaseClient.from("usuarios").insert([{
            opCode,
            name,
            dni,
            area,
            descriptor: JSON.stringify(Array.from(capturedDescriptor)),
            audit_user_id: currentUserId
        }]);

        if (insertError) throw insertError;
        if (registerButton) {
            registerButton.disabled = false;
            registerButton.textContent = originalText;
            }
        showMessage("✅ Usuario registrado con éxito", "success");

        // Limpiar campos y redirigir
        nameInput.value = "";
        dniInput.value = "";
        areaInput.value = "";
        capturedDescriptor = null;
        captureButton.disabled = true;

        setTimeout(() => window.location.href = "rrhh.html", 2000);

    } catch (err) {
        console.error("Error registrando usuario:", err);
        showMessage("Ocurrió un error al registrar el usuario", "error");
        if (registerButton) {
            registerButton.disabled = false;
            registerButton.textContent = originalText;
            }
    }
});

// ====== Inicialización ======
(async function init() {
    try {
        await loadModels();
        await startCamera();
        opCodeInput.value = await getNextOpCode();
    } catch (err) {
        console.error("Error inicializando página:", err);
        showMessage("Error inicializando la página", "error");
    }
})();
