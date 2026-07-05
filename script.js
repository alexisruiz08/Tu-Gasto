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
    billetera: {},
    presupuestos: {}
};

// FIX #1: Caché de todos los datos del usuario para evitar doble GET en saveData
let cachedAllData = null;

// Catálogo de activos soportados (todos los que trae la hoja de cotizaciones).
// "ticker" es lo que se muestra en la UI (billetera, selects, resumen), en vez
// del nombre interno crudo (ej: "bitcoin" -> "BTC").
const ASSET_INFO = {
    usd:      { nombre: 'Dólar (USD)',            ticker: 'USD',  tipo: 'fiat' },
    eur:      { nombre: 'Euro (EUR)',              ticker: 'EUR',  tipo: 'fiat' },
    ars:      { nombre: 'Peso Argentino (ARS)',    ticker: 'ARS',  tipo: 'fiat' },
    uyu:      { nombre: 'Peso Uruguayo (UYU)',     ticker: 'UYU',  tipo: 'fiat' },
    brl:      { nombre: 'Real Brasileño (BRL)',    ticker: 'BRL',  tipo: 'fiat' },
    clp:      { nombre: 'Peso Chileno (CLP)',      ticker: 'CLP',  tipo: 'fiat' },
    cop:      { nombre: 'Peso Colombiano (COP)',   ticker: 'COP',  tipo: 'fiat' },
    mxn:      { nombre: 'Peso Mexicano (MXN)',     ticker: 'MXN',  tipo: 'fiat' },
    pen:      { nombre: 'Sol Peruano (PEN)',       ticker: 'PEN',  tipo: 'fiat' },
    gbp:      { nombre: 'Libra Esterlina (GBP)',   ticker: 'GBP',  tipo: 'fiat' },
    bitcoin:  { nombre: 'Bitcoin (BTC)',           ticker: 'BTC',  tipo: 'cripto' },
    ethereum: { nombre: 'Ethereum (ETH)',          ticker: 'ETH',  tipo: 'cripto' },
    tether:   { nombre: 'Tether (USDT)',           ticker: 'USDT', tipo: 'cripto' },
    bnb:      { nombre: 'BNB (BNB)',               ticker: 'BNB',  tipo: 'cripto' },
    cardano:  { nombre: 'Cardano (ADA)',           ticker: 'ADA',  tipo: 'cripto' },
    litecoin: { nombre: 'Litecoin (LTC)',          ticker: 'LTC',  tipo: 'cripto' },
    polkadot: { nombre: 'Polkadot (DOT)',          ticker: 'DOT',  tipo: 'cripto' },
    solana:   { nombre: 'Solana (SOL)',            ticker: 'SOL',  tipo: 'cripto' },
    xrp:      { nombre: 'XRP (XRP)',               ticker: 'XRP',  tipo: 'cripto' },
};

// Símbolos de moneda fiat para formatMoney() (las cripto se muestran con su ticker, ej "0.00050000 BTC")
const FIAT_SYMBOLS = { usd: 'US$', eur: '€', ars: '$', uyu: '$U', brl: 'R$', clp: '$', cop: '$', mxn: '$', pen: 'S/', gbp: '£' };

function getAssetTicker(key) { return ASSET_INFO[key]?.ticker || String(key).toUpperCase(); }
function isAssetCripto(key) { return ASSET_INFO[key]?.tipo === 'cripto'; }

