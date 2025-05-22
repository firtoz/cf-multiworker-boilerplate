import { $ } from "bun";

// Slice from index 2 to get all user-provided arguments
const args = process.argv.slice(2);

// Log the arguments for debugging
console.log(args.join(' '));

try {
  // Pass arguments individually to wrangler instead of joining them
  await $`bunx wrangler ${args}`;
} catch (error) {
  // Print errors to stderr instead of failing
  console.error(error.message || error);
  // Exit with the same code as the original command
  process.exit(error.exitCode || 1);
}