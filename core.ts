///<reference path="typings/node/node.d.ts"/>
///<reference path="typings/colors/colors.d.ts"/>

"use strict";
import * as fs from "fs";
import * as Util from "./utilities";
import * as colors from "colors";

export interface IServer {
    host: string;
    port: number;
    filepath: string;
    rconPassword: string;
}

export interface IConfig {
    servers: Array<IServer>;
}

export async function loadConfig(filepath: string) {
    return new Promise<IConfig>((resolve, error) => {
        fs.readFile(filepath, (err, buffer) => {
            if (err) {
                return error(err);
            }

            let config: IConfig;
            try {
                config = JSON.parse(fs.readFileSync(filepath).toString());
            } catch (e) {
                return error(Util.currentTimestamp(), colors.red("error: ") + `could not parse ${filepath}. ` + e);
            }

            return resolve(config);
        });
    });
}

export async function saveConfig(filepath: string, config: IConfig) {
    return new Promise<IConfig>((resolve, error) => {
        fs.writeFile(filepath, JSON.stringify(config, null, 4), (err) => {
            if (err) {
                return error(err);
            }
            return resolve();
        });
    })
}

export interface ILogWatcherOptions {

}

export class LogWatcher {
    constructor(options: ILogWatcherOptions) {

    }
}