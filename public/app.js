// SOCKET
const socket = io();

// ELEMENTOS HTML
const videoElement = document.getElementById("video");
const canvasElement = document.getElementById("canvas");
const canvasCtx = canvasElement.getContext("2d");
const mensajeDiv = document.getElementById("mensaje");
const estadoDiv = document.getElementById("estado-entrenamiento");
const modoDiv = document.getElementById("modo-deporte");
const loadingOverlay = document.getElementById("loading-overlay");

// NUEVOS ELEMENTOS P2
const relojDiv = document.getElementById("reloj-digital");
const kcalDiv = document.getElementById("kcal-counter");
const aiLogDiv = document.getElementById("ai-log");

const cronoDiv = document.getElementById("crono");
const contadorErroresDiv = document.getElementById("contador-errores");
const overlayResumen = document.getElementById("overlay-resumen");
const resumenDeporte = document.getElementById("resumen-deporte");
const resumenTiempo = document.getElementById("resumen-tiempo");
const resumenErrores = document.getElementById("resumen-errores");

// ==========================================
// CONFIGURACIÓN IA Y ESTADO MÁQUINA
// ==========================================
const CONFIG_IA = {
  bici: { maxCuello: 140, maxCodo: 165, maxRodillaYOffset: 0.15 },
  natacion: { maxCuello: 140, maxPierna: 150, maxCodoYOffset: 0.1 },
  correr: { minEspalda: 150, minCuello: 150, maxRodillaYOffset: 0.05 },
  timeoutSinUsuario: 3000,
  cooldownGesto: 1500
};

// MAQUINA DE ESTADOS: ESPERANDO -> CALIBRACION -> ACTIVO / PAUSA -> RESUMEN
let estadoSistema = "ESPERANDO";
let deportesDisponibles = ["bici", "natacion", "correr"];
let indiceDeporte = 0;
let deporteActual = deportesDisponibles[0]; 

let tiempoEntrenamiento = 0;
let erroresTotales = 0;
let cronoActivo = false;

let tiempoTpose = 0;
let ultimoTiempoGesto = 0;
let progresoGesto = 0;

let ultimoAviso = 0;
const TIEMPO_ESPERA = 4000;
let errorAnunciado = false;
let tiempoInicioError = 0;
let errorDetectadoInterno = "Correcto";

let tiempoDesaparicion = 0;
let usuarioAusente = false;
let colorEsqueleto = "#00e5ff"; 

// ==========================================
// 1. RELOJ Y CRONÓMETRO
// ==========================================
// Reloj del Header
setInterval(() => {
  const ahora = new Date();
  if (relojDiv) {
    relojDiv.innerText = ahora.toLocaleTimeString('es-ES', { hour12: false });
  }
}, 1000);

