const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Servir la carpeta pública (frontend)
app.use(express.static("public"));

// === VARIABLES PARA EVITAR ECO/DUPLICADOS ===
// Esto soluciona el problema de que el móvil repita cosas
// si tienes el Espejo o el Móvil abierto en múltiples pestañas
// o si el sistema de voz envía dos veces la misma frase
let ultimoTextoHablado = "";
let tiempoUltimoHablado = 0;

let ultimoComando = "";
let tiempoUltimoComando = 0;

io.on("connection", (socket) => {
  console.log("🟢 Nuevo cliente conectado (Dispositivo ID:", socket.id, ")");

  // Recibir alerta de error (postura) desde el cliente cámara
  socket.on("error_detectado", (data) => {
    const ahora = Date.now();
    // Prevenir enviar el mismo error más de 1 vez en 2 segundos
    if (data === ultimoTextoHablado && ahora - tiempoUltimoHablado < 2000) {
      return;
    }
    ultimoTextoHablado = data;
    tiempoUltimoHablado = ahora;

    console.log("⚠️ Error detectado:", data);
    io.emit("feedback", {
      mensaje: data,
    });
  });

  // Recibir comandos de voz desde el móvil y pasarlos al ordenador
  socket.on("comando_voz", (comando) => {
    const ahora = Date.now();
    // Prevenir enviar el mismo comando al PC más de 1 vez en 2 segundos (evita doble activación)
    if (comando === ultimoComando && ahora - tiempoUltimoComando < 2000) {
      return;
    }
    ultimoComando = comando;
    tiempoUltimoComando = ahora;

    console.log("🗣️ Comando de voz recibido:", comando);
    io.emit("comando_ordenador", comando);
  });

  // Recibir cualquier texto que deba hablar el móvil desde el ordenador
  socket.on("hablar_movil", (texto) => {
    const ahora = Date.now();
    // Prevenir eco de audio (si hay dos ventanas abiertas en PC por error)
    if (texto === ultimoTextoHablado && ahora - tiempoUltimoHablado < 2000) {
      console.log("🔇 Suspensión de texto duplicado (Anti-Eco):", texto);
      return; 
    }
    ultimoTextoHablado = texto;
    tiempoUltimoHablado = ahora;

    console.log("🔊 Mandar a hablar al móvil:", texto);
    io.emit("feedback", {
      mensaje: texto,
    });
  });

  socket.on("disconnect", () => {
    console.log("🔴 Cliente desconectado");
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
