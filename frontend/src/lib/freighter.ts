import {
  isConnected,
  isAllowed,
  setAllowed,
  getUserInfo,
  signTransaction,
} from "@stellar/freighter-api";

export interface WalletState {
  connected: boolean;
  publicKey: string | null;
  network: string;
}

export async function checkFreighterInstalled(): Promise<boolean> {
  try {
    const connectedResult = await isConnected();
    return !!connectedResult;
  } catch (err) {
    console.warn("Freighter connection check failed:", err);
    return false;
  }
}

export async function connectFreighter(): Promise<string | null> {
  try {
    const installed = await checkFreighterInstalled();
    if (!installed) {
      alert("Freighter wallet is not installed. Please install Freighter from https://freighter.app");
      return null;
    }

    const allowed = await isAllowed();
    if (!allowed) {
      await setAllowed();
    }

    const userInfo = await getUserInfo();
    return userInfo.publicKey || null;
  } catch (err) {
    console.error("Failed to connect Freighter wallet:", err);
    return null;
  }
}

export async function signWithFreighter(
  xdr: string,
  networkPassphrase = "Test SDF Network ; September 2015"
): Promise<string | null> {
  try {
    const signedXdr = await signTransaction(xdr, {
      networkPassphrase,
    });
    return signedXdr;
  } catch (err) {
    console.error("Freighter transaction signing error:", err);
    throw err;
  }
}
