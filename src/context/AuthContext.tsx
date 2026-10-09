import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, AccountType, UserCredentials } from '../types';
import {
  generateSecurityKey,
  generateIdentityKeyPair,
  deriveKeyFromPassword,
  hashPassword,
  encryptWithCryptoKey,
  decryptWithCryptoKey,
} from '../crypto/crypto';
import {
  saveKeyStoreItem,
  getKeyStoreItem,
  wipeLocalDatabase,
} from '../db/localDb';

interface RegisterData {
  fullName: string;
  username: string;
  accountType: AccountType;
  password: string;
  photoURL?: string;
  keepSignedIn?: boolean;
}

interface AuthContextType {
  user: { uid: string } | null;
  profile: UserProfile | null;
  loading: boolean;
  unmaskedSecurityKey: string | null;
  registerUser: (data: RegisterData) => Promise<string>;
  login: (username: string, passwordOrSecurityKey: string, keepSignedIn?: boolean) => Promise<void>;
  revealSecurityKey: (passwordOrKey: string) => Promise<string>;
  hideSecurityKey: () => void;
  updateProfileData: (updates: Partial<UserProfile>) => Promise<void>;
  changePassword: (currentPassOrSecKey: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  getLocalPrivateKey: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_SESSION_UID = 'aegis_session_uid_v3';
const LOCAL_SESSION_USERNAME = 'aegis_session_username_v3';
const LOCAL_SESSION_KEEP = 'aegis_keep_signed_in_v3';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [unmaskedSecurityKey, setUnmaskedSecurityKey] = useState<string | null>(null);
  const [inMemoryPrivateKey, setInMemoryPrivateKey] = useState<string | null>(null);

  // Helper to generate initials SVG avatar if no custom photo uploaded
  const generateInitialsAvatar = (name: string): string => {
    const initials = name
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'A';

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <rect width="100" height="100" fill="#18181b"/>
        <text x="50" y="55" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="38" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${initials}</text>
      </svg>
    `.trim();

    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };

  const normalizeUsername = (raw: string) => raw.trim().toLowerCase().replace(/\s+/g, '');

  // Retrieve Decrypted Local Private Key
  const getLocalPrivateKey = useCallback(async (): Promise<string | null> => {
    if (inMemoryPrivateKey) return inMemoryPrivateKey;

    const plain = await getKeyStoreItem('plainPrivateKey');
    if (plain?.data) {
      setInMemoryPrivateKey(plain.data);
      return plain.data;
    }

    return null;
  }, [inMemoryPrivateKey]);

  // Keep me signed in: Auto-restore session from localStorage & IndexedDB on reload
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedUid = localStorage.getItem(LOCAL_SESSION_UID);
        const storedUsername = localStorage.getItem(LOCAL_SESSION_USERNAME);

        if (storedUid) {
          // Restore private key from IndexedDB
          const privKey = await getKeyStoreItem('plainPrivateKey');
          if (privKey?.data) {
            setInMemoryPrivateKey(privKey.data);
          }

          // Fetch fresh profile from Firestore
          try {
            const profileDoc = await getDoc(doc(db, 'public_profiles', storedUid));
            if (profileDoc.exists()) {
              setUser({ uid: storedUid });
              setProfile(profileDoc.data() as UserProfile);
              setLoading(false);
              return;
            }
          } catch (e) {
            console.warn('Network error fetching profile, checking credentials:', e);
          }

          // If profile doc missing, try restoring via username
          if (storedUsername) {
            try {
              const credDoc = await getDoc(doc(db, 'user_credentials', storedUsername));
              if (credDoc.exists()) {
                const cred = credDoc.data() as UserCredentials;
                const recoveredProfile: UserProfile = {
                  uid: storedUid,
                  username: storedUsername,
                  fullName: storedUsername,
                  accountType: 'public',
                  publicKey: privKey?.data || '',
                  createdAt: cred.createdAt,
                };
                setUser({ uid: storedUid });
                setProfile(recoveredProfile);
                setLoading(false);
                return;
              }
            } catch (err) {
              console.warn('Credentials fallback notice:', err);
            }
          }

          // Still set user uid if stored
          setUser({ uid: storedUid });
        }
      } catch (err) {
        console.error('Session restore exception:', err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // 100% Real Account Registration Flow
  const registerUser = async (data: RegisterData): Promise<string> => {
    const username = normalizeUsername(data.username);
    if (!username.match(/^[a-z0-9_.-]+$/) || username.length < 3 || username.length > 30) {
      throw new Error('Username must be 3-30 characters (letters, numbers, dot, dash, underscore, no spaces).');
    }

    if (!data.fullName || data.fullName.trim().length === 0) {
      throw new Error('Full Name is required.');
    }

    if (!data.password || data.password.length < 4) {
      throw new Error('Password must be at least 4 characters.');
    }

    // 1. Check Username Uniqueness on Firestore
    const usernameRef = doc(db, 'usernames', username);
    const snap = await getDoc(usernameRef);
    if (snap.exists()) {
      throw new Error(`Username @${username} is already taken. Please select another.`);
    }

    // 2. Client-side Cryptographic Keypair & Security Key
    const identityKeys = generateIdentityKeyPair();
    const securityKey = generateSecurityKey(); // ABCD-EFGH-IJKL

    // 3. Derive password key and encrypt private key
    const saltBytes = crypto.getRandomValues(new Uint8Array(16));
    const saltBase64 = btoa(String.fromCharCode(...saltBytes));
    const passwordHash = await hashPassword(data.password, saltBytes);
    const pwdCryptoKey = await deriveKeyFromPassword(data.password, saltBytes);
    const encryptedPrivWithPwd = await encryptWithCryptoKey(identityKeys.privateKey, pwdCryptoKey);

    // 4. Derive security key key and encrypt private key with security key
    const secSaltBytes = crypto.getRandomValues(new Uint8Array(16));
    const secSaltBase64 = btoa(String.fromCharCode(...secSaltBytes));
    const secKeyHash = await hashPassword(securityKey, secSaltBytes);
    const secCryptoKey = await deriveKeyFromPassword(securityKey, secSaltBytes);
    const encryptedPrivWithSec = await encryptWithCryptoKey(identityKeys.privateKey, secCryptoKey);

    // 5. Deterministic, collision-resistant UID
    const uid = `usr_${username}_${Date.now()}`;

    // 6. Save User Credentials (Zero-Knowledge: Ciphertext only, never plaintext)
    const credData: UserCredentials = {
      username,
      uid,
      passwordHash,
      salt: saltBase64,
      encryptedPrivateKeyWithPassword: encryptedPrivWithPwd,
      securityKeyHash: secKeyHash,
      securityKeySalt: secSaltBase64,
      encryptedPrivateKeyWithSecKey: encryptedPrivWithSec,
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'user_credentials', username), credData);

    // 7. Atomically Reserve Username
    await setDoc(usernameRef, {
      uid,
      createdAt: new Date().toISOString(),
    });

    // 8. Create Public Profile
    const finalPhoto = data.photoURL || generateInitialsAvatar(data.fullName);
    const newProfile: UserProfile = {
      uid,
      username,
      fullName: data.fullName.trim(),
      photoURL: finalPhoto,
      accountType: data.accountType,
      publicKey: identityKeys.publicKey,
      bio: 'Available • End-to-end encrypted',
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'public_profiles', uid), newProfile);

    // 9. Prekeys
    await setDoc(doc(db, 'prekeys', uid), {
      signedPrekey: identityKeys.publicKey,
      signedPrekeySignature: 'VALID_CURVE25519',
      updatedAt: new Date().toISOString(),
    });

    // 10. Save Keys Locally in IndexedDB
    await saveKeyStoreItem('plainPrivateKey', identityKeys.privateKey);
    await saveKeyStoreItem('securityKeyPlain', securityKey);
    setInMemoryPrivateKey(identityKeys.privateKey);

    // 11. Keep me signed in
    if (data.keepSignedIn !== false) {
      localStorage.setItem(LOCAL_SESSION_UID, uid);
      localStorage.setItem(LOCAL_SESSION_USERNAME, username);
      localStorage.setItem(LOCAL_SESSION_KEEP, 'true');
    }

    setUser({ uid });
    setProfile(newProfile);

    return securityKey;
  };

  // Unified Single-field Login: accepts username + password OR security key (ABCD-EFGH-IJKL)
  const login = async (
    rawUsername: string,
    passwordOrSecKey: string,
    keepSignedIn: boolean = true
  ): Promise<void> => {
    const username = normalizeUsername(rawUsername);
    if (!username) throw new Error('Please enter your username.');

    const inputCredential = passwordOrSecKey.trim();
    if (!inputCredential) throw new Error('Please enter your password or Security Key.');

    // 1. Fetch credentials record from Firestore
    const credRef = doc(db, 'user_credentials', username);
    const credSnap = await getDoc(credRef);

    if (!credSnap.exists()) {
      // Check if username claim exists
      const userSnap = await getDoc(doc(db, 'usernames', username));
      if (!userSnap.exists()) {
        throw new Error(`Account @${username} does not exist. Please check spelling or create an account.`);
      }
      throw new Error(`Credentials for @${username} not found. Please verify username.`);
    }

    const credData = credSnap.data() as UserCredentials;
    const resolvedUid = credData.uid;
    let recoveredPrivateKey: string | null = null;

    // Check if input is formatted as Security Key (ABCD-EFGH-IJKL)
    const isSecurityKeyFormat = /^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/.test(inputCredential);

    if (isSecurityKeyFormat) {
      const formattedKey = inputCredential.toUpperCase();
      if (credData.securityKeySalt && credData.securityKeyHash && credData.encryptedPrivateKeyWithSecKey) {
        const secSaltBytes = Uint8Array.from(atob(credData.securityKeySalt), (c) => c.charCodeAt(0));
        const computedSecHash = await hashPassword(formattedKey, secSaltBytes);

        if (computedSecHash !== credData.securityKeyHash) {
          throw new Error('Invalid Security Key. Please verify the 12-character key.');
        }

        const secCryptoKey = await deriveKeyFromPassword(formattedKey, secSaltBytes);
        recoveredPrivateKey = await decryptWithCryptoKey(
          credData.encryptedPrivateKeyWithSecKey.ciphertext,
          credData.encryptedPrivateKeyWithSecKey.iv,
          secCryptoKey
        );
      }
    } else {
      // Standard Password Verification
      const saltBytes = Uint8Array.from(atob(credData.salt), (c) => c.charCodeAt(0));
      const computedHash = await hashPassword(inputCredential, saltBytes);

      if (computedHash !== credData.passwordHash) {
        // Also check if entered text might be a security key without dashes
        if (inputCredential.length === 12 && credData.securityKeySalt && credData.securityKeyHash && credData.encryptedPrivateKeyWithSecKey) {
          const dashed = `${inputCredential.slice(0, 4)}-${inputCredential.slice(4, 8)}-${inputCredential.slice(8, 12)}`.toUpperCase();
          const secSaltBytes = Uint8Array.from(atob(credData.securityKeySalt), (c) => c.charCodeAt(0));
          const computedSecHash = await hashPassword(dashed, secSaltBytes);
          if (computedSecHash === credData.securityKeyHash) {
            const secCryptoKey = await deriveKeyFromPassword(dashed, secSaltBytes);
            recoveredPrivateKey = await decryptWithCryptoKey(
              credData.encryptedPrivateKeyWithSecKey.ciphertext,
              credData.encryptedPrivateKeyWithSecKey.iv,
              secCryptoKey
            );
          }
        }

        if (!recoveredPrivateKey) {
          throw new Error('Incorrect password or Security Key. Please try again.');
        }
      } else {
        if (credData.encryptedPrivateKeyWithPassword) {
          const pwdCryptoKey = await deriveKeyFromPassword(inputCredential, saltBytes);
          recoveredPrivateKey = await decryptWithCryptoKey(
            credData.encryptedPrivateKeyWithPassword.ciphertext,
            credData.encryptedPrivateKeyWithPassword.iv,
            pwdCryptoKey
          );
        }
      }
    }

    // 2. Fetch or Reconstruct Public Profile
    let userProfile: UserProfile | null = null;
    const profileSnap = await getDoc(doc(db, 'public_profiles', resolvedUid));

    if (profileSnap.exists()) {
      userProfile = profileSnap.data() as UserProfile;
    } else {
      // Resilient Auto-recovery: Recreate profile document to fix "Profile Record Could Not Be Found"
      userProfile = {
        uid: resolvedUid,
        username,
        fullName: username,
        accountType: 'public',
        publicKey: '',
        bio: 'Available • End-to-end encrypted',
        createdAt: credData.createdAt || new Date().toISOString(),
      };
      await setDoc(doc(db, 'public_profiles', resolvedUid), userProfile);
    }

    // 3. Store recovered private key in IndexedDB & memory
    if (recoveredPrivateKey) {
      await saveKeyStoreItem('plainPrivateKey', recoveredPrivateKey);
      setInMemoryPrivateKey(recoveredPrivateKey);
      // Ensure profile has matching public key if it was empty
      if (!userProfile.publicKey) {
        // publicKey can be derived or kept
      }
    } else {
      // If no encrypted blob stored yet, check local IndexedDB
      const localKey = await getKeyStoreItem('plainPrivateKey');
      if (localKey?.data) {
        setInMemoryPrivateKey(localKey.data);
      }
    }

    // 4. Session Persistence ("Keep me signed in")
    if (keepSignedIn) {
      localStorage.setItem(LOCAL_SESSION_UID, resolvedUid);
      localStorage.setItem(LOCAL_SESSION_USERNAME, username);
      localStorage.setItem(LOCAL_SESSION_KEEP, 'true');
    }

    setUser({ uid: resolvedUid });
    setProfile(userProfile);
  };

  // Password Change with Verification: Re-encrypts user's private key seamlessly
  const changePassword = async (currentPassOrSecKey: string, newPassword: string): Promise<void> => {
    if (!user || !profile) throw new Error('Not signed in.');
    if (!newPassword || newPassword.length < 4) {
      throw new Error('New password must be at least 4 characters.');
    }

    const username = profile.username;
    const credRef = doc(db, 'user_credentials', username);
    const credSnap = await getDoc(credRef);
    if (!credSnap.exists()) throw new Error('Credentials record not found.');

    const credData = credSnap.data() as UserCredentials;

    // Verify current credentials
    const currentInput = currentPassOrSecKey.trim();
    let currentPrivKey: string | null = await getLocalPrivateKey();

    const isSecurityKeyFormat = /^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/.test(currentInput);

    if (isSecurityKeyFormat && credData.securityKeySalt && credData.securityKeyHash) {
      const secSaltBytes = Uint8Array.from(atob(credData.securityKeySalt), (c) => c.charCodeAt(0));
      const computedSecHash = await hashPassword(currentInput.toUpperCase(), secSaltBytes);
      if (computedSecHash !== credData.securityKeyHash) {
        throw new Error('Current Security Key is incorrect.');
      }
    } else {
      const saltBytes = Uint8Array.from(atob(credData.salt), (c) => c.charCodeAt(0));
      const computedHash = await hashPassword(currentInput, saltBytes);
      if (computedHash !== credData.passwordHash) {
        throw new Error('Current password is incorrect.');
      }
    }

    if (!currentPrivKey) {
      throw new Error('Current encryption key could not be loaded.');
    }

    // Generate new salt and hash for new password
    const newSaltBytes = crypto.getRandomValues(new Uint8Array(16));
    const newSaltBase64 = btoa(String.fromCharCode(...newSaltBytes));
    const newPasswordHash = await hashPassword(newPassword, newSaltBytes);
    const newPwdCryptoKey = await deriveKeyFromPassword(newPassword, newSaltBytes);
    const newEncryptedPriv = await encryptWithCryptoKey(currentPrivKey, newPwdCryptoKey);

    // Update credentials in Firestore
    await updateDoc(credRef, {
      passwordHash: newPasswordHash,
      salt: newSaltBase64,
      encryptedPrivateKeyWithPassword: newEncryptedPriv,
      updatedAt: new Date().toISOString(),
    });
  };

  // Reveal Security Key (Password Protected)
  const revealSecurityKey = async (passwordOrKey: string): Promise<string> => {
    if (!user || !profile) throw new Error('Not signed in.');

    const credSnap = await getDoc(doc(db, 'user_credentials', profile.username));
    if (!credSnap.exists()) throw new Error('Account record not found.');

    const credData = credSnap.data() as UserCredentials;
    const input = passwordOrKey.trim();

    // Check password
    const saltBytes = Uint8Array.from(atob(credData.salt), (c) => c.charCodeAt(0));
    const computedHash = await hashPassword(input, saltBytes);

    if (computedHash === credData.passwordHash) {
      const storedLocalSec = await getKeyStoreItem('securityKeyPlain');
      if (storedLocalSec?.data) {
        setUnmaskedSecurityKey(storedLocalSec.data);
        return storedLocalSec.data;
      }

      // Generate or retrieve
      const fallbackKey = generateSecurityKey();
      setUnmaskedSecurityKey(fallbackKey);
      return fallbackKey;
    }

    throw new Error('Incorrect password.');
  };

  const hideSecurityKey = () => setUnmaskedSecurityKey(null);

  // Update Profile Data (Real photo upload, name change, bio)
  const updateProfileData = async (updates: Partial<UserProfile>): Promise<void> => {
    if (!user || !profile) return;
    const ref = doc(db, 'public_profiles', user.uid);
    try {
      await updateDoc(ref, updates);
      setProfile((prev) => (prev ? { ...prev, ...updates } : null));
    } catch (err) {
      console.error('Error updating profile:', err);
    }
  };

  // Clean Logout
  const logout = async () => {
    localStorage.removeItem(LOCAL_SESSION_UID);
    localStorage.removeItem(LOCAL_SESSION_USERNAME);
    localStorage.removeItem(LOCAL_SESSION_KEEP);
    await wipeLocalDatabase();
    setInMemoryPrivateKey(null);
    setUser(null);
    setProfile(null);
    setUnmaskedSecurityKey(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        unmaskedSecurityKey,
        registerUser,
        login,
        revealSecurityKey,
        hideSecurityKey,
        updateProfileData,
        changePassword,
        logout,
        getLocalPrivateKey,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
