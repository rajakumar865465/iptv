const fs = require('fs');
let file = 'mobile/lib/cubits/auth_cubit.dart';
let content = fs.readFileSync(file, 'utf8');

content = content.replace("GoogleSignIn(scopes: ['email'])", "GoogleSignIn(scopes: const <String>['email'])");

fs.writeFileSync(file, content);
