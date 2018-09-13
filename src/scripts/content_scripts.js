import $ from 'jquery';
import { Storage } from './utils';
var MutationObserver = require('mutation-observer');

export class ContentScript {
  constructor() {
    this.clicked = false;
    this.storage = new Storage();
  }

  extractMail(text) {
    let emails = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi);
    if (emails) return emails.join(',');
    return '';
  }

  async onSendMail(data, uid = '') {
    data.notified = false;
    chrome.runtime.sendMessage({ message: 'firebase.push', data: data });
  }

  async initObserver() {
    this.observer = new MutationObserver(() => {
      let mailContent = {};
      let btnSend = $("table[role='group']").find("div[role='button']");

      if (btnSend.length !== 0) {
        let eventSend = $._data(btnSend[0], 'events');
        if (eventSend === undefined || eventSend.click.length === 0) {
          btnSend.on('click', event => {
            if (this.clicked === false) {
              this.clicked = true;
              let footerbox = $(event.currentTarget).closest('table');
              let bodybox = $(footerbox).parent().closest('table');
              let currentbox = $(bodybox).parent().closest('table');
              let boxId = currentbox[0].attributes.id.value;
              let mailReceivers = {};

              for (let key of ['to', 'cc', 'bcc']) {
                mailReceivers[key] = $(`table[id='${boxId}'] :input[name="${key}"]`)
                  .get()
                  .map(input => {
                    let mail = $(input).val();
                    if (mail.length !== 0) {
                      return mail;
                    }
                  });

                mailContent[key] = this.extractMail(mailReceivers[key].join(','));
              }

              mailContent['title'] = $(`table[id='${boxId}'] :input[name='subjectbox']`).val() || '';
              mailContent['body'] = $(`table[id='${boxId}']`).find("div[aria-label='Message Body'][g_editable='true'][role='textbox']").text();

              if ($(event.currentTarget).closest("div[role='dialog']").length !== 0) {
                mailContent['isNew'] = true;
                setTimeout(() => {
                  if ($("span[id='link_vsm']").length !== 0) {
                    this.onSendMail(mailContent);
                    mailContent = {};
                  }
                }, 4000);
              } else {
                mailContent['isNew'] = false;
                this.onSendMail(mailContent);
                mailContent = {};
              }

              this.clicked = false;
            }
          });
        }
      }
    });

    let config = {
      childList: true,
      subtree: true
    };

    this.observer.observe(document.getElementsByTagName('body')[0], config);
  }
}

var script = new ContentScript();
script.initObserver();
