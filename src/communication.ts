import { spawn } from "child_process";
import * as api from "./api";
import treeKill from "tree-kill";

export interface CommandInfo {
  command: string;
  env: NodeJS.ProcessEnv;
}

export interface ProgramOutput {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface ServerOutput extends ProgramOutput {
  validationErrors: string[];
  panes: api.Pane[];
}

// TODO: Kill process if still running

export function runCompileCommand(
  workingDir: string,
  command: CommandInfo
): { promise: Promise<ProgramOutput>; cancel: () => Promise<void> } {
  return runCommand(workingDir, command, "");
}

export function runServerCommand(
  workingDir: string,
  { command, env }: CommandInfo,
  stdin: string
): { promise: Promise<ServerOutput>; cancel: () => Promise<void> } {
  const { promise, cancel } = runCommand(
    workingDir,
    { command, env: { ...env, ["DEVIZ_SERVER"]: "1" } },
    stdin
  );

  const toServerOutput = async (): Promise<ServerOutput> => {
    const output = await promise;
    const { validationErrors, strippedStderr, panes } = parseStderr(
      output.stderr
    );
    return { ...output, stderr: strippedStderr, validationErrors, panes };
  };

  return { promise: toServerOutput(), cancel };
}

function runCommand(
  workingDir: string,
  { command, env }: CommandInfo,
  stdin: string
): { promise: Promise<ProgramOutput>; cancel: () => Promise<void> } {
  const process = spawn(command, {
    cwd: workingDir,
    shell: true,
    env,
  });

  let canceled = false;
  const cancel = (): Promise<void> => {
    canceled = true;
    return new Promise((resolve) => treeKill(process.pid, () => resolve()));
  };

  const promise: Promise<ProgramOutput> = new Promise((resolve, reject) => {
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
      if (canceled) {
        reject("killed");
      } else {
        resolve({ exitCode, stdout, stderr });
      }
    });
  });

  return { promise, cancel };
}

const BEGIN_MARKER = "|DEVIZ:BEGIN|";
const END_MARKER = "|DEVIZ:END|";

function parseStderr(
  stderr: string
): { validationErrors: string[]; strippedStderr: string; panes: api.Pane[] } {
  const validationErrors = [];
  let strippedStderr = "";
  const outputChunks = [];

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
    if (endMarkerIndex < 0) {
      continue;
    }

    outputChunks.push(remaining.slice(0, endMarkerIndex));
    remaining = remaining.slice(endMarkerIndex + END_MARKER.length);
  }

  const commands = [];
  for (const chunk of outputChunks) {
    const result = api.parseCommands(chunk);
    if (typeof result === "string") {
      if (validationErrors.length === 0) {
        validationErrors.push(`deviz API error: ${result}`);
      }
    } else {
      commands.push(...result);
    }
  }

  const inPanes = commands
    .sort((cmd1, cmd2) => cmd1.index - cmd2.index)
    .map(({ pane }) => pane);
  let { paneErrors, outPanes } = mergePanes(inPanes);
  return {
    validationErrors: validationErrors.concat(paneErrors),
    strippedStderr,
    panes: outPanes,
  };
}

function mergePanes(
  inPanes: api.Pane[]
): { paneErrors: string[]; outPanes: api.Pane[] } {
  // TODO: Validate pane name (no "/" etc)
  // TODO: Check that built-in names aren't used (stdin, stdout, stderr)
  const paneErrors: string[] = [];
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
            ? `${pane.name} referenced twice. Panes of type ${pane.content.type} can only have one item.`
            : `${pane.name} has conflicting types: ${prevContent.type} and ${pane.content.type}`;
        paneErrors.push(errorMsg);
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
  return { paneErrors, outPanes };
}

function mergeContent(
  content1: api.PaneContent,
  content2: api.PaneContent
): api.PaneContent | null {
  if (content1.type !== content2.type) {
    return null;
  }
  switch (content1.type) {
    case "text": {
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
    }
    case "tree": {
      const trees1 = content1.data;
      const trees2 = <api.Tree[]>content2.data;
      return {
        type: "tree",
        data: trees1.concat(trees2),
      };
    }
    case "textTree": {
      const trees1 = content1.data;
      const trees2 = <api.Tree[]>content2.data;
      return {
        type: "textTree",
        data: trees1.concat(trees2),
      };
    }
    case "graph": {
      const graphs1 = content1.data;
      const graphs2 = <api.Graph[]>content2.data;
      return {
        type: "graph",
        data: graphs1.concat(graphs2),
      };
    }
    default:
      const _checkExhaustive: never = content1;
      return null;
  }
}
