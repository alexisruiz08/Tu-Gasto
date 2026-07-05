// script.js
// CONFIGURACIÓN GLOBAL
const API_URL = 'api.php'; 
const GOOGLE_CLIENT_ID = "875118863427-50nipitrr9qjiancdru831bkeoa0krmn.apps.googleusercontent.com"; 

// ✅ ENLACE MAESTRO INTEGRADO (CSV)
const DEFAULT_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRcJ627hJGrJiOiHfAJyNZQWczsff_8InNB2i1B4dqqYfXBG-uKmhFbi3Mtc39biuaEjylIRJ6TFNf3/pub?gid=0&single=true&output=csv";

let currentUser = null;

// ESTRUCTURA DE DATOS
let currentData = {
    ingresos: { fijo: 0, extra: 0 },
    gastos: [],
    monedaBase: 'ars',
    monedaVisual: 'usd',
    sheetUrl: '',
    billetera: {}
};

// FIX #1: Caché de todos los datos del usuario para evitar doble GET en saveData
let cachedAllData = null;

// Cotizaciones de Respaldo
let exchangeRatesUSD = { 
    'usd': 1, 
    'ars': 0.0009, 
    'bitcoin': 90000,
    'ethereum': 3300,
    'tether': 1,
    'uyu': 0.025
}; 

// Variables UI
let currentMonth = new Date().getMonth() + 1; 
let currentYear = new Date().getFullYear();
let transferType = 'deposito';
let rolloverData = null; 
let lastDeletedGasto = null;
let deleteTimeout = null;

// Estado de ordenamiento de tabla
let tableSortCol = 'descripcion'; // columna activa
let tableSortDir = 1;             // 1 = asc, -1 = desc 

// FIX #5: Flag para evitar doble inicialización de Google Login
let googleInitialized = false;

// FIX #11: Flag para mostrar notificación de cotizaciones solo en primera carga
let ratesLoadedOnce = false;

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    initCanvas();
    checkSession(); 
    if (typeof lucide !== 'undefined') lucide.createIcons();
    initGoogleLogin(); 
    initializeButtonListeners();
    updateMonthDisplay();
});

// FIX #5: Solo intentar init si no fue inicializado ya
window.addEventListener("load", () => {
    if (!googleInitialized) {
        if (window.google && google.accounts && google.accounts.id) {
            initGoogleLogin();
        } else {
            const interval = setInterval(() => {
                if (window.google && google.accounts && google.accounts.id) {
                    initGoogleLogin();
                    clearInterval(interval);
                }
            }, 500);
        }
    }
});

// FIX #3: Pausar animación de partículas cuando la pestaña no está visible
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (window.stopParticles) window.stopParticles();
    } else {
        // Solo reanudar si estamos en la landing (no en la app)
        if (document.getElementById('landingLayout').style.display !== 'none') {
            if (window.startParticles) window.startParticles();
        }
    }
});

function getGSIConfig() {
    return { theme: "outline", size: "large", type: "icon", shape: "square", logo_alignment: "center" };
}

// FIX #5: Guard con flag googleInitialized
function initGoogleLogin() {
    if (googleInitialized || typeof google === 'undefined') return;
    googleInitialized = true;
    google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleResponse, auto_select: false });
    const btnContainer = document.getElementById("google_btn_container");
    if (btnContainer) {
        btnContainer.innerHTML = `
            <div class="google-glow-wrapper">
                <div class="google-glow-bg"></div>
                <button class="google-glow-btn" id="customGoogleBtn" type="button">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20" height="20">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                        <path fill="none" d="M0 0h48v48H0z"/>
                    </svg>
                    <span>Sign in with Google</span>
                </button>
            </div>
        `;
        document.getElementById("customGoogleBtn").addEventListener("click", () => {
            google.accounts.id.prompt();
        });
    }
}

async function handleGoogleResponse(response) {
    if (currentUser) return; 
    try {
        const formData = new FormData();
        formData.append('credential', response.credential);
        formData.append('action', 'google_login'); 
        const res = await fetch(API_URL, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.status === 'success') {
            currentUser = data.username; 
            localStorage.setItem('currentUser', currentUser);
            checkSession(); 
        } else {
            showNotification(data.message || "Error al iniciar con Google", "error");
        }
    } catch (e) {
        showNotification("Error de conexión con Google", "error");
    }
}

function showAuthOnly() {
    document.getElementById('infoPanel').style.display = 'none';
    document.getElementById('authPanel').style.display = 'block';
    if(window.startParticles) window.startParticles();
}

function showInfoOnly() {
    document.getElementById('authPanel').style.display = 'none';
    document.getElementById('infoPanel').style.display = 'block';
    if(window.startParticles) window.startParticles();
}

// FIX #7: Reemplazar alert() por showNotification
function forgotPassword() {
    showNotification("Funcionalidad en desarrollo. Pronto disponible.", "secondary");
}

