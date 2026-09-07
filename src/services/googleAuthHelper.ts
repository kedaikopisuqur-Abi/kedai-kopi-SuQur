import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

export interface GoogleUserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  emailVerified?: boolean;
}

export interface GoogleAuthResult {
  user: GoogleUserProfile;
  accessToken: string;
  method: 'firebase' | 'gsi';
}

export interface DomainAuthInfo {
  currentDomain: string;
  projectId: string;
  consoleUrl: string;
  isUnauthorizedDomain: boolean;
  rawError?: any;
}

/**
 * Check if an error is a Firebase auth/unauthorized-domain error
 */
export function isUnauthorizedDomainError(error: any): boolean {
  if (!error) return false;
  const msg = (error.message || error.code || String(error)).toLowerCase();
  return (
    msg.includes('auth/unauthorized-domain') ||
    msg.includes('unauthorized-domain') ||
    msg.includes('unauthorized domain') ||
    msg.includes('domain is not authorized')
  );
}

/**
 * Check if an error was caused by a browser popup blocker
 */
export function isPopupBlockedError(error: any): boolean {
  if (!error) return false;
  const msg = (error.message || error.code || error.type || String(error)).toLowerCase();
  return (
    error.isPopupBlocked === true ||
    msg.includes('popup_failed_to_open') ||
    msg.includes('popup_closed') ||
    msg.includes('failed to open popup') ||
    msg.includes('blocked by the browser') ||
    msg.includes('popup diblokir') ||
    msg.includes('popup window') ||
    msg.includes('gsi_logger')
  );
}

/**
 * Extract domain and console URL details from current environment
 */
export function getDomainAuthInfo(error?: any): DomainAuthInfo {
  const currentDomain = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const projectId = firebaseConfig.projectId || 'herculian-talent-lc9s2';
  const consoleUrl = `https://console.firebase.google.com/project/${projectId}/authentication/settings`;

  return {
    currentDomain,
    projectId,
    consoleUrl,
    isUnauthorizedDomain: isUnauthorizedDomainError(error),
    rawError: error,
  };
}

/**
 * Dynamically load Google Identity Services (GSI) script
 */
export function loadGsiScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((window as any).google?.accounts?.oauth2) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.getElementById('google-gsi-client');
    if (existing) {
      if ((window as any).google?.accounts?.oauth2) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', (e) => reject(e));
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-gsi-client';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (e) => reject(e);
    document.head.appendChild(script);
  });
}

/**
 * Sign in using Google Identity Services (GSI) Token Client as a direct fallback
 */
