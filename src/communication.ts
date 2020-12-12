import { spawn } from "child_process";
import { CommandInfo } from "./config";
import * as api from "./api";
import { assert } from "console";

export interface ProgramOutput {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface ServerOutput extends ProgramOutput {
  panes: api.Pane[];
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
  const output = await runCommand(
    workingDir,
    { command, env: { ...env, ["DEVIZ_SERVER"]: "1" } },
    stdin
  );
  const { strippedStderr, panes } = parseStderr(output.stderr);
  return { ...output, stderr: strippedStderr, panes };
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

    process.on("close", (exitCode) => {
      resolve({ exitCode, stdout, stderr });
    });
  });
}

const BEGIN_MARKER = "|DEVIZ:BEGIN|";
const END_MARKER = "|DEVIZ:END|";

function parseStderr(
  stderr: string
): { strippedStderr: string; panes: api.Pane[] } {
  let strippedStderr = "";
  let outputChunks = [];

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
    outputChunks.push(remaining.slice(0, endMarkerIndex));
    remaining = remaining.slice(endMarkerIndex + END_MARKER.length);
  }

  return {
    strippedStderr,
    panes: new Array<api.Pane>().concat(...outputChunks.map(parseOutputChunk)),
  };
}

function parseOutputChunk(source: string): api.Pane[] {
  // TODO: Validation
  return JSON.parse(source);
}
