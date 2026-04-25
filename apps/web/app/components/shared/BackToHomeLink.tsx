import { href, Link } from "react-router";

const linkClassName =
	"inline-flex w-fit shrink-0 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800";

export function BackToHomeLink() {
	return (
		<Link to={href("/")} className={linkClassName}>
			← Back to home
		</Link>
	);
}
