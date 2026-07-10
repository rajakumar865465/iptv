import 'package:flutter/material.dart';
import '../../constants.dart';
import '../../models/notification_model.dart';
import '../../services/api_service.dart';
import '../../services/storage_service.dart';

// ── category style ────────────────────────────────────────────────────────────

class _CatStyle {
  final IconData icon;
  final Color color;
  final Color glow;
  const _CatStyle(this.icon, this.color, this.glow);
}

_CatStyle _catStyle(String title) {
  final t = title.toLowerCase();
  if (_any(t, ['offer', 'free', 'deal', 'discount', 'promo', 'sale', 'coupon']))
    return _CatStyle(Icons.local_offer_rounded,
        const Color(0xFFF59E0B), const Color(0x33F59E0B));
  if (_any(t, ['new', 'update', 'launch', 'feature', 'release', 'version']))
    return _CatStyle(Icons.auto_awesome_rounded,
        const Color(0xFF22D3EE), const Color(0x3322D3EE));
  if (_any(t, ['alert', 'warning', 'down', 'outage', 'issue', 'error']))
    return _CatStyle(Icons.warning_amber_rounded,
        const Color(0xFFF97316), const Color(0x33F97316));
  if (_any(t, ['maintenance', 'scheduled', 'downtime']))
    return _CatStyle(Icons.build_rounded,
        const Color(0xFF94A3B8), const Color(0x2294A3B8));
  if (_any(t, ['premium', 'upgrade', 'subscribe', 'plan']))
    return _CatStyle(Icons.workspace_premium_rounded,
        const Color(0xFFA855F7), const Color(0x33A855F7));
  // default → announcement
  return _CatStyle(Icons.campaign_rounded,
      const Color(AppColors.primary), const Color(0x333B82F6));
}

bool _any(String text, List<String> words) =>
    words.any((w) => text.contains(w));

// ── sheet ─────────────────────────────────────────────────────────────────────

class NotificationsSheet extends StatefulWidget {
  const NotificationsSheet({super.key});

  @override
  State<NotificationsSheet> createState() => _NotificationsSheetState();
}

class _NotificationsSheetState extends State<NotificationsSheet>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  List<NotificationModel> _items = [];
  bool _loading = true;
  String? _error;
  DateTime? _clearedAt;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _load();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        ApiService().get(ApiEndpoints.userNotifications),
        StorageService().getNotificationsClearedAt(),
      ]);
      final raw = (results[0] as Map<String, dynamic>)['data'] as List;
      final clearedAt = results[1] as DateTime?;
      final all = raw.map((e) => NotificationModel.fromJson(e)).toList();
      final visible = clearedAt == null
          ? all
          : all.where((n) => n.createdAt.isAfter(clearedAt)).toList();
      if (mounted) {
        setState(() {
          _clearedAt = clearedAt;
          _items = visible;
          _loading = false;
        });
        if (visible.isNotEmpty) _ctrl.forward();
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'Could not load notifications';
          _loading = false;
        });
      }
    }
  }

  Future<void> _clearAll() async {
    final now = DateTime.now();
    await StorageService().setNotificationsClearedAt(now);
    _ctrl.reset();
    setState(() {
      _clearedAt = now;
      _items = [];
    });
  }

  String _ago(DateTime dt) {
    final d = DateTime.now().difference(dt);
    if (d.inDays >= 7) return '${(d.inDays / 7).floor()}w ago';
    if (d.inDays >= 1) return '${d.inDays}d ago';
    if (d.inHours >= 1) return '${d.inHours}h ago';
    if (d.inMinutes >= 1) return '${d.inMinutes}m ago';
    return 'Just now';
  }

  // ── build ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF0D1117),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        border: Border.all(
          color: Colors.white.withOpacity(0.07),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(AppColors.primary).withOpacity(0.12),
            blurRadius: 40,
            offset: const Offset(0, -8),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildHandle(),
          _buildHeader(),
          const Divider(height: 1, thickness: 1, color: Color(0xFF1E2530)),
          ConstrainedBox(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.of(context).size.height * 0.62,
            ),
            child: _buildBody(),
          ),
          SizedBox(height: MediaQuery.of(context).padding.bottom + 16),
        ],
      ),
    );
  }

  Widget _buildHandle() {
    return Center(
      child: Container(
        margin: const EdgeInsets.only(top: 10, bottom: 6),
        width: 36,
        height: 4,
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.15),
          borderRadius: BorderRadius.circular(2),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    final count = _items.length;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 10, 20, 14),
      child: Row(
        children: [
          // gradient icon
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(AppColors.primary), Color(AppColors.brandRed)],
              ),
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: const Color(AppColors.primary).withOpacity(0.35),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: const Icon(Icons.notifications_rounded,
                color: Colors.white, size: 20),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Notifications',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.3,
                ),
              ),
              if (!_loading && _error == null)
                Text(
                  count == 0
                      ? 'No announcements'
                      : '$count announcement${count != 1 ? 's' : ''}',
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.4),
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
            ],
          ),
          const Spacer(),
          if (!_loading && _items.isNotEmpty) ...[
            // NEW badge
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(AppColors.primary).withOpacity(0.12),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: const Color(AppColors.primary).withOpacity(0.25),
                  width: 0.8,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(
                      color: const Color(AppColors.primary),
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: const Color(AppColors.primary).withOpacity(0.6),
                          blurRadius: 6,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 5),
                  Text(
                    'NEW',
                    style: TextStyle(
                      color: const Color(AppColors.primary),
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            // Clear all button
            GestureDetector(
              onTap: _clearAll,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.05),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: Colors.white.withOpacity(0.1),
                    width: 0.8,
                  ),
                ),
                child: Text(
                  'Clear all',
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.45),
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) return _buildSkeleton();
    if (_error != null) return _buildError();
    if (_items.isEmpty) return _buildEmpty();
    return _buildList();
  }

  // ── skeleton ───────────────────────────────────────────────────────────────

  Widget _buildSkeleton() {
    return ListView.builder(
      shrinkWrap: true,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      itemCount: 3,
      itemBuilder: (_, i) => _SkeletonCard(delay: i * 80),
    );
  }

  // ── error ──────────────────────────────────────────────────────────────────

  Widget _buildError() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: const Color(0xFFEF4444).withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.wifi_off_rounded,
                color: Color(0xFFEF4444), size: 26),
          ),
          const SizedBox(height: 14),
          const Text(
            'Could not load',
            style: TextStyle(
                color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          Text(
            'Check your connection and try again.',
            textAlign: TextAlign.center,
            style: TextStyle(
                color: Colors.white.withOpacity(0.4),
                fontSize: 13,
                height: 1.4),
          ),
          const SizedBox(height: 20),
          GestureDetector(
            onTap: () {
              setState(() {
                _loading = true;
                _error = null;
              });
              _load();
            },
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(AppColors.primary), Color(AppColors.brandRed)],
                ),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Text(
                'Retry',
                style: TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w700),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── empty ──────────────────────────────────────────────────────────────────

  Widget _buildEmpty() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 52, horizontal: 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 68,
            height: 68,
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.04),
              shape: BoxShape.circle,
              border: Border.all(
                color: Colors.white.withOpacity(0.08),
                width: 1,
              ),
            ),
            child: Icon(
              Icons.notifications_off_outlined,
              size: 30,
              color: Colors.white.withOpacity(0.2),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'All caught up!',
            style: TextStyle(
              color: Colors.white.withOpacity(0.7),
              fontSize: 15,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'No announcements right now.\nCheck back later.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.white.withOpacity(0.3),
              fontSize: 13,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }

  // ── list ───────────────────────────────────────────────────────────────────

  Widget _buildList() {
    return ListView.builder(
      shrinkWrap: true,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      itemCount: _items.length,
      itemBuilder: (_, i) {
        // stagger: item i starts at (i * 80ms) into the 600ms animation
        final start = (i * 0.12).clamp(0.0, 0.7);
        final end = (start + 0.45).clamp(0.0, 1.0);
        final slideAnim = Tween<Offset>(
          begin: const Offset(0, 0.25),
          end: Offset.zero,
        ).animate(CurvedAnimation(
          parent: _ctrl,
          curve: Interval(start, end, curve: Curves.easeOutCubic),
        ));
        final fadeAnim = Tween<double>(begin: 0, end: 1).animate(
          CurvedAnimation(
            parent: _ctrl,
            curve: Interval(start, end, curve: Curves.easeOut),
          ),
        );
        return FadeTransition(
          opacity: fadeAnim,
          child: SlideTransition(
            position: slideAnim,
            child: _NotifCard(item: _items[i], ago: _ago(_items[i].createdAt)),
          ),
        );
      },
    );
  }
}

