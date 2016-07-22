///<reference path="../node_modules/@types/node/index.d.ts"/>

import * as childProcess from "child_process";
import * as chokidar from "chokidar";
import * as fs from "fs";
import * as path from "path";
import * as dgram from "dgram";
import * as request from "request";
import * as cheerio from "cheerio";

interface IServer {
    // log file to read chat from
    log: string;
    // ip:port of the server
    address: string;
    // rcon password of the server
    rconPassword: string;
    // the name that will be displayed on the chat.
    // retrieved automatically with getstatus
    hostname?: string;
    // the file descriptor
    fd?: number;
    // the file watcher object
    watcher?: fs.FSWatcher;
    // current number of bytes read
    bytesRead?: number;
}

interface IServerStatus {
    players: string[];
    keys: {
        [index: string]: string;
    }
}

/**
 * Creates an out of bounds packet for oob communication with a server
 * @param message
 * @returns {Buffer}
 */
const createPacket = (message: string): Buffer => {
    return new Buffer("\xff\xff\xff\xff" + message, "ascii");
};

/**
 * Sends the host the message and returns the result
 * @param host
 * @param port
 * @param message
 * @param timeout
 * @returns {Promise<string>}
 */
const sendUdpRequest = (host: string, port: number, message: string, timeout = 1000): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
        const client = dgram.createSocket("udp4");
        const packet = createPacket(message);

        // timeout if the server is unreachable
        let timer = setTimeout(() => {
            client.close();
            return reject(`UDP request to ${host}:${port} timed out.`);
        }, timeout);

        client.send(packet, 0, packet.length, port, host, (err) => {
            if (err) {
                client.close();
                clearTimeout(timer);
                return reject(err);
            }
        });

        client.on("message", (bytes: Buffer) => {
            clearTimeout(timer);
            client.close();
            return resolve(bytes.toString());
        });
    });
};

/**
 * Parses the status response into a server status object
 * @param statusResponse
 */
const parseStatusResponse = (statusResponse: string): IServerStatus => {
    let result: IServerStatus = {
        keys: {},
        players: []
    };

    // parse the key value pairs
    let rows = statusResponse.split("\n");
    let key = "";
    rows[1].split("\\").forEach(keyValue => {
        if (key.length === 0) {
            key = keyValue;
        } else {
            result.keys[key] = keyValue;
            key = "";
        }
    });

    // parse the players
    result.players = rows.slice(2).map(player => {
        return player.split("\"")[1];
    });
    return result;
};

/**
 * Gets ip and port from the ipPort string
 * @param host
 * @returns {{ipAddress: string, port: number}}
 */
const getIpPort = (host: string): { ipAddress: string, port: number } => {
    let address: string;
    let port: number = 27960;
    let ipPort = host.split(":");
    address = ipPort[0];
    if (ipPort.length === 2) {
        port = parseInt(ipPort[1], 10);
    }
    return {
        ipAddress: address,
        port
    };
};

/**
 * Gets the sv_hostname value of the server
 * @param server
 * @returns {Promise<string>}
 */
const getHostName = (server: IServer): Promise<string> => {
    return new Promise<string>(async (resolve, reject) => {
        try {
            let { ipAddress, port } = getIpPort(server.address);

            let status = parseStatusResponse(await sendUdpRequest(ipAddress, port, "getstatus"));

            return resolve(status.keys["sv_hostname"]);
        } catch (exception) {
            return reject(exception);
        }
    });
};

/**
 * Fetches the host names from servers and sets them to the server objects
 * @param servers
 * @returns {Promise<T>}
 */
const setHostNames = (servers:IServer[]) => {
    return new Promise((resolve, reject) => {
        try {
            let hostnamePromises: Promise<string>[] = [];
            servers.forEach((server) => {
                hostnamePromises.push(getHostName(server));
            });

            Promise.all(hostnamePromises).then((hostnames: string[]) => {
                hostnames.forEach((hostname, index) => {
                    servers[index].hostname = hostname;
                });

                return resolve();
            }).catch((err) => {
                return reject(err);
            });
        } catch (exception) {
            return reject(exception);
        }
    });
}

/**
 * Opens a file and sets the server file handle for each server
 * @param servers
 * @returns {Promise<T>}
 */
const setFileHandles = (servers: IServer[]): Promise<void> => {
    return new Promise((resolve, reject) => {
        try {
            let promises: Promise<number>[] = [];

            servers.forEach(server => {
                promises.push(new Promise<number>((resolve, reject) => {
                    try {
                        fs.open(server.log, "r", (err, fd) => {
                            if (err) {
                                return reject(err);
                            }
                            return resolve(fd);
                        });
                    } catch (exception) {
                        return reject(exception);
                    }
                }));
            });

            Promise.all(promises).then((fds) => {
                fds.forEach((fd, index) => {
                    servers[index].fd = fd;
                });

                return resolve();
            }).catch((err) => {
                return reject(err);
            });
        } catch (exception) {
            return reject(exception);
        }
    });
};

/**
 * Creates a watcher for server logs
 * @param server
 * @returns {fs.FSWatcher}
 */
const createWatcher = (server: IServer, changeCallback: (path: string, stat: fs.Stats) => void) => {
    server.bytesRead = 0;

    fs.stat(server.log, (err, stats) => {
        if (err) {
            console.error(`Ignoring server: ${server.hostname}`);
            console.error(err);
            return;
        }
        server.bytesRead = stats.size;
    });

    let watcher = chokidar.watch(server.log, {
        usePolling: true,
        interval: 200
    });

    watcher.on("change", changeCallback);

    return watcher;
};

