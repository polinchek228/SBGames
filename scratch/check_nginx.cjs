const {Client}=require('ssh2');
const c=new Client();
c.on('ready',()=>{
  c.exec('cat /etc/nginx/sites-enabled/default 2>/dev/null || cat /etc/nginx/conf.d/sbgames.conf 2>/dev/null || cat /etc/nginx/sites-available/games.sb-capital.group 2>/dev/null || echo "NOT FOUND"', (e,s)=>{
    let o='';
    s.stdout.on('data',d=>o+=d);
    s.stderr.on('data',d=>o+=d);
    s.on('close',()=>{console.log(o);c.end();});
  });
}).connect({host:'62.77.154.84',username:'mnntn',password:'tcfgd12'});
