/** Simple logger for worker */
export function logger(name: string) {
  return {
    debug: (message: string, ...args: unknown[]) => {
      console.log(`[DEBUG] [${name}] ${message}`, ...args);
    },
    info: (message: string, ...args: unknown[]) => {
      console.log(`[INFO] [${name}] ${message}`, ...args);
    },
    warn: (message: string, ...args: unknown[]) => {
      console.warn(`[WARN] [${name}] ${message}`, ...args);
    },
    error: (message: string, ...args: unknown[]) => {
      console.error(`[ERROR] [${name}] ${message}`, ...args);
    },
  };
}

