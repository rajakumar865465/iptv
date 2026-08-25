const fs = require('fs');

function addGoogleButton(file, btnText) {
  let content = fs.readFileSync(file, 'utf8');
  
  const googleBtn = `
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      icon: Icon(Icons.g_mobiledata, size: 28),
                      label: const Text('Sign in with Google'),
                      onPressed: state is AuthLoading ? null : () => context.read<AuthCubit>().loginWithGoogle(),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        side: const BorderSide(color: Colors.grey),
                        foregroundColor: Colors.white,
                      ),
                    ),
                  ),`;

  if (!content.includes('loginWithGoogle()')) {
    content = content.replace("const Text('" + btnText + "'),\n                    ),\n                  ),", "$&\n" + googleBtn);
    fs.writeFileSync(file, content);
  }
}

addGoogleButton('mobile/lib/screens/login_screen.dart', 'Sign In');
addGoogleButton('mobile/lib/screens/signup_screen.dart', 'Sign Up');
