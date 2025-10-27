import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("executor", {
  backendUrl: async () => ipcRenderer.invoke("get-backend-url"),
});
