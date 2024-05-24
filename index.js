const admin = require('firebase-admin');
const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Initialize Firebase Admin SDK with storageBucket option
const serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'video-a9a2d.appspot.com' // Replace with your actual storage bucket name
});

const db = admin.firestore();
const storage = admin.storage().bucket(); // This line ensures storage is defined

console.log("Firebase Storage bucket name:", storage.name);

// Function to get today's date folder
const getTodayFolder = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are zero-based
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Folder to watch
const folderToWatch = `./${getTodayFolder()}`;

// Ensure the watched folder exists
if (!fs.existsSync(folderToWatch)) {
  fs.mkdirSync(folderToWatch, { recursive: true });
}

// Watch for new files in the folder
const watcher = chokidar.watch(folderToWatch, {
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 2000,
    pollInterval: 100
  }
});

// Function to handle new file addition
const handleNewFile = async (filePath) => {
  try {
    const fileName = path.basename(filePath);

    // Upload file to Firebase Storage
    const fileUploadResponse = await storage.upload(filePath, {
      destination: `files/${fileName}`
    });

    // Get download URL
    const file = fileUploadResponse[0];
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: '01-01-2100' // Set expiry as needed
    });

    // Save metadata to Firestore
    await db.collection('files').doc('image').set({
      name: fileName,
      content: url, // Save download URL instead of base64 content
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`File ${fileName} has been uploaded to Storage and Firestore.`);

    // Optionally, delete the file after processing
    // fs.unlinkSync(filePath);
  } catch (error) {
    console.error('Error processing file:', error);
  }
};

// Watch for new files
watcher.on('add', handleNewFile);

console.log(`Watching for new files in ${folderToWatch}`);
