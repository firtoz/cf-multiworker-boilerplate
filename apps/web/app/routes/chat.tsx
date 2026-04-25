import type { RoutePath } from "@firtoz/router-toolkit";
import { ChatClient } from "~/components/chat/ChatClient";
import { ClientOnly } from "~/components/client/ClientOnly";
import { BackToHomeLink } from "~/components/shared/BackToHomeLink";
import type { Route } from "./+types/chat";

export const route: RoutePath<"/chat"> = "/chat";

export function meta(_args: Route.MetaArgs) {
	return [
		{ title: "Chat" },
		{
			name: "description",
			content: "Group chat: choose a room, set your name, and send messages.",
		},
	];
}

export default function ChatRoute(_props: Route.ComponentProps) {
	return (
		<ClientOnly
			fallback={
				<div className="max-w-2xl mx-auto w-full h-dvh max-h-dvh min-h-0 flex flex-col overflow-hidden gap-3 px-4 py-4">
					<BackToHomeLink />
					<div className="flex min-h-0 flex-1 items-center justify-center text-gray-600 dark:text-gray-400 text-sm">
						Loading chat…
					</div>
				</div>
			}
		>
			<ChatClient />
		</ClientOnly>
	);
}
