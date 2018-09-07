import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/database';
import { v4 as uuid } from 'uuid';
import _ from 'lodash';
import Consts from './consts';

export class Storage {
  constructor(driver = 'local') {
    this.driver = chrome.storage[driver];
  }

  extractMasterKey(key) {
    return key.split('.')[0];
  }

  get(key, defaultValue = undefined) {
    let masterKey = this.extractMasterKey(key);
    return new Promise((resolve, reject) => {
      this.driver.get(masterKey, (result) => {
        let v = _.get(result, key, undefined);
        if (v === undefined) {
          console.log(`[GET] Cannot get property '${key}' of storage.`);
          return resolve(defaultValue);
        }
        console.log(`[GET] storage.${key} = ${JSON.stringify(v)}.`);
        return resolve(v);
      });
    });
  }

  set(key, value) {
    console.log(key);
    let masterKey = this.extractMasterKey(key);
    return new Promise((resolve, reject) => {
      this.get(masterKey, {}).then((result) => {
        let o = {}; o[masterKey] = result;
        console.log(o);
        let n = _.set(o, key, value);
        this.driver.set(n, () => {
          console.log(`[SET] storage.${key} = ${JSON.stringify(value)}.`);
          resolve(true);
        });
      });
    });
  }

  setWithoutOverwriting(key, value) {
    console.log(key);
    let masterKey = this.extractMasterKey(key);
    return new Promise((resolve, reject) => {
      this.get(masterKey, {}).then((result) => {
        let c = {}; c[masterKey] = result;
        let i = _.set({}, key, value);
        let n = _.merge(i, c);
        this.driver.set(n, () => {
          console.log(`[SET WITHOUT OVERWRITING] storage.${key} = ${JSON.stringify(value)}.`);
          resolve(true);
        });
      });
    });
  }

  remove(key) {
    let keys = key.split('.');
    let masterKey = keys[0];
    return new Promise((resolve, reject) => {
      if (keys.length === 1) {
        this.driver.remove(key, () => {
          resolve(true);
        });
      } else {
        this.get(masterKey, {}).then((result) => {
          let o = {}; o[masterKey] = result;
          let n = _.omit(o, key);
          this.driver.set(n, () => {
            console.log(`[REMOVE] storage.${masterKey} = ${JSON.stringify(n[masterKey])}.`);
            resolve(true);
          });
        });
      }
    });
  }

  clear() {
    return new Promise((resolve, reject) => {
      this.driver.clear(() => {
        console.log('[CLEAR] storage.');
        resolve(true);
      });
    });
  }
}

export class Notification {
  constructor(id, type, iconUrl, title, message, buttons) {
    this.id = id;
    this.type = type;
    this.iconUrl = iconUrl;
    this.title = title;
    this.message = message;
    this.buttons = buttons;
  }

  show() {
    let options = {
      type: this.type,
      iconUrl: this.iconUrl,
      title: this.title,
      message: this.message,
      buttons: this.buttons
    };
    if (_.isNull(this.id)) {
      this.id = uuid();
    }
    chrome.notifications.create(this.id, options, () => {});
  }

  close() {
    chrome.notifications.clear(this.id, () => {});
  }

  addListener(callback) {
    chrome.notifications.onButtonClicked.addListener(callback);
  }
}

export class Firebase {
  constructor(configs) {
    this.configs = configs;
    if (!firebase.apps.length) {
      firebase.initializeApp(this.configs);
    }
    this.app = firebase.app();
  }

  static pickConfigs(obj) {
    let firebaseInitKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId'];
    let configs = _.pickBy(obj, (value, key) => {
      return ~_.indexOf(firebaseInitKeys, key);
    });
    configs['databaseURL'] = obj.databaseUrl;
    return configs;
  }

  static pickRealtimeDatabaseConfigs(obj) {
    let realtimeDbInitKeys = ['collection', 'fieldTitle', 'fieldMessage'];
    let configs = _.pickBy(obj, (value, key) => {
      return ~_.indexOf(realtimeDbInitKeys, key);
    });
    configs['getNewItemBy'] = Consts.GET_NEW_ITEM_BY_GRAB_LIMIT;
    configs['grabType'] = Consts.GRAB_LIMIT_TO_LAST;
    return configs;
  }
}

