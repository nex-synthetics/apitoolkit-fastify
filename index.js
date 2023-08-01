"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _APIToolkit_topic, _APIToolkit_pubsub, _APIToolkit_project_id, _APIToolkit_redactHeaders, _APIToolkit_redactRequestBody, _APIToolkit_redactResponseBody, _APIToolkit_fastify, _APIToolkit_startTimes;
Object.defineProperty(exports, "__esModule", { value: true });
const node_fetch_1 = __importDefault(require("node-fetch"));
const pubsub_1 = require("@google-cloud/pubsub");
const node_process_1 = require("node:process");
const jsonpath_1 = __importDefault(require("jsonpath"));
class APIToolkit {
    constructor(pubsub, topic, project_id, fastify, redactHeaders, redactReqBody, redactRespBody) {
        _APIToolkit_topic.set(this, void 0);
        _APIToolkit_pubsub.set(this, void 0);
        _APIToolkit_project_id.set(this, void 0);
        _APIToolkit_redactHeaders.set(this, void 0);
        _APIToolkit_redactRequestBody.set(this, void 0);
        _APIToolkit_redactResponseBody.set(this, void 0);
        _APIToolkit_fastify.set(this, void 0);
        _APIToolkit_startTimes.set(this, new Map());
        __classPrivateFieldSet(this, _APIToolkit_topic, topic, "f");
        __classPrivateFieldSet(this, _APIToolkit_pubsub, pubsub, "f");
        __classPrivateFieldSet(this, _APIToolkit_project_id, project_id, "f");
        __classPrivateFieldSet(this, _APIToolkit_redactHeaders, redactHeaders, "f");
        __classPrivateFieldSet(this, _APIToolkit_redactRequestBody, redactReqBody, "f");
        __classPrivateFieldSet(this, _APIToolkit_redactResponseBody, redactRespBody, "f");
        __classPrivateFieldSet(this, _APIToolkit_fastify, fastify, "f");
        this.init = this.init.bind(this);
    }
    static NewClient({ apiKey, fastify, rootURL = "https://app.apitoolkit.io", redactHeaders = [], redactRequestBody = [], redactResponseBody = [] }) {
        return __awaiter(this, void 0, void 0, function* () {
            const resp = yield (0, node_fetch_1.default)(rootURL + "/api/client_metadata", {
                method: 'GET',
                headers: {
                    Authorization: "Bearer " + apiKey,
                    Accept: 'application/json',
                },
            });
            if (!resp.ok)
                throw new Error(`Error getting apitoolkit client_metadata ${resp.status}`);
            const clientMetadata = yield resp.json();
            const { pubsub_project_id, topic_id, project_id, pubsub_push_service_account } = clientMetadata;
            const pubsubClient = new pubsub_1.PubSub({
                projectId: pubsub_project_id,
                authClient: (new pubsub_1.PubSub()).auth.fromJSON(pubsub_push_service_account),
            });
            return new APIToolkit(pubsubClient, topic_id, project_id, fastify, redactHeaders, redactRequestBody, redactResponseBody);
        });
    }
    getStringValue(val) {
        if (typeof val === "string") {
            return val;
        }
        else if (Buffer.isBuffer(val)) {
            return val.toString();
        }
        else {
            try {
                return JSON.stringify(val);
            }
            catch (error) {
                return "";
            }
        }
    }
    getQuery(query) {
        try {
            return Object.assign({}, query);
        }
        catch (error) {
            return {};
        }
    }
    init() {
        __classPrivateFieldGet(this, _APIToolkit_fastify, "f").addHook('preHandler', (request, reply, done) => {
            __classPrivateFieldGet(this, _APIToolkit_startTimes, "f").set(request.id, node_process_1.hrtime.bigint());
            done();
        });
        __classPrivateFieldGet(this, _APIToolkit_fastify, "f").addHook('onSend', (request, reply, data) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                let reqBody = this.getStringValue(request.body);
                let resBody = this.getStringValue(data);
                const reqObjEntries = Object.entries(request.headers).map(([k, v]) => {
                    if (typeof v === "string")
                        return [k, [v]];
                    return [k, v];
                });
                const reqHeaders = Object.fromEntries(reqObjEntries);
                const resObjEntries = Object.entries(reply.getHeaders()).map(([k, v]) => {
                    if (typeof v === "string")
                        return [k, [v]];
                    return [k, v];
                });
                const resHeaders = Object.fromEntries(resObjEntries);
                const query = this.getQuery(request.query);
                const queryObjEntries = Object.entries(query).map(([k, v]) => {
                    if (typeof v === "string")
                        return [k, [v]];
                    return [k, v];
                });
                const queryParams = Object.fromEntries(queryObjEntries);
                const target = __classPrivateFieldGet(this, _APIToolkit_startTimes, "f").get(request.id);
                const start_time = target ? target : node_process_1.hrtime.bigint();
                __classPrivateFieldGet(this, _APIToolkit_startTimes, "f").delete(request.id);
                const pathParams = (_a = request.params) !== null && _a !== void 0 ? _a : {};
                const payload = {
                    duration: Number(node_process_1.hrtime.bigint() - start_time),
                    host: request.hostname,
                    method: request.method,
                    path_params: pathParams,
                    project_id: __classPrivateFieldGet(this, _APIToolkit_project_id, "f"),
                    proto_minor: 1,
                    proto_major: 1,
                    query_params: queryParams,
                    raw_url: request.url,
                    referer: (_b = request.headers.referer) !== null && _b !== void 0 ? _b : '',
                    request_body: Buffer.from(this.redactFields(reqBody, __classPrivateFieldGet(this, _APIToolkit_redactRequestBody, "f"))).toString('base64'),
                    request_headers: this.redactHeaders(reqHeaders, __classPrivateFieldGet(this, _APIToolkit_redactHeaders, "f")),
                    response_body: Buffer.from(this.redactFields(resBody, __classPrivateFieldGet(this, _APIToolkit_redactResponseBody, "f"))).toString('base64'),
                    response_headers: this.redactHeaders(resHeaders, __classPrivateFieldGet(this, _APIToolkit_redactHeaders, "f")),
                    sdk_type: "JsExpress",
                    status_code: reply.statusCode,
                    timestamp: new Date().toISOString(),
                    url_path: request.routerPath
                };
                __classPrivateFieldGet(this, _APIToolkit_pubsub, "f").topic(__classPrivateFieldGet(this, _APIToolkit_topic, "f")).publishMessage({ json: payload });
            }
            catch (error) {
                console.log(error);
            }
            return data;
        }));
    }
    redactHeaders(headers, headersToRedact) {
        for (const [key, value] of Object.entries(headers)) {
            if (headersToRedact.some(header => header.includes(key) || header.includes(key.toLocaleLowerCase()))) {
                headers[key] = ["[CLIENT_REDACTED]"];
            }
            else if (key === "Cookie" || key === "cookie") {
                headers[key] = ["[CLIENT_REDACTED]"];
            }
            else {
                headers[key] = value;
            }
        }
        return headers;
    }
    redactFields(body, fieldsToRedact) {
        try {
            const bodyOB = JSON.parse(body);
            fieldsToRedact.forEach(path => {
                jsonpath_1.default.apply(bodyOB, path, function () { return "[CLIENT_REDACTED]"; });
            });
            return JSON.stringify(bodyOB);
        }
        catch (error) {
            return "";
        }
    }
}
exports.default = APIToolkit;
_APIToolkit_topic = new WeakMap(), _APIToolkit_pubsub = new WeakMap(), _APIToolkit_project_id = new WeakMap(), _APIToolkit_redactHeaders = new WeakMap(), _APIToolkit_redactRequestBody = new WeakMap(), _APIToolkit_redactResponseBody = new WeakMap(), _APIToolkit_fastify = new WeakMap(), _APIToolkit_startTimes = new WeakMap();