export interface DevizConfig {
  mode: RunMode;
}

export type RunMode =
  | {
      type: "runOnSourceEdit";
      runCommand: CommandInfo;
    }
  | {
      type: "compileOnSourceEdit";
      compileCommand: CommandInfo;
      runCommand: CommandInfo;
    }
  | {
      type: "runOnFileChange";
      watchFile: string;
      runCommand: CommandInfo;
    };

export interface CommandInfo {
  command: string;
  env: NodeJS.ProcessEnv;
}
