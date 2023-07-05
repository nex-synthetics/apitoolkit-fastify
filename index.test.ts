import APIToolkit from './index';
import { PubSub } from '@google-cloud/pubsub';
import Fastify from "fastify"
const fastify = Fastify({
});

describe('testing headers and jsonpath redaction', () => {
    let myClassInstance: APIToolkit;

    beforeEach(() => {
        const pubsub = new PubSub({
            projectId: "pubsub_project_id"
        });
        myClassInstance = new APIToolkit(pubsub, "topic_id", "project_id", fastify, [], [], []);
    });

    it('should redact headers correctly', () => {
        const headers = { 'Authorization': ["token"], "User-Agent": ["MyApp"], "Content-Type": ["text/json"] }

        const headersToRedact = ['Authorization', 'content-type'];

        const redactedHeaders = myClassInstance['redactHeaders'](headers, headersToRedact);

        expect(redactedHeaders['Authorization']).toEqual(['[CLIENT_REDACTED]']);
        expect(redactedHeaders['Content-Type']).toEqual(['[CLIENT_REDACTED]']);
        expect(redactedHeaders['User-Agent']).toEqual(['MyApp']);
    });

    it('should redact fields correctly', () => {
        const body = '{"user": {"name": "John", "email": "john@example.com", "books": [{"title": "Book 1", "author": "Author 1"},{"title": "Book 2", "author": "Author 2"}]}}';
        const fieldsToRedact = ['$.user.email', 'user.books[*].author'];

        const redactedBody = myClassInstance['redactFields'](body, fieldsToRedact);

        expect(redactedBody).toContain('"email":"[CLIENT_REDACTED]"');
        expect(redactedBody).toContain('{"title":"Book 1","author":"[CLIENT_REDACTED]"},{"title":"Book 2","author":"[CLIENT_REDACTED]"}')
        expect(redactedBody).toContain('"name":"John"');
    });
});