/**
 * Reads `length` bytes from file described by `fd` starting from `position`
 * @param fd
 * @param position
 * @param length
 * @returns {Promise<Buffer>}
 */
const readBytes = (fd: number, position: number, length: number) => {
    return new Promise<Buffer>((resolve, reject) => {
        try {
            let buffer = new Buffer(length);

            fs.read(fd, buffer, 0, length, position, (err, bytesRead, buffer) => {
                if (err) {
                    return reject(err);
                }

                return resolve(buffer);
            });
        } catch (exception) {
            return reject(exception);
        }
    });
};

/**
 * Creates a watcher for each server
 * @param servers
 * @returns {Promise<T>}
 */
const createWatchers = (servers: IServer[], newMessage: (server: IServer, message: string) => void) => {
    return new Promise((resolve, reject) => {
        try {
            servers.forEach(server => {
                server.watcher = createWatcher(server, async (path, stat) => {
                    const bytesRead = server.bytesRead ? server.bytesRead : 0;
                    if (server.fd !== undefined) {
                        const newBytes = await readBytes(server.fd, server.bytesRead ? server.bytesRead : 0, stat.size - bytesRead);
                        server.bytesRead = stat.size;

                        newMessage(server, newBytes.toString().trim());
                    }
                });
            });
            return resolve();
        } catch (exception) {
            return reject(exception);
        }
    });
};

/**
 * Which servers to send the reply to
 */
enum SendTo {
    // Do nothing
    None,
    // Send everywhere
    All,
    // Send everywhere except the original server
    Others
};

/**
 * Removes any disallowed characters from the string
 * @param text
 * @returns {string}
 */
const escapeString = (text: string) => {
    const notAllowedCharacters = [
        34,
        59,
        92
    ];

    let escaped = "";
    for (let i = 0, len = text.length; i < len; ++i) {
        const char = text.charCodeAt(i);
        if (char >= 32 && char < 127 && notAllowedCharacters.indexOf(char) === -1) {
            escaped += text[i];
        }
    }

    return escaped;
};

interface IParseResult {
    sendTo: SendTo;
    message: string;
}

const sayPattern = /^say: (.+): (.+)$/;
/**
 * Checks if the given message is an actual say message or just some other log entry
 * @param message
 * @returns {Promise<IParseResult>}
 */
const testSayPattern = (server: IServer, message: string): Promise<IParseResult> => {
    return new Promise<IParseResult>((resolve, reject) => {
        try {
            if (!message.startsWith("say: ")) {
                return resolve({
                    message: "",
                    sendTo: SendTo.None
                });
            }

            let result = message.match(sayPattern);
            if (result === null) {
                return resolve({
                    message: "",
                    sendTo: SendTo.None
                });
            }

            return resolve({
                message: `${server.hostname}^7@${result[1]}^7: ^2${result[2]}`,
                sendTo: SendTo.Others
            });
        } catch (exception) {
            return reject(exception);
        }
    });
};

const urlPattern = /(http|https):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&amp;:\/~+#-]*[\w@?^=%&amp;\/~+#-])?/;
/**
 * Checks whether the given message has an URL and if it does, tries to
 * fetch the title.
 * @param message
 * @returns {Promise<IParseResult>}
 */
const testUrlPattern = (server: IServer, message: string): Promise<IParseResult> => {
    return new Promise<IParseResult>((resolve, reject) => {
        try {
            let result = message.match(urlPattern);
            if (result === null) {
                return resolve({
                    message: "",
                    sendTo: SendTo.None
                });
            }

            request(result[0], (err, response, body) => {
                if (err) {
                    console.error(err);
                    return resolve({
                        message: "",
                        sendTo: SendTo.None
                    });
                }

                let $ = cheerio.load(body);
                return resolve({
                    message: `^7${$("title").text()}`,
                    sendTo: SendTo.All
                });
            });
        } catch (exception) {
            return reject(exception);
        }
    })
};

/**
 * Checks if the message matches any of the patterns
 * @param message
 * @returns {Promise<IParseResult>[]}
 */
const parseMessage = (server: IServer, message: string): Promise<IParseResult>[] => {
    return [
        testSayPattern(server, message),
        testUrlPattern(server, message)
    ];
};

class Application {
    private servers: IServer[];
    constructor() {
        try {
            this.servers = JSON.parse(fs.readFileSync(path.join(__dirname, "servers.json")).toString());
        } catch (exception) {
            this.servers = [];
        }

        this.start();
    }

    private async start() {
        try {
            await setHostNames(this.servers);
            await setFileHandles(this.servers);
            await createWatchers(this.servers, (server, message) => {
                let parseResults = parseMessage(server, message);
                parseResults.forEach(result => {
                    result.then((parseResult: IParseResult) => {
                        let sendToServers: IServer[];
                        switch (parseResult.sendTo) {
                            case SendTo.All:
                                sendToServers = this.servers;
                                break;
                            case SendTo.Others:
                                sendToServers = this.servers.filter(s => s !== server);
                                break;
                            default:
                                sendToServers = [];
                        }

                        sendToServers.forEach(sendToServer => {
                            let { ipAddress, port } = getIpPort(sendToServer.address);
                            sendUdpRequest(ipAddress, port, `rcon ${sendToServer.rconPassword} qsay ${escapeString(parseResult.message)}`);
                        });
                    }).catch((err) => {
                        console.error(err);
                    });
                });
            });
        } catch (exception) {
            console.error(`Could not initialize the cross server chat: ${exception}`);
        }
    }
}

const application = new Application();