async function checkSession() {
    try {
        const res = await fetch(`${API_URL}?action=check_session`);
        const data = await res.json();
        if (data.status === 'logged_in') {
            currentUser = data.username;
            document.getElementById('landingLayout').style.display = 'none';
            document.getElementById('mainContent').style.display = 'block';
            if(window.stopParticles) window.stopParticles();
            initApp();
        } else {
            document.getElementById('landingLayout').style.display = 'flex';
            document.getElementById('mainContent').style.display = 'none';
            if(window.startParticles) window.startParticles();
            showAuthOnly(); 
        }
    } catch (e) {
        const pending = localStorage.getItem('pendingSyncData');
        if (pending) {
            const allUserData = JSON.parse(pending);
            cachedAllData = allUserData;
            currentUser = localStorage.getItem('currentUser') || "Usuario Local";

            const monthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
            const monthData = allUserData[monthKey] || { ingresos: { fijo: 0, extra: 0 }, gastos: [] };
            currentData.ingresos = monthData.ingresos;
            currentData.gastos = monthData.gastos;
            currentData.monedaBase = allUserData.global?.monedaBase || 'ars';
            currentData.monedaVisual = allUserData.global?.monedaVisual || 'usd';
            currentData.sheetUrl = allUserData.global?.sheetUrl || '';
            currentData.billetera = allUserData.global?.billetera || {};

            document.getElementById('landingLayout').style.display = 'none';
            document.getElementById('mainContent').style.display = 'block';
            if(window.stopParticles) window.stopParticles();
            initApp();
        } else {
            document.getElementById('landingLayout').style.display = 'flex';
            document.getElementById('mainContent').style.display = 'none';
            if(window.startParticles) window.startParticles();
            showAuthOnly();
        }
    }
}

function initApp() {
    document.getElementById('welcomeText').textContent = `Hola, ${currentUser}`;
    trySyncPendingData();
    loadData().then(() => {
        fetchSheetRates();
        showNotification(`Bienvenido, ${currentUser} 👋`);
    });
}

async function logout() {
    await fetch(`${API_URL}?action=logout`);
    currentUser = null;
    cachedAllData = null; // FIX #1: Limpiar caché al logout
    currentData = { ingresos: { fijo: 0, extra: 0 }, gastos: [], ahorroTotal: 0, metaAhorro: 0 };
    if (typeof google !== 'undefined' && google.accounts.id) google.accounts.id.disableAutoSelect();
    location.reload(); 
}

let isLoginMode = true;
function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    const title = document.getElementById('authTitle');
    const btn = document.getElementById('authButton');
    const toggleText = document.getElementById('toggleAuthText');
    const toggleLabel = document.querySelector('#authPanel p button');

    if (isLoginMode) {
        title.textContent = 'Bienvenido';
        btn.textContent = 'Entrar';
        toggleLabel.childNodes[0].nodeValue = "¿No tienes cuenta? ";
        toggleText.textContent = 'Regístrate';
    } else {
        title.textContent = 'Crear Cuenta';
        btn.textContent = 'Registrarme';
        toggleLabel.childNodes[0].nodeValue = "¿Ya tienes cuenta? ";
        toggleText.textContent = 'Ingresa';
    }
}

async function handleAuth(e, type) {
    if(e) e.preventDefault();
    const userIn = document.getElementById('username').value;
    const passIn = document.getElementById('password').value;
    if (!userIn || !passIn) { showNotification("Completa todos los campos", "error"); return; }

    const btn = document.getElementById('authButton');
    btn.disabled = true;
    btn.textContent = 'Cargando...';

    const formData = new FormData();
    formData.append('username', userIn);
    formData.append('password', passIn);
    formData.append('action', type); 

    try {
        const res = await fetch(API_URL, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.status === 'success') {
            currentUser = userIn;
            localStorage.setItem('currentUser', currentUser);
            checkSession(); 
        } else {
            showNotification(data.message || "Error en autenticación", "error");
            btn.disabled = false;
            btn.textContent = isLoginMode ? 'Entrar' : 'Registrarme';
        }
    } catch (error) {
        showNotification("Error de conexión", "error");
        btn.disabled = false;
        btn.textContent = isLoginMode ? 'Entrar' : 'Registrarme';
    }
}

function updateMonthDisplay() {
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const displayElement = document.getElementById('monthDisplay');
    if (displayElement) displayElement.textContent = `${monthNames[currentMonth - 1]} ${currentYear}`;
}

function navigateMonth(direction) {
    let newMonth = currentMonth + direction;
    let newYear = currentYear;
    if (newMonth < 1) { newMonth = 12; newYear -= 1; } 
    else if (newMonth > 12) { newMonth = 1; newYear += 1; }
    currentMonth = newMonth;
    currentYear = newYear;
    // Velocidad: si tenemos caché, cargar el mes directo sin GET al servidor
    if (cachedAllData) {
        loadMonthFromCache();
    } else {
        loadData();
    }
}

// Carga los datos del mes actual desde el caché local (instantáneo)
function loadMonthFromCache() {
    if (!cachedAllData) return loadData();
    updateMonthDisplay();

    const monthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    const monthData = cachedAllData[monthKey] || { ingresos: { fijo: 0, extra: 0 }, gastos: [] };

    currentData.ingresos = monthData.ingresos;
    currentData.gastos = monthData.gastos;

    updateUIConfig();
    updateDashboard();
    renderTable();
}

// --- GESTIÓN DE DATOS ---

