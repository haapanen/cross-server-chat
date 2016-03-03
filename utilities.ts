///<reference path="typings/node/node.d.ts"/>

"use strict";
import * as fs from "fs";

export async function fileExists(filepath: string) {
    return new Promise<boolean>((resolve) => {
        fs.stat(filepath, (err, stats) => {
            if (err) {
                return resolve(false);
            }
            return resolve(!stats.isDirectory());
        });
    });
}

export function fileExistsSync(filepath: string) {
    try {
        return !fs.statSync(filepath).isDirectory();
    } catch (e) {
        return false;
    }
}

export function currentTimestamp() {
    return (new Date()).toISOString();
}

export interface IServerStatus {
    players: Array<string>;
    keys: any;
}

export function parseStatusResponse(message: Buffer): IServerStatus {
    let lines = message.toString().split("\n");
    let key: string;
    let keys: any = {};
    lines[1].split("\\").forEach((val: string) => {
        if (key) {
            keys[key] = val;
            key = undefined;
        } else {
            key = val;
        }
    });

    return {
        keys: keys,
        players: lines.slice(2, lines.length - 1).map((nameString) => { return nameString.split('"')[1]})
    };
}

var notAllowedCharacters = [
    34,
    59,
    92
];

export function escapeString(str) {
    if (!str) {
        return "";
    }

    var i, len, escaped = "", char;
    for (i = 0, len = str.length; i < len; i++) {
        char = str[i].charCodeAt(0);
        if (char >= 32 && char < 127 && notAllowedCharacters.indexOf(char) === -1) {
            escaped += str[i];
        }
    }

    return escaped;
}