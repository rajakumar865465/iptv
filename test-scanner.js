const { checkDeep } = require('./backend/src/controllers/scannerController');

async function test() {
  console.log("Testing stream scanner deep check...");
  // Use a known public test stream
  const testUrl = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";
  
  // Create a mock checkDeep since we didn't export it in scannerController.js!
  // Wait, I didn't export `checkDeep` from scannerController.js. I only exported triggerScan, getScanStatus, getScanHistory.
  // I can't import checkDeep directly. 
}
test();
