'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const VALID_EVENTS = [
  'announcements:updated',
  'settings:updated',
  'news:updated',
  'meetings:updated',
];

contextBridge.exposeInMainWorld('api', {
  get:  (key)       => ipcRenderer.invoke('data:get', key),
  save: (key, data) => ipcRenderer.invoke('data:save', key, data),
  on:   (channel, cb) => {
    if (VALID_EVENTS.includes(channel)) {
      ipcRenderer.on(channel, (_, data) => cb(data));
    }
  },
});