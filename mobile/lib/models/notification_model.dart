class NotificationModel {
  final int id;
  final String title;
  final String body;
  final String? imageUrl;
  final String? actionUrl;
  final DateTime createdAt;

  NotificationModel({
    required this.id,
    required this.title,
    required this.body,
    this.imageUrl,
    this.actionUrl,
    required this.createdAt,
  });

  factory NotificationModel.fromJson(Map<String, dynamic> json) {
    return NotificationModel(
      id: json['id'],
      title: json['title'] ?? '',
      body: json['body'] ?? '',
      imageUrl: json['image_url'],
      actionUrl: json['action_url'],
      createdAt: DateTime.parse(json['created_at']),
    );
  }
}
