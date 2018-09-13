import $ from 'jquery'; // eslint-disable-line no-unused-vars
import Vue from 'vue';
import _ from 'lodash';
import Consts from './consts';
import { Storage } from './utils';
import 'materialize-css/dist/js/materialize.js';
import '../stylesheets/options.scss';

const storage = new Storage('local');

const app = new Vue({ // eslint-disable-line no-unused-vars
  el: '#app',
  data: {
    errors: [],
    isFetching: false,
    isTesting: false,
    isSaving: false,
    appsScript: {
      url: '',
      icon_success: 'img/notification.png',
      icon_warning: 'img/notification.png'
    },
    firebase: {
      apiKey: '',
      authDomain: '',
      databaseURL: '',
      storageBucket: ''
    },
    consts: Consts
  },
  methods: {
    init: async function() {
      let firebase = await storage.get('firebase');
      let realtimeDatabase = await storage.get('realtimeDatabase');
      let appsScript = await storage.get('appsScript');
      this.firebase = _.assign(this.firebase, firebase);
      this.realtimeDatabase = _.assign(this.realtimeDatabase, realtimeDatabase);
      this.appsScript = _.assign(this.appsScript, appsScript);
    },
    loadIconNoti: async function(event) {
      let file = event.target.files[0];
      var reader = new window.FileReader();
      reader.onload = event => {
        let dataUrl = event.target.result;
        this.appsScript.icon_success = dataUrl;
      };
      reader.readAsDataURL(file);
    },
    loadIconWarning: async function(event) {
      let file = event.target.files[0];
      var reader = new window.FileReader();
      reader.onload = event => {
        let dataUrl = event.target.result;
        this.appsScript.icon_warning = dataUrl;
      };
      reader.readAsDataURL(file);
    },
    firebaseForm: function(e) {
      e.preventDefault();
      if (this.isSaving) return;

      this.isSaving = true;
      if (!this.firebaseValidate()) {
        this.isSaving = false;
        return;
      }

      storage.set('firebase', this.firebase).then((result) => {
        chrome.runtime.sendMessage({ configUpdated: true }, (response) => {
          this.isSaving = false;
          M.toast({html: 'Saved successfully', classes: 'rounded'});
        });
      });
    },
    firebaseValidate: function() {
      this.errors = [];

      _.each(this.realtimeDatabase, (v, k) => {
        if (v === '') {
          let msg = '';
          switch (k) {
            case 'apiKey':
              msg = 'API Key is required.';
              break;
            case 'authDomain':
              msg = 'Auth Domain is required.';
              break;
            case 'databaseURL':
              msg = 'Database URL is required.';
              break;
            case 'storageBucket':
              msg = 'Storage Bucket is required.';
              break;
          }
          msg && this.errors.push(msg);
        }
      });

      if (this.errors.length) {
        return false;
      }

      return true;
    },
    appsScriptValidate: function() {
      this.errors = [];

      if (this.appsScript.url.length === 0) {
        this.errors.push('Apps Script URL is required.');
      }

      if (this.errors.length) {
        return false;
      }

      return true;
    },
    appsScriptForm: async function(e) {
      e.preventDefault();
      if (!this.appsScriptValidate()) {
        return;
      }

      storage.set('appsScript', this.appsScript).then((result) => {
        chrome.runtime.sendMessage({ configUpdated: true }, (response) => {
          M.toast({html: 'Saved successfully', classes: 'rounded'});
        });
      });
    },
    close: function() {
      chrome.tabs.query({currentWindow: true, active: true}, (tabs) => {
        let tabId = tabs[0].id;
        chrome.tabs.remove(tabId);
      });
    }
  },
  created: function() {
    this.init();
  },
  mounted: function() {
    M.AutoInit();
    $('#splash').addClass('splash-loaded');
  },
  updated: function() {
    let elems = document.querySelectorAll('select');
    M.FormSelect.init(elems, {});
  }
});
