"use strict";
import {IServer} from "../core";

export enum SendTo {
    None,
    OriginalServer,
    OtherServers,
    AllServers
}

export interface IHandlerOptions {
    sendTo: SendTo;
}

export class BaseHandler {
    get sendTo() {
        return (this.options && this.options.sendTo) ? this.options.sendTo : SendTo.OtherServers;
    };

    private options: IHandlerOptions;

    constructor(options?: IHandlerOptions) {
        this.options = options;
    }

    handle(line: string, server: IServer): Array<string> {
        return [line];
    }
}