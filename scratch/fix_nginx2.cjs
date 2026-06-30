const {Client}=require('ssh2');
const c=new Client();
c.on('ready',()=>{
  c.sftp((err,sftp)=>{
    sftp.readFile('/etc/nginx/sites-enabled/games.sb-capital.group', 'utf8', (err, data)=>{
      if(err){console.log('read err:', err);c.end();return;}
      console.log('Config length:', data.length, 'lines:', data.split('\n').length);
      
      const inviteBlock = [
        '    location /invite/ {',
        '        proxy_pass http://127.0.0.1:3000;',
        '        proxy_http_version 1.1;',
        '        proxy_set_header Host $host;',
        '        proxy_set_header X-Real-IP $remote_addr;',
        '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
        '        proxy_set_header X-Forwarded-Proto $scheme;',
        '    }',
        '',
      ].join('\n');
      
      const newConfig = data.replace(
        '    # Website static files (catch-all)',
        inviteBlock + '    # Website static files (catch-all)'
      );
      
      console.log('New config length:', newConfig.length);
      
      // Write to temp, then sudo cp to the RIGHT file
      sftp.writeFile('/tmp/nginx-new', Buffer.from(newConfig), (err)=>{
        if(err){console.log('write err:', err);c.end();return;}
        c.exec('echo "tcfgd12" | sudo -S cp /tmp/nginx-new /etc/nginx/sites-enabled/games.sb-capital.group && echo "tcfgd12" | sudo -S nginx -t 2>&1 && echo "tcfgd12" | sudo -S nginx -s reload 2>&1', (e,s)=>{
          let o='';
          s.stdout.on('data',d=>o+=d);
          s.stderr.on('data',d=>o+=d);
          s.on('close',()=>{console.log(o);c.end();});
        });
      });
    });
  });
}).connect({host:'62.77.154.84',username:'mnntn',password:'tcfgd12'});
