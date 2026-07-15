const { jwtVerify } = require('jose');
async function test() {
  const strings = [
    undefined,
    "undefined",
    "null",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsImVtYWlsIjoic3VwZXJhZG1pbkBuaXZhdHYuaW4iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3ODM5Mzk5MDEsImV4cCI6MTc4NDAyNjMwMX0", // 2 parts
    "%22eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsImVtYWlsIjoic3VwZXJhZG1pbkBuaXZhdHYuaW4iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3ODM5Mzk5MDEsImV4cCI6MTc4NDAyNjMwMX0.hdAp9JTi49CQpGXjXe0dVi35zeaIlSe558yKqgtWCrE", // with %22
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsImVtYWlsIjoic3VwZXJhZG1pbkBuaXZhdHYuaW4iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3ODM5Mzk5MDEsImV4cCI6MTc4NDAyNjMwMX0.hdAp9JTi49CQpGXjXe0dVi35zeaIlSe558yKqgtWCrE%22", // with %22 at end
  ];
  for (let s of strings) {
    try {
      await jwtVerify(s, new TextEncoder().encode('dummy'));
      console.log(s, '=> OK');
    } catch(e) {
      console.log(s, '=>', e.code);
    }
  }
}
test();
