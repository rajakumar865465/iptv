const fs = require('fs');
let file = 'mobile/lib/services/auth_service.dart';
let content = fs.readFileSync(file, 'utf8');

const fn = `
  Future<AuthUserResult?> googleLogin({
    required String idToken,
    required String deviceId,
    String? deviceName,
    bool forceLogoutOldest = false,
  }) async {
    try {
      final response = await _dio.post(ApiEndpoints.baseUrl + '/auth/google-login', data: {
        'credential': idToken,
        'device_id': deviceId,
        'device_name': deviceName ?? 'Unknown Device',
        'app_version': AppConstants.appVersion,
        'forceLogoutOldest': forceLogoutOldest,
      });
      final d = response.data['data'];
      return AuthUserResult(
        userId: d['user']['id'],
        email: d['user']['email'],
        name: d['user']['full_name'],
        token: d['token'],
        refreshToken: d['refreshToken'],
      );
    } catch (e) {
      if (e is DioException && e.response?.data != null) {
        throw Exception(e.response!.data['message'] ?? 'Google login failed');
      }
      rethrow;
    }
  }
`;

if (!content.includes('googleLogin')) {
  content = content.replace(/Future<AuthUserResult\?> login\(/, fn + "\n  Future<AuthUserResult?> login(");
  fs.writeFileSync(file, content);
}
