class UserModel {
  final int id;
  final String fullName;
  final String email;
  final String mobile;
  final String status;
  final String role;
  final DateTime createdAt;
  final DateTime? lastLoginAt;

  UserModel({
    required this.id,
    required this.fullName,
    required this.email,
    required this.mobile,
    required this.status,
    required this.role,
    required this.createdAt,
    this.lastLoginAt,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'],
      fullName: json['full_name'],
      email: json['email'],
      mobile: json['mobile'],
      status: json['status'],
      role: json['role'] ?? 'user',
      createdAt: DateTime.parse(json['created_at']),
      lastLoginAt: json['last_login_at'] != null ? DateTime.parse(json['last_login_at']) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'full_name': fullName,
      'email': email,
      'mobile': mobile,
      'status': status,
      'role': role,
      'created_at': createdAt.toIso8601String(),
      'last_login_at': lastLoginAt?.toIso8601String(),
    };
  }
}
