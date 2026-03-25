'use strict';

const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let serverProc = null;

function startServer() {
  serverProc = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env }
  });
  serverProc.unref();
  console.log('Server spawned, pid:', serverProc.pid);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'PromptHub Local',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
    backgroundColor: '#0d1117',
    show: false,
  });

  win.once('ready-to-show', () => win.show());
  win.loadURL('http://localhost:3355');
}

app.whenReady().then(() => {
  startServer();
  // Give server a moment to bind
  setTimeout(createWindow, 500);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

process.on('exit', () => {
  if (serverProc) serverProc.kill();
});
