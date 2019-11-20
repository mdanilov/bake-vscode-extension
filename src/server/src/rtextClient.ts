import * as net from "net";

import * as rtextProtocol from "src/rtextProtocol";

class PendingRequest {
    public invocationId: number = 0;
    public command: string = "";
    public progressCallback?: Function;
    public resolveFunc: Function = () => {};
}

export class RtextClient {

    private _client = new net.Socket();
    private _invocationCounter = 0;
    private _connected = false;
    private _pendingRequests: PendingRequest[] = [];
    private _reconnectTimeout?: NodeJS.Timeout;

    public init() {
        this._client.connect(9001, "127.0.0.1", this.onConnect);
        this._client.on("data", (data) => { this.onData(data); });
        this._client.on("close", this.onClose);
    }

    public loadModel(progressCallback?: Function): Promise<rtextProtocol.LoadModelResponse> {
        const req = {
            command: "load_model",
        };
        return this.send(req, progressCallback);
    }

    public send(data: any, progressCallback: Function|undefined): Promise<any> {
        data.type = "request";
        data.version = 1;
        data.invocation_id = this._invocationCounter;

        const request = new PendingRequest();
        request.invocationId = this._invocationCounter;
        request.progressCallback = progressCallback;
        request.command = data.command;
        this._pendingRequests.push(request);

        const json = JSON.stringify(data);
        const payload = json.length + json;

        this._client.write(payload);
        this._invocationCounter++;

        return new Promise<object>((resolve) => {
            request.resolveFunc = resolve;
        });
    }

    private onConnect() {
        this._connected = true;
        console.log("Connected");
    }

    private onClose() {
        this._connected = false;
        console.log("Connection closed");

        this._reconnectTimeout = setTimeout(() => {
            this._client.connect(9001, "127.0.0.1", this.onConnect);
        }, 1000);
    }

    private onData(data: any) {
        const str = data.toString("utf-8");
        console.log("Received: " + str);
        const m = str.match(/^(\d+)\{/);
        if (m) {
            const lengthLength = m[1].length;
            const length = Number(m[1]);
            if (str.length >= lengthLength + length) {
                const json = str.slice(lengthLength, lengthLength + length);
                const obj = JSON.parse(json);

                const found = this._pendingRequests.findIndex((request) => {
                    return request.invocationId === obj.invocation_id;
                });

                if (found !== -1) {
                    if (obj.type === "response") {
                        if (this._pendingRequests[found].command === "load_model") {
                            this._pendingRequests[found].resolveFunc(<rtextProtocol.LoadModelResponse> obj);
                        }

                        this._pendingRequests.splice(found, 1);
                    } else if (obj.type === "progress" &&
                             this._pendingRequests[found].progressCallback) {
                        this._pendingRequests[found].progressCallback!(obj);
                    }
                }
            }
        }
    }
}
