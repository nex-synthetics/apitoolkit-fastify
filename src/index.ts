import fetch from 'sync-fetch';
import { PubSub, Topic } from '@google-cloud/pubsub';
import { hrtime } from 'node:process';
import jsonpath from "jsonpath"
import { FastifyInstance } from 'fastify'
import { buildPayload } from "apitoolkit-js";
export type Config = {
    apiKey: string;
    fastify: FastifyInstance;
    rootURL?: string;
    redactHeaders?: string[];
    redactRequestBody?: string[];
    redactResponseBody?: string[]
}

type ClientMetadata = {
    project_id: string,
    pubsub_project_id: string,
    topic_id: string,
    pubsub_push_service_account: any,
}

type Payload = {
    duration: number
    host: string
    method: string
    path_params: any,
    project_id: string
    proto_major: number
    proto_minor: number
    query_params: Map<string, string[]>
    raw_url: string
    referer: string
    request_body: string
    request_headers: Object,
    response_body: string
    response_headers: Object
    sdk_type: string
    status_code: number
    timestamp: string
    url_path: string
}

export default class APIToolkit {
    #topic: string;
    #pubsub: PubSub;
    #project_id: string;
    #redactHeaders: string[]
    #redactRequestBody: string[]
    #redactResponseBody: string[]
    #fastify: FastifyInstance
    #startTimes = new Map<string, bigint>()

    constructor(pubsub: PubSub, topic: string, project_id: string, fastify: FastifyInstance, redactHeaders: string[], redactReqBody: string[], redactRespBody: string[]) {
        this.#topic = topic
        this.#pubsub = pubsub
        this.#project_id = project_id
        this.#redactHeaders = redactHeaders
        this.#redactRequestBody = redactReqBody
        this.#redactResponseBody = redactRespBody
        this.#fastify = fastify
        this.init = this.init.bind(this)
    }

    static NewClient({ apiKey, fastify, rootURL = "https://app.apitoolkit.io", redactHeaders = [], redactRequestBody = [], redactResponseBody = [] }: Config) {
        const resp = fetch(rootURL + "/api/client_metadata", {
            method: 'GET',
            headers: {
                Authorization: "Bearer " + apiKey,
                Accept: 'application/json',
            },
        })
        if (!resp.ok) throw new Error(`Error getting apitoolkit client_metadata ${resp.status}`);

        const clientMetadata = resp.json() as ClientMetadata
        const { pubsub_project_id, topic_id, project_id, pubsub_push_service_account } = clientMetadata;
        const pubsubClient = new PubSub({
            projectId: pubsub_project_id,
            authClient: (new PubSub()).auth.fromJSON(pubsub_push_service_account),
        });

        return new APIToolkit(pubsubClient, topic_id, project_id, fastify, redactHeaders, redactRequestBody, redactResponseBody);
    }

    private getStringValue(val: unknown): string {
        if (typeof val === "string") {
            return val;
        } else if (Buffer.isBuffer(val)) {
            return val.toString();
        } else {
            try {
                return JSON.stringify(val);
            } catch (error) {
                return "";
            }
        }
    }

    private getQuery(query: unknown) {
        try {
            return { ...(query as any) }
        } catch (error) {
            return {}
        }
    }

    public init() {
        this.#fastify.addHook('preHandler', (request, reply, done) => {
            this.#startTimes.set(request.id, hrtime.bigint())
            done()
        });
        this.#fastify.addHook('onSend', async (request, reply, data) => {
            try {
                let reqBody = this.getStringValue(request.body)
                let resBody = this.getStringValue(data)

                const reqObjEntries = Object.entries(request.headers).map(([k, v]) => {
                    if (typeof v === "string") return [k, [v]]
                    return [k, v]
                })

                const reqHeaders = Object.fromEntries(reqObjEntries)

                const resObjEntries = Object.entries(reply.getHeaders()).map(([k, v]) => {
                    if (typeof v === "string") return [k, [v]]
                    return [k, v]
                })
                const resHeaders = Object.fromEntries(resObjEntries)

                const query = this.getQuery(request.query)
                const queryObjEntries = Object.entries(query).map(([k, v]) => {
                    if (typeof v === "string") return [k, [v]]
                    return [k, v]
                })
                const queryParams = Object.fromEntries(queryObjEntries)
                const target = this.#startTimes.get(request.id)
                const start_time = target ? target : hrtime.bigint()
                this.#startTimes.delete(request.id)
                const pathParams = request.params ?? {}
                const payload = buildPayload({
                    start_time: start_time,
                    host: request.hostname,
                    method: request.method,
                    reqParams: pathParams,
                    project_id: this.#project_id,
                    reqQuery: queryParams,
                    reqBody: reqBody,
                    respBody: resBody,
                    responseHeaders: resHeaders,
                    requestHeaders: reqHeaders,
                    sdk_type: "JsFastify",
                    status_code: reply.statusCode,
                    raw_url: request.url,
                    url_path: request.routerPath,
                    redactHeaderLists: this.#redactHeaders,
                    redactRequestBody: this.#redactRequestBody,
                    redactResponseBody: this.#redactResponseBody,
                    errors: [],
                    service_version: "",
                    tags: [],
                    msg_id: "",
                    parent_id: undefined
                })
                this.#pubsub.topic(this.#topic).publishMessage({ json: payload })
            } catch (error) {
                console.log(error)
            }
            return data
        });
    }

}