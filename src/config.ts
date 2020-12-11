export interface DevizConfig {
  mode: RunMode;
}

export type RunMode =
  | {
      type: "runOnSourceEdit";
      runCommand: CommandInfo;
    }
  | {
      type: "runOnFileChange";
      watchFile: string;
      runCommand: CommandInfo;
    }
  | {
      type: "compileOnSourceEdit";
      runCommand: CommandInfo;
      compileCommand: CommandInfo;
    };

export interface CommandInfo {
  command: string;
  env: NodeJS.ProcessEnv;
}
