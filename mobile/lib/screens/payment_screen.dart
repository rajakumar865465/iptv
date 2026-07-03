import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../constants.dart';
import '../cubits/app_config_cubit.dart';
import '../models/license_model.dart';
import '../services/api_service.dart';

class PaymentScreen extends StatefulWidget {
  const PaymentScreen({super.key});

  @override
  State<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen> {
  final ApiService _api = ApiService();
  List<PlanModel> _plans = [];
  bool _isLoading = true;
  bool _hasRazorpay = false;

  @override
  void initState() {
    super.initState();
    _loadPlans();
  }

  Future<void> _loadPlans() async {
    try {
      final res = await _api.get(ApiEndpoints.plans);
      if (res['success'] == true) {
        final data = res['data'];
        if (data is List) {
          _plans = data.map((p) => PlanModel.fromJson(p)).toList();
        }
      }
      final config = context.read<AppConfigCubit>();
      _hasRazorpay = config.isPaymentEnabled;
    } catch (e) {
      debugPrint('PaymentScreen: unable to load plans: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _buyPlan(PlanModel plan) async {
    if (!_hasRazorpay) {
      _showSupportSheet();
      return;
    }
    try {
      final res = await _api.post(ApiEndpoints.manualRequest, {
        'plan_id': plan.id,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(res['message'] ?? 'Purchase request created')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Purchase failed: $e')),
        );
      }
    }
  }

  void _showSupportSheet() {
    final config = context.read<AppConfigCubit>();
    final whatsapp = config.supportWhatsapp.isNotEmpty ? config.supportWhatsapp : null;
    final email = config.supportEmail.isNotEmpty ? config.supportEmail : null;
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(AppColors.surface),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Contact Support', style: Theme.of(ctx).textTheme.headlineSmall),
              const SizedBox(height: 16),
              if (whatsapp != null)
                ListTile(
                  leading: const Icon(Icons.chat, color: Color(AppColors.primary)),
                  title: Text('WhatsApp: $whatsapp', style: const TextStyle(color: Colors.white)),
                ),
              if (email != null)
                ListTile(
                  leading: const Icon(Icons.email, color: Color(AppColors.primary)),
                  title: Text('Email: $email', style: const TextStyle(color: Colors.white)),
                ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Close'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(AppColors.background),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
        title: const Text('Plans & Payment', style: TextStyle(color: Colors.white)),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(AppColors.primary)))
          : _plans.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Text('No plans available', style: TextStyle(color: Colors.white70)),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _showSupportSheet,
                        child: const Text('Contact Support'),
                      ),
                    ],
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _plans.length,
                  itemBuilder: (context, index) {
                    final plan = _plans[index];
                    return Card(
                      color: const Color(AppColors.surface),
                      margin: const EdgeInsets.only(bottom: 12),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    plan.name,
                                    style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                                  ),
                                ),
                                if (plan.isPopular)
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: const Color(AppColors.primary),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: const Text('Popular', style: TextStyle(color: Colors.white, fontSize: 12)),
                                  ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              '₹${plan.price} / ${plan.durationDays} days',
                              style: const TextStyle(color: Colors.white70, fontSize: 14),
                            ),
                            if (plan.description.isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(top: 8),
                                child: Text(plan.description, style: const TextStyle(color: Colors.white54, fontSize: 12)),
                              ),
                            const SizedBox(height: 16),
                            SizedBox(
                              width: double.infinity,
                              child: ElevatedButton(
                                onPressed: () => _buyPlan(plan),
                                child: const Text('Subscribe'),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
