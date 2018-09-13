import configs from 'configs';
import { Process } from './process';
import { Storage, Firebase, FirebaseDatabase } from './utils';
import '../stylesheets/background.scss';
import firebase from 'firebase/app';

firebase.database.enableLogging(true);
var p = new Process();
var firebaseDb = null;
var realtimeDbConfigs = null;
var storage = new Storage();

chrome.runtime.onInstalled.addListener(async () => {
  let firebaseConfigs = Firebase.pickConfigs(configs);
  let realtimeDatabaseConfigs = Firebase.pickRealtimeDatabaseConfigs(configs);
  let settings = Process.pickSettingConfigs();
  await storage.setWithoutOverwriting('firebase', firebaseConfigs);
  await storage.setWithoutOverwriting('realtimeDatabase', realtimeDatabaseConfigs);
  await storage.setWithoutOverwriting('settings', settings);
  realtimeDbConfigs = realtimeDatabaseConfigs;
  firebaseDb = new FirebaseDatabase(firebaseConfigs);
  p.runListener();
});

chrome.runtime.onStartup.addListener(async () => {
  p.runListener();
});

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.configUpdated === true) {
    p.stopListener();
    p.runListener(true);
    sendResponse({ ok: true });
  }

  if (request.message === 'firebase.push') {
    let ref = realtimeDbConfigs.collection;
    let user = await storage.get('user');
    if (!user || !user.uid) {
      return;
    }

    try {
      firebaseDb.push(`${ref}/${user.uid}`, request.data);
      console.log('Success');
    } catch (error) {
      console.log(error);
    }
  }

  if (request.message === 'firebase.runListener') {
    await setTimeout(() => {
      p.runListener();
    }, 3000);
  }

  if (request.message === 'firebase.stopListener') {
    p.stopListener();
  }
});