export async function signInViaGsi(scopes: string[]): Promise<GoogleAuthResult> {
  // If already loaded, no async delay needed
  if (!(window as any).google?.accounts?.oauth2) {
    await loadGsiScript();
  }
  const google = (window as any).google;
  if (!google?.accounts?.oauth2) {
    throw new Error('Google Identity Services (GSI) belum siap atau diblokir oleh browser.');
  }

  const clientId =
    (firebaseConfig as any).oAuthClientId ||
    '942664049990-jdr375lvt4m8qc5bnpejlbltnhn4gtbu.apps.googleusercontent.com';

  return new Promise((resolve, reject) => {
    let isSettled = false;

    // Timeout fallback if popup is closed or blocked silently by browser
    const timer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        const isIframe = typeof window !== 'undefined' && window.self !== window.top;
        const msg = isIframe
          ? 'Jendela popup Google OAuth diblokir oleh browser / iframe. Buka aplikasi di Tab Baru atau gunakan sinkronisasi Webhook Google Sheets.'
          : 'Waktu otorisasi Google telah habis atau jendela login ditutup.';
        const err: any = new Error(msg);
        err.isPopupBlocked = true;
        reject(err);
      }
    }, 25000);

    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: scopes.join(' '),
        callback: async (response: any) => {
          if (isSettled) return;
          isSettled = true;
          clearTimeout(timer);

          if (response.error) {
            const errObj: any = new Error(response.error_description || response.error);
            if (response.error === 'popup_closed' || response.error === 'popup_failed_to_open') {
              errObj.isPopupBlocked = true;
            }
            reject(errObj);
            return;
          }
          if (!response.access_token) {
            reject(new Error('Tidak ada Access Token yang diterima dari Google.'));
            return;
          }

          let userProfile: GoogleUserProfile = {
            uid: 'google-user-' + Date.now(),
            displayName: 'Pengguna Google (OAuth)',
            email: null,
            photoURL: null,
          };

          try {
            const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${response.access_token}` },
            });
            if (userInfoRes.ok) {
              const userInfo = await userInfoRes.json();
              userProfile = {
                uid: userInfo.sub || userProfile.uid,
                displayName: userInfo.name || userInfo.email || 'Pengguna Google',
                email: userInfo.email || null,
                photoURL: userInfo.picture || null,
                emailVerified: userInfo.email_verified,
              };
            }
          } catch (fetchErr) {
            console.debug('Notice fetching Google userinfo:', fetchErr);
          }

          resolve({
            user: userProfile,
            accessToken: response.access_token,
            method: 'gsi',
          });
        },
        error_callback: (err: any) => {
          if (isSettled) return;
          isSettled = true;
          clearTimeout(timer);
          console.debug('[GoogleAuth] GSI error callback caught:', err);
          const isPopupBlocked =
            err?.type === 'popup_failed_to_open' ||
            err?.type === 'popup_closed' ||
            String(err?.message || '').toLowerCase().includes('popup') ||
            String(err?.type || '').toLowerCase().includes('popup');

          const isIframe = typeof window !== 'undefined' && window.self !== window.top;
          const message = isPopupBlocked
            ? (isIframe
                ? 'Jendela popup Google OAuth diblokir oleh browser di dalam iframe. Silakan buka aplikasi di Tab Baru atau gunakan sinkronisasi Webhook Google Sheets.'
                : 'Jendela popup Google OAuth diblokir oleh browser. Harap izinkan popup di browser Anda.')
            : (err?.message || err?.type || 'Gagal membuka otorisasi Google.');

          const customErr: any = new Error(message);
          customErr.isPopupBlocked = isPopupBlocked;
          customErr.rawError = err;
          reject(customErr);
        },
      });

      client.requestAccessToken({ prompt: 'consent' });
    } catch (initErr: any) {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        reject(initErr);
      }
    }
  });
}

/**
 * Unified Google Sign-in with resilient multi-tier fallback:
 * 1. Checks if running on Cloud Run preview domain (*.run.app) or unauthorized domain
 * 2. If running on a preview domain, prioritizes GSI directly to preserve user click activation
 * 3. Falls back gracefully between Firebase Auth Popup and GSI
 */
export async function executeResilientGoogleSignIn(scopes: string[]): Promise<GoogleAuthResult> {
  const currentDomain = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const projectId = firebaseConfig.projectId || 'herculian-talent-lc9s2';
  const isCloudRunDomain = currentDomain.endsWith('.run.app');

  // If on a Cloud Run domain, GSI is directly preferred to preserve user click activation
  // avoiding the failed Firebase auth/unauthorized-domain network delay which triggers popup blockers
  if (isCloudRunDomain && (window as any).google?.accounts?.oauth2) {
    try {
      console.log('[GoogleAuth] Menjalankan Google Identity Services (GSI) langsung untuk Cloud Run...');
      return await signInViaGsi(scopes);
    } catch (gsiDirectErr: any) {
      console.debug('[GoogleAuth] GSI direct attempt notice:', gsiDirectErr);
      if (isPopupBlockedError(gsiDirectErr)) {
        throw gsiDirectErr;
      }
    }
  }

  // Tier 1: Try Firebase Auth Popup
  try {
    const provider = new GoogleAuthProvider();
    scopes.forEach((scope) => provider.addScope(scope));

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken;

    if (!accessToken) {
      throw new Error('Gagal memperoleh Access Token dari kredensial Firebase.');
    }

    return {
      user: {
        uid: result.user.uid,
        displayName: result.user.displayName,
        email: result.user.email,
        photoURL: result.user.photoURL,
        emailVerified: result.user.emailVerified,
      },
      accessToken,
      method: 'firebase',
    };
  } catch (firebaseErr: any) {
    console.debug('[GoogleAuth] Firebase Popup warning/error:', firebaseErr?.code || firebaseErr?.message);

    // If unauthorized-domain, popup blocked, or Firebase provider not enabled, attempt GSI fallback
    try {
      console.log('[GoogleAuth] Mencoba autentikasi alternatif via Google Identity Services (GSI)...');
      const gsiResult = await signInViaGsi(scopes);
      return gsiResult;
    } catch (gsiErr: any) {
      console.debug('[GoogleAuth] GSI fallback error:', gsiErr);
      if (isPopupBlockedError(gsiErr)) {
        (gsiErr as any).isDomainError = isUnauthorizedDomainError(firebaseErr);
        (gsiErr as any).domain = currentDomain;
        (gsiErr as any).projectId = projectId;
        throw gsiErr;
      }
    }

    if (isUnauthorizedDomainError(firebaseErr)) {
      const err: any = new Error(
        `Domain "${currentDomain}" belum didaftarkan di Firebase Authentication Authorized Domains. Silakan tambahkan domain ini di Firebase Console (${projectId}) atau gunakan sinkronisasi Webhook Google Sheets.`
      );
      err.isUnauthorizedDomain = true;
      err.domain = currentDomain;
      err.projectId = projectId;
      err.consoleUrl = `https://console.firebase.google.com/project/${projectId}/authentication/settings`;
      throw err;
    }

    throw firebaseErr;
  }
}
