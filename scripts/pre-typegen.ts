import fs from 'node:fs';
import path from 'node:path';
import { v7 as uuidv7 } from 'uuid';
import { parse as parseJsonc } from 'jsonc-parser';
import process from 'node:process';

// Use the current working directory instead of relative paths
const CWD = process.cwd();
const WRANGLER_CONFIG_PATH = path.join(CWD, 'wrangler.jsonc');
const WRANGLER_TEMP_PATH = path.join(CWD, 'wrangler.temp.json');
const WRANGLER_DEV_PATH = path.join(CWD, 'wrangler.dev.json');
const DEV_VARS_PATH = path.join(CWD, '.dev.vars');
const DEV_VARS_EXAMPLE_PATH = path.join(CWD, '.dev.vars.example');

// Check if the wrangler config file exists
if (!fs.existsSync(WRANGLER_CONFIG_PATH)) {
  console.error(`Error: Configuration file not found at ${WRANGLER_CONFIG_PATH}`);
  console.error(`Make sure you're running this script from a directory containing a wrangler.jsonc file.`);
  process.exit(1);
}

// Read the original wrangler.jsonc file
const wranglerConfigRaw = fs.readFileSync(WRANGLER_CONFIG_PATH, 'utf8');
const wranglerConfig = parseJsonc(wranglerConfigRaw);

// Function to create the temp file for typegen (without script_name)
function createTypegenConfig() {
  console.log('Creating typegen configuration...');

  // Create a deep copy of the original config
  const typegenConfig = JSON.parse(JSON.stringify(wranglerConfig));

  // Remove script_name from durable object bindings if they exist
  if (typegenConfig.durable_objects?.bindings) {
    typegenConfig.durable_objects.bindings = typegenConfig.durable_objects.bindings.map(binding => {
      // Create a new binding without the script_name property
      const { script_name, ...newBinding } = binding;
      return newBinding;
    });
  }

  // Write the modified config to the temp file
  fs.writeFileSync(WRANGLER_TEMP_PATH, JSON.stringify(typegenConfig, null, 2));
  console.log(`Typegen configuration written to ${path.relative(CWD, WRANGLER_TEMP_PATH)}`);
}

// Function to create or ensure .dev.vars file exists
function createDevVarsFile() {
  console.log('Checking .dev.vars file...');

  // If .dev.vars already exists, skip creation
  if (fs.existsSync(DEV_VARS_PATH)) {
    console.log('.dev.vars file already exists, skipping creation');
    return;
  }

  let devVarsContent = '';

  // Check if .dev.vars.example exists
  if (fs.existsSync(DEV_VARS_EXAMPLE_PATH)) {
    console.log('Found .dev.vars.example, using example values');
    devVarsContent = fs.readFileSync(DEV_VARS_EXAMPLE_PATH, 'utf8');
  } else {
    console.log('No .dev.vars.example found, creating empty .dev.vars');
    devVarsContent = '# Environment variables for local development\n# Add your variables here\n';
  }

  // Create the .dev.vars file
  fs.writeFileSync(DEV_VARS_PATH, devVarsContent);
  console.log(`Created ${path.relative(CWD, DEV_VARS_PATH)}`);
}

// Function to create the dev file for development
function createDevConfig() {
  console.log('Creating dev configuration...');

  // Create a deep copy of the original config
  const devConfig = JSON.parse(JSON.stringify(wranglerConfig));

  // Extract all durable object class names
  const durableObjectClasses: string[] = devConfig.durable_objects?.bindings
    ? devConfig.durable_objects.bindings.map(binding => binding.class_name)
    : [];

  // Check if migrations already exist
  if (!devConfig.migrations) {
    // If no migrations exist, create a new one
    devConfig.migrations = [
      {
        tag: "v1",
        new_sqlite_classes: durableObjectClasses
      }
    ];
  } else {
    // If migrations exist, append a new one with a random UUID
    devConfig.migrations.push({
      tag: uuidv7(),
      new_sqlite_classes: durableObjectClasses
    });
  }

  // Write the modified config to the dev file
  fs.writeFileSync(WRANGLER_DEV_PATH, JSON.stringify(devConfig, null, 2));
  console.log(`Dev configuration written to ${path.relative(CWD, WRANGLER_DEV_PATH)}`);
}

// Create configurations and .dev.vars file
createTypegenConfig();
createDevConfig();
createDevVarsFile();

console.log('Pre-typegen script completed successfully.');
