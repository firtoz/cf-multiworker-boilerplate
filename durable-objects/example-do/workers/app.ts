import { DurableObject } from "cloudflare:workers";

/**
 * Example Durable Object implementation
 * This is a simple example that demonstrates the basic structure of a Durable Object
 */
export class TestDo extends DurableObject<Env> {
	/**
	 * Handle HTTP requests to this Durable Object
	 */
	fetch(
		/** The incoming request */
		_request: Request,
	): Response | Promise<Response> {
		// Example of a simple response
		return new Response("Hello World from TestDo!");

		// TODO: Implement your Durable Object logic here
		// - Parse request data
		// - Access Durable Object state with this.state
		// - Return appropriate response
	}
}

export default {
	fetch: () => new Response("Hello World!"),
};
