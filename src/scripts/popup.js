import $ from 'jquery'; // eslint-disable-line no-unused-vars
import Vue from 'vue';
import _ from 'lodash';
import Consts from './consts';
import { Storage, FirebaseAuth } from './utils';
import 'materialize-css/dist/js/materialize.js';
import '../stylesheets/popup.scss';

const storage = new Storage();

async function readFromStorage() {
  let settings = await storage.get('settings');
  return _.assign({
    enableNotification: true,
    autoClose: false
  }, settings);
}

readFromStorage().then((result) => {
  const app = new Vue({ // eslint-disable-line no-unused-vars
    el: '#app',
    data: {
      message: '',
      errors: [],
      settings: {
        enableNotification: result.enableNotification,
        autoClose: result.autoClose
      },
      signIn: {
        email: '',
        password: ''
      },
      isSignIn: false,
      showSignIn: true,
      signUp: {
        email: '',
        password: ''
      },
      isSignUp: false,
      showSignUp: false,
      isAuthenticated: false,
      consts: Consts,
      authenticator: null
    },
    watch: {
      // whenever question changes, this function will run
      settings: {
        handler: function(newSettings, oldSettings) {
          this.message = 'Waiting for you to stop changing...';
          this.debouncedChangeSetting();
        },
        immediate: false,
        deep: true
      }
    },
    methods: {
      changeSetting: function() {
        storage.set('settings', this.settings).then((result) => {
          chrome.runtime.sendMessage({ configUpdated: true }, (response) => {
            this.message = '';
          });
        });
      },
      openOptions: function() {
        if (chrome.runtime.openOptionsPage) {
          chrome.runtime.openOptionsPage();
        } else {
          window.open(chrome.runtime.getURL('options.html'));
        }
      },
      initFirebase: async function() {
        let firebase = await storage.get('firebase');
        this.authenticator = new FirebaseAuth(firebase);
      },
      signInForm: function(e) {
        e.preventDefault();
        this.redirectIfAuthenticated();
        if (this.isSignIn) return;

        this.isSignIn = true;
        if (!this.signInUpValidate(this.signIn)) {
          this.isSignIn = false;
          return;
        }

        this.authenticator.signin(this.signIn, data => {
          storage.set('signIn', this.signIn).then((result) => {
            this.isSignIn = false;
            this.isAuthenticated = true;
          });
        }, errors => {
          this.errors.push(errors.message);
          this.isSignIn = false;
          this.isAuthenticated = false;
        });
      },
      signOutForm: function(e) {
        e.preventDefault();
        if (!this.isAuthenticated) return;

        this.authenticator.signout(() => {
          console.log('Sign-out successfully');
          storage.remove('signUp').then((result) => {
            console.log(result);
            this.isSignUp = false;
          });
          storage.remove('signIn').then((result) => {
            console.log(result);
            this.isSignIn = false;
          });
          this.isAuthenticated = false;
          this.showSignIn = true;
          this.showSignUp = false;
        }, errors => {
          console.log('Sign-out failure');
          console.log(errors);
        });
      },
      signUpForm: function(e) {
        e.preventDefault();
        this.redirectIfAuthenticated();
        if (this.isSignUp) return;

        this.isSignUp = true;
        if (!this.signInUpValidate(this.signUp)) {
          this.isSignUp = false;
          return;
        }

        this.authenticator.signup(this.signUp, data => {
          storage.set('signUp', this.signUp).then((result) => {
            this.isSignUp = false;
            this.isAuthenticated = true;
          });
        }, errors => {
          this.isAuthenticated = false;
          this.errors.push(errors.message);
          this.isSignUp = false;
        });
      },
      signInUpValidate: function(data) {
        this.errors = [];

        _.each(data, (v, k) => {
          if (v === '') {
            let msg = '';
            switch (k) {
              case 'email':
                msg = 'Email is required.';
                break;
              case 'password':
                msg = 'Password is required.';
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
      showSignInUp: function() {
        this.errors = [];
        this.showSignIn = !this.showSignIn;
        this.showSignUp = !this.showSignUp;
      },
      redirectIfAuthenticated: async function () {
        let signUpData = await storage.get('signUp');
        let signInData = await storage.get('signIn');

        if (signUpData || signInData) {
          this.isAuthenticated = true;
        }
      }
    },
    created: function() {
      this.initFirebase();
      this.redirectIfAuthenticated();
      this.debouncedChangeSetting = _.debounce(this.changeSetting, 500);
    },
    mounted: function() {
      M.AutoInit();
    }
  });
});
