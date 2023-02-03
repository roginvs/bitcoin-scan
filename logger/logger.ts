// Yes, i am aware that there are libraries which do similar things

// LOGGER_DEBUG=
// LOGGER_INFO=asd,fff
// LOGGER_WARN=*

type LogFilter = null | string[];
function createFilterFromString(s?: string): LogFilter {
  return s === undefined || s === "*"
    ? null
    : s.split(",").map((x) => x.trim());
}
const debugFilter = createFilterFromString(process.env.LOGGER_DEBUG);
const infoFilter = createFilterFromString(process.env.LOGGER_INFO);
const warnFilter = createFilterFromString(process.env.LOGGER_WARN);

function isFilterMatch(
  id: string | undefined,
  filter: LogFilter,
  yes: () => void
) {
  if (!id) {
    yes();
  } else {
    if (!filter) {
      yes();
    } else {
      if (filter.includes(id)) {
        yes();
      } else {
        // no, no output
      }
    }
  }
}

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  darkgrey: "\x1b[90m",
  underscore: "\x1b[4m",
  blink: "\x1b[5m",
  reverse: "\x1b[7m",
  hidden: "\x1b[8m",
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
};

function coloredPrint(
  color: string | undefined,
  id: string | undefined,
  msg: string,
  args: any[]
) {
  let mOut = msg;
  if (id) {
    mOut = id + " " + msg;
  }
  mOut = (color ?? colors.reset) + mOut;
  if (args.length === 0) {
    return [mOut + (color ? colors.reset : "")];
  }
  return [mOut, ...args, ...(color ? [colors.reset] : [])];
}

export function createLogger(id?: string) {
  return {
    debug: (msg: string, ...args: any) =>
      isFilterMatch(id, debugFilter, () =>
        console.debug(...coloredPrint(colors.darkgrey, id, msg, args))
      ),
    info: (msg: string, ...args: any) =>
      isFilterMatch(id, infoFilter, () =>
        console.info(...coloredPrint(undefined, id, msg, args))
      ),

    warn: (msg: string, ...args: any) =>
      isFilterMatch(id, warnFilter, () =>
        console.warn(...coloredPrint(colors.red, id, msg, args))
      ),
  };
}

/*
console.info("Simple console");

const { debug, info, warn } = createLogger("lol");
info("this is info", {}, [1, 2, 34]);
warn("warning", [3, 4]);
debug("some debug");
info("still info", {}, [1, 2, 34]);
*/
