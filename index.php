<!-- index.php -->
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <!-- Cache solo en HTML -->
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">

    <!-- SEO Principal -->
    <title>TuGasto.com | App Gratis para Controlar tus Gastos e Ingresos</title>
    <meta name="description" content="Controlá tus gastos, ingresos y ahorros gratis desde el celular o PC. App web de finanzas personales multimoneda: pesos, dólares, cripto y más. Sin instalar nada.">
    <meta name="keywords" content="controlar gastos, app gastos personales, finanzas personales gratis, control de gastos, billetera virtual, presupuesto mensual, ahorros, app gratuita finanzas, control de gastos argentina, control de gastos uruguay">
    <meta name="author" content="TuGasto.com">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="https://tugasto.com/">

    <!-- Open Graph (redes sociales) -->
    <meta property="og:title" content="TuGasto.com — Controlá tus gastos gratis" />
    <meta property="og:description" content="La app web gratuita para llevar el control de tus gastos, ingresos y ahorros en pesos, dólares o cripto. Sin instalar. Sin costo." />
    <meta property="og:url" content="https://tugasto.com/" />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="https://tugasto.com/tugasto.png" />
    <meta property="og:locale" content="es_AR" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="TuGasto.com — Controlá tus gastos gratis">
    <meta name="twitter:description" content="App gratuita de finanzas personales multimoneda. Pesos, dólares y cripto en un solo lugar.">
    <meta name="twitter:image" content="https://tugasto.com/tugasto.png">

    <!-- Schema.org JSON-LD para Google -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": "TuGasto.com",
      "url": "https://tugasto.com",
      "image": "https://tugasto.com/tugasto.png",
      "inLanguage": "es",
      "description": "App web gratuita para controlar gastos, ingresos y ahorros en múltiples monedas. Ideal para Argentina, Uruguay y Latinoamérica.",
      "applicationCategory": "FinanceApplication",
      "operatingSystem": "Web",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      },
      "featureList": [
        "Control de gastos personales",
        "Ingresos y presupuesto mensual",
        "Billetera multimoneda: pesos, dólares y criptomonedas",
        "Gastos recurrentes automáticos",
        "Presupuestos por categoría",
        "Reportes de gastos y comparativa mensual",
        "Exportación de movimientos a CSV",
        "Balance en tiempo real",
        "100% gratuito"
      ]
    }
    </script>

    <meta name="google-site-verification" content="Em3e08eNaD-Ph10kn5itCkHtPz_a0ZW7ss38H2f1FPQ" />
    
    <style>
        .google-glow-wrapper {
            position: relative;
            display: inline-flex;
            width: 100%;
        }
        .google-glow-bg {
            position: absolute;
            inset: -2px;
            background: linear-gradient(to right, #44BCFF, #FF44EC, #FF675E);
            border-radius: 12px;
            opacity: 0.7;
            filter: blur(8px);
            transition: opacity 0.2s, inset 0.2s, filter 0.2s;
            animation: tilt 3s infinite alternate ease-in-out;
        }
        .google-glow-wrapper:hover .google-glow-bg {
            opacity: 1;
            inset: -3px;
            filter: blur(10px);
        }
        @keyframes tilt {
            0%   { background-position: 0% 50%; }
            50%  { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
        .google-glow-btn {
            position: relative;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            width: 100%;
            padding: 12px 24px;
            background: #111827;
            color: white;
            font-size: 0.95rem;
            font-weight: 600;
            border: none;
            border-radius: 12px;
            cursor: pointer;
            transition: background 0.2s;
            white-space: nowrap;
        }
        .google-glow-btn:hover {
            background: #1a2436;
        }
    </style>
    <script src="https://accounts.google.com/gsi/client" async defer></script>
    <script src="https://unpkg.com/lucide@latest" defer></script>
    
    <link rel="stylesheet" href="styles.css?v=<?php echo filemtime('styles.css'); ?>">

    <link rel="icon" type="image/png" sizes="32x32" href="/tugastoo.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/tugastoo.png">
</head>
<body>

    <canvas id="backgroundCanvas"></canvas>

    <main id="landingLayout">
        
        <section id="infoPanel">
            <h1 class="landing-title">
                Controla <span style="color: white;">Tu Gasto</span> Multimoneda
            </h1>

            <p class="landing-subtitle">
                Registrá tus gastos e ingresos, armá presupuestos por categoría y mirá reportes claros de en qué se te va la plata. Todo gratis, desde el celular o la PC, sin instalar nada — en pesos, dólares o criptomonedas.
            </p>

            <button class="btn-primary btn-cta" onclick="showAuthOnly()">
                Comenzar Gratis
            </button>

            <h3 class="landing-features-title">Todo lo que podés hacer con <span style="color:#3b82f6">TuGasto.com</span></h3>
            <ul class="feature-list">
                <li>
                    <span class="feature-icon">
                        <i data-lucide="wallet"></i>
                    </span>
                    <div class="feature-text">
                        <strong>Balance Real al Día</strong>
                        <span>Cargá tus ingresos y gastos del mes y sabé al instante cuánta plata te queda disponible.</span>
                    </div>
                </li>
                <li>
                    <span class="feature-icon">
                        <i data-lucide="repeat"></i>
                    </span>
                    <div class="feature-text">
                        <strong>Gastos Recurrentes Automáticos</strong>
                        <span>Cargá una vez el alquiler, la luz o una suscripción y se repite solo todos los meses.</span>
                    </div>
                </li>
                <li>
                    <span class="feature-icon">
                        <i data-lucide="target"></i>
                    </span>
                    <div class="feature-text">
                        <strong>Presupuestos por Categoría</strong>
                        <span>Definí un límite mensual para Comida, Transporte, Ocio y más, y recibí un aviso si te pasás.</span>
                    </div>
                </li>
                <li>
                    <span class="feature-icon">
                        <i data-lucide="bar-chart-3"></i>
                    </span>
                    <div class="feature-text">
                        <strong>Reportes y Comparativa Mensual</strong>
                        <span>Mirá cuánto gastás por categoría y cómo evolucionó tu balance en los últimos meses.</span>
                    </div>
                </li>
                <li>
                    <span class="feature-icon">
                        <i data-lucide="pie-chart"></i>
                    </span>
                    <div class="feature-text">
                        <strong>Billetera Multimoneda</strong>
                        <span>Guardá ahorros en pesos, dólares, euros u otras monedas, y en criptomonedas como Bitcoin o Ethereum. Vas a ver el total convertido a tu moneda de referencia.</span>
                    </div>
                </li>
                <li>
                    <span class="feature-icon">
                        <i data-lucide="download"></i>
                    </span>
                    <div class="feature-text">
                        <strong>Buscador y Exportación a CSV</strong>
                        <span>Encontrá cualquier movimiento por descripción o categoría, y exportá tus gastos a Excel cuando los necesites.</span>
                    </div>
                </li>
            </ul>
        </section>

        <div id="authPanel" class="glass-panel auth-container" style="display: none;">
            <div class="logo-area">
                <img src="tugasto.png" alt="Logo de TuGasto.com" width="80" height="80">
                <p class="auth-brand">TuGasto.com</p>
            </div>
            <h2 class="auth-title" id="authTitle">Bienvenido</h2>
            
            <div id="google_btn_container" class="google-btn-wrapper" style="display:flex; justify-content:center; width:100%;"></div>

            <div class="divider">
                <hr class="divider-line">
                <span class="divider-text">O usa tu usuario</span>
                <hr class="divider-line">
            </div>

            <!-- FIX #4: Eliminado onclick duplicado. El listener está solo en script.js -->
            <form class="auth-form" id="authForm" onsubmit="event.preventDefault();">         
                <input type="text" id="username" placeholder="Usuario" required autocomplete="username">
                <input type="password" id="password" placeholder="Contraseña" required autocomplete="current-password">
                <button type="submit" class="btn-primary full-width" id="authButton">Entrar</button>
            </form>
            
            <button type="button" class="btn-text btn-forgot" onclick="forgotPassword()">
                Olvidé mi contraseña
            </button>
            
            <p class="auth-toggle-row">
                <button class="btn-text btn-toggle-auth" onclick="toggleAuthMode()">
                    ¿No tienes cuenta? <strong id="toggleAuthText">Regístrate</strong>
                </button>
            </p>
            

        </div>

    </main>

    <div id="mainContent" style="display: none;">
        
        <header class="app-header glass-panel">
            <div class="header-left">
                <img src="tugasto.png" alt="TuGasto.com" width="25" height="25">
                <span id="welcomeText">Hola, Usuario</span>
            </div>
            <div class="header-donate">
                <script type='text/javascript' src='https://storage.ko-fi.com/cdn/widget/Widget_2.js'></script><script type='text/javascript'>kofiwidget2.init('Invítame un café', '#1a2640', 'O2F322PEJJ');kofiwidget2.draw();</script>
            </div>
            <button class="btn-text logout-btn" onclick="logout()">
                <i data-lucide="log-out"></i> Salir
            </button>
        </header>

        <div class="controls-bar glass-panel">
            <div id="dateSelectorControl" class="date-selector-control">
                <button onclick="navigateMonth(-1)" class="btn-icon-only" aria-label="Mes anterior"><i data-lucide="chevron-left"></i></button>
                <div id="monthDisplay" class="month-display">Enero 2024</div>
                <button onclick="navigateMonth(1)" class="btn-icon-only" aria-label="Mes siguiente"><i data-lucide="chevron-right"></i></button>
            </div>
        </div>

        <div class="dashboard-grid">
            
            <div class="card glass-panel highlight-card">
                <div class="card-header">
                    <span>Disponible (<span class="lblMonedaBase">ARS</span>)</span>
                    <i data-lucide="wallet"></i>
                </div>
                <div class="card-value" id="displayDisponible">$0</div>
                <div class="card-subtext" id="displayArrastre">Liquidez para gastos</div>
            </div>

            <div class="card glass-panel savings-card">
                <div class="card-header">
                    <span>Patrimonio Total (<span id="lblMonedaVisual">USD</span>)</span>
                    <i data-lucide="pie-chart"></i>
                </div>
                <div class="card-value" id="displayAhorroTotal">$0</div>
                
                <div class="card-subtext" id="displayDetalleAhorros" style="font-size: 0.8rem; min-height: 20px; white-space: pre-wrap; margin-bottom: 5px;">
                    Calculando...
                </div>
                
                <div style="display: flex; gap: 8px;">
                    <button onclick="openModal('modalTransfer')" class="btn-sm btn-white" style="flex: 1;">
                        <i data-lucide="arrow-right-left"></i> Mover
                    </button>
                    <button onclick="openModal('modalConfig')" class="btn-sm" style="background: rgba(255,255,255,0.2); color: white; padding: 0 10px;" title="Configuración" aria-label="Configuración">
                        <i data-lucide="settings-2"></i>
                    </button>
                </div>
            </div>

            <div class="card glass-panel summary-card">
                <div class="summary-row">
                    <span>Ingresos Mes:</span>
                    <span class="text-success" id="displayIngresos">+$0</span>
                </div>
                <div class="summary-row">
                    <span>Gastos Mes:</span>
                    <span class="text-danger" id="displayGastos">-$0</span>
                </div>
                <div class="summary-row border-top">
                    <span>Balance Mes:</span>
                    <span id="displayBalanceMes">$0</span>
                </div>
                <div class="actions-row">
                    <button onclick="openModal('modalIngresos')" class="btn-secondary btn-sm">Editar Ingresos</button>
                </div>
            </div>
        </div>

        <div class="transactions-container glass-panel">
            <div class="section-header">
                <h3>Movimientos</h3>
                <div class="section-header-actions">
                    <button onclick="openReportesModal()" class="btn-secondary btn-icon btn-sm" title="Reportes y presupuestos">
                        <i data-lucide="bar-chart-3"></i> Reportes
                    </button>
                    <button onclick="exportGastosCSV()" class="btn-secondary btn-icon btn-sm" title="Exportar a CSV">
                        <i data-lucide="download"></i> Exportar
                    </button>
                    <button onclick="openModal('modalGasto')" class="btn-primary btn-icon">
                        <i data-lucide="plus"></i> Nuevo Gasto
                    </button>
                </div>
            </div>

            <div class="filter-bar">
                <input type="text" id="filtroTexto" placeholder="Buscar por descripción o categoría..." oninput="aplicarFiltroTabla()">
                <select id="filtroCategoria" onchange="aplicarFiltroTabla()">
                    <option value="">Todas las categorías</option>
                </select>
            </div>

            <div class="table-responsive">
                <table class="modern-table">
                    <thead>
                        <tr>
                            <th data-sort="fecha" onclick="sortTable('fecha')" class="th-sortable sort-asc">Fecha</th>
                            <th data-sort="descripcion" onclick="sortTable('descripcion')" class="th-sortable">Descripción</th>
                            <th data-sort="categoria" onclick="sortTable('categoria')" class="th-sortable">Categoría</th>
                            <th data-sort="monto" onclick="sortTable('monto')" class="th-sortable">Monto</th>
                            <th class="th-acciones">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="listaGastos"></tbody>
                </table>
            </div>
            <div id="emptyState" class="empty-state" style="display:none;">
                <i data-lucide="clipboard-list"></i>
                <p>No hay gastos registrados este mes.</p>
            </div>
        </div>
    </div>

    <!-- MODAL: Nuevo/Editar Gasto -->
    <div id="modalGasto" class="modal-overlay">
        <div class="modal-card">
            <div class="modal-header">
                <h3 id="tituloModalGasto">Registrar Gasto</h3>
                <button onclick="closeModal('modalGasto')" class="close-btn" aria-label="Cerrar"><i data-lucide="x"></i></button>
            </div>
            <div class="modal-body">
                <input type="hidden" id="editIndex">
                <div class="form-group">
                    <label>Descripción</label>
                    <input type="text" id="descGasto" placeholder="Ej: Supermercado">
                </div>
                <div class="form-group">
                    <label>Monto (<span class="lblMonedaBase">ARS</span>)</label>
                    <input type="number" id="montoGasto" placeholder="0.00">
                </div>
                <div class="form-group">
                    <label>Categoría</label>
                    <select id="catGasto">
                        <option value="Comida">Comida</option>
                        <option value="Transporte">Transporte</option>
                        <option value="Servicios">Servicios</option>
                        <option value="Ocio">Ocio</option>
                        <option value="Salud">Salud</option>
                        <option value="Educación">Educación</option>
                        <option value="Ropa">Ropa</option>
                        <option value="Hogar">Hogar</option>
                        <option value="Mascotas">Mascotas</option>
                        <option value="Regalos">Regalos</option>
                        <option value="Impuestos">Impuestos</option>
                        <option value="Seguros">Seguros</option>
                        <option value="Suscripciones">Suscripciones</option>
                        <option value="Tecnología">Tecnología</option>
                        <option value="Belleza">Belleza</option>
                        <option value="Deporte">Deporte</option>
                        <option value="Viajes">Viajes</option>
                        <option value="Alquiler">Alquiler</option>
                        <option value="Inversión">Inversión</option>
                        <option value="Varios">Varios</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Fecha</label>
                    <input type="date" id="fechaGasto">
                </div>
                
                <label class="checkbox-row" for="recurrenteCheck">
                    <input type="checkbox" id="recurrenteCheck" onchange="document.getElementById('recurrenteOptions').style.display = this.checked ? 'block' : 'none'">
                    <i data-lucide="repeat" style="width:15px; color:var(--primary); flex-shrink:0;"></i>
                    <span>Gasto recurrente</span>
                </label>
                <div id="recurrenteOptions" style="display:none; margin-bottom:12px; padding:14px; background:rgba(59,130,246,0.06); border:1px solid rgba(59,130,246,0.15); border-radius:10px;">
                    <div class="form-group">
                        <label>Repetir durante cuántos meses</label>
                        <input type="number" id="mesesRecurrentes" min="1" max="36" value="3">
                    </div>
                </div>

                <button id="btnGuardarGasto" class="btn-primary full-width">Guardar</button>
            </div>
        </div>
    </div>

    <!-- MODAL: Ingresos -->
    <div id="modalIngresos" class="modal-overlay">
        <div class="modal-card">
            <div class="modal-header">
                <h3>Ingresos del Mes</h3>
                <button onclick="closeModal('modalIngresos')" class="close-btn" aria-label="Cerrar"><i data-lucide="x"></i></button>
            </div>
            <div class="modal-body">
                <p class="helper-text" style="color:#94a3b8; margin-bottom:15px;">Define el dinero que entra en <span class="lblMonedaBase" style="font-weight:bold;">ARS</span>.</p>
                <div class="form-group">
                    <label>Sueldo / Ingreso Fijo</label>
                    <input type="number" id="ingresoFijo" placeholder="0.00">
                </div>
                <div class="form-group">
                    <label>Extras (Aguinaldo, etc)</label>
                    <input type="number" id="ingresoExtra" placeholder="0.00">
                </div>
                <button id="btnGuardarIngresos" class="btn-primary full-width">Actualizar Ingresos</button>
            </div>
        </div>
    </div>

    <!-- MODAL: Transferencias -->
    <div id="modalTransfer" class="modal-overlay">
        <div class="modal-card">
            <div class="modal-header">
                <h3>Mover Fondos</h3>
                <button onclick="closeModal('modalTransfer')" class="close-btn" aria-label="Cerrar"><i data-lucide="x"></i></button>
            </div>
            <div class="modal-body">
                <div style="display:flex; gap:10px; margin-bottom:15px;">
                    <button class="btn-sm full-width" onclick="setTransferType('deposito')" id="tabDeposito" style="background:var(--primary); color:white;">
                        Ahorrar
                    </button>
                    <button class="btn-sm full-width" onclick="setTransferType('retiro')" id="tabRetiro" style="background:transparent; border:1px solid var(--glass-border);">
                        Retirar (Usar)
                    </button>
                </div>
                
                <div class="form-group">
                    <label>¿Qué activo vas a <span id="lblActionVerb">guardar</span>?</label>
                    <select id="transferMoneda" onchange="calcularImpacto()"></select>
                </div>

                <div class="form-group">
                    <label id="lblTransferAmount">Cantidad</label>
                    <input type="number" id="transferCantidad" placeholder="0.00" step="any" oninput="calcularImpacto()">
                </div>

                <div id="divImpacto" style="background:rgba(59, 130, 246, 0.1); padding:12px; border-radius:8px; margin-bottom:15px;">
                    <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:#94a3b8; margin-bottom:5px;">
                        <span>Cotización detectada:</span>
                        <span id="lblCotizacionDisplay">---</span>
                    </div>
                    
                    <div class="form-group" style="margin-bottom:0;">
                        <label style="color:#60a5fa; font-weight:600;" id="lblImpactoTitle">Monto a restar de tu Caja (<span class="lblMonedaBase">ARS</span>)</label>
                        <input type="number" id="transferImpacto" step="any" style="border: 1px solid #60a5fa; color: white;">
                        <small style="color:#94a3b8;">* Puedes corregir este valor si pagaste otro precio.</small>
                    </div>
                </div>

                <button onclick="ejecutarTransferencia()" class="btn-primary full-width">Confirmar Movimiento</button>
            </div>
        </div>
    </div>

    <!-- MODAL: Pago Parcial -->
    <div id="modalPagoParcial" class="modal-overlay">
        <div class="modal-card">
            <div class="modal-header">
                <h3>Registrar Pago</h3>
                <button onclick="closeModal('modalPagoParcial')" class="close-btn" aria-label="Cerrar"><i data-lucide="x"></i></button>
            </div>
            <div class="modal-body">
                <input type="hidden" id="pagoParcialIndex">
                <p id="pagoParcialInfo" style="color:#94a3b8; margin-bottom:15px;"></p>
                <div class="form-group">
                    <label>Monto a pagar (<span class="lblMonedaBase">ARS</span>)</label>
                    <input type="number" id="montoPagoParcial" placeholder="0.00" step="any">
                </div>
                <button onclick="confirmarPagoParcial()" class="btn-primary full-width">Registrar Pago</button>
            </div>
        </div>
    </div>

    <!-- MODAL: Detalle de Gasto -->
    <div id="modalDetalleGasto" class="modal-overlay">
        <div class="modal-card">
            <div class="modal-header">
                <h3 id="detalleGastoTitulo">Detalle del Gasto</h3>
                <button onclick="closeModal('modalDetalleGasto')" class="close-btn" aria-label="Cerrar"><i data-lucide="x"></i></button>
            </div>
            <div class="modal-body">
                <input type="hidden" id="detalleGastoIndex">
                <div id="detalleGastoInfo" class="detalle-gasto-info"></div>

                <hr style="border:0; border-top:1px solid var(--glass-border); margin:18px 0;">

                <div class="form-group" style="margin-bottom:10px;">
                    <label>Pagos registrados</label>
                    <div id="detalleGastoPagos" class="detalle-gasto-pagos"></div>
                </div>

                <div id="detalleGastoRegistrarPago" class="form-group" style="margin-bottom:0;">
                    <label>Registrar nuevo pago</label>
                    <div style="display:flex; gap:8px;">
                        <input type="number" id="montoNuevoPagoDetalle" placeholder="0.00" step="any" style="margin:0;">
                        <button onclick="confirmarPagoDesdeDetalle()" class="btn-primary" style="white-space:nowrap; padding:0 18px;">Pagar</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- MODAL: Configuración -->
    <div id="modalConfig" class="modal-overlay">
        <div class="modal-card">
            <div class="modal-header">
                <h3>Configuración General</h3>
                <button onclick="closeModal('modalConfig')" class="close-btn" aria-label="Cerrar"><i data-lucide="x"></i></button>
            </div>
            <div class="modal-body">
                
                <div class="form-group">
                    <label>Moneda Principal (Caja)</label>
                    <select id="configMonedaBase">
                        <option value="ars">Peso Argentino (ARS)</option>
                        <option value="usd">Dólar (USD)</option>
                        <option value="eur">Euro (EUR)</option>
                        <option value="uyu">Peso Uruguayo (UYU)</option>
                    </select>
                    <small style="color:#94a3b8;">Tus ingresos y gastos corrientes se verán en esta moneda.</small>
                </div>

                <div class="form-group">
                    <label>Ver mis Ahorros en:</label>
                    <select id="configMonedaVisual">
                        <optgroup label="Monedas">
                            <option value="usd">Dólar (USD) - Recomendado</option>
                            <option value="ars">Peso Argentino (ARS)</option>
                            <option value="eur">Euro (EUR)</option>
                            <option value="uyu">Peso Uruguayo (UYU)</option>
                            <option value="brl">Real Brasileño (BRL)</option>
                            <option value="clp">Peso Chileno (CLP)</option>
                            <option value="cop">Peso Colombiano (COP)</option>
                            <option value="mxn">Peso Mexicano (MXN)</option>
                            <option value="pen">Sol Peruano (PEN)</option>
                            <option value="gbp">Libra Esterlina (GBP)</option>
                        </optgroup>
                        <optgroup label="Criptomonedas">
                            <option value="bitcoin">Bitcoin (BTC)</option>
                            <option value="ethereum">Ethereum (ETH)</option>
                            <option value="tether">Tether (USDT)</option>
                            <option value="bnb">BNB (BNB)</option>
                            <option value="cardano">Cardano (ADA)</option>
                            <option value="litecoin">Litecoin (LTC)</option>
                            <option value="polkadot">Polkadot (DOT)</option>
                            <option value="solana">Solana (SOL)</option>
                            <option value="xrp">XRP (XRP)</option>
                        </optgroup>
                    </select>
                    <small style="color:#94a3b8;">Ej: Gano en Pesos, pero quiero ver cuánto tengo en Dólares.</small>
                </div>

                <hr style="border:0; border-top:1px solid var(--glass-border); margin:15px 0;">
                
                <div class="form-group">
                    <label>Mis Activos Guardados</label>
                    <div id="panelSaldosManuales" style="background:rgba(0,0,0,0.2); padding:10px; border-radius:8px; margin-bottom:10px;"></div>
                    
                    <div style="display:flex; gap:5px;">
                        <!-- Opciones generadas dinámicamente por populateSelectNuevaMoneda() con todo el catálogo de activos -->
                        <select id="selectNuevaMoneda" style="margin:0; font-size:0.9rem;">
                            <option value="">+ Agregar otro activo...</option>
                        </select>
                        <button onclick="agregarMonedaManual()" class="btn-secondary" style="padding: 0 15px;">+</button>
                    </div>
                </div>

                <button onclick="guardarConfig()" class="btn-primary full-width" style="margin-top:15px;">Guardar Configuración</button>
            </div>
        </div>
    </div>

    <!-- MODAL: Reportes y Presupuestos -->
    <div id="modalReportes" class="modal-overlay">
        <div class="modal-card modal-card-wide">
            <div class="modal-header">
                <h3>Reportes y Presupuestos</h3>
                <button onclick="closeModal('modalReportes')" class="close-btn" aria-label="Cerrar"><i data-lucide="x"></i></button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Gastos por Categoría (mes actual) y presupuesto mensual</label>
                    <div id="reportesCategorias" class="reportes-categorias"></div>
                    <button onclick="guardarPresupuestos()" class="btn-primary full-width" style="margin-top:10px;">Guardar Presupuestos</button>
                </div>

                <hr style="border:0; border-top:1px solid var(--glass-border); margin:20px 0;">

                <div class="form-group" style="margin-bottom:0;">
                    <label>Balance de los últimos meses</label>
                    <div id="reportesHistorial" class="reportes-historial"></div>
                </div>
            </div>
        </div>
    </div>

    <!-- MODAL: Rollover de mes -->
    <div id="modalRollover" class="modal-overlay" style="z-index: 200;">
        <div class="modal-card">
            <div class="modal-header">
                <h3>Cierre del Mes Anterior</h3>
            </div>
            <div class="modal-body">
                <div style="border: 1px solid var(--glass-border); padding:15px; border-radius:8px; text-align:center; margin-bottom:15px;">
                    <small>Sobrante detectado:</small><br>
                    <span id="rolloverAmount" class="text-success" style="font-size:1.4rem; font-weight:bold;">$0</span><br>
                    <small id="rolloverOrigin" style="color:var(--text-muted); margin-top:5px;"></small>
                </div>

                <p style="text-align:center; margin-bottom:15px; color:#94a3b8;">¿Qué quieres hacer con este dinero?</p>
                
                <div class="form-group">
                    <label>Monto a utilizar</label>
                    <input type="number" id="montoRolloverInput">
                </div>

                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <button onclick="applyRollover('caja')" class="btn-primary full-width" style="margin:0">
                        <i data-lucide="wallet"></i> Sumar a Disponible (Caja)
                    </button>
                    <button onclick="applyRollover('ahorro')" class="btn-secondary full-width" style="margin:0; background: rgba(16, 185, 129, 0.2); color: #10b981; border:none;">
                        <i data-lucide="piggy-bank"></i> Enviar a Ahorros
                    </button>
                    <button onclick="applyRollover('ignorar')" class="btn-text full-width">
                        Descartar / No hacer nada
                    </button>
                </div>
            </div>
        </div>
    </div>

    <footer class="app-footer">
        <a href="/terminos.php">Términos de Servicio</a> · <a href="/privacidad.php">Política de Privacidad</a>
    </footer>

    <div id="notification-container" class="notification-container"></div>

    <script src="script.js?v=<?php echo filemtime('script.js'); ?>"></script>

</body>
</html>