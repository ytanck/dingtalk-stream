import { builtinModules } from 'node:module';
import esbuild from 'rollup-plugin-esbuild';
import dts from 'rollup-plugin-dts';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import alias from '@rollup/plugin-alias';
import { defineConfig } from 'rollup';
import pkg from './package.json' assert { type: 'json' };

const entries = {
  index: 'src/index.ts',
  client: 'src/client.ts',
  constants: 'src/constants.ts',
};

const external = [
  ...builtinModules,
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
  'pathe',
  'birpc',
  'vite',
  'vite/types/hot',
  'node:url',
  'node:events',
  'node:vm',
];

const plugins = [
  resolve({
    preferBuiltins: true,
  }),
  json(),
  commonjs(),
  esbuild({
    target: 'node14',
  }),
];

export default defineConfig([
  {
    input: entries,
    output: {
      dir: 'dist',
      format: 'esm',
      entryFileNames: '[name].mjs',
      chunkFileNames: 'chunk-[name].mjs',
    },
    external,
    plugins,
    onwarn,
  },
  {
    input: entries,
    output: {
      dir: 'dist',
      format: 'cjs',
      entryFileNames: '[name].cjs',
      chunkFileNames: 'chunk-[name].cjs',
    },
    external,
    plugins: [
      alias({
        entries: [
          // cjs in Node 14 doesn't support node: prefix
          // can be dropped, when we drop support for Node 14
          { find: /^node:(.+)$/, replacement: '$1' },
        ],
      }),
      ...plugins,
    ],
    onwarn,
  },
  {
    input: entries,
    output: {
      dir: 'dist',
      entryFileNames: '[name].d.ts',
      format: 'esm',
    },
    external,
    plugins: [dts({ respectExternal: true })],
    onwarn,
  },
]);

function onwarn(message) {
  if (['EMPTY_BUNDLE', 'CIRCULAR_DEPENDENCY'].includes(message.code)) return;
  console.error(message);
}
