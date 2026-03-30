declare global {
  interface Window {
    __wekaGsiInitialized?: boolean;
    __wekaGsiClientId?: string;
    __wekaGoogleCredentialHandler?: (r: unknown) => void;
  }
}

export function setGoogleCredentialHandler(handler: (r: unknown) => void) {
  window.__wekaGoogleCredentialHandler = handler;
}

export function clearGoogleCredentialHandler() {
  delete window.__wekaGoogleCredentialHandler;
}

export function ensureGoogleIdentityInitialized(clientId: string): boolean {
  const gsi = window.google?.accounts?.id;
  if (!gsi) return false;

  const needNewInit =
    !window.__wekaGsiInitialized || window.__wekaGsiClientId !== clientId;

  if (needNewInit) {
    gsi.initialize({
      client_id: clientId,
      callback: (response: unknown) => {
        window.__wekaGoogleCredentialHandler?.(response);
      },
      use_fedcm_for_prompt: false,
    });
    window.__wekaGsiInitialized = true;
    window.__wekaGsiClientId = clientId;
  }
  return true;
}

export function clearGoogleButtonHost(host: HTMLElement | null) {
  if (!host) return;
  try {
    host.replaceChildren();
  } catch {
    host.innerHTML = '';
  }
}
