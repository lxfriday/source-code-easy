function a() {
  console.log("a");
}

async function b() {
  a();
  console.log("b");
  return new Promise(1);
}

export default b;