function formatearTiempo(segundos) {
  const m = Math.floor(segundos / 60).toString().padStart(2, "0");
  const s = (segundos % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// INICIAR CRONO
setInterval(() => {
  if (cronoActivo && estadoSistema === "ACTIVO" && !usuarioAusente) {
    tiempoEntrenamiento++;
    if(cronoDiv) cronoDiv.innerText = formatearTiempo(tiempoEntrenamiento);
    
    // Cada segundo quema unas 0.15 kcal para efecto visual
    if(kcalDiv) kcalDiv.innerText = (tiempoEntrenamiento * 0.15).toFixed(1);
  }
}, 1000);

// ==========================================
// 2. VOZ / COMANDOS DESDE EL MÓVIL Y LOGS
// ==========================================
function hablar(texto) {
  socket.emit("hablar_movil", texto);
  
  if (aiLogDiv) {
     const p = document.createElement("p");
     p.innerHTML = `<i>[IA]</i> ${texto}`;
     aiLogDiv.appendChild(p);
     // Auto Scroll 
     aiLogDiv.scrollTop = aiLogDiv.scrollHeight;
  }
}

function arrancarDesdeEspera(modo) {
    tiempoEntrenamiento = 0;
    erroresTotales = 0;
    if (cronoDiv) cronoDiv.innerText = "00:00";
    if (contadorErroresDiv) contadorErroresDiv.innerText = "Errores: 0";

    document.getElementById("contenedor-video").classList.remove("difuminado");
    document.getElementById("dashboard").classList.remove("difuminado");
    document.getElementById("panel-derecho").classList.remove("difuminado");
    document.getElementById("overlay-esperando").classList.add("oculto");
    document.getElementById("overlay-resumen").classList.add("oculto");
    
    forceDeporte(modo);
    cambiarEstado("CALIBRACION");
}

socket.on("comando_ordenador", (comando) => {
  console.log("🎤 Comando recibido del móvil:", comando);

  if (estadoSistema === "ESPERANDO" || estadoSistema === "RESUMEN") {
     if (comando.includes("iniciar bicicleta") || comando.includes("bicicleta") || comando.includes("bici")) {
         arrancarDesdeEspera("bici");
     } else if (comando.includes("iniciar natacion") || comando.includes("nadar") || comando.includes("natación") || comando.includes("natacion")) {
         arrancarDesdeEspera("natacion");
     } else if (comando.includes("iniciar correr") || comando.includes("cinta") || comando.includes("correr")) {
         arrancarDesdeEspera("correr");
     }
  } else {
      // SOLO SE ACEPTAN COMANDOS DE FLUJO (Pausar/Reanudar/Terminar), EL DEPORTE ESTÁ BLOQUEADO
      if (comando === "saltar_calibracion") {
        if (estadoSistema === "CALIBRACION") {
           hablar("Calibración omitida.");
           iniciarCuentaAtras();
        }
      } else if (comando.includes("iniciar") || comando.includes("reanudar") || comando.includes("reanuda") || comando.includes("continuar") || comando.includes("play")) {
        if (estadoSistema === "PAUSA") iniciarCuentaAtras();
      } else if (comando === "alternar_pausa") {
        if (estadoSistema === "ACTIVO") cambiarEstado("PAUSA");
        else if (estadoSistema === "PAUSA") iniciarCuentaAtras();
      } else if (comando.includes("pausa") || comando.includes("parar") || comando.includes("stop")) {
        if (estadoSistema === "ACTIVO") cambiarEstado("PAUSA");
      } else if (comando.includes("terminar") || comando.includes("termina") || comando.includes("fin")) {
        if (estadoSistema !== "RESUMEN" && estadoSistema !== "ESPERANDO") {
            cambiarEstado("RESUMEN");
        }
      }
  }
});

// ==========================================
// 2. FUNCIÓN DE CAMBIO DE ESTADO 
// ==========================================
function forceDeporte(nuevoDeporte) {
  if (deporteActual === nuevoDeporte && modoDiv.innerText !== "?") return;

  deporteActual = nuevoDeporte;
  indiceDeporte = deportesDisponibles.indexOf(nuevoDeporte);
  modoDiv.innerText = nuevoDeporte.toUpperCase();
  modoDiv.style.color = "var(--accent-cyan)";
  
  // Limpiar temas y aplicar el nuevo
  document.body.classList.remove("tema-bici", "tema-nadar", "tema-natacion", "tema-correr");
  const claseTema = nuevoDeporte === "natacion" ? "nadar" : nuevoDeporte;
  document.body.classList.add(`tema-${claseTema}`);

  let nombreLocutor = nuevoDeporte === "natacion" ? "natación" : nuevoDeporte;
  hablar(`Modo ${nombreLocutor} seleccionado.`);
}

let intervalCuenta = null;
function iniciarCuentaAtras() {
    estadoSistema = "CUENTA_ATRAS";
    estadoDiv.innerText = "CUENTA ATRÁS";
    cronoActivo = false;
    colorEsqueleto = "white";
    
    const overlay = document.getElementById("overlay-cuenta");
    const numSpan = document.getElementById("numero-cuenta");
    if(!overlay) { cambiarEstado("ACTIVO"); return; }
    
    overlay.style.display = "flex";
    let tiempo = 5;
    numSpan.innerText = tiempo;
    
    if (intervalCuenta) clearInterval(intervalCuenta);
    hablar(tiempo.toString());
    
    intervalCuenta = setInterval(() => {
        tiempo--;
        if (tiempo > 0) {
            numSpan.innerText = tiempo;
            hablar(tiempo.toString());
        } else {
            clearInterval(intervalCuenta);
            intervalCuenta = null;
            overlay.style.display = "none";
            cambiarEstado("ACTIVO");
        }
    }, 1000);
}

function cambiarEstado(nuevoEstado) {
  estadoSistema = nuevoEstado;
  estadoDiv.innerText = nuevoEstado;
  
  if (nuevoEstado === "CALIBRACION") {
    // Al elegirse de antemano el deporte, la calibración ya no lleva a SELECCION, pasa directo a ACTIVO
    mensajeDiv.innerText = "Deporte fijado. Sitúate en T-Pose para calibrar y empezar directo...";
    mensajeDiv.style.color = "var(--text-main)";
    cronoActivo = false;
    cronoDiv.classList.remove("crono-activo");
    modoDiv.innerText = deporteActual.toUpperCase();
    
  } else if (nuevoEstado === "ACTIVO") {
    cronoActivo = true;
    cronoDiv.classList.add("crono-activo");
    colorEsqueleto = "#00e5ff";
    hablar("Entrenamiento activado. ¡A por todas!");
    
  } else if (nuevoEstado === "PAUSA") {
    cronoActivo = false;
    cronoDiv.classList.remove("crono-activo");
    colorEsqueleto = "var(--text-muted)";
    mensajeDiv.innerText = "Entrenamiento pausado.";
    mensajeDiv.style.color = "var(--text-main)";
    hablar("Entrenamiento pausado.");
    
  } else if (nuevoEstado === "RESUMEN") {
    cronoActivo = false;
    cronoDiv.classList.remove("crono-activo");
    colorEsqueleto = "var(--text-muted)";
    
    resumenDeporte.innerText = deporteActual.toUpperCase();
    resumenTiempo.innerText = formatearTiempo(tiempoEntrenamiento);
    resumenErrores.innerText = erroresTotales.toString();
    
    overlayResumen.classList.remove("oculto");
    hablar("Entrenamiento terminado. Pantalla de resumen activada.");
    
    // SIN LIMITE AUTOMATICO: Ahora esperamos al evento manual del Móvil para resetear
    socket.emit("deporte_completado", deporteActual); // Avisamos al móvil de que se tache
  }
}

// ESCUCHA DEL BOTÓN MANUAL DE RETORNO AL MENÚ
socket.on("reset_manual", () => {
    overlayResumen.classList.add("oculto");
    reiniciarApp();
});

function reiniciarApp() {
  tiempoEntrenamiento = 0;
  erroresTotales = 0;
  tiempoTpose = 0;
  ultimoTiempoGesto = 0;
  cronoDiv.innerText = "00:00";
  contadorErroresDiv.innerText = "Errores: 0";
  
  // VOLVER A PANTALLA DE INCIO
  estadoSistema = "ESPERANDO";
  estadoDiv.innerText = "ESPERANDO";
  document.getElementById("contenedor-video").classList.add("difuminado");
  document.getElementById("dashboard").classList.add("difuminado");
  document.getElementById("overlay-esperando").classList.remove("oculto");
  
  // Restaurar el tema por Defecto
  document.body.classList.remove("tema-bici", "tema-nadar", "tema-correr");
  
  mensajeDiv.innerText = "Sistema inactivo.";
  modoDiv.innerText = "ESPERANDO";
}

// ==========================================
// 3. MATEMÁTICAS GEOMÉTRICAS Y GESTOS
// ==========================================
function calcularAngulo(p1, p2, p3) {
  const radianes = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
  let angulo = Math.abs((radianes * 180.0) / Math.PI);
  return angulo > 180.0 ? 360 - angulo : angulo;
}

function analizarGestos(landmarks) {
    const ahora = Date.now();
    progresoGesto = 0;
    if (ahora - ultimoTiempoGesto < CONFIG_IA.cooldownGesto) return;

    const hombroI = landmarks[11];
    const hombroD = landmarks[12];
    const muñecaI = landmarks[15]; 
    const muñecaD = landmarks[16];

    const tPose = Math.abs(muñecaI.y - hombroI.y) < 0.15 && Math.abs(muñecaD.y - hombroD.y) < 0.15 && Math.abs(muñecaI.x - muñecaD.x) > 0.45;

    let algunGestoDetec = false;

    if (estadoSistema === "CALIBRACION") {
       if (tPose) {
          algunGestoDetec = true;
          if (tiempoTpose === 0) tiempoTpose = ahora;
          progresoGesto = Math.min((ahora - tiempoTpose) / 2000, 1);
          if (ahora - tiempoTpose >= 2000) { 
             iniciarCuentaAtras();
             ultimoTiempoGesto = ahora;
             tiempoTpose = 0;
             progresoGesto = 0;
          }
       } else {
          tiempoTpose = 0;
       }
    }
}

// ==========================================
// 4. LÓGICA DE POSTURAS DE ENTRENAMIENTO
// ==========================================
function detectarError(landmarks) {
  const oreja = landmarks[3];
  const hombro = landmarks[11];
  const codo = landmarks[13];
  const muñeca = landmarks[15];
  const cadera = landmarks[23];
  const rodilla = landmarks[25];
  const tobillo = landmarks[27];

  if (deporteActual === "bici") {
    const anguloAlineacionCuello = calcularAngulo(oreja, hombro, cadera);
    const anguloCodo = calcularAngulo(hombro, codo, muñeca);

    if (anguloAlineacionCuello < CONFIG_IA.bici.maxCuello) return "Alinea la espalda con el cuello.";
    if (rodilla.y < cadera.y - CONFIG_IA.bici.maxRodillaYOffset) return "Baja las rodillas, postura muy agresiva.";
    if (anguloCodo > CONFIG_IA.bici.maxCodo) return "Flexiona los codos, vas muy tenso.";

  } else if (deporteActual === "natacion") {
    const anguloCuello = calcularAngulo(oreja, hombro, cadera);
    const anguloPierna = calcularAngulo(cadera, rodilla, tobillo);

    if (codo.y > hombro.y + CONFIG_IA.natacion.maxCodoYOffset) return "Levanta los codos en la brazada.";
    if (anguloCuello < CONFIG_IA.natacion.maxCuello) return "Mantén el cuello recto.";
    if (anguloPierna < CONFIG_IA.natacion.maxPierna) return "Estira más las piernas.";

  } else if (deporteActual === "correr") {
    const anguloCuello = calcularAngulo(oreja, hombro, cadera);
    const anguloEspalda = calcularAngulo(hombro, cadera, rodilla);

    if (anguloEspalda < CONFIG_IA.correr.minEspalda) return "Endereza la espalda.";
    if (rodilla.y < cadera.y + CONFIG_IA.correr.maxRodillaYOffset) return "No levantes tanto las rodillas.";
    if (anguloCuello < CONFIG_IA.correr.minCuello) return "Mirada al frente.";
  }
  return "Correcto";
}

// ==========================================
// 5. BUCLE PRINCIPAL DE PROCESAMIENTO IA
// ==========================================
const pose = new Pose({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
});

pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
});

