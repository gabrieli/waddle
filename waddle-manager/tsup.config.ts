import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  target: 'node20',
  outDir: 'dist',
  onSuccess: async () => {
    // Create the bin wrapper after successful build
    const fs = await import('fs');
    const path = await import('path');
    
    const binDir = path.join(process.cwd(), 'bin');
    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir);
    }
    
    const binScript = `#!/usr/bin/env node
require('../dist/cli/index.js');
`;
    
    fs.writeFileSync(path.join(binDir, 'waddle.js'), binScript);
    fs.chmodSync(path.join(binDir, 'waddle.js'), '755');
  }
});