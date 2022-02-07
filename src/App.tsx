import React from "react";

const singleWorker: Worker = new Worker(new URL("worker.ts", import.meta.url), {
  type: "module",
});

type Task = {
  cmd: string;
  cb: (value: any) => void;
};

class WorkerPool {
  _workers: Worker[];
  _avail: boolean[];
  _queue: Task[];

  constructor() {
    this._workers = [];
    this._avail = [];
    this._queue = [];
  }

  load(count: number, readycb: () => void) {
    this._workers = [];
    this._avail = [];
    this._queue = [];
    let readycount = 0
    for (let i = 0; i < count; i++) {
      this._workers.push(
        new Worker(new URL("worker.ts", import.meta.url), {
          type: "module",
        })
      );
      this._avail.push(false);
      this._workers[i].onmessage = (ev) => {
        if (ev.data === "ready") {
          this._avail[i] = true;
          readycount++
          console.log("worker " + i + " is now ready");
          //check how many ready
          if (readycount == count) {
            //call back
            readycb()
          }
        }
      };
    }
  }

  setCfg(cfg: string) {
    for (let i = 0; i < this._workers.length; i++) {
      this._workers[i].postMessage(cfg);
    }
  }

  queue(t: Task) {
    //add it to queue
    this._queue.push(t);
    //try popping
    this.pop();
  }

  private pop() {
    // console.log("looking for worker to do work: ", this);
    if (this._queue.length == 0) {
      return;
    }
    //find free worker
    let ind = -1;
    for (let i = 0; i < this._avail.length; i++) {
      if (this._avail[i]) {
        ind = i;
        break;
      }
    }

    if (ind === -1) {
      return;
    }

    //pop from slice
    const task = this._queue[0];
    this._queue = this._queue.slice(1, this._queue.length);
    this.run(ind, task);
  }

  //ask current worker to run a task
  private run(workerIndex: number, task: Task) {
    this._avail[workerIndex] = false;
    let w = this._workers[workerIndex];
    w.postMessage(task.cmd);
    w.onmessage = (ev) => {
      task.cb(ev.data);
      this._avail[workerIndex] = true;
      // console.log("worker done: ", this);
      //try popping maybe there's more
      this.pop();
    };
  }
}

function Dash({ pool, maxWorker } : { pool : WorkerPool, maxWorker: number }) {
  // const [count, setCount] = React.useState(0);
  const [cfg, setCfg] = React.useState<string>(test);
  const [iters, setIters] = React.useState<number>(1000);
  const [workers, setWorkers] = React.useState<number>(maxWorker);
  const [result, setResult] = React.useState<number>(-1);
  const [progress, setProgress] = React.useState<number>(-1);
  const [runtime, setRuntime] = React.useState<number>(-1)
  const [calcMode, setCalcMode] = React.useState<boolean>(false);
  const [errMsg, setErrMsg] = React.useState<string>("")

  const runThreaded = () => {
    setResult(-1);
    setRuntime(-1)
    console.log("start running threaded");
    let queued = 0;
    let done = 0;
    let avg = 0;
    const runcmd = calcMode ? "runcalc" : "run"
    const dbgcmd = calcMode ? "debugcalc" : "debug"
    const startTime = window.performance.now();
    console.time("sim");
    //set config first
    pool.setCfg(cfg);
    const cbFunc = (val: any) => {
      //parse the result
      const res = JSON.parse(val);
      // console.log(
      //   "finish a run, result: " + res.dps,
      //   "done",
      //   done,
      //   "queue",
      //   queued
      // );
      avg += res.dps;

      done++;

      if (done == iters) {
        //done now
        console.log("done running");
        console.timeEnd("sim");
        const end = window.performance.now();
        setRuntime(end-startTime)
        avg = avg / iters;
        setResult(avg);
        setProgress(-1)
        return;
      }

      //check progress
      const per = Math.floor(20 * done / iters)
      if (per > progress) {
        setProgress(per)
      }


      //otherwise check if we need to queue more
      if (queued < iters) {
        //queue another worker
        queued++;
        pool.queue({ cmd: runcmd, cb: cbFunc });
      }
      //otherwise do nothing
    };
    const debugCB = (val: any) => {
      const res = JSON.parse(val);
      if (res.err) {
        setErrMsg(res.err)
        return;
      }
      console.log("finish debug run: ", res);
    };
    //queue up a debug run first
    pool.queue({ cmd: dbgcmd, cb: debugCB });
    //queue up to number of workers - 1 (for debug)
    let count = workers - 1;
    if (count > iters) {
      count = iters;
    }
    for (; queued < count; queued++) {
      pool.queue({ cmd: runcmd, cb: cbFunc });
    }
  };
  return (
    <div>
      <h1>Run</h1>
      <br />
      <textarea
        value={cfg}
        onChange={(e) => {
          setCfg(e.target.value);
        }}
        rows={10}
        cols={90}
      />
      <br />
      iterations:{" "}
      <input
        value={iters}
        onChange={(e) => {
          setIters(parseInt(e.target.value));
        }}
      />
      <br />
      workers (1 to 8):{" "}
      <input
        value={workers}
        onChange={(e) => {
          let val = parseInt(e.target.value);
          if (val === NaN) {
            val = 1;
          } else if (val > maxWorker) {
            val = maxWorker;
          } else if (val < 1) {
            val = 1;
          }
          setWorkers(val);
        }}
      />
      <br />
      Calc mode: <input type="checkbox" checked={calcMode} onChange={() => {setCalcMode(!calcMode)}} />
      <br />
      <button onClick={runThreaded}>run</button>
      <br />
      {progress !== -1 && errMsg === "" ? <p>Running... progress: {progress * 5} %</p> : null}
      {errMsg === "" ?  result !== -1 ? <p>Run completed in {runtime}ms. Average dps: {result}</p> : null : <p>Error encountered: {errMsg}</p>}
    </div>
  );
}

