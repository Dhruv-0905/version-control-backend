const express = require('express');
const multer = require('multer');
const { Pool } = require('pg');
const unzipper = require('unzipper'); 
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const { exec } = require('child_process');

const app = express();
const port = 3000;

// PostgreSQL pool
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'file_tracking',
  password: 'yourpassword',
  port: 5432,
});

// Multer setup for file uploading
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// File upload route (for both files and zip folders)
app.post('/upload', upload.single('file'), async (req, res) => {
  const originalName = req.file.originalname;
  const fileBuffer = req.file.buffer;

  if (path.extname(originalName) === '.zip') {
    // Handle zip file uploads (folders)
    const zipPath = path.join('uploads', originalName);
    fs.writeFileSync(zipPath, fileBuffer);
``
    fs.createReadStream(zipPath)
      .pipe(unzipper.Extract({ path: 'uploads/' }))
      .on('close', async () => {
        console.log(`Folder ${originalName} uploaded and extracted.`);
        await saveMetadata(zipPath, 'folder', 1);
        res.send('Folder uploaded and metadata stored.');
      });
  } else {
    // Handle regular file uploads
    const filePath = path.join('uploads', originalName);
    fs.writeFileSync(filePath, fileBuffer);

    // Save file metadata in PostgreSQL
    await saveMetadata(filePath, 'file', 1);

    // Trigger PGM update
    updatePgm(filePath, 1);

    res.send('File uploaded and metadata stored.');
  }
});

// Save metadata to the database (files/folders)
async function saveMetadata(filePath, type, version) {
  await pool.query(
    'INSERT INTO file_versions (file_path, version, last_modified, content) VALUES ($1, $2, NOW(), $3)',
    [filePath, version, type]
  );
  console.log(`${type} metadata saved for ${filePath}`);
}

// Function to call Python script to update PGM
function updatePgm(filePath, version) {
  exec(`python update_pgm.py ${filePath} ${version}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing Python script: ${error.message}`);
      return;
    }
    console.log(`Python output: ${stdout}`);
    if (stderr) {
      console.error(`Python stderr: ${stderr}`);
    }
  });
}

// Monitor the 'uploads' directory for file and folder changes
const watcher = chokidar.watch('uploads/', {
  ignored: /(^|[\/\\])\../, // Ignore dotfiles
  persistent: true
});

watcher
  .on('add', path => {
    console.log(`File ${path} has been added`);
    updatePgm(path, 2); // Trigger PGM update when a file is added
  })
  .on('change', path => {
    console.log(`File ${path} has been changed`);
    updatePgm(path, 2); // Trigger PGM update when a file is modified
  })
  .on('unlink', path => {
    console.log(`File ${path} has been removed`);
    updatePgm(path, 3); // Trigger PGM update when a file is removed
  })
  .on('addDir', path => {
    console.log(`Directory ${path} has been added`);
    updatePgm(path, 1); // Trigger PGM update when a folder is added
  })
  .on('unlinkDir', path => {
    console.log(`Directory ${path} has been removed`);
    updatePgm(path, 3); // Trigger PGM update when a folder is removed
  })
  .on('error', error => console.log(`Error: ${error}`));

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
