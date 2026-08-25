const fs = require('fs');
let file = 'mobile/lib/screens/signup_screen.dart';
let content = fs.readFileSync(file, 'utf8');

content = content.replace("state is AuthLoading ? null : () => context.read<AuthCubit>().loginWithGoogle()", "context.read<AuthCubit>().state is AuthLoading ? null : () => context.read<AuthCubit>().loginWithGoogle()");
content = content.replace("context.watch<AuthCubit>().state is AuthLoading ? null : () => context.read<AuthCubit>().loginWithGoogle()", "context.read<AuthCubit>().state is AuthLoading ? null : () => context.read<AuthCubit>().loginWithGoogle()");

fs.writeFileSync(file, content);
