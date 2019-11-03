// main.js

import {html, render} from 'lit-html';

import Store from './helpers/store';
import Loader from './helpers/loader';
import Writer from './helpers/writer';

import {tplHeader} from './templates/header';
import {tplMain} from './templates/main';
import {tplFooter} from './templates/footer';
import {tplOverlay} from './templates/overlay';


const enableButton = (btn) => {
  btn.classList.remove('disable');
  btn.textContent = 'Extract';
  btn.disabled = false;
};

const disableButton = (btn) => {
  btn.classList.add('disable');
  btn.textContent = 'Extracting...';
  btn.disabled = true;
};

const App = window.App = {
  render: (state) => {
    const tplWrapper = html`<div class="wrapper">
      ${tplHeader(state)}
      ${tplMain(state)}
      ${tplFooter(state)}
      ${tplOverlay(state)}
    </div>`;
    const result = render(tplWrapper, document.body);
    return result;
  },
  parse: async (url, btnExtract) => {
    disableButton(btnExtract);
    const cstate = Store.unsetArticle();
    App.render(cstate);
    const {clientSecret} = cstate;
    const data = await Loader.extract(url, clientSecret);
    if (!data.error) {
      const {article} = data;
      const state = Store.setArticle(article);
      App.render(state);
      const ifr = document.getElementById('ifcontent');
      if (ifr && state.article.content) {
        Writer.setContent(state.article.content, ifr);
      }
    } else if (data.errorType === 'credentials') {
      const state = Store.setOverlayMessage(data.message);
      App.render(state);
    } else if (data.errorType === 'parser') {
      const state = Store.setParserMessage(data.message);
      App.render(state);
    }
    enableButton(btnExtract);
  },
  init: async () => {
    try {
      const state = await Store.init();
      App.render(state);
    } catch (err) {
      console.trace(err);
    }
  },
};

App.init();

