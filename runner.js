const { spawn } = require("child_process");

console.log("\n⏳ Iniciando cerebro IA local y conectando con Cloudflare...");
console.log("⏳ Dame unos 5-10 segundos mientras aparto y limpio la información...\n");

// 1. Iniciar servidor local de node de manera transparente (para que veas los "🗣️ Comando recibido")
const serverProcess = spawn("node", ["server.js"], { stdio: "inherit", shell: true });

// 2. Iniciar túnel de Cloudflare ocultando sus molestos logs técnicos por defecto
const tunnelProcess = spawn("npx", ["-y", "cloudflared", "tunnel", "--url", "http://localhost:3000"], { shell: true });

let urlEncontrada = false;

// Leemos el resultado del túnel y extraemos SOLO el enlace
tunnelProcess.stderr.on("data", (data) => {
  const output = data.toString();
  
  // Buscar exactamente la URL de TryCloudflare con Regex
  const urlMatch = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
  
  if (urlMatch && !urlEncontrada) {
    urlEncontrada = true;
    const urlMovel = urlMatch[0];
    
    // Imprimir el cuadro limpio y gigante al final
    console.log("");
    console.log("===================================================================");
    console.log("✅ SISTEMA LISTO Y COMPUERTAS ABIERTAS");
    console.log("===================================================================");
    console.log("🖥️  ENLACE ORDENADOR (Abre esto en la pestaña del PC para grabarte):");
    console.log("👉  http://localhost:3000\n");
    console.log("📱 ENLACE MÓVIL (Abre esto en el Teléfono para escuchar tu propio micro):");
    console.log(`👉  ${urlMovel}/pinganillo.html`);
    console.log("===================================================================\n");
  }
});

// Por si quieres forzar la salida manual si falla Cloudflare
tunnelProcess.stdout.on("data", () => {});

// Apagar todo limpiamente cuando el usuario pulse Ctrl + C
const exitApp = () => {
    try { serverProcess.kill(); } catch (e) {}
    try { tunnelProcess.kill(); } catch (e) {}
    process.exit();
};

process.on("SIGINT", exitApp);
process.on("SIGTERM", exitApp);
tunnelProcess.on("close", exitApp);
serverProcess.on("close", exitApp);