export class FirebaseDatabase extends Firebase {
  constructor(configs) {
    super(configs);
    this.database = this.app.database();
  }

  /**
   * To read a snapshot of your data without listening for changes
   */
  read(ref) {
    return this.database.ref(ref).once('value');
  }

  /**
   * To save data to a specified reference, replacing any existing data at that path.
   */
  set(ref, id, data) {
    return this.database.ref(`${ref}/${id}`).set(data);
  }

  /**
   * To adding data to a collection of items
   */
  push(ref, data) {
    return this.database.ref(ref).push().set(data);
  }

  /**
   * To simultaneously write to specific children of a node without overwriting other child nodes
   *
   * updates['/posts/' + newPostKey] = postData;
   * updates['/user-posts/' + uid + '/' + newPostKey] = postData;
   */
  update(updates) {
    return this.database.ref().update(updates);
  }

  /**
   *
   */
  transaction(ref, transactionUpdate) {
    return this.database.ref(ref).transaction(transactionUpdate);
  }

  /**
   * To read data at a path and listen for changes
   */
  on(ref, eventType, cb) {
    return this.database.ref(ref).on(eventType, (snapshot) => {
      cb && cb(snapshot);
    });
  }

  /**
   * To remove a callback previously attached on a reference
   * Calling off() on a parent listener does not automatically remove listeners registered on its child nodes
   *
   * eventType: "value", "child_added", "child_changed", "child_removed", or "child_moved."
   */
  off(ref, eventType = undefined) {
    if (eventType === undefined) {
      return this.database.ref(ref).off();
    }
    return this.database.ref(ref).off(eventType);
  }

  /**
   * To remove a single listener on a reference
   * Calling off() on a parent listener does not automatically remove listeners registered on its child nodes
   */
  remove(ref) {
    return this.database.ref(ref).remove();
  }

  /**
   * Fetching all collections name in Firebase
   */
  getCollectionName(ref = '/') {
    return new Promise((resolve, reject) => {
      this.database.ref(ref).once('value')
        .then((snapshot) => {
          let collections = _.keys(snapshot.val());
          resolve(collections);
        })
        .catch(function(error) {
          reject(error);
        });
    });
  }

  /**
   * To watching added event from the bottom of a list (descending order)
   */
  onNewChildAdded(ref, limitToLast, cb) {
    return this.database.ref(ref).limitToLast(limitToLast).on('child_added', (snapshot, prevChildKey) => {
      cb && cb(snapshot, prevChildKey);
    });
  }

  /**
   * To watching value changed event from the first of a list (ascending order)
   */
  onFirstChildUpdated(ref, limitToFirst, cb) {
    return this.database.ref(ref).limitToFirst(limitToFirst).on('child_changed', (snapshot) => {
      cb && cb(snapshot);
    });
  }

  /**
   * To watching new added event from the item that have created at timestamp > startedAt
   */
  onAfterStartAtChild(ref, field, startedAt, cb) {
    return this.database.ref(ref).orderByChild(field).startAt(startedAt).on('child_added', (snapshot, prevChildKey) => {
      cb && cb(snapshot, prevChildKey);
    });
  }
}

export class FirebaseAuth extends FirebaseDatabase {
  constructor(configs) {
    super(configs);
  }

  async signin(data, success = null, failure = null) {
    try {
      let result = await firebase.auth()
        .signInWithEmailAndPassword(data.email, data.password);
      success && success(result);
    } catch (e) {
      console.log(e);
      failure && failure(e);
    }
  }

  async signup(data, success = null, failure = null) {
    try {
      let result = await firebase.auth()
        .createUserWithEmailAndPassword(data.email, data.password);
      success && success(result);
    } catch (e) {
      console.log(e);
      failure && failure(e);
    }
  }

  async signout(success = null, failure = null) {
    try {
      let result = await firebase.auth().signOut();
      success && success(result);
    } catch (e) {
      console.log(e);
      failure && failure(e);
    }
  }
}