// Cotizaciones de Respaldo (snapshot real, se usa solo si falla el fetch a la hoja de cálculo)
let exchangeRatesUSD = {
    ars: 0.0006699242852,
    bitcoin: 62716,
    bnb: 587.241266,
    brl: 0.1934235977,
    cardano: 0.18908874,
    clp: 0.001080360218,
    cop: 0.0002976725002,
    ethereum: 1779.8881,
    eur: 1.1442,
    gbp: 1.33905001,
    litecoin: 45.6201,
    mxn: 0.05723240132,
    pen: 0.293792229,
    polkadot: 0.8815,
    solana: 80.9355,
    tether: 1,
    usd: 1,
    uyu: 0.02485555814,
    xrp: 1.134,
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

// Estado del buscador/filtro de la tabla de Movimientos
let tableFilterText = '';
let tableFilterCategoria = '';

// Categorías cuyo presupuesto ya avisamos que se superó en esta sesión (evita spam de notificaciones)
let presupuestosAvisados = new Set();

// Evita mostrar el recordatorio de recurrentes pendientes más de una vez por carga de mes
let recordatorioMostradoParaMes = null;

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
            currentData.presupuestos = allUserData.global?.presupuestos || {};

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
        checkRecordatorioRecurrentes();
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
    checkRecordatorioRecurrentes();
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
            currentData.presupuestos = allUserData.global?.presupuestos || {};

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
            currentData = { ingresos: { fijo: 0, extra: 0 }, gastos: [], monedaBase: 'ars', sheetUrl: '', billetera: {}, presupuestos: {} };
        }

        updateUIConfig();
        updateDashboard();
        renderTable();
        updateMonthDisplay();
        checkRecordatorioRecurrentes();

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
        allUserData.global.presupuestos = currentData.presupuestos;

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

        // No reseteamos exchangeRatesUSD: si una moneda no viene en esta lectura puntual
        // de la hoja, conserva el último valor conocido en vez de desaparecer.
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
    document.getElementById('lblCotizacionDisplay').textContent = `1 ${getAssetTicker(moneda)} = ${formatNumber(cotizacion, 2)} ${base.toUpperCase()}`;
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
                descripcion: `Compra ${getAssetTicker(moneda)}`,
                monto: impacto,
                categoria: 'Inversión',
                fecha: new Date().toISOString().split('T')[0],
                esRecurrente: false,
                isPaid: true 
            });
        }
    } else {
        if ((currentData.billetera[moneda] || 0) < cantidad) {
            showNotification("Saldo insuficiente en " + getAssetTicker(moneda), "error");
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
        return;
    }

    // Agrupamos Fiat y Cripto por separado, y ordenamos alfabéticamente por ticker
    // dentro de cada grupo, para que la lista sea fácil de escanear con muchos activos.
    const fiat = monedas.filter(m => !isAssetCripto(m)).sort((a, b) => getAssetTicker(a).localeCompare(getAssetTicker(b)));
    const cripto = monedas.filter(m => isAssetCripto(m)).sort((a, b) => getAssetTicker(a).localeCompare(getAssetTicker(b)));

    const renderGrupo = (titulo, lista) => {
        if (lista.length === 0) return '';
        const filas = lista.map(m => {
            const val = currentData.billetera[m];
            return `
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:5px;">
                    <label style="width:60px; margin:0; font-size:0.8rem;" title="${escapeHtml(ASSET_INFO[m]?.nombre || m)}">${getAssetTicker(m)}</label>
                    <input type="number" class="input-saldo-manual" data-moneda="${m}" value="${val}" step="any" style="margin:0; padding:5px; flex:1;">
                    <button onclick="eliminarMoneda('${m}')" class="btn-icon-only btn-delete" aria-label="Eliminar activo ${getAssetTicker(m)}"><i data-lucide="trash-2"></i></button>
                </div>
            `;
        }).join('');
        return `<div style="font-size:0.7rem; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em; margin:8px 0 4px;">${titulo}</div>${filas}`;
    };

    panel.innerHTML = renderGrupo('Monedas', fiat) + renderGrupo('Criptomonedas', cripto);
    lucide.createIcons();

    populateSelectNuevaMoneda();
}

// Llena "+ Agregar otro activo..." con todo el catálogo disponible, agrupado en
// Monedas/Criptomonedas, excluyendo los activos que ya están en la billetera.
function populateSelectNuevaMoneda() {
    const select = document.getElementById('selectNuevaMoneda');
    if (!select) return;

    const yaAgregadas = new Set(Object.keys(currentData.billetera));
    const disponibles = Object.keys(ASSET_INFO).filter(k => !yaAgregadas.has(k));

    const armarOptions = (tipo) => disponibles
        .filter(k => ASSET_INFO[k].tipo === tipo)
        .sort((a, b) => ASSET_INFO[a].ticker.localeCompare(ASSET_INFO[b].ticker))
        .map(k => `<option value="${k}">${escapeHtml(ASSET_INFO[k].nombre)}</option>`)
        .join('');

    select.innerHTML = '<option value="">+ Agregar otro activo...</option>' +
        `<optgroup label="Monedas">${armarOptions('fiat')}</optgroup>` +
        `<optgroup label="Criptomonedas">${armarOptions('cripto')}</optgroup>`;
}

