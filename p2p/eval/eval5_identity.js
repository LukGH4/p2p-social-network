if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    crypto: globalThis.crypto
  };
}

import { stats, printTable } from './helpers.js';

const keyOptions = {
  name: 'ECDSA',
  namedCurve: 'P-256'
};

const signatureOptions = {
  name: 'ECDSA',
  hash: {
    name: 'SHA-256'
  }
};

function convertBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binaryString = '';
  
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    binaryString = binaryString + String.fromCharCode(byte);
  }
  
  return btoa(binaryString);
}

function convertBase64ToBuffer(base64String) {
  const binaryString = atob(base64String);
  const buffer = new Uint8Array(binaryString.length);
  
  for (let i = 0; i < binaryString.length; i++) {
    buffer[i] = binaryString.charCodeAt(i);
  }
  
  return buffer.buffer;
}

async function createKeys() {
  const keyPair = await globalThis.crypto.subtle.generateKey(keyOptions, false, ['sign', 'verify']);
  const exportedPublicKey = await globalThis.crypto.subtle.exportKey('spki', keyPair.publicKey);
  const base64PublicKey = convertBufferToBase64(exportedPublicKey);
  
  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
    encodedPublicKey: base64PublicKey
  };
}

async function createSignature(textPayload, privateKey) {
  const encoder = new TextEncoder();
  const encodedData = encoder.encode(textPayload);
  const signatureBuffer = await globalThis.crypto.subtle.sign(signatureOptions, privateKey, encodedData);
  
  return convertBufferToBase64(signatureBuffer);
}

async function checkSignature(textPayload, base64Signature, base64PublicKey) {
  try {
    const publicKeyBuffer = convertBase64ToBuffer(base64PublicKey);
    const importedPublicKey = await globalThis.crypto.subtle.importKey('spki', publicKeyBuffer, keyOptions, true, ['verify']);
    
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(textPayload);
    const signatureBuffer = convertBase64ToBuffer(base64Signature);
    
    const isValid = await globalThis.crypto.subtle.verify(signatureOptions, importedPublicKey, signatureBuffer, encodedData);
    
    return isValid;
  } catch (error) {
    return false;
  }
}

function sortObjectKeys(objectToSort) {
  const keys = Object.keys(objectToSort);
  
  keys.sort(function(a, b) {
    return a.localeCompare(b);
  });
  
  const sortedObject = {};
  
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    sortedObject[key] = objectToSort[key];
  }
  
  return JSON.stringify(sortedObject);
}

function buildTestProfile(paddingSize) {
  let paddingString = '';
  
  for (let i = 0; i < paddingSize; i++) {
    paddingString = paddingString + 'A';
  }

  const profile = {
    bio: 'loves movies',
    peerId: 'eval-peer-identity',
    publicKey: 'PLACEHOLDER',
    tags: {
      era: {
        '2010s': 1
      },
      language: {
        english: 1
      }
    },
    timestamp: Date.now(),
    ttl: 3600000,
    username: 'alice',
    dummyData: paddingString
  };

  return profile;
}

const paddingSizes = [0, 10000, 50000, 100000, 500000, 1000000];
const totalRuns = 10;

console.log('Eval 5 — ECDSA sign + verify latency vs profile payload size');
console.log('Vary: payload bytes  |  Measure: sign + verify time  |  10 runs per size\n');

const keys = await createKeys();
const testResults = [];

for (let i = 0; i < paddingSizes.length; i++) {
  const currentPadding = paddingSizes[i];
  const currentProfile = buildTestProfile(currentPadding);
  
  currentProfile.publicKey = keys.encodedPublicKey;

  const jsonPayload = sortObjectKeys(currentProfile);
  const encoder = new TextEncoder();
  const byteLength = encoder.encode(jsonPayload).length;

  const signDurations = [];
  const verifyDurations = [];

  for (let run = 0; run < totalRuns; run++) {
    const startSignTime = performance.now();
    const signature = await createSignature(jsonPayload, keys.privateKey);
    const endSignTime = performance.now();
    const signDifference = endSignTime - startSignTime;
    
    signDurations.push(signDifference);

    const startVerifyTime = performance.now();
    await checkSignature(jsonPayload, signature, keys.encodedPublicKey);
    const endVerifyTime = performance.now();
    const verifyDifference = endVerifyTime - startVerifyTime;
    
    verifyDurations.push(verifyDifference);
  }

  const signStats = stats(signDurations);
  const verifyStats = stats(verifyDurations);
  const totalAverage = signStats.avg + verifyStats.avg;

  testResults.push({
    'bytes': byteLength,
    'sign avg (ms)': signStats.avg,
    'verify avg (ms)': verifyStats.avg,
    'total avg (ms)': Number(totalAverage.toFixed(2))
  });

  const bytesText = String(byteLength).padStart(7);
  const signText = signStats.avg;
  const verifyText = verifyStats.avg;
  const totalText = Number(totalAverage.toFixed(2));

  console.log(`  ${bytesText} B  →  sign ${signText}ms  verify ${verifyText}ms  total ${totalText}ms`);
}

console.log('\n--- Results ---');
printTable(testResults, ['bytes', 'sign avg (ms)', 'verify avg (ms)', 'total avg (ms)']);