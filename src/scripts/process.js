import Consts from './consts';
import { Storage, Notification, FirebaseDatabase } from './utils';

export class Process {
  constructor() {
    this.storage = new Storage();
    this.localStorage = new Storage();
    this.refListener = null;
  }

  static pickSettingConfigs() {
    return {
      enableNotification: Consts.ENABLE_NOTIFICATION,
      autoClose: Consts.AUTO_CLOSE_NOTIFICATION
    };
  }

  async initialize(force = false) {
    if (typeof this.firebase === 'undefined' || force) {
      this.firebase = await this.storage.get('firebase');
    }
    if (typeof this.realtimeDatabase === 'undefined' || force) {
      this.realtimeDatabase = await this.storage.get('realtimeDatabase');
      this.ref = this.realtimeDatabase.collection;
    }
    if (typeof this.settings === 'undefined' || force) {
      this.settings = await this.storage.get('settings');
    }
    this.fbDatabase = new FirebaseDatabase(this.firebase);
    return true;
  }

  async runListener(again = false) {
    await this.initialize(again);
    let user = await this.storage.get('user');
    let init = true;

    if (!this.settings.enableNotification || user === undefined) {
      return;
    }

    let ref = `${this.ref}/${user.uid}`;
    this.fbDatabase.onNewChildAdded(ref, 1, snapshot => {
      if (init) {
        init = false;
        return;
      }
      this.triggerNotify(snapshot.val(), snapshot.key);
    });
  }

  async triggerNotify(item, key) {
    let user = await this.storage.get('user');
    if (item.notified || user === undefined) {
      return;
    }

    let buttons = [];
    if (item.ok === false && item.isNew === true) {
      // Add button close for new mail & non-exist
      buttons.push({
        title: '新規メールなので問題ないです'
      });
    }

    let notiType = item.ok === true ? 'success' : 'warning';
    let icon = ((await this.localStorage.get('appsScript.icon_' + notiType)) || 'img/notification.png');
    let noti = new Notification(null, 'basic', icon, item.title, item.body, buttons);
    noti.show();

    let updates = {};
    updates[`${this.ref}/${user.uid}/${key}/notified`] = true;
    this.fbDatabase.update(updates);

    if (item.ok === true) {
      // Auto-close if mail existed
      this.autoCloseNotification(this.settings.autoClose, noti);
    } else if (item.isNew === true) {
      // Add listener for button close
      noti.addListener((notificationId, buttonIndex) => {
        if (buttonIndex === 0) {
          noti.close();
        }
      });
    }
  }

  autoCloseNotification(ok, notiObj) {
    if (ok) {
      setTimeout(() => {
        notiObj.close();
      }, Consts.CLOSE_NOTIFICATION_TIMEOUT);
    }
  }

  stopListener() {
    this.fbDatabase.database.ref(this.realtimeDatabase.collection).off();
  }
}
