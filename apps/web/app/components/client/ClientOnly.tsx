import type { ReactNode } from "react";
import { useEffect, useState } from "react";

interface ClientOnlyProps {
	children: ReactNode;
	fallback?: ReactNode;
}

/**
 * ClientOnly component ensures that the children are only rendered on the client side
 * This is useful for components that use browser APIs or libraries that don't support SSR
 */
export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
	const [isClient, setIsClient] = useState(false);

	useEffect(() => {
		setIsClient(true);
	}, []);

	return isClient ? children : fallback;
}
