import { SockaDoSession, type SockaDoSessionConfig, SockaWebSocketDO } from "@firtoz/socka/do";
import { type ChatMessageRow, chatContract } from "cf-starter-chat-contract";
import { desc } from "drizzle-orm";
import { type DrizzleSqliteDODatabase, drizzle } from "drizzle-orm/durable-sqlite";
import { migrate } from "drizzle-orm/durable-sqlite/migrator";
import migrationConfig from "../drizzle/migrations.js";
import * as schema from "../src/schema";
import { chatMessagesTable } from "../src/schema";

type SessionData = { userId: string; displayName: string };

const TTL_MS = 15 * 60 * 1000;

function sortPresence(users: { userId: string; displayName: string }[]) {
	return [...users].sort(
		(a, b) => a.displayName.localeCompare(b.displayName) || a.userId.localeCompare(b.userId),
	);
}

type ChatroomDb = DrizzleSqliteDODatabase<typeof schema>;
// biome-ignore lint/suspicious/noExplicitAny: Socka's public constraint rejects contracts with pushes; keep this cast at the library boundary.
type ChatroomSession = SockaDoSession<any, SessionData, Env>;

export class ChatroomDo extends SockaWebSocketDO<ChatroomSession, Env> {
	readonly app = this.getBaseApp();
	private db: ChatroomDb | null = null;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env, {
			createSockaSession: (_c, ws) => new SockaDoSession(ws, this.sessions, this.buildConfig()),
		});
		void ctx.blockConcurrencyWhile(async () => {
			const db = drizzle(ctx.storage, { schema });
			await migrate(db, migrationConfig);
			this.db = db;
		});
	}

	private getDb(): ChatroomDb {
		if (this.db === null) {
			throw new Error("Chatroom DO database not ready");
		}
		return this.db;
	}

	// biome-ignore lint/suspicious/noExplicitAny: see ChatroomSession; handlers below keep their payload casts local.
	private buildConfig(): SockaDoSessionConfig<any, SessionData, Env> {
		return {
			contract: chatContract,
			wireFormat: "json",
			createData: (ctx) => {
				const u = new URL(ctx.req.url);
				const displayName = u.searchParams.get("name")?.trim() || "anon";
				return { userId: crypto.randomUUID(), displayName };
			},
			onAttached: async (session) => {
				this.touchActivityTtl();
				await session.broadcastPush(
					"userJoined",
					{ userId: session.data.userId, displayName: session.data.displayName },
					true,
				);
				const users = sortPresence(
					session.listPeers().map((d) => ({ userId: d.userId, displayName: d.displayName })),
				);
				await session.broadcastPush("presenceUpdated", { users }, false);
			},
			handlers: {
				listHistory: async (input: unknown) => {
					this.touchActivityTtl();
					const { limit } = input as { limit?: number };
					const lim = limit ?? 200;
					const rows = await this.getDb()
						.select()
						.from(chatMessagesTable)
						.orderBy(desc(chatMessagesTable.ts))
						.limit(lim);
					const messages: ChatMessageRow[] = rows.reverse().map((r) => ({
						id: r.id,
						ts: r.ts,
						userId: r.userId,
						displayName: r.displayName,
						text: r.text,
					}));
					return { messages };
				},
				listPresence: async (_input, session) => {
					this.touchActivityTtl();
					const users = sortPresence(
						session.listPeers().map((d) => ({ userId: d.userId, displayName: d.displayName })),
					);
					return { selfUserId: session.data.userId, users };
				},
				setDisplayName: async (input, session) => {
					this.touchActivityTtl();
					const { displayName } = input as { displayName: string };
					const t = displayName.trim();
					session.data.displayName = t;
					const users = sortPresence(
						session.listPeers().map((d) => ({ userId: d.userId, displayName: d.displayName })),
					);
					await session.broadcastPush("presenceUpdated", { users }, false);
					return { ok: true as const };
				},
				sendMessage: async (input, session) => {
					this.touchActivityTtl();
					const { text } = input as { text: string };
					const row: ChatMessageRow = {
						id: crypto.randomUUID(),
						ts: Date.now(),
						userId: session.data.userId,
						displayName: session.data.displayName,
						text,
					};
					await this.getDb().insert(chatMessagesTable).values({
						id: row.id,
						ts: row.ts,
						userId: row.userId,
						displayName: row.displayName,
						text: row.text,
					});
					await session.broadcastPush("roomMessage", row);
					return { ok: true as const };
				},
				clearHistory: async (_input, session) => {
					this.touchActivityTtl();
					await this.getDb().delete(chatMessagesTable);
					const ts = Date.now();
					await session.broadcastPush("historyCleared", {
						ts,
						clearedByUserId: session.data.userId,
						clearedByDisplayName: session.data.displayName,
					});
					return { ok: true as const };
				},
			},
			handleClose: async (session) => {
				this.touchActivityTtl();
				await session.broadcastPush(
					"userLeft",
					{ userId: session.data.userId, displayName: session.data.displayName },
					true,
				);
				const users = sortPresence(
					session
						.listPeers({ excludeSelf: true })
						.map((d) => ({ userId: d.userId, displayName: d.displayName })),
				);
				await session.broadcastPush("presenceUpdated", { users }, false);
			},
		};
	}

	/** Resets the 15m DO TTL. Not called from the constructor. */
	private touchActivityTtl(): void {
		void this.ctx.storage.setAlarm(Date.now() + TTL_MS);
	}

	override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
		this.touchActivityTtl();
		return super.webSocketMessage(ws, message);
	}

	override async alarm(): Promise<void> {
		await this.ctx.storage.deleteAll();
	}
}
