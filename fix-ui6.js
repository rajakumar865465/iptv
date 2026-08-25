const fs = require('fs');

function addGoogleBtn(file) {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('loginWithGoogle')) return;

  const search = 'const SizedBox(height: 16),\n                  Center(';
  const idx = content.lastIndexOf('const SizedBox(height: 16)');
  
  if (idx !== -1) {
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
                  ),\n`;
    content = content.slice(0, idx) + googleBtn + content.slice(idx);
    fs.writeFileSync(file, content);
  }
}

addGoogleBtn('mobile/lib/screens/login_screen.dart');
addGoogleBtn('mobile/lib/screens/signup_screen.dart');
