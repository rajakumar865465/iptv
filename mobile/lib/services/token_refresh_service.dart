import 'package:shared_preferences/shared_preferences.dart';
import '../constants.dart';
import 'auth_service.dart';

/// Single, concurrency-safe point for exchanging a stored refresh token for a
/// fresh access token. Used by the splash screen (proactively) and by the Dio
/// 401 interceptor (reactively), so a session survives past the 15-minute
/// access-token expiry without forcing the user to re-login.
///
/// A Completer guards against a token-refresh stampede: if multiple requests
/// 401 at the same time, only one network refresh runs and the rest await it.
class TokenRefreshService {
  TokenRefreshService._internal();
  static final TokenRefreshService instance = TokenRefreshService._internal();

  final AuthService _auth = AuthService();

  // Tracks an in-flight refresh so concurrent callers share one network call.
  static Future<bool>? _pending;

  /// Attempts to refresh the access token using the stored refresh token.
  /// Returns true on success (new tokens persisted, _auth in-memory updated),
  /// false if there is no refresh token or the server rejected the rotation.
  Future<bool> refresh() async {
    // Collapse concurrent refresh attempts into a single network call.
    final pending = _pending;
    if (pending != null) return pending;
    final completer = _doRefresh();
    _pending = completer;
    try {
      return await completer;
    } finally {
      _pending = null;
    }
  }

  Future<bool> _doRefresh() async {
    final prefs = await SharedPreferences.getInstance();
    final refreshToken = prefs.getString(StorageKeys.refreshToken);
    if (refreshToken == null || refreshToken.isEmpty) return false;

    final result = await _auth.refreshToken(refreshToken);
    if (result == null || result.token.isEmpty) return false;

    await prefs.setString(StorageKeys.token, result.token);
    if (result.refreshToken != null && result.refreshToken!.isNotEmpty) {
      await prefs.setString(StorageKeys.refreshToken, result.refreshToken!);
    }
    _auth.setToken(result.token);
    return true;
  }
}
