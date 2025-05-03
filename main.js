import config from "3lib-config";
import { execa } from "execa";
import moment from "moment/moment";
import * as toml from "smol-toml";

config.init();
let processes = config.get("processes", []);

if (processes.length == 0)
  console.error("no processes defined. check or create config.toml file.");

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
      console.log(
        `${moment().format("YYYY-MM-DD_HH:mm:ss.SS")} | ${process.name}: ${result}`,
      );
    }
  })();
}
