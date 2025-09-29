// ================== Supabase ==================
const supabaseUrl = "https://ldgrlfnmuvvaqsezjsvj.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZ3JsZm5tdXZ2YXFzZXpqc3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MzEwNDMsImV4cCI6MjA3NDUwNzA0M30.NrUTqCLkzMWUGqn2XIAsCY8H90vgHpuxhMT2zIVt3Zo";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// ====== DOM Elements ======
const video = document.getElementById("video-access");
const status = document.getElementById("status");
const messageBox = document.getElementById("message-box");
const userNameSpan = document.getElementById("user-name");
const accessMessage = document.getElementById("access-message");

// ====== Variables ======
let modelsLoaded = false;
let descriptors = []; // Array de {id, name, descriptor}
let verifying = false;

// ====== Mensajes ======
function showMessage(text, type="info") {
    messageBox.textContent = text;
    messageBox.className = "message-box";
    if(type==="success") messageBox.classList.add("success");
    if(type==="error") messageBox.classList.add("error");
    messageBox.classList.add("show");
    setTimeout(()=> messageBox.classList.remove("show"), 3000);
}

// ====== Cargar modelos ======
async function loadModels() {
    try {
        const MODEL_URL = "./models";
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        modelsLoaded = true;
        showMessage("Modelos cargados", "success");
    } catch(err) {
        console.error("Error al cargar modelos:", err);
        showMessage("Error al cargar modelos", "error");
    }
}

// ====== Iniciar cámara ======
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        video.srcObject = stream;
    } catch(err) {
        console.error("Error al iniciar cámara:", err);
        showMessage("No se pudo acceder a la cámara", "error");
    }
}

// ====== Cargar descriptores ======
async function loadDescriptors() {
    try {
        const { data: users, error } = await supabaseClient
            .from("usuarios")
            .select("*");

        if(error) {
            console.error("Error cargando usuarios:", error);
            showMessage("Error al cargar usuarios", "error");
            return;
        }

        descriptors = users
            .filter(u => u.descriptor)
            .map(u => ({
                id: u.id,
                name: u.name,
                descriptor: Float32Array.from(JSON.parse(u.descriptor))
            }));

        showMessage(`${descriptors.length} usuarios cargados`, "success");
    } catch(err) {
        console.error("Error inesperado al cargar descriptores:", err);
        showMessage("Error inesperado al cargar descriptores", "error");
    }
}

// ====== Registrar ingreso/egreso ======
async function registerAccess(userId, userName) {
    try {
        const { data: lastAccess } = await supabaseClient
            .from("accesos")
            .select("accion")
            .eq("usuario_id", userId)
            .order("fecha_hora", { ascending: false })
            .limit(1);

        let accion = "ingreso";
        if(lastAccess && lastAccess.length>0 && lastAccess[0].accion==="ingreso") accion="egreso";

        const { error } = await supabaseClient.from("accesos").insert([{
            usuario_id: userId,
            tipo: "facial",
            accion: accion,
            fecha_hora: new Date().toISOString()
        }]);

        if(error) {
            console.error(error);
            showMessage("Error al registrar acceso", "error");
            return;
        }

        showMessage(`✅ ${userName} registrado como ${accion}`, "success");
        userNameSpan.textContent = userName;
        accessMessage.textContent = accion==="ingreso" 
            ? `Bienvenido/a, ${userName}` 
            : `Salida registrada para ${userName}. ¡Que tengas buen día!`;

    } catch(err) {
        console.error("Error inesperado al registrar acceso:", err);
        showMessage("Error inesperado al registrar acceso", "error");
    }
}

// ====== Loop de verificación facial ======
async function verifyLoop() {
    try {
        if(!modelsLoaded || verifying || descriptors.length===0) return;
        verifying = true;

        const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();

        if(detection){
            const descriptor = detection.descriptor;
            let matched = null;
            let minDistance = 0.5;

            for(const u of descriptors){
                const dist = faceapi.euclideanDistance(descriptor, u.descriptor);
                if(dist < minDistance){
                    minDistance = dist;
                    matched = u;
                }
            }

            if(matched){
                await registerAccess(matched.id, matched.name);
                setTimeout(()=> verifying=false, 3000);
            } else {
                status.textContent = "Rostro no reconocido";
                verifying = false;
            }

        } else {
            status.textContent = "Buscando rostro...";
            verifying = false;
        }
    } catch(err) {
        console.error("Error en el loop de verificación:", err);
        verifying = false;
        status.textContent = "Error al verificar rostro";
    }
}

// ====== Inicialización ======
async function init() {
    try {
        await loadModels();
        await startCamera();
        await loadDescriptors();
        setInterval(verifyLoop, 2000);
    } catch(err) {
        console.error("Error en la inicialización:", err);
        showMessage("Error al iniciar el sistema", "error");
    }
}

init();
