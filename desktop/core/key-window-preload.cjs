// Nøglevinduets bro. Siden får kun disse seks kald og ingen adgang til ipcRenderer. Hovedprocessen kontrollerer, at
// kaldet kommer fra netop nøglevinduets side.
const { contextBridge, ipcRenderer } = require('electron');
const call = (channel, value) => ipcRenderer.invoke(channel, value);
contextBridge.exposeInMainWorld('keyWindow', Object.freeze({
  cancel: () => call('key-window:cancel'),
  context: () => call('key-window:context'),
  help: () => call('key-window:help'),
  resize: height => call('key-window:resize', Number(height)),
  saveAnyway: () => call('key-window:save-anyway'),
  submit: value => call('key-window:submit', String(value))
}));
