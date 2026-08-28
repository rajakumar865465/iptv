# EC2 Backend Deployment Rule

When tasked to update the backend or deploy the backend database to the EC2 instance, always follow this workflow:

1. **Update GitHub First**: Commit and push all local changes to the GitHub repository.
2. **Invoke Browser Subagent**: Use the `invoke_subagent` tool to spawn the `browser` agent. Do not use local SSH tools or scripts.
3. **Navigate to EC2 Console**: Instruct the `browser` subagent to go to the AWS EC2 Instance Connect URL for the Ubuntu instance.
4. **Run Deployment Commands**: Ask the `browser` subagent to execute the required update commands in the hosted instance terminal to complete the backend deployment.
5. **Provide Manual Fallback Commands**: Every time you provide an update or fix for the backend, you must also provide the manual terminal commands (e.g., `cd ~/iptv`, `git pull`, `pm2 restart iptv-backend`) in your response so the user can deploy it themselves if the subagent gets stuck.



# Server Architecture Context
- The PostgreSQL database is hosted directly on the same EC2 instance (accessible locally via port 5432) and should not be accessed remotely.
- The Backend runs on the same EC2 instance. (Note: `.env` typically configures it for port 5000, while the frontend might use port 3000).

# Project Context Rule
- ALWAYS read `progress.md` at the start of your tasks to check the previous work and understand the current state of the app and recent bug fixes.

# Mobile App Build Rule
- When building the release app (APK or AAB), ALWAYS use the production backend URL (`https://nivatv.luxomall.in`).
- Do NOT use the local testing or example IP addresses found in the `main.dart` fallback error screen text.
- To build the production App Bundle (AAB) for Google Play: 
  `flutter build appbundle --release --obfuscate --split-debug-info=build/app/outputs/symbols --dart-define=BACKEND_URL=https://nivatv.luxomall.in`
- To build the production Split APKs (32-bit and 64-bit) for direct distribution:
  `flutter build apk --release --split-per-abi --obfuscate --split-debug-info=build/app/outputs/symbols --dart-define=BACKEND_URL=https://nivatv.luxomall.in`