// ── notification card ─────────────────────────────────────────────────────────

class _NotifCard extends StatelessWidget {
  final NotificationModel item;
  final String ago;
  const _NotifCard({required this.item, required this.ago});

  @override
  Widget build(BuildContext context) {
    final style = _catStyle(item.title);

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.03),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: Colors.white.withOpacity(0.07),
          width: 1,
        ),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // left accent bar
              Container(
                width: 3,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      style.color,
                      style.color.withOpacity(0.2),
                    ],
                  ),
                ),
              ),
              // content
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // icon blob
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: style.glow,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: style.color.withOpacity(0.2),
                            width: 1,
                          ),
                        ),
                        child: Icon(style.icon, color: style.color, size: 20),
                      ),
                      const SizedBox(width: 12),
                      // text
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // title row
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Expanded(
                                  child: Text(
                                    item.title,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 14,
                                      fontWeight: FontWeight.w700,
                                      letterSpacing: -0.2,
                                      height: 1.3,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  ago,
                                  style: TextStyle(
                                    color: Colors.white.withOpacity(0.3),
                                    fontSize: 11,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 5),
                            // body
                            Text(
                              item.body,
                              style: TextStyle(
                                color: Colors.white.withOpacity(0.55),
                                fontSize: 13,
                                fontWeight: FontWeight.w400,
                                height: 1.45,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── skeleton card ─────────────────────────────────────────────────────────────

class _SkeletonCard extends StatefulWidget {
  final int delay;
  const _SkeletonCard({required this.delay});

  @override
  State<_SkeletonCard> createState() => _SkeletonCardState();
}

class _SkeletonCardState extends State<_SkeletonCard>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 1200))
      ..repeat(reverse: true);
    _anim = CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _anim,
      builder: (_, __) {
        final opacity = 0.04 + _anim.value * 0.06;
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.03),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
                color: Colors.white.withOpacity(0.07), width: 1),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(opacity),
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      height: 13,
                      width: double.infinity,
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(opacity),
                        borderRadius: BorderRadius.circular(6),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      height: 11,
                      width: 180,
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(opacity * 0.7),
                        borderRadius: BorderRadius.circular(6),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
