// PM2 — تشغيل تطبيق مثراء على الـVPS
module.exports = {
  apps: [
    {
      name: "mithraa",
      cwd: "/var/www/mithraa",
      script: ".output/server/index.mjs",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "1G",
      env_file: "/var/www/mithraa/deploy/.env",
      env: { NODE_ENV: "production", PORT: 3000 },
      out_file: "/var/log/mithraa/out.log",
      error_file: "/var/log/mithraa/err.log",
      time: true,
    },
  ],
};
