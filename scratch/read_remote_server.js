import { Client } from "ssh2";
import fs from "fs";

const conn = new Client();

conn.on("ready", () => {
  console.log("Connected. Downloading /opt/sbgames-auth/server_index.js...");
  conn.exec("cat /opt/sbgames-auth/server_index.js", (err, stream) => {
    if (err) throw err;
    let data = "";
    stream.on("close", () => {
      fs.writeFileSync("scratch/remote_server_index.js", data);
      console.log("Saved remote server_index.js to scratch/remote_server_index.js");
      conn.end();
    }).on("data", (d) => {
      data += d.toString();
    }).stderr.on("data", (d) => {
      console.log("STDERR:", d.toString());
    });
  });
}).connect({
  host: "94.26.83.31",
  port: 22,
  username: "root",
  password: "WJ1gaad33hNXRVJL9qti"
});
