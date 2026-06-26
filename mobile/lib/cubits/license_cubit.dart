import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:dio/dio.dart';
import '../services/api_service.dart';
import '../models/license_model.dart';

abstract class LicenseState {}

class LicenseInitial extends LicenseState {}
class LicenseLoading extends LicenseState {}
class LicenseActive extends LicenseState {
  final LicenseModel license;
  LicenseActive(this.license);
}
class LicenseExpired extends LicenseState {
  final LicenseModel? license;
  LicenseExpired(this.license);
}
class LicenseNone extends LicenseState {}
class LicenseError extends LicenseState {
  final String message;
  LicenseError(this.message);
}

class LicenseDeviceLimitReached extends LicenseState {
  final String licenseKey;
  final String message;
  LicenseDeviceLimitReached(this.licenseKey, this.message);
}

class LicenseCubit extends Cubit<LicenseState> {
  LicenseCubit() : super(LicenseInitial());

  final ApiService _api = ApiService();

  Future<void> checkStatus() async {
    emit(LicenseLoading());
    try {
      final response = await _api.get('/api/license/status');
      if (response['success'] == true && response['data'] != null) {
        final data = response['data'];
        if (data['status'] == 'none') {
          emit(LicenseNone());
        } else {
          final license = LicenseModel.fromJson(data);
          if (license.isActive) {
            emit(LicenseActive(license));
          } else {
            emit(LicenseExpired(license));
          }
        }
      } else {
        emit(LicenseNone());
      }
    } catch (e) {
      emit(LicenseError(e.toString()));
    }
  }

  Future<void> activate(String licenseKey, {bool forceLogoutOldest = false}) async {
    emit(LicenseLoading());
    try {
      final response = await _api.post('/api/license/activate', {
        'license_key': licenseKey,
        'forceLogoutOldest': forceLogoutOldest,
      });
      if (response['success'] == true) {
        await checkStatus();
      } else {
        emit(LicenseError(response['message'] ?? 'Activation failed'));
      }
    } catch (e) {
      if (e is DioException && e.response?.data is Map) {
        final data = e.response!.data as Map;
        if (data['error'] == 'DEVICE_LIMIT_REACHED') {
          emit(LicenseDeviceLimitReached(licenseKey, data['message'] ?? 'Device limit reached'));
          return;
        }
      }
      emit(LicenseError(e.toString()));
    }
  }
}
