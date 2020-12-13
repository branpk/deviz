import { spawn } from "child_process";
import { CommandInfo } from "./config";
import * as api from "./api";
import { assert } from "console";
import * as vscode from "vscode";

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

  const panes = new Array<api.Pane>().concat(
    ...outputChunks.map(parseOutputChunk)
  );
  return {
    strippedStderr,
    panes: mergePanes(panes),
  };
}

function parseOutputChunk(source: string): api.Pane[] {
  // TODO: Validation
  return JSON.parse(source);
}

function mergePanes(inPanes: api.Pane[]): api.Pane[] {
  // TODO: Validate pane name (no "/" etc)
  const orderedPanes: string[] = [];
  const paneContent: Map<string, api.PaneContent> = new Map();

  for (const pane of inPanes) {
    const prevContent = paneContent.get(pane.name);
    if (prevContent) {
      const newContent = mergeContent(prevContent, pane.content);
      if (newContent) {
        paneContent.set(pane.name, newContent);
      } else {
        const errorMsg =
          prevContent.type === pane.content.type
            ? `${pane.name} built twice. Panes of type ${pane.content.type} can only be built once.`
            : `${pane.name} has conflicting types: ${prevContent.type} and ${pane.content.type}`;
        vscode.window.showWarningMessage(errorMsg);
      }
    } else {
      orderedPanes.push(pane.name);
      paneContent.set(pane.name, pane.content);
    }
  }

  const outPanes: api.Pane[] = [];
  for (const name of orderedPanes) {
    const content = paneContent.get(name);
    if (content) {
      outPanes.push({ name, content });
    }
  }
  return outPanes;
}

function mergeContent(
  content1: api.PaneContent,
  content2: api.PaneContent
): api.PaneContent | null {
  if (content1.type !== content2.type) {
    return null;
  }
  switch (content1.type) {
    case "text":
      const text1 = content1.data;
      const text2 = <api.Text>content2.data;
      return {
        type: "text",
        data: {
          text: text1.text + text2.text,
          hovers: [
            ...text1.hovers,
            ...text2.hovers.map((hover) => ({
              start: hover.start + text1.text.length, // TODO: Handle unicode
              end: hover.end + text1.text.length,
              text: hover.text,
            })),
          ],
        },
      };
    case "tree":
      return null;
    case "textTree":
      return null;
    case "graph":
      return null;
    default:
      const _checkExhaustive: never = content1;
      return null;
  }
}
