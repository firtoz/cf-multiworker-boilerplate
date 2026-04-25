import alchemy from "alchemy";
import { DurableObjectNamespace, Worker } from "alchemy/cloudflare";
import { alchemyPassword } from "../../alchemy/password";

const app = await alchemy("chatroom-do", { password: alchemyPassword });

export const ChatroomDo = await DurableObjectNamespace<Rpc.DurableObjectBranded>(
	"chatroom-do-ChatroomDo-class",
	{
		className: "ChatroomDo",
		sqlite: true,
	},
);

export const chatroomWorker = await Worker("chatroom-do", {
	name: "cf-starter-chatroom-do",
	entrypoint: new URL("./workers/app.ts", import.meta.url).pathname,
	compatibility: "node",
	placement: { mode: "smart" },
	adopt: true,
	bindings: {
		ChatroomDo,
	},
});

console.log({ worker: "chatroom-do", scriptName: chatroomWorker.name });

await app.finalize();
