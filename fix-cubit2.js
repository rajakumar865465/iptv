const fs = require('fs');
let content = fs.readFileSync('mobile/lib/cubits/auth_cubit.dart', 'utf8');

const importGoogle = "import 'package:google_sign_in/google_sign_in.dart';\n";

if (!content.includes('google_sign_in.dart')) {
  content = content.replace(/import 'package:bloc\/bloc\.dart';/, "$&\n" + importGoogle);
}

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
  content = content.replace(/Future<void> register/, googleLoginFn + "\n\n  Future<void> register");
}

fs.writeFileSync('mobile/lib/cubits/auth_cubit.dart', content);
