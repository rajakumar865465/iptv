const { execSync } = require('child_process');

try {
    console.log("Uploading insert_channels.sql...");
    const scpCmd = `scp -i C:\\Users\\deba_pc.com\\.ssh\\iptv_rsa -o StrictHostKeyChecking=no insert_channels.sql ubuntu@35.174.78.33:~/insert_channels.sql`;
    const scpOutput = execSync(scpCmd, { encoding: 'utf-8', stdio: 'pipe' });
    console.log("Upload complete.");

    console.log("Executing insert_channels.sql against iptv_db2...");
    const psqlCmd = `ssh -i C:\\Users\\deba_pc.com\\.ssh\\iptv_rsa -o StrictHostKeyChecking=no ubuntu@35.174.78.33 "sudo -u postgres psql -d iptv_db2 -f ~/insert_channels.sql"`;
    const psqlOutput = execSync(psqlCmd, { encoding: 'utf-8', stdio: 'pipe' });
    console.log("Insert complete.");

    console.log("Verifying channel count...");
    const countCmd = `ssh -i C:\\Users\\deba_pc.com\\.ssh\\iptv_rsa -o StrictHostKeyChecking=no ubuntu@35.174.78.33 "sudo -u postgres psql -d iptv_db2 -t -c 'SELECT COUNT(*) FROM channels;'"`;
    const countOutput = execSync(countCmd, { encoding: 'utf-8', stdio: 'pipe' });
    console.log("Final channel count: " + countOutput.trim());

} catch (err) {
    console.error("Error executing SSH commands:");
    console.error(err.message);
    if (err.stdout) console.error("STDOUT:", err.stdout);
    if (err.stderr) console.error("STDERR:", err.stderr);
}
