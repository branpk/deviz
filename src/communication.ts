import { spawn } from "child_process";
import { CommandInfo } from "./config";
import * as api from "./api";
import { assert } from "console";

export interface ProgramOutput {
  stdout: string;
  stderr: string;
}

export interface ServerOutput extends ProgramOutput {
  commands: api.Command[];
}

// TODO: Kill process if still running

export function runCompileCommand(
  workingDir: string,
  command: CommandInfo
): Promise<ProgramOutput> {
  return runCommand(workingDir, command, "");
}

export async function runServerCommand(
  workingDir: string,
  { command, env }: CommandInfo,
  stdin: string
): Promise<ServerOutput> {
  const { stdout, stderr } = await runCommand(
    workingDir,
    { command, env: { ...env, ["DEVIZ_SERVER"]: "1" } },
    stdin
  );
  const { strippedStderr, commands } = parseStderr(stderr);
  return { stdout, stderr: strippedStderr, commands };
}

function runCommand(
  workingDir: string,
  { command, env }: CommandInfo,
  stdin: string
): Promise<ProgramOutput> {
  return new Promise((resolve) => {
    const process = spawn(command, {
      cwd: workingDir,
      shell: true,
      env,
    });

    process.stdin.write(stdin);
    process.stdin.end();

    let stdout = "";
    process.stdout.on("data", (chunk) => {
      stdout += chunk;
    });

    let stderr = "";
    process.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    process.on("close", () => {
      resolve({ stdout, stderr });
    });
  });
}

const BEGIN_MARKER = "|DEVIZ:BEGIN|";
const END_MARKER = "|DEVIZ:END|";

function parseStderr(
  stderr: string
): { strippedStderr: string; commands: api.Command[] } {
  let strippedStderr = "";
  let commandSources = [];

  let remaining = stderr;
  while (true) {
    const beginMarkerIndex = remaining.indexOf(BEGIN_MARKER);
    if (beginMarkerIndex < 0) {
      strippedStderr += remaining;
      break;
    }

    strippedStderr += remaining.slice(0, beginMarkerIndex);
    remaining = remaining.slice(beginMarkerIndex + BEGIN_MARKER.length);
    const endMarkerIndex = remaining.indexOf(END_MARKER);
    // TODO: Better error handling
    assert(endMarkerIndex >= 0);
    commandSources.push(remaining.slice(0, endMarkerIndex));
    remaining = remaining.slice(endMarkerIndex + END_MARKER.length);
  }

  return {
    strippedStderr,
    commands: commandSources.map(parseCommand),
  };
}

function parseCommand(source: string): api.Command {
  // TODO: Validation
  return JSON.parse(source);
}
