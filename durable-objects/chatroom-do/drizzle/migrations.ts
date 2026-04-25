import journal from "./meta/_journal.json";

const m0000 = `CREATE TABLE \`chat_messages\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`ts\` integer NOT NULL,
	\`user_id\` text NOT NULL,
	\`display_name\` text NOT NULL,
	\`text\` text NOT NULL
);
`;

const migrationConfig = {
	journal,
	migrations: {
		m0000,
	},
};

export default migrationConfig;
