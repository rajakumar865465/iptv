const fs = require('fs');

// 1. Fix auth_cubit.dart
let file = 'mobile/lib/cubits/auth_cubit.dart';
let content = fs.readFileSync(file, 'utf8');

const googleLoginFn = `
  Future<void> loginWithGoogle({String? deviceId, String? deviceName, bool forceLogoutOldest = false}) async {
    emit(AuthLoading());
    try {
      final GoogleSignIn googleSignIn = GoogleSignIn(scopes: ['email']);
      final GoogleSignInAccount? googleUser = await googleSignIn.signIn();
      if (googleUser == null) {
        emit(AuthInitial()); // User cancelled
        return;
      }
      
      final GoogleSignInAuthentication googleAuth = await googleUser.authentication;
      final String? idToken = googleAuth.idToken;
      
      if (idToken == null) {
        throw Exception('Failed to get Google ID token');
      }

      final actualDeviceId = deviceId ?? await _storage.getDeviceId();
      final result = await _authService.googleLogin(
        idToken: idToken,
        deviceId: actualDeviceId,
        deviceName: deviceName,
        forceLogoutOldest: forceLogoutOldest,
      );
      
      if (result != null) {
        await _storage.saveToken(result.token);
        if (result.refreshToken != null && result.refreshToken!.isNotEmpty) {
          await _storage.saveRefreshToken(result.refreshToken!);
        }
        await _storage.saveUser(result);
        emit(AuthAuthenticated(result));
      }
    } catch (e) {
      if (e.toString().contains('DEVICE_LIMIT_REACHED')) {
        emit(AuthDeviceLimitReached('', '', e.toString()));
      } else {
        emit(AuthError(e.toString().replaceAll('Exception: ', '')));
      }
    }
  }
`;

if (!content.includes('loginWithGoogle')) {
  content = content.replace("Future<void> signup", googleLoginFn + "\n\n  Future<void> signup");
  fs.writeFileSync(file, content);
}

// 2. Fix signup_screen.dart
file = 'mobile/lib/screens/signup_screen.dart';
content = fs.readFileSync(file, 'utf8');

// Replace state is AuthLoading with context.watch<AuthCubit>().state is AuthLoading
content = content.replace("state is AuthLoading ? null : () => context.read<AuthCubit>().loginWithGoogle()", "context.watch<AuthCubit>().state is AuthLoading ? null : () => context.read<AuthCubit>().loginWithGoogle()");

// Make sure it's signup() not register()
content = content.replace(/context\.read<AuthCubit>\(\)\.register\((.*?)\);/g, "context.read<AuthCubit>().signup($1);");
content = content.replace(/context\.read<AuthCubit>\(\)\.signup\(name, email, '', password\);/g, "context.read<AuthCubit>().signup(name, email, '', password);"); // Ensure it's correct

fs.writeFileSync(file, content);

// 3. Ensure loginWithGoogle signature has optional AuthUserResult in auth_cubit.dart
// Wait, AuthAuthenticated takes a parameter? Let's check auth_cubit.dart
