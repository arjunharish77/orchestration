import { existsSync } from 'fs';
import { join } from 'path';
import { config, parse } from 'dotenv';
import { readFileSync } from 'fs';

const candidates = [
  join(process.cwd(), '.env'),
  join(process.cwd(), 'backend', '.env'),
  join(process.cwd(), '..', '.env'),
  join(process.cwd(), '..', 'backend', '.env')
];

for (const path of candidates) {
  if (existsSync(path)) {
    config({ path, override: false });
    const parsed = parse(readFileSync(path));
    for (const [key, value] of Object.entries(parsed)) {
      if (!process.env[key]) process.env[key] = value;
    }
  }
}
