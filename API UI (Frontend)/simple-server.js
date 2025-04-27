const express = require('express');
const path = require('path');
const app = express();
const PORT = 3001;

// Serve static files from the build directory
app.use(express.static(path.join(__dirname, 'build')));

// Simplest possible SPA handler - no path-to-regexp dependency
app.use('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Frontend server running on port ${PORT}`);
});
