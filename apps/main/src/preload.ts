import { contextBridge } from 'electron';

// Minimal, safe bridge. The real typed IPC surface arrives in Sprint 04.
contextBridge.exposeInMainWorld('asf', {
  electronVersion: process.versions.electron,
});
