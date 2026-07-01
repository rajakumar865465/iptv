const { execSync } = require('child_process');

try {
    console.log("Checking project directory on EC2...");
    const dirCmd = `ssh -i C:\\Users\\deba_pc.com\\.ssh\\iptv_rsa -o StrictHostKeyChecking=no ubuntu@35.154.128.217 "ls -la"`;
    const dirOutput = execSync(dirCmd, { encoding: 'utf-8', stdio: 'pipe' });
    console.log("Directory contents:\n", dirOutput);

    // Look for iptv or iptv-backend or NivaTV
    let projectDir = "iptv";
    if (dirOutput.includes("NivaTV")) projectDir = "NivaTV";
    if (dirOutput.includes("iptv-backend")) projectDir = "iptv-backend";

    console.log(`Using project directory: ${projectDir}`);

    console.log("Pulling latest code and restarting services...");
    const deployCmd = `ssh -i C:\\Users\\deba_pc.com\\.ssh\\iptv_rsa -o StrictHostKeyChecking=no ubuntu@35.154.128.217 "cd ~/${projectDir} && git pull origin main && cd backend && npm install && cd ../frontend && npm install && npm run build && pm2 restart all"`;
    const deployOutput = execSync(deployCmd, { encoding: 'utf-8', stdio: 'pipe' });
    console.log("Deploy output:\n", deployOutput);
    
    console.log("Deployment complete.");
} catch (err) {
    console.error("Error executing SSH commands:");
    console.error(err.message);
    if (err.stdout) console.error("STDOUT:", err.stdout);
    if (err.stderr) console.error("STDERR:", err.stderr);
}
