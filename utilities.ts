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

export async function fileExistsSync(filepath: string) {
    return (await fileExists(filepath));
}

export function currentTimestamp() {
    return (new Date()).toISOString();
}