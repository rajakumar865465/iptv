import subprocess

try:
    result = subprocess.run(
        ['ssh', '-i', r'C:\Users\deba_pc.com\.ssh\iptv_rsa', '-o', 'StrictHostKeyChecking=no', 'ubuntu@35.154.128.217', 'pm2 list'],
        capture_output=True,
        text=True,
        timeout=15
    )
    print("STDOUT:", result.stdout)
    print("STDERR:", result.stderr)
    print("RETURN CODE:", result.returncode)
except Exception as e:
    print("ERROR:", e)
