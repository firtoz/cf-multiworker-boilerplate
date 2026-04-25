export type { PingDoRpc } from "./ping-do";

export type PingWorkerRpc = Rpc.WorkerEntrypointBranded & {
	pingServiceAck(): Promise<string>;
};
