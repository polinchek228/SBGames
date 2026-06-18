module.exports = {
  apps: [{
    name: "sbgames-auth",
    script: "/opt/sbgames-auth/server_index.js",
    max_memory_restart: "200M",
    env: {
      SSL_KEY: "/home/mnntn/.ssl/sbgames.key",
      SSL_CERT: "/home/mnntn/.ssl/sbgames.crt"
    }
  }]
};
