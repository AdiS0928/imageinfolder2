const admin = require('firebase-admin');
const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
require('dotenv').config();

// Initialize Firebase Admin SDK
const serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

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
    const fileContent = fs.readFileSync(filePath);
    const base64Content = fileContent.toString('base64');
    const mimeType = mime.lookup(filePath) || 'application/octet-stream';
    const base64String = `data:${mimeType};base64,${base64Content}`;
    const fileName = path.basename(filePath);

    // Save to Firestore
    await db.collection('files').doc('image').set({
      name: fileName,
      content: base64String,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`File ${fileName} has been uploaded to Firestore.`);

    // Optionally, delete the file after processing
    // fs.unlinkSync(filePath);
  } catch (error) {
    console.error('Error processing file:', error);
  }
};

// Watch for new files
watcher.on('add', handleNewFile);

console.log(`Watching for new files in ${folderToWatch}`);