export function App() {
  const [pool, setPool] = React.useState<WorkerPool|null>(null)
  const workerCount = 8;
  React.useEffect(() => {
    let pool = new WorkerPool
    pool.load(workerCount, () => {setPool(pool)})
  }, [])
  if (pool == null) {
    return <div> loading app...</div>
  }
 return (
   <Dash pool={pool} maxWorker={workerCount} />
 )
}

const test = `
options debug=true iteration=20000 duration=90 workers=24;
bennett char lvl=70/80 cons=2 talent=6,8,8; 
bennett add weapon="favoniussword" refine=1 lvl=90/90;
bennett add set="noblesseoblige" count=4;
bennett add stats hp=4780 atk=311 er=0.518 pyro%=0.466 cr=0.311 ; #main
bennett add stats hp=926 hp%=0.21 atk=121 atk%=0.47800000000000004 def=60 em=42 er=0.052000000000000005 cr=0.186 cd=0.327 ; #subs

raidenshogun char lvl=90/90 cons=1 talent=10,10,10; 
raidenshogun add weapon="engulfinglightning" refine=1 lvl=90/90;
raidenshogun add set="emblemofseveredfate" count=4;
raidenshogun add stats hp=4780 atk=311 er=0.518 electro%=0.466 cr=0.311 ; #main
raidenshogun add stats hp=299 hp%=0.053 atk=101 atk%=0.192 def%=0.073 em=42 er=0.148 cr=0.261 cd=1.119 ; #subs

xiangling char lvl=80/90 cons=6 talent=6,9,10; 
xiangling add weapon="staffofhoma" refine=1 lvl=90/90;
xiangling add set="crimsonwitchofflames" count=2;
xiangling add set="gladiatorsfinale" count=2;
xiangling add stats hp=4780 atk=311 er=0.518 pyro%=0.466 cr=0.311 ; #main
xiangling add stats hp=478 hp%=0.047 atk=65 atk%=0.152 def=76 def%=0.051 em=63 er=0.16199999999999998 cr=0.264 cd=0.9960000000000001 ; #subs

xingqiu char lvl=80/90 cons=6 talent=1,9,10; 
xingqiu add weapon="sacrificialsword" refine=5 lvl=90/90;
xingqiu add set="noblesseoblige" count=2;
xingqiu add set="gladiatorsfinale" count=2;
xingqiu add stats hp=4780 atk=311 atk%=0.466 hydro%=0.466 cr=0.311 ; #main
xingqiu add stats hp=299 hp%=0.08199999999999999 atk=78 atk%=0.449 def=63 def%=0.073 em=94 er=0.065 cr=0.15899999999999997 cd=0.831 ; #subs


##Default Enemy
target lvl=100 resist=.1;
# target lvl=100 resist=.1;

##Actions List
active raidenshogun;

# HP particle simulation. Per srl:
# it adds 1 particle randomly, uniformly distributed between 200 to 300 frames after the last time an energy drops
# so in the case above, it adds on avg one particle every 250 frames in effect
# so over 90s of combat that's 90 * 60 / 250 = 21.6 on avg
energy every interval=200,300 amount=1;

raidenshogun attack,attack,attack,attack,dash,attack,attack,attack,attack,dash,attack,attack,attack,attack,dash,attack,attack,charge  +if=.status.raidenburst>0;

# Additional check to reset at the start of the next rotation
raidenshogun skill  +if=.status.xianglingburst==0&&.energy.xingqiu>70&&.energy.xiangling>70;
raidenshogun skill  +if=.status.raidenskill==0;

# Skill is required before burst to activate Kageuchi. Otherwise ER is barely not enough
# For rotations #2 and beyond, need to ensure that Guoba is ready to go. Guoba timing is about 300 frames after XQ fires his skill
xingqiu skill[orbital=1],burst[orbital=1],attack  +if=.cd.xiangling.skill<300;

# Bennett burst goes after XQ burst for uptime alignment. Attack to proc swords
bennett burst,attack,skill  +if=.status.xqburst>0&&.cd.xiangling.burst<180;

# Only ever want to XL burst in Bennett buff and after XQ burst for uptime alignment
xiangling burst,attack,skill,attack,attack  +if=.status.xqburst>0&&.status.btburst>0;
# Second set of actions needed in case Guoba CD comes off while pyronado is spinning
xiangling burst,attack  +if=.status.xqburst>0&&.status.btburst>0;
xiangling skill ;

# Raiden must burst after all others. Requires an attack to allow Bennett buff to apply
raidenshogun burst  +if=.status.xqburst>0&&.status.xianglingburst>0&&.status.btburst>0;

# Funnelling
bennett attack,skill  +if=.status.xqburst>0&&.energy.xiangling<70 +swap_to=xiangling;
bennett skill  +if=.energy.xiangling<70 +swap_to=xiangling;
bennett skill  +if=.energy.xingqiu<80 +swap_to=xingqiu;
bennett attack,skill  +if=.status.xqburst>0 +if=.energy.raidenshogun<90 +swap_to=raidenshogun;

xingqiu attack  +if=.status.xqburst>0;
xiangling attack  +is_onfield;
bennett attack  +is_onfield;
xingqiu attack  +is_onfield;
raidenshogun attack  +is_onfield;
`;
