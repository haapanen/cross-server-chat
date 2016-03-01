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