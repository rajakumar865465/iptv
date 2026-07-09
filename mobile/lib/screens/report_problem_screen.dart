import 'dart:io';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../constants.dart';
import '../services/api_service.dart';

class ReportProblemScreen extends StatefulWidget {
  const ReportProblemScreen({super.key});

  @override
  State<ReportProblemScreen> createState() => _ReportProblemScreenState();
}

class _ReportProblemScreenState extends State<ReportProblemScreen> {
  static const _categories = [
    'App Crash',
    'Playback Issue',
    'Login Issue',
    'Payment Issue',
    'Other',
  ];

  String? _category;
  final _descController = TextEditingController();
  bool _loading = false;
  String? _error;
  bool _submitted = false;

  @override
  void dispose() {
    _descController.dispose();
    super.dispose();
  }

  Future<Map<String, dynamic>> _buildDeviceInfo() async {
    try {
      final plugin = DeviceInfoPlugin();
      if (!kIsWeb && Platform.isAndroid) {
        final info = await plugin.androidInfo;
        return {
          'platform': 'android',
          'os_version': 'Android ${info.version.release}',
          'device_model': '${info.manufacturer} ${info.model}',
          'sdk': info.version.sdkInt,
        };
      } else if (!kIsWeb && Platform.isIOS) {
        final info = await plugin.iosInfo;
        return {
          'platform': 'ios',
          'os_version': '${info.systemName} ${info.systemVersion}',
          'device_model': info.model,
        };
      }
    } catch (_) {}
    return {'platform': 'unknown'};
  }

  Future<void> _submit() async {
    if (_category == null) {
      setState(() => _error = 'Please select a problem category');
      return;
    }
    if (_descController.text.trim().length < 10) {
      setState(() => _error = 'Description must be at least 10 characters');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final deviceInfo = await _buildDeviceInfo();
      final api = ApiService();
      final response = await api.post(ApiEndpoints.userFeedback, {
        'category': _category,
        'description': _descController.text.trim(),
        'device_info': deviceInfo,
        'app_version': AppConstants.appVersion,
        'platform': kIsWeb
            ? 'web'
            : Platform.isAndroid
                ? 'android'
                : 'ios',
      });
      if (response['success'] == true) {
        if (mounted) setState(() => _submitted = true);
      } else {
        setState(() => _error = response['message']?.toString() ?? 'Failed to submit');
      }
    } on DioException catch (e) {
      setState(() =>
          _error = (e.response?.data as Map?)?['message']?.toString() ?? 'Network error. Please try again.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(AppColors.background),
      appBar: AppBar(
        backgroundColor: const Color(AppColors.background),
        foregroundColor: const Color(AppColors.textPrimary),
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        title: const Text(
          'Report Problem',
          style: TextStyle(
            color: Color(AppColors.textPrimary),
            fontSize: 18,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
      body: _submitted ? _buildSuccess() : _buildForm(),
    );
  }

  Widget _buildSuccess() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: const Color(AppColors.success).withOpacity(0.12),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.check_circle_rounded,
                color: Color(AppColors.success),
                size: 44,
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'Thank You!',
              style: TextStyle(
                color: Color(AppColors.textPrimary),
                fontSize: 22,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'Your report has been submitted. Our team will review it and get back to you if needed.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Color(AppColors.textSecondary),
                fontSize: 14,
                height: 1.6,
              ),
            ),
            const SizedBox(height: 32),
            SizedBox(
              width: 180,
              height: 48,
              child: ElevatedButton(
                onPressed: () => Navigator.of(context).pop(),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(AppColors.primary),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                  textStyle: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                child: const Text('Back to Profile'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildForm() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Tell us what went wrong and we\'ll look into it.',
            style: TextStyle(
              color: Color(AppColors.textSecondary),
              fontSize: 14,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 24),

          // Category label
          const Text(
            'PROBLEM TYPE',
            style: TextStyle(
              color: Color(AppColors.textMuted),
              fontSize: 11,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.0,
            ),
          ),
          const SizedBox(height: 10),

          // Category dropdown
          Container(
            decoration: BoxDecoration(
              color: const Color(AppColors.surface),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(AppColors.divider)),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _category,
                hint: const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                  child: Text(
                    'Select a category',
                    style: TextStyle(color: Color(AppColors.textMuted), fontSize: 15),
                  ),
                ),
                isExpanded: true,
                dropdownColor: const Color(AppColors.surfaceElevated),
                iconEnabledColor: const Color(AppColors.textMuted),
                padding: const EdgeInsets.symmetric(horizontal: 16),
                borderRadius: BorderRadius.circular(14),
                items: _categories
                    .map((c) => DropdownMenuItem(
                          value: c,
                          child: Text(
                            c,
                            style: const TextStyle(
                              color: Color(AppColors.textPrimary),
                              fontSize: 15,
                            ),
                          ),
                        ))
                    .toList(),
                onChanged: (v) => setState(() {
                  _category = v;
                  _error = null;
                }),
              ),
            ),
          ),

          const SizedBox(height: 20),
          const Text(
            'DESCRIPTION',
            style: TextStyle(
              color: Color(AppColors.textMuted),
              fontSize: 11,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.0,
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _descController,
            maxLines: 6,
            maxLength: 2000,
            style: const TextStyle(
              color: Color(AppColors.textPrimary),
              fontSize: 14,
              height: 1.5,
            ),
            decoration: InputDecoration(
              hintText: 'Describe the issue in detail — steps to reproduce, what you expected vs what happened...',
              hintStyle: const TextStyle(
                color: Color(AppColors.textMuted),
                fontSize: 14,
              ),
              counterStyle: const TextStyle(color: Color(AppColors.textMuted)),
              filled: true,
              fillColor: const Color(AppColors.surface),
              contentPadding: const EdgeInsets.all(16),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: Color(AppColors.divider)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: Color(AppColors.divider)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: Color(AppColors.primary), width: 1.5),
              ),
            ),
            onChanged: (_) {
              if (_error != null) setState(() => _error = null);
            },
          ),

          if (_error != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(AppColors.error).withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: const Color(AppColors.error).withOpacity(0.3),
                ),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline_rounded,
                      color: Color(AppColors.error), size: 16),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _error!,
                      style: const TextStyle(
                        color: Color(AppColors.error),
                        fontSize: 13,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: 28),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed: _loading ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(AppColors.primary),
                foregroundColor: Colors.white,
                disabledBackgroundColor: const Color(AppColors.primary).withOpacity(0.5),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                textStyle: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                ),
              ),
              child: _loading
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2.5,
                      ),
                    )
                  : const Text('Submit Report'),
            ),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}
