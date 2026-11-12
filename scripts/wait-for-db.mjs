import net from "net";

const host = process.env.MYSQL_HOST || "127.0.0.1";
const port = parseInt(process.env.MYSQL_PORT || "3307", 10);
const maxAttempts = 30;
let attempts = 0;

console.log(`[db:wait] Menunggu koneksi MySQL di ${host}:${port}...`);

function checkConnection() {
  attempts++;
  const socket = new net.Socket();
  socket.setTimeout(2000);

  socket.on("connect", () => {
    socket.destroy();
    console.log(`[db:wait] MySQL siap menerima koneksi di ${host}:${port}!`);
    process.exit(0);
  });

  socket.on("error", () => {
    socket.destroy();
    if (attempts >= maxAttempts) {
      console.error(`[db:wait] Timeout: MySQL belum siap setelah ${maxAttempts} percobaan.`);
      process.exit(1);
    }
    setTimeout(checkConnection, 1500);
  });

  socket.on("timeout", () => {
    socket.destroy();
    if (attempts >= maxAttempts) {
      console.error(`[db:wait] Timeout: MySQL belum siap setelah ${maxAttempts} percobaan.`);
      process.exit(1);
    }
    setTimeout(checkConnection, 1500);
  });

  socket.connect(port, host);
}

checkConnection();
