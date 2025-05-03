import config from "3lib-config";
import { execa } from "execa";
import moment from "moment/moment";
import * as toml from "smol-toml";
import fs from "fs";

config.init();
let processes = config.get("processes", []);

if (processes.length == 0)
  console.error("no processes defined. check or create config.toml file.");

let logStream;

if (config.get("writeToFile", false)) {
  logStream = fs.createWriteStream(config.get("writeToFile"), { flags: 'a' });
}

for (let process of config.get("processes")) {
  let processConfig, processConfigEncoded;
  if (process.loadConfig) {
    processConfig = config.get("configs/" + process.loadConfig, null);
    if (processConfig == null)
      console.error("config", process.loadConfig, "is not defined");
    processConfigEncoded = encodeURI(toml.stringify(processConfig));
  }
  if (process.tomlConfig) {
    processConfig = process.tomlConfig;
    processConfigEncoded = encodeURI(toml.stringify(processConfig));
  }
  (async () => {
    console.log("executing", process.exec, processConfig);
    for await (const result of execa(process.exec, [processConfigEncoded])) {

      let msg = `${moment().format("YYYY-MM-DD_HH:mm:ss.SS")} | ${process.name}: ${result}`;
      let msgConsole = msg;
      let msgFile = msg;
      let maxLineLengthConsole = config.get("truncateLineLengthConsole", 0);
      if (maxLineLengthConsole > 0 && msg.length > maxLineLengthConsole) {
        msgConsole = msg.substring(0, maxLineLengthConsole - 3) + "...";
      }
      let maxLineLengthFile = config.get("truncateLineLengthFile", 0);
      if (maxLineLengthFile > 0 && msg.length > maxLineLengthFile) {
        msgFile = msg.substring(0, maxLineLengthFile - 3) + "...";
      }

      console.log(msgConsole);
      if (config.get("truncateInFile", false)) msg = truncated;
      logStream?.write(msgFile + "\n");
    }
  })();
}
