const fs = require('fs');
let file = 'mobile/lib/screens/login_screen.dart';
let content = fs.readFileSync(file, 'utf8');

const googleBtn = `\n                  const SizedBox(height: 16),
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
                  ),\n`;

if (!content.includes('loginWithGoogle')) {
  let parts = content.split("const Text('Sign In'),\n                      ),\n                    ),");
  if (parts.length > 1) {
    fs.writeFileSync(file, parts[0] + "const Text('Sign In'),\n                      ),\n                    )," + googleBtn + parts[1]);
  }
}

file = 'mobile/lib/screens/signup_screen.dart';
content = fs.readFileSync(file, 'utf8');
if (!content.includes('loginWithGoogle')) {
  let parts = content.split("const Text('Sign Up'),\n                      ),\n                    ),");
  if (parts.length > 1) {
    fs.writeFileSync(file, parts[0] + "const Text('Sign Up'),\n                      ),\n                    )," + googleBtn + parts[1]);
  }
}
