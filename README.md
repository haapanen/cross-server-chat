# Cross server chat
A Node.js application that parses log files and sends chat messages from one Wolfenstein: Enemy Territory server to all linked servers.

# Usage

1. Install required npm packages by running `npm install`.
2. Run typescript compiler `./node_modules/typescript/bin/tsc` to compile the TypeScript files to JavaScript.
3. Add linked servers to `./build/servers.json` in the following format:

```JSON
[
  {
    "log": "/path/to/1st/server/etconsole.log",
    "address": "localhost:27960",
    "rconPassword": "rconPasswordHere"
  },
  {
    "log": "./path/to/2nd/server/etconsole.log",
    "address": "localhost:27961",
    "rconPassword": "rconPasswordHere"
  }
]
```

`log` is the path to the log file.
`address` is the server address and port separated by `:` (e.g. localhost:27960). It is used to send an rcon command to the server.
`rconPassword` is the server rcon password. It is used to send an rcon command to the server.

