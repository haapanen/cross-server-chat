"use strict";
///<reference path="typings/node/node.d.ts"/>
///<reference path="typings/colors/colors.d.ts"/>
///<reference path="typings/chokidar/chokidar.d.ts"/>

import {SendTo} from "./handler";
import {Handler} from "./handler";
import {EventEmitter} from "events";
import * as fs from "fs";
import * as Util from "./utilities";
import * as colors from "colors";
import * as chokidar from "chokidar";

export interface IServer {
    host: string;
    port: number;
    filepath: string;
    rconPassword: string;
}

export interface IConfig {
    servers: Array<IServer>;
}

export async function loadConfig(filepath:string):Promise<IConfig> {
    return new Promise<IConfig>((resolve, error) => {
        fs.readFile(filepath, (err, buffer) => {
            if (err) {
                return error(err);
            }

            let config:IConfig;
            try {
                config = JSON.parse(fs.readFileSync(filepath).toString());
            } catch (e) {
                return error(Util.currentTimestamp() + " " + colors.red("error: ") + `could not parse ${filepath}. ` + e);
            }

            return resolve(config);
        });
    });
}

export async function saveConfig(filepath:string, config:IConfig) {
    return new Promise<IConfig>((resolve, error) => {
        fs.writeFile(filepath, JSON.stringify(config, null, 4), (err) => {
            if (err) {
                return error(err);
            }
            return resolve();
        });
    })
}

export class LogWatcher extends EventEmitter {
    private previousSize: number = 0;
    private fd: number;

    constructor(server: IServer) {
        super();
        fs.stat(server.filepath, (err, stat) => {
            if (err) {
                throw err;
            }

            this.previousSize = stat.size;

            fs.open(server.filepath, 'r', (err, fd) => {
                if (err) {
                    throw err;
                }

                this.fd = fd;
                // use polling as fs and chokidar watch with events is rather unreliable
                chokidar.watch(server.filepath, {
                    usePolling: true,
                    interval: 100
                }).on('change', this.fileChanged.bind(this));
                console.log(`Watching server ${server.host}:${server.port} log file: ${server.filepath}`);
            });
        });
    }

    private fileChanged(path: string, stat: fs.Stats) {
        let newBytes = stat.size - this.previousSize;
        if (newBytes <= 0) {
            return;
        }
        let buffer = new Buffer(newBytes);
        fs.read(this.fd, buffer, 0, newBytes, this.previousSize, (err, bytesRead, buffer) => {
            if (err) {
                return this.emit("error", err);
            }

            this.previousSize = stat.size;
            this.emit("bytes", buffer);
        });
    }
}

export interface ICrossServerChatOptions {
    servers: Array<IServer>;
    handlers: Array<Handler>;
}

export class CrossServerChat {
    private logWatchers: Array<LogWatcher> = [];
    private servers: Array<IServer> = [];
    private handlers: Array<Handler> = [];
    constructor(options: ICrossServerChatOptions) {
        if (!options || !options.servers || options.servers.length === 0) {
            throw "options must be defined and have at least 1 server specified.";
        }

        options.servers.forEach((server, idx) => {
            let logWatcher = new LogWatcher(server);
            logWatcher.on("bytes", (buffer: Buffer) => {
                this.newBytes(idx, buffer);
            });
            this.logWatchers.push(logWatcher);
        });

        this.servers = options.servers;
        this.handlers = options.handlers;
    }

    private newBytes(index: number, buffer: Buffer) {
        let otherServers = this.servers.filter((server, idx) => {
            return idx !== index;
        });

        let lines = buffer.toString().split("\n");

        lines.forEach((line) => {
            if (line.trim().length === 0) {
                return;
            }

            this.handlers.forEach((handler) => {
                let result = handler.handle(line);
                if (result.length === 0) {
                    return;
                }

                switch (handler.sendTo) {
                    case SendTo.OriginalServer:
                        this.sendMessage([this.servers[index]], result);
                        break;
                    case SendTo.OtherServers:
                        this.sendMessage(otherServers, result);
                        break;
                    default:
                        break;
                }
            });
        });
    }

    private sendMessage(servers:IServer[], messages:Array<String>) {
        if (servers.length === 0 || messages.length === 0) {
            return;
        }

        console.log("Sending messages:");
        messages.forEach((message) => {
            console.log(message);
        });
        console.log("To servers:");
        servers.forEach((server) => {
            console.log(server.host + ":" + server.port);
        });
    }
}

