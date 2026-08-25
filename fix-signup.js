const fs = require('fs');
const file = 'mobile/lib/screens/signup_screen.dart';
let content = fs.readFileSync(file, 'utf8');

// Remove Mobile controller
content = content.replace(/final _mobileController = TextEditingController\(\);\n/, '');
content = content.replace(/_mobileController\.dispose\(\);\n/, '');

// Remove Confirm Password controller
content = content.replace(/final _confirmPasswordController = TextEditingController\(\);\n/, '');
content = content.replace(/_confirmPasswordController\.dispose\(\);\n/, '');

// Replace Mobile textfield block
content = content.replace(/TextField\(controller: _mobileController[\s\S]*?SizedBox\(height: 16\),/m, '');

// Replace Confirm Password block
content = content.replace(/TextField\(\s*controller: _confirmPasswordController[\s\S]*?SizedBox\(height: 16\),/m, '');

// Fix register call: remove mobile and confirm password
content = content.replace(/final mobile = _mobileController\.text\.trim\(\);\n\s*final confirmPassword = _confirmPasswordController\.text;/, '');
content = content.replace(/if \(name\.isEmpty[\s\S]*?confirmPassword\.isEmpty\) \{[\s\S]*?return;\n\s*\}/m, "if (name.isEmpty || email.isEmpty || password.isEmpty) { ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please fill all fields'))); return; }");

content = content.replace(/if \(password != confirmPassword\) \{[\s\S]*?return;\n\s*\}/m, '');
content = content.replace(/context\.read<AuthCubit>\(\)\.register\(name, email, mobile, password\);/, "context.read<AuthCubit>().register(name, email, '', password);");

fs.writeFileSync(file, content);
