///<reference path="typings/node/node.d.ts"/>
///<reference path="typings/commander/commander.d.ts"/>
///<reference path="typings/colors/colors.d.ts"/>
///<reference path="typings/prompt/prompt.d.ts"/>
"use strict";
import {BaseHandler} from "./handlers/handler";
import {CrossServerChat} from "./core";
import * as Core from "./core";
import * as Util from "./utilities";
import * as commander from "commander";
import * as fs from "fs";
import * as path from "path";
import * as colors from "colors";
import * as prompt from "prompt";

interface PackageJSON {
    version: string;
    description: string;
}

interface IApplicationOptions {
    config: string;
}

class Application {
    constructor() {
        let packageJSON:PackageJSON = JSON.parse(fs.readFileSync(path.join(__dirname, "./package.json")).toString());

        commander
            .version(packageJSON.version)
            .description(packageJSON.description)
            .option('-c, --config <configuration file>', 'specify custom path to configuration file. (Default: ./config.json)');

        commander
            .command("add")
            .description("add a server to the list of linked servers")
            .action(this.addServer.bind(this, commander));

        commander
            .command("start")
            .description("starts the cross server chat")
            .action(this.startCrossServerChat.bind(this, commander));

        commander.parse(process.argv);
    }

    async addServer(options:IApplicationOptions) {
        let file = (options && options.config) ? options.config : "./config.json";
        file = path.resolve(file);

        let config: Core.IConfig;
        if ((await Util.fileExists(file))) {
            try {
                config = await Core.loadConfig(file);
            } catch (e) {
                return console.error(e);
            }
        } else {
            config = {servers: [], handlers: []};
        }

        prompt.start();
        prompt.get({
            properties: {
                host: {
                    pattern: /(^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|localhost)/,
                    message: "host must be either an IP address or localhost",
                    default: "localhost",
                    required: true
                },
                port: {
                    message: "port must be between 1 and 65536",
                    default: "27960",
                    type: "number",
                    required: true
                },
                filepath: {
                    message: "filepath must exist",
                    required: true,
                    conform: Util.fileExistsSync
                },
                rconPassword: {
                    message: "rcon password must be correct",
                    hidden: true,
                    required: true
                }
            }
        } as prompt.Schema, async (err, result) => {
            if (err) {
                return console.error(Util.currentTimestamp(), colors.red("error: ") + `failed to read input from console.`, err);
            }

            let matches = config.servers.filter((server) => {
                return server.host === result.host && server.port === result.port;
            });
            if (matches.length > 0) {
                return console.error(Util.currentTimestamp(), colors.red("error: ") + `a server with address ${result.host}:${result.port} already exists`);
            }

            config.servers.push(result);

            try {
                await Core.saveConfig(file, config);
            } catch (e) {
                return console.error(e);
            }

            console.log(Util.currentTimestamp(), colors.green("success: "), `added server ${result.host}:${result.port}`);
        });
    }

    async startCrossServerChat(options: IApplicationOptions) {
        let file = (options && options.config) ? options.config : "./config.json";
        file = path.resolve(file);

        let config: Core.IConfig;
        try {
            config = await Core.loadConfig(file);
        } catch (e) {
        }
        if (!config || config.servers.length === 0) {
            return console.error("error: ".red + "add servers before starting the application");
        }

        let handlers: Array<any>;
        try  {
            handlers = [];
            config.handlers.forEach((handlerName) => {
                handlers.push(new (require(`./handlers/${handlerName}`).Handler))
            });
        } catch (e) {
            return console.error(e);
        }

        try {
            let logWatcher = new CrossServerChat({
                servers: config.servers,
                handlers: handlers
            });
        } catch (e) {
            console.log(e);
        }

    }
}

let application = new Application();

