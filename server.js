// server.js

import {normalize} from 'path';
import {existsSync} from 'fs';

import {isString, genid} from 'bellajs';
import express from 'express';
import session from 'express-session';
import sfstore from 'session-file-store';

import {getConfig} from './configs';


import readFile from './utils/readFile';
import parseJS from './utils/parseJS';
import parseCSS from './utils/parseCSS';
import parseHTML from './utils/parseHTML';

import {getCredentials} from './utils/auth';
import {info, error} from './utils/logger';

import handleRequest from './handlers/extractor';

import {name, version} from './package.json';

const {
  baseDir,
  srcDir,
  staticOpt,
  fileStoreOpt,
  port,
  ENV,
} = getConfig();

const app = express();

const FileStore = sfstore(session);
app.use(session({
  store: new FileStore(fileStoreOpt),
  secret: `${name}@${version}`,
  genid: () => genid(24),
  name,
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: ENV === 'prod',
    maxAge: ENV === 'prod' ? 6e4 * 60 * 2 : 6e4 * 2,
  },
}));

app.set('etag', 'strong');
app.disable('x-powered-by');

const staticDir = normalize(`${baseDir}/${srcDir}/static`);
if (existsSync(staticDir)) {
  app.use(express.static(staticDir, staticOpt));
}

app.get('/api/extract', (req, res) => {
  return handleRequest(req, res);
});

app.get('/assets/*', async (req, res, next) => {
  const filePath = req.params[0];
  if (filePath.endsWith('.js')) {
    const {clientId, clientSecret} = req.session;
    if (!clientId || !clientSecret) {
      error('Missing cliendId or clientSecret');
      return next();
    }
    const jsContent = await parseJS(filePath, clientSecret);
    if (jsContent && isString(jsContent)) {
      res.type('text/javascript');
      return res.send(jsContent);
    }
  } else if (filePath.endsWith('.css')) {
    const cssContent = await parseCSS(filePath);
    if (cssContent && isString(cssContent)) {
      res.type('text/css');
      return res.send(cssContent);
    }
  }
  error(`Error while loading file '${filePath}'`);
  return next();
});

app.get('/', (req, res) => {
  let {clientId, clientSecret} = req.session;
  if (!clientId || !clientSecret) {
    const cred = getCredentials();
    clientId = cred.clientId;
    clientSecret = cred.clientSecret;
    req.session.clientId = clientId;
    req.session.clientSecret = clientSecret;
  }
  const html = readFile(`${baseDir}/${srcDir}/index.html`);
  res.type('text/html');
  res.cookie('clientId', clientId);
  res.send(parseHTML(html));
});

app.listen(port, () => {
  info(`Server started at http://0.0.0.0:${port}`);
});
