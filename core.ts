///<reference path="typings/node/node.d.ts"/>
///<reference path="typings/colors/colors.d.ts"/>
///<reference path="typings/chokidar/chokidar.d.ts"/>


import {EventEmitter} from "events";
"use strict";
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
                chokidar.watch(server.filepath).on('change', this.fileChanged.bind(this));
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

            this.emit("bytes", buffer);
        });
    }
}

export interface ICrossServerChatOptions {
    servers: Array<IServer>;
}

export class CrossServerChat {
    private logWatchers: Array<LogWatcher> = [];
    constructor(options: ICrossServerChatOptions) {
        if (!options || !options.servers || options.servers.length === 0) {
            throw "options must be defined and have atleast 1 server specified.";
        }

        options.servers.forEach((server, idx) => {
            let logWatcher = new LogWatcher(server);
            logWatcher.on("bytes", (buffer: Buffer) => {
                
            });
            this.logWatchers.push(logWatcher);
        });
    }
}