pose.onResults((results) => {
  if (loadingOverlay && !loadingOverlay.classList.contains("oculto")) {
    loadingOverlay.classList.add("oculto"); 
  }

  const ahora = Date.now();
  let hayCuerpo = results.poseLandmarks && results.poseLandmarks.length > 0;

  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

  if (hayCuerpo) {
      analizarGestos(results.poseLandmarks);
      
      if (usuarioAusente) {
         usuarioAusente = false;
         if (estadoSistema === "ACTIVO" || estadoSistema === "PAUSA") {
             mensajeDiv.innerText = "Usuario detectado. Retomando...";
             mensajeDiv.style.color = "var(--text-main)";
             colorEsqueleto = estadoSistema === "ACTIVO" ? "#00e5ff" : "var(--text-muted)";
         }
      }
      tiempoDesaparicion = 0;
  } else {
      if (!usuarioAusente) {
        if (tiempoDesaparicion === 0) tiempoDesaparicion = ahora;
        else if (ahora - tiempoDesaparicion > CONFIG_IA.timeoutSinUsuario) {
            usuarioAusente = true;
            if (estadoSistema === "ACTIVO") {
              mensajeDiv.innerText = "Usuario no detectado. Pausa automática.";
              mensajeDiv.style.color = "var(--accent-yellow)";
              colorEsqueleto = "var(--text-muted)";
              socket.emit("error_detectado", "Usuario perdido de la cámara");
            }
        }
      }
  }

  if (hayCuerpo && typeof drawConnectors !== "undefined" && estadoSistema !== "RESUMEN") {
    if (estadoSistema === "CALIBRACION" && tiempoTpose > 0) colorEsqueleto = "white";
    else if (estadoSistema === "CALIBRACION") colorEsqueleto = "gray";

    let animRadius = 3;
    if (progresoGesto > 0) {
        animRadius = 3 + (progresoGesto * 15); // Crece de 3 hasta 18
        colorEsqueleto = "#ff00ff"; // Rosa/Morado de carga
    }

    drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, { color: "#FFFFFF", lineWidth: 4 });
    drawLandmarks(canvasCtx, results.poseLandmarks, { color: colorEsqueleto, lineWidth: 2, radius: animRadius });
  }

  if (estadoSistema === "ACTIVO" && hayCuerpo && !usuarioAusente) {
    const resultadoBruto = detectarError(results.poseLandmarks);

    if (resultadoBruto !== "Correcto") {
      colorEsqueleto = "#ffea00"; 

      if (errorDetectadoInterno !== resultadoBruto) {
        errorDetectadoInterno = resultadoBruto;
        tiempoInicioError = ahora;
      } else if (ahora - tiempoInicioError > 1000) {
        mensajeDiv.innerText = errorDetectadoInterno;
        mensajeDiv.style.color = "var(--accent-yellow)";

        if (ahora - ultimoAviso > TIEMPO_ESPERA) {
          socket.emit("error_detectado", errorDetectadoInterno);
          ultimoAviso = ahora;
          
          if (!errorAnunciado) {
             erroresTotales++;
             contadorErroresDiv.innerText = `Errores: ${erroresTotales}`;
          }
          errorAnunciado = true;
        }
      }
    } else {
      colorEsqueleto = "#00e5ff"; 
      errorDetectadoInterno = "Correcto";
      tiempoInicioError = 0;
      mensajeDiv.innerText = "Postura Correcta";
      mensajeDiv.style.color = "var(--accent-cyan)";

      if (errorAnunciado) {
        socket.emit("error_detectado", "¡Ahora mucho mejor!");
        errorAnunciado = false;
        ultimoAviso = ahora;
      }
    }
  }
});

// ==========================================
// 6. CONTROL Y REPRODUCCIÓN DEL VÍDEO REMOTO
// ==========================================
// NOTA MODO ESPEJO P2: El PC ya no usa la webcam local. Pide las fotos al túnel Wifi.
videoElement.onload = async () => {
  // Ocultamos el spinner inicial cuando recibamos la primera foto del móvil
  if (loadingOverlay && !loadingOverlay.classList.contains("oculto")) {
    loadingOverlay.classList.add("oculto"); 
  }
  // Pasamos el fotograma al cerebro MediaPipe
  try {
    await pose.send({ image: videoElement });
  } catch (err) {
    console.error("Error MediaPipe procesando frame:", err);
  }
};

socket.on("stream_espejo", (frameBase64) => {
  // Inyectamos el fotograma en nuestro <img> fantasma
  videoElement.src = frameBase64;
});