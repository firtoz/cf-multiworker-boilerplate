CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`ts` integer NOT NULL,
	`user_id` text NOT NULL,
	`display_name` text NOT NULL,
	`text` text NOT NULL
);
