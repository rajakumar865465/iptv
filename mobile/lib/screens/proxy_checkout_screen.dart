import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'dart:convert';
import '../constants.dart';

class ProxyCheckoutScreen extends StatefulWidget {
  final String orderId;
  final String token;

  const ProxyCheckoutScreen({
    super.key,
    required this.orderId,
    required this.token,
  });

  @override
  State<ProxyCheckoutScreen> createState() => _ProxyCheckoutScreenState();
}

class _ProxyCheckoutScreenState extends State<ProxyCheckoutScreen> {
  late final WebViewController _controller;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    
    // We point this directly to the approved domain, but served by our backend
    final url = 'https://luxomall.pdf-cropper.site/api/proxy/checkout?order_id=${widget.orderId}&token=${widget.token}';

    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(AppColors.background))
      ..addJavaScriptChannel(
        'PaymentBridge',
        onMessageReceived: (JavaScriptMessage message) {
          try {
            final data = jsonDecode(message.message);
            if (data['status'] == 'success') {
              if (mounted) {
                Navigator.of(context).pop(true);
              }
            } else if (data['status'] == 'cancelled') {
              if (mounted) {
                Navigator.of(context).pop(false);
              }
            }
          } catch (e) {
            debugPrint('PaymentBridge error: $e');
          }
        },
      )
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (String url) {
            if (mounted) setState(() => _isLoading = false);
          },
        ),
      )
      ..loadRequest(Uri.parse(url));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(AppColors.background),
      appBar: AppBar(
        backgroundColor: const Color(AppColors.surface),
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
        title: const Text('Secure Checkout', style: TextStyle(color: Colors.white, fontSize: 16)),
      ),
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (_isLoading)
            const Center(
              child: CircularProgressIndicator(color: Color(AppColors.primary)),
            ),
        ],
      ),
    );
  }
}
