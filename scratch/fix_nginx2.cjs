const { Client } = require('ssh2');
const fs = require('fs');

const config = fs.readFileSync(require('path').join(__dirname, '..', 'games-sb-capital.conf'), 'utf8');
// Actually let's just write it directly via heredoc

const newConfig = `server {
    server_name games.sb-capital.group;

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/games.sb-capital.group/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/games.sb-capital.group/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 20M;

    location /backgrounds/ {
        alias /opt/sbgames/backgrounds/;
        add_header Cache-Control "public, max-age=86400";
        add_header Access-Control-Allow-Origin "*";
    }

    location /frames/ {
        alias /opt/sbgames/frames/;
        add_header Cache-Control "public, max-age=86400";
        add_header Access-Control-Allow-Origin "*";
    }

    location /icons/ {
        alias /opt/sbgames/icons/;
        add_header Cache-Control "public, max-age=86400";
        add_header Access-Control-Allow-Origin "*";
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}

server {
    if ($host = games.sb-capital.group) {
        return 301 https://$host$request_uri;
    }

    listen 80;
    server_name games.sb-capital.group;
    return 404;
}`;

// Upload config via SFTP, then sudo cp
const c = new Client();
c.on('ready', () => {
  c.sftp((err, sftp) => {
    if (err) { console.error('SFTP err:', err); c.end(); process.exit(1); }
    const stream = sftp.createWriteStream('/tmp/games-sb-capital.conf');
    stream.on('close', () => {
      c.exec("echo tcfgd12 | sudo -S cp /tmp/games-sb-capital.conf /etc/nginx/sites-available/games.sb-capital.group && echo tcfgd12 | sudo -S nginx -t 2>&1 && echo tcfgd12 | sudo -S systemctl reload nginx 2>&1 && echo '=== RELOADED ===' && curl -skI https://games.sb-capital.group/backgrounds/fon1.mp4 2>&1 | head -8", (e, s) => {
        s.on('data', c => process.stdout.write(c));
        s.stderr.on('data', c => process.stderr.write(c));
        s.on('close', () => c.end());
      });
    });
    stream.end(newConfig);
  });
}).on('error', e => console.error(e.message))
  .connect({ host: '62.77.154.84', port: 22, username: 'mnntn', password: 'tcfgd12' });
