import { index, type RouteConfig, route } from "@react-router/dev/routes";

export default [
	index("routes/home.tsx"),
	route("visitors", "routes/visitors.tsx"),
	route("chat", "routes/chat.tsx"),
	route("ping-do", "routes/ping-do.tsx"),
] satisfies RouteConfig;
