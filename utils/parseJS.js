// utils / parseJS

import {normalize} from 'path';
import {existsSync} from 'fs';

import {rollup} from 'rollup';
import strip from '@rollup/plugin-strip';
import replace from '@rollup/plugin-replace';

import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import cleanup from 'rollup-plugin-cleanup';
import terser from 'terser';

import {md5} from 'bellajs';
import LRU from 'lru-cache';

import {error, info} from './logger';
import {getConfig} from '../configs';

const config = getConfig();
const cache = new LRU({
  max: 500,
  maxAge: config.ENV === 'dev' ? 5e3 : 6e4 * 60 * 3,
});

const rollupify = async (input, clientSecret = '') => {
  try {
    info('Start parsing JS file with Rollup...');
    const plugins = [
      nodeResolve(),
      commonjs({
        include: 'node_modules/**',
        sourceMap: false,
      }),
      replace({
        __clientSecret__: clientSecret,
      }),
      cleanup(),
    ];
    if (config.ENV != 'dev') {
      plugins.push(strip({
        debugger: false,
        functions: [
          'console.log',
          'assert.*',
          'debug',
          'alert',
        ],
        sourceMap: false,
      }));
    }
    const bundle = await rollup({
      input,
      plugins,
    });

    const {output} = await bundle.generate({
      format: 'iife',
      indent: true,
      strict: false,
    });

    const codeParts = [];
    for (const chunkOrAsset of output) {
      if (chunkOrAsset.isAsset) {
        codeParts.push(chunkOrAsset.source);
      } else {
        codeParts.push(chunkOrAsset.code);
      }
    }
    info('Rollupified JS content.');

    const jsCode = codeParts.join('\n');

    if (config.ENV == 'dev') {
      return jsCode;
    }

    const minOutput = terser.minify(jsCode);
    return minOutput.code;
  } catch (err) {
    error(err);
    return null;
  }
};

export default async (filePath, clientSecret) => {
  const key = md5([filePath, clientSecret].join(''));
  const c = cache.get(key);
  if (c) {
    return c;
  }
  const {
    baseDir,
    srcDir,
  } = config;
  const fullPath = normalize(`${baseDir}/${srcDir}/assets/${filePath}`);
  if (!existsSync(fullPath)) {
    error(`File does not exist: ${fullPath}`);
    return null;
  }
  const jsContent = await rollupify(fullPath, clientSecret);
  cache.set(key, jsContent);
  return jsContent;
};
