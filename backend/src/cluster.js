// Cluster implementation for multi threading
import cluster from "cluster";
import os from "os";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const numCPUs = os.cpus().length;

if (cluster.isPrimary) {
  console.log(`Primary process ${process.pid} is running`);
  console.log(`Forking ${numCPUs} worker processes...`);

  // fork workers for  CPU core
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // worker exit and restart
  cluster.on("exit", (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died with code ${code} and signal ${signal}`);
    console.log("Starting a new worker...");
    cluster.fork();
  });

  // worker online
  cluster.on("online", (worker) => {
    console.log(`Worker ${worker.process.pid} is online`);
  });

} else {
  // Worker processes run the actual server.
  // Note: online users and key-exchange sessions live in each worker's memory,
  // so real-time features across workers would need sticky sessions and a shared
  // Socket.IO adapter (e.g. Redis). `npm start` runs a single process.
  await import("./mainServer.js");
  console.log(`Worker process ${process.pid} started`);
}
