const { Client } = require("ssh2");

const newConfig = `server {
    listen 443 ssl;
    server_name api.hyperionsearch.xyz;

    ssl_certificate     /etc/letsencrypt/live/api.hyperionsearch.xyz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.hyperionsearch.xyz/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    location /tg-webhook {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 30;
        limit_req zone=sbg_api burst=30 nodelay;
    }

    location /backgrounds/ {
        alias /opt/sbgames-auth/public/backgrounds/;
        expires 30d;
        add_header Cache-Control "public, immutable";
        add_header Access-Control-Allow-Origin "*";
    }

    location / {
        include /etc/nginx/snippets/sbgames-security.conf;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
}

# Legacy 8443 -> redirect
server {
    listen 8443 ssl;
    server_name api.sbgames.hyperionsearch.xyz api.hyperionsearch.xyz;

    ssl_certificate     /etc/letsencrypt/live/api.hyperionsearch.xyz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.hyperionsearch.xyz/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    return 301 https://api.hyperionsearch.xyz$request_uri;
}

server {
    listen 80;
    server_name api.hyperionsearch.xyz api.sbgames.hyperionsearch.xyz;
    return 301 https://api.hyperionsearch.xyz$request_uri;
}
`;

const c = new Client();
c.on("ready", () => {
  const cmd = `cat > /etc/nginx/sites-available/sbgames-api << 'NGINXEOF'\n${newConfig}\nNGINXEOF\nnginx -t 2>&1 && systemctl reload nginx 2>&1 && echo "OK"`;
  c.exec(cmd, (err, stream) => {
    let out = "";
    stream.on("data", (d) => (out += d));
    stream.stderr.on("data", (d) => (out += d));
    stream.on("close", () => {
      console.log(out);
      c.end();
    });
  });
});
c.connect({ host: "94.26.83.31", port: 22, username: "root", password: "WJ1gaad33hNXRVJL9qti" });