function eliminarMoneda(moneda) {
    if (confirm(`¿Eliminar el activo ${getAssetTicker(moneda)}?`)) {
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
    // Cripto: se muestra el monto seguido del ticker (ej "0.00050000 BTC"), nunca con
    // símbolo de moneda fiat, para no confundir "$" con un valor que no es peso ni dólar.
    if (isAssetCripto(curr)) {
        return `${formatNumber(n, 8)} ${getAssetTicker(curr)}`;
    }
    const formatted = formatNumber(Math.round(n));
    return (FIAT_SYMBOLS[curr] || '$') + ' ' + formatted;
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

// Aplica el buscador de texto, el filtro de categoría y el orden activo.
// La usan tanto renderTable() como exportGastosCSV(), para que la exportación
// respete siempre lo que el usuario está viendo en pantalla.
function getGastosFiltradosYOrdenados() {
    let lista = currentData.gastos
        .map((g, i) => ({ ...g, originalIndex: i }))
        .filter(g => !g.isDeleted);

    if (tableFilterText.trim() !== '') {
        const q = tableFilterText.trim().toLowerCase();
        lista = lista.filter(g =>
            (g.descripcion || '').toLowerCase().includes(q) ||
            (g.categoria || '').toLowerCase().includes(q)
        );
    }

    if (tableFilterCategoria !== '') {
        lista = lista.filter(g => (g.categoria || 'Varios') === tableFilterCategoria);
    }

    lista.sort((a, b) => {
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

    return lista;
}

// Se llama desde el buscador y el select de categoría del filtro de la tabla
function aplicarFiltroTabla() {
    tableFilterText = document.getElementById('filtroTexto').value;
    tableFilterCategoria = document.getElementById('filtroCategoria').value;
    renderTable();
}

// Llena el <select> de categorías del filtro con las categorías realmente usadas este mes
function populateCategoryFilterOptions() {
    const select = document.getElementById('filtroCategoria');
    if (!select) return;
    const valorPrevio = select.value;

    const categorias = [...new Set(
        (currentData.gastos || [])
            .filter(g => !g.isDeleted)
            .map(g => g.categoria || 'Varios')
    )].sort((a, b) => a.localeCompare(b));

    select.innerHTML = '<option value="">Todas las categorías</option>' +
        categorias.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

    if (categorias.includes(valorPrevio)) select.value = valorPrevio;
}

function renderTable() {
    const tbody = document.getElementById('listaGastos');
    tbody.innerHTML = '';

    populateCategoryFilterOptions();

    const hayGastosDelMes = currentData.gastos && currentData.gastos.some(g => !g.isDeleted);
    const gastosAMostrar = getGastosFiltradosYOrdenados();

    if (!hayGastosDelMes) {
        document.getElementById('emptyState').style.display = 'block';
        document.getElementById('emptyState').querySelector('p').textContent = 'No hay gastos registrados este mes.';
        return;
    }

    if (gastosAMostrar.length === 0) {
        document.getElementById('emptyState').style.display = 'block';
        document.getElementById('emptyState').querySelector('p').textContent = 'Ningún gasto coincide con el filtro.';
        return;
    }
    document.getElementById('emptyState').style.display = 'none';

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
        document.getElementById('catGasto').selectedIndex = 0;
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
            detalleAhorros += `${getAssetTicker(moneda)}: ${formatNumber(saldo, isAssetCripto(moneda) ? 8 : 2)}\n`;
        }
    }
    document.getElementById('displayAhorroTotal').textContent = formatMoney(ahorroTotal, currentData.monedaVisual);
    document.getElementById('displayDetalleAhorros').textContent = detalleAhorros || 'Sin ahorros registrados';

    document.querySelectorAll('.lblMonedaBase').forEach(el => el.textContent = currentData.monedaBase.toUpperCase());
    document.getElementById('lblMonedaVisual').textContent = currentData.monedaVisual.toUpperCase();

    checkPresupuestosExcedidos();
}

// --- EXPORTAR CSV ---
function exportGastosCSV() {
    const gastos = getGastosFiltradosYOrdenados();
    if (gastos.length === 0) {
        showNotification("No hay gastos para exportar", "error");
        return;
    }

    const escapeCsv = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const header = ['Fecha', 'Descripción', 'Categoría', `Monto (${currentData.monedaBase.toUpperCase()})`, 'Pagado'];
    const filas = gastos.map(g => [
        g.fecha || '',
        g.descripcion || '',
        g.categoria || 'Varios',
        g.monto || 0,
        g.isPaid ? 'Sí' : 'No'
    ]);

    const csv = [header, ...filas].map(fila => fila.map(escapeCsv).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const monthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

    const a = document.createElement('a');
    a.href = url;
    a.download = `tugasto_movimientos_${monthKey}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

// --- REPORTES POR CATEGORÍA Y PRESUPUESTOS ---

// Total gastado por categoría en el mes actual (no distingue pagado/pendiente)
function getCategoryBreakdown() {
    const totales = {};
    (currentData.gastos || []).filter(g => !g.isDeleted).forEach(g => {
        const cat = g.categoria || 'Varios';
        totales[cat] = (totales[cat] || 0) + (g.monto || 0);
    });
    return Object.entries(totales)
        .map(([categoria, total]) => ({ categoria, total }))
        .sort((a, b) => b.total - a.total);
}

function openReportesModal() {
    renderReportesCategorias();
    renderReportesHistorial();
    openModal('modalReportes');
}

function renderReportesCategorias() {
    const cont = document.getElementById('reportesCategorias');
    if (!cont) return;
    const breakdown = getCategoryBreakdown();

    if (breakdown.length === 0) {
        cont.innerHTML = '<small style="color:#94a3b8;">No hay gastos este mes todavía.</small>';
        return;
    }

    const maxTotal = Math.max(...breakdown.map(b => b.total), 1);

    cont.innerHTML = breakdown.map(({ categoria, total }) => {
        const presupuesto = parseFloat(currentData.presupuestos[categoria]) || 0;
        const pctBarra = Math.min(100, (total / maxTotal) * 100);
        const sobrePresupuesto = presupuesto > 0 && total > presupuesto;

        return `
            <div class="reporte-cat-row">
                <div class="reporte-cat-info">
                    <span class="reporte-cat-nombre">${escapeHtml(categoria)}</span>
                    <span class="reporte-cat-monto">${formatCurrency(total)}${presupuesto > 0 ? ` / ${formatCurrency(presupuesto)}` : ''}</span>
                </div>
                <div class="reporte-cat-barra-bg">
                    <div class="reporte-cat-barra ${sobrePresupuesto ? 'over-budget' : ''}" style="width:${pctBarra}%;"></div>
                </div>
                <div class="reporte-cat-presupuesto">
                    <span>Presupuesto mensual:</span>
                    <input type="number" class="input-presupuesto" data-categoria="${escapeHtml(categoria)}" value="${presupuesto || ''}" placeholder="Sin límite" step="any" min="0">
                </div>
            </div>
        `;
    }).join('');
}

function guardarPresupuestos() {
    document.querySelectorAll('.input-presupuesto').forEach(input => {
        const categoria = input.dataset.categoria;
        const valor = parseFloat(input.value);
        if (!isNaN(valor) && valor > 0) {
            currentData.presupuestos[categoria] = valor;
        } else {
            delete currentData.presupuestos[categoria];
        }
    });
    presupuestosAvisados.clear(); // si cambiaron los límites, vuelve a avisar si corresponde
    saveData();
    renderReportesCategorias();
    showNotification("Presupuestos guardados");
}

// Avisa (una vez por categoría y por sesión) si el gasto del mes supera el presupuesto definido
function checkPresupuestosExcedidos() {
    if (!currentData.presupuestos || Object.keys(currentData.presupuestos).length === 0) return;

    const breakdown = getCategoryBreakdown();
    breakdown.forEach(({ categoria, total }) => {
        const presupuesto = parseFloat(currentData.presupuestos[categoria]) || 0;
        if (presupuesto > 0 && total > presupuesto && !presupuestosAvisados.has(categoria)) {
            presupuestosAvisados.add(categoria);
            showNotification(`Superaste el presupuesto de "${categoria}" este mes (${formatCurrency(total)} de ${formatCurrency(presupuesto)})`, "error");
        }
    });
}

// --- HISTORIAL / COMPARATIVA MENSUAL ---
async function renderReportesHistorial() {
    const cont = document.getElementById('reportesHistorial');
    if (!cont) return;
    cont.innerHTML = '<small style="color:#94a3b8;">Cargando...</small>';

    const allUserData = await getAllDataRaw();
    const monthKeys = Object.keys(allUserData)
        .filter(k => k.includes('-'))
        .sort()
        .slice(-6); // últimos 6 meses con datos, para que las barras no queden ilegibles

    if (monthKeys.length === 0) {
        cont.innerHTML = '<small style="color:#94a3b8;">Todavía no hay historial suficiente.</small>';
        return;
    }

    const monthNamesShort = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

    const balances = monthKeys.map(key => {
        const mes = allUserData[key];
        const ingresosTotal = (parseFloat(mes.ingresos?.fijo) || 0) + (parseFloat(mes.ingresos?.extra) || 0);
        const gastosTotal = (mes.gastos || []).filter(g => !g.isDeleted).reduce((sum, g) => sum + (g.monto || 0), 0);
        const [y, m] = key.split('-').map(Number);
        return { label: `${monthNamesShort[m - 1]} ${String(y).slice(2)}`, balance: ingresosTotal - gastosTotal };
    });

    const maxAbs = Math.max(...balances.map(b => Math.abs(b.balance)), 1);

    cont.innerHTML = balances.map(({ label, balance }) => {
        const alturaPct = Math.max(4, (Math.abs(balance) / maxAbs) * 100);
        return `
            <div class="historial-mes-col" title="${escapeHtml(label)}: ${formatCurrency(balance)}">
                <div class="historial-mes-barra ${balance < 0 ? 'negativo' : ''}" style="height:${alturaPct}%;"></div>
                <span class="historial-mes-label">${escapeHtml(label)}</span>
            </div>
        `;
    }).join('');
}

// --- RECORDATORIO DE GASTOS RECURRENTES PENDIENTES ---
function checkRecordatorioRecurrentes() {
    const monthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    if (recordatorioMostradoParaMes === monthKey) return; // ya avisado para este mes en esta sesión
    recordatorioMostradoParaMes = monthKey;

    const pendientes = (currentData.gastos || []).filter(g =>
        !g.isDeleted && !g.isPaid && (g.esRecurrente || g.idRecurrencia)
    );

    if (pendientes.length === 0) return;

    const nombres = pendientes.map(g => g.descripcion).join(', ');
    showNotification(`Tenés ${pendientes.length} gasto${pendientes.length > 1 ? 's' : ''} recurrente${pendientes.length > 1 ? 's' : ''} pendiente${pendientes.length > 1 ? 's' : ''} de pago: ${nombres}`, "secondary");
}

function updateUIConfig() {
    const selectTransfer = document.getElementById('transferMoneda');
    const disponibles = Object.keys(exchangeRatesUSD)
        .filter(m => m !== currentData.monedaBase)
        .sort((a, b) => getAssetTicker(a).localeCompare(getAssetTicker(b)));

    const armarOptions = (esCripto) => disponibles
        .filter(m => isAssetCripto(m) === esCripto)
        .map(m => `<option value="${m}">${getAssetTicker(m)}</option>`)
        .join('');

    selectTransfer.innerHTML =
        `<optgroup label="Monedas">${armarOptions(false)}</optgroup>` +
        `<optgroup label="Criptomonedas">${armarOptions(true)}</optgroup>`;

    calcularImpacto();
    updateDashboard();
}