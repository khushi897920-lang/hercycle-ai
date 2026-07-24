'use client';

import { createContext, useContext, useState, useCallback } from 'react';

const EncryptionContext = createContext();

export function EncryptionProvider({ children }) {
    const [aesKey, setAesKey] = useState(null);

    const deriveKey = useCallback(async (pin, salt) => {
        try {
            const encoder = new TextEncoder();
            
            const keyMaterial = await window.crypto.subtle.importKey(
                "raw",
                encoder.encode(pin),
                "PBKDF2",
                false,
                ["deriveKey"]
            );

            // Ensure salt is a Buffer source
            const saltBuffer = typeof salt === 'string' ? encoder.encode(salt) : salt;

            if (!saltBuffer) {
                throw new Error("Salt is required for key derivation");
            }

            const key = await window.crypto.subtle.deriveKey(
                {
                    name: "PBKDF2",
                    salt: saltBuffer,
                    iterations: 100000,
                    hash: "SHA-256",
                },
                keyMaterial,
                {
                    name: "AES-GCM",
                    length: 256,
                },
                false,
                ["encrypt", "decrypt"]
            );

            setAesKey(key);
            return key;
        } catch (error) {
            console.error("Key derivation failed", error);
            throw error;
        }
    }, []);

    const encrypt = useCallback(async (data) => {
        if (!aesKey) throw new Error("Encryption key not derived yet");

        const encoder = new TextEncoder();
        const iv = window.crypto.getRandomValues(new Uint8Array(12));

        const encrypted = await window.crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv,
            },
            aesKey,
            encoder.encode(JSON.stringify(data))
        );

        // Convert to Base64
        const ivBase64 = btoa(String.fromCharCode(...iv));
        const cipherBase64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));

        return {
            iv: ivBase64,
            ciphertext: cipherBase64
        };
    }, [aesKey]);

    const decrypt = useCallback(async (encryptedData) => {
        if (!aesKey) throw new Error("Encryption key not derived yet");
        
        // If encryptedData is a string, it might be stringified JSON
        let dataToDecrypt = encryptedData;
        if (typeof dataToDecrypt === 'string') {
            try {
                dataToDecrypt = JSON.parse(dataToDecrypt);
            } catch (e) {
                // If it can't be parsed, let it fail below
            }
        }
        
        const { iv, ciphertext } = dataToDecrypt;
        if (!iv || !ciphertext) throw new Error("Invalid encrypted data format");

        const ivBuffer = new Uint8Array(atob(iv).split('').map(char => char.charCodeAt(0)));
        const cipherBuffer = new Uint8Array(atob(ciphertext).split('').map(char => char.charCodeAt(0)));

        const decrypted = await window.crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: ivBuffer,
            },
            aesKey,
            cipherBuffer
        );

        const decoder = new TextDecoder();
        return JSON.parse(decoder.decode(decrypted));
    }, [aesKey]);

    const clearKey = useCallback(() => {
        setAesKey(null);
    }, []);

    return (
        <EncryptionContext.Provider
            value={{
                deriveKey,
                encrypt,
                decrypt,
                clearKey,
                isUnlocked: !!aesKey
            }}
        >
            {children}
        </EncryptionContext.Provider>
    );
}

export function useEncryption() {
    const context = useContext(EncryptionContext);
    if (!context) {
        throw new Error("useEncryption must be used within an EncryptionProvider");
    }
    return context;
}
