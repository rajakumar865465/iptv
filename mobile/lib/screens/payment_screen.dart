import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../constants.dart';
import '../utils/backend_config.dart';

/// Professional Plans & Pricing Screen.
/// Loads the official NIVA TV website pricing page (https://nivatv.luxomall.in/pricing)
/// directly in-app on mobile devices via WebView, and launches the browser tab on Web.
class PaymentScreen extends StatefulWidget {
  const PaymentScreen({super.key});

  @override
  State<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen> {
  WebViewController? _webViewController;
  bool _isLoading = true;
  int _loadingProgress = 0;
  bool _hasError = false;

  String get _pricingUrl => '${BackendConfig.baseUrl}/pricing';

  @override
  void initState() {
    super.initState();
    _initScreen();
  }

  void _initScreen() {
    if (kIsWeb) {
      // On web browser runner, open website pricing in external tab
      _launchExternalPricing();
      setState(() => _isLoading = false);
    } else if (Platform.isAndroid || Platform.isIOS) {
      // On native mobile, embed website plans directly in-app via WebView
      _initWebView();
    } else {
      _launchExternalPricing();
      setState(() => _isLoading = false);
    }
  }

  void _initWebView() {
    try {
      _webViewController = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setBackgroundColor(const Color(AppColors.background))
        ..setNavigationDelegate(
          NavigationDelegate(
            onProgress: (progress) {
              if (mounted) setState(() => _loadingProgress = progress);
            },
            onPageStarted: (url) {
              if (mounted) {
                setState(() {
                  _isLoading = true;
                  _hasError = false;
                });
              }
            },
            onPageFinished: (url) {
              if (mounted) {
                setState(() {
                  _isLoading = false;
                  _loadingProgress = 100;
                });
              }
            },
            onWebResourceError: (error) {
              debugPrint('PaymentScreen WebView error: ${error.description}');
              if (mounted && error.isForMainFrame == true) {
                setState(() {
                  _isLoading = false;
                  _hasError = true;
                });
              }
            },
          ),
        )
        ..loadRequest(Uri.parse(_pricingUrl));
    } catch (e) {
      debugPrint('Failed to initialize WebView on platform: $e');
      setState(() {
        _isLoading = false;
        _hasError = true;
      });
    }
  }

  Future<void> _launchExternalPricing() async {
    try {
      final uri = Uri.parse(_pricingUrl);
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (e) {
      debugPrint('Failed to launch external browser for pricing: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Could not open $_pricingUrl'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  Future<void> _reloadPage() async {
    if (_webViewController != null) {
      setState(() {
        _isLoading = true;
        _hasError = false;
      });
      _webViewController!.reload();
    } else {
      _initScreen();
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final text1 = AppColors.text1(context);
    final text2 = AppColors.text2(context);
    final bgColor = AppColors.bg(context);

    return Scaffold(
      backgroundColor: bgColor,
      appBar: AppBar(
        backgroundColor: isDark
            ? const Color(AppColors.surfaceElevated)
            : const Color(0xFFFFFFFF),
        elevation: 0.5,
        leading: IconButton(
          icon: Icon(
            Icons.arrow_back_ios_new_rounded,
            size: 18,
            color: text1,
          ),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          'Plans & Pricing',
          style: TextStyle(
            color: text1,
            fontSize: 18,
            fontWeight: FontWeight.w800,
          ),
        ),
        centerTitle: true,
        actions: [
          IconButton(
            icon: Icon(Icons.refresh_rounded, size: 20, color: text1),
            tooltip: 'Refresh Plans',
            onPressed: _reloadPage,
          ),
          IconButton(
            icon: Icon(Icons.open_in_browser_rounded, size: 20, color: text1),
            tooltip: 'Open in Browser',
            onPressed: _launchExternalPricing,
          ),
          const SizedBox(width: 4),
        ],
        bottom: _isLoading && _loadingProgress < 100
            ? PreferredSize(
                preferredSize: const Size.fromHeight(2.5),
                child: LinearProgressIndicator(
                  value: _loadingProgress > 0 ? _loadingProgress / 100 : null,
                  backgroundColor: Colors.transparent,
                  color: const Color(AppColors.primary),
                  minHeight: 2.5,
                ),
              )
            : null,
      ),
      body: SafeArea(
        child: _buildBody(context, isDark, text1, text2, bgColor),
      ),
    );
  }

  Widget _buildBody(
    BuildContext context,
    bool isDark,
    Color text1,
    Color text2,
    Color bgColor,
  ) {
    // 1. Error state
    if (_hasError) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(AppColors.brandRed).withOpacity(0.12),
                ),
                child: const Icon(
                  Icons.wifi_off_rounded,
                  size: 32,
                  color: Color(AppColors.brandRed),
                ),
              ),
              const SizedBox(height: 18),
              Text(
                'Unable to load plans right now',
                style: TextStyle(
                  color: text1,
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                'Please check your internet connection or open plans in your mobile web browser.',
                style: TextStyle(
                  color: text2,
                  fontSize: 13,
                  height: 1.45,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  OutlinedButton.icon(
                    onPressed: _reloadPage,
                    icon: const Icon(Icons.refresh_rounded, size: 16),
                    label: const Text('Try Again'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: text1,
                      side: BorderSide(color: AppColors.div(context)),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  ElevatedButton.icon(
                    onPressed: _launchExternalPricing,
                    icon: const Icon(Icons.open_in_browser_rounded, size: 16),
                    label: const Text('Open in Browser'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(AppColors.primary),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      );
    }

    // 2. Web Runner Platform View (kIsWeb)
    if (kIsWeb || _webViewController == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 76,
                height: 76,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF4F46E5), Color(0xFF6366F1)],
                  ),
                  borderRadius: BorderRadius.circular(22),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(AppColors.primary).withOpacity(0.35),
                      blurRadius: 20,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.diamond_rounded,
                  size: 38,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 22),
              Text(
                'Official NIVA TV Plans',
                style: TextStyle(
                  color: text1,
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.4,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 10),
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 320),
                child: Text(
                  'Explore our official plans, instant UPI activation, and free trial on our secure portal.',
                  style: TextStyle(
                    color: text2,
                    fontSize: 13.5,
                    height: 1.5,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
              const SizedBox(height: 28),
              Container(
                constraints: const BoxConstraints(maxWidth: 280),
                height: 50,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF4F46E5), Color(0xFF6366F1)],
                  ),
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF4F46E5).withOpacity(0.35),
                      blurRadius: 16,
                      offset: const Offset(0, 5),
                    ),
                  ],
                ),
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: _launchExternalPricing,
                    borderRadius: BorderRadius.circular(16),
                    child: const Center(
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.launch_rounded, color: Colors.white, size: 18),
                          SizedBox(width: 8),
                          Text(
                            'Open Pricing Portal',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: Text(
                  'Back to NIVA TV',
                  style: TextStyle(
                    color: AppColors.textM(context),
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    // 3. Embedded In-App WebView on Mobile
    return Stack(
      children: [
        WebViewWidget(controller: _webViewController!),
        if (_isLoading)
          Container(
            color: bgColor,
            child: const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircularProgressIndicator(
                    color: Color(AppColors.primary),
                    strokeWidth: 2.8,
                  ),
                  SizedBox(height: 16),
                  Text(
                    'Loading official plans...',
                    style: TextStyle(
                      color: Color(AppColors.textSecondary),
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
