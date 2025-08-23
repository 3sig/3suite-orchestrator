import config from "3lib-config";
import { execa } from "execa";
import moment from "moment/moment";
import fs from "fs";

config.init();

const verbose = config.get("verbose", false);
const processes = config.get("processes", []);

if (verbose) {
  console.log("Orchestrator starting with config:", JSON.stringify(config.get(), null, 2));
}

console.log(`Starting orchestrator with ${processes.length} processes`);

if (processes.length === 0) {
  console.error("No processes defined. Check or create config.json5 file.");
}

let logStream;
const writeToFile = config.get("writeToFile", false);

if (writeToFile) {
  logStream = fs.createWriteStream(writeToFile, { flags: 'a' });
  console.log(`Log file output enabled: ${writeToFile}`);
  if (verbose) {
    console.log("Log stream created with append mode");
  }
}

function createCustomLogger(processName) {
  return function(verboseLine, verboseObject) {
    const timestamp = moment().format("YYYY-MM-DD_HH:mm:ss.SS");
    const msg = `${timestamp} | ${processName}: ${verboseObject.message}`;

    let msgConsole = msg;
    let msgFile = msg;

    const maxLineLengthConsole = config.get("truncateLineLengthConsole", 0);
    if (maxLineLengthConsole > 0 && msg.length > maxLineLengthConsole) {
      msgConsole = msg.substring(0, maxLineLengthConsole - 3) + "...";
    }

    const maxLineLengthFile = config.get("truncateLineLengthFile", 0);
    if (maxLineLengthFile > 0 && msg.length > maxLineLengthFile) {
      msgFile = msg.substring(0, maxLineLengthFile - 3) + "...";
    }

    console.log(msgConsole);

    if (logStream) {
      logStream.write(msgFile + "\n");
    }
  };
}

for (let process of processes) {
  let processConfig, processConfigEncoded;
  let cwd = "";

  if (process.loadConfig) {
    processConfig = config.get("configs/" + process.loadConfig, null);
    if (processConfig === null) {
      console.error(`Config '${process.loadConfig}' not found for process '${process.name}'`);
      continue;
    }
    processConfigEncoded = encodeURI(JSON.stringify(processConfig));
    if (verbose) {
      console.log(`Loaded config for '${process.name}':`, processConfig);
    }
  }

  if (process.config) {
    processConfig = process.config;
    if (verbose) processConfig.verbose = true;
    processConfigEncoded = encodeURI(JSON.stringify(processConfig));
    if (verbose) {
      console.log(`Using inline config for '${process.name}':`, processConfig);
    }
  }

  if (process.cwd) {
    cwd = process.cwd;
    if (verbose) {
      console.log(`Working directory for '${process.name}': ${cwd}`);
    }
  }

  (async () => {
    console.log(`Starting process '${process.name}': ${process.exec}`);

    if (verbose) {
      console.log(`Process '${process.name}' details:`, {
        executable: process.exec,
        cwd: cwd || process.cwd || "current directory",
        hasConfig: !!processConfig,
        configSource: process.loadConfig ? `loaded from configs/${process.loadConfig}` : process.config ? "inline config" : "none"
      });
    }

    let execaResult;

    try {
      const execaOptions = {
        cwd,
        verbose: createCustomLogger(process.name)
      };

      if (processConfigEncoded) {
        execaResult = execa(process.exec, [processConfigEncoded], execaOptions);
      } else {
        if (verbose) {
          console.log(`Process '${process.name}' running without config`);
        }
        execaResult = execa(process.exec, [], execaOptions);
      }
    } catch (error) {
      console.error(`Failed to start process '${process.name}':`, error.message);
      if (verbose) {
        console.error(`Process '${process.name}' start error details:`, {
          executable: process.exec,
          cwd: cwd || "current directory",
          error: error
        });
      }
      return;
    }

    try {
      await execaResult;
    } catch (error) {
      console.error(`Process '${process.name}' encountered error:`, error.message);
      if (verbose) {
        console.error(`Process '${process.name}' runtime error details:`, {
          executable: process.exec,
          error: error,
          exitCode: error.exitCode,
          signal: error.signal
        });
      }
    }
  })();
}
