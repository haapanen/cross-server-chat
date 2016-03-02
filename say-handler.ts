"use strict";
import {IHandlerOptions} from "./handler";

import {Handler} from "./handler";
export class SayHandler extends Handler {
    private sayPattern = /^say: (.+): (.+)$/;
    private teamSayPattern = /^sayteam: (.+): (.+)$/;
    private fireteamSayPattern = /^saybuddy: (.+): (.+)$/;

    constructor(options: IHandlerOptions) {
        super(options);
    }

    handle(line: string): Array<string> {
        let result = line.match(this.sayPattern);
        if (result === null) {
            return [];
        }
        return [result[1] + " said " + result[2]];
    }
}
