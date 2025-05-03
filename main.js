import config from '3lib-config';
import {execa} from 'execa'
import * as toml from 'smol-toml';

config.init();
let processes = config.get("processes", []);

if (processes.length == 0) console.error("no processes defined. check or create config.toml file.")

for (let process of config.get("processes")) {
  let processConfig = null;
  if (process.loadConfig) {
    processConfig = config.get("configs/" + process.loadConfig, null);
    if (config == null) console.error("config", process.loadConfig, "is not defined");
    processConfig = encodeURI(toml.stringify(processConfig));
  }
  if (process.tomlConfig) {
    processConfig = process.tomlConfig;
    processConfig = encodeURI(toml.stringify(processConfig));
  }
  ; (async () => {
    console.log("executing", process.exec, processConfig)
    for await (const result of execa(process.exec, [processConfig])) {
      console.log(process.name, result);
    }
  })();

}
