import "reflect-metadata";
import { Logger } from "@nestjs/common";
import Redis from "ioredis";
import { loadEnv } from "./common/load-env";

loadEnv();

const logger = new Logger("Worker");

async function boot() {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  const redis = new Redis(url, { maxRetriesPerRequest: null, lazyConnect: true });
  await redis.connect();
  logger.log("Mankopi worker siap (antrian bunga/laporan/SHU didaftarkan di fase berikutnya)");
  setInterval(() => {
    void redis.ping().catch((err) => logger.error(err));
  }, 30_000);
}

void boot();
