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
  cooldownGesto: 1500 // 1.5s entre gestos para evitar spam
};

// MAQUINA DE ESTADOS: CALIBRACION -> SELECCION -> ACTIVO / PAUSA -> RESUMEN
let estadoSistema = "CALIBRACION";
let deportesDisponibles = ["bici", "natacion", "correr"];
let indiceDeporte = 0;
let deporteActual = deportesDisponibles[0]; 

let tiempoEntrenamiento = 0;
let erroresTotales = 0;
let cronoActivo = false;

let tiempoTpose = 0;
let ultimoTiempoGesto = 0;

let ultimoAviso = 0;
const TIEMPO_ESPERA = 4000;
let errorAnunciado = false;
let tiempoInicioError = 0;
let errorDetectadoInterno = "Correcto";

let tiempoDesaparicion = 0;
let usuarioAusente = false;
let colorEsqueleto = "#00e5ff"; // default cyan

// ==========================================
// FORMATEAR TIEMPO
// ==========================================
function formatearTiempo(segundos) {
  const m = Math.floor(segundos / 60).toString().padStart(2, "0");
  const s = (segundos % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// INICIAR CRONO
setInterval(() => {
  if (cronoActivo && estadoSistema === "ACTIVO" && !usuarioAusente) {
    tiempoEntrenamiento++;
    cronoDiv.innerText = formatearTiempo(tiempoEntrenamiento);
  }
}, 1000);

// ==========================================
// 1. VOZ: ÚNICA FORMA DE SALIDA Y RESPALDO
// ==========================================
function hablar(texto) {
  socket.emit("hablar_movil", texto);
}

socket.on("comando_ordenador", (comando) => {
  console.log("🎤 Comando recibido del móvil:", comando);

  if (comando.includes("iniciar")) {
    if (estadoSistema === "SELECCION" || estadoSistema === "PAUSA") {
      cambiarEstado("ACTIVO");
    }
  } else if (comando.includes("pausar")) {
    if (estadoSistema === "ACTIVO") cambiarEstado("PAUSA");
  } else if (comando.includes("terminar")) {
    if (estadoSistema !== "CALIBRACION" && estadoSistema !== "RESUMEN") {
        cambiarEstado("RESUMEN");
    }
  } else if (estadoSistema !== "RESUMEN") {
    // CAMBIO DE DEPORTE POR VOZ (Funciona en CALIBRACION para testear micro)
    if (comando.includes("bicicleta") || comando.includes("bici")) forceDeporte("bici");
    else if (comando.includes("natación") || comando.includes("nadar") || comando.includes("natacion")) forceDeporte("natacion");
    else if (comando.includes("correr") || comando.includes("cinta")) forceDeporte("correr");
  }
});

// ==========================================
// 2. FUNCIÓN DE CAMBIO DE ESTADO (MÁQUINA LOGICA)
// ==========================================
function forceDeporte(nuevoDeporte) {
  // Bloquear bucles de eco. Evita que el micrófono escuche al propio altavoz 
  // diciendo "natación" y vuelva a activarlo en un bucle infinito.
  if (deporteActual === nuevoDeporte && modoDiv.innerText !== "?") return;

  deporteActual = nuevoDeporte;
  indiceDeporte = deportesDisponibles.indexOf(nuevoDeporte);
  modoDiv.innerText = nuevoDeporte.toUpperCase();
  modoDiv.style.color = "var(--accent-cyan)";
  
  // Añadimos tildes a la fuerza para que el motor de habla de Google lo lea natural
  let nombreLocutor = nuevoDeporte === "natacion" ? "natación" : nuevoDeporte;
  hablar(`Modo ${nombreLocutor} seleccionado.`);
}

function cambiarEstado(nuevoEstado) {
  estadoSistema = nuevoEstado;
  estadoDiv.innerText = nuevoEstado;
  
  if (nuevoEstado === "SELECCION") {
    mensajeDiv.innerText = "Levanta MANO IZQUIERDA para ciclar deporte. MANO DERECHA arranca.";
    mensajeDiv.style.color = "var(--text-main)";
    cronoActivo = false;
    cronoDiv.classList.remove("crono-activo");
    modoDiv.innerText = deporteActual.toUpperCase();
    hablar("Calibración completada. Selecciona deporte.");
    
  } else if (nuevoEstado === "ACTIVO") {
    cronoActivo = true;
    cronoDiv.classList.add("crono-activo");
    colorEsqueleto = "#00e5ff";
    hablar("Entrenamiento activado. ¡A por todas!");
    
  } else if (nuevoEstado === "PAUSA") {
    cronoActivo = false;
    cronoDiv.classList.remove("crono-activo");
    colorEsqueleto = "var(--text-muted)";
    mensajeDiv.innerText = "Entrenamiento pausado. (Ambas manos arriba para retomar)";
    mensajeDiv.style.color = "var(--text-main)";
    hablar("Entrenamiento pausado.");
    
  } else if (nuevoEstado === "RESUMEN") {
    cronoActivo = false;
    cronoDiv.classList.remove("crono-activo");
    colorEsqueleto = "var(--text-muted)";
    
    // Rellenamos el Overlay P2
    resumenDeporte.innerText = deporteActual.toUpperCase();
    resumenTiempo.innerText = formatearTiempo(tiempoEntrenamiento);
    resumenErrores.innerText = erroresTotales.toString();
    
    overlayResumen.classList.remove("oculto");
    hablar("Entrenamiento terminado. Pantalla de resumen activada.");
    
    // Auto reset en 10 segs volviendo a la Fase 1
    setTimeout(() => {
      overlayResumen.classList.add("oculto");
      reiniciarApp();
    }, 10000);
  }
}

function reiniciarApp() {
  tiempoEntrenamiento = 0;
  erroresTotales = 0;
  tiempoTpose = 0;
  ultimoTiempoGesto = 0;
  cronoDiv.innerText = "00:00";
  contadorErroresDiv.innerText = "Errores: 0";
  cambiarEstado("CALIBRACION");
  mensajeDiv.innerText = "Sitúate en T-Pose frente a la cámara...";
  modoDiv.innerText = "?";
}

// ==========================================
// 3. MATEMÁTICAS GEOMÉTRICAS Y GESTOS MEDIAPIPE
// ==========================================
function calcularAngulo(p1, p2, p3) {
  const radianes = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
  let angulo = Math.abs((radianes * 180.0) / Math.PI);
  return angulo > 180.0 ? 360 - angulo : angulo;
}

function analizarGestos(landmarks) {
    const ahora = Date.now();
    if (ahora - ultimoTiempoGesto < CONFIG_IA.cooldownGesto) return; // Cooldown anti spam

    const hombroI = landmarks[11];
    const hombroD = landmarks[12];
    const muñecaI = landmarks[15]; 
    const muñecaD = landmarks[16];

    // DEFINICIÓN DE GESTOS SIMPLES Y ROBUSTOS (Eje Y: 0 top a 1 bottom)
    const manoIzquierdaArriba = muñecaI.y < hombroI.y - 0.2;
    const manoDerechaArriba = muñecaD.y < hombroD.y - 0.2;
    // T-POSE: Brazos alineados horizontalmente con los hombros y extendidos
    const tPose = Math.abs(muñecaI.y - hombroI.y) < 0.2 && Math.abs(muñecaD.y - hombroD.y) < 0.2 && Math.abs(muñecaI.x - muñecaD.x) > 0.4;

    // ESTADOS:
    if (estadoSistema === "CALIBRACION") {
       if (tPose) {
          if (tiempoTpose === 0) tiempoTpose = ahora;
          else if (ahora - tiempoTpose > 2000) { // 2 segundos manteniendo T-Pose
             cambiarEstado("SELECCION");
          }
       } else {
          tiempoTpose = 0;
       }
    } 
    else if (estadoSistema === "SELECCION") {
       if (manoIzquierdaArriba && !manoDerechaArriba) {
          // Cambiar Deporte (Gestual)
          indiceDeporte = (indiceDeporte + 1) % deportesDisponibles.length;
          forceDeporte(deportesDisponibles[indiceDeporte]);
          ultimoTiempoGesto = ahora;
       } else if (manoDerechaArriba && !manoIzquierdaArriba) {
          // Iniciar Entreno (Gestual)
          cambiarEstado("ACTIVO");
          ultimoTiempoGesto = ahora;
       }
    }
    else if (estadoSistema === "ACTIVO" || estadoSistema === "PAUSA") {
       if (manoIzquierdaArriba && manoDerechaArriba) {
          // Gesto de Seguridad Bimanual: Pausar / Reanudar sin decir palabra
          if (estadoSistema === "ACTIVO") {
              socket.emit("error_detectado", "Pausa gestual de seguridad iniciada");
              cambiarEstado("PAUSA");
          } else {
              cambiarEstado("ACTIVO");
          }
          ultimoTiempoGesto = ahora;
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

  // DETECCIÓN GLOBAL DE GESTOS Y ABANDONOS
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
              mensajeDiv.style.color = "var(--accent-orange)";
              colorEsqueleto = "var(--text-muted)";
              socket.emit("error_detectado", "Usuario perdido de la cámara");
            }
        }
      }
  }

  // PINTAR EL ESQUELETO Y DAR CROMATISMO DE FEEDBACK
  if (hayCuerpo && typeof drawConnectors !== "undefined" && estadoSistema !== "RESUMEN") {
    if (estadoSistema === "CALIBRACION" && tiempoTpose > 0) colorEsqueleto = "white"; // Feedback de que está cogiendo la T-Pose
    else if (estadoSistema === "CALIBRACION") colorEsqueleto = "gray";

    drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, { color: "#FFFFFF", lineWidth: 4 });
    drawLandmarks(canvasCtx, results.poseLandmarks, { color: colorEsqueleto, lineWidth: 2, radius: 3 });
  }

  // IA MATEMÁTICA DE POSTURA EN TIEMPO REAL
  if (estadoSistema === "ACTIVO" && hayCuerpo && !usuarioAusente) {
    const resultadoBruto = detectarError(results.poseLandmarks);

    if (resultadoBruto !== "Correcto") {
      colorEsqueleto = "#ff4d00"; // ESTADO DE ERROR (Rojo/Naranja)

      if (errorDetectadoInterno !== resultadoBruto) {
        errorDetectadoInterno = resultadoBruto;
        tiempoInicioError = ahora;
      } else if (ahora - tiempoInicioError > 1000) { // Tolerancia para que no flashee a la mínima
        mensajeDiv.innerText = errorDetectadoInterno;
        mensajeDiv.style.color = "var(--accent-orange)";

        if (ahora - ultimoAviso > TIEMPO_ESPERA) {
          socket.emit("error_detectado", errorDetectadoInterno);
          ultimoAviso = ahora;
          
          if (!errorAnunciado) {
             erroresTotales++; // ESTADISTICA P2
             contadorErroresDiv.innerText = `Errores: ${erroresTotales}`;
          }
          errorAnunciado = true;
        }
      }
    } else {
      colorEsqueleto = "#00e5ff"; // IDEAL (Cian)
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
// 6. CONTROL Y ARRANQUE DE CÁMARA BÁSICA
// ==========================================
const camera = new Camera(videoElement, {
  onFrame: async () => {
    await pose.send({ image: videoElement });
  },
  width: 800,
  height: 600,
});

camera.start().catch((err) => {
  if (loadingOverlay) {
    loadingOverlay.classList.remove("oculto");
    loadingOverlay.innerHTML = `
      <div style="text-align: center; color: var(--accent-orange); padding: 20px; border: 2px solid var(--accent-orange); border-radius: 8px;">
        <h3 style="margin-bottom: 15px;">❌ Error de Cámara</h3>
        <p>No se pudo acceder a la cámara web.</p>
        <p style="font-size: 0.9rem; margin-top: 5px; color: var(--text-main);">Por favor, aprueba los permisos.</p>
      </div>
    `;
    loadingOverlay.style.background = "rgba(13, 17, 23, 0.95)";
  }
});
