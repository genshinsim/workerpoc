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


declare function sim(): string;
declare function debug(): string;
declare function setcfg(
  content: string
): string;

let inst: WebAssembly.Instance;
WebAssembly.instantiateStreaming(fetch("/main.wasm"), go.importObject)
  .then((result) => {
    inst = result.instance;
    go.run(inst);
    // console.log("worker loaded ok");
    postMessage("ready")
  })
  .catch((err) => {
    console.error(err);
  });

onmessage = async (ev) => {
  // console.log(ev.data);
  switch (ev.data) {
    case "run":
      const simres = sim()
      postMessage(simres)
      break;
    case "debug":
      const d = debug()
      postMessage(d)
      break;
    default:
      const ok = setcfg(ev.data)
      console.log("done setting config: " +  ok)
  }
};
