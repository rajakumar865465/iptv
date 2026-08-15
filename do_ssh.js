/**
 * DEPRECATED / UNSAFE: Direct SSH execution scripts are deprecated.
 * Use AWS EC2 Instance Connect or the automated deployment workflow instead.
 * 
 * To run manual migrations or imports on EC2:
 * 1. Connect via EC2 Instance Connect
 * 2. cd ~/iptv/backend
 * 3. npm run migrate
 */
console.error("Direct SSH script execution is disabled for safety. Please use EC2 Instance Connect.");
process.exit(1);

