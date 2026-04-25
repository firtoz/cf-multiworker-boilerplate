import alchemy from "alchemy";
import { Worker, WorkerRef, WorkerStub } from "alchemy/cloudflare";
import { alchemyPassword } from "../../alchemy/password";
import type { PingWorkerRpc } from "../ping-do/workers/rpc";

const app = await alchemy("other-worker", { password: alchemyPassword });

await WorkerStub<PingWorkerRpc>("ping-worker-service-stub", {
	name: "cf-starter-ping-do",
	url: false,
});

export const otherWorker = await Worker("other-worker", {
	name: "cf-starter-other-worker",
	entrypoint: new URL("./workers/app.ts", import.meta.url).pathname,
	compatibility: "node",
	placement: { mode: "smart" },
	adopt: true,
	bindings: {
		PING: WorkerRef<PingWorkerRpc>({ service: "cf-starter-ping-do" }),
	},
});

console.log({ worker: "other-worker", scriptName: otherWorker.name });

await app.finalize();
