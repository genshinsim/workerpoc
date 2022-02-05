// let url = process.env.PUBLIC_URL + "/wasm_exec.js";
// @ts-ignore
import("~/wasm_exec.js");

if (!WebAssembly.instantiateStreaming) {
  // polyfill
  WebAssembly.instantiateStreaming = async (resp, importObject) => {
    const source = await (await resp).arrayBuffer();
    return await WebAssembly.instantiate(source, importObject);
  };
}

//@ts-ignore
const go = new Go(); // Defined in wasm_exec.js. Don't forget to add this in your index.html.

let inst: WebAssembly.Instance;
WebAssembly.instantiateStreaming(fetch("/main.wasm"), go.importObject)
  .then((result) => {
    inst = result.instance;
    go.run(inst);
    // console.log("worker loaded ok");
  })
  .catch((err) => {
    console.error(err);
  });

onmessage = async (ev) => {
  // console.log(ev.data);
  //@ts-ignore
  const addResult = inst.exports.fib(30);

  // Set the result onto the body
  // console.log("done adding: ", addResult);
  postMessage(addResult);
};
