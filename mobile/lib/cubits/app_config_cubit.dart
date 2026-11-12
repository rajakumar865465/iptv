import 'package:flutter_bloc/flutter_bloc.dart';
import '../services/api_service.dart';
import '../constants.dart';
import '../utils/force_update_helper.dart';

abstract class AppConfigState {}

class AppConfigInitial extends AppConfigState {}
class AppConfigLoading extends AppConfigState {}
class AppConfigLoaded extends AppConfigState {
  final Map<String, dynamic> config;
  AppConfigLoaded(this.config);
}
class AppConfigForceUpdateRequired extends AppConfigState {
  final ForceUpdateInfo? info;
  AppConfigForceUpdateRequired([this.info]);
}
class AppConfigError extends AppConfigState {
  final String message;
  AppConfigError(this.message);
}

class AppConfigCubit extends Cubit<AppConfigState> {
  AppConfigCubit() : super(AppConfigInitial());

  final ApiService _api = ApiService();
  Map<String, dynamic> _config = {};

  Future<void> fetchConfig() async {
    emit(AppConfigLoading());
    try {
      final response = await _api.get(
        ApiEndpoints.config,
        queryParameters: {'version': AppConstants.appVersion},
      );
      if (response['success'] == true) {
        _config = response['data'] ?? {};
        if (isClosed) return;
        emit(AppConfigLoaded(_config));
      } else {
        if (isClosed) return;
        emit(AppConfigError('Failed to fetch config'));
      }
    } catch (e) {
      if (isClosed) return;
      if (ForceUpdateHelper.isForceUpdateException(e)) {
        emit(AppConfigForceUpdateRequired(ForceUpdateHelper.extractInfo(e)));
        return;
      }
      emit(AppConfigError(e.toString()));
    }
  }

  Map<String, dynamic> get rawConfig => _config;
  bool get isMaintenanceMode => _config['maintenance_mode'] == 'true';
  bool get isForceUpdate => _config['force_update'] == 'true';
  bool get isSignupEnabled => _config['signup_enabled'] != 'false';
  bool get isPaymentEnabled => _config['payment_enabled'] != 'false';
  bool get isTrialEnabled => _config['trial_enabled'] != 'false';
  String get supportWhatsapp => _config['support_whatsapp'] ?? '';
  String get supportEmail => _config['support_email'] ?? '';
  String get supportTelegram => _config['support_telegram'] ?? '';
  String get privacyPolicyUrl => _config['privacy_policy_url'] ?? '';
  String get termsUrl => _config['terms_url'] ?? '';
  String get minAppVersion => _config['minimum_app_version'] ?? '1.0.0';
  String get latestAppVersion => _config['latest_app_version']?.toString() ?? minAppVersion;
  String get apkDownloadUrl => _config['apk_download_url']?.toString() ?? '';
  ForceUpdateInfo get forceUpdateInfo => ForceUpdateInfo.fromConfig(_config);
}
