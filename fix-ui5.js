const fs = require('fs');
let file = 'mobile/lib/screens/login_screen.dart';
let content = fs.readFileSync(file, 'utf8');

const googleBtn = `                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      icon: const Icon(Icons.g_mobiledata, size: 28),
                      label: const Text('Sign in with Google'),
                      onPressed: state is AuthLoading ? null : () => context.read<AuthCubit>().loginWithGoogle(),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        side: const BorderSide(color: Colors.grey),
                        foregroundColor: Colors.white,
                      ),
                    ),
                  ),
`;

if (!content.includes('loginWithGoogle')) {
  content = content.replace("                    const SizedBox(height: 16),\n                    Center(\n                      child: TextButton(\n                        onPressed: () {\n                          Navigator.of(context).push(\n                            MaterialPageRoute(builder: (_) => const ForgotPasswordScreen()),", googleBtn + "$&");
  fs.writeFileSync(file, content);
}

file = 'mobile/lib/screens/signup_screen.dart';
content = fs.readFileSync(file, 'utf8');
if (!content.includes('loginWithGoogle')) {
  content = content.replace("                    const SizedBox(height: 16),\n                    Center(\n                      child: TextButton(\n                        onPressed: () {\n                          Navigator.of(context).pop();", googleBtn + "$&");
  fs.writeFileSync(file, content);
}
