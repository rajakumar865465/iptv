const fs = require('fs');
let file = 'mobile/lib/cubits/auth_cubit.dart';
let content = fs.readFileSync(file, 'utf8');

content = content.replace("emit(AuthAuthenticated(result));", "emit(AuthAuthenticated());");

fs.writeFileSync(file, content);

// Also need to check signup_screen.dart to see if it still has `register`
file = 'mobile/lib/screens/signup_screen.dart';
content = fs.readFileSync(file, 'utf8');
content = content.replace(/context\.read<AuthCubit>\(\)\.register\(/g, "context.read<AuthCubit>().signup(");
fs.writeFileSync(file, content);

