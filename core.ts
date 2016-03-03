"use strict";
///<reference path="typings/node/node.d.ts"/>
///<reference path="typings/colors/colors.d.ts"/>
///<reference path="typings/chokidar/chokidar.d.ts"/>

import {IServerStatus} from "./utilities";
import {BaseHandler} from "./handlers/handler";
import {SendTo} from "./handlers/handler";
import {EventEmitter} from "events";
import * as fs from "fs";
import * as Util from "./utilities";
import * as colors from "colors";
import * as chokidar from "chokidar";
import * as dgram from "dgram";
import {escapeString} from "./utilities";

export interface IServer {
    host: string;
    port: number;
    filepath: string;
    rconPassword: string;
    client: dgram.Socket;
    hostname: string;
    active: boolean;
    statusResponse: IServerStatus;
}

export interface IConfig {
    servers: Array<IServer>;
    handlers: Array<string>;
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
    private previousSize:number = 0;
    private fd:number;

    constructor(server:IServer) {
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

    private fileChanged(path:string, stat:fs.Stats) {
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
    handlers: Array<BaseHandler>;
}

export class CrossServerChat {
    private logWatchers:Array<LogWatcher> = [];
    private servers:Array<IServer> = [];
    private handlers:Array<BaseHandler> = [];
    private serverMessageBuffers:Array<Array<string>> = [];

    constructor(options:ICrossServerChatOptions) {
        if (!options || !options.servers || options.servers.length === 0) {
            throw "options must be defined and have at least 1 server specified.";
        }

        this.servers = options.servers;
        this.handlers = options.handlers;

        options.servers.forEach((server, idx) => {
            let logWatcher = new LogWatcher(server);
            logWatcher.on("bytes", (buffer:Buffer) => {
                this.newBytes(idx, buffer);
            });
            this.logWatchers.push(logWatcher);
            server.client = dgram.createSocket("udp4");
            this.setServerName(server);
            this.serverMessageBuffers.push([]);
        });

        this.initMessageSender();
    }

    private newBytes(index:number, buffer:Buffer) {
        let otherServers = [] as Array<number>;
        this.servers.forEach((server, idx) => {
            if (idx !== index) {
                otherServers.push(idx);
            }
        });

        let allServers = this.servers.map((server, idx) => {
            return idx;
        });

        let lines = buffer.toString().split("\n");

        lines.forEach((line) => {
            if (line.trim().length === 0) {
                return;
            }

            this.handlers.forEach((handler) => {
                let result = handler.handle(line, this.servers[index]);
                if (result.length === 0) {
                    return;
                }

                switch (handler.sendTo) {
                    case SendTo.OriginalServer:
                        this.addMessageToBuffers([index], result);
                        break;
                    case SendTo.OtherServers:
                        this.addMessageToBuffers(otherServers, result);
                        break;
                    case SendTo.AllServers:
                        this.addMessageToBuffers(allServers, result);
                    default:
                        break;
                }
            });
        });
    }

    private addMessageToBuffers(serverIndices:Array<number>, messages:Array<string>) {
        if (serverIndices.length === 0 || messages.length === 0) {
            return;
        }

        serverIndices.forEach((serverIdx) => {
            messages.forEach((message) => {
                this.serverMessageBuffers[serverIdx].push(message);
            });
        });
    }

    private initMessageSender() {
        this.servers.forEach((server, index) => {
            setInterval(() => {
                if (!server.active) {
                    return;
                }

                if (this.serverMessageBuffers[index].length === 0) {
                    return;
                }

                let message = this.serverMessageBuffers[index].shift();
                let packet = new Buffer(`\xff\xff\xff\xffrcon ${server.rconPassword} qsay "${escapeString(message)}"`, "ascii");

                server.client.send(packet, 0, packet.length, server.port, server.host);
            }, 550);
        });
    }

    private setServerName(server:IServer) {
        let client = dgram.createSocket("udp4");
        // if getstatus fails, just ignore the server
        let timeout = setTimeout(() => {
            client.close();
            server.active = false;
            console.log(colors.red("error: ") + `server ${server.host}:${server.port} is unreachable. Ignoring server.`);
        }, 3000);
        client.on('message', (message) => {
            clearTimeout(timeout);
            server.active = true;
            server.statusResponse = Util.parseStatusResponse(message);
            server.hostname = server.statusResponse.keys["sv_hostname"];
            client.close();
        });
        let getStatusPacket = new Buffer("\xff\xff\xff\xffgetstatus", "ascii");
        client.send(getStatusPacket, 0, getStatusPacket.length, server.port, server.host);
    }
}

