import afile from "./a";

function a() {
  console.log(afile);
  console.log("a");
}

async function b() {
  a();
  console.log("b");
  return new Promise(1);
}

if (__DEV__) {
  console.log("this is dev");
}

export default b;
