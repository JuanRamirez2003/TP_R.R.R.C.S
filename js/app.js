// Inicializar Supabase
const SUPABASE_URL = 'TU_SUPABASE_URL';
const SUPABASE_KEY = 'TU_SUPABASE_KEY';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos del DOM ---
    const screens = document.querySelectorAll('.screen');
    const videoRegister = document.getElementById('video-register');
    const videoLogin = document.getElementById('video-login');
    const videoLogout = document.getElementById('video-logout');
    const loginStatus = document.getElementById('login-status');
    const logoutStatus = document.getElementById('logout-status');
    const userNameSpan = document.getElementById('user-name');
    const messageBox = document.getElementById('message-box');

    // Botones
    const registerButton = document.getElementById('register-button');
    const loginButton = document.getElementById('login-button');
    const logoutMenuButton = document.getElementById('logout-button');
    const backButtons = document.querySelectorAll('.back-button');
    const captureButton = document.getElementById('capture-button');
    const registerUserButton = document.getElementById('register-user-button');
    const manualLoginButton = document.getElementById('manual-login-button');
    const manualLogoutButton = document.getElementById('manual-logout-button');

    // Inputs
    const opCodeInput = document.getElementById('op-code');
    const nameInput = document.getElementById('name');
    const dniInput = document.getElementById('dni');
    const manualOpCodeInput = document.getElementById('manual-op-code');
    const manualDniInput = document.getElementById('manual-dni');
    const manualLogoutOpCodeInput = document.getElementById('manual-logout-op-code');
    const manualLogoutDniInput = document.getElementById('manual-logout-dni');

    let capturedDescriptor = null;
    let modelsLoaded = false;
    let loginInterval, loginTimeout, messageTimeout;

    // --- Funciones ---
    function showMessage(text, type = 'info', duration = 3000) {
        messageBox.textContent = text;
        messageBox.className = 'message-box show';
        if (type === 'success') messageBox.classList.add('success');
        if (type === 'error') messageBox.classList.add('error');
        clearTimeout(messageTimeout);
        messageTimeout = setTimeout(() => messageBox.classList.remove('show'), duration);
    }

    function showScreen(screenId) {
        screens.forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
        stopCamera(videoRegister);
        stopCamera(videoLogin);
        stopCamera(videoLogout);
        clearInterval(loginInterval);
        clearTimeout(loginTimeout);

        if (screenId === 'register-screen') startCamera(videoRegister);
        if (screenId === 'login-screen') startFacialLogin();
        if (screenId === 'logout-screen') startFacialLogout();
    }

    async function startCamera(videoEl) {
        if (!modelsLoaded) { showMessage('Modelos de IA cargando...', 'info'); return false; }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
            videoEl.srcObject = stream;
            return true;
        } catch (err) {
            showMessage('No se pudo acceder a la cámara', 'error');
            return false;
        }
    }

    function stopCamera(videoEl) {
        if (videoEl?.srcObject) videoEl.srcObject.getTracks().forEach(track => track.stop());
        videoEl.srcObject = null;
    }

    async function loadFaceApiModels() {
        const MODEL_URL = './models';
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        modelsLoaded = true;
    }

    function resetRegistrationForm() {
        opCodeInput.value = ''; nameInput.value = ''; dniInput.value = '';
        capturedDescriptor = null;
        captureButton.textContent = 'Tomar Foto';
    }

    async function getFaceMatcher() {
        const { data: users } = await supabaseClient.from('usuarios').select('*');
        if (!users || users.length === 0) return null;
        const labeledDescriptors = users.map(u => new faceapi.LabeledFaceDescriptors(u.opCode, [Float32Array.from(JSON.parse(u.descriptor))]));
        return new faceapi.FaceMatcher(labeledDescriptors, 0.5);
    }

    async function getLastAccess(usuario_id) {
        const { data } = await supabaseClient.from('accesos').select('*').eq('usuario_id', usuario_id).order('fecha_hora', { ascending: false }).limit(1);
        return data?.[0] || null;
    }

    async function registerAccess(usuario_id, tipo = 'manual') {
        const last = await getLastAccess(usuario_id);
        const accion = last?.accion === 'ingreso' ? 'egreso' : 'ingreso';
        await supabaseClient.from('accesos').insert([{ usuario_id, tipo, accion, fecha_hora: new Date().toISOString() }]);
        return accion;
    }

    function showAccessScreen(userName, type = 'ingreso') {
        userNameSpan.textContent = userName;
        const msg = document.getElementById('access-message');
        msg.textContent = type === 'ingreso' ? `Bienvenido/a, ${userName}.` : `Salida registrada para ${userName}. ¡Que tengas buen día!`;
        showScreen('access-permitted-screen');
    }

    // --- Eventos ---
    captureButton.addEventListener('click', async () => {
        captureButton.textContent = 'Procesando...';
        const detections = await faceapi.detectSingleFace(videoRegister, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
        if (detections) {
            capturedDescriptor = detections.descriptor;
            captureButton.textContent = 'Foto Capturada ✓';
            showMessage('Foto capturada exitosamente', 'success');
        } else {
            captureButton.textContent = 'Tomar Foto';
            showMessage('No se detectó rostro', 'error');
        }
    });

    registerUserButton.addEventListener('click', async () => {
        const opCode = opCodeInput.value, name = nameInput.value, dni = dniInput.value;
        if (!opCode || !name || !dni || !capturedDescriptor) return showMessage('Complete todos los campos y capture foto', 'error');
        await supabaseClient.from('usuarios').insert([{ opCode, name, dni, descriptor: JSON.stringify(Array.from(capturedDescriptor)) }]);
        showMessage(`Usuario ${name} registrado`, 'success');
        resetRegistrationForm();
        showScreen('main-menu');
    });

    manualLoginButton.addEventListener('click', async () => {
        const opCode = manualOpCodeInput.value, dni = manualDniInput.value;
        const { data: users } = await supabaseClient.from('usuarios').select('*').eq('opCode', opCode).eq('dni', dni);
        if (users?.[0]) {
            const user = users[0];
            const accion = await registerAccess(user.id, 'manual');
            showAccessScreen(user.name, accion);
        } else showScreen('access-denied-screen');
        manualOpCodeInput.value = ''; manualDniInput.value = '';
    });

    manualLogoutButton.addEventListener('click', async () => {
        const opCode = manualLogoutOpCodeInput.value, dni = manualLogoutDniInput.value;
        const { data: users } = await supabaseClient.from('usuarios').select('*').eq('opCode', opCode).eq('dni', dni);
        if (users?.[0]) {
            const user = users[0];
            const accion = await registerAccess(user.id, 'manual');
            showAccessScreen(user.name, accion);
        } else showScreen('access-denied-screen');
        manualLogoutOpCodeInput.value = ''; manualLogoutDniInput.value = '';
    });

    [registerButton, loginButton, logoutMenuButton].forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn === registerButton) showScreen('register-screen');
            if (btn === loginButton) showScreen('login-screen');
            if (btn === logoutMenuButton) showScreen('logout-screen');
        });
    });

    backButtons.forEach(btn => btn.addEventListener('click', () => showScreen('main-menu')));

    // Dark Mode
    const toggleDarkMode = document.getElementById('dark-mode-toggle');
    toggleDarkMode.addEventListener('click', () => {
        document.body.classList.toggle('dark');
        toggleDarkMode.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
    });

    // Inicialización
    loadFaceApiModels();
    showScreen('main-menu');
});
