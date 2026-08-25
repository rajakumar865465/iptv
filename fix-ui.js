const fs = require('fs');

function addGoogleButton(file) {
  let content = fs.readFileSync(file, 'utf8');
  
  const googleBtn = `
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      icon: Image.asset('assets/images/google_logo.png', width: 24, height: 24, errorBuilder: (c, e, s) => const Icon(Icons.g_mobiledata, size: 24)),
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
    if (file.includes('login')) {
      content = content.replace(/child: state is AuthLoading[\s\S]*?Text\('Sign In'\),\n\s*\),\n\s*\),/, "$&" + googleBtn);
    } else {
      content = content.replace(/child: state is AuthLoading[\s\S]*?Text\('Sign Up'\),\n\s*\),\n\s*\),/, "$&" + googleBtn);
    }
    fs.writeFileSync(file, content);
  }
}

addGoogleButton('mobile/lib/screens/login_screen.dart');
addGoogleButton('mobile/lib/screens/signup_screen.dart');
