import fs from 'node:fs';
import path from 'node:path';

const chrome83PluginPath = fs.existsSync(path.join(process.cwd(), 'postcss-chrome83.cjs'))
  ? path.join(process.cwd(), 'postcss-chrome83.cjs')
  : path.join(process.cwd(), 'frontend', 'postcss-chrome83.cjs');

const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    [chrome83PluginPath]: {},
  },
};

export default config;
