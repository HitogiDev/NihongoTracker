import { create } from 'zustand';

export interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  /** Show the confirm action in the error color. */
  destructive?: boolean;
}

export interface ConfirmRequest extends ConfirmOptions {
  message: string;
  resolve: (confirmed: boolean) => void;
}

export const useConfirmStore = create<{ request: ConfirmRequest | null }>(
  () => ({ request: null }),
);

/**
 * Ask the user to confirm an action. Use this in place of `window.confirm`.
 * The promise gives true when the user confirms, and false otherwise.
 * `ConfirmDialogHost` must be mounted once, in `RootLayout`.
 */
export function confirmDialog(
  message: string,
  options: ConfirmOptions = {},
): Promise<boolean> {
  return new Promise((resolve) => {
    // A new request answers an open one with false.
    useConfirmStore.getState().request?.resolve(false);
    useConfirmStore.setState({ request: { ...options, message, resolve } });
  });
}