// FIX #9: Spinner de carga global
function showLoadingSpinner() {
    if (document.getElementById('loadingOverlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.className = 'loading-overlay';
    overlay.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(overlay);
}
function hideLoadingSpinner() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.remove();
}

async function loadData() {
    if (!currentUser) return;
    showLoadingSpinner();
    try {
        const res = await fetch(`${API_URL}?action=get_data`);
        const result = await res.json();
        let allUserData = {};
        
        if (result.status === 'success') {
            allUserData = JSON.parse(result.data) || {};

            // FIX #1: Actualizar caché
            cachedAllData = allUserData;
            
            // Migración de datos viejos
            if (allUserData.global && typeof allUserData.global.ahorroTotal !== 'undefined' && !allUserData.global.billetera) {
                allUserData.global.billetera = {};
                const base = allUserData.global.monedaBase || 'ars';
                allUserData.global.billetera[base] = parseFloat(allUserData.global.ahorroTotal) || 0;
                delete allUserData.global.ahorroTotal;
            }

            currentData.monedaBase = allUserData.global?.monedaBase || 'ars';
            currentData.monedaVisual = allUserData.global?.monedaVisual || 'usd'; 
            currentData.sheetUrl = allUserData.global?.sheetUrl || '';
            currentData.billetera = allUserData.global?.billetera || {};

            const monthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
            let monthData = allUserData[monthKey] || { ingresos: { fijo: 0, extra: 0 }, gastos: [] };

            const actualDate = new Date(currentYear, currentMonth - 1, 1);
            let changesMade = false;

            // FIX #8: Limitar loop de recurrencia a los últimos 13 meses para no sobrecargar
            const allMonthKeys = Object.keys(allUserData)
                .filter(k => k.includes('-'))
                .sort()
                .slice(-13);

            for (const key of allMonthKeys) {
                const [prevYear, prevMonth] = key.split('-').map(Number);
                const prevDate = new Date(prevYear, prevMonth - 1, 1);

                if (prevDate < actualDate) {
                    allUserData[key].gastos.forEach(gastoRecurrente => {
                        if (gastoRecurrente.esRecurrente && gastoRecurrente.fecha) {
                            const duration = gastoRecurrente.recurrenceDuration || 1; 
                            const [creationYear, creationMonth] = gastoRecurrente.fecha.split('-').map(Number);
                            const stopDate = new Date(creationYear, creationMonth - 1 + duration, 1); 
                            
                            if (actualDate >= stopDate) return;
                            
                            const alreadyExists = monthData.gastos.some(g => g.idRecurrencia && g.idRecurrencia === gastoRecurrente.idRecurrencia);

                            if (!alreadyExists) {
                                const nuevoGasto = { ...gastoRecurrente };
                                nuevoGasto.isPaid = false; 
                                nuevoGasto.fecha = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`; 
                                nuevoGasto.esRecurrente = false; 
                                monthData.gastos.push(nuevoGasto);
                                changesMade = true;
                            }
                        }
                    });
                }
            }
            
            if (changesMade) {
                allUserData[monthKey] = monthData;
                cachedAllData = allUserData; // FIX #1: Sincronizar caché
                await saveData(allUserData); 
            }

            currentData.ingresos = monthData.ingresos;
            currentData.gastos = monthData.gastos;
            
        } else {
            currentData = { ingresos: { fijo: 0, extra: 0 }, gastos: [], monedaBase: 'ars', sheetUrl: '', billetera: {} };
        }
        
        updateUIConfig();
        updateDashboard();
        renderTable();
        updateMonthDisplay(); 

    } catch (e) {
        console.error("Error:", e);
    } finally {
        hideLoadingSpinner();
    }
}

async function saveData(allUserDataOverride = null) {
    if (!currentUser) return;

    let allUserData = allUserDataOverride;
    
    if (!allUserData) {
        // FIX #1: Usar caché en lugar de hacer GET al servidor
        allUserData = cachedAllData ? JSON.parse(JSON.stringify(cachedAllData)) : {};

        const monthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
        allUserData[monthKey] = {
            ingresos: currentData.ingresos,
            gastos: currentData.gastos
        };
        
        if (!allUserData.global) allUserData.global = {};
        allUserData.global.monedaBase = currentData.monedaBase;
        allUserData.global.monedaVisual = currentData.monedaVisual; 
        allUserData.global.sheetUrl = currentData.sheetUrl;
        allUserData.global.billetera = currentData.billetera;

        // FIX #1: Actualizar caché con los datos que acabamos de armar
        cachedAllData = allUserData;
    } else {
        cachedAllData = allUserData;
    }

    // FIX #2: Actualizar UI optimistamente (antes de confirmar el server)
    updateDashboard();
    renderTable();

    await pushDataToServer(allUserData);
}

// Envía el bloque completo de datos del usuario al servidor. Si falla (offline),
// lo deja guardado en localStorage para reintentar cuando vuelva la conexión,
// en vez de perderlo silenciosamente como antes.
async function pushDataToServer(allUserData) {
    try {
        const formData = new FormData();
        formData.append('data', JSON.stringify(allUserData));
        formData.append('action', 'save_data');
        const res = await fetch(API_URL, { method: 'POST', body: formData });
        const resp = await res.json();
        if (resp.status === 'success') {
            localStorage.removeItem('pendingSyncData');
        } else {
            showNotification("Error guardando", "error");
        }
    } catch (e) {
        localStorage.setItem('pendingSyncData', JSON.stringify(allUserData));
        showNotification("Sin conexión: se guardó en este dispositivo y se sincronizará solo cuando vuelva internet.", "secondary");
    }
}

// Reintenta enviar cambios pendientes apenas el navegador detecta que volvió la conexión
async function trySyncPendingData() {
    const pending = localStorage.getItem('pendingSyncData');
    if (pending && currentUser) {
        await pushDataToServer(JSON.parse(pending));
    }
}

window.addEventListener('online', trySyncPendingData);

// --- LÓGICA DE COTIZACIONES ---
async function fetchSheetRates() {
    const targetUrl = (currentData.sheetUrl && currentData.sheetUrl.trim() !== "") 
                      ? currentData.sheetUrl 
                      : DEFAULT_SHEET_URL;
    
    try {
        const formData = new FormData();
        formData.append('action', 'get_quotes');
        formData.append('url', targetUrl);

        const res = await fetch(API_URL, { method: 'POST', body: formData });
        const json = await res.json();

        if (json.status !== 'success') throw new Error(json.message);

        const text = json.data; 
        const lines = text.split('\n');
        
        exchangeRatesUSD = { 'usd': 1, 'ars': 0.0009, 'bitcoin': 90000 }; 
        let foundData = false;

        lines.forEach((line) => {
            const match = line.match(/^([^,]+),("([^"]+)"|([^,]+))/);

            if (match) {
                let key = match[1].replace(/['"\r]+/g, '').trim().toLowerCase();
                
                if (key === 'btc') key = 'bitcoin';
                if (key === 'eth') key = 'ethereum';
                if (key === 'usdt') key = 'tether';

                let valStr = match[3] || match[4];

                if (valStr) {
                    valStr = valStr.replace(',', '.');
                    valStr = valStr.replace(/[^0-9.]/g, '');
                    const val = parseFloat(valStr);
                    
                    if (!isNaN(val)) {
                        exchangeRatesUSD[key] = val; 
                        foundData = true;
                    }
                }
            }
        });

        if (foundData) {
            console.log("📈 Cotizaciones cargadas correctamente:", exchangeRatesUSD);
            updateDashboard();
            // FIX #11: Solo notificar la primera vez que se cargan cotizaciones
            if (!ratesLoadedOnce) {
                showNotification("Precios de mercado actualizados", "success");
                ratesLoadedOnce = true;
            }
        } else {
            console.warn("CSV descargado pero no se detectaron filas válidas.");
        }

    } catch(e) {
        console.error("Error aplicando cotizaciones:", e);
        showNotification("Usando precios offline (Respaldo)", "secondary");
    }
}

// Helper para convertir entre monedas usando el pivote USD
function convertCurrency(amount, fromCurr, toCurr) {
    const valOrigenEnUSD = exchangeRatesUSD[fromCurr] || 0; 
    const valDestinoEnUSD = exchangeRatesUSD[toCurr] || 1;
    
    if (valOrigenEnUSD === 0 || valDestinoEnUSD === 0) return 0;
    
    return (amount * valOrigenEnUSD) / valDestinoEnUSD;
}

// --- RECURRENCIA ---
async function getAllDataRaw() {
    // FIX #1: Usar caché si está disponible
    if (cachedAllData) return JSON.parse(JSON.stringify(cachedAllData));
    try {
        const res = await fetch(`${API_URL}?action=get_data`);
        const result = await res.json();
        const data = result.status === 'success' ? JSON.parse(result.data) : {};
        cachedAllData = data;
        return data;
    } catch(e) {
        return {};
    }
}

async function forkRecurrence(gastoOriginal, nuevoGasto) {
    const allData = await getAllDataRaw();
    const idRecurrencia = gastoOriginal.idRecurrencia;
    const currentMonthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    
    for (const key in allData) {
        if (!key.includes('-')) continue;
        const [y, m] = key.split('-').map(Number);
        const monthDate = new Date(y, m - 1, 1);
        const currentDate = new Date(currentYear, currentMonth - 1, 1);
        
        if (monthDate >= currentDate) {
            const gastosMes = allData[key].gastos;
            const indexToEdit = gastosMes.findIndex(g => g.idRecurrencia === idRecurrencia);
            if (indexToEdit !== -1) {
                gastosMes[indexToEdit] = { ...nuevoGasto, fecha: `${y}-${String(m).padStart(2, '0')}-01` };
            }
        }
    }
    
    await saveData(allData);
    loadData();
}

// --- TRANSFERENCIAS MULTIMONEDA ---
function setTransferType(type) {
    transferType = type;
    const tabDeposito = document.getElementById('tabDeposito');
    const tabRetiro = document.getElementById('tabRetiro');
    const lblAction = document.getElementById('lblActionVerb');
    const lblAmount = document.getElementById('lblTransferAmount');
    const lblImpacto = document.getElementById('lblImpactoTitle');
    
    if (type === 'deposito') {
        tabDeposito.style.background = 'var(--primary)';
        tabDeposito.style.color = 'white';
        tabRetiro.style.background = 'transparent';
        tabRetiro.style.border = '1px solid var(--glass-border)';
        lblAction.textContent = 'guardar';
        lblAmount.textContent = 'Cantidad a depositar';
        lblImpacto.textContent = `Monto a restar de tu Caja (${currentData.monedaBase.toUpperCase()})`;
    } else {
        tabDeposito.style.background = 'transparent';
        tabDeposito.style.border = '1px solid var(--glass-border)';
        tabRetiro.style.background = 'var(--primary)';
        tabRetiro.style.color = 'white';
        lblAction.textContent = 'retirar';
        lblAmount.textContent = 'Cantidad a retirar';
        lblImpacto.textContent = `Monto a sumar a tu Caja (${currentData.monedaBase.toUpperCase()})`;
    }
    
    calcularImpacto();
}

function calcularImpacto() {
    const moneda = document.getElementById('transferMoneda').value;
    const cantidad = parseFloat(document.getElementById('transferCantidad').value) || 0;
    const base = currentData.monedaBase;
    
    let cotizacion = exchangeRatesUSD[moneda] / exchangeRatesUSD[base];
    
    let impacto = cantidad * cotizacion;
    if (transferType === 'retiro') impacto = -impacto;
    
    document.getElementById('transferImpacto').value = Math.abs(impacto).toFixed(2);
    document.getElementById('lblCotizacionDisplay').textContent = `1${moneda.toUpperCase()} = ${formatNumber(cotizacion, 2)} ${base.toUpperCase()}`;
}

function ejecutarTransferencia() {
    const moneda = document.getElementById('transferMoneda').value;
    const cantidad = parseFloat(document.getElementById('transferCantidad').value);
    let impacto = parseFloat(document.getElementById('transferImpacto').value);
    
    if (isNaN(cantidad) || cantidad <= 0) {
        showNotification("Ingresa una cantidad válida", "error");
        return;
    }
    
    if (transferType === 'retiro') impacto = -impacto;
    
    if (transferType === 'deposito') {
        currentData.billetera[moneda] = (currentData.billetera[moneda] || 0) + cantidad;
        
        if (impacto < 0) {
            currentData.ingresos.extra = (parseFloat(currentData.ingresos.extra) || 0) + Math.abs(impacto);
        } else {
            currentData.gastos.push({
                descripcion: `Compra ${moneda.toUpperCase()}`,
                monto: impacto,
                categoria: 'Inversión',
                fecha: new Date().toISOString().split('T')[0],
                esRecurrente: false,
                isPaid: true 
            });
        }
    } else {
        if ((currentData.billetera[moneda] || 0) < cantidad) {
            showNotification("Saldo insuficiente en " + moneda.toUpperCase(), "error");
            return;
        }
        currentData.billetera[moneda] -= cantidad;
        
        if (impacto > 0) {
            currentData.ingresos.extra = (parseFloat(currentData.ingresos.extra) || 0) + impacto;
        }
    }

    saveData();
    closeModal('modalTransfer');
    showNotification("Movimiento registrado");
}

// --- CONFIGURACIÓN ---
function guardarConfig() {
    currentData.monedaBase = document.getElementById('configMonedaBase').value;
    currentData.monedaVisual = document.getElementById('configMonedaVisual').value;
    
    document.querySelectorAll('.input-saldo-manual').forEach(inp => {
        const m = inp.dataset.moneda;
        const v = parseFloat(inp.value);
        if (!isNaN(v)) currentData.billetera[m] = v;
    });

    saveData();
    fetchSheetRates(); 
    closeModal('modalConfig');
    updateUIConfig();
    showNotification("Configuración guardada");
}

function toggleSaldosManuales() {
    const panel = document.getElementById('panelSaldosManuales');
    panel.innerHTML = ''; 
    
    const monedas = Object.keys(currentData.billetera);
    
    if (monedas.length === 0) {
        panel.innerHTML = '<small style="color:#94a3b8;">No tienes activos guardados aún.</small>';
    }

    monedas.forEach(m => {
        const val = currentData.billetera[m];
        const div = document.createElement('div');
        div.style.cssText = "display:flex; align-items:center; gap:10px; margin-bottom:5px;";
        div.innerHTML = `
            <label style="width:60px; margin:0; font-size:0.8rem;">${m.toUpperCase()}</label>
            <input type="number" class="input-saldo-manual" data-moneda="${m}" value="${val}" step="any" style="margin:0; padding:5px; flex:1;">
            <button onclick="eliminarMoneda('${m}')" class="btn-icon-only btn-delete" aria-label="Eliminar activo ${m.toUpperCase()}"><i data-lucide="trash-2"></i></button>
        `;
        panel.appendChild(div);
    });
    lucide.createIcons();
}

function eliminarMoneda(moneda) {
    if (confirm(`¿Eliminar el activo ${moneda.toUpperCase()}?`)) {
        delete currentData.billetera[moneda];
        toggleSaldosManuales();
        saveData();
        showNotification("Activo eliminado");
    }
}

function agregarMonedaManual() {
    const select = document.getElementById('selectNuevaMoneda');
    const moneda = select.value;
    if (!moneda) return;

    if (!currentData.billetera[moneda]) {
        currentData.billetera[moneda] = 0;
    }
    toggleSaldosManuales();
}

// --- HELPERS VISUALES ---
// Formatea números: sin decimales para monedas fiat, 8 para crypto
function formatNumber(n, decimals = 0) {
    if (n == null || isNaN(n)) return "0";
    // Crypto: siempre con 8 decimales si es muy pequeño
    if (decimals === 8 || (Math.abs(n) > 0 && Math.abs(n) < 0.01)) {
        return n.toLocaleString('es-AR', { minimumFractionDigits: 8, maximumFractionDigits: 8 });
    }
    // Fiat: sin decimales, redondeado
    return Math.round(n).toLocaleString('es-AR');
}

function formatMoney(n, curr) { 
    const symbols = {
        'ars': '$',
        'usd': 'US$',
        'eur': '€',
        'uyu': '$U'
    };
    const isCrypto = ['bitcoin', 'ethereum', 'tether'].includes(curr);
    const formatted = isCrypto ? formatNumber(n, 8) : formatNumber(Math.round(n));
    return (symbols[curr] || '$') + ' ' + formatted; 
}

function formatDate(dateStr) { const [y, m, d] = dateStr.split('-'); return `${d}/${m}`; }

// Escapa HTML para evitar que una descripción/categoría con < > & " ' se interprete como markup (XSS)
function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function formatCurrency(amount) { 
    const base = currentData.monedaBase || 'ars';
    return formatMoney(amount, base);
}

// --- FUNCIONES UI BÁSICAS ---
function renderTable() {
    const tbody = document.getElementById('listaGastos');
    tbody.innerHTML = '';

    const hayGastosVisibles = currentData.gastos && currentData.gastos.some(g => !g.isDeleted);

    if (!hayGastosVisibles) {
        document.getElementById('emptyState').style.display = 'block';
        return;
    }
    document.getElementById('emptyState').style.display = 'none';
    
    const gastosAMostrar = currentData.gastos
        .map((g, i) => ({ ...g, originalIndex: i }))
        .filter(g => !g.isDeleted);

    gastosAMostrar.sort((a, b) => {
        let vA, vB;
        if (tableSortCol === 'monto') {
            vA = a.monto || 0; vB = b.monto || 0;
            return (vA - vB) * tableSortDir;
        } else if (tableSortCol === 'fecha') {
            vA = a.fecha || ''; vB = b.fecha || '';
            return vA.localeCompare(vB) * tableSortDir;
        } else if (tableSortCol === 'categoria') {
            vA = (a.categoria || '').toLowerCase(); vB = (b.categoria || '').toLowerCase();
            return vA.localeCompare(vB) * tableSortDir;
        } else { // descripcion (default)
            vA = (a.descripcion || '').toLowerCase(); vB = (b.descripcion || '').toLowerCase();
            return vA.localeCompare(vB) * tableSortDir;
        }
    });

    gastosAMostrar.forEach((g) => {
        const tr = document.createElement('tr');
        const isRecurrenteItem = g.esRecurrente || g.idRecurrencia;
        const recurrenteIcon = isRecurrenteItem ? `<i data-lucide="repeat" style="width:14px; margin-left:5px; color:var(--primary);"></i>` : '';

        tr.className = g.isPaid ? 'paid-row' : '';
        // Escapado para uso dentro del atributo onclick (comillas simples del handler inline)
        const descEscapadaAttr = (g.descripcion || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        tr.innerHTML = `
            <td>${formatDate(g.fecha)}</td>
            <td><div style="font-weight:600;">${escapeHtml(g.descripcion)} ${recurrenteIcon}</div></td>
            <td><span style="font-size:0.9rem;">${escapeHtml(g.categoria)}</span></td>
            <td style="font-weight:bold; color: ${g.isPaid ? 'var(--secondary)' : 'var(--text-main)'};">${formatCurrency(g.monto || 0)}</td>
            <td style="text-align:right;">
                <button class="btn-action-edit" onclick="openActionModal(${g.originalIndex}, '${descEscapadaAttr}', ${g.isPaid ? 'true' : 'false'})" title="Acciones" aria-label="Acciones para ${escapeHtml(g.descripcion)}">
                    <i data-lucide="pencil-line"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Modal central de acciones (reemplaza al dropdown)
function openActionModal(index, descripcion, isPaid) {
    // Cerrar si ya existe
    closeActionModal();

    const overlay = document.createElement('div');
    overlay.id = 'actionModalOverlay';
    overlay.className = 'action-modal-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) closeActionModal(); };

    const paid = isPaid === true || isPaid === 'true';
    const payLabel = paid ? 'Desmarcar pagado' : 'Marcar como pagado';
    const payIcon  = paid ? 'circle-x' : 'circle-check';
    const payColor = paid ? '#94a3b8' : '#10b981';

    overlay.innerHTML = `
        <div class="action-modal-card">
            <div class="action-modal-title">${escapeHtml(descripcion)}</div>
            <div class="action-modal-buttons">
                <button class="action-modal-btn" onclick="editGasto(${index}); closeActionModal();">
                    <span class="action-modal-icon" style="background:rgba(59,130,246,0.15); color:#60a5fa;">
                        <i data-lucide="pencil"></i>
                    </span>
                    <span>Editar</span>
                </button>
                <button class="action-modal-btn" onclick="toggleGastoPaidStatus(${index});">
                    <span class="action-modal-icon" style="background:rgba(16,185,129,0.15); color:${payColor};">
                        <i data-lucide="${payIcon}"></i>
                    </span>
                    <span>${payLabel}</span>
                </button>
                <button class="action-modal-btn action-modal-btn--danger" onclick="deleteGasto(${index}); closeActionModal();">
                    <span class="action-modal-icon" style="background:rgba(239,68,68,0.15); color:#ef4444;">
                        <i data-lucide="trash-2"></i>
                    </span>
                    <span>Eliminar</span>
                </button>
            </div>
            <button class="action-modal-cancel" onclick="closeActionModal()">Cancelar</button>
        </div>
    `;

    document.body.appendChild(overlay);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeActionModal() {
    const overlay = document.getElementById('actionModalOverlay');
    if (overlay) overlay.remove();
}

// Ordenar tabla al hacer click en encabezado
function sortTable(col) {
    if (tableSortCol === col) {
        tableSortDir *= -1; // invertir si es la misma columna
    } else {
        tableSortCol = col;
        tableSortDir = 1;
    }
    renderTable();
    // Actualizar indicadores visuales en los th
    document.querySelectorAll('.modern-table th[data-sort]').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.dataset.sort === col) {
            th.classList.add(tableSortDir === 1 ? 'sort-asc' : 'sort-desc');
        }
    });
}

// FIX #4: Un solo lugar de listeners, sin onclick duplicado en el HTML
function initializeButtonListeners() {
    document.getElementById('btnGuardarGasto').addEventListener('click', handleSaveGasto);
    document.getElementById('btnGuardarIngresos').addEventListener('click', handleSaveIngresos);
    
    // FIX #10: Usar la variable isLoginMode en lugar de leer textContent del botón
    document.getElementById('authButton').addEventListener('click', (e) => {
        handleAuth(e, isLoginMode ? 'login' : 'register');
    });
}

async function handleSaveGasto() {
    const desc = document.getElementById('descGasto').value;
    const monto = parseFloat(document.getElementById('montoGasto').value);
    const cat = document.getElementById('catGasto').value;
    const fechaInput = document.getElementById('fechaGasto').value; 
    const editIdx = document.getElementById('editIndex').value;
    const esRecurrente = document.getElementById('recurrenteCheck').checked;
    const mesesRecurrentes = parseInt(document.getElementById('mesesRecurrentes').value) || 1; 

    if (!desc || isNaN(monto) || !fechaInput) { showNotification("Faltan datos", "error"); return; }

    // FIX #9: Deshabilitar botón mientras se guarda
    const btn = document.getElementById('btnGuardarGasto');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    const nuevoGasto = {
        descripcion: desc, monto: monto, categoria: cat || 'Varios',
        fecha: fechaInput, esRecurrente: esRecurrente, 
        idRecurrencia: esRecurrente ? (currentData.gastos[editIdx]?.idRecurrencia || Date.now()) : null,
        isPaid: false, recurrenceDuration: esRecurrente ? mesesRecurrentes : 0 
    };

    if (editIdx !== "") {
        const gastoOriginal = currentData.gastos[editIdx];
        if (gastoOriginal.idRecurrencia) {
             await forkRecurrence(gastoOriginal, nuevoGasto);
             closeModal('modalGasto');
             btn.disabled = false;
             btn.textContent = 'Guardar';
             return; 
        } else {
            currentData.gastos[editIdx] = nuevoGasto;
        }
    } else {
        currentData.gastos.push(nuevoGasto);
    }
    await saveData();
    closeModal('modalGasto');
    showNotification("Gasto guardado");
    btn.disabled = false;
    btn.textContent = 'Guardar';
}

function editGasto(index) {
    const g = currentData.gastos[index];
    document.getElementById('descGasto').value = g.descripcion;
    document.getElementById('montoGasto').value = g.monto;
    document.getElementById('catGasto').value = g.categoria;
    document.getElementById('fechaGasto').value = g.fecha;
    document.getElementById('editIndex').value = index;
    const isRecur = g.esRecurrente || (g.idRecurrencia ? true : false);
    document.getElementById('recurrenteCheck').checked = isRecur;
    document.getElementById('recurrenteOptions').style.display = isRecur ? 'block' : 'none';
    document.getElementById('mesesRecurrentes').value = g.recurrenceDuration || 3; 
    document.getElementById('tituloModalGasto').textContent = "Editar Gasto";
    openModal('modalGasto');
}

// FIX #6: Eliminar sin confirm(), usar el Undo como red de seguridad
function deleteGasto(index) {
    lastDeletedGasto = { index: index, gasto: JSON.parse(JSON.stringify(currentData.gastos[index])) };
    
    const gasto = currentData.gastos[index];

    if (gasto.idRecurrencia || gasto.esRecurrente) {
        gasto.isDeleted = true;
        gasto.monto = 0;
        gasto.isPaid = false;
    } else {
        currentData.gastos.splice(index, 1);
    }
    
    saveData();

    const undoButtonHtml = `<button class="btn-undo" onclick="undoDeleteGasto()">Deshacer</button>`;
    showNotification("Eliminado", "undo", undoButtonHtml);
    
    if (deleteTimeout) clearTimeout(deleteTimeout);
    deleteTimeout = setTimeout(() => { 
        lastDeletedGasto = null; 
        document.querySelectorAll('.notification.undo').forEach(n => n.remove()); 
    }, 8000); 
}

function undoDeleteGasto() {
    if (lastDeletedGasto) {
        currentData.gastos.splice(lastDeletedGasto.index, 0, lastDeletedGasto.gasto);
        saveData();
        document.querySelectorAll('.notification.undo').forEach(n => n.remove());
        lastDeletedGasto = null;
        showNotification("Recuperado");
    }
}

function toggleGastoPaidStatus(index) {
    const gasto = currentData.gastos[index];
    if (!gasto) return;
    gasto.isPaid = !gasto.isPaid;
    closeActionModal();
    saveData();
    showNotification(gasto.isPaid ? "Marcado como pagado" : "Marcado como pendiente");
}

function handleSaveIngresos() {
    const fijo = parseFloat(document.getElementById('ingresoFijo').value) || 0;
    const extra = parseFloat(document.getElementById('ingresoExtra').value) || 0;
    currentData.ingresos.fijo = fijo;
    currentData.ingresos.extra = extra;
    saveData();
    closeModal('modalIngresos');
    showNotification("Ingresos actualizados");
}

function applyRollover(action) {
    const amount = parseFloat(document.getElementById('montoRolloverInput').value) || 0;
    if (action === 'caja') currentData.ingresos.extra = (parseFloat(currentData.ingresos.extra) || 0) + amount;
    else if (action === 'ahorro') {
        const base = currentData.monedaBase;
        currentData.billetera[base] = (currentData.billetera[base] || 0) + amount;
    }
    saveData();
    closeModal('modalRollover');
    showNotification("Saldo aplicado correctamente");
}

function openModal(id) {
    if (id === 'modalIngresos') {
        document.getElementById('ingresoFijo').value = currentData.ingresos.fijo || '';
        document.getElementById('ingresoExtra').value = currentData.ingresos.extra || '';
    }
    if (id === 'modalGasto' && document.getElementById('tituloModalGasto').textContent !== "Editar Gasto") {
        document.getElementById('descGasto').value = '';
        document.getElementById('montoGasto').value = '';
        document.getElementById('catGasto').value = '';
        document.getElementById('fechaGasto').value = new Date().toISOString().split('T')[0];
        document.getElementById('editIndex').value = "";
        document.getElementById('recurrenteCheck').checked = false;
        document.getElementById('recurrenteOptions').style.display = 'none';
        document.getElementById('mesesRecurrentes').value = 3; 
    }
    if (id === 'modalConfig') {
        document.getElementById('configMonedaBase').value = currentData.monedaBase;
        document.getElementById('configMonedaVisual').value = currentData.monedaVisual || 'usd';
        toggleSaldosManuales();
    }
    if (id === 'modalTransfer') {
        setTransferType('deposito');
    }

    document.getElementById(id).style.display = 'flex';
}

function closeModal(id) { 
    document.getElementById(id).style.display = 'none'; 
    if (id === 'modalGasto') document.getElementById('tituloModalGasto').textContent = "Registrar Gasto"; 
}

window.onclick = function(event) { 
    if (event.target.classList.contains('modal-overlay')) event.target.style.display = "none"; 
}

// === PARTICULAS OPTIMIZADAS ===
let particleAnimationId = null;

function initCanvas() {
    const canvas = document.getElementById('backgroundCanvas');
    const ctx = canvas.getContext('2d');
    let width, height, particles = [];
    
    function resize() { width = window.innerWidth; height = window.innerHeight; canvas.width = width; canvas.height = height; }
    class Particle {
        constructor() { this.x = Math.random()*width; this.y = Math.random()*height; this.vx = (Math.random()-0.5)*0.8; this.vy = (Math.random()-0.5)*0.8; this.size = Math.random()*2.5+0.5; this.alpha = Math.random()*0.6+0.1; }
        update() { this.x += this.vx; this.y += this.vy; if (this.x<0) this.x=width; if(this.x>width) this.x=0; if(this.y<0) this.y=height; if(this.y>height) this.y=0; }
        draw() { ctx.fillStyle = `rgba(59, 130, 246, ${this.alpha})`; ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI*2); ctx.fill(); }
    }
    
    function initParticles() { particles = []; for(let i=0; i<80; i++) particles.push(new Particle()); }
    
    function animate() { 
        ctx.clearRect(0,0,width,height); 
        particles.forEach(p=>{p.update();p.draw();}); 
        particleAnimationId = requestAnimationFrame(animate); 
    }
    
    window.addEventListener('resize', resize); 
    resize(); 
    initParticles();
    
    window.startParticles = function() {
        if (!particleAnimationId) {
            canvas.style.display = 'block';
            animate();
        }
    };
    
    window.stopParticles = function() {
        if (particleAnimationId) {
            cancelAnimationFrame(particleAnimationId);
            particleAnimationId = null;
            ctx.clearRect(0,0,width,height);
            canvas.style.display = 'none'; 
        }
    };
    window.startParticles();
}

// Mapa de íconos Lucide por tipo de notificación
const NOTIF_ICONS = {
    success:   'circle-check',
    error:     'circle-x',
    undo:      'rotate-ccw',
    secondary: 'info',
};

function showNotification(message, type = 'success', extraHtml = '') {
    const container = document.getElementById('notification-container');
    if (!container) return;

    // Eliminar notificaciones anteriores del mismo tipo (no apilar duplicados)
    container.querySelectorAll(`.notification.${type}`).forEach(n => n.remove());

    const icon = NOTIF_ICONS[type] || 'circle-check';

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="notif-icon" data-lucide="${icon}"></i>
        <span class="notif-msg">${message}</span>
        ${extraHtml ? `<div>${extraHtml}</div>` : ''}
    `;

    container.appendChild(notification);
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Las notificaciones de undo no se auto-eliminan (se quedan hasta que el user actúe)
    if (type !== 'undo') {
        const timeout = setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(-8px) scale(0.96)';
            setTimeout(() => notification.remove(), 400);
        }, 5000);
        // Pausar el timer si el usuario pone el mouse encima
        notification.addEventListener('mouseenter', () => clearTimeout(timeout));
        notification.addEventListener('mouseleave', () => {
            setTimeout(() => {
                notification.style.opacity = '0';
                notification.style.transform = 'translateY(-8px) scale(0.96)';
                setTimeout(() => notification.remove(), 400);
            }, 1500);
        });
    }
}

function updateDashboard() {
    const ingresosTotal = parseFloat(currentData.ingresos.fijo) + parseFloat(currentData.ingresos.extra);
    const gastosPagados = currentData.gastos.reduce((sum, g) => sum + (g.isPaid && !g.isDeleted ? g.monto : 0), 0);
    const gastosPendientes = currentData.gastos.reduce((sum, g) => sum + (!g.isPaid && !g.isDeleted ? g.monto : 0), 0);
    const disponible = ingresosTotal - gastosPagados - gastosPendientes;

    document.getElementById('displayIngresos').textContent = `+${formatCurrency(ingresosTotal)}`;
    document.getElementById('displayGastos').textContent = `-${formatCurrency(gastosPagados + gastosPendientes)}`;
    document.getElementById('displayBalanceMes').textContent = formatCurrency(ingresosTotal - (gastosPagados + gastosPendientes));
    document.getElementById('displayDisponible').textContent = formatCurrency(disponible);
    document.getElementById('displayArrastre').textContent = `Pendientes: -${formatCurrency(gastosPendientes)}`;

    let ahorroTotal = 0;
    let detalleAhorros = '';
    for (const [moneda, saldo] of Object.entries(currentData.billetera)) {
        if (saldo > 0) {
            const valorEnVisual = convertCurrency(saldo, moneda, currentData.monedaVisual);
            ahorroTotal += valorEnVisual;
            detalleAhorros += `${moneda.toUpperCase()}: ${formatNumber(saldo, moneda === 'bitcoin' || moneda === 'ethereum' ? 8 : 2)}\n`;
        }
    }
    document.getElementById('displayAhorroTotal').textContent = formatMoney(ahorroTotal, currentData.monedaVisual);
    document.getElementById('displayDetalleAhorros').textContent = detalleAhorros || 'Sin ahorros registrados';

    document.querySelectorAll('.lblMonedaBase').forEach(el => el.textContent = currentData.monedaBase.toUpperCase());
    document.getElementById('lblMonedaVisual').textContent = currentData.monedaVisual.toUpperCase();
}

function updateUIConfig() {
    const selectTransfer = document.getElementById('transferMoneda');
    selectTransfer.innerHTML = '';
    Object.keys(exchangeRatesUSD).forEach(m => {
        if (m !== currentData.monedaBase) {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m.toUpperCase();
            selectTransfer.appendChild(opt);
        }
    });
    calcularImpacto();
    updateDashboard();
}