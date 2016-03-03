"use strict";

import {BaseHandler} from "./handler";
import {IServer} from "../core";

export class Handler extends BaseHandler {

    private sayPattern = /^say: (.+): (.+)$/;
    private teamSayPattern = /^sayteam: (.+): (.+)$/;
    private fireteamSayPattern = /^saybuddy: (.+): (.+)$/;

    constructor() {
        super();
    }

    handle(line: string, server: IServer): Array<string> {
        if (!line.startsWith("say: ")) {
            return [];
        }
        let result = line.match(this.sayPattern);
        if (result === null) {
            return [];
        }
        return [server.hostname + ":" + result[1] + " said " + result[2]];
    }
}
