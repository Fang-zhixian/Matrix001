import firebaseConfig from '../firebase-applet-config.json';
import type { User as FirebaseUser } from 'firebase/auth';
import type { QuerySnapshot } from 'firebase/firestore';
import type { Canvas } from './types/canvas';

type FirebaseApp = import('firebase/app').FirebaseApp;

type FirebaseAuthServices = {
  auth: import('firebase/auth').Auth;
  authModule: typeof import('firebase/auth');
};

type FirebaseFirestoreServices = {
  db: import('firebase/firestore').Firestore;
  firestoreModule: typeof import('firebase/firestore');
};

let firebaseAppPromise: Promise<FirebaseApp> | null = null;
let firebaseAuthPromise: Promise<FirebaseAuthServices> | null = null;
let firebaseFirestorePromise: Promise<FirebaseFirestoreServices> | null = null;

async function getFirebaseApp() {
  if (!firebaseAppPromise) {
    firebaseAppPromise = (async () => {
      const { initializeApp } = await import('firebase/app');
      return initializeApp(firebaseConfig);
    })();
  }

  return firebaseAppPromise;
}

async function getFirebaseAuthServices(): Promise<FirebaseAuthServices> {
  if (!firebaseAuthPromise) {
    firebaseAuthPromise = (async () => {
      const [app, authModule] = await Promise.all([getFirebaseApp(), import('firebase/auth')]);

      return {
        auth: authModule.getAuth(app),
        authModule,
      };
    })();
  }

  return firebaseAuthPromise;
}

async function getFirebaseFirestoreServices(): Promise<FirebaseFirestoreServices> {
  if (!firebaseFirestorePromise) {
    firebaseFirestorePromise = (async () => {
      const [app, firestoreModule] = await Promise.all([getFirebaseApp(), import('firebase/firestore')]);

      return {
        db: firestoreModule.getFirestore(app, firebaseConfig.firestoreDatabaseId),
        firestoreModule,
      };
    })();
  }

  return firebaseFirestorePromise;
}

export async function subscribeToAuthChanges(
  callback: (user: FirebaseUser | null) => void
) {
  const { auth, authModule } = await getFirebaseAuthServices();
  return authModule.onAuthStateChanged(auth, callback);
}

export async function mergeUserProfile(user: FirebaseUser) {
  const { db, firestoreModule } = await getFirebaseFirestoreServices();
  const userRef = firestoreModule.doc(db, 'users', user.uid);

  await firestoreModule.setDoc(
    userRef,
    {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      lastLogin: Date.now(),
    },
    { merge: true }
  );
}

export async function saveCanvasDocument(userId: string, canvasId: string, canvas: unknown) {
  const { db, firestoreModule } = await getFirebaseFirestoreServices();
  const canvasRef = firestoreModule.doc(db, 'users', userId, 'canvases', canvasId);
  await firestoreModule.setDoc(canvasRef, canvas);
}

export async function deleteCanvasDocument(userId: string, canvasId: string) {
  const { db, firestoreModule } = await getFirebaseFirestoreServices();
  await firestoreModule.deleteDoc(firestoreModule.doc(db, 'users', userId, 'canvases', canvasId));
}

function snapshotToCanvases(snapshot: QuerySnapshot) {
  const canvases: Canvas[] = [];
  snapshot.forEach((document) => {
    canvases.push(document.data() as Canvas);
  });
  return canvases;
}

export async function subscribeToCanvasDocuments(
  userId: string,
  onData: (canvases: Canvas[]) => void,
  onError: (error: unknown) => void
) {
  const { db, firestoreModule } = await getFirebaseFirestoreServices();
  const canvasesRef = firestoreModule.collection(db, 'users', userId, 'canvases');
  const canvasesQuery = firestoreModule.query(canvasesRef);

  return firestoreModule.onSnapshot(
    canvasesQuery,
    (snapshot) => {
      onData(snapshotToCanvases(snapshot));
    },
    onError
  );
}
