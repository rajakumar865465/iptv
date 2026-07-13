const { execSync } = require('child_process');

try {
    console.log("Uploading migration 027...");
    const scpCmd = `scp -i C:\\Users\\deba_pc.com\\.ssh\\iptv_rsa -o StrictHostKeyChecking=no backend/migrations/027_channel_management_system.sql ubuntu@35.174.78.33:~/027_channel_management_system.sql`;
    const scpOutput = execSync(scpCmd, { encoding: 'utf-8', stdio: 'pipe' });
    console.log("Upload complete.");

    console.log("Executing migration 027 against iptv_db2...");
    const psqlCmd = `ssh -i C:\\Users\\deba_pc.com\\.ssh\\iptv_rsa -o StrictHostKeyChecking=no ubuntu@35.174.78.33 "sudo -u postgres psql -d iptv_db2 -f ~/027_channel_management_system.sql"`;
    const psqlOutput = execSync(psqlCmd, { encoding: 'utf-8', stdio: 'pipe' });
    console.log(psqlOutput);
    console.log("Migration complete.");
} catch (err) {
    console.error("Error executing SSH commands:");
    console.error(err.message);
    if (err.stdout) console.error("STDOUT:", err.stdout);
    if (err.stderr) console.error("STDERR:", err.stderr);
}
