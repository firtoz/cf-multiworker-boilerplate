import { DurableObject } from "cloudflare:workers";

/**
 * A new Durable Object implementation
 * This is a Durable Object implementation for example-do
 */
export class ExampleDo extends DurableObject<Env> {
	/**
	 * Handle HTTP requests to this Durable Object
	 */
	fetch(
		/** The incoming request */
		_request: Request,
	): Response | Promise<Response> {
		// Example of a simple response
		return new Response("Hello World from ExampleDo!");

		// TODO: Implement your Durable Object logic here
		// - Parse request data
		// - Access Durable Object state with this.state
		// - Return appropriate response
	}
}

export default {
	fetch: () => new Response("Hello World from example-do!"),
};
