// Auto-generated ASCII logo - don't edit manually
// Regenerate with: cd ../.. && ascii-image-converter Retriever_logo.png -C --height 40 > logo-colored.txt

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the pre-generated colored ASCII art
const logoPath = path.join(__dirname, '../logo-colored.txt');
export const logo = fs.readFileSync(logoPath, 'utf-8');
