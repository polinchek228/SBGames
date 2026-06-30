const {Client}=require('ssh2');
const c=new Client();
c.on('ready',()=>{
  c.sftp((err,sftp)=>{
    sftp.readdir('/etc/nginx/sites-enabled/', (err, list)=>{
      console.log('All files:', list.map(f=>f.filename));
      // The backup from earlier might be somewhere else
      c.exec('ls -la /etc/nginx/sites-enabled/ 2>&1', (e,s)=>{
        let o='';
        s.stdout.on('data',d=>o+=d);
        s.stderr.on('data',d=>o+=d);
        s.on('close',()=>{console.log(o);c.end();});
      });
    });
  });
}).connect({host:'62.77.154.84',username:'mnntn',password:'tcfgd12'});
