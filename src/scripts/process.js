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
    return true;
  }

  async runListener(again = false) {
    await this.initialize(again);

    let fbDatabase = new FirebaseDatabase(this.firebase);
    let init = true;

    if (!this.settings.enableNotification) {
      return;
    }

    if (this.realtimeDatabase.getNewItemBy === Consts.GET_NEW_ITEM_BY_GRAB_LIMIT) {
      switch (this.realtimeDatabase.grabType) {
        case Consts.GRAB_LIMIT_TO_FIRST:
          fbDatabase.onFirstChildUpdated('notifications', 1, (snapshot) => {
            this.triggerNotify(snapshot.val());
          });
          break;
        case Consts.GRAB_LIMIT_TO_LAST:
          fbDatabase.onNewChildAdded('notifications', 1, (snapshot, prevChildKey) => {
            if (init) {
              init = false;
              return;
            }
            this.triggerNotify(snapshot.val());
          });
          break;
      }
    } else if (this.realtimeDatabase.getNewItemBy === Consts.GET_NEW_ITEM_BY_ORDER_BY) {
      fbDatabase.onAfterStartAtChild('notifications', this.realtimeDatabase.orderBy, Date.now(), (snapshot, prevChildKey) => {
        this.triggerNotify(snapshot.val());
      });
    }
  }

  async triggerNotify(item) {
    console.log(item);
    let buttons = [];
    if (item.ok === false && item.isNew === true) {
      // Add button close for new mail & non-exist
      buttons.push({
        title: '新規メールなので問題ないです'
      });
    }

    let notiType = item.ok === true ? 'success' : 'warning';
    let icon = ((await this.localStorage.get('appsScript.icon_' + notiType)) || 'img/notification.png');
    let noti = new Notification(null, 'basic', icon, item.title, item.message, buttons);
    noti.show();

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
    let fbDatabase = new FirebaseDatabase(this.firebase);
    fbDatabase.database.ref(this.realtimeDatabase.collection).off();
  }
}
