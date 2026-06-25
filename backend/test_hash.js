const bcrypt = require('bcryptjs');

const hash = '$2b$10$CZNaCoUk2YH2XINwGzFNwOX3DYVPGzdUzkdk9XFfIcmTr51D0N1c.';
bcrypt.compare('password', hash).then(res => {
  console.log('Match with "password":', res);
});
bcrypt.compare('demo12@gmail.com', hash).then(res => {
  console.log('Match with "demo12@gmail.com":', res);
});
