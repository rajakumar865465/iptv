import 'package:flutter/material.dart';
import '../../constants.dart';
import '../../models/user_model.dart';

/// Premium profile header card with gradient background, avatar, name, email
/// and account-type badge.
class ProfileHeaderCard extends StatelessWidget {
  final UserModel? user;
  final String accountType;
  final Color accountColor;
  final VoidCallback? onEditTap;

  const ProfileHeaderCard({
    super.key,
    required this.user,
    required this.accountType,
    required this.accountColor,
    this.onEditTap,
  });

  String get _name => user?.fullName ?? 'NivaTV User';
  String get _email => user?.email ?? '';
  String get _mobile => user?.mobile ?? '';

  String get _initial {
    final n = _name.trim();
    if (n.isEmpty) return 'N';
    return n[0].toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFF11183A),
            Color(0xFF1A0F3A),
            Color(0xFF0D1026),
          ],
          stops: [0.0, 0.55, 1.0],
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: const Color(AppColors.primary).withOpacity(0.18),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(AppColors.primary).withOpacity(0.18),
            blurRadius: 28,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Stack(
        children: [
          // Decorative glow
          Positioned(
            top: -20,
            right: -20,
            child: Container(
              width: 100,
              height: 100,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(AppColors.primary).withOpacity(0.12),
                boxShadow: [
                  BoxShadow(
                    color: const Color(AppColors.primary).withOpacity(0.18),
                    blurRadius: 50,
                    spreadRadius: 10,
                  ),
                ],
              ),
            ),
          ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // Avatar
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      Color(AppColors.primary),
                      Color(AppColors.brandRed),
                    ],
                  ),
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: Colors.white.withOpacity(0.18),
                    width: 2,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(AppColors.primary).withOpacity(0.4),
                      blurRadius: 16,
                      offset: const Offset(0, 5),
                    ),
                  ],
                ),
                alignment: Alignment.center,
                child: Text(
                  _initial,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 26,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              const SizedBox(width: 16),
              // Info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _name,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                        letterSpacing: -0.3,
                        height: 1.2,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (_email.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        _email,
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.7),
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                    if (_mobile.isNotEmpty && _email.isEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        _mobile,
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.7),
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: accountColor.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: accountColor.withOpacity(0.35),
                          width: 0.8,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 7,
                            height: 7,
                            decoration: BoxDecoration(
                              color: accountColor,
                              shape: BoxShape.circle,
                              boxShadow: [
                                BoxShadow(
                                  color: accountColor.withOpacity(0.5),
                                  blurRadius: 6,
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            accountType,
                            style: TextStyle(
                              color: accountColor,
                              fontSize: 11.5,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.2,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              // Edit icon
              if (onEditTap != null)
                GestureDetector(
                  onTap: onEditTap,
                  child: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.08),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: Colors.white.withOpacity(0.1),
                        width: 0.8,
                      ),
                    ),
                    child: const Icon(
                      Icons.edit_rounded,
                      color: Colors.white70,
                      size: 16,
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
