# EC2 Backend Deployment Rule

When tasked to update the backend or deploy the backend database to the EC2 instance, always follow this workflow:

1. **Update GitHub First**: Commit and push all local changes to the GitHub repository.
2. **Invoke Browser Subagent**: Use the `invoke_subagent` tool to spawn the `browser` agent. Do not use local SSH tools or scripts.
3. **Navigate to EC2 Console**: Instruct the `browser` subagent to go to the AWS EC2 Instance Connect URL for the Ubuntu instance.
4. **Run Deployment Commands**: Ask the `browser` subagent to execute the required update commands in the hosted instance terminal to complete the backend deployment.
5. **Provide Manual Fallback Commands**: Every time you provide an update or fix for the backend, you must also provide the manual terminal commands (e.g., `cd ~/iptv`, `git pull`, `pm2 restart iptv-backend`) in your response so the user can deploy it themselves if the subagent gets stuck.
