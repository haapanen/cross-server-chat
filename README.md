# cross-server-chat
A Node.js application that parses log files and sends chat messages from one Wolfenstein: Enemy Territory server to all linked servers.

## Usage

Download the source code
```git clone https://github.com/haapanen/cross-server-chat.git```
```cd cross-server-chat```

Install TypeScript compiler
```npm install -g typescript```

Compile the source code
```tsc```

Install necessary libraries
```npm install```

Create linked servers
```node application.js add```

Add handlers to the config.json handlers array.
```{ servers: [...], handlers: ["say-handler"] }```

Start application
```node application.js start```


