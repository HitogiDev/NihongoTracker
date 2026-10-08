import { useEffect } from "react";
import { App } from "@capacitor/app";
import { Keyboard } from "@capacitor/keyboard";
import { SystemBars, SystemBarsStyle } from "@capacitor/core";
import { isNativeApp } from "../utils/nativeRuntime";
import { syncOfflineQueue } from "../offline/offlineQueue";
import { prefetchPersonalData } from "../offline/prefetch";

export default function NativeAppLifecycle() {
  useEffect(() => {
    if (!isNativeApp()) return;
    const root = document.documentElement;
    let keyboardOpen = false;
    let focusTimer: ReturnType<typeof setTimeout> | undefined;
    const showKeyboard = () => {
      keyboardOpen = true;
      root.dataset.nativeKeyboard = "true";
      clearTimeout(focusTimer);
      focusTimer = setTimeout(() => {
        document.activeElement?.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });
      }, 150);
    };
    const hideKeyboard = () => {
      keyboardOpen = false;
      delete root.dataset.nativeKeyboard;
      clearTimeout(focusTimer);
    };
    const keyboardListeners = [
      Keyboard.addListener("keyboardWillShow", showKeyboard),
      Keyboard.addListener("keyboardDidShow", showKeyboard),
      Keyboard.addListener("keyboardWillHide", hideKeyboard),
      Keyboard.addListener("keyboardDidHide", hideKeyboard),
    ];
    const syncBars = () => {
      const color = getComputedStyle(root)
        .getPropertyValue("--color-base-100")
        .trim();
      const lightness = /^oklch\(\s*([\d.]+)(%?)/.exec(color);
      const background = getComputedStyle(root).backgroundColor;
      const rgb = /^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)/.exec(background);
      const dark = lightness
        ? Number(lightness[1]) / (lightness[2] ? 100 : 1) < 0.6
        : rgb
          ? (Number(rgb[1]) * 0.299 + Number(rgb[2]) * 0.587 + Number(rgb[3]) * 0.114) < 150
          : getComputedStyle(root).colorScheme === "dark";
      void SystemBars.setStyle({
        style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
      }).catch(() => undefined);
    };
    const themeObserver = new MutationObserver(syncBars);
    themeObserver.observe(root, {
      attributes: true,
      attributeFilter: ["data-theme", "style"],
    });
    syncBars();
    const stateListener = App.addListener("appStateChange", ({ isActive }) => {
      if (isActive)
        void syncOfflineQueue()
          .then(() => prefetchPersonalData())
          .catch(() => undefined);
    });
    const backListener = App.addListener("backButton", () => {
      if (keyboardOpen) {
        void Keyboard.hide();
        return;
      }
      const dialogs =
        document.querySelectorAll<HTMLDialogElement>("dialog[open], dialog.modal-open");
      const dialog = dialogs[dialogs.length - 1];
      if (dialog) {
        if (dialog.dispatchEvent(new Event("cancel", { cancelable: true }))) {
          if (dialog.open) dialog.close();
          else dialog.querySelector<HTMLButtonElement>('.modal-backdrop button')?.click();
        }
        return;
      }
      const back = new Event("nihongo:native-back", { cancelable: true });
      if (window.dispatchEvent(back)) void App.exitApp();
    });
    return () => {
      void stateListener.then((handle) => handle.remove());
      void backListener.then((handle) => handle.remove());
      keyboardListeners.forEach(
        (listener) => void listener.then((handle) => handle.remove()),
      );
      themeObserver.disconnect();
      hideKeyboard();
    };
  }, []);
  return null;
}
