import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
addFormats(ajv);

const schemaDir = 'schemas';
const mapping = [
  { schema: 'power-status.schema.json', data: 'power-status.json' },
  { schema: 'sparkline.schema.json', data: 'team-sparkline.json' },
  { schema: 'bar.schema.json', data: 'conference-bar.json' },
  { schema: 'meta.schema.json', data: 'global-stage.json' },
];

let hasError = false;

for (const item of mapping) {
  const schemaPath = join(schemaDir, item.schema);
  const dataPath = join('data', item.data);
  const schema = JSON.parse(await fs.readFile(schemaPath, 'utf-8'));
  const data = JSON.parse(await fs.readFile(dataPath, 'utf-8'));
  const validate = ajv.compile(schema);
  const valid = validate(data);
  if (!valid) {
    console.error(`Validation failed for ${dataPath}`);
    console.error(validate.errors);
    hasError = true;
  } else {
    console.log(`Validated ${dataPath}`);
  }
}

if (hasError) {
  process.exitCode = 1;
